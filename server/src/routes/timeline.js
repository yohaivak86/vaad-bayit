const express = require('express');
const prisma = require('../lib/prisma');
const { toNum } = require('../lib/calc');

const router = express.Router({ mergeParams: true });

// The year-at-a-glance timeline for a building: its own tasks plus its complex's tasks (never
// another building's private tasks), and any expense the committee chose to put on the timeline.
// Residents see the same items but without amounts.
router.get('/', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const canSeeMoney = req.buildingRole === 'COMMITTEE';

  const member = await prisma.complexMember.findUnique({
    where: { buildingId: req.buildingId },
    include: { complex: { select: { id: true, name: true } } },
  });
  const scope = member ? { OR: [{ buildingId: req.buildingId }, { complexId: member.complexId }] } : { buildingId: req.buildingId };

  const [tasks, expenses] = await Promise.all([
    prisma.task.findMany({ where: { ...scope, showOnTimeline: true } }),
    prisma.expense.findMany({ where: { buildingId: req.buildingId, showOnTimeline: true, date: { gte: start, lt: end } } }),
  ]);

  const items = [];

  for (const t of tasks) {
    const date = t.dueDate || t.createdAt;
    if (date < start || date >= end) continue;
    items.push({
      kind: 'TASK',
      id: t.id,
      date,
      title: t.title,
      description: t.description,
      status: t.status,
      urgent: t.urgency === 'דחוף',
      scope: t.complexId ? 'COMPLEX' : 'BUILDING',
      complexName: t.complexId ? member?.complex.name ?? null : null,
      location: t.location,
      cost: canSeeMoney && t.cost !== null ? toNum(t.cost) : undefined,
    });
  }

  for (const e of expenses) {
    items.push({
      kind: 'EXPENSE',
      id: e.id,
      date: e.date,
      title: e.description || e.category,
      category: e.category,
      scope: e.complexExpenseId ? 'COMPLEX' : 'BUILDING',
      complexName: e.complexExpenseId ? member?.complex.name ?? null : null,
      amount: canSeeMoney ? toNum(e.amount) : undefined,
    });
  }

  items.sort((a, b) => new Date(a.date) - new Date(b.date));
  res.json({ year, complexName: member?.complex.name ?? null, items });
});

module.exports = router;
