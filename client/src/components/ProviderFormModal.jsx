import { useState } from 'react';
import { X } from 'lucide-react';
import { PROVIDER_CATEGORIES } from '../constants';

// Add/edit a service provider. In a complex, `buildings` lists the member buildings so the
// provider can be linked to exactly the ones it serves (changeable at any time).
export default function ProviderFormModal({ initial, buildings, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    category: initial?.category || PROVIDER_CATEGORIES[0],
    phone: initial?.phone || '',
    email: initial?.email || '',
    notes: initial?.notes || '',
    buildingIds: initial?.buildingIds || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleBuilding = (id) =>
    set('buildingIds', form.buildingIds.includes(id) ? form.buildingIds.filter((b) => b !== id) : [...form.buildingIds, id]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-800">{initial ? 'עריכת נותן שירות' : 'נותן שירות חדש'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">שם</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">תחום</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input">
              {PROVIDER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">טלפון</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">אימייל</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">הערות</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input" rows={2} />
          </div>

          {buildings && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">הבניינים שמקבלים ממנו שירות</label>
              <div className="flex flex-wrap gap-2">
                {buildings.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => toggleBuilding(b.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      form.buildingIds.includes(b.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
                {buildings.length === 0 && <p className="text-xs text-slate-400">אין עדיין בניינים במתחם</p>}
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'שומר...' : 'שמירה'}
            </button>
            {onDelete && (
              <button type="button" onClick={onDelete} className="rounded-xl border border-red-200 px-4 text-sm text-red-600">מחיקה</button>
            )}
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 text-sm text-slate-600">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
