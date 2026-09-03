import { useEffect, useState, useCallback } from 'react';
import Header from './components/Header';
import TabBar from './components/TabBar';
import OnboardingModal from './components/OnboardingModal';
import AddExpenseModal from './components/AddExpenseModal';
import ApprovePaymentModal from './components/ApprovePaymentModal';
import ManageAdminsModal from './components/ManageAdminsModal';
import AuthScreen from './components/AuthScreen';
import BuildingSelector from './components/BuildingSelector';
import AnnouncementsBoard from './components/AnnouncementsBoard';
import TenantsTab from './components/tabs/TenantsTab';
import TasksTab from './components/tabs/TasksTab';
import ExpensesTab from './components/tabs/ExpensesTab';
import BudgetTab from './components/tabs/BudgetTab';
import DocumentsTab from './components/tabs/DocumentsTab';
import { api } from './api';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [buildings, setBuildings] = useState(null);
  const [buildingId, setBuildingId] = useState(null);

  const [building, setBuilding] = useState(null);
  const [balance, setBalance] = useState(null);
  const [tab, setTab] = useState('tenants');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showApprovePayment, setShowApprovePayment] = useState(false);
  const [showManageAdmins, setShowManageAdmins] = useState(false);

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

  const refreshBalance = useCallback(async () => {
    if (!buildingId) return;
    setBalance(await api.getBalance(buildingId));
  }, [buildingId]);

  const currentBuildingMeta = buildings?.find((b) => b.id === buildingId);
  const readOnly = currentBuildingMeta?.role === 'VIEWER';

  const loadBuilding = useCallback(async () => {
    if (!buildingId) return;
    const b = await api.getBuilding(buildingId);
    setBuilding(b);
    if (!b.isConfigured && !readOnly) setShowSettings(true);
  }, [buildingId, readOnly]);

  useEffect(() => {
    if (buildingId) {
      loadBuilding();
      refreshBalance();
    }
  }, [buildingId, loadBuilding, refreshBalance]);

  const saveSettings = async (form) => {
    const updated = await api.updateBuilding(buildingId, form);
    setBuilding(updated);
    setShowSettings(false);
    await refreshBalance();
  };

  const saveExpense = async (form) => {
    await api.createExpense(buildingId, form);
    setShowAddExpense(false);
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
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">טוען...</div>;
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  if (!buildingId) {
    if (!buildings) {
      return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">טוען...</div>;
    }
    return (
      <BuildingSelector
        user={user}
        buildings={buildings}
        onSelect={setBuildingId}
        onLogout={logout}
        onBuildingsChanged={loadBuildings}
      />
    );
  }

  return (
    <div dir="rtl" className="min-h-screen">
      <Header
        building={building}
        balance={balance}
        onAddExpense={() => setShowAddExpense(true)}
        onApprovePayment={() => setShowApprovePayment(true)}
        onOpenSettings={() => setShowSettings(true)}
        onManageAdmins={() => setShowManageAdmins(true)}
        onSwitchBuilding={() => setBuildingId(null)}
        showSwitch={buildings && (buildings.length > 1 || user.role === 'SUPER_ADMIN')}
        onLogout={logout}
        readOnly={readOnly}
      />
      <AnnouncementsBoard buildingId={buildingId} readOnly={readOnly} />
      <TabBar active={tab} onChange={setTab} />

      {tab === 'tenants' && <TenantsTab buildingId={buildingId} onBalanceChanged={refreshBalance} readOnly={readOnly} />}
      {tab === 'tasks' && <TasksTab buildingId={buildingId} readOnly={readOnly} />}
      {tab === 'expenses' && <ExpensesTab buildingId={buildingId} building={building} readOnly={readOnly} />}
      {tab === 'budget' && <BudgetTab buildingId={buildingId} readOnly={readOnly} />}
      {tab === 'documents' && <DocumentsTab buildingId={buildingId} readOnly={readOnly} />}

      {showSettings && (
        <OnboardingModal building={building} onClose={() => setShowSettings(false)} onSave={saveSettings} />
      )}
      {showAddExpense && (
        <AddExpenseModal onClose={() => setShowAddExpense(false)} onSave={saveExpense} />
      )}
      {showApprovePayment && (
        <ApprovePaymentModal buildingId={buildingId} onClose={() => setShowApprovePayment(false)} onApproved={refreshBalance} />
      )}
      {showManageAdmins && (
        <ManageAdminsModal buildingId={buildingId} currentUserId={user.id} building={building} onClose={() => setShowManageAdmins(false)} />
      )}
    </div>
  );
}
