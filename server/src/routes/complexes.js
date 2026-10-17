const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { generateInviteCode } = require('../lib/inviteCode');
const { computeSplits } = require('../lib/complexSplit');
const { round2 } = require('../lib/calc');
const { sendEmail } = require('../lib/email');

const router = express.Router();
router.use(requireAuth);

function publicComplex(complex, { includeInviteCode }) {
  return {
    id: complex.id,
    number: complex.number,
    name: complex.name,
    address: complex.address,
    ownerId: complex.ownerId,
    ownerName: complex.owner?.name,
    createdAt: complex.createdAt,
    inviteCode: includeInviteCode ? complex.inviteCode : undefined,
    electricityRatePerUnit: complex.electricityRatePerUnit !== null && complex.electricityRatePerUnit !== undefined ? Number(complex.electricityRatePerUnit) : null,
    lastElectricityReading: complex.lastElectricityReading !== null && complex.lastElectricityReading !== undefined ? Number(complex.lastElectricityReading) : null,
    members: complex.members?.map((m) => ({
      buildingId: m.buildingId,
      buildingName: m.building?.name,
      apartmentsCount: m.building?.apartmentsCount,
      sharePercent: m.sharePercent !== null && m.sharePercent !== undefined ? Number(m.sharePercent) : null,
    })),
  };
}

// Buildings the requester belongs to in any role (a resident included) - enough to open the
// complex profile and its tasks. A site admin counts as belonging to all of them.
async function viewerBuildingIds(user) {
  if (user.role === 'SUPER_ADMIN') {
    return (await prisma.building.findMany({ select: { id: true } })).map((b) => b.id);
  }
  const memberships = await prisma.buildingAdmin.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { buildingId: true } });
  return memberships.map((m) => m.buildingId);
}

// Buildings where the requester is a committee rep (נציג ועד) - needed for anything financial
// (shares, shared expenses, the electricity meter) and for joining/leaving a complex.
async function committeeBuildingIds(user) {
  if (user.role === 'SUPER_ADMIN') {
    return (await prisma.building.findMany({ select: { id: true } })).map((b) => b.id);
  }
  const memberships = await prisma.buildingAdmin.findMany({
    where: { userId: user.id, status: 'ACTIVE', role: { in: ['COMMITTEE', 'ADMIN'] } },
    select: { buildingId: true },
  });
  return memberships.map((m) => m.buildingId);
}

async function loadComplexOr404(id, res) {
  const complex = await prisma.complex.findUnique({
    where: { id },
    include: { owner: true, members: { include: { building: true } } },
  });
  if (!complex) {
    res.status(404).json({ error: 'מתחם לא נמצא' });
    return null;
  }
  return complex;
}

function isOwner(complex, user) {
  return complex.ownerId === user.id || user.role === 'SUPER_ADMIN';
}

// Complexes the user can see: ones they own, or ones any of their buildings belongs to.
router.get('/mine', async (req, res) => {
  const buildingIds = await viewerBuildingIds(req.user);
  const complexes = await prisma.complex.findMany({
    where: { OR: [{ ownerId: req.user.id }, { members: { some: { buildingId: { in: buildingIds } } } }] },
    include: { owner: true, members: { include: { building: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(complexes.map((c) => publicComplex(c, { includeInviteCode: isOwner(c, req.user) })));
});

router.post('/', async (req, res) => {
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ error: 'name הוא שדה חובה' });
  if ((await committeeBuildingIds(req.user)).length === 0) {
    return res.status(403).json({ error: 'רק מנהל אתר או נציג ועד יכולים ליצור מתחם' });
  }

  const complex = await prisma.complex.create({
    data: { name, address: address || '', ownerId: req.user.id, inviteCode: generateInviteCode() },
    include: { owner: true, members: { include: { building: true } } },
  });
  res.status(201).json(publicComplex(complex, { includeInviteCode: true }));
});

// Search by complex number, invite code, name or address - the same box for all of them.
// The invite code is never returned here; only the number / name / address identify the complex.
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 1) return res.json([]);

  const or = [
    { name: { contains: q, mode: 'insensitive' } },
    { address: { contains: q, mode: 'insensitive' } },
    { inviteCode: q.toUpperCase() },
  ];
  if (/^\d{1,9}$/.test(q)) or.push({ number: Number(q) });

  const [complexes, myBuildings, pending] = await Promise.all([
    prisma.complex.findMany({
      where: { OR: or },
      include: { owner: { select: { name: true } }, _count: { select: { members: true } } },
      orderBy: { number: 'asc' },
      take: 10,
    }),
    committeeBuildingIds(req.user),
    prisma.complexJoinRequest.findMany({ where: { status: 'PENDING' }, select: { complexId: true, buildingId: true } }),
  ]);
  const requestedIds = new Set(pending.filter((p) => myBuildings.includes(p.buildingId)).map((p) => p.complexId));

  res.json(
    complexes.map((c) => ({
      id: c.id,
      number: c.number,
      name: c.name,
      address: c.address,
      ownerName: c.owner?.name,
      buildingsCount: c._count.members,
      requested: requestedIds.has(c.id),
    }))
  );
});

