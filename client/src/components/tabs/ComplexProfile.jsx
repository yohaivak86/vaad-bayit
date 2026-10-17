import { useEffect, useState } from 'react';
import { Network, Plus, Trash2, AlertTriangle, Wallet, CalendarClock, X, Building2 } from 'lucide-react';
import { api } from '../../api';
import { TASK_STATUSES } from '../../constants';
import { formatDateHe } from '../../format';
import ServiceMap from '../ServiceMap';
import ProviderFormModal from '../ProviderFormModal';
import { ProviderDetails } from './BuildingProfile';

// Complex profile: open to everyone in a member building; only the complex owner / site admin
// can change it. The complex's own tasks live here - for small buildings (duplex/triplex) that is
// where most of the day-to-day work is.
export default function ComplexProfile({ complexId, currentBuildingId, canFinance, onOpenFinance }) {
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const load = async () => {
    setProfile(await api.getComplexProfile(complexId));
    setTasks(await api.getComplexTasks(complexId));
  };
  useEffect(() => { load(); }, [complexId]);

  if (!profile) return <p className="p-6 text-sm text-slate-500">טוען...</p>;

  const { complex, buildings, providers, canEdit } = profile;
  const selected = providers.find((p) => p.id === selectedId);
  const nameOf = (id) => buildings.find((b) => b.id === id)?.name;

  const updateStatus = async (task, status) => {
    await api.updateComplexTask(complexId, task.id, { status });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 lg:p-6">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="chip chip--accent" style={{ width: 52, height: 52, padding: 0, justifyContent: 'center' }}><Network size={26} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-extrabold text-slate-800">מתחם {complex.number} · {complex.name}</h2>
          <p className="text-sm text-slate-500">{complex.address ? complex.address + ' · ' : ''}{buildings.length} בניינים · מנהל המתחם: {complex.ownerName}</p>
        </div>
        {canFinance && (
          <button onClick={onOpenFinance} className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white">
            <Wallet size={16} /> ניהול כספי של המתחם
          </button>
        )}
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-base font-extrabold text-slate-800">הבניינים במתחם</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => (
            <div key={b.id} className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${b.id === currentBuildingId ? 'bg-blue-50 ring-blue-200' : 'bg-white ring-slate-200'}`}>
              <div className="rounded-xl bg-blue-100 p-2 text-blue-600"><Building2 size={18} /></div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{b.name}{b.id === currentBuildingId && ' (הבניין שלי)'}</p>
                <p className="truncate text-xs text-slate-500">{b.address || 'ללא כתובת'} · {b.apartmentsCount} דירות</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-800">נותני שירות וקשרים בין הבניינים</h3>
          {canEdit && (
            <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white">
              <Plus size={16} /> נותן שירות
            </button>
          )}
        </div>
        {providers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">עדיין לא הוגדרו נותני שירות למתחם</p>
        ) : (
          <div className="grid items-center gap-4 lg:grid-cols-[1.5fr_1fr]">
            <ServiceMap
              centerTitle={complex.name}
              centerSubtitle="מתחם"
              buildings={buildings}
              providers={providers}
              selectedId={selectedId}
              activeBuildingId={currentBuildingId}
              onSelectProvider={(id) => setSelectedId(id === selectedId ? null : id)}
            />
            <div>
              {selected ? (
                <ProviderDetails
                  provider={selected}
                  canEdit={canEdit}
                  onEdit={() => setEditing(selected)}
                  extra={
                    <p className="text-xs text-slate-500">
                      משרת: {selected.buildingIds.length ? selected.buildingIds.map(nameOf).filter(Boolean).join(' · ') : 'כל המתחם (לא שויך לבניינים ספציפיים)'}
                    </p>
                  }
                />
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">לחצו על בלון של נותן שירות כדי לראות אילו בניינים הוא משרת. קו מקווקו = משרת את כל המתחם.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">משימות המתחם</h3>
            <p className="text-xs text-slate-500">משימות משותפות לכל הבניינים - מופיעות בציר הזמן של כל בניין במתחם</p>
          </div>
          {canEdit && (
            <button onClick={() => setShowTaskForm(true)} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white">
              <Plus size={16} /> משימה
            </button>
          )}
        </div>
        <div className="space-y-2">
          {tasks?.map((t) => (
            <div key={t.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    {t.urgency === 'דחוף' && <AlertTriangle size={14} className="shrink-0 text-rose-500" />}
                    {t.title}
                  </p>
                  {t.description && <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>}
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    <CalendarClock size={11} /> {t.dueDate ? `יעד: ${formatDateHe(t.dueDate)}` : `נוצרה ${formatDateHe(t.createdAt)}`}
                    {t.location && ` · ${t.location}`}
                  </p>
                </div>
                {canEdit && (
                  <button onClick={async () => { await api.deleteComplexTask(complexId, t.id); await load(); }} className="p-1 text-slate-300 hover:text-rose-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TASK_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    disabled={!canEdit}
                    onClick={() => updateStatus(t, s.value)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium ${t.status === s.value ? s.color : 'bg-slate-50 text-slate-400'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {tasks?.length === 0 && <p className="py-6 text-center text-sm text-slate-400">אין עדיין משימות מתחמיות</p>}
        </div>
      </div>

      {editing && (
        <ProviderFormModal
          initial={editing === 'new' ? null : editing}
          buildings={buildings}
          onClose={() => setEditing(null)}
          onSave={async (form) => {
            if (editing === 'new') await api.createComplexProvider(complexId, form);
            else await api.updateComplexProvider(complexId, editing.id, form);
            setEditing(null);
            await load();
          }}
          onDelete={editing === 'new' ? undefined : async () => {
            await api.deleteComplexProvider(complexId, editing.id);
            setEditing(null);
            setSelectedId(null);
            await load();
          }}
        />
      )}
      {showTaskForm && (
        <ComplexTaskForm
          onClose={() => setShowTaskForm(false)}
          onSave={async (form) => {
            await api.createComplexTask(complexId, form);
            setShowTaskForm(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ComplexTaskForm({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', urgency: 'רגיל', dueDate: '', showOnTimeline: true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-800">משימה מתחמית</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form
          onSubmit={async (e) => { e.preventDefault(); setSaving(true); try { await onSave(form); } finally { setSaving(false); } }}
          className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">כותרת</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">תיאור</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="input" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">מיקום</label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)} className="input" placeholder="חניון, גינה..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">תאריך יעד</label>
              <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="input" />
            </div>
          </div>
          <div className="flex gap-2">
            {['רגיל', 'דחוף'].map((u) => (
              <button type="button" key={u} onClick={() => set('urgency', u)} className={`flex-1 rounded-xl border py-2 text-sm font-medium ${form.urgency === u ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600'}`}>
                {u}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.showOnTimeline} onChange={(e) => set('showOnTimeline', e.target.checked)} />
            להציג בציר הזמן השנתי
          </label>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'שומר...' : 'שמירה'}</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 text-sm text-slate-600">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
