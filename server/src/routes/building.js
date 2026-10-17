const express = require('express');
const prisma = require('../lib/prisma');
const { getBuilding, getBalance } = require('../lib/calc');
const { hashPassword } = require('../lib/auth');
const { generateInviteCode } = require('../lib/inviteCode');
const { requireCommittee, normalizeBuildingRole } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

const PUBLIC_BUILDING_FIELDS = ['id', 'name', 'address', 'floors', 'apartmentsCount', 'elevatorsCount', 'isConfigured', 'createdAt'];

// Full record for committee reps; identity-only (no balances, no invite code) for residents.
router.get('/', async (req, res) => {
  const building = await getBuilding(req.buildingId);
  if (!building) return res.status(404).json({ error: 'בניין לא נמצא' });

  const member = await prisma.complexMember.findUnique({
    where: { buildingId: req.buildingId },
    include: { complex: { select: { name: true, number: true } } },
  });
  const complexInfo = { complexId: member?.complexId ?? null, complexName: member?.complex?.name ?? null, complexNumber: member?.complex?.number ?? null };

  if (req.buildingRole === 'COMMITTEE') return res.json({ ...building, ...complexInfo });
  res.json({ ...Object.fromEntries(PUBLIC_BUILDING_FIELDS.map((k) => [k, building[k]])), ...complexInfo });
});

router.put('/', requireCommittee, async (req, res) => {
  const {
    name, address, floors, apartmentsCount, monthlyFeeDefault,
    openingBalanceCash, openingBalanceBank, openingBalancePaybox, openingBalanceDate,
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
      ...(openingBalanceBank !== undefined && { openingBalanceBank: Number(openingBalanceBank) }),
      ...(openingBalancePaybox !== undefined && { openingBalancePaybox: Number(openingBalancePaybox) }),
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

router.get('/balance', requireCommittee, async (req, res) => {
  const [balance, building] = await Promise.all([getBalance(req.buildingId), getBuilding(req.buildingId)]);
  const redLine = Number(building.treasuryRedLine);
  res.json({ ...balance, redLine, belowRedLine: balance.totalBalance < redLine });
});

// The treasury must stay above this line - a reserve for unplanned work. Shown on the dashboard.
router.put('/red-line', requireCommittee, async (req, res) => {
  const value = Number(req.body.treasuryRedLine);
  if (!(value >= 0)) return res.status(400).json({ error: 'יש להזין סכום תקין' });
  await prisma.building.update({ where: { id: req.buildingId }, data: { treasuryRedLine: value } });
  res.json({ redLine: value });
});

// Invalidates the current invite code (e.g. if it leaked) and issues a fresh one.
router.post('/invite-code/regenerate', requireCommittee, async (req, res) => {
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

// A building starts standalone or inside a complex - and can be moved at any time.
router.post('/complex/join', requireCommittee, async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'inviteCode הוא שדה חובה' });

  const complex = await prisma.complex.findUnique({ where: { inviteCode: inviteCode.toUpperCase().trim() } });
  if (!complex) return res.status(404).json({ error: 'קוד ההזמנה למתחם לא תקין' });

  try {
    await prisma.complexMember.create({ data: { complexId: complex.id, buildingId: req.buildingId } });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'הבניין כבר משויך למתחם - יש להסיר אותו ממנו קודם' });
    throw err;
  }
  res.status(201).json({ complexId: complex.id, complexName: complex.name });
});

