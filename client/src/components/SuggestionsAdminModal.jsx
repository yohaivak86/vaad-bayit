import { useEffect, useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { api } from '../api';
import { formatDateHe } from '../format';

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'חדש', color: 'bg-amber-100 text-amber-700' },
  { value: 'IN_PROGRESS', label: 'בביצוע', color: 'bg-blue-100 text-blue-700' },
  { value: 'DONE', label: 'בוצע', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'REJECTED', label: 'נדחה', color: 'bg-slate-100 text-slate-500' },
];

export default function SuggestionsAdminModal({ onClose }) {
  const [suggestions, setSuggestions] = useState(null);

  const load = async () => setSuggestions(await api.getSuggestions());
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await api.updateSuggestion(id, { status });
    await load();
  };

  const updateNotes = async (id, adminNotes) => {
    await api.updateSuggestion(id, { adminNotes });
    await load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-1.5"><Lightbulb size={18} /> הצעות לשיפור</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-3">
          {suggestions === null && <p className="text-sm text-slate-500">טוען...</p>}
          {suggestions?.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} onUpdateStatus={updateStatus} onUpdateNotes={updateNotes} />
          ))}
          {suggestions?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">אין עדיין הצעות</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestionRow({ suggestion, onUpdateStatus, onUpdateNotes }) {
  const [notes, setNotes] = useState(suggestion.adminNotes || '');

  return (
    <div className="border border-slate-200 rounded-xl px-3 py-3">
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{suggestion.text}</p>
      <p className="text-[11px] text-slate-400 mt-1.5">
        {suggestion.user?.name || 'משתמש לא ידוע'} ({suggestion.user?.email || '—'})
        {suggestion.building && ` · ${suggestion.building.name}`}
        {' · '}{formatDateHe(suggestion.createdAt)}
      </p>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onUpdateStatus(suggestion.id, opt.value)}
            className={`text-[11px] rounded-md px-2 py-1 font-medium transition ${
              suggestion.status === opt.value ? opt.color : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (suggestion.adminNotes || '') && onUpdateNotes(suggestion.id, notes)}
          className="input text-xs"
          placeholder="הערה פנימית..."
        />
      </div>
    </div>
  );
}
