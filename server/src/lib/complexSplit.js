const { round2 } = require('./calc');

// Deterministic proportional split of a shared amount across member buildings.
// A member with sharePercent === null falls back to an equal share; the final
// member (by the given order) absorbs any leftover cent from rounding so the
// parts always sum exactly to the original amount.
function computeSplits(amount, members) {
  const n = members.length;
  if (n === 0) return [];
  const equalPercent = 100 / n;

  const parts = members.map((m) => {
    const percent = m.sharePercent !== null && m.sharePercent !== undefined ? Number(m.sharePercent) : equalPercent;
    return round2((Number(amount) * percent) / 100);
  });

  const diff = round2(Number(amount) - parts.reduce((sum, p) => sum + p, 0));
  if (diff !== 0) parts[parts.length - 1] = round2(parts[parts.length - 1] + diff);

  return members.map((m, i) => ({ buildingId: m.buildingId, amount: parts[i] }));
}

module.exports = { computeSplits };
