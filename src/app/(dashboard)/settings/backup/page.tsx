'use client';
import { useUiText } from '@/i18n/interface-text';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Database,
  Shield,
  HardDrive,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Clock,
  CheckCircle,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';

export default function BackupSettingsPage() {
  const ui = useUiText();

  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (format: 'json' | 'excel') => {
    try {
      if (format === 'json') setDownloadingJson(true);
      else setDownloadingExcel(true);
      setError(null);
      setStatusMessage(null);

      const res = await fetch(`/api/backup?format=${format}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'فشل تنزيل النسخة');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = format === 'excel' ? 'oud_erp_export.xlsx' : 'oud_erp_backup.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStatusMessage(
        format === 'excel'
          ? 'تم تصدير وتنزيل ملف Excel بنجاح!'
          : 'تم تنزيل النسخة الاحتياطية (JSON) بنجاح على جهازك!'
      );
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنزيل الملف');
    } finally {
      setDownloadingJson(false);
      setDownloadingExcel(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    const confirmed = window.confirm(
      'تحذير: استعادة النسخة الاحتياطية ستستبدل جميع بيانات النظام مع الملف المختار. هل أنت متأكد من المتابعة؟'
    );
    if (!confirmed) return;

    try {
      setRestoring(true);
      setError(null);
      setStatusMessage(null);

      const text = await file.text();
      const parsedJson = JSON.parse(text);

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: parsedJson, confirmReplace: true, reason: 'استعادة يدوية معتمدة من شاشة النسخ الاحتياطي' }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'فشلت استعادة النسخة الاحتياطية');
      }

      setStatusMessage(resJson.message || 'تمت استعادة البيانات بنجاح!');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء قراءة واستعادة ملف النسخة الاحتياطية');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
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
              <Database className="w-6 h-6 text-amber-800" />
              {ui("النسخ الاحتياطي واستعادة وتصدير البيانات")}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {ui("حفظ وتأمين بيانات النظام المحاسبي والمخزوني لمنع أي فقدان للمعلومات")}</p>
          </div>
        </div>

        <Link
          href="/settings/import"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          {ui("استيراد من Excel")}</Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Card 1: On-Demand Full Backup & Excel Export */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-amber-800" />
            {ui("تنزيل نسخة احتياطية فورية (Manual Backup & Export)")}</h2>
          <p className="text-xs text-gray-600 mt-1">
            {ui("اختر الصيغة المناسبة لتنزيل كامل قاعدة البيانات: بصيغة JSON شاملة لكافة الجداول، أو بصيغة ملف Excel (.xlsx) جاهز للفتح والمراجعة.")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleDownload('json')}
            disabled={downloadingJson || downloadingExcel}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
          >
            {downloadingJson ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {ui("جاري تجهيز النسخة...")}</>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {ui("تنزيل نسخة كاملة (JSON)")}</>
            )}
          </button>

          <button
            onClick={() => handleDownload('excel')}
            disabled={downloadingJson || downloadingExcel}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
          >
            {downloadingExcel ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {ui("جاري التصدير...")}</>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                {ui("تصدير إلى Excel (.xlsx)")}</>
            )}
          </button>
        </div>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>{ui("يشمل كافة الجداول والمعاملات")}</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span>{ui("ملف محلي غير مشفر — احفظه في مكان خاص")}</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <Shield className="w-4 h-4 text-purple-600" />
            <span>{ui("متاح للمشرف (Admin) فقط")}</span>
          </div>
        </div>
      </div>

      {/* Card 2: Restore from JSON backup */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-700" />
            {ui("استعادة قاعدة البيانات من ملف احتياطي (Restore Backup)")}</h2>
          <p className="text-xs text-gray-600 mt-1">
            {ui("ارفع ملف النسخة الاحتياطية بصيغة JSON (")}<code className="font-mono">oud_erp_backup_*.json</code>{ui(") لاستعادة البيانات والأرصدة إلى النظام.")}</p>
        </div>

        <div>
          <input
            type="file"
            accept=".json"
            id="restore-file-input"
            className="hidden"
            onChange={handleRestoreFile}
            disabled={restoring}
          />
          <label
            htmlFor="restore-file-input"
            className={`inline-flex items-center gap-2 px-5 py-2.5 border border-indigo-300 text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm ${
              restoring ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {restoring ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {ui("جاري استعادة البيانات...")}</>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {ui("اختيار ملف النسخة الاحتياطية لاستعادتها")}</>
            )}
          </label>
        </div>
      </div>

      {/* Card 3: Scheduled Backup Guide */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-800" />
          {ui("النسخ الاحتياطي التلقائي اليومي (Scheduled Backup)")}</h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          {ui("وفقاً للمواصفة القياسية (")}<code className="bg-gray-100 px-1 py-0.5 rounded text-amber-900">specs/17-deployment-ops.md</code>{ui(")، يمكن إعداد نسخة احتياطية يومية من قاعدة بيانات PostgreSQL في المجلد المربوط")}<code className="bg-gray-100 px-1 py-0.5 rounded font-mono">./backups</code> {ui("بعد تفعيل الجدولة وفق دليل التشغيل. الجدولة غير مفعلة تلقائيًا من هذه الشاشة.")}</p>

        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto text-left" dir="ltr">
          <div className="text-gray-400"># Backup directly using docker exec pg_dump:</div>
          <div>docker exec -t oud_erp_db pg_dump -U oud_user oud_erp &gt; backups/oud_backup_$(date +%Y%m%d).sql</div>
        </div>
      </div>
    </div>
  );
}
