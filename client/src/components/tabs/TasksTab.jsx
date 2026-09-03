import { useEffect, useState } from 'react';
import { Plus, X, MapPin, AlertTriangle, CheckSquare, Trash2 } from 'lucide-react';
import { api } from '../../api';
import { TASK_STATUSES, RECURRING_CHECKLIST } from '../../constants';
import { formatDateHe } from '../../format';

export default function TasksTab({ buildingId, readOnly }) {
  const [tasks, setTasks] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const load = async () => setTasks(await api.getTasks(buildingId));
  useEffect(() => { load(); }, [buildingId]);

  const updateStatus = async (task, status) => {
    await api.updateTask(buildingId, task.id, { status });
    await load();
  };

  const remove = async (task) => {
    await api.deleteTask(buildingId, task.id);
    await load();
  };

  const addRecurring = async (label) => {
    await api.createTask(buildingId, { title: label, isRecurring: true, recurrenceLabel: label, urgency: 'רגיל' });
    await load();
  };

  const filtered = tasks?.filter((t) => filter === 'ALL' || t.status === filter) || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-slate-800">משימות ותקלות פתוחות</h2>
        {!readOnly && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-3 py-2 transition"
          >
            <Plus size={16} /> תקלה / משימה חדשה
          </button>
        )}
      </div>

      <div className="flex gap-1.5 mb-3 flex-wrap">
        <FilterChip label="הכל" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        {TASK_STATUSES.map((s) => (
          <FilterChip key={s.value} label={s.label} active={filter === s.value} onClick={() => setFilter(s.value)} />
        ))}
      </div>

      {!readOnly && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <CheckSquare size={15} /> משימות תקופתיות קבועות
          </p>
          <div className="flex flex-wrap gap-1.5">
            {RECURRING_CHECKLIST.map((label) => (
              <button
                key={label}
                onClick={() => addRecurring(label)}
                className="text-xs border border-slate-200 rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-50"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!tasks && <p className="text-sm text-slate-500">טוען...</p>}
      <div className="space-y-2">
        {filtered.map((task) => (
          <TaskCard key={task.id} task={task} onStatusChange={updateStatus} onDelete={remove} readOnly={readOnly} />
        ))}
        {tasks && filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-8">אין משימות בסטטוס זה</p>}
      </div>

      {!readOnly && showForm && (
        <TaskFormModal
          onClose={() => setShowForm(false)}
          onSave={async (form) => { await api.createTask(buildingId, form); setShowForm(false); await load(); }}
        />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs rounded-full px-3 py-1.5 font-medium border transition ${
        active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

function TaskCard({ task, onStatusChange, onDelete, readOnly }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
            {task.urgency === 'דחוף' && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
            {task.title}
          </p>
          {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400 flex-wrap">
            {task.location && (
              <span className="flex items-center gap-0.5"><MapPin size={11} /> {task.location}</span>
            )}
            <span>{formatDateHe(task.createdAt)}</span>
            {task.isRecurring && <span className="text-blue-500">תקופתי</span>}
          </div>
        </div>
        {!readOnly && (
          <button onClick={() => onDelete(task)} className="p-1 text-slate-300 hover:text-red-500 shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        {TASK_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => !readOnly && onStatusChange(task, s.value)}
            disabled={readOnly}
            className={`text-[11px] rounded-md px-2 py-1 font-medium transition ${
              task.status === s.value ? s.color : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            } ${readOnly ? 'cursor-default' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskFormModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', urgency: 'רגיל', attachmentUrl: '' });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">דיווח תקלה / משימה</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">כותרת</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תיאור</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="input" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">מיקום</label>
            <input value={form.location} onChange={(e) => set('location', e.target.value)} className="input" placeholder="קומה 2, לובי, מעלית..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">דחיפות</label>
            <div className="flex gap-2">
              {['רגיל', 'דחוף'].map((u) => (
                <button
                  type="button"
                  key={u}
                  onClick={() => set('urgency', u)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                    form.urgency === u ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">קישור לתמונה / קבלה (אופציונלי)</label>
            <input value={form.attachmentUrl} onChange={(e) => set('attachmentUrl', e.target.value)} className="input" placeholder="https://..." />
          </div>
          <div className="pt-2 flex gap-2">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 text-sm transition">שמירה</button>
            <button type="button" onClick={onClose} className="px-4 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