// Join requests this building sent to complexes found through the search (waiting for the owner).
router.get('/complex/requests', requireCommittee, async (req, res) => {
  const requests = await prisma.complexJoinRequest.findMany({
    where: { buildingId: req.buildingId, status: 'PENDING' },
    include: { complex: { select: { id: true, number: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests.map((r) => ({ id: r.id, createdAt: r.createdAt, complex: r.complex })));
});

router.delete('/complex/requests/:requestId', requireCommittee, async (req, res) => {
  await prisma.complexJoinRequest.deleteMany({ where: { id: Number(req.params.requestId), buildingId: req.buildingId, status: 'PENDING' } });
  res.status(204).end();
});

router.post('/complex/leave', requireCommittee, async (req, res) => {
  await prisma.$transaction([
    // The complex's providers stop serving this building too.
    prisma.serviceProviderLink.deleteMany({ where: { buildingId: req.buildingId, provider: { complexId: { not: null } } } }),
    prisma.complexMember.deleteMany({ where: { buildingId: req.buildingId } }),
  ]);
  res.status(204).end();
});

const VALID_ROLES = ['COMMITTEE', 'RESIDENT'];

// ---- Members of this building (committee reps and residents) ----
// Granting COMMITTEE is allowed to a site admin or a committee rep of this building - every route
// below is already behind requireCommittee. (Making someone a *site* admin is separate: it only
// exists in the site admin's control center.)
router.use('/admins', requireCommittee);

router.get('/admins', async (req, res) => {
  const memberships = await prisma.buildingAdmin.findMany({
    where: { buildingId: req.buildingId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  const linkedTenants = await prisma.tenant.findMany({
    where: { buildingId: req.buildingId, userId: { in: memberships.map((m) => m.userId) } },
    select: { id: true, userId: true, apartmentNumber: true, name: true },
  });
  const tenantByUser = new Map(linkedTenants.map((t) => [t.userId, t]));

  res.json(
    memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      role: normalizeBuildingRole(m.role),
      status: m.status,
      tenant: tenantByUser.get(m.userId) || null,
    }))
  );
});

async function linkTenant(buildingId, userId, tenantId) {
  await prisma.tenant.updateMany({ where: { buildingId, userId }, data: { userId: null } });
  if (!tenantId) return;
  const tenant = await prisma.tenant.findFirst({ where: { id: Number(tenantId), buildingId } });
  if (!tenant) throw Object.assign(new Error('הדירה לא נמצאה'), { status: 404 });
  await prisma.tenant.update({ where: { id: tenant.id }, data: { userId } });
}

router.post('/admins', async (req, res) => {
  const { email, name, password, role, tenantId } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'email ו-name הם שדות חובה' });
  const membershipRole = VALID_ROLES.includes(role) ? role : 'RESIDENT';

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

  try {
    // A committee rep is adding this user directly, which is itself the approval step.
    await prisma.buildingAdmin.create({ data: { userId: user.id, buildingId: req.buildingId, role: membershipRole, status: 'ACTIVE' } });
    if (tenantId) await linkTenant(req.buildingId, user.id, tenantId);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
  res.status(201).json({ userId: user.id, name: user.name, email: user.email, role: membershipRole, status: 'ACTIVE' });
});

// Approves a PENDING join request (invite-code flow): picks the role and, for a resident,
// the apartment they belong to.
router.post('/admins/:userId/approve', async (req, res) => {
  const userId = Number(req.params.userId);
  const { role, tenantId } = req.body;
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'role חייב להיות COMMITTEE או RESIDENT' });

  try {
    const updated = await prisma.buildingAdmin.update({
      where: { userId_buildingId: { userId, buildingId: req.buildingId } },
      data: { role, status: 'ACTIVE' },
    });
    if (tenantId) await linkTenant(req.buildingId, userId, tenantId);
    res.json({ userId, role: updated.role, status: updated.status });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

router.put('/admins/:userId/tenant', async (req, res) => {
  const userId = Number(req.params.userId);
  try {
    await linkTenant(req.buildingId, userId, req.body.tenantId || null);
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

router.put('/admins/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  const { role } = req.body;
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'role חייב להיות COMMITTEE או RESIDENT' });

  if (role === 'RESIDENT') {
    const remaining = await prisma.buildingAdmin.count({
      where: { buildingId: req.buildingId, role: { in: ['COMMITTEE', 'ADMIN'] }, status: 'ACTIVE', userId: { not: userId } },
    });
    if (remaining === 0) return res.status(400).json({ error: 'לא ניתן להשאיר את הבניין ללא נציג ועד' });
  }

  const updated = await prisma.buildingAdmin.update({
    where: { userId_buildingId: { userId, buildingId: req.buildingId } },
    data: { role },
  });
  res.json({ userId, role: updated.role });
});

// Also used to reject a still-PENDING join request.
router.delete('/admins/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  const target = await prisma.buildingAdmin.findUnique({ where: { userId_buildingId: { userId, buildingId: req.buildingId } } });
  if (!target) return res.status(404).json({ error: 'המשתמש לא נמצא' });

  if (target.status === 'ACTIVE' && normalizeBuildingRole(target.role) === 'COMMITTEE') {
    const remaining = await prisma.buildingAdmin.count({
      where: { buildingId: req.buildingId, role: { in: ['COMMITTEE', 'ADMIN'] }, status: 'ACTIVE', userId: { not: userId } },
    });
    if (remaining === 0) return res.status(400).json({ error: 'לא ניתן להסיר את נציג הוועד האחרון של הבניין' });
  }

  await prisma.tenant.updateMany({ where: { buildingId: req.buildingId, userId }, data: { userId: null } });
  await prisma.buildingAdmin.delete({ where: { userId_buildingId: { userId, buildingId: req.buildingId } } });
  res.status(204).end();
});

module.exports = router;
