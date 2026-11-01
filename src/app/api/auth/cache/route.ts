import { withApiGuard } from '@/lib/api-guard';
import { browserCacheKey, getSession } from '@/lib/auth';

export const GET = withApiGuard('GET', '/api/auth/cache', async () => {
  const session = await getSession();
  if (!session) return Response.json({ error: 'غير مصرح' }, { status: 401 });
  return Response.json({ scope: session.cacheScope, key: browserCacheKey(session), expiresAt: session.cacheExpiresAt });
});
