const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

async function getAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

// Shown on the public login screen - a live building count, toggleable off by the super-admin.
router.get('/stats', async (req, res) => {
  const settings = await getAppSettings();
  if (!settings.showBuildingCountStat) return res.json({ show: false });

  const buildingsCount = await prisma.building.count();
  res.json({ show: true, buildingsCount });
});

// Public lead-capture form for tradespeople wanting to offer services through the platform.
// No login account is created here - just a directory row for building admins to browse.
router.post('/professionals', async (req, res) => {
  const { name, phone, email, profession, message, marketingConsent } = req.body;
  if (!name || !phone || !email || !profession) {
    return res.status(400).json({ error: 'name, phone, email ו-profession הם שדות חובה' });
  }
  if (!marketingConsent) {
    return res.status(400).json({ error: 'יש לאשר קבלת עדכונים והתראות כדי להירשם' });
  }
  const professional = await prisma.professional.create({
    data: { name, phone, email, profession, message: message || null, marketingConsent: true },
  });
  res.status(201).json({ id: professional.id });
});

module.exports = { router, getAppSettings };
