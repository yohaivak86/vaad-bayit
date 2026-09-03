const express = require('express');
const prisma = require('../lib/prisma');
const { hashPassword, verifyPassword, signToken, setSessionCookie, clearSessionCookie } = require('../lib/auth');
const { requireAuth } = require('../middleware/auth');
const { generateInviteCode } = require('../lib/inviteCode');

const router = express.Router();

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function createUserAccount(tx, { email, password, name }) {
  if (!email || !password || !name) {
    throw Object.assign(new Error('email, password ו-name הם שדות חובה'), { status: 400 });
  }
  if (password.length < 8) {
    throw Object.assign(new Error('הסיסמה חייבת להכיל לפחות 8 תווים'), { status: 400 });
  }
  const normalizedEmail = email.toLowerCase();
  const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw Object.assign(new Error('כתובת האימייל כבר רשומה במערכת'), { status: 409 });

  return tx.user.create({
    data: { email: normalizedEmail, passwordHash: await hashPassword(password), name, role: 'BUILDING_ADMIN' },
  });
}

// Self-service signup: creates a brand-new building together with its first admin.
router.post('/register', async (req, res) => {
  const { email, password, name, buildingName, buildingAddress } = req.body;
  if (!buildingName) return res.status(400).json({ error: 'buildingName הוא שדה חובה' });

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const user = await createUserAccount(tx, { email, password, name });
      const building = await tx.building.create({
        data: { name: buildingName, address: buildingAddress || '', inviteCode: generateInviteCode() },
      });
      await tx.buildingAdmin.create({ data: { userId: user.id, buildingId: building.id } });
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
router.post('/join-building', async (req, res) => {
  const { email, password, name, inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'inviteCode הוא שדה חובה' });

  const building = await prisma.building.findUnique({ where: { inviteCode: inviteCode.toUpperCase().trim() } });
  if (!building) return res.status(404).json({ error: 'קוד ההזמנה לא תקין' });

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const newUser = await createUserAccount(tx, { email, password, name });
      await tx.buildingAdmin.create({ data: { userId: newUser.id, buildingId: building.id } });
      return newUser;
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const token = signToken(user);
  setSessionCookie(res, token);
  res.status(201).json({ user: publicUser(user), buildingId: building.id, buildingName: building.name });
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
