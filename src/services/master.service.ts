import { loadAllLedgerData } from './ledger-loader';
import { reportBalanceSummary } from './report-balance-summary';
import { todayInStore } from '@/domain/period';
import { withLedgerTransaction, withReadSnapshot } from '@/lib/db';
import { prisma } from '@/lib/db';
import { PartyType, ItemRole, RecordStatus } from '@prisma/client';
import { toDecimal, zero, Decimal, toStorageDecimal } from '@/domain/decimal';
import { nextPartyCode, nextItemCode, nextAssetCode } from './code-generator';
import { logAudit } from './audit.service';
import { loadCostingEngine, loadBalancesEngine } from './ledger-loader';
import { getMonthIndex } from '@/domain/period';
import { stockQuantitiesAt } from './stock-integrity';

// ==========================================
// 1. PARTIES (الأسماء وبيانات الاتصال)
// ==========================================

export interface CreatePartyInput {
  name: string;
  nameId?: string | null;
  nameEn?: string | null;
  type: PartyType;
  phone?: string | null;
  country?: string | null;
  address?: string | null;
  supplierCategory?: string | null;
  supplierCategoryEn?: string | null;
  carNumber?: string | null;
  openingBalance?: number | string;
  profitShareRatio?: number | string;
  openingCapital?: number | string;
  carryoverReferrals?: number;
  isDriverGiftEnabled?: boolean;
}

export async function createParty(data: CreatePartyInput, userId?: string) {
  return withLedgerTransaction(async () => {

  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error('اسم الطرف مطلوب');
  }

  // Check unique name for this type
  const existing = await prisma.party.findUnique({
    where: { name_type: { name: trimmedName, type: data.type } },
  });
  if (existing) {
    throw new Error('اسم مكرر لهذا النوع؛ ميّزه بفرع أو رقم');
  }

  // Validate opening balance rules
  if (data.type === 'DRIVER' || data.type === 'PARTNER') {
    if (data.openingBalance && !toStorageDecimal(data.openingBalance).isZero()) {
      throw new Error('رصيد أول المدة مخصص للعميل والمورد والممول فقط');
    }
  }

  // Validate partner profit share ratio sum <= 100%
  if (data.type === 'PARTNER') {
    const ratio = toStorageDecimal(data.profitShareRatio ?? 0);
    if (ratio.lt(0) || ratio.gt(1)) {
      throw new Error('نسبة ربح الشريك يجب أن تكون بين 0% و 100%');
    }

    const currentPartners = await prisma.party.findMany({
      where: { type: 'PARTNER', isActive: true },
      select: { profitShareRatio: true },
    });
    let currentTotal = zero();
    for (const p of currentPartners) {
      currentTotal = currentTotal.plus(toDecimal(p.profitShareRatio));
    }
    if (currentTotal.plus(ratio).gt(new Decimal('1.0001'))) {
      throw new Error('مجموع نسب ربح الشركاء يتجاوز 100%');
    }
  }

  const code = await nextPartyCode(data.type);

  const created = await prisma.party.create({
    data: {
      code,
      name: trimmedName,
      nameId: data.nameId ? data.nameId.trim() : null,
      nameEn: data.nameEn ? data.nameEn.trim() : null,
      type: data.type,
      phone: data.phone ?? null,
      country: data.country ?? null,
      address: data.address ?? null,
      supplierCategory: (data.type === 'SUPPLIER' || data.type === 'CLIENT') ? data.supplierCategory ?? null : null,
      supplierCategoryEn:
        (data.type === 'SUPPLIER' || data.type === 'CLIENT') && data.supplierCategoryEn
          ? data.supplierCategoryEn.trim()
          : null,
      carNumber: data.type === 'DRIVER' ? data.carNumber ?? null : null,
      openingBalance:
        data.type === 'CLIENT' || data.type === 'SUPPLIER' || data.type === 'FUNDER'
          ? toStorageDecimal(data.openingBalance ?? 0).toString()
          : '0',
      profitShareRatio:
        data.type === 'PARTNER' ? toStorageDecimal(data.profitShareRatio ?? 0).toString() : '0',
      openingCapital:
        data.type === 'PARTNER' ? toStorageDecimal(data.openingCapital ?? 0).toString() : '0',
      carryoverReferrals: data.type === 'DRIVER' ? data.carryoverReferrals ?? 0 : 0,
      isDriverGiftEnabled:
        data.type === 'DRIVER' ? data.isDriverGiftEnabled ?? true : false,
    },
  });

  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'Party',
    entityCode: code,
    afterJson: created,
  });

  return created;

  });
}

