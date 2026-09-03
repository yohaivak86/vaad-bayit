const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { generateInviteCode } = require('../lib/inviteCode');
const { computeSplits } = require('../lib/complexSplit');

const router = express.Router();
router.use(requireAuth);

function publicComplex(complex, { includeInviteCode }) {
  return {
    id: complex.id,
    name: complex.name,
    ownerId: complex.ownerId,
    ownerName: complex.owner?.name,
    createdAt: complex.createdAt,
    inviteCode: includeInviteCode ? complex.inviteCode : undefined,
    members: complex.members?.map((m) => ({
      buildingId: m.buildingId,
      buildingName: m.building?.name,
      apartmentsCount: m.building?.apartmentsCount,
      sharePercent: m.sharePercent !== null && m.sharePercent !== undefined ? Number(m.sharePercent) : null,
    })),
  };
}

// Buildings the requester administers directly (used to check complex access/actions).
async function myBuildingIds(user) {
  if (user.role === 'SUPER_ADMIN') {
    return (await prisma.building.findMany({ select: { id: true } })).map((b) => b.id);
  }
  const memberships = await prisma.buildingAdmin.findMany({ where: { userId: user.id }, select: { buildingId: true } });
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
  const buildingIds = await myBuildingIds(req.user);
  const complexes = await prisma.complex.findMany({
    where: { OR: [{ ownerId: req.user.id }, { members: { some: { buildingId: { in: buildingIds } } } }] },
    include: { owner: true, members: { include: { building: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(complexes.map((c) => publicComplex(c, { includeInviteCode: isOwner(c, req.user) })));
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name הוא שדה חובה' });

  const complex = await prisma.complex.create({
    data: { name, ownerId: req.user.id, inviteCode: generateInviteCode() },
    include: { owner: true, members: { include: { building: true } } },
  });
  res.status(201).json(publicComplex(complex, { includeInviteCode: true }));
});

router.get('/:id', async (req, res) => {
  const complex = await loadComplexOr404(Number(req.params.id), res);
  if (!complex) return;

  const buildingIds = await myBuildingIds(req.user);
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

  const buildingIds = await myBuildingIds(req.user);
  if (!buildingIds.includes(Number(buildingId))) return res.status(403).json({ error: 'אין הרשאה לבניין זה' });

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

  await prisma.complexMember.deleteMany({ where: { complexId: complex.id, buildingId: Number(req.params.buildingId) } });
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

  const buildingIds = await myBuildingIds(req.user);
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

module.exports = router;