// All pending requests across the complexes the caller owns - drives the badge in the UI.
router.get('/requests/incoming', async (req, res) => {
  const requests = await prisma.complexJoinRequest.findMany({
    where: { status: 'PENDING', ...(req.user.role === 'SUPER_ADMIN' ? {} : { complex: { ownerId: req.user.id } }) },
    include: {
      complex: { select: { id: true, number: true, name: true } },
      building: { select: { id: true, name: true, address: true, apartmentsCount: true } },
      requestedBy: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(
    requests.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      complex: r.complex,
      building: r.building,
      requestedBy: r.requestedBy?.name,
      requestedByPhone: r.requestedBy?.phone,
    }))
  );
});

router.post('/requests/:requestId/:decision(approve|reject)', async (req, res) => {
  const request = await prisma.complexJoinRequest.findUnique({
    where: { id: Number(req.params.requestId) },
    include: { complex: true },
  });
  if (!request || request.status !== 'PENDING') return res.status(404).json({ error: 'הבקשה לא נמצאה או שכבר טופלה' });
  if (request.complex.ownerId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'רק בעל המתחם יכול לאשר או לדחות בקשות' });
  }

  if (req.params.decision === 'reject') {
    await prisma.complexJoinRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
    return res.json({ status: 'REJECTED' });
  }

  try {
    await prisma.$transaction([
      prisma.complexMember.create({ data: { complexId: request.complexId, buildingId: request.buildingId } }),
      prisma.complexJoinRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } }),
    ]);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'הבניין כבר חבר במתחם אחר' });
    throw err;
  }
  res.json({ status: 'APPROVED' });
});

// A committee rep of a building asks to join a complex found through the search.
router.post('/:id/join-requests', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  const buildingId = Number(req.body.buildingId);
  if (!buildingId) return res.status(400).json({ error: 'buildingId הוא שדה חובה' });
  if (!(await committeeBuildingIds(req.user)).includes(buildingId)) {
    return res.status(403).json({ error: 'רק נציג ועד של הבניין יכול לבקש לשייך אותו למתחם' });
  }
  if (await prisma.complexMember.findUnique({ where: { buildingId } })) {
    return res.status(409).json({ error: 'הבניין כבר משויך למתחם - יש להסיר אותו ממנו קודם' });
  }

  const request = await prisma.complexJoinRequest.upsert({
    where: { complexId_buildingId: { complexId: complex.id, buildingId } },
    update: { status: 'PENDING', requestedById: req.user.id },
    create: { complexId: complex.id, buildingId, requestedById: req.user.id },
    include: { building: { select: { name: true } } },
  });

  if (complex.owner?.email) {
    sendEmail({
      to: complex.owner.email,
      subject: `בקשת הצטרפות למתחם ${complex.name}`,
      text: `הבניין "${request.building.name}" מבקש להצטרף למתחם ${complex.name} (מספר ${complex.number}).\nיש להיכנס למערכת ← מתחמים כדי לאשר או לדחות את הבקשה.`,
    });
  }
  res.status(201).json({ id: request.id, status: request.status, complexName: complex.name });
});

