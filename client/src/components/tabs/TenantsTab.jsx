import { useEffect, useMemo, useState } from 'react';
import { Plus, MessageCircle, Trash2, Pencil, X, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../../api';
import { formatILS, MONTHS_HE } from '../../format';

const STATUS_STYLE = {
  UNPAID: 'bg-red-100 text-red-700 border-red-200',
  PAID_BANK: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PAID_PAYBOX: 'bg-purple-100 text-purple-700 border-purple-200',
  PAID_CASH: 'bg-blue-100 text-blue-700 border-blue-200',
  PENDING_CASH_APPROVAL: 'bg-amber-100 text-amber-700 border-amber-200',
};
const STATUS_LABEL = {
  UNPAID: 'לא שולם',
  PAID_BANK: 'שולם בבנק',
  PAID_PAYBOX: 'שולם ב-PayBox',
  PAID_CASH: 'שולם במזומן',
  PENDING_CASH_APPROVAL: 'ממתין לאישור',
};

export default function TenantsTab({ buildingId, onBalanceChanged, readOnly }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [openCell, setOpenCell] = useState(null);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [expandedTenant, setExpandedTenant] = useState(null);

  const load = async () => {
    const res = await api.getDuesMatrix(buildingId, year);
    setData(res);
  };

  useEffect(() => { load(); }, [year, buildingId]);

  const doAction = async (fn, due) => {
    await fn(buildingId, due.id);
    setOpenCell(null);
    await load();
    onBalanceChanged?.();
  };

  const moveTenant = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= data.tenants.length) return;
    const reordered = [...data.tenants];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setData((d) => ({ ...d, tenants: reordered }));
    await api.reorderTenants(buildingId, reordered.map((t) => t.id));
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-slate-800">מטריצת גבייה חודשית</h2>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input !w-auto text-sm">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowAddTenant(true)}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-3 py-2 transition"
          >
            <Plus size={16} /> דייר חדש
          </button>
        )}
      </div>

      <Legend />

      {!data && <p className="text-sm text-slate-500">טוען...</p>}

      {/* Desktop matrix */}
      {data && (
        <div className="hidden md:block overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="sticky right-0 bg-slate-50 px-3 py-2 text-start font-semibold min-w-[160px]">דייר</th>
                {MONTHS_HE.map((m) => (
                  <th key={m} className="px-2 py-2 font-semibold whitespace-nowrap">{m}</th>
                ))}
                <th className="px-2 py-2 font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((tenant, index) => (
                <tr key={tenant.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="sticky right-0 bg-white px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {!readOnly && (
                        <div className="flex flex-col shrink-0">
                          <button
                            onClick={() => moveTenant(index, -1)}
                            disabled={index === 0}
                            className="p-0.5 text-slate-300 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-300"
                            title="הזזה למעלה"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            onClick={() => moveTenant(index, 1)}
                            disabled={index === data.tenants.length - 1}
                            className="p-0.5 text-slate-300 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-300"
                            title="הזזה למטה"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-800">{tenant.name}</p>
                        <p className="text-xs text-slate-500">קומה {tenant.floor} · דירה {tenant.apartmentNumber}</p>
                      </div>
                    </div>
                  </td>
                  {tenant.dues.map((due) => (
                    <td key={due.id} className="px-1.5 py-2 text-center relative">
                      <button
                        onClick={() => !readOnly && setOpenCell(openCell === due.id ? null : due.id)}
                        className={`w-full rounded-md border px-1.5 py-1 text-[11px] font-medium ${STATUS_STYLE[due.status]} ${readOnly ? 'cursor-default' : ''}`}
                      >
                        {STATUS_LABEL[due.status]}
                      </button>
                      {!readOnly && openCell === due.id && (
                        <DueMenu due={due} onClose={() => setOpenCell(null)} onAction={doAction} />
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <WhatsAppButton tenant={tenant} />
                      {!readOnly && (
                        <button onClick={() => setEditingTenant(tenant)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card list */}
      {data && (
        <div className="md:hidden space-y-2">
          {data.tenants.map((tenant, index) => {
            const isOpen = expandedTenant === tenant.id;
            const unpaidCount = tenant.dues.filter((d) => d.status === 'UNPAID').length;
            return (
              <div key={tenant.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedTenant(isOpen ? null : tenant.id)}
                  className="w-full flex items-center justify-between px-3 py-3"
                >
                  <div className="text-start">
                    <p className="font-semibold text-slate-800 text-sm">{tenant.name}</p>
                    <p className="text-xs text-slate-500">
                      קומה {tenant.floor} · דירה {tenant.apartmentNumber}
                      {unpaidCount > 0 && <span className="text-red-600 font-medium"> · {unpaidCount} חודשים בחוב</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <WhatsAppButton tenant={tenant} />
                    {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 grid grid-cols-3 gap-1.5">
                    {tenant.dues.map((due) => (
                      <div key={due.id} className="relative">
                        <button
                          onClick={() => !readOnly && setOpenCell(openCell === due.id ? null : due.id)}
                          className={`w-full rounded-md border px-1 py-1.5 text-[11px] font-medium ${STATUS_STYLE[due.status]} ${readOnly ? 'cursor-default' : ''}`}
                        >
                          {MONTHS_HE[due.month - 1].slice(0, 3)}
                        </button>
                        {!readOnly && openCell === due.id && (
                          <DueMenu due={due} onClose={() => setOpenCell(null)} onAction={doAction} />
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => setEditingTenant(tenant)}
                          className="col-span-3 mt-1 flex items-center justify-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-lg py-1.5"
                        >
                          <Pencil size={12} /> עריכת פרטי דייר
                        </button>
                        <div className="col-span-3 flex gap-1.5">
                          <button
                            onClick={() => moveTenant(index, -1)}
                            disabled={index === 0}
                            className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-lg py-1.5 disabled:opacity-30"
                          >
                            <ArrowUp size={12} /> הזזה למעלה
                          </button>
                          <button
                            onClick={() => moveTenant(index, 1)}
                            disabled={index === data.tenants.length - 1}
                            className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 border border-slate-200 rounded-lg py-1.5 disabled:opacity-30"
                          >
                            <ArrowDown size={12} /> הזזה למטה
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddTenant && (
        <TenantFormModal
          onClose={() => setShowAddTenant(false)}
          onSave={async (form) => { await api.createTenant(buildingId, form); setShowAddTenant(false); await load(); }}
        />
      )}
      {editingTenant && (
        <TenantFormModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onSave={async (form) => { await api.updateTenant(buildingId, editingTenant.id, form); setEditingTenant(null); await load(); }}
          onDelete={async () => { await api.deleteTenant(buildingId, editingTenant.id); setEditingTenant(null); await load(); }}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
      {Object.entries(STATUS_LABEL).map(([k, label]) => (
        <span key={k} className={`rounded-md border px-2 py-0.5 ${STATUS_STYLE[k]}`}>{label}</span>
      ))}
    </div>
  );
}

function DueMenu({ due, onClose, onAction }) {
  return (
    <div className="absolute z-20 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg text-start overflow-hidden left-1/2 -translate-x-1/2">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 bg-slate-50">
        <span className="text-[11px] font-medium text-slate-500">{formatILS(due.amountDue)}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={13} /></button>
      </div>
      <MenuItem onClick={() => onAction(api.markBank, due)}>סימון כשולם בבנק</MenuItem>
      <MenuItem onClick={() => onAction(api.markPaybox, due)}>סימון כשולם ב-PayBox</MenuItem>
      {due.status === 'PENDING_CASH_APPROVAL' ? (
        <MenuItem onClick={() => onAction(api.approveCash, due)}>אישור תשלום מזומן</MenuItem>
      ) : (
        <MenuItem onClick={() => onAction(api.approveCash, due)}>סימון כשולם במזומן</MenuItem>
      )}
      <MenuItem onClick={() => onAction(api.markUnpaid, due)} danger>סימון כלא שולם</MenuItem>
    </div>
  );
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-right px-3 py-2 text-xs hover:bg-slate-50 ${danger ? 'text-red-600' : 'text-slate-700'}`}
    >
      {children}
    </button>
  );
}

function WhatsAppButton({ tenant }) {
  const unpaid = tenant.dues.filter((d) => d.status === 'UNPAID');
  const message = useMemo(() => {
    if (unpaid.length === 0) return `שלום ${tenant.name}, תודה על תשלום דמי הוועד בזמן! 🙏`;
    const monthsList = unpaid.map((d) => `${MONTHS_HE[d.month - 1]}`).join(', ');
    const total = unpaid.reduce((s, d) => s + Number(d.amountDue), 0);
    return `שלום ${tenant.name}, זוהי תזכורת ידידותית לתשלום דמי הוועד עבור: ${monthsList} (סה"כ ${formatILS(total)}). תודה מראש! 🏠`;
  }, [tenant, unpaid]);

  const phoneDigits = (tenant.phone || '').replace(/\D/g, '');
  const intlPhone = phoneDigits.startsWith('0') ? '972' + phoneDigits.slice(1) : phoneDigits;
  const href = `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
      title="שליחת תזכורת בוואטסאפ"
    >
      <MessageCircle size={16} />
    </a>
  );
}

function TenantFormModal({ tenant, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(
    tenant
      ? { ...tenant, monthlyFee: tenant.monthlyFee ?? '' }
      : { floor: 0, apartmentNumber: '', name: '', phone: '', role: 'OWNER', monthlyFee: '' }
  );
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">{tenant ? 'עריכת דייר' : 'דייר חדש'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onSave(form); }}
          className="overflow-y-auto px-5 py-4 space-y-3 flex-1"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">קומה</label>
              <input type="number" value={form.floor} onChange={(e) => set('floor', e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">מספר דירה</label>
              <input value={form.apartmentNumber} onChange={(e) => set('apartmentNumber', e.target.value)} className="input" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">שם הדייר</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">טלפון (לוואטסאפ)</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" placeholder="050-1234567" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">סטטוס</label>
              <select value={form.role} onChange={(e) => set('role', e.target.value)} className="input">
                <option value="OWNER">בעל דירה</option>
                <option value="RENTER">שוכר</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">דמי ועד חריגים (אופציונלי)</label>
              <input type="number" value={form.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} className="input" placeholder="ברירת מחדל" />
            </div>
          </div>
          <div className="pt-2 flex gap-2">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 text-sm transition">שמירה</button>
            {onDelete && (
              <button type="button" onClick={onDelete} className="px-3 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