export interface UpdatePartyInput {
  name?: string;
  nameId?: string | null;
  nameEn?: string | null;
  phone?: string | null;
  country?: string | null;
  address?: string | null;
  supplierCategory?: string | null;
  supplierCategoryEn?: string | null;
  carNumber?: string | null;
  isDriverGiftEnabled?: boolean;
  profitShareRatio?: number | string;
  openingCapital?: number | string;
}

export async function updateParty(id: string, data: UpdatePartyInput, userId?: string) {
  return withLedgerTransaction(async () => {

  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) throw new Error('جهة التعامل غير موجودة');

  let trimmedName = party.name;
  if (data.name !== undefined) {
    trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('اسم الطرف مطلوب');
    if (trimmedName !== party.name) {
      const existing = await prisma.party.findUnique({
        where: { name_type: { name: trimmedName, type: party.type } },
      });
      if (existing && existing.id !== id) {
        throw new Error('اسم مكرر لهذا النوع؛ ميّزه بفرع أو رقم');
      }
    }
  }

  let newRatioStr: string | undefined = undefined;
  if (party.type === 'PARTNER' && data.profitShareRatio !== undefined) {
    const ratio = toStorageDecimal(data.profitShareRatio);
    if (ratio.lt(0) || ratio.gt(1)) {
      throw new Error('نسبة ربح الشريك يجب أن تكون بين 0% و 100%');
    }
    const currentPartners = await prisma.party.findMany({
      where: { type: 'PARTNER', isActive: true, id: { not: id } },
      select: { profitShareRatio: true },
    });
    let currentTotal = zero();
    for (const p of currentPartners) {
      currentTotal = currentTotal.plus(toDecimal(p.profitShareRatio));
    }
    if (currentTotal.plus(ratio).gt(new Decimal('1.0001'))) {
      throw new Error('مجموع نسب ربح الشركاء يتجاوز 100%');
    }
    newRatioStr = ratio.toString();
  }

  const updated = await prisma.party.update({
    where: { id },
    data: {
      name: trimmedName,
      nameId: data.nameId !== undefined ? (data.nameId ? data.nameId.trim() : null) : party.nameId,
      nameEn: data.nameEn !== undefined ? (data.nameEn ? data.nameEn.trim() : null) : party.nameEn,
      phone: data.phone !== undefined ? data.phone : party.phone,
      country: data.country !== undefined ? data.country : party.country,
      address: data.address !== undefined ? data.address : party.address,
      supplierCategory:
        (party.type === 'SUPPLIER' || party.type === 'CLIENT') && data.supplierCategory !== undefined
          ? data.supplierCategory
          : party.supplierCategory,
      supplierCategoryEn:
        (party.type === 'SUPPLIER' || party.type === 'CLIENT') && data.supplierCategoryEn !== undefined
          ? (data.supplierCategoryEn ? data.supplierCategoryEn.trim() : null)
          : party.supplierCategoryEn,
      carNumber:
        party.type === 'DRIVER' && data.carNumber !== undefined
          ? data.carNumber
          : party.carNumber,
      isDriverGiftEnabled:
        party.type === 'DRIVER' && data.isDriverGiftEnabled !== undefined
          ? data.isDriverGiftEnabled
          : party.isDriverGiftEnabled,
      profitShareRatio: newRatioStr !== undefined ? newRatioStr : party.profitShareRatio,
      openingCapital:
        party.type === 'PARTNER' && data.openingCapital !== undefined
          ? toStorageDecimal(data.openingCapital).toString()
          : party.openingCapital,
    },
  });

  await logAudit({
    userId,
    action: 'UPDATE',
    entityType: 'Party',
    entityCode: party.code,
    reason: `تعديل بيانات جهة التعامل: ${party.name}`,
    beforeState: party,
    afterState: updated,
  });

  return updated;

  });
}

