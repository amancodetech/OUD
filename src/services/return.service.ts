import { withLedgerTransaction } from '@/lib/db';
import { prisma } from '@/lib/db';
import { Decimal, toDecimal, zero, toStorageDecimal } from '@/domain/decimal';
import { formatDate, getMonthIndex } from '@/domain/period';
import { nextReturnCode, nextCashCode } from './code-generator';
import { logAudit } from './audit.service';
import { loadCostingEngine, loadBalancesEngine } from './ledger-loader';
import {
  ReturnType,
  SaleReturnCondition,
  RecordStatus,
  CashAccountType,
  CashTransactionType,
  Prisma,
} from '@prisma/client';

export interface CreateReturnLineInput {
  type: ReturnType; // SALE_RETURN | PURCHASE_RETURN
  returnDate: string; // YYYY-MM-DD
  returnDocNo: string; // RT-001
  partyId: string;
  invoiceKey: string;
  sourceSaleLineId?: string | null;
  sourcePurchaseLineId?: string | null;
  qty: number | string | Decimal;
  saleReturnCondition?: SaleReturnCondition | null; // GOOD | DAMAGED
  supplierCreditNote?: number | string | Decimal | null;
  reason: string;
  notes?: string | null;
  // Instant Cash Refund Option for Sales Return
  refundCashNow?: boolean;
  refundAccount?: CashAccountType | null;
}

