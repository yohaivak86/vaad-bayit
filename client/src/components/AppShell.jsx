import { useState } from 'react';
import {
  Building2, LayoutGrid, LogOut, Menu, X, Users, Settings, Wrench, Copy, Check, Network, Plus, ReceiptText,
} from 'lucide-react';
import { ROLE_LABELS } from '../constants';

export default function AppShell({
  user, building, role, isSiteAdmin, nav, active, onNav, complex,
  showSwitch, onSwitchBuilding, onLogout,
  onAddExpense, onApprovePayment, onManageAdmins, onOpenSettings, onOpenProfessionals,
  children,
}) {
  const [drawer, setDrawer] = useState(false);
  const isCommittee = role === 'COMMITTEE';
  const roleLabel = isSiteAdmin ? ROLE_LABELS.SITE_ADMIN : ROLE_LABELS[role];

  const navigate = (key) => { onNav(key); setDrawer(false); };

  const sidebar = (
    <div className="sidebar flex h-full flex-col text-white">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <div className="rounded-2xl bg-white/15 p-2.5 shadow-inner ring-1 ring-white/20">
          <Building2 size={22} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold leading-tight">{building?.name || 'ועד בית'}</p>
          <p className="truncate text-[11px] text-blue-200/80">{complex ? `מתחם ${complex.name}` : 'בניין בודד'}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => navigate(item.key)} className={`nav-item ${active === item.key ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 px-3 py-3">
        <button onClick={() => { onOpenProfessionals(); setDrawer(false); }} className="nav-item"><Wrench size={18} /> בעלי מקצוע</button>
        {isCommittee && (
          <>
            <button onClick={() => { onManageAdmins(); setDrawer(false); }} className="nav-item"><Users size={18} /> ניהול משתמשים</button>
            <button onClick={() => { onOpenSettings(); setDrawer(false); }} className="nav-item"><Settings size={18} /> הגדרות בניין</button>
          </>
        )}
        {showSwitch && (
          <button onClick={() => { onSwitchBuilding(); setDrawer(false); }} className="nav-item"><LayoutGrid size={18} /> החלפת בניין</button>
        )}
        <button onClick={onLogout} className="nav-item"><LogOut size={18} /> התנתקות</button>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/80 text-sm font-bold">
            {(user.name || '?').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{user.name}</p>
            <p className="text-[10px] text-blue-200/80">{roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen lg:flex">
      <aside className="no-print fixed inset-y-0 right-0 z-30 hidden w-72 lg:block">{sidebar}</aside>

      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 right-0 w-72 rise-in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDrawer(false)} className="absolute left-3 top-3 z-10 rounded-lg bg-white/10 p-1.5 text-white"><X size={18} /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1 lg:mr-72">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md">
          <button onClick={() => setDrawer(true)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm lg:hidden">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold text-slate-800">{building?.name || 'ועד בית'}</h1>
            <p className="truncate text-xs text-slate-500">{building?.address}</p>
          </div>

          {complex && (
            <span className="hidden items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 sm:flex">
              <Network size={13} /> {complex.name}
            </span>
          )}
          {isCommittee && building?.inviteCode && <InviteChip code={building.inviteCode} />}
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline">{roleLabel}</span>

          {isCommittee && (
            <div className="hidden items-center gap-2 md:flex">
              <button onClick={onAddExpense} className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white">
                <ReceiptText size={16} /> הוצאה
              </button>
              <button onClick={onApprovePayment} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white">
                <Plus size={16} /> תשלום דייר
              </button>
            </div>
          )}
        </header>

        <main className="rise-in">{children}</main>
      </div>
    </div>
  );
}

function InviteChip({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button
      onClick={copy}
      title="קוד הזמנה לבניין - לחצו להעתקה"
      className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-mono text-xs text-blue-700"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {code}
    </button>
  );
}