export async function deleteParty(id: string, userId?: string) {
  return withLedgerTransaction(async () => {

  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) throw new Error('جهة التعامل غير موجودة');

  if ([party.openingBalance, party.openingInvoice, party.openingPaid, party.openingCapital].some(value => !toDecimal(value).isZero())) {
    throw new Error('لا يمكن حذف جهة تعامل لها أرصدة أو مبالغ افتتاحية؛ يلزم تسويتها محاسبيًا أولًا');
  }

  const [salesCount, purchCount, cashCount, retCount, refCount] = await Promise.all([
    prisma.saleInvoice.count({ where: { customerId: id } }),
    prisma.purchaseInvoice.count({ where: { supplierId: id } }),
    prisma.cashTransaction.count({ where: { partyId: id } }),
    prisma.returnLine.count({ where: { partyId: id } }),
    prisma.driverReferral.count({ where: { driverId: id } }),
  ]);

  if (salesCount > 0 || purchCount > 0 || cashCount > 0 || retCount > 0 || refCount > 0) {
    throw new Error(
      'لا يمكن حذف جهة التعامل لوجود حركات مالية أو فواتير مرتبطة بها في النظام'
    );
  }

  const deleted = await prisma.party.delete({ where: { id } });

  await logAudit({
    userId,
    action: 'DELETE',
    entityType: 'Party',
    entityCode: party.code,
    reason: `حذف جهة التعامل: ${party.name} (${party.code})`,
    beforeState: party,
  });

  return deleted;

  });
}

export async function getPartiesWithBalances(options?: { type?: PartyType; asOfDate?: string }) {
  const asOf = options?.asOfDate ?? todayInStore();
  const where = options?.type ? { type: options.type } : {};

  const [parties, balances] = await Promise.all([
    prisma.party.findMany({
      where,
      orderBy: { code: 'asc' },
    }),
    loadAllLedgerData(undefined, undefined, true).then(data => reportBalanceSummary(data, asOf)),
  ]);

  const summaryMap = new Map(balances.partySummaries.map((s) => [s.partyId, s]));

  return parties.map((p) => {
    const summary = summaryMap.get(p.id);
    return {
      ...p,
      openingBalance: toDecimal(p.openingBalance),
      profitShareRatio: toDecimal(p.profitShareRatio),
      openingCapital: toDecimal(p.openingCapital),
      debtAsOf: summary?.partyDebtAsOf ?? zero(),
      creditAsOf: summary?.partyCreditAsOf ?? zero(),
      signedAsOf: summary ? summary.partyDebtAsOf.minus(summary.partyCreditAsOf) : zero(),
      uncoveredAsOf: summary ? Decimal.max(summary.partyDebtAsOf.minus(summary.partyCreditAsOf), zero()) : zero(),
      coverageAsOf: !summary ? 'متوازن' : summary.partyDebtAsOf.gt('0.01') && summary.partyCreditAsOf.gt('0.01') ? 'مستحق يقابله دائن' : summary.partyDebtAsOf.gt('0.01') ? 'مستحق' : summary.partyCreditAsOf.gt('0.01') ? 'رصيد دائن' : 'متوازن',
    };
  });
}

// ==========================================
// 2. ITEMS (تعريف الأصناف)
// ==========================================

export interface CreateItemInput {
  name: string;
  nameId?: string | null;
  nameEn?: string | null;
  categoryId: string;
  unitId: string;
  role?: ItemRole;
  reorderLevel?: number | string;
  openingQty?: number | string;
  openingValue?: number | string;
  customCode?: string | null;
  defaultSalePrice?: number | string | null;
}

