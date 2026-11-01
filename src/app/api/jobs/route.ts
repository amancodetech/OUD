import { withApiGuard } from '@/lib/api-guard';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
export const GET = withApiGuard('GET', '/api/jobs', async () => {
  const user = await getSession();
  const jobs = await prisma.backgroundJob.findMany({ where: { userId: user!.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, select: { id: true, kind: true, status: true, createdAt: true } });
  return Response.json({ jobs });
});
