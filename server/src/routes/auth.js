const express = require('express');
const prisma = require('../lib/prisma');
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