export async function createItem(data: CreateItemInput, userId?: string) {
  return withLedgerTransaction(async () => {

  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error('اسم الصنف مطلوب');
  }

  const existing = await prisma.item.findUnique({
    where: { name: trimmedName },
  });
  if (existing) {
    throw new Error('اسم الصنف مسجل مسبقاً');
  }

  const opQty = toStorageDecimal(data.openingQty ?? 0);
  const opVal = toStorageDecimal(data.openingValue ?? 0);
  if (opQty.isZero() && opVal.gt(0)) {
    throw new Error('لا يمكن إدخال قيمة أول مدة بدون كمية أول مدة');
  }

  const code = await nextItemCode();

  const created = await prisma.item.create({
    data: {
      code,
      name: trimmedName,
      nameId: data.nameId ? data.nameId.trim() : null,
      nameEn: data.nameEn ? data.nameEn.trim() : null,
      categoryId: data.categoryId,
      unitId: data.unitId,
      role: data.role ?? 'MERCHANDISE',
      reorderLevel: toStorageDecimal(data.reorderLevel ?? 0).toString(),
      openingQty: opQty.toString(),
      openingValue: opVal.toString(),
      customCode: data.customCode ? data.customCode.trim() : null,
      defaultSalePrice: data.defaultSalePrice ? toStorageDecimal(data.defaultSalePrice).toString() : null,
    },
    include: {
      category: true,
      unit: true,
    },
  });

  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'Item',
    entityCode: code,
    afterJson: created,
  });

  return created;

  });
}

export interface UpdateItemInput {
  name?: string;
  nameId?: string | null;
  nameEn?: string | null;
  categoryId?: string;
  unitId?: string;
  role?: ItemRole;
  reorderLevel?: number | string;
  customCode?: string | null;
  defaultSalePrice?: number | string | null;
}

export async function updateItem(id: string, data: UpdateItemInput, userId?: string) {
  return withLedgerTransaction(async () => {

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw new Error('الصنف غير موجود');

  let trimmedName = item.name;
  if (data.name !== undefined) {
    trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('اسم الصنف مطلوب');
    if (trimmedName !== item.name) {
      const existing = await prisma.item.findUnique({ where: { name: trimmedName } });
      if (existing && existing.id !== id) {
        throw new Error('اسم الصنف مسجل مسبقاً');
      }
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      name: trimmedName,
      nameId: data.nameId !== undefined ? (data.nameId ? data.nameId.trim() : null) : item.nameId,
      nameEn: data.nameEn !== undefined ? (data.nameEn ? data.nameEn.trim() : null) : item.nameEn,
      categoryId: data.categoryId ?? item.categoryId,
      unitId: data.unitId ?? item.unitId,
      role: data.role ?? item.role,
      reorderLevel:
        data.reorderLevel !== undefined ? toStorageDecimal(data.reorderLevel).toString() : item.reorderLevel,
      customCode:
        data.customCode !== undefined
          ? data.customCode
            ? data.customCode.trim()
            : null
          : item.customCode,
      defaultSalePrice:
        data.defaultSalePrice !== undefined
          ? data.defaultSalePrice
            ? toStorageDecimal(data.defaultSalePrice).toString()
            : null
          : item.defaultSalePrice,
    },
    include: { category: true, unit: true },
  });

  await logAudit({
    userId,
    action: 'UPDATE',
    entityType: 'Item',
    entityCode: item.code,
    reason: `تعديل بيانات الصنف: ${item.name}`,
    beforeState: item,
    afterState: updated,
  });

  return updated;

  });
}

export async function deleteItem(id: string, userId?: string) {
  return withLedgerTransaction(async () => {

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw new Error('الصنف غير موجود');

  const [purchCount, saleCount, issueCount, batchCount, matCount] = await Promise.all([
    prisma.purchaseLine.count({ where: { itemId: id } }),
    prisma.saleLine.count({ where: { itemId: id } }),
    prisma.stockIssue.count({ where: { itemId: id } }),
    prisma.productionBatch.count({ where: { finishedItemId: id } }),
    prisma.batchMaterial.count({ where: { rawItemId: id } }),
  ]);

  if (purchCount > 0 || saleCount > 0 || issueCount > 0 || batchCount > 0 || matCount > 0) {
    throw new Error('لا يمكن حذف الصنف لوجود حركات مخزنية أو فواتير مرتبطة به في النظام');
  }

  if (parseFloat(String(item.openingQty || 0)) > 0) {
    throw new Error('لا يمكن حذف الصنف لوجود رصيد افتتاحي مسجل له؛ صفّر رصيد أول المدة أولاً');
  }

  const deleted = await prisma.item.delete({ where: { id } });

  await logAudit({
    userId,
    action: 'DELETE',
    entityType: 'Item',
    entityCode: item.code,
    reason: `حذف الصنف: ${item.name} (${item.code})`,
    beforeState: item,
  });

  return deleted;

  });
}

