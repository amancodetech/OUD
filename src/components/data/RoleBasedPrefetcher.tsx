'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch, apiSessionScope } from '@/lib/client-api';
import { todayInStore } from '@/domain/period';
import { resolveReportPeriod } from '@/domain/report-period';
import { prefetchQueryKeys } from '@/lib/query-keys';
import type { PermissionKey } from '@/lib/permissions';
import type { UserRole } from '@prisma/client';

const noPermissions: PermissionKey[] = [];
interface RoleBasedPrefetcherProps {
  role: UserRole;
  permissions?: PermissionKey[];
  today?: string;
  startYear?: number;
}

/** Warm only the permitted default page keys when the browser has idle time. */
export function RoleBasedPrefetcher({ role, permissions = noPermissions, today = todayInStore(), startYear = Number(today.slice(0, 4)) }: RoleBasedPrefetcherProps) {
  const searchParams = useSearchParams();
  const period = resolveReportPeriod(searchParams, today, startYear);
  const { startDate, endDate, error } = period;
  const permissionKey = permissions.join(',');
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const controller = new AbortController();
    const scope = apiSessionScope();
    const urls = prefetchQueryKeys({ role, permissions: permissionKey.split(',') as PermissionKey[], today, period: { preset: 'custom', startDate, endDate, error } });
    const cancel = () => {
      cancelled = true;
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      controller.abort();
    };
    let index = 0;
    const schedule = () => {
      if (cancelled || apiSessionScope() !== scope || !scope || index >= urls.length) return;
      if (window.requestIdleCallback) idle = window.requestIdleCallback(() => { void next(); }, { timeout: 3000 });
      else timer = setTimeout(() => { void next(); }, 1200);
    };
    const next = async () => {
      if (cancelled || apiSessionScope() !== scope || !navigator.onLine) return;
      try { await apiFetch(urls[index++], { signal: controller.signal }); }
      catch { /* The query snapshot carries request failures for the page. */ }
      if (!cancelled) timer = setTimeout(schedule, 400);
    };
    window.addEventListener('oud:cache-locked', cancel);
    window.addEventListener('oud:session-expired', cancel);
    window.addEventListener('oud:logout', cancel);
    schedule();
    return () => {
      cancel();
      window.removeEventListener('oud:cache-locked', cancel);
      window.removeEventListener('oud:session-expired', cancel);
      window.removeEventListener('oud:logout', cancel);
    };
  }, [role, permissionKey, today, startDate, endDate, error]);
  return null;
}
