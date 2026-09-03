import { useEffect, useState } from 'react';
import { X, CheckCircle2, Inbox } from 'lucide-react';
import { api } from '../api';
import { formatILS, MONTHS_HE } from '../format';

export default function ApprovePaymentModal({ buildingId, onClose, onApproved }) {
  const [pending, setPending] = useState(null);

  const load = async () => {
    const year = new Date().getFullYear();
    const data = await api.getDuesMatrix(buildingId, year);
    const rows = [];
    for (const tenant of data.tenants) {
      for (const due of tenant.dues) {
        if (due.status === 'PENDING_CASH_APPROVAL') {
          rows.push({ ...due, tenantName: tenant.name, apartmentNumber: tenant.apartmentNumber });
        }
      }
    }
    setPending(rows);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id) => {
    await api.approveCash(buildingId, id);
    await load();
    onApproved?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">אישור תשלומי מזומן ממתינים</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-2">
          {pending === null && <p className="text-sm text-slate-500">טוען...</p>}
          {pending?.length === 0 && (
            <div className="flex flex-col items-center justify-center text-slate-400 py-10 gap-2">
              <Inbox size={32} />
              <p className="text-sm">אין תשלומים ממתינים לאישור</p>
            </div>
          )}
          {pending?.map((p) => (
            <div key={p.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2.5">
              <div>
                <p className="font-semibold text-sm text-slate-800">{p.tenantName} · דירה {p.apartmentNumber}</p>
                <p className="text-xs text-slate-500">{MONTHS_HE[p.month - 1]} {p.year} · {formatILS(p.amountDue)}</p>
              </div>
              <button
                onClick={() => approve(p.id)}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg px-3 py-2 transition"
              >
                <CheckCircle2 size={14} />
                אישור
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
