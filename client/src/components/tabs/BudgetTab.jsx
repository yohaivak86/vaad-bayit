import { useEffect, useState } from 'react';
import { Plus, Trash2, X, AlertTriangle, TrendingUp } from 'lucide-react';
import { api } from '../../api';
import { EXPENSE_CATEGORIES, BUDGET_FREQUENCIES } from '../../constants';
import { formatILS, MONTHS_HE } from '../../format';

export default function BudgetTab({ buildingId }) {
  const [items, setItems] = useState(null);
  const [projection, setProjection] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [i, p] = await Promise.all([api.getBudgetItems(buildingId), api.getProjection(buildingId, year)]);
    setItems(i);
    setProjection(p);
  };

  useEffect(() => { load(); }, [year, buildingId]);

  const remove = async (id) => {
    await api.deleteBudgetItem(buildingId, id);
    await load();
  };

  const years = [year - 1, year, year + 1];
  const deficitMonth = projection?.months.find((m) => m.isDeficit);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-slate-800">תכנון הוצאות שנתי</h2>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input !w-auto text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-3 py-2 transition"
        >
          <Plus size={16} /> סעיף תקציבי
        </button>
      </div>

      {deficitMonth && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 mb-4 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          צפי לגירעון בקופה החל מחודש <b className="mx-1">{deficitMonth.monthLabel} {year}</b>
          (יתרה חזויה: {formatILS(deficitMonth.endOfMonthBalance)})
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <TrendingUp size={15} /> תחזית יתרת קופה חודשית - {year}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100">
                <th className="px-2 py-1.5 text-start font-semibold">חודש</th>
                <th className="px-2 py-1.5 font-semibold">הכנסה צפויה</th>
                <th className="px-2 py-1.5 font-semibold">הוצאה מתוכננת</th>
                <th className="px-2 py-1.5 font-semibold">שינוי נטו</th>
                <th className="px-2 py-1.5 font-semibold">יתרה חזויה</th>
              </tr>
            </thead>
            <tbody>
              {projection?.months.map((m) => (
                <tr key={m.month} className={`border-b border-slate-50 ${m.isDeficit ? 'bg-red-50' : ''}`}>
                  <td className="px-2 py-1.5 font-medium">{m.monthLabel}</td>
                  <td className="px-2 py-1.5 text-center text-emerald-600">{formatILS(m.projectedIncome)}</td>
                  <td className="px-2 py-1.5 text-center text-rose-600">{formatILS(m.scheduledExpense)}</td>
                  <td className={`px-2 py-1.5 text-center ${m.netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.netChange >= 0 ? '+' : ''}{formatILS(m.netChange)}
                  </td>
                  <td className={`px-2 py-1.5 text-center font-bold ${m.isDeficit ? 'text-red-700' : 'text-slate-800'}`}>
                    {formatILS(m.endOfMonthBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs">
              <th className="px-3 py-2 text-start font-semibold">סעיף</th>
              <th className="px-3 py-2 text-start font-semibold hidden sm:table-cell">קטגוריה</th>
              <th className="px-3 py-2 text-start font-semibold">תדירות</th>
              <th className="px-3 py-2 text-start font-semibold">סכום</th>
              <th className="px-3 py-2 no-print"></th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{item.label}</td>
                <td className="px-3 py-2 hidden sm:table-cell text-slate-500">{item.category}</td>
                <td className="px-3 py-2">{BUDGET_FREQUENCIES.find((f) => f.value === item.frequency)?.label}</td>
                <td className="px-3 py-2">{formatILS(item.amount)}</td>
                <td className="px-3 py-2">
                  <button onClick={() => remove(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {items?.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 py-8 text-sm">לא הוגדרו סעיפי תקציב</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <BudgetItemFormModal
          onClose={() => setShowForm(false)}
          onSave={async (form) => { await api.createBudgetItem(buildingId, form); setShowForm(false); await load(); }}
        />
      )}
    </div>
  );
}

const FREQUENCY_DEFAULT_MONTHS = {
  MONTHLY: [1,2,3,4,5,6,7,8,9,10,11,12],
  BIMONTHLY: [2,4,6,8,10,12],
  SEMIANNUAL: [3,9],
  ANNUAL: [1],
};

function BudgetItemFormModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    label: '',
    frequency: 'MONTHLY',
    amount: '',
    months: FREQUENCY_DEFAULT_MONTHS.MONTHLY,
  });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setFrequency = (freq) => setForm((f) => ({ ...f, frequency: freq, months: FREQUENCY_DEFAULT_MONTHS[freq] }));

  const toggleMonth = (m) => {
    setForm((f) => ({
      ...f,
      months: f.months.includes(m) ? f.months.filter((x) => x !== m) : [...f.months, m].sort((a, b) => a - b),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">סעיף תקציבי חדש</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, amount: Number(form.amount) }); }} className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">שם הסעיף</label>
            <input value={form.label} onChange={(e) => set('label', e.target.value)} className="input" required placeholder='למשל: חוזה שירות מעליות' />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">קטגוריה</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תדירות</label>
            <select value={form.frequency} onChange={(e) => setFrequency(e.target.value)} className="input">
              {BUDGET_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">סכום כל תשלום (₪)</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">חודשי תשלום</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS_HE.map((m, idx) => {
                const monthNum = idx + 1;
                const active = form.months.includes(monthNum);
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => toggleMonth(monthNum)}
                    className={`text-[11px] rounded-md py-1.5 border font-medium ${
                      active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {m.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pt-2 flex gap-2">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 text-sm transition">שמירה</button>
            <button type="button" onClick={onClose} className="px-4 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
