import { useEffect, useState } from 'react';
import { Trash2, Printer, Filter, Paperclip, X, Upload } from 'lucide-react';
import { api } from '../../api';
import { EXPENSE_CATEGORIES, PAID_FROM_OPTIONS } from '../../constants';
import { formatILS, formatDateHe } from '../../format';

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpensesTab({ buildingId, building, readOnly }) {
  const [filters, setFilters] = useState({ from: firstOfMonth(), to: today(), category: '', paidFrom: '' });
  const [expenses, setExpenses] = useState(null);
  const [summary, setSummary] = useState(null);
  const [receiptExpense, setReceiptExpense] = useState(null);

  const load = async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const [exp, sum] = await Promise.all([api.getExpenses(buildingId, params), api.getExpensesSummary(buildingId, params)]);
    setExpenses(exp);
    setSummary(sum);
  };

  useEffect(() => { load(); }, [filters, buildingId]);

  const remove = async (id) => {
    await api.deleteExpense(buildingId, id);
    await load();
  };

  const maxCategory = summary ? Math.max(1, ...Object.values(summary.byCategory)) : 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 no-print">
        <h2 className="font-bold text-slate-800">הוצאות ותנועות</h2>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg px-3 py-2 hover:bg-slate-50 transition"
        >
          <Printer size={16} /> ייצוא דו"ח חודשי
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 no-print">
        <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-2"><Filter size={13} /> סינון</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">מתאריך</label>
            <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">עד תאריך</label>
            <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">קטגוריה</label>
            <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="input">
              <option value="">הכל</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">מקור תשלום</label>
            <select value={filters.paidFrom} onChange={(e) => setFilters((f) => ({ ...f, paidFrom: e.target.value }))} className="input">
              <option value="">הכל</option>
              {PAID_FROM_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="print-area bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="hidden print:block mb-3">
          <h1 className="font-extrabold text-lg">{building?.name}</h1>
          <p className="text-sm text-slate-500">דו"ח הוצאות: {filters.from} עד {filters.to}</p>
        </div>
        <p className="text-xs font-semibold text-slate-500 mb-2">סיכום לתקופה שנבחרה</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <SummaryBox label='סה"כ הוצאות' value={formatILS(summary?.total)} />
          <SummaryBox label="מזומן" value={formatILS(summary?.byPaidFrom?.CASH)} />
          <SummaryBox label="בנק" value={formatILS(summary?.byPaidFrom?.BANK)} />
          <SummaryBox label="PayBox" value={formatILS(summary?.byPaidFrom?.PAYBOX)} />
        </div>
        {summary && Object.keys(summary.byCategory).length > 0 && (
          <div className="space-y-1.5 mb-1">
            {Object.entries(summary.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs w-24 shrink-0 text-slate-600 truncate">{cat}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-3.5 overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(amt / maxCategory) * 100}%` }} />
                  </div>
                  <span className="text-xs w-16 text-left text-slate-700 font-medium">{formatILS(amt)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="print-area bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs">
              <th className="px-3 py-2 text-start font-semibold">תאריך</th>
              <th className="px-3 py-2 text-start font-semibold">קטגוריה</th>
              <th className="px-3 py-2 text-start font-semibold hidden sm:table-cell">ספק</th>
              <th className="px-3 py-2 text-start font-semibold">מקור</th>
              <th className="px-3 py-2 text-start font-semibold">סכום</th>
              <th className="px-3 py-2 no-print"></th>
              {!readOnly && <th className="px-3 py-2 no-print"></th>}
            </tr>
          </thead>
          <tbody>
            {expenses?.map((e) => {
              const hasReceipt = e.receiptFileName || e.receiptUrl;
              return (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateHe(e.date)}</td>
                  <td className="px-3 py-2">{e.category}</td>
                  <td className="px-3 py-2 hidden sm:table-cell text-slate-500">{e.supplierName || '—'}</td>
                  <td className="px-3 py-2">{PAID_FROM_OPTIONS.find((o) => o.value === e.paidFrom)?.label || e.paidFrom}</td>
                  <td className="px-3 py-2 font-medium">{formatILS(e.amount)}</td>
                  <td className="px-3 py-2 no-print">
                    <button
                      onClick={() => setReceiptExpense(e)}
                      className={`flex items-center gap-1 text-xs ${hasReceipt ? 'text-blue-600' : 'text-slate-300'} hover:text-blue-700`}
                      title={hasReceipt ? 'צפייה בקבלה' : readOnly ? 'אין קבלה' : 'צירוף קבלה'}
                    >
                      <Paperclip size={14} />
                    </button>
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 no-print">
                      <button onClick={() => remove(e.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              );
            })}
            {expenses?.length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-8 text-sm">אין הוצאות בטווח שנבחר</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {receiptExpense && (
        <ReceiptModal
          buildingId={buildingId}
          expense={receiptExpense}
          readOnly={readOnly}
          onClose={() => setReceiptExpense(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function ReceiptModal({ buildingId, expense, readOnly, onClose, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const hasFile = Boolean(expense.receiptFileName);
  const receiptUrl = hasFile ? api.getReceiptUrl(buildingId, expense.id) : expense.receiptUrl;
  const isImage = expense.receiptMimeType?.startsWith('image/');

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadReceipt(buildingId, expense.id, file);
      await onChanged();
      onClose();
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    await api.deleteReceipt(buildingId, expense.id);
    await onChanged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">קבלה - {expense.category}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {receiptUrl ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {hasFile && isImage ? (
                <img src={receiptUrl} alt="קבלה" className="w-full max-h-64 object-contain bg-slate-50" />
              ) : (
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-3 text-sm text-blue-600 hover:bg-slate-50">
                  <Paperclip size={16} /> פתיחת הקבלה
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">אין קבלה מצורפת</p>
          )}

          {!readOnly && (
            <>
              <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
                <Upload size={16} />
                {uploading ? 'מעלה...' : receiptUrl ? 'החלפת הקבלה' : 'העלאת קבלה'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </label>
              {hasFile && (
                <button onClick={remove} className="w-full text-xs text-red-600 hover:underline">הסרת הקבלה</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg px-2.5 py-2 text-center">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="font-bold text-slate-800 text-sm">{value}</p>
    </div>
  );
}
