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

// Yearly expense forecast (committee only): for every month, what is planned (expected recurring items +
// the annual budget lines) next to what was actually paid, so the year can be followed at a glance.
router.get('/forecast', async (req, res) => {
  if (req.buildingRole !== 'COMMITTEE') return res.status(403).json({ error: 'תחזית ההוצאות זמינה לנציגי ועד בלבד' });
  const year = Number(req.query.year) || new Date().getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [recurring, budget, expenses] = await Promise.all([
    prisma.recurringItem.findMany({ where: { buildingId: req.buildingId, active: true } }),
    prisma.budgetItem.findMany({ where: { buildingId: req.buildingId } }),
    prisma.expense.findMany({ where: { buildingId: req.buildingId, date: { gte: start, lt: end } }, select: { date: true, amount: true } }),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, planned: 0, actual: 0, items: [] }));
  const add = (m, title, amount, source) => {
    months[m - 1].planned += amount;
    months[m - 1].items.push({ title, amount, source });
  };
  for (const r of recurring) {
    const amount = r.expectedAmount !== null ? toNum(r.expectedAmount) : 0;
    if (r.frequency === 'MONTHLY') for (let m = 1; m <= 12; m++) add(m, r.title, amount, 'RECURRING');
    else if (r.frequency === 'ANNUAL') add(r.month, r.title, amount, 'RECURRING');
    else if (r.dueDate && r.dueDate >= start && r.dueDate < end) add(r.dueDate.getUTCMonth() + 1, r.title, amount, 'RECURRING');
  }
  for (const b of budget) for (const m of b.months) add(m, b.label, toNum(b.amount), 'BUDGET');
  for (const e of expenses) months[e.date.getUTCMonth()].actual += toNum(e.amount);

  const round = (n) => Math.round(n * 100) / 100;
  months.forEach((m) => { m.planned = round(m.planned); m.actual = round(m.actual); });
  res.json({
    year,
    months,
    plannedTotal: round(months.reduce((s, m) => s + m.planned, 0)),
    actualTotal: round(months.reduce((s, m) => s + m.actual, 0)),
  });
});

module.exports = router;
