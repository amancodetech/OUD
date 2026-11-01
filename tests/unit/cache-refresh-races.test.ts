import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch, cachedQueryEntries, invalidateData, resetApiSession } from '@/lib/client-api';
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const value = () => cachedQueryEntries().find(([key]) => key === '/api/cash')?.[1].data.value;
beforeEach(() => { vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('navigator', { onLine: true }); resetApiSession('races'); });
afterEach(() => { resetApiSession(); vi.unstubAllGlobals(); });
it('replaces an in-flight cached refresh after a confirmed mutation without dropping known data', async () => {
  const old = deferred<Response>(); let amount = 100, reads = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    if (init.method === 'POST') { amount = 200; return Response.json({ ok: true }); }
    if (++reads === 2) return old.promise;
    return Response.json({ amount });
  }));
  await apiFetch('/api/cash');
  await apiFetch('/api/cash');
  await apiFetch('/api/cash', { method: 'POST', body: '{}' });
  expect(value()).toEqual({ amount: 100 });
  old.resolve(Response.json({ amount: 100 }));
  await vi.waitFor(() => expect(value()).toEqual({ amount: 200 }));
  expect(reads).toBe(3);
});
it('defers cold and prefetch reads started during a write until the confirmed commit', async () => {
  const save = deferred<Response>(); const get = vi.fn(async () => Response.json({ amount: 200 }));
  vi.stubGlobal('fetch', (_url: string, init: RequestInit) => init.method === 'POST' ? save.promise : get());
  const write = apiFetch('/api/cash', { method: 'POST', body: '{}' });
  const first = apiFetch('/api/cash'); const duplicate = apiFetch('/api/cash');
  expect(get).not.toHaveBeenCalled();
  save.resolve(Response.json({ ok: true })); await write;
  expect(await (await first).json()).toEqual({ amount: 200 });
  expect(await (await duplicate).json()).toEqual({ amount: 200 });
  expect(get).toHaveBeenCalledOnce();
});
it('replaces a cold read superseded by a revision in another tab and does not retry failures', async () => {
  const old = deferred<Response>(); const get = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(Response.json({ amount: 200 }));
  vi.stubGlobal('fetch', get);
  const pending = apiFetch('/api/cash'); invalidateData(); old.resolve(Response.json({ amount: 100 }));
  expect(await (await pending).json()).toEqual({ amount: 200 }); expect(get).toHaveBeenCalledTimes(2);
  get.mockResolvedValue(Response.json({ error: 'unavailable' }, { status: 503 }));
  expect((await apiFetch('/api/cash', { cache: 'reload' })).status).toBe(503);
  expect(get).toHaveBeenCalledTimes(3); expect(value()).toEqual({ amount: 200 });
});
it('retains the confirmed timestamp and exposes a failed HTTP background refresh with known data', async () => {
  const { apiReadSnapshot } = await import('@/lib/client-api');
  const failed = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ amount: 100 })).mockReturnValueOnce(failed.promise));
  const first = await apiFetch('/api/cash');
  const confirmedAt = Number(first.headers.get('x-oud-fetched-at'));
  expect(confirmedAt).toBeGreaterThan(0);
  const clock = vi.spyOn(Date, 'now').mockReturnValue(confirmedAt + 5000);
  try {
    const cached = await apiFetch('/api/cash');
    expect(Number(cached.headers.get('x-oud-fetched-at'))).toBe(confirmedAt);
    expect(apiReadSnapshot('/api/cash').isValidating).toBe(true);
    failed.resolve(Response.json({ error: 'maintenance' }, { status: 503 }));
    await vi.waitFor(() => expect(apiReadSnapshot('/api/cash').isValidating).toBe(false));
    expect(apiReadSnapshot('/api/cash').error?.message).toBe('maintenance');
    expect(apiReadSnapshot('/api/cash').data).toEqual({ value: { amount: 100 }, fetchedAt: confirmedAt });
    expect(apiReadSnapshot('/api/cash?period=B').data).toBeUndefined();
  } finally { clock.mockRestore(); }
});
it('publishes successful background results without causing another network refresh', async () => {
  const { apiReadSnapshot, subscribeApiReads } = await import('@/lib/client-api');
  const fresh = deferred<Response>();
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ amount: 100 })).mockReturnValueOnce(fresh.promise);
  vi.stubGlobal('fetch', fetcher); await apiFetch('/api/cash');
  const changed = vi.fn(); const unsubscribe = subscribeApiReads(changed);
  try {
    await apiFetch('/api/cash'); fresh.resolve(Response.json({ amount: 200 }));
    await vi.waitFor(() => expect(apiReadSnapshot('/api/cash').isValidating).toBe(false));
    expect(apiReadSnapshot('/api/cash').data?.value).toEqual({ amount: 200 });
    expect(apiReadSnapshot('/api/cash').error).toBeUndefined();
    expect(changed).toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(2);
  } finally { unsubscribe(); }
});
it('lets a foreground reader finish when the prefetch consumer cancels its shared read', async () => {
  const response = deferred<Response>(); let networkSignal!: AbortSignal;
  const get = vi.fn((_url: string, init: RequestInit) => { networkSignal = init.signal!; return response.promise; });
  vi.stubGlobal('fetch', get);
  const controller = new AbortController();
  const prefetch = apiFetch('/api/cash', { signal: controller.signal });
  const foreground = apiFetch('/api/cash', { cache: 'reload' });
  controller.abort();
  await expect(prefetch).rejects.toMatchObject({ name: 'AbortError' });
  expect(networkSignal.aborted).toBe(false);
  response.resolve(Response.json({ amount: 200 }));
  expect(await (await foreground).json()).toEqual({ amount: 200 });
  expect(get).toHaveBeenCalledOnce();
});
it('aborts unused prefetch work, and a later foreground request starts a fresh read', async () => {
  const old = deferred<Response>(); let oldSignal!: AbortSignal;
  const get = vi.fn().mockImplementationOnce((_url: string, init: RequestInit) => { oldSignal = init.signal!; return old.promise; }).mockResolvedValueOnce(Response.json({ amount: 200 }));
  vi.stubGlobal('fetch', get);
  const controller = new AbortController();
  const prefetch = apiFetch('/api/cash', { signal: controller.signal }); controller.abort();
  await expect(prefetch).rejects.toMatchObject({ name: 'AbortError' }); expect(oldSignal.aborted).toBe(true);
  expect(await (await apiFetch('/api/cash', { cache: 'reload' })).json()).toEqual({ amount: 200 });
  old.resolve(Response.json({ amount: 100 }));
  await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  expect(value()).toEqual({ amount: 200 });
});
it('keeps the last good snapshot and exposes malformed successful refreshes as errors', async () => {
  const { apiReadSnapshot } = await import('@/lib/client-api');
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({ amount: 100 }))
    .mockResolvedValueOnce(new Response('{broken', { headers: { 'content-type': 'application/json' } }))
    .mockResolvedValueOnce(new Response('<html>Error</html>', { headers: { 'content-type': 'text/html' } })));
  await apiFetch('/api/cash');
  const confirmedAt = apiReadSnapshot('/api/cash').data?.fetchedAt;
  for (let attempt = 0; attempt < 2; attempt++) {
    await expect(apiFetch('/api/cash', { cache: 'reload' })).rejects.toThrow('تعذر قراءة');
    expect(apiReadSnapshot('/api/cash').error).toBeInstanceOf(Error);
    expect(apiReadSnapshot('/api/cash').data?.fetchedAt).toBe(confirmedAt);
    expect(value()).toEqual({ amount: 100 });
  }
});
