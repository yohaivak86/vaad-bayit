import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, MapPin, Trash2, Check, Network, Repeat, Phone, CalendarDays, Wrench, Home } from 'lucide-react';
import { api } from '../../api';
import { PAID_FROM_OPTIONS, TASK_STATUSES } from '../../constants';
import { formatDateHe, formatILS } from '../../format';
import { describeSchedule, nextOccurrence } from '../RecurringItemSheet';
import Sheet from '../Sheet';

const STATUS_DOT = { OPEN: 'danger', IN_PROGRESS: 'warning', CONTRACTOR: 'warning', RESOLVED: 'success' };
const statusLabel = (v) => TASK_STATUSES.find((s) => s.value === v)?.label || v;
const isOpen = (t) => t.status !== 'RESOLVED';

// Faults and chores. Anyone in the building can open a fault; committee reps run the rest:
// plan a chore from the expected list, add a one-off, order a contractor, record what it cost
// (a cost with a payment source is recorded in the expenses automatically).
export default function TasksTab({ buildingId, isCommittee, onBalanceChanged }) {
  const [tasks, setTasks] = useState(null);
  const [recurring, setRecurring] = useState([]);
  const [providers, setProviders] = useState([]);
  const [filter, setFilter] = useState('OPEN'); // OPEN | RESOLVED | ALL | RESIDENT
  const [sheet, setSheet] = useState(null); // { task? } | null

  const load = useCallback(async () => {
    setTasks(await api.getTasks(buildingId));
    if (isCommittee) api.getRecurring(buildingId).then(setRecurring).catch(() => {});
  }, [buildingId, isCommittee]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getBuildingProfile(buildingId).then((p) => setProviders(p.providers || [])).catch(() => {}); }, [buildingId]);

  const counts = useMemo(() => ({
    OPEN: (tasks || []).filter(isOpen).length,
    RESOLVED: (tasks || []).filter((t) => !isOpen(t)).length,
    ALL: (tasks || []).length,
    RESIDENT: (tasks || []).filter((t) => t.residentReported && isOpen(t)).length,
  }), [tasks]);

  const shown = (tasks || []).filter((t) => {
    if (filter === 'OPEN') return isOpen(t);
    if (filter === 'RESOLVED') return !isOpen(t);
    if (filter === 'RESIDENT') return t.residentReported && isOpen(t);
    return true;
  });

  const changed = async () => {
    await load();
    await onBalanceChanged?.();
  };

  const resolve = async (task) => {
    await api.updateTask(buildingId, task.id, { status: 'RESOLVED' });
    await changed();
  };

  const filters = [
    ['OPEN', 'פתוחות'],
    ...(isCommittee ? [['RESIDENT', 'תקלות דיירים']] : []),
    ['RESOLVED', 'הושלמו'],
    ['ALL', 'הכל'],
  ];

  return (
    <div className="page stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>משימות ותקלות</h1>
          <p className="page-sub" style={{ margin: 0 }}>{isCommittee ? 'תקלות מהדיירים, משימות מתוכננות ובעלי מקצוע' : 'מה קורה בבניין, ופתיחת תקלה חדשה'}</p>
        </div>
        <button className="btn btn--primary" onClick={() => setSheet({})}>
          <Plus size={20} /> {isCommittee ? 'משימה או תקלה חדשה' : 'פתיחת תקלה'}
        </button>
      </div>

      <div className="segmented" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        {filters.map(([key, label]) => (
          <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} ({counts[key]})</button>
        ))}
      </div>

      {tasks === null && <p className="empty">טוען...</p>}
      {tasks && shown.length === 0 && (
        <div className="card empty">{filter === 'OPEN' ? 'אין כרגע משימות או תקלות פתוחות. כל הכבוד.' : 'אין פריטים להצגה בסינון הזה.'}</div>
      )}

      {shown.length > 0 && (
        <ul className="list">
          {shown.map((t) => (
            <li key={t.id} className="is-link" onClick={() => setSheet({ task: t })} style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <h3 style={{ margin: 0 }}>{t.title}</h3>
                  <span className={`badge badge--${STATUS_DOT[t.status] || 'danger'}`}>{statusLabel(t.status)}</span>
                  {t.urgency === 'דחוף' && <span className="badge badge--danger">דחוף</span>}
                  {t.residentReported && <span className="chip"><Home size={12} /> תקלת דייר</span>}
                  {t.scope === 'COMPLEX' && <span className="chip"><Network size={12} /> מתחם</span>}
                  {t.recurringTitle && <span className="chip"><Repeat size={12} /> {t.recurringTitle}</span>}
                </div>
                <p className="text-footnote text-secondary row" style={{ margin: 0, flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  {t.location && <span className="row" style={{ gap: 4 }}><MapPin size={13} /> {t.location}</span>}
                  {t.dueDate && <span className="row" style={{ gap: 4 }}><CalendarDays size={13} /> {formatDateHe(t.dueDate)}</span>}
                  {t.contractorName && <span className="row" style={{ gap: 4 }}><Wrench size={13} /> {t.contractorName}</span>}
                  {t.reportedByName && isCommittee && <span>דווח ע"י {t.reportedByName}</span>}
                </p>
                {t.cost != null && (
                  <p className="text-footnote" style={{ margin: 'var(--space-1) 0 0' }}>
                    עלות {formatILS(t.cost)} ·{' '}
                    {t.paidFrom ? <span className="text-secondary">נרשמה בהוצאות</span> : <span className="badge badge--warning">{isCommittee ? 'בחרו מקור תשלום כדי לרשום בהוצאות' : 'ממתין לאישור הוועד'}</span>}
                  </p>
                )}
              </div>
              {isCommittee && isOpen(t) && t.scope !== 'COMPLEX' && (
                <button className="btn btn--secondary btn--small" onClick={(e) => { e.stopPropagation(); resolve(t); }}><Check size={16} /> הושלם</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {sheet && (
        <TaskSheet
          task={sheet.task}
          buildingId={buildingId}
          isCommittee={isCommittee}
          recurring={recurring.filter((r) => r.active)}
          providers={providers}
          onClose={() => setSheet(null)}
          onSaved={async () => { setSheet(null); await changed(); }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------ create / edit
function TaskSheet({ task, buildingId, isCommittee, recurring, providers, onClose, onSaved }) {
  const editing = Boolean(task);
  const complexTask = task?.scope === 'COMPLEX';
  // A resident may open faults and edit only their own unresolved report; everything else is read-only for them.
  const canEdit = isCommittee ? !complexTask : !editing || (task.mine && task.status !== 'RESOLVED');
  const [source, setSource] = useState(task?.recurringItemId ? 'RECURRING' : 'NEW');
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    location: task?.location || '',
    urgency: task?.urgency || 'רגיל',
    status: task?.status || 'OPEN',
    dueDate: task?.dueDate ? String(task.dueDate).slice(0, 10) : '',
    contractorName: task?.contractorName || '',
    contractorPhone: task?.contractorPhone || '',
    cost: task?.cost != null ? String(Number(task.cost)) : '',
    paidFrom: task?.paidFrom || '',
    showOnTimeline: task?.showOnTimeline ?? true,
    recurringItemId: task?.recurringItemId || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickRecurring = (id) => {
    const item = recurring.find((r) => String(r.id) === String(id));
    setForm((f) => ({
      ...f,
      recurringItemId: id,
      ...(item && !editing ? { title: item.title, dueDate: nextOccurrence(item) || '' } : {}),
    }));
  };

  const pickProvider = (id) => {
    const p = providers.find((x) => String(x.id) === String(id));
    if (p) setForm((f) => ({ ...f, contractorName: p.name, contractorPhone: p.phone || '', status: f.status === 'OPEN' ? 'CONTRACTOR' : f.status }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const hasCost = form.cost !== '' && Number(form.cost) >= 0;
    const payload = {
      title: form.title,
      description: form.description,
      location: form.location,
      urgency: form.urgency,
      contractorName: form.contractorName,
      contractorPhone: form.contractorPhone,
      cost: hasCost ? Number(form.cost) : null,
    };
    if (isCommittee) {
      Object.assign(payload, {
        dueDate: form.dueDate || null,
        paidFrom: hasCost ? form.paidFrom || null : null,
        showOnTimeline: form.showOnTimeline,
        recurringItemId: source === 'RECURRING' && form.recurringItemId ? Number(form.recurringItemId) : null,
        ...(editing ? { status: form.status } : {}),
      });
    }
    try {
      if (editing) await api.updateTask(buildingId, task.id, payload);
      else await api.createTask(buildingId, payload);
      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const remove = async () => {
    await api.deleteTask(buildingId, task.id);
    await onSaved();
  };

  const title = editing ? (canEdit ? 'עריכת משימה' : 'פרטי משימה') : isCommittee ? 'משימה או תקלה חדשה' : 'פתיחת תקלה';

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        {editing && task.residentReported && <div className="alert alert--warning row"><Home size={20} /> <span>תקלת דייר{task.reportedByName ? ` - דווחה ע"י ${task.reportedByName}` : ''}</span></div>}
        {complexTask && <div className="alert alert--warning row"><Network size={20} /> <span>משימת מתחם {task.complexName ? `(${task.complexName}) ` : ''}- מנוהלת מפרופיל המתחם.</span></div>}

        {isCommittee && canEdit && !editing && (
          <div className="field">
            <label>מאיפה המשימה?</label>
            <div className="segmented" style={{ alignSelf: 'flex-start' }}>
              <button type="button" aria-pressed={source === 'NEW'} onClick={() => { setSource('NEW'); set('recurringItemId', ''); }}>פריט חדש / תקלה</button>
              <button type="button" aria-pressed={source === 'RECURRING'} onClick={() => setSource('RECURRING')} disabled={recurring.length === 0}>מהרשימה הצפויה</button>
            </div>
            {recurring.length === 0 && <span className="text-footnote text-secondary">עוד אין הוצאות צפויות - אפשר להגדיר אותן במסך "הוצאות".</span>}
          </div>
        )}

        {isCommittee && canEdit && source === 'RECURRING' && (
          <div className="field">
            <label>פריט צפוי</label>
            <select className="input" value={form.recurringItemId} onChange={(e) => pickRecurring(e.target.value)} required>
              <option value="">בחרו פריט...</option>
              {recurring.map((r) => <option key={r.id} value={r.id}>{r.title} · {describeSchedule(r)}</option>)}
            </select>
            <span className="text-footnote text-secondary">המשימה תקושר לפריט, וההוצאה שלה תירשם תחת אותה קטגוריה.</span>
          </div>
        )}

        <div className="field"><label>מה קרה / מה צריך לעשות</label><input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required disabled={!canEdit} placeholder="לדוגמה: נזילה בחדר המדרגות" /></div>
        <div className="field"><label>פירוט</label><textarea className="input" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} disabled={!canEdit} /></div>
        <div className="field-row">
          <div className="field"><label>מיקום</label><input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} disabled={!canEdit} placeholder="קומה 2, חניה..." /></div>
          <div className="field">
            <label>דחיפות</label>
            <div className="segmented" style={{ alignSelf: 'flex-start' }}>
              {['רגיל', 'דחוף'].map((u) => <button type="button" key={u} aria-pressed={form.urgency === u} onClick={() => canEdit && set('urgency', u)}>{u}</button>)}
            </div>
          </div>
        </div>

        {isCommittee && canEdit && (
          <div className="field-row">
            <div className="field"><label>תאריך יעד</label><input type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
            {editing && (
              <div className="field">
                <label>סטטוס</label>
                <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <h3 style={{ margin: 0 }}>בעל מקצוע ועלות</h3>
          {canEdit && providers.length > 0 && (
            <div className="field">
              <label>מתוך בעלי המקצוע של הבניין</label>
              <select className="input" defaultValue="" onChange={(e) => pickProvider(e.target.value)}>
                <option value="">בחרו (לא חובה)...</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.category}</option>)}
              </select>
            </div>
          )}
          <div className="field-row">
            <div className="field"><label>שם בעל המקצוע</label><input className="input" value={form.contractorName} onChange={(e) => set('contractorName', e.target.value)} disabled={!canEdit} /></div>
            <div className="field"><label>טלפון</label><input className="input" value={form.contractorPhone} onChange={(e) => set('contractorPhone', e.target.value)} disabled={!canEdit} dir="ltr" style={{ textAlign: 'start' }} inputMode="tel" /></div>
          </div>
          {editing && task.contractorPhone && !canEdit && (
            <a href={`tel:${task.contractorPhone}`} className="btn btn--secondary btn--small" style={{ alignSelf: 'flex-start' }}><Phone size={16} /> התקשרות</a>
          )}
          <div className="field">
            <label>עלות (₪)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.cost} onChange={(e) => set('cost', e.target.value)} disabled={!canEdit} inputMode="decimal" />
          </div>
          {isCommittee && canEdit && form.cost !== '' && (
            <div className="field">
              <label>שולם מתוך</label>
              <div className="segmented" style={{ alignSelf: 'flex-start' }}>
                <button type="button" aria-pressed={!form.paidFrom} onClick={() => set('paidFrom', '')}>עוד לא שולם</button>
                {PAID_FROM_OPTIONS.map((o) => <button type="button" key={o.value} aria-pressed={form.paidFrom === o.value} onClick={() => set('paidFrom', o.value)}>{o.label}</button>)}
              </div>
              <span className="text-footnote text-secondary">{form.paidFrom ? 'העלות תירשם אוטומטית גם במסך ההוצאות ותרד מהקופה.' : 'כל עוד לא נבחר מקור תשלום - ההוצאה לא נרשמת בקופה.'}</span>
            </div>
          )}
          {!isCommittee && canEdit && <span className="text-footnote text-secondary">העלות מועברת לנציג הוועד, שיאשר אותה וירשום אותה בהוצאות.</span>}
        </div>

        {isCommittee && canEdit && (
          <label className="row text-footnote"><input type="checkbox" checked={form.showOnTimeline} onChange={(e) => set('showOnTimeline', e.target.checked)} /> להציג בציר הזמן השנתי</label>
        )}

        {error && <div className="alert alert--danger" role="alert">{error}</div>}
        {canEdit && <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'שומר...' : editing ? 'שמירת שינויים' : isCommittee ? 'הוספה' : 'שליחת התקלה'}</button>}
        {editing && isCommittee && !complexTask && (
          confirmDelete ? (
            <button type="button" className="btn btn--danger" onClick={remove}>בטוחים? מחיקה סופית{task.cost && task.paidFrom ? ' (גם ההוצאה שנרשמה)' : ''}</button>
          ) : (
            <button type="button" className="btn btn--danger btn--small" style={{ alignSelf: 'center' }} onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> מחיקת המשימה</button>
          )
        )}
      </form>
    </Sheet>
  );
}
