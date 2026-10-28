import { stockQuantitiesAt } from './stock-integrity';
import { todayInStore } from '@/domain/period';
import { withLedgerTransaction } from '@/lib/db';
import { prisma } from '@/lib/db';
import { Decimal, toDecimal, zero, toStorageDecimal, roundMoney } from '@/domain/decimal';
import { formatDate } from '@/domain/period';
import { nextSaleLineCode, nextCashCode } from './code-generator';
import { logAudit } from './audit.service';
import { loadBalancesEngine, loadAllLedgerData } from './ledger-loader';
import { RecordStatus, CashAccountType, CashTransactionType, SaleLineType } from '@prisma/client';

export interface SaleLineInput {
  itemId: string;
  qty: number | string | Decimal;
  unitPrice: number | string | Decimal;
  discount?: number | string | Decimal;
  lineType?: SaleLineType;
  driverId?: string | null;
  driverGiftSettlementValue?: number | string | Decimal | null;
}

export interface CreateSaleInvoiceInput {
  invoiceDate: string; // YYYY-MM-DD
  invoiceNo: string;
  customerId?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  lines: SaleLineInput[];
  // Instant collection option
  paidNow?: number | string | Decimal | null;
  collectionAccount?: CashAccountType | null;
}

export interface CreateDriverGiftDeliveryInput {
  invoiceDate: string; // YYYY-MM-DD
  driverId: string;
  itemId: string;
  qty: number | string | Decimal;
  driverGiftSettlementValue: number | string | Decimal;
  notes?: string | null;
}

/**
 * Calculates available stock for an item up to a specific date (Spec 07 Section 3)
 */
export async function getAvailableStockAtDate(itemId: string, targetDate: string): Promise<Decimal> {
  return (await stockQuantitiesAt(targetDate, [itemId])).get(itemId) ?? zero();
}

