'use client';
import { QueryStatus } from '@/components/data/QueryStatus';
import { useApiQuery } from '@/lib/use-api-query';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Package,
  ArrowRight,
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Layers,
  ShoppingBag,
  ExternalLink,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { Locale } from '@/i18n/types';

interface Movement {
  id: string;
  date: string;
  type: string;
  typeBadge: string;
  docCode: string;
  docUrl?: string;
  notes?: string | null;
  inQty: number;
  outQty: number;
  runningBalance: number;
}

interface StockCardData {
  item: {
    id: string;
    code: string;
    displayCode: string;
    name: string;
    nameEn?: string | null;
    role: string;
    categoryName: string;
    unitName: string;
    reorderLevel: number;
    currentAvailable: number;
    currentAvgCost: number;
    currentTotalValue: number;
  };
  movements: Movement[];
}

function translateMovementType(typeBadge: string, rawType: string, locale: Locale): string {
  const map: Record<string, { ar: string; id: string; en: string }> = {
    OPENING: { ar: 'رصيد أول المدة', id: 'Saldo Awal Periode', en: 'Opening Balance' },
    PURCHASE: { ar: 'فاتورة شراء', id: 'Faktur Pembelian', en: 'Purchase Invoice' },
    SALE: { ar: 'فاتورة بيع', id: 'Faktur Penjualan', en: 'Sales Invoice' },
    DRIVER_GIFT: { ar: 'تسليم هدية سائق', id: 'Hadiah Supir', en: 'Driver Gift Delivery' },
    SALE_RETURN: { ar: 'مرتجع بيع صالح', id: 'Retur Penjualan (Baik)', en: 'Good Sale Return' },
    PURCHASE_RETURN: { ar: 'مرتجع شراء إلى مورد', id: 'Retur Pembelian ke Supplier', en: 'Purchase Return to Supplier' },
    BATCH_MATERIAL: { ar: 'استهلاك تصنيع (خام)', id: 'Bahan Baku Produksi', en: 'Manufacturing Material Consumed' },
    BATCH_FINISHED: { ar: 'إنتاج تام مصنع', id: 'Produk Jadi Hasil Produksi', en: 'Manufactured Finished Product' },
    STOCK_ISSUE: { ar: 'صرف مخزني / إتلاف / عينة', id: 'Pengeluaran Stok / Sampel / Rusak', en: 'Stock Issue / Sample / Damage' },
  };
  return map[typeBadge]?.[locale] || rawType;
}

function translateMovementNotes(notes: string | null | undefined, locale: Locale): string {
  if (!notes) return '-';
  if (notes === 'الرصيد المعتمد عند تدشين النظام') {
    if (locale === 'id') return 'Saldo yang disetujui saat inisialisasi sistem';
    if (locale === 'en') return 'Approved balance at system initialization';
    return notes;
  }
  if (notes.startsWith('سطر شراء ')) {
    const code = notes.replace('سطر شراء ', '');
    if (locale === 'id') return `Baris Pembelian ${code}`;
    if (locale === 'en') return `Purchase Line ${code}`;
  }
  if (notes.startsWith('سطر بيع ')) {
    const code = notes.replace('سطر بيع ', '');
    if (locale === 'id') return `Baris Penjualan ${code}`;
    if (locale === 'en') return `Sales Line ${code}`;
  }
  if (notes.startsWith('سبب: ')) {
    const reason = notes.replace('سبب: ', '');
    if (locale === 'id') return `Alasan: ${reason}`;
    if (locale === 'en') return `Reason: ${reason}`;
  }
  return notes;
}

function translateDocCode(code: string, locale: Locale): string {
  if (code === 'افتتاحي') {
    if (locale === 'id') return 'Saldo Awal';
    if (locale === 'en') return 'Opening';
    return 'افتتاحي';
  }
  return code;
}

