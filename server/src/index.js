require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { requireAuth, requireBuildingAccess, blockResidentWrites, requireCommittee } = require('./middleware/auth');
const meRoutes = require('./routes/me');
const timelineRoutes = require('./routes/timeline');
const providersRoutes = require('./routes/providers');
const profileRoutes = require('./routes/profile');
const authRoutes = require('./routes/auth');
const buildingsListRoutes = require('./routes/buildings');
const buildingRoutes = require('./routes/building');
const tenantsRoutes = require('./routes/tenants');
const duesRoutes = require('./routes/dues');
const tasksRoutes = require('./routes/tasks');
const expensesRoutes = require('./routes/expenses');
const budgetRoutes = require('./routes/budget');
const complexesRoutes = require('./routes/complexes');
const minutesRoutes = require('./routes/minutes');
const proceduresRoutes = require('./routes/procedures');
const announcementsRoutes = require('./routes/announcements');
const { router: publicRoutes } = require('./routes/public');
const professionalsRoutes = require('./routes/professionals');
const settingsRoutes = require('./routes/settings');
const suggestionsRoutes = require('./routes/suggestions');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/buildings', buildingsListRoutes);
app.use('/api/complexes', complexesRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/professionals', professionalsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/admin', adminRoutes);

// Every building-scoped resource lives under /api/buildings/:buildingId/... and requires
// the caller to be authenticated and to have access to that specific building.
const buildingScope = express.Router({ mergeParams: true });
buildingScope.use('/', buildingRoutes);
// Open to every role: a resident's own page, the year timeline, the building/complex profile
// and the tasks (building + complex). Residents can read these but never change them (apart
// from /me, see blockResidentWrites).
buildingScope.use('/me', meRoutes);
buildingScope.use('/timeline', timelineRoutes);
buildingScope.use('/profile', profileRoutes);
buildingScope.use('/providers', providersRoutes);
buildingScope.use('/tasks', tasksRoutes);
buildingScope.use('/announcements', announcementsRoutes);
// Everything about other residents or money: committee reps (and the site admin) only.
buildingScope.use('/tenants', requireCommittee, tenantsRoutes);
buildingScope.use('/dues', requireCommittee, duesRoutes);
buildingScope.use('/expenses', requireCommittee, expensesRoutes);
buildingScope.use('/budget', requireCommittee, budgetRoutes);
buildingScope.use('/minutes', requireCommittee, minutesRoutes);
buildingScope.use('/procedures', requireCommittee, proceduresRoutes);

app.use('/api/buildings/:buildingId', requireAuth, requireBuildingAccess, blockResidentWrites, buildingScope);

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
