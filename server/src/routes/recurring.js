const express = require('express');
const prisma = require('../lib/prisma');
const { toNum } = require('../lib/calc');

// Expected recurring / one-time costs and chores ("פריטים צפויים"). Committee only (mounted behind
// requireCommittee) - the dashboard's "next month" list is the resident-safe view of it.
const router = express.Router({ mergeParams: true });

const FREQUENCIES = ['MONTHLY', 'ANNUAL', 'ONE_TIME'];

function shape(item, handledByMonth) {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    frequency: item.frequency,
    month: item.month,
    dueDate: item.dueDate,
    expectedAmount: item.expectedAmount !== null ? toNum(item.expectedAmount) : null,
    notes: item.notes,
    active: item.active,
    tasksCount: item._count?.tasks ?? 0,
    expensesCount: item._count?.expenses ?? 0,
    ...(handledByMonth && { handledThisMonth: handledByMonth.has(item.id) }),
  };
}

// Validates and normalizes one item; throws a 400 error with a Hebrew message on bad input.
function normalize(body) {
  const title = String(body.title || '').trim();
  if (!title) throw Object.assign(new Error('יש להזין שם'), { status: 400 });
  if (!FREQUENCIES.includes(body.frequency)) throw Object.assign(new Error('תדירות חייבת להיות חודשית, שנתית או חד־פעמית'), { status: 400 });

  const data = {
    title,
    category: String(body.category || '').trim() || 'אחר',
    frequency: body.frequency,
    month: null,
    dueDate: null,
    expectedAmount: body.expectedAmount !== undefined && body.expectedAmount !== null && body.expectedAmount !== '' ? Number(body.expectedAmount) : null,
    notes: body.notes ? String(body.notes) : null,
  };
  if (data.expectedAmount !== null && !(data.expectedAmount >= 0)) throw Object.assign(new Error('סכום לא תקין'), { status: 400 });

  if (body.frequency === 'ANNUAL') {
    const m = Number(body.month);
    if (!(m >= 1 && m <= 12)) throw Object.assign(new Error('להוצאה שנתית יש לבחור חודש'), { status: 400 });
    data.month = m;
  }
  if (body.frequency === 'ONE_TIME') {
    const d = body.dueDate ? new Date(body.dueDate) : null;
    if (!d || Number.isNaN(d.getTime())) throw Object.assign(new Error('להוצאה חד־פעמית יש לבחור תאריך'), { status: 400 });
    data.dueDate = d;
  }
  return data;
}

router.get('/', async (req, res) => {
  const items = await prisma.recurringItem.findMany({
    where: { buildingId: req.buildingId },
    include: { _count: { select: { tasks: true, expenses: true } } },
    orderBy: [{ active: 'desc' }, { frequency: 'asc' }, { title: 'asc' }],
  });
  res.json(items.map((i) => shape(i)));
});

router.post('/', async (req, res) => {
  try {
    const item = await prisma.recurringItem.create({ data: { ...normalize(req.body), buildingId: req.buildingId } });
    res.status(201).json(shape(item));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// Bulk load (the Excel upload): every row is validated first - nothing is saved if any row is bad,
// so the committee can fix the file and upload it again without ending up with half of it.
router.post('/bulk', async (req, res) => {
  const rows = Array.isArray(req.body.items) ? req.body.items : [];
  if (rows.length === 0) return res.status(400).json({ error: 'הקובץ ריק' });
  if (rows.length > 300) return res.status(400).json({ error: 'ניתן לטעון עד 300 שורות בבת אחת' });

  const data = [];
  const errors = [];
  rows.forEach((row, i) => {
    try {
      data.push({ ...normalize(row), buildingId: req.buildingId });
    } catch (err) {
      if (!err.status) throw err;
      errors.push({ row: i + 1, error: err.message });
    }
  });
  if (errors.length) return res.status(400).json({ error: `נמצאו ${errors.length} שורות לא תקינות`, errors });

  const result = await prisma.recurringItem.createMany({ data });
  res.status(201).json({ created: result.count });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.recurringItem.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'הפריט לא נמצא' });

  try {
    // Merge over the stored values so a partial update (e.g. just toggling "active") stays valid.
    const merged = { ...existing, ...req.body };
    const data = normalize({ ...merged, expectedAmount: merged.expectedAmount !== null ? toNum(merged.expectedAmount) : null });
    const item = await prisma.recurringItem.update({
      where: { id },
      data: { ...data, ...(req.body.active !== undefined && { active: Boolean(req.body.active) }) },
    });
    res.json(shape(item));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

// Deleting a template keeps the tasks and expenses that were linked to it (the link is just cleared).
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.recurringItem.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'הפריט לא נמצא' });
  await prisma.recurringItem.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
