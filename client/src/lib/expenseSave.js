import { api } from '../api';

// Creates an expense. A "monthly" or "annual" expense also becomes an expected item - so it shows up in
// the plan and in the dashboard's next-month list from now on. A one-time expense is just recorded.
export async function createExpenseFromForm(buildingId, form, receiptFile) {
  const { kind, ...fields } = form;
  let recurringItemId = fields.recurringItemId || null;

  if (!recurringItemId && (kind === 'MONTHLY' || kind === 'ANNUAL')) {
    const item = await api.createRecurring(buildingId, {
      title: fields.description || fields.category,
      category: fields.category,
      frequency: kind,
      month: kind === 'ANNUAL' ? new Date(fields.date).getUTCMonth() + 1 : undefined,
      expectedAmount: fields.amount,
    });
    recurringItemId = item.id;
  }

  const created = await api.createExpense(buildingId, { ...fields, recurringItemId });
  if (receiptFile) await api.uploadReceipt(buildingId, created.id, receiptFile);
  return created;
}

export async function updateExpenseFromForm(buildingId, id, form, receiptFile) {
  const { kind, recurringItemId, ...fields } = form; // eslint-disable-line no-unused-vars
  const updated = await api.updateExpense(buildingId, id, fields);
  if (receiptFile) await api.uploadReceipt(buildingId, id, receiptFile);
  return updated;
}
