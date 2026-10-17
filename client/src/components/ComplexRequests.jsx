import { useCallback, useEffect, useState } from 'react';
import { Check, X, Network } from 'lucide-react';
import { api } from '../api';

// Buildings asking to join a complex this user manages (the committee rep who opened it).
// Renders nothing when there is nothing waiting.
export default function ComplexRequests({ onChanged, embedded = false }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => api.getIncomingComplexRequests().then(setRequests).catch(() => setRequests([])), []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision) => {
    setBusyId(id);
    setError('');
    try {
      await api.decideComplexRequest(id, decision);
      await load();
      if (decision === 'approve') onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0) return null;

  const Wrapper = embedded ? 'div' : 'section';
  return (
    <Wrapper className={embedded ? undefined : 'page'} style={embedded ? undefined : { paddingBlock: 'var(--space-4) 0' }}>
      <div className="card card--tight stack" style={{ gap: 'var(--space-3)' }}>
        <h3 className="row" style={{ margin: 0 }}><Network size={20} /> בקשות הצטרפות למתחם <span className="badge badge--warning">{requests.length}</span></h3>
        <ul className="list" style={{ background: 'var(--bg-grouped)' }}>
          {requests.map((r) => (
            <li key={r.id}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0 }}>{r.building.name} → מתחם {r.complex.number} {r.complex.name}</h3>
                <p className="text-footnote text-secondary" style={{ margin: 0 }}>
                  {r.building.address || 'ללא כתובת'} · {r.building.apartmentsCount || '?'} דירות · ביקש/ה: {r.requestedBy}{r.requestedByPhone ? ` (${r.requestedByPhone})` : ''}
                </p>
              </div>
              <div className="row">
                <button className="btn btn--primary btn--small" disabled={busyId === r.id} onClick={() => decide(r.id, 'approve')}><Check size={16} /> אישור</button>
                <button className="btn btn--danger btn--small" disabled={busyId === r.id} onClick={() => decide(r.id, 'reject')}><X size={16} /> דחייה</button>
              </div>
            </li>
          ))}
        </ul>
        {error && <div className="alert alert--danger">{error}</div>}
      </div>
    </Wrapper>
  );
}
