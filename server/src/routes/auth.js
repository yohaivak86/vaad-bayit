const express = require('express');
const prisma = require('../lib/prisma');
const { hashPassword, verifyPassword, signToken, setSessionCookie, clearSessionCookie } = require('../lib/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// Self-service signup: creates a brand-new building together with its first admin.
router.post('/register', async (req, res) => {
  const { email, password, name, buildingName, buildingAddress } = req.body;
  if (!email || !password || !name || !buildingName) {
    return res.status(400).json({ error: 'email, password, name ו-buildingName הם שדות חובה' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 8 תווים' });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'כתובת האימייל כבר רשומה במערכת' });

  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const building = await tx.building.create({
      data: { name: buildingName, address: buildingAddress || '' },
    });
    const user = await tx.user.create({
      data: { email: email.toLowerCase(), passwordHash, name, role: 'BUILDING_ADMIN' },
    });
    await tx.buildingAdmin.create({ data: { userId: user.id, buildingId: building.id } });
    return { user, building };
  });

  const token = signToken(result.user);
  setSessionCookie(res, token);
  res.status(201).json({ user: publicUser(result.user), buildingId: result.building.id });
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
