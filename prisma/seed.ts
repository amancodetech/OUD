import {UserRole, PartyType} from '@prisma/client';
import { PrismaClient } from '../src/lib/prisma-client.mjs';
import bcrypt from 'bcryptjs';
import { assertTestDatabase, testDatabaseUrl } from '../src/lib/test-database';

const testing = process.env.NODE_ENV === 'test';
const target = testing ? testDatabaseUrl() : process.env.SEED_DATABASE_URL;
if (!target) throw new Error('SEED_DATABASE_URL is required explicitly for initial setup');
const prisma = new PrismaClient({ datasources: { db: { url: target } } });

async function main() {
  if (testing) await assertTestDatabase(prisma);
  else if (await prisma.user.count() || await prisma.item.count() || await prisma.party.count()) throw new Error('Initial setup requires an empty database; existing data will not be overwritten');
  const initialPassword = testing ? 'admin123' : process.env.INITIAL_ADMIN_PASSWORD;
  if (!initialPassword || (!testing && initialPassword.length < 12)) throw new Error('A unique INITIAL_ADMIN_PASSWORD of at least 12 characters is required');
  console.log('Seeding initial ERP data...');

  // 1. System Setting
  await prisma.systemSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: 'محل العود والعطور',
      currencyLabel: 'روبية (IDR)',
      currencyCode: 'IDR',
      startYear: 2026,
      openingCash: 0,
      openingBank: 0,
      openingReviewed: false,
      approveOpeningAssets: false,
      openingLoans: 0,
      openingRetainedEarnings: 0,
      allowNegativeStock: false,
    },
  });

  // 2. Admin User
  const passwordHash = await bcrypt.hash(initialPassword, 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      displayName: 'مدير النظام',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // 3. 12 Item Categories
  const categories = [
    { name: 'عود طبيعي', prefix: 'NA', sortOrder: 1 },
    { name: 'عود محسن', prefix: 'EN', sortOrder: 2 },
    { name: 'عود معطر', prefix: 'PE', sortOrder: 3 },
    { name: 'دهن عود', prefix: 'OO', sortOrder: 4 },
    { name: 'مخلطات ومسك وعنبر وورد', prefix: 'MX', sortOrder: 5 },
    { name: 'عطور بارفان', prefix: 'PF', sortOrder: 6 },
    { name: 'مباخر وإكسسوارات', prefix: 'BA', sortOrder: 7 },
    { name: 'صناديق وعلب بخور', prefix: 'BX', sortOrder: 8 },
    { name: 'مسابح', prefix: 'SB', sortOrder: 9 },
    { name: 'قطع ديكور خشب', prefix: 'WD', sortOrder: 10 },
    { name: 'قهوة إندونيسيا', prefix: 'CF', sortOrder: 11 },
    { name: 'مواد خام وتغليف', prefix: 'RM', sortOrder: 12 },
  ];

  for (const cat of categories) {
    await prisma.itemCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // 4. 12 Unit Options
  const units = [
    'قطعة',
    'جرام',
    'كيلوجرام',
    'ملليلتر',
    'لتر',
    'تولة',
    'علبة',
    'صندوق',
    'طقم',
    'كيس',
    'عبوة',
    'درزن',
  ];

  for (let i = 0; i < units.length; i++) {
    await prisma.unitOption.upsert({
      where: { name: units[i] },
      update: {},
      create: {
        name: units[i],
        sortOrder: i + 1,
        isActive: true,
      },
    });
  }

  // 5. 13 Opening Fixed Assets (Total = 170,386,000)
  const assets = [
    { code: 'FA001', name: 'ديكور المحل', submittedValue: 87680000 },
    { code: 'FA002', name: 'مكيف', submittedValue: 5247000 },
    { code: 'FA003', name: 'عداد كهرباء المحل', submittedValue: 4502000 },
    { code: 'FA004', name: 'لوحة الإعلان الخارجية', submittedValue: 21000000 },
    { code: 'FA005', name: 'الباب الزجاجي', submittedValue: 22200000 },
    { code: 'FA006', name: 'صوفا 1 وكراسي 2 وطاولة 1', submittedValue: 13500000 },
    { code: 'FA007', name: 'عداد كهرباء الغرفة', submittedValue: 3000000 },
    { code: 'FA008', name: 'شبكة إنترنت', submittedValue: 280000 },
    { code: 'FA009', name: 'لاب توب', submittedValue: 6300000 },
    { code: 'FA010', name: 'كاميرات', submittedValue: 1400000 },
    { code: 'FA011', name: 'ميزانا بخور كبيران وميزان صغير', submittedValue: 1969000 },
    { code: 'FA012', name: 'براد شاي', submittedValue: 139000 },
    { code: 'FA013', name: 'سريران', submittedValue: 3169000 },
  ];

  for (const asset of assets) {
    await prisma.fixedAsset.upsert({
      where: { code: asset.code },
      update: {},
      create: {
        code: asset.code,
        name: asset.name,
        submittedValue: asset.submittedValue,
        isActive: true,
      },
    });
  }

  // 6. Default Funder: F001 | أخ المالك
  await prisma.party.upsert({
    where: { code: 'F001' },
    update: {},
    create: {
      code: 'F001',
      name: 'أخ المالك',
      type: PartyType.FUNDER,
      openingBalance: 0,
      isActive: true,
    },
  });

  // 7. Default Gift Policy
  await prisma.giftPolicy.upsert({
    where: { effectiveDate: new Date('2026-01-01') },
    update: {},
    create: {
      effectiveDate: new Date('2026-01-01'),
      customersPerGift: 10,
      giftValue: 100000,
      notes: 'سياسة الهدايا الافتراضية: هدية لكل 10 عملاء بقيمة 100,000',
    },
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
