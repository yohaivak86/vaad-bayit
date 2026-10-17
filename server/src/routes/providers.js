const express = require('express');
const prisma = require('../lib/prisma');
const { requireCommittee } = require('../middleware/auth');
const { listBuildingProviders } = require('../lib/providers');

const router = express.Router({ mergeParams: true });

// Readable by every role (the building profile is open to all users).
router.get('/', async (req, res) => {
  res.json(await listBuildingProviders(req.buildingId));
});

router.post('/', requireCommittee, async (req, res) => {
  const { name, category, phone, email, notes } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name ו-category הם שדות חובה' });
  const provider = await prisma.serviceProvider.create({
    data: { buildingId: req.buildingId, name, category, phone: phone || null, email: email || null, notes: notes || null },
  });
  res.status(201).json(provider);
});

// Only the building's own providers; complex-level providers are edited from the complex.
router.put('/:id', requireCommittee, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.serviceProvider.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'נותן שירות לא נמצא' });

  const { name, category, phone, email, notes } = req.body;
  const provider = await prisma.serviceProvider.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(email !== undefined && { email: email || null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
  });
  res.json(provider);
});

router.delete('/:id', requireCommittee, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.serviceProvider.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'נותן שירות לא נמצא' });
  await prisma.serviceProvider.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
