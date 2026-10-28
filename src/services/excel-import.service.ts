import { withLedgerTransaction } from '@/lib/db';
import * as xlsx from 'xlsx';
import { prisma } from '@/lib/db';
import { toDecimal, zero, Decimal, toStorageDecimal, roundMoney } from '@/domain/decimal';
import {
  UserRole,
  PartyType,
  ItemRole,
  SaleLineType,
  CashAccountType,
  CashTransactionType,
  ReturnType,
  SaleReturnCondition,
  StockIssueType,
  RecordStatus,
} from '@prisma/client';
import { loadReportsEngine, loadBalancesEngine } from './ledger-loader';
import { logAudit } from './audit.service';
import { readValidatedWorkbook } from './excel-validation';
import { parseDateParts } from '@/domain/period';

export interface ReconciliationItem {
  key: string;
  label: string;
  cellRef: string;
  excelValue: number;
  systemValue: number;
  diff: number;
  matched: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  counts: {
    categories: number;
    units: number;
    parties: number;
    items: number;
    assets: number;
    policies: number;
    purchases: number;
    sales: number;
    cashTransactions: number;
    returns: number;
    stockIssues: number;
    batches: number;
    referrals: number;
  };
  reconciliation: {
    items: ReconciliationItem[];
    allMatched: boolean;
  };
}

/**
 * Safely parses an Excel cell value into a YYYY-MM-DD date string.
 */
function parseExcelDate(val: any, defaultYear = 2026): string {
  if (!val) return `${defaultYear}-01-01`;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    const parsed = xlsx.SSF.parse_date_code(val);
    if (parsed) {
      const y = parsed.y || defaultYear;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) { parseDateParts(trimmed); return trimmed; }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  throw new Error('تاريخ غير صالح في ملف Excel');
}

function parseDecimal(val: any, stored = true): number {
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const num = Number(cleaned);
  if (!Number.isFinite(num)) throw new Error('قيمة رقمية غير صالحة في ملف Excel');
  if (stored) {
    const decimal = toStorageDecimal(cleaned);
    // Import rows use numeric values; refuse a lossy conversion of textual cells.
    if (!toDecimal(num).eq(decimal)) throw new Error('القيمة تتجاوز الحد المسموح للتخزين');
  }
  return num;
}

function parseBool(val: any): boolean {
  if (!val) return false;
  if (typeof val === 'boolean') return val;
  const str = String(val).trim().toLowerCase();
  return str === 'نعم' || str === 'true' || str === '1' || str === 'yes';
}

/**
 * Maps Arabic transaction types to Prisma Enums
 */
function mapPartyType(str: any): PartyType {
  const s = String(str || '').trim();
  if (s.includes('عميل')) return PartyType.CLIENT;
  if (s.includes('مورد')) return PartyType.SUPPLIER;
  if (s.includes('سائق')) return PartyType.DRIVER;
  if (s.includes('شريك')) return PartyType.PARTNER;
  if (s.includes('ممول')) return PartyType.FUNDER;
  throw new Error('نوع طرف غير معروف في ملف Excel');
}

function mapItemRole(str: any): ItemRole {
  const s = String(str || '').trim();
  if (s.includes('خام')) return ItemRole.RAW;
  if (s.includes('منتج تام')) return ItemRole.FINISHED;
  return ItemRole.MERCHANDISE;
}

function mapCashAccount(str: any): CashAccountType {
  const s = String(str || '').trim();
  if (s.includes('بنك')) return CashAccountType.BANK;
  return CashAccountType.CASH;
}

function mapCashTxType(str: any): CashTransactionType {
  const s = String(str || '').trim();
  if (s.includes('تحصيل عميل')) return CashTransactionType.CUSTOMER_COLLECTION;
  if (s.includes('سداد مورد')) return CashTransactionType.SUPPLIER_PAYMENT;
  if (s.includes('رد لعميل') || s.includes('رد مبلغ لعميل')) return CashTransactionType.CUSTOMER_REFUND;
  if (s.includes('استرداد من مورد')) return CashTransactionType.SUPPLIER_REFUND;
  if (s.includes('مصروف نقدي')) return CashTransactionType.CASH_EXPENSE;
  if (s.includes('هدية نقدية')) return CashTransactionType.DRIVER_CASH_GIFT;
  if (s.includes('سائق')) return CashTransactionType.DRIVER_AMOUNT;
  if (s.includes('ربح مبيعات خارجية')) return CashTransactionType.EXTERNAL_SALES_PROFIT;
  if (s.includes('شراء أصل')) return CashTransactionType.ASSET_PURCHASE;
  if (s.includes('تمويل')) return CashTransactionType.OWNER_BROTHER_FINANCING;
  if (s.includes('مساهمة شريك')) return CashTransactionType.PARTNER_CONTRIBUTION;
  if (s.includes('مسحوبات شريك')) return CashTransactionType.PARTNER_DRAWING;
  if (s.includes('توزيع أرباح')) return CashTransactionType.PROFIT_DISTRIBUTION;
  if (s.includes('تحويل داخلي')) return CashTransactionType.INTERNAL_TRANSFER;
  throw new Error('نوع حركة نقدية غير معروف في ملف Excel');
}

