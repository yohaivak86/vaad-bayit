const express = require('express');
const prisma = require('../lib/prisma');
const { getBuilding } = require('../lib/calc');
const { listBuildingProviders } = require('../lib/providers');

const router = express.Router({ mergeParams: true });

// Building profile - open to every role. Only identity details, the complex it belongs to and its
// service providers: nothing financial and nothing about individual residents (just a headcount).
router.get('/', async (req, res) => {
  const building = await getBuilding(req.buildingId);
  if (!building) return res.status(404).json({ error: 'בניין לא נמצא' });

  const member = await prisma.complexMember.findUnique({
    where: { buildingId: req.buildingId },
    include: { complex: { include: { members: { include: { building: { select: { id: true, name: true } } } } } } },
  });

  const [providers, residentsCount] = await Promise.all([
    listBuildingProviders(req.buildingId),
    prisma.tenant.count({ where: { buildingId: req.buildingId, active: true } }),
  ]);

  res.json({
    building: {
      id: building.id,
      name: building.name,
      address: building.address,
      floors: building.floors,
      apartmentsCount: building.apartmentsCount,
      elevatorsCount: building.elevatorsCount,
    },
    residentsCount,
    complex: member
      ? {
          id: member.complex.id,
          name: member.complex.name,
          buildings: member.complex.members.map((m) => ({ id: m.building.id, name: m.building.name })),
        }
      : null,
    providers,
  });
});

module.exports = router;
