import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPurchaseInvoices, createPurchaseInvoice } from '@/services/purchase.service';
import { getCurrentUser } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('countOnly') === 'true') {
      const count = await prisma.purchaseInvoice.count();
      return NextResponse.json({ count, nextNumber: 1001 + count });
    }

    const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
    const supplierId = searchParams.get('supplierId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const search = searchParams.get('search') || undefined;

    const data = await getPurchaseInvoices({ year, supplierId, startDate, endDate, search });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب المشتريات' }, { status: 400 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }


    const body = await req.json();
    const invoice = await createPurchaseInvoice(body, user.id);
    return NextResponse.json(invoice, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل حفظ فاتورة الشراء' }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/purchases', handleGET);
export const POST = withApiGuard('POST', '/api/purchases', handlePOST);
