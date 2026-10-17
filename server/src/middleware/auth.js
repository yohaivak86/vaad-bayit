const prisma = require('../lib/prisma');
const { COOKIE_NAME, verifyToken } = require('../lib/auth');

// Three permission levels:
//   SITE_ADMIN  - User.role === 'SUPER_ADMIN'. Only they can make someone else a site admin.
//   COMMITTEE   - נציג ועד, per building. Granted by a site admin or a committee rep of that building.
//   RESIDENT    - דייר, the default. Sees only their own details; can only submit requests.
// Rows written before this model used ADMIN/VIEWER - normalized on read.
function normalizeBuildingRole(role) {
  if (role === 'ADMIN' || role === 'COMMITTEE') return 'COMMITTEE';
  return 'RESIDENT';
}

async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'נדרשת התחברות' });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return res.status(401).json({ error: 'נדרשת התחברות' });

  req.user = user;
  next();
}

// Verifies req.user can access the building in req.params.buildingId, and records their
// level there (req.buildingRole = COMMITTEE | RESIDENT; a site admin counts as COMMITTEE).
async function requireBuildingAccess(req, res, next) {
  const buildingId = Number(req.params.buildingId);
  if (!buildingId) return res.status(400).json({ error: 'buildingId חסר' });

  if (req.user.role === 'SUPER_ADMIN') {
    req.buildingId = buildingId;
    req.buildingRole = 'COMMITTEE';
    req.isSiteAdmin = true;
    return next();
  }

  const membership = await prisma.buildingAdmin.findUnique({
    where: { userId_buildingId: { userId: req.user.id, buildingId } },
  });
  if (!membership) return res.status(403).json({ error: 'אין הרשאה לבניין זה' });
  if (membership.status === 'PENDING') {
    return res.status(403).json({ error: 'הבקשה שלך להצטרף לבניין ממתינה לאישור נציג ועד' });
  }

  req.buildingId = buildingId;
  req.buildingRole = normalizeBuildingRole(membership.role);
  req.isSiteAdmin = false;
  next();
}

// Residents can't enter data - the only writes they get are under /me (their own details and
// requests such as reporting a cash payment, which a committee rep must then approve).
function blockResidentWrites(req, res, next) {
  // Residents may also open a fault (POST /tasks) and edit their own report (PUT /tasks/:id) -
  // the route itself restricts that to reports they opened.
  const residentTaskWrite = (req.method === 'POST' && req.path === '/tasks') || (req.method === 'PUT' && /^\/tasks\/\d+$/.test(req.path));
  const residentVote = req.method === 'POST' && /^\/polls\/\d+\/vote$/.test(req.path);
  if (req.method !== 'GET' && req.buildingRole === 'RESIDENT' && !residentTaskWrite && !residentVote && !/^\/me(\/|$)/.test(req.path)) {
    return res.status(403).json({ error: 'דייר יכול רק לשלוח בקשות - ביצוע שינויים מתבצע על ידי נציג ועד' });
  }
  next();
}

// Everything financial / about other residents: committee reps (and the site admin) only.
function requireCommittee(req, res, next) {
  if (req.buildingRole !== 'COMMITTEE') {
    return res.status(403).json({ error: 'מסך זה זמין לנציגי ועד בלבד' });
  }
  next();
}

// Readable by every role, changeable by committee reps only (documents: protocols, procedures).
function committeeWritesOnly(req, res, next) {
  if (req.method === 'GET') return next();
  return requireCommittee(req, res, next);
}

function requireSiteAdmin(req, res, next) {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'פעולה זו מיועדת למנהל אתר בלבד' });
  next();
}

module.exports = {
  normalizeBuildingRole,
  requireAuth,
  requireBuildingAccess,
  blockResidentWrites,
  requireCommittee,
  committeeWritesOnly,
  requireSiteAdmin,
};
