const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const minutes = await prisma.meetingMinutes.findMany({
    where: { buildingId: req.buildingId },
    orderBy: { date: 'desc' },
  });
  res.json(minutes);
});

router.post('/', async (req, res) => {
  const { title, date, content, attachmentUrl } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title ו-date הם שדות חובה' });

  const minutes = await prisma.meetingMinutes.create({
    data: { buildingId: req.buildingId, title, date: new Date(date), content: content || null, attachmentUrl: attachmentUrl || null },
  });
  res.status(201).json(minutes);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.meetingMinutes.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'סיכום ישיבה לא נמצא' });
  await prisma.meetingMinutes.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
