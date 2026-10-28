import { todayInStore } from '@/domain/period';
import { withLedgerTransaction } from '@/lib/db';
import { prisma } from '@/lib/db';
import { Decimal, toDecimal, zero, toStorageDecimal, roundMoney } from '@/domain/decimal';
import { formatDate } from '@/domain/period';
import { nextPurchaseLineCode, nextCashCode } from './code-generator';
import { logAudit } from './audit.service';
import { loadBalancesEngine } from './ledger-loader';
import { RecordStatus, CashAccountType, CashTransactionType } from '@prisma/client';

export interface PurchaseLineInput {
  itemId: string;
  qty: number | string | Decimal;
  unitCost: number | string | Decimal;
  landedCost?: number | string | Decimal;
  discount?: number | string | Decimal;
}

export interface CreatePurchaseInvoiceInput {
  invoiceDate: string; // YYYY-MM-DD
  invoiceNo: string;
  supplierId: string;
  dueDate?: string | null;
  notes?: string | null;
  lines: PurchaseLineInput[];
  // Instant payment option
  paidNow?: number | string | Decimal | null;
  paymentAccount?: CashAccountType | null;
}

export async function createPurchaseInvoice(
  input: CreatePurchaseInvoiceInput,
  userId?: string
) {
  return withLedgerTransaction(async () => {

  const { invoiceDate, invoiceNo, supplierId, dueDate, notes, lines, paidNow, paymentAccount } = input;

  if (!lines || lines.length === 0) {
    throw new Error('يجب إضافة سطر صنف واحد على الأقل في فاتورة الشراء');
  }

  // 1. Check system settings & lock date
  const setting = await prisma.systemSetting.findFirst();
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

  // 2. Due date check
  if (dueDate && dueDate < invoiceDate) {
    throw new Error('تاريخ الاستحقاق يسبق تاريخ الفاتورة');
  }

  // 3. Supplier check
  const supplier = await prisma.party.findUnique({ where: { id: supplierId } });
  if (!supplier?.isActive || supplier.type !== 'SUPPLIER') {
    throw new Error('المورد المحدد غير موجود أو نوعه ليس مورداً');
  }

  const cleanNo = invoiceNo.trim();
  if (!cleanNo) {
    throw new Error('رقم الفاتورة إلزامي');
  }

  const invoiceYear = new Date(invoiceDate).getFullYear();
  const invoiceKey = `${invoiceYear} | ${cleanNo}`;

  // 4. Duplicate invoiceKey check for same supplier
  const existing = await prisma.purchaseInvoice.findFirst({
    where: {
      supplierId,
      invoiceKey,
      status: 'POSTED',
    },
  });
  if (existing) {
    throw new Error(`رقم الفاتورة (${invoiceKey}) مكرر لنفس المورد`);
  }

  // 5. Validate and calculate line amounts
  const processedLines: Array<{
    itemId: string;
    qty: Decimal;
    unitCost: Decimal;
    landedCost: Decimal;
    discount: Decimal;
    lineTotalCost: Decimal;
  }> = [];

  let invoiceTotal = zero();

  for (const line of lines) {
    const item = await prisma.item.findUnique({ where: { id: line.itemId }, select: { isActive: true } });
    if (!item?.isActive) throw new Error('الصنف غير نشط أو غير موجود');
    const qty = toStorageDecimal(line.qty);
    const unitCost = toStorageDecimal(line.unitCost);
    const landedCost = toStorageDecimal(line.landedCost ?? 0);
    const discount = toStorageDecimal(line.discount ?? 0);

    if (qty.lte(0)) {
      throw new Error('كمية الصنف يجب أن تكون أكبر من الصفر');
    }
    if (unitCost.lt(0)) {
      throw new Error('تكلفة الوحدة لا يمكن أن تكون سالبة');
    }
    if (landedCost.lt(0)) {
      throw new Error('تكلفة الوصول لا يمكن أن تكون سالبة');
    }
    if (discount.lt(0)) {
      throw new Error('خصم البند لا يمكن أن يكون سالباً');
    }

    // lineTotalCost = qty * unitCost + landedCost - discount
    const rawLineTotalCost = qty.times(unitCost).plus(landedCost).minus(discount);
    if (rawLineTotalCost.lt(0)) {
      throw new Error('خصم البند أكبر من إجمالي تكلفة البند');
    }
    const lineTotalCost = toStorageDecimal(roundMoney(rawLineTotalCost));

    invoiceTotal = invoiceTotal.plus(lineTotalCost);
    processedLines.push({
      itemId: line.itemId,
      qty,
      unitCost,
      landedCost,
      discount,
      lineTotalCost,
    });
  }

  // Instant payment check
  const paymentDec = toStorageDecimal(paidNow ?? 0);
  if (paymentDec.lt(0)) throw new Error('المبلغ المسدد لا يمكن أن يكون سالبًا');
  if (paymentDec.gt(0) && !paymentAccount) {
    throw new Error('يرجى تحديد حساب الدفع (خزينة / بنك) لتسجيل الدفعة المسددة');
  }

  // 6. Execute atomic transaction
  return prisma.$transaction(async (tx) => {
    // Create header
    const invoice = await tx.purchaseInvoice.create({
      data: {
        invoiceNo: cleanNo,
        invoiceYear,
        invoiceKey,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        supplierId,
        notes: notes ?? null,
        status: 'POSTED',
      },
    });

    // Create lines with sequential codes
    let lineIdx = 0;
    for (const pLine of processedLines) {
      const code = await nextPurchaseLineCode(lineIdx++);
      await tx.purchaseLine.create({
        data: {
          code,
          invoiceId: invoice.id,
          itemId: pLine.itemId,
          qty: pLine.qty.toString(),
          unitCost: pLine.unitCost.toString(),
          landedCost: pLine.landedCost.toString(),
          discount: pLine.discount.toString(),
          lineTotalCost: pLine.lineTotalCost.toString(),
          status: 'POSTED',
        },
      });
    }

    // Create instant supplier payment if provided
    if (paymentDec.gt(0) && paymentAccount) {
      const cashCode = await nextCashCode();
      await tx.cashTransaction.create({
        data: {
          code: cashCode,
          txDate: new Date(invoiceDate),
          type: CashTransactionType.SUPPLIER_PAYMENT,
          account: paymentAccount,
          amount: paymentDec.toString(),
          partyId: supplierId,
          invoiceKey,
          description: `سداد فوري عند إنشاء فاتورة الشراء ${invoiceKey}`,
          status: 'POSTED',
        },
      });

      await logAudit({
        userId,
        action: 'CREATE',
        entityType: 'CashTransaction',
        entityCode: cashCode,
        reason: `سداد فوري لفاتورة شراء ${invoiceKey}`,
        afterJson: {
          invoiceKey,
          amount: paymentDec.toString(),
          account: paymentAccount,
        },
      });
    }

    await logAudit({
      userId,
      action: 'CREATE',
      entityType: 'PurchaseInvoice',
      entityCode: invoiceKey,
      reason: 'إنشاء فاتورة شراء جديدة',
      afterJson: {
        id: invoice.id,
        invoiceKey,
        supplierId,
        invoiceTotal: invoiceTotal.toString(),
        linesCount: processedLines.length,
      },
    });

    return invoice;
  });

  });
}

