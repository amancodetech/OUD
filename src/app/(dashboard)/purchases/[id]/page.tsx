'use client';
import { useParams } from 'next/navigation';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingBag,
  ArrowRight,
  DollarSign,
  Clock,
  RotateCcw,
  Trash2,
  AlertCircle,
  X,
  Layers,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payAccount, setPayAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);
  const [payError, setPayError] = useState('');

  // Void modal state
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchases/${params.id}`);
      const data = await res.json();
      if (res.ok) {
        setInvoice(data);
        setPayAmount(data.invoiceDebt > 0 ? data.invoiceDebt : 0);
        setPayNotes(`سداد دفعة لفاتورة ${data.invoiceKey}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [params.id]);

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || payAmount <= 0) {
      setPayError('يرجى إدخال مبلغ صحيح');
      return;
    }

    setSubmittingPay(true);
    setPayError('');
    try {
      const res = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txDate: todayInStore(),
          type: 'SUPPLIER_PAYMENT',
          account: payAccount,
          amount: payAmount,
          partyId: invoice.supplierId,
          invoiceKey: invoice.invoiceKey,
          description: payNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل السداد');

      setPaymentModalOpen(false);
      await loadInvoice();
    } catch (err: any) {
      setPayError(err.message);
    } finally {
      setSubmittingPay(false);
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
      const res = await fetch(`/api/purchases/${params.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إلغاء الفاتورة');

      setVoidModalOpen(false);
      router.push('/purchases');
    } catch (err: any) {
      setVoidError(err.message);
    } finally {
      setVoiding(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        جاري تحميل بيانات الفاتورة...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center text-rose-500 text-sm">
        لم يتم العثور على فاتورة الشراء المطلوبة.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases"
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
              المورد: <strong>{invoice.supplier?.name}</strong> | التاريخ:{' '}
              {new Date(invoice.invoiceDate).toLocaleDateString('ar-EG')}
            </p>
          </div>
        </div>

        {invoice.status !== 'VOID' && (
          <div className="flex items-center gap-2">
            {invoice.invoiceDebt > 0 && (
              <button
                type="button"
                onClick={() => setPaymentModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <DollarSign className="w-4 h-4" />
                سداد دفعة للمورد
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
          </div>
        )}
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">إجمالي الفاتورة الأصلي</p>
          <p className="text-lg font-bold text-slate-900 mt-1 font-mono" dir="ltr">
            {invoice.originalAsOf?.toLocaleString()} IDR
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">المرتجعات المخصومة</p>
          <p className="text-lg font-bold text-amber-600 mt-1 font-mono" dir="ltr">
            {invoice.returnsAsOf?.toLocaleString()} IDR
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">إجمالي المسدد</p>
          <p className="text-lg font-bold text-emerald-600 mt-1 font-mono" dir="ltr">
            {invoice.settlementAsOf?.toLocaleString()} IDR
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">المتبقي المطلوب سداده</p>
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

      {/* Lines Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            سطور الأصناف في الفاتورة
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">كود السطر</th>
                <th className="p-3">الصنف</th>
                <th className="p-3 text-center">الكمية</th>
                <th className="p-3 text-left">تكلفة الوحدة</th>
                <th className="p-3 text-left">تكلفة الوصول</th>
                <th className="p-3 text-left">الخصم</th>
                <th className="p-3 text-left font-bold">تكلفة البند</th>
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
                  <td className="p-3 text-center font-mono font-bold" dir="ltr">
                    {Number(line.qty).toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono" dir="ltr">
                    {Number(line.unitCost).toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono text-slate-500" dir="ltr">
                    {Number(line.landedCost).toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono text-slate-500" dir="ltr">
                    {Number(line.discount).toLocaleString()}
                  </td>
                  <td className="p-3 text-left font-mono font-bold text-slate-900" dir="ltr">
                    {Number(line.lineTotalCost).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Related Payments & Returns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Payments */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            سندات السداد المسجلة على الفاتورة
          </h2>
          {invoice.payments?.length === 0 ? (
            <p className="text-xs text-slate-400">لم يتم تسجيل أي سداد بعد.</p>
          ) : (
            <div className="space-y-2">
              {invoice.payments?.map((pm: any) => (
                <div
                  key={pm.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-800">{pm.code}</span>
                    <span className="text-slate-400 mx-1.5">•</span>
                    <span className="text-slate-600">
                      {new Date(pm.txDate).toLocaleDateString('ar-EG')}
                    </span>
                    <span className="text-slate-400 mx-1.5">•</span>
                    <span className="text-slate-500">
                      {pm.account === 'CASH' ? 'خزينة' : 'بنك'}
                    </span>
                  </div>
                  <span className="font-bold font-mono text-emerald-600" dir="ltr">
                    {Number(pm.amount).toLocaleString()} IDR
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
            مرتجعات المشتريات المربوطة
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

      {/* Quick Payment Modal */}
      {paymentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-200" />
                <h2 className="text-sm font-bold">سداد دفعة للمورد</h2>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitPayment} className="p-5 space-y-4">
              {payError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المدفوع (IDR)
                </label>
                <MoneyInput
                  value={payAmount}
                  onChange={(v) => setPayAmount(Number(v) || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حساب الدفع</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayAccount('CASH')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      payAccount === 'CASH'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    نقدي (الخزينة)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayAccount('BANK')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      payAccount === 'BANK'
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
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {submittingPay ? 'جاري الحفظ...' : 'تأكيد وحفظ السداد'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
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
                <h2 className="text-sm font-bold">إلغاء فاتورة شراء (Void)</h2>
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
