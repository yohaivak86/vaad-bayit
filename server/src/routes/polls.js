const express = require('express');
const prisma = require('../lib/prisma');
const { requireCommittee } = require('../middleware/auth');
const { tenantForUser } = require('../lib/apartments');

// Building votes. Everyone in the building can see the polls and their aggregate results (never who
// voted what); committee reps create / close / delete them and read the change log. A vote belongs to
// an APARTMENT: however many residents it has, it counts once - and changing it asks for confirmation
// and is written to a log the committee can read.
const router = express.Router({ mergeParams: true });

const isClosed = (poll) => poll.status === 'CLOSED' || (poll.closesAt && poll.closesAt < new Date());

async function eligibleApartments(buildingId) {
  const tenants = await prisma.tenant.findMany({ where: { buildingId, active: true }, select: { apartmentNumber: true } });
  return new Set(tenants.map((t) => t.apartmentNumber.trim())).size;
}

// Aggregates only - no voter identities.
function shape(poll, votes, eligible, myVote) {
  const counts = poll.options.map((_, i) => votes.filter((v) => v.optionIndex === i).length);
  const total = votes.length;
  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    status: isClosed(poll) ? 'CLOSED' : 'OPEN',
    closesAt: poll.closesAt,
    createdAt: poll.createdAt,
    options: poll.options.map((label, i) => ({
      index: i,
      label,
      votes: counts[i],
      percent: total ? Math.round((counts[i] / total) * 100) : 0,
    })),
    totalVotes: total,
    eligibleApartments: eligible,
    participationPercent: eligible ? Math.round((total / eligible) * 100) : 0,
    myVote, // { optionIndex } for the caller's own apartment, or null
  };
}

async function myApartmentKey(req) {
  const tenant = await tenantForUser(req.buildingId, req.user.id);
  return tenant ? tenant.apartmentNumber.trim() : null;
}

router.get('/', async (req, res) => {
  const [polls, eligible, apartment] = await Promise.all([
    prisma.poll.findMany({ where: { buildingId: req.buildingId }, include: { votes: true }, orderBy: { createdAt: 'desc' } }),
    eligibleApartments(req.buildingId),
    myApartmentKey(req),
  ]);
  res.json({
    canVote: Boolean(apartment),
    apartmentNumber: apartment,
    polls: polls.map((p) => {
      const mine = apartment ? p.votes.find((v) => v.apartmentNumber === apartment) : null;
      return shape(p, p.votes, eligible, mine ? { optionIndex: mine.optionIndex } : null);
    }),
  });
});

router.post('/', requireCommittee, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const options = [...new Set((Array.isArray(req.body.options) ? req.body.options : []).map((o) => String(o).trim()).filter(Boolean))];
  if (!title) return res.status(400).json({ error: 'יש להזין נושא להצבעה' });
  if (options.length < 2 || options.length > 8) return res.status(400).json({ error: 'נדרשות בין 2 ל-8 אפשרויות שונות' });
  const closesAt = req.body.closesAt ? new Date(req.body.closesAt) : null;
  if (closesAt && Number.isNaN(closesAt.getTime())) return res.status(400).json({ error: 'תאריך סגירה לא תקין' });

  const poll = await prisma.poll.create({
    data: { buildingId: req.buildingId, title, description: req.body.description ? String(req.body.description) : null, options, closesAt, createdById: req.user.id },
    include: { votes: true },
  });
  res.status(201).json(shape(poll, [], await eligibleApartments(req.buildingId), null));
});

async function loadPoll(req, res) {
  const poll = await prisma.poll.findFirst({ where: { id: Number(req.params.id), buildingId: req.buildingId } });
  if (!poll) res.status(404).json({ error: 'ההצבעה לא נמצאה' });
  return poll;
}

