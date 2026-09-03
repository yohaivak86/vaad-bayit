import { useState } from 'react';
import { X, Paperclip } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '../constants';

const today = () => new Date().toISOString().slice(0, 10);

export default function AddExpenseModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    date: today(),
    category: EXPENSE_CATEGORIES[0],
    description: '',
    supplierName: '',
    amount: '',
    paidFrom: 'DIGITAL',
    receiptUrl: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      await onSave({ ...form, amount: Number(form.amount) }, receiptFile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">רישום הוצאה</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          <Field label="תאריך">
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input" required />
          </Field>
          <Field label="קטגוריה">
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="ספק">
            <input value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} className="input" placeholder="שם הספק" />
          </Field>
          <Field label="תיאור">
            <input value={form.description} onChange={(e) => set('description', e.target.value)} className="input" placeholder="פירוט ההוצאה" />
          </Field>
          <Field label="סכום (₪)">
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input" required />
          </Field>
          <Field label="שולם מתוך">
            <div className="flex gap-2">
              {[
                { v: 'DIGITAL', label: 'בנק / PayBox' },
                { v: 'CASH', label: 'מזומן' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.v}
                  onClick={() => set('paidFrom', opt.v)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                    form.paidFrom === opt.v ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="קבלה (אופציונלי)">
            <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
              <Paperclip size={16} />
              {receiptFile ? receiptFile.name : 'העלאת תמונה או PDF של הקבלה'}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
            </label>
          </Field>
          <Field label="או קישור לקבלה (אופציונלי)">
            <input value={form.receiptUrl} onChange={(e) => set('receiptUrl', e.target.value)} className="input" placeholder="https://..." />
          </Field>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition"
            >
              {saving ? 'שומר...' : 'שמירת הוצאה'}
            </button>
            <button type="button" onClick={onClose} className="px-4 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
