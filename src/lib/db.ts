import { Prisma, PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { testDatabaseUrl } from './test-database';

if (process.env.NODE_ENV === 'test') process.env.DATABASE_URL = testDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  ledgerWriterPrisma: PrismaClient | undefined;
  ledgerWriterQueue: { tail: Promise<void> } | undefined;
};

const configuredDatabaseUrl = process.env.DATABASE_URL;
let ledgerWriter = globalForPrisma.ledgerWriterPrisma;
function writerClient() {
  if (!ledgerWriter) {
    const url = new URL(configuredDatabaseUrl ?? process.env.DATABASE_URL!);
    url.searchParams.set('connection_limit', '1');
    ledgerWriter = new PrismaClient({ datasources: { db: { url: url.href } }, log: ['error'] });
    if (process.env.NODE_ENV !== 'production') globalForPrisma.ledgerWriterPrisma = ledgerWriter;
  }
  return ledgerWriter;
}

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;

const transactions = new AsyncLocalStorage<Prisma.TransactionClient>();
const readSnapshots = new AsyncLocalStorage<{ key?: Promise<string> }>();
export const isReadSnapshot = () => readSnapshots.getStore() !== undefined;
const writerQueue = globalForPrisma.ledgerWriterQueue ??= { tail: Promise.resolve() };

// Existing service helpers, including audit/code generation/ledger readers, share
// the transaction of the operation that called them. No second connection commits
// audit entries while their document is still uncommitted.
export const prisma = new Proxy(client, {
  get(target, key) {
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
  // Wait before reserving a connection. PostgreSQL's advisory lock remains
  // authoritative across processes; local waiters must not fill the read pool.
  const previous = writerQueue.tail;
  let release!: () => void;
  writerQueue.tail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
  return await writerClient().$transaction(async tx => {
    // A single ordered ledger lock serializes all document checks and writes.
    // READ COMMITTED takes a fresh snapshot after waiting for the lock.
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
  } finally { release(); }
}

export async function withReadSnapshot<T>(work: () => Promise<T>): Promise<T> {
  if (transactions.getStore()) return work();
  return client.$transaction(async tx => {
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
