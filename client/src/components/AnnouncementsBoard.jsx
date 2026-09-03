import { useEffect, useState } from 'react';
import { Megaphone, Plus, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api';
import { formatDateHe } from '../format';

export default function AnnouncementsBoard({ buildingId, readOnly }) {
  const [announcements, setAnnouncements] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = async () => setAnnouncements(await api.getAnnouncements(buildingId));
  useEffect(() => { load(); }, [buildingId]);

  const remove = async (id) => {
    await api.deleteAnnouncement(buildingId, id);
    await load();
  };

  if (!announcements) return null;
  if (announcements.length === 0 && readOnly) return null;

  const visible = expanded ? announcements : announcements.slice(0, 1);

  return (
    <div className="no-print border-b border-slate-200 bg-amber-50/60">
      <div className="max-w-6xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-sm">
            <Megaphone size={16} />
            הודעות ({announcements.length})
          </div>
          <div className="flex items-center gap-1">
            {!readOnly && (
              <button onClick={() => setShowForm(true)} className="p-1 text-amber-700 hover:bg-amber-100 rounded-md">
                <Plus size={16} />
              </button>
            )}
            {announcements.length > 1 && (
              <button onClick={() => setExpanded((e) => !e)} className="p-1 text-amber-700 hover:bg-amber-100 rounded-md">
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>
        </div>

        {announcements.length === 0 && (
          <p className="text-xs text-amber-700 mt-1">אין הודעות כרגע</p>
        )}

        <div className="space-y-1.5 mt-1.5">
          {visible.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 bg-white/70 rounded-lg px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                {a.body && <p className="text-xs text-slate-600 mt-0.5">{a.body}</p>}
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDateHe(a.createdAt)}</p>
              </div>
              {!readOnly && (
                <button onClick={() => remove(a.id)} className="p-1 text-slate-300 hover:text-red-500 shrink-0">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <AnnouncementFormModal
          onClose={() => setShowForm(false)}
          onSave={async (form) => { await api.createAnnouncement(buildingId, form); setShowForm(false); await load(); }}
        />
      )}
    </div>
  );
}

function AnnouncementFormModal({ onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ title, body });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">הודעה חדשה</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">כותרת</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required placeholder='לדוגמה: ניקוי מאגר מים ביום שלישי' />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">פירוט (אופציונלי)</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className="input" rows={3} />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition">
            {saving ? 'מפרסם...' : 'פרסום'}
          </button>
        </form>
      </div>
    </div>
  );
}
