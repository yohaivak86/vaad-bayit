import { useState } from 'react';
import { FileSpreadsheet, Download, Upload } from 'lucide-react';
import { api } from '../api';
import { parseRecurringFile, downloadRecurringTemplate } from '../lib/recurringExcel';
import { formatILS } from '../format';
import { FREQUENCY_LABELS, describeSchedule } from './RecurringItemSheet';
import Sheet from './Sheet';

// Load the building's expected costs / chores from an Excel (or CSV) file: pick the file, review what
// was understood row by row, then confirm. Nothing is saved until the whole file is valid.
export default function ExcelImportSheet({ buildingId, onClose, onImported }) {
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      setParsed(await parseRecurringFile(file));
    } catch (err) {
      setParsed(null);
      setError('לא הצלחנו לקרוא את הקובץ. ודאו שזה קובץ Excel (xlsx) או CSV.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.bulkRecurring(buildingId, parsed.items);
      onImported(res.created);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const canImport = parsed && parsed.items.length > 0 && parsed.errors.length === 0;

  return (
    <Sheet title="טעינת הוצאות צפויות מ-Excel" onClose={onClose} wide>
      <div className="stack">
        <p className="text-footnote text-secondary" style={{ margin: 0 }}>
          שורה לכל פריט, ושורת כותרות: <b>שם</b>, קטגוריה, תדירות (חודשי / שנתי / חד פעמי), חודש (לשנתי), תאריך (לחד פעמי), סכום צפוי, הערות.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <label className="btn btn--primary" style={{ cursor: 'pointer' }}>
            <Upload size={20} /> {busy ? 'קורא...' : 'בחירת קובץ'}
            <input type="file" className="hidden" accept=".xlsx,.csv" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <button type="button" className="btn btn--secondary" onClick={downloadRecurringTemplate}><Download size={20} /> הורדת תבנית</button>
        </div>

        {error && <div className="alert alert--danger" role="alert">{error}</div>}

        {parsed && (
          <>
            {parsed.errors.length > 0 && (
              <div className="alert alert--danger stack" style={{ gap: 'var(--space-1)' }} role="alert">
                <b>יש לתקן {parsed.errors.length} שורות ולהעלות שוב - שום דבר לא נשמר:</b>
                {parsed.errors.slice(0, 8).map((e) => <span key={`${e.row}-${e.error}`}>שורה {e.row}: {e.error}</span>)}
                {parsed.errors.length > 8 && <span>ועוד {parsed.errors.length - 8}...</span>}
              </div>
            )}
            {parsed.items.length > 0 && (
              <>
                <p className="row" style={{ margin: 0 }}><FileSpreadsheet size={20} /> <b>{parsed.items.length}</b> פריטים זוהו</p>
                <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>שם</th><th>קטגוריה</th><th>מתי</th><th>סכום</th></tr></thead>
                    <tbody>
                      {parsed.items.map((it, i) => (
                        <tr key={i}>
                          <td>{it.title}</td>
                          <td>{it.category}</td>
                          <td className="text-footnote">{FREQUENCY_LABELS[it.frequency]} · {describeSchedule(it)}</td>
                          <td>{it.expectedAmount != null ? formatILS(it.expectedAmount) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <button className="btn btn--primary" disabled={!canImport || busy} onClick={confirm}>
              {busy ? 'טוען...' : canImport ? `טעינת ${parsed.items.length} פריטים` : 'אין מה לטעון'}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
