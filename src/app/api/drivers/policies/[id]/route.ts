import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { updateGiftPolicy, deleteGiftPolicy } from '@/services/master.service';
import { getSession } from '@/lib/auth';

async function handlePUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const body = await req.json();
    const updated = await updateGiftPolicy(params.id, body, session?.id);
    return NextResponse.json({ ok: true, data: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل تعديل سياسة الهدايا' },
      { status: 400 }
    );
  }
}

async function handleDELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    const result = await deleteGiftPolicy(params.id, session?.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل حذف سياسة الهدايا' },
      { status: 400 }
    );
  }
}

export const PUT = withApiGuard('PUT', '/api/drivers/policies/[id]', handlePUT);
export const DELETE = withApiGuard('DELETE', '/api/drivers/policies/[id]', handleDELETE);