export async function getItemsWithStock(asOfDate?: string) {
  return withReadSnapshot(async () => {
  const asOf = asOfDate ?? todayInStore();
  const setting = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  const startYear = setting?.startYear ?? 2026;
  const monthIdx = getMonthIndex(asOf, startYear);

  const [items, costing, quantities] = await Promise.all([
    prisma.item.findMany({
      include: { category: true, unit: true },
      orderBy: { code: 'asc' },
    }),
    loadCostingEngine(monthIdx),
    stockQuantitiesAt(asOf),
  ]);

  return items.map((item) => {
    // Generate displayCode: customCode || (prefix - numeric code)
    let displayCode = item.customCode;
    if (!displayCode) {
      const numPart = item.code.replace(/^[A-Za-z_-]+/i, '');
      displayCode = numPart ? `${item.category.prefix}-${numPart}` : item.code;
    }

    const state = costing.getItemEndingState(item.id, monthIdx);
    const availableQty = quantities.get(item.id) ?? zero();
    const monthlyAvgCost = state.AVG;
    const availableValue = availableQty.times(monthlyAvgCost);
    const reorderLevel = toDecimal(item.reorderLevel);

    let stockStatus: 'مخزون سالب' | 'أعد الطلب' | 'متاح';
    if (availableQty.lt(-0.000000001)) {
      stockStatus = 'مخزون سالب';
    } else if (availableQty.lte(reorderLevel)) {
      stockStatus = 'أعد الطلب';
    } else {
      stockStatus = 'متاح';
    }

    return {
      ...item,
      displayCode,
      openingQty: toDecimal(item.openingQty),
      openingValue: toDecimal(item.openingValue),
      reorderLevel,
      defaultSalePrice: item.defaultSalePrice ? toDecimal(item.defaultSalePrice) : null,
      availableQty,
      monthlyAvgCost,
      availableValue,
      stockStatus,
      costCheck: state.COST_CHECK,
    };
  });
  });
}

// ==========================================
// 3. FIXED ASSETS (الأصول الثابتة)
// ==========================================

export async function getFixedAssetsWithAdditions(asOfDate?: string) {
  const asOf = asOfDate ?? todayInStore();
  const [assets, setting, additions] = await Promise.all([
    prisma.fixedAsset.findMany({ orderBy: { code: 'asc' } }),
    prisma.systemSetting.findUnique({ where: { id: 1 } }),
    prisma.cashTransaction.findMany({
      where: {
        type: 'ASSET_PURCHASE',
        status: 'POSTED',
        txDate: { lte: new Date(asOf) },
      },
    }),
  ]);

  const approveOpening = setting?.approveOpeningAssets ?? false;

  const additionByAsset = new Map<string, Decimal>();
  for (const tx of additions) {
    if (tx.assetId) {
      const cur = additionByAsset.get(tx.assetId) ?? zero();
      additionByAsset.set(tx.assetId, cur.plus(toDecimal(tx.amount)));
    }
  }

  let totalSubmitted = zero();
  let totalApprovedOpening = zero();
  let totalAdditions = zero();
  let totalValueBeforeDepreciation = zero();

  const assetRows = assets.map((a) => {
    const submittedValue = toDecimal(a.submittedValue);
    const approvedOpening = approveOpening ? submittedValue : zero();
    const additionsAsOf = additionByAsset.get(a.id) ?? zero();
    const valueBeforeDepreciation = approvedOpening.plus(additionsAsOf);

    totalSubmitted = totalSubmitted.plus(submittedValue);
    totalApprovedOpening = totalApprovedOpening.plus(approvedOpening);
    totalAdditions = totalAdditions.plus(additionsAsOf);
    totalValueBeforeDepreciation = totalValueBeforeDepreciation.plus(valueBeforeDepreciation);

    return {
      ...a,
      submittedValue,
      approvedOpening,
      additionsAsOf,
      valueBeforeDepreciation,
    };
  });

  return {
    assets: assetRows,
    approveOpening,
    totals: {
      totalSubmitted,
      totalApprovedOpening,
      totalAdditions,
      totalValueBeforeDepreciation,
    },
  };
}