router.get('/:id', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;

  const buildingIds = await committeeBuildingIds(req.user);
  const isMember = complex.members.some((m) => buildingIds.includes(m.buildingId));
  if (!isOwner(complex, req.user) && !isMember) return res.status(403).json({ error: 'אין הרשאה לצפות במתחם זה' });

  res.json(publicComplex(complex, { includeInviteCode: isOwner(complex, req.user) }));
});

// A building's admin joins their building into a complex, knowing only the invite code
// (not the complex's id) - so the lookup happens by code, not by :id in the URL.
router.post('/join', async (req, res) => {
  const { buildingId, inviteCode } = req.body;
  if (!buildingId || !inviteCode) return res.status(400).json({ error: 'buildingId ו-inviteCode הם שדות חובה' });

  const complex = await prisma.complex.findUnique({ where: { inviteCode: inviteCode.toUpperCase().trim() } });
  if (!complex) return res.status(404).json({ error: 'קוד ההזמנה לא תקין' });

  const buildingIds = await committeeBuildingIds(req.user);
  if (!buildingIds.includes(Number(buildingId))) return res.status(403).json({ error: 'רק נציג ועד של הבניין יכול לשייך אותו למתחם' });

  try {
    await prisma.complexMember.create({ data: { complexId: complex.id, buildingId: Number(buildingId) } });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'הבניין כבר חבר במתחם (ניתן להיות חבר במתחם אחד בלבד)' });
    throw err;
  }
  res.status(201).json({ complexId: complex.id, complexName: complex.name });
});

router.delete('/:id/members/:buildingId', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול להסיר בניינים' });

  const buildingId = Number(req.params.buildingId);
  await prisma.$transaction([
    prisma.serviceProviderLink.deleteMany({ where: { buildingId, provider: { complexId: complex.id } } }),
    prisma.complexMember.deleteMany({ where: { complexId: complex.id, buildingId } }),
  ]);
  res.status(204).end();
});

// Owner sets a custom cost-share per building; must cover every member and sum to 100.
// Passing an empty array resets to an equal split among all members.
router.put('/:id/shares', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לערוך את החלוקה' });

  const { shares } = req.body; // [{ buildingId, sharePercent }]
  const memberIds = complex.members.map((m) => m.buildingId);

  if (!Array.isArray(shares) || shares.length === 0) {
    await prisma.$transaction(
      memberIds.map((buildingId) =>
        prisma.complexMember.update({ where: { complexId_buildingId: { complexId: complex.id, buildingId } }, data: { sharePercent: null } })
      )
    );
    return res.json({ ok: true });
  }

  const total = shares.reduce((sum, s) => sum + Number(s.sharePercent), 0);
  const coversAllMembers = memberIds.every((id) => shares.some((s) => Number(s.buildingId) === id));
  if (shares.length !== memberIds.length || !coversAllMembers || Math.abs(total - 100) > 0.01) {
    return res.status(400).json({ error: 'החלוקה חייבת לכלול את כל הבניינים החברים ולהסתכם ב-100%' });
  }

  await prisma.$transaction(
    shares.map((s) =>
      prisma.complexMember.update({
        where: { complexId_buildingId: { complexId: complex.id, buildingId: Number(s.buildingId) } },
        data: { sharePercent: Number(s.sharePercent) },
      })
    )
  );
  res.json({ ok: true });
});

router.post('/:id/regenerate-code', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול ליצור קוד חדש' });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.complex.update({ where: { id: complex.id }, data: { inviteCode: generateInviteCode() } });
      return res.json({ inviteCode: updated.inviteCode });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
  res.status(500).json({ error: 'לא הצלחנו ליצור קוד הזמנה, נסו שוב' });
});

