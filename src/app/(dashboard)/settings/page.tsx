'use client';
import { apiFetch } from '@/lib/client-api';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { Settings, Shield, Sliders, History, Check, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';

export default function SettingsPage() {
  const router = useRouter();
  const { t, locale, isRtl } = useI18n();

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState<number | null>(null);
  const [storeName, setStoreName] = useState('محل العود والعطور');
  const [currencyCode, setCurrencyCode] = useState('IDR');
  const [currencyLabel, setCurrencyLabel] = useState('روبية (IDR)');
  const [startYear, setStartYear] = useState(2026);
  const [openingCash, setOpeningCash] = useState('0');
  const [openingBank, setOpeningBank] = useState('0');
  const [openingLoans, setOpeningLoans] = useState('0');
  const [openingRetainedEarnings, setOpeningRetainedEarnings] = useState('0');
  const [approveOpeningAssets, setApproveOpeningAssets] = useState(false);
  const [openingReviewed, setOpeningReviewed] = useState(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [lockedThroughDate, setLockedThroughDate] = useState('');
  const [unlockReason, setUnlockReason] = useState('');

  useEffect(() => {
    apiFetch('/api/settings')
      .then((res) => res.json())
      .then((res) => {
        if (res.ok && res.data) {
          const s = res.data;
          setVersion(s.version);
          setStoreName(s.storeName || 'محل العود والعطور');
          setCurrencyCode(s.currencyCode || 'IDR');
          setCurrencyLabel(s.currencyLabel || 'روبية (IDR)');
          setStartYear(s.startYear || 2026);
          setOpeningCash(String(s.openingCash || '0'));
          setOpeningBank(String(s.openingBank || '0'));
          setOpeningLoans(String(s.openingLoans || '0'));
          setOpeningRetainedEarnings(String(s.openingRetainedEarnings || '0'));
          setApproveOpeningAssets(Boolean(s.approveOpeningAssets));
          setOpeningReviewed(Boolean(s.openingReviewed));
          setAllowNegativeStock(Boolean(s.allowNegativeStock));
          if (s.lockedThroughDate) {
            setLockedThroughDate(s.lockedThroughDate.slice(0, 10));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'If-Match': JSON.stringify(String(version)) },
        body: JSON.stringify({
          storeName,
          currencyCode,
          currencyLabel,
          startYear,
          openingCash,
          openingBank,
          openingLoans,
          openingRetainedEarnings,
          approveOpeningAssets,
          openingReviewed,
          allowNegativeStock,
          lockedThroughDate: lockedThroughDate || null,
          unlockReason: unlockReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.common.errorOccurred);
      }

      setVersion(data.data.version);
      setSaved(true);
      router.refresh();
      window.dispatchEvent(new Event('focus'));
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-5 w-5 text-amber-600" />
            {t.settings.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t.settings.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings/users"
            className="flex items-center gap-1.5 rounded-xl bg-[#6E1E24] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#58161B] shadow-2xs transition"
          >
            <Shield className="h-4 w-4 text-[#E6B88A]" />
            <span>
              {isRtl ? 'المستخدمون والصلاحيات' : 'Users & Permissions'}
            </span>
          </Link>
          <Link
            href="/setup"
            className="flex items-center gap-1.5 rounded-xl border border-[#E6DDD3] bg-[#FAF5EE] px-3 py-2 text-xs font-bold text-[#6E1E24] hover:bg-[#F5EFEA]"
          >
            <Sliders className="h-4 w-4" />
            <span>{t.header.setupWizardBtn}</span>
          </Link>
          <Link
            href="/settings/audit"
            className="flex items-center gap-1.5 rounded-xl border border-[#E6DDD3] bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <History className="h-4 w-4" />
            <span>{isRtl ? 'سجل التدقيق (Audit Log)' : 'Audit Log'}</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Check className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{t.common.successSaved}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700">{t.settings.companyName}</label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">{t.settings.currencySymbol}</label>
            <select
              value={currencyCode}
              onChange={(e) => {
                const code = e.target.value;
                setCurrencyCode(code);
                if (code === 'IDR') setCurrencyLabel('روبية (IDR)');
                if (code === 'SAR') setCurrencyLabel('ريال سعودي (SAR)');
                if (code === 'AED') setCurrencyLabel('درهم إماراتي (AED)');
                if (code === 'USD') setCurrencyLabel('دولار أمريكي (USD)');
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="IDR">IDR (Indonesian Rupiah)</option>
              <option value="SAR">SAR (Saudi Riyal)</option>
              <option value="AED">AED (UAE Dirham)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">{t.settings.fiscalYearStart}</label>
            <input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
              className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">{t.settings.openingCashBalance}</label>
            <div className="mt-1">
              <MoneyInput
                value={openingCash}
                onChange={setOpeningCash}
                currencyLabel={currencyCode}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              {isRtl ? 'رصيد البنك الافتتاحي' : 'Opening Bank Balance'}
            </label>
            <div className="mt-1">
              <MoneyInput
                value={openingBank}
                onChange={setOpeningBank}
                currencyLabel={currencyCode}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              {isRtl ? 'إقفال الفترة المحاسبية حتى تاريخ' : 'Lock Period Through'}
            </label>
            <input
              type="date"
              value={lockedThroughDate}
              onChange={(e) => setLockedThroughDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
            />
              <input aria-label={locale === 'ar' ? 'سبب فك القفل' : locale === 'id' ? 'Alasan membuka periode' : 'Reason for unlocking'} placeholder={locale === 'ar' ? 'سبب فك القفل عند تغييره (5 أحرف على الأقل)' : locale === 'id' ? 'Alasan membuka periode (minimal 5 karakter)' : 'Unlock reason (at least 5 characters)'} value={unlockReason} onChange={e => setUnlockReason(e.target.value)} className="mt-2 w-full rounded-lg border p-2 text-sm" />
            <p className="mt-1 text-[11px] text-slate-500">
              {isRtl
                ? 'يُمنع إضافة أو تعديل أي حركة في أو قبل هذا التاريخ'
                : 'Entries on or before this date cannot be added or modified'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              {isRtl ? 'قروض افتتاحية مستحقة' : 'Opening Loans'}
            </label>
            <div className="mt-1">
              <MoneyInput
                value={openingLoans}
                onChange={setOpeningLoans}
                currencyLabel={currencyCode}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              {isRtl ? 'رأس مال المؤسسة التأسيسي / حقوق الملكية' : 'Initial Business Equity / Capital'}
            </label>
            <div className="mt-1">
              <MoneyInput
                value={openingRetainedEarnings}
                onChange={setOpeningRetainedEarnings}
                currencyLabel={currencyCode}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {isRtl
                ? 'صافي حقوق الملكية لبداية النشاط (إجمالي الموجودات والأصول ناقصاً ديون الموردين)'
                : 'Net opening equity (Assets minus Liabilities)'}
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="border-t border-slate-200 pt-6 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={approveOpeningAssets}
              onChange={(e) => setApproveOpeningAssets(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-xs font-bold text-slate-900">
                {isRtl
                  ? 'اعتماد الأصول والمصروفات التأسيسية ضمن حقوق الملكية'
                  : 'Approve Opening Fixed Assets into Initial Equity'}
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={openingReviewed}
              onChange={(e) => setOpeningReviewed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-xs font-bold text-slate-900">
                {isRtl
                  ? 'تمت مراجعة وتأكيد أرصدة البداية'
                  : 'Opening Balances Verified & Approved'}
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowNegativeStock}
              onChange={(e) => setAllowNegativeStock(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-xs font-bold text-slate-900">
                {isRtl
                  ? 'السماح بالبيع والصرف بالسالب'
                  : 'Allow Negative Stock on Sales'}
              </span>
              <p className="text-[11px] text-slate-500">
                {isRtl
                  ? 'افتراضياً غير مسموح لحماية دقة التكلفة والمخزون'
                  : 'Disabled by default to protect inventory and costing integrity'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-amber-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-700 shadow"
          >
            <Check className="h-4 w-4" />
            <span>{loading ? t.common.saving : t.common.save}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
