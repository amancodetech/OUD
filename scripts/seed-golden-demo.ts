import { PrismaClient, PartyType, ItemRole, RecordStatus, CashAccountType, CashTransactionType, ReturnType, SaleReturnCondition, StockIssueType, SaleLineType } from '@prisma/client';
import { assertTestDatabase } from '../src/lib/test-database';

const prisma = new PrismaClient();

export async function seedGoldenData(includeTransactions = true) {
  await assertTestDatabase(prisma);
  console.log(`--- Seeding Golden Demo Data (Include Transactions: ${includeTransactions}) ---`);

  // 1. Fetch categories & units
  const naCat = await prisma.itemCategory.findUnique({ where: { name: 'عود طبيعي' } });
  const rmCat = await prisma.itemCategory.findUnique({ where: { name: 'مواد خام وتغليف' } });
  const pfCat = await prisma.itemCategory.findUnique({ where: { name: 'عطور بارفان' } });

  const gramUnit = await prisma.unitOption.findUnique({ where: { name: 'جرام' } });
  const mlUnit = await prisma.unitOption.findUnique({ where: { name: 'ملليلتر' } });
  const pieceUnit = await prisma.unitOption.findUnique({ where: { name: 'قطعة' } });

  if (!naCat || !rmCat || !pfCat || !gramUnit || !mlUnit || !pieceUnit) {
    throw new Error('Required categories or units are missing. Please run prisma/seed.ts first.');
  }

  // 2. Clean existing transactions & leftovers if full seed requested
  console.log('Cleaning test/orphaned transactions...');
  await prisma.batchMaterial.deleteMany({});
  await prisma.productionBatch.deleteMany({});
  await prisma.stockIssue.deleteMany({});
  await prisma.returnLine.deleteMany({});
  await prisma.cashTransaction.deleteMany({});
  await prisma.saleLine.deleteMany({});
  await prisma.saleInvoice.deleteMany({});
  await prisma.purchaseLine.deleteMany({});
  await prisma.purchaseInvoice.deleteMany({});
  await prisma.driverReferral.deleteMany({});

  // 3. System Settings
  await prisma.systemSetting.upsert({
    where: { id: 1 },
    update: {
      startYear: 2026,
      openingCash: 5000000,
      openingBank: 20000000,
      approveOpeningAssets: false,
      openingReviewed: true,
      currencyCode: 'IDR',
      currencyLabel: 'روبية (IDR)',
      allowNegativeStock: false,
    },
    create: {
      id: 1,
      storeName: 'محل العود والعطور',
      currencyLabel: 'روبية (IDR)',
      currencyCode: 'IDR',
      startYear: 2026,
      openingCash: 5000000,
      openingBank: 20000000,
      openingReviewed: true,
      approveOpeningAssets: false,
      allowNegativeStock: false,
    },
  });

  // 4. Master Parties
  const partiesData = [
    {
      code: 'C001',
      name: 'أحمد السعيدي',
      type: PartyType.CLIENT,
      phone: '08123456789',
      country: 'إندونيسيا',
      openingBalance: 0,
    },
    {
      code: 'C002',
      name: 'سالم باحسن',
      type: PartyType.CLIENT,
      phone: '08123456780',
      country: 'إندونيسيا',
      openingBalance: 0,
    },
    {
      code: 'SUP001',
      name: 'مورد نوسانتارا',
      type: PartyType.SUPPLIER,
      phone: '08123456781',
      country: 'إندونيسيا',
      supplierCategory: 'عود وبخور',
      openingBalance: 0,
    },
    {
      code: 'D001',
      name: 'السائق يوسف',
      type: PartyType.DRIVER,
      phone: '08123456782',
      country: 'إندونيسيا',
      carNumber: 'B 1234 XYZ',
      isDriverGiftEnabled: true,
      carryoverReferrals: 0,
      openingBalance: 0,
    },
    {
      code: 'PR001',
      name: 'عمر',
      type: PartyType.PARTNER,
      phone: '08123456783',
      profitShareRatio: 0.60,
      openingCapital: 15900000,
      openingBalance: 0,
    },
    {
      code: 'PR002',
      name: 'خالد',
      type: PartyType.PARTNER,
      phone: '08123456784',
      profitShareRatio: 0.40,
      openingCapital: 10600000,
      openingBalance: 0,
    },
    {
      code: 'F001',
      name: 'أخ المالك',
      type: PartyType.FUNDER,
      phone: '08123456785',
      openingBalance: 0,
    },
  ];

  const partyMap: Record<string, string> = {};
  for (const p of partiesData) {
    const party = await prisma.party.upsert({
      where: { code: p.code },
      update: p,
      create: p,
    });
    partyMap[p.code] = party.id;
  }
  console.log(`Parties seeded: ${Object.keys(partyMap).length}`);

  // 5. Master Items
  const itemsData = [
    {
      code: 'P001',
      name: 'عود طبيعي إندونيسي',
      role: ItemRole.MERCHANDISE,
      categoryId: naCat.id,
      unitId: gramUnit.id,
      reorderLevel: 20,
      openingQty: 100,
      openingValue: 1000000,
      defaultSalePrice: 25000,
    },
    {
      code: 'P002',
      name: 'مسك خام',
      role: ItemRole.RAW,
      categoryId: rmCat.id,
      unitId: mlUnit.id,
      reorderLevel: 10,
      openingQty: 100,
      openingValue: 500000,
      defaultSalePrice: 10000,
    },
    {
      code: 'P003',
      name: 'عطر شرقي مركب',
      role: ItemRole.FINISHED,
      categoryId: pfCat.id,
      unitId: pieceUnit.id,
      reorderLevel: 5,
      openingQty: 0,
      openingValue: 0,
      defaultSalePrice: 30000,
    },
  ];

  const itemMap: Record<string, string> = {};
  for (const item of itemsData) {
    const record = await prisma.item.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
    itemMap[item.code] = record.id;
  }
  console.log(`Items seeded: ${Object.keys(itemMap).length}`);

  // Add Asset FA014 if not exists
  const fa014 = await prisma.fixedAsset.upsert({
    where: { code: 'FA014' },
    update: { name: 'طابعة فواتير', submittedValue: 0 },
    create: { code: 'FA014', name: 'طابعة فواتير', submittedValue: 0, isActive: true },
  });

  if (!includeTransactions) {
    console.log('--- Master entities only seeded successfully! ---');
    return;
  }

  // 6. Transactions - October 2026 Golden Scenario
  console.log('Seeding transactions for October 2026...');

  // 2026-10-03: Purchase P-1001 from SUP001 (200g @ 10,000 = 2,000,000)
  const purchaseInvoice = await prisma.purchaseInvoice.create({
    data: {
      invoiceNo: 'P-1001',
      invoiceYear: 2026,
      invoiceKey: '2026 | P-1001',
      invoiceDate: new Date('2026-10-03'),
      dueDate: new Date('2026-10-15'),
      supplierId: partyMap['SUP001'],
      notes: 'فاتورة شراء عود طبيعي من مورد نوسانتارا',
      status: RecordStatus.POSTED,
      lines: {
        create: [
          {
            code: 'P000001',
            itemId: itemMap['P001'],
            qty: 200,
            unitCost: 10000,
            landedCost: 0,
            discount: 0,
            lineTotalCost: 2000000,
            status: RecordStatus.POSTED,
          },
        ],
      },
    },
    include: { lines: true },
  });
  const p000001 = purchaseInvoice.lines[0];

  // 2026-10-04: Cash payment C000001 for P-1001 (1,200,000 from Bank)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000001',
      txDate: new Date('2026-10-04'),
      account: CashAccountType.BANK,
      type: CashTransactionType.SUPPLIER_PAYMENT,
      partyId: partyMap['SUP001'],
      invoiceKey: '2026 | P-1001',
      amount: 1200000,
      description: 'سداد جزئي من البنك لفاتورة المورد نوسانتارا P-1001',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-05: Sale S-1001 to Ahmed C001 (40g @ 25,000 = 1,000,000)
  const saleInvoice1 = await prisma.saleInvoice.create({
    data: {
      invoiceNo: 'S-1001',
      invoiceYear: 2026,
      invoiceKey: '2026 | S-1001',
      invoiceDate: new Date('2026-10-05'),
      dueDate: new Date('2026-10-15'),
      customerId: partyMap['C001'],
      notes: 'مبيعات عود لأحمد السعيدي',
      status: RecordStatus.POSTED,
      lines: {
        create: [
          {
            code: 'S000001',
            lineType: SaleLineType.SALE,
            itemId: itemMap['P001'],
            qty: 40,
            unitPrice: 25000,
            discount: 0,
            netSaleAmount: 1000000,
            status: RecordStatus.POSTED,
          },
        ],
      },
    },
    include: { lines: true },
  });
  const s000001 = saleInvoice1.lines[0];

  // 2026-10-06: Collection C000002 from Ahmed (600,000 to Cash)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000002',
      txDate: new Date('2026-10-06'),
      account: CashAccountType.CASH,
      type: CashTransactionType.CUSTOMER_COLLECTION,
      partyId: partyMap['C001'],
      invoiceKey: '2026 | S-1001',
      amount: 600000,
      description: 'تحصيل نقدي جزئي من أحمد السعيدي',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-07: Return RT-001 from Ahmed (10g Good condition)
  await prisma.returnLine.create({
    data: {
      code: 'R000001',
      returnDocNo: 'RT-001',
      returnDate: new Date('2026-10-07'),
      type: ReturnType.SALE_RETURN,
      partyId: partyMap['C001'],
      invoiceKey: '2026 | S-1001',
      sourceSaleLineId: s000001.id,
      qty: 10,
      saleReturnCondition: SaleReturnCondition.GOOD,
      reason: 'إرجاع فائض',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-08: Collection C000003 from Ahmed (150,000 to Cash)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000003',
      txDate: new Date('2026-10-08'),
      account: CashAccountType.CASH,
      type: CashTransactionType.CUSTOMER_COLLECTION,
      partyId: partyMap['C001'],
      invoiceKey: '2026 | S-1001',
      amount: 150000,
      description: 'تحصيل نقدي إضافي من أحمد السعيدي',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-09: Sale S-1002 to Salem C002 (20g @ 25,000 = 500,000)
  const saleInvoice2 = await prisma.saleInvoice.create({
    data: {
      invoiceNo: 'S-1002',
      invoiceYear: 2026,
      invoiceKey: '2026 | S-1002',
      invoiceDate: new Date('2026-10-09'),
      dueDate: new Date('2026-10-09'),
      customerId: partyMap['C002'],
      notes: 'مبيعات لسالم باحسن',
      status: RecordStatus.POSTED,
      lines: {
        create: [
          {
            code: 'S000002',
            lineType: SaleLineType.SALE,
            itemId: itemMap['P001'],
            qty: 20,
            unitPrice: 25000,
            discount: 0,
            netSaleAmount: 500000,
            status: RecordStatus.POSTED,
          },
        ],
      },
    },
    include: { lines: true },
  });
  const s000002 = saleInvoice2.lines[0];

  // 2026-10-09: Collection C000004 from Salem (500,000 Cash)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000004',
      txDate: new Date('2026-10-09'),
      account: CashAccountType.CASH,
      type: CashTransactionType.CUSTOMER_COLLECTION,
      partyId: partyMap['C002'],
      invoiceKey: '2026 | S-1002',
      amount: 500000,
      description: 'تحصيل نقدي كامل لفاتورة سالم باحسن S-1002',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-10: Return RT-002 from Salem (4g Good condition)
  await prisma.returnLine.create({
    data: {
      code: 'R000002',
      returnDocNo: 'RT-002',
      returnDate: new Date('2026-10-10'),
      type: ReturnType.SALE_RETURN,
      partyId: partyMap['C002'],
      invoiceKey: '2026 | S-1002',
      sourceSaleLineId: s000002.id,
      qty: 4,
      saleReturnCondition: SaleReturnCondition.GOOD,
      reason: 'إرجاع',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-10: Refund C000005 to Salem (100,000 Cash)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000005',
      txDate: new Date('2026-10-10'),
      account: CashAccountType.CASH,
      type: CashTransactionType.CUSTOMER_REFUND,
      partyId: partyMap['C002'],
      invoiceKey: '2026 | S-1002',
      amount: 100000,
      description: 'رد قيمة المرتجع نقداً لسالم باحسن',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-11: Return RT-003 from Ahmed (2g Damaged condition)
  await prisma.returnLine.create({
    data: {
      code: 'R000003',
      returnDocNo: 'RT-003',
      returnDate: new Date('2026-10-11'),
      type: ReturnType.SALE_RETURN,
      partyId: partyMap['C001'],
      invoiceKey: '2026 | S-1001',
      sourceSaleLineId: s000001.id,
      qty: 2,
      saleReturnCondition: SaleReturnCondition.DAMAGED,
      reason: 'تالف',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-11: Refund C000006 to Ahmed (50,000 Cash)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000006',
      txDate: new Date('2026-10-11'),
      account: CashAccountType.CASH,
      type: CashTransactionType.CUSTOMER_REFUND,
      partyId: partyMap['C001'],
      invoiceKey: '2026 | S-1001',
      amount: 50000,
      description: 'رد قيمة المرتجع التالف نقداً لأحمد السعيدي',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-12: Stock issues IS000001, IS000002, IS000003
  await prisma.stockIssue.create({
    data: {
      code: 'IS000001',
      issueDate: new Date('2026-10-12'),
      type: StockIssueType.TESTER,
      itemId: itemMap['P001'],
      qty: 3,
      reason: 'تستر مستهلك',
      status: RecordStatus.POSTED,
    },
  });

  await prisma.stockIssue.create({
    data: {
      code: 'IS000002',
      issueDate: new Date('2026-10-12'),
      type: StockIssueType.SAMPLE,
      itemId: itemMap['P001'],
      qty: 2,
      reason: 'عينة عميل',
      status: RecordStatus.POSTED,
    },
  });

  await prisma.stockIssue.create({
    data: {
      code: 'IS000003',
      issueDate: new Date('2026-10-12'),
      type: StockIssueType.DAMAGED,
      itemId: itemMap['P001'],
      qty: 1,
      reason: 'تالف في المحل',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-13: Production Batch B-001 (10 pieces of P003 using 20ml of P002)
  await prisma.productionBatch.create({
    data: {
      code: 'B-001',
      completionDate: new Date('2026-10-13'),
      finishedItemId: itemMap['P003'],
      producedQty: 10,
      notes: 'تصنيع 10 عطور شرقية باستخدام 20 ملليلتر مسك خام',
      status: RecordStatus.POSTED,
      materials: {
        create: [
          {
            rawItemId: itemMap['P002'],
            consumedQty: 20,
          },
        ],
      },
    },
  });

  // 2026-10-14: Sale S-1003 to Salem C002 (2 pieces of P003 @ 30,000 = 60,000)
  await prisma.saleInvoice.create({
    data: {
      invoiceNo: 'S-1003',
      invoiceYear: 2026,
      invoiceKey: '2026 | S-1003',
      invoiceDate: new Date('2026-10-14'),
      dueDate: new Date('2026-10-14'),
      customerId: partyMap['C002'],
      notes: 'بيع عطر شرقي مركب لسالم باحسن',
      status: RecordStatus.POSTED,
      lines: {
        create: [
          {
            code: 'S000003',
            lineType: SaleLineType.SALE,
            itemId: itemMap['P003'],
            qty: 2,
            unitPrice: 30000,
            discount: 0,
            netSaleAmount: 60000,
            status: RecordStatus.POSTED,
          },
        ],
      },
    },
  });

  // 2026-10-14: Collection C000007 from Salem (60,000 Cash)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000007',
      txDate: new Date('2026-10-14'),
      account: CashAccountType.CASH,
      type: CashTransactionType.CUSTOMER_COLLECTION,
      partyId: partyMap['C002'],
      invoiceKey: '2026 | S-1003',
      amount: 60000,
      description: 'تحصيل نقدي كامل لفاتورة العطر S-1003',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-14: Stock issue IS000004 (Tester P003 - 1 piece)
  await prisma.stockIssue.create({
    data: {
      code: 'IS000004',
      issueDate: new Date('2026-10-14'),
      type: StockIssueType.TESTER,
      itemId: itemMap['P003'],
      qty: 1,
      reason: 'تستر عطر',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-16: Purchase return RT-004 to SUP001 (20g of P001 from P-1001)
  await prisma.returnLine.create({
    data: {
      code: 'R000004',
      returnDocNo: 'RT-004',
      returnDate: new Date('2026-10-16'),
      type: ReturnType.PURCHASE_RETURN,
      partyId: partyMap['SUP001'],
      invoiceKey: '2026 | P-1001',
      sourcePurchaseLineId: p000001.id,
      qty: 20,
      supplierCreditNote: null,
      reason: 'فائض للمورد',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-18: 10 Visitors referred by Driver Yusuf D001
  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(3, '0');
    await prisma.driverReferral.create({
      data: {
        code: `VIS000${pad}`,
        visitDate: new Date('2026-10-18'),
        visitorUniqueKey: `08100${i}`,
        visitorName: `زبون ${i}`,
        driverId: partyMap['D001'],
        notes: `زيارة مسجلة للسائق يوسف`,
        status: RecordStatus.POSTED,
      },
    });
  }

  // 2026-10-19: Cash expense C000008 (100,000 Cash)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000008',
      txDate: new Date('2026-10-19'),
      account: CashAccountType.CASH,
      type: CashTransactionType.CASH_EXPENSE,
      amount: 100000,
      description: 'ضيافة قهوة وشاي للزوار بالمحل',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-19: Owner Brother Financing C000011 (2,000,000 to Bank)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000011',
      txDate: new Date('2026-10-19'),
      account: CashAccountType.BANK,
      type: CashTransactionType.OWNER_BROTHER_FINANCING,
      partyId: partyMap['F001'],
      amount: 2000000,
      description: 'تمويل إضافي من أخ المالك في البنك',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-20: Driver cash gift payment C000009 (100,000 Cash to D001)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000009',
      txDate: new Date('2026-10-20'),
      account: CashAccountType.CASH,
      type: CashTransactionType.DRIVER_CASH_GIFT,
      partyId: partyMap['D001'],
      amount: 100000,
      description: 'صرف مكافأة هدية نقدية للسائق يوسف لإكماله 10 عملاء',
      status: RecordStatus.POSTED,
    },
  });

  // 2026-10-22: Asset purchase C000010 (1,000,000 Bank for FA014)
  await prisma.cashTransaction.create({
    data: {
      code: 'C000010',
      txDate: new Date('2026-10-22'),
      account: CashAccountType.BANK,
      type: CashTransactionType.ASSET_PURCHASE,
      assetId: fa014.id,
      amount: 1000000,
      description: 'شراء طابعة فواتير جديدة من البنك',
      status: RecordStatus.POSTED,
    },
  });

  console.log('--- Golden Scenario Seeded Successfully! ---');
}

// Allow direct CLI execution
if (require.main === module) {
  const masterOnly = process.argv.includes('--master-only');
  seedGoldenData(!masterOnly)
    .catch((err) => {
      console.error('Error seeding golden data:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
