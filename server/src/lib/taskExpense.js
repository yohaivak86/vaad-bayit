const prisma = require('./prisma');
const { toNum } = require('./calc');

const TASK_EXPENSE_CATEGORY = 'תחזוקה ותיקונים';

// A task's cost is also a real expense: whenever a task has a cost AND a ledger to pay it from,
// a matching Expense row (Expense.taskId) is kept in sync; clearing either removes it again.
// A cost with no ledger yet (e.g. entered by a resident) stays on the task as "awaiting the
// committee" and never touches the treasury until a committee rep chooses where it was paid from.
async function syncTaskExpense(task) {
  if (!task.buildingId) return null;
  const existing = await prisma.expense.findFirst({ where: { taskId: task.id } });
  const amount = toNum(task.cost);

  if (!(amount > 0) || !task.paidFrom) {
    if (existing) await prisma.expense.delete({ where: { id: existing.id } });
    return null;
  }

  const recurring = task.recurringItemId
    ? await prisma.recurringItem.findUnique({ where: { id: task.recurringItemId }, select: { category: true } })
    : null;

  const data = {
    category: recurring?.category || existing?.category || TASK_EXPENSE_CATEGORY,
    description: `משימה: ${task.title}`,
    supplierName: task.contractorName || null,
    amount,
    paidFrom: task.paidFrom,
    recurringItemId: task.recurringItemId || null,
  };

  if (existing) {
    return prisma.expense.update({ where: { id: existing.id }, data });
  }
  return prisma.expense.create({
    data: { ...data, buildingId: task.buildingId, taskId: task.id, date: task.resolvedAt || task.dueDate || new Date() },
  });
}

module.exports = { syncTaskExpense, TASK_EXPENSE_CATEGORY };
