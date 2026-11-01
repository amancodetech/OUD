import application from '../.open-next/worker.js';
export { DOQueueHandler, DOShardedTagCache } from '../.open-next/worker.js';
import { executeJob, failJob, cleanupJobs } from '../src/services/background-jobs.service.ts';
import { requestRuntime } from '../src/lib/request-runtime.mjs';

async function jobScope(env, work) {
  const scope = { connectionString: env.HYPERDRIVE.connectionString, bindings: env, memo: new Map() };
  return requestRuntime.run(scope, async () => {
    try { return await work(); }
    finally { scope.memo.clear(); await scope.client?.$disconnect(); }
  });
}

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try { await jobScope(env, () => executeJob(message.body.id)); message.ack(); }
      catch {
        if (message.attempts >= 3) { await jobScope(env, () => failJob(message.body.id)); message.ack(); }
        else message.retry({ delaySeconds: 10 });
      }
    }
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(jobScope(env, cleanupJobs)); },
  async fetch(request, env, ctx) {
    if (!env.HYPERDRIVE?.connectionString || !env.SESSION_SECRET || !env.APP_URL) {
      return new Response('Service configuration unavailable', { status: 503 });
    }
    const scope = { connectionString: env.HYPERDRIVE.connectionString, bindings: env, memo: new Map() };
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      scope.memo.clear();
      if (scope.client) ctx.waitUntil(scope.client.$disconnect());
    };
    return requestRuntime.run(scope, async () => {
      try {
        const response = await application.fetch(request, env, ctx);
        if (!response.body) { close(); return response; }
        const reader = response.body.getReader();
        const body = new ReadableStream({
          pull(controller) {
            return requestRuntime.run(scope, async () => {
              try {
                const part = await reader.read();
                if (part.done) { controller.close(); close(); }
                else controller.enqueue(part.value);
              } catch (error) { controller.error(error); close(); }
            });
          },
          async cancel(reason) { try { await reader.cancel(reason); } finally { close(); } },
        });
        const result = new Response(body, response);
        if (!new URL(request.url).pathname.startsWith('/_next/static/')) {
          result.headers.set('Cache-Control', 'private, no-store');
          result.headers.set('CDN-Cache-Control', 'no-store');
        }
        return result;
      } catch (error) { close(); throw error; }
    });
  },
};
