import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getGiftPolicies, createGiftPolicy, canModifyGiftPolicy } from '@/services/master.service';
import { getSession } from '@/lib/auth';

async function handleGET() {
  try {
    const policies = await getGiftPolicies();
    const policiesWithStatus = await Promise.all(
      policies.map(async (p) => {
        const canModify = await canModifyGiftPolicy(p.id);
        return {
          ...p,
          effectiveDate: p.effectiveDate.toISOString().slice(0, 10),
          giftValue: p.giftValue.toString(),
          canModify,
        };
      })
    );
    return NextResponse.json({ ok: true, data: policiesWithStatus });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'خطأ في جلب سياسات الهدايا' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const created = await createGiftPolicy(body, session?.id);
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل إضافة سياسة الهدايا' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/drivers/policies', handleGET);
export const POST = withApiGuard('POST', '/api/drivers/policies', handlePOST);
