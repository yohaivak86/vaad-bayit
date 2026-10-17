import { useCallback, useEffect, useState } from 'react';
import { Plus, Lock, LockOpen, Trash2, History, Check, X } from 'lucide-react';
import { api } from '../../api';
import { formatDateHe } from '../../format';
import Sheet from '../Sheet';

// Building votes: one vote per apartment (however many residents live in it). Everyone sees the totals -
// never who voted. Changing an apartment's vote asks for confirmation; committee reps get a change log.
export default function VotesTab({ buildingId, isCommittee }) {
  const [data, setData] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirm, setConfirm] = useState(null); // { poll, optionIndex, info }
  const [logPoll, setLogPoll] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.getPolls(buildingId).then(setData), [buildingId]);
  useEffect(() => { load(); }, [load]);

  const castVote = async (poll, optionIndex, confirmed = false) => {
    setError('');
    try {
      await api.vote(buildingId, poll.id, optionIndex, confirmed);
      setConfirm(null);
      await load();
    } catch (err) {
      if (err.status === 409 && err.data?.code === 'CONFIRM_CHANGE') setConfirm({ poll, optionIndex, info: err.data });
      else setError(err.message);
    }
  };

  const setStatus = async (poll, status) => {
    await api.updatePoll(buildingId, poll.id, { status });
    await load();
  };

  return (
    <div className="page stack" style={{ gap: 'var(--space-4)' }}>
      {isCommittee && (
        <div className="row">
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}><Plus size={20} /> הצבעה חדשה</button>
        </div>
      )}

      {data && !data.canVote && (
        <div className="alert alert--warning">החשבון שלכם עדיין לא משויך לדירה, ולכן אי אפשר להצביע. נציג הוועד יכול לשייך אתכם לדירה ב"ניהול משתמשים".</div>
      )}
      {data?.canVote && <p className="page-sub" style={{ margin: 0 }}>מצביעים מדירה {data.apartmentNumber}. לכל דירה קול אחד, גם אם גרים בה כמה דיירים.</p>}
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
      {data === null && <p className="empty">טוען...</p>}
      {data && data.polls.length === 0 && <div className="card empty">אין עדיין הצבעות. {isCommittee ? 'אפשר לפתוח הצבעה חדשה לדיירי הבניין.' : ''}</div>}

      {data?.polls.map((poll) => {
        const open = poll.status === 'OPEN';
        return (
          <section key={poll.id} className="card stack" style={{ gap: 'var(--space-3)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>{poll.title}</h2>
                {poll.description && <p className="text-footnote text-secondary" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{poll.description}</p>}
              </div>
              <span className={`badge badge--${open ? 'success' : ''}`}>{open ? 'פתוחה' : 'סגורה'}{poll.closesAt ? ` · עד ${formatDateHe(poll.closesAt)}` : ''}</span>
            </div>

            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {poll.options.map((o) => {
                const mine = poll.myVote?.optionIndex === o.index;
                const canClick = open && data.canVote;
                return (
                  <button
                    key={o.index}
                    type="button"
                    disabled={!canClick}
                    onClick={() => castVote(poll, o.index)}
                    className="vote-option"
                    aria-pressed={mine}
                  >
                    <span className="vote-bar" style={{ width: `${o.percent}%` }} />
                    <span className="row" style={{ position: 'relative', justifyContent: 'space-between', width: '100%' }}>
                      <span className="row">{mine && <Check size={18} color="var(--accent)" />}<span style={{ fontWeight: mine ? 700 : 500 }}>{o.label}</span></span>
                      <span className="text-footnote">{o.votes} · {o.percent}%</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-footnote text-secondary" style={{ margin: 0 }}>
              הצביעו {poll.totalVotes} מתוך {poll.eligibleApartments} דירות ({poll.participationPercent}%)
              {poll.myVote ? ` · הדירה שלכם הצביעה "${poll.options[poll.myVote.optionIndex].label}"` : data.canVote && open ? ' · הדירה שלכם עוד לא הצביעה' : ''}
            </p>

            {isCommittee && (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn--secondary btn--small" onClick={() => setStatus(poll, open ? 'CLOSED' : 'OPEN')}>
                  {open ? <><Lock size={14} /> סגירת ההצבעה</> : <><LockOpen size={14} /> פתיחה מחדש</>}
                </button>
                <button className="btn btn--secondary btn--small" onClick={() => setLogPoll(poll)}><History size={14} /> יומן שינויים</button>
                <button className="btn btn--danger btn--small" onClick={() => setDeleting(poll)}><Trash2 size={14} /> מחיקה</button>
              </div>
            )}
          </section>
        );
      })}

      {showCreate && <CreatePoll buildingId={buildingId} onClose={() => setShowCreate(false)} onCreated={async () => { setShowCreate(false); await load(); }} />}

      {confirm && (
        <Sheet title="לעדכן את ההצבעה?" onClose={() => setConfirm(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>
              {confirm.info.isSelf ? 'כבר הצבעתם' : `דייר ${confirm.info.voterName} כבר הצביע`} "{confirm.info.currentOption}" בהצבעה "{confirm.poll.title}".
              {' '}האם לעדכן את ההצבעה של הדירה ל-"{confirm.info.newOption}"?
            </p>
            <p className="text-footnote text-secondary" style={{ margin: 0 }}>לדירה יש קול אחד. השינוי יירשם ביומן ההצבעות של הוועד.</p>
            <div className="row">
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => castVote(confirm.poll, confirm.optionIndex, true)}>כן, לעדכן</button>
              <button className="btn btn--secondary" style={{ flex: 1 }} onClick={() => setConfirm(null)}>השארת ההצבעה</button>
            </div>
          </div>
        </Sheet>
      )}

      {logPoll && <LogSheet buildingId={buildingId} poll={logPoll} onClose={() => setLogPoll(null)} />}

      {deleting && (
        <Sheet title="מחיקת הצבעה" onClose={() => setDeleting(null)}>
          <div className="stack">
            <p style={{ margin: 0 }}>למחוק את "{deleting.title}" על כל הקולות והיומן שלה? אי אפשר לשחזר.</p>
            <button className="btn btn--danger" onClick={async () => { await api.deletePoll(buildingId, deleting.id); setDeleting(null); await load(); }}>מחיקה</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function CreatePoll({ buildingId, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', closesAt: '' });
  const [options, setOptions] = useState(['כן', 'לא', 'נמנע']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createPoll(buildingId, { ...form, closesAt: form.closesAt || null, options });
      onCreated();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Sheet title="הצבעה חדשה" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="field"><label>על מה מצביעים?</label><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="לדוגמה: צביעת חדר המדרגות" /></div>
        <div className="field"><label>פירוט (לא חובה)</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
        <div className="field">
          <label>אפשרויות</label>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {options.map((o, i) => (
              <div key={i} className="row">
                <input className="input" value={o} onChange={(e) => setOptions((list) => list.map((x, j) => (j === i ? e.target.value : x)))} required aria-label={`אפשרות ${i + 1}`} />
                {options.length > 2 && <button type="button" className="icon-btn" onClick={() => setOptions((list) => list.filter((_, j) => j !== i))} aria-label="הסרת אפשרות"><X size={18} /></button>}
              </div>
            ))}
            {options.length < 8 && <button type="button" className="btn btn--secondary btn--small" style={{ alignSelf: 'flex-start' }} onClick={() => setOptions((list) => [...list, ''])}><Plus size={14} /> אפשרות נוספת</button>}
          </div>
        </div>
        <div className="field"><label>סגירה אוטומטית בתאריך (לא חובה)</label><input type="date" className="input" value={form.closesAt} onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))} /></div>
        {error && <div className="alert alert--danger" role="alert">{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'פותח...' : 'פתיחת ההצבעה'}</button>
      </form>
    </Sheet>
  );
}

function LogSheet({ buildingId, poll, onClose }) {
  const [log, setLog] = useState(null);
  useEffect(() => { api.getPollLog(buildingId, poll.id).then(setLog).catch(() => setLog([])); }, [buildingId, poll.id]);

  return (
    <Sheet title={`יומן שינויים: ${poll.title}`} onClose={onClose} wide>
      {log === null && <p className="empty">טוען...</p>}
      {log && log.length === 0 && <p className="empty">לא שונתה אף הצבעה.</p>}
      {log && log.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>מתי</th><th>דירה</th><th>מי שינה</th><th>הצבעה קודמת</th><th>הצבעה חדשה</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{new Date(l.createdAt).toLocaleString('he-IL')}</td>
                  <td>{l.apartmentNumber}</td>
                  <td>{l.changedBy}{l.previousVoter !== l.changedBy ? <span className="text-footnote text-secondary"> (במקום {l.previousVoter})</span> : null}</td>
                  <td>{l.previousOption}</td>
                  <td>{l.newOption}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sheet>
  );
}
