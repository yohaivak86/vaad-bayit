import { useEffect, useState } from 'react';
import { DoorOpen, Building2, Network, Check, Clock, LogOut, X } from 'lucide-react';
import { api } from '../api';
import AuthLayout from './AuthLayout';
import SearchBox from './SearchBox';

// The second step of a new user's journey (also reachable later, from the building list):
//   1. join an existing building - by invite number, or by searching its name / address / code
//   2. open a new building - standalone, or inside a complex (found by number / name / address /
//      code - which sends a request to the complex's manager - or opened right now).
const CAPTIONS = {
  choose: 'מה תרצו לעשות? אפשר לפתוח בניין חדש או להצטרף לבניין שכבר במערכת.',
  join: 'הצטרפות לבניין קיים. נציג הוועד יאשר אתכם.',
  'create-building': 'בניין בודד: ניהול כספים, משימות ודיירים במקום אחד.',
  'create-complex': 'מתחם: כמה בניינים שמתחלקים בהוצאות, בספקים ובחשמל המשותף.',
};

export default function JoinOrCreate({ onDone, onLogout, onCancel }) {
  const [step, setStep] = useState('choose'); // choose | join | create
  const [kind, setKind] = useState('building'); // create: building | complex
  const [stats, setStats] = useState(null);
  useEffect(() => { api.getPublicStats().then(setStats).catch(() => {}); }, []);

  const focus = step === 'create' && kind === 'complex' ? 'complex' : step === 'create' ? 'building' : step === 'join' ? 'building' : 'complex';
  const captionKey = step === 'create' ? (kind === 'complex' ? 'create-complex' : 'create-building') : step;

  return (
    <AuthLayout focus={focus} caption={CAPTIONS[captionKey]} stats={stats}>
      <div className="auth-card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0 }}>{step === 'choose' ? 'בואו נתחיל' : step === 'join' ? 'הצטרפות לבניין' : 'בניין חדש'}</h1>
          {onCancel ? (
            <button className="icon-btn" onClick={onCancel} aria-label="סגירה"><X size={20} /></button>
          ) : (
            <button className="icon-btn" onClick={onLogout} aria-label="התנתקות" title="התנתקות"><LogOut size={20} /></button>
          )}
        </div>

        {step === 'choose' && (
          <div className="choice">
            <button type="button" className="choice-card" aria-pressed="false" onClick={() => setStep('join')}>
              <DoorOpen size={24} className="choice-icon" />
              <h3 style={{ margin: 0 }}>הצטרפות לבניין</h3>
              <span className="text-footnote text-secondary">יש לי מספר הזמנה, או שאחפש את הבניין</span>
            </button>
            <button type="button" className="choice-card" aria-pressed="false" onClick={() => setStep('create')}>
              <Building2 size={24} className="choice-icon" />
              <h3 style={{ margin: 0 }}>פתיחת בניין חדש</h3>
              <span className="text-footnote text-secondary">בניין בודד, או חלק ממתחם</span>
            </button>
          </div>
        )}

        {step === 'join' && <JoinPanel onDone={onDone} onBack={() => setStep('choose')} />}
        {step === 'create' && <CreatePanel kind={kind} setKind={setKind} onDone={onDone} onBack={() => setStep('choose')} />}
      </div>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------- join an existing building
function JoinPanel({ onDone, onBack }) {
  const [mode, setMode] = useState('code'); // code | search
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  const send = async (payload) => {
    setError('');
    setBusy(true);
    try {
      const res = await api.requestJoinBuilding(payload);
      setSent(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="card stack">
        <div className="alert alert--success row"><Clock size={20} /> <span>הבקשה להצטרפות לבניין "{sent.buildingName}" נשלחה. נציג הוועד יאשר אתכם ויקבע אם אתם דיירים או נציגי ועד.</span></div>
        <button className="btn btn--primary" onClick={onDone}>המשך</button>
      </div>
    );
  }

  return (
    <div className="card stack">
      <div className="segmented" style={{ alignSelf: 'flex-start' }}>
        <button type="button" aria-pressed={mode === 'code'} onClick={() => setMode('code')}>מספר הזמנה</button>
        <button type="button" aria-pressed={mode === 'search'} onClick={() => setMode('search')}>חיפוש בניין</button>
      </div>

      {mode === 'code' ? (
        <form onSubmit={(e) => { e.preventDefault(); send({ inviteCode: code }); }} className="stack">
          <div className="field">
            <label htmlFor="invite">מספר הזמנה לבניין</label>
            <input id="invite" className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD1234" required dir="ltr" style={{ textAlign: 'center', letterSpacing: '0.12em', fontFamily: 'ui-monospace, monospace' }} />
          </div>
          <button type="submit" className="btn btn--primary" disabled={busy || !code.trim()}>{busy ? 'שולח...' : 'שליחת בקשת הצטרפות'}</button>
        </form>
      ) : (
        <SearchBox
          placeholder="שם הבניין, כתובת או קוד הזמנה"
          minLength={2}
          run={api.searchBuildings}
          emptyHint="לא נמצא בניין. בדקו את האיות, או פתחו בניין חדש."
          renderRow={(b) => (
            <li key={b.id}>
              <div className="min-w-0">
                <h3 style={{ margin: 0 }}>{b.name}</h3>
                <p className="text-footnote text-secondary" style={{ margin: 0 }}>
                  {b.address || 'ללא כתובת'}{b.complexName ? ` · מתחם ${b.complexNumber} ${b.complexName}` : ''}
                </p>
              </div>
              {b.membership === 'ACTIVE' ? <span className="badge badge--success">כבר שלכם</span>
                : b.membership === 'PENDING' ? <span className="badge badge--warning">ממתין לאישור</span>
                : <button className="btn btn--secondary btn--small" disabled={busy} onClick={() => send({ buildingId: b.id })}>בקשת הצטרפות</button>}
            </li>
          )}
        />
      )}

      {error && <div className="alert alert--danger" role="alert">{error}</div>}
      <button className="btn btn--secondary btn--small" style={{ alignSelf: 'flex-start' }} onClick={onBack}>חזרה</button>
    </div>
  );
}

// ---------------------------------------------------------------- open a new building (+ complex)
function CreatePanel({ kind, setKind, onDone, onBack }) {
  const [form, setForm] = useState({ name: '', address: '' });
  const [complexMode, setComplexMode] = useState('find'); // find | new
  const [chosen, setChosen] = useState(null); // complex picked from the search
  const [lastResults, setLastResults] = useState(null);
  const [newComplex, setNewComplex] = useState({ name: '', address: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (kind === 'complex' && complexMode === 'find' && !chosen) { setError('בחרו מתחם מהחיפוש, או פתחו מתחם חדש.'); return; }
    setBusy(true);
    try {
      const payload = { name: form.name, address: form.address };
      if (kind === 'complex') {
        if (complexMode === 'new') payload.newComplex = newComplex;
        else payload.complexId = chosen.id;
      }
      setDone(await api.openNewBuilding(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card stack">
        <div className="alert alert--success row"><Check size={20} /> <span>
          הבניין "{form.name}" נפתח ואתם נציגי הוועד שלו.
          {done.complex && ` נפתח גם מתחם "${done.complex.name}" - מספר המתחם: ${done.complex.number}.`}
          {done.complexRequested && ` בקשת השיוך למתחם ${done.complexRequested.number} (${done.complexRequested.name}) נשלחה לאישור מנהל המתחם.`}
        </span></div>
        <button className="btn btn--primary" onClick={() => onDone(done.buildingId)}>כניסה לבניין</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card stack">
      <div className="choice">
        <button type="button" className="choice-card" aria-pressed={kind === 'building'} onClick={() => setKind('building')}>
          <Building2 size={24} className="choice-icon" />
          <h3 style={{ margin: 0 }}>בניין בודד</h3>
        </button>
        <button type="button" className="choice-card" aria-pressed={kind === 'complex'} onClick={() => setKind('complex')}>
          <Network size={24} className="choice-icon" />
          <h3 style={{ margin: 0 }}>חלק ממתחם</h3>
        </button>
      </div>

      <div className="field">
        <label htmlFor="bname">שם הבניין</label>
        <input id="bname" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="לדוגמה: נחל דליות 8" />
      </div>
      <div className="field">
        <label htmlFor="baddr">כתובת</label>
        <input id="baddr" className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="רחוב ומספר, עיר" />
      </div>

      {kind === 'complex' && (
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <div className="segmented" style={{ alignSelf: 'flex-start' }}>
            <button type="button" aria-pressed={complexMode === 'find'} onClick={() => setComplexMode('find')}>חיפוש מתחם קיים</button>
            <button type="button" aria-pressed={complexMode === 'new'} onClick={() => setComplexMode('new')}>פתיחת מתחם חדש</button>
          </div>

          {complexMode === 'find' && (
            <>
              <SearchBox
                placeholder="מספר מתחם, שם, כתובת או קוד"
                minLength={1}
                run={api.searchComplexes}
                onResults={setLastResults}
                emptyHint="לא נמצא מתחם כזה."
                renderRow={(c) => (
                  <li key={c.id} className="is-link" onClick={() => !c.requested && setChosen(c)} style={chosen?.id === c.id ? { background: 'var(--accent-tint)' } : undefined}>
                    <div className="min-w-0">
                      <h3 style={{ margin: 0 }}>מתחם {c.number} · {c.name}</h3>
                      <p className="text-footnote text-secondary" style={{ margin: 0 }}>{c.address || 'ללא כתובת'} · {c.buildingsCount} בניינים · מנהל: {c.ownerName}</p>
                    </div>
                    {chosen?.id === c.id ? <Check size={20} color="var(--accent)" /> : c.requested ? <span className="badge badge--warning">בקשה פתוחה</span> : null}
                  </li>
                )}
              />
              {chosen && <div className="alert alert--warning">שיוך הבניין למתחם "{chosen.name}" יישלח לאישור מנהל המתחם ({chosen.ownerName}).</div>}
              {lastResults && lastResults.length === 0 && (
                <button type="button" className="btn btn--secondary" onClick={() => setComplexMode('new')}>אין מתחם כזה - לפתוח מתחם חדש</button>
              )}
            </>
          )}

          {complexMode === 'new' && (
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div className="field">
                <label htmlFor="cname">שם המתחם</label>
                <input id="cname" className="input" value={newComplex.name} onChange={(e) => setNewComplex((c) => ({ ...c, name: e.target.value }))} required placeholder="לדוגמה: מתחם הדקלים" />
              </div>
              <div className="field">
                <label htmlFor="caddr">כתובת המתחם</label>
                <input id="caddr" className="input" value={newComplex.address} onChange={(e) => setNewComplex((c) => ({ ...c, address: e.target.value }))} />
                <span className="text-footnote text-secondary">המתחם יקבל מספר אוטומטי. אתם תהיו מנהלי המתחם ותאשרו בניינים שמבקשים להצטרף.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="alert alert--danger" role="alert">{error}</div>}
      <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'פותח...' : kind === 'complex' && complexMode === 'new' ? 'פתיחת בניין ומתחם' : 'פתיחת הבניין'}</button>
      <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: 'flex-start' }} onClick={onBack}>חזרה</button>
    </form>
  );
}
