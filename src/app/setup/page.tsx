'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { CheckCircle2, ChevronRight, ChevronLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';

export default function SetupWizardPage() {
  const router = useRouter();
  const { t, locale, isRtl, dir } = useI18n();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [currencyCode, setCurrencyCode] = useState('IDR');
  const [currencyLabel, setCurrencyLabel] = useState('روبية (IDR)');
  const [startYear, setStartYear] = useState(2026);
  const [openingCash, setOpeningCash] = useState('0');
  const [openingBank, setOpeningBank] = useState('3769575');
  const [approveOpeningAssets, setApproveOpeningAssets] = useState(false);
  const [openingLoans, setOpeningLoans] = useState('0');
  const [openingRetainedEarnings, setOpeningRetainedEarnings] = useState('0');

  // Step 6: Driver gift policy
  const [customersPerGift, setCustomersPerGift] = useState(10);
  const [giftValue, setGiftValue] = useState('100000');

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((res) => {
        if (res.ok && res.data) {
          const s = res.data;
          setCurrencyCode(s.currencyCode || 'IDR');
          setCurrencyLabel(s.currencyLabel || 'روبية (IDR)');
          setStartYear(s.startYear || 2026);
          setOpeningCash(String(s.openingCash || '0'));
          setOpeningBank(String(s.openingBank || '0'));
          setApproveOpeningAssets(Boolean(s.approveOpeningAssets));
          setOpeningLoans(String(s.openingLoans || '0'));
          setOpeningRetainedEarnings(String(s.openingRetainedEarnings || '0'));
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveStep1 = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currencyCode,
          currencyLabel,
          startYear,
          openingCash,
          openingBank,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || t.common.errorOccurred);
      }
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Save settings and mark openingReviewed = true
      const resSettings = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approveOpeningAssets,
          openingLoans,
          openingRetainedEarnings,
          openingReviewed: true,
        }),
      });
      if (!resSettings.ok) {
        const d = await resSettings.json().catch(() => ({}));
        throw new Error(d.error || t.common.errorOccurred);
      }

      // 2. Create gift policy
      const resPolicy = await fetch('/api/drivers/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          effectiveDate: `${startYear}-01-01`,
          customersPerGift,
          giftValue,
          notes: isRtl ? 'سياسة الهدايا التأسيسية' : 'Initial Gift Policy',
        }),
      });
      if (!resPolicy.ok) {
        const d = await resPolicy.json().catch(() => ({}));
        throw new Error(d.error || t.common.errorOccurred);
      }

      setSuccessMsg(
        isRtl
          ? 'تم تأكيد أرصدة البداية والتهيئة بالكامل!'
          : 'Opening balances and system setup confirmed successfully!'
      );
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    t.setup.stepStoreInfo,
    t.setup.stepOpeningInventory,
    t.setup.stepOpeningDebts,
    isRtl ? 'الأصول الافتتاحية' : 'Opening Assets',
    isRtl ? 'حقوق الشركاء' : 'Partners Equity',
    isRtl ? 'هدايا السائقين والاعتماد' : 'Driver Gifts & Approval',
  ];

  const NextArrow = isRtl ? '←' : '→';
  const PrevArrow = isRtl ? '→' : '←';

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900" dir={dir}>
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-600" />
              {t.setup.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t.setup.subtitle}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
          >
            {isRtl ? 'تخطي إلى الرئيسية ←' : 'Skip to Dashboard →'}
          </Link>
        </div>

        {/* Steps Progress */}
        <div className="mt-6 flex items-center justify-between border-b pb-6 overflow-x-auto gap-2">
          {stepsList.map((stName, idx) => {
            const currentIdx = idx + 1;
            const isDone = currentIdx < step;
            const isCurrent = currentIdx === step;
            return (
              <div key={stName} className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-amber-600 text-white ring-4 ring-amber-100'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isDone ? '✓' : currentIdx}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isCurrent ? 'text-amber-900' : 'text-slate-500'
                  }`}
                >
                  {stName}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Step Contents */}
        <div className="mt-6 space-y-6">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">
                {isRtl
                  ? 'الخطوة 1: اختيار العملة وسنة البداية والنقدية الافتتاحية'
                  : 'Step 1: Currency, Fiscal Year & Opening Cash'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">{t.settings.currencySymbol}</label>
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
                  <label className="block text-xs font-medium text-slate-700">{t.settings.fiscalYearStart}</label>
                  <input
                    type="number"
                    value={startYear}
                    onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isRtl
                      ? `تاريخ أول حركة في النظام هو 1 يناير من سنة البداية (${startYear}-01-01)`
                      : `Initial transaction date starts on January 1st (${startYear}-01-01)`}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    {isRtl ? 'رصيد الخزينة عند البداية' : 'Opening Cash Drawer'}
                  </label>
                  <div className="mt-1">
                    <MoneyInput
                      value={openingCash}
                      onChange={setOpeningCash}
                      currencyLabel={currencyCode}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    {isRtl ? 'رصيد البنك عند البداية' : 'Opening Bank Balance'}
                  </label>
                  <div className="mt-1">
                    <MoneyInput
                      value={openingBank}
                      onChange={setOpeningBank}
                      currencyLabel={currencyCode}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleSaveStep1}
                  disabled={loading}
                  className="rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700"
                >
                  {isRtl ? `التالي: مخزون البداية ${NextArrow}` : `Next: Opening Inventory ${NextArrow}`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">
                {isRtl
                  ? 'الخطوة 2: تعريف الأصناف ومخزون أول المدة'
                  : 'Step 2: Items Catalog & Opening Inventory'}
              </h2>
              <div className="rounded-lg bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">
                  {isRtl ? 'تنبيه هام:' : 'Important Note:'}
                </span>{' '}
                {isRtl
                  ? 'كميات وقيم مخزون أول المدة تُسجل في شاشة الأصناف مباشرة كأرصدة افتتاحية، ولا تُسجّل كفواتير شراء.'
                  : 'Opening inventory is set directly in the Items Master, not as purchase invoices.'}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  {`${PrevArrow} `}{t.common.back}
                </button>
                <div className="flex gap-2">
                  <Link
                    href="/items"
                    target="_blank"
                    className="rounded-md border border-amber-600 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50"
                  >
                    {isRtl ? 'فتح شاشة الأصناف ↗' : 'Open Items Catalog ↗'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    {isRtl ? `التالي: الأسماء والديون ${NextArrow}` : `Next: Parties & Debts ${NextArrow}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">
                {isRtl
                  ? 'الخطوة 3: الأسماء وبيانات الاتصال وديون أول المدة'
                  : 'Step 3: Contacts & Opening Debts'}
              </h2>
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                {isRtl
                  ? 'سجّل عملاء وموردي وسائقي وشركاء المحل وأدخل رصيد أول المدة لكل منهم.'
                  : 'Register customers, suppliers, drivers, and partners along with their opening balances.'}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  {`${PrevArrow} `}{t.common.back}
                </button>
                <div className="flex gap-2">
                  <Link
                    href="/parties"
                    target="_blank"
                    className="rounded-md border border-amber-600 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50"
                  >
                    {isRtl ? 'فتح شاشة الأسماء ↗' : 'Open Parties Directory ↗'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    {isRtl ? `التالي: الأصول الافتتاحية ${NextArrow}` : `Next: Fixed Assets ${NextArrow}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">
                {isRtl
                  ? 'الخطوة 4: الأصول الثابتة الافتتاحية'
                  : 'Step 4: Opening Fixed Assets'}
              </h2>
              <p className="text-xs text-slate-600">
                {isRtl
                  ? 'يحتوي النظام مسبقاً على أصول المحل المحفوظة (ديكور المحل، المكيف، اللوحة، الكاميرات، إلخ).'
                  : 'The system contains the store fixed assets (decoration, AC, signage, CCTV, etc).'}
              </p>

              <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
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
                        ? 'اعتماد القيم الافتتاحية للأصول في حقوق ملكية البداية'
                        : 'Recognize Fixed Assets into Initial Equity'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  {`${PrevArrow} `}{t.common.back}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700"
                >
                  {isRtl ? `التالي: حقوق الشركاء ${NextArrow}` : `Next: Partners Equity ${NextArrow}`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">
                {isRtl
                  ? 'الخطوة 5: مطابقة حقوق ملكية البداية مع رأس مال الشركاء'
                  : 'Step 5: Opening Equity & Partner Capital Reconciliation'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
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
                  <label className="block text-xs font-medium text-slate-700">
                    {isRtl ? 'رأس مال المؤسسة التأسيسي / حقوق الملكية' : 'Initial Business Equity / Capital'}
                  </label>
                  <div className="mt-1">
                    <MoneyInput
                      value={openingRetainedEarnings}
                      onChange={setOpeningRetainedEarnings}
                      currencyLabel={currencyCode}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  {`${PrevArrow} `}{t.common.back}
                </button>
                <div className="flex gap-2">
                  <Link
                    href="/partners"
                    target="_blank"
                    className="rounded-md border border-amber-600 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50"
                  >
                    {isRtl ? 'شاشة الشركاء والأصول ↗' : 'Partners & Assets Screen ↗'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setStep(6)}
                    className="rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    {isRtl ? `التالي: هدايا السائقين ${NextArrow}` : `Next: Driver Gifts ${NextArrow}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-800">
                {isRtl
                  ? 'الخطوة 6: سياسة هدايا السائقين والاعتماد النهائي'
                  : 'Step 6: Driver Gift Policy & Final Confirmation'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    {isRtl ? 'عدد العملاء لاستحقاق الهدية' : 'Tourists Required per Gift'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={customersPerGift}
                    onChange={(e) => setCustomersPerGift(parseInt(e.target.value, 10))}
                    className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    {isRtl ? 'قيمة الهدية التقديرية' : 'Estimated Gift Value'}
                  </label>
                  <div className="mt-1">
                    <MoneyInput
                      value={giftValue}
                      onChange={setGiftValue}
                      currencyLabel={currencyCode}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {isRtl ? 'تأكيد الاعتماد: ' : 'Confirmation: '}
                  </span>
                  {isRtl
                    ? 'الضغط على الزر أدناه سيعتمد إعدادات التأسيس ويحول حالة التأسيس في لوحة التحكم إلى معتمد بالكامل.'
                    : 'Clicking below will confirm initial setup and mark opening status as verified.'}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  {`${PrevArrow} `}{t.common.back}
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{loading ? t.common.saving : t.setup.completeSetupBtn}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
