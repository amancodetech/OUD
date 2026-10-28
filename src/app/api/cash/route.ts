import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getCashTransactions, createCashTransaction, getCashSummary } from '@/services/cash.service';
import { getCurrentUser } from '@/lib/auth';
import { CashAccountType, CashTransactionType } from '@prisma/client';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const summaryOnly = searchParams.get('summary');
    const asOfDate = searchParams.get('asOfDate') || undefined;

    if (summaryOnly === 'true') {
      const summary = await getCashSummary(asOfDate);
      return NextResponse.json(summary);
    }

    const account = (searchParams.get('account') as CashAccountType) || undefined;
    const type = (searchParams.get('type') as CashTransactionType) || undefined;
    const partyId = searchParams.get('partyId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const data = await getCashTransactions({ account, type, partyId, startDate, endDate, customerOnly: searchParams.get('customerOnly') === 'true' });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب الحركات النقدية' }, { status: 400 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await req.json();

    // Cashier role restriction


    const tx = await createCashTransaction(body, user.id);
    return NextResponse.json(tx, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل حفظ الحركة النقدية' }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/cash', handleGET);
export const POST = withApiGuard('POST', '/api/cash', handlePOST);
