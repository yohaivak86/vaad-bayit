import { useState } from 'react';
import { EXPENSE_CATEGORIES } from '../constants';
import { MONTHS_HE } from '../format';
import Sheet from './Sheet';

export const FREQUENCY_LABELS = { MONTHLY: 'חודשי', ANNUAL: 'שנתי', ONE_TIME: 'חד־פעמי' };

// Human description of when an expected item comes up.
export function describeSchedule(item) {
  if (item.frequency === 'MONTHLY') return 'בכל חודש';
  if (item.frequency === 'ANNUAL') return `בכל שנה, ב${MONTHS_HE[(item.month || 1) - 1]}`;
  return item.dueDate ? `חד־פעמי, ${new Date(item.dueDate).toLocaleDateString('he-IL', { timeZone: 'UTC' })}` : 'חד־פעמי';
}

// The next date this item is due - used when opening a task from it.
export function nextOccurrence(item) {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (item.frequency === 'ONE_TIME') return item.dueDate ? String(item.dueDate).slice(0, 10) : null;
  if (item.frequency === 'MONTHLY') return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const month = (item.month || 1) - 1;
  return new Date(Date.UTC(month >= m ? y : y + 1, month, 1)).toISOString().slice(0, 10);
}

// Add or edit an expected recurring / one-time cost.
export default function RecurringItemSheet({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    title: item?.title || '',
    category: item?.category || EXPENSE_CATEGORIES[0],
    frequency: item?.frequency || 'MONTHLY',
    month: item?.month || new Date().getMonth() + 1,
    dueDate: item?.dueDate ? String(item.dueDate).slice(0, 10) : '',
    expectedAmount: item?.expectedAmount != null ? String(item.expectedAmount) : '',
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const categories = EXPENSE_CATEGORIES.includes(form.category) ? EXPENSE_CATEGORIES : [form.category, ...EXPENSE_CATEGORIES];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        title: form.title,
        category: form.category,
        frequency: form.frequency,
        month: form.frequency === 'ANNUAL' ? Number(form.month) : undefined,
        dueDate: form.frequency === 'ONE_TIME' ? form.dueDate : undefined,
        expectedAmount: form.expectedAmount === '' ? null : Number(form.expectedAmount),
        notes: form.notes || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Sheet title={item ? 'עריכת הוצאה צפויה' : 'הוצאה צפויה חדשה'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="field"><label>שם</label><input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required placeholder="לדוגמה: שירות מעלית" /></div>
        <div className="field">
          <label>קטגוריה</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>כל כמה זמן</label>
          <div className="segmented" style={{ alignSelf: 'flex-start' }}>
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <button type="button" key={value} aria-pressed={form.frequency === value} onClick={() => set('frequency', value)}>{label}</button>
            ))}
          </div>
        </div>
        {form.frequency === 'ANNUAL' && (
          <div className="field">
            <label>באיזה חודש</label>
            <select className="input" value={form.month} onChange={(e) => set('month', e.target.value)}>
              {MONTHS_HE.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
        {form.frequency === 'ONE_TIME' && (
          <div className="field"><label>תאריך</label><input type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} required /></div>
        )}
        <div className="field"><label>סכום צפוי (₪, לא חובה)</label><input type="number" min="0" step="0.01" className="input" value={form.expectedAmount} onChange={(e) => set('expectedAmount', e.target.value)} inputMode="decimal" /></div>
        <div className="field"><label>הערות</label><input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        {error && <div className="alert alert--danger" role="alert">{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'שומר...' : 'שמירה'}</button>
      </form>
    </Sheet>
  );
}