export async function createFixedAsset(
  data: {
    name: string;
    nameId?: string | null;
    nameEn?: string | null;
    acquiredDate?: string | null;
    submittedValue?: number | string;
    notes?: string | null;
  },
  userId?: string
) {
  return withLedgerTransaction(async () => {

  const code = await nextAssetCode();
  const created = await prisma.fixedAsset.create({
    data: {
      code,
      name: data.name.trim(),
      nameId: data.nameId ? data.nameId.trim() : null,
      nameEn: data.nameEn ? data.nameEn.trim() : null,
      acquiredDate: data.acquiredDate ? new Date(data.acquiredDate) : null,
      submittedValue: toStorageDecimal(data.submittedValue ?? 0).toString(),
      notes: data.notes?.trim() ?? null,
      isActive: true,
    },
  });

  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'FixedAsset',
    entityCode: code,
    afterJson: created,
  });

  return created;

  });
}

export async function updateFixedAsset(
  id: string,
  data: {
    name?: string;
    nameId?: string | null;
    nameEn?: string | null;
    acquiredDate?: string | null;
    submittedValue?: number | string;
    notes?: string | null;
  },
  userId?: string
) {
  return withLedgerTransaction(async () => {

  const asset = await prisma.fixedAsset.findUnique({ where: { id } });
  if (!asset) throw new Error('الأصل الثابت غير موجود');

  const updated = await prisma.fixedAsset.update({
    where: { id },
    data: {
      name: data.name !== undefined ? data.name.trim() : asset.name,
      nameId: data.nameId !== undefined ? (data.nameId ? data.nameId.trim() : null) : asset.nameId,
      nameEn: data.nameEn !== undefined ? (data.nameEn ? data.nameEn.trim() : null) : asset.nameEn,
      acquiredDate:
        data.acquiredDate !== undefined
          ? data.acquiredDate
            ? new Date(data.acquiredDate)
            : null
          : asset.acquiredDate,
      submittedValue:
        data.submittedValue !== undefined ? toStorageDecimal(data.submittedValue).toString() : asset.submittedValue,
      notes: data.notes !== undefined ? (data.notes ? data.notes.trim() : null) : asset.notes,
    },
  });

  await logAudit({
    userId,
    action: 'UPDATE',
    entityType: 'FixedAsset',
    entityCode: asset.code,
    reason: `تعديل الأصل الثابت: ${asset.name}`,
    beforeState: asset,
    afterState: updated,
  });

  return updated;

  });
}

export async function deleteFixedAsset(id: string, userId?: string) {
  return withLedgerTransaction(async () => {

  const asset = await prisma.fixedAsset.findUnique({ where: { id } });
  if (!asset) throw new Error('الأصل الثابت غير موجود');

  const txCount = await prisma.cashTransaction.count({ where: { assetId: id } });
  if (txCount > 0) {
    throw new Error('لا يمكن حذف الأصل الثابت لوجود حركات شراء نقدية مرتبطة به في النظام');
  }

  const deleted = await prisma.fixedAsset.delete({ where: { id } });

  await logAudit({
    userId,
    action: 'DELETE',
    entityType: 'FixedAsset',
    entityCode: asset.code,
    reason: `حذف الأصل الثابت: ${asset.name} (${asset.code})`,
    beforeState: asset,
  });

  return deleted;

  });
}

// ==========================================
// 4. GIFT POLICIES (سياسة الهدايا)
// ==========================================

export async function getGiftPolicies() {
  return prisma.giftPolicy.findMany({
    orderBy: { effectiveDate: 'asc' },
  });
}

