import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { updateFixedAsset, deleteFixedAsset } from '@/services/master.service';
import { getSession } from '@/lib/auth';

async function handlePUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    const updated = await updateFixedAsset(
      id,
      {
        name: body.name,
        nameEn: body.nameEn !== undefined ? (body.nameEn ? body.nameEn.trim() : null) : undefined,
        acquiredDate: body.acquiredDate !== undefined ? body.acquiredDate : undefined,
        submittedValue: body.submittedValue !== undefined ? body.submittedValue : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      },
      session.id
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'فشل تعديل الأصل الثابت' },
      { status: 400 }
    );
  }
}

async function handleDELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });
    }

    const { id } = params;
    const deleted = await deleteFixedAsset(id, session.id);
    return NextResponse.json({ ok: true, message: 'تم حذف الأصل الثابت بنجاح', data: deleted });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'فشل حذف الأصل الثابت' },
      { status: 400 }
    );
  }
}

export const PUT = withApiGuard('PUT', '/api/fixed-assets/[id]', handlePUT);
export const DELETE = withApiGuard('DELETE', '/api/fixed-assets/[id]', handleDELETE);
