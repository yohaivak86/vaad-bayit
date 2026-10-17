const express = require('express');
const prisma = require('../lib/prisma');
const { hashPassword } = require('../lib/auth');
const { requireAuth, requireSiteAdmin, normalizeBuildingRole } = require('../middleware/auth');
const { generateInviteCode } = require('../lib/inviteCode');
const { sendEmail } = require('../lib/email');

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
    complexNumber: complexMember?.complex?.number ?? null,
  };
}

// Buildings the logged-in user can access (all of them for a site admin), each with the
// caller's own level there (role) and the complex it belongs to, if any.
router.get('/', requireAuth, async (req, res) => {
  const complexInclude = { complexMember: { include: { complex: { select: { name: true, number: true } } } } };

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

// Search for a building to join - by name, address or invite code (the same box for all of them).
// Only identity is returned (never the invite code or anything financial).
router.get('/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const [buildings, mine] = await Promise.all([
    prisma.building.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { inviteCode: q.toUpperCase() },
        ],
      },
      include: { complexMember: { include: { complex: { select: { number: true, name: true } } } } },
      orderBy: { name: 'asc' },
      take: 10,
    }),
    prisma.buildingAdmin.findMany({ where: { userId: req.user.id }, select: { buildingId: true, status: true } }),
  ]);
  const mineById = new Map(mine.map((m) => [m.buildingId, m.status]));

  res.json(
    buildings.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      complexNumber: b.complexMember?.complex.number ?? null,
      complexName: b.complexMember?.complex.name ?? null,
      membership: mineById.get(b.id) || null, // ACTIVE | PENDING | null
    }))
  );
});

// Ask to join an existing building - by id (found through the search) or by its invite code.
// Either way a committee rep of that building has to approve it and pick the role / apartment.
router.post('/join-request', requireAuth, async (req, res) => {
  const { buildingId, inviteCode } = req.body;
  const building = inviteCode
    ? await prisma.building.findUnique({ where: { inviteCode: String(inviteCode).toUpperCase().trim() } })
    : buildingId
      ? await prisma.building.findUnique({ where: { id: Number(buildingId) } })
      : null;
  if (!building) return res.status(404).json({ error: inviteCode ? 'קוד ההזמנה לא תקין' : 'הבניין לא נמצא' });

  const existing = await prisma.buildingAdmin.findUnique({ where: { userId_buildingId: { userId: req.user.id, buildingId: building.id } } });
  if (existing) {
    return res.status(409).json({ error: existing.status === 'PENDING' ? 'הבקשה שלך לבניין זה כבר ממתינה לאישור' : 'אתם כבר משויכים לבניין זה' });
  }

  await prisma.buildingAdmin.create({ data: { userId: req.user.id, buildingId: building.id, role: 'RESIDENT', status: 'PENDING' } });
  res.status(201).json({ buildingId: building.id, buildingName: building.name, pending: true });
});

// Self-service: open a brand-new building (the creator becomes its committee rep), optionally
// standalone, inside an existing complex (by request / by code) or inside a complex opened right now.
router.post('/new', requireAuth, async (req, res) => {
  const { name, address, complexId, complexInviteCode, newComplex } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'יש להזין שם בניין' });
  if (newComplex && !String(newComplex.name || '').trim()) return res.status(400).json({ error: 'יש להזין שם למתחם' });

  let targetComplex = null;
  if (complexInviteCode && String(complexInviteCode).trim()) {
    targetComplex = await prisma.complex.findUnique({ where: { inviteCode: String(complexInviteCode).toUpperCase().trim() } });
    if (!targetComplex) return res.status(404).json({ error: 'קוד ההזמנה למתחם לא תקין' });
  }
  let requestComplex = null;
  if (!targetComplex && complexId) {
    requestComplex = await prisma.complex.findUnique({ where: { id: Number(complexId) }, include: { owner: true } });
    if (!requestComplex) return res.status(404).json({ error: 'המתחם לא נמצא' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const building = await tx.building.create({ data: { name: String(name).trim(), address: address ? String(address).trim() : '', inviteCode: generateInviteCode() } });
    await tx.buildingAdmin.create({ data: { userId: req.user.id, buildingId: building.id, role: 'COMMITTEE', status: 'ACTIVE' } });

    let complexOut = null;
    if (targetComplex) {
      await tx.complexMember.create({ data: { complexId: targetComplex.id, buildingId: building.id } });
    } else if (requestComplex) {
      await tx.complexJoinRequest.create({ data: { complexId: requestComplex.id, buildingId: building.id, requestedById: req.user.id } });
    } else if (newComplex) {
      // The new complex's owner is this user - who is a committee rep, as complex owners must be.
      const complex = await tx.complex.create({
        data: { name: String(newComplex.name).trim(), address: newComplex.address ? String(newComplex.address).trim() : '', ownerId: req.user.id, inviteCode: generateInviteCode() },
      });
      await tx.complexMember.create({ data: { complexId: complex.id, buildingId: building.id } });
      complexOut = { id: complex.id, number: complex.number, name: complex.name };
    }
    return { building, complexOut };
  });

  if (requestComplex?.owner?.email) {
    sendEmail({
      to: requestComplex.owner.email,
      subject: `בקשת הצטרפות למתחם ${requestComplex.name}`,
      text: `הבניין "${result.building.name}" מבקש להצטרף למתחם ${requestComplex.name} (מספר ${requestComplex.number}).\nיש להיכנס למערכת ← מתחמים כדי לאשר או לדחות את הבקשה.`,
    });
  }

  res.status(201).json({
    buildingId: result.building.id,
    complex: result.complexOut,
    complexRequested: requestComplex ? { id: requestComplex.id, number: requestComplex.number, name: requestComplex.name } : null,
    complexJoined: Boolean(targetComplex),
  });
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