router.get('/:id/expenses', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;

  const buildingIds = await committeeBuildingIds(req.user);
  const isMember = complex.members.some((m) => buildingIds.includes(m.buildingId));
  if (!isOwner(complex, req.user) && !isMember) return res.status(403).json({ error: 'אין הרשאה לצפות במתחם זה' });

  const expenses = await prisma.complexExpense.findMany({
    where: { complexId: complex.id },
    include: { buildingExpenses: { include: { building: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(
    expenses.map((e) => ({
      id: e.id,
      date: e.date,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      paidFrom: e.paidFrom,
      split: e.buildingExpenses.map((be) => ({ buildingId: be.buildingId, buildingName: be.building.name, amount: Number(be.amount) })),
    }))
  );
});

// Creates a shared expense and fans it out into a proportional Expense row per member
// building, so each building's own deterministic balance calculation includes its share.
router.post('/:id/expenses', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לרשום הוצאות משותפות' });

  const { date, category, description, amount, paidFrom } = req.body;
  if (!date || !category || amount === undefined || !paidFrom) {
    return res.status(400).json({ error: 'date, category, amount ו-paidFrom הם שדות חובה' });
  }
  if (complex.members.length === 0) return res.status(400).json({ error: 'אין בניינים חברים במתחם' });

  const members = complex.members
    .slice()
    .sort((a, b) => a.buildingId - b.buildingId)
    .map((m) => ({ buildingId: m.buildingId, sharePercent: m.sharePercent !== null && m.sharePercent !== undefined ? Number(m.sharePercent) : null }));
  const splits = computeSplits(Number(amount), members);

  const result = await prisma.$transaction(async (tx) => {
    const complexExpense = await tx.complexExpense.create({
      data: { complexId: complex.id, date: new Date(date), category, description: description || null, amount: Number(amount), paidFrom },
    });
    for (const s of splits) {
      await tx.expense.create({
        data: {
          buildingId: s.buildingId,
          date: new Date(date),
          category,
          description: `${description ? description + ' - ' : ''}הוצאת מתחם (${complex.name})`,
          amount: s.amount,
          paidFrom,
          complexExpenseId: complexExpense.id,
        },
      });
    }
    return complexExpense;
  });

  res.status(201).json({ id: result.id, splits });
});

router.delete('/:id/expenses/:expenseId', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול למחוק הוצאות משותפות' });

  await prisma.complexExpense.delete({ where: { id: Number(req.params.expenseId) } }).catch(() => null);
  res.status(204).end();
});

// Owner sets the ₪-per-unit rate used to cost future meter readings.
router.put('/:id/electricity-rate', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לקבוע את התעריף' });

  const { rate } = req.body;
  if (rate === undefined || rate === null || Number(rate) <= 0) {
    return res.status(400).json({ error: 'rate חייב להיות מספר חיובי' });
  }
  const updated = await prisma.complex.update({ where: { id: complex.id }, data: { electricityRatePerUnit: Number(rate) } });
  res.json({ electricityRatePerUnit: Number(updated.electricityRatePerUnit) });
});

router.get('/:id/electricity-readings', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;

  const buildingIds = await committeeBuildingIds(req.user);
  const isMember = complex.members.some((m) => buildingIds.includes(m.buildingId));
  if (!isOwner(complex, req.user) && !isMember) return res.status(403).json({ error: 'אין הרשאה לצפות במתחם זה' });

  const readings = await prisma.complexElectricityReading.findMany({
    where: { complexId: complex.id },
    include: { debts: { include: { building: { select: { name: true } } } } },
    orderBy: { readingDate: 'desc' },
  });
  res.json(
    readings.map((r) => ({
      id: r.id,
      readingDate: r.readingDate,
      previousReading: Number(r.previousReading),
      currentReading: Number(r.currentReading),
      consumption: Number(r.consumption),
      ratePerUnit: Number(r.ratePerUnit),
      totalCost: Number(r.totalCost),
      debts: r.debts.map((d) => ({
        id: d.id,
        buildingId: d.buildingId,
        buildingName: d.building.name,
        amountOwed: Number(d.amountOwed),
        paid: d.paid,
        paidAt: d.paidAt,
      })),
    }))
  );
});

