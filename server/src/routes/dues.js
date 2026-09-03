const express = require('express');
const prisma = require('../lib/prisma');
const { getBuilding, toNum } = require('../lib/calc');

const router = express.Router({ mergeParams: true });

async function ensureYearDues(buildingId, year) {
  const [tenants, building] = await Promise.all([
    prisma.tenant.findMany({ where: { buildingId, active: true } }),
    getBuilding(buildingId),
  ]);
  const defaultFee = toNum(building.monthlyFeeDefault);

  for (const tenant of tenants) {
    const fee = tenant.monthlyFee !== null && tenant.monthlyFee !== undefined ? toNum(tenant.monthlyFee) : defaultFee;
    for (let month = 1; month <= 12; month++) {
      await prisma.due.upsert({
        where: { tenantId_year_month: { tenantId: tenant.id, year, month } },
        update: {},
        create: { tenantId: tenant.id, year, month, amountDue: fee, status: 'UNPAID' },
      });
    }
  }
}

async function findOwnedDue(buildingId, id) {
  return prisma.due.findFirst({ where: { id, tenant: { buildingId } } });
}

// Full payment matrix for a given year: tenants with their 12 monthly due records.
router.get('/', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  await ensureYearDues(req.buildingId, year);

  const tenants = await prisma.tenant.findMany({
    where: { buildingId: req.buildingId, active: true },
    orderBy: [{ floor: 'asc' }, { apartmentNumber: 'asc' }],
    include: { dues: { where: { year }, orderBy: { month: 'asc' } } },
  });

  res.json({ year, tenants });
});

router.put('/:id/note', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await findOwnedDue(req.buildingId, id))) return res.status(404).json({ error: 'רשומה לא נמצאה' });
  const { note } = req.body;
  const due = await prisma.due.update({ where: { id }, data: { note: note || null } });
  res.json(due);
});

// Tenant self-reports a cash payment -> pending admin approval.
router.post('/:id/report-cash', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await findOwnedDue(req.buildingId, id))) return res.status(404).json({ error: 'רשומה לא נמצאה' });
  const due = await prisma.due.update({
    where: { id },
    data: { status: 'PENDING_CASH_APPROVAL', reportedByTenant: true },
  });
  res.json(due);
});

// Admin one-click approval of a reported (or fresh) cash payment.
router.post('/:id/approve-cash', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await findOwnedDue(req.buildingId, id))) return res.status(404).json({ error: 'רשומה לא נמצאה' });
  const due = await prisma.due.update({
    where: { id },
    data: { status: 'PAID_CASH', approvedAt: new Date(), paidDate: new Date() },
  });
  res.json(due);
});

router.post('/:id/mark-bank', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await findOwnedDue(req.buildingId, id))) return res.status(404).json({ error: 'רשומה לא נמצאה' });
  const due = await prisma.due.update({
    where: { id },
    data: { status: 'PAID_BANK', paidDate: new Date() },
  });
  res.json(due);
});

router.post('/:id/mark-unpaid', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await findOwnedDue(req.buildingId, id))) return res.status(404).json({ error: 'רשומה לא נמצאה' });
  const due = await prisma.due.update({
    where: { id },
    data: { status: 'UNPAID', paidDate: null, approvedAt: null, reportedByTenant: false },
  });
  res.json(due);
});

module.exports = router;
