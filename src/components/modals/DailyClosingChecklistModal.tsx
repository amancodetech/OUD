'use client';
import { apiFetch } from '@/lib/client-api';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Calendar,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  RotateCcw,
  Package,
  Layers,
  Clock,
  Printer,
  Sparkles,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { useI18n } from '@/i18n/LanguageContext';

interface DailyClosingData {
  date: string;
  sales: { count: number; totalAmount: number };
  purchases: { count: number; totalAmount: number };
  cashAndBank: { cashBalance: number; bankBalance: number; totalBalance: number };
  returns: { count: number; goodCount: number; damagedCount: number };
  stockIssues: { count: number };
  manufacturing: { batchesCount: number };
  debts: { dueTodayCount: number; overdueCount: number };
  health: { costAlertCount: number; negativeStockCount: number; isHealthy: boolean };
}

interface DailyClosingChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyClosingChecklistModal({ isOpen, onClose }: DailyClosingChecklistModalProps) {
  const { t, locale, isRtl } = useI18n();

  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayInStore());
  const [data, setData] = useState<DailyClosingData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  // Cash drawer counting
  const [countedCash, setCountedCash] = useState<number | string>('');

  // Checklist checked state
  const [checkedItems, setCheckedItems] = useState({
    item1: false,
    item2: false,
    item3: false,
    item4: false,
    item5: false,
    item6: false,
  });

  const loadClosingData = async (dateStr: string) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/reports/daily-closing?date=${dateStr}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Failed to load daily closing data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClosingData(selectedDate);
    }
  }, [isOpen, selectedDate]);

  const bookCash = data?.cashAndBank.cashBalance ?? 0;
  const numCounted = countedCash !== '' ? Number(countedCash) : null;
  const cashDiff = numCounted !== null ? numCounted - bookCash : null;

  // Auto-check item2 when cash drawer strictly matches
  useEffect(() => {
    if (cashDiff !== null && Math.abs(cashDiff) < 0.01) {
      setCheckedItems((prev) => ({ ...prev, item2: true }));
    }
  }, [cashDiff]);

  if (!isOpen || !mounted) return null;

  const toggleCheck = (key: keyof typeof checkedItems) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allCompleted = Object.values(checkedItems).every(Boolean);

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/70 backdrop-blur-sm p-3 sm:p-6 flex justify-center items-start"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] mt-4 sm:mt-8 mb-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative z-[100000]"
        onClick={(e) => e.stopPropagation()}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-4 sm:p-5 shrink-0 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                {t.closingModal.reviewChecklistTitle || t.closingModal.title}
              </h3>
              <p className="text-xs text-gray-500 line-clamp-1">
                {t.closingModal.reviewSubtext || t.closingModal.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Date Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-xl gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {t.closingModal.closingDateLabel || t.closingModal.dateToReview || 'تاريخ يوم الإغلاق المطلوب مراجعته:'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(todayInStore())}
                className="px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition"
              >
                {locale === 'ar' ? 'اليوم' : 'Today'}
              </button>
            </div>
          </div>

          {loading || !data ? (
            <div className="text-center py-12 text-sm text-gray-500">
              <div className="w-8 h-8 border-2 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              {t.common.loading}
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* 1. Sales & Purchases */}
              <div
                onClick={() => toggleCheck('item1')}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  checkedItems.item1
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checkedItems.item1}
                      readOnly
                      className="mt-1 rounded text-amber-600 focus:ring-amber-500 pointer-events-none"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-amber-600" />
                        {t.closingModal.salesPurchasesTitle || '1. المبيعات والمشتريات المسجلة اليوم'}
                      </h4>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 space-y-0.5">
                        <div>
                          {t.closingModal.salesCountLabel || 'المبيعات:'}{' '}
                          <span className="font-bold font-mono">
                            {data.sales.count} {t.closingModal.invoicesWord || 'فواتير'}
                          </span>{' '}
                          {t.common.total}:{' '}
                          <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {data.sales.totalAmount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            {t.common.currency || 'IDR'}
                          </span>
                        </div>
                        <div>
                          {t.closingModal.purchasesCountLabel || 'المشتريات:'}{' '}
                          <span className="font-bold font-mono">
                            {data.purchases.count} {t.closingModal.invoicesWord || 'فواتير'}
                          </span>{' '}
                          {t.common.total}:{' '}
                          <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                            {data.purchases.totalAmount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            {t.common.currency || 'IDR'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {checkedItems.item1 && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                </div>
              </div>

              {/* 2. Cash & Drawer Reconciliation (مطابقة الدرج) */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  checkedItems.item2
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 w-full">
                    <input
                      type="checkbox"
                      checked={checkedItems.item2}
                      onChange={() => toggleCheck('item2')}
                      className="mt-1 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="w-full space-y-2.5">
                      <div
                        onClick={() => toggleCheck('item2')}
                        className="cursor-pointer select-none flex items-center justify-between"
                      >
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          {t.closingModal.cashDrawerTitle || '2. مطابقة الخزينة والبنك وعدّ النقد في الدرج'}
                        </h4>
                        {checkedItems.item2 && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 dark:bg-gray-900 p-2.5 rounded-lg font-mono">
                        <div>
                          <span className="text-gray-500 block">{t.closingModal.bookCashBalance || 'رصيد الخزينة الدفتري:'}</span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {data.cashAndBank.cashBalance.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            {t.common.currency || 'IDR'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">{t.closingModal.bookBankBalance || 'رصيد البنك الدفتري:'}</span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {data.cashAndBank.bankBalance.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            {t.common.currency || 'IDR'}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Counted Cash input */}
                      <div className="pt-1">
                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                          {t.closingModal.enterActualCash || 'أدخل النقد الفعلي المعدود في الدرج الآن (روبية / IDR):'}
                        </label>
                        <div className="max-w-xs">
                          <MoneyInput
                            value={countedCash}
                            onChange={(v) => setCountedCash(v)}
                            placeholder="مثلاً: 5000"
                            currencyLabel="IDR"
                          />
                        </div>

                        {cashDiff !== null && (
                          <div className="mt-2 text-xs font-bold">
                            {Math.abs(cashDiff) < 0.01 ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                {t.closingModal.drawerMatches || 'الدرج مطابق تماماً للرصيد الدفتري ✅'}
                              </span>
                            ) : cashDiff > 0 ? (
                              <span className="text-blue-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                {t.closingModal.drawerSurplus || 'يوجد زيادة في الدرج بمقدار'}{' '}
                                {cashDiff.toLocaleString('en-US', { minimumFractionDigits: 2 })} {t.common.currency || 'IDR'} ℹ️
                              </span>
                            ) : (
                              <span className="text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                {t.closingModal.drawerDeficit || 'يوجد عجز في الدرج بمقدار'}{' '}
                                {Math.abs(cashDiff).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                {t.common.currency || 'IDR'} ⚠️
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Returns Recorded Today */}
              <div
                onClick={() => toggleCheck('item3')}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  checkedItems.item3
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checkedItems.item3}
                      readOnly
                      className="mt-1 rounded text-amber-600 focus:ring-amber-500 pointer-events-none"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <RotateCcw className="w-4 h-4 text-purple-600" />
                        {t.closingModal.returnsTitle || '3. المرتجعات المسجلة اليوم'}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {t.closingModal.returnsTodayCount || 'عدد المرتجعات اليوم:'}{' '}
                        <span className="font-bold font-mono">{data.returns.count}</span> (
                        <span className="text-emerald-600 font-bold">{data.returns.goodCount} {t.closingModal.goodCount || 'صالح'}</span>
                        {' '}&{' '}
                        <span className="text-rose-600 font-bold">
                          {data.returns.damagedCount} {t.closingModal.damagedCount || 'تالف'}
                        </span>
                        ) {t.closingModal.returnsCheckedDesc || '— تم التأكد من معالجتها وقيد رد النقدية إن وُجد.'}
                      </p>
                    </div>
                  </div>
                  {checkedItems.item3 && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                </div>
              </div>

              {/* 4. Stock Issues & Manufacturing */}
              <div
                onClick={() => toggleCheck('item4')}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  checkedItems.item4
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checkedItems.item4}
                      readOnly
                      className="mt-1 rounded text-amber-600 focus:ring-amber-500 pointer-events-none"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-blue-600" />
                        {t.closingModal.issuesMfgTitle || '4. صرف المخزون والتصنيع'}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {t.closingModal.issuesTodayCount || 'أذون صرف تستر/عينات اليوم:'}{' '}
                        <span className="font-bold font-mono">{data.stockIssues.count}</span> |{' '}
                        {t.closingModal.completedBatchesCount || 'دفعات تصنيع مكتملة اليوم:'}{' '}
                        <span className="font-bold font-mono">
                          {data.manufacturing.batchesCount}
                        </span>
                      </p>
                    </div>
                  </div>
                  {checkedItems.item4 && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                </div>
              </div>

              {/* 5. Due & Overdue Invoices */}
              <div
                onClick={() => toggleCheck('item5')}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  checkedItems.item5
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checkedItems.item5}
                      readOnly
                      className="mt-1 rounded text-amber-600 focus:ring-amber-500 pointer-events-none"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        {t.closingModal.debtsTitle || '5. المديونية المستحقة والمتأخرة'}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {t.closingModal.dueTodayCount || 'فواتير حل تاريخ استحقاقها اليوم:'}{' '}
                        <span className="font-bold font-mono">{data.debts.dueTodayCount}</span> |{' '}
                        {t.closingModal.overdueCount || 'فواتير متأخرة تجاوزت أجلها:'}{' '}
                        <span className="font-bold font-mono text-amber-600">
                          {data.debts.overdueCount}
                        </span>
                      </p>
                    </div>
                  </div>
                  {checkedItems.item5 && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                </div>
              </div>

              {/* 6. Cost Check & Alerts */}
              <div
                onClick={() => toggleCheck('item6')}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  checkedItems.item6
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checkedItems.item6}
                      readOnly
                      className="mt-1 rounded text-amber-600 focus:ring-amber-500 pointer-events-none"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        {t.closingModal.costHealthTitle || '6. سلامة التكلفة الشهرية والتنبيهات (COST_CHECK)'}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {data.health.isHealthy ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                            {t.closingModal.costAllHealthy || 'جميع الأصناف سليمة تماماً — لا توجد أي تنبيهات تكلفة (تنبيهات = 0).'}
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-4 h-4" />
                            {data.health.costAlertCount} / {data.health.negativeStockCount}{' '}
                            {t.closingModal.costAlertsFound || 'تنبيهات تكلفة ومخزون سالب تحتاج مراجعة!'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {checkedItems.item6 && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 shrink-0 bg-gray-50/70 dark:bg-gray-900">
          <div className="text-xs text-gray-500">
            {allCompleted ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                {t.closingModal.allCompletedSuccess || 'تم إكمال جميع بنود الإغلاق بنجاح'}
              </span>
            ) : (
              <span>
                {t.closingModal.reviewedCountOf || 'تم مراجعة'}{' '}
                {Object.values(checkedItems).filter(Boolean).length} / 6
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <Printer className="w-4 h-4" />
              {t.closingModal.printReport || 'طباعة التقرير'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              {t.closingModal.closeModal || 'إغلاق النافذة'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
