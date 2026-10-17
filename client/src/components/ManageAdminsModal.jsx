import { useEffect, useState } from 'react';
import { X, Trash2, UserPlus, Copy, RefreshCw, Check, UserCheck, Clock } from 'lucide-react';
import { api } from '../api';
import { ROLE_LABELS } from '../constants';

const ROLE_OPTIONS = [
  { v: 'RESIDENT', label: ROLE_LABELS.RESIDENT },
  { v: 'COMMITTEE', label: ROLE_LABELS.COMMITTEE },
];

// Members of the building. Anyone who joins starts as a resident; a committee rep (or the site
// admin) can grant "נציג ועד". Making someone a *site* admin isn't possible from here - that
// exists only in the site admin's control center.
export default function ManageAdminsModal({ buildingId, currentUserId, building, onClose }) {
  const [members, setMembers] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'RESIDENT', tenantId: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState(building?.inviteCode || '');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setMembers(await api.getBuildingAdmins(buildingId));
    setTenants(await api.getTenants(buildingId));
  };
  useEffect(() => { load(); }, [buildingId]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const run = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await run(async () => {
      await api.addBuildingAdmin(buildingId, { ...form, tenantId: form.tenantId ? Number(form.tenantId) : undefined });
      setForm({ email: '', name: '', password: '', role: 'RESIDENT', tenantId: '' });
    });
    setSaving(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const regenerateCode = async () => {
    const res = await api.regenerateInviteCode(buildingId);
    setInviteCode(res.inviteCode);
  };

  const pending = members?.filter((m) => m.status === 'PENDING') || [];
  const active = members?.filter((m) => m.status === 'ACTIVE') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-800">ניהול משתמשים בבניין</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
            <p className="mb-1.5 text-xs font-semibold text-blue-800">קוד הזמנה לבניין</p>
            <p className="mb-2 text-[11px] text-blue-700">
              מי שנרשם עם הקוד (בטאב "הצטרפות") נכנס כ"דייר" ממתין - נציג ועד מאשר אותו, בוחר הרשאה ומשייך אותו לדירה.
            </p>
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-lg border border-blue-200 bg-white py-1.5 text-center font-mono text-sm tracking-widest text-blue-900">{inviteCode}</span>
              <button onClick={copyCode} className="rounded-lg border border-blue-200 bg-white p-2 text-blue-700" title="העתקה">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
              <button onClick={regenerateCode} className="rounded-lg border border-blue-200 bg-white p-2 text-blue-700" title="יצירת קוד חדש"><RefreshCw size={15} /></button>
            </div>
          </div>

          {members === null && <p className="text-sm text-slate-500">טוען...</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><Clock size={13} /> ממתינים לאישור</p>
              {pending.map((m) => (
                <PendingRow
                  key={m.userId}
                  member={m}
                  tenants={tenants}
                  onApprove={(role, tenantId) => run(() => api.approveBuildingAdmin(buildingId, m.userId, role, tenantId ? Number(tenantId) : undefined))}
                  onReject={() => run(() => api.removeBuildingAdmin(buildingId, m.userId))}
                />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {active.map((m) => {
              const isMe = m.userId === currentUserId;
              return (
                <div key={m.userId} className="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{m.name}</p>
                      <p className="truncate text-xs text-slate-500">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isMe ? (
                        <span className="text-xs text-slate-400">{ROLE_LABELS[m.role]}</span>
                      ) : (
                        <select value={m.role} onChange={(e) => run(() => api.updateBuildingAdminRole(buildingId, m.userId, e.target.value))} className="rounded-md border border-slate-200 px-1.5 py-1 text-xs">
                          {ROLE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </select>
                      )}
                      {!isMe && (
                        <button onClick={() => run(() => api.removeBuildingAdmin(buildingId, m.userId))} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span>דירה:</span>
                    <select
                      value={m.tenant?.id || ''}
                      onChange={(e) => run(() => api.linkMemberTenant(buildingId, m.userId, e.target.value ? Number(e.target.value) : null))}
                      className="flex-1 rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                    >
                      <option value="">— לא משויך —</option>
                      {tenants.map((t) => <option key={t.id} value={t.id}>דירה {t.apartmentNumber} · {t.name}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><UserPlus size={14} /> הוספת משתמש (עם סיסמה שאת קובעת)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">שם מלא</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">אימייל</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">סיסמה (רק אם זה משתמש חדש)</label>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} className="input" minLength={8} placeholder="לפחות 8 תווים" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">הרשאה</label>
              <div className="flex gap-2">
                {ROLE_OPTIONS.map((opt) => (
                  <button type="button" key={opt.v} onClick={() => set('role', opt.v)}
                    className={`flex-1 rounded-xl border py-2 text-sm font-medium ${form.role === opt.v ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">שיוך לדירה (אופציונלי)</label>
              <select value={form.tenantId} onChange={(e) => set('tenantId', e.target.value)} className="input">
                <option value="">— ללא —</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>דירה {t.apartmentNumber} · {t.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'מוסיף...' : 'הוספה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PendingRow({ member, tenants, onApprove, onReject }) {
  const [role, setRole] = useState('RESIDENT'); // resident is the default
  const [tenantId, setTenantId] = useState('');
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <p className="text-sm font-semibold text-slate-800">{member.name}</p>
      <p className="mb-2 text-xs text-slate-500">{member.email}{member.phone ? ` · ${member.phone}` : ''}</p>
      <div className="grid grid-cols-2 gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs">
          {ROLE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs">
          <option value="">דירה: לא משויך</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>דירה {t.apartmentNumber} · {t.name}</option>)}
        </select>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => onApprove(role, tenantId)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white">
          <UserCheck size={13} /> אישור
        </button>
        <button onClick={onReject} className="p-1.5 text-slate-400 hover:text-red-500" title="דחייה"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
