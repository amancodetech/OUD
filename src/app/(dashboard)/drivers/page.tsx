'use client';
import { useApiQuery } from '@/lib/use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { QueryStatus } from '@/components/data/QueryStatus';
import { apiFetch } from '@/lib/client-api';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Car,
  Gift,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Calendar,
  User,
  Phone,
  Trash2,
  Settings,
  Sparkles,
  ArrowRight,
  Package,
} from 'lucide-react';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { useI18n } from '@/i18n/LanguageContext';

interface DriverSummary {
  driverId: string;
  driverCode: string;
  driverName: string;
  driverNameEn?: string;
  carryoverReferrals: number;
  registeredClients: number;
  totalGiftsEarned: number;
  totalAccruedAmount: number;
  totalReceivedAmount: number;
  remainingBalance: number;
  lastRemainder: number;
  clientsNeededForNextGift: number;
}

interface DriverReferral {
  id: string;
  code: string;
  visitDate: string;
  driverId: string;
  visitorUniqueKey: string;
  visitorName: string;
  notes: string | null;
  status: 'POSTED' | 'VOID';
  voidReason?: string | null;
  calcBefore: number;
  calcGifts: number;
  calcConsumed: number;
  calcAfter: number;
  calcAmount: number;
  policyThreshold: number;
  policyGiftValue: number;
  driver: {
    id: string;
    code: string;
    name: string;
    nameEn?: string | null;
    phone: string | null;
    carNumber: string | null;
  };
}

