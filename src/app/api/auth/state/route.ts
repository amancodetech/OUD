import { withApiGuard } from '@/lib/api-guard';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
export const GET = withApiGuard('GET', '/api/auth/state', async () => {
  const [session, state] = await Promise.all([getSession(), prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } })]);
  if (!session) return Response.json({ error: 'غير مصرح' }, { status: 401 });
  return Response.json({ scope: session.cacheScope, expiresAt: session.cacheExpiresAt, generation: state.generation, revision: state.revision.toString() });
});
