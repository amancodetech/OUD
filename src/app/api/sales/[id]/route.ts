import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getSaleInvoiceById } from '@/services/sale.service';

async function handleGET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get('asOfDate') || undefined;
    const invoice = await getSaleInvoiceById(params.id, asOfDate);
    if (!invoice) {
      return NextResponse.json({ error: 'فاتورة البيع غير موجودة' }, { status: 404 });
    }
    return NextResponse.json(invoice);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/sales/[id]', handleGET);