export async function createSaleInvoice(input: CreateSaleInvoiceInput, userId?: string) {
  return withLedgerTransaction(async () => {

  const { invoiceDate, invoiceNo, customerId, dueDate, notes, lines, paidNow, collectionAccount } = input;

  if (!lines || lines.length === 0) {
    throw new Error('يجب إضافة سطر صنف واحد على الأقل في فاتورة البيع');
  }

  // 1. Check system settings & lock date
  const setting = await prisma.systemSetting.findFirst();
  const allowNegative = setting?.allowNegativeStock ?? false;
  if (setting) {
    const minDate = `${setting.startYear}-01-01`;
    if (invoiceDate < minDate) {
      throw new Error(`تاريخ الفاتورة (${invoiceDate}) يسبق سنة بداية النظام (${setting.startYear})`);
    }
    if (setting.lockedThroughDate) {
      const lockStr = formatDate(setting.lockedThroughDate);
      if (invoiceDate <= lockStr) {
        throw new Error(`الفترة المحاسبية مغلقة حتى تاريخ ${lockStr}. لا يمكن تسجيل فواتير في فترة مغلقة.`);
      }
    }
  }

  // 2. Customer validation
  if (!customerId) {
    throw new Error('العميل إلزامي في فاتورة البيع');
  }
  const customer = await prisma.party.findUnique({ where: { id: customerId } });
  if (!customer?.isActive || customer.type !== 'CLIENT') {
    throw new Error('الطرف المحدد غير موجود أو نوعه ليس عميلاً');
  }

  // 3. Due date check
  if (dueDate && dueDate < invoiceDate) {
    throw new Error('تاريخ الاستحقاق يسبق تاريخ الفاتورة');
  }

  const cleanNo = invoiceNo.trim();
  if (!cleanNo) {
    throw new Error('رقم الفاتورة إلزامي');
  }

  const invoiceYear = new Date(invoiceDate).getFullYear();
  const invoiceKey = `${invoiceYear} | ${cleanNo}`;

  // 4. Duplicate invoiceKey check for same customer
  const existing = await prisma.saleInvoice.findFirst({
    where: {
      customerId,
      invoiceKey,
      status: 'POSTED',
    },
  });
  if (existing) {
    throw new Error(`رقم الفاتورة (${invoiceKey}) مكرر لنفس العميل`);
  }

  // 5. Validate lines & check stock
  const processedLines: Array<{
    itemId: string;
    qty: Decimal;
    unitPrice: Decimal;
    discount: Decimal;
    netSaleAmount: Decimal;
    lineType: SaleLineType;
    driverId?: string | null;
    driverGiftSettlementValue: Decimal;
  }> = [];

  let invoiceTotal = zero();

  // Group line quantities by item to check aggregated stock demand
  const itemDemands = new Map<string, Decimal>();
  for (const line of lines) {
    const qty = toStorageDecimal(line.qty);
    itemDemands.set(line.itemId, (itemDemands.get(line.itemId) || zero()).plus(qty));
  }

  for (const [itemId, demand] of itemDemands.entries()) {
    const available = await getAvailableStockAtDate(itemId, invoiceDate);
    if (demand.gt(available)) {
      if (!allowNegative) {
        const itemObj = await prisma.item.findUnique({
          where: { id: itemId },
          select: { name: true, unit: { select: { name: true } } },
        });
        throw new Error(
          `الكمية المباعة للصنف (${itemObj?.name}) تتجاوز المخزون المتاح حتى تاريخ ${invoiceDate} (المتاح: ${available.toString()} ${itemObj?.unit?.name ?? ''})`
        );
      }
    }
  }

  for (const line of lines) {
    const qty = toStorageDecimal(line.qty);
    const unitPrice = toStorageDecimal(line.unitPrice);
    const discount = toStorageDecimal(line.discount ?? 0);
    const lineType = line.lineType || SaleLineType.SALE;
    if (lineType !== 'SALE') throw new Error('هدايا السائقين تُسجل عبر عملية تسليم الهدية المخصصة');
    const activeItem = await prisma.item.findUnique({ where: { id: line.itemId }, select: { isActive: true } });
    if (!activeItem?.isActive) throw new Error('الصنف غير نشط أو غير موجود');

    if (qty.lte(0)) {
      throw new Error('كمية الصنف يجب أن تكون أكبر من الصفر');
    }
    if (unitPrice.lt(0)) {
      throw new Error('سعر الوحدة لا يمكن أن يكون سالباً');
    }
    if (discount.lt(0)) {
      throw new Error('خصم البند لا يمكن أن يكون سالباً');
    }

    const rawNetSaleAmount = qty.times(unitPrice).minus(discount);
    if (rawNetSaleAmount.lt(0)) {
      throw new Error('خصم البند أكبر من إجمالي سعر البند');
    }
    const netSaleAmount = toStorageDecimal(roundMoney(rawNetSaleAmount));

    invoiceTotal = invoiceTotal.plus(netSaleAmount);
    processedLines.push({
      itemId: line.itemId,
      qty,
      unitPrice,
      discount,
      netSaleAmount,
      lineType,
      driverId: null,
      driverGiftSettlementValue: zero(),
    });
  }

  // Instant collection check
  const collectionDec = toStorageDecimal(paidNow ?? 0);
  if (collectionDec.lt(0)) throw new Error('المبلغ المحصل لا يمكن أن يكون سالبًا');
  if (collectionDec.gt(0) && !collectionAccount) {
    throw new Error('يرجى تحديد حساب التحصيل (خزينة / بنك) لتسجيل المبلغ المحصل');
  }

  // 6. Execute atomic transaction
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.saleInvoice.create({
      data: {
        invoiceNo: cleanNo,
        invoiceYear,
        invoiceKey,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        customerId,
        notes: notes ?? null,
        status: 'POSTED',
      },
    });

    let lineIdx = 0;
    for (const sLine of processedLines) {
      const code = await nextSaleLineCode(lineIdx++);
      await tx.saleLine.create({
        data: {
          code,
          invoiceId: invoice.id,
          lineType: sLine.lineType,
          itemId: sLine.itemId,
          qty: sLine.qty.toString(),
          unitPrice: sLine.unitPrice.toString(),
          discount: sLine.discount.toString(),
          netSaleAmount: sLine.netSaleAmount.toString(),
          driverId: sLine.driverId,
          driverGiftSettlementValue: sLine.driverGiftSettlementValue.toString(),
          status: 'POSTED',
        },
      });
    }

    // Instant collection record
    if (collectionDec.gt(0) && collectionAccount) {
      const cashCode = await nextCashCode();
      await tx.cashTransaction.create({
        data: {
          code: cashCode,
          txDate: new Date(invoiceDate),
          type: CashTransactionType.CUSTOMER_COLLECTION,
          account: collectionAccount,
          amount: collectionDec.toString(),
          partyId: customerId,
          invoiceKey,
          description: `تحصيل فوري عند إنشاء فاتورة البيع ${invoiceKey}`,
          status: 'POSTED',
        },
      });

      await logAudit({
        userId,
        action: 'CREATE',
        entityType: 'CashTransaction',
        entityCode: cashCode,
        reason: `تحصيل فوري لفاتورة بيع ${invoiceKey}`,
        afterJson: {
          invoiceKey,
          amount: collectionDec.toString(),
          account: collectionAccount,
        },
      });
    }

    await logAudit({
      userId,
      action: 'CREATE',
      entityType: 'SaleInvoice',
      entityCode: invoiceKey,
      reason: 'إنشاء فاتورة بيع جديدة',
      afterJson: {
        id: invoice.id,
        invoiceKey,
        customerId,
        invoiceTotal: invoiceTotal.toString(),
        linesCount: processedLines.length,
      },
    });

    return invoice;
  });

  });
}

