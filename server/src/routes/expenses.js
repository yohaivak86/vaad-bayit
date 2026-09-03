const express = require('express');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { toNum, round2 } = require('../lib/calc');

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Listing/summary never returns the receipt bytes - just enough to know one exists.
const LIST_SELECT = {
  id: true, buildingId: true, date: true, category: true, description: true, supplierName: true,
  amount: true, paidFrom: true, receiptUrl: true, receiptFileName: true, receiptMimeType: true,
  createdAt: true, complexExpenseId: true,
};

function buildWhere(buildingId, query) {
  const { from, to, category, paidFrom } = query;
  const where = { buildingId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to + 'T23:59:59.999Z');
  }
  if (category) where.category = category;
  if (paidFrom) where.paidFrom = paidFrom;
  return where;
}

router.get('/', async (req, res) => {
  const where = buildWhere(req.buildingId, req.query);
  const expenses = await prisma.expense.findMany({ where, select: LIST_SELECT, orderBy: { date: 'desc' } });
  res.json(expenses);
});

router.get('/summary', async (req, res) => {
  const where = buildWhere(req.buildingId, req.query);
  const expenses = await prisma.expense.findMany({ where, select: { amount: true, category: true, paidFrom: true } });
  const total = round2(expenses.reduce((s, e) => s + toNum(e.amount), 0));
  const byCategory = {};
  for (const e of expenses) {
    byCategory[e.category] = round2((byCategory[e.category] || 0) + toNum(e.amount));
  }
  const byPaidFrom = { CASH: 0, DIGITAL: 0 };
  for (const e of expenses) {
    byPaidFrom[e.paidFrom] = round2((byPaidFrom[e.paidFrom] || 0) + toNum(e.amount));
  }
  res.json({ total, count: expenses.length, byCategory, byPaidFrom });
});

router.post('/', async (req, res) => {
  const { date, category, description, supplierName, amount, paidFrom, receiptUrl } = req.body;
  if (!date || !category || amount === undefined || !paidFrom) {
    return res.status(400).json({ error: 'date, category, amount and paidFrom are required' });
  }
  const expense = await prisma.expense.create({
    data: {
      buildingId: req.buildingId,
      date: new Date(date),
      category,
      description: description || null,
      supplierName: supplierName || null,
      amount: Number(amount),
      paidFrom,
      receiptUrl: receiptUrl || null,
    },
    select: LIST_SELECT,
  });
  res.status(201).json(expense);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.expense.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'הוצאה לא נמצאה' });

  const { date, category, description, supplierName, amount, paidFrom, receiptUrl } = req.body;
  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(date !== undefined && { date: new Date(date) }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description }),
      ...(supplierName !== undefined && { supplierName }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(paidFrom !== undefined && { paidFrom }),
      ...(receiptUrl !== undefined && { receiptUrl }),
    },
    select: LIST_SELECT,
  });
  res.json(expense);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.expense.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'הוצאה לא נמצאה' });
  await prisma.expense.delete({ where: { id } });
  res.status(204).end();
});

// Uploads or replaces the receipt file for an existing expense - can be done at creation
// time or any time after, since it's a separate step from the expense's own fields.
router.post('/:id/receipt', upload.single('receipt'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.expense.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'הוצאה לא נמצאה' });
  if (!req.file) return res.status(400).json({ error: 'לא צורף קובץ תקין (תמונה או PDF, עד 5MB)' });

  await prisma.expense.update({
    where: { id },
    data: { receiptFileName: req.file.originalname, receiptMimeType: req.file.mimetype, receiptData: req.file.buffer },
  });
  res.status(201).json({ receiptFileName: req.file.originalname });
});

router.get('/:id/receipt', async (req, res) => {
  const id = Number(req.params.id);
  const expense = await prisma.expense.findFirst({
    where: { id, buildingId: req.buildingId },
    select: { receiptData: true, receiptMimeType: true, receiptFileName: true },
  });
  if (!expense?.receiptData) return res.status(404).json({ error: 'אין קבלה מצורפת' });

  res.setHeader('Content-Type', expense.receiptMimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(expense.receiptFileName || 'receipt')}"`);
  res.send(expense.receiptData);
});

router.delete('/:id/receipt', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.expense.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'הוצאה לא נמצאה' });

  await prisma.expense.update({
    where: { id },
    data: { receiptFileName: null, receiptMimeType: null, receiptData: null },
  });
  res.status(204).end();
});

module.exports = router;
