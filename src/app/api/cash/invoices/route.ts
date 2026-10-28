import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getPartyPendingInvoices } from '@/services/cash.service';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const partyId = searchParams.get('partyId');
    const asOfDate = searchParams.get('asOfDate') || undefined;

    if (!partyId) {
      return NextResponse.json({ error: 'partyId مطلوب' }, { status: 400 });
    }

    const user = await getSession();
    if (user?.role !== 'ADMIN' && !user?.permissions?.includes('cash_full')) {
      const party = await prisma.party.findUnique({ where: { id: partyId } });
      if (party?.type !== 'CLIENT') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const invoices = await getPartyPendingInvoices(partyId, asOfDate);
    return NextResponse.json(invoices);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/cash/invoices', handleGET);
