const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { sendEmail } = require('../lib/email');

const router = express.Router();

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'yohaivak86@gmail.com';
const VALID_STATUSES = ['NEW', 'IN_PROGRESS', 'DONE', 'REJECTED'];

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'פעולה זו מיועדת למנהל-על בלבד' });
  next();
}

// Submittable from anywhere in the app by any logged-in user.
router.post('/', requireAuth, async (req, res) => {
  const { text, buildingId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text הוא שדה חובה' });

  const suggestion = await prisma.suggestion.create({
    data: {
      text: text.trim(),
      userId: req.user.id,
      buildingId: buildingId ? Number(buildingId) : null,
    },
  });

  sendEmail({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: 'הצעה לשיפור חדשה - ועד בית',
    text: `התקבלה הצעה לשיפור חדשה\n\nמאת: ${req.user.name} (${req.user.email})\n\n${text.trim()}`,
  });

  res.status(201).json(suggestion);
});

router.get('/', requireAuth, requireSuperAdmin, async (req, res) => {
  const suggestions = await prisma.suggestion.findMany({
    include: { user: { select: { name: true, email: true } }, building: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(suggestions);
});

router.put('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status, adminNotes } = req.body;
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'status לא תקין' });
  }
  const updated = await prisma.suggestion.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(adminNotes !== undefined && { adminNotes }),
    },
  });
  res.json(updated);
});

module.exports = router;
