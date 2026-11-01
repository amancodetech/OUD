'use client';
import { apiFetch } from '@/lib/client-api';
import { useUiText } from '@/i18n/interface-text';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Factory,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Package,
  Layers,
  Calendar,
  CheckCircle2,
  DollarSign,
  Info,
} from 'lucide-react';
import { QtyInput } from '@/components/forms/QtyInput';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';

interface MaterialRow {
  id: string;
  rawItemId: string;
  consumedQty: number;
}

export default function NewManufacturingBatchPage() {
  const [operationKey] = useState(() => crypto.randomUUID());

  const ui = useUiText();

  const router = useRouter();

  // Header State
  const [completionDate, setCompletionDate] = useState(
    todayInStore()
  );
  const [finishedItemId, setFinishedItemId] = useState('');
  const [producedQty, setProducedQty] = useState<number>(1);
  const [notes, setNotes] = useState('');

  // Materials State (at least 1 is required)
  const [materials, setMaterials] = useState<MaterialRow[]>([
    {
      id: 'mat-1',
      rawItemId: '',
      consumedQty: 1,
    },
  ]);

  // Master Data
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadItems() {
      try {
        setLoadingItems(true);
        const res = await apiFetch('/api/items?lookup=true');
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setItems(list);
      } catch (e) {
        console.error('Failed to load items', e);
      } finally {
        setLoadingItems(false);
      }
    }
    loadItems();
  }, []);

  // Filter items by role (HeaderValid & LineValid from Spec 10)
  const finishedItemOptions = items.filter((i) => i.role === 'FINISHED');
  const rawItemOptions = items.filter((i) => i.role === 'RAW');

  const selectedFinishedItem = items.find((i) => i.id === finishedItemId);

  // Material Row Actions
  const handleAddMaterial = () => {
    const newId = `mat-${Date.now()}`;
    setMaterials((prev) => [
      ...prev,
      {
        id: newId,
        rawItemId: '',
        consumedQty: 1,
      },
    ]);
  };

  const handleRemoveMaterial = (id: string) => {
    if (materials.length <= 1) {
      setError('يجب أن تحتوي دفعة التصنيع على مادة خام واحدة على الأقل');
      return;
    }
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleMaterialChange = (id: string, field: 'rawItemId' | 'consumedQty', value: any) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          return { ...m, [field]: value };
        }
        return m;
      })
    );
  };

  // Live Calculations (Spec 10 / Section 2.3)
  let totalMaterialsCost = 0;
  const enrichedMaterials = materials.map((m) => {
    const raw = items.find((i) => i.id === m.rawItemId);
    const unitCost = raw ? Number(raw.monthlyAvgCost) || 0 : 0;
    const consumedQty = Number(m.consumedQty) || 0;
    const rowCost = consumedQty * unitCost;
    totalMaterialsCost += rowCost;

    return {
      ...m,
      raw,
      unitCost,
      rowCost,
    };
  });

  const validProducedQty = Number(producedQty) || 0;
  const finishedUnitCost = validProducedQty > 0 ? totalMaterialsCost / validProducedQty : 0;

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errors: Record<string, string> = {};

    if (!finishedItemId) {
      errors.finishedItemId = 'يرجى اختيار المنتج التام المراد تصنيعه';
    }
    if (validProducedQty <= 0) {
      errors.producedQty = 'الكمية الناتجة يجب أن تكون أكبر من الصفر';
    }
    if (materials.length === 0) {
      errors.materials = 'يجب إضافة مادة خام واحدة على الأقل';
    }

    let hasEmptyRaw = false;
    let hasInvalidQty = false;
    for (const m of materials) {
      if (!m.rawItemId) hasEmptyRaw = true;
      if (!m.consumedQty || Number(m.consumedQty) <= 0) hasInvalidQty = true;
    }
    if (hasEmptyRaw) {
      errors.materials = 'يرجى اختيار المادة الخام لجميع السطور';
    } else if (hasInvalidQty) {
      errors.materials = 'كمية المادة الخام في كل سطر يجب أن تكون أكبر من الصفر';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('يرجى تصحيح الحقول المميزة');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch('/api/manufacturing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationKey },
        body: JSON.stringify({
          completionDate,
          finishedItemId,
          producedQty: validProducedQty,
          notes: notes.trim() || null,
          materials: materials.map((m) => ({
            rawItemId: m.rawItemId,
            consumedQty: Number(m.consumedQty),
          })),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'فشل حفظ دفعة التصنيع');
      }

      router.push('/manufacturing');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع أثناء حفظ الدفعة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/manufacturing"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={ui("رجوع للدفعات")}
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Factory className="w-6 h-6 text-amber-600" />
              {ui("دفعة تصنيع وتركيب جديدة")}</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mr-9">
            {ui("شاشة موحدة تجمع رأس الدفعة ومواد التصنيع الخام وتحديث تكلفة المنتج التام والمخزون لحظياً")}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/manufacturing"
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            {ui("إلغاء")}</Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {submitting ? ui("جاري الحفظ...") : ui("حفظ وترحيل الدفعة")}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Batch Header (ProductionBatch) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-500" />
            {ui("1. بيانات رأس الدفعة والمنتج التام الناتج")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Completion Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {ui("تاريخ إكمال الدفعة")}<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Finished Item (FINISHED role only) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {ui("المنتج التام الناتج (FINISHED)")}<span className="text-red-500">*</span>
              </label>
              <select
                value={finishedItemId}
                onChange={(e) => {
                  setFinishedItemId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, finishedItemId: '' }));
                }}
                disabled={loadingItems}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              >
                <option value="">
                  {loadingItems
                    ? ui("جاري التحميل...")
                    : finishedItemOptions.length === 0
                    ? ui("لا توجد أصناف بدور منتج تام (FINISHED)")
                    : ui("اختر المنتج التام...")}
                </option>
                {finishedItemOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code}{ui(") | الوحدة:")}{item.unit?.name}
                  </option>
                ))}
              </select>
              {fieldErrors.finishedItemId && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.finishedItemId}</p>
              )}
            </div>

            {/* Produced Qty */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {ui("الكمية الناتجة")}<span className="text-red-500">*</span>
              </label>
              <QtyInput
                value={producedQty}
                unitName={selectedFinishedItem?.unit?.name || ui("قطعة")}
                onChange={(v) => {
                  setProducedQty(Number(v) || 0);
                  setFieldErrors((prev) => ({ ...prev, producedQty: '' }));
                }}
              />
              {fieldErrors.producedQty && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.producedQty}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              {ui("ملاحظات عن الدفعة (اختياري)")}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={ui("مثال: تركيب تركيبة خريفية خاصة برائحة المسك والعود")}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Step 2: Raw Materials Table (BatchMaterial[]) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-gray-500" />
                {ui("2. المواد الخام المستهلكة في الدفعة (RAW)")}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {ui("يجب إضافة مادة خام واحدة على الأقل. يتم احتساب التكلفة بمتوسط التكلفة الشهري المرجح (RAVG).")}</p>
            </div>

            <button
              type="button"
              onClick={handleAddMaterial}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              {ui("إضافة مادة خام أخرى")}</button>
          </div>

          {fieldErrors.materials && (
            <p className="text-xs text-red-500 font-medium">{fieldErrors.materials}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase">
                <tr>
                  <th className="p-3 w-1/3">{ui("المادة الخام (دور RAW فقط)")}</th>
                  <th className="p-3 text-center">{ui("المخزون المتاح")}</th>
                  <th className="p-3 text-center">{ui("الكمية المستهلكة")}</th>
                  <th className="p-3 text-left">{ui("متوسط التكلفة (RAVG)")}</th>
                  <th className="p-3 text-left">{ui("التكلفة المستهلكة")}</th>
                  <th className="p-3 text-center w-12">{ui("حذف")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {enrichedMaterials.map((mat, index) => {
                  const rawItem = mat.raw;
                  const available = rawItem?.availableQty || 0;
                  const unitName = rawItem?.unit?.name || '';

                  return (
                    <tr key={mat.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                      {/* Raw Item Select */}
                      <td className="p-3">
                        <select
                          value={mat.rawItemId}
                          onChange={(e) =>
                            handleMaterialChange(mat.id, 'rawItemId', e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">{ui("اختر مادة خام...")}</option>
                          {rawItemOptions.map((raw) => (
                            <option key={raw.id} value={raw.id}>
                              {raw.name} ({raw.code}) - {raw.unit?.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Available Stock */}
                      <td className="p-3 text-center font-mono text-xs">
                        {rawItem ? (
                          <span
                            className={
                              Number(available) <= 0
                                ? 'text-red-500 font-bold'
                                : 'text-gray-700 dark:text-gray-300'
                            }
                          >
                            {Number(available).toLocaleString('en-US')} {unitName}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Consumed Qty */}
                      <td className="p-3 text-center w-40">
                        <QtyInput
                          value={mat.consumedQty}
                          unitName={unitName}
                          onChange={(v) =>
                            handleMaterialChange(mat.id, 'consumedQty', Number(v) || 0)
                          }
                        />
                      </td>

                      {/* RAVG Unit Cost */}
                      <td className="p-3 text-left font-mono text-xs text-gray-700 dark:text-gray-300">
                        {mat.unitCost.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {ui("ر.س")}</td>

                      {/* Row Cost */}
                      <td className="p-3 text-left font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                        {mat.rowCost.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {ui("ر.س")}</td>

                      {/* Remove Button */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(mat.id)}
                          disabled={materials.length <= 1}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-30"
                          title={ui("حذف المادة الخام")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Calculation & Impact Summary Card */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-6 shadow-md space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {ui("معاينة تكلفة الدفعة والمنتج التام لحظياً (حسب معادلات المواصفة 10)")}</h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <div className="text-xs text-gray-400">{ui("المنتج التام الناتج")}</div>
              <div className="text-base font-bold text-white mt-0.5">
                {selectedFinishedItem ? selectedFinishedItem.name : ui("لم يُحدد بعد")}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400">{ui("الكمية الناتجة")}</div>
              <div className="text-base font-bold text-amber-400 mt-0.5">
                {validProducedQty} {selectedFinishedItem?.unit?.name || ui("قطعة")}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400">{ui("إجمالي تكلفة المكونات (Σ ConsumedCost)")}</div>
              <div className="text-lg font-mono font-bold text-white mt-0.5">
                {totalMaterialsCost.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {ui("ر.س")}</div>
            </div>

            <div>
              <div className="text-xs text-gray-400">{ui("تكلفة الوحدة الواحدة من المنتج التام")}</div>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
                {finishedUnitCost.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {ui("ر.س")}</div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-3 text-xs text-gray-300 flex flex-col sm:flex-row gap-4 justify-between">
            <div>
              <span className="font-bold text-gray-200">{ui("الأثر على مخزون المواد الخام:")}</span>
              <span className="text-amber-400">
                {ui("سحب فوري لكميات المواد الخام المحددة وتخفيض رصيدها الشهري (CQ)")}</span>
            </div>

            <div>
              <span className="font-bold text-gray-200">{ui("الأثر على مخزون المنتج التام:")}</span>
              <span className="text-emerald-400">
                {ui("إضافة +")}{validProducedQty} {selectedFinishedItem?.unit?.name || ui("قطعة")} {ui("إلى وعاء مخزون المنتج التام (MQ) بقيمة إجمالية")}{totalMaterialsCost.toFixed(2)} {ui("ر.س (MV)")}</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