/**
 * Dedicated function for Driver Gift In-Kind Delivery (Spec 07 Section 1 & 2.2)
 */
export async function createDriverGiftDelivery(
  input: CreateDriverGiftDeliveryInput,
  userId?: string
) {
  return withLedgerTransaction(async () => {

  const { invoiceDate, driverId, itemId, qty, driverGiftSettlementValue, notes } = input;

  const driver = await prisma.party.findUnique({ where: { id: driverId } });
  if (!driver?.isActive || driver.type !== 'DRIVER') {
    throw new Error('الطرف المحدد ليس سائقاً');
  }
  if (!driver.isDriverGiftEnabled) {
    throw new Error('حساب هدايا السائق غير مفعّل لهذا السائق');
  }
  const giftItem = await prisma.item.findUnique({ where: { id: itemId }, select: { isActive: true } });
  if (!giftItem?.isActive) throw new Error('الصنف غير نشط أو غير موجود');

  const decQty = toStorageDecimal(qty);
  if (decQty.lte(0)) {
    throw new Error('كمية الهدية يجب أن تكون أكبر من الصفر');
  }

  const settlementVal = toStorageDecimal(driverGiftSettlementValue);
  if (settlementVal.lt(0)) {
    throw new Error('قيمة تسوية الهدية لا يمكن أن تكون سالبة');
  }

  // Stock check
  const setting = await prisma.systemSetting.findFirst();
  if (setting && invoiceDate < `${setting.startYear}-01-01`) throw new Error('تاريخ الهدية يسبق بداية النظام');
  if (setting?.lockedThroughDate && invoiceDate <= formatDate(setting.lockedThroughDate)) throw new Error('الفترة المحاسبية مقفلة');
  const allowNegative = setting?.allowNegativeStock ?? false;
  const available = await getAvailableStockAtDate(itemId, invoiceDate);
  if (decQty.gt(available) && !allowNegative) {
    const itemObj = await prisma.item.findUnique({
      where: { id: itemId },
      select: { name: true, unit: { select: { name: true } } },
    });
    throw new Error(
      `الكمية المهداة للصنف (${itemObj?.name}) تتجاوز المخزون المتاح حتى تاريخ ${invoiceDate} (المتاح: ${available.toString()} ${itemObj?.unit?.name ?? ''})`
    );
  }

  const invoiceYear = new Date(invoiceDate).getFullYear();
  // Sequential gift doc no
  const giftCount = await prisma.saleLine.count({ where: { lineType: 'DRIVER_GIFT' } });
  const invoiceNo = `GIFT-${String(giftCount + 1).padStart(4, '0')}`;
  const invoiceKey = `${invoiceYear} | ${invoiceNo}`;

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.saleInvoice.create({
      data: {
        invoiceNo,
        invoiceYear,
        invoiceKey,
        invoiceDate: new Date(invoiceDate),
        customerId: null,
        notes: notes || `تسليم هدية عينية للسائق ${driver.name}`,
        status: 'POSTED',
      },
    });

    const code = await nextSaleLineCode();
    const line = await tx.saleLine.create({
      data: {
        code,
        invoiceId: invoice.id,
        lineType: SaleLineType.DRIVER_GIFT,
        itemId,
        qty: decQty.toString(),
        unitPrice: 0,
        discount: 0,
        netSaleAmount: 0,
        driverId,
        driverGiftSettlementValue: settlementVal.toString(),
        status: 'POSTED',
      },
    });

    await logAudit({
      userId,
      action: 'CREATE',
      entityType: 'SaleLine',
      entityCode: code,
      reason: `تسليم هدية سائق عينية: ${driver.name}`,
      afterJson: {
        invoiceKey,
        driverId,
        itemId,
        qty: decQty.toString(),
        driverGiftSettlementValue: settlementVal.toString(),
      },
    });

    return { invoice, line };
  });

  });
}

