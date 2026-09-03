import { useEffect, useState } from 'react';
import { Plus, X, Trash2, FileText, ClipboardCheck, Link as LinkIcon } from 'lucide-react';
import { api } from '../../api';
import { formatDateHe } from '../../format';

export default function DocumentsTab({ buildingId, readOnly }) {
  const [minutes, setMinutes] = useState(null);
  const [procedures, setProcedures] = useState(null);
  const [showMinutesForm, setShowMinutesForm] = useState(false);
  const [showProcedureForm, setShowProcedureForm] = useState(false);

  const loadMinutes = async () => setMinutes(await api.getMinutes(buildingId));
  const loadProcedures = async () => setProcedures(await api.getProcedures(buildingId));

  useEffect(() => { loadMinutes(); loadProcedures(); }, [buildingId]);

  const removeMinutes = async (id) => { await api.deleteMinutes(buildingId, id); await loadMinutes(); };
  const removeProcedure = async (id) => { await api.deleteProcedure(buildingId, id); await loadProcedures(); };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-6 space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800 flex items-center gap-1.5"><ClipboardCheck size={17} /> סיכומי ישיבות ועד</h2>
          {!readOnly && (
            <button
              onClick={() => setShowMinutesForm(true)}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-3 py-2 transition"
            >
              <Plus size={16} /> העלאת סיכום
            </button>
          )}
        </div>
        <div className="space-y-2">
          {minutes === null && <p className="text-sm text-slate-500">טוען...</p>}
          {minutes?.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{m.title}</p>
                  <p className="text-xs text-slate-400">{formatDateHe(m.date)}</p>
                </div>
                {!readOnly && (
                  <button onClick={() => removeMinutes(m.id)} className="p-1 text-slate-300 hover:text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {m.content && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{m.content}</p>}
              {m.attachmentUrl && (
                <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 mt-2 hover:underline">
                  <LinkIcon size={12} /> קובץ מצורף
                </a>
              )}
            </div>
          ))}
          {minutes?.length === 0 && <p className="text-sm text-slate-400 text-center py-6">אין עדיין סיכומי ישיבות</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800 flex items-center gap-1.5"><FileText size={17} /> נהלים</h2>
          {!readOnly && (
            <button
              onClick={() => setShowProcedureForm(true)}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-3 py-2 transition"
            >
              <Plus size={16} /> נוהל חדש
            </button>
          )}
        </div>
        <div className="space-y-2">
          {procedures === null && <p className="text-sm text-slate-500">טוען...</p>}
          {procedures?.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-800 text-sm">{p.title}</p>
                {!readOnly && (
                  <button onClick={() => removeProcedure(p.id)} className="p-1 text-slate-300 hover:text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {p.content && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{p.content}</p>}
              {p.attachmentUrl && (
                <a href={p.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 mt-2 hover:underline">
                  <LinkIcon size={12} /> קובץ מצורף
                </a>
              )}
            </div>
          ))}
          {procedures?.length === 0 && <p className="text-sm text-slate-400 text-center py-6">לא הוגדרו עדיין נהלים</p>}
        </div>
      </section>

      {showMinutesForm && (
        <MinutesFormModal
          onClose={() => setShowMinutesForm(false)}
          onSave={async (form) => { await api.createMinutes(buildingId, form); setShowMinutesForm(false); await loadMinutes(); }}
        />
      )}
      {showProcedureForm && (
        <ProcedureFormModal
          onClose={() => setShowProcedureForm(false)}
          onSave={async (form) => { await api.createProcedure(buildingId, form); setShowProcedureForm(false); await loadProcedures(); }}
        />
      )}
    </div>
  );
}

function MinutesFormModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().slice(0, 10), content: '', attachmentUrl: '' });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">סיכום ישיבה חדש</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">כותרת</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} className="input" required placeholder='לדוגמה: ישיבת ועד - ינואר 2026' />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תאריך הישיבה</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תוכן הסיכום</label>
            <textarea value={form.content} onChange={(e) => set('content', e.target.value)} className="input" rows={5} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">קישור לקובץ (אופציונלי)</label>
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

function ProcedureFormModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', content: '', attachmentUrl: '' });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">נוהל חדש</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">כותרת</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} className="input" required placeholder='לדוגמה: נוהל דיווח תקלות' />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תוכן</label>
            <textarea value={form.content} onChange={(e) => set('content', e.target.value)} className="input" rows={5} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">קישור לקובץ (אופציונלי)</label>
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