export default function DriversPage() {
  const { t, locale, isRtl, tLocalizedName } = useI18n();
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'VISITS'>('SUMMARY');

  // Quick Register Form State
  const [visitDate, setVisitDate] = useState(todayInStore());
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [visitorUniqueKey, setVisitorUniqueKey] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingVisit, setSubmittingVisit] = useState(false);
  const [visitNotification, setVisitNotification] = useState<{
    type: 'success' | 'error' | 'celebrate';
    message: string;
  } | null>(null);

  // Cash Gift Payment Modal State
  const [payCashModalOpen, setPayCashModalOpen] = useState(false);
  const [targetDriver, setTargetDriver] = useState<DriverSummary | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payAccount, setPayAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [payingCash, setPayingCash] = useState(false);
  const [payError, setPayError] = useState('');

  // Void Modal State
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [targetVisit, setTargetVisit] = useState<DriverReferral | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  const query = useApiQuery<DriverSummary[]>(queryKeys.drivers);
  const referralQuery = useApiQuery<DriverReferral[]>(queryKeys.driverReferrals);
  const driverQuery = useApiQuery<any>(queryKeys.partiesLookup('DRIVER'));
  const summaries = query.data || [];
  const referrals = referralQuery.data || [];
  const drivers: any[] = driverQuery.data?.data || [];
  const loading = query.isLoading || referralQuery.isLoading || driverQuery.isLoading;
  const loadData = () => Promise.all([query.mutate(), referralQuery.mutate(), driverQuery.mutate()]);

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVisitNotification(null);

    if (!selectedDriverId) {
      setVisitNotification({ type: 'error', message: 'يرجى اختيار السائق' });
      return;
    }
    if (!visitorUniqueKey.trim()) {
      setVisitNotification({ type: 'error', message: 'رقم هاتف أو كود العميل الفريد إلزامي' });
      return;
    }
    if (!visitorName.trim()) {
      setVisitNotification({ type: 'error', message: 'اسم العميل الزائر إلزامي' });
      return;
    }

    try {
      setSubmittingVisit(true);
      const res = await apiFetch('/api/drivers/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitDate,
          driverId: selectedDriverId,
          visitorUniqueKey: visitorUniqueKey.trim(),
          visitorName: visitorName.trim(),
          notes: notes.trim() || null,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'فشل تسجيل زيارة العميل');
      }

      setVisitNotification({
        type: resJson.isGiftEarned ? 'celebrate' : 'success',
        message: resJson.notificationMessage,
      });

      // Reset form fields
      setVisitorUniqueKey('');
      setVisitorName('');
      setNotes('');

      // Reload lists
      loadData();
    } catch (err: any) {
      setVisitNotification({
        type: 'error',
        message: err.message || 'حدث خطأ أثناء تسجيل الزيارة',
      });
    } finally {
      setSubmittingVisit(false);
    }
  };

  const handlePayCashGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDriver) return;
    setPayError('');

    if (payAmount <= 0) {
      setPayError('المبلغ المسدد يجب أن يكون أكبر من الصفر');
      return;
    }
    if (payAmount > targetDriver.remainingBalance) {
      setPayError(`المبلغ يتجاوز الرصيد المتبقي المستحق (${targetDriver.remainingBalance.toLocaleString('en-US')} ر.س)`);
      return;
    }

    try {
      setPayingCash(true);
      const res = await apiFetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txDate: todayInStore(),
          type: 'DRIVER_CASH_GIFT',
          account: payAccount,
          amount: payAmount,
          partyId: targetDriver.driverId,
          description: `صرف هدية نقدية مستحقة للسائق ${targetDriver.driverName}`,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'فشل صرف الهدية النقدية');
      }

      setPayCashModalOpen(false);
      setTargetDriver(null);
      loadData();
    } catch (err: any) {
      setPayError(err.message || 'حدث خطأ أثناء سداد الهدية النقدية');
    } finally {
      setPayingCash(false);
    }
  };

  const handleVoidVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetVisit) return;
    setVoidError('');

    if (!voidReason.trim() || voidReason.trim().length < 3) {
      setVoidError('يرجى إدخال سبب الإلغاء (3 أحرف على الأقل)');
      return;
    }

    try {
      setVoiding(true);
      const res = await apiFetch(`/api/drivers/referrals/${targetVisit.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'فشل إلغاء الزيارة');
      }

      setVoidModalOpen(false);
      setTargetVisit(null);
      setVoidReason('');
      loadData();
    } catch (err: any) {
      setVoidError(err.message || 'حدث خطأ أثناء إلغاء الزيارة');
    } finally {
      setVoiding(false);
    }
  };

  // KPIs
  const totalGiftsAllDrivers = summaries.reduce((sum, s) => sum + s.totalGiftsEarned, 0);
  const totalRemainingBalanceAll = summaries.reduce((sum, s) => sum + s.remainingBalance, 0);
  const totalClientsReferredAll = summaries.reduce((sum, s) => sum + s.registeredClients, 0);

  // Filtered lists
  const filteredSummaries = summaries.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.driverName.toLowerCase().includes(q) || s.driverCode.toLowerCase().includes(q);
  });

  const filteredReferrals = referrals.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.code.toLowerCase().includes(q) ||
      r.visitorName.toLowerCase().includes(q) ||
      r.visitorUniqueKey.toLowerCase().includes(q) ||
      r.driver.name.toLowerCase().includes(q)
    );
  });

  if (query.error && !query.data) return <QueryStatus query={query} />;

  return (
    <div className="space-y-6">
      <QueryStatus query={query} />
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-amber-600" />
            {t.drivers.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t.drivers.subtitle}
          </p>
        </div>

        <Link
          href="/drivers/policies"
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-500" />
          {t.drivers.policyBtn || 'سياسة الهدايا والشروط'}
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t.drivers.totalVisitsKpi || 'إجمالي زيارات العملاء المسجلة'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-2">
            {totalClientsReferredAll.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-gray-500">{t.drivers.visitorClient || 'عميل زائر'}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t.drivers.totalGiftsKpi || 'مجموع الهدايا المستحقة المكتسبة'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-2">
            {totalGiftsAllDrivers.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-gray-500">{t.drivers.giftUnit || 'هدية'}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t.drivers.remainingBalanceKpi || 'إجمالي الرصيد المتبقي للصرف'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2">
            {totalRemainingBalanceAll.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span className="text-xs font-normal text-gray-500">{t.common.currency}</span>
          </div>
        </div>
      </div>

      {/* Section 1: Quick Register Bar (شريط التسجيل السريع) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-600" />
          {t.drivers.quickRegisterTitle || 'تسجيل عميل سائق جديد (العد التراكمي الفوري)'}
        </h2>

        {/* Live Notification Feedback */}
        {visitNotification && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs font-semibold transition-all ${
              visitNotification.type === 'celebrate'
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 shadow-sm'
                : visitNotification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
            }`}
          >
            {visitNotification.type === 'celebrate' ? (
              <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 animate-bounce" />
            ) : visitNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{visitNotification.message}</span>
          </div>
        )}

        <form onSubmit={handleCreateVisit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* Visit Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
              {t.drivers.visitDate} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Driver Select */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
              {t.drivers.driver || 'السائق'} <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="">{t.drivers.selectDriver || 'اختر السائق...'}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {tLocalizedName(d, locale)} ({d.code}) {d.carNumber ? `| ${t.drivers.carNumber || 'سيارة'}: ${d.carNumber}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Visitor Unique Phone / Code */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
              {t.drivers.visitorKey || 'هاتف / كود العميل الفريد'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={visitorUniqueKey}
              onChange={(e) => setVisitorUniqueKey(e.target.value)}
              placeholder="0501234567"
              required
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>

          {/* Visitor Name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
              {t.drivers.visitorName || 'اسم العميل الزائر'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder={t.drivers.visitorName || 'اسم الزائر'}
              required
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={submittingVisit}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {submittingVisit ? t.common.loading : (t.drivers.registerVisitBtn || 'تسجيل الزيارة')}
            </button>
          </div>
        </form>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('SUMMARY')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'SUMMARY'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t.drivers.summaryTab || 'خلاصة هدايا السائقين'} ({summaries.length})
          </button>
          <button
            onClick={() => setActiveTab('VISITS')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'VISITS'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t.drivers.visitsTab || 'سجل زيارات العملاء الكامل'} ({referrals.length})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3' : 'left-3'} top-2.5 text-gray-400`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.drivers.searchPlaceholder || t.common.search}
            className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500`}
          />
        </div>
      </div>

      {/* Tab 1: Driver Gifts Summary Table */}
      {activeTab === 'SUMMARY' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-500">{t.common.loading}</div>
          ) : filteredSummaries.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Car className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-base font-semibold">{t.common.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">{t.drivers.driver || 'السائق'}</th>
                    <th className="p-3.5 w-48">{t.drivers.nextGiftCounter || 'عداد الهدية التالية'}</th>
                    <th className="p-3.5 text-center">{t.drivers.registeredClients || 'العملاء المسجلون'}</th>
                    <th className="p-3.5 text-center">{t.drivers.earnedGifts || 'الهدايا المكتسبة'}</th>
                    <th className="p-3.5 text-left">{t.drivers.accruedAmount || 'إجمالي الاستحقاق'}</th>
                    <th className="p-3.5 text-left">{t.drivers.receivedAmount || 'ما استلمه'}</th>
                    <th className="p-3.5 text-left">{t.drivers.remainingBalance || 'الرصيد المتبقي'}</th>
                    <th className="p-3.5 text-center">{t.drivers.settlementActions || 'إجراءات الصرف'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredSummaries.map((s) => {
                    const threshold = s.lastRemainder + s.clientsNeededForNextGift || 10;
                    const progressPercent = Math.min(100, Math.round((s.lastRemainder / threshold) * 100));

                    return (
                      <tr key={s.driverId} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {(locale === 'en' || locale === 'id') && s.driverNameEn ? s.driverNameEn : s.driverName}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">{s.driverCode}</div>
                        </td>

                        {/* Visual Progress Bar (Spec 13) */}
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-amber-600 dark:text-amber-400">
                                {s.lastRemainder} / {threshold}
                              </span>
                              <span className="text-gray-400 text-[11px]">
                                {s.clientsNeededForNextGift === 0 ? (
                                  <span className="text-emerald-500 font-bold">{t.drivers.completed || 'مكتملة 🎉'}</span>
                                ) : (
                                  `${t.drivers.remainingCount || 'بقي'} ${s.clientsNeededForNextGift}`
                                )}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  s.clientsNeededForNextGift === 0
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5 text-center font-mono text-gray-700 dark:text-gray-300">
                          {s.registeredClients}
                        </td>

                        <td className="p-3.5 text-center font-mono font-bold text-purple-600 dark:text-purple-400">
                          {s.totalGiftsEarned}
                        </td>

                        <td className="p-3.5 text-left font-mono text-gray-700 dark:text-gray-300">
                          {s.totalAccruedAmount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {t.common.currency}
                        </td>

                        <td className="p-3.5 text-left font-mono text-emerald-600 dark:text-emerald-400">
                          {s.totalReceivedAmount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {t.common.currency}
                        </td>

                        <td className="p-3.5 text-left font-mono font-bold text-amber-600 dark:text-amber-400">
                          {s.remainingBalance.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {t.common.currency}
                        </td>

                        {/* Direct Settlement Action Buttons (Spec 13 Section 4) */}
                        <td className="p-3.5 text-center">
                          {s.remainingBalance > 0 ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setTargetDriver(s);
                                  setPayAmount(s.remainingBalance);
                                  setPayError('');
                                  setPayCashModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                                title={t.drivers.payCashGift || 'صرف هدية نقدية فوري'}
                              >
                                {t.drivers.cashDisbursement || 'صرف نقدي'}
                              </button>

                              <Link
                                href={`/sales/driver-gift?driverId=${s.driverId}`}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                                title="تسليم هدية بضاعة من المخزون"
                              >
                                {t.drivers.goodsGift || 'هدية بضاعة'}
                              </Link>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">{t.drivers.noPendingBalance || 'لا يوجد رصيد مستحق'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Full Visits Table (عملاء السائقين) */}
      {activeTab === 'VISITS' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-500">{t.common.loading}</div>
          ) : filteredReferrals.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <User className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-base font-semibold">{t.common.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3.5">{t.drivers.codeAndDate || 'الكود والتاريخ'}</th>
                    <th className="p-3.5">{t.drivers.driver || 'السائق'}</th>
                    <th className="p-3.5">{t.drivers.visitorPhoneCode || 'هاتف/كود العميل'}</th>
                    <th className="p-3.5">{t.drivers.visitorName || 'اسم العميل'}</th>
                    <th className="p-3.5 text-center">{t.drivers.beforeVisit || 'قبل الزيارة'}</th>
                    <th className="p-3.5 text-center">{t.drivers.visitGifts || 'هدايا الزيارة'}</th>
                    <th className="p-3.5 text-center">{t.drivers.afterVisit || 'بعد الزيارة'}</th>
                    <th className="p-3.5 text-left">{t.drivers.accruedAmount || 'قيمة مستحقة'}</th>
                    <th className="p-3.5 text-center">{t.common.status}</th>
                    <th className="p-3.5 text-center">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredReferrals.map((r) => {
                    const dateStr = r.visitDate
                      ? new Date(r.visitDate).toISOString().split('T')[0]
                      : '';
                    const isVoid = r.status === 'VOID';

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                          isVoid ? 'opacity-60 bg-gray-50/50 dark:bg-gray-900/50' : ''
                        }`}
                      >
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-gray-900 dark:text-white">
                            {r.code}
                          </div>
                          <div className="text-xs text-gray-400">{dateStr}</div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {tLocalizedName(r.driver, locale)}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">{r.driver.code}</div>
                        </td>

                        <td className="p-3.5 font-mono text-xs font-semibold text-gray-900 dark:text-white">
                          {r.visitorUniqueKey}
                        </td>

                        <td className="p-3.5 text-gray-700 dark:text-gray-300">{r.visitorName}</td>

                        <td className="p-3.5 text-center font-mono text-gray-500">
                          {r.calcBefore}
                        </td>

                        <td className="p-3.5 text-center">
                          {r.calcGifts > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                              <Sparkles className="w-3 h-3 text-purple-600" />+{r.calcGifts} {t.drivers.giftUnit || 'هدية'}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-mono">0</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                          {r.calcAfter}
                        </td>

                        <td className="p-3.5 text-left font-mono font-bold text-gray-900 dark:text-white">
                          {r.calcAmount > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {r.calcAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              {t.common.currency}
                            </span>
                          ) : (
                            <span className="text-gray-400">0.00 {t.common.currency}</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          {isVoid ? (
                            <span
                              className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                              title={`ملغى: ${r.voidReason || ''}`}
                            >
                              {t.drivers.statusVoid || 'ملغاة'}
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              {t.drivers.statusPosted || 'مرحلة'}
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          {!isVoid && (
                            <button
                              onClick={() => {
                                setTargetVisit(r);
                                setVoidReason('');
                                setVoidError('');
                                setVoidModalOpen(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                              title="إلغاء الزيارة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pay Cash Gift Modal */}
      {payCashModalOpen && targetDriver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setPayCashModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              {t.drivers.cashPaymentModalTitle || 'صرف هدية نقدية للسائق'} ({targetDriver.driverName})
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t.drivers.remainingBalance || 'الرصيد المتبقي المستحق للسائق'}:{' '}
              <span className="font-bold font-mono text-amber-600">
                {targetDriver.remainingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {t.common.currency}
              </span>
            </p>

            {payError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                {payError}
              </div>
            )}

            <form onSubmit={handlePayCashGift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t.common.amount} ({t.common.currency}) <span className="text-red-500">*</span>
                </label>
                <MoneyInput
                  value={payAmount}
                  onChange={(v) => setPayAmount(Number(v) || 0)}
                  placeholder={targetDriver.remainingBalance.toString()}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t.drivers.disbursementAccount || 'حساب الصرف'} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="account"
                      value="CASH"
                      checked={payAccount === 'CASH'}
                      onChange={() => setPayAccount('CASH')}
                      className="text-amber-600"
                    />
                    {t.drivers.cashDrawer || 'الخزينة النقدية (CASH)'}
                  </label>
                  <label className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="radio"
                      name="account"
                      value="BANK"
                      checked={payAccount === 'BANK'}
                      onChange={() => setPayAccount('BANK')}
                      className="text-amber-600"
                    />
                    {t.drivers.bankAccount || 'الحساب البنكي (BANK)'}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayCashModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={payingCash}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {payingCash ? t.common.loading : (t.drivers.confirmPayBtn || 'تأكيد وصرف الهدية')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModalOpen && targetVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setVoidModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {t.drivers.confirmVoidVisit || 'تأكيد إلغاء زيارة العميل'} ({targetVisit.code})
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {tLocalizedName(targetVisit.driver, locale)}
            </p>

            {voidError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                {voidError}
              </div>
            )}

            <form onSubmit={handleVoidVisit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t.drivers.voidReason || 'سبب الإلغاء'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.drivers.voidReason || 'أدخل سبب إلغاء هذه الزيارة...'}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={voiding}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {voiding ? t.common.loading : (t.drivers.confirmVoidBtn || 'تأكيد الإلغاء')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