export async function createReturnLine(input: CreateReturnLineInput, userId?: string) {
  return withLedgerTransaction(async () => {

  const {
    type,
    returnDate,
    returnDocNo,
    partyId,
    invoiceKey,
    sourceSaleLineId,
    sourcePurchaseLineId,
    qty,
    saleReturnCondition,
    supplierCreditNote,
    reason,
    notes,
    refundCashNow,
    refundAccount,
  } = input;

  if (!reason || reason.trim().length === 0) {
    throw new Error('السبب إلزامي لتسجيل المرتجع');
  }

  const decQty = toStorageDecimal(qty);
  if (decQty.lte(0)) {
    throw new Error('الكمية المرتجعة يجب أن تكون أكبر من الصفر');
  }

  // 1. System setting & Lock check
  const setting = await prisma.systemSetting.findFirst();
  if (setting) {
    const minDate = `${setting.startYear}-01-01`;
    if (returnDate < minDate) {
      throw new Error(`تاريخ المرتجع (${returnDate}) يسبق سنة بداية النظام (${setting.startYear})`);
    }
    if (setting.lockedThroughDate) {
      const lockStr = formatDate(setting.lockedThroughDate);
      if (returnDate <= lockStr) {
        throw new Error(`الفترة المحاسبية مغلقة حتى تاريخ ${lockStr}. لا يمكن تسجيل مرتجع في فترة مغلقة.`);
      }
    }
  }

  // 2. Party check
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party?.isActive) throw new Error('الطرف المحدد غير موجود أو غير نشط');
  if (!['SALE_RETURN', 'PURCHASE_RETURN'].includes(type)) throw new Error('نوع مرتجع غير صالح');
  if (type === 'SALE_RETURN' && !['GOOD', 'DAMAGED'].includes(saleReturnCondition ?? '')) throw new Error('حالة المرتجع غير صالحة');
  if (supplierCreditNote != null && toStorageDecimal(supplierCreditNote).lt(0)) throw new Error('إشعار المورد لا يمكن أن يكون سالبًا');

  let sourceDateStr = '';
  let originalQty = zero();
  let sourceNetUnitPrice = zero();

  // 3. Source line & cumulative ceiling validation
  if (type === 'SALE_RETURN') {
    if (party.type !== 'CLIENT') {
      throw new Error('في مرتجع البيع، يجب أن يكون الطرف عميلاً');
    }
    if (!sourceSaleLineId) {
      throw new Error('يرجى تحديد سطر فاتورة البيع الأصلي');
    }
    if (!saleReturnCondition) {
      throw new Error('يرجى تحديد حالة مرتجع البيع (صالح أو تالف)');
    }

    const saleLine = await prisma.saleLine.findUnique({
      where: { id: sourceSaleLineId },
      include: { invoice: true, item: { include: { unit: true } } },
    });
    if (!saleLine) throw new Error('سطر البيع الأصلي غير موجود');
    if (saleLine.status !== 'POSTED' || saleLine.invoice.status !== 'POSTED' ||
        saleLine.invoice.customerId !== partyId || saleLine.invoice.invoiceKey !== invoiceKey) throw new Error('سطر البيع لا يطابق الطرف والفاتورة المعتمدة');

    if (saleLine.lineType === 'DRIVER_GIFT') {
      throw new Error('لا يُسمح باختيار هدايا السائقين العينية كمصدر لمرتجع بيع');
    }

    sourceDateStr = formatDate(saleLine.invoice.invoiceDate);
    originalQty = toDecimal(saleLine.qty);
    const netSaleAmount = toDecimal(saleLine.netSaleAmount);
    sourceNetUnitPrice = originalQty.gt(0) ? netSaleAmount.div(originalQty) : zero();

    // Check prior returns on this sale line
    const priorReturns = await prisma.returnLine.findMany({
      where: {
        sourceSaleLineId,
        status: 'POSTED',
      },
      select: { qty: true },
    });
    let priorReturnedQty = zero();
    for (const pr of priorReturns) {
      priorReturnedQty = priorReturnedQty.plus(toDecimal(pr.qty));
    }

    const totalCandidate = priorReturnedQty.plus(decQty);
    if (totalCandidate.minus(originalQty).gt(new Decimal('0.000000001'))) {
      const remaining = Decimal.max(originalQty.minus(priorReturnedQty), zero());
      throw new Error(
        `إجمالي الكمية المرتجعة لهذا السطر يتجاوز الكمية الأصلية في الفاتورة (المتبقي القابل للإرجاع: ${remaining.toString()} ${saleLine.item.unit.name})`
      );
    }
  } else {
    // PURCHASE_RETURN
    if (party.type !== 'SUPPLIER') {
      throw new Error('في مرتجع الشراء، يجب أن يكون الطرف مورداً');
    }
    if (!sourcePurchaseLineId) {
      throw new Error('يرجى تحديد سطر فاتورة الشراء الأصلي');
    }

    const purchaseLine = await prisma.purchaseLine.findUnique({
      where: { id: sourcePurchaseLineId },
      include: { invoice: true, item: { include: { unit: true } } },
    });
    if (!purchaseLine) throw new Error('سطر الشراء الأصلي غير موجود');
    if (purchaseLine.status !== 'POSTED' || purchaseLine.invoice.status !== 'POSTED' ||
        purchaseLine.invoice.supplierId !== partyId || purchaseLine.invoice.invoiceKey !== invoiceKey) throw new Error('سطر الشراء لا يطابق الطرف والفاتورة المعتمدة');

    sourceDateStr = formatDate(purchaseLine.invoice.invoiceDate);
    originalQty = toDecimal(purchaseLine.qty);
    const lineTotalCost = toDecimal(purchaseLine.lineTotalCost);
    sourceNetUnitPrice = originalQty.gt(0) ? lineTotalCost.div(originalQty) : zero();

    const priorReturns = await prisma.returnLine.findMany({
      where: {
        sourcePurchaseLineId,
        status: 'POSTED',
      },
      select: { qty: true },
    });
    let priorReturnedQty = zero();
    for (const pr of priorReturns) {
      priorReturnedQty = priorReturnedQty.plus(toDecimal(pr.qty));
    }

    const totalCandidate = priorReturnedQty.plus(decQty);
    if (totalCandidate.minus(originalQty).gt(new Decimal('0.000000001'))) {
      const remaining = Decimal.max(originalQty.minus(priorReturnedQty), zero());
      throw new Error(
        `إجمالي الكمية المرتجعة لهذا السطر يتجاوز الكمية الأصلية في الفاتورة (المتبقي القابل للإرجاع: ${remaining.toString()} ${purchaseLine.item.unit.name})`
      );
    }
  }

  // 4. Return date must be >= sourceDate
  if (returnDate < sourceDateStr) {
    throw new Error(`تاريخ المرتجع (${returnDate}) يسبق تاريخ الفاتورة الأصلية (${sourceDateStr})`);
  }

  // 5. Code & Transaction Execution
  const returnCode = await nextReturnCode();

  return prisma.$transaction(async (tx) => {
    const returnLine = await tx.returnLine.create({
      data: {
        code: returnCode,
        returnDocNo: returnDocNo.trim() || returnCode,
        returnDate: new Date(returnDate),
        type,
        partyId,
        invoiceKey,
        sourceSaleLineId: type === 'SALE_RETURN' ? sourceSaleLineId : null,
        sourcePurchaseLineId: type === 'PURCHASE_RETURN' ? sourcePurchaseLineId : null,
        qty: decQty.toString(),
        saleReturnCondition: type === 'SALE_RETURN' ? saleReturnCondition : null,
        supplierCreditNote:
          type === 'PURCHASE_RETURN' && supplierCreditNote !== undefined && supplierCreditNote !== null
            ? toStorageDecimal(supplierCreditNote).toString()
            : null,
        reason: reason.trim(),
        notes: notes ?? null,
        status: RecordStatus.POSTED,
      },
    });

    // Instant Cash Refund for Sales Return (Frictionless entry feature)
    if (type === 'SALE_RETURN' && refundCashNow) {
      if (!refundAccount) {
        throw new Error('يرجى تحديد حساب الدفع (خزينة / بنك) لرد المبلغ نقداً للعميل');
      }

      const refundAmount = decQty.times(sourceNetUnitPrice);
      if (refundAmount.gt(0)) {
        const balances = await loadBalancesEngine(returnDate);
        const credit = balances.checkCreditBefore(partyId, invoiceKey, returnDate, refundAmount);
        if (!credit.refundLimitValid || credit.creditBefore.lt(refundAmount)) throw new Error('لا يوجد رصيد دائن كافٍ لرد المبلغ نقدًا');
        const cashCode = await nextCashCode();
        await tx.cashTransaction.create({
          data: {
            code: cashCode,
            sourceReturnId: returnLine.id,
            txDate: new Date(returnDate),
            type: CashTransactionType.CUSTOMER_REFUND,
            account: refundAccount,
            amount: refundAmount.toNumber(),
            partyId,
            invoiceKey,
            description: `رد نقدي فوري لمرتجع البيع ${returnCode}`,
            status: RecordStatus.POSTED,
          },
        });

        await logAudit({
          userId,
          action: 'CREATE',
          entityType: 'CashTransaction',
          entityCode: cashCode,
          reason: `رد نقدي فوري لمرتجع بيع ${returnCode}`,
          afterJson: {
            invoiceKey,
            amount: refundAmount.toString(),
            account: refundAccount,
          },
        });
      }
    }

    await logAudit({
      userId,
      action: 'CREATE',
      entityType: 'ReturnLine',
      entityCode: returnCode,
      reason: `تسجيل مرتجع ${type === 'SALE_RETURN' ? 'بيع' : 'شراء'}: ${reason}`,
      afterJson: {
        id: returnLine.id,
        returnCode,
        invoiceKey,
        qty: decQty.toString(),
        condition: saleReturnCondition,
      },
    });

    return returnLine;
  });

  });
}

