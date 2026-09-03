const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `שגיאת שרת (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Separate from request(): a file upload must NOT set a JSON Content-Type header -
// the browser needs to set multipart/form-data with its own boundary.
async function uploadFile(path, file, fieldName) {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `שגיאת שרת (${res.status})`);
  }
  return res.json();
}

export const api = {
  // Auth
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  joinBuilding: (data) => request('/auth/join-building', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Buildings (multi-tenant)
  getBuildings: () => request('/buildings'),
  createBuilding: (data) => request('/buildings', { method: 'POST', body: JSON.stringify(data) }),

  // Building settings
  getBuilding: (buildingId) => request(`/buildings/${buildingId}`),
  updateBuilding: (buildingId, data) => request(`/buildings/${buildingId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getBalance: (buildingId) => request(`/buildings/${buildingId}/balance`),
  getBuildingAdmins: (buildingId) => request(`/buildings/${buildingId}/admins`),
  addBuildingAdmin: (buildingId, data) => request(`/buildings/${buildingId}/admins`, { method: 'POST', body: JSON.stringify(data) }),
  approveBuildingAdmin: (buildingId, userId, role) => request(`/buildings/${buildingId}/admins/${userId}/approve`, { method: 'POST', body: JSON.stringify({ role }) }),
  updateBuildingAdminRole: (buildingId, userId, role) => request(`/buildings/${buildingId}/admins/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) }),
  removeBuildingAdmin: (buildingId, userId) => request(`/buildings/${buildingId}/admins/${userId}`, { method: 'DELETE' }),
  regenerateInviteCode: (buildingId) => request(`/buildings/${buildingId}/invite-code/regenerate`, { method: 'POST' }),

  // Complexes (multiple buildings sharing costs)
  getMyComplexes: () => request('/complexes/mine'),
  getComplex: (id) => request(`/complexes/${id}`),
  createComplex: (data) => request('/complexes', { method: 'POST', body: JSON.stringify(data) }),
  joinComplex: (data) => request('/complexes/join', { method: 'POST', body: JSON.stringify(data) }),
  removeComplexMember: (id, buildingId) => request(`/complexes/${id}/members/${buildingId}`, { method: 'DELETE' }),
  updateComplexShares: (id, shares) => request(`/complexes/${id}/shares`, { method: 'PUT', body: JSON.stringify({ shares }) }),
  regenerateComplexCode: (id) => request(`/complexes/${id}/regenerate-code`, { method: 'POST' }),
  getComplexExpenses: (id) => request(`/complexes/${id}/expenses`),
  createComplexExpense: (id, data) => request(`/complexes/${id}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
  deleteComplexExpense: (id, expenseId) => request(`/complexes/${id}/expenses/${expenseId}`, { method: 'DELETE' }),

  // Tenants
  getTenants: (buildingId) => request(`/buildings/${buildingId}/tenants`),
  createTenant: (buildingId, data) => request(`/buildings/${buildingId}/tenants`, { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (buildingId, id, data) => request(`/buildings/${buildingId}/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTenant: (buildingId, id) => request(`/buildings/${buildingId}/tenants/${id}`, { method: 'DELETE' }),
  reorderTenants: (buildingId, tenantIds) => request(`/buildings/${buildingId}/tenants/reorder`, { method: 'PUT', body: JSON.stringify({ tenantIds }) }),

  // Dues
  getDuesMatrix: (buildingId, year) => request(`/buildings/${buildingId}/dues?year=${year}`),
  reportCash: (buildingId, id) => request(`/buildings/${buildingId}/dues/${id}/report-cash`, { method: 'POST' }),
  approveCash: (buildingId, id) => request(`/buildings/${buildingId}/dues/${id}/approve-cash`, { method: 'POST' }),
  markBank: (buildingId, id) => request(`/buildings/${buildingId}/dues/${id}/mark-bank`, { method: 'POST' }),
  markPaybox: (buildingId, id) => request(`/buildings/${buildingId}/dues/${id}/mark-paybox`, { method: 'POST' }),
  markUnpaid: (buildingId, id) => request(`/buildings/${buildingId}/dues/${id}/mark-unpaid`, { method: 'POST' }),

  // Tasks
  getTasks: (buildingId) => request(`/buildings/${buildingId}/tasks`),
  createTask: (buildingId, data) => request(`/buildings/${buildingId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (buildingId, id, data) => request(`/buildings/${buildingId}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (buildingId, id) => request(`/buildings/${buildingId}/tasks/${id}`, { method: 'DELETE' }),

  // Expenses
  getExpenses: (buildingId, params) => request(`/buildings/${buildingId}/expenses?${new URLSearchParams(params).toString()}`),
  getExpensesSummary: (buildingId, params) => request(`/buildings/${buildingId}/expenses/summary?${new URLSearchParams(params).toString()}`),
  createExpense: (buildingId, data) => request(`/buildings/${buildingId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (buildingId, id, data) => request(`/buildings/${buildingId}/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (buildingId, id) => request(`/buildings/${buildingId}/expenses/${id}`, { method: 'DELETE' }),
  uploadReceipt: (buildingId, id, file) => uploadFile(`/buildings/${buildingId}/expenses/${id}/receipt`, file, 'receipt'),
  getReceiptUrl: (buildingId, id) => `${BASE}/buildings/${buildingId}/expenses/${id}/receipt`,
  deleteReceipt: (buildingId, id) => request(`/buildings/${buildingId}/expenses/${id}/receipt`, { method: 'DELETE' }),

  // Budget
  getBudgetItems: (buildingId) => request(`/buildings/${buildingId}/budget`),
  createBudgetItem: (buildingId, data) => request(`/buildings/${buildingId}/budget`, { method: 'POST', body: JSON.stringify(data) }),
  updateBudgetItem: (buildingId, id, data) => request(`/buildings/${buildingId}/budget/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBudgetItem: (buildingId, id) => request(`/buildings/${buildingId}/budget/${id}`, { method: 'DELETE' }),
  getProjection: (buildingId, year) => request(`/buildings/${buildingId}/budget/projection?year=${year}`),

  // Meeting minutes
  getMinutes: (buildingId) => request(`/buildings/${buildingId}/minutes`),
  createMinutes: (buildingId, data) => request(`/buildings/${buildingId}/minutes`, { method: 'POST', body: JSON.stringify(data) }),
  deleteMinutes: (buildingId, id) => request(`/buildings/${buildingId}/minutes/${id}`, { method: 'DELETE' }),

  // Procedures
  getProcedures: (buildingId) => request(`/buildings/${buildingId}/procedures`),
  createProcedure: (buildingId, data) => request(`/buildings/${buildingId}/procedures`, { method: 'POST', body: JSON.stringify(data) }),
  updateProcedure: (buildingId, id, data) => request(`/buildings/${buildingId}/procedures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProcedure: (buildingId, id) => request(`/buildings/${buildingId}/procedures/${id}`, { method: 'DELETE' }),

  // Announcements
  getAnnouncements: (buildingId) => request(`/buildings/${buildingId}/announcements`),
  createAnnouncement: (buildingId, data) => request(`/buildings/${buildingId}/announcements`, { method: 'POST', body: JSON.stringify(data) }),
  deleteAnnouncement: (buildingId, id) => request(`/buildings/${buildingId}/announcements/${id}`, { method: 'DELETE' }),
};
