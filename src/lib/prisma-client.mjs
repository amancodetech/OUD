import { PrismaClient as BasePrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { workerRuntime } from './request-runtime.mjs';

class RequestScopedPool extends pg.Pool {
  constructor() {
    super({ max: 1 });
  }
  #pool() {
    const runtime = workerRuntime();
    if (!runtime?.connectionString) throw new Error('Active Worker request runtime required');
    if (!runtime.pool) {
      runtime.pool = new pg.Pool({
        connectionString: runtime.connectionString,
        max: 2,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 10000,
      });
      runtime.pool.on('error', () => {});
    }
    return runtime.pool;
  }
  query(...args) {
    return this.#pool().query(...args);
  }
  connect(...args) {
    return this.#pool().connect(...args);
  }
  end() {
    return Promise.resolve();
  }
}

let sharedWorkerClient;
export function getWorkerPrismaClient() {
  return sharedWorkerClient ??= new BasePrismaClient({
    adapter: new PrismaPg(new RequestScopedPool()),
    log: ['error'],
  });
}

/** PostgreSQL driver shared by Node tools and the Workers request adapter. */
export class PrismaClient extends BasePrismaClient {
  /** @param {import('@prisma/client').Prisma.PrismaClientOptions} [options] */
  constructor(options = {}) {
    const { datasources, datasourceUrl, ...rest } = options;
    const connectionString = datasources?.db?.url ?? datasourceUrl ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Explicit DATABASE_URL is required');
    const url = new URL(connectionString);
    const max = Number(url.searchParams.get('connection_limit') || 3);
    super({ ...rest, adapter: options.adapter ?? new PrismaPg({ connectionString,
      max: Number.isInteger(max) && max > 0 && max <= 20 ? max : 3,
      connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000,
    }) });
  }
}
