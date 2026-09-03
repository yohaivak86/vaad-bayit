import { useState } from 'react';
import { Building2, ChevronLeft, LogOut, Plus, X, Users2, Clock, Settings2, Lightbulb, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import ComplexesModal from './ComplexesModal';
import SiteSettingsModal from './SiteSettingsModal';
import SuggestionsAdminModal from './SuggestionsAdminModal';
import AdminControlCenterModal from './AdminControlCenterModal';

export default function BuildingSelector({ user, buildings, onSelect, onLogout, onBuildingsChanged }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showComplexes, setShowComplexes] = useState(false);
  const [showSiteSettings, setShowSiteSettings] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-extrabold text-lg text-slate-800">שלום, {user.name}</h1>
            <p className="text-xs text-slate-500">בחרו בניין לניהול</p>
          </div>
          <button onClick={onLogout} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="התנתקות">
            <LogOut size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {buildings.map((b) => {
            const isPending = b.status === 'PENDING';
            return (
              <button
                key={b.id}
                onClick={() => !isPending && onSelect(b.id)}
                disabled={isPending}
                className={`w-full flex items-center justify-between bg-white border rounded-xl px-4 py-3.5 transition ${
                  isPending ? 'border-amber-200 bg-amber-50 cursor-default' : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${isPending ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Building2 size={18} />
                  </div>
                  <div className="text-start">
                    <p className="font-semibold text-slate-800 text-sm">{b.name}</p>
                    {isPending ? (
                      <p className="text-xs text-amber-700 flex items-center gap-1"><Clock size={11} /> ממתין לאישור מנהל הבניין</p>
                    ) : (
                      <p className="text-xs text-slate-500">{b.address}</p>
                    )}
                  </div>
                </div>
                {!isPending && <ChevronLeft size={18} className="text-slate-300" />}
              </button>
            );
          })}
          {buildings.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">אין עדיין בניינים משויכים לחשבון</p>
          )}
        </div>

        {user.role === 'SUPER_ADMIN' && (
          <>
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-1.5 mt-3 border border-dashed border-slate-300 text-slate-500 rounded-xl py-3 text-sm font-medium hover:bg-white transition"
            >
              <Plus size={16} /> הוספת בניין חדש
            </button>
            <button
              onClick={() => setShowControlCenter(true)}
              className="w-full flex items-center justify-center gap-1.5 mt-2 text-slate-500 rounded-xl py-2.5 text-sm font-medium hover:bg-white transition"
            >
              <ShieldCheck size={16} /> מרכז ניהול (כל הבניינים והמשתמשים)
            </button>
            <button
              onClick={() => setShowSiteSettings(true)}
              className="w-full flex items-center justify-center gap-1.5 mt-2 text-slate-500 rounded-xl py-2.5 text-sm font-medium hover:bg-white transition"
            >
              <Settings2 size={16} /> הגדרות מערכת
            </button>
            <button
              onClick={() => setShowSuggestions(true)}
              className="w-full flex items-center justify-center gap-1.5 mt-2 text-slate-500 rounded-xl py-2.5 text-sm font-medium hover:bg-white transition"
            >
              <Lightbulb size={16} /> הצעות לשיפור
            </button>
          </>
        )}

        {buildings.length > 0 && (
          <button
            onClick={() => setShowComplexes(true)}
            className="w-full flex items-center justify-center gap-1.5 mt-2 text-slate-500 rounded-xl py-2.5 text-sm font-medium hover:bg-white transition"
          >
            <Users2 size={16} /> מתחמים (בניינים משותפים)
          </button>
        )}
      </div>

      {showCreate && (
        <CreateBuildingModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => { setShowCreate(false); await onBuildingsChanged(); }}
        />
      )}
      {showComplexes && (
        <ComplexesModal myBuildings={buildings} onClose={() => setShowComplexes(false)} />
      )}
      {showSiteSettings && (
        <SiteSettingsModal onClose={() => setShowSiteSettings(false)} />
      )}
      {showSuggestions && (
        <SuggestionsAdminModal onClose={() => setShowSuggestions(false)} />
      )}
      {showControlCenter && (
        <AdminControlCenterModal currentUserId={user.id} onClose={() => setShowControlCenter(false)} />
      )}
    </div>
  );
}

function CreateBuildingModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', address: '', adminEmail: '', adminName: '', adminPassword: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createBuilding(form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">בניין חדש</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">שם הבניין</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">כתובת</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className="input" />
          </div>
          <p className="text-xs text-slate-500 pt-1">פרטי חשבון האדמין של הבניין:</p>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">שם מלא</label>
            <input value={form.adminName} onChange={(e) => set('adminName', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">אימייל</label>
            <input type="email" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">סיסמה זמנית</label>
            <input type="password" value={form.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} className="input" required minLength={8} />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="pt-2 flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition">
              {saving ? 'יוצר...' : 'יצירת בניין'}
            </button>
            <button type="button" onClick={onClose} className="px-4 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
