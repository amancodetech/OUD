import type { PrismaClient } from '@prisma/client';

export function testDatabaseUrl(value = process.env.TEST_DATABASE_URL): string {
  if (!value) throw new Error('TEST_DATABASE_URL is required; application .env is never a test target');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !/^oud_test_[a-z0-9_]+$/.test(url.pathname.slice(1)) ||
      !['127.0.0.1', 'localhost', 'db-test'].includes(url.hostname)) {
    throw new Error('Refusing non-disposable database: expected local oud_test_<run>');
  }
  return value;
}

export async function assertTestDatabase(client: PrismaClient): Promise<void> {
  const url = new URL(testDatabaseUrl());
  const rows = await client.$queryRaw<Array<{ name: string }>>`SELECT current_database()::text AS name`;
  if (rows[0]?.name !== url.pathname.slice(1)) throw new Error('Actual test database identity mismatch');
}
