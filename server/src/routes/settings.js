const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { getAppSettings } = require('./public');

const router = express.Router();

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'פעולה זו מיועדת למנהל-על בלבד' });
  next();
}

router.get('/', requireAuth, requireSuperAdmin, async (req, res) => {
  res.json(await getAppSettings());
});

router.put('/', requireAuth, requireSuperAdmin, async (req, res) => {
  const { showBuildingCountStat } = req.body;
  const updated = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: { ...(showBuildingCountStat !== undefined && { showBuildingCountStat: Boolean(showBuildingCountStat) }) },
    create: { id: 1, showBuildingCountStat: showBuildingCountStat !== undefined ? Boolean(showBuildingCountStat) : true },
  });
  res.json(updated);
});

module.exports = router;
