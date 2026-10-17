import { useEffect, useState } from 'react';
import { Plus, Search, ChevronLeft } from 'lucide-react';
import { api } from '../api';
import ComplexDetailModal from './ComplexDetailModal';
import ComplexPicker from './ComplexPicker';
import ComplexRequests from './ComplexRequests';
import Sheet from './Sheet';

export default function ComplexesModal({ myBuildings, onClose }) {
  const [complexes, setComplexes] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showFind, setShowFind] = useState(false);

  const load = async () => setComplexes(await api.getMyComplexes());
  useEffect(() => { load(); }, []);

  return (
    <>
      <Sheet
        title="מתחמים"
        onClose={onClose}
        footer={
          <div className="row">
            <button onClick={() => setShowCreate(true)} className="btn btn--primary" style={{ flex: 1 }}><Plus size={20} /> מתחם חדש</button>
            <button onClick={() => setShowFind(true)} className="btn btn--secondary" style={{ flex: 1 }}><Search size={20} /> חיפוש והצטרפות</button>
          </div>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <ComplexRequests embedded onChanged={load} />
          {complexes === null && <p className="empty">טוען...</p>}
          {complexes && complexes.length > 0 && (
            <ul className="list">
              {complexes.map((c) => (
                <li key={c.id} className="is-link" onClick={() => setOpenId(c.id)}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>מתחם {c.number} · {c.name}</h3>
                    <p className="text-footnote text-secondary" style={{ margin: 0 }}>{c.address ? `${c.address} · ` : ''}{c.members.length} בניינים · מנהל: {c.ownerName}</p>
                  </div>
                  <ChevronLeft size={20} color="var(--label-secondary)" />
                </li>
              ))}
            </ul>
          )}
          {complexes?.length === 0 && <p className="empty">אין עדיין מתחמים. אפשר לפתוח מתחם חדש או לחפש מתחם קיים ולבקש להצטרף.</p>}
        </div>
      </Sheet>

      {openId && <ComplexDetailModal complexId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
      {showCreate && (
        <CreateComplexModal
          onClose={() => setShowCreate(false)}
          onCreated={async (id) => { setShowCreate(false); await load(); setOpenId(id); }}
        />
      )}
      {showFind && <FindComplexModal myBuildings={myBuildings} onClose={() => { setShowFind(false); load(); }} />}
    </>
  );
}

function CreateComplexModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const complex = await api.createComplex(form);
      onCreated(complex.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Sheet title="מתחם חדש" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="field"><label>שם המתחם</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" required placeholder="לדוגמה: מתחם נחל דליות" /></div>
        <div className="field"><label>כתובת המתחם</label><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="input" /></div>
        <p className="text-footnote text-secondary" style={{ margin: 0 }}>המתחם יקבל מספר אוטומטי. רק נציג ועד יכול לפתוח מתחם - ואתם תהיו מנהליו.</p>
        {error && <div className="alert alert--danger">{error}</div>}
        <button type="submit" disabled={saving} className="btn btn--primary">{saving ? 'יוצר...' : 'יצירה'}</button>
      </form>
    </Sheet>
  );
}

// Pick which of your buildings should join, then search for the complex. The manager approves.
function FindComplexModal({ myBuildings, onClose }) {
  const committee = (myBuildings || []).filter((b) => b.role === 'COMMITTEE' && b.status !== 'PENDING' && !b.complexId);
  const [buildingId, setBuildingId] = useState(committee[0]?.id || '');

  return (
    <Sheet title="הצטרפות למתחם" onClose={onClose}>
      <div className="stack">
        {committee.length === 0 ? (
          <p className="empty">אין בניין פנוי לשיוך: צריך להיות נציג ועד בבניין שעדיין אינו חלק ממתחם.</p>
        ) : (
          <>
            {committee.length > 1 && (
              <div className="field">
                <label>איזה בניין מצטרף?</label>
                <select value={buildingId} onChange={(e) => setBuildingId(Number(e.target.value))} className="input">
                  {committee.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <ComplexPicker key={buildingId} buildingId={buildingId} onChanged={onClose} />
          </>
        )}
      </div>
    </Sheet>
  );
}
