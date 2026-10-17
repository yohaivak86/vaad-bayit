import { useEffect, useState } from 'react';
import { X, ShieldCheck, Building2, Users, Trash2 } from 'lucide-react';
import { api } from '../api';
import { formatDateHe } from '../format';

const ROLE_LABEL = { ADMIN: 'נציג ועד', COMMITTEE: 'נציג ועד', VIEWER: 'דייר', RESIDENT: 'דייר' };

export default function AdminControlCenterModal({ currentUserId, onClose }) {
  const [tab, setTab] = useState('buildings');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-1.5"><ShieldCheck size={18} /> מרכז ניהול</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>

        <div className="flex px-5 pt-3 gap-1 border-b border-slate-100">
          <TabButton icon={Building2} label="בניינים" active={tab === 'buildings'} onClick={() => setTab('buildings')} />
          <TabButton icon={Users} label="משתמשים" active={tab === 'users'} onClick={() => setTab('users')} />
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1">
          {tab === 'buildings' ? <BuildingsPanel /> : <UsersPanel currentUserId={currentUserId} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function BuildingsPanel() {
  const [buildings, setBuildings] = useState(null);
  const load = async () => setBuildings(await api.getAllBuildings());
  useEffect(() => { load(); }, []);

  const remove = async (b) => {
    if (!confirm(`למחוק לצמיתות את הבניין "${b.name}"? כל הדיירים, ההוצאות והנתונים שלו יימחקו ולא ניתן יהיה לשחזר.`)) return;
    await api.deleteAnyBuilding(b.id);
    await load();
  };

  if (buildings === null) return <p className="text-sm text-slate-500">טוען...</p>;

  return (
    <div className="space-y-2">
      {buildings.map((b) => (
        <div key={b.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2.5">
          <div>
            <p className="font-semibold text-sm text-slate-800">{b.name}</p>
            <p className="text-xs text-slate-500">
              {b.address || 'ללא כתובת'} · {b.adminCount} משתמשים · {b.tenantCount} דיירים
              {!b.isConfigured && <span className="text-amber-600"> · לא הוגדר</span>}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">נוצר ב-{formatDateHe(b.createdAt)}</p>
          </div>
          <button onClick={() => remove(b)} className="p-1.5 text-slate-300 hover:text-red-500 shrink-0">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {buildings.length === 0 && <p className="text-sm text-slate-400 text-center py-8">אין בניינים במערכת</p>}
    </div>
  );
}

function UsersPanel({ currentUserId }) {
  const [users, setUsers] = useState(null);
  const load = async () => setUsers(await api.getAllUsers());
  useEffect(() => { load(); }, []);

  const changeRole = async (u, role) => {
    await api.updateUserRole(u.id, role);
    await load();
  };

  const remove = async (u) => {
    if (!confirm(`למחוק לצמיתות את המשתמש "${u.name}" (${u.email})?`)) return;
    await api.deleteUser(u.id);
    await load();
  };

  if (users === null) return <p className="text-sm text-slate-500">טוען...</p>;

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="border border-slate-200 rounded-xl px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-slate-800">{u.name}</p>
              <p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">נרשם ב-{formatDateHe(u.createdAt)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {u.id === currentUserId ? (
                <span className="text-xs text-slate-400">מנהל אתר (את/ה)</span>
              ) : (
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u, e.target.value)}
                  className="text-xs border border-slate-200 rounded-md px-1.5 py-1"
                >
                  <option value="BUILDING_ADMIN">משתמש רגיל</option>
                  <option value="SUPER_ADMIN">מנהל אתר</option>
                </select>
              )}
              {u.id !== currentUserId && (
                <button onClick={() => remove(u)} className="p-1.5 text-slate-300 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          {u.buildings.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {u.buildings.map((b) => (
                <span key={b.buildingId} className="text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-500">
                  {b.buildingName} · {b.status === 'PENDING' ? 'ממתין' : ROLE_LABEL[b.role]}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {users.length === 0 && <p className="text-sm text-slate-400 text-center py-8">אין משתמשים במערכת</p>}
    </div>
  );
}
