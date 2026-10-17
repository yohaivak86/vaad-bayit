import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, ChevronLeft, Maximize2, Minimize2, Receipt, Network, CalendarClock, ShieldAlert, Pencil, Check, TriangleAlert, ListChecks, Banknote, ClipboardPlus,
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

// The main screen. Every number and card on it opens the screen behind it (`onNavigate(tab, params)`).
export default function TimelineDashboard({ buildingId, role, balance, complexName, onBalanceChanged, onNavigate, onPayExpected }) {
  const isCommittee = role === 'COMMITTEE';
  const now = new Date();

  return (
    <div className="page stack" style={{ maxWidth: 1600, gap: 'var(--space-6)' }}>
      {isCommittee && (
        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <BalanceCards balance={balance} onSelect={(paidFrom) => onNavigate('expenses', { view: 'movements', ...(paidFrom ? { paidFrom } : {}) })} />
          <RedLine buildingId={buildingId} balance={balance} onSaved={onBalanceChanged} />
        </section>
      )}

      <NextMonth buildingId={buildingId} isCommittee={isCommittee} balance={balance} onNavigate={onNavigate} onPayExpected={onPayExpected} />

      <Timeline buildingId={buildingId} isCommittee={isCommittee} complexName={complexName} onNavigate={onNavigate} startYear={now.getFullYear()} startMonth={now.getMonth() + 1} />
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
function NextMonth({ buildingId, isCommittee, balance, onNavigate, onPayExpected }) {
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
        <h2 className="row ellipsis" style={{ margin: 0, minWidth: 0 }}><CalendarClock size={22} className="shrink-0" /> <span className="ellipsis">בחודש הקרוב · {data.monthLabel} {data.year}</span></h2>
        {isCommittee && data.expectedTotal !== undefined && (
          <button className="chip chip--accent" onClick={() => onNavigate('expenses', { view: 'expected' })}>הוצאות צפויות: {formatILS(data.expectedTotal)}</button>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <h3 style={{ margin: 0 }}>משימות</h3>
          {data.tasks.length === 0 ? <p className="empty" style={{ padding: 'var(--space-3)' }}>אין משימות מתוזמנות לחודש הקרוב</p> : (
            <ul className="list" style={{ background: 'var(--bg-grouped)' }}>
              {data.tasks.map((t) => (
                <li key={t.id} className="is-link row-1" onClick={() => onNavigate('tasks', { filter: 'OPEN' })}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span className="ellipsis" style={{ fontWeight: 600, display: 'block' }}>{t.title}</span>
                    <p className="text-footnote text-secondary hide-mobile" style={{ margin: 0 }}>{new Date(t.date).getUTCDate()} ב{data.monthLabel}{t.scope === 'COMPLEX' ? ' · מתחם' : ''}</p>
                  </div>
                  <span className="row shrink-0" style={{ gap: 'var(--space-1)' }}>
                    <span className="text-footnote text-secondary nowrap">{new Date(t.date).getUTCDate()}.{data.month}</span>
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
                  <li key={`${e.source}-${e.id}`} className="is-link row-1" onClick={() => onNavigate('expenses', { view: 'expected' })}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span className="ellipsis" style={{ fontWeight: 600, display: 'block' }}>{e.title}</span>
                      <p className="text-footnote text-secondary hide-mobile" style={{ margin: 0 }}>{e.category}{e.source === 'BUDGET' ? ' · מהתקציב השנתי' : ''}</p>
                    </div>
                    <span className="row shrink-0" style={{ gap: 'var(--space-2)' }}>
                      <b className="nowrap">{e.expectedAmount != null ? formatILS(e.expectedAmount) : '—'}</b>
                      {e.handled ? <span className="badge badge--success">שולם</span> : (
                        <>
                          <button className="btn btn--primary btn--small btn-icon-mobile" aria-label="רישום תשלום" title="רישום תשלום" onClick={(ev) => { ev.stopPropagation(); onPayExpected?.({ id: e.source === 'RECURRING' ? e.id : null, title: e.title, category: e.category, expectedAmount: e.expectedAmount }); }}><Banknote size={16} /> <span className="hide-mobile">רישום תשלום</span></button>
                          {e.source === 'RECURRING' && !e.hasTask && <button className="btn btn--secondary btn--small btn-icon-mobile" aria-label="פתיחת משימה" title="פתיחת משימה" onClick={(ev) => { ev.stopPropagation(); openTask(e); }}><ClipboardPlus size={16} /> <span className="hide-mobile">פתיחת משימה</span></button>}
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

// ------------------------------------------------------------------------------ timeline
// Opens on the CURRENT month, with arrows to move between months; "השנה כולה" shows all twelve months side
// by side together with the yearly expense forecast (committee only).
function Timeline({ buildingId, isCommittee, complexName, onNavigate, startYear, startMonth }) {
  const [mode, setMode] = useState('month'); // month | year
  const [cursor, setCursor] = useState({ year: startYear, month: startMonth });
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [expected, setExpected] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef(null);
  const { year, month } = cursor;

  useEffect(() => {
    setData(null);
    api.getTimeline(buildingId, year).then(setData).catch(() => setData({ items: [] }));
    if (isCommittee) api.getForecast(buildingId, year).then(setForecast).catch(() => setForecast(null));
  }, [buildingId, year, isCommittee]);

  // expected costs of the month being looked at (committee only)
  useEffect(() => {
    if (!isCommittee || mode !== 'month') return;
    setExpected(null);
    api.getUpcomingMonth(buildingId, year, month).then(setExpected).catch(() => setExpected({ expenses: [] }));
  }, [buildingId, isCommittee, mode, year, month]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  };

  const stepMonth = (delta) => setCursor(({ year: y, month: m }) => {
    const idx = y * 12 + (m - 1) + delta;
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
  });

  const items = data?.items || [];
  const byMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, () => []);
    items.forEach((it) => months[new Date(it.date).getMonth()].push(it));
    return months;
  }, [items]);

  const tasks = items.filter((i) => i.kind === 'TASK');
  const open = tasks.filter((t) => t.status !== 'RESOLVED');
  const urgent = open.filter((t) => t.urgent);
  const resolved = tasks.filter((t) => t.status === 'RESOLVED');
  const currentMonth = year === startYear ? startMonth - 1 : -1;
  const fm = forecast?.months?.[month - 1];
  const openItem = (it) => (it.kind === 'TASK' ? onNavigate('tasks', { filter: 'ALL' }) : onNavigate('expenses', { view: 'movements' }));

  const title = mode === 'month' ? `${MONTHS_HE[month - 1]} ${year}` : `ציר זמן שנתי ${year}`;

  return (
    <section ref={stageRef} className={`card ${fullscreen ? 'presentation' : ''}`} style={fullscreen ? { overflow: 'auto', borderRadius: 0 } : undefined}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: fullscreen ? 34 : undefined }}>{title}</h2>
          <p className="page-sub" style={{ margin: 0 }}>{complexName ? `כולל משימות המתחם "${complexName}"` : 'משימות, תקלות והוצאות לאורך הזמן'}</p>
        </div>
        <div className="row no-print bar-1" style={{ flexWrap: 'wrap' }}>
          <div className="segmented">
            <button aria-pressed={mode === 'month'} onClick={() => setMode('month')}>חודש</button>
            <button aria-pressed={mode === 'year'} onClick={() => setMode('year')}>השנה כולה</button>
          </div>
          <button onClick={() => (mode === 'month' ? stepMonth(-1) : setCursor((c) => ({ ...c, year: c.year - 1 })))} className="icon-btn" aria-label={mode === 'month' ? 'החודש הקודם' : 'שנה קודמת'}><ChevronRight size={20} /></button>
          <button onClick={() => setCursor({ year: startYear, month: startMonth })} className="btn btn--secondary btn--small">{mode === 'month' ? 'החודש' : 'השנה'}</button>
          <button onClick={() => (mode === 'month' ? stepMonth(1) : setCursor((c) => ({ ...c, year: c.year + 1 })))} className="icon-btn" aria-label={mode === 'month' ? 'החודש הבא' : 'שנה הבאה'}><ChevronLeft size={20} /></button>
          <button onClick={toggleFullscreen} className="btn btn--secondary btn--small btn-icon-mobile" aria-label={fullscreen ? 'יציאה ממצב תצוגה' : 'מצב תצוגה'}>
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} <span className="hide-mobile">{fullscreen ? 'יציאה' : 'מצב תצוגה'}</span>
          </button>
        </div>
      </div>

      {!data && <p className="empty">טוען...</p>}

      {data && mode === 'month' && (
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          {isCommittee && fm && (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="tile tile--blue tile--click" onClick={() => onNavigate('expenses', { view: 'expected' })}>
                <span className="stat-label">מתוכנן ב{MONTHS_HE[month - 1]}</span><span className="stat-value stat-value--md">{formatILS(fm.planned)}</span>
              </button>
              <button type="button" className="tile tile--emerald tile--click" onClick={() => onNavigate('expenses', { view: 'movements' })}>
                <span className="stat-label">שולם בפועל</span><span className="stat-value stat-value--md">{formatILS(fm.actual)}</span>
              </button>
            </div>
          )}

          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <h3 style={{ margin: 0 }}>משימות והוצאות בציר</h3>
            {byMonth[month - 1].length === 0 ? <p className="empty" style={{ padding: 'var(--space-3)' }}>אין פריטים בציר הזמן של החודש. משימות והוצאות שסומנו "להצגה בציר הזמן" יופיעו כאן.</p> : (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-2)' }}>
                {byMonth[month - 1].map((it) => <EventCard key={`${it.kind}-${it.id}`} item={it} onClick={() => openItem(it)} />)}
              </div>
            )}
          </div>

          {isCommittee && expected?.expenses?.length > 0 && (
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <h3 style={{ margin: 0 }}>הוצאות צפויות החודש</h3>
              <ul className="list" style={{ background: 'var(--bg-grouped)' }}>
                {expected.expenses.map((e) => (
                  <li key={`${e.source}-${e.id}`} className="is-link" onClick={() => onNavigate('expenses', { view: 'expected' })}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{e.title}</span>
                      <p className="text-footnote text-secondary" style={{ margin: 0 }}>{e.category}{e.source === 'BUDGET' ? ' · מהתקציב השנתי' : ''}</p>
                    </div>
                    <span className="row"><b>{e.expectedAmount != null ? formatILS(e.expectedAmount) : '—'}</b>{e.handled && <span className="badge badge--success">שולם</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data && mode === 'year' && (
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi tone="rose" label="משימות פתוחות" value={open.length} onClick={() => onNavigate('tasks', { filter: 'OPEN' })} />
            <Kpi tone="amber" label="דחופות" value={urgent.length} onClick={() => onNavigate('tasks', { filter: 'URGENT' })} />
            <Kpi tone="emerald" label="הושלמו השנה" value={resolved.length} onClick={() => onNavigate('tasks', { filter: 'RESOLVED' })} />
            <Kpi tone="blue" label="פריטים בציר" value={items.length} onClick={() => onNavigate('tasks', { filter: 'ALL' })} />
          </div>

          <div className="overflow-x-auto" style={{ paddingBottom: 'var(--space-3)' }}>
            <div className="grid min-w-[1180px] grid-cols-12 gap-2" style={{ direction: 'rtl' }}>
              {MONTHS_HE.map((m, idx) => (
                <div key={m} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => { setCursor({ year, month: idx + 1 }); setMode('month'); }}
                    className={idx === currentMonth ? 'chip chip--accent' : 'chip'}
                    style={{ width: '100%', justifyContent: 'center', marginBottom: 'var(--space-2)', fontWeight: 600, cursor: 'pointer', ...(idx === currentMonth ? { background: 'var(--accent)', color: 'var(--on-accent)' } : null) }}
                    title={`מעבר לחודש ${m}`}
                  >
                    {m}{byMonth[idx].length > 0 ? ` · ${byMonth[idx].length}` : ''}
                  </button>
                  <div className="stack" style={{ gap: 'var(--space-2)' }}>
                    {byMonth[idx].map((it) => <EventCard key={`${it.kind}-${it.id}`} item={it} onClick={() => openItem(it)} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {items.length === 0 && <p className="empty">אין עדיין פריטים בציר הזמן של {year}. משימות והוצאות שסומנו "להצגה בציר הזמן" יופיעו כאן.</p>}

          {isCommittee && forecast && (
            <Forecast forecast={forecast} currentMonth={currentMonth} onPickMonth={(m) => { setCursor({ year, month: m }); setMode('month'); }} onOpenPlan={() => onNavigate('expenses', { view: 'expected' })} />
          )}
        </div>
      )}
    </section>
  );
}

// Planned vs. paid for every month of the year, plus the yearly totals.
function Forecast({ forecast, currentMonth, onPickMonth, onOpenPlan }) {
  const max = Math.max(1, ...forecast.months.map((m) => Math.max(m.planned, m.actual)));
  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h3 className="row" style={{ margin: 0 }}><ListChecks size={20} /> תחזית הוצאות שנתית {forecast.year}</h3>
        <button className="btn btn--secondary btn--small" onClick={onOpenPlan}>עריכת ההוצאות הצפויות</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="tile tile--blue"><span className="stat-label">מתוכנן לשנה</span><span className="stat-value stat-value--md">{formatILS(forecast.plannedTotal)}</span></div>
        <div className="tile tile--emerald"><span className="stat-label">שולם עד עכשיו</span><span className="stat-value stat-value--md">{formatILS(forecast.actualTotal)}</span></div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>חודש</th><th>מתוכנן</th><th>שולם בפועל</th><th style={{ width: '40%' }} /></tr></thead>
          <tbody>
            {forecast.months.map((m, i) => (
              <tr key={m.month} className="is-link" onClick={() => onPickMonth(m.month)} style={{ cursor: 'pointer', ...(i === currentMonth ? { background: 'var(--accent-tint)' } : null) }}>
                <td style={{ fontWeight: 600 }}>{MONTHS_HE[i]}</td>
                <td>{formatILS(m.planned)}</td>
                <td>{formatILS(m.actual)}</td>
                <td>
                  <div style={{ background: 'var(--fill-quiet)', borderRadius: 'var(--radius-pill)', height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${(m.planned / max) * 100}%`, height: '100%', background: 'var(--accent)', opacity: 0.35 }} />
                  </div>
                  <div style={{ marginTop: 3, background: 'var(--fill-quiet)', borderRadius: 'var(--radius-pill)', height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${(m.actual / max) * 100}%`, height: '100%', background: 'var(--accent)' }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-footnote text-secondary" style={{ margin: 0 }}>המתוכנן מחושב מההוצאות הצפויות (חודשיות, שנתיות וחד-פעמיות) ומהתקציב השנתי. לחצו על חודש כדי לראות אותו.</p>
    </div>
  );
}

function Kpi({ label, value, dot, tone = 'blue', onClick }) {
  return (
    <button type="button" className={`tile tile--${tone} tile--click`} onClick={onClick}>
      <span className="stat-label row">{dot && <span className={`dot dot--${dot}`} />}{label}</span>
      <span className="stat-value">{value}</span>
    </button>
  );
}

function EventCard({ item, onClick }) {
  const isTask = item.kind === 'TASK';
  const st = isTask ? STATUS[item.status] || STATUS.OPEN : null;
  const d = new Date(item.date);

  return (
    <button type="button" onClick={onClick} className="card card--tight tile--click" style={{ padding: 'var(--space-2) var(--space-3)', background: '#fff', textAlign: 'start', width: '100%', borderInlineStart: `5px solid ${isTask ? { danger: '#f43f5e', warning: '#f59e0b', success: '#10b981' }[st.dot] : '#94a3b8'}` }}>
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
    </button>
  );
}
