import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/services/audit.service';
import { resolveUserPermissions } from '@/lib/permissions';
import { UserRole } from '@prisma/client';

async function handlePATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'تعديل المستخدمين متاح للمدير فقط' },
        { status: 403 }
      );
    }

    const userId = params.id;
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'المستخدم غير موجود' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const displayName =
      body.displayName !== undefined ? String(body.displayName).trim() : existing.displayName;
    const role: UserRole =
      body.role === 'ADMIN' || body.role === 'ACCOUNTANT' || body.role === 'CASHIER'
        ? body.role
        : existing.role;
    const isActive =
      typeof body.isActive === 'boolean' ? body.isActive : existing.isActive;
    const permissions =
      body.permissions !== undefined
        ? resolveUserPermissions(role, body.permissions)
        : resolveUserPermissions(role, existing.permissions);

    if (existing.role === 'ADMIN' && existing.isActive && (!isActive || role !== 'ADMIN') &&
        await prisma.user.count({ where: { role: 'ADMIN', isActive: true } }) <= 1) {
      return NextResponse.json({ ok: false, error: 'لا يمكن تعطيل أو خفض صلاحية آخر مدير نشط' }, { status: 400 });
    }

    // Prevent deactivating the main admin account
    if (existing.username === 'admin' && !isActive) {
      return NextResponse.json(
        { ok: false, error: 'لا يمكن تعطيل حساب المدير الرئيسي (admin)' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      sessionVersion: { increment: 1 },
      displayName,
      role,
      isActive,
      permissions,
    };

    if (body.password && String(body.password).trim().length > 0) {
      const pwd = String(body.password).trim();
      if (pwd.length < 12 || Buffer.byteLength(pwd, 'utf8') > 72) {
        return NextResponse.json(
          { ok: false, error: 'كلمة المرور الجديدة يجب أن تكون 12 حرفًا على الأقل' },
          { status: 400 }
        );
      }
      updateData.passwordHash = await bcrypt.hash(pwd, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
      action: 'UPDATE',
      entityType: 'User',
      entityCode: updated.username,
      afterJson: {
        displayName: updated.displayName,
        role: updated.role,
        isActive: updated.isActive,
        permissions,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...updated,
        permissions: resolveUserPermissions(updated.role, updated.permissions),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل تحديث بيانات المستخدم' },
      { status: 400 }
    );
  }
}

export const PATCH = withApiGuard('PATCH', '/api/users/[id]', handlePATCH);
