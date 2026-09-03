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

export const api = {
  // Auth
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Buildings (multi-tenant)
  getBuildings: () => request('/buildings'),
  createBuilding: (data) => request('/buildings', { method: 'POST', body: JSON.stringify(data) }),

  // Building settings
  getBuilding: (buildingId) => request(`/buildings/${buildingId}`),
  updateBuilding: (buildingId, data) => request(`/buildings/${buildingId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getBalance: (buildingId) => request(`/buildings/${buildingId}/balance`),

  // Tenants
  getTenants: (buildingId) => request(`/buildings/${buildingId}/tenants`),
  createTenant: (buildingId, data) => request(`/buildings/${buildingId}/tenants`, { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (buildingId, id, data) => request(`/buildings/${buildingId}/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTenant: (buildingId, id) => request(`/buildings/${buildingId}/tenants/${id}`, { method: 'DELETE' }),

  // Dues
  getDuesMatrix: (buildingId, year) => request(`/buildings/${buildingId}/dues?year=${year}`),
  reportCash: (buildingId, id) => request(`/buildings/${buildingId}/dues/${id}/report-cash`, { method: 'POST' }),
  approveCash: (buildingId, id) => request(`/buildings/${buildingId}/dues/${id}/approve-cash`, { method: 'POST' }),
  markBank: (buildingId, id) => request(`/buildings/${buildingId}/dues/${id}/mark-bank`, { method: 'POST' }),
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

  // Budget
  getBudgetItems: (buildingId) => request(`/buildings/${buildingId}/budget`),
  createBudgetItem: (buildingId, data) => request(`/buildings/${buildingId}/budget`, { method: 'POST', body: JSON.stringify(data) }),
  updateBudgetItem: (buildingId, id, data) => request(`/buildings/${buildingId}/budget/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBudgetItem: (buildingId, id) => request(`/buildings/${buildingId}/budget/${id}`, { method: 'DELETE' }),
  getProjection: (buildingId, year) => request(`/buildings/${buildingId}/budget/projection?year=${year}`),
};
