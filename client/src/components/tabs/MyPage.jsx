import { useEffect, useState } from 'react';
import { UserRound, Save, HandCoins, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../api';
import { MONTHS_HE, formatILS } from '../../format';

const DUE_STYLE = {
  UNPAID: { label: 'לא שולם', cls: 'bg-rose-50 text-rose-700 ring-rose-100' },
  PENDING_CASH_APPROVAL: { label: 'ממתין לאישור נציג ועד', cls: 'bg-amber-50 text-amber-700 ring-amber-100' },
  PAID_BANK: { label: 'שולם', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  PAID_PAYBOX: { label: 'שולם', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  PAID_CASH: { label: 'שולם', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
};

// A resident sees only their own apartment: personal details (editable) and their own months.
// They can't record anything - they can only *request* (e.g. "I paid cash"), which a committee
// rep then approves.
export default function MyPage({ buildingId }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api.getMe(buildingId, new Date().getFullYear());
    setData(res);
    if (res.tenant) setForm({ name: res.tenant.name || '', phone: res.tenant.phone || '' });
  };
  useEffect(() => { load(); }, [buildingId]);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.updateMe(buildingId, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const reportCash = async (dueId) => {
    setError('');
    try {
      await api.reportMyCash(buildingId, dueId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return <p className="p-6 text-sm text-slate-500">טוען...</p>;

  if (!data.tenant) {
    return (
      <div className="mx-auto max-w-xl p-4 lg:p-6">
        <div className="card flex items-start gap-3 p-5">
          <AlertCircle className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-bold text-slate-800">החשבון שלך עדיין לא משויך לדירה</p>
            <p className="mt-1 text-sm text-slate-500">נציג הוועד צריך לשייך אותך לדירה כדי שתוכל/י לראות כאן את הפרטים והתשלומים שלך.</p>
          </div>
        </div>
      </div>
    );
  }

  const t = data.tenant;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24 lg:p-6">
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><UserRound size={22} /></div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">הפרטים שלי</h2>
            <p className="text-xs text-slate-500">דירה {t.apartmentNumber} · קומה {t.floor}</p>
          </div>
        </div>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">שם</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">טלפון</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input" placeholder="050-1234567" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">
              {saved ? <CheckCircle2 size={16} /> : <Save size={16} />} {saved ? 'נשמר' : 'שמירת פרטים'}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 text-lg font-extrabold text-slate-800">דמי הוועד שלי {data.year}</h2>
        <p className="mb-4 text-xs text-slate-500">שילמת במזומן? סמנו כאן - נציג הוועד יאשר והתשלום יתעדכן.</p>
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {data.dues.map((d) => {
            const st = DUE_STYLE[d.status] || DUE_STYLE.UNPAID;
            return (
              <div key={d.id} className={`rounded-xl p-3 ring-1 ${st.cls}`}>
                <p className="text-sm font-bold">{MONTHS_HE[d.month - 1]}</p>
                <p className="text-xs opacity-80">{formatILS(d.amountDue)}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold">
                  {d.status === 'PENDING_CASH_APPROVAL' && <Clock size={11} />}
                  {st.label}
                </p>
                {d.status === 'UNPAID' && (
                  <button onClick={() => reportCash(d.id)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm">
                    <HandCoins size={12} /> שילמתי במזומן
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
