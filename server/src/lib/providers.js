const prisma = require('./prisma');

function shape(p, extra = {}) {
  return { id: p.id, name: p.name, category: p.category, phone: p.phone, email: p.email, notes: p.notes, ...extra };
}

// Everyone serving one building: its own providers plus the complex-level providers the
// complex's owner linked to it (those are labelled with the complex they come through).
async function listBuildingProviders(buildingId) {
  const own = await prisma.serviceProvider.findMany({ where: { buildingId }, orderBy: { name: 'asc' } });
  const links = await prisma.serviceProviderLink.findMany({
    // Only while the building is still a member of the provider's complex.
    where: { buildingId, provider: { complex: { members: { some: { buildingId } } } } },
    include: { provider: { include: { complex: { select: { id: true, name: true } } } } },
  });

  return [
    ...own.map((p) => shape(p, { scope: 'BUILDING' })),
    ...links.map((l) => shape(l.provider, { scope: 'COMPLEX', complexId: l.provider.complex?.id, complexName: l.provider.complex?.name })),
  ];
}

module.exports = { listBuildingProviders, shape };
