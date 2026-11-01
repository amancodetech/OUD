'use client';
import { QueryStatus } from '@/components/data/QueryStatus';
import { useApiQuery } from '@/lib/use-api-query';
import { apiFetch } from '@/lib/client-api';
import { useParams } from 'next/navigation';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart,
  ArrowRight,
  Printer,
  DollarSign,
  RotateCcw,
  Trash2,
  AlertCircle,
  X,
  Layers,
  Gift,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const query = useApiQuery<any>(`/api/sales/${params.id}`);
  const invoice = query.data;
  const loading = query.isLoading;

  // Collection modal state
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectAccount, setCollectAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [collectNotes, setCollectNotes] = useState('');
  const [submittingCollect, setSubmittingCollect] = useState(false);
  const [collectError, setCollectError] = useState('');

  // Void modal state
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const loadInvoice = () => query.mutate();

  const submitCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectAmount || collectAmount <= 0) {
      setCollectError('يرجى إدخال مبلغ تحصيل صحيح');
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
          partyId: invoice.customerId,
          invoiceKey: invoice.invoiceKey,
          description: collectNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل التحصيل');

      setCollectModalOpen(false);
      await loadInvoice();
    } catch (err: any) {
      setCollectError(err.message);
    } finally {
      setSubmittingCollect(false);
    }
  };

  const submitVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason || voidReason.trim().length < 3) {
      setVoidError('يرجى كتابة سبب الإلغاء (3 أحرف على الأقل)');
      return;
    }

    setVoiding(true);
    setVoidError('');
    try {
      const res = await apiFetch(`/api/sales/${params.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إلغاء الفاتورة');

      setVoidModalOpen(false);
      router.push('/sales');
    } catch (err: any) {
      setVoidError(err.message);
    } finally {
      setVoiding(false);
    }
  };

  if (query.error && !invoice) return <QueryStatus query={query} />;
  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        جاري تحميل تفاصيل الفاتورة...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center text-rose-500 text-sm">
        لم يتم العثور على فاتورة البيع المطلوبة.
      </div>
    );
  }

  const isDriverGift = !invoice.customerId && invoice.lines?.some((l: any) => l.lineType === 'DRIVER_GIFT');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <QueryStatus query={query} />
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/sales"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 font-mono" dir="ltr">
                {invoice.invoiceKey}
              </h1>
              {invoice.status === 'VOID' ? (
                <span className="px-2 py-0.5 rounded-full text-xs bg-rose-100 text-rose-700 font-bold">
                  ملغاة (VOID)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 font-bold">
                  معتمدة (POSTED)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDriverGift ? (
                <span>هدية سائق عينية: <strong>{invoice.lines?.[0]?.driver?.name}</strong></span>
              ) : (
                <span>العميل: <strong>{invoice.customer?.name}</strong></span>
              )}{' '}
              | التاريخ: {new Date(invoice.invoiceDate).toLocaleDateString('ar-EG')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/sales/${invoice.id}/print`}
            target="_blank"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            طباعة الفاتورة
          </Link>

          {invoice.status !== 'VOID' && (
            <>
              {!isDriverGift && invoice.invoiceDebt > 0 && (
                <button
                  type="button"
                  onClick={() => { setCollectAmount(invoice.invoiceDebt > 0 ? invoice.invoiceDebt : 0); setCollectNotes(`تحصيل دفعة من فاتورة ${invoice.invoiceKey}`); setCollectModalOpen(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <DollarSign className="w-4 h-4" />
                  تحصيل دفعة
                </button>
              )}

              <button
                type="button"
                onClick={() => setVoidModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 className="w-4 h-4" />
                إلغاء الفاتورة
              </button>
            </>
          )}
        </div>
      </div>

      {/* Financial Summary Cards */}
      {!isDriverGift && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">إجمالي الفاتورة</p>
            <p className="text-lg font-bold text-slate-900 mt-1 font-mono" dir="ltr">
              {invoice.originalAsOf?.toLocaleString()} IDR
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">المرتجعات</p>
            <p className="text-lg font-bold text-amber-600 mt-1 font-mono" dir="ltr">
              {invoice.returnsAsOf?.toLocaleString()} IDR
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">إجمالي المحصل</p>
            <p className="text-lg font-bold text-emerald-600 mt-1 font-mono" dir="ltr">
              {invoice.settlementAsOf?.toLocaleString()} IDR
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">المتبقي على العميل</p>
            <p
              className={`text-lg font-bold mt-1 font-mono ${
                invoice.invoiceDebt > 0 ? 'text-rose-600' : 'text-slate-700'
              }`}
              dir="ltr"
            >
              {invoice.signedAsOf?.toLocaleString()} IDR
            </p>
          </div>
        </div>
      )}

      {/* Lines Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            سطور الأصناف المباعة
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">كود السطر</th>
                <th className="p-3">الصنف</th>
                <th className="p-3">النوع</th>
                <th className="p-3 text-center">الكمية</th>
                <th className="p-3 text-left">سعر الوحدة</th>
                <th className="p-3 text-left">الخصم</th>
                <th className="p-3 text-left font-bold">صافي البيع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lines?.map((line: any) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-mono text-amber-700 font-bold">{line.code}</td>
                  <td className="p-3 font-bold text-slate-900">
                    {line.item?.name}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({line.item?.unit?.name})
                    </span>
                  </td>
                  <td className="p-3">
                    {line.lineType === 'DRIVER_GIFT' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                        هدية سائق ({line.driver?.name})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                        بيع عادي
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center font-mono font-bold" dir="ltr">
                    {Number(line.qty).toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono" dir="ltr">
                    {Number(line.unitPrice).toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono text-slate-500" dir="ltr">
                    {Number(line.discount).toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-slate-900" dir="ltr">
                    {Number(line.netSaleAmount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Related Collections & Returns */}
      {!isDriverGift && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Collections */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              سندات التحصيل المسجلة
            </h2>
            {invoice.collections?.length === 0 ? (
              <p className="text-xs text-slate-400">لم يتم تسجيل أي تحصيل حتى الآن.</p>
            ) : (
              <div className="space-y-2">
                {invoice.collections?.map((col: any) => (
                  <div
                    key={col.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-800">{col.code}</span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="text-slate-600">
                        {new Date(col.txDate).toLocaleDateString('ar-EG')}
                      </span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="text-slate-500">
                        {col.account === 'CASH' ? 'خزينة' : 'بنك'}
                      </span>
                    </div>
                    <span className="font-bold font-mono text-emerald-600" dir="ltr">
                      {Number(col.amount).toLocaleString()} IDR
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Returns */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-600" />
              مرتجعات المبيعات المربوطة
            </h2>
            {invoice.returns?.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد مرتجعات على هذه الفاتورة.</p>
            ) : (
              <div className="space-y-2">
                {invoice.returns?.map((rt: any) => (
                  <div
                    key={rt.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-800">{rt.code}</span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="text-slate-600">
                        {new Date(rt.returnDate).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <span className="font-bold font-mono text-amber-600" dir="ltr">
                      الكمية: {Number(rt.qty).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {collectModalOpen && (
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
                <h2 className="text-sm font-bold">تحصيل دفعة من العميل</h2>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المحصل (IDR)
                </label>
                <MoneyInput
                  value={collectAmount}
                  onChange={(v) => setCollectAmount(Number(v) || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حساب التحصيل</label>
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
                    نقدي (الخزينة)
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
                    تحويل (البنك)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات / البيان</label>
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
                  {submittingCollect ? 'جاري الحفظ...' : 'تأكيد وحفظ التحصيل'}
                </button>
                <button
                  type="button"
                  onClick={() => setCollectModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModalOpen && (
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
                <h2 className="text-sm font-bold">إلغاء فاتورة بيع (Void)</h2>
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
                هل أنت متأكد من إلغاء الفاتورة{' '}
                <strong className="text-slate-900 font-mono" dir="ltr">
                  {invoice.invoiceKey}
                </strong>
                ؟
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  سبب الإلغاء (إلزامي)*
                </label>
                <textarea
                  required
                  rows={2}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="اكتب سبب إلغاء الفاتورة بوضوح..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={voiding}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {voiding ? 'جاري الإلغاء...' : 'تأكيد الإلغاء نهائياً'}
                </button>
                <button
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