export async function getPurchaseInvoices(options?: {
  year?: number;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const where: any = {};
  if (options?.year) where.invoiceYear = options.year;
  if (options?.supplierId) where.supplierId = options.supplierId;
  if (options?.startDate || options?.endDate) {
    where.invoiceDate = {};
    if (options.startDate) where.invoiceDate.gte = new Date(options.startDate);
    if (options.endDate) where.invoiceDate.lte = new Date(options.endDate);
  }
  if (options?.search) {
    where.OR = [
      { invoiceNo: { contains: options.search, mode: 'insensitive' } },
      { invoiceKey: { contains: options.search, mode: 'insensitive' } },
      { supplier: { name: { contains: options.search, mode: 'insensitive' } } },
    ];
  }

  const invoices = await prisma.purchaseInvoice.findMany({
    where,
    orderBy: { invoiceDate: 'desc' },
    include: {
      supplier: { select: { id: true, code: true, name: true, phone: true } },
      lines: {
        include: {
          item: {
            select: { id: true, code: true, name: true, unit: { select: { name: true } } },
          },
        },
      },
    },
  });

  // Calculate balances as of today or report end date
  const asOfDate = options?.endDate || todayInStore();
  const balancesResult = await loadBalancesEngine(asOfDate);
  const invoiceBalanceMap = new Map<string, any>();
  for (const item of balancesResult.invoiceItems) {
    if (item.partyType === 'SUPPLIER') {
      invoiceBalanceMap.set(`${item.partyId}__${item.invoiceKey}`, item);
    }
  }

  return invoices.map((inv) => {
    const key = `${inv.supplierId}__${inv.invoiceKey}`;
    const bal = invoiceBalanceMap.get(key);
    const invoiceTotal = inv.lines.reduce((acc, l) => acc.plus(toDecimal(l.lineTotalCost)), zero()).toNumber();

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

export async function getPurchaseInvoiceById(id: string, asOfDate?: string) {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      lines: {
        include: {
          item: {
            include: { unit: true, category: true },
          },
        },
      },
    },
  });

  if (!invoice) return null;

  const targetDate = asOfDate || todayInStore();
  const balancesResult = await loadBalancesEngine(targetDate);
  const key = `${invoice.supplierId}__${invoice.invoiceKey}`;
  const bal = balancesResult.invoiceItems.find(
    (b) => b.partyId === invoice.supplierId && b.invoiceKey === invoice.invoiceKey
  );

  // Find related cash payments and returns
  const [payments, returns] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: {
        partyId: invoice.supplierId,
        invoiceKey: invoice.invoiceKey,
        status: 'POSTED',
      },
      orderBy: { txDate: 'asc' },
    }),
    prisma.returnLine.findMany({
      where: {
        partyId: invoice.supplierId,
        invoiceKey: invoice.invoiceKey,
        status: 'POSTED',
      },
      orderBy: { returnDate: 'asc' },
    }),
  ]);

  const invoiceTotal = invoice.lines.reduce((acc, l) => acc.plus(toDecimal(l.lineTotalCost)), zero()).toNumber();

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
    payments,
    returns,
  };
}

