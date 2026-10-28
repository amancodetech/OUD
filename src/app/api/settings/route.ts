import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getSystemSetting, updateSystemSetting, getSetupStatus } from '@/services/settings.service';
import { getSession } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('status') === 'true') {
      const status = await getSetupStatus();
      return NextResponse.json({ ok: true, data: status });
    }

    const setting = await getSystemSetting();
    return NextResponse.json({ ok: true, data: setting });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'خطأ في جلب الإعدادات' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session?.role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'تعديل الإعدادات متاح للمدير فقط' },
        { status: 403 }
      );
    }
    const body = await req.json();
    const updated = await updateSystemSetting(body, session?.id);
    return NextResponse.json({ ok: true, data: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل في حفظ الإعدادات' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/settings', handleGET);
export const POST = withApiGuard('POST', '/api/settings', handlePOST);
