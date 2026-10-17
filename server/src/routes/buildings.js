const express = require('express');
const prisma = require('../lib/prisma');
const { hashPassword } = require('../lib/auth');
const { requireAuth, requireSiteAdmin, normalizeBuildingRole } = require('../middleware/auth');
const { generateInviteCode } = require('../lib/inviteCode');

const router = express.Router();

// Fields a resident may see about a building: identity only, nothing financial and no invite code.
const PUBLIC_BUILDING_FIELDS = ['id', 'name', 'address', 'floors', 'apartmentsCount', 'elevatorsCount', 'isConfigured', 'createdAt'];

function shapeBuilding(building, role, status, complexMember) {
  const full = role === 'COMMITTEE';
  const base = full ? building : Object.fromEntries(PUBLIC_BUILDING_FIELDS.map((k) => [k, building[k]]));
  return {
    ...base,
    role,
    status,
    complexId: complexMember?.complexId ?? null,
    complexName: complexMember?.complex?.name ?? null,
  };
}

// Buildings the logged-in user can access (all of them for a site admin), each with the
// caller's own level there (role) and the complex it belongs to, if any.
router.get('/', requireAuth, async (req, res) => {
  const complexInclude = { complexMember: { include: { complex: { select: { name: true } } } } };

  if (req.user.role === 'SUPER_ADMIN') {
    const buildings = await prisma.building.findMany({ include: complexInclude, orderBy: { name: 'asc' } });
    return res.json(buildings.map((b) => shapeBuilding(b, 'COMMITTEE', 'ACTIVE', b.complexMember)));
  }

  const memberships = await prisma.buildingAdmin.findMany({
    where: { userId: req.user.id },
    include: { building: { include: complexInclude } },
    orderBy: { building: { name: 'asc' } },
  });
  res.json(
    memberships.map((m) =>
      shapeBuilding(m.building, m.status === 'PENDING' ? 'RESIDENT' : normalizeBuildingRole(m.role), m.status, m.building.complexMember)
    )
  );
});

// Site admin only: provision a new building and its first committee rep's account.
router.post('/', requireAuth, requireSiteAdmin, async (req, res) => {
  const { name, address, adminEmail, adminName, adminPassword, complexInviteCode } = req.body;
  if (!name || !adminEmail || !adminName || !adminPassword) {
    return res.status(400).json({ error: 'name, adminEmail, adminName ו-adminPassword הם שדות חובה' });
  }
  if (adminPassword.length < 8) {
    return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 8 תווים' });
  }

  let complex = null;
  if (complexInviteCode && complexInviteCode.trim()) {
    complex = await prisma.complex.findUnique({ where: { inviteCode: complexInviteCode.toUpperCase().trim() } });
    if (!complex) return res.status(404).json({ error: 'קוד ההזמנה למתחם לא תקין' });
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
    await tx.buildingAdmin.create({ data: { userId: user.id, buildingId: building.id, role: 'COMMITTEE' } });
    if (complex) await tx.complexMember.create({ data: { complexId: complex.id, buildingId: building.id } });
    return building;
  });

  res.status(201).json(result);
});

module.exports = router;
