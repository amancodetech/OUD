import { withApiGuard } from '@/lib/api-guard';
import { NextResponse } from 'next/server';
import { destroySession, getSession } from '@/lib/auth';

async function handlePOST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

async function handleGET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'غير مصرح' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, data: session });
}

export const POST = withApiGuard('POST', '/api/auth/logout', handlePOST);
export const GET = withApiGuard('GET', '/api/auth/logout', handleGET);
