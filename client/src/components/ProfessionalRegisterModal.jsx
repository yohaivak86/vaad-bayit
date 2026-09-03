import { useState } from 'react';
import { X, Wrench, PartyPopper } from 'lucide-react';
import { api } from '../api';
import { PROFESSION_CATEGORIES } from '../constants';

export default function ProfessionalRegisterModal({ onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', profession: PROFESSION_CATEGORIES[0], message: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.registerProfessional(form);
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
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-1.5"><Wrench size={18} /> הרשמת בעל מקצוע</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-6 gap-3">
            <PartyPopper size={36} className="text-emerald-500" />
            <p className="font-semibold text-slate-800">תודה על ההרשמה!</p>
            <p className="text-sm text-slate-500">הפרטים נקלטו במערכת - ניצור קשר בהקדם לגבי מסלולי ההצטרפות.</p>
            <button onClick={onClose} className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-2 text-sm transition">
              סגירה
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-4 space-y-3">
            <p className="text-xs text-slate-500">
              רישום בעלי מקצוע לספריית ספקים שוועדי בית באפליקציה יוכלו לפנות אליה. בהמשך ייפתחו מסלולי הצטרפות.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">שם / שם העסק</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">תחום עיסוק</label>
              <select value={form.profession} onChange={(e) => set('profession', e.target.value)} className="input">
                {PROFESSION_CATEGORIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">טלפון</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" required placeholder="050-1234567" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">אימייל (אופציונלי)</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">כמה מילים על השירות (אופציונלי)</label>
              <textarea value={form.message} onChange={(e) => set('message', e.target.value)} className="input" rows={3} />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition">
              {saving ? 'שולח...' : 'שליחת הרשמה'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
