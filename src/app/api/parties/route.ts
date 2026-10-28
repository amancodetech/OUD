import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getPartiesWithBalances, createParty } from '@/services/master.service';
import { getSession } from '@/lib/auth';
import { PartyType } from '@prisma/client';
import { partyLookup } from '@/services/lookup.service';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') as PartyType) || undefined;
    const asOfDate = searchParams.get('asOfDate') || undefined;
    const session = await getSession();
    if (searchParams.get('lookup') === 'true' || (session?.role !== 'ADMIN' && !session?.permissions?.some(key => ['debts_view', 'cash_full', 'dashboard_view', 'partners_view'].includes(key)))) {
      return NextResponse.json({ ok: true, data: await partyLookup(type) });
    }

    const parties = await getPartiesWithBalances({ type, asOfDate });
    return NextResponse.json({ ok: true, data: parties });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'خطأ في جلب الأطراف' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const party = await createParty(body, session?.id);
    return NextResponse.json({ ok: true, data: party }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل في حفظ الطرف' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/parties', handleGET);
export const POST = withApiGuard('POST', '/api/parties', handlePOST);
