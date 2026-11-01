import { withApiGuard } from '@/lib/api-guard';
import { getSession } from '@/lib/auth';
import { readJob } from '@/services/background-jobs.service';
export const GET = withApiGuard('GET', '/api/jobs/[id]', async (req, { params }) => {
  const user = await getSession();
  return readJob(params.id, user!.id, new URL(req.url).searchParams.get('download') === 'true');
});
