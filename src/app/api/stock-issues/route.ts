import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getStockIssues, createStockIssue } from '@/services/stock-issue.service';
import { getCurrentUser } from '@/lib/auth';
import { StockIssueType } from '@prisma/client';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') as StockIssueType) || undefined;
    const itemId = searchParams.get('itemId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const data = await getStockIssues({ type, itemId, startDate, endDate });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب أذون الصرف' }, { status: 400 });
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await req.json();
    const issue = await createStockIssue(body, user.id);
    return NextResponse.json(issue, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل حفظ إذن صرف المخزون' }, { status: 400 });
  }
}

export const GET = withApiGuard('GET', '/api/stock-issues', handleGET);
export const POST = withApiGuard('POST', '/api/stock-issues', handlePOST);
