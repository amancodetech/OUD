import { expect, it, vi } from 'vitest';
import { CacheBackend, CachedRead, EncryptedRecord, EncryptedSessionStore } from '@/components/data/session-persistence';

class MemoryBackend implements CacheBackend {
  records = new Map<string, EncryptedRecord>();
  async entries(scope: string) { return [...this.records.values()].filter(record => record.scope === scope); }
  async put(record: EncryptedRecord) { this.records.set(record.id, record); }
  async clear(scope: string) { for (const [id, record] of this.records) if (record.scope === scope) this.records.delete(id); }
  async retain(scope: string) { for (const [id, record] of this.records) if (record.scope !== scope) this.records.delete(id); }
}
const key = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const deadline = () => Date.now() + 600000;
const read: CachedRead = { body: '{"privateFinancialData":"12.0010"}', headers: [['content-type', 'application/json']], fetchedAt: Date.now() };

it('persists ciphertext only and restores the full query key after a verified reload', async () => {
  const backend = new MemoryBackend(), encodedKey = key();
  const first = new EncryptedSessionStore(backend);
  await first.unlock('login-1', encodedKey, deadline());
  const url = '/api/cash?year=2026&month=10&page=2&search=private-client';
  await first.remember(url, read);
  expect(backend.records.size).toBe(1);
  const record = [...backend.records.values()][0];
  expect(record.id).not.toContain('private-client');
  expect(new TextDecoder().decode(record.ciphertext)).not.toContain('privateFinancialData');
  expect(Object.keys(record).sort()).toEqual(['ciphertext', 'id', 'iv', 'scope']);
  await first.lock(false);
  const second = new EncryptedSessionStore(backend);
  expect((await second.unlock('login-1', encodedKey, deadline())).get(url)).toEqual(read);
});
it('uses a fresh IV for repeated writes and rejects the wrong key or tampered ciphertext', async () => {
  const backend = new MemoryBackend(), encodedKey = key(), warning = vi.fn();
  const store = new EncryptedSessionStore(backend, warning);
  await store.unlock('login', encodedKey, deadline());
  await store.remember('/api/items', read);
  const first = [...backend.records.values()][0];
  await store.remember('/api/items', read);
  const second = [...backend.records.values()][0];
  expect(second.iv).not.toEqual(first.iv);
  const wrong = new EncryptedSessionStore(backend, warning);
  expect((await wrong.unlock('login', key(), deadline())).size).toBe(0);
  new Uint8Array(second.ciphertext)[0] ^= 1;
  expect((await store.unlock('login', encodedKey, deadline())).size).toBe(0);
  expect(warning).toHaveBeenCalledTimes(2);
});
it('does not reuse a prior login or permission scope and does not unlock expired data', async () => {
  const backend = new MemoryBackend(), encodedKey = key();
  const first = new EncryptedSessionStore(backend);
  await first.unlock('old-login', encodedKey, deadline());
  await first.remember('/api/items', read);
  const second = new EncryptedSessionStore(backend);
  expect((await second.unlock('new-login', key(), deadline())).size).toBe(0);
  await second.remember('/api/items', read);
  expect([...backend.records.values()].every(record => record.scope === 'new-login')).toBe(true);
  expect((await second.unlock('new-login', encodedKey, Date.now() - 1)).size).toBe(0);
  const size = backend.records.size;
  await second.remember('/api/expired', read);
  expect(backend.records.size).toBe(size);
});
it('serializes logout deletion after a write whose transaction is already running', async () => {
  const backend = new MemoryBackend(), encodedKey = key();
  let finish!: () => void;
  const put = vi.spyOn(backend, 'put').mockImplementation(record => new Promise<void>(resolve => { finish = () => { backend.records.set(record.id, record); resolve(); }; }));
  const store = new EncryptedSessionStore(backend);
  await store.unlock('login', encodedKey, deadline());
  const write = store.remember('/api/items', read);
  await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
  const logout = store.lock();
  const late = store.remember('/api/late', read);
  finish();
  await Promise.all([write, logout, late]);
  expect(backend.records.size).toBe(0);
  expect(put).toHaveBeenCalledOnce();
});
it('discards hydration if logout happens while storage is loading', async () => {
  const backend = new MemoryBackend(), encodedKey = key();
  const first = new EncryptedSessionStore(backend);
  await first.unlock('login', encodedKey, deadline());
  await first.remember('/api/items', read);
  const existing = [...backend.records.values()];
  let finish!: (entries: EncryptedRecord[]) => void;
  vi.spyOn(backend, 'entries').mockImplementation(() => new Promise(done => { finish = done; }));
  const next = new EncryptedSessionStore(backend);
  const loading = next.unlock('login', encodedKey, deadline());
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  const logout = next.lock();
  finish(existing);
  expect((await loading).size).toBe(0);
  await logout;
  expect(backend.records.size).toBe(0);
});
it('reports quota failures without rejecting application reads or evicting older entries', async () => {
  const backend = new MemoryBackend(), warning = vi.fn();
  const store = new EncryptedSessionStore(backend, warning);
  await store.unlock('login', key(), deadline());
  await store.remember('/api/first', read);
  vi.spyOn(backend, 'put').mockRejectedValue(new DOMException('Quota exceeded', 'QuotaExceededError'));
  await expect(store.remember('/api/second', read)).resolves.toBeUndefined();
  expect(backend.records.size).toBe(1);
  expect(warning).toHaveBeenCalledOnce();
});