export async function getSaleInvoices(options?: {
  year?: number;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const where: any = {};
  if (options?.year) where.invoiceYear = options.year;
  if (options?.customerId) where.customerId = options.customerId;
  if (options?.startDate || options?.endDate) {
    where.invoiceDate = {};
    if (options.startDate) where.invoiceDate.gte = new Date(options.startDate);
    if (options.endDate) where.invoiceDate.lte = new Date(options.endDate);
  }
  if (options?.search) {
    where.OR = [
      { invoiceNo: { contains: options.search, mode: 'insensitive' } },
      { invoiceKey: { contains: options.search, mode: 'insensitive' } },
      { customer: { name: { contains: options.search, mode: 'insensitive' } } },
    ];
  }

  const invoices = await prisma.saleInvoice.findMany({
    where,
    orderBy: [{ invoiceDate: 'desc' }, { id: 'desc' }],
    skip: ((options?.page ?? 1) - 1) * (options?.pageSize ?? 100),
    take: options?.pageSize ?? 100,
    include: {
      customer: { select: { id: true, code: true, name: true, phone: true } },
      lines: {
        include: {
          item: {
            select: { id: true, code: true, name: true, unit: { select: { name: true } } },
          },
          driver: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  const asOfDate = options?.endDate || todayInStore();
  const partyIds = [...new Set(invoices.flatMap(inv => inv.customerId ? [inv.customerId] : []))];
  const balancesResult = await loadBalancesEngine(asOfDate, await loadAllLedgerData(partyIds, invoices.map(inv => inv.invoiceKey)));
  const invoiceBalanceMap = new Map<string, any>();
  for (const item of balancesResult.invoiceItems) {
    if (item.partyType === 'CLIENT') {
      invoiceBalanceMap.set(`${item.partyId}__${item.invoiceKey}`, item);
    }
  }

  return invoices.map((inv) => {
    const key = `${inv.customerId}__${inv.invoiceKey}`;
    const bal = invoiceBalanceMap.get(key);
    const invoiceTotal = inv.lines.reduce((acc, l) => acc.plus(toDecimal(l.netSaleAmount)), zero()).toNumber();

    return {
      ...inv,
      invoiceTotal,
      originalAsOf: bal ? Number(bal.originalAsOf) : invoiceTotal,
      returnsAsOf: bal ? Number(bal.returnsAsOf) : 0,
      settlementAsOf: bal ? Number(bal.settlementAsOf) : 0,
      refundAsOf: bal ? Number(bal.refundAsOf) : 0,
      signedAsOf: bal ? Number(bal.signedAsOf) : invoiceTotal,
      invoiceDebt: bal ? Number(bal.invoiceDebt) : invoiceTotal,
      invoiceCredit: bal ? Number(bal.invoiceCredit) : 0,
      daysOverdue: bal ? bal.daysOverdue : 0,
      aging: bal ? bal.aging : 'غير مستحق',
    };
  });
}

export async function getSaleInvoiceById(id: string, asOfDate?: string) {
  const invoice = await prisma.saleInvoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: {
        include: {
          item: {
            include: { unit: true, category: true },
          },
          driver: true,
        },
      },
    },
  });

  if (!invoice) return null;

  const targetDate = asOfDate || todayInStore();
  const balancesResult = await loadBalancesEngine(targetDate, await loadAllLedgerData(invoice.customerId ? [invoice.customerId] : [], [invoice.invoiceKey]));
  const bal = invoice.customerId
    ? balancesResult.invoiceItems.find(
        (b) => b.partyId === invoice.customerId && b.invoiceKey === invoice.invoiceKey
      )
    : null;

  const [collections, returns] = await Promise.all([
    invoice.customerId
      ? prisma.cashTransaction.findMany({
          where: {
            partyId: invoice.customerId,
            invoiceKey: invoice.invoiceKey,
            status: 'POSTED',
          },
          orderBy: { txDate: 'asc' },
        })
      : [],
    invoice.customerId
      ? prisma.returnLine.findMany({
          where: {
            partyId: invoice.customerId,
            invoiceKey: invoice.invoiceKey,
            status: 'POSTED',
          },
          orderBy: { returnDate: 'asc' },
        })
      : [],
  ]);

  const invoiceTotal = invoice.lines.reduce((acc, l) => acc.plus(toDecimal(l.netSaleAmount)), zero()).toNumber();

  return {
    ...invoice,
    invoiceTotal,
    originalAsOf: bal ? Number(bal.originalAsOf) : invoiceTotal,
    returnsAsOf: bal ? Number(bal.returnsAsOf) : 0,
    settlementAsOf: bal ? Number(bal.settlementAsOf) : 0,
    refundAsOf: bal ? Number(bal.refundAsOf) : 0,
    signedAsOf: bal ? Number(bal.signedAsOf) : invoiceTotal,
    invoiceDebt: bal ? Number(bal.invoiceDebt) : invoiceTotal,
    invoiceCredit: bal ? Number(bal.invoiceCredit) : 0,
    daysOverdue: bal ? bal.daysOverdue : 0,
    aging: bal ? bal.aging : 'غير مستحق',
    collections,
    returns,
  };
}

export async function voidSaleInvoice(id: string, reason: string, userId?: string) {
  return withLedgerTransaction(async () => {

  if (!reason || reason.trim().length < 3) {
    throw new Error('سبب الإلغاء إلزامي ويجب ألا يقل عن 3 أحرف');
  }

  const invoice = await prisma.saleInvoice.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!invoice) {
    throw new Error('فاتورة البيع غير موجودة');
  }

  if (invoice.status === RecordStatus.VOID) {
    throw new Error('الفاتورة ملغاة مسبقاً');
  }

  const setting = await prisma.systemSetting.findFirst();
  if (setting?.lockedThroughDate) {
    const lockStr = formatDate(setting.lockedThroughDate);
    const invDateStr = formatDate(invoice.invoiceDate);
    if (invDateStr <= lockStr) {
      throw new Error(`الفترة حتى ${lockStr} مقفلة محاسبياً؛ لا يمكن إلغاء حركات فيها`);
    }
  }

  if (invoice.customerId) {
    const [hasCollections, hasReturns] = await Promise.all([
      prisma.cashTransaction.findFirst({
        where: {
          partyId: invoice.customerId,
          invoiceKey: invoice.invoiceKey,
          status: 'POSTED',
        },
      }),
      prisma.returnLine.findFirst({
        where: {
          partyId: invoice.customerId,
          invoiceKey: invoice.invoiceKey,
          status: 'POSTED',
        },
      }),
    ]);

    if (hasCollections || hasReturns) {
      throw new Error(
        'لا يمكن إلغاء الفاتورة لوجود تحصيلات أو مرتجعات مرتبطة بها؛ ألغِ الحركات المرتبطة أولاً'
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.saleInvoice.update({
      where: { id },
      data: {
        status: RecordStatus.VOID,
        voidReason: reason.trim(),
        voidedAt: new Date(),
      },
    });

    await tx.saleLine.updateMany({
      where: { invoiceId: id },
      data: { status: RecordStatus.VOID },
    });

    await logAudit({
      userId,
      action: 'VOID',
      entityType: 'SaleInvoice',
      entityCode: invoice.invoiceKey,
      reason: reason.trim(),
      beforeState: { status: invoice.status },
      afterState: { status: RecordStatus.VOID, voidReason: reason.trim() },
    });

    return updated;
  });

  });
}
