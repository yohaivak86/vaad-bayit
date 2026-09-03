const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const procedures = await prisma.procedure.findMany({
    where: { buildingId: req.buildingId },
    orderBy: { title: 'asc' },
  });
  res.json(procedures);
});

router.post('/', async (req, res) => {
  const { title, content, attachmentUrl } = req.body;
  if (!title) return res.status(400).json({ error: 'title הוא שדה חובה' });

  const procedure = await prisma.procedure.create({
    data: { buildingId: req.buildingId, title, content: content || null, attachmentUrl: attachmentUrl || null },
  });
  res.status(201).json(procedure);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.procedure.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'נוהל לא נמצא' });

  const { title, content, attachmentUrl } = req.body;
  const procedure = await prisma.procedure.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(attachmentUrl !== undefined && { attachmentUrl }),
    },
  });
  res.json(procedure);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.procedure.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'נוהל לא נמצא' });
  await prisma.procedure.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
