import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CalendarRange, UserRound, Users, ClipboardList, Receipt, LineChart, FileText, Building2, Network, Vote, ArrowRight, Milestone,
} from 'lucide-react';
import AppShell from './components/AppShell';
import OnboardingModal from './components/OnboardingModal';
import AddExpenseModal from './components/AddExpenseModal';
import ApprovePaymentModal from './components/ApprovePaymentModal';
import ManageAdminsModal from './components/ManageAdminsModal';
import ProfessionalsDirectoryModal from './components/ProfessionalsDirectoryModal';
import ComplexDetailModal from './components/ComplexDetailModal';
import AuthScreen from './components/AuthScreen';
import BuildingSelector from './components/BuildingSelector';
import JoinOrCreate from './components/JoinOrCreate';
import ComplexRequests from './components/ComplexRequests';
import AnnouncementsBoard from './components/AnnouncementsBoard';
import SuggestionButton from './components/SuggestionButton';
import TimelineDashboard from './components/tabs/TimelineDashboard';
import MyPage from './components/tabs/MyPage';
import TenantsTab from './components/tabs/TenantsTab';
import TasksTab from './components/tabs/TasksTab';
import ExpensesTab from './components/tabs/ExpensesTab';
import BudgetTab from './components/tabs/BudgetTab';
import DocumentsTab from './components/tabs/DocumentsTab';
import VotesTab from './components/tabs/VotesTab';
import YearTimeline from './components/tabs/YearTimeline';
import BuildingProfile from './components/tabs/BuildingProfile';
import ComplexProfile from './components/tabs/ComplexProfile';
import { api } from './api';
import { createExpenseFromForm } from './lib/expenseSave';

// `label` is the sidebar entry AND the title shown at the top of the screen; `sub` is the line under it.
const NAV_ITEMS = {
  dashboard: { label: 'מסך ראשי', sub: 'הקופה, מה מצפה בחודש הקרוב, והציר השנתי', subResident: 'מה מצפה בחודש הקרוב והציר השנתי', icon: CalendarRange },
  timeline: { label: 'ציר זמן', sub: 'כל ההוצאות והמשימות הצפויות במהלך השנה - להצגה על מסך', icon: Milestone },
  me: { label: 'הדף שלי', sub: 'הפרטים שלי ודמי הוועד', icon: UserRound },
  tenants: { label: 'דיירים וגבייה', sub: 'דמי ועד, תשלומים וחובות', icon: Users },
  tasks: { label: 'משימות ותקלות', sub: 'תקלות מהדיירים, משימות מתוכננות ובעלי מקצוע', subResident: 'מה קורה בבניין, ופתיחת תקלה חדשה', icon: ClipboardList },
  expenses: { label: 'הוצאות', sub: 'מה שולם, ומה צפוי בחודשים הקרובים', icon: Receipt },
  budget: { label: 'תכנון שנתי', sub: 'תקציב והקרנת הקופה', icon: LineChart },
  documents: { label: 'פרוטוקולים ונהלי בניין', sub: 'פרוטוקולים וסיכומי ועד, ונהלי הבניין', icon: FileText },
  votes: { label: 'הצבעות', sub: 'קול אחד לכל דירה', icon: Vote },
  building: { label: 'פרופיל בניין', sub: 'פרטי הבניין, שיוך למתחם ובעלי מקצוע', icon: Building2 },
  complex: { label: 'פרופיל מתחם', sub: 'הבניינים, נציגי הוועד ובעלי המקצוע של המתחם', icon: Network },
};

// What each level sees. A resident gets only their own page, the timeline, the tasks, the documents, the
// votes and the profiles - never money or other residents. Committee reps / the site admin get everything.
function navKeysFor(role, inComplex) {
  const keys = role === 'COMMITTEE'
    ? ['dashboard', 'timeline', ...(inComplex ? ['complex'] : []), 'tenants', 'tasks', 'expenses', 'budget', 'documents', 'votes', 'building']
    : ['me', 'dashboard', 'timeline', 'tasks', 'votes', 'documents', 'building', ...(inComplex ? ['complex'] : [])];
  return keys;
}

