'use client';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  CreditCard,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  ChevronLeft,
  ExternalLink,
  ShieldCheck,
  Building,
  UserCheck,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';

interface PartySummary {
  partyId: string;
  partyCode: string;
  partyName: string;
  partyNameEn?: string | null;
  supplierCategory?: string | null;
  supplierCategoryEn?: string | null;
  partyType: 'CLIENT' | 'SUPPLIER';
  totalInvoicedAsOf: number;
  totalSettledAsOf: number;
  partyDebtAsOf: number;
  partyCreditAsOf: number;
  partySignedAsOf: number;
  uncoveredAsOf: number;
  coverageAsOf: string;
  prepaymentAsOf: number;
  unallocatedAsOf: number;
  reconciliationAsOf: number;
}

interface InvoiceAgingItem {
  partyId: string;
  partyCode: string;
  partyName: string;
  partyNameEn?: string | null;
  supplierCategory?: string | null;
  supplierCategoryEn?: string | null;
  partyType: 'CLIENT' | 'SUPPLIER';
  invoiceKey: string;
  invoiceDate: string;
  dueDate: string;
  reportClass: string;
  originalAsOf: number;
  returnsAsOf: number;
  settlementAsOf: number;
  refundAsOf: number;
  signedAsOf: number;
  invoiceDebt: number;
  invoiceCredit: number;
  daysOverdue: number;
  aging: string;
}

