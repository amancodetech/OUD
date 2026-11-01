'use client';
import useSWR from 'swr';
import { useSyncExternalStore } from 'react';
import { apiFetch, apiReadSnapshot, emptyApiReadSnapshot, subscribeApiReads } from './client-api';

export function useApiQuery<T>(url: string | null, refreshInterval = 0) {
  const snapshot = useSyncExternalStore(subscribeApiReads, () => apiReadSnapshot(url), emptyApiReadSnapshot);
  const query = useSWR<{ value: T; fetchedAt: number }>(url, async (key: string) => {
    const response = await apiFetch(key, { cache: 'reload' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'تعذر تحميل البيانات');
    const confirmedAt = Number(response.headers.get('x-oud-fetched-at'));
    return { value, fetchedAt: confirmedAt || Date.now() };
  }, { refreshInterval, keepPreviousData: false });
  // The exact-key transport snapshot also covers prefetched/cold data and the
  // server refresh, while SWR keeps explicit mutate() tied to that request.
  const data = snapshot.data ?? query.data;
  const tracked = snapshot !== emptyApiReadSnapshot();
  return {
    ...query,
    error: tracked ? snapshot.error : query.error,
    isValidating: query.isValidating || snapshot.isValidating,
    isLoading: data === undefined && (query.isLoading || snapshot.isValidating),
    data: data?.value as T | undefined,
    fetchedAt: data?.fetchedAt,
  };
}
