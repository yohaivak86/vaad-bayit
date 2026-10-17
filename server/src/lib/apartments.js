const prisma = require('./prisma');

// A resident account belongs to an apartment (a Tenant row). The first account is Tenant.userId; any
// further residents of the same apartment are ApartmentResident rows - so the whole household can log in,
// see the apartment's details and dues, and still count as ONE vote.

async function tenantForUser(buildingId, userId) {
  const primary = await prisma.tenant.findFirst({ where: { buildingId, userId } });
  if (primary) return primary;
  const extra = await prisma.apartmentResident.findUnique({
    where: { buildingId_userId: { buildingId, userId } },
    include: { tenant: true },
  });
  return extra?.tenant ?? null;
}

async function unlinkUser(buildingId, userId) {
  await prisma.tenant.updateMany({ where: { buildingId, userId }, data: { userId: null } });
  await prisma.apartmentResident.deleteMany({ where: { buildingId, userId } });
}

// Links the user to the apartment (replacing any earlier link in this building). tenantId null = just unlink.
async function linkUserToTenant(buildingId, userId, tenantId) {
  await unlinkUser(buildingId, userId);
  if (!tenantId) return null;
  const tenant = await prisma.tenant.findFirst({ where: { id: Number(tenantId), buildingId } });
  if (!tenant) throw Object.assign(new Error('הדירה לא נמצאה'), { status: 404 });

  if (!tenant.userId) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { userId } });
  } else {
    await prisma.apartmentResident.create({ data: { tenantId: tenant.id, buildingId, userId } });
  }
  return tenant;
}

// userId -> tenant, for a batch of users (the members list).
async function tenantsByUser(buildingId, userIds) {
  const [primary, extra] = await Promise.all([
    prisma.tenant.findMany({
      where: { buildingId, userId: { in: userIds } },
      select: { id: true, userId: true, apartmentNumber: true, name: true },
    }),
    prisma.apartmentResident.findMany({
      where: { buildingId, userId: { in: userIds } },
      include: { tenant: { select: { id: true, apartmentNumber: true, name: true } } },
    }),
  ]);
  const map = new Map(primary.map((t) => [t.userId, t]));
  extra.forEach((r) => map.set(r.userId, { ...r.tenant, userId: r.userId }));
  return map;
}

module.exports = { tenantForUser, unlinkUser, linkUserToTenant, tenantsByUser };
