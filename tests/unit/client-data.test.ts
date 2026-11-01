import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { apiFetch, cachedQueryEntries, invalidateData, resetApiSession } from '@/lib/client-api';
import { SessionCache } from '@/components/data/SessionDataProvider';
beforeEach(() => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: true });
  resetApiSession('test-session');
});
afterEach(() => { resetApiSession(); vi.unstubAllGlobals(); });
it('retains the command key after a lost response but gives the next confirmed operation a fresh key', async () => {
  const keys: string[] = [];
  const fetcher = vi.fn(async (_url, init) => {
    keys.push(new Headers(init.headers).get('idempotency-key')!);
    if (keys.length === 1) throw new TypeError('Network interrupted');
    return Response.json({ ok: true });
  });
  vi.stubGlobal('fetch', fetcher);
  const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"amount":"12.0010"}' };
  await expect(apiFetch('/api/cash', options)).rejects.toThrow('تعذر التأكد');
  await apiFetch('/api/cash', options); await apiFetch('/api/cash', options);
  expect(keys[0]).toBe(keys[1]); expect(keys[2]).not.toBe(keys[1]);
  expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
});
it('discards a late response after logout even if the transport ignores abort', async () => {
  let resolve!: (value: Response) => void;
  vi.stubGlobal('fetch', () => new Promise<Response>(done => { resolve = done; }));
  const pending = apiFetch('/api/items');
  resetApiSession('different-user');
  resolve(Response.json({ data: ['private data'] }));
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
it('blocks offline financial writes without creating a background submission', async () => {
  vi.stubGlobal('navigator', { onLine: false });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(apiFetch('/api/cash', { method: 'POST', body: '{}' })).rejects.toThrow('لم يُرسل');
  expect(fetcher).not.toHaveBeenCalled();
});
it('retains all visited pages for the session without count, size or TTL eviction', () => {
  const first = new SessionCache(), second = new SessionCache();
  for (let i = 0; i < 100; i++) first.set(String(i), { data: 'x'.repeat(1000) });
  expect(first.size).toBe(100); expect(second.size).toBe(0);
  first.set('huge', { data: 'x'.repeat(4_100_000) });
  expect(first.has('huge')).toBe(true);
});
it('retains the same operation key after a 503 and includes the captured record version', async () => {
  const keys: string[] = [];
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const h = new Headers(init.headers); keys.push(h.get('idempotency-key')!);
    expect(h.get('if-match')).toBe('"4"');
    return Response.json({ error: 'unavailable' }, { status: 503 });
  });
  const options = { method: 'PUT', headers: { 'if-match': '"4"' }, body: '{}' };
  await apiFetch('/api/items/one', options); await apiFetch('/api/items/one', options);
  expect(keys[0]).toBe(keys[1]);
});
it('does not treat a truncated successful response as a confirmed save', async () => {
  const keys: string[] = [];
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    keys.push(new Headers(init.headers).get('idempotency-key')!);
    return keys.length === 1 ? new Response(new ReadableStream({ start(controller) { controller.error(new Error('Truncated')); } })) : Response.json({ ok: true });
  });
  const options = { method: 'POST', body: '{}' };
  await expect(apiFetch('/api/cash', options)).rejects.toThrow('تعذر التأكد');
  await apiFetch('/api/cash', options); expect(keys[0]).toBe(keys[1]);
});
it('returns a cached page immediately after long navigation and refreshes in the background', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ data: ['old'] })).mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal('fetch', fetcher);
  await apiFetch('/api/items?year=2026&page=2&search=oud');
  const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400000);
  const cached = await apiFetch('/api/items?year=2026&page=2&search=oud');
  expect(await cached.json()).toEqual({ data: ['old'] });
  expect(cached.headers.get('x-oud-cache')).toBe('session');
  resolve(Response.json({ data: ['new'] }));
  await vi.waitFor(() => expect(cachedQueryEntries()[0][1].data.value).toEqual({ data: ['new'] }));
  now.mockRestore();
});
it('keeps known data during invalidation, and isolates periods and later logins', async () => {
  const fetcher = vi.fn(async (url: string) => Response.json({ url }));
  vi.stubGlobal('fetch', fetcher);
  await apiFetch('/api/reports?year=2026');
  await apiFetch('/api/reports?year=2027');
  invalidateData();
  expect(cachedQueryEntries().map(entry => entry[0])).toEqual(['/api/reports?year=2026', '/api/reports?year=2027']);
  resetApiSession('new-login-same-user');
  expect(cachedQueryEntries()).toEqual([]);
  await apiFetch('/api/reports?year=2026');
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('locks the cache as logout starts and rejects late reads before logout finishes', async () => {
  let resolveRead!: (value: Response) => void, resolveLogout!: (value: Response) => void;
  vi.stubGlobal('fetch', (url: string) => new Promise<Response>(done => { if (url.includes('logout')) resolveLogout = done; else resolveRead = done; }));
  const read = apiFetch('/api/items');
  const logout = apiFetch('/api/auth/logout', { method: 'POST' });
  resolveRead(Response.json({ private: true }));
  await expect(read).rejects.toMatchObject({ name: 'AbortError' });
  expect(cachedQueryEntries()).toEqual([]);
  resolveLogout(Response.json({ ok: true }));
  await logout;
  expect(cachedQueryEntries()).toEqual([]);
});

it('sends explicit JSON for bodyless commands, including logout on Workers', async () => {
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(init.body).toBe('{}');
    return Response.json({ ok: true });
  });
  vi.stubGlobal('fetch', fetcher);
  await apiFetch('/api/items/one', { method: 'DELETE' });
  await apiFetch('/api/auth/logout', { method: 'POST' });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
