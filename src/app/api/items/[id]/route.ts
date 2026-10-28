import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { updateItem, deleteItem } from '@/services/master.service';
import { getSession } from '@/lib/auth';

async function handlePUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const updated = await updateItem(id, body, session.id);
    return NextResponse.json({ ok: true, data: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'فشل تعديل بيانات الصنف' },
      { status: 400 }
    );
  }
}

async function handleDELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { id } = params;
    const deleted = await deleteItem(id, session.id);
    return NextResponse.json({ ok: true, message: 'تم حذف الصنف بنجاح', data: deleted });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'فشل حذف الصنف' },
      { status: 400 }
    );
  }
}

export const PUT = withApiGuard('PUT', '/api/items/[id]', handlePUT);
export const DELETE = withApiGuard('DELETE', '/api/items/[id]', handleDELETE);
