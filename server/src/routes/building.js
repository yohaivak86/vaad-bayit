const express = require('express');
const prisma = require('../lib/prisma');
const { getBuilding, getBalance } = require('../lib/calc');
const { hashPassword } = require('../lib/auth');
const { generateInviteCode } = require('../lib/inviteCode');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const building = await getBuilding(req.buildingId);
  if (!building) return res.status(404).json({ error: 'בניין לא נמצא' });
  res.json(building);
});

router.put('/', async (req, res) => {
  const {
    name, address, floors, apartmentsCount, monthlyFeeDefault,
    openingBalanceCash, openingBalanceDigital, openingBalanceDate,
    elevatorsCount, electricityBenchmark, cleaningBenchmark, gardeningBenchmark,
  } = req.body;

  const updated = await prisma.building.update({
    where: { id: req.buildingId },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(floors !== undefined && { floors: Number(floors) }),
      ...(apartmentsCount !== undefined && { apartmentsCount: Number(apartmentsCount) }),
      ...(monthlyFeeDefault !== undefined && { monthlyFeeDefault: Number(monthlyFeeDefault) }),
      ...(openingBalanceCash !== undefined && { openingBalanceCash: Number(openingBalanceCash) }),
      ...(openingBalanceDigital !== undefined && { openingBalanceDigital: Number(openingBalanceDigital) }),
      ...(openingBalanceDate !== undefined && { openingBalanceDate: new Date(openingBalanceDate) }),
      ...(elevatorsCount !== undefined && { elevatorsCount: Number(elevatorsCount) }),
      ...(electricityBenchmark !== undefined && { electricityBenchmark: Number(electricityBenchmark) }),
      ...(cleaningBenchmark !== undefined && { cleaningBenchmark: Number(cleaningBenchmark) }),
      ...(gardeningBenchmark !== undefined && { gardeningBenchmark: Number(gardeningBenchmark) }),
      isConfigured: true,
    },
  });
  res.json(updated);
});

router.get('/balance', async (req, res) => {
  const balance = await getBalance(req.buildingId);
  res.json(balance);
});

// Invalidates the current invite code (e.g. if it leaked) and issues a fresh one.
router.post('/invite-code/regenerate', async (req, res) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.building.update({
        where: { id: req.buildingId },
        data: { inviteCode: generateInviteCode() },
      });
      return res.json({ inviteCode: updated.inviteCode });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
  res.status(500).json({ error: 'לא הצלחנו ליצור קוד הזמנה, נסו שוב' });
});

const VALID_ROLES = ['ADMIN', 'VIEWER'];

// Co-admins/viewers of this specific building (a committee typically has more than one member).
router.get('/admins', async (req, res) => {
  const memberships = await prisma.buildingAdmin.findMany({
    where: { buildingId: req.buildingId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(memberships.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role })));
});

router.post('/admins', async (req, res) => {
  const { email, name, password, role } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'email ו-name הם שדות חובה' });
  const membershipRole = role && VALID_ROLES.includes(role) ? role : 'ADMIN';

  const normalizedEmail = email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'עבור משתמש חדש נדרשת סיסמה של לפחות 8 תווים' });
    }
    user = await prisma.user.create({
      data: { email: normalizedEmail, name, passwordHash: await hashPassword(password), role: 'BUILDING_ADMIN' },
    });
  }

  const existingMembership = await prisma.buildingAdmin.findUnique({
    where: { userId_buildingId: { userId: user.id, buildingId: req.buildingId } },
  });
  if (existingMembership) return res.status(409).json({ error: 'המשתמש כבר משויך לבניין הזה' });

  await prisma.buildingAdmin.create({ data: { userId: user.id, buildingId: req.buildingId, role: membershipRole } });
  res.status(201).json({ userId: user.id, name: user.name, email: user.email, role: membershipRole });
});

router.put('/admins/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  const { role } = req.body;
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'role חייב להיות ADMIN או VIEWER' });

  if (role === 'VIEWER') {
    const remainingAdmins = await prisma.buildingAdmin.count({ where: { buildingId: req.buildingId, role: 'ADMIN', userId: { not: userId } } });
    if (remainingAdmins === 0) return res.status(400).json({ error: 'לא ניתן להשאיר את הבניין ללא אף אדמין עם הרשאת עריכה' });
  }

  const updated = await prisma.buildingAdmin.update({
    where: { userId_buildingId: { userId, buildingId: req.buildingId } },
    data: { role },
  });
  res.json({ userId, role: updated.role });
});

router.delete('/admins/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  const remainingAdmins = await prisma.buildingAdmin.count({ where: { buildingId: req.buildingId, role: 'ADMIN', userId: { not: userId } } });
  if (remainingAdmins === 0) {
    return res.status(400).json({ error: 'לא ניתן להסיר את האדמין האחרון של הבניין' });
  }
  await prisma.buildingAdmin.delete({
    where: { userId_buildingId: { userId, buildingId: req.buildingId } },
  }).catch(() => null);
  res.status(204).end();
});

module.exports = router;
