import { useState, useEffect } from 'react';
import { Eye, EyeOff, Wrench, MailCheck } from 'lucide-react';
import { api } from '../api';
import AuthLayout from './AuthLayout';
import ProfessionalRegisterModal from './ProfessionalRegisterModal';

// Two entry points only: sign in, or open a new user. After a new user is created, the next step
// (JoinOrCreate) asks for an invite number or a building search, or lets them open a building.
// Also handles "forgot password" and the e-mailed reset link (?reset=<token>).
const CAPTIONS = {
  login: 'ברוכים השבים. הבניין שלכם מחכה.',
  signup: 'משתמש חדש ב-30 שניות. אחר כך מצטרפים לבניין או פותחים אחד.',
  forgot: 'נשלח אליכם קישור לאיפוס הסיסמה.',
  reset: 'בחרו סיסמה חדשה וממשיכים.',
};

function readResetToken() {
  try {
    return new URLSearchParams(window.location.search).get('reset') || '';
  } catch {
    return '';
  }
}

export default function AuthScreen({ onAuthenticated }) {
  const resetToken = readResetToken();
  const [view, setView] = useState(resetToken ? 'reset' : 'login'); // login | signup | forgot | reset
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', marketingConsent: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [showProfessionalForm, setShowProfessionalForm] = useState(false);

  useEffect(() => {
    api.getPublicStats().then(setStats).catch(() => setStats({ show: false }));
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const go = (next) => { setView(next); setError(''); setNotice(''); setShowPassword(false); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (view === 'login') {
        const { user } = await api.login(form.email, form.password);
        onAuthenticated(user);
      } else if (view === 'signup') {
        const { user } = await api.signup(form);
        onAuthenticated(user);
      } else if (view === 'forgot') {
        await api.forgotPassword(form.email);
        setNotice('אם הכתובת רשומה אצלנו, נשלח אליה קישור לאיפוס הסיסמה. הקישור תקף לשעה.');
      } else {
        const { user } = await api.resetPassword(resetToken, form.password);
        window.history.replaceState({}, '', window.location.pathname);
        onAuthenticated(user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const needsPassword = view !== 'forgot';
  const newPassword = view === 'signup' || view === 'reset';
  const titles = { login: 'התחברות', signup: 'משתמש חדש', forgot: 'שכחתי סיסמה', reset: 'סיסמה חדשה' };
  const submitLabels = { login: 'התחברות', signup: 'יצירת משתמש', forgot: 'שליחת קישור לאיפוס', reset: 'שמירת סיסמה והתחברות' };

  return (
    <AuthLayout focus={view === 'signup' ? 'complex' : 'building'} caption={CAPTIONS[view]} stats={stats}>
      <div className="auth-card stack">
        {(view === 'login' || view === 'signup') && (
          <div className="segmented" style={{ alignSelf: 'center' }} role="tablist">
            <button type="button" aria-pressed={view === 'login'} onClick={() => go('login')}>התחברות</button>
            <button type="button" aria-pressed={view === 'signup'} onClick={() => go('signup')}>משתמש חדש</button>
          </div>
        )}

        <form onSubmit={submit} className="card card--floating stack" noValidate={false}>
          <h1 style={{ margin: 0 }}>{titles[view]}</h1>

          {view === 'signup' && (
            <>
              <div className="field">
                <label htmlFor="name">שם מלא</label>
                <input id="name" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="phone">טלפון</label>
                <input id="phone" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} required placeholder="050-1234567" inputMode="tel" autoComplete="tel" dir="ltr" style={{ textAlign: 'start' }} />
              </div>
            </>
          )}

          {view !== 'reset' && (
            <div className="field">
              <label htmlFor="email">אימייל</label>
              <input id="email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} required autoComplete="email" dir="ltr" style={{ textAlign: 'start' }} />
            </div>
          )}

          {needsPassword && (
            <div className="field">
              <label htmlFor="password">{view === 'reset' ? 'סיסמה חדשה' : 'סיסמה'}</label>
              <div className="input-affix">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  required
                  minLength={newPassword ? 8 : undefined}
                  autoComplete={newPassword ? 'new-password' : 'current-password'}
                />
                <span className="affix">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </span>
              </div>
              {newPassword && <span className="text-footnote text-secondary">לפחות 8 תווים</span>}
            </div>
          )}

          {view === 'signup' && (
            <label className="row text-footnote text-secondary" style={{ alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              <input type="checkbox" checked={form.marketingConsent} onChange={(e) => set('marketingConsent', e.target.checked)} style={{ marginTop: 3 }} />
              <span>אשמח לקבל עדכונים והתראות מהמערכת (לא חובה)</span>
            </label>
          )}

          {error && <div className="alert alert--danger" role="alert">{error}</div>}
          {notice && <div className="alert alert--success row" role="status"><MailCheck size={20} /> <span>{notice}</span></div>}

          <button type="submit" disabled={loading} className="btn btn--primary">{loading ? 'רגע...' : submitLabels[view]}</button>

          {view === 'login' && (
            <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: 'center' }} onClick={() => go('forgot')}>שכחתי סיסמה</button>
          )}
          {(view === 'forgot' || view === 'reset') && (
            <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: 'center' }} onClick={() => go('login')}>חזרה להתחברות</button>
          )}
        </form>

        <button type="button" onClick={() => setShowProfessionalForm(true)} className="btn btn--secondary">
          <Wrench size={20} /> בעל מקצוע ורוצה לתת שירות? הירשמו כאן
        </button>
      </div>

      {showProfessionalForm && <ProfessionalRegisterModal onClose={() => setShowProfessionalForm(false)} />}
    </AuthLayout>
  );
}