export async function voidPurchaseInvoice(id: string, reason: string, userId?: string) {
  return withLedgerTransaction(async () => {

  if (!reason || reason.trim().length < 3) {
    throw new Error('سبب الإلغاء إلزامي ويجب ألا يقل عن 3 أحرف');
  }

  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!invoice) {
    throw new Error('فاتورة الشراء غير موجودة');
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

  // Integrity rule: cannot void if there are posted payments or returns
  const [hasPayments, hasReturns] = await Promise.all([
    prisma.cashTransaction.findFirst({
      where: {
        partyId: invoice.supplierId,
        invoiceKey: invoice.invoiceKey,
        status: 'POSTED',
      },
    }),
    prisma.returnLine.findFirst({
      where: {
        partyId: invoice.supplierId,
        invoiceKey: invoice.invoiceKey,
        status: 'POSTED',
      },
    }),
  ]);

  if (hasPayments || hasReturns) {
    throw new Error(
      'لا يمكن إلغاء الفاتورة لوجود سدادات أو مرتجعات مرتبطة بها؛ ألغِ الحركات المرتبطة أولاً'
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseInvoice.update({
      where: { id },
      data: {
        status: RecordStatus.VOID,
        voidReason: reason.trim(),
        voidedAt: new Date(),
      },
    });

    await tx.purchaseLine.updateMany({
      where: { invoiceId: id },
      data: { status: RecordStatus.VOID },
    });

    await logAudit({
      userId,
      action: 'VOID',
      entityType: 'PurchaseInvoice',
      entityCode: invoice.invoiceKey,
      reason: reason.trim(),
      beforeState: { status: invoice.status },
      afterState: { status: RecordStatus.VOID, voidReason: reason.trim() },
    });

    return updated;
  });

  });
}
