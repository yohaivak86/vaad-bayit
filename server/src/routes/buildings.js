const express = require('express');
const prisma = require('../lib/prisma');
const { hashPassword } = require('../lib/auth');
const { requireAuth } = require('../middleware/auth');
const { generateInviteCode } = require('../lib/inviteCode');

const router = express.Router();

// Buildings the logged-in user can access: all of them for SUPER_ADMIN, only their own otherwise.
// Each building carries the caller's own access level (role) so the client can hide edit UI for viewers.
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'SUPER_ADMIN') {
    const buildings = await prisma.building.findMany({ orderBy: { name: 'asc' } });
    return res.json(buildings.map((b) => ({ ...b, role: 'ADMIN', status: 'ACTIVE' })));
  }
  const memberships = await prisma.buildingAdmin.findMany({
    where: { userId: req.user.id },
    include: { building: true },
    orderBy: { building: { name: 'asc' } },
  });
  res.json(memberships.map((m) => ({ ...m.building, role: m.role, status: m.status })));
});

// SUPER_ADMIN only: provision a new building and its admin account.
router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'פעולה זו מיועדת למנהל-על בלבד' });

  const { name, address, adminEmail, adminName, adminPassword } = req.body;
  if (!name || !adminEmail || !adminName || !adminPassword) {
    return res.status(400).json({ error: 'name, adminEmail, adminName ו-adminPassword הם שדות חובה' });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 8 תווים' });
  }

  const email = adminEmail.toLowerCase();
  const result = await prisma.$transaction(async (tx) => {
    const building = await tx.building.create({ data: { name, address: address || '', inviteCode: generateInviteCode() } });

    let user = await tx.user.findUnique({ where: { email } });
    if (!user) {
      user = await tx.user.create({
        data: { email, name: adminName, passwordHash: await hashPassword(adminPassword), role: 'BUILDING_ADMIN' },
      });
    }
    await tx.buildingAdmin.create({ data: { userId: user.id, buildingId: building.id } });
    return building;
  });

  res.status(201).json(result);
});

module.exports = router;
