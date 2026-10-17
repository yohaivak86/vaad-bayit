const crypto = require('crypto');
const express = require('express');
const prisma = require('../lib/prisma');
const { sendEmail } = require('../lib/email');
const { hashPassword, verifyPassword, signToken, setSessionCookie, clearSessionCookie } = require('../lib/auth');
const { requireAuth } = require('../middleware/auth');
const { generateInviteCode } = require('../lib/inviteCode');

const router = express.Router();

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role };
}

async function createUserAccount(tx, { email, password, name, phone, marketingConsent }) {
  if (!email || !password || !name || !phone) {
    throw Object.assign(new Error('email, password, name ו-phone הם שדות חובה'), { status: 400 });
  }
  if (password.length < 8) {
    throw Object.assign(new Error('הסיסמה חייבת להכיל לפחות 8 תווים'), { status: 400 });
  }
  const normalizedEmail = email.toLowerCase();
  const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw Object.assign(new Error('כתובת האימייל כבר רשומה במערכת'), { status: 409 });

  return tx.user.create({
    data: { email: normalizedEmail, passwordHash: await hashPassword(password), name, phone, role: 'BUILDING_ADMIN', marketingConsent: Boolean(marketingConsent) },
  });
}

// Self-service signup: creates a brand-new building together with its first admin.
router.post('/register', async (req, res) => {
  const { email, password, name, phone, buildingName, buildingAddress, marketingConsent, complexInviteCode } = req.body;
  if (!buildingName) return res.status(400).json({ error: 'buildingName הוא שדה חובה' });

  // Optional: attach the new building to an existing complex right away (it can also be
  // attached - or detached - later from the building profile).
  let complex = null;
  if (complexInviteCode && complexInviteCode.trim()) {
    complex = await prisma.complex.findUnique({ where: { inviteCode: complexInviteCode.toUpperCase().trim() } });
    if (!complex) return res.status(404).json({ error: 'קוד ההזמנה למתחם לא תקין' });
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const user = await createUserAccount(tx, { email, password, name, phone, marketingConsent });
      const building = await tx.building.create({
        data: { name: buildingName, address: buildingAddress || '', inviteCode: generateInviteCode() },
      });
      await tx.buildingAdmin.create({ data: { userId: user.id, buildingId: building.id, role: 'COMMITTEE' } });
      if (complex) await tx.complexMember.create({ data: { complexId: complex.id, buildingId: building.id } });
      return { user, building };
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const token = signToken(result.user);
  setSessionCookie(res, token);
  res.status(201).json({ user: publicUser(result.user), buildingId: result.building.id });
});

// Self-service signup for a NEW user joining an EXISTING building via its invite code.
// The membership starts PENDING - an existing admin of that building must approve it
// (and choose its role) before the new user gets any access.
router.post('/join-building', async (req, res) => {
  const { email, password, name, phone, inviteCode, marketingConsent } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'inviteCode הוא שדה חובה' });

  const building = await prisma.building.findUnique({ where: { inviteCode: inviteCode.toUpperCase().trim() } });
  if (!building) return res.status(404).json({ error: 'קוד ההזמנה לא תקין' });

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const newUser = await createUserAccount(tx, { email, password, name, phone, marketingConsent });
      await tx.buildingAdmin.create({ data: { userId: newUser.id, buildingId: building.id, status: 'PENDING' } });
      return newUser;
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const token = signToken(user);
  setSessionCookie(res, token);
  res.status(201).json({ user: publicUser(user), buildingId: building.id, buildingName: building.name, pending: true });
});

// Step one of the new-user flow: just the account. What the user does next - join an existing
// building (by invite code or search) or open a new one - happens signed in, via /api/buildings.
router.post('/signup', async (req, res) => {
  const { email, password, name, phone, marketingConsent } = req.body;
  let user;
  try {
    user = await prisma.$transaction((tx) => createUserAccount(tx, { email, password, name, phone, marketingConsent }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
  setSessionCookie(res, signToken(user));
  res.status(201).json({ user: publicUser(user) });
});

const RESET_TTL_MS = 60 * 60 * 1000;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Always answers the same way, so the form can't be used to find out which e-mails are registered.
router.post('/forgot', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const reply = { ok: true };
  if (!email) return res.status(400).json({ error: 'יש להזין כתובת אימייל' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json(reply);

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });

  const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const link = `${base}/?reset=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'איפוס סיסמה - ועד בית',
    text: `שלום ${user.name},\n\nהתקבלה בקשה לאיפוס הסיסמה שלך. הקישור תקף לשעה:\n${link}\n\nאם לא ביקשת איפוס - אפשר להתעלם מההודעה.`,
  });

  // Test hook only: lets the automated tests finish the flow without a mailbox.
  if (process.env.EXPOSE_RESET_TOKEN === '1') reply.devToken = token;
  res.json(reply);
});

router.post('/reset', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token ו-password הם שדות חובה' });
  if (password.length < 8) return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 8 תווים' });

  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(String(token)) }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return res.status(400).json({ error: 'הקישור לא תקף או שפג תוקפו - בקשו איפוס חדש' });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    // Any other outstanding link for this user dies with this one.
    prisma.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  setSessionCookie(res, signToken(reset.user));
  res.json({ user: publicUser(reset.user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email ו-password הם שדות חובה' });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });

  const token = signToken(user);
  setSessionCookie(res, token);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
