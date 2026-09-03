const express = require('express');
const prisma = require('../lib/prisma');
const { getBuilding, getBalance } = require('../lib/calc');

const router = express.Router({ mergeParams: true });

router.get('/', async (req, res) => {
  const building = await getBuilding(req.buildingId);
  if (!building) return res.status(404).json({ error: 'בניין לא נמצא' });
  res.json(building);
});

router.put('/', async (req, res) => {
  const {
    name, address, floors, apartmentsCount, monthlyFeeDefault,
    openingBalanceCash, openingBalanceDigital, openingBalanceDate,
    elevatorsCount, electricityBenchmark, cleaningBenchmark, gardeningBenchmark,
  } = req.body;

  const updated = await prisma.building.update({
    where: { id: req.buildingId },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(floors !== undefined && { floors: Number(floors) }),
      ...(apartmentsCount !== undefined && { apartmentsCount: Number(apartmentsCount) }),
      ...(monthlyFeeDefault !== undefined && { monthlyFeeDefault: Number(monthlyFeeDefault) }),
      ...(openingBalanceCash !== undefined && { openingBalanceCash: Number(openingBalanceCash) }),
      ...(openingBalanceDigital !== undefined && { openingBalanceDigital: Number(openingBalanceDigital) }),
      ...(openingBalanceDate !== undefined && { openingBalanceDate: new Date(openingBalanceDate) }),
      ...(elevatorsCount !== undefined && { elevatorsCount: Number(elevatorsCount) }),
      ...(electricityBenchmark !== undefined && { electricityBenchmark: Number(electricityBenchmark) }),
      ...(cleaningBenchmark !== undefined && { cleaningBenchmark: Number(cleaningBenchmark) }),
      ...(gardeningBenchmark !== undefined && { gardeningBenchmark: Number(gardeningBenchmark) }),
      isConfigured: true,
    },
  });
  res.json(updated);
});

router.get('/balance', async (req, res) => {
  const balance = await getBalance(req.buildingId);
  res.json(balance);
});

module.exports = router;
