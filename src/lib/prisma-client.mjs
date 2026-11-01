import { PrismaClient as BasePrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** PostgreSQL driver shared by Node tools and the Workers request adapter. */
export class PrismaClient extends BasePrismaClient {
  /** @param {import('@prisma/client').Prisma.PrismaClientOptions} [options] */
  constructor(options = {}) {
    const { datasources, datasourceUrl, ...rest } = options;
    const connectionString = datasources?.db?.url ?? datasourceUrl ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Explicit DATABASE_URL is required');
    const url = new URL(connectionString);
    const max = Number(url.searchParams.get('connection_limit') || 5);
    super({ ...rest, adapter: options.adapter ?? new PrismaPg({ connectionString,
      max: Number.isInteger(max) && max > 0 && max <= 20 ? max : 5,
      connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000,
    }) });
  }
}
