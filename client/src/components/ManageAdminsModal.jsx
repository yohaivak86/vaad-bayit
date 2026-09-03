import { useEffect, useState } from 'react';
import { X, Trash2, UserPlus, Copy, RefreshCw, Check, UserCheck, Clock } from 'lucide-react';
import { api } from '../api';

const ROLE_LABEL = { ADMIN: 'עריכה מלאה', VIEWER: 'צפייה בלבד' };

export default function ManageAdminsModal({ buildingId, currentUserId, building, onClose }) {
  const [admins, setAdmins] = useState(null);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'ADMIN' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState(building?.inviteCode || '');
  const [copied, setCopied] = useState(false);

  const load = async () => setAdmins(await api.getBuildingAdmins(buildingId));
  useEffect(() => { load(); }, [buildingId]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.addBuildingAdmin(buildingId, form);
      setForm({ email: '', name: '', password: '', role: 'ADMIN' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (userId) => {
    setError('');
    try {
      await api.removeBuildingAdmin(buildingId, userId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const changeRole = async (userId, role) => {
    setError('');
    try {
      await api.updateBuildingAdminRole(buildingId, userId, role);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const approve = async (userId, role) => {
    setError('');
    try {
      await api.approveBuildingAdmin(buildingId, userId, role);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable - ignore, the code is still selectable on screen */
    }
  };

  const regenerateCode = async () => {
    const res = await api.regenerateInviteCode(buildingId);
    setInviteCode(res.inviteCode);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">ניהול משתמשים בבניין</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3">
            <p className="text-xs font-semibold text-blue-800 mb-1.5">קוד הזמנה לבניין</p>
            <p className="text-[11px] text-blue-700 mb-2">
              כל מי שנרשם עם הקוד הזה (בטאב "הצטרפות" במסך ההתחברות) יצטרף כאדמין עם הרשאת עריכה מלאה.
              עבור הרשאת צפייה בלבד יש להוסיף למטה ידנית.
            </p>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-mono tracking-widest text-center bg-white border border-blue-200 rounded-lg py-1.5 text-sm text-blue-900">
                {inviteCode}
              </span>
              <button onClick={copyCode} className="p-2 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100" title="העתקה">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
              <button onClick={regenerateCode} className="p-2 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100" title="יצירת קוד חדש">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {admins === null && <p className="text-sm text-slate-500">טוען...</p>}

          {admins?.some((a) => a.status === 'PENDING') && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5"><Clock size={13} /> ממתינים לאישור</p>
              {admins.filter((a) => a.status === 'PENDING').map((a) => (
                <PendingRow key={a.userId} admin={a} onApprove={approve} onReject={remove} />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {admins?.filter((a) => a.status === 'ACTIVE').map((a) => (
              <div key={a.userId} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2.5">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{a.name}</p>
                  <p className="text-xs text-slate-500">{a.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.userId === currentUserId ? (
                    <span className="text-xs text-slate-400">{ROLE_LABEL[a.role]}</span>
                  ) : (
                    <select
                      value={a.role}
                      onChange={(e) => changeRole(a.userId, e.target.value)}
                      className="text-xs border border-slate-200 rounded-md px-1.5 py-1"
                    >
                      <option value="ADMIN">עריכה מלאה</option>
                      <option value="VIEWER">צפייה בלבד</option>
                    </select>
                  )}
                  {a.userId !== currentUserId && (
                    <button onClick={() => remove(a.userId)} className="p-1.5 text-slate-300 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submit} className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <UserPlus size={14} /> הוספת משתמש (עם סיסמה שאת קובעת)
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">שם מלא</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">אימייל</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">סיסמה (רק אם זה משתמש חדש)</label>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} className="input" minLength={8} placeholder="לפחות 8 תווים" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">הרשאה</label>
              <div className="flex gap-2">
                {[{ v: 'ADMIN', label: 'עריכה מלאה' }, { v: 'VIEWER', label: 'צפייה בלבד' }].map((opt) => (
                  <button
                    type="button"
                    key={opt.v}
                    onClick={() => set('role', opt.v)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                      form.role === opt.v ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition">
              {saving ? 'מוסיף...' : 'הוספה'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PendingRow({ admin, onApprove, onReject }) {
  const [role, setRole] = useState('ADMIN');
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2.5">
      <p className="font-semibold text-sm text-slate-800">{admin.name}</p>
      <p className="text-xs text-slate-500 mb-2">{admin.email}</p>
      <div className="flex items-center gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="text-xs border border-slate-200 rounded-md px-1.5 py-1.5 bg-white">
          <option value="ADMIN">עריכה מלאה</option>
          <option value="VIEWER">צפייה בלבד</option>
        </select>
        <button
          onClick={() => onApprove(admin.userId, role)}
          className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md py-1.5 transition"
        >
          <UserCheck size={13} /> אישור
        </button>
        <button
          onClick={() => onReject(admin.userId)}
          className="p-1.5 text-slate-400 hover:text-red-500"
          title="דחייה"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
