import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Maximize2, Minimize2, Printer, Repeat, CheckCircle2, Network, Eye, EyeOff } from 'lucide-react';
import { api } from '../../api';
import { MONTHS_HE, formatILS } from '../../format';

// The year as a real timeline: a line running through the twelve months, a marker for today, and under every
// month what is expected in it - planned costs (expected items + annual budget) and dated tasks. Built to be
// put on a screen for all residents ("מצב תצוגה" = full screen). The committee decides whether residents also
// see the amounts.
const STATUS_COLOR = { OPEN: '#f43f5e', IN_PROGRESS: '#f59e0b', CONTRACTOR: '#f59e0b', RESOLVED: '#10b981' };
const STATUS_LABEL = { OPEN: 'פתוח', IN_PROGRESS: 'בטיפול', CONTRACTOR: 'בעל מקצוע', RESOLVED: 'הושלם' };
const SOURCE_COLOR = { RECURRING: '#3b82f6', BUDGET: '#8b5cf6' };

export default function YearTimeline({ buildingId }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef(null);

  const load = useCallback(() => {
    setPlan(null);
    api.getYearPlan(buildingId, year).then(setPlan).catch((e) => setError(e.message));
  }, [buildingId, year]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  };

  const toggleAmounts = async (value) => {
    await api.setTimelineSettings(buildingId, value);
    load();
  };

  // where "today" sits along the year, as a percentage (only when looking at the current year)
  const todayPct = useMemo(() => {
    if (year !== now.getFullYear()) return null;
    const dim = new Date(year, now.getMonth() + 1, 0).getDate();
    return ((now.getMonth() + (now.getDate() - 1) / dim) / 12) * 100;
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentMonth = year === now.getFullYear() ? now.getMonth() : -1;

  return (
    <div className="page stack" style={{ maxWidth: 1800, gap: 'var(--space-4)' }}>
      <section ref={stageRef} className={`card ${fullscreen ? 'presentation tl-presentation' : ''}`} style={fullscreen ? { overflow: 'auto', borderRadius: 0, padding: 'var(--space-6)' } : undefined}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: fullscreen ? 40 : undefined }}>ההוצאות הצפויות ב-{year}</h2>
            <p className="page-sub" style={{ margin: 0 }}>
              מה מתוכנן בכל חודש בבניין{plan?.showAmounts && plan.yearTotal !== undefined ? ` · סה"כ מתוכנן לשנה: ${formatILS(plan.yearTotal)}` : ''}
            </p>
          </div>
          <div className="row no-print" style={{ flexWrap: 'wrap' }}>
            <button onClick={() => setYear((y) => y - 1)} className="icon-btn" aria-label="שנה קודמת"><ChevronRight size={20} /></button>
            <span style={{ minWidth: 48, textAlign: 'center', font: 'var(--text-headline)' }}>{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="icon-btn" aria-label="שנה הבאה"><ChevronLeft size={20} /></button>
            <button onClick={toggleFullscreen} className="btn btn--primary btn--small">
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {fullscreen ? 'יציאה ממצב תצוגה' : 'מצב תצוגה למסך'}
            </button>
            <button onClick={() => window.print()} className="btn btn--secondary btn--small"><Printer size={16} /> הדפסה</button>
          </div>
        </div>

        {plan?.canEditSettings && !fullscreen && (
          <label className="row text-footnote no-print" style={{ marginBottom: 'var(--space-3)' }}>
            <input type="checkbox" checked={plan.settings.showAmountsToResidents} onChange={(e) => toggleAmounts(e.target.checked)} />
            {plan.settings.showAmountsToResidents ? <Eye size={16} /> : <EyeOff size={16} />}
            להציג את הסכומים גם לדיירים (בלי הסימון, הדיירים רואים רק מה מתוכנן ומתי)
          </label>
        )}

        <Legend showAmounts={plan?.showAmounts} />

        {error && <div className="alert alert--danger">{error}</div>}
        {!plan && !error && <p className="empty">טוען...</p>}

        {plan && (
          <div className="tl-wrap">
            <div className="tl" style={todayPct !== null ? { '--today': `${todayPct}%` } : undefined}>
              <div className="tl-line" />
              {todayPct !== null && <div className="tl-today"><span>היום</span></div>}
              {plan.months.map((m, i) => (
                <MonthColumn key={m.month} month={m} current={i === currentMonth} showAmounts={plan.showAmounts} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Legend({ showAmounts }) {
  const dot = (color, label) => <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: color }} />{label}</span>;
  return (
    <div className="row text-footnote text-secondary" style={{ flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
      {dot(SOURCE_COLOR.RECURRING, 'הוצאה צפויה')}
      {dot(SOURCE_COLOR.BUDGET, 'מהתקציב השנתי')}
      {dot('#10b981', 'שולם / הושלם')}
      {dot('#f43f5e', 'משימה פתוחה')}
      {dot('#f59e0b', 'משימה בטיפול')}
      {showAmounts === false && <span>(הסכומים מוסתרים)</span>}
    </div>
  );
}

function MonthColumn({ month, current, showAmounts }) {
  const monthly = month.items.filter((i) => i.kind === 'EXPENSE' && i.source === 'RECURRING' && i.frequency === 'MONTHLY');
  const others = month.items.filter((i) => !(i.kind === 'EXPENSE' && i.source === 'RECURRING' && i.frequency === 'MONTHLY'));
  const monthlyTotal = monthly.reduce((s, i) => s + (i.amount || 0), 0);
  const allPaid = monthly.length > 0 && monthly.every((i) => i.paid);

  return (
    <div className="tl-col">
      <div className="tl-node">
        <span className={`tl-month ${current ? 'tl-month--now' : ''}`}>{MONTHS_HE[month.month - 1]}</span>
        {showAmounts && month.plannedTotal > 0 && <span className="tl-total">{formatILS(month.plannedTotal)}</span>}
      </div>

      {monthly.length > 0 && (
        <div className="tl-card" style={{ '--c': allPaid ? '#10b981' : SOURCE_COLOR.RECURRING }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
            <b className="row" style={{ gap: 4 }}><Repeat size={13} /> חודשיות קבועות</b>
            {allPaid && <CheckCircle2 size={15} color="#10b981" />}
          </div>
          {monthly.map((i) => (
            <div key={i.key} className="tl-line-item">
              <span>{i.title}{i.paid ? ' · שולם' : ''}</span>
              {showAmounts && i.amount != null && <span>{formatILS(i.amount)}</span>}
            </div>
          ))}
          {showAmounts && monthly.length > 1 && <div className="tl-line-item tl-line-item--sum"><span>סה"כ</span><span>{formatILS(monthlyTotal)}</span></div>}
        </div>
      )}

      {others.map((i) => (i.kind === 'TASK' ? <TaskCard key={i.key} item={i} /> : <ExpenseCard key={i.key} item={i} showAmounts={showAmounts} />))}
    </div>
  );
}

function ExpenseCard({ item, showAmounts }) {
  const color = item.paid ? '#10b981' : SOURCE_COLOR[item.source] || '#3b82f6';
  return (
    <div className="tl-card" style={{ '--c': color }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <b>{item.title}</b>
        {item.paid && <CheckCircle2 size={15} color="#10b981" />}
      </div>
      <div className="text-caption tl-meta">
        {item.day ? `${item.day} בחודש · ` : ''}{item.category}{item.source === 'BUDGET' ? ' · תקציב שנתי' : ''}
      </div>
      {showAmounts && item.amount != null && <div className="tl-amount">{formatILS(item.amount)}</div>}
    </div>
  );
}

function TaskCard({ item }) {
  return (
    <div className="tl-card" style={{ '--c': STATUS_COLOR[item.status] || '#f43f5e' }}>
      <b>{item.title}</b>
      <div className="text-caption tl-meta row" style={{ flexWrap: 'wrap', gap: 4 }}>
        <span>משימה · {item.day} בחודש · {STATUS_LABEL[item.status] || item.status}</span>
        {item.urgent && <span className="badge badge--danger" style={{ padding: '0 6px' }}>דחוף</span>}
        {item.scope === 'COMPLEX' && <Network size={11} />}
      </div>
    </div>
  );
}