// Close / reopen (status) or edit the text. The options of a poll are fixed once it exists.
router.put('/:id', requireCommittee, async (req, res) => {
  const poll = await loadPoll(req, res);
  if (!poll) return;
  const { status, title, description, closesAt } = req.body;
  if (status !== undefined && !['OPEN', 'CLOSED'].includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });

  const updated = await prisma.poll.update({
    where: { id: poll.id },
    data: {
      ...(status !== undefined && { status, ...(status === 'OPEN' && poll.closesAt && poll.closesAt < new Date() ? { closesAt: null } : {}) }),
      ...(title !== undefined && String(title).trim() && { title: String(title).trim() }),
      ...(description !== undefined && { description: description || null }),
      ...(closesAt !== undefined && { closesAt: closesAt ? new Date(closesAt) : null }),
    },
    include: { votes: true },
  });
  res.json(shape(updated, updated.votes, await eligibleApartments(req.buildingId), null));
});

router.delete('/:id', requireCommittee, async (req, res) => {
  const poll = await loadPoll(req, res);
  if (!poll) return;
  await prisma.poll.delete({ where: { id: poll.id } });
  res.status(204).end();
});

// The committee's log of changed votes (who changed an apartment's vote, from what to what).
router.get('/:id/log', requireCommittee, async (req, res) => {
  const poll = await loadPoll(req, res);
  if (!poll) return;
  const logs = await prisma.voteLog.findMany({ where: { pollId: poll.id }, orderBy: { createdAt: 'desc' } });
  res.json(
    logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      apartmentNumber: l.apartmentNumber,
      changedBy: l.changedByName,
      previousVoter: l.previousVoterName,
      previousOption: poll.options[l.previousOption] ?? '?',
      newOption: poll.options[l.newOption] ?? '?',
    }))
  );
});

// Cast or change the caller's apartment vote. Changing an existing vote needs `confirm: true` - without it the
// server answers 409 with who voted what, so the client can ask "X already voted Y - update?".
router.post('/:id/vote', async (req, res) => {
  const poll = await loadPoll(req, res);
  if (!poll) return;
  if (isClosed(poll)) return res.status(400).json({ error: 'ההצבעה נסגרה' });

  const optionIndex = Number(req.body.optionIndex);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
    return res.status(400).json({ error: 'אפשרות לא תקינה' });
  }
  const apartment = await myApartmentKey(req);
  if (!apartment) return res.status(403).json({ error: 'החשבון שלך עדיין לא משויך לדירה - פנו לנציג הוועד כדי להצביע' });

  const existing = await prisma.vote.findUnique({ where: { pollId_apartmentNumber: { pollId: poll.id, apartmentNumber: apartment } } });

  if (!existing) {
    try {
      await prisma.vote.create({ data: { pollId: poll.id, apartmentNumber: apartment, optionIndex, castById: req.user.id, castByName: req.user.name } });
      return res.status(201).json({ ok: true, changed: false });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
      // someone from the same apartment voted a moment ago - fall through to the "already voted" path
    }
  }
  const current = existing || (await prisma.vote.findUnique({ where: { pollId_apartmentNumber: { pollId: poll.id, apartmentNumber: apartment } } }));

  if (current.optionIndex === optionIndex) return res.json({ ok: true, changed: false });

  if (!req.body.confirm) {
    return res.status(409).json({
      error: 'כבר הצביעו מהדירה הזו',
      code: 'CONFIRM_CHANGE',
      voterName: current.castByName,
      isSelf: current.castById === req.user.id,
      currentOption: poll.options[current.optionIndex],
      newOption: poll.options[optionIndex],
    });
  }

  await prisma.$transaction([
    prisma.vote.update({ where: { id: current.id }, data: { optionIndex, castById: req.user.id, castByName: req.user.name } }),
    prisma.voteLog.create({
      data: {
        pollId: poll.id,
        apartmentNumber: apartment,
        changedById: req.user.id,
        changedByName: req.user.name,
        previousVoterName: current.castByName,
        previousOption: current.optionIndex,
        newOption: optionIndex,
      },
    }),
  ]);
  res.json({ ok: true, changed: true });
});

module.exports = router;
