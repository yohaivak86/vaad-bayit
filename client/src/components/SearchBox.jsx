import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

// Search box + result list used across the app (buildings, complexes). `run(query)` returns the matches;
// `renderRow` draws one. Searches work on code, number, name and address - the server decides.
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// A search box + result list. `run(query)` returns the matches; `renderRow` draws one.
export default function SearchBox({ placeholder, minLength, run, renderRow, emptyHint, onResults }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const dq = useDebounced(q.trim());

  useEffect(() => {
    let alive = true;
    if (dq.length < minLength) { setResults(null); onResults?.(null); return undefined; }
    run(dq)
      .then((r) => { if (alive) { setResults(r); setError(''); onResults?.(r); } })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="input-affix">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <span className="affix" style={{ pointerEvents: 'none', paddingInlineEnd: 'var(--space-3)', color: 'var(--label-secondary)' }}><Search size={20} /></span>
      </div>
      {error && <div className="alert alert--danger">{error}</div>}
      {results && results.length > 0 && <ul className="list">{results.map((r) => renderRow(r))}</ul>}
      {results && results.length === 0 && <p className="empty" style={{ padding: 'var(--space-2)' }}>{emptyHint}</p>}
      {!results && dq.length < minLength && <p className="text-footnote text-secondary" style={{ margin: 0 }}>הקלידו לפחות {minLength} תווים - אפשר לחפש לפי שם, כתובת או קוד.</p>}
    </div>
  );
}

