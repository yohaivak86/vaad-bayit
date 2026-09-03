import { useEffect, useState } from 'react';
import { X, Plus, Users2, LogIn } from 'lucide-react';
import { api } from '../api';
import ComplexDetailModal from './ComplexDetailModal';

export default function ComplexesModal({ myBuildings, onClose }) {
  const [complexes, setComplexes] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const load = async () => setComplexes(await api.getMyComplexes());
  useEffect(() => { load(); }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-1.5"><Users2 size={18} /> מתחמים</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-2">
          {complexes === null && <p className="text-sm text-slate-500">טוען...</p>}
          {complexes?.map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenId(c.id)}
              className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-3 py-3 hover:border-blue-300 hover:shadow-sm transition text-start"
            >
              <div>
                <p className="font-semibold text-sm text-slate-800">{c.name}</p>
                <p className="text-xs text-slate-500">{c.members.length} בניינים · בעלים: {c.ownerName}</p>
              </div>
            </button>
          ))}
          {complexes?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">אין עדיין מתחמים - אפשר ליצור אחד חדש או להצטרף לקיים</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg py-2.5 transition"
          >
            <Plus size={16} /> מתחם חדש
          </button>
          <button
            onClick={() => setShowJoin(true)}
            className="flex-1 flex items-center justify-center gap-1.5 border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2.5 hover:bg-slate-50 transition"
          >
            <LogIn size={16} /> הצטרפות
          </button>
        </div>
      </div>

      {openId && (
        <ComplexDetailModal complexId={openId} onClose={() => setOpenId(null)} onChanged={load} />
      )}
      {showCreate && (
        <CreateComplexModal
          onClose={() => setShowCreate(false)}
          onCreated={async (id) => { setShowCreate(false); await load(); setOpenId(id); }}
        />
      )}
      {showJoin && (
        <JoinComplexModal
          myBuildings={myBuildings}
          onClose={() => setShowJoin(false)}
          onJoined={async () => { setShowJoin(false); await load(); }}
        />
      )}
    </div>
  );
}

function CreateComplexModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const complex = await api.createComplex({ name });
      onCreated(complex.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">מתחם חדש</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">שם המתחם</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" required placeholder="לדוגמה: מתחם נחל דליות" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition">
            {saving ? 'יוצר...' : 'יצירה'}
          </button>
        </form>
      </div>
    </div>
  );
}

function JoinComplexModal({ myBuildings, onClose, onJoined }) {
  const [buildingId, setBuildingId] = useState(myBuildings?.[0]?.id || '');
  const [inviteCode, setInviteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.joinComplex({ buildingId: Number(buildingId), inviteCode });
      onJoined();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">הצטרפות למתחם</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">איזה בניין מצטרף?</label>
            <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="input" required>
              {myBuildings?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">קוד הזמנה למתחם</label>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="input font-mono tracking-widest text-center"
              required
              placeholder="ABCD1234"
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition">
            {saving ? 'מצטרף...' : 'הצטרפות'}
          </button>
        </form>
      </div>
    </div>
  );
}
