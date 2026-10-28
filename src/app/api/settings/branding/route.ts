import { NextResponse } from 'next/server';
import { withApiGuard } from '@/lib/api-guard';
import { prisma } from '@/lib/db';

// Explicit projection: authenticated invoice consumers never receive financial settings.
export const GET = withApiGuard('GET', '/api/settings/branding', async () => {
  const data = await prisma.systemSetting.findUnique({ where: { id: 1 }, select: { storeName: true } });
  return NextResponse.json({ ok: true, data });
});
