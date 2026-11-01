'use client';
import { QueryStatus } from '@/components/data/QueryStatus';
import { useApiQuery } from '@/lib/use-api-query';
import { queryKeys } from '@/lib/query-keys';
import { apiFetch } from '@/lib/client-api';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Plus,
  Gift,
  Search,
  DollarSign,
  AlertCircle,
  Clock,
  Printer,
  Eye,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { useI18n } from '@/i18n/LanguageContext';

export default function SalesPage() {
  const { t, locale, isRtl, tAging, tInvoiceKey, tUnit, tLocalizedName } = useI18n();



  const [viewMode, setViewMode] = useState<'INVOICES' | 'LINES'>('INVOICES');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');

  const [page, setPage] = useState(1);


  const text = (ar: string, en: string, id: string) => locale === 'ar' ? ar : locale === 'id' ? id : en;


  // Collection modal state
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [selectedInvoiceForCollect, setSelectedInvoiceForCollect] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectAccount, setCollectAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [collectNotes, setCollectNotes] = useState('');
  const [submittingCollect, setSubmittingCollect] = useState(false);
  const [collectError, setCollectError] = useState('');

  // Void modal state
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [invoiceToVoid, setInvoiceToVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(searchTerm), 250); return () => clearTimeout(timer); }, [searchTerm]);
  const invoiceQuery = useApiQuery<any>(queryKeys.sales({ page, search: debouncedSearch, customerId: selectedCustomer }));
  const customerQuery = useApiQuery<any>(queryKeys.partiesLookup('CLIENT'));
  const invoices: any[] = Array.isArray(invoiceQuery.data) ? invoiceQuery.data : invoiceQuery.data?.data || [];
  const customers: any[] = Array.isArray(customerQuery.data) ? customerQuery.data : customerQuery.data?.data || [];
  const loading = invoiceQuery.isLoading || customerQuery.isLoading || searchTerm !== debouncedSearch;
  const loadError = invoiceQuery.error || customerQuery.error;
  const loadData = () => Promise.all([invoiceQuery.mutate(), customerQuery.mutate()]);

  const filteredInvoices = invoices.filter((inv) => {
    if (inv.status === 'VOID') return false;
    if (selectedCustomer && inv.customerId !== selectedCustomer) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchNo = inv.invoiceNo?.toLowerCase().includes(s);
      const matchKey = inv.invoiceKey?.toLowerCase().includes(s);
      const matchCust = inv.customer?.name?.toLowerCase().includes(s);
      if (!matchNo && !matchKey && !matchCust) return false;
    }
    return true;
  });

  // KPI Metrics
  const totalSalesAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.originalAsOf || 0), 0);
  const totalReceivable = filteredInvoices.reduce((sum, inv) => sum + (inv.invoiceDebt || 0), 0);
  const totalCollected = filteredInvoices.reduce((sum, inv) => sum + (inv.settlementAsOf || 0), 0);

  const handleOpenCollection = (inv: any) => {
    setSelectedInvoiceForCollect(inv);
    setCollectAmount(inv.invoiceDebt > 0 ? inv.invoiceDebt : 0);
    setCollectAccount('CASH');
    setCollectNotes(
      isRtl
        ? `تحصيل دفعة من فاتورة ${inv.invoiceKey}`
        : `Payment collection for invoice ${inv.invoiceKey}`
    );
    setCollectError('');
    setCollectModalOpen(true);
  };

  const submitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectAmount || collectAmount <= 0) {
      setCollectError(isRtl ? 'يرجى إدخال مبلغ تحصيل صحيح' : 'Please enter a valid amount');
      return;
    }

    setSubmittingCollect(true);
    setCollectError('');
    try {
      const res = await apiFetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txDate: todayInStore(),
          type: 'CUSTOMER_COLLECTION',
          account: collectAccount,
          amount: collectAmount,
          partyId: selectedInvoiceForCollect.customerId,
          invoiceKey: selectedInvoiceForCollect.invoiceKey,
          description: collectNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.common.errorOccurred);

      setCollectModalOpen(false);
      await loadData();
    } catch (err: any) {
      setCollectError(err.message);
    } finally {
      setSubmittingCollect(false);
    }
  };

  const handleOpenVoid = (inv: any) => {
    setInvoiceToVoid(inv);
    setVoidReason('');
    setVoidError('');
    setVoidModalOpen(true);
  };

  const submitVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason || voidReason.trim().length < 3) {
      setVoidError(isRtl ? 'يرجى كتابة سبب الإلغاء (3 أحرف على الأقل)' : 'Please enter void reason (min 3 chars)');
      return;
    }

    setVoiding(true);
    setVoidError('');
    try {
      const res = await apiFetch(`/api/sales/${invoiceToVoid.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.common.errorOccurred);

      setVoidModalOpen(false);
      await loadData();
    } catch (err: any) {
      setVoidError(err.message);
    } finally {
      setVoiding(false);
    }
  };

  const getAgingBadge = (aging: string) => {
    if (aging === 'مسدد') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (aging === 'رصيد دائن') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (aging === 'غير مستحق') return 'bg-slate-100 text-slate-700 border-slate-300';
    return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
  };

  if (invoiceQuery.error && !invoiceQuery.data) return <QueryStatus query={invoiceQuery} />;

  return (
    <div className="space-y-6">
      <QueryStatus query={invoiceQuery} />
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-amber-600" />
            {t.sales.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t.sales.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setViewMode('INVOICES')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'INVOICES'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isRtl ? 'عرض حسب الفواتير' : 'Invoices View'}
            </button>
            <button
              onClick={() => setViewMode('LINES')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'LINES'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isRtl ? 'عرض حسب السطور التفصيلية' : 'Detailed Lines View'}
            </button>
          </div>

          <Link
            href="/sales/driver-gift"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-200 transition-all shadow-sm"
          >
            <Gift className="w-4 h-4 text-amber-600" />
            {isRtl ? 'تسليم هدية سائق عينية' : 'Driver Gift Issue'}
          </Link>

          <Link
            href="/sales/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            {t.sales.newInvoice}
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">{t.dashboard.kpiNetSales} · {text('هذه الصفحة', 'This page', 'Halaman ini')}</p>
            <p className="text-lg font-bold text-slate-900 mt-1 font-mono" dir="ltr">
              {totalSalesAmount.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">
              {text('المحصل — هذه الصفحة', 'Collected — this page', 'Diterima — halaman ini')}
            </p>
            <p className="text-lg font-bold text-emerald-600 mt-1 font-mono" dir="ltr">
              {totalCollected.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">{t.dashboard.kpiCustomerDebts} · {text('هذه الصفحة', 'This page', 'Halaman ini')}</p>
            <p className="text-lg font-bold text-rose-600 mt-1 font-mono" dir="ltr">
              {totalReceivable.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-400 absolute top-3 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t.common.search}
            value={searchTerm}
            onChange={(e) => { setPage(1); setSearchTerm(e.target.value); }}
            className={`w-full py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={selectedCustomer}
            onChange={(e) => { setPage(1); setSelectedCustomer(e.target.value); }}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 bg-white"
          >
            <option value="">{locale === 'ar' ? 'جميع العملاء' : 'All Customers'}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} | {tLocalizedName(c, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav aria-label={text('صفحات المبيعات', 'Sales pages', 'Halaman penjualan')} className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{text('الصفحة', 'Page', 'Halaman')} {page} · {text('حتى 100 فاتورة لكل صفحة', 'Up to 100 invoices per page', 'Hingga 100 faktur per halaman')}</span>
        <div className="flex gap-2">
          <button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">{text('السابق', 'Previous', 'Sebelumnya')}</button>
          <button disabled={invoices.length < 100 || loading} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">{text('التالي', 'Next', 'Berikutnya')}</button>
        </div>
      </nav>
      {loadError && <p role="alert" className="text-red-700">{t.common.errorOccurred} <button className="underline" onClick={() => void loadData()}>{text('إعادة المحاولة', 'Retry', 'Coba lagi')}</button></p>}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t.common.loading}</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t.common.noData}</div>
        ) : viewMode === 'INVOICES' ? (
          <div className="overflow-x-auto">
            <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t.sales.invoiceNo}</th>
                  <th className="p-3">{t.sales.invoiceDate}</th>
                  <th className="p-3">{t.sales.customer}</th>
                  <th className="p-3">{isRtl ? 'السطور' : 'Lines'}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.sales.grandTotal}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.common.paidAmount}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.sales.remainingOnCustomer}</th>
                  <th className="p-3 text-center">{t.debts.agingBucket}</th>
                  <th className="p-3 text-center">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isDriverGift = !inv.customerId && inv.lines?.some((l: any) => l.lineType === 'DRIVER_GIFT');
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-bold text-slate-900 font-mono" dir="ltr">
                        {tInvoiceKey(inv.invoiceKey)}
                      </td>
                      <td className="p-3 text-slate-600">
                        {new Date(inv.invoiceDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {isDriverGift ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold">
                            <Gift className="w-3.5 h-3.5" />
                            {locale === 'ar' ? 'هدية سائق:' : locale === 'id' ? 'Hadiah Supir:' : 'Driver Gift:'} {tLocalizedName(inv.lines?.[0]?.driver, locale) || (locale === 'ar' ? 'سائق' : locale === 'id' ? 'Supir' : 'Driver')}
                          </span>
                        ) : (
                          `${inv.customer?.code || ''} | ${tLocalizedName(inv.customer, locale) || (locale === 'ar' ? 'عميل نقدي' : locale === 'id' ? 'Pelanggan Tunai' : 'Cash Customer')}`
                        )}
                      </td>
                      <td className="p-3 text-slate-500">{inv.lines?.length || 0}</td>
                      <td className={`p-3 font-bold text-slate-900 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {inv.invoiceTotal?.toLocaleString()}
                      </td>
                      <td className={`p-3 text-emerald-600 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {inv.settlementAsOf?.toLocaleString()}
                      </td>
                      <td
                        className={`p-3 font-bold font-mono ${isRtl ? 'text-left' : 'text-right'} ${
                          inv.invoiceDebt > 0 ? 'text-rose-600' : 'text-slate-500'
                        }`}
                        dir="ltr"
                      >
                        {inv.signedAsOf?.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] border ${getAgingBadge(
                            inv.aging
                          )}`}
                        >
                          {tAging(inv.aging)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/sales/${inv.id}/print`}
                            target="_blank"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title={t.common.print}
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          <Link
                            href={`/sales/${inv.id}`}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title={t.common.viewDetails}
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {!isDriverGift && inv.invoiceDebt > 0 && (
                            <button
                              onClick={() => handleOpenCollection(inv)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[11px] font-bold transition-all"
                              title={t.debts.collectPayment}
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              {t.debts.collectPayment}
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenVoid(inv)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title={t.common.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Detailed Lines View */
          <div className="overflow-x-auto">
            <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{isRtl ? 'كود السطر' : 'Line Code'}</th>
                  <th className="p-3">{t.sales.invoiceNo}</th>
                  <th className="p-3">{t.common.date}</th>
                  <th className="p-3">{isRtl ? 'النوع' : 'Type'}</th>
                  <th className="p-3">{t.cash.party}</th>
                  <th className="p-3">{t.sales.item}</th>
                  <th className="p-3 text-center">{t.sales.qty}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.sales.sellingPrice}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.sales.lineDiscount}</th>
                  <th className={`p-3 font-bold ${isRtl ? 'text-left' : 'text-right'}`}>{t.sales.lineTotal}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.flatMap((inv) =>
                  inv.lines.map((line: any) => (
                    <tr key={line.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-mono text-amber-700 font-bold">{line.code}</td>
                      <td className="p-3 font-mono font-medium text-slate-800" dir="ltr">
                        {tInvoiceKey(inv.invoiceKey)}
                      </td>
                      <td className="p-3 text-slate-500">
                        {new Date(inv.invoiceDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="p-3">
                        {line.lineType === 'DRIVER_GIFT' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                            {isRtl ? 'هدية سائق' : 'Driver Gift'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                            {isRtl ? 'بيع' : 'Sale'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {line.lineType === 'DRIVER_GIFT' ? tLocalizedName(line.driver, locale) : tLocalizedName(inv.customer, locale)}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {tLocalizedName(line.item, locale)}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({tUnit(line.item?.unit?.name)})
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold" dir="ltr">
                        {Number(line.qty).toLocaleString()}
                      </td>
                      <td className={`p-3 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(line.unitPrice).toLocaleString()}
                      </td>
                      <td className={`p-3 font-mono text-slate-500 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(line.discount).toLocaleString()}
                      </td>
                      <td className={`p-3 font-mono font-bold text-slate-900 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(line.netSaleAmount).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Collection Modal */}
      {collectModalOpen && selectedInvoiceForCollect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCollectModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-200" />
                <h2 className="text-sm font-bold">{t.debts.collectPayment}</h2>
              </div>
              <button
                onClick={() => setCollectModalOpen(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitCollection} className="p-5 space-y-4">
              {collectError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{collectError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.sales.invoiceNo}:</span>
                  <span className="font-bold text-slate-800 font-mono" dir="ltr">
                    {tInvoiceKey(selectedInvoiceForCollect.invoiceKey)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.sales.customer}:</span>
                  <span className="font-bold text-slate-800">
                    {tLocalizedName(selectedInvoiceForCollect.customer, locale)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                  <span className="text-slate-500">{t.sales.remainingOnCustomer}:</span>
                  <span className="font-bold text-rose-600 font-mono" dir="ltr">
                    {selectedInvoiceForCollect.invoiceDebt?.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.common.paidAmount}
                </label>
                <MoneyInput
                  value={collectAmount}
                  onChange={(v) => setCollectAmount(Number(v) || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRtl ? 'حساب التحصيل' : 'Collection Account'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectAccount('CASH')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      collectAccount === 'CASH'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isRtl ? 'نقدي (الخزينة)' : 'Cash (Drawer)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectAccount('BANK')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      collectAccount === 'BANK'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isRtl ? 'تحويل (البنك)' : 'Bank Transfer'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.common.notes}</label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submittingCollect}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {submittingCollect ? t.common.saving : t.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => setCollectModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  {t.common.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidModalOpen && invoiceToVoid && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setVoidModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-200" />
                <h2 className="text-sm font-bold">
                  {isRtl ? 'إلغاء فاتورة بيع (Void)' : 'Void Sales Invoice'}
                </h2>
              </div>
              <button
                onClick={() => setVoidModalOpen(false)}
                className="text-rose-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitVoid} className="p-5 space-y-4">
              {voidError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{voidError}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                {isRtl ? 'هل أنت متأكد من إلغاء الفاتورة ' : 'Are you sure you want to void invoice '}
                <strong className="text-slate-900 font-mono" dir="ltr">
                  {tInvoiceKey(invoiceToVoid.invoiceKey)}
                </strong>
                ?
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.returns.reason} *
                </label>
                <textarea
                  required
                  rows={2}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.returns.reason}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={voiding}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {voiding ? t.common.saving : t.common.confirmDelete}
                </button>
                <button
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  {t.common.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