export default function StockCardPage() {
  const params = useParams();
  const itemId = params.itemId as string;
  const { t, locale, isRtl, tCategory, tUnit, tLocalizedName } = useI18n();

  const query = useApiQuery<StockCardData>(`/api/inventory/${itemId}/card`);
  const data = query.data;
  const loading = query.isLoading;
  const error = query.error?.message || '';

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-gray-500">
          {locale === 'id'
            ? 'Memuat pergerakan kartu stok...'
            : locale === 'en'
            ? 'Loading stock card movements...'
            : 'جاري تحميل حركات كارت الصنف...'}
        </p>
      </div>
    );
  }

  if ((!data && error) || !data) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-300">
        <div className="flex items-center gap-2 font-bold mb-2">
          <AlertCircle className="w-5 h-5" />
          {locale === 'id'
            ? 'Kesalahan pada Kartu Stok'
            : locale === 'en'
            ? 'Stock Card Error'
            : 'خطأ في كارت الصنف'}
        </div>
        <p className="text-sm">
          {error ||
            (locale === 'id'
              ? 'Data produk tidak ditemukan'
              : locale === 'en'
              ? 'Item data not found'
              : 'لم يتم العثور على بيانات الصنف')}
        </p>
        <Link href="/inventory" className="inline-block mt-4 text-xs font-bold text-amber-600 underline">
          {locale === 'id'
            ? 'Kembali ke Laporan Stok'
            : locale === 'en'
            ? 'Back to Inventory Report'
            : 'العودة لتقرير المخزون'}
        </Link>
      </div>
    );
  }

  const { item, movements } = data;

  const totalIn = movements.reduce((sum, m) => sum + m.inQty, 0);
  const totalOut = movements.reduce((sum, m) => sum + m.outQty, 0);

  const localizedItemName = tLocalizedName(item);
  const localizedUnit = tUnit(item.unitName);
  const localizedCategory = tCategory(item.categoryName);

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6">
      <QueryStatus query={query} />
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/inventory"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={
                locale === 'id'
                  ? 'Kembali ke Laporan Stok'
                  : locale === 'en'
                  ? 'Back to Inventory'
                  : 'العودة لتقرير المخزون'
              }
            >
              <BackIcon className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-amber-600" />
              <span>
                {locale === 'ar'
                  ? `كارت حركة الصنف: ${item.name}`
                  : locale === 'id'
                  ? `Kartu Mutasi Produk: ${localizedItemName}`
                  : `Item Movement Card: ${localizedItemName}`}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
            <span className="font-bold text-amber-700 dark:text-amber-400">{item.displayCode}</span>
            <span>•</span>
            <span>
              {locale === 'ar' ? 'المعرف' : locale === 'id' ? 'Kode' : 'Code'}: {item.code}
            </span>
            <span>•</span>
            <span>
              {locale === 'ar' ? 'الفئة' : locale === 'id' ? 'Kategori' : 'Category'}: {localizedCategory}
            </span>
            <span>•</span>
            <span>
              {locale === 'ar' ? 'الوحدة' : locale === 'id' ? 'Satuan' : 'Unit'}: {localizedUnit}
            </span>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>
            {locale === 'ar'
              ? 'طباعة كارت الصنف'
              : locale === 'id'
              ? 'Cetak Kartu Produk'
              : 'Print Stock Card'}
          </span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
            {locale === 'ar'
              ? 'الرصيد المتاح حالياً'
              : locale === 'id'
              ? 'Stok Tersedia Saat Ini'
              : 'Current Available Stock'}
          </span>
          <div className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
            {item.currentAvailable.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-gray-500">{localizedUnit}</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {locale === 'ar'
              ? 'حد إعادة الطلب'
              : locale === 'id'
              ? 'Batas Pesan Ulang'
              : 'Reorder Level'}
            : {item.reorderLevel}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
            {locale === 'ar'
              ? 'متوسط التكلفة المرجح الحالي'
              : locale === 'id'
              ? 'Biaya Rata-Rata Tertimbang (WAC)'
              : 'Weighted Average Cost (WAC)'}
          </span>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {item.currentAvgCost.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span className="text-xs font-normal text-gray-500">
              {locale === 'id' ? 'IDR' : locale === 'en' ? 'SAR' : 'ر.س'}
            </span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {locale === 'ar'
              ? 'محسوب شهرياً (AVG/RAVG)'
              : locale === 'id'
              ? 'Dihitung bulanan (AVG/RAVG)'
              : 'Calculated monthly (AVG/RAVG)'}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
            {locale === 'ar'
              ? 'إجمالي قيمة الرصيد الحالي (EV)'
              : locale === 'id'
              ? 'Total Nilai Stok Saat Ini (EV)'
              : 'Total Inventory Valuation (EV)'}
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {item.currentTotalValue.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span className="text-xs font-normal text-gray-500">
              {locale === 'id' ? 'IDR' : locale === 'en' ? 'SAR' : 'ر.س'}
            </span>
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {locale === 'ar'
              ? 'الرصيد المتاح × متوسط التكلفة'
              : locale === 'id'
              ? 'Stok Tersedia × Biaya Rata-rata'
              : 'Available Stock × Average Cost'}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
            {locale === 'ar'
              ? 'إجمالي حركات الداخل والخارج'
              : locale === 'id'
              ? 'Total Mutasi Masuk & Keluar'
              : 'Total In & Out Movements'}
          </span>
          <div className="text-xs font-mono font-bold mt-2 space-y-1">
            <div className="text-emerald-600">
              {locale === 'ar' ? 'الوارد' : locale === 'id' ? 'Masuk' : 'In'}: +
              {totalIn.toLocaleString('en-US')} {localizedUnit}
            </div>
            <div className="text-rose-600">
              {locale === 'ar' ? 'المنصرف' : locale === 'id' ? 'Keluar' : 'Out'}: -
              {totalOut.toLocaleString('en-US')} {localizedUnit}
            </div>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            <span>
              {locale === 'ar'
                ? `سجل الحركات التاريخية التفصيلية (${movements.length} حركة)`
                : locale === 'id'
                ? `Riwayat Mutasi Detail (${movements.length} mutasi)`
                : `Detailed Movements History (${movements.length} records)`}
            </span>
          </h2>
          <span className="text-xs text-gray-500">
            {locale === 'ar'
              ? 'مرتبة زمنياً من الأقدم إلى الأحدث'
              : locale === 'id'
              ? 'Diurutkan secara kronologis dari yang terlama'
              : 'Chronologically sorted from oldest to newest'}
          </span>
        </div>

        {movements.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {locale === 'id'
              ? 'Tidak ada mutasi yang tercatat untuk produk ini'
              : locale === 'en'
              ? 'No movements recorded for this item'
              : 'لا توجد حركات مسجلة لهذا الصنف'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 font-semibold uppercase border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="p-3">{t.common.date}</th>
                  <th className="p-3">
                    {t.inventory.movementType ||
                      (locale === 'id' ? 'Jenis Mutasi' : 'نوع الحركة')}
                  </th>
                  <th className="p-3">
                    {locale === 'ar'
                      ? 'المستند / المرجع'
                      : locale === 'id'
                      ? 'Dokumen / Ref'
                      : 'Doc / Ref'}
                  </th>
                  <th className="p-3">{t.common.notes}</th>
                  <th className="p-3 text-center text-emerald-600">
                    {t.inventory.qtyIn || '(+) وارد'}
                  </th>
                  <th className="p-3 text-center text-rose-600">
                    {t.inventory.qtyOut || '(-) منصرف'}
                  </th>
                  <th className="p-3 text-center font-bold text-gray-900 dark:text-white">
                    {t.inventory.balanceAfter ||
                      (locale === 'id' ? 'Saldo Berjalan' : 'الرصيد التراكمي')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="p-3 text-gray-600 dark:text-gray-300">{m.date}</td>

                    <td className="p-3 font-sans">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          m.typeBadge === 'OPENING'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : m.typeBadge === 'PURCHASE'
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                            : m.typeBadge === 'SALE'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : m.typeBadge === 'DRIVER_GIFT'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : m.typeBadge === 'SALE_RETURN'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : m.typeBadge === 'PURCHASE_RETURN'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : m.typeBadge === 'BATCH_MATERIAL'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
                            : m.typeBadge === 'BATCH_FINISHED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {translateMovementType(m.typeBadge, m.type, locale)}
                      </span>
                    </td>

                    <td className="p-3 font-bold text-gray-900 dark:text-white">
                      {m.docUrl ? (
                        <Link
                          href={m.docUrl}
                          className="text-amber-600 hover:underline flex items-center gap-1"
                        >
                          <span>{translateDocCode(m.docCode, locale)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span>{translateDocCode(m.docCode, locale)}</span>
                      )}
                    </td>

                    <td className="p-3 font-sans text-gray-500 max-w-xs truncate" title={m.notes || ''}>
                      {translateMovementNotes(m.notes, locale)}
                    </td>

                    <td className="p-3 text-center text-emerald-600 font-bold">
                      {m.inQty > 0 ? `+${m.inQty.toLocaleString('en-US')}` : '-'}
                    </td>

                    <td className="p-3 text-center text-rose-600 font-bold">
                      {m.outQty > 0 ? `-${m.outQty.toLocaleString('en-US')}` : '-'}
                    </td>

                    <td className="p-3 text-center font-bold text-gray-900 dark:text-white bg-gray-50/50 dark:bg-gray-800/20">
                      {m.runningBalance.toLocaleString('en-US')} {localizedUnit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
