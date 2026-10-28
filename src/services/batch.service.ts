import { withLedgerTransaction } from '@/lib/db';
import { prisma } from '@/lib/db';
import { Decimal, toDecimal, zero, toStorageDecimal } from '@/domain/decimal';
import { formatDate, getMonthIndex } from '@/domain/period';
import { nextBatchCode } from './code-generator';
import { logAudit } from './audit.service';
import { loadCostingEngine } from './ledger-loader';
import { getAvailableStockAtDate } from './sale.service';
import { RecordStatus, Prisma } from '@prisma/client';

export interface BatchMaterialInput {
  rawItemId: string;
  consumedQty: number | string | Decimal;
}

export interface CreateProductionBatchInput {
  completionDate: string; // YYYY-MM-DD
  finishedItemId: string;
  producedQty: number | string | Decimal;
  notes?: string | null;
  materials: BatchMaterialInput[];
}

export async function createProductionBatch(
  input: CreateProductionBatchInput,
  userId?: string
) {
  return withLedgerTransaction(async () => {

  const { completionDate, finishedItemId, producedQty, notes, materials } = input;

  if (!materials || materials.length === 0) {
    throw new Error('يجب إضافة مادة خام واحدة على الأقل في دفعة التصنيع');
  }

  const decProducedQty = toStorageDecimal(producedQty);
  if (decProducedQty.lte(0)) {
    throw new Error('الكمية الناتجة من المنتج التام يجب أن تكون أكبر من الصفر');
  }

  // 1. Setting and lock date check
  const setting = await prisma.systemSetting.findFirst();
  const allowNegative = setting?.allowNegativeStock ?? false;
  if (setting) {
    const minDate = `${setting.startYear}-01-01`;
    if (completionDate < minDate) {
      throw new Error(`تاريخ الدفعة (${completionDate}) يسبق سنة بداية النظام (${setting.startYear})`);
    }
    if (setting.lockedThroughDate) {
      const lockStr = formatDate(setting.lockedThroughDate);
      if (completionDate <= lockStr) {
        throw new Error(`الفترة المحاسبية مغلقة حتى تاريخ ${lockStr}. لا يمكن تسجيل دفعة في فترة مغلقة.`);
      }
    }
  }

  // 2. Finished item role check (must be FINISHED)
  const finishedItem = await prisma.item.findUnique({
    where: { id: finishedItemId },
    include: { unit: true },
  });
  if (!finishedItem?.isActive) throw new Error('المنتج التام المحدد غير موجود أو غير نشط');
  if (finishedItem.role !== 'FINISHED') {
    throw new Error('المنتج الناتج في دفعة التصنيع يجب أن يكون بدَور منتج تام (FINISHED) فقط');
  }

  // 3. Materials role check (all must be RAW) & stock availability
  const processedMaterials: Array<{ rawItemId: string; consumedQty: Decimal }> = [];

  const demands = new Map<string, Decimal>();
  for (const mat of materials) demands.set(mat.rawItemId, (demands.get(mat.rawItemId) ?? zero()).plus(toStorageDecimal(mat.consumedQty)));
  for (const [rawId, demand] of demands) {
    if (!allowNegative && demand.gt(await getAvailableStockAtDate(rawId, completionDate))) throw new Error('إجمالي استهلاك المادة الخام يتجاوز المخزون المتاح');
  }

  for (const mat of materials) {
    const raw = await prisma.item.findUnique({
      where: { id: mat.rawItemId },
      include: { unit: true },
    });
    if (!raw?.isActive) throw new Error('إحدى المواد الخام المحددة غير موجودة أو غير نشطة');
    if (raw.role !== 'RAW') {
      throw new Error(`الصنف (${raw.name}) ليس مادة خام؛ دفعات التصنيع تستهلك أصنافاً بدور خام (RAW) فقط`);
    }

    const decConsumed = toStorageDecimal(mat.consumedQty);
    if (decConsumed.lte(0)) {
      throw new Error(`كمية المادة الخام (${raw.name}) يجب أن تكون أكبر من الصفر`);
    }

    // Check available stock
    const available = await getAvailableStockAtDate(mat.rawItemId, completionDate);
    if (decConsumed.gt(available) && !allowNegative) {
      throw new Error(
        `الكمية المستهلكة من المادة الخام (${raw.name}) تتجاوز المخزون المتاح حتى تاريخ ${completionDate} (المتاح: ${available.toString()} ${raw.unit.name})`
      );
    }

    processedMaterials.push({
      rawItemId: mat.rawItemId,
      consumedQty: decConsumed,
    });
  }

  const batchCode = await nextBatchCode();

  return prisma.$transaction(async (tx) => {
    const batch = await tx.productionBatch.create({
      data: {
        code: batchCode,
        completionDate: new Date(completionDate),
        finishedItemId,
        producedQty: decProducedQty.toString(),
        notes: notes ? notes.trim() : null,
        status: RecordStatus.POSTED,
      },
    });

    for (const mat of processedMaterials) {
      await tx.batchMaterial.create({
        data: {
          batchId: batch.id,
          rawItemId: mat.rawItemId,
          consumedQty: mat.consumedQty.toString(),
        },
      });
    }

    await logAudit({
      userId,
      action: 'CREATE',
      entityType: 'ProductionBatch',
      entityCode: batchCode,
      reason: `إنشاء دفعة تصنيع (${finishedItem.name} × ${decProducedQty.toString()})`,
      afterJson: {
        id: batch.id,
        code: batchCode,
        finishedItemId,
        producedQty: decProducedQty.toString(),
        materialsCount: processedMaterials.length,
      },
    });

    return batch;
  });

  });
}

