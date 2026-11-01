'use client';
import { useApiQuery } from '@/lib/use-api-query';
import { QueryStatus } from '@/components/data/QueryStatus';
import { apiFetch } from '@/lib/client-api';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RotateCcw,
  Plus,
  Search,
  Filter,
  AlertCircle,
  Clock,
  ArrowRight,
  Trash2,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';

export default function ReturnsPage() {
  const { t, locale, isRtl, tUnit, tInvoiceKey, tLocalizedName } = useI18n();

  const [filterType, setFilterType] = useState<'ALL' | 'SALE_RETURN' | 'PURCHASE_RETURN'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Void modal state
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [returnToVoid, setReturnToVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const query = useApiQuery<any[]>('/api/returns');
  const returns = query.data || [];
  const loading = query.isLoading;
  const loadData = () => query.mutate();

  const filteredReturns = returns.filter((r) => {
    if (r.status === 'VOID') return false;
    if (filterType !== 'ALL' && r.type !== filterType) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchCode = r.code?.toLowerCase().includes(s);
      const matchDoc = r.returnDocNo?.toLowerCase().includes(s);
      const matchParty = r.party?.name?.toLowerCase().includes(s);
      const matchInv = r.invoiceKey?.toLowerCase().includes(s);
      const matchItem = r.itemName?.toLowerCase().includes(s);
      if (!matchCode && !matchDoc && !matchParty && !matchInv && !matchItem) return false;
    }
    return true;
  });

  const totalSaleReturns = filteredReturns
    .filter((r) => r.type === 'SALE_RETURN')
    .reduce((sum, r) => sum + (r.creditAmount || 0), 0);

  const totalPurchaseReturns = filteredReturns
    .filter((r) => r.type === 'PURCHASE_RETURN')
    .reduce((sum, r) => sum + (r.creditAmount || 0), 0);

  const totalDamagedExpense = filteredReturns
    .filter((r) => r.type === 'SALE_RETURN' && r.saleReturnCondition === 'DAMAGED')
    .reduce((sum, r) => sum + (r.damagedExpense || 0), 0);

  const submitVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason || voidReason.trim().length < 3) {
      setVoidError(
        locale === 'ar'
          ? 'يرجى كتابة سبب الإلغاء (3 أحرف على الأقل)'
          : 'Please enter the cancellation reason (at least 3 characters)'
      );
      return;
    }

    setVoiding(true);
    setVoidError('');
    try {
      const res = await apiFetch(`/api/returns/${returnToVoid.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void return');

      setVoidModalOpen(false);
      await loadData();
    } catch (err: any) {
      setVoidError(err.message);
    } finally {
      setVoiding(false);
    }
  };

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';

  if (query.error && !query.data) return <QueryStatus query={query} />;

  return (
    <div className="space-y-6">
      <QueryStatus query={query} />
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-amber-600" />
            {t.returns.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t.returns.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.common.all}
            </button>
            <button
              onClick={() => setFilterType('SALE_RETURN')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterType === 'SALE_RETURN'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.returns.salesReturn}
            </button>
            <button
              onClick={() => setFilterType('PURCHASE_RETURN')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterType === 'PURCHASE_RETURN'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.returns.purchaseReturn}
            </button>
          </div>

          <Link
            href="/returns/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            {t.returns.newReturn}
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">{t.returns.totalSaleReturns}</p>
            <p className="text-lg font-bold text-amber-700 mt-1 font-mono" dir="ltr">
              {totalSaleReturns.toLocaleString()} <span className="text-xs font-normal">IDR</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">{t.returns.totalPurchaseReturns}</p>
            <p className="text-lg font-bold text-blue-700 mt-1 font-mono" dir="ltr">
              {totalPurchaseReturns.toLocaleString()} <span className="text-xs font-normal">IDR</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">{t.returns.totalDamagedExpense}</p>
            <p className="text-lg font-bold text-rose-600 mt-1 font-mono" dir="ltr">
              {totalDamagedExpense.toLocaleString()} <span className="text-xs font-normal">IDR</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-400 absolute ${isRtl ? 'right-3' : 'left-3'} top-3`} />
          <input
            type="text"
            placeholder={t.returns.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500`}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t.common.loading}</div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t.common.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-xs`}>
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">{t.returns.returnNo}</th>
                  <th className="p-3">{t.returns.returnDocNo}</th>
                  <th className="p-3">{t.common.date}</th>
                  <th className="p-3">{t.returns.returnType}</th>
                  <th className="p-3">{t.cash.party}</th>
                  <th className="p-3">{t.returns.originalInvoice}</th>
                  <th className="p-3">{t.purchases.item}</th>
                  <th className="p-3 text-center">{t.purchases.qty}</th>
                  <th className="p-3 text-center">{t.returns.condition}</th>
                  <th className={`p-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t.returns.creditImpact}</th>
                  <th className="p-3">{t.returns.reason}</th>
                  <th className="p-3 text-center">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-mono font-bold text-amber-700">{ret.code}</td>
                    <td className="p-3 font-mono font-medium text-slate-800">{ret.returnDocNo}</td>
                    <td className="p-3 text-slate-500">
                      {new Date(ret.returnDate).toLocaleDateString(dateLocale)}
                    </td>
                    <td className="p-3">
                      {ret.type === 'SALE_RETURN' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">
                          {t.returns.salesReturn}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-900 font-bold">
                          {t.returns.purchaseReturn}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-slate-800">
                      {tLocalizedName(ret.party, locale)}{' '}
                      <span className="text-[10px] text-slate-400">({ret.party?.code})</span>
                    </td>
                    <td className="p-3 font-mono text-[11px]" dir="ltr">
                      {tInvoiceKey(ret.invoiceKey)}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {(locale === 'en' || locale === 'id') && ret.itemNameEn ? ret.itemNameEn : ret.itemName}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({tUnit(ret.unitName)})
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold" dir="ltr">
                      {Number(ret.qty).toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      {ret.type === 'SALE_RETURN' ? (
                        ret.saleReturnCondition === 'GOOD' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                            {t.returns.goodCondition}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold">
                            {t.returns.damagedCondition}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500 text-[11px] font-mono">
                          {ret.supplierCreditNote ? `${Number(ret.supplierCreditNote).toLocaleString()} IDR` : t.returns.automatic}
                        </span>
                      )}
                    </td>
                    <td className={`p-3 ${isRtl ? 'text-left' : 'text-right'} font-mono font-bold text-slate-900`} dir="ltr">
                      {ret.creditAmount?.toLocaleString()} IDR
                    </td>
                    <td className="p-3 text-slate-600 max-w-xs truncate">{ret.reason}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setReturnToVoid(ret);
                          setVoidReason('');
                          setVoidError('');
                          setVoidModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title={t.returns.voidTitle}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Void Modal */}
      {voidModalOpen && returnToVoid && (
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
                <h2 className="text-sm font-bold">{t.returns.voidTitle}</h2>
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
                {locale === 'ar' ? (
                  <>
                    هل أنت متأكد من إلغاء سطر المرتجع{' '}
                    <strong className="text-slate-900 font-mono">{returnToVoid.code}</strong>؟
                  </>
                ) : (
                  <>
                    Are you sure you want to void return line{' '}
                    <strong className="text-slate-900 font-mono">{returnToVoid.code}</strong>?
                  </>
                )}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.cash.voidReasonLabel}
                </label>
                <textarea
                  required
                  rows={2}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.cash.voidReasonPlaceholder}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={voiding}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {voiding ? t.cash.voiding : t.cash.confirmVoidBtn}
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