// Records a new meter reading. Consumption is measured from the complex's last reading
// (or this becomes the baseline if there isn't one yet) and split into a per-building
// debt - a standalone ledger, not posted to any building's own Expense records.
router.post('/:id/electricity-readings', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול להזין קריאת מונה' });

  const { currentReading, date } = req.body;
  if (currentReading === undefined || currentReading === null) {
    return res.status(400).json({ error: 'currentReading הוא שדה חובה' });
  }
  if (!complex.electricityRatePerUnit) {
    return res.status(400).json({ error: 'יש לקבוע תעריף לפני הזנת קריאת מונה' });
  }
  const current = Number(currentReading);

  if (complex.lastElectricityReading === null || complex.lastElectricityReading === undefined) {
    const updated = await prisma.complex.update({ where: { id: complex.id }, data: { lastElectricityReading: current } });
    return res.status(201).json({ baseline: true, lastElectricityReading: Number(updated.lastElectricityReading) });
  }

  const previous = Number(complex.lastElectricityReading);
  if (current < previous) return res.status(400).json({ error: 'הקריאה החדשה נמוכה מהקריאה הקודמת' });

  const consumption = current - previous;
  const rate = Number(complex.electricityRatePerUnit);
  const totalCost = round2(consumption * rate);

  if (complex.members.length === 0) return res.status(400).json({ error: 'אין בניינים חברים במתחם' });
  const members = complex.members
    .slice()
    .sort((a, b) => a.buildingId - b.buildingId)
    .map((m) => ({ buildingId: m.buildingId, sharePercent: m.sharePercent !== null && m.sharePercent !== undefined ? Number(m.sharePercent) : null }));
  const splits = computeSplits(totalCost, members);

  const reading = await prisma.$transaction(async (tx) => {
    const created = await tx.complexElectricityReading.create({
      data: {
        complexId: complex.id,
        readingDate: date ? new Date(date) : new Date(),
        previousReading: previous,
        currentReading: current,
        consumption,
        ratePerUnit: rate,
        totalCost,
      },
    });
    for (const s of splits) {
      await tx.complexElectricityDebt.create({
        data: { readingId: created.id, buildingId: s.buildingId, amountOwed: s.amount },
      });
    }
    await tx.complex.update({ where: { id: complex.id }, data: { lastElectricityReading: current } });
    return created;
  });

  res.status(201).json({ id: reading.id, consumption, totalCost, splits });
});

router.post('/:id/electricity-debts/:debtId/mark-paid', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לסמן חוב כשולם' });

  const debt = await prisma.complexElectricityDebt.findFirst({
    where: { id: Number(req.params.debtId), reading: { complexId: complex.id } },
  });
  if (!debt) return res.status(404).json({ error: 'חוב לא נמצא' });

  const updated = await prisma.complexElectricityDebt.update({
    where: { id: debt.id },
    data: { paid: true, paidAt: new Date() },
  });
  res.json({ id: updated.id, paid: updated.paid, paidAt: updated.paidAt });
});

// ---- Complex profile, tasks and service providers ----
// Reading is open to everyone who belongs to a member building (residents included); changing
// anything is for the complex owner / site admin only.

async function canViewComplex(complex, user) {
  if (isOwner(complex, user)) return true;
  const ids = await viewerBuildingIds(user);
  return complex.members.some((m) => ids.includes(m.buildingId));
}

router.get('/:id/profile', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!(await canViewComplex(complex, req.user))) return res.status(403).json({ error: 'אין הרשאה לצפות במתחם זה' });

  const providers = await prisma.serviceProvider.findMany({
    where: { complexId: complex.id },
    include: { links: true },
    orderBy: { name: 'asc' },
  });

  res.json({
    complex: { id: complex.id, number: complex.number, name: complex.name, address: complex.address, ownerName: complex.owner?.name },
    canEdit: isOwner(complex, req.user),
    buildings: complex.members.map((m) => ({
      id: m.buildingId,
      name: m.building.name,
      address: m.building.address,
      apartmentsCount: m.building.apartmentsCount,
    })),
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      phone: p.phone,
      email: p.email,
      notes: p.notes,
      buildingIds: p.links.map((l) => l.buildingId),
    })),
  });
});

router.get('/:id/tasks', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!(await canViewComplex(complex, req.user))) return res.status(403).json({ error: 'אין הרשאה לצפות במתחם זה' });

  const tasks = await prisma.task.findMany({ where: { complexId: complex.id }, orderBy: { createdAt: 'desc' } });
  res.json(tasks);
});

