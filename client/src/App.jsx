import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CalendarRange, UserRound, Users, ClipboardList, Receipt, LineChart, FileText, Building2, Network,
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
import BuildingProfile from './components/tabs/BuildingProfile';
import ComplexProfile from './components/tabs/ComplexProfile';
import { api } from './api';
import { createExpenseFromForm } from './lib/expenseSave';

const NAV_ITEMS = {
  dashboard: { label: 'ציר זמן ולוח בקרה', icon: CalendarRange },
  me: { label: 'הדף שלי', icon: UserRound },
  tenants: { label: 'דיירים וגבייה', icon: Users },
  tasks: { label: 'משימות ותקלות', icon: ClipboardList },
  expenses: { label: 'הוצאות ותנועות', icon: Receipt },
  budget: { label: 'תכנון שנתי', icon: LineChart },
  documents: { label: 'מסמכים ונהלים', icon: FileText },
  building: { label: 'פרופיל בניין', icon: Building2 },
  complex: { label: 'פרופיל מתחם', icon: Network },
};

// What each level sees. A resident gets only their own page, the timeline, the tasks and the
// profiles - never money or other residents. Committee reps / the site admin get everything.
function navKeysFor(role, inComplex) {
  const keys = role === 'COMMITTEE'
    ? ['dashboard', ...(inComplex ? ['complex'] : []), 'tenants', 'tasks', 'expenses', 'budget', 'documents', 'building']
    : ['me', 'dashboard', 'tasks', 'building', ...(inComplex ? ['complex'] : [])];
  return keys;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [buildings, setBuildings] = useState(null);
  const [buildingId, setBuildingId] = useState(null);

  const [building, setBuilding] = useState(null);
  const [balance, setBalance] = useState(null);
  const [tab, setTab] = useState('dashboard');
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
    if (buildingId) setTab(role === 'COMMITTEE' ? 'dashboard' : 'me');
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
      onNav={setTab}
      complex={complex}
      showSwitch={buildings && (buildings.length > 1 || isSiteAdmin)}
      onSwitchBuilding={() => setBuildingId(null)}
      onLogout={logout}
      onAddExpense={() => { setExpensePrefill(null); setShowAddExpense(true); }}
      onApprovePayment={() => setShowApprovePayment(true)}
      onManageAdmins={() => setShowManageAdmins(true)}
      onOpenSettings={() => setShowSettings(true)}
      onOpenProfessionals={() => setShowProfessionals(true)}
    >
      {isCommittee && <ComplexRequests onChanged={loadBuildings} />}
      <AnnouncementsBoard buildingId={buildingId} readOnly={!isCommittee} />

      {tab === 'dashboard' && <TimelineDashboard
          key={`dash-${version}`}
          buildingId={buildingId}
          role={role}
          balance={balance}
          complexName={complex?.name}
          onBalanceChanged={refreshBalance}
          onOpenTasks={() => setTab('tasks')}
          onPayExpected={(item) => { setExpensePrefill(item); setShowAddExpense(true); }}
        />}
      {tab === 'me' && <MyPage buildingId={buildingId} />}
      {tab === 'tenants' && isCommittee && <TenantsTab buildingId={buildingId} onBalanceChanged={refreshBalance} readOnly={false} />}
      {tab === 'tasks' && <TasksTab buildingId={buildingId} isCommittee={isCommittee} onBalanceChanged={refreshBalance} />}
      {tab === 'expenses' && isCommittee && <ExpensesTab key={`exp-${version}`} buildingId={buildingId} building={building} onBalanceChanged={refreshBalance} />}
      {tab === 'budget' && isCommittee && <BudgetTab buildingId={buildingId} readOnly={false} />}
      {tab === 'documents' && isCommittee && <DocumentsTab buildingId={buildingId} readOnly={false} />}
      {tab === 'building' && (
        <BuildingProfile
          buildingId={buildingId}
          canEdit={isCommittee}
          onChanged={loadBuildings}
          onOpenComplex={() => setTab('complex')}
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
        <OnboardingModal building={building} onClose={() => setShowSettings(false)} onSave={saveSettings} />
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
