import { useEffect, useState } from 'react';
import { Building2, Network, Phone, Mail, Plus, Pencil, Link2, Unlink, Users, Layers, ArrowUpDown } from 'lucide-react';
import { api } from '../../api';
import ServiceMap from '../ServiceMap';
import ProviderFormModal from '../ProviderFormModal';

// Building profile: open to every role, editable only by committee reps / the site admin.
export default function BuildingProfile({ buildingId, canEdit, onChanged, onOpenComplex }) {
  const [profile, setProfile] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | provider
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const load = async () => setProfile(await api.getBuildingProfile(buildingId));
  useEffect(() => { load(); }, [buildingId]);

  if (!profile) return <p className="p-6 text-sm text-slate-500">טוען...</p>;

  const { building, complex, providers, residentsCount } = profile;
  const selected = providers.find((p) => p.id === selectedId);

  const joinComplex = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.joinComplexFromBuilding(buildingId, joinCode);
      setJoinCode('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const leaveComplex = async () => {
    if (!confirm(`להסיר את הבניין מהמתחם "${complex.name}"? נותני השירות והמשימות של המתחם יפסיקו להופיע כאן.`)) return;
    await api.leaveComplexFromBuilding(buildingId);
    await load();
    onChanged?.();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 lg:p-6">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-3.5 text-white shadow-lg"><Building2 size={26} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-extrabold text-slate-800">{building.name}</h2>
          <p className="text-sm text-slate-500">{building.address || 'ללא כתובת'}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <Stat icon={Layers} label={`${building.floors} קומות`} />
          <Stat icon={Building2} label={`${building.apartmentsCount} דירות`} />
          <Stat icon={Users} label={`${residentsCount} דיירים`} />
          <Stat icon={ArrowUpDown} label={`${building.elevatorsCount} מעליות`} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-800"><Network size={18} /> שיוך למתחם</h3>
        {complex ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-violet-700">הבניין משתייך למתחם "{complex.name}"</p>
              <p className="mt-0.5 text-xs text-slate-500">
                בניינים במתחם: {complex.buildings.map((b) => b.name).join(' · ')}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onOpenComplex?.()} className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white" style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.2), transparent 55%)' }}>
                <Network size={15} /> לפרופיל המתחם
              </button>
              {canEdit && (
                <button onClick={leaveComplex} className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
                  <Unlink size={15} /> הסרה מהמתחם
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-slate-500">הבניין כרגע בודד (לא שייך למתחם). אפשר לשייך אותו למתחם בכל שלב.</p>
            {canEdit && (
              <form onSubmit={joinComplex} className="flex flex-wrap gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="input max-w-[220px] text-center font-mono tracking-widest"
                  placeholder="קוד הזמנה למתחם"
                  required
                />
                <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  <Link2 size={15} /> שיוך למתחם
                </button>
              </form>
            )}
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-800">נותני השירות של הבניין</h3>
          {canEdit && (
            <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white">
              <Plus size={16} /> נותן שירות
            </button>
          )}
        </div>

        {providers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">עדיין לא הוגדרו נותני שירות לבניין</p>
        ) : (
          <div className="grid items-center gap-4 lg:grid-cols-[1.4fr_1fr]">
            <ServiceMap
              centerTitle={building.name}
              centerSubtitle={`${providers.length} נותני שירות`}
              providers={providers}
              selectedId={selectedId}
              onSelectProvider={(id) => setSelectedId(id === selectedId ? null : id)}
            />
            <div className="space-y-3">
              {selected ? (
                <ProviderDetails
                  provider={selected}
                  canEdit={canEdit && selected.scope === 'BUILDING'}
                  onEdit={() => setEditing(selected)}
                />
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">לחצו על בלון כדי לראות פרטים. בלון מקווקו = נותן שירות שמגיע דרך המתחם.</p>
              )}
              <ul className="space-y-1.5">
                {providers.map((p) => (
                  <li key={`${p.scope}-${p.id}`}>
                    <button
                      onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-start text-sm ${p.id === selectedId ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-white ring-1 ring-slate-200'}`}
                    >
                      <span className="font-semibold text-slate-800">{p.name}</span>
                      <span className="text-xs text-slate-500">{p.category}{p.scope === 'COMPLEX' ? ` · דרך ${p.complexName}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <ProviderFormModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (form) => {
            if (editing === 'new') await api.createProvider(buildingId, form);
            else await api.updateProvider(buildingId, editing.id, form);
            setEditing(null);
            await load();
          }}
          onDelete={editing === 'new' ? undefined : async () => {
            await api.deleteProvider(buildingId, editing.id);
            setEditing(null);
            setSelectedId(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ icon: Icon, label }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5"><Icon size={13} /> {label}</span>
  );
}

export function ProviderDetails({ provider, canEdit, onEdit, extra }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-extrabold text-slate-800">{provider.name}</p>
          <p className="text-xs text-slate-500">{provider.category}{provider.scope === 'COMPLEX' ? ` · דרך המתחם ${provider.complexName}` : ''}</p>
        </div>
        {canEdit && (
          <button onClick={onEdit} className="rounded-lg border border-slate-200 p-1.5 text-slate-500"><Pencil size={14} /></button>
        )}
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        {provider.phone && (
          <a href={`tel:${provider.phone}`} className="flex items-center gap-2 text-blue-600"><Phone size={14} /> {provider.phone}</a>
        )}
        {provider.email && (
          <a href={`mailto:${provider.email}`} className="flex items-center gap-2 text-blue-600"><Mail size={14} /> {provider.email}</a>
        )}
        {provider.notes && <p className="text-slate-600">{provider.notes}</p>}
        {extra}
      </div>
    </div>
  );
}
