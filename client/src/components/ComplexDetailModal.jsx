import { useEffect, useState } from 'react';
import { X, Copy, RefreshCw, Check, Trash2, Plus, Scale } from 'lucide-react';
import { api } from '../api';
import { formatILS, formatDateHe } from '../format';
import { EXPENSE_CATEGORIES, PAID_FROM_OPTIONS } from '../constants';

export default function ComplexDetailModal({ complexId, onClose, onChanged }) {
  const [complex, setComplex] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [shares, setShares] = useState({});
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const load = async () => {
    const c = await api.getComplex(complexId);
    setComplex(c);
    const initialShares = {};
    c.members.forEach((m) => { initialShares[m.buildingId] = m.sharePercent ?? ''; });
    setShares(initialShares);
    setExpenses(await api.getComplexExpenses(complexId));
  };

  useEffect(() => { load(); }, [complexId]);

  const isOwner = complex && complex.inviteCode !== undefined;
  const equalPercent = complex && complex.members.length ? round1(100 / complex.members.length) : 0;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(complex.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const regenerateCode = async () => {
    const res = await api.regenerateComplexCode(complexId);
    setComplex((c) => ({ ...c, inviteCode: res.inviteCode }));
  };

  const removeMember = async (buildingId) => {
    await api.removeComplexMember(complexId, buildingId);
    await load();
    onChanged?.();
  };

  const saveShares = async () => {
    setError('');
    try {
      const payload = complex.members.map((m) => ({ buildingId: m.buildingId, sharePercent: Number(shares[m.buildingId]) }));
      await api.updateComplexShares(complexId, payload);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetShares = async () => {
    await api.updateComplexShares(complexId, []);
    await load();
  };

  const deleteExpense = async (id) => {
    await api.deleteComplexExpense(complexId, id);
    await load();
    onChanged?.();
  };

  if (!complex) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
        <p className="text-white text-sm">טוען...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-lg text-slate-800">{complex.name}</h2>
            <p className="text-xs text-slate-500">בעלים: {complex.ownerName}{!isOwner && ' · תצוגה בלבד'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-4">
          {isOwner && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3">
              <p className="text-xs font-semibold text-blue-800 mb-2">קוד הזמנה למתחם</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 font-mono tracking-widest text-center bg-white border border-blue-200 rounded-lg py-1.5 text-sm text-blue-900">
                  {complex.inviteCode}
                </span>
                <button onClick={copyCode} className="p-2 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button onClick={regenerateCode} className="p-2 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100">
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5"><Scale size={13} /> בניינים וחלוקת עלויות</p>
            <div className="space-y-1.5">
              {complex.members.map((m) => (
                <div key={m.buildingId} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{m.buildingName}</p>
                    <p className="text-[11px] text-slate-400">{m.apartmentsCount} דירות</p>
                  </div>
                  {isOwner ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={shares[m.buildingId]}
                          onChange={(e) => setShares((s) => ({ ...s, [m.buildingId]: e.target.value }))}
                          placeholder={String(equalPercent)}
                          className="w-16 border border-slate-300 rounded-md px-2 py-1 text-sm text-center"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                      <button onClick={() => removeMember(m.buildingId)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-600">{m.sharePercent ?? round1(equalPercent)}%</span>
                  )}
                </div>
              ))}
              {complex.members.length === 0 && <p className="text-xs text-slate-400 text-center py-3">אין עדיין בניינים חברים</p>}
            </div>
            {isOwner && complex.members.length > 0 && (
              <div className="flex gap-2 mt-2">
                <button onClick={saveShares} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg py-2 transition">
                  שמירת חלוקה
                </button>
                <button onClick={resetShares} className="flex-1 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg py-2 hover:bg-slate-50 transition">
                  איפוס לחלוקה שווה
                </button>
              </div>
            )}
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{error}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500">הוצאות משותפות</p>
              {isOwner && (
                <button onClick={() => setShowExpenseForm(true)} className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                  <Plus size={13} /> הוצאה חדשה
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {expenses?.map((e) => (
                <div key={e.id} className="border border-slate-200 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{e.category}{e.description ? ` · ${e.description}` : ''}</p>
                      <p className="text-[11px] text-slate-400">{formatDateHe(e.date)} · {formatILS(e.amount)}</p>
                    </div>
                    {isOwner && (
                      <button onClick={() => deleteExpense(e.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {e.split.map((s) => (
                      <span key={s.buildingId} className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-500">
                        {s.buildingName}: {formatILS(s.amount)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {expenses?.length === 0 && <p className="text-xs text-slate-400 text-center py-3">אין עדיין הוצאות משותפות</p>}
            </div>
          </div>
        </div>
      </div>

      {showExpenseForm && (
        <ComplexExpenseFormModal
          onClose={() => setShowExpenseForm(false)}
          onSave={async (form) => {
            await api.createComplexExpense(complexId, form);
            setShowExpenseForm(false);
            await load();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function ComplexExpenseFormModal({ onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, category: EXPENSE_CATEGORIES[0], description: '', amount: '', paidFrom: 'BANK' });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      await onSave({ ...form, amount: Number(form.amount) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">הוצאה משותפת חדשה</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תאריך</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">קטגוריה</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תיאור</label>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} className="input" placeholder="לדוגמה: גינון רבעוני" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">סכום כולל (₪)</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">שולם מתוך</label>
            <div className="flex gap-2">
              {PAID_FROM_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => set('paidFrom', opt.value)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                    form.paidFrom === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">הסכום יתחלק אוטומטית בין הבניינים החברים לפי החלוקה שהוגדרה, וינוכה מיתרת כל בניין.</p>
          <div className="pt-2 flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition">
              {saving ? 'שומר...' : 'שמירה'}
            </button>
            <button type="button" onClick={onClose} className="px-4 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
