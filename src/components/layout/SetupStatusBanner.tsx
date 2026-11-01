'use client';
import { apiFetch } from '@/lib/client-api';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';

interface SetupStatusData {
  isComplete: boolean;
  message: string;
  missingItems: string[];
}

export function SetupStatusBanner() {
  const [status, setStatus] = useState<SetupStatusData | null>(null);
  const { t, isRtl } = useI18n();
  const pathname = usePathname();

  const fetchStatus = useCallback(() => {
    apiFetch('/api/settings?status=true')
      .then((res) => res.json())
      .then((res) => {
        if (res.ok) setStatus(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, pathname]);

  useEffect(() => {
    const handleFocus = () => fetchStatus();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(fetchStatus, 8000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  if (!status || status.isComplete) return null;

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#DFD3C8] bg-[#F5EFEA] px-3 py-1.5 text-xs text-[#3D2414]">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[#9A6533] shrink-0" />
        <div>
          <span className="font-bold">{t.header.setupWarningTitle} </span>
          <span>{status.message}</span>
        </div>
      </div>
      <Link
        href="/setup"
        className="flex items-center gap-1 shrink-0 rounded-lg bg-[#6E1E24] px-2.5 py-1 font-semibold text-white hover:bg-[#58161B] transition"
      >
        <span>{t.header.setupWizardBtn}</span>
        <ArrowIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
