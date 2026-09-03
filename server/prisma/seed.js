const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'yohaivak86@gmail.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'changeme123';

const APARTMENTS = [
  { floor: 0, apartmentNumber: '1' },
  { floor: 0, apartmentNumber: '2' },
  { floor: 1, apartmentNumber: '3' },
  { floor: 1, apartmentNumber: '4' },
  { floor: 1, apartmentNumber: '5' },
  { floor: 2, apartmentNumber: '6' },
  { floor: 2, apartmentNumber: '7' },
  { floor: 2, apartmentNumber: '8' },
  { floor: 3, apartmentNumber: '9' },
  { floor: 3, apartmentNumber: '10' },
  { floor: 3, apartmentNumber: '11' },
  { floor: 4, apartmentNumber: '12' },
  { floor: 4, apartmentNumber: '13' },
  { floor: 5, apartmentNumber: '14' },
];

const BUDGET_ITEMS = [
  { category: 'ניקיון', label: 'ניקיון חדר מדרגות', frequency: 'MONTHLY', amount: 900, months: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { category: 'גינון', label: 'תחזוקת גינה', frequency: 'MONTHLY', amount: 400, months: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { category: 'מעליות', label: 'חוזה שירות מעליות', frequency: 'MONTHLY', amount: 350, months: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { category: 'שונות', label: 'אינטרנט לובי', frequency: 'MONTHLY', amount: 100, months: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { category: 'שונות', label: 'קרן תחזוקה שוטפת', frequency: 'MONTHLY', amount: 300, months: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { category: 'חשמל', label: 'חברת חשמל (דו-חודשי)', frequency: 'BIMONTHLY', amount: 1600, months: [2,4,6,8,10,12] },
  { category: 'מעליות', label: 'בודק מעליות מוסמך', frequency: 'SEMIANNUAL', amount: 600, months: [3,9] },
  { category: 'שונות', label: 'חיטוי מאגר מים', frequency: 'SEMIANNUAL', amount: 500, months: [4,10] },
  { category: 'ביטוח', label: 'ביטוח מבנה שנתי', frequency: 'ANNUAL', amount: 4500, months: [1] },
  { category: 'בזק/סים כיבוי אש', label: 'סים כיבוי אש שנתי', frequency: 'ANNUAL', amount: 600, months: [6] },
  { category: 'תרבות הדיור', label: 'אגודה לתרבות הדיור', frequency: 'ANNUAL', amount: 350, months: [1] },
];

async function main() {
  // Super-admin: sees and manages every building in the system, regardless of membership.
  let superAdmin = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        name: 'יוחאי',
        role: 'SUPER_ADMIN',
        passwordHash: await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10),
      },
    });
    console.log(`Created super admin: ${SUPER_ADMIN_EMAIL} (password: ${SUPER_ADMIN_PASSWORD})`);
  }

  let building = await prisma.building.findFirst({ where: { name: 'נחל דליות 8' } });
  if (!building) {
    building = await prisma.building.create({
      data: {
        name: 'נחל דליות 8',
        address: 'נחל דליות 8',
        floors: 6,
        apartmentsCount: APARTMENTS.length,
        monthlyFeeDefault: 350,
        openingBalanceCash: 1200,
        openingBalanceBank: 15000,
        openingBalancePaybox: 3500,
        openingBalanceDate: new Date(),
        elevatorsCount: 1,
        electricityBenchmark: 1600,
        cleaningBenchmark: 900,
        gardeningBenchmark: 400,
        isConfigured: true,
      },
    });
    console.log('Created building: נחל דליות 8');

    for (const apt of APARTMENTS) {
      await prisma.tenant.create({
        data: {
          buildingId: building.id,
          floor: apt.floor,
          apartmentNumber: apt.apartmentNumber,
          name: `דייר/ת דירה ${apt.apartmentNumber}`,
          phone: `050-000${apt.apartmentNumber.padStart(4, '0')}`,
          role: 'OWNER',
        },
      });
    }
    console.log(`Created ${APARTMENTS.length} sample tenants`);

    for (const item of BUDGET_ITEMS) {
      await prisma.budgetItem.create({ data: { ...item, buildingId: building.id } });
    }
    console.log(`Created ${BUDGET_ITEMS.length} budget lines`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