// The title of the screen the user is on, with a back button to the screen they came from.
function PageHeader({ item, resident, canGoBack, onBack }) {
  if (!item) return null;
  return (
    <div className="page no-print" style={{ paddingBottom: 0 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        {canGoBack && (
          <button className="icon-btn" onClick={onBack} aria-label="חזרה למסך הקודם" title="חזרה למסך הקודם" style={{ marginInlineStart: 'calc(var(--space-2) * -1)' }}>
            <ArrowRight size={22} />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ margin: 0 }}>{item.label}</h1>
          <p className="page-sub" style={{ margin: 0 }}>{resident && item.subResident ? item.subResident : item.sub}</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [buildings, setBuildings] = useState(null);
  const [buildingId, setBuildingId] = useState(null);

  const [building, setBuilding] = useState(null);
  const [balance, setBalance] = useState(null);
  const [route, setRoute] = useState({ tab: 'dashboard', params: null, depth: 0 });
  const tab = route.tab;
  // programmatic redirects (no history entry)
  const setTab = useCallback((t) => setRoute((r) => ({ ...r, tab: t, params: null })), []);
  // user navigation: remembered, so "back" works
  const go = useCallback((t, params = null) => {
    setRoute((r) => {
      const next = { tab: t, params, depth: r.depth + 1 };
      window.history.pushState(next, '');
      return next;
    });
  }, []);
  const goBack = () => window.history.back();
  const [showSettings, setShowSettings] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showApprovePayment, setShowApprovePayment] = useState(false);
  const [showManageAdmins, setShowManageAdmins] = useState(false);
  const [showProfessionals, setShowProfessionals] = useState(false);
  const [showComplexFinance, setShowComplexFinance] = useState(false);
  const [version, setVersion] = useState(0); // bumped after a change made from the header so open tabs reload
  const [expensePrefill, setExpensePrefill] = useState(null);

  useEffect(() => {
    api.me().then((res) => setUser(res.user)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    window.history.replaceState({ tab: 'dashboard', params: null, depth: 0 }, '');
    const onPop = (e) => { if (e.state?.tab) setRoute(e.state); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const loadBuildings = useCallback(async () => {
    const list = await api.getBuildings();
    setBuildings(list);
    if (list.length === 1 && list[0].status === 'ACTIVE') setBuildingId(list[0].id);
  }, []);

  useEffect(() => {
    if (user) loadBuildings();
  }, [user, loadBuildings]);

  const meta = buildings?.find((b) => b.id === buildingId);
  const role = meta?.role === 'COMMITTEE' ? 'COMMITTEE' : 'RESIDENT';
  const isCommittee = role === 'COMMITTEE';
  const isSiteAdmin = user?.role === 'SUPER_ADMIN';
  const complex = meta?.complexId ? { id: meta.complexId, name: meta.complexName, number: meta.complexNumber } : null;

  const navKeys = useMemo(() => navKeysFor(role, Boolean(complex)), [role, complex]);

  // Land on the right page for the role whenever a building is opened.
  useEffect(() => {
    if (buildingId) {
      const first = { tab: role === 'COMMITTEE' ? 'dashboard' : 'me', params: null, depth: 0 };
      window.history.replaceState(first, '');
      setRoute(first);
    }
  }, [buildingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the role or complex membership changes, never leave the user on a page they can't see.
  useEffect(() => {
    if (buildingId && !navKeys.includes(tab)) setTab(navKeys[0]);
  }, [navKeys, tab, buildingId]);

  const refreshBalance = useCallback(async () => {
    if (!buildingId || !isCommittee) return;
    setBalance(await api.getBalance(buildingId));
  }, [buildingId, isCommittee]);

  const loadBuilding = useCallback(async () => {
    if (!buildingId) return;
    const b = await api.getBuilding(buildingId);
    setBuilding(b);
    if (!b.isConfigured && isCommittee) setShowSettings(true);
  }, [buildingId, isCommittee]);

  useEffect(() => {
    if (buildingId) {
      loadBuilding();
      refreshBalance();
    }
  }, [buildingId, loadBuilding, refreshBalance]);

  const saveSettings = async (form) => {
    const updated = await api.updateBuilding(buildingId, form);
    setBuilding((b) => ({ ...b, ...updated }));
    setShowSettings(false);
    await refreshBalance();
  };

  const saveExpense = async (form, receiptFile) => {
    await createExpenseFromForm(buildingId, form, receiptFile);
    setShowAddExpense(false);
    setExpensePrefill(null);
    setVersion((v) => v + 1);
    await refreshBalance();
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setBuildings(null);
    setBuildingId(null);
    setBuilding(null);
    setBalance(null);
  };

  if (user === undefined) {
    return <div className="empty" style={{ paddingBlock: 'var(--space-8)' }}>טוען...</div>;
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  if (!buildingId) {
    if (!buildings) {
      return <div className="empty" style={{ paddingBlock: 'var(--space-8)' }}>טוען...</div>;
    }
    // A brand-new user (no building yet): join one by invite number / search, or open one.
    if (buildings.length === 0 && !isSiteAdmin) {
      return (
        <JoinOrCreate
          onLogout={logout}
          onDone={async (id) => { await loadBuildings(); if (id) setBuildingId(id); }}
        />
      );
    }
    return (
      <>
        <BuildingSelector user={user} buildings={buildings} onSelect={setBuildingId} onLogout={logout} onBuildingsChanged={loadBuildings} />
        <SuggestionButton />
      </>
    );
  }

  const nav = navKeys.map((key) => ({ key, ...NAV_ITEMS[key] }));

  return (
    <AppShell
      user={user}
      building={building}
      role={role}
      isSiteAdmin={isSiteAdmin}
      nav={nav}
      active={tab}
      onNav={(key) => go(key)}
      complex={complex}
      showSwitch={buildings && (buildings.length > 1 || isSiteAdmin)}
      onSwitchBuilding={() => setBuildingId(null)}
      onLogout={logout}
      onAddExpense={() => { setExpensePrefill(null); setShowAddExpense(true); }}
      onApprovePayment={() => setShowApprovePayment(true)}
      onManageAdmins={() => setShowManageAdmins(true)}
      onOpenSettings={() => setShowSettings(true)}
      inviteCode={isCommittee ? building?.inviteCode : null}
      onOpenProfessionals={() => setShowProfessionals(true)}
    >
      {isCommittee && <ComplexRequests onChanged={loadBuildings} />}
      <AnnouncementsBoard buildingId={buildingId} readOnly={!isCommittee} />

      <PageHeader item={NAV_ITEMS[tab]} resident={!isCommittee} canGoBack={route.depth > 0} onBack={goBack} />

      {tab === 'dashboard' && <TimelineDashboard
          key={`dash-${version}`}
          buildingId={buildingId}
          role={role}
          balance={balance}
          complexName={complex?.name}
          onBalanceChanged={refreshBalance}
          onNavigate={go}
          onPayExpected={(item) => { setExpensePrefill(item); setShowAddExpense(true); }}
        />}
      {tab === 'me' && <MyPage buildingId={buildingId} />}
      {tab === 'tenants' && isCommittee && <TenantsTab buildingId={buildingId} onBalanceChanged={refreshBalance} readOnly={false} />}
      {tab === 'tasks' && <TasksTab key={JSON.stringify(route.params)} buildingId={buildingId} isCommittee={isCommittee} initial={route.params} onBalanceChanged={refreshBalance} />}
      {tab === 'expenses' && isCommittee && <ExpensesTab key={`exp-${version}-${JSON.stringify(route.params)}`} initial={route.params} buildingId={buildingId} building={building} onBalanceChanged={refreshBalance} />}
      {tab === 'budget' && isCommittee && <BudgetTab buildingId={buildingId} readOnly={false} />}
      {tab === 'documents' && <DocumentsTab buildingId={buildingId} readOnly={!isCommittee} />}
      {tab === 'timeline' && <YearTimeline buildingId={buildingId} />}
      {tab === 'votes' && <VotesTab buildingId={buildingId} isCommittee={isCommittee} />}
      {tab === 'building' && (
        <BuildingProfile
          buildingId={buildingId}
          canEdit={isCommittee}
          onChanged={loadBuildings}
          onOpenComplex={() => go('complex')}
        />
      )}
      {tab === 'complex' && complex && (
        <ComplexProfile
          complexId={complex.id}
          currentBuildingId={buildingId}
          canFinance={isCommittee}
          onOpenFinance={() => setShowComplexFinance(true)}
        />
      )}

      {showSettings && isCommittee && (
        <OnboardingModal
          building={building}
          buildingId={buildingId}
          complex={complex}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
          onComplexChanged={loadBuildings}
        />
      )}
      {showAddExpense && <AddExpenseModal prefill={expensePrefill} onClose={() => { setShowAddExpense(false); setExpensePrefill(null); }} onSave={saveExpense} />}
      {showApprovePayment && (
        <ApprovePaymentModal buildingId={buildingId} onClose={() => setShowApprovePayment(false)} onApproved={refreshBalance} />
      )}
      {showManageAdmins && (
        <ManageAdminsModal buildingId={buildingId} currentUserId={user.id} building={building} onClose={() => setShowManageAdmins(false)} />
      )}
      {showProfessionals && <ProfessionalsDirectoryModal onClose={() => setShowProfessionals(false)} />}
      {showComplexFinance && complex && (
        <ComplexDetailModal complexId={complex.id} onClose={() => setShowComplexFinance(false)} onChanged={refreshBalance} />
      )}
      <SuggestionButton buildingId={buildingId} />
    </AppShell>
  );
}
