import { withLedgerTransaction } from '@/lib/db';
import { prisma } from '@/lib/db';
import { Decimal, toDecimal, toStorageDecimal } from '@/domain/decimal';
import { formatDate, getMonthIndex } from '@/domain/period';
import { nextStockIssueCode } from './code-generator';
import { logAudit } from './audit.service';
import { loadCostingEngine } from './ledger-loader';
import { getAvailableStockAtDate } from './sale.service';
import { StockIssueType, RecordStatus, Prisma } from '@prisma/client';

export interface CreateStockIssueInput {
  issueDate: string; // YYYY-MM-DD
  type: StockIssueType; // TESTER | SAMPLE | DAMAGED
  itemId: string;
  qty: number | string | Decimal;
  reason: string;
  testerRef?: string | null;
  notes?: string | null;
}

export async function createStockIssue(input: CreateStockIssueInput, userId?: string) {
  return withLedgerTransaction(async () => {

  const { issueDate, type, itemId, qty, reason, testerRef, notes } = input;

  if (!reason || reason.trim().length === 0) {
    throw new Error('أدخل السبب أو المناسبة لصرف المخزون');
  }

  const decQty = toStorageDecimal(qty);
  if (decQty.lte(0)) {
    throw new Error('كمية الصرف يجب أن تكون أكبر من الصفر');
  }

  // 1. Setting and lock date check
  const setting = await prisma.systemSetting.findFirst();
  const allowNegative = setting?.allowNegativeStock ?? false;
  if (setting) {
    const minDate = `${setting.startYear}-01-01`;
    if (issueDate < minDate) {
      throw new Error(`تاريخ الصرف (${issueDate}) يسبق سنة بداية النظام (${setting.startYear})`);
    }
    if (setting.lockedThroughDate) {
      const lockStr = formatDate(setting.lockedThroughDate);
      if (issueDate <= lockStr) {
        throw new Error(`الفترة المحاسبية مغلقة حتى تاريخ ${lockStr}. لا يمكن تسجيل صرف مخزون في فترة مغلقة.`);
      }
    }
  }

  // 2. Item & Stock availability check
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { unit: true },
  });
  if (!item?.isActive) throw new Error('الصنف المحدد غير موجود أو غير نشط');

  const available = await getAvailableStockAtDate(itemId, issueDate);
  if (decQty.gt(available) && !allowNegative) {
    throw new Error(
      `الكمية المصروفة للصنف (${item.name}) تتجاوز المخزون المتاح حتى تاريخ ${issueDate} (المتاح: ${available.toString()} ${item.unit.name})`
    );
  }

  const code = await nextStockIssueCode();

  return prisma.$transaction(async (tx) => {
    const stockIssue = await tx.stockIssue.create({
      data: {
        code,
        issueDate: new Date(issueDate),
        type,
        itemId,
        qty: decQty.toString(),
        testerRef: testerRef ? testerRef.trim() : null,
        reason: reason.trim(),
        notes: notes ? notes.trim() : null,
        status: RecordStatus.POSTED,
      },
    });

    await logAudit({
      userId,
      action: 'CREATE',
      entityType: 'StockIssue',
      entityCode: code,
      reason: `صرف مخزون (${type}): ${reason}`,
      afterJson: {
        id: stockIssue.id,
        code,
        type,
        itemId,
        qty: decQty.toString(),
      },
    });

    return stockIssue;
  });

  });
}

export async function getStockIssues(options?: {
  type?: StockIssueType;
  itemId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.StockIssueWhereInput = {};
  if (options?.type) where.type = options.type;
  if (options?.itemId) where.itemId = options.itemId;
  if (options?.startDate || options?.endDate) {
    where.issueDate = {};
    if (options.startDate) where.issueDate.gte = new Date(options.startDate);
    if (options.endDate) where.issueDate.lte = new Date(options.endDate);
  }

  const issues = await prisma.stockIssue.findMany({
    where,
    orderBy: { issueDate: 'desc' },
    include: {
      item: {
        include: { unit: true },
      },
    },
  });

  const costing = await loadCostingEngine();

  return issues.map((iss) => {
    const qty = toDecimal(iss.qty);
    const dateStr = formatDate(iss.issueDate);
    const month = getMonthIndex(dateStr, costing.startYear);
    const unitCost = costing.getItemMonthlyAvgCost(iss.itemId, month);
    const issueCost = qty.times(unitCost);

    return {
      ...iss,
      unitCost: unitCost.toNumber(),
      issueCost: issueCost.toNumber(),
    };
  });
}

export async function voidStockIssue(id: string, reason: string, userId?: string) {
  return withLedgerTransaction(async () => {

  if (!reason || reason.trim().length < 3) {
    throw new Error('سبب الإلغاء إلزامي ويجب ألا يقل عن 3 أحرف');
  }

  const iss = await prisma.stockIssue.findUnique({ where: { id } });
  if (!iss) throw new Error('إذن صرف المخزون غير موجود');
  if (iss.status === RecordStatus.VOID) throw new Error('الإذن ملغى مسبقاً');

  const setting = await prisma.systemSetting.findFirst();
  if (setting?.lockedThroughDate) {
    const lockStr = formatDate(setting.lockedThroughDate);
    const issDateStr = formatDate(iss.issueDate);
    if (issDateStr <= lockStr) {
      throw new Error(`الفترة حتى ${lockStr} مقفلة محاسبياً؛ لا يمكن إلغاء حركات فيها`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.stockIssue.update({
      where: { id },
      data: {
        status: RecordStatus.VOID,
        voidReason: reason.trim(),
        voidedAt: new Date(),
      },
    });

    await logAudit({
      userId,
      action: 'VOID',
      entityType: 'StockIssue',
      entityCode: iss.code,
      reason: reason.trim(),
      beforeState: { status: iss.status },
      afterState: { status: RecordStatus.VOID, voidReason: reason.trim() },
    });

    return updated;
  });

  });
}
