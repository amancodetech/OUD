import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSession } from '@/lib/auth';
import { consumeLoginAttempt } from '@/lib/login-limit';

async function handlePOST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > 100 || password.length > 200) {
      return NextResponse.json(
        { ok: false, error: 'اسم المستخدم وكلمة المرور مطلوبان' },
        { status: 400 }
      );
    }

    if (!await consumeLoginAttempt(username)) return NextResponse.json({ ok: false, error: 'محاولات كثيرة؛ انتظر 15 دقيقة', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '900' } });
    const user = await authenticateUser(username.trim().toLowerCase(), password);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    await createSession(user);
    return NextResponse.json({ ok: true, data: user });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

export const POST = withApiGuard('POST', '/api/auth/login', handlePOST);
