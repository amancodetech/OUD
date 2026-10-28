import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSaleInvoices, createSaleInvoice } from '@/services/sale.service';
import { getCurrentUser } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('countOnly') === 'true') {
      const count = await prisma.saleInvoice.count();
      return NextResponse.json({ count, nextNumber: 1001 + count });
    }

    const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const search = searchParams.get('search') || undefined;

    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 100);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }
    const data = await getSaleInvoices({ year, customerId, startDate, endDate, search, page, pageSize });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب المبيعات' }, { status: 400 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await req.json();
    const invoice = await createSaleInvoice(body, user.id);
    return NextResponse.json(invoice, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل حفظ فاتورة البيع' }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/sales', handleGET);
export const POST = withApiGuard('POST', '/api/sales', handlePOST);
