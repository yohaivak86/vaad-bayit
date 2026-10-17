import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, ChevronLeft, Maximize2, Minimize2, Receipt, Network, CalendarClock, ShieldAlert, Pencil, Check, TriangleAlert,
} from 'lucide-react';
import { api } from '../../api';
import { MONTHS_HE, formatILS } from '../../format';
import BalanceCards from '../BalanceCards';

const STATUS = {
  OPEN: { label: 'פתוח', dot: 'danger' },
  IN_PROGRESS: { label: 'בטיפול', dot: 'warning' },
  CONTRACTOR: { label: 'בעל מקצוע', dot: 'warning' },
  RESOLVED: { label: 'הושלם', dot: 'success' },
};

export default function TimelineDashboard({ buildingId, role, balance, complexName, onBalanceChanged, onOpenTasks, onPayExpected }) {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [data, setData] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef(null);
  const isCommittee = role === 'COMMITTEE';

  useEffect(() => {
    setData(null);
    api.getTimeline(buildingId, year).then(setData).catch(() => setData({ items: [] }));
  }, [buildingId, year]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  };

  const byMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, () => []);
    (data?.items || []).forEach((it) => months[new Date(it.date).getMonth()].push(it));
    return months;
  }, [data]);

  const items = data?.items || [];
  const tasks = items.filter((i) => i.kind === 'TASK');
  const open = tasks.filter((t) => t.status !== 'RESOLVED');
  const urgent = open.filter((t) => t.urgent);
  const resolved = tasks.filter((t) => t.status === 'RESOLVED');
  const currentMonth = year === nowYear ? new Date().getMonth() : -1;

  return (
    <div className="page stack" style={{ maxWidth: 1600, gap: 'var(--space-6)' }}>
      <div>
        <h1 className="page-title" style={{ margin: 0 }}>לוח בקרה</h1>
        <p className="page-sub" style={{ margin: 0 }}>{isCommittee ? 'הקופה, מה מצפה בחודש הקרוב, והשנה כולה' : 'מה מצפה בחודש הקרוב והשנה כולה'}</p>
      </div>

      {isCommittee && (
        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <BalanceCards balance={balance} />
          <RedLine buildingId={buildingId} balance={balance} onSaved={onBalanceChanged} />
        </section>
      )}

      <NextMonth buildingId={buildingId} isCommittee={isCommittee} balance={balance} onOpenTasks={onOpenTasks} onPayExpected={onPayExpected} />

      <section ref={stageRef} className={`card ${fullscreen ? 'presentation' : ''}`} style={fullscreen ? { overflow: 'auto', borderRadius: 0 } : undefined}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: fullscreen ? 34 : undefined }}>ציר זמן שנתי {year}</h2>
            <p className="page-sub" style={{ margin: 0 }}>{complexName ? `כולל משימות המתחם "${complexName}"` : 'משימות, תקלות והוצאות מרכזיות לאורך השנה'}</p>
          </div>
          <div className="row no-print">
            <button onClick={() => setYear((y) => y - 1)} className="icon-btn" aria-label="שנה קודמת"><ChevronRight size={20} /></button>
            <span style={{ minWidth: 48, textAlign: 'center', font: 'var(--text-headline)' }}>{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="icon-btn" aria-label="שנה הבאה"><ChevronLeft size={20} /></button>
            <button onClick={toggleFullscreen} className="btn btn--secondary btn--small">
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {fullscreen ? 'יציאה' : 'מצב תצוגה'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ marginBottom: 'var(--space-4)' }}>
          <Kpi label="משימות פתוחות" value={open.length} />
          <Kpi label="דחופות" value={urgent.length} dot="danger" />
          <Kpi label="הושלמו השנה" value={resolved.length} dot="success" />
          <Kpi label="פריטים בציר" value={items.length} />
        </div>

        {!data && <p className="empty">טוען...</p>}

        {data && (
          <div className="overflow-x-auto" style={{ paddingBottom: 'var(--space-3)' }}>
            <div className="grid min-w-[1180px] grid-cols-12 gap-2" style={{ direction: 'rtl' }}>
              {MONTHS_HE.map((m, idx) => (
                <div key={m} className="min-w-0">
                  <div
                    className={idx === currentMonth ? 'chip chip--accent' : 'chip'}
                    style={{ width: '100%', justifyContent: 'center', marginBottom: 'var(--space-2)', fontWeight: 600, ...(idx === currentMonth ? { background: 'var(--accent)', color: 'var(--on-accent)' } : null) }}
                  >
                    {m}{byMonth[idx].length > 0 ? ` · ${byMonth[idx].length}` : ''}
                  </div>
                  <div className="stack" style={{ gap: 'var(--space-2)' }}>
                    {byMonth[idx].map((it) => <EventCard key={`${it.kind}-${it.id}`} item={it} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data && items.length === 0 && (
          <p className="empty">אין עדיין פריטים בציר הזמן של {year}. משימות והוצאות שסומנו "להצגה בציר הזמן" יופיעו כאן.</p>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------------------ red line
// The treasury has to stay above this amount - a reserve for unplanned work. Falling below turns the
// total tile red (BalanceCards) and warns here.
function RedLine({ buildingId, balance, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const redLine = balance?.redLine;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.setRedLine(buildingId, Number(value));
      setEditing(false);
      await onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (redLine === undefined) return null;

  return (
    <div className="card card--tight stack" style={{ gap: 'var(--space-2)' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span className="row"><ShieldAlert size={20} /> קו אדום לקופה: <b>{formatILS(redLine)}</b></span>
        {!editing && <button className="btn btn--secondary btn--small" onClick={() => { setValue(String(redLine)); setEditing(true); }}><Pencil size={14} /> שינוי</button>}
      </div>
      {editing ? (
        <form onSubmit={save} className="row" style={{ flexWrap: 'wrap' }}>
          <input type="number" min="0" step="100" className="input" style={{ maxWidth: 180 }} value={value} onChange={(e) => setValue(e.target.value)} required aria-label="סכום הקו האדום" inputMode="numeric" />
          <button type="submit" className="btn btn--primary btn--small" disabled={saving}><Check size={14} /> שמירה</button>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => setEditing(false)}>ביטול</button>
        </form>
      ) : (
        <p className="text-footnote text-secondary" style={{ margin: 0 }}>יתרה שנמוכה מהקו מסומנת באדום. הסכום שמור לתקלות בלתי צפויות.</p>
      )}
      {error && <div className="alert alert--danger">{error}</div>}
      {balance?.belowRedLine && !editing && (
        <div className="alert alert--danger row"><TriangleAlert size={20} /> <span>הקופה ({formatILS(balance.totalBalance)}) נמוכה מהקו האדום - כדאי לגבות או לדחות הוצאות.</span></div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------ next month
function NextMonth({ buildingId, isCommittee, balance, onOpenTasks, onPayExpected }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => api.getUpcoming(buildingId, 1).then(setData).catch(() => setData({ tasks: [], expenses: [] })), [buildingId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return null;
  const projected = balance && data.expectedTotal !== undefined ? balance.totalBalance - data.expectedTotal : null;
  const underLine = projected !== null && balance?.redLine !== undefined && projected < balance.redLine;

  const openTask = async (e) => {
    await api.createTask(buildingId, { title: e.title, recurringItemId: e.id });
    await load();
  };

  return (
    <section className="card stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 className="row" style={{ margin: 0 }}><CalendarClock size={22} /> בחודש הקרוב · {data.monthLabel} {data.year}</h2>
        {isCommittee && data.expectedTotal !== undefined && <span className="chip chip--accent">הוצאות צפויות: {formatILS(data.expectedTotal)}</span>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <h3 style={{ margin: 0 }}>משימות</h3>
          {data.tasks.length === 0 ? <p className="empty" style={{ padding: 'var(--space-3)' }}>אין משימות מתוזמנות לחודש הקרוב</p> : (
            <ul className="list" style={{ background: 'var(--bg-grouped)' }}>
              {data.tasks.map((t) => (
                <li key={t.id} className="is-link" onClick={onOpenTasks}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{t.title}</span>
                    <p className="text-footnote text-secondary" style={{ margin: 0 }}>{new Date(t.date).getUTCDate()} ב{data.monthLabel}{t.scope === 'COMPLEX' ? ' · מתחם' : ''}</p>
                  </div>
                  <span className="row">
                    {t.urgent && <span className="badge badge--danger">דחוף</span>}
                    <span className={`badge badge--${STATUS[t.status]?.dot || 'danger'}`}>{STATUS[t.status]?.label}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isCommittee && (
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <h3 style={{ margin: 0 }}>הוצאות צפויות</h3>
            {data.expenses.length === 0 ? <p className="empty" style={{ padding: 'var(--space-3)' }}>אין הוצאות צפויות. אפשר להגדיר אותן במסך "הוצאות".</p> : (
              <ul className="list" style={{ background: 'var(--bg-grouped)' }}>
                {data.expenses.map((e) => (
                  <li key={`${e.source}-${e.id}`} style={{ flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{e.title}</span>
                      <p className="text-footnote text-secondary" style={{ margin: 0 }}>{e.category}{e.source === 'BUDGET' ? ' · מהתקציב השנתי' : ''}</p>
                    </div>
                    <span className="row" style={{ flexWrap: 'wrap' }}>
                      <b>{e.expectedAmount != null ? formatILS(e.expectedAmount) : '—'}</b>
                      {e.handled ? <span className="badge badge--success">שולם</span> : (
                        <>
                          <button className="btn btn--primary btn--small" onClick={() => onPayExpected?.({ id: e.source === 'RECURRING' ? e.id : null, title: e.title, category: e.category, expectedAmount: e.expectedAmount })}>רישום תשלום</button>
                          {e.source === 'RECURRING' && !e.hasTask && <button className="btn btn--secondary btn--small" onClick={() => openTask(e)}>פתיחת משימה</button>}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {underLine && (
              <div className="alert alert--danger row"><TriangleAlert size={20} /> <span>אחרי ההוצאות הצפויות (ללא גבייה) הקופה תרד ל-{formatILS(projected)} - מתחת לקו האדום.</span></div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------ timeline pieces
function Kpi({ label, value, dot }) {
  return (
    <div className="tile">
      <span className="stat-label row">{dot && <span className={`dot dot--${dot}`} />}{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function EventCard({ item }) {
  const isTask = item.kind === 'TASK';
  const st = isTask ? STATUS[item.status] || STATUS.OPEN : null;
  const d = new Date(item.date);

  return (
    <div className="card card--tight" style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-grouped)' }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        {isTask ? <span className={`dot dot--${st.dot}`} style={{ marginTop: 6 }} /> : <Receipt size={14} style={{ marginTop: 3 }} color="var(--label-secondary)" />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="text-footnote" style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{item.title}</p>
          <p className="text-caption text-secondary row" style={{ margin: 0, flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            <span>{d.getDate()}.{d.getMonth() + 1}</span>
            {isTask && <span>· {st.label}</span>}
            {!isTask && item.amount !== undefined && <span>· {formatILS(item.amount)}</span>}
            {item.urgent && <span className="badge badge--danger" style={{ padding: '0 6px' }}>דחוף</span>}
            {item.scope === 'COMPLEX' && <Network size={11} />}
          </p>
        </div>
      </div>
    </div>
  );
}
