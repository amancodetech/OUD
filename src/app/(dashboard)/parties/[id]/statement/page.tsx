'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FileText,
  Printer,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  Building,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Locale } from '@/i18n/types';

interface PartyInfo {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  type: 'CLIENT' | 'SUPPLIER';
  phone: string | null;
  address: string | null;
  country: string | null;
}

interface StatementLine {
  id: string;
  date: string;
  type: string;
  docCode: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

function translateMovementType(type: string, locale: Locale): string {
  const map: Record<string, { ar: string; id: string; en: string }> = {
    'رصيد أول المدة': { ar: 'رصيد أول المدة', id: 'Saldo Awal Periode', en: 'Opening Balance' },
    'فاتورة بيع': { ar: 'فاتورة بيع', id: 'Faktur Penjualan', en: 'Sales Invoice' },
    'فاتورة شراء': { ar: 'فاتورة شراء', id: 'Faktur Pembelian', en: 'Purchase Invoice' },
    'إشعار مرتجع بيع': { ar: 'إشعار مرتجع بيع', id: 'Retur Penjualan', en: 'Sales Return Note' },
    'إشعار مرتجع شراء': { ar: 'إشعار مرتجع شراء', id: 'Retur Pembelian', en: 'Purchase Return Note' },
    'سداد نقدي / تحصيل': { ar: 'سداد نقدي / تحصيل', id: 'Penerimaan Kas / Pelunasan', en: 'Cash Collection / Receipt' },
    'رد مبلغ للعميل': { ar: 'رد مبلغ للعميل', id: 'Pengembalian Dana Pelanggan', en: 'Refund to Customer' },
    'سداد دفعة للمورد': { ar: 'سداد دفعة للمورد', id: 'Pembayaran ke Supplier', en: 'Payment to Supplier' },
    'استرداد نقدي من المورد': { ar: 'استرداد نقدي من المورد', id: 'Pengembalian Kas dari Supplier', en: 'Refund from Supplier' },
  };
  return map[type]?.[locale] || type;
}

export default function PartyStatementPage() {
  const { t, locale, isRtl, tInvoiceKey, tLocalizedName } = useI18n();
  const params = useParams();
  const partyId = params.id as string;

  const [party, setParty] = useState<PartyInfo | null>(null);
  const [statementLines, setStatementLines] = useState<StatementLine[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [finalBalance, setFinalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatement = async (start?: string, end?: string) => {
    try {
      setLoading(true);
      setError(null);
      const urlParams = new URLSearchParams();
      if (start) urlParams.set('startDate', start);
      if (end) urlParams.set('endDate', end);

      const res = await fetch(`/api/parties/${partyId}/statement?${urlParams.toString()}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'تعذر تحميل كشف الحساب');
      }
      const data = await res.json();
      setParty(data.party);
      setStatementLines(data.statementLines);
      setStartDate(data.startDate);
      setEndDate(data.endDate);
      setTotalDebit(data.totalDebit);
      setTotalCredit(data.totalCredit);
      setFinalBalance(data.finalBalance);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل كشف الحساب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (partyId) {
      fetchStatement();
    }
  }, [partyId]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatement(startDate, endDate);
  };

  const getBalanceDescription = () => {
    if (!party) return '';
    if (finalBalance === 0) return t.statement?.fullySettled || 'الحساب خالص ومسدد بالكامل';
    if (party.type === 'CLIENT') {
      return finalBalance > 0
        ? (t.statement?.clientDebitDue || 'رصيد مدين (مستحق على العميل لصالح المحل)')
        : (t.statement?.clientCreditAdvance || 'رصيد دائن (دفعة مقدمة لصالح العميل)');
    } else {
      return finalBalance > 0
        ? (t.statement?.supplierCreditDue || 'رصيد دائن (مستحق للمورد على المحل)')
        : (t.statement?.supplierDebitAdvance || 'رصيد مدين (دفعة مقدمة من المحل للمورد)');
    }
  };

  const formattedIssueDate = new Date().toLocaleDateString(
    locale === 'ar' ? 'ar-SA' : locale === 'id' ? 'id-ID' : 'en-US'
  );
  const formattedPrintTime = new Date().toLocaleTimeString(
    locale === 'ar' ? 'ar-SA' : locale === 'id' ? 'id-ID' : 'en-US'
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/debts"
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            title={t.statement?.backToDebts || 'العودة لتقرير المديونية'}
          >
            {isRtl ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-amber-800" />
              {t.statement?.title || 'كشف حساب تفصيلي:'} {party?.name || (t.common.loading)}
            </h1>
            <p className="text-xs text-gray-500">
              {t.statement?.subtitle || 'حركات متسلسلة زمنياً مع حساب الرصيد التراكمي المعتمد'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            {t.statement?.printStatement || 'طباعة كشف الحساب'}
          </button>
        </div>
      </div>

      {/* Date Filter Bar (Hidden when printing) */}
      <div className="print:hidden bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.statement?.fromDate || 'من تاريخ'}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border-gray-300 rounded-lg p-2 bg-gray-50 border focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.statement?.toDate || 'إلى تاريخ'}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border-gray-300 rounded-lg p-2 bg-gray-50 border focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium transition"
          >
            {t.statement?.showStatement || 'تحديث الكشف'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-800" />
          {t.common.loading}
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-200">
          {error}
        </div>
      ) : (
        /* Printable Document Container */
        <div className="bg-white p-6 sm:p-8 rounded-xl border border-gray-200 shadow-sm print:border-none print:shadow-none print:p-0">
          {/* Print Header */}
          <div className="border-b border-gray-300 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-amber-950">{t.statement?.shopName || 'محل قصر العود والعطور'}</h2>
                <p className="text-xs text-gray-600 mt-1">{t.statement?.certifiedStatement || 'كشف حساب طرف تجاري معتمد'}</p>
                <div className="text-xs text-gray-500 mt-1">
                  {t.statement?.periodFrom || 'الفترة من:'} <span className="font-semibold text-gray-800">{startDate}</span> {t.statement?.periodTo || 'إلى:'}{' '}
                  <span className="font-semibold text-gray-800">{endDate}</span>
                </div>
              </div>
              <div className={`${isRtl ? 'text-left' : 'text-right'} text-xs text-gray-500`}>
                <div>{t.statement?.issueDate || 'تاريخ الإصدار:'} {formattedIssueDate}</div>
                <div>{t.statement?.printTime || 'وقت الطباعة:'} {formattedPrintTime}</div>
              </div>
            </div>

            {/* Party Profile Card */}
            {party && (
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block">{t.statement?.partyNameLabel || 'اسم الطرف:'}</span>
                  <span className="font-bold text-gray-900 text-sm">{tLocalizedName(party, locale)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t.statement?.partyCodeLabel || 'كود الطرف:'}</span>
                  <span className="font-mono font-semibold text-gray-800">{party.code}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t.statement?.accountTypeLabel || 'نوع الحساب:'}</span>
                  <span
                    className={`inline-block font-semibold mt-0.5 px-2 py-0.5 rounded text-[11px] ${
                      party.type === 'CLIENT'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {party.type === 'CLIENT'
                      ? (t.statement?.clientTypeDesc || 'عميل تجزئة / جملة')
                      : (t.statement?.supplierTypeDesc || 'مورد')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t.statement?.phoneCityLabel || 'الهاتف والمدينة:'}</span>
                  <span className="text-gray-800 font-medium">
                    {party.phone || '—'} {party.country ? `(${party.country})` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <span className="text-xs text-gray-500 font-semibold block">{t.statement?.totalDebit || 'إجمالي الحركات المدينة (+)'}</span>
              <div className="text-lg font-black text-emerald-700 mt-1">
                {totalDebit.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {t.common.currency || 'ر.س'}
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <span className="text-xs text-gray-500 font-semibold block">{t.statement?.totalCredit || 'إجمالي الحركات الدائنة (-)'}</span>
              <div className="text-lg font-black text-rose-700 mt-1">
                {totalCredit.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {t.common.currency || 'ر.س'}
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
              <span className="text-xs text-amber-800 font-bold block">{t.statement?.netBalance || 'الرصيد النهائي المستحق'}</span>
              <div
                className={`text-xl font-black mt-1 ${
                  finalBalance > 0 ? 'text-amber-950' : finalBalance < 0 ? 'text-blue-900' : 'text-gray-700'
                }`}
              >
                {finalBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {t.common.currency || 'ر.س'}
              </div>
              <span className="text-[10px] text-amber-900 font-medium block mt-0.5">
                {getBalanceDescription()}
              </span>
            </div>
          </div>

          {/* Statement Lines Table */}
          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-xs border border-gray-200`}>
              <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
                <tr>
                  <th className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200`}>{t.statement?.date || 'التاريخ'}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200`}>{t.statement?.type || 'نوع الحركة'}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200`}>{t.statement?.docNo || 'رقم المستند'}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200`}>{t.statement?.description || 'البيان / التفاصيل'}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 ${isRtl ? 'text-left' : 'text-right'}`}>{t.statement?.debit || 'مدين (+)'}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 ${isRtl ? 'text-left' : 'text-right'}`}>{t.statement?.credit || 'دائن (-)'}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.statement?.runningBalanceCol || t.statement?.runningBalance || 'الرصيد التراكمي'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {statementLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500 font-sans text-sm">
                      {t.common.noData}
                    </td>
                  </tr>
                ) : (
                  statementLines.map((line, idx) => (
                    <tr
                      key={line.id || idx}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                    >
                      <td className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 font-sans text-gray-700`}>
                        {line.date}
                      </td>
                      <td className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 font-sans font-medium text-gray-900`}>
                        {translateMovementType(line.type, locale)}
                      </td>
                      <td className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 text-gray-800`}>
                        {tInvoiceKey(line.docCode)}
                      </td>
                      <td className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 font-sans text-gray-600 max-w-xs truncate`}>
                        {line.description}
                      </td>
                      <td className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 ${isRtl ? 'text-left' : 'text-right'} text-emerald-700 font-semibold`}>
                        {line.debit > 0
                          ? line.debit.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td className={`py-2.5 px-3 ${isRtl ? 'border-l' : 'border-r'} border-gray-200 ${isRtl ? 'text-left' : 'text-right'} text-rose-700 font-semibold`}>
                        {line.credit > 0
                          ? line.credit.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'} font-bold text-gray-900 bg-gray-50/80`}>
                        {line.runningBalance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 font-mono text-gray-900">
                <tr>
                  <td colSpan={4} className={`py-2.5 px-3 font-sans ${isRtl ? 'text-right' : 'text-left'}`}>
                    {t.statement?.totalsAndClosingBalance || 'الإجماليات ورصيد الإقفال:'}
                  </td>
                  <td className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'} text-emerald-800`}>
                    {totalDebit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'} text-rose-800`}>
                    {totalCredit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'} text-amber-950 font-black`}>
                    {finalBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signatures Footer (Visible in print) */}
          <div className="mt-12 pt-6 border-t border-gray-300 grid grid-cols-3 gap-6 text-center text-xs text-gray-600">
            <div>
              <span className="block font-semibold mb-8">{t.statement?.accountantPrep || 'إعداد المحاسب'}</span>
              <div className="border-t border-dashed border-gray-400 pt-2 w-36 mx-auto">{t.statement?.signaturePlaceholder || 'التوقيع'}</div>
            </div>
            <div>
              <span className="block font-semibold mb-8">{t.statement?.managementApproval || 'اعتماد الإدارة'}</span>
              <div className="border-t border-dashed border-gray-400 pt-2 w-36 mx-auto">{t.statement?.stampSignaturePlaceholder || 'الختم / التوقيع'}</div>
            </div>
            <div>
              <span className="block font-semibold mb-8">{t.statement?.secondPartyConfirm || 'مصادقة الطرف الثاني'}</span>
              <div className="border-t border-dashed border-gray-400 pt-2 w-36 mx-auto">{t.statement?.signatureDatePlaceholder || 'التوقيع / التاريخ'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
