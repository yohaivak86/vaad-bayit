import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Link as LinkIcon } from 'lucide-react';
import { api } from '../../api';
import { formatDateHe } from '../../format';
import Sheet from '../Sheet';

// Two kinds of documents. Everyone in the building reads them; committee reps add, edit and delete:
//   פרוטוקולים וסיכומי ועד - what was decided at committee meetings
//   נהלי בניין            - the standing house rules
export default function DocumentsTab({ buildingId, readOnly }) {
  const [view, setView] = useState('minutes'); // minutes | procedures
  const [minutes, setMinutes] = useState(null);
  const [procedures, setProcedures] = useState(null);
  const [sheet, setSheet] = useState(null); // { kind, item? }
  const [deleting, setDeleting] = useState(null); // { kind, item }

  const load = useCallback(async () => {
    setMinutes(await api.getMinutes(buildingId));
    setProcedures(await api.getProcedures(buildingId));
  }, [buildingId]);
  useEffect(() => { load(); }, [load]);

  const list = view === 'minutes' ? minutes : procedures;
  const addLabel = view === 'minutes' ? 'פרוטוקול או סיכום חדש' : 'נוהל חדש';

  const remove = async () => {
    if (deleting.kind === 'minutes') await api.deleteMinutes(buildingId, deleting.item.id);
    else await api.deleteProcedure(buildingId, deleting.item.id);
    setDeleting(null);
    await load();
  };

  return (
    <div className="page stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="segmented">
          <button aria-pressed={view === 'minutes'} onClick={() => setView('minutes')}>פרוטוקולים וסיכומי ועד{minutes ? ` (${minutes.length})` : ''}</button>
          <button aria-pressed={view === 'procedures'} onClick={() => setView('procedures')}>נהלי בניין{procedures ? ` (${procedures.length})` : ''}</button>
        </div>
        {!readOnly && <button className="btn btn--primary" onClick={() => setSheet({ kind: view })}><Plus size={20} /> {addLabel}</button>}
      </div>

      {list === null && <p className="empty">טוען...</p>}
      {list?.length === 0 && (
        <div className="card empty">{view === 'minutes' ? 'אין עדיין פרוטוקולים או סיכומי ועד.' : 'אין עדיין נהלי בניין.'}{!readOnly ? ' אפשר להוסיף עם הכפתור למעלה.' : ''}</div>
      )}

      {list?.map((item) => (
        <article key={item.id} className="card card--tight stack" style={{ gap: 'var(--space-2)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0 }}>{item.title}</h3>
              {view === 'minutes' && <p className="text-footnote text-secondary" style={{ margin: 0 }}>{formatDateHe(item.date)}</p>}
            </div>
            {!readOnly && (
              <div className="row" style={{ gap: 0 }}>
                {view === 'procedures' && <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setSheet({ kind: 'procedures', item })} aria-label="עריכה"><Pencil size={18} /></button>}
                <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setDeleting({ kind: view, item })} aria-label="מחיקה"><Trash2 size={18} /></button>
              </div>
            )}
          </div>
          {item.content && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.content}</p>}
          {item.attachmentUrl && (
            <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="row text-footnote"><LinkIcon size={14} /> קובץ מצורף</a>
          )}
        </article>
      ))}

      {sheet && <DocumentSheet buildingId={buildingId} kind={sheet.kind} item={sheet.item} onClose={() => setSheet(null)} onSaved={async () => { setSheet(null); await load(); }} />}
      {deleting && (
        <Sheet title="מחיקה" onClose={() => setDeleting(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>למחוק את "{deleting.item.title}"?</p>
            <button className="btn btn--danger" onClick={remove}>מחיקה</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function DocumentSheet({ buildingId, kind, item, onClose, onSaved }) {
  const isMinutes = kind === 'minutes';
  const [form, setForm] = useState({
    title: item?.title || '',
    date: item?.date ? String(item.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    content: item?.content || '',
    attachmentUrl: item?.attachmentUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isMinutes) await api.createMinutes(buildingId, form);
      else if (item) await api.updateProcedure(buildingId, item.id, { title: form.title, content: form.content, attachmentUrl: form.attachmentUrl });
      else await api.createProcedure(buildingId, { title: form.title, content: form.content, attachmentUrl: form.attachmentUrl });
      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Sheet title={isMinutes ? 'פרוטוקול או סיכום ועד' : item ? 'עריכת נוהל' : 'נוהל בניין חדש'} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="field"><label>{isMinutes ? 'נושא הישיבה' : 'שם הנוהל'}</label><input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required placeholder={isMinutes ? 'לדוגמה: ישיבת ועד - יוני' : 'לדוגמה: שעות שקט'} /></div>
        {isMinutes && <div className="field"><label>תאריך הישיבה</label><input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} required /></div>}
        <div className="field"><label>{isMinutes ? 'סיכום והחלטות' : 'תוכן הנוהל'}</label><textarea className="input" rows={6} value={form.content} onChange={(e) => set('content', e.target.value)} /></div>
        <div className="field"><label>קישור לקובץ (לא חובה)</label><input className="input" value={form.attachmentUrl} onChange={(e) => set('attachmentUrl', e.target.value)} placeholder="https://..." dir="ltr" style={{ textAlign: 'start' }} /></div>
        {error && <div className="alert alert--danger" role="alert">{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'שומר...' : 'שמירה'}</button>
      </form>
    </Sheet>
  );
}