function mapStockIssueType(str: any): StockIssueType {
  const s = String(str || '').trim();
  if (s.includes('عينة')) return StockIssueType.SAMPLE;
  if (s.includes('تالف')) return StockIssueType.DAMAGED;
  return StockIssueType.TESTER;
}

/**
 * Imports full workbook according to specs/15-excel-import.md inside a single transaction.
 */
export async function importExcelWorkbook(
  buffer: Buffer,
  userId?: string
): Promise<ImportResult> {
  return withLedgerTransaction(async () => {

  const wb = readValidatedWorkbook(buffer);
  const currentSettings = await prisma.systemSetting.findUnique({ where: { id: 1 } });
  if (currentSettings?.lockedThroughDate) throw new Error('لا يمكن الاستيراد مع فترة محاسبية مقفلة؛ راجع المحاسب أولًا');

  const getSheetRows = (sheetName: string): any[][] => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  };

  const mainReportsSheet = wb.Sheets['الرئيسية والتقارير'] || {};

  // Track counts
  const counts = {
    categories: 0,
    units: 0,
    parties: 0,
    items: 0,
    assets: 0,
    policies: 0,
    purchases: 0,
    sales: 0,
    cashTransactions: 0,
    returns: 0,
    stockIssues: 0,
    batches: 0,
    referrals: 0,
  };

  // 1. Transaction Pipeline
  await prisma.$transaction(
    async (tx) => {
      // -------------------------------------------------------------
      // Step 1: System Settings, Categories & Units
      // -------------------------------------------------------------
      const settingsSheet = wb.Sheets['الإعدادات والتهيئة'] || {};
      const currencyLabel = String(settingsSheet['B6']?.v || 'روبية (IDR)').trim();
      let currencyCode = 'IDR';
      if (currencyLabel.includes('SAR') || currencyLabel.includes('ريال')) currencyCode = 'SAR';
      else if (currencyLabel.includes('AED') || currencyLabel.includes('درهم')) currencyCode = 'AED';
      else if (currencyLabel.includes('USD') || currencyLabel.includes('دولار')) currencyCode = 'USD';

      const openingCash = parseDecimal(settingsSheet['B8']?.v);
      const openingBank = parseDecimal(settingsSheet['B9']?.v);
      const openingReviewed = parseBool(settingsSheet['B10']?.v);
      const startYear = parseInt(String(settingsSheet['B12']?.v || '2026'), 10) || 2026;

      const assetsSheet = wb.Sheets['الأصول والشركاء'] || {};
      const approveOpeningAssets = parseBool(assetsSheet['L3']?.v);
      const openingLoans = parseDecimal(assetsSheet['L14']?.v);
      const openingRetainedEarnings = parseDecimal(assetsSheet['L15']?.v);

      await tx.systemSetting.upsert({
        where: { id: 1 },
        update: {
          currencyLabel,
          currencyCode,
          openingCash,
          openingBank,
          openingReviewed,
          startYear,
          approveOpeningAssets,
          openingLoans,
          openingRetainedEarnings,
        },
        create: {
          id: 1,
          storeName: 'قصر العود والعطور',
          currencyLabel,
          currencyCode,
          openingCash,
          openingBank,
          openingReviewed,
          startYear,
          approveOpeningAssets,
          openingLoans,
          openingRetainedEarnings,
          allowNegativeStock: false,
        },
      });

      // Categories (D8:E19 in الإعدادات والتهيئة)
      const settingsRows = getSheetRows('الإعدادات والتهيئة');
      for (let r = 7; r <= 18; r++) {
        const row = settingsRows[r];
        if (row && row[3]) {
          const name = String(row[3]).trim();
          const prefix = String(row[4] || 'NA').trim();
          if (name) {
            await tx.itemCategory.upsert({
              where: { name },
              update: { prefix, sortOrder: r - 6 },
              create: { name, prefix, sortOrder: r - 6 },
            });
            counts.categories++;
          }
        }
      }

      // Units (G8:G19)
      for (let r = 7; r <= 18; r++) {
        const row = settingsRows[r];
        if (row && row[6]) {
          const name = String(row[6]).trim();
          if (name) {
            await tx.unitOption.upsert({
              where: { name },
              update: { sortOrder: r - 6 },
              create: { name, sortOrder: r - 6 },
            });
            counts.units++;
          }
        }
      }

      // -------------------------------------------------------------
      // Step 2: People / Parties (الأسماء وبيانات الاتصال)
      // -------------------------------------------------------------
      const peopleRows = getSheetRows('الأسماء وبيانات الاتصال');
      // Row 5 is header, data starts at index 5 (row 6)
      for (let i = 5; i < peopleRows.length; i++) {
        const row = peopleRows[i];
        if (!row || !row[1] || String(row[1]).trim() === '') continue; // ignore empty names

        const code = String(row[0] || `P_${i}`).trim();
        const name = String(row[1]).trim();
        const type = mapPartyType(row[2]);
        const phone = row[3] ? String(row[3]).trim() : null;
        const country = row[4] ? String(row[4]).trim() : null;
        const address = row[5] ? String(row[5]).trim() : null;
        const supplierCategory = row[6] ? String(row[6]).trim() : null;
        const carNumber = row[7] ? String(row[7]).trim() : null;
        const openingBalance = parseDecimal(row[8]);
        const profitShareRatio = parseDecimal(row[9]);

        await tx.party.upsert({
          where: { code },
          update: {
            name,
            type,
            phone,
            country,
            address,
            supplierCategory,
            carNumber,
            openingBalance,
            profitShareRatio,
          },
          create: {
            code,
            name,
            type,
            phone,
            country,
            address,
            supplierCategory,
            carNumber,
            openingBalance,
            profitShareRatio,
          },
        });
        counts.parties++;
      }

      // -------------------------------------------------------------
      // Step 3: Items (الأصناف)
      // -------------------------------------------------------------
      const allCategories = await tx.itemCategory.findMany();
      const allUnits = await tx.unitOption.findMany();
      const catMap = new Map(allCategories.map((c) => [c.name, c.id]));
      const unitMap = new Map(allUnits.map((u) => [u.name, u.id]));

      const defaultCatId = allCategories[0]?.id;
      const defaultUnitId = allUnits[0]?.id;

      const itemsRows = getSheetRows('الأصناف');
      for (let i = 5; i < itemsRows.length; i++) {
        const row = itemsRows[i];
        if (!row || !row[1] || String(row[1]).trim() === '') continue;

        const code = String(row[0] || `P${i}`).trim();
        const name = String(row[1]).trim();
        const catName = String(row[2] || '').trim();
        const unitName = String(row[3] || '').trim();
        const role = mapItemRole(row[4]);
        const reorderLevel = parseDecimal(row[5]);
        const openingQty = parseDecimal(row[6]);
        const openingValue = parseDecimal(row[7]);
        const customCode = row[8] ? String(row[8]).trim() : null;

        const categoryId = catMap.get(catName) || defaultCatId;
        const unitId = unitMap.get(unitName) || defaultUnitId;

        if (categoryId && unitId) {
          await tx.item.upsert({
            where: { code },
            update: {
              name,
              categoryId,
              unitId,
              role,
              reorderLevel,
              openingQty,
              openingValue,
              customCode,
            },
            create: {
              code,
              name,
              categoryId,
              unitId,
              role,
              reorderLevel,
              openingQty,
              openingValue,
              customCode,
            },
          });
          counts.items++;
        }
      }

      // -------------------------------------------------------------
      // Step 4: Fixed Assets, Partners Capital, Policies & Driver Gifts
      // -------------------------------------------------------------
      // Fixed Assets
      const assetDataRows = getSheetRows('الأصول والشركاء');
      for (let i = 5; i < assetDataRows.length; i++) {
        const row = assetDataRows[i];
        if (!row || !row[0] || !row[1]) continue;
        const code = String(row[0]).trim();
        const name = String(row[1]).trim();
        const submittedValue = parseDecimal(row[3]);
        const acquiredDate = row[2] ? new Date(parseExcelDate(row[2], startYear)) : null;

        await tx.fixedAsset.upsert({
          where: { code },
          update: { name, submittedValue, acquiredDate },
          create: { code, name, submittedValue, acquiredDate },
        });
        counts.assets++;
      }

      // Partners Capital
      const partnersRows = getSheetRows('الشركاء');
      for (let i = 5; i < partnersRows.length; i++) {
        const row = partnersRows[i];
        if (!row || !row[0]) continue;
        const rawCode = String(row[0]).split('|')[0].trim();
        const openingCapital = parseDecimal(row[1]);

        await tx.party.updateMany({
          where: { code: rawCode, type: PartyType.PARTNER },
          data: { openingCapital },
        });
      }

      // Gift Policy
      const policyRows = getSheetRows('سياسة الهدايا');
      for (let i = 5; i < policyRows.length; i++) {
        const row = policyRows[i];
        if (!row || !row[0]) continue;
        const effectiveDateStr = parseExcelDate(row[0], startYear);
        const customersPerGift = parseInt(String(row[1] || '10'), 10) || 10;
        const giftValue = parseDecimal(row[2]);
        const notes = row[3] ? String(row[3]).trim() : null;

        if (giftValue > 0) {
          const effectiveDate = new Date(effectiveDateStr);
          await tx.giftPolicy.upsert({
            where: { effectiveDate },
            update: { customersPerGift, giftValue, notes },
            create: { effectiveDate, customersPerGift, giftValue, notes },
          });
          counts.policies++;
        }
      }

      // Driver Gifts setup
      const driverGiftsRows = getSheetRows('هدايا السائقين');
      for (let i = 5; i < driverGiftsRows.length; i++) {
        const row = driverGiftsRows[i];
        if (!row || !row[0]) continue;
        const rawCode = String(row[0]).split('|')[0].trim();
        const carryover = parseInt(String(row[1] || '0'), 10) || 0;

        await tx.party.updateMany({
          where: { code: rawCode, type: PartyType.DRIVER },
          data: {
            isDriverGiftEnabled: true,
            carryoverReferrals: carryover,
          },
        });
      }

      // Pre-fetch items and parties for subsequent movements
      const dbItems = await tx.item.findMany();
      const itemByCodeOrName = new Map<string, string>();
      for (const it of dbItems) {
        itemByCodeOrName.set(it.code, it.id);
        itemByCodeOrName.set(it.name, it.id);
      }

      const dbParties = await tx.party.findMany();
      const partyByCodeOrName = new Map<string, string>();
      for (const pt of dbParties) {
        partyByCodeOrName.set(pt.code, pt.id);
        partyByCodeOrName.set(pt.name, pt.id);
      }

      const dbAssets = await tx.fixedAsset.findMany();
      const assetByCodeOrName = new Map<string, string>();
      for (const fa of dbAssets) {
        assetByCodeOrName.set(fa.code, fa.id);
        assetByCodeOrName.set(fa.name, fa.id);
      }

      // -------------------------------------------------------------
      // Step 5: Purchases (المشتريات)
      // -------------------------------------------------------------
      const purchaseRows = getSheetRows('المشتريات');
      // Group by (supplierId, invoiceKey)
      const purchaseInvoicesMap = new Map<
        string,
        {
          invoiceDate: string;
          invoiceNo: string;
          invoiceYear: number;
          invoiceKey: string;
          dueDate?: string | null;
          supplierId: string;
          lines: any[];
        }
      >();

      for (let i = 5; i < purchaseRows.length; i++) {
        const row = purchaseRows[i];
        if (!row || !row[0] || !row[1] || !row[2] || !row[3]) continue;

        const dateStr = parseExcelDate(row[0], startYear);
        const invoiceNo = String(row[1]).trim();
        const year = parseInt(dateStr.slice(0, 4), 10);
        const invoiceKey = `${year} | ${invoiceNo}`;

        const supplierKey = String(row[2]).split('|')[0].trim();
        const supplierId = partyByCodeOrName.get(supplierKey) || partyByCodeOrName.get(String(row[2]).trim());
        if (!supplierId) throw new Error(`مورد غير معروف في صف الشراء ${i + 1}`);

        const itemKey = String(row[3]).split('|')[0].trim();
        const itemId = itemByCodeOrName.get(itemKey) || itemByCodeOrName.get(String(row[3]).trim());
        if (!itemId) throw new Error(`صنف غير معروف في الصف ${i + 1}`);

        const qty = parseDecimal(row[4]);
        const unitCost = parseDecimal(row[5]);
        const landedCost = parseDecimal(row[6]);
        const discount = parseDecimal(row[7]);
        const dueDateStr = row[8] ? parseExcelDate(row[8], startYear) : null;
        const lineCode = String(row[9] || `P${String(i).padStart(6, '0')}`).trim();

        if (qty <= 0) throw new Error(`كمية غير صالحة في الصف ${i + 1}`);

        if ([unitCost, landedCost, discount].some(value => value < 0)) throw new Error(`تكلفة أو وصول أو خصم سالب في صف الشراء ${i + 1}`);
        const rawLineTotalCost = toDecimal(qty).times(unitCost).plus(landedCost).minus(discount);
        if (rawLineTotalCost.lt(0)) throw new Error(`خصم صف الشراء ${i + 1} أكبر من قيمته`);

        const groupKey = `${supplierId}__${invoiceKey}`;
        if (!purchaseInvoicesMap.has(groupKey)) {
          purchaseInvoicesMap.set(groupKey, {
            invoiceDate: dateStr,
            invoiceNo,
            invoiceYear: year,
            invoiceKey,
            dueDate: dueDateStr,
            supplierId,
            lines: [],
          });
        }

        const inv = purchaseInvoicesMap.get(groupKey)!;
        inv.lines.push({
          code: lineCode,
          itemId,
          qty,
          unitCost,
          landedCost,
          discount,
          lineTotalCost: toStorageDecimal(roundMoney(rawLineTotalCost)).toString(),
        });
      }

      // Create purchase invoices and lines
      for (const [_, invData] of purchaseInvoicesMap) {
        const createdInv = await tx.purchaseInvoice.upsert({
          where: {
            supplierId_invoiceKey: {
              supplierId: invData.supplierId,
              invoiceKey: invData.invoiceKey,
            },
          },
          update: {
            invoiceDate: new Date(invData.invoiceDate),
            dueDate: invData.dueDate ? new Date(invData.dueDate) : null,
          },
          create: {
            invoiceNo: invData.invoiceNo,
            invoiceYear: invData.invoiceYear,
            invoiceKey: invData.invoiceKey,
            invoiceDate: new Date(invData.invoiceDate),
            dueDate: invData.dueDate ? new Date(invData.dueDate) : null,
            supplierId: invData.supplierId,
            status: RecordStatus.POSTED,
          },
        });

        for (const line of invData.lines) {
          await tx.purchaseLine.upsert({
            where: { code: line.code },
            update: {
              invoiceId: createdInv.id,
              itemId: line.itemId,
              qty: line.qty,
              unitCost: line.unitCost,
              landedCost: line.landedCost,
              discount: line.discount,
              lineTotalCost: line.lineTotalCost,
              status: RecordStatus.POSTED,
            },
            create: {
              code: line.code,
              invoiceId: createdInv.id,
              itemId: line.itemId,
              qty: line.qty,
              unitCost: line.unitCost,
              landedCost: line.landedCost,
              discount: line.discount,
              lineTotalCost: line.lineTotalCost,
              status: RecordStatus.POSTED,
            },
          });
          counts.purchases++;
        }
      }

      // -------------------------------------------------------------
      // Step 6: Sales (المبيعات)
      // -------------------------------------------------------------
      const saleRows = getSheetRows('المبيعات');
      const saleInvoicesMap = new Map<
        string,
        {
          invoiceDate: string;
          invoiceNo: string;
          invoiceYear: number;
          invoiceKey: string;
          dueDate?: string | null;
          customerId?: string | null;
          lines: any[];
        }
      >();

      for (let i = 5; i < saleRows.length; i++) {
        const row = saleRows[i];
        if (!row || !row[0] || !row[1] || !row[3]) continue;

        const dateStr = parseExcelDate(row[0], startYear);
        const invoiceNo = String(row[1]).trim();
        const year = parseInt(dateStr.slice(0, 4), 10);
        const invoiceKey = `${year} | ${invoiceNo}`;

        const itemKey = String(row[3]).split('|')[0].trim();
        const itemId = itemByCodeOrName.get(itemKey) || itemByCodeOrName.get(String(row[3]).trim());
        if (!itemId) throw new Error(`صنف غير معروف في الصف ${i + 1}`);

        const qty = parseDecimal(row[4]);
        const unitPrice = parseDecimal(row[5]);
        const discount = parseDecimal(row[6]);
        const dueDateStr = row[7] ? parseExcelDate(row[7], startYear) : null;
        const lineTypeRaw = String(row[8] || '').trim();
        const isGift = lineTypeRaw.includes('هدية');

        const driverKey = row[9] ? String(row[9]).split('|')[0].trim() : null;
        const driverId = driverKey
          ? partyByCodeOrName.get(driverKey) || partyByCodeOrName.get(String(row[9]).trim())
          : null;
        const giftSettlementVal = parseDecimal(row[10]);
        const lineCode = String(row[11] || `S${String(i).padStart(6, '0')}`).trim();

        if (qty <= 0) throw new Error(`كمية غير صالحة في الصف ${i + 1}`);
        if ([unitPrice, discount, giftSettlementVal].some(value => value < 0)) throw new Error(`سعر أو خصم أو تسوية سالب في صف البيع ${i + 1}`);
        const rawNetSaleAmount = toDecimal(qty).times(unitPrice).minus(discount);
        if (!isGift && rawNetSaleAmount.lt(0)) throw new Error(`خصم صف البيع ${i + 1} أكبر من قيمته`);

        let customerId: string | null = null;
        if (!isGift && row[2]) {
          const clientKey = String(row[2]).split('|')[0].trim();
          customerId = partyByCodeOrName.get(clientKey) || partyByCodeOrName.get(String(row[2]).trim()) || null;
        }

        const groupKey = isGift ? `GIFT_${invoiceKey}_${i}` : `${customerId}__${invoiceKey}`;
        if (!saleInvoicesMap.has(groupKey)) {
          saleInvoicesMap.set(groupKey, {
            invoiceDate: dateStr,
            invoiceNo,
            invoiceYear: year,
            invoiceKey,
            dueDate: dueDateStr,
            customerId: isGift ? null : customerId,
            lines: [],
          });
        }

        const inv = saleInvoicesMap.get(groupKey)!;
        inv.lines.push({
          code: lineCode,
          lineType: isGift ? SaleLineType.DRIVER_GIFT : SaleLineType.SALE,
          itemId,
          qty,
          unitPrice: isGift ? 0 : unitPrice,
          discount: isGift ? 0 : discount,
          netSaleAmount: isGift ? 0 : toStorageDecimal(roundMoney(rawNetSaleAmount)).toString(),
          driverId: isGift ? driverId : null,
          driverGiftSettlementValue: isGift ? giftSettlementVal : 0,
        });
      }

      for (const [_, invData] of saleInvoicesMap) {
        const existingInvoice = await tx.saleInvoice.findFirst({ where: { invoiceKey: invData.invoiceKey, customerId: invData.customerId ?? null } });
        const invoiceData = {
          invoiceNo: invData.invoiceNo, invoiceYear: invData.invoiceYear, invoiceKey: invData.invoiceKey,
          invoiceDate: new Date(invData.invoiceDate), dueDate: invData.dueDate ? new Date(invData.dueDate) : null,
          customerId: invData.customerId, status: RecordStatus.POSTED,
        };
        const createdInv = existingInvoice ? await tx.saleInvoice.update({ where: { id: existingInvoice.id }, data: invoiceData }) : await tx.saleInvoice.create({
          data: {
            invoiceNo: invData.invoiceNo,
            invoiceYear: invData.invoiceYear,
            invoiceKey: invData.invoiceKey,
            invoiceDate: new Date(invData.invoiceDate),
            dueDate: invData.dueDate ? new Date(invData.dueDate) : null,
            customerId: invData.customerId,
            status: RecordStatus.POSTED,
          },
        });

        for (const line of invData.lines) {
          await tx.saleLine.upsert({
            where: { code: line.code },
            update: {
              invoiceId: createdInv.id,
              lineType: line.lineType,
              itemId: line.itemId,
              qty: line.qty,
              unitPrice: line.unitPrice,
              discount: line.discount,
              netSaleAmount: line.netSaleAmount,
              driverId: line.driverId,
              driverGiftSettlementValue: line.driverGiftSettlementValue,
              status: RecordStatus.POSTED,
            },
            create: {
              code: line.code,
              invoiceId: createdInv.id,
              lineType: line.lineType,
              itemId: line.itemId,
              qty: line.qty,
              unitPrice: line.unitPrice,
              discount: line.discount,
              netSaleAmount: line.netSaleAmount,
              driverId: line.driverId,
              driverGiftSettlementValue: line.driverGiftSettlementValue,
              status: RecordStatus.POSTED,
            },
          });
          counts.sales++;
        }
      }

      // -------------------------------------------------------------
      // Step 7: Manufacturing Batches & Materials (التصنيع ومواد التصنيع)
      // -------------------------------------------------------------
      const batchRows = getSheetRows('التصنيع');
      const batchMap = new Map<string, string>(); // batchNo -> batchId

      for (let i = 5; i < batchRows.length; i++) {
        const row = batchRows[i];
        if (!row || !row[0] || !row[1] || !row[2]) continue;

        const dateStr = parseExcelDate(row[0], startYear);
        const batchNo = String(row[1]).trim();
        const itemKey = String(row[2]).split('|')[0].trim();
        const itemId = itemByCodeOrName.get(itemKey) || itemByCodeOrName.get(String(row[2]).trim());
        const producedQty = parseDecimal(row[3]);

        if (itemId && producedQty > 0) {
          const batch = await tx.productionBatch.create({
            data: {
              code: batchNo,
              completionDate: new Date(dateStr),
              finishedItemId: itemId,
              producedQty,
              status: RecordStatus.POSTED,
            },
          });
          batchMap.set(batchNo, batch.id);
          counts.batches++;
        }
      }

      const materialRows = getSheetRows('مواد التصنيع');
      for (let i = 5; i < materialRows.length; i++) {
        const row = materialRows[i];
        if (!row || !row[0] || !row[1]) continue;

        const batchNo = String(row[0]).trim();
        const batchId = batchMap.get(batchNo);
        if (!batchId) throw new Error(`دفعة تصنيع غير معروفة في الصف ${i + 1}`);

        const itemKey = String(row[1]).split('|')[0].trim();
        const itemId = itemByCodeOrName.get(itemKey) || itemByCodeOrName.get(String(row[1]).trim());
        const consumedQty = parseDecimal(row[2]);

        if (itemId && consumedQty > 0) {
          await tx.batchMaterial.create({
            data: {
              batchId,
              rawItemId: itemId,
              consumedQty,
            },
          });
        }
      }

      // -------------------------------------------------------------
      // Step 8: Cash Transactions (الحسابات والمدفوعات)
      // -------------------------------------------------------------
      const cashRows = getSheetRows('الحسابات والمدفوعات');
      for (let i = 5; i < cashRows.length; i++) {
        const row = cashRows[i];
        if (!row || !row[0] || !row[2] || !row[6]) continue;

        const txDateStr = parseExcelDate(row[0], startYear);
        const code = String(row[1] || `C${String(i).padStart(6, '0')}`).trim();
        const type = mapCashTxType(row[2]);
        const partyKey = row[3] ? String(row[3]).split('|')[0].trim() : null;
        const partyId = partyKey
          ? partyByCodeOrName.get(partyKey) || partyByCodeOrName.get(String(row[3]).trim())
          : null;
        const invoiceKey = row[4] ? String(row[4]).trim() : null;
        const account = mapCashAccount(row[5]);
        const amount = parseDecimal(row[6]);
        const assetKey = row[7] ? String(row[7]).split('|')[0].trim() : null;
        const assetId = assetKey
          ? assetByCodeOrName.get(assetKey) || assetByCodeOrName.get(String(row[7]).trim())
          : null;
        const description = row[8] ? String(row[8]).trim() : null;

        if (amount > 0) {
          await tx.cashTransaction.upsert({
            where: { code },
            update: {
              txDate: new Date(txDateStr),
              type,
              account,
              amount,
              partyId,
              invoiceKey,
              assetId,
              description,
              status: RecordStatus.POSTED,
            },
            create: {
              code,
              txDate: new Date(txDateStr),
              type,
              account,
              amount,
              partyId,
              invoiceKey,
              assetId,
              description,
              status: RecordStatus.POSTED,
            },
          });
          counts.cashTransactions++;
        }
      }

      // -------------------------------------------------------------
      // Step 9: Returns (المرتجعات)
      // -------------------------------------------------------------
      const returnRows = getSheetRows('المرتجعات');
      const allDbSaleLines = await tx.saleLine.findMany({ select: { id: true, code: true } });
      const saleLineByCode = new Map(allDbSaleLines.map((l) => [l.code, l.id]));

      const allDbPurchLines = await tx.purchaseLine.findMany({ select: { id: true, code: true } });
      const purchLineByCode = new Map(allDbPurchLines.map((l) => [l.code, l.id]));

      for (let i = 5; i < returnRows.length; i++) {
        const row = returnRows[i];
        if (!row || !row[0] || !row[6] || !row[7]) continue;

        const dateStr = parseExcelDate(row[0], startYear);
        const code = String(row[1] || `R${String(i).padStart(6, '0')}`).trim();
        const docNo = String(row[2] || `RT-${i}`).trim();
        const isSaleReturn = String(row[3] || '').includes('مبيعات');
        const partyKey = row[4] ? String(row[4]).split('|')[0].trim() : null;
        const partyId = partyKey
          ? partyByCodeOrName.get(partyKey) || partyByCodeOrName.get(String(row[4]).trim())
          : null;
        const invoiceKey = row[5] ? String(row[5]).trim() : null;
        const srcCode = String(row[6]).trim();
        const qty = parseDecimal(row[7]);
        const condition = String(row[8] || '').includes('تالف')
          ? SaleReturnCondition.DAMAGED
          : SaleReturnCondition.GOOD;
        const supplierNoticeCredit = parseDecimal(row[9]);
        const reason = String(row[10] || 'مرتجع مسجل من الإكسل').trim();
        const notes = row[11] ? String(row[11]).trim() : null;

        if (qty > 0 && partyId && invoiceKey) {
          const sourceSaleLineId = isSaleReturn ? saleLineByCode.get(srcCode) || null : null;
          const sourcePurchaseLineId = !isSaleReturn ? purchLineByCode.get(srcCode) || null : null;

          await tx.returnLine.upsert({
            where: { code },
            update: {
              returnDocNo: docNo,
              returnDate: new Date(dateStr),
              type: isSaleReturn ? ReturnType.SALE_RETURN : ReturnType.PURCHASE_RETURN,
              partyId,
              invoiceKey,
              sourceSaleLineId,
              sourcePurchaseLineId,
              qty,
              saleReturnCondition: isSaleReturn ? condition : null,
              supplierCreditNote: !isSaleReturn && supplierNoticeCredit > 0 ? supplierNoticeCredit : null,
              reason,
              notes,
              status: RecordStatus.POSTED,
            },
            create: {
              code,
              returnDocNo: docNo,
              returnDate: new Date(dateStr),
              type: isSaleReturn ? ReturnType.SALE_RETURN : ReturnType.PURCHASE_RETURN,
              partyId,
              invoiceKey,
              sourceSaleLineId,
              sourcePurchaseLineId,
              qty,
              saleReturnCondition: isSaleReturn ? condition : null,
              supplierCreditNote: !isSaleReturn && supplierNoticeCredit > 0 ? supplierNoticeCredit : null,
              reason,
              notes,
              status: RecordStatus.POSTED,
            },
          });
          counts.returns++;
        }
      }

      // -------------------------------------------------------------
      // Step 10: Stock Issues (صرف المخزون)
      // -------------------------------------------------------------
      const issueRows = getSheetRows('صرف المخزون');
      for (let i = 5; i < issueRows.length; i++) {
        const row = issueRows[i];
        if (!row || !row[0] || !row[3] || !row[4]) continue;

        const dateStr = parseExcelDate(row[0], startYear);
        const code = String(row[1] || `IS${String(i).padStart(6, '0')}`).trim();
        const issueType = mapStockIssueType(row[2]);
        const itemKey = String(row[3]).split('|')[0].trim();
        const itemId = itemByCodeOrName.get(itemKey) || itemByCodeOrName.get(String(row[3]).trim());
        const qty = parseDecimal(row[4]);
        const testerRef = row[5] ? String(row[5]).trim() : null;
        const reason = String(row[6] || 'صرف مخزون').trim();
        const notes = row[7] ? String(row[7]).trim() : null;

        if (itemId && qty > 0) {
          await tx.stockIssue.upsert({
            where: { code },
            update: {
              issueDate: new Date(dateStr),
              type: issueType,
              itemId,
              qty,
              testerRef,
              reason,
              notes,
              status: RecordStatus.POSTED,
            },
            create: {
              code,
              issueDate: new Date(dateStr),
              type: issueType,
              itemId,
              qty,
              testerRef,
              reason,
              notes,
              status: RecordStatus.POSTED,
            },
          });
          counts.stockIssues++;
        }
      }

      // -------------------------------------------------------------
      // Step 11: Driver Referrals (عملاء السائقين)
      // -------------------------------------------------------------
      const referralRows = getSheetRows('عملاء السائقين');
      for (let i = 5; i < referralRows.length; i++) {
        const row = referralRows[i];
        if (!row || !row[0] || !row[1] || !row[2] || !row[3]) continue;

        const dateStr = parseExcelDate(row[0], startYear);
        const visitorUniqueKey = String(row[1]).trim();
        const visitorName = String(row[2]).trim();
        const driverKey = String(row[3]).split('|')[0].trim();
        const driverId = partyByCodeOrName.get(driverKey) || partyByCodeOrName.get(String(row[3]).trim());
        const code = String(row[4] || `VIS${String(i).padStart(6, '0')}`).trim();

        if (driverId && visitorUniqueKey && visitorName) {
          await tx.driverReferral.upsert({
            where: { code },
            update: {
              visitDate: new Date(dateStr),
              driverId,
              visitorUniqueKey,
              visitorName,
              status: RecordStatus.POSTED,
            },
            create: {
              code,
              visitDate: new Date(dateStr),
              driverId,
              visitorUniqueKey,
              visitorName,
              status: RecordStatus.POSTED,
            },
          });
          counts.referrals++;
        }
      }

      await logAudit({
        userId,
        action: 'IMPORT',
        entityType: 'ExcelWorkbook',
        entityCode: 'EXCEL_IMPORT',
        reason: 'استيراد شامل لملف Excel بنجاح',
        afterJson: counts,
      });
    },
    {
      timeout: 60000, // 60 seconds for full batch import
    }
  );

  // -------------------------------------------------------------
  // Post-Import Reconciliation Check against الرئيسية والتقارير
  // -------------------------------------------------------------
  const setting = await prisma.systemSetting.findFirst();
  const startYear = setting?.startYear ?? 2026;
  const reports = await loadReportsEngine(`${startYear}-01-01`, `${startYear}-12-31`);
  const balances = await loadBalancesEngine(`${startYear}-12-31`);

  const expectedValues: Record<string, { label: string; cellRef: string; excelVal: number; sysVal: number }> = {
    netSales: {
      label: 'صافي المبيعات',
      cellRef: 'B10',
      excelVal: parseDecimal(mainReportsSheet['B10']?.v, false),
      sysVal: reports.cards.netSales.toNumber(),
    },
    netCOGS: {
      label: 'تكلفة المبيعات',
      cellRef: 'B11',
      excelVal: parseDecimal(mainReportsSheet['B11']?.v, false),
      sysVal: reports.cards.netCOGS.toNumber(),
    },
    grossProfit: {
      label: 'مجمل الربح',
      cellRef: 'B12',
      excelVal: parseDecimal(mainReportsSheet['B12']?.v, false),
      sysVal: reports.cards.grossProfit.toNumber(),
    },
    cashExpenses: {
      label: 'المصروفات النقدية التشغيلية',
      cellRef: 'B13',
      excelVal: parseDecimal(mainReportsSheet['B13']?.v, false),
      sysVal: reports.cards.cashOperatingExpenses.toNumber(),
    },
    operatingProfit: {
      label: 'الربح التشغيلي',
      cellRef: 'B14',
      excelVal: parseDecimal(mainReportsSheet['B14']?.v, false),
      sysVal: reports.cards.operatingProfit.toNumber(),
    },
    inventoryValue: {
      label: 'قيمة المخزون',
      cellRef: 'B15',
      excelVal: parseDecimal(mainReportsSheet['B15']?.v, false),
      sysVal: reports.cards.inventoryValue.toNumber(),
    },
    cashAndBank: {
      label: 'إجمالي النقدية والبنوك',
      cellRef: 'B16',
      excelVal: parseDecimal(mainReportsSheet['B16']?.v, false),
      sysVal: reports.cards.cashAndBankTotal.toNumber(),
    },
    clientDebt: {
      label: 'مستحق العملاء',
      cellRef: 'J9',
      excelVal: parseDecimal(mainReportsSheet['J9']?.v, false),
      sysVal: reports.cards.clientDebtTotal.toNumber(),
    },
    supplierDebt: {
      label: 'مستحق الموردين',
      cellRef: 'J10',
      excelVal: parseDecimal(mainReportsSheet['J10']?.v, false),
      sysVal: reports.cards.supplierDebtTotal.toNumber(),
    },
  };

  const reconciliationItems: ReconciliationItem[] = [];
  let allMatched = true;

  for (const [key, item] of Object.entries(expectedValues)) {
    const diff = Math.abs(item.excelVal - item.sysVal);
    const matched = diff < 0.05; // tolerates rounding
    if (!matched) allMatched = false;

    reconciliationItems.push({
      key,
      label: item.label,
      cellRef: item.cellRef,
      excelValue: item.excelVal,
      systemValue: item.sysVal,
      diff,
      matched,
    });
  }

  return {
    success: true,
    message: allMatched
      ? 'تم الاستيراد بنجاح وتطابقت جميع الأرصدة المحاسبية بنسبة 100%'
      : 'تم استيراد البيانات مع وجود فروقات تستلزم المراجعة؛ راجع القيم قبل اعتماد الأرصدة',
    counts,
    reconciliation: {
      items: reconciliationItems,
      allMatched,
    },
  };

  });
}
