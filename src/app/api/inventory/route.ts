import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma, withReadSnapshot } from '@/lib/db';
import { stockQuantitiesAt } from '@/services/stock-integrity';
import { loadCostingEngine } from '@/services/ledger-loader';
import { getMonthIndex } from '@/domain/period';
import { toDecimal, zero } from '@/domain/decimal';

async function handleGET(req: NextRequest) {
  return withReadSnapshot(async () => {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId') || undefined;
    const statusFilter = searchParams.get('status') || 'ALL'; // ALL | AVAILABLE | REORDER | NEGATIVE
    const asOfDate = searchParams.get('asOfDate') || todayInStore();

    const setting = await prisma.systemSetting.findFirst();
    const startYear = setting?.startYear ?? 2026;
    const monthIdx = getMonthIndex(asOfDate, startYear);

    const [items, categories, costing, quantities] = await Promise.all([
      prisma.item.findMany({
        where: categoryId ? { categoryId } : undefined,
        include: { category: true, unit: true },
        orderBy: { code: 'asc' },
      }),
      prisma.itemCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
      loadCostingEngine(monthIdx),
      stockQuantitiesAt(asOfDate),
    ]);

    const enrichedItems = items.map((item) => {
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
        id: item.id,
        code: item.code,
        displayCode,
        name: item.name,
        nameId: item.nameId,
        nameEn: item.nameEn,
        role: item.role,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        categoryPrefix: item.category.prefix,
        unitName: item.unit.name,
        availableQty: availableQty.toNumber(),
        reorderLevel: reorderLevel.toNumber(),
        monthlyAvgCost: monthlyAvgCost.toNumber(),
        availableValue: availableValue.toNumber(),
        stockStatus,
        costCheck: state.COST_CHECK,
      };
    });

    // Filter by status if requested
    const filtered = enrichedItems.filter((i) => {
      if (statusFilter === 'AVAILABLE') return i.stockStatus === 'متاح';
      if (statusFilter === 'REORDER') return i.stockStatus === 'أعد الطلب';
      if (statusFilter === 'NEGATIVE') return i.stockStatus === 'مخزون سالب';
      return true;
    });

    const totalInventoryValue = filtered.reduce((sum, i) => sum + i.availableValue, 0);

    return NextResponse.json({
      asOfDate,
      categories: categories.map((c) => ({ id: c.id, name: c.name, prefix: c.prefix })),
      items: filtered,
      totalInventoryValue,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'حدث خطأ أثناء تحميل بيانات تقرير المخزون' },
      { status: 400 }
    );
  }
  });
}

export const GET = withApiGuard('GET', '/api/inventory', handleGET);
