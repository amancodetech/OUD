'use client';
import React, { useEffect, useRef, useState } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { apiFetch, browserCacheWarning, cachedQueryEntries, invalidateData, releaseApiSession, resetApiSession, subscribeDataChange, unlockApiSession } from '@/lib/client-api';
import { useI18n } from '@/i18n/LanguageContext';

// No TTL or arbitrary count/size eviction. Successful GET responses are encrypted
// separately by client-api; transient SWR errors and pending requests are not.
export class SessionCache extends Map<string, any> {}

function useCacheText() {
  const { locale } = useI18n();
  return locale === 'ar' ? {
    checking: 'جارٍ التحقق من جلسة الدخول…', unavailable: 'تعذر التحقق من الجلسة. اتصل بالشبكة ثم أعد المحاولة.', retry: 'إعادة المحاولة',
    expired: 'انتهت الجلسة؛ جارٍ تسجيل الخروج…', locked: 'تم إخفاء البيانات المحلية. جارٍ تسجيل الخروج؛ أعد المحاولة إذا انقطع الاتصال.', logout: 'إتمام تسجيل الخروج',
    offline: 'الاتصال مقطوع — البيانات المعروضة قديمة. الحفظ يتطلب اتصالًا.', storage: 'تعذر حفظ بعض البيانات في المتصفح. تبقى في ذاكرة التبويب، وقد يلزم تحميلها من الخادم بعد إعادة فتحه.',
    refresh: 'تعذر تحديث بعض البيانات؛ المعروض هو آخر نسخة معروفة. تحقق من الاتصال قبل الاعتماد عليها.',
  } : locale === 'id' ? {
    checking: 'Memeriksa sesi masuk…', unavailable: 'Sesi tidak dapat diverifikasi. Sambungkan ke jaringan lalu coba lagi.', retry: 'Coba lagi',
    expired: 'Sesi berakhir; keluar…', locked: 'Data lokal disembunyikan. Sedang keluar; coba lagi jika koneksi terputus.', logout: 'Selesaikan keluar',
    offline: 'Offline — data yang ditampilkan mungkin lama. Penyimpanan memerlukan koneksi.', storage: 'Sebagian data tidak dapat disimpan di browser. Data tetap di memori tab dan mungkin perlu dimuat ulang dari server setelah tab dibuka kembali.',
    refresh: 'Sebagian data gagal diperbarui; versi terakhir ditampilkan. Periksa koneksi sebelum menggunakannya.',
  } : {
    checking: 'Verifying your session…', unavailable: 'Your session could not be verified. Connect to the network and retry.', retry: 'Retry',
    expired: 'Session expired; signing out…', locked: 'Local data is hidden. Signing out; retry if the connection was interrupted.', logout: 'Complete sign out',
    offline: 'Offline — displayed data may be outdated. Saving requires a connection.', storage: 'Some data could not be saved in your browser. It remains in this tab’s memory and may need to load from the server when reopened.',
    refresh: 'Some data could not be refreshed; the last known version is shown. Check connectivity before relying on it.',
  };
}

