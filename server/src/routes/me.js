const express = require('express');
const prisma = require('../lib/prisma');
const { ensureYearDues } = require('./dues');
const { tenantForUser } = require('../lib/apartments');

const router = express.Router({ mergeParams: true });

async function myTenant(req) {
  return tenantForUser(req.buildingId, req.user.id);
}

// A resident's own page: just their apartment's details and their own monthly dues.
router.get('/', async (req, res) => {
  const tenant = await myTenant(req);
  if (!tenant) return res.json({ tenant: null, dues: [] });

  const year = Number(req.query.year) || new Date().getFullYear();
  await ensureYearDues(req.buildingId, year);
  const dues = await prisma.due.findMany({ where: { tenantId: tenant.id, year }, orderBy: { month: 'asc' } });

  res.json({
    year,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone,
      floor: tenant.floor,
      apartmentNumber: tenant.apartmentNumber,
      role: tenant.role,
    },
    dues: dues.map((d) => ({ id: d.id, month: d.month, amountDue: Number(d.amountDue), status: d.status })),
  });
});

// A resident may change only their own personal details - never fees, floor or apartment.
router.put('/', async (req, res) => {
  const tenant = await myTenant(req);
  if (!tenant) return res.status(404).json({ error: 'החשבון שלך עדיין לא משויך לדירה - פנו לנציג הוועד' });

  const { name, phone } = req.body;
  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      ...(name !== undefined && name.trim() && { name: name.trim() }),
      ...(phone !== undefined && { phone: phone || null }),
    },
  });
  res.json({ id: updated.id, name: updated.name, phone: updated.phone });
});

// A request, not an entry: marks one of the resident's own months as "paid in cash, pending
// approval". It doesn't touch any balance until a committee rep approves it.
router.post('/dues/:dueId/report-cash', async (req, res) => {
  const tenant = await myTenant(req);
  if (!tenant) return res.status(404).json({ error: 'החשבון שלך עדיין לא משויך לדירה - פנו לנציג הוועד' });

  const due = await prisma.due.findFirst({ where: { id: Number(req.params.dueId), tenantId: tenant.id } });
  if (!due) return res.status(404).json({ error: 'רשומה לא נמצאה' });
  if (due.status !== 'UNPAID') return res.status(400).json({ error: 'ניתן לדווח רק על חודש שטרם שולם' });

  const updated = await prisma.due.update({
    where: { id: due.id },
    data: { status: 'PENDING_CASH_APPROVAL', reportedByTenant: true },
  });
  res.json({ id: updated.id, status: updated.status });
});

module.exports = router;
