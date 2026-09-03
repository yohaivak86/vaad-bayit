require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { requireAuth, requireBuildingAccess } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const buildingsListRoutes = require('./routes/buildings');
const buildingRoutes = require('./routes/building');
const tenantsRoutes = require('./routes/tenants');
const duesRoutes = require('./routes/dues');
const tasksRoutes = require('./routes/tasks');
const expensesRoutes = require('./routes/expenses');
const budgetRoutes = require('./routes/budget');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/buildings', buildingsListRoutes);

// Every building-scoped resource lives under /api/buildings/:buildingId/... and requires
// the caller to be authenticated and to have access to that specific building.
const buildingScope = express.Router({ mergeParams: true });
buildingScope.use('/', buildingRoutes);
buildingScope.use('/tenants', tenantsRoutes);
buildingScope.use('/dues', duesRoutes);
buildingScope.use('/tasks', tasksRoutes);
buildingScope.use('/expenses', expensesRoutes);
buildingScope.use('/budget', budgetRoutes);

app.use('/api/buildings/:buildingId', requireAuth, requireBuildingAccess, buildingScope);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve the built React client in production.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`vaad-bayit server listening on port ${PORT}`);
});
