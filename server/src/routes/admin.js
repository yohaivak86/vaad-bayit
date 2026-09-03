const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'פעולה זו מיועדת למנהל-על בלבד' });
  next();
}
router.use(requireSuperAdmin);

// Every building in the system, with enough context to manage it from one screen.
router.get('/buildings', async (req, res) => {
  const buildings = await prisma.building.findMany({
    include: { _count: { select: { admins: true, tenants: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    buildings.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      isConfigured: b.isConfigured,
      adminCount: b._count.admins,
      tenantCount: b._count.tenants,
      createdAt: b.createdAt,
    }))
  );
});

// Deletes a building and everything under it (tenants, dues, expenses, tasks...) via cascade.
router.delete('/buildings/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.building.delete({ where: { id } }).catch(() => null);
  res.status(204).end();
});

// Every user account in the system, with which buildings they belong to.
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    include: { buildingAdmins: { include: { building: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt,
      buildings: u.buildingAdmins.map((m) => ({ buildingId: m.buildingId, buildingName: m.building.name, role: m.role, status: m.status })),
    }))
  );
});

const VALID_USER_ROLES = ['SUPER_ADMIN', 'BUILDING_ADMIN'];

router.put('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body;
  if (!VALID_USER_ROLES.includes(role)) return res.status(400).json({ error: 'role לא תקין' });

  if (role !== 'SUPER_ADMIN' && id === req.user.id) {
    const otherSuperAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN', id: { not: id } } });
    if (otherSuperAdmins === 0) return res.status(400).json({ error: 'לא ניתן להסיר את מנהל-העל האחרון' });
  }

  const updated = await prisma.user.update({ where: { id }, data: { role } });
  res.json({ id: updated.id, role: updated.role });
});

router.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'לא ניתן למחוק את החשבון שלך' });
  await prisma.user.delete({ where: { id } }).catch(() => null);
  res.status(204).end();
});

module.exports = router;
