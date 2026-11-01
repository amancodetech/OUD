import {Prisma} from '@prisma/client';
import { PrismaClient } from './prisma-client.mjs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { testDatabaseUrl } from './test-database';
import { workerRuntime } from './request-runtime.mjs';

if (process.env.NODE_ENV === 'test') process.env.DATABASE_URL = testDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  ledgerWriterPrisma: PrismaClient | undefined;
  ledgerWriterQueue: { tail: Promise<void> } | undefined;
};

const configuredDatabaseUrl = process.env.DATABASE_URL;
let ledgerWriter = globalForPrisma.ledgerWriterPrisma;
function writerClient() {
  if (workerRuntime()) return clientForRequest();
  if (!ledgerWriter) {
    const url = new URL(configuredDatabaseUrl ?? process.env.DATABASE_URL!);
    url.searchParams.set('connection_limit', '1');
    ledgerWriter = new PrismaClient({ datasources: { db: { url: url.href } }, log: ['error'] });
    if (process.env.NODE_ENV !== 'production') globalForPrisma.ledgerWriterPrisma = ledgerWriter;
  }
  return ledgerWriter;
}

let nodeClient = globalForPrisma.prisma;
function clientForRequest(): PrismaClient {
  const runtime = workerRuntime();
  if (runtime) {
    runtime.client ??= new PrismaClient({ datasources: { db: { url: runtime.connectionString } }, log: ['error'] });
    return runtime.client as PrismaClient;
  }
  nodeClient ??= new PrismaClient({ log: ['error'] });
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = nodeClient;
  return nodeClient;
}

const transactions = new AsyncLocalStorage<Prisma.TransactionClient>();
const readSnapshots = new AsyncLocalStorage<{ key?: Promise<string> }>();
export const isReadSnapshot = () => readSnapshots.getStore() !== undefined;
const writerQueue = globalForPrisma.ledgerWriterQueue ??= { tail: Promise.resolve() };

// Existing service helpers, including audit/code generation/ledger readers, share
// the transaction of the operation that called them. No second connection commits
// audit entries while their document is still uncommitted.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const target = clientForRequest();
    if (key === '$disconnect') return async () => { await Promise.all([target.$disconnect(), ledgerWriter?.$disconnect()]); };
    const active = transactions.getStore();
    if (active && key === '$transaction') {
      return async (work: unknown) => typeof work === 'function'
        ? work(active) : Promise.all(work as Promise<unknown>[]);
    }
    const owner = active && key in active ? active : target;
    const value = Reflect.get(owner, key);
    return typeof value === 'function' ? value.bind(owner) : value;
  },
}) as PrismaClient;

export async function withLedgerTransaction<T>(work: () => Promise<T>, checkStock = true): Promise<T> {
  if (transactions.getStore()) return work();
  const execute = () => writerClient().$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1597463001)`;
    return transactions.run(tx, async () => {
      const result = await work();
      if (checkStock) {
        const { assertStockIntegrity } = await import('@/services/stock-integrity');
        await assertStockIntegrity();
      }
      return result;
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 15000, timeout: 60000 });
  // Workers may never wait on a network Promise belonging to another request.
  if (workerRuntime()) return execute();
  // Wait before reserving a connection. PostgreSQL's advisory lock remains
  // authoritative across processes; local waiters must not fill the read pool.
  const previous = writerQueue.tail;
  let release!: () => void;
  writerQueue.tail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
  return await execute();
  } finally { release(); }
}

export async function withReadSnapshot<T>(work: () => Promise<T>): Promise<T> {
  if (transactions.getStore()) return work();
  return clientForRequest().$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return transactions.run(tx, () => readSnapshots.run({}, work));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 15000, timeout: 60000 });
}

export async function readSnapshotKey(): Promise<string | undefined> {
  const scope = readSnapshots.getStore();
  if (!scope) return undefined;
  return scope.key ??= prisma.$queryRaw<{key:string}[]>`SELECT current_database() || ':' || pg_current_snapshot()::text AS key`.then(rows => rows[0].key);
}

export default prisma;
