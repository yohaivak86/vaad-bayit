import { useState, useEffect } from 'react';
import { Building2, Wrench } from 'lucide-react';
import { api } from '../api';
import ProfessionalRegisterModal from './ProfessionalRegisterModal';

const MODES = [
  { key: 'login', label: 'התחברות' },
  { key: 'register', label: 'בניין חדש' },
  { key: 'join', label: 'הצטרפות' },
];

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', buildingName: '', buildingAddress: '', inviteCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [showProfessionalForm, setShowProfessionalForm] = useState(false);

  useEffect(() => {
    api.getPublicStats().then(setStats).catch(() => setStats({ show: false }));
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { user } = await api.login(form.email, form.password);
        onAuthenticated(user);
      } else if (mode === 'register') {
        const res = await api.register(form);
        onAuthenticated(res.user);
      } else {
        const res = await api.joinBuilding(form);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm space-y-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col items-center mb-5 relative">
          {stats?.show && (
            <div className="absolute -top-1 left-0 flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 rounded-full w-16 h-16 text-emerald-700">
              <span className="font-extrabold text-lg leading-none">{stats.buildingsCount}</span>
              <span className="text-[9px] leading-tight">בניינים</span>
            </div>
          )}
          <div className="bg-blue-600 text-white rounded-xl p-2.5 mb-2">
            <Building2 size={24} />
          </div>
          <h1 className="font-extrabold text-lg text-slate-800">ועד בית</h1>
          <p className="text-xs text-slate-500">מערכת ניהול עצמי לבניין מגורים</p>
        </div>

        <div className="flex mb-4 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`flex-1 rounded-md py-1.5 transition ${mode === m.key ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <>
              <Field label="שם הבניין">
                <input value={form.buildingName} onChange={(e) => set('buildingName', e.target.value)} className="input" required placeholder='לדוגמה: נחל דליות 8' />
              </Field>
              <Field label="כתובת (אופציונלי)">
                <input value={form.buildingAddress} onChange={(e) => set('buildingAddress', e.target.value)} className="input" />
              </Field>
              <Field label="שם מלא">
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
              </Field>
            </>
          )}

          {mode === 'join' && (
            <>
              <Field label="קוד הזמנה לבניין">
                <input
                  value={form.inviteCode}
                  onChange={(e) => set('inviteCode', e.target.value.toUpperCase())}
                  className="input font-mono tracking-widest text-center"
                  required
                  placeholder="ABCD1234"
                />
              </Field>
              <Field label="שם מלא">
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
              </Field>
            </>
          )}

          <Field label="אימייל">
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" required />
          </Field>
          <Field label="סיסמה">
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} className="input" required minLength={mode !== 'login' ? 8 : undefined} />
          </Field>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition"
          >
            {loading ? 'רגע...' : mode === 'login' ? 'התחברות' : mode === 'register' ? 'יצירת בניין וחשבון' : 'הצטרפות לבניין'}
          </button>
        </form>
      </div>

      <button
        onClick={() => setShowProfessionalForm(true)}
        className="w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-sm font-medium transition"
      >
        <Wrench size={16} />
        בעל מקצוע ורוצה לתת שירות? הירשם כאן
      </button>
      </div>

      {showProfessionalForm && <ProfessionalRegisterModal onClose={() => setShowProfessionalForm(false)} />}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