/**
 * Returns eligible source lines for an invoice with remaining returnable quantities
 */
export async function getSourceLineOptions(invoiceKey: string, type: ReturnType, partyId?: string) {
  if (!partyId) throw new Error('الطرف إلزامي لاختيار الفاتورة الأصلية');
  if (type === 'SALE_RETURN') {
    const saleInvoice = await prisma.saleInvoice.findFirst({
      where: { invoiceKey, customerId: partyId, status: 'POSTED' },
      include: {
        lines: {
          where: { status: 'POSTED', lineType: 'SALE' },
          include: {
            item: { include: { unit: true } },
            returns: { where: { status: 'POSTED' }, select: { qty: true } },
          },
        },
      },
    });

    if (!saleInvoice) return [];

    return saleInvoice.lines.map((line) => {
      const origQty = toDecimal(line.qty);
      const returnedQty = line.returns.reduce((sum, r) => sum.plus(toDecimal(r.qty)), zero());
      const remainingQty = Decimal.max(origQty.minus(returnedQty), zero());
      const netUnitPrice = origQty.gt(0) ? toDecimal(line.netSaleAmount).div(origQty) : zero();

      return {
        id: line.id,
        code: line.code,
        itemId: line.itemId,
        itemName: line.item.name,
        unitName: line.item.unit.name,
        originalQty: origQty.toNumber(),
        alreadyReturnedQty: returnedQty.toNumber(),
        remainingReturnableQty: remainingQty.toNumber(),
        originalNetUnitPrice: netUnitPrice.toNumber(),
      };
    });
  } else {
    // PURCHASE_RETURN
    const purchInvoice = await prisma.purchaseInvoice.findFirst({
      where: { invoiceKey, supplierId: partyId, status: 'POSTED' },
      include: {
        lines: {
          where: { status: 'POSTED' },
          include: {
            item: { include: { unit: true } },
            returns: { where: { status: 'POSTED' }, select: { qty: true } },
          },
        },
      },
    });

    if (!purchInvoice) return [];

    return purchInvoice.lines.map((line) => {
      const origQty = toDecimal(line.qty);
      const returnedQty = line.returns.reduce((sum, r) => sum.plus(toDecimal(r.qty)), zero());
      const remainingQty = Decimal.max(origQty.minus(returnedQty), zero());
      const netUnitPrice = origQty.gt(0) ? toDecimal(line.lineTotalCost).div(origQty) : zero();

      return {
        id: line.id,
        code: line.code,
        itemId: line.itemId,
        itemName: line.item.name,
        unitName: line.item.unit.name,
        originalQty: origQty.toNumber(),
        alreadyReturnedQty: returnedQty.toNumber(),
        remainingReturnableQty: remainingQty.toNumber(),
        originalNetUnitPrice: netUnitPrice.toNumber(),
      };
    });
  }
}

