'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/domain/decimal';
import {
  Landmark,
  Users,
  Building,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  FileText,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';

export default function PartnersAndAssetsPage() {
  const { t, locale, isRtl } = useI18n();

  const [activeTab, setActiveTab] = useState<'PARTNERS' | 'ASSETS' | 'EQUITY'>('ASSETS');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Asset Modals State
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [isDeleteAssetOpen, setIsDeleteAssetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [assetForm, setAssetForm] = useState({
    name: '',
    nameEn: '',
    submittedValue: '',
    acquiredDate: '',
    notes: '',
  });
  const [assetFormError, setAssetFormError] = useState<string | null>(null);
  const [assetSubmitting, setAssetSubmitting] = useState(false);

  // Partner Modal State
  const [isEditPartnerOpen, setIsEditPartnerOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [partnerForm, setPartnerForm] = useState({
    name: '',
    nameEn: '',
    profitShareRatio: '',
    openingCapital: '',
  });
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/partners-summary')
      .then((res) => res.json())
      .then((res) => {
        if (res.ok) setData(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleApproveAssets = async (approved: boolean) => {
    setToggling(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approveOpeningAssets: approved }),
      });
      fetchData();
    } catch {
    } finally {
      setToggling(false);
    }
  };

  // Fixed Asset Handlers
  const handleOpenAddAsset = () => {
    setAssetForm({ name: '', nameEn: '', submittedValue: '0', acquiredDate: '', notes: '' });
    setAssetFormError(null);
    setIsAddAssetOpen(true);
  };

  const handleOpenEditAsset = (asset: any) => {
    setSelectedAsset(asset);
    setAssetForm({
      name: asset.name || '',
      nameEn: asset.nameEn || '',
      submittedValue: String(asset.submittedValue ?? 0),
      acquiredDate: asset.acquiredDate || '',
      notes: asset.notes || '',
    });
    setAssetFormError(null);
    setIsEditAssetOpen(true);
  };

  const handleOpenDeleteAsset = (asset: any) => {
    setSelectedAsset(asset);
    setAssetFormError(null);
    setIsDeleteAssetOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssetFormError(null);
    if (!assetForm.name.trim()) {
      setAssetFormError(isRtl ? 'اسم الأصل الثابت إلزامي' : 'Asset name is required');
      return;
    }

    setAssetSubmitting(true);
    try {
      const url = isAddAssetOpen ? '/api/fixed-assets' : `/api/fixed-assets/${selectedAsset.id}`;
      const method = isAddAssetOpen ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assetForm.name,
          nameEn: assetForm.nameEn.trim() || null,
          submittedValue: parseFloat(assetForm.submittedValue || '0') || 0,
          acquiredDate: assetForm.acquiredDate || null,
          notes: assetForm.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || (isRtl ? 'فشل حفظ بيانات الأصل' : 'Failed to save asset'));
      }
      setIsAddAssetOpen(false);
      setIsEditAssetOpen(false);
      fetchData();
    } catch (err: any) {
      setAssetFormError(err.message);
    } finally {
      setAssetSubmitting(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;
    setAssetSubmitting(true);
    setAssetFormError(null);
    try {
      const res = await fetch(`/api/fixed-assets/${selectedAsset.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || (isRtl ? 'فشل حذف الأصل الثابت' : 'Failed to delete asset'));
      }
      setIsDeleteAssetOpen(false);
      fetchData();
    } catch (err: any) {
      setAssetFormError(err.message);
    } finally {
      setAssetSubmitting(false);
    }
  };

  // Partner Edit Handlers
  const handleOpenEditPartner = (p: any) => {
    setSelectedPartner(p);
    setPartnerForm({
      name: p.partnerName || '',
      nameEn: p.partnerNameEn || '',
      profitShareRatio: (parseFloat(String(p.profitShareRatio || 0)) * 100).toFixed(0),
      openingCapital: String(p.openingCapital ?? 0),
    });
    setPartnerFormError(null);
    setIsEditPartnerOpen(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerFormError(null);
    const ratio = parseFloat(partnerForm.profitShareRatio);
    if (isNaN(ratio) || ratio < 0 || ratio > 100) {
      setPartnerFormError(isRtl ? 'نسبة الربح يجب أن تكون بين 0 و 100%' : 'Profit share ratio must be between 0% and 100%');
      return;
    }

    setPartnerSubmitting(true);
    try {
      const res = await fetch(`/api/parties/${selectedPartner.partnerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partnerForm.name,
          nameEn: partnerForm.nameEn.trim() || null,
          profitShareRatio: ratio / 100,
          openingCapital: parseFloat(partnerForm.openingCapital || '0') || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || (isRtl ? 'فشل تعديل بيانات الشريك' : 'Failed to update partner'));
      }
      setIsEditPartnerOpen(false);
      fetchData();
    } catch (err: any) {
      setPartnerFormError(err.message);
    } finally {
      setPartnerSubmitting(false);
    }
  };

  const partners = data?.partnersSummary || [];
  const assets = data?.assetsData?.assets || [];
  const assetTotals = data?.assetsData?.totals || {};
  const approveOpening = data?.assetsData?.approveOpening || false;
  const eq = data?.openingEquitySummary || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-600" />
            {t.partners.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t.partners.subtitle}
          </p>
        </div>

        {/* Action button & Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'ASSETS' && (
            <button
              onClick={handleOpenAddAsset}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
            >
              <Plus className="h-4 w-4" />
              <span>{isRtl ? 'إضافة أصل جديد' : 'Add New Asset'}</span>
            </button>
          )}

          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('ASSETS')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'ASSETS'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="h-4 w-4" />
              <span>{t.partners.fixedAssetsTab}</span>
            </button>
            <button
              onClick={() => setActiveTab('PARTNERS')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'PARTNERS'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>{t.partners.partnersTab}</span>
            </button>
            <button
              onClick={() => setActiveTab('EQUITY')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'EQUITY'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {isRtl ? 'مطابقة حقوق التأسيس' : 'Equity Reconciliation'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">{t.common.loading}</div>
      ) : (
        <>
          {/* TAB 1: ASSETS */}
          {activeTab === 'ASSETS' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="approveAssetsCheck"
                    checked={approveOpening}
                    disabled={toggling}
                    onChange={(e) => handleToggleApproveAssets(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="approveAssetsCheck" className="text-xs cursor-pointer">
                    <span className="font-bold text-slate-900">
                      {isRtl
                        ? 'اعتماد القيم الافتتاحية للأصول في حقوق ملكية البداية'
                        : 'Approve Opening Fixed Assets into Initial Equity'}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {isRtl
                        ? 'إذا تم التفعيل، تدخل القيم المقدمة للأصول الـ 13 (170,386,000 IDR) ضمن أصول وحقوق البداية.'
                        : 'If enabled, the 13 fixed assets (170,386,000 IDR) are recognized in opening equity.'}
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddAsset}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isRtl ? 'إضافة أصل جديد' : 'Add Asset'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="py-3 px-4">{locale === 'ar' ? 'كود الأصل' : locale === 'id' ? 'Kode Aset' : 'Asset Code'}</th>
                        <th className="py-3 px-4">{t.partners.assetName}</th>
                        <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                          {isRtl ? 'قيمة مقدمة قبل التشغيل' : 'Pre-operation Submitted'}
                        </th>
                        <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                          {isRtl ? 'افتتاح معتمد' : 'Approved Opening'}
                        </th>
                        <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                          {isRtl ? 'إضافات حتى التقرير' : 'Additions'}
                        </th>
                        <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                          {isRtl ? 'قيمة قبل الإهلاك' : 'Gross Book Value'}
                        </th>
                        <th className="py-3 px-4 text-center">
                          {isRtl ? 'إجراءات' : 'Actions'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {assets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            {t.common.noData}
                          </td>
                        </tr>
                      ) : (
                        assets.map((a: any) => (
                          <tr key={a.id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-4 font-mono font-bold text-amber-800">{a.code}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-900">
                              <div className="font-semibold text-slate-900">
                                {(locale === 'en' || locale === 'id') && a.nameEn ? a.nameEn : a.name}
                              </div>
                              {locale === 'ar' && a.nameEn && (
                                <div className="text-[10px] text-slate-400 font-normal font-sans" dir="ltr">
                                  {a.nameEn}
                                </div>
                              )}
                              {locale !== 'ar' && a.name && a.name !== ((locale === 'en' || locale === 'id') && a.nameEn ? a.nameEn : a.name) && (
                                <div className="text-[10px] text-slate-400 font-normal" dir="rtl">
                                  {a.name}
                                </div>
                              )}
                              {a.notes && <div className="text-[10px] text-slate-500 mt-0.5">{a.notes}</div>}
                            </td>
                            <td className={`py-2.5 px-4 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                              {formatMoney(a.submittedValue)}
                            </td>
                            <td className={`py-2.5 px-4 font-mono font-medium text-slate-700 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                              {formatMoney(a.approvedOpening)}
                            </td>
                            <td className={`py-2.5 px-4 font-mono text-emerald-700 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                              {formatMoney(a.additionsAsOf)}
                            </td>
                            <td className={`py-2.5 px-4 font-mono font-bold text-slate-900 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                              {formatMoney(a.valueBeforeDepreciation)}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAsset(a)}
                                  title={isRtl ? 'تعديل الأصل' : 'Edit Asset'}
                                  className="p-1 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteAsset(a)}
                                  title={isRtl ? 'حذف الأصل' : 'Delete Asset'}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t border-slate-200 text-slate-900">
                      <tr>
                        <td colSpan={2} className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t.common.total}</td>
                        <td className={`py-3 px-4 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                          {formatMoney(assetTotals.totalSubmitted)}
                        </td>
                        <td className={`py-3 px-4 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                          {formatMoney(assetTotals.totalApprovedOpening)}
                        </td>
                        <td className={`py-3 px-4 font-mono text-emerald-800 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                          {formatMoney(assetTotals.totalAdditions)}
                        </td>
                        <td className={`py-3 px-4 font-mono text-amber-950 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                          {formatMoney(assetTotals.totalValueBeforeDepreciation)}
                        </td>
                        <td className="py-3 px-4"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PARTNERS */}
          {activeTab === 'PARTNERS' && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {isRtl ? 'جدول الشركاء وحساب رأس المال والأرباح المتراكمة' : 'Partners Capital & Retained Earnings'}
                </span>
                <Link
                  href="/parties"
                  className="text-xs font-semibold text-amber-700 hover:underline flex items-center gap-1"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{isRtl ? 'إدارة كافة الشركاء في دليل الأسماء' : 'Manage Partners in Directory'}</span>
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-3 px-4">{t.partners.partnerName}</th>
                      <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.partners.capitalContributed}</th>
                      <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                        {isRtl ? 'مساهمات إضافية' : 'Additions'}
                      </th>
                      <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.partners.withdrawals}</th>
                      <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.partners.netPartnerBalance}</th>
                      <th className="py-3 px-4 text-center">{t.partners.capitalSharePercent}</th>
                      <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.partners.profitShare}</th>
                      <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                        {isRtl ? 'أرباح مستلمة' : 'Received Profit'}
                      </th>
                      <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                        {isRtl ? 'ربح غير موزع' : 'Undistributed'}
                      </th>
                      <th className="py-3 px-4 text-center">
                        {isRtl ? 'إجراءات' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {partners.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center">
                          <div className="max-w-sm mx-auto space-y-2.5">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                              <Users className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm">
                              {isRtl ? 'لا يوجد شركاء مسجلون حالياً' : 'No Partners Registered'}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {isRtl
                                ? 'المؤسسة تعمل كملكية فردية. يمكنك إضافة شريك وتحديد نسبته في أي وقت عند الحاجة.'
                                : 'Sole proprietorship. You can add a partner and set their share anytime.'}
                            </p>
                            <Link
                              href="/parties"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isRtl ? 'إضافة شريك جديد' : 'Add Partner'}</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      partners.map((p: any) => (
                        <tr key={p.partnerId} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-amber-800">{p.partnerCode}</span>
                              <span>
                                {(locale === 'en' || locale === 'id') && p.partnerNameEn ? p.partnerNameEn : p.partnerName}
                              </span>
                            </div>
                            {(locale === 'en' || locale === 'id') && p.partnerNameEn && p.partnerName && (
                              <div className="text-[10px] text-slate-400 font-normal" dir="rtl">{p.partnerName}</div>
                            )}
                            {locale === 'ar' && p.partnerNameEn && (
                              <div className="text-[10px] text-slate-400 font-normal font-sans" dir="ltr">{p.partnerNameEn}</div>
                            )}
                          </td>
                          <td className={`py-3 px-4 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                            {formatMoney(p.openingCapital)}
                          </td>
                          <td className={`py-3 px-4 font-mono text-emerald-700 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                            {formatMoney(p.contributions)}
                          </td>
                          <td className={`py-3 px-4 font-mono text-rose-700 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                            {formatMoney(p.drawings)}
                          </td>
                          <td className={`py-3 px-4 font-mono font-bold text-slate-900 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                            {formatMoney(p.currentCapital)}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-800">
                            {(parseFloat(String(p.profitShareRatio || 0)) * 100).toFixed(0)}%
                          </td>
                          <td className={`py-3 px-4 font-mono font-bold text-emerald-800 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                            {formatMoney(p.cumulativeProfitShare)}
                          </td>
                          <td className={`py-3 px-4 font-mono text-slate-600 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                            {formatMoney(p.profitsReceived)}
                          </td>
                          <td className={`py-3 px-4 font-mono font-bold text-amber-900 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                            {formatMoney(p.undistributedProfit)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditPartner(p)}
                                title={isRtl ? 'تعديل بيانات الشريك' : 'Edit Partner'}
                                className="p-1 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <Link
                                href={`/parties/${p.partnerId}/statement`}
                                title={isRtl ? 'كشف الحساب' : 'Statement'}
                                className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                              >
                                <FileText className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: OPENING EQUITY */}
          {activeTab === 'EQUITY' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Opening Equity Match */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
                  <span>
                    {isRtl ? 'مطابقة تأسيس حقوق الملكية' : 'Opening Equity Match'}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                      Math.abs(parseFloat(String(eq.openingEquityDiff || 0))) < 0.01
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {Math.abs(parseFloat(String(eq.openingEquityDiff || 0))) < 0.01
                      ? isRtl ? 'مطابق 100%' : 'Balanced'
                      : isRtl ? 'يوجد فارق تأسيس' : 'Discrepancy'}
                  </span>
                </h3>

                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>{isRtl ? 'رصيد الخزينة النقدي (الكاش):' : 'Cash on Hand:'}</span>
                    <span className="font-mono font-bold" dir="ltr">{formatMoney(eq.openingCash)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>{isRtl ? 'رصيد الحساب البنكي:' : 'Bank Balance:'}</span>
                    <span className="font-mono font-bold text-blue-700" dir="ltr">{formatMoney(eq.openingBank)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>{t.dashboard.kpiInventoryValue}:</span>
                    <span className="font-mono font-bold" dir="ltr">{formatMoney(eq.openingInventoryValue)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>{t.dashboard.kpiCustomerDebts}:</span>
                    <span className="font-mono font-bold" dir="ltr">{formatMoney(eq.openingClientDebt)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>{t.partners.fixedAssetsTab}:</span>
                    <span className="font-mono font-bold" dir="ltr">{formatMoney(eq.approvedOpeningAssets)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700">
                    <span>
                      {isRtl ? 'ناقص ديون الموردين الافتتاحية:' : 'Less Supplier Debts:'}
                    </span>
                    <span className="font-mono font-bold" dir="ltr">({formatMoney(eq.openingSupplierDebt)})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-rose-700">
                    <span>
                      {isRtl ? 'ناقص تمويل الممولين الافتتاحي:' : 'Less Funder Debts:'}
                    </span>
                    <span className="font-mono font-bold" dir="ltr">({formatMoney(eq.openingFunderDebt)})</span>
                  </div>

                  <div className="flex justify-between py-2 border-t-2 border-slate-300 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>
                      {isRtl ? 'حقوق ملكية البداية:' : 'Total Opening Equity:'}
                    </span>
                    <span className="font-mono text-sm" dir="ltr">{formatMoney(eq.openingEquity)}</span>
                  </div>

                  <div className="flex justify-between py-2 font-bold text-slate-900 bg-amber-50 px-2 rounded">
                    <span>
                      {partners.length > 0
                        ? (isRtl ? 'حقوق موزعة على الشركاء:' : 'Allocated to Partners:')
                        : (isRtl ? 'رأس مال المؤسسة التأسيسي:' : 'Initial Business Equity:')}
                    </span>
                    <span className="font-mono text-sm" dir="ltr">{formatMoney(eq.allocatedPartnerEquity)}</span>
                  </div>

                  <div className="flex justify-between py-2 font-bold text-slate-900 bg-emerald-50 px-2 rounded">
                    <span>
                      {isRtl ? 'فرق توزيع الافتتاح:' : 'Allocation Variance:'}
                    </span>
                    <span className="font-mono text-sm" dir="ltr">{formatMoney(eq.openingEquityDiff)}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Funder Card (F001) */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">
                  {isRtl ? 'بطاقة تمويل الممولين / أخ المالك' : 'Funder / Investor Account'}
                </h3>
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>{isRtl ? 'تمويل افتتاحي:' : 'Opening Funding:'}</span>
                    <span className="font-mono font-bold" dir="ltr">{formatMoney(eq.openingFunderDebt)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>{isRtl ? 'الحساب الافتراضي للممول:' : 'Default Funder Account:'}</span>
                    <span className="font-bold text-amber-900">F001</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {isRtl
                      ? 'حركات تمويل أخ المالك تُسجل في شاشة الحسابات والمدفوعات بنوع تمويل (+) ورد تمويل (-)، ولا تدخل في الأرباح أو المصروفات التشغيلية.'
                      : 'Funder capital transactions are recorded under Cash & Payments as capital contribution (+) or return (-), and do not affect operating profit.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: Add or Edit Fixed Asset */}
      {(isAddAssetOpen || isEditAssetOpen) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setIsAddAssetOpen(false);
            setIsEditAssetOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {isAddAssetOpen
                  ? (isRtl ? 'إضافة أصل ثابت جديد' : 'Add New Fixed Asset')
                  : (isRtl ? `تعديل الأصل الثابت (${selectedAsset?.code})` : `Edit Fixed Asset (${selectedAsset?.code})`)}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddAssetOpen(false);
                  setIsEditAssetOpen(false);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {assetFormError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {assetFormError}
              </div>
            )}

            <form onSubmit={handleSaveAsset} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {locale === 'ar' ? 'اسم الأصل الثابت (بالعربية) *' : locale === 'id' ? 'Nama Aset Tetap (Arab) *' : 'Asset Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    placeholder={locale === 'ar' ? 'مثال: مكيف، ديكور المحل، ميزان بخور...' : locale === 'id' ? 'Contoh: AC, Dekorasi Toko...' : 'e.g. AC, Store Decor...'}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {locale === 'ar' ? 'اسم الأصل بالإنجليزية (English Name)' : locale === 'id' ? 'Nama Aset (Inggris / English)' : 'Asset Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={assetForm.nameEn}
                    onChange={(e) => setAssetForm({ ...assetForm, nameEn: e.target.value })}
                    placeholder="e.g. Store Interior & Decor"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-amber-500 focus:outline-none font-sans"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {isRtl ? 'القيمة المقدمة قبل التشغيل (روبية IDR)' : 'Pre-operation Submitted Value (IDR)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={assetForm.submittedValue}
                  onChange={(e) => setAssetForm({ ...assetForm, submittedValue: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-amber-500 focus:outline-none"
                  dir="ltr"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {isRtl
                    ? 'الأصول المشتراة قبل بدء النشاط تُدخل قيمتها هنا. أما الأصول المشتراة لاحقاً فتُدخل قيمتها كـ 0 ويتم سدادها من شاشة الحسابات والمدفوعات (شراء أصل).'
                    : 'Assets purchased before start are entered here. Assets purchased during operations are recorded via Cash Payments.'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {isRtl ? 'تاريخ الشراء / الاستحواذ' : 'Acquisition Date'}
                </label>
                <input
                  type="date"
                  value={assetForm.acquiredDate}
                  onChange={(e) => setAssetForm({ ...assetForm, acquiredDate: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-amber-500 focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {isRtl ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={assetForm.notes}
                  onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
                  placeholder={isRtl ? 'أي تفاصيل عن الأصل أو الضمان أو الفاتورة...' : 'Notes or warranty details...'}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAssetOpen(false);
                    setIsEditAssetOpen(false);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={assetSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                >
                  {assetSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{t.common.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Delete Fixed Asset Confirmation */}
      {isDeleteAssetOpen && selectedAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsDeleteAssetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 border-b pb-3">
              <div className="rounded-full bg-rose-100 p-2">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {isRtl ? 'تأكيد حذف الأصل الثابت' : 'Confirm Delete Asset'}
              </h3>
            </div>

            {assetFormError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {assetFormError}
              </div>
            )}

            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p>
                {isRtl ? 'هل أنت متأكد من حذف هذا الأصل من السجل؟' : 'Are you sure you want to delete this asset?'}
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-slate-800">
                <span className="font-bold text-amber-900">{selectedAsset.code}</span> — {selectedAsset.name}
              </div>
              <p className="text-[11px] text-slate-500">
                {isRtl
                  ? 'إذا كان الأصل مرتبطاً بحركة شراء نقدية مسجلة في الصندوق، سيمنع النظام الحذف لحماية صحة الحسابات.'
                  : 'If this asset has linked cash purchase payments, deletion will be blocked.'}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsDeleteAssetOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeleteAsset}
                disabled={assetSubmitting}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                {assetSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isRtl ? 'نعم، حذف الأصل' : 'Yes, Delete Asset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Partner Info */}
      {isEditPartnerOpen && selectedPartner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsEditPartnerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {isRtl ? `تعديل بيانات الشريك (${selectedPartner.partnerCode})` : `Edit Partner (${selectedPartner.partnerCode})`}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditPartnerOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {partnerFormError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {partnerFormError}
              </div>
            )}

            <form onSubmit={handleSavePartner} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {locale === 'ar' ? 'اسم الشريك (بالعربية) *' : locale === 'id' ? 'Nama Mitra (Arab) *' : 'Partner Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerForm.name}
                    onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {locale === 'ar' ? 'الاسم بالإنجليزية (English Name)' : locale === 'id' ? 'Nama Mitra (Inggris / English)' : 'Partner Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={partnerForm.nameEn}
                    onChange={(e) => setPartnerForm({ ...partnerForm, nameEn: e.target.value })}
                    placeholder="e.g. Partner Name"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-amber-500 focus:outline-none font-sans"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {isRtl ? 'نسبة الشراكة والأرباح المتفق عليها (%)' : 'Agreed Profit Share Ratio (%)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={partnerForm.profitShareRatio}
                  onChange={(e) => setPartnerForm({ ...partnerForm, profitShareRatio: e.target.value })}
                  placeholder="مثال: 60"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-amber-500 focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {isRtl ? 'رأس مال أول المدة (روبية IDR)' : 'Opening Capital (IDR)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={partnerForm.openingCapital}
                  onChange={(e) => setPartnerForm({ ...partnerForm, openingCapital: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-amber-500 focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditPartnerOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={partnerSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                >
                  {partnerSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{t.common.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