export async function createGiftPolicy(
  data: { effectiveDate: string; customersPerGift: number; giftValue: number | string; notes?: string | null },
  userId?: string
) {
  return withLedgerTransaction(async () => {

  if (data.customersPerGift < 1) {
    throw new Error('عدد العملاء لكل هدية يجب أن يكون 1 على الأقل');
  }

  const existing = await prisma.giftPolicy.findUnique({
    where: { effectiveDate: new Date(data.effectiveDate) },
  });
  if (existing) {
    throw new Error('توجد سياسة هدايا مسبقة بنفس تاريخ التطبيق؛ اختر تاريخاً آخر');
  }

  const created = await prisma.giftPolicy.create({
    data: {
      effectiveDate: new Date(data.effectiveDate),
      customersPerGift: Math.floor(data.customersPerGift),
      giftValue: toStorageDecimal(data.giftValue).toString(),
      notes: data.notes?.trim() ?? null,
    },
  });

  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'GiftPolicy',
    entityCode: data.effectiveDate,
    afterJson: created,
  });

  return created;

  });
}

export async function canModifyGiftPolicy(policyId: string): Promise<boolean> {
  const policy = await prisma.giftPolicy.findUnique({ where: { id: policyId } });
  if (!policy) return false;

  const count = await prisma.driverReferral.count({
    where: {
      status: 'POSTED',
      visitDate: { gte: policy.effectiveDate },
    },
  });

  return count === 0;
}

export async function updateGiftPolicy(
  id: string,
  data: { effectiveDate?: string; customersPerGift?: number; giftValue?: number | string; notes?: string | null },
  userId?: string
) {
  return withLedgerTransaction(async () => {

  const canModify = await canModifyGiftPolicy(id);
  if (!canModify) {
    throw new Error('لا يمكن تعديل هذه السياسة لأنها مرتبطة بزيارات فعلية مسجلة في النظام');
  }

  const existing = await prisma.giftPolicy.findUnique({ where: { id } });
  if (!existing) throw new Error('سياسة الهدايا غير موجودة');

  if (data.customersPerGift !== undefined && data.customersPerGift < 1) {
    throw new Error('عدد العملاء لكل هدية يجب أن يكون 1 على الأقل');
  }

  if (data.effectiveDate && new Date(data.effectiveDate).getTime() !== existing.effectiveDate.getTime()) {
    const duplicate = await prisma.giftPolicy.findUnique({
      where: { effectiveDate: new Date(data.effectiveDate) },
    });
    if (duplicate && duplicate.id !== id) {
      throw new Error('توجد سياسة هدايا أخرى بنفس تاريخ التطبيق؛ اختر تاريخاً آخر');
    }
  }

  const updated = await prisma.giftPolicy.update({
    where: { id },
    data: {
      effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
      customersPerGift: data.customersPerGift !== undefined ? Math.floor(data.customersPerGift) : undefined,
      giftValue: data.giftValue !== undefined ? toStorageDecimal(data.giftValue).toString() : undefined,
      notes: data.notes !== undefined ? data.notes?.trim() ?? null : undefined,
    },
  });

  await logAudit({
    userId,
    action: 'UPDATE',
    entityType: 'GiftPolicy',
    entityCode: updated.effectiveDate.toISOString().slice(0, 10),
    beforeJson: existing,
    afterJson: updated,
  });

  return updated;

  });
}

export async function deleteGiftPolicy(id: string, userId?: string) {
  return withLedgerTransaction(async () => {

  const canModify = await canModifyGiftPolicy(id);
  if (!canModify) {
    throw new Error('لا يمكن حذف هذه السياسة لأنها مرتبطة بزيارات فعلية مسجلة في النظام');
  }

  const existing = await prisma.giftPolicy.findUnique({ where: { id } });
  if (!existing) throw new Error('سياسة الهدايا غير موجودة');

  await prisma.giftPolicy.delete({ where: { id } });

  await logAudit({
    userId,
    action: 'DELETE',
    entityType: 'GiftPolicy',
    entityCode: existing.effectiveDate.toISOString().slice(0, 10),
    beforeJson: existing,
  });

  return { success: true };

  });
}
