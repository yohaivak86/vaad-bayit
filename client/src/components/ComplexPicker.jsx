import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../api';
import SearchBox from './SearchBox';

// Attach a building to a complex: search by number / name / address / code, then send a request that the
// complex's manager approves. Nothing found? Offer to open a new complex (this building joins it at once;
// the committee rep who opens it becomes its manager).
export default function ComplexPicker({ buildingId, onChanged }) {
  const [pending, setPending] = useState([]);
  const [results, setResults] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });
  const [version, setVersion] = useState(0);

  const loadPending = useCallback(() => api.getBuildingComplexRequests(buildingId).then(setPending).catch(() => setPending([])), [buildingId]);
  useEffect(() => { loadPending(); }, [loadPending]);

  const request = async (complex) => {
    setBusy(true);
    setError('');
    try {
      await api.requestJoinComplex(complex.id, buildingId);
      setNotice(`הבקשה למתחם ${complex.number} (${complex.name}) נשלחה למנהל המתחם.`);
      await loadPending();
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    await api.cancelBuildingComplexRequest(buildingId, id);
    await loadPending();
    setVersion((v) => v + 1);
  };

  const createComplex = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const complex = await api.createComplex(form);
      await api.joinComplexFromBuilding(buildingId, complex.inviteCode);
      onChanged?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      {pending.length > 0 && (
        <ul className="list">
          {pending.map((p) => (
            <li key={p.id}>
              <span>בקשה ממתינה למתחם {p.complex.number} · {p.complex.name}</span>
              <button className="btn btn--secondary btn--small" onClick={() => cancel(p.id)}><X size={14} /> ביטול</button>
            </li>
          ))}
        </ul>
      )}

      {!creating && (
        <>
          <SearchBox
            key={version}
            placeholder="מספר מתחם, שם, כתובת או קוד"
            minLength={1}
            run={api.searchComplexes}
            onResults={setResults}
            emptyHint="לא נמצא מתחם כזה."
            renderRow={(c) => (
              <li key={c.id}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0 }}>מתחם {c.number} · {c.name}</h3>
                  <p className="text-footnote text-secondary" style={{ margin: 0 }}>{c.address || 'ללא כתובת'} · {c.buildingsCount} בניינים · מנהל: {c.ownerName}</p>
                </div>
                {c.requested ? <span className="badge badge--warning">בקשה פתוחה</span>
                  : <button className="btn btn--secondary btn--small" disabled={busy} onClick={() => request(c)}>בקשת הצטרפות</button>}
              </li>
            )}
          />
          {(results === null || results.length === 0) && (
            <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: 'flex-start' }} onClick={() => setCreating(true)}>
              <Plus size={14} /> {results && results.length === 0 ? 'אין מתחם כזה - לפתוח מתחם חדש' : 'פתיחת מתחם חדש'}
            </button>
          )}
        </>
      )}

      {creating && (
        <form onSubmit={createComplex} className="stack" style={{ gap: 'var(--space-3)' }}>
          <div className="field"><label>שם המתחם</label><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
          <div className="field"><label>כתובת המתחם</label><input className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
          <span className="text-footnote text-secondary">המתחם יקבל מספר אוטומטי והבניין הזה יצורף אליו. אתם תהיו מנהלי המתחם ותאשרו בניינים שיבקשו להצטרף.</span>
          <div className="row">
            <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'פותח...' : 'פתיחת מתחם ושיוך הבניין'}</button>
            <button type="button" className="btn btn--secondary" onClick={() => setCreating(false)}>חזרה לחיפוש</button>
          </div>
        </form>
      )}

      {notice && <div className="alert alert--success" role="status">{notice}</div>}
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
    </div>
  );
}
