const express = require('express');
const prisma = require('../lib/prisma');

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

router.get('/', async (req, res) => {
  const { status } = req.query;
  const tasks = await prisma.task.findMany({
    where: { AND: [await scopeFilter(req.buildingId), ...(status ? [{ status }] : [])] },
    include: { complex: { select: { name: true } } },
    orderBy: [{ createdAt: 'desc' }],
  });
  res.json(
    tasks.map((t) => ({
      ...t,
      scope: t.complexId ? 'COMPLEX' : 'BUILDING',
      complexName: t.complex?.name ?? null,
      complex: undefined,
    }))
  );
});

router.post('/', async (req, res) => {
  const { title, description, location, urgency, attachmentUrl, isRecurring, recurrenceLabel, cost, paidFrom, dueDate, showOnTimeline } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const hasCost = decimalOrNull(cost) !== null;
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
      cost: decimalOrNull(cost),
      paidFrom: hasCost ? paidFrom || null : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      showOnTimeline: showOnTimeline === undefined ? true : Boolean(showOnTimeline),
    },
  });
  res.status(201).json(task);
});

// Only this building's own tasks can be changed here - complex tasks are managed from the complex.
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findFirst({ where: { id, buildingId: req.buildingId } });
  if (!existing) return res.status(404).json({ error: 'משימה לא נמצאה' });

  const { title, description, location, urgency, status, attachmentUrl, cost, paidFrom, dueDate, showOnTimeline } = req.body;
  const data = {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(location !== undefined && { location }),
    ...(urgency !== undefined && { urgency }),
    ...(attachmentUrl !== undefined && { attachmentUrl }),
    ...(cost !== undefined && { cost: decimalOrNull(cost) }),
    ...(paidFrom !== undefined && { paidFrom: paidFrom || null }),
    ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    ...(showOnTimeline !== undefined && { showOnTimeline: Boolean(showOnTimeline) }),
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
