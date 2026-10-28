import { withApiGuard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/services/audit.service';

async function handleGET() {
  const [categories, units] = await Promise.all([
    prisma.itemCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.unitOption.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  return NextResponse.json({ ok: true, categories, units });
}

async function handlePOST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const type = body.type; // 'CATEGORY' | 'UNIT'

    if (type === 'CATEGORY') {
      const name = String(body.name || '').trim();
      const rawPrefix = String(body.prefix || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

      if (!name) {
        return NextResponse.json(
          { ok: false, error: 'اسم التصنيف مطلوب' },
          { status: 400 }
        );
      }

      const prefix = rawPrefix || 'CT';

      const existing = await prisma.itemCategory.findUnique({
        where: { name },
      });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: `التصنيف «${name}» موجود مسبقاً` },
          { status: 400 }
        );
      }

      const count = await prisma.itemCategory.count();
      const created = await prisma.itemCategory.create({
        data: {
          name,
          prefix,
          sortOrder: count + 1,
          isActive: true,
        },
        include: {
          _count: { select: { items: true } },
        },
      });

      await logAudit({
        userId: session?.id,
        action: 'CREATE',
        entityType: 'ItemCategory',
        entityCode: prefix,
        afterJson: created,
      });

      return NextResponse.json({ ok: true, data: created }, { status: 201 });
    }

    if (type === 'UNIT') {
      const name = String(body.name || '').trim();
      if (!name) {
        return NextResponse.json(
          { ok: false, error: 'اسم وحدة القياس مطلوب' },
          { status: 400 }
        );
      }

      const existing = await prisma.unitOption.findUnique({
        where: { name },
      });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: `وحدة القياس «${name}» موجودة مسبقاً` },
          { status: 400 }
        );
      }

      const count = await prisma.unitOption.count();
      const created = await prisma.unitOption.create({
        data: {
          name,
          sortOrder: count + 1,
          isActive: true,
        },
        include: {
          _count: { select: { items: true } },
        },
      });

      await logAudit({
        userId: session?.id,
        action: 'CREATE',
        entityType: 'UnitOption',
        entityCode: name,
        afterJson: created,
      });

      return NextResponse.json({ ok: true, data: created }, { status: 201 });
    }

    return NextResponse.json(
      { ok: false, error: 'نوع الإضافة غير صالح (CATEGORY أو UNIT)' },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل في الحفظ' },
      { status: 400 }
    );
  }
}

async function handlePUT(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { type, id } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'معرّف السجل مطلوب للتعديل' },
        { status: 400 }
      );
    }

    if (type === 'CATEGORY') {
      const name = String(body.name || '').trim();
      const rawPrefix = String(body.prefix || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

      if (!name) {
        return NextResponse.json(
          { ok: false, error: 'اسم التصنيف مطلوب' },
          { status: 400 }
        );
      }

      const prefix = rawPrefix || 'CT';

      const existingCat = await prisma.itemCategory.findUnique({
        where: { id },
      });
      if (!existingCat) {
        return NextResponse.json(
          { ok: false, error: 'التصنيف غير موجود' },
          { status: 404 }
        );
      }

      // Check if duplicate name in other category
      const duplicate = await prisma.itemCategory.findFirst({
        where: {
          name,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { ok: false, error: `يوجد تصنيف آخر بنفس الاسم «${name}»` },
          { status: 400 }
        );
      }

      const updated = await prisma.itemCategory.update({
        where: { id },
        data: {
          name,
          prefix,
        },
        include: {
          _count: { select: { items: true } },
        },
      });

      await logAudit({
        userId: session?.id,
        action: 'UPDATE',
        entityType: 'ItemCategory',
        entityCode: prefix,
        beforeJson: existingCat,
        afterJson: updated,
      });

      return NextResponse.json({ ok: true, data: updated });
    }

    if (type === 'UNIT') {
      const name = String(body.name || '').trim();
      if (!name) {
        return NextResponse.json(
          { ok: false, error: 'اسم وحدة القياس مطلوب' },
          { status: 400 }
        );
      }

      const existingUnit = await prisma.unitOption.findUnique({
        where: { id },
      });
      if (!existingUnit) {
        return NextResponse.json(
          { ok: false, error: 'وحدة القياس غير موجودة' },
          { status: 404 }
        );
      }

      // Check if duplicate name in other unit
      const duplicate = await prisma.unitOption.findFirst({
        where: {
          name,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { ok: false, error: `توجد وحدة قياس أخرى بنفس الاسم «${name}»` },
          { status: 400 }
        );
      }

      const updated = await prisma.unitOption.update({
        where: { id },
        data: {
          name,
        },
        include: {
          _count: { select: { items: true } },
        },
      });

      await logAudit({
        userId: session?.id,
        action: 'UPDATE',
        entityType: 'UnitOption',
        entityCode: name,
        beforeJson: existingUnit,
        afterJson: updated,
      });

      return NextResponse.json({ ok: true, data: updated });
    }

    return NextResponse.json(
      { ok: false, error: 'نوع التعديل غير صالح (CATEGORY أو UNIT)' },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل في تعديل البيانات' },
      { status: 400 }
    );
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const { type, id } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'معرّف السجل مطلوب للحذف' },
        { status: 400 }
      );
    }

    if (type === 'CATEGORY') {
      const existing = await prisma.itemCategory.findUnique({
        where: { id },
        include: { _count: { select: { items: true } } },
      });

      if (!existing) {
        return NextResponse.json(
          { ok: false, error: 'التصنيف غير موجود' },
          { status: 404 }
        );
      }

      if (existing._count.items > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `لا يمكن حذف هذا التصنيف لأنه مرتبط بـ (${existing._count.items}) أصناف حالياً. يمكنك تعديله بدلاً من حذفه.`,
          },
          { status: 400 }
        );
      }

      await prisma.itemCategory.delete({
        where: { id },
      });

      await logAudit({
        userId: session?.id,
        action: 'DELETE',
        entityType: 'ItemCategory',
        entityCode: existing.prefix,
        beforeJson: existing,
      });

      return NextResponse.json({ ok: true, message: 'تم حذف التصنيف بنجاح' });
    }

    if (type === 'UNIT') {
      const existing = await prisma.unitOption.findUnique({
        where: { id },
        include: { _count: { select: { items: true } } },
      });

      if (!existing) {
        return NextResponse.json(
          { ok: false, error: 'وحدة القياس غير موجودة' },
          { status: 404 }
        );
      }

      if (existing._count.items > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `لا يمكن حذف وحدة القياس هذه لأنها مرتبطة بـ (${existing._count.items}) أصناف حالياً. يمكنك تعديلها بدلاً من حذفها.`,
          },
          { status: 400 }
        );
      }

      await prisma.unitOption.delete({
        where: { id },
      });

      await logAudit({
        userId: session?.id,
        action: 'DELETE',
        entityType: 'UnitOption',
        entityCode: existing.name,
        beforeJson: existing,
      });

      return NextResponse.json({ ok: true, message: 'تم حذف وحدة القياس بنجاح' });
    }

    return NextResponse.json(
      { ok: false, error: 'نوع العملية غير صالح' },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'فشل في حذف السجل' },
      { status: 400 }
    );
  }
}

export const GET = withApiGuard('GET', '/api/categories-units', handleGET);
export const POST = withApiGuard('POST', '/api/categories-units', handlePOST);
export const PUT = withApiGuard('PUT', '/api/categories-units', handlePUT);
export const DELETE = withApiGuard('DELETE', '/api/categories-units', handleDELETE);
