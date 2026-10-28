import { todayInStore } from '@/domain/period';
import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createFixedAsset, getFixedAssetsWithAdditions } from '@/services/master.service';
import { getSession } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const asOfDate = searchParams.get('asOfDate') || todayInStore();
    const data = await getFixedAssetsWithAdditions(asOfDate);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'فشل جلب الأصول الثابتة' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { ok: false, error: 'اسم الأصل الثابت إلزامي' },
        { status: 400 }
      );
    }

    const created = await createFixedAsset(
      {
        name: body.name,
        nameEn: body.nameEn?.trim() || null,
        acquiredDate: body.acquiredDate || null,
        submittedValue: body.submittedValue || 0,
        notes: body.notes || null,
      },
      session.id
    );

    return NextResponse.json({ ok: true, data: created });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'فشل إنشاء الأصل الثابت' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/fixed-assets', handleGET);
export const POST = withApiGuard('POST', '/api/fixed-assets', handlePOST);
