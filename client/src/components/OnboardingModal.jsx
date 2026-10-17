import { useState, useEffect } from 'react';
import { Network } from 'lucide-react';
import ComplexPicker from './ComplexPicker';
import Sheet from './Sheet';

const FIELD_DEFS = [
  { key: 'name', label: 'שם הבניין', type: 'text' },
  { key: 'address', label: 'כתובת', type: 'text' },
  { key: 'floors', label: 'מספר קומות', type: 'number' },
  { key: 'apartmentsCount', label: 'מספר דירות', type: 'number' },
  { key: 'monthlyFeeDefault', label: 'דמי ועד חודשיים לדירה (ברירת מחדל)', type: 'number' },
  { key: 'openingBalanceCash', label: 'יתרת פתיחה - מזומן', type: 'number' },
  { key: 'openingBalanceBank', label: 'יתרת פתיחה - בנק', type: 'number' },
  { key: 'openingBalancePaybox', label: 'יתרת פתיחה - PayBox', type: 'number' },
  { key: 'openingBalanceDate', label: 'תאריך יתרת פתיחה', type: 'date' },
  { key: 'elevatorsCount', label: 'מספר מעליות', type: 'number' },
  { key: 'electricityBenchmark', label: 'עלות חשמל דו-חודשית משוערת', type: 'number' },
  { key: 'cleaningBenchmark', label: 'עלות ניקיון חודשית משוערת', type: 'number' },
  { key: 'gardeningBenchmark', label: 'עלות גינון חודשית משוערת', type: 'number' },
];

// Building settings. The "join a complex" option sits right here so it is easy to find: search for the
// complex (number / name / address / code), send the request, and the complex's manager approves.
export default function OnboardingModal({ building, buildingId, complex, onClose, onSave, onComplexChanged }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (building) {
      setForm({
        ...building,
        openingBalanceDate: building.openingBalanceDate ? new Date(building.openingBalanceDate).toISOString().slice(0, 10) : '',
      });
    }
  }, [building]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Sheet title="הגדרות בניין" onClose={onClose}>
      <div className="stack" style={{ gap: 'var(--space-6)' }}>
        <section className="stack" style={{ gap: 'var(--space-3)' }}>
          <h3 className="row" style={{ margin: 0 }}><Network size={20} /> שיוך למתחם</h3>
          {complex ? (
            <p className="text-footnote text-secondary" style={{ margin: 0 }}>הבניין משתייך למתחם {complex.number} · {complex.name}. להסרה מהמתחם: פרופיל בניין.</p>
          ) : buildingId ? (
            <>
              <p className="text-footnote text-secondary" style={{ margin: 0 }}>הבניין בודד כרגע. חפשו מתחם לפי מספר, שם, כתובת או קוד, ושלחו בקשת הצטרפות - מנהל המתחם יאשר.</p>
              <ComplexPicker buildingId={buildingId} onChanged={onComplexChanged} />
            </>
          ) : null}
        </section>

        <form onSubmit={handleSubmit} className="stack">
          {FIELD_DEFS.map((f) => (
            <div key={f.key} className="field">
              <label>{f.label}</label>
              <input type={f.type} value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} className="input" step={f.type === 'number' ? 'any' : undefined} />
            </div>
          ))}
          <button type="submit" className="btn btn--primary">שמירה</button>
        </form>
      </div>
    </Sheet>
  );
}