export async function getProductionBatches(options?: {
  finishedItemId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.ProductionBatchWhereInput = {};
  if (options?.finishedItemId) where.finishedItemId = options.finishedItemId;
  if (options?.startDate || options?.endDate) {
    where.completionDate = {};
    if (options.startDate) where.completionDate.gte = new Date(options.startDate);
    if (options.endDate) where.completionDate.lte = new Date(options.endDate);
  }

  const batches = await prisma.productionBatch.findMany({
    where,
    orderBy: { completionDate: 'desc' },
    include: {
      finishedItem: {
        include: { unit: true, category: true },
      },
      materials: {
        include: {
          rawItem: { include: { unit: true } },
        },
      },
    },
  });

  const costing = await loadCostingEngine();

  return batches.map((b) => {
    const producedQty = toDecimal(b.producedQty);
    const dateStr = formatDate(b.completionDate);
    const month = getMonthIndex(dateStr, costing.startYear);

    let totalMaterialsCost = zero();
    const enrichedMaterials = b.materials.map((m) => {
      const consumedQty = toDecimal(m.consumedQty);
      // Raw unit cost is RAVG for this month
      const rawUnitCost = costing.getItemMonthlyAvgCost(m.rawItemId, month);
      const consumedCost = consumedQty.times(rawUnitCost);
      totalMaterialsCost = totalMaterialsCost.plus(consumedCost);

      return {
        ...m,
        rawUnitCost: rawUnitCost.toNumber(),
        consumedCost: consumedCost.toNumber(),
      };
    });

    const finishedUnitCost = producedQty.gt(0)
      ? totalMaterialsCost.div(producedQty)
      : zero();

    return {
      ...b,
      materials: enrichedMaterials,
      totalMaterialsCost: totalMaterialsCost.toNumber(),
      finishedUnitCost: finishedUnitCost.toNumber(),
    };
  });
}

export async function voidProductionBatch(id: string, reason: string, userId?: string) {
  return withLedgerTransaction(async () => {

  if (!reason || reason.trim().length < 3) {
    throw new Error('سبب الإلغاء إلزامي ويجب ألا يقل عن 3 أحرف');
  }

  const batch = await prisma.productionBatch.findUnique({ where: { id } });
  if (!batch) throw new Error('دفعة التصنيع غير موجودة');
  if (batch.status === RecordStatus.VOID) throw new Error('الدفعة ملغاة مسبقاً');

  const setting = await prisma.systemSetting.findFirst();
  if (setting?.lockedThroughDate) {
    const lockStr = formatDate(setting.lockedThroughDate);
    const batchDateStr = formatDate(batch.completionDate);
    if (batchDateStr <= lockStr) {
      throw new Error(`الفترة حتى ${lockStr} مقفلة محاسبياً؛ لا يمكن إلغاء حركات فيها`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.productionBatch.update({
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
      entityType: 'ProductionBatch',
      entityCode: batch.code,
      reason: reason.trim(),
      beforeState: { status: batch.status },
      afterState: { status: RecordStatus.VOID, voidReason: reason.trim() },
    });

    return updated;
  });

  });
}
