import { useEffect, useState } from 'react';
import { X, CheckCircle2, Landmark, PartyPopper } from 'lucide-react';
import { api } from '../api';
import { formatILS, MONTHS_HE } from '../format';

// Quick-action for the admin to register this month's tenant payments directly -
// there is currently no tenant-facing portal, so admins record payments themselves
// (bank transfers/PayBox show up automatically once reconciled; this is mainly for cash).
export default function ApprovePaymentModal({ buildingId, onClose, onApproved }) {
  const [rows, setRows] = useState(null);

  const load = async () => {
    const now = new Date();
    const data = await api.getDuesMatrix(buildingId, now.getFullYear());
    const currentMonth = now.getMonth() + 1;
    const outstanding = [];
    for (const tenant of data.tenants) {
      const due = tenant.dues.find((d) => d.month === currentMonth);
      if (due && due.status !== 'PAID_BANK' && due.status !== 'PAID_CASH') {
        outstanding.push({ ...due, tenantName: tenant.name, apartmentNumber: tenant.apartmentNumber });
      }
    }
    setRows({ list: outstanding, month: currentMonth, year: now.getFullYear() });
  };

  useEffect(() => { load(); }, [buildingId]);

  const act = async (fn, id) => {
    await fn(buildingId, id);
    await load();
    onApproved?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-lg text-slate-800">רישום תשלום דייר</h2>
            {rows && <p className="text-xs text-slate-500">חובות פתוחים לחודש {MONTHS_HE[rows.month - 1]} {rows.year}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-2">
          {rows === null && <p className="text-sm text-slate-500">טוען...</p>}
          {rows?.list.length === 0 && (
            <div className="flex flex-col items-center justify-center text-slate-400 py-10 gap-2">
              <PartyPopper size={32} />
              <p className="text-sm">כל הדיירים שילמו את החודש הנוכחי</p>
            </div>
          )}
          {rows?.list.map((d) => (
            <div key={d.id} className="border border-slate-200 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{d.tenantName} · דירה {d.apartmentNumber}</p>
                  <p className="text-xs text-slate-500">
                    {formatILS(d.amountDue)}
                    {d.status === 'PENDING_CASH_APPROVAL' && <span className="text-amber-600"> · דווח כמזומן ע"י הדייר</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => act(api.approveCash, d.id)}
                  className="flex-1 flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg px-2 py-1.5 transition"
                >
                  <CheckCircle2 size={13} /> שולם במזומן
                </button>
                <button
                  onClick={() => act(api.markBank, d.id)}
                  className="flex-1 flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg px-2 py-1.5 transition"
                >
                  <Landmark size={13} /> שולם בבנק
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 px-5 py-2 border-t border-slate-100">
          לרישום תשלום עבור חודש אחר - עברו לטאב "דיירים וגבייה" ובחרו את החודש הרלוונטי.
        </p>
      </div>
    </div>
  );
}
