import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getItemsWithStock, createItem } from '@/services/master.service';
import { getSession } from '@/lib/auth';
import { itemLookup } from '@/services/lookup.service';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get('asOfDate') || undefined;
    const session = await getSession();
    if (searchParams.get('lookup') === 'true' || (session?.role !== 'ADMIN' && !session?.permissions?.some(key => ['items_manage', 'inventory_view', 'purchases_manage', 'cash_full', 'dashboard_view'].includes(key)))) {
      return NextResponse.json({ ok: true, data: await itemLookup(asOfDate) });
    }

    const items = await getItemsWithStock(asOfDate);
    return NextResponse.json({ ok: true, data: items });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'خطأ في جلب الأصناف' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const item = await createItem(body, session?.id);
    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل في حفظ الصنف' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/items', handleGET);
export const POST = withApiGuard('POST', '/api/items', handlePOST);
