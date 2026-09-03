import { useState } from 'react';
import { Lightbulb, X, PartyPopper } from 'lucide-react';
import { api } from '../api';

export default function SuggestionButton({ buildingId }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="no-print fixed bottom-20 sm:bottom-6 left-4 z-40 bg-amber-400 hover:bg-amber-500 text-amber-900 rounded-full p-3 shadow-lg transition"
        title="הצעה לשיפור"
      >
        <Lightbulb size={20} />
      </button>
      {showForm && <SuggestionFormModal buildingId={buildingId} onClose={() => setShowForm(false)} />}
    </>
  );
}

function SuggestionFormModal({ buildingId, onClose }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createSuggestion({ text, buildingId });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-1.5"><Lightbulb size={18} /> הצעה לשיפור</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-6 gap-3">
            <PartyPopper size={36} className="text-emerald-500" />
            <p className="font-semibold text-slate-800">תודה!</p>
            <p className="text-sm text-slate-500">ההצעה שלך נשלחה.</p>
            <button onClick={onClose} className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-2 text-sm transition">
              סגירה
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-4 space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input"
              rows={5}
              required
              placeholder="מה תרצו שנשפר או נוסיף במערכת?"
            />
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition">
              {saving ? 'שולח...' : 'שליחה'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
