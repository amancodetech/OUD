'use client';

export interface CachedRead { body: string; headers: [string, string][]; fetchedAt: number }
export interface EncryptedRecord { id: string; scope: string; iv: Uint8Array; ciphertext: ArrayBuffer }
export interface CacheBackend {
  entries(scope: string): Promise<EncryptedRecord[]>;
  put(record: EncryptedRecord): Promise<void>;
  clear(scope: string): Promise<void>;
  retain(scope: string): Promise<void>;
}

/** IndexedDB contains ciphertext only. Neither the login cookie nor the key is stored. */
export class IndexedCacheBackend implements CacheBackend {
  private database?: Promise<IDBDatabase>;
  private open() {
    if (!this.database) this.database = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Browser storage unavailable')); return; }
      const request = indexedDB.open('oud-session-cache-v1', 1);
      const timer = setTimeout(() => reject(new Error('Browser storage timed out')), 4000);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('reads', { keyPath: 'id' });
        store.createIndex('scope', 'scope');
      };
      request.onsuccess = () => { clearTimeout(timer); request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => { clearTimeout(timer); reject(request.error); };
      request.onblocked = () => { clearTimeout(timer); reject(new Error('Browser storage blocked')); };
    });
    return this.database;
  }
  private async transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = database.transaction('reads', mode);
      let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Browser storage failed'));
      action(tx.objectStore('reads'), result => { value = result; });
    });
  }
  entries(scope: string) {
    return this.transaction<EncryptedRecord[]>('readonly', (store, result) => {
      const request = store.index('scope').getAll(scope);
      request.onsuccess = () => result(request.result);
    });
  }
  put(record: EncryptedRecord) { return this.transaction<void>('readwrite', store => { store.put(record); }); }
  clear(scope: string) {
    return this.transaction<void>('readwrite', store => {
      const cursor = store.index('scope').openCursor(scope);
      cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
    });
  }
  retain(scope: string) {
    return this.transaction<void>('readwrite', store => {
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        if (cursor.result) { if (cursor.result.value.scope !== scope) cursor.result.delete(); cursor.result.continue(); }
      };
    });
  }
}

export class EncryptedSessionStore {
  private current?: { scope: string; key: CryptoKey; expiresAt: number; ticket: number };
  private ticket = 0;
  private writes: Promise<void> = Promise.resolve();
  constructor(private backend: CacheBackend = new IndexedCacheBackend(), private warning: () => void = () => {}) {}
  private active(captured: NonNullable<EncryptedSessionStore['current']>) {
    return this.current === captured && captured.ticket === this.ticket && captured.expiresAt > Date.now();
  }
  async unlock(scope: string, encodedKey: string, expiresAt: number): Promise<Map<string, CachedRead>> {
    const ticket = ++this.ticket;
    this.current = undefined;
    const keyBytes = Uint8Array.from(atob(encodedKey), value => value.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    if (ticket !== this.ticket || expiresAt <= Date.now()) return new Map();
    const captured = { scope, key, expiresAt, ticket };
    this.current = captured;
    const result = new Map<string, CachedRead>();
    try {
      await this.writes;
      if (!this.active(captured)) return result;
      const entries = await this.backend.entries(scope);
      for (const record of entries) {
        if (!this.active(captured)) return new Map();
        try {
          const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(record.iv), additionalData: new TextEncoder().encode(record.id) }, key, record.ciphertext);
          const entry = JSON.parse(new TextDecoder().decode(plaintext));
          if (typeof entry.url === 'string' && typeof entry.read?.body === 'string' && Array.isArray(entry.read.headers) && Number.isFinite(entry.read.fetchedAt)) result.set(entry.url, entry.read);
        } catch { this.warning(); }
      }
      if (!this.active(captured)) return new Map();
      // Stale logins are inaccessible with this key and can now be removed.
      this.writes = this.writes.then(async () => { if (this.active(captured)) await this.backend.retain(scope); }).catch(() => this.warning());
    } catch { this.warning(); }
    return this.active(captured) ? result : new Map();
  }
  remember(url: string, read: CachedRead): Promise<void> {
    const captured = this.current;
    if (!captured || !this.active(captured)) return Promise.resolve();
    this.writes = this.writes.then(async () => {
      if (!this.active(captured)) return;
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
      const id = `${captured.scope}:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) }, captured.key, new TextEncoder().encode(JSON.stringify({ url, read })));
      if (this.active(captured)) await this.backend.put({ id, scope: captured.scope, iv, ciphertext });
    }).catch(() => this.warning());
    return this.writes;
  }
  lock(erase = true, knownScope?: string): Promise<void> {
    const scope = this.current?.scope || knownScope;
    this.ticket++;
    this.current = undefined;
    // Serializing deletion after pending transactions prevents a late write from
    // recreating records after logout, even if IndexedDB ignores cancellation.
    if (erase && scope) this.writes = this.writes.then(() => this.backend.clear(scope)).catch(() => this.warning());
    return this.writes;
  }
}
