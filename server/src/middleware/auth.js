const prisma = require('../lib/prisma');
const { COOKIE_NAME, verifyToken } = require('../lib/auth');

async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'נדרשת התחברות' });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return res.status(401).json({ error: 'נדרשת התחברות' });

  req.user = user;
  next();
}

// Verifies req.user (set by requireAuth) can access the building in req.params.buildingId.
async function requireBuildingAccess(req, res, next) {
  const buildingId = Number(req.params.buildingId);
  if (!buildingId) return res.status(400).json({ error: 'buildingId חסר' });

  if (req.user.role === 'SUPER_ADMIN') {
    req.buildingId = buildingId;
    return next();
  }

  const membership = await prisma.buildingAdmin.findUnique({
    where: { userId_buildingId: { userId: req.user.id, buildingId } },
  });
  if (!membership) return res.status(403).json({ error: 'אין הרשאה לבניין זה' });

  req.buildingId = buildingId;
  next();
}

module.exports = { requireAuth, requireBuildingAccess };