function SessionMonitor({ scope, expiresAt, children }: { scope: string; expiresAt: number; children: React.ReactNode }) {
  const { mutate, cache } = useSWRConfig();
  const text = useCacheText();
  const [expired, setExpired] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const [offline, setOffline] = useState(false);
  const [storageFailed, setStorageFailed] = useState(browserCacheWarning);
  const [refreshFailed, setRefreshFailed] = useState(false);
  useEffect(() => {
    let stopped = false;
    let checking = false;
    let last: string | undefined;
    let generation: string | undefined;
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('oud-data-v1') : undefined;
    const clear = () => { Array.from(cache.keys()).forEach(key => cache.delete(key)); return resetApiSession(); };
    const refresh = () => { if (!stopped && !lockedRef.current) void mutate(() => true); };
    const expire = (broadcast = true) => {
      if (stopped) return;
      if (broadcast) channel?.postMessage({ scope, kind: 'logout' });
      setExpired(true); void Promise.resolve(clear()).finally(() => window.location.replace('/login'));
    };
    const lock = (broadcast = true) => {
      if (broadcast) channel?.postMessage({ scope, kind: 'lock' });
      lockedRef.current = true; setLocked(true); void clear();
    };
    const check = async () => {
      setOffline(!navigator.onLine);
      if (Date.now() >= expiresAt) { expire(); return; }
      if (stopped || checking || lockedRef.current || document.visibilityState !== 'visible' || !navigator.onLine) return;
      checking = true;
      try {
        const res = await apiFetch('/api/auth/state');
        if (!res.ok || stopped) { if (!stopped && res.status !== 401) setRefreshFailed(true); return; }
        const state = await res.json();
        if (state.scope !== scope || (generation !== undefined && state.generation !== generation)) { expire(); return; }
        const revision = `${state.generation}:${state.revision}`;
        if (last !== undefined && last !== revision) invalidateData();
        last = revision; generation = state.generation; setRefreshFailed(false);
      } catch (error) { if (!stopped && (error as Error)?.name !== 'AbortError') setRefreshFailed(true); }
      finally { checking = false; }
    };
    const logout = () => expire();
    const lockEvent = () => lock();
    const committed = () => { channel?.postMessage({ scope, kind: 'changed' }); void check(); };
    const storageError = () => setStorageFailed(true);
    const refreshError = () => setRefreshFailed(true);
    if (channel) channel.onmessage = event => {
      if (event.data?.scope !== scope) return;
      if (event.data.kind === 'logout') expire(false);
      else if (event.data.kind === 'lock') lock(false);
      else { invalidateData(); void check(); }
    };
    const unsubscribe = subscribeDataChange(refresh);
    const timer = setInterval(check, 30000);
    const expiry = setTimeout(() => expire(), Math.max(0, expiresAt - Date.now()));
    window.addEventListener('online', check); window.addEventListener('offline', check); window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('oud:committed', committed); window.addEventListener('oud:logout', logout);
    window.addEventListener('oud:cache-locked', lockEvent); window.addEventListener('oud:cache-warning', storageError);
    window.addEventListener('oud:read-refresh-failed', refreshError);
    window.addEventListener('oud:session-expired', logout); window.addEventListener('oud:permissions-check', check);
    void check();
    return () => {
      stopped = true; unsubscribe(); clearInterval(timer); clearTimeout(expiry); channel?.close();
      window.removeEventListener('online', check); window.removeEventListener('offline', check); window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('oud:logout', logout); window.removeEventListener('oud:cache-locked', lockEvent);
      window.removeEventListener('oud:cache-warning', storageError); window.removeEventListener('oud:read-refresh-failed', refreshError);
      window.removeEventListener('oud:committed', committed); window.removeEventListener('oud:session-expired', logout); window.removeEventListener('oud:permissions-check', check);
    };
  }, [scope, expiresAt, cache, mutate]);
  if (expired) return <p role="status">{text.expired}</p>;
  if (locked) return <div role="status" className="p-6 text-center">{text.locked}<button className="mx-2 underline" onClick={() => { void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); }}>{text.logout}</button></div>;
  return <>{offline && <div role="status" className="bg-amber-100 p-2 text-center text-sm">{text.offline}</div>}{storageFailed && <div role="status" className="bg-amber-100 p-2 text-center text-sm">{text.storage}</div>}{refreshFailed && !offline && <div role="status" className="bg-amber-100 p-2 text-center text-sm">{text.refresh}</div>}{children}</>;
}

export function SessionDataProvider({ scope, children }: { scope: string; children: React.ReactNode }) {
  const [cache] = useState(() => new SessionCache());
  const [state, setState] = useState<{ ready?: number; error?: boolean }>({});
  const [attempt, setAttempt] = useState(0);
  const bootstrapped = useRef(false);
  const text = useCacheText();
  useEffect(() => {
    let stopped = false;
    bootstrapped.current = false;
    resetApiSession(scope);
    const bootstrap = async () => {
      try {
        const response = await apiFetch('/api/auth/cache');
        if (response.status === 401) { await resetApiSession(); window.location.replace('/login'); return; }
        if (!response.ok) throw new Error('Session verification failed');
        const session = await response.json();
        if (stopped) return;
        if (session.scope !== scope || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
          await resetApiSession(); window.location.replace('/login'); return;
        }
        await unlockApiSession(scope, session.key, session.expiresAt);
        if (stopped) return;
        for (const [key, value] of cachedQueryEntries()) cache.set(key, value);
        bootstrapped.current = true;
        setState({ ready: session.expiresAt });
      } catch { if (!stopped) setState({ error: true }); }
    };
    const retry = () => { if (!stopped && !bootstrapped.current) { setState({}); setAttempt(value => value + 1); } };
    window.addEventListener('online', retry);
    void bootstrap();
    return () => { stopped = true; window.removeEventListener('online', retry); releaseApiSession(scope); cache.clear(); };
  }, [scope, cache, attempt]);
  if (!state.ready) return <div className="p-6 text-center" role="status">{state.error ? text.unavailable : text.checking}{state.error && <button className="mx-2 underline" onClick={() => { setState({}); setAttempt(value => value + 1); }}>{text.retry}</button>}</div>;
  return <SWRConfig value={{ provider: () => cache, dedupingInterval: 2000, revalidateOnFocus: true, revalidateOnReconnect: true, shouldRetryOnError: false, keepPreviousData: false }}><SessionMonitor scope={scope} expiresAt={state.ready}>{children}</SessionMonitor></SWRConfig>;
}
