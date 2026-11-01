'use client';
import { useApiQuery } from '@/lib/use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { QueryStatus } from '@/components/data/QueryStatus';
import { apiFetch } from '@/lib/client-api';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Layers,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { tLocalizedName } from '@/i18n/translate-domain';

interface InventoryItem {
  id: string;
  code: string;
  displayCode: string;
  name: string;
  nameId?: string | null;
  nameEn?: string | null;
  role: string;
  categoryId: string;
  categoryName: string;
  categoryPrefix: string;
  unitName: string;
  availableQty: number;
  reorderLevel: number;
  monthlyAvgCost: number;
  availableValue: number;
  stockStatus: 'متاح' | 'أعد الطلب' | 'مخزون سالب';
  costCheck: string;
}

interface CategoryOption {
  id: string;
  name: string;
  prefix: string;
}

export default function InventoryReportPage() {
  const { t, locale, isRtl, tCategory, tUnit, tItemRole } = useI18n();

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [asOfDate, setAsOfDate] = useState(todayInStore());

  const query = useApiQuery<{ items: InventoryItem[]; categories: CategoryOption[] }>(queryKeys.inventory(asOfDate, selectedCategory, selectedStatus));
  const items = query.data?.items || [];
  const categories = query.data?.categories || [];
  const loading = query.isLoading;
  const loadInventory = () => query.mutate();

  // Client-side text search
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.nameId && item.nameId.toLowerCase().includes(q)) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
      item.code.toLowerCase().includes(q) ||
      item.displayCode.toLowerCase().includes(q) ||
      item.categoryName.toLowerCase().includes(q)
    );
  });

  // Calculate total EV
  const totalValue = filteredItems.reduce((sum, i) => sum + i.availableValue, 0);

  if (query.error && !query.data) return <QueryStatus query={query} />;

  return (
    <div className="space-y-6">
      <QueryStatus query={query} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-600" />
            {t.inventory.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t.inventory.subtitle}
          </p>
        </div>

        <div className={`${isRtl ? 'text-left' : 'text-right'} font-mono`}>
          <span className="text-xs text-gray-500 block">{t.inventory.totalValueEV || 'إجمالي قيمة المخزون (EV):'}</span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal">{t.common.currency}</span>
          </span>
        </div>
      </div>

      {/* Filter Bar (Spec 14 Section 3.1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        {/* Category Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            {t.inventory.category}
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">{t.inventory.allCategories || 'جميع الفئات'}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {tCategory(c.name)} ({c.prefix})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            {t.common.status}
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">{t.inventory.allStatuses || 'جميع الحالات'}</option>
            <option value="AVAILABLE">{t.inventory.stockStatusAvailable || 'متاح'}</option>
            <option value="REORDER">{t.inventory.stockStatusReorder || 'أعد الطلب'}</option>
            <option value="NEGATIVE">{t.inventory.stockStatusNegative || 'مخزون سالب'}</option>
          </select>
        </div>

        {/* As of Date */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            {t.inventory.asOfDate || 'حتى تاريخ'}
          </label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Search */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
            {t.common.search}
          </label>
          <div className="relative">
            <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3' : 'left-3'} top-2.5 text-gray-400`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.inventory.searchPlaceholder || t.common.search}
              className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500`}
            />
          </div>
        </div>
      </div>

      {/* Inventory Table (Spec 14 Section 3.2) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-500">{t.common.loading}</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-base font-semibold">{t.common.noData}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="p-3.5">{t.inventory.itemCode}</th>
                  <th className="p-3.5">{t.inventory.itemName}</th>
                  <th className="p-3.5">{t.inventory.category}</th>
                  <th className="p-3.5 text-center">{t.inventory.unit}</th>
                  <th className="p-3.5 text-center">{t.inventory.availableEQ || 'المتاح (EQ)'}</th>
                  <th className="p-3.5 text-center">{t.inventory.reorderLevel}</th>
                  <th className="p-3.5 text-left">{t.inventory.avgCostAVG || 'متوسط التكلفة (AVG)'}</th>
                  <th className="p-3.5 text-left">{t.inventory.totalInventoryValue}</th>
                  <th className="p-3.5 text-center">{t.common.status}</th>
                  <th className="p-3.5 text-center">{t.inventory.cardTitle || 'كارت الصنف'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group"
                  >
                    <td className="p-3.5 font-mono font-bold text-amber-800 dark:text-amber-400">
                      {item.displayCode || item.code}
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {tLocalizedName(item, locale)}
                      </div>
                      {(locale === 'en' || locale === 'id') && item.name && item.name !== tLocalizedName(item, locale) && (
                        <div className="text-[11px] text-gray-400 font-normal" dir="rtl">
                          {item.name}
                        </div>
                      )}
                      {locale === 'ar' && item.nameEn && (
                        <div className="text-[11px] text-gray-400 font-normal font-sans" dir="ltr">
                          {item.nameEn}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {tItemRole(item.role)}
                      </div>
                    </td>

                    <td className="p-3.5 text-xs text-gray-600 dark:text-gray-300">
                      {tCategory(item.categoryName)}
                    </td>

                    <td className="p-3.5 text-center text-xs text-gray-500 font-medium">
                      {tUnit(item.unitName)}
                    </td>

                    <td
                      className={`p-3.5 text-center font-mono font-bold ${
                        item.availableQty < 0
                          ? 'text-red-600 dark:text-red-400'
                          : item.availableQty <= item.reorderLevel
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {item.availableQty.toLocaleString('en-US')}
                    </td>

                    <td className="p-3.5 text-center font-mono text-xs text-gray-400">
                      {item.reorderLevel.toLocaleString('en-US')}
                    </td>

                    <td className="p-3.5 text-left font-mono text-xs text-gray-700 dark:text-gray-300">
                      {item.monthlyAvgCost.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {t.common.currency}
                    </td>

                    <td className="p-3.5 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {item.availableValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {t.common.currency}
                    </td>

                    <td className="p-3.5 text-center">
                      {item.stockStatus === 'مخزون سالب' && (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                          {t.inventory.stockStatusNegative || 'مخزون سالب'}
                        </span>
                      )}
                      {item.stockStatus === 'أعد الطلب' && (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          {t.inventory.stockStatusReorder || 'أعد الطلب'}
                        </span>
                      )}
                      {item.stockStatus === 'متاح' && (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {t.inventory.stockStatusAvailable || 'متاح'}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <Link
                        href={`/inventory/${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-lg transition-colors"
                        title="فتح كارت حركة الصنف"
                      >
                        <span>{t.inventory.itemCardBtn || 'الكارت'}</span>
                        <ChevronLeft className={`w-3.5 h-3.5 ${isRtl ? '' : 'rotate-180'}`} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Strict Totals Footer Rule (Spec 14 / Slide 44) */}
              <tfoot className="bg-gray-100 dark:bg-gray-800/80 font-bold border-t-2 border-gray-300 dark:border-gray-700">
                <tr>
                  <td colSpan={5} className="p-3.5 text-gray-900 dark:text-white">
                    {t.inventory.totalCountFooter || 'الإجمالي العام'} ({filteredItems.length})
                  </td>
                  {/* Under Available Quantity: Do NOT sum different units! */}
                  <td className="p-3.5 text-center text-xs text-amber-700 dark:text-amber-400 font-sans">
                    {t.inventory.doNotSumUnits || 'لا نجمع وحدات مختلفة'}
                  </td>
                  <td></td>
                  <td></td>
                  {/* Total EV */}
                  <td className="p-3.5 text-left font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {totalValue.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    {t.common.currency}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
