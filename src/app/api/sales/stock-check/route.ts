import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getAvailableStockAtDate } from '@/services/sale.service';
import { prisma } from '@/lib/db';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    const date = searchParams.get('date') || todayInStore();

    if (!itemId) {
      return NextResponse.json({ error: 'itemId مطلوب' }, { status: 400 });
    }

    const available = await getAvailableStockAtDate(itemId, date);
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        code: true,
        name: true,
        defaultSalePrice: true,
        unit: { select: { name: true } },
      },
    });

    return NextResponse.json({
      itemId,
      date,
      availableQty: available.toNumber(),
      unitName: item?.unit?.name ?? '',
      defaultSalePrice: item?.defaultSalePrice ? Number(item.defaultSalePrice) : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/sales/stock-check', handleGET);
