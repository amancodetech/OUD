import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getSourceLineOptions } from '@/services/return.service';
import { ReturnType } from '@prisma/client';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceKey = searchParams.get('invoiceKey');
    const type = (searchParams.get('type') as ReturnType) || 'SALE_RETURN';

    if (!invoiceKey) {
      return NextResponse.json({ error: 'invoiceKey مطلوب' }, { status: 400 });
    }

    const lines = await getSourceLineOptions(invoiceKey, type, searchParams.get('partyId') || undefined);
    return NextResponse.json(lines);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/returns/source-lines', handleGET);
