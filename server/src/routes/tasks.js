const express = require('express');
const prisma = require('../lib/prisma');
const { syncTaskExpense } = require('../lib/taskExpense');

const router = express.Router({ mergeParams: true });

function decimalOrNull(v) {
  return v !== undefined && v !== null && v !== '' ? Number(v) : null;
}

// A building sees its own tasks plus the tasks of the complex it belongs to - never the
// private tasks of another building in that complex.
async function scopeFilter(buildingId) {
  const member = await prisma.complexMember.findUnique({ where: { buildingId } });
  return member ? { OR: [{ buildingId }, { complexId: member.complexId }] } : { buildingId };
}

function isResident(req) {
  return req.buildingRole === 'RESIDENT';
}

// Residents see what a task is and where it stands - but money only on faults they reported.
function shapeTask(t, req) {
  const own = t.reportedById === req.user.id;
  const hideMoney = isResident(req) && !own;
  return {
    ...t,
    cost: hideMoney ? undefined : t.cost,
    paidFrom: hideMoney ? undefined : t.paidFrom,
    contractorPhone: hideMoney ? undefined : t.contractorPhone,
    scope: t.complexId ? 'COMPLEX' : 'BUILDING',
    complexName: t.complex?.name ?? null,
    reportedByName: t.reportedBy?.name ?? null,
    recurringTitle: t.recurringItem?.title ?? null,
    awaitingLedger: Boolean(t.cost) && !t.paidFrom && t.buildingId !== null,
    mine: own,
    complex: undefined,
    reportedBy: undefined,
    recurringItem: undefined,
  };
}

const TASK_INCLUDE = {
  complex: { select: { name: true } },
  reportedBy: { select: { name: true } },
  recurringItem: { select: { title: true } },
};

router.get('/', async (req, res) => {
  const { status } = req.query;
  const tasks = await prisma.task.findMany({
    where: { AND: [await scopeFilter(req.buildingId), ...(status ? [{ status }] : [])] },
    include: TASK_INCLUDE,
    orderBy: [{ createdAt: 'desc' }],
  });
  res.json(tasks.map((t) => shapeTask(t, req)));
});

async function checkRecurring(buildingId, recurringItemId) {
  if (!recurringItemId) return null;
  const item = await prisma.recurringItem.findFirst({ where: { id: Number(recurringItemId), buildingId } });
  return item ? item.id : undefined; // undefined = not found / foreign
}

router.post('/', async (req, res) => {
  const { title, description, location, urgency, attachmentUrl, isRecurring, recurrenceLabel, cost, paidFrom, dueDate, showOnTimeline, recurringItemId, contractorName, contractorPhone } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'יש להזין כותרת' });

  const resident = isResident(req);
  const linkedRecurring = resident ? null : await checkRecurring(req.buildingId, recurringItemId);
  if (linkedRecurring === undefined) return res.status(404).json({ error: 'המשימה החוזרת לא נמצאה' });

  // A resident opening a fault ("תקלת דייר"): a plain report, optionally with the contractor they
  // called and what it cost. Where the money comes from is the committee's call, so no ledger here.
  const hasCost = decimalOrNull(cost) !== null;
  const task = await prisma.task.create({
    data: {
      buildingId: req.buildingId,
      title: title.trim(),
      description: description || null,
      location: location || null,
      urgency: urgency || 'רגיל',
      attachmentUrl: attachmentUrl || null,
      isRecurring: resident ? false : Boolean(isRecurring) || Boolean(linkedRecurring),
      recurrenceLabel: resident ? null : recurrenceLabel || null,
      cost: decimalOrNull(cost),
      paidFrom: hasCost && !resident ? paidFrom || null : null,
      dueDate: !resident && dueDate ? new Date(dueDate) : null,
      showOnTimeline: resident ? true : showOnTimeline === undefined ? true : Boolean(showOnTimeline),
      recurringItemId: linkedRecurring || null,
      residentReported: resident,
      reportedById: resident ? req.user.id : null,
      contractorName: contractorName || null,
      contractorPhone: contractorPhone || null,
      status: resident && contractorName ? 'CONTRACTOR' : 'OPEN',
    },
    include: TASK_INCLUDE,
  });
  await syncTaskExpense(task);
  res.status(201).json(shapeTask(task, req));
});

// Only this building's own tasks can be changed here - complex tasks are managed from the complex.
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'משימה לא נמצאה' });

  const resident = isResident(req);
  if (resident && (existing.reportedById !== req.user.id || existing.status === 'RESOLVED')) {
    return res.status(403).json({ error: 'דייר יכול לעדכן רק תקלה שהוא פתח ושעדיין לא טופלה' });
  }

  const { title, description, location, urgency, status, attachmentUrl, cost, paidFrom, dueDate, showOnTimeline, recurringItemId, contractorName, contractorPhone, isRecurring } = req.body;

  let linkedRecurring;
  if (!resident && recurringItemId !== undefined) {
    linkedRecurring = await checkRecurring(req.buildingId, recurringItemId);
    if (linkedRecurring === undefined) return res.status(404).json({ error: 'המשימה החוזרת לא נמצאה' });
  }

  const data = {
    ...(title !== undefined && title.trim() && { title: title.trim() }),
    ...(description !== undefined && { description }),
    ...(location !== undefined && { location }),
    ...(urgency !== undefined && { urgency }),
    ...(attachmentUrl !== undefined && { attachmentUrl }),
    ...(cost !== undefined && { cost: decimalOrNull(cost) }),
    ...(contractorName !== undefined && { contractorName: contractorName || null }),
    ...(contractorPhone !== undefined && { contractorPhone: contractorPhone || null }),
    ...(!resident && paidFrom !== undefined && { paidFrom: paidFrom || null }),
    ...(!resident && dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    ...(!resident && showOnTimeline !== undefined && { showOnTimeline: Boolean(showOnTimeline) }),
    ...(!resident && isRecurring !== undefined && { isRecurring: Boolean(isRecurring) }),
    ...(!resident && recurringItemId !== undefined && { recurringItemId: linkedRecurring || null }),
  };
  if (!resident && status !== undefined) {
    data.status = status;
    data.resolvedAt = status === 'RESOLVED' ? new Date() : null;
  }
  if (data.cost === null) data.paidFrom = null;

  const task = await prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });
  await syncTaskExpense(task);
  res.json(shapeTask(task, req));
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'משימה לא נמצאה' });
  await prisma.$transaction([
    prisma.expense.deleteMany({ where: { taskId: id } }),
    prisma.task.delete({ where: { id } }),
  ]);
  res.status(204).end();
});

module.exports = router;
