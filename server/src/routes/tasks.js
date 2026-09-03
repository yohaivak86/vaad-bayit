const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const { status } = req.query;
  const tasks = await prisma.task.findMany({
    where: { buildingId: req.buildingId, ...(status && { status }) },
    orderBy: [{ createdAt: 'desc' }],
  });
  res.json(tasks);
});

router.post('/', async (req, res) => {
  const { title, description, location, urgency, attachmentUrl, isRecurring, recurrenceLabel } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const task = await prisma.task.create({
    data: {
      buildingId: req.buildingId,
      title,
      description: description || null,
      location: location || null,
      urgency: urgency || 'רגיל',
      attachmentUrl: attachmentUrl || null,
      isRecurring: Boolean(isRecurring),
      recurrenceLabel: recurrenceLabel || null,
    },
  });
  res.status(201).json(task);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'משימה לא נמצאה' });

  const { title, description, location, urgency, status, attachmentUrl } = req.body;
  const data = {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(location !== undefined && { location }),
    ...(urgency !== undefined && { urgency }),
    ...(attachmentUrl !== undefined && { attachmentUrl }),
  };
  if (status !== undefined) {
    data.status = status;
    data.resolvedAt = status === 'RESOLVED' ? new Date() : null;
  }
  const task = await prisma.task.update({ where: { id }, data });
  res.json(task);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'משימה לא נמצאה' });
  await prisma.task.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
