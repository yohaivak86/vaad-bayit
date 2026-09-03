const prisma = require('./prisma');
const { generateInviteCode } = require('./inviteCode');

function toNum(v) {
  if (v === null || v === undefined) return 0;
  return typeof v === 'object' && typeof v.toNumber === 'function' ? v.toNumber() : Number(v);
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Buildings created before invite codes existed don't have one yet - backfill lazily on read.
async function getBuilding(buildingId) {
  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building || building.inviteCode) return building;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.building.update({
        where: { id: buildingId },
        data: { inviteCode: generateInviteCode() },
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err; // unique clash on the code itself - retry with a new one
    }
  }
  return building;
}

// Deterministic dual-ledger balance: opening balance + confirmed income - paid expenses,
// computed separately per ledger (digital / cash) and never mixed.
async function getBalance(buildingId) {
  const building = await getBuilding(buildingId);

  const [digitalDuesSum, cashDuesSum, digitalExpSum, cashExpSum] = await Promise.all([
    prisma.due.aggregate({
      where: { status: 'PAID_BANK', tenant: { buildingId } },
      _sum: { amountDue: true },
    }),
    prisma.due.aggregate({
      where: { status: 'PAID_CASH', tenant: { buildingId } },
      _sum: { amountDue: true },
    }),
    prisma.expense.aggregate({ where: { buildingId, paidFrom: 'DIGITAL' }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { buildingId, paidFrom: 'CASH' }, _sum: { amount: true } }),
  ]);

  const digitalIncome = toNum(digitalDuesSum._sum.amountDue);
  const cashIncome = toNum(cashDuesSum._sum.amountDue);
  const digitalExpense = toNum(digitalExpSum._sum.amount);
  const cashExpense = toNum(cashExpSum._sum.amount);

  const digitalBalance = toNum(building.openingBalanceDigital) + digitalIncome - digitalExpense;
  const cashBalance = toNum(building.openingBalanceCash) + cashIncome - cashExpense;

  return {
    digitalBalance: round2(digitalBalance),
    cashBalance: round2(cashBalance),
    totalBalance: round2(digitalBalance + cashBalance),
  };
}

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

// Deterministic 12-month projection: current total treasury balance carried forward,
// plus scheduled monthly dues income minus scheduled budget-line expenses per month.
async function getBudgetProjection(buildingId, year) {
  const [building, tenants, budgetItems, currentBalance] = await Promise.all([
    getBuilding(buildingId),
    prisma.tenant.findMany({ where: { buildingId, active: true } }),
    prisma.budgetItem.findMany({ where: { buildingId } }),
    getBalance(buildingId),
  ]);

  const defaultFee = toNum(building.monthlyFeeDefault);
  const monthlyIncome = tenants.reduce(
    (sum, t) => sum + (t.monthlyFee !== null && t.monthlyFee !== undefined ? toNum(t.monthlyFee) : defaultFee),
    0
  );

  let running = currentBalance.totalBalance;
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const scheduledExpense = budgetItems
      .filter((b) => b.months.includes(m))
      .reduce((sum, b) => sum + toNum(b.amount), 0);
    const netChange = round2(monthlyIncome - scheduledExpense);
    running = round2(running + netChange);
    months.push({
      month: m,
      monthLabel: MONTHS_HE[m - 1],
      projectedIncome: round2(monthlyIncome),
      scheduledExpense: round2(scheduledExpense),
      netChange,
      endOfMonthBalance: running,
      isDeficit: running < 0,
    });
  }

  return {
    year,
    startingBalance: currentBalance.totalBalance,
    monthlyIncome: round2(monthlyIncome),
    months,
  };
}

module.exports = { toNum, round2, getBuilding, getBalance, getBudgetProjection, MONTHS_HE };
