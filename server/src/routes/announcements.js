const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const announcements = await prisma.announcement.findMany({
    where: { buildingId: req.buildingId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(announcements);
});

router.post('/', async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title הוא שדה חובה' });

  const announcement = await prisma.announcement.create({
    data: { buildingId: req.buildingId, title, body: body || null },
  });
  res.status(201).json(announcement);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.announcement.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'הודעה לא נמצאה' });
  await prisma.announcement.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