export async function getReturnLines(options?: {
  type?: ReturnType;
  partyId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.ReturnLineWhereInput = {};
  if (options?.type) where.type = options.type;
  if (options?.partyId) where.partyId = options.partyId;
  if (options?.startDate || options?.endDate) {
    where.returnDate = {};
    if (options.startDate) where.returnDate.gte = new Date(options.startDate);
    if (options.endDate) where.returnDate.lte = new Date(options.endDate);
  }

  const returns = await prisma.returnLine.findMany({
    where,
    orderBy: { returnDate: 'desc' },
    include: {
      party: { select: { id: true, code: true, name: true, type: true } },
      sourceSaleLine: {
        include: {
          invoice: { select: { invoiceDate: true } },
          item: { select: { id: true, code: true, name: true, unit: { select: { name: true } } } },
        },
      },
      sourcePurchaseLine: {
        include: {
          item: { select: { id: true, code: true, name: true, unit: { select: { name: true } } } },
        },
      },
    },
  });

  const costing = await loadCostingEngine();

  return returns.map((ret) => {
    const qty = toDecimal(ret.qty);
    let originalNetUnitPrice = zero();
    let salesCredit = zero();
    let purchaseCredit = zero();
    let returnCost = zero();
    let damagedExpense = zero();
    let itemName = '';
    let unitName = '';

    if (ret.type === 'SALE_RETURN' && ret.sourceSaleLine) {
      const origQty = toDecimal(ret.sourceSaleLine.qty);
      originalNetUnitPrice = origQty.gt(0)
        ? toDecimal(ret.sourceSaleLine.netSaleAmount).div(origQty)
        : zero();
      salesCredit = qty.times(originalNetUnitPrice);
      itemName = ret.sourceSaleLine.item.name;
      unitName = ret.sourceSaleLine.item.unit.name;

      // SourceMonth avg cost
      const sourceMonth = getMonthIndex(formatDate(ret.sourceSaleLine.invoice.invoiceDate), costing.startYear);
      const unitAvgCost = costing.getItemMonthlyAvgCost(ret.sourceSaleLine.itemId, sourceMonth);
      returnCost = qty.times(unitAvgCost);
      if (ret.saleReturnCondition === 'DAMAGED') {
        damagedExpense = returnCost;
      }
    } else if (ret.type === 'PURCHASE_RETURN' && ret.sourcePurchaseLine) {
      const origQty = toDecimal(ret.sourcePurchaseLine.qty);
      originalNetUnitPrice = origQty.gt(0)
        ? toDecimal(ret.sourcePurchaseLine.lineTotalCost).div(origQty)
        : zero();
      purchaseCredit = ret.supplierCreditNote !== null
        ? toDecimal(ret.supplierCreditNote)
        : qty.times(originalNetUnitPrice);
      itemName = ret.sourcePurchaseLine.item.name;
      unitName = ret.sourcePurchaseLine.item.unit.name;
    }

    return {
      ...ret,
      itemName,
      unitName,
      originalNetUnitPrice: originalNetUnitPrice.toNumber(),
      creditAmount: ret.type === 'SALE_RETURN' ? salesCredit.toNumber() : purchaseCredit.toNumber(),
      returnCost: returnCost.toNumber(),
      damagedExpense: damagedExpense.toNumber(),
    };
  });
}

export async function voidReturnLine(id: string, reason: string, userId?: string) {
  return withLedgerTransaction(async () => {

  if (!reason || reason.trim().length < 3) {
    throw new Error('سبب الإلغاء إلزامي ويجب ألا يقل عن 3 أحرف');
  }

  const ret = await prisma.returnLine.findUnique({ where: { id } });
  if (!ret) throw new Error('سطر المرتجع غير موجود');
  if (ret.status === RecordStatus.VOID) throw new Error('المرتجع ملغى مسبقاً');
  const legacyRefund = await prisma.cashTransaction.findFirst({ where: {
    sourceReturnId: null, type: 'CUSTOMER_REFUND', status: 'POSTED',
    partyId: ret.partyId, invoiceKey: ret.invoiceKey, description: { contains: ret.code },
  } });
  if (legacyRefund) throw new Error('يوجد سند رد قديم غير مربوط؛ راجع السند واعكسه قبل إلغاء المرتجع');

  const setting = await prisma.systemSetting.findFirst();
  if (setting?.lockedThroughDate) {
    const lockStr = formatDate(setting.lockedThroughDate);
    const retDateStr = formatDate(ret.returnDate);
    if (retDateStr <= lockStr) {
      throw new Error(`الفترة حتى ${lockStr} مقفلة محاسبياً؛ لا يمكن إلغاء حركات فيها`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.returnLine.update({
      where: { id },
      data: {
        status: RecordStatus.VOID,
        voidReason: reason.trim(),
        voidedAt: new Date(),
      },
    });

    await tx.cashTransaction.updateMany({ where: { sourceReturnId: id, status: 'POSTED' }, data: { status: 'VOID', voidReason: reason.trim(), voidedAt: new Date() } });

    await logAudit({
      userId,
      action: 'VOID',
      entityType: 'ReturnLine',
      entityCode: ret.code,
      reason: reason.trim(),
      beforeState: { status: ret.status },
      afterState: { status: RecordStatus.VOID, voidReason: reason.trim() },
    });

    return updated;
  });

  });
}
