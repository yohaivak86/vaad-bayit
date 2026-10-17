import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, ChevronLeft, Maximize2, Minimize2, AlertTriangle, CheckCircle2, Wrench, Hourglass, ClipboardList, Receipt, Network,
} from 'lucide-react';
import { api } from '../../api';
import { MONTHS_HE, formatILS } from '../../format';
import BalanceCards from '../BalanceCards';

const STATUS_STYLE = {
  OPEN: { label: 'פתוח', bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700', icon: AlertTriangle },
  IN_PROGRESS: { label: 'בטיפול', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700', icon: Hourglass },
  CONTRACTOR: { label: 'בעל מקצוע', bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700', icon: Wrench },
  RESOLVED: { label: 'הושלם', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
};

export default function TimelineDashboard({ buildingId, role, balance, complexName }) {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [data, setData] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const stageRef = useRef(null);

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
  const isCommittee = role === 'COMMITTEE';

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 pb-24 lg:p-6">
      {isCommittee && <BalanceCards balance={balance} />}

      <div ref={stageRef} className={`rounded-3xl p-4 lg:p-6 ${fullscreen ? 'presentation overflow-auto' : 'card'}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={`text-xl font-extrabold ${fullscreen ? 'text-white text-3xl' : 'text-slate-800'}`}>
              ציר זמן שנתי {year}
            </h2>
            <p className={`text-xs ${fullscreen ? 'text-blue-200 text-base' : 'text-slate-500'}`}>
              {complexName ? `כולל משימות המתחם "${complexName}"` : 'משימות, תקלות והוצאות מרכזיות לאורך השנה'}
            </p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button onClick={() => setYear((y) => y - 1)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm"><ChevronRight size={18} /></button>
            <span className={`min-w-[3.5rem] text-center text-lg font-bold ${fullscreen ? 'text-white' : 'text-slate-700'}`}>{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm"><ChevronLeft size={18} /></button>
            <button onClick={toggleFullscreen} className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white">
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {fullscreen ? 'יציאה' : 'מצב תצוגה'}
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="משימות פתוחות" value={open.length} tone="rose" dark={fullscreen} />
          <Kpi label="דחופות" value={urgent.length} tone="amber" dark={fullscreen} />
          <Kpi label="הושלמו השנה" value={resolved.length} tone="emerald" dark={fullscreen} />
          <Kpi label="פריטים בציר" value={items.length} tone="blue" dark={fullscreen} />
        </div>

        {!data && <p className={`py-10 text-center text-sm ${fullscreen ? 'text-blue-200' : 'text-slate-400'}`}>טוען...</p>}

        {data && (
          <div className="overflow-x-auto pb-3">
            <div className="relative grid min-w-[1180px] grid-cols-12 gap-2" style={{ direction: 'rtl' }}>
              <div className="pointer-events-none absolute inset-x-2 top-[2.1rem] h-1 rounded-full bg-gradient-to-l from-blue-500 via-violet-500 to-emerald-500 opacity-70" />
              {MONTHS_HE.map((m, idx) => (
                <div key={m} className="min-w-0">
                  <div
                    className={`relative mb-3 rounded-xl px-2 py-1.5 text-center text-sm font-bold ${
                      idx === currentMonth
                        ? 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-500/25'
                        : fullscreen ? 'bg-white/10 text-white' : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200'
                    }`}
                  >
                    {m}
                    {byMonth[idx].length > 0 && (
                      <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {byMonth[idx].length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {byMonth[idx].map((it) => <EventCard key={`${it.kind}-${it.id}`} item={it} dark={fullscreen} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data && items.length === 0 && (
          <p className={`py-6 text-center text-sm ${fullscreen ? 'text-blue-200' : 'text-slate-400'}`}>
            אין עדיין פריטים בציר הזמן של {year}. משימות והוצאות שסומנו "להצגה בציר הזמן" יופיעו כאן.
          </p>
        )}

        {urgent.length > 0 && (
          <div className="mt-5">
            <h3 className={`mb-2 flex items-center gap-1.5 text-sm font-bold ${fullscreen ? 'text-amber-300' : 'text-amber-700'}`}>
              <AlertTriangle size={16} /> תקלות ומשימות מרכזיות פתוחות
            </h3>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {urgent.map((t) => <EventCard key={`u-${t.id}`} item={t} dark={fullscreen} wide />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, dark }) {
  const tones = {
    rose: 'from-rose-500/90 to-rose-600',
    amber: 'from-amber-400 to-orange-500',
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-indigo-600',
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${tones[tone]} p-3 text-white shadow-md ${dark ? 'p-4' : ''}`}>
      <p className="text-xs font-semibold text-white/85">{label}</p>
      <p className={`font-extrabold ${dark ? 'text-4xl' : 'text-2xl'}`}>{value}</p>
    </div>
  );
}

function EventCard({ item, dark, wide }) {
  const isTask = item.kind === 'TASK';
  const st = isTask ? STATUS_STYLE[item.status] || STATUS_STYLE.OPEN : null;
  const Icon = isTask ? st.icon : Receipt;
  const day = new Date(item.date).getDate();
  const bar = isTask ? st.bar : 'bg-slate-400';

  return (
    <div
      className={`card-lift relative overflow-hidden rounded-xl ps-3 pe-2.5 py-2 text-start ${
        dark ? 'bg-white/10 text-white ring-1 ring-white/15' : 'bg-white shadow-sm ring-1 ring-slate-200'
      } ${wide ? 'p-3' : ''}`}
    >
      <span className={`absolute inset-y-0 right-0 w-1.5 ${bar}`} />
      <div className="flex items-start gap-2 pr-1.5">
        <Icon size={15} className={`mt-0.5 shrink-0 ${dark ? 'text-blue-200' : 'text-slate-500'}`} />
        <div className="min-w-0 flex-1">
          <p className={`break-words text-[13px] font-bold leading-snug ${dark ? 'text-white' : 'text-slate-800'}`}>{item.title}</p>
          <div className={`mt-1 flex flex-wrap items-center gap-1 text-[10px] ${dark ? 'text-blue-200' : 'text-slate-500'}`}>
            <span className="font-semibold">{day}.{new Date(item.date).getMonth() + 1}</span>
            {isTask && <span className={`rounded-full px-1.5 py-0.5 font-semibold ${st.chip}`}>{st.label}</span>}
            {!isTask && item.amount !== undefined && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">{formatILS(item.amount)}</span>}
            {item.urgent && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700">דחוף</span>}
            {item.scope === 'COMPLEX' && (
              <span className="flex items-center gap-0.5 rounded-full bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700">
                <Network size={9} /> מתחם
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
