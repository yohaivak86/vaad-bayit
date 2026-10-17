import { useState } from 'react';
import {
  Building2, LayoutGrid, LogOut, Menu, X, Users, Settings, Wrench, Copy, Check, Network, Plus, ReceiptText,
} from 'lucide-react';
import { ROLE_LABELS } from '../constants';
import ShareButton from './ShareButton';

export default function AppShell({
  user, building, role, isSiteAdmin, nav, active, onNav, complex,
  showSwitch, onSwitchBuilding, onLogout,
  onAddExpense, onApprovePayment, onManageAdmins, onOpenSettings, onOpenProfessionals,
  pendingComplexRequests = 0, inviteCode,
  children,
}) {
  const [drawer, setDrawer] = useState(false);
  const isCommittee = role === 'COMMITTEE';
  const roleLabel = isSiteAdmin ? ROLE_LABELS.SITE_ADMIN : ROLE_LABELS[role];

  const navigate = (key) => { onNav(key); setDrawer(false); };
  const run = (fn) => () => { fn(); setDrawer(false); };

  const sidebar = (
    <div className="sidebar">
      <div className="row" style={{ padding: 'var(--space-4) var(--space-4) var(--space-2)', gap: 'var(--space-3)' }}>
        <div className="chip chip--accent" style={{ width: 44, height: 44, padding: 0, justifyContent: 'center' }}>
          <Building2 size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="truncate" style={{ margin: 0 }}>{building?.name || 'ועד בית'}</h3>
          <p className="text-footnote text-secondary truncate" style={{ margin: 0 }}>
            {complex ? `מתחם ${complex.name}` : 'בניין בודד'}
          </p>
        </div>
      </div>

      <nav className="stack" style={{ gap: 2, padding: 'var(--space-2) var(--space-3)', flex: '0 0 auto' }}>
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => navigate(item.key)} className={`nav-item ${active === item.key ? 'active' : ''}`}>
              <Icon size={20} />
              <span className="flex-1">{item.label}</span>
              {item.key === 'complex' && pendingComplexRequests > 0 && <span className="badge badge--warning">{pendingComplexRequests}</span>}
            </button>
          );
        })}
      </nav>

      <div className="hairline sidebar-foot">
        <div className="side-tools">
          <ShareButton className="side-tool" label="שיתוף" iconSize={20} inviteCode={inviteCode} buildingName={building?.name} />
          <button onClick={run(onOpenProfessionals)} className="side-tool"><Wrench size={20} /> <span>בעלי מקצוע</span></button>
          {isCommittee && <button onClick={run(onManageAdmins)} className="side-tool"><Users size={20} /> <span>משתמשים</span></button>}
          {isCommittee && <button onClick={run(onOpenSettings)} className="side-tool"><Settings size={20} /> <span>הגדרות</span></button>}
          {showSwitch && <button onClick={run(onSwitchBuilding)} className="side-tool"><LayoutGrid size={20} /> <span>החלפת בניין</span></button>}
          <button onClick={onLogout} className="side-tool"><LogOut size={20} /> <span>התנתקות</span></button>
        </div>
        <div className="row" style={{ padding: 'var(--space-2) var(--space-3) 0' }}>
          <div className="chip" style={{ width: 32, height: 32, padding: 0, justifyContent: 'center', font: 'var(--text-footnote)', fontWeight: 600 }}>
            {(user.name || '?').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="text-footnote truncate" style={{ margin: 0, fontWeight: 600 }}>{user.name}</p>
            <p className="text-caption text-secondary" style={{ margin: 0 }}>{roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="app-shell lg:flex">
      <aside className="no-print fixed inset-y-0 right-0 z-30 hidden lg:block" style={{ width: 'var(--sidebar-width)' }}>{sidebar}</aside>

      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0" style={{ background: 'var(--overlay)', backdropFilter: 'blur(8px)' }} />
          <aside className="absolute inset-y-0 right-0 rise-in" style={{ width: 'min(var(--sidebar-width), 86vw)' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDrawer(false)} className="icon-btn absolute z-10" style={{ insetBlockStart: 'var(--space-2)', insetInlineEnd: 'var(--space-2)' }} aria-label="סגירה"><X size={20} /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1" style={{ marginInlineStart: 0 }}>
        <div className="lg:mr-[var(--sidebar-width)]">
          <header className="navbar no-print" style={{ gap: 'var(--space-3)', justifyContent: 'flex-start' }}>
            <button onClick={() => setDrawer(true)} className="icon-btn lg:hidden" aria-label="תפריט"><Menu size={20} /></button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate" style={{ margin: 0 }}>{building?.name || 'ועד בית'}</h3>
              {building?.address && <p className="text-footnote text-secondary truncate" style={{ margin: 0 }}>{building.address}</p>}
            </div>

            {complex && (
              <span className="chip hidden sm:inline-flex"><Network size={14} /> {complex.number ? `מתחם ${complex.number} · ` : ''}{complex.name}</span>
            )}
            {isCommittee && building?.inviteCode && <InviteChip code={building.inviteCode} />}
            <span className="chip hidden sm:inline-flex">{roleLabel}</span>

            {isCommittee && (
              <div className="hidden items-center gap-2 md:flex">
                <button onClick={onAddExpense} className="btn btn--rose btn--small"><ReceiptText size={16} /> הוצאה</button>
                <button onClick={onApprovePayment} className="btn btn--success btn--small"><Plus size={16} /> תשלום דייר</button>
              </div>
            )}
          </header>

          <main className="rise-in">{children}</main>
        </div>
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
    <button onClick={copy} title="קוד הבניין - לחצו להעתקה" className="chip chip--accent" style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em' }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span style={{ fontFamily: 'var(--font-sans)', letterSpacing: 0 }}>קוד בניין:</span> {code}
    </button>
  );
}
