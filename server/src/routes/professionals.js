const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// The directory of registered service providers - open to every logged-in building admin
// (any building, any role) for now; a paid-subscription gate is planned but not built yet.
router.get('/', requireAuth, async (req, res) => {
  const professionals = await prisma.professional.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(professionals);
});

module.exports = router;
