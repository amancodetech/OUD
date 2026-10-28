'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Factory,
  Plus,
  Search,
  Layers,
  Trash2,
  Calendar,
  AlertCircle,
  Package,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';

interface BatchMaterial {
  id: string;
  rawItemId: string;
  consumedQty: number;
  rawUnitCost: number;
  consumedCost: number;
  rawItem: {
    id: string;
    code: string;
    name: string;
    unit: {
      name: string;
    };
  };
}

interface ProductionBatch {
  id: string;
  code: string;
  completionDate: string;
  finishedItemId: string;
  producedQty: number;
  notes: string | null;
  status: 'POSTED' | 'VOID';
  voidReason?: string | null;
  voidedAt?: string | null;
  totalMaterialsCost: number;
  finishedUnitCost: number;
  finishedItem: {
    id: string;
    code: string;
    name: string;
    unit: {
      name: string;
    };
    category: {
      name: string;
    };
  };
  materials: BatchMaterial[];
}

export default function ManufacturingPage() {
  const { t, locale, isRtl, tUnit, tCategory } = useI18n();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // Void Modal State
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [targetBatch, setTargetBatch] = useState<ProductionBatch | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/manufacturing');
      const data = await res.json();
      if (Array.isArray(data)) {
        setBatches(data);
      }
    } catch (e) {
      console.error('Error fetching batches', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleVoidBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBatch) return;
    setVoidError('');

    if (!voidReason.trim() || voidReason.trim().length < 3) {
      setVoidError(
        locale === 'ar'
          ? 'يرجى إدخال سبب الإلغاء (3 أحرف على الأقل)'
          : 'Please enter void reason (at least 3 characters)'
      );
      return;
    }

    try {
      setVoiding(true);
      const res = await fetch(`/api/manufacturing/${targetBatch.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to void production batch');
      }

      setVoidModalOpen(false);
      setTargetBatch(null);
      setVoidReason('');
      fetchBatches();
    } catch (err: any) {
      setVoidError(err.message || 'Error occurred while voiding batch');
    } finally {
      setVoiding(false);
    }
  };

  // KPIs (posted only)
  const postedBatches = batches.filter((b) => b.status === 'POSTED');
  const totalProducedUnits = postedBatches.reduce((sum, b) => sum + (b.producedQty || 0), 0);
  const grandMaterialsCost = postedBatches.reduce((sum, b) => sum + (b.totalMaterialsCost || 0), 0);

  // Search Filter
  const filteredBatches = batches.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.code.toLowerCase().includes(q) ||
      b.finishedItem.name.toLowerCase().includes(q) ||
      b.finishedItem.code.toLowerCase().includes(q) ||
      (b.notes && b.notes.toLowerCase().includes(q))
    );
  });

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Factory className="w-6 h-6 text-amber-600" />
            {t.manufacturing.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t.manufacturing.subtitle}
          </p>
        </div>

        <Link
          href="/manufacturing/new"
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.manufacturing.newBatchBtn}
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {locale === 'ar' ? 'الدفعات المكتملة المرحلة' : 'Completed Posted Batches'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-gray-900 dark:text-white mt-2" dir="ltr">
            {postedBatches.length}{' '}
            <span className="text-xs font-normal text-gray-500">
              {locale === 'ar' ? 'دفعة' : 'Batches'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {t.manufacturing.totalMaterialsCost}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2" dir="ltr">
            {grandMaterialsCost.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span className="text-xs font-normal text-gray-500">IDR</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {locale === 'ar' ? 'إجمالي المنتجات التامة المصنعة' : 'Total Manufactured Units'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-2" dir="ltr">
            {totalProducedUnits.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-gray-500">
              {locale === 'ar' ? 'وحدة' : 'Units'}
            </span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3' : 'left-3'} top-3 text-gray-400`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.manufacturing.searchPlaceholder}
            className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500`}
          />
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-500">{t.common.loading}</div>
        ) : filteredBatches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Factory className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-base font-semibold">{t.common.noData}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="p-3.5">{t.manufacturing.batchNo}</th>
                  <th className="p-3.5">{t.manufacturing.completionDate}</th>
                  <th className="p-3.5">{t.manufacturing.finishedItem}</th>
                  <th className="p-3.5 text-center">{t.manufacturing.producedQty}</th>
                  <th className={`p-3.5 ${isRtl ? 'text-left' : 'text-right'}`}>{t.manufacturing.totalMaterialsCost}</th>
                  <th className={`p-3.5 ${isRtl ? 'text-left' : 'text-right'}`}>{t.manufacturing.finishedUnitCost}</th>
                  <th className="p-3.5 text-center">{t.manufacturing.rawMaterialsUsed}</th>
                  <th className="p-3.5 text-center">{t.common.status}</th>
                  <th className="p-3.5 text-center">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredBatches.map((b) => {
                  const dateStr = b.completionDate
                    ? new Date(b.completionDate).toLocaleDateString(dateLocale)
                    : '';
                  const isVoid = b.status === 'VOID';
                  const isExpanded = expandedBatchId === b.id;

                  return (
                    <React.Fragment key={b.id}>
                      <tr
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                          isVoid ? 'opacity-60 bg-gray-50/50 dark:bg-gray-900/50' : ''
                        }`}
                      >
                        <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                          {b.code}
                        </td>

                        <td className="p-3.5 text-xs text-gray-600 dark:text-gray-300">
                          {dateStr}
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {b.finishedItem.name}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {b.finishedItem.code} | {tCategory(b.finishedItem.category?.name)}
                          </div>
                        </td>

                        <td className="p-3.5 text-center font-mono font-bold text-gray-900 dark:text-white" dir="ltr">
                          {b.producedQty}{' '}
                          <span className="text-xs font-normal text-gray-500">
                            {tUnit(b.finishedItem.unit.name)}
                          </span>
                        </td>

                        <td className={`p-3.5 ${isRtl ? 'text-left' : 'text-right'} font-mono font-bold text-gray-900 dark:text-white`} dir="ltr">
                          {(b.totalMaterialsCost || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          IDR
                        </td>

                        <td className={`p-3.5 ${isRtl ? 'text-left' : 'text-right'} font-mono font-bold text-emerald-600 dark:text-emerald-400`} dir="ltr">
                          {(b.finishedUnitCost || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          IDR
                        </td>

                        <td className="p-3.5 text-center">
                          <button
                            onClick={() =>
                              setExpandedBatchId(isExpanded ? null : b.id)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                          >
                            <span>
                              {b.materials.length} {locale === 'ar' ? 'مادة خام' : 'Raw Materials'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>

                        <td className="p-3.5 text-center">
                          {isVoid ? (
                            <span
                              className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                              title={`ملغى: ${b.voidReason || ''}`}
                            >
                              VOID
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                              POSTED
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          {!isVoid && (
                            <button
                              onClick={() => {
                                setTargetBatch(b);
                                setVoidReason('');
                                setVoidError('');
                                setVoidModalOpen(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                              title={t.manufacturing.voidTitle}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Breakdown of Raw Materials */}
                      {isExpanded && (
                        <tr className="bg-gray-50/80 dark:bg-gray-800/40">
                          <td colSpan={9} className="p-4 border-t border-b border-gray-200 dark:border-gray-700">
                            <div className={`space-y-2 max-w-4xl ${isRtl ? 'mr-6' : 'ml-6'}`}>
                              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                {t.manufacturing.rawMaterialsUsed}:
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {b.materials.map((m) => (
                                  <div
                                    key={m.id}
                                    className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs space-y-1 shadow-xs"
                                  >
                                    <div className="font-bold text-gray-900 dark:text-white">
                                      {m.rawItem.name}
                                    </div>
                                    <div className="text-gray-500 font-mono">
                                      {t.manufacturing.consumedQty}: {m.consumedQty} {tUnit(m.rawItem.unit.name)}
                                    </div>
                                    <div className="text-gray-500 font-mono" dir="ltr">
                                      {t.manufacturing.rawUnitCost}:{' '}
                                      {(m.rawUnitCost || 0).toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{' '}
                                      IDR
                                    </div>
                                    <div className="text-amber-600 dark:text-amber-400 font-bold font-mono" dir="ltr">
                                      {t.manufacturing.rawTotalCost}:{' '}
                                      {(m.consumedCost || 0).toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{' '}
                                      IDR
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {b.notes && (
                                <div className="text-xs text-gray-400 pt-1">
                                  {t.common.notes}: {b.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Void Modal */}
      {voidModalOpen && targetBatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setVoidModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {t.manufacturing.voidTitle} ({targetBatch.code})
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {locale === 'ar' ? (
                <>
                  سيتم إلغاء الدفعة واستعادة المواد الخام المستهلكة وإلغاء إضافة المنتج التام ({targetBatch.finishedItem.name}) من المخزون.
                </>
              ) : (
                <>
                  Production batch will be voided, consumed raw materials will be restored, and finished item ({targetBatch.finishedItem.name}) will be removed from stock.
                </>
              )}
            </p>

            {voidError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                {voidError}
              </div>
            )}

            <form onSubmit={handleVoidBatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t.cash.voidReasonLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t.cash.voidReasonPlaceholder}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={voiding}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {voiding ? t.cash.voiding : t.cash.confirmVoidBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
