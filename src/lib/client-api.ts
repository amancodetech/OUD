'use client';

import { CachedRead, EncryptedSessionStore } from '@/components/data/session-persistence';

// Only successful reads are persisted. Commands and encryption keys stay in memory.
let scope = '';
let epoch = 0;
let dataEpoch = 0;
let expiresAt = Infinity;
let storageWarning = false;
const reads = new Map<string, CachedRead>();
export type ApiReadSnapshot = { data?: { value: unknown; fetchedAt: number }; isValidating: boolean; error?: Error };
const emptyReadSnapshot: ApiReadSnapshot = { isValidating: false };
const readSnapshots = new Map<string, ApiReadSnapshot>();
const readListeners = new Set<() => void>();
export const subscribeApiReads = (listener: () => void) => { readListeners.add(listener); return () => { readListeners.delete(listener); }; };
export const apiReadSnapshot = (url: string | null) => url ? readSnapshots.get(url) ?? emptyReadSnapshot : emptyReadSnapshot;
export const emptyApiReadSnapshot = () => emptyReadSnapshot;
function updateReadSnapshot(url: string, patch: Partial<ApiReadSnapshot>) {
  readSnapshots.set(url, { ...apiReadSnapshot(url), ...patch });
  for (const listener of readListeners) listener();
}
function publishRead(url: string, read: CachedRead) {
  try { updateReadSnapshot(url, { data: { value: JSON.parse(read.body), fetchedAt: read.fetchedAt } }); }
  catch { /* Non-JSON reads are not query snapshots. */ }
}
function clearReadState() {
  for (const finish of pendingWrites.values()) finish();
  pendingWrites.clear(); reads.clear(); refreshing.clear(); readSnapshots.clear();
  for (const listener of readListeners) listener();
}
type SharedRead = { promise: Promise<Response>; controller: AbortController; consumers: Set<symbol> };
const refreshing = new Map<string, SharedRead>();
const pendingWrites = new Map<Promise<void>, () => void>();
class SupersededRead extends Error {}
async function settleWrites() { while (pendingWrites.size) await Promise.all([...pendingWrites.keys()]); }
const dispatch = (name: string) => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(name)); };
const storage = new EncryptedSessionStore(undefined, () => { storageWarning = true; dispatch('oud:cache-warning'); });
export const browserCacheWarning = () => storageWarning;
function rememberRead(key: string, bytes: ArrayBuffer, headers: Headers) {
  const read = { body: new TextDecoder().decode(bytes), headers: Array.from(headers.entries()), fetchedAt: Date.now() };
  reads.set(key, read);
  publishRead(key, read);
  void storage.remember(key, read);
  return read;
}
export async function unlockApiSession(expectedScope: string, key: string, deadline: number) {
  const captured = epoch;
  if (scope !== expectedScope || !Number.isFinite(deadline) || deadline <= Date.now()) throw new Error('Invalid cache session');
  expiresAt = deadline;
  let restored = new Map<string, CachedRead>();
  try { restored = await storage.unlock(expectedScope, key, deadline); }
  catch { storageWarning = true; dispatch('oud:cache-warning'); }
  if (captured !== epoch || scope !== expectedScope) throw new DOMException('Session changed', 'AbortError');
  for (const [url, read] of restored) if (!reads.has(url)) { reads.set(url, read); publishRead(url, read); }
}
export function cachedQueryEntries() {
  return Array.from(reads, ([url, read]) => {
    try { return [url, { data: { value: JSON.parse(read.body), fetchedAt: read.fetchedAt }, isLoading: false, isValidating: false, _k: url }] as const; }
    catch { return undefined; }
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
}
const controllers = new Set<AbortController>();
const operations = new Map<string, string>();
const listeners = new Set<() => void>();
export const subscribeDataChange = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function invalidateData() { dataEpoch++; for (const listener of listeners) listener(); }
export function resetApiSession(nextScope = '') {
  if (scope && scope === nextScope) return;
  const purge = storage.lock(true, scope);
  epoch++;
  scope = nextScope;
  expiresAt = Infinity;
  storageWarning = false;
  controllers.forEach(controller => controller.abort());
  controllers.clear();
  operations.clear();
  clearReadState(); dataEpoch++;
  return purge;
}
// Unmount/reload releases keys and requests but preserves encrypted records.
export function releaseApiSession(expectedScope: string) {
  if (scope !== expectedScope) return;
  void storage.lock(false);
  epoch++; scope = ''; expiresAt = Infinity;
  controllers.forEach(controller => controller.abort()); controllers.clear();
  operations.clear(); clearReadState(); dataEpoch++;
}
export const apiSessionScope = () => scope;

function cacheableRead(input: string, init: RequestInit) {
  return (init.method || 'GET').toUpperCase() === 'GET' && !!scope && /^\/api\//.test(input) && !/^\/api\/(auth|backup|jobs)(?:[/?]|$)/.test(input);
}
// One network read per exact key. A confirmed write or cross-tab revision may
// supersede it; retry after writes settle instead of publishing a stale result.
function consumeRead(read: SharedRead, signal?: AbortSignal | null): Promise<Response> {
  const consumer = Symbol();
  read.consumers.add(consumer);
  return new Promise<Response>((resolve, reject) => {
    const cleanup = () => { read.consumers.delete(consumer); signal?.removeEventListener('abort', abort); };
    const abort = () => {
      cleanup();
      reject(new DOMException('Request aborted', 'AbortError'));
      if (!read.consumers.size) read.controller.abort();
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    void read.promise.then(response => { cleanup(); resolve(response.clone()); }, error => { cleanup(); reject(error); });
  });
}
function refreshRead(input: string, init: RequestInit): Promise<Response> {
  const existing = refreshing.get(input);
  if (existing && !existing.controller.signal.aborted) return consumeRead(existing, init.signal);
  const controller = new AbortController();
  const captured = epoch;
  updateReadSnapshot(input, { isValidating: true, error: undefined });
  const work = (async () => {
    for (;;) {
      if (pendingWrites.size) await settleWrites();
      if (captured !== epoch || controller.signal.aborted) throw new DOMException('Session changed', 'AbortError');
      try {
        const response = await performApiFetch(input, { ...init, signal: controller.signal });
        if (captured === epoch && !response.ok) {
          const value = await response.clone().json().catch(() => ({}));
          updateReadSnapshot(input, { error: new Error(value.error || 'تعذر تحميل البيانات') });
          dispatch('oud:read-refresh-failed');
        }
        return response;
      }
      catch (error) { if (!(error instanceof SupersededRead)) throw error; }
    }
  })();
  const shared: SharedRead = { promise: work, controller, consumers: new Set() };
  refreshing.set(input, shared);
  void work.catch(error => {
    if (captured === epoch && error?.name !== 'AbortError') {
      updateReadSnapshot(input, { error: error instanceof Error ? error : new Error('تعذر تحميل البيانات') });
      dispatch('oud:read-refresh-failed');
    }
  }).finally(() => {
    if (refreshing.get(input) === shared) { refreshing.delete(input); updateReadSnapshot(input, { isValidating: false }); }
  });
  return consumeRead(shared, init.signal);
}
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (scope && Date.now() >= expiresAt) { resetApiSession(); dispatch('oud:session-expired'); throw new DOMException('Session expired', 'AbortError'); }
  if (init.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (!cacheableRead(input, init)) return performApiFetch(input, init);
  const cached = init.cache !== 'reload' ? reads.get(input) : undefined;
  if (!cached) return refreshRead(input, init);
  void refreshRead(input, init).catch(() => {});
  const headers = new Headers(cached.headers);
  headers.set('x-oud-cache', 'session'); headers.set('x-oud-fetched-at', String(cached.fetchedAt));
  return new Response(cached.body, { headers });
}
async function performApiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const mutation = !['GET', 'HEAD'].includes(method);
  if (scope && Date.now() >= expiresAt) { resetApiSession(); dispatch('oud:session-expired'); throw new DOMException('Session expired', 'AbortError'); }
  const canCacheRead = cacheableRead(input, init);
  // Lock immediately when logout begins; its own HTTP request is created after
  // cancellation so a delayed read cannot write back into the departing session.
  if (input === '/api/auth/logout' && mutation) { const purge = resetApiSession(); dispatch('oud:cache-locked'); await purge; }
  const readEpoch = dataEpoch;
  const command = (mutation && !input.startsWith('/api/auth/')) || input.startsWith('/api/backup?');
  if (mutation && typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('الاتصال مقطوع. لم يُرسل الطلب؛ احتفظ بالمدخلات ثم أعد المحاولة عند عودة الاتصال');
  const headers = new Headers(init.headers);
  // Workers may represent an empty HTTP body as a non-null stream. Send an
  // explicit JSON document for bodyless commands so the API contract is stable.
  if (mutation && init.body == null) {
    headers.set('content-type', 'application/json');
    init = { ...init, body: '{}' };
  }
  let bodyIdentity: unknown = init.body ?? '';
  if (init.body instanceof FormData) {
    const parts = [];
    for (const [name, value] of init.body.entries()) {
      parts.push([name, typeof value === 'string' ? value : Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await value.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('')]);
    }
    bodyIdentity = parts.sort((a, b) => a[0].localeCompare(b[0]));
  }
  const fingerprint = JSON.stringify([scope, method, input, bodyIdentity, headers.get('if-match')]);
  if (command && !headers.has('idempotency-key')) {
    if (!operations.has(fingerprint)) {
      if (operations.size >= 20) throw new Error('توجد عمليات لم تتأكد نتيجتها؛ راجعها قبل إرسال عمليات أخرى');
      operations.set(fingerprint, crypto.randomUUID());
    }
    headers.set('idempotency-key', operations.get(fingerprint)!);
  }
  const controller = new AbortController();
  const captured = epoch;
  const abort = () => controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  controllers.add(controller);
  let finishWrite: (() => void) | undefined;
  const write = mutation && !input.startsWith('/api/auth/') ? new Promise<void>(resolve => { finishWrite = resolve; }) : undefined;
  if (write) pendingWrites.set(write, finishWrite!);
  try {
    let response = await fetch(input, { ...init, headers, cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
    // Read the complete response before resolving a financial command. A broken
    // response stream is ambiguous and must retain the same operation key.
    let bytes = await response.arrayBuffer();
    if (captured !== epoch || controller.signal.aborted) throw new DOMException('Session changed', 'AbortError');
    if (canCacheRead && pendingWrites.size) await settleWrites();
    if (captured !== epoch || controller.signal.aborted) throw new DOMException('Session changed', 'AbortError');
    if (canCacheRead && readEpoch !== dataEpoch) throw new SupersededRead();
    if (response.status === 202) {
      const { jobId } = JSON.parse(new TextDecoder().decode(bytes));
      if (!/^[a-f0-9]{64}$/.test(jobId)) throw new Error('Invalid background job');
      const deadline = Date.now() + 10 * 60 * 1000;
      for (;;) {
        if (captured !== epoch || controller.signal.aborted) throw new DOMException('Session changed', 'AbortError');
        if (Date.now() > deadline) throw new Error('Job still pending');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const status = await apiFetch(`/api/jobs/${jobId}`, { signal: controller.signal });
        if (!status.ok) { response = status; bytes = await status.arrayBuffer(); break; }
        const job = await status.json();
        if (['FAILED', 'EXPIRED'].includes(job.status)) {
          response = Response.json({ error: 'تعذر تنفيذ المهمة. لم تعتمد أي تغييرات جزئية. راجع الملف أو إعدادات الخدمة قبل إعادة المحاولة' }, { status: 422 });
          bytes = await response.arrayBuffer(); break;
        }
        if (job.status === 'SUCCEEDED') {
          response = await apiFetch(`/api/jobs/${jobId}?download=true`, { signal: controller.signal });
          bytes = await response.arrayBuffer(); break;
        }
      }
    }
    if (response.status === 401) {
      resetApiSession();
      dispatch('oud:session-expired');
    }
    if (response.status === 403) dispatch('oud:permissions-check');
    if (command && response.status < 500 && response.status !== 408 && response.status !== 429) operations.delete(fingerprint);
    if (input === '/api/auth/logout' && response.ok) dispatch('oud:logout');
    if (mutation && response.ok) {
      invalidateData();
      dispatch('oud:committed');
    }
    if (canCacheRead && response.ok) {
      // Cacheable API reads have a JSON contract. Do not replace a known-good
      // snapshot with malformed JSON or an HTML error page returned as HTTP 200.
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('تعذر قراءة استجابة الخادم');
      try { JSON.parse(new TextDecoder().decode(bytes)); }
      catch { throw new Error('تعذر قراءة استجابة الخادم'); }
      const read = rememberRead(input, bytes.slice(0), response.headers);
      const stampedHeaders = new Headers(response.headers);
      stampedHeaders.set('x-oud-fetched-at', String(read.fetchedAt));
      response = new Response(null, { status: response.status, statusText: response.statusText, headers: stampedHeaders });
    }
    return new Response(bytes.byteLength ? bytes : null, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    if (command) throw new Error('تعذر التأكد من نتيجة الحفظ. أعد المحاولة بنفس المدخلات؛ سيُستخدم مفتاح العملية نفسه لمنع التكرار. لا تُنشئ عملية بديلة قبل التحقق');
    throw error;
  } finally {
    if (write) { pendingWrites.delete(write); finishWrite!(); }
    controllers.delete(controller);
    init.signal?.removeEventListener('abort', abort);
  }
}
