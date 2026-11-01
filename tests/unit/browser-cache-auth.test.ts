import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  token: '',
  user: { id: 'user-1', username: 'owner', displayName: 'Owner', role: 'ADMIN', permissions: [] as string[], isActive: true, sessionVersion: 1, sessionGeneration: 'generation-1' },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: () => state.token ? { value: state.token } : undefined,
  set: (_name: string, token: string) => { state.token = token; },
  delete: () => { state.token = ''; },
}) }));
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: async () => state.user } } }));

import { browserCacheKey, createSession, getSession } from '@/lib/auth';

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'test-only-cache-auth-abcdefghijklmnopqrstuvwxyz123456');
  state.token = ''; state.user.sessionVersion = 1; state.user.role = 'ADMIN';
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('assigns a distinct cache scope and key to every login, including logins at the same instant', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
  const user = { id: 'user-1', username: 'owner', displayName: 'Owner', role: 'ADMIN' as const };
  await createSession(user);
  const first = (await getSession())!;
  const firstToken = state.token;
  await createSession(user);
  const second = (await getSession())!;
  expect(state.token).not.toBe(firstToken);
  expect(second.cacheScope).not.toBe(first.cacheScope);
  expect(browserCacheKey(second)).not.toBe(browserCacheKey(first));
  expect(browserCacheKey(second)).toBe(browserCacheKey((await getSession())!));
  expect(Buffer.from(browserCacheKey(second), 'base64').byteLength).toBe(32);
  expect(JSON.stringify(second)).not.toContain(state.token);
  expect(second.cacheExpiresAt).toBe(1800000000000 + 7 * 86400000);
});

it('changes the cache scope when permissions change and rejects revoked or expired sessions', async () => {
  await createSession({ id: 'user-1', username: 'owner', displayName: 'Owner', role: 'ADMIN' });
  const first = (await getSession())!;
  state.user.role = 'CASHIER';
  const reduced = (await getSession())!;
  expect(reduced.cacheScope).not.toBe(first.cacheScope);
  expect(browserCacheKey(reduced)).not.toBe(browserCacheKey(first));
  state.user.sessionVersion++;
  expect(await getSession()).toBeNull();
  state.user.sessionVersion--;
  vi.spyOn(Date, 'now').mockReturnValue(first.cacheExpiresAt! + 1);
  expect(await getSession()).toBeNull();
});
