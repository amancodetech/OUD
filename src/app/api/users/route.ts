import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/services/audit.service';
import { resolveUserPermissions } from '@/lib/permissions';
import { UserRole } from '@prisma/client';

async function handleGET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'إدارة المستخدمين متاحة للمدير فقط' },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    const formatted = users.map((u) => ({
      ...u,
      permissions: resolveUserPermissions(u.role, u.permissions),
    }));

    return NextResponse.json({ ok: true, data: formatted });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'خطأ في جلب المستخدمين' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'إضافة المستخدمين متاحة للمدير فقط' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');
    const role: UserRole =
      body.role === 'ADMIN' || body.role === 'ACCOUNTANT' || body.role === 'CASHIER'
        ? body.role
        : 'CASHIER';
    const permissions = resolveUserPermissions(role, body.permissions);

    if (!username || username.length < 3) {
      return NextResponse.json(
        { ok: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' },
        { status: 400 }
      );
    }
    if (!displayName) {
      return NextResponse.json(
        { ok: false, error: 'الاسم الظاهر للموظف مطلوب' },
        { status: 400 }
      );
    }
    if (typeof body.password !== 'string' || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      return NextResponse.json(
        { ok: false, error: 'كلمة المرور يجب أن تكون 12 حرفًا أو أرقام على الأقل' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'اسم المستخدم مسجل مسبقاً، اختر اسم دخول آخر' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        username,
        displayName,
        passwordHash,
        role,
        permissions,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAudit({
      userId: session.id,
      action: 'CREATE',
      entityType: 'User',
      entityCode: created.username,
      afterJson: {
        username: created.username,
        displayName: created.displayName,
        role: created.role,
        permissions,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...created,
        permissions: resolveUserPermissions(created.role, created.permissions),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل في إنشاء الحساب' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/users', handleGET);
export const POST = withApiGuard('POST', '/api/users', handlePOST);
