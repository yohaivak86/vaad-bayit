import { useEffect, useState, useCallback } from 'react';
import { Trash2, Printer, Paperclip, Upload, Pencil, Plus, FileSpreadsheet, ClipboardPlus, Wallet, Link2, Network, Repeat, Banknote, ListPlus } from 'lucide-react';
import { api } from '../../api';
import { EXPENSE_CATEGORIES, PAID_FROM_OPTIONS } from '../../constants';
import { formatILS, formatDateHe } from '../../format';
import { createExpenseFromForm, updateExpenseFromForm } from '../../lib/expenseSave';
import AddExpenseModal from '../AddExpenseModal';
import RecurringItemSheet, { describeSchedule, nextOccurrence, FREQUENCY_LABELS } from '../RecurringItemSheet';
import ExcelImportSheet from '../ExcelImportSheet';
import Sheet from '../Sheet';

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Two views of the money, one primary action:
//   "תנועות"          - what was actually paid (edit / delete / receipt, any time)
//   "הוצאות צפויות"   - what is planned: monthly, annual and one-time items, loaded by hand or from Excel
export default function ExpensesTab({ buildingId, building, onBalanceChanged, initial }) {
  const [view, setView] = useState(initial?.view || 'movements'); // movements | expected
  const [expenseSheet, setExpenseSheet] = useState(null); // { expense?, prefill? } | null
  const [loadVersion, setLoadVersion] = useState(0);

  const changed = useCallback(async () => {
    setLoadVersion((v) => v + 1);
    await onBalanceChanged?.();
  }, [onBalanceChanged]);

  const save = async (form, file) => {
    if (expenseSheet?.expense) await updateExpenseFromForm(buildingId, expenseSheet.expense.id, form, file);
    else await createExpenseFromForm(buildingId, form, file);
    setExpenseSheet(null);
    await changed();
  };

  return (
    <div className="page stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row no-print" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <button className="btn btn--primary" onClick={() => setExpenseSheet({})}><Plus size={20} /> הוצאה חדשה</button>
      </div>

      <div className="segmented no-print" style={{ alignSelf: 'flex-start' }}>
        <button aria-pressed={view === 'movements'} onClick={() => setView('movements')}>תנועות</button>
        <button aria-pressed={view === 'expected'} onClick={() => setView('expected')}>הוצאות צפויות</button>
      </div>

      {view === 'movements' ? (
        <Movements
          key={`m-${loadVersion}`}
          buildingId={buildingId}
          building={building}
          initialPaidFrom={initial?.paidFrom}
          onEdit={(expense) => setExpenseSheet({ expense })}
          onChanged={changed}
        />
      ) : (
        <Expected
          key={`e-${loadVersion}`}
          buildingId={buildingId}
          onPay={(item) => setExpenseSheet({ prefill: item })}
          onChanged={changed}
        />
      )}

      {expenseSheet && (
        <AddExpenseModal
          expense={expenseSheet.expense}
          prefill={expenseSheet.prefill}
          onClose={() => setExpenseSheet(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------ movements
function Movements({ buildingId, building, onEdit, onChanged, initialPaidFrom }) {
  const [filters, setFilters] = useState({ from: initialPaidFrom ? `${new Date().getFullYear()}-01-01` : firstOfMonth(), to: today(), category: '', paidFrom: initialPaidFrom || '' });
  const [expenses, setExpenses] = useState(null);
  const [summary, setSummary] = useState(null);
  const [receiptExpense, setReceiptExpense] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const [exp, sum] = await Promise.all([api.getExpenses(buildingId, params), api.getExpensesSummary(buildingId, params)]);
    setExpenses(exp);
    setSummary(sum);
  }, [buildingId, filters]);

  useEffect(() => { load(); }, [load]);

  const remove = async (expense) => {
    await api.deleteExpense(buildingId, expense.id);
    setConfirmDelete(null);
    await onChanged();
  };

  const maxCategory = summary ? Math.max(1, ...Object.values(summary.byCategory)) : 1;

  return (
    <>
      <div className="card card--tight no-print">
        <div className="field-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="field"><label>מתאריך</label><input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="input" /></div>
          <div className="field"><label>עד תאריך</label><input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="input" /></div>
          <div className="field">
            <label>קטגוריה</label>
            <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} className="input">
              <option value="">הכל</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="תחזוקה ותיקונים">תחזוקה ותיקונים</option>
            </select>
          </div>
          <div className="field">
            <label>מקור תשלום</label>
            <select value={filters.paidFrom} onChange={(e) => setFilters((f) => ({ ...f, paidFrom: e.target.value }))} className="input">
              <option value="">הכל</option>
              {PAID_FROM_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="print-area stack" style={{ gap: 'var(--space-3)' }}>
        <div className="hidden print:block">
          <h1 style={{ fontSize: 20 }}>{building?.name}</h1>
          <p>דו"ח הוצאות: {filters.from} עד {filters.to}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="tile tile--rose"><span className="stat-label">סה"כ בתקופה</span><span className="stat-value stat-value--md">{formatILS(summary?.total)}</span></div>
          <div className="tile tile--amber"><span className="stat-label">מזומן</span><span className="stat-value stat-value--md">{formatILS(summary?.byPaidFrom?.CASH)}</span></div>
          <div className="tile tile--blue"><span className="stat-label">בנק</span><span className="stat-value stat-value--md">{formatILS(summary?.byPaidFrom?.BANK)}</span></div>
          <div className="tile tile--purple"><span className="stat-label">PayBox</span><span className="stat-value stat-value--md">{formatILS(summary?.byPaidFrom?.PAYBOX)}</span></div>
        </div>

        {summary && Object.keys(summary.byCategory).length > 0 && (
          <div className="card card--tight stack" style={{ gap: 'var(--space-2)' }}>
            {Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="row">
                <span className="text-footnote truncate" style={{ width: 110, flexShrink: 0 }}>{cat}</span>
                <div style={{ flex: 1, background: 'var(--fill-quiet)', borderRadius: 'var(--radius-pill)', height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${(amt / maxCategory) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-pill)' }} />
                </div>
                <span className="text-footnote" style={{ width: 72, textAlign: 'end' }}>{formatILS(amt)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>תאריך</th><th>פירוט</th><th className="hidden sm:table-cell">מקור</th><th>סכום</th><th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {expenses?.map((e) => {
                const hasReceipt = e.receiptFileName || e.receiptUrl;
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDateHe(e.date)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.description || e.category}</div>
                      <div className="text-footnote text-secondary row" style={{ flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                        <span>{e.category}</span>
                        {e.supplierName && <span>· {e.supplierName}</span>}
                        {e.taskId && <span className="chip"><Link2 size={12} /> ממשימה</span>}
                        {e.recurringItemId && <span className="chip"><Repeat size={12} /> צפויה</span>}
                        {e.complexExpenseId && <span className="chip"><Network size={12} /> מתחם</span>}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell">{PAID_FROM_OPTIONS.find((o) => o.value === e.paidFrom)?.label || e.paidFrom}</td>
                    <td style={{ fontWeight: 600 }}>{formatILS(e.amount)}</td>
                    <td className="no-print whitespace-nowrap">
                      <button className="icon-btn" style={{ width: 36, height: 36, color: hasReceipt ? 'var(--accent)' : undefined }} onClick={() => setReceiptExpense(e)} title={hasReceipt ? 'צפייה בקבלה' : 'צירוף קבלה'} aria-label="קבלה"><Paperclip size={18} /></button>
                      <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => onEdit(e)} title="עריכה" aria-label="עריכה"><Pencil size={18} /></button>
                      <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setConfirmDelete(e)} title="מחיקה" aria-label="מחיקה"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                );
              })}
              {expenses?.length === 0 && <tr><td colSpan={5} className="empty">אין הוצאות בטווח שנבחר</td></tr>}
            </tbody>
          </table>
        </div>
        <button onClick={() => window.print()} className="btn btn--secondary no-print" style={{ alignSelf: 'flex-start' }}><Printer size={20} /> ייצוא דו"ח להדפסה</button>
      </div>

      {receiptExpense && <ReceiptModal buildingId={buildingId} expense={receiptExpense} onClose={() => setReceiptExpense(null)} onChanged={load} />}
      {confirmDelete && (
        <Sheet title="מחיקת הוצאה" onClose={() => setConfirmDelete(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>למחוק את "{confirmDelete.description || confirmDelete.category}" ({formatILS(confirmDelete.amount)})? היתרה בקופה תתעדכן.</p>
            {confirmDelete.taskId && <div className="alert alert--warning">ההוצאה נרשמה ממשימה - עלות המשימה תתאפס.</div>}
            <button className="btn btn--danger" onClick={() => remove(confirmDelete)}>מחיקה</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------ expected items
function Expected({ buildingId, onPay, onChanged }) {
  const [items, setItems] = useState(null);
  const [sheet, setSheet] = useState(null); // { item? } | null
  const [showExcel, setShowExcel] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => api.getRecurring(buildingId).then(setItems), [buildingId]);
  useEffect(() => { load(); }, [load]);

  const save = async (data) => {
    if (sheet?.item) await api.updateRecurring(buildingId, sheet.item.id, data);
    else await api.createRecurring(buildingId, data);
    setSheet(null);
    await load();
  };

  const openTask = async (item) => {
    await api.createTask(buildingId, { title: item.title, recurringItemId: item.id, dueDate: nextOccurrence(item) });
    setNotice(`נפתחה משימה "${item.title}" - אפשר לראות אותה במסך המשימות.`);
    await load();
  };

  const groups = [
    ['MONTHLY', 'חודשיות'],
    ['ANNUAL', 'שנתיות'],
    ['ONE_TIME', 'חד־פעמיות'],
  ];
  const monthlyTotal = (items || []).filter((i) => i.active && i.frequency === 'MONTHLY').reduce((s, i) => s + (i.expectedAmount || 0), 0);
  const annualTotal = (items || []).filter((i) => i.active && i.frequency === 'ANNUAL').reduce((s, i) => s + (i.expectedAmount || 0), 0);

  return (
    <>
      <div className="row no-print" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn--secondary" onClick={() => setSheet({})}><ClipboardPlus size={20} /> הוצאה צפויה חדשה</button>
        <button className="btn btn--secondary" onClick={() => setShowExcel(true)}><FileSpreadsheet size={20} /> טעינה מ-Excel</button>
      </div>

      {notice && <div className="alert alert--success" role="status">{notice}</div>}

      {items && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="tile tile--blue"><span className="stat-label">חודשיות - סה"כ לחודש</span><span className="stat-value stat-value--md">{formatILS(monthlyTotal)}</span></div>
          <div className="tile tile--purple"><span className="stat-label">שנתיות - סה"כ לשנה</span><span className="stat-value stat-value--md">{formatILS(annualTotal)}</span></div>
        </div>
      )}

      {items && items.length === 0 && (
        <div className="card empty stack" style={{ alignItems: 'center' }}>
          <Wallet size={32} color="var(--label-secondary)" />
          <p style={{ margin: 0 }}>עוד לא הגדרתם הוצאות צפויות. הוסיפו ידנית או טענו קובץ Excel - הן יופיעו בלוח הבקרה כשהחודש מתקרב.</p>
        </div>
      )}

      {groups.map(([freq, title]) => {
        const rows = (items || []).filter((i) => i.frequency === freq);
        if (rows.length === 0) return null;
        return (
          <section key={freq} className="stack" style={{ gap: 'var(--space-2)' }}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            <ul className="list">
              {rows.map((item) => (
                <li key={item.id} className="row-1" style={{ opacity: item.active ? 1 : 0.5 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 className="ellipsis" style={{ margin: 0 }}>{item.title}</h3>
                    <p className="text-footnote text-secondary ellipsis" style={{ margin: 0 }}>
                      {item.category} · {describeSchedule(item)}
                      <span className="hide-mobile">{item.tasksCount > 0 ? ` · ${item.tasksCount} משימות` : ''}{item.expensesCount > 0 ? ` · ${item.expensesCount} תשלומים` : ''}</span>
                    </p>
                  </div>
                  {item.expectedAmount != null && <b className="nowrap shrink-0">{formatILS(item.expectedAmount)}</b>}
                  <div className="row no-print shrink-0" style={{ gap: 'var(--space-1)' }}>
                    <button className="btn btn--primary btn--small btn-icon-mobile" onClick={() => onPay(item)} aria-label="רישום תשלום" title="רישום תשלום"><Banknote size={16} /> <span className="hide-mobile">רישום תשלום</span></button>
                    <button className="btn btn--secondary btn--small btn-icon-mobile" onClick={() => openTask(item)} aria-label="פתיחת משימה" title="פתיחת משימה"><ListPlus size={16} /> <span className="hide-mobile">פתיחת משימה</span></button>
                    <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setSheet({ item })} aria-label="עריכה"><Pencil size={18} /></button>
                    <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setConfirmDelete(item)} aria-label="מחיקה"><Trash2 size={18} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {sheet && <RecurringItemSheet item={sheet.item} onClose={() => setSheet(null)} onSave={save} />}
      {showExcel && (
        <ExcelImportSheet
          buildingId={buildingId}
          onClose={() => setShowExcel(false)}
          onImported={async (count) => { setShowExcel(false); setNotice(`נטענו ${count} פריטים.`); await load(); }}
        />
      )}
      {confirmDelete && (
        <Sheet title="מחיקת פריט צפוי" onClose={() => setConfirmDelete(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>למחוק את "{confirmDelete.title}" ({FREQUENCY_LABELS[confirmDelete.frequency]})? משימות ותשלומים שכבר נרשמו ממנו יישארו.</p>
            <button className="btn btn--danger" onClick={async () => { await api.deleteRecurring(buildingId, confirmDelete.id); setConfirmDelete(null); await load(); await onChanged(); }}>מחיקה</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------ receipt
function ReceiptModal({ buildingId, expense, onClose, onChanged }) {
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
    <Sheet title={`קבלה - ${expense.category}`} onClose={onClose}>
      <div className="stack">
        {receiptUrl ? (
          <div className="card card--flush">
            {hasFile && isImage ? (
              <img src={receiptUrl} alt="קבלה" style={{ width: '100%', maxHeight: 280, objectFit: 'contain' }} />
            ) : (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="row" style={{ padding: 'var(--space-4)' }}><Paperclip size={20} /> פתיחת הקבלה</a>
            )}
          </div>
        ) : (
          <p className="empty">אין קבלה מצורפת</p>
        )}
        <label className="btn btn--secondary" style={{ cursor: 'pointer' }}>
          <Upload size={20} /> {uploading ? 'מעלה...' : receiptUrl ? 'החלפת הקבלה' : 'העלאת קבלה'}
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {hasFile && <button onClick={remove} className="btn btn--danger btn--small" style={{ alignSelf: 'center' }}>הסרת הקבלה</button>}
      </div>
    </Sheet>
  );
}
