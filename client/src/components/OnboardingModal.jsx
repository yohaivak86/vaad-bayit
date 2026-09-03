import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const FIELD_DEFS = [
  { key: 'name', label: 'שם הבניין', type: 'text' },
  { key: 'address', label: 'כתובת', type: 'text' },
  { key: 'floors', label: 'מספר קומות', type: 'number' },
  { key: 'apartmentsCount', label: 'מספר דירות', type: 'number' },
  { key: 'monthlyFeeDefault', label: 'דמי ועד חודשיים לדירה (ברירת מחדל)', type: 'number' },
  { key: 'openingBalanceCash', label: 'יתרת פתיחה - מזומן', type: 'number' },
  { key: 'openingBalanceDigital', label: 'יתרת פתיחה - בנק/PayBox', type: 'number' },
  { key: 'openingBalanceDate', label: 'תאריך יתרת פתיחה', type: 'date' },
  { key: 'elevatorsCount', label: 'מספר מעליות', type: 'number' },
  { key: 'electricityBenchmark', label: 'עלות חשמל דו-חודשית משוערת', type: 'number' },
  { key: 'cleaningBenchmark', label: 'עלות ניקיון חודשית משוערת', type: 'number' },
  { key: 'gardeningBenchmark', label: 'עלות גינון חודשית משוערת', type: 'number' },
];

export default function OnboardingModal({ building, onClose, onSave }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (building) {
      setForm({
        ...building,
        openingBalanceDate: building.openingBalanceDate
          ? new Date(building.openingBalanceDate).toISOString().slice(0, 10)
          : '',
      });
    }
  }, [building]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">הגדרות בניין</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          {FIELD_DEFS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-600 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={form[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 text-sm transition"
            >
              שמירה
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-50"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
