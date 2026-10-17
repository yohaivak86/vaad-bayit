const express = require('express');
const prisma = require('../lib/prisma');
const { toNum, round2, MONTHS_HE } = require('../lib/calc');

const router = express.Router({ mergeParams: true });

// What is expected in a coming month (default: next month) - the dashboard's "what's ahead" list.
// Tasks are visible to every role; expected costs (planned recurring items + annual budget lines)
// only to committee reps.
router.get('/', async (req, res) => {
  const offset = Math.min(Math.max(Number(req.query.offset ?? 1) || 0, 0), 12);
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  const start = target;
  const end = new Date(Date.UTC(year, month, 1));
  const canSeeMoney = req.buildingRole === 'COMMITTEE';

  const member = await prisma.complexMember.findUnique({ where: { buildingId: req.buildingId } });
  const scope = member ? { OR: [{ buildingId: req.buildingId }, { complexId: member.complexId }] } : { buildingId: req.buildingId };

  const tasks = await prisma.task.findMany({
    where: { ...scope, status: { not: 'RESOLVED' }, dueDate: { gte: start, lt: end } },
    include: { recurringItem: { select: { title: true } } },
    orderBy: { dueDate: 'asc' },
  });

  const result = {
    year,
    month,
    monthLabel: MONTHS_HE[month - 1],
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      date: t.dueDate,
      urgent: t.urgency === 'דחוף',
      status: t.status,
      scope: t.complexId ? 'COMPLEX' : 'BUILDING',
      recurringItemId: t.recurringItemId,
    })),
    expenses: [],
    expectedTotal: undefined,
  };
  if (!canSeeMoney) return res.json(result);

  const [items, budget, monthExpenses, monthTasks] = await Promise.all([
    prisma.recurringItem.findMany({ where: { buildingId: req.buildingId, active: true } }),
    prisma.budgetItem.findMany({ where: { buildingId: req.buildingId, months: { has: month } } }),
    prisma.expense.findMany({ where: { buildingId: req.buildingId, recurringItemId: { not: null }, date: { gte: start, lt: end } }, select: { recurringItemId: true } }),
    prisma.task.findMany({ where: { buildingId: req.buildingId, recurringItemId: { not: null }, dueDate: { gte: start, lt: end } }, select: { recurringItemId: true } }),
  ]);
  const paidIds = new Set(monthExpenses.map((e) => e.recurringItemId));
  const taskIds = new Set(monthTasks.map((t) => t.recurringItemId));

  const due = items.filter((i) => {
    if (i.frequency === 'MONTHLY') return true;
    if (i.frequency === 'ANNUAL') return i.month === month;
    return i.dueDate && i.dueDate >= start && i.dueDate < end;
  });

  const expenses = [
    ...due.map((i) => ({
      source: 'RECURRING',
      id: i.id,
      title: i.title,
      category: i.category,
      frequency: i.frequency,
      date: i.dueDate,
      expectedAmount: i.expectedAmount !== null ? toNum(i.expectedAmount) : null,
      handled: paidIds.has(i.id),
      hasTask: taskIds.has(i.id),
    })),
    ...budget.map((b) => ({
      source: 'BUDGET',
      id: b.id,
      title: b.label,
      category: b.category,
      frequency: b.frequency,
      expectedAmount: toNum(b.amount),
      handled: false,
      hasTask: false,
    })),
  ];

  result.expenses = expenses;
  result.expectedTotal = round2(expenses.filter((e) => !e.handled).reduce((s, e) => s + (e.expectedAmount || 0), 0));
  res.json(result);
});

module.exports = router;
