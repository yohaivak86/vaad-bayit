const express = require('express');
const prisma = require('../lib/prisma');
const { getBudgetProjection } = require('../lib/calc');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const items = await prisma.budgetItem.findMany({
    where: { buildingId: req.buildingId },
    orderBy: [{ category: 'asc' }, { label: 'asc' }],
  });
  res.json(items);
});

router.post('/', async (req, res) => {
  const { category, label, frequency, amount, months } = req.body;
  if (!category || !label || !frequency || amount === undefined || !Array.isArray(months)) {
    return res.status(400).json({ error: 'category, label, frequency, amount and months[] are required' });
  }
  const item = await prisma.budgetItem.create({
    data: { buildingId: req.buildingId, category, label, frequency, amount: Number(amount), months: months.map(Number) },
  });
  res.status(201).json(item);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.budgetItem.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'סעיף לא נמצא' });

  const { category, label, frequency, amount, months } = req.body;
  const item = await prisma.budgetItem.update({
    where: { id },
    data: {
      ...(category !== undefined && { category }),
      ...(label !== undefined && { label }),
      ...(frequency !== undefined && { frequency }),
      ...(amount !== undefined && { amount: Number(amount) }),
      ...(months !== undefined && { months: months.map(Number) }),
    },
  });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.budgetItem.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'סעיף לא נמצא' });
  await prisma.budgetItem.delete({ where: { id } });
  res.status(204).end();
});

router.get('/projection', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const projection = await getBudgetProjection(req.buildingId, year);
  res.json(projection);
});

module.exports = router;