export default function DebtsReportPage() {
  const { t, locale, isRtl, tPartyType, tAging, tInvoiceKey } = useI18n();

  const [partySummaries, setPartySummaries] = useState<PartySummary[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceAgingItem[]>([]);
  const [totalClientDebt, setTotalClientDebt] = useState(0);
  const [totalSupplierDebt, setTotalSupplierDebt] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('ALL'); // ALL | CLIENT | SUPPLIER
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL'); // ALL | DEBT | CREDIT | SETTLED
  const [searchQuery, setSearchQuery] = useState('');
  const [asOfDate, setAsOfDate] = useState(todayInStore());
  const [activeTab, setActiveTab] = useState<'PARTIES' | 'INVOICES'>('PARTIES');

  const loadDebtsData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedType !== 'ALL') params.set('type', selectedType);
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);
      params.set('asOfDate', asOfDate);

      const res = await fetch(`/api/debts?${params.toString()}`);
      const json = await res.json();
      if (json.partySummaries) {
        setPartySummaries(json.partySummaries);
      }
      if (json.invoiceItems) {
        setInvoiceItems(json.invoiceItems);
      }
      setTotalClientDebt(json.totalClientDebt || 0);
      setTotalSupplierDebt(json.totalSupplierDebt || 0);
    } catch (err) {
      console.error('Failed to load debts report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebtsData();
  }, [selectedType, selectedStatus, asOfDate]);

  // Client-side text filter
  const filteredParties = partySummaries.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.partyName.toLowerCase().includes(q) ||
      (p.partyNameEn && p.partyNameEn.toLowerCase().includes(q)) ||
      (p.supplierCategory && p.supplierCategory.toLowerCase().includes(q)) ||
      p.partyCode.toLowerCase().includes(q)
    );
  });

  const filteredInvoices = invoiceItems.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.partyName.toLowerCase().includes(q) ||
      (inv.partyNameEn && inv.partyNameEn.toLowerCase().includes(q)) ||
      (inv.supplierCategory && inv.supplierCategory.toLowerCase().includes(q)) ||
      inv.partyCode.toLowerCase().includes(q) ||
      inv.invoiceKey.toLowerCase().includes(q)
    );
  });

  const getAgingBadgeColor = (aging: string) => {
    switch (aging) {
      case 'جاري':
      case 'غير مستحق':
      case '0-30 يوم':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case '1–30':
      case '31-60 يوم':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case '31–60':
      case '61-90 يوم':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case '61–90':
      case 'أكثر من90':
      case '+90 يوم':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'مسدد':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-amber-800" />
            {t.debts.title}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t.debts.subtitle}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">{t.debts.totalClientDebt || 'إجمالي مستحق العملاء (لنا)'}</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {totalClientDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.common.currency || 'ر.س'}
            </div>
            <span className="text-xs text-gray-500 mt-0.5 block">{t.debts.clientsOnly || 'فواتير مبيعات آجلة ومستحقات لم تُحصّل'}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">{t.debts.totalSupplierDebt || 'إجمالي مستحق الموردين (علينا)'}</span>
            <div className="text-2xl font-black text-rose-700 mt-1">
              {totalSupplierDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.common.currency || 'ر.س'}
            </div>
            <span className="text-xs text-gray-500 mt-0.5 block">{t.debts.suppliersOnly || 'فواتير مشتريات آجلة والتزامات لم تُسدد'}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">{t.debts.netPosition || 'صافي الموقف المالي'}</span>
            <div
              className={`text-2xl font-black mt-1 ${
                totalClientDebt - totalSupplierDebt >= 0 ? 'text-indigo-700' : 'text-amber-700'
              }`}
            >
              {(totalClientDebt - totalSupplierDebt).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {t.common.currency || 'ر.س'}
            </div>
            <span className="text-xs text-gray-500 mt-0.5 block">
              {totalClientDebt >= totalSupplierDebt ? (t.debts.shopSurplus || 'فائض لصالح المحل') : (t.debts.shopDeficit || 'عجز والتزامات تفوق المستحقات')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.parties.type}</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="ALL">{t.debts.allTypesOption || 'الكل (عملاء وموردون)'}</option>
              <option value="CLIENT">{t.debts.clientsOnly || 'عملاء فقط'}</option>
              <option value="SUPPLIER">{t.debts.suppliersOnly || 'موردون فقط'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.common.status}</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-lg p-2.5 bg-gray-50 border focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="ALL">{t.debts.allStatuses || 'جميع الحالات'}</option>
              <option value="DEBT">{t.debts.statusDebtOnly || 'أرصدة مدينة (مستحق)'}</option>
              <option value="CREDIT">{t.debts.statusCreditOnly || 'أرصدة دائنة'}</option>
              <option value="SETTLED">{t.debts.statusSettled || 'مسدد بالكامل (صفر)'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.debts.asOfDate || 'حتى تاريخ'}</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-lg p-2 bg-gray-50 border focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.common.search}</label>
            <div className="relative">
              <input
                type="text"
                placeholder={t.debts.searchPlaceholder || 'اسم الطرف، الكود، أو رقم الفاتورة...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full text-sm border-gray-300 rounded-lg p-2.5 ${
                  isRtl ? 'pl-10 pr-3' : 'pr-10 pl-3'
                } bg-gray-50 border focus:ring-amber-500 focus:border-amber-500`}
              />
              <Search
                className={`w-4 h-4 text-gray-400 absolute top-3.5 ${isRtl ? 'left-3' : 'right-3'}`}
              />
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('PARTIES')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'PARTIES'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            {t.debts.partiesTab || 'ملخص الأطراف'} ({filteredParties.length})
          </button>
          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'INVOICES'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            {t.debts.invoicesTab || 'تفصيل الفواتير وأعمار الديون'} ({filteredInvoices.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-800" />
          {t.common.loading}
        </div>
      ) : activeTab === 'PARTIES' ? (
        /* Table 1: Parties Summary */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-amber-800" />
                {t.debts.partiesSummaryTitle || (locale === 'id' ? 'Ringkasan Saldo Pihak & Penutupan Faktur' : isRtl ? 'ملخص أرصدة الأطراف وحسابات الفواتير' : 'Parties Accounts & Invoices Summary')}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {locale === 'ar'
                  ? 'يعكس تلقائياً الرصيد الافتتاحي + كافة فواتير المشتريات والمبيعات الجديدة والدفعات المسددة لكل طرف'
                  : locale === 'id'
                  ? 'Secara otomatis menggabungkan saldo awal, faktur pembelian/penjualan baru, dan pembayaran per pihak'
                  : 'Aggregates opening balances, new purchase/sale invoices, and payments per party'}
              </p>
            </div>
            <span className="text-xs text-gray-500">
              {t.debts.clickForStatement || (locale === 'id' ? 'Klik nama pihak untuk membuka rekening koran terperinci' : 'اضغط على اسم أي طرف للانتقال المباشر إلى كشف الحساب التفصيلي')}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200 text-xs">
                <tr>
                  <th className="py-3 px-3">{t.debts.partyTypeCol || (locale === 'id' ? 'Jenis Pihak' : 'نوع الطرف')}</th>
                  <th className="py-3 px-3">{t.debts.partyCode}</th>
                  <th className="py-3 px-3">{t.debts.partyName}</th>
                  <th className="py-3 px-3">{t.parties.companyOrStore || (locale === 'id' ? 'Nama Perusahaan / Toko' : isRtl ? 'اسم المؤسسة / المتجر' : 'Company / Store Name')}</th>
                  <th className="py-3 px-3">{t.debts.totalInvoices}</th>
                  <th className="py-3 px-3">{t.debts.totalPayments}</th>
                  <th className="py-3 px-3">{t.debts.netBalance}</th>
                  <th className="py-3 px-3">{t.common.status}</th>
                  <th className="py-3 px-3 text-center">{t.debts.statementCol || (locale === 'id' ? 'Rekening Koran' : 'كشف الحساب')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredParties.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      {t.debts.noPartiesFound || 'لا توجد أطراف تطابق معايير البحث المحددة'}
                    </td>
                  </tr>
                ) : (
                  filteredParties.map((p) => (
                    <tr key={p.partyId} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            p.partyType === 'CLIENT'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {tPartyType(p.partyType)}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-gray-600">{p.partyCode}</td>
                      <td className="py-3 px-3 font-bold text-gray-900">
                        <Link
                          href={`/parties/${p.partyId}/statement`}
                          className="hover:text-amber-800 inline-flex items-center gap-1 group"
                        >
                          <span>{(locale === 'en' || locale === 'id') && p.partyNameEn ? p.partyNameEn : p.partyName}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-700 transition-opacity" />
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-gray-700 font-medium">
                        {(locale === 'en' || locale === 'id')
                          ? (p.supplierCategoryEn || p.supplierCategory || '—')
                          : (p.supplierCategory || p.supplierCategoryEn || '—')}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-gray-900">
                        {p.totalInvoicedAsOf > 0
                          ? p.totalInvoicedAsOf.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })
                          : '0'}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                        {p.totalSettledAsOf > 0
                          ? p.totalSettledAsOf.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })
                          : '0'}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        <span
                          className={
                            p.partySignedAsOf > 0
                              ? 'text-rose-700 text-sm'
                              : p.partySignedAsOf < 0
                              ? 'text-emerald-700 text-sm'
                              : 'text-gray-500'
                          }
                        >
                          {p.partySignedAsOf.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            p.partySignedAsOf === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.partySignedAsOf < 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.partySignedAsOf > 0
                            ? p.partyType === 'SUPPLIER'
                              ? (locale === 'ar' ? 'مستحق له' : locale === 'id' ? 'Hutang (Harus Dibayar)' : 'Payable')
                              : (locale === 'ar' ? 'مستحق عليه' : locale === 'id' ? 'Piutang (Harus Ditagih)' : 'Receivable')
                            : p.partySignedAsOf < 0
                            ? (locale === 'ar' ? 'رصيد دائن' : locale === 'id' ? 'Saldo Kredit' : 'Credit Balance')
                            : (locale === 'ar' ? 'متوازن (خالص)' : locale === 'id' ? 'Lunas' : 'Settled')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Link
                          href={`/parties/${p.partyId}/statement`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{locale === 'ar' ? 'كشف الحساب' : locale === 'id' ? 'Rekening Koran' : 'Statement'}</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Table 2: Invoices Aging Detail */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-amber-800" />
              {t.debts.invoicesAgingTitle || 'تفصيل الفواتير وأعمار الديون'}
            </h2>
            <span className="text-xs text-gray-500">
              {t.debts.quickActionHint || 'استخدم أزرار التحصيل أو السداد السريع لإنشاء سند قبض/صرف مباشر للفاتورة'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200 text-xs">
                <tr>
                  <th className="py-3 px-3">{t.cash.party}</th>
                  <th className="py-3 px-3">{t.sales.invoiceNo}</th>
                  <th className="py-3 px-3">{t.debts.invoiceDate || 'تاريخ الفاتورة'}</th>
                  <th className="py-3 px-3">{t.debts.dueDate || 'الاستحقاق'}</th>
                  <th className="py-3 px-3">{t.debts.originalValueCol || 'القيمة الأصلية'}</th>
                  <th className="py-3 px-3">{t.debts.returnsCol || 'المرتجع'}</th>
                  <th className="py-3 px-3">{t.debts.settledCol || 'المسدد/المحصل'}</th>
                  <th className="py-3 px-3">{t.debts.refundCol || 'رد نقدي'}</th>
                  <th className="py-3 px-3">{t.debts.signedBalance || 'الصافي'}</th>
                  <th className="py-3 px-3">{t.debts.invoicesDueCol || 'مستحق'}</th>
                  <th className="py-3 px-3">{t.debts.creditDueCol || 'رصيد دائن'}</th>
                  <th className="py-3 px-3">{t.debts.delayDaysCol || 'التأخير (أيام)'}</th>
                  <th className="py-3 px-3">{t.debts.agingClassCol || 'فئة العمر'}</th>
                  <th className="py-3 px-3 text-center">{t.debts.quickActionCol || 'إجراء سريع'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-8 text-center text-gray-500 text-sm">
                      {t.common.noData}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv, idx) => (
                    <tr key={`${inv.partyId}-${inv.invoiceKey}-${idx}`} className="hover:bg-amber-50/40 transition">
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/parties/${inv.partyId}/statement`}
                          className="font-bold text-gray-900 hover:text-amber-800"
                        >
                          {(locale === 'en' || locale === 'id') && inv.partyNameEn ? inv.partyNameEn : inv.partyName}
                        </Link>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                          <span>{inv.partyCode}</span>
                          {(inv.supplierCategory || inv.supplierCategoryEn) && (
                            <>
                              <span>•</span>
                              <span className="text-amber-800 font-medium">
                                {(locale === 'en' || locale === 'id')
                                  ? (inv.supplierCategoryEn || inv.supplierCategory)
                                  : (inv.supplierCategory || inv.supplierCategoryEn)}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-medium text-gray-900">{tInvoiceKey(inv.invoiceKey)}</td>
                      <td className="py-2.5 px-3 text-gray-600">{inv.invoiceDate}</td>
                      <td className="py-2.5 px-3 text-gray-600">{inv.dueDate}</td>
                      <td className="py-2.5 px-3 font-mono">
                        {inv.originalAsOf.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-rose-600">
                        {inv.returnsAsOf > 0
                          ? inv.returnsAsOf.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-600">
                        {inv.settlementAsOf > 0
                          ? inv.settlementAsOf.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-600">
                        {inv.refundAsOf > 0
                          ? inv.refundAsOf.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                        {inv.signedAsOf.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        {inv.invoiceDebt > 0
                          ? inv.invoiceDebt.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-700">
                        {inv.invoiceCredit > 0
                          ? inv.invoiceCredit.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center">
                        <span className={inv.daysOverdue > 0 ? 'text-red-700 font-bold' : 'text-gray-500'}>
                          {inv.daysOverdue > 0 ? `${inv.daysOverdue} ${t.debts.dayUnit || 'يوم'}` : (t.debts.noDelay || 'لا يوجد')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${getAgingBadgeColor(
                            inv.aging
                          )}`}
                        >
                          {tAging(inv.aging)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {inv.invoiceDebt > 0 && inv.partyType === 'CLIENT' && (
                          <Link
                            href={`/cash?type=CUSTOMER_COLLECTION&partyId=${inv.partyId}&invoiceKey=${inv.invoiceKey}&amount=${inv.invoiceDebt}`}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium transition"
                          >
                            <DollarSign className="w-3 h-3" />
                            {t.debts.collectNow || 'تحصيل الآن'}
                          </Link>
                        )}
                        {inv.invoiceDebt > 0 && inv.partyType === 'SUPPLIER' && (
                          <Link
                            href={`/cash?type=SUPPLIER_PAYMENT&partyId=${inv.partyId}&invoiceKey=${inv.invoiceKey}&amount=${inv.invoiceDebt}`}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 font-medium transition"
                          >
                            <DollarSign className="w-3 h-3" />
                            {t.debts.payNow || 'سداد الآن'}
                          </Link>
                        )}
                        {inv.invoiceDebt === 0 && (
                          <span className="text-[11px] text-gray-400">{t.debts.fullySettledBadge || 'مسدد بالكامل'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
