'use client';
import { apiFetch } from '@/lib/client-api';
import { useUiText } from '@/i18n/interface-text';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Layers,
  FileCheck,
  ShieldCheck,
  XCircle,
  TrendingUp,
  DollarSign,
  Package,
} from 'lucide-react';

interface ReconciliationItem {
  key: string;
  label: string;
  cellRef: string;
  excelValue: number;
  systemValue: number;
  diff: number;
  matched: boolean;
}

interface ImportResultData {
  success: boolean;
  message: string;
  counts: {
    categories: number;
    units: number;
    parties: number;
    items: number;
    assets: number;
    policies: number;
    purchases: number;
    sales: number;
    cashTransactions: number;
    returns: number;
    stockIssues: number;
    batches: number;
    referrals: number;
  };
  reconciliation: {
    items: ReconciliationItem[];
    allMatched: boolean;
  };
}

export default function ExcelImportPage() {
  const ui = useUiText();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ databaseRevision: string; fileHash: string; changes: { field: string; before: string; after: string }[]; sheets: { name: string; records: number }[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('الرجاء اختيار ملف Excel أولاً');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', preview ? 'apply' : 'preview');
      if (preview) { formData.append('fileHash', preview.fileHash); formData.append('databaseRevision', preview.databaseRevision); }

      const res = await apiFetch('/api/settings/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'فشل استيراد ملف Excel');
      }

      if (json.preview) setPreview(json);
      else { setResult(json); setPreview(null); }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء معالجة الملف واستيراده');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            title={ui("العودة للإعدادات")}
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
              {ui("استيراد البيانات من Excel (oud_system.xlsx)")}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {ui("ترحيل شامل وسريع لجميع الأوراق الـ 18 إلى قاعدة البيانات مع فحص مطابقة الأرصدة")}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 hover:border-emerald-600 rounded-xl p-8 text-center transition-colors bg-gray-50/50">
            <input
              type="file"
              accept=".xlsx, .xls"
              id="excel-file-input"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="excel-file-input"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mb-1">
                <Upload className="w-7 h-7" />
              </div>
              <span className="text-sm font-bold text-gray-800">
                {file ? file.name : ui("اضغط لاختيار ملف Excel أو اسحبه إلى هنا")}
              </span>
              <span className="text-xs text-gray-500">
                {ui("يدعم ملفات قالب النظام المحاسبي المعتمد (.xlsx) مثل")}<code className="font-mono">oud_system (7).xlsx</code>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-500">
              {ui("* سيتم استيراد كافة العمليات داخل معاملة واحدة آمنة (Atomic Transaction).")}</span>
            <button
              type="submit"
              disabled={!file || uploading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {ui("جاري قراءة واستيراد الملف...")}</>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {preview ? ui("تأكيد تطبيق الاستيراد") : ui("معاينة الملف والفروقات")}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {preview && <div className="rounded-xl border bg-amber-50 p-5 space-y-3"><h2 className="font-bold">{ui("معاينة قبل الكتابة")}</h2>
        {preview.changes.map(change => <p key={change.field} dir="ltr">{change.field}: {change.before} → {change.after}</p>)}
        {preview.sheets.map(sheet => <p key={sheet.name}>{sheet.name}: {sheet.records}</p>)}
        <p>{ui("الاستيراد يحدّث السجلات المطابقة ويعيد احتساب الأرصدة. راجع الفروقات ثم أكد التطبيق.")}</p>
      </div>}
      {/* Results and Reconciliation Card */}
      {result && (
        <div className="space-y-6">
          {/* Main Success Banner */}
          <div
            className={`p-5 rounded-xl border flex items-center gap-3 ${
              result.reconciliation.allMatched
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            {result.reconciliation.allMatched ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
            )}
            <div>
              <h2 className="text-base font-bold">{result.message}</h2>
              <p className="text-xs opacity-90 mt-0.5">
                {result.reconciliation.allMatched
                  ? ui("تم فحص جميع أرقام قائمة الدخل والمركز المالي وتطابقت حرفياً مع محرك الويب المحاسبي.")
                  : ui("تمت قراءة البيانات بنجاح، راجع جدول الفروقات أدناه للتأكد من بنود الأرصدة.")}
              </p>
            </div>
          </div>

          {/* Counts Overview Grid */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-800" />
              {ui("إحصائيات السجلات المستوردة:")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-center text-xs">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("فئات الأصناف")}</span>
                <span className="font-bold text-sm text-gray-900 mt-1 block">{result.counts.categories}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("الوحدات")}</span>
                <span className="font-bold text-sm text-gray-900 mt-1 block">{result.counts.units}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("الأطراف والأسماء")}</span>
                <span className="font-bold text-sm text-gray-900 mt-1 block">{result.counts.parties}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("الأصناف")}</span>
                <span className="font-bold text-sm text-gray-900 mt-1 block">{result.counts.items}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("سطور المشتريات")}</span>
                <span className="font-bold text-sm text-emerald-700 mt-1 block">{result.counts.purchases}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("سطور المبيعات")}</span>
                <span className="font-bold text-sm text-emerald-700 mt-1 block">{result.counts.sales}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("الحركات النقدية")}</span>
                <span className="font-bold text-sm text-indigo-700 mt-1 block">{result.counts.cashTransactions}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("سطور المرتجعات")}</span>
                <span className="font-bold text-sm text-rose-700 mt-1 block">{result.counts.returns}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("صرف المخزون")}</span>
                <span className="font-bold text-sm text-amber-700 mt-1 block">{result.counts.stockIssues}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("دفعات التصنيع")}</span>
                <span className="font-bold text-sm text-purple-700 mt-1 block">{result.counts.batches}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("زيارات السائقين")}</span>
                <span className="font-bold text-sm text-blue-700 mt-1 block">{result.counts.referrals}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 block">{ui("الأصول الثابتة")}</span>
                <span className="font-bold text-sm text-gray-900 mt-1 block">{result.counts.assets}</span>
              </div>
            </div>
          </div>

          {/* Post-Import Reconciliation Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                {ui("بطاقة فحص المطابقة التلقائية مع ورقة «الرئيسية والتقارير» في ملف Excel:")}</h3>
              <span className="text-xs text-gray-500">{ui("مقارنة الخلايا المعتمدة في ورقة التقارير")}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-4">{ui("البند المالي")}</th>
                    <th className="py-2.5 px-3">{ui("الخلية في Excel")}</th>
                    <th className="py-2.5 px-4 font-mono">{ui("القيمة في Excel")}</th>
                    <th className="py-2.5 px-4 font-mono">{ui("المحسوب في النظام")}</th>
                    <th className="py-2.5 px-4 font-mono">{ui("الفرق")}</th>
                    <th className="py-2.5 px-4 text-center">{ui("حالة المطابقة")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  {result.reconciliation.items.map((it) => (
                    <tr
                      key={it.key}
                      className={it.matched ? 'hover:bg-emerald-50/30' : 'bg-red-50/40 hover:bg-red-50/60'}
                    >
                      <td className="py-2.5 px-4 font-sans font-medium text-gray-900">{it.label}</td>
                      <td className="py-2.5 px-3 text-gray-500">{it.cellRef}</td>
                      <td className="py-2.5 px-4 text-gray-800">
                        {it.excelValue.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-gray-900">
                        {it.systemValue.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">
                        {it.diff > 0.001
                          ? it.diff.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '0.00'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-sans">
                        {it.matched ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {ui("متطابق 100%")}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100/70 px-2.5 py-0.5 rounded-full">
                            <XCircle className="w-3.5 h-3.5" />
                            {ui("يوجد فرق")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
