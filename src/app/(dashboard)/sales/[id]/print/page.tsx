'use client';
import { useParams } from 'next/navigation';

import React, { useState, useEffect, useContext } from 'react';
import { formatInvoiceNumber, toDecimal } from '@/domain/decimal';
import { StoreCurrencyContext } from '@/i18n/interface-text';
import Link from 'next/link';
import {
  Printer,
  Share2,
  ArrowRight,
  ArrowLeft,
  FileText,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

export default function SalePrintPage() {
  const params = useParams<{ id: string }>();
  const { t, locale, isRtl, dir, tUnit, tInvoiceKey, tLocalizedName, tAging } = useI18n();
  const currency = useContext(StoreCurrencyContext);
  const formatNumber = (value: Parameters<typeof formatInvoiceNumber>[0]) => formatInvoiceNumber(value, locale);
  const returnCreditLabel = locale === 'ar' ? 'إشعارات المرتجع' : locale === 'id' ? 'Nota retur' : 'Return credits';
  const netInvoiceLabel = locale === 'ar' ? 'صافي الفاتورة بعد المرتجعات' : locale === 'id' ? 'Faktur bersih setelah retur' : 'Net invoice after returns';
  const refundLabel = locale === 'ar' ? 'المبالغ المعادة' : locale === 'id' ? 'Dana dikembalikan' : 'Refunds';
  const [invoice, setInvoice] = useState<any>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [paperFormat, setPaperFormat] = useState<'THERMAL' | 'A4'>('THERMAL');

  useEffect(() => {
    async function loadData() {
      try {
        const [res, sRes] = await Promise.all([
          fetch(`/api/sales/${params.id}`),
          fetch('/api/settings/branding'),
        ]);
        const data = await res.json();
        const sData = await sRes.json();
        if (res.ok) setInvoice(data);
        if (sRes.ok && sData.data?.storeName) setStoreName(sData.data.storeName);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        {t.common.loading}
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center text-rose-500 text-sm">
        {t.common.noData}
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const getWhatsAppShareUrl = () => {
    const linesText = invoice.lines
      ?.map(
        (l: any, i: number) =>
          `${i + 1}. ${tLocalizedName(l.item, locale)} (${formatNumber(l.qty)} ${tUnit(l.item?.unit?.name)}) = ${formatNumber(l.netSaleAmount)} ${currency}`
      )
      .join('\n');

    const message = `*${t.print.taxInvoiceTitle} - ${storeName || t.meta.brandTitle}*
${t.print.invoiceNumber} ${tInvoiceKey(invoice.invoiceKey)}
${t.print.date} ${new Date(invoice.invoiceDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'id' ? 'id-ID' : 'en-US')}
${t.print.customerName} ${tLocalizedName(invoice.customer, locale) || (locale === 'ar' ? 'عميل نقدي' : locale === 'id' ? 'Pelanggan Tunai' : 'Cash Customer')}
---------------------------------
${linesText}
---------------------------------
${t.print.subtotal} ${formatNumber(invoice.invoiceTotal)} ${currency}
${returnCreditLabel} ${formatNumber(invoice.returnsAsOf)} ${currency}
${netInvoiceLabel} ${formatNumber(toDecimal(invoice.invoiceTotal).minus(toDecimal(invoice.returnsAsOf)))} ${currency}
${t.print.paid} ${formatNumber(invoice.settlementAsOf)} ${currency}
${refundLabel} ${formatNumber(invoice.refundAsOf)} ${currency}
${t.print.remainingBalance} ${formatNumber(invoice.signedAsOf)} ${currency}
${t.print.thankYouMessage}`;

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0" dir={dir}>
      <style media="print">{paperFormat === 'A4' ? '@page { size: A4; margin: 12mm; }' : '@page { margin: 3mm; }'}</style>
      {/* Control Action Bar - Hidden when printing */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 print:hidden">
        <Link
          href={`/sales/${params.id}`}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-bold"
        >
          <BackArrow className="w-4 h-4" />
          {t.common.back}
        </Link>

        {/* Language Switcher for Print Language */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            {t.print.switchPrintLang}
          </span>
          <LanguageSwitcher compact />
        </div>

        {/* Format Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setPaperFormat('THERMAL')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
              paperFormat === 'THERMAL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            {isRtl ? 'إيصال حراري (80mm)' : 'Thermal (80mm)'}
          </button>
          <button
            type="button"
            onClick={() => setPaperFormat('A4')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
              paperFormat === 'A4'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {isRtl ? 'فاتورة رسمية (A4 / A5)' : 'Formal Invoice (A4 / A5)'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={getWhatsAppShareUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp
          </a>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            {t.print.printNow}
          </button>
        </div>
      </div>

      {/* Printable Body */}
      {paperFormat === 'THERMAL' ? (
        /* 80mm Thermal Receipt Layout */
        <div className="max-w-[340px] mx-auto bg-white p-5 rounded-2xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 font-mono text-slate-900 text-xs">
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <h1 className="text-base font-black tracking-wide text-slate-900 flex items-center justify-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-600" />
              {storeName || t.meta.brandTitle}
            </h1>
            <p className="text-xs font-bold" dir="ltr">{currency}</p>
            <p className="text-[11px] text-slate-500 font-sans">{t.meta.brandSubtitle}</p>
          </div>

          <div className="py-2.5 space-y-1 border-b border-dashed border-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">{t.print.invoiceNumber}</span>
              <span className="font-bold font-mono" dir="ltr">{tInvoiceKey(invoice.invoiceKey)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">{t.print.date}</span>
              <span>{new Date(invoice.invoiceDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">{t.print.customerName}</span>
              <span className="font-bold font-sans">{tLocalizedName(invoice.customer, locale) || (locale === 'ar' ? 'عميل نقدي' : locale === 'id' ? 'Pelanggan Tunai' : 'Cash Customer')}</span>
            </div>
          </div>

          {/* Items */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400 font-bold border-b border-slate-100 pb-1">
              <span>{t.print.itemDescription}</span>
              <span>{t.print.total}</span>
            </div>
            {invoice.lines?.map((line: any) => (
              <div key={line.id} className="text-xs space-y-0.5">
                <div className="flex justify-between font-bold">
                  <span className="font-sans">{tLocalizedName(line.item, locale)}</span>
                  <span dir="ltr">{formatNumber(line.netSaleAmount)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>
                    {formatNumber(line.qty)} {tUnit(line.item?.unit?.name)} × {formatNumber(line.unitPrice)}
                  </span>
                  {Number(line.discount) > 0 && (
                    <span className="text-emerald-600 font-sans">
                      {t.print.discount} {formatNumber(line.discount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="py-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">{t.print.subtotal}</span>
              <span className="font-bold" dir="ltr">{formatNumber(invoice.invoiceTotal)}</span>
            </div>
            {Number(invoice.returnsAsOf) > 0 && <>
              <div className="flex justify-between"><span>{returnCreditLabel}</span><span dir="ltr">{formatNumber(invoice.returnsAsOf)}</span></div>
              <div className="flex justify-between font-bold"><span>{netInvoiceLabel}</span><span dir="ltr">{formatNumber(toDecimal(invoice.invoiceTotal).minus(toDecimal(invoice.returnsAsOf)))}</span></div>
            </>}
            <div className="flex justify-between text-emerald-700">
              <span className="font-sans">{t.print.paid}</span>
              <span className="font-bold" dir="ltr">{formatNumber(invoice.settlementAsOf)}</span>
            </div>
            {Number(invoice.refundAsOf) > 0 && <div className="flex justify-between"><span>{refundLabel}</span><span dir="ltr">{formatNumber(invoice.refundAsOf)}</span></div>}
            <div className="flex justify-between text-rose-700 font-bold text-sm border-t border-slate-200 pt-1">
              <span className="font-sans">{t.print.remainingBalance}</span>
              <span dir="ltr">{formatNumber(invoice.signedAsOf)}</span>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-500 font-sans space-y-1">
            <p>{t.print.thankYouMessage}</p>
          </div>
        </div>
      ) : (
        /* Formal A4 / A5 Document Layout */
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 text-slate-900 text-xs">
          {/* Header */}
          <div className="flex justify-between items-start pb-6 border-b-2 border-slate-900">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-wide flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-600" />
                {storeName || t.meta.brandTitle}
              </h1>
              <p className="text-xs font-bold" dir="ltr">{currency}</p>
              <p className="text-xs text-slate-500 mt-1">{t.meta.brandSubtitle}</p>
              <p className="text-xs font-bold text-amber-900 mt-0.5">{t.print.taxInvoiceTitle}</p>
            </div>

            <div className={`font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
              <p className="text-base font-bold text-slate-900">{tInvoiceKey(invoice.invoiceKey)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(invoice.invoiceDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
              </p>
            </div>
          </div>

          {/* Client Details */}
          <div className="py-4 my-4 bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
            <div>
              <p className="text-slate-400">{t.print.customerName}</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {tLocalizedName(invoice.customer, locale) || (locale === 'ar' ? 'عميل نقدي مكرّم' : locale === 'id' ? 'Pelanggan Tunai' : 'Cash Customer')}
              </p>
              {invoice.customer?.phone && (
                <p className="text-slate-500 mt-0.5" dir="ltr">
                  {t.print.phone} {invoice.customer.phone}
                </p>
              )}
            </div>

            <div className={`font-mono ${isRtl ? 'text-left' : 'text-right'}`}>
              <p className="text-slate-400 text-[11px]">{t.common.status}:</p>
              <span className="font-bold text-emerald-700 font-sans">
                {toDecimal(invoice.signedAsOf).lte(0) ? (toDecimal(invoice.signedAsOf).lt(0) ? tAging('رصيد دائن') : t.sales.fullyPaid) : toDecimal(invoice.settlementAsOf).minus(toDecimal(invoice.refundAsOf)).gt(0) ? t.sales.partiallyPaid : t.sales.unpaidCredit}
              </span>
            </div>
          </div>

          {/* Table */}
          <table className={`w-full text-xs my-4 border-collapse ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="p-3 w-8 text-center">#</th>
                <th className="p-3">{t.print.itemDescription}</th>
                <th className="p-3 text-center">{t.print.qty}</th>
                <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.print.unitPrice}</th>
                <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.print.discount}</th>
                <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.print.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-b border-slate-200">
              {invoice.lines?.map((line: any, idx: number) => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-900">
                    {tLocalizedName(line.item, locale)}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({tUnit(line.item?.unit?.name)})
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold" dir="ltr">
                    {formatNumber(line.qty)}
                  </td>
                  <td className={`p-3 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    {formatNumber(line.unitPrice)}
                  </td>
                  <td className={`p-3 font-mono text-slate-500 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    {formatNumber(line.discount)}
                  </td>
                  <td className={`p-3 font-mono font-bold text-slate-900 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    {formatNumber(line.netSaleAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div className="flex justify-end pt-4">
            <div className="w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{t.print.subtotal}</span>
                <span className="font-bold font-mono" dir="ltr">
                  {formatNumber(invoice.invoiceTotal)}
                </span>
              </div>
              {Number(invoice.returnsAsOf) > 0 && <>
                <div className="flex justify-between"><span>{returnCreditLabel}</span><span dir="ltr">{formatNumber(invoice.returnsAsOf)}</span></div>
                <div className="flex justify-between font-bold"><span>{netInvoiceLabel}</span><span dir="ltr">{formatNumber(toDecimal(invoice.invoiceTotal).minus(toDecimal(invoice.returnsAsOf)))}</span></div>
              </>}
              <div className="flex justify-between text-emerald-700">
                <span>{t.print.paid}</span>
                <span className="font-bold font-mono" dir="ltr">
                  {formatNumber(invoice.settlementAsOf)}
                </span>
              </div>
              {Number(invoice.refundAsOf) > 0 && <div className="flex justify-between"><span>{refundLabel}</span><span dir="ltr">{formatNumber(invoice.refundAsOf)}</span></div>}
              <div className="flex justify-between text-rose-700 font-bold text-sm border-t-2 border-slate-900 pt-2">
                <span>{t.print.remainingBalance}</span>
                <span className="font-mono" dir="ltr">
                  {formatNumber(invoice.signedAsOf)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between text-[11px] text-slate-500">
            <div>
              <p>{t.print.signatureReceiver}: ___________________</p>
            </div>
            <div>
              <p>{t.print.signatureSeller}: ___________________</p>
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] text-slate-400 border-t pt-3">
            <p>{t.print.thankYouMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