router.post('/:id/tasks', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לנהל משימות מתחמיות' });

  const { title, description, location, urgency, dueDate, showOnTimeline, cost, paidFrom } = req.body;
  if (!title) return res.status(400).json({ error: 'title הוא שדה חובה' });
  const hasCost = cost !== undefined && cost !== null && cost !== '';
  const task = await prisma.task.create({
    data: {
      complexId: complex.id,
      title,
      description: description || null,
      location: location || null,
      urgency: urgency || 'רגיל',
      dueDate: dueDate ? new Date(dueDate) : null,
      showOnTimeline: showOnTimeline === undefined ? true : Boolean(showOnTimeline),
      cost: hasCost ? Number(cost) : null,
      paidFrom: hasCost ? paidFrom || null : null,
    },
  });
  res.status(201).json(task);
});

router.put('/:id/tasks/:taskId', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לנהל משימות מתחמיות' });

  const id = Number(req.params.taskId);
  const existing = await prisma.task.findFirst({ where: { id, complexId: complex.id } });
  if (!existing) return res.status(404).json({ error: 'משימה לא נמצאה' });

  const { title, description, location, urgency, status, dueDate, showOnTimeline, cost, paidFrom } = req.body;
  const data = {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(location !== undefined && { location }),
    ...(urgency !== undefined && { urgency }),
    ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    ...(showOnTimeline !== undefined && { showOnTimeline: Boolean(showOnTimeline) }),
    ...(cost !== undefined && { cost: cost === null || cost === '' ? null : Number(cost) }),
    ...(paidFrom !== undefined && { paidFrom: paidFrom || null }),
  };
  if (status !== undefined) {
    data.status = status;
    data.resolvedAt = status === 'RESOLVED' ? new Date() : null;
  }
  res.json(await prisma.task.update({ where: { id }, data }));
});

router.delete('/:id/tasks/:taskId', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לנהל משימות מתחמיות' });

  await prisma.task.deleteMany({ where: { id: Number(req.params.taskId), complexId: complex.id } });
  res.status(204).end();
});

router.post('/:id/providers', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לנהל נותני שירות' });

  const { name, category, phone, email, notes, buildingIds } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name ו-category הם שדות חובה' });

  const memberIds = complex.members.map((m) => m.buildingId);
  const linked = (Array.isArray(buildingIds) ? buildingIds : []).map(Number).filter((id) => memberIds.includes(id));

  const provider = await prisma.serviceProvider.create({
    data: {
      complexId: complex.id,
      name,
      category,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      links: { create: linked.map((buildingId) => ({ buildingId })) },
    },
  });
  res.status(201).json(provider);
});

router.put('/:id/providers/:providerId', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לנהל נותני שירות' });

  const id = Number(req.params.providerId);
  const existing = await prisma.serviceProvider.findFirst({ where: { id, complexId: complex.id } });
  if (!existing) return res.status(404).json({ error: 'נותן שירות לא נמצא' });

  const { name, category, phone, email, notes, buildingIds } = req.body;
  const memberIds = complex.members.map((m) => m.buildingId);

  await prisma.$transaction(async (tx) => {
    await tx.serviceProvider.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });
    // Which of the complex's buildings this provider serves - changeable at any time.
    if (Array.isArray(buildingIds)) {
      const linked = buildingIds.map(Number).filter((b) => memberIds.includes(b));
      await tx.serviceProviderLink.deleteMany({ where: { providerId: id } });
      if (linked.length) await tx.serviceProviderLink.createMany({ data: linked.map((buildingId) => ({ providerId: id, buildingId })) });
    }
  });
  res.json({ ok: true });
});

router.delete('/:id/providers/:providerId', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;
  if (!isOwner(complex, req.user)) return res.status(403).json({ error: 'רק בעל המתחם יכול לנהל נותני שירות' });

  await prisma.serviceProvider.deleteMany({ where: { id: Number(req.params.providerId), complexId: complex.id } });
  res.status(204).end();
});

module.exports = router;
