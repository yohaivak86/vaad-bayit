const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const tenants = await prisma.tenant.findMany({
    where: { buildingId: req.buildingId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(tenants);
});

router.post('/', async (req, res) => {
  const { floor, apartmentNumber, name, phone, role, monthlyFee } = req.body;
  if (!apartmentNumber || !name) {
    return res.status(400).json({ error: 'apartmentNumber and name are required' });
  }
  const last = await prisma.tenant.findFirst({
    where: { buildingId: req.buildingId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const tenant = await prisma.tenant.create({
    data: {
      buildingId: req.buildingId,
      floor: Number(floor) || 0,
      apartmentNumber: String(apartmentNumber),
      name,
      phone: phone || null,
      role: role || 'OWNER',
      monthlyFee: monthlyFee !== undefined && monthlyFee !== null && monthlyFee !== '' ? Number(monthlyFee) : null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  res.status(201).json(tenant);
});

// Persists a manual display order for the building's active tenants (e.g. after a
// drag/move-up-down in the UI) - tenantIds must be exactly the set of active tenants.
router.put('/reorder', async (req, res) => {
  const { tenantIds } = req.body;
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
    return res.status(400).json({ error: 'tenantIds הוא שדה חובה' });
  }

  const activeTenants = await prisma.tenant.findMany({
    where: { buildingId: req.buildingId, active: true },
    select: { id: true },
  });
  const activeIds = new Set(activeTenants.map((t) => t.id));
  const submittedIds = tenantIds.map(Number);
  const isValidPermutation =
    submittedIds.length === activeIds.size && submittedIds.every((id) => activeIds.has(id)) && new Set(submittedIds).size === submittedIds.length;
  if (!isValidPermutation) {
    return res.status(400).json({ error: 'הרשימה חייבת לכלול בדיוק את כל הדיירים הפעילים, כל אחד פעם אחת' });
  }

  await prisma.$transaction(
    submittedIds.map((id, index) => prisma.tenant.update({ where: { id }, data: { sortOrder: index } }))
  );
  res.json({ ok: true });
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { floor, apartmentNumber, name, phone, role, monthlyFee, active } = req.body;
  const existing = await prisma.tenant.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'דייר לא נמצא' });

  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      ...(floor !== undefined && { floor: Number(floor) }),
      ...(apartmentNumber !== undefined && { apartmentNumber: String(apartmentNumber) }),
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(role !== undefined && { role }),
      ...(monthlyFee !== undefined && { monthlyFee: monthlyFee === null || monthlyFee === '' ? null : Number(monthlyFee) }),
      ...(active !== undefined && { active: Boolean(active) }),
    },
  });
  res.json(tenant);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.tenant.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'דייר לא נמצא' });
  await prisma.tenant.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
