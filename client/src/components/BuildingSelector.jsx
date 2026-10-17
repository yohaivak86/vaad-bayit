import { useState } from 'react';
import { Building2, ChevronLeft, LogOut, Plus, Users2, Clock, Settings2, Lightbulb, ShieldCheck, DoorOpen } from 'lucide-react';
import { api } from '../api';
import ComplexesModal from './ComplexesModal';
import SiteSettingsModal from './SiteSettingsModal';
import SuggestionsAdminModal from './SuggestionsAdminModal';
import AdminControlCenterModal from './AdminControlCenterModal';
import JoinOrCreate from './JoinOrCreate';
import Sheet from './Sheet';

export default function BuildingSelector({ user, buildings, onSelect, onLogout, onBuildingsChanged }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showComplexes, setShowComplexes] = useState(false);
  const [showSiteSettings, setShowSiteSettings] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  if (showJoin) {
    return (
      <JoinOrCreate
        onLogout={onLogout}
        onCancel={() => setShowJoin(false)}
        onDone={async (buildingId) => {
          setShowJoin(false);
          await onBuildingsChanged();
          if (buildingId) onSelect(buildingId);
        }}
      />
    );
  }

  const isSiteAdmin = user.role === 'SUPER_ADMIN';

  return (
    <div dir="rtl" style={{ minHeight: '100vh' }}>
      <header className="navbar">
        <div>
          <h3 style={{ margin: 0 }}>שלום, {user.name}</h3>
          <p className="text-footnote text-secondary" style={{ margin: 0 }}>בחרו בניין לניהול</p>
        </div>
        <button onClick={onLogout} className="icon-btn" title="התנתקות" aria-label="התנתקות"><LogOut size={20} /></button>
      </header>

      <div className="page stack" style={{ maxWidth: 560 }}>
        <ul className="list">
          {buildings.map((b) => {
            const isPending = b.status === 'PENDING';
            return (
              <li key={b.id} className={isPending ? '' : 'is-link'} onClick={() => !isPending && onSelect(b.id)} style={{ minHeight: 64 }}>
                <div className="row" style={{ gap: 'var(--space-3)', minWidth: 0 }}>
                  <div className={`chip ${isPending ? '' : 'chip--accent'}`} style={{ width: 40, height: 40, padding: 0, justifyContent: 'center' }}>
                    <Building2 size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }} className="truncate">{b.name}</h3>
                    {isPending ? (
                      <p className="text-footnote text-secondary row" style={{ margin: 0 }}><Clock size={14} /> ממתין לאישור נציג ועד</p>
                    ) : (
                      <p className="text-footnote text-secondary truncate" style={{ margin: 0 }}>
                        {b.address}
                        {b.complexName ? `${b.address ? ' · ' : ''}מתחם ${b.complexNumber ?? ''} ${b.complexName}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                {isPending ? <span className="badge badge--warning">ממתין</span> : <ChevronLeft size={20} color="var(--label-secondary)" />}
              </li>
            );
          })}
          {buildings.length === 0 && <li><span className="text-secondary text-footnote">אין עדיין בניינים משויכים לחשבון</span></li>}
        </ul>

        <button onClick={() => setShowJoin(true)} className="btn btn--primary"><DoorOpen size={20} /> הצטרפות לבניין או פתיחת בניין חדש</button>

        <ul className="list">
          {buildings.length > 0 && (
            <li className="is-link" onClick={() => setShowComplexes(true)}><span className="row"><Users2 size={20} /> מתחמים (בניינים משותפים)</span><ChevronLeft size={20} color="var(--label-secondary)" /></li>
          )}
          {isSiteAdmin && (
            <>
              <li className="is-link" onClick={() => setShowCreate(true)}><span className="row"><Plus size={20} /> הוספת בניין (מנהל אתר)</span><ChevronLeft size={20} color="var(--label-secondary)" /></li>
              <li className="is-link" onClick={() => setShowControlCenter(true)}><span className="row"><ShieldCheck size={20} /> מרכז ניהול (כל הבניינים והמשתמשים)</span><ChevronLeft size={20} color="var(--label-secondary)" /></li>
              <li className="is-link" onClick={() => setShowSiteSettings(true)}><span className="row"><Settings2 size={20} /> הגדרות מערכת</span><ChevronLeft size={20} color="var(--label-secondary)" /></li>
              <li className="is-link" onClick={() => setShowSuggestions(true)}><span className="row"><Lightbulb size={20} /> הצעות לשיפור</span><ChevronLeft size={20} color="var(--label-secondary)" /></li>
            </>
          )}
        </ul>
      </div>

      {showCreate && (
        <CreateBuildingModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => { setShowCreate(false); await onBuildingsChanged(); }}
        />
      )}
      {showComplexes && <ComplexesModal myBuildings={buildings} onClose={() => setShowComplexes(false)} />}
      {showSiteSettings && <SiteSettingsModal onClose={() => setShowSiteSettings(false)} />}
      {showSuggestions && <SuggestionsAdminModal onClose={() => setShowSuggestions(false)} />}
      {showControlCenter && <AdminControlCenterModal currentUserId={user.id} onClose={() => setShowControlCenter(false)} />}
    </div>
  );
}

function CreateBuildingModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', address: '', adminEmail: '', adminName: '', adminPassword: '', complexInviteCode: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createBuilding(form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="בניין חדש" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="field"><label>שם הבניין</label><input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required /></div>
        <div className="field"><label>כתובת</label><input value={form.address} onChange={(e) => set('address', e.target.value)} className="input" /></div>
        <div className="field">
          <label>קוד הזמנה למתחם (אם הבניין חלק ממתחם - לא חובה)</label>
          <input value={form.complexInviteCode} onChange={(e) => set('complexInviteCode', e.target.value.toUpperCase())} className="input" dir="ltr" style={{ textAlign: 'center', letterSpacing: '0.12em' }} placeholder="ריק = בניין בודד" />
        </div>
        <p className="text-footnote text-secondary" style={{ margin: 0 }}>פרטי חשבון נציג הוועד של הבניין:</p>
        <div className="field"><label>שם מלא</label><input value={form.adminName} onChange={(e) => set('adminName', e.target.value)} className="input" required /></div>
        <div className="field"><label>אימייל</label><input type="email" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} className="input" required dir="ltr" style={{ textAlign: 'start' }} /></div>
        <div className="field"><label>סיסמה זמנית (לפחות 8 תווים)</label><input type="password" value={form.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} className="input" required minLength={8} /></div>
        {error && <div className="alert alert--danger">{error}</div>}
        <button type="submit" disabled={saving} className="btn btn--primary">{saving ? 'יוצר...' : 'יצירת בניין'}</button>
      </form>
    </Sheet>
  );
}
