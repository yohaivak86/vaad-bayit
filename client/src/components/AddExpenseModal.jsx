import { useState } from 'react';
import { Paperclip, Link2 } from 'lucide-react';
import { EXPENSE_CATEGORIES, PAID_FROM_OPTIONS } from '../constants';
import Sheet from './Sheet';

const today = () => new Date().toISOString().slice(0, 10);

const KINDS = [
  { value: 'ONE_TIME', label: 'חד־פעמית' },
  { value: 'MONTHLY', label: 'חודשית' },
  { value: 'ANNUAL', label: 'שנתית' },
];

// Add a new expense - or edit an existing one (`expense`; committee reps can edit any expense at any
// time, including the ones a task posted). `prefill` fills a new expense from an expected item.
export default function AddExpenseModal({ expense, prefill, onClose, onSave }) {
  const editing = Boolean(expense);
  const [form, setForm] = useState({
    date: expense ? String(expense.date).slice(0, 10) : today(),
    category: expense?.category || prefill?.category || EXPENSE_CATEGORIES[0],
    description: expense?.description ?? prefill?.title ?? '',
    supplierName: expense?.supplierName ?? '',
    amount: expense ? String(Number(expense.amount)) : prefill?.expectedAmount != null ? String(prefill.expectedAmount) : '',
    paidFrom: expense?.paidFrom || 'BANK',
    receiptUrl: expense?.receiptUrl ?? '',
    showOnTimeline: expense?.showOnTimeline ?? false,
    kind: 'ONE_TIME',
    recurringItemId: prefill?.id ?? expense?.recurringItemId ?? null,
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const categories = EXPENSE_CATEGORIES.includes(form.category) ? EXPENSE_CATEGORIES : [form.category, ...EXPENSE_CATEGORIES];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setError('יש להזין סכום גדול מאפס.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, amount: Number(form.amount) }, receiptFile);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Sheet title={editing ? 'עריכת הוצאה' : prefill ? `רישום תשלום: ${prefill.title}` : 'הוצאה חדשה'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        {editing && expense.taskId && (
          <div className="alert alert--warning row"><Link2 size={20} /> <span>הוצאה זו נרשמה ממשימה. שינוי הסכום או מקור התשלום יתעדכן גם במשימה.</span></div>
        )}
        {!editing && !prefill && (
          <div className="field">
            <label>סוג ההוצאה</label>
            <div className="segmented" style={{ alignSelf: 'flex-start' }}>
              {KINDS.map((k) => (
                <button type="button" key={k.value} aria-pressed={form.kind === k.value} onClick={() => set('kind', k.value)}>{k.label}</button>
              ))}
            </div>
            {form.kind !== 'ONE_TIME' && (
              <span className="text-footnote text-secondary">
                {form.kind === 'MONTHLY' ? 'תירשם עכשיו, וגם תופיע ברשימת ההוצאות הצפויות בכל חודש.' : 'תירשם עכשיו, וגם תופיע ברשימת ההוצאות הצפויות בכל שנה, באותו חודש.'}
              </span>
            )}
          </div>
        )}

        <div className="field-row">
          <div className="field"><label>תאריך</label><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input" required /></div>
          <div className="field"><label>סכום (₪)</label><input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input" required inputMode="decimal" /></div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>קטגוריה</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>ספק</label><input value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} className="input" placeholder="שם הספק" /></div>
        </div>
        <div className="field"><label>תיאור</label><input value={form.description} onChange={(e) => set('description', e.target.value)} className="input" placeholder="פירוט ההוצאה" /></div>

        <div className="field">
          <label>שולם מתוך</label>
          <div className="segmented" style={{ alignSelf: 'flex-start' }}>
            {PAID_FROM_OPTIONS.map((opt) => (
              <button type="button" key={opt.value} aria-pressed={form.paidFrom === opt.value} onClick={() => set('paidFrom', opt.value)}>{opt.label}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>קבלה (לא חובה)</label>
          <label className="btn btn--secondary" style={{ cursor: 'pointer' }}>
            <Paperclip size={20} /> {receiptFile ? receiptFile.name : expense?.receiptFileName ? 'החלפת הקבלה' : 'צירוף תמונה או PDF'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="field"><label>או קישור לקבלה</label><input value={form.receiptUrl} onChange={(e) => set('receiptUrl', e.target.value)} className="input" placeholder="https://..." dir="ltr" style={{ textAlign: 'start' }} /></div>
        <label className="row text-footnote"><input type="checkbox" checked={form.showOnTimeline} onChange={(e) => set('showOnTimeline', e.target.checked)} /> להציג בציר הזמן השנתי</label>

        {error && <div className="alert alert--danger" role="alert">{error}</div>}
        <button type="submit" disabled={saving} className="btn btn--primary">{saving ? 'שומר...' : editing ? 'שמירת שינויים' : 'שמירת הוצאה'}</button>
      </form>
    </Sheet>
  );
}
