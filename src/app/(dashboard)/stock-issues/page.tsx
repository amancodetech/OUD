'use client';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import {
  PackageMinus,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  FlaskConical,
  Gift,
  Trash2,
  Calendar,
  Layers,
  X,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Info,
} from 'lucide-react';
import { QtyInput } from '@/components/forms/QtyInput';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';
import { useI18n } from '@/i18n/LanguageContext';

interface StockIssueItem {
  id: string;
  code: string;
  issueDate: string;
  type: 'TESTER' | 'SAMPLE' | 'DAMAGED';
  itemId: string;
  qty: number;
  testerRef: string | null;
  reason: string;
  notes: string | null;
  status: 'POSTED' | 'VOID';
  voidReason?: string | null;
  voidedAt?: string | null;
  unitCost: number;
  issueCost: number;
  item: {
    id: string;
    code: string;
    name: string;
    unit: {
      id: string;
      name: string;
    };
  };
}

export default function StockIssuesPage() {
  const { t, locale, isRtl, tUnit, tLocalizedName } = useI18n();
  const [issues, setIssues] = useState<StockIssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Items for dropdown
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // New Issue Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [issueDate, setIssueDate] = useState(todayInStore());
  const [type, setType] = useState<'TESTER' | 'SAMPLE' | 'DAMAGED'>('TESTER');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [testerRef, setTesterRef] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Void Modal
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [targetIssue, setTargetIssue] = useState<StockIssueItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState('');

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const url = filterType !== 'ALL' ? `/api/stock-issues?type=${filterType}` : '/api/stock-issues';
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setIssues(data);
      }
    } catch (e) {
      console.error('Error fetching stock issues', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await fetch('/api/items');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      setItems(list);
    } catch (e) {
      console.error('Error fetching items', e);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [filterType]);

  useEffect(() => {
    fetchItems();
  }, []);

  const selectedItemObj = items.find((i) => i.id === selectedItemId);

  const getReasonPlaceholder = () => {
    switch (type) {
      case 'TESTER':
        return locale === 'ar'
          ? 'مثال: تستر للعرض في واجهة المحل / تجربة زبائن على الكاونتر'
          : 'e.g. Counter display tester / in-store customer testing';
      case 'SAMPLE':
        return locale === 'ar'
          ? 'مثال: عينة إهداء لعميل VIP / ضيافة في مناسبة ترويجية'
          : 'e.g. VIP client gift sample / promotional event hospitality';
      case 'DAMAGED':
        return locale === 'ar'
          ? 'مثال: كسر زجاجة أثناء الترتيب / تلف بالحرارة أو انتهاء صلاحية'
          : 'e.g. Broken bottle during shelving / heat damage or expired';
      default:
        return locale === 'ar'
          ? 'مثال: سبب أو مناسبة صرف المخزون...'
          : 'e.g. Reason for stock issue...';
    }
  };

  const getReasonSuggestions = () => {
    switch (type) {
      case 'TESTER':
        return locale === 'ar'
          ? ['تستر عرض في المحل', 'تجربة زبائن على الكاونتر', 'تجديد تستر مستهلك']
          : false
          ? ['Tester display toko', 'Tester pelanggan konter', 'Ganti tester habis']
          : ['Store display tester', 'Counter customer trial', 'Replace used tester'];
      case 'SAMPLE':
        return locale === 'ar'
          ? ['عينة إهداء لعميل VIP', 'ضيافة مناسبة ترويجية', 'عينة تسويقية لمعرض']
          : false
          ? ['Hadiah pelanggan VIP', 'Jamuan acara promosi', 'Sampel pameran']
          : ['VIP client gift sample', 'Promotional hospitality', 'Exhibition marketing sample'];
      case 'DAMAGED':
        return locale === 'ar'
          ? ['كسر زجاجة أثناء الترتيب', 'تلف بالحرارة أو سوء تخزين', 'عيب مصنعي أو تسريب']
          : false
          ? ['Botol pecah saat penataan', 'Rusak karena panas / simpan', 'Cacat pabrik / bocor']
          : ['Broken during shelving', 'Heat damage / storage issue', 'Manufacturing defect / leak'];
      default:
        return [];
    }
  };

  // Totals for KPIs (posted only)
  const postedIssues = issues.filter((i) => i.status === 'POSTED');
  const testerTotal = postedIssues
    .filter((i) => i.type === 'TESTER')
    .reduce((sum, i) => sum + (i.issueCost || 0), 0);
  const sampleTotal = postedIssues
    .filter((i) => i.type === 'SAMPLE')
    .reduce((sum, i) => sum + (i.issueCost || 0), 0);
  const damagedTotal = postedIssues
    .filter((i) => i.type === 'DAMAGED')
    .reduce((sum, i) => sum + (i.issueCost || 0), 0);
  const grandTotal = testerTotal + sampleTotal + damagedTotal;

  // Filtered rows by search
  const filteredIssues = issues.filter((iss) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      iss.code.toLowerCase().includes(q) ||
      iss.item.name.toLowerCase().includes(q) ||
      iss.item.code.toLowerCase().includes(q) ||
      iss.reason.toLowerCase().includes(q) ||
      (iss.testerRef && iss.testerRef.toLowerCase().includes(q))
    );
  });

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedItemId) {
      setFormError(
        locale === 'ar'
          ? 'يرجى اختيار الصنف'
          : 'Please select an item'
      );
      return;
    }
    if (!qty || Number(qty) <= 0) {
      setFormError(
        locale === 'ar'
          ? 'الكمية يجب أن تكون أكبر من الصفر'
          : 'Quantity must be greater than zero'
      );
      return;
    }
    if (!reason.trim()) {
      setFormError(
        locale === 'ar'
          ? 'أدخل السبب أو المناسبة لصرف المخزون'
          : 'Enter the reason for stock issue'
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/stock-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueDate,
          type,
          itemId: selectedItemId,
          qty: Number(qty),
          testerRef: type === 'TESTER' ? testerRef.trim() || null : null,
          reason: reason.trim(),
          notes: notes.trim() || null,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to save stock issue');
      }

      setIsModalOpen(false);
      resetModalForm();
      fetchIssues();
      fetchItems();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetIssue) return;
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
      const res = await fetch(`/api/stock-issues/${targetIssue.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to void stock issue');
      }

      setVoidModalOpen(false);
      setTargetIssue(null);
      setVoidReason('');
      fetchIssues();
      fetchItems();
    } catch (err: any) {
      setVoidError(err.message || 'Error occurred while voiding issue');
    } finally {
      setVoiding(false);
    }
  };

  const resetModalForm = () => {
    setIssueDate(todayInStore());
    setType('TESTER');
    setSelectedItemId('');
    setQty(1);
    setTesterRef('');
    setReason('');
    setNotes('');
    setFormError('');
  };

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <PackageMinus className="w-6 h-6 text-amber-600" />
            {t.stockIssues.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t.stockIssues.subtitle}
          </p>
        </div>

        <button
          onClick={() => {
            resetModalForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.stockIssues.newIssue}
        </button>
      </div>

      {/* Strict Reminder Alert Banner (Spec 10 / Slide 26) */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <div className="text-sm leading-relaxed">
          <span className="font-bold">
            {locale === 'ar' ? 'تنبيه صارم: ' : 'Important Notice: '}
          </span>
          {locale === 'ar'
            ? 'لا تُكرر هنا تسجيل المرتجع التالف من عميل (فهو يُعالج تلقائياً في شاشة المرتجعات كمصروف تلف مرتجع)، ولا تُسجل عبوة التستر كاملة هنا ثم تعود لتسجيل استهلاكها بالجرام مرة أخرى.'
            : 'Do not re-record damaged customer returns here (they are automatically handled in the Returns module as Damaged Return Expense), and do not record a full tester bottle here and then log its gram usage again.'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t.stockIssues.totalTester}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-2" dir="ltr">
            {testerTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-gray-500">IDR</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t.stockIssues.totalSample}</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-2" dir="ltr">
            {sampleTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-gray-500">IDR</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t.stockIssues.totalDamaged}</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-2" dir="ltr">
            {damagedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-gray-500">IDR</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t.stockIssues.grandTotal}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2" dir="ltr">
            {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-gray-500">IDR</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: t.common.all },
            { id: 'TESTER', label: t.stockIssues.typeTester },
            { id: 'SAMPLE', label: t.stockIssues.typeSample },
            { id: 'DAMAGED', label: t.stockIssues.typeDamaged },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterType === tab.id
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3' : 'left-3'} top-2.5 text-gray-400`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.stockIssues.searchPlaceholder}
            className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500`}
          />
        </div>
      </div>

      {/* Stock Issues Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-500">{t.common.loading}</div>
        ) : filteredIssues.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <PackageMinus className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-base font-semibold">{t.common.noData}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="p-3.5">{t.stockIssues.issueNo} & {t.stockIssues.issueDate}</th>
                  <th className="p-3.5">{t.stockIssues.issueType}</th>
                  <th className="p-3.5">{t.purchases.item}</th>
                  <th className="p-3.5 text-center">{t.purchases.qty}</th>
                  <th className={`p-3.5 ${isRtl ? 'text-left' : 'text-right'}`}>{t.stockIssues.unitCost}</th>
                  <th className={`p-3.5 ${isRtl ? 'text-left' : 'text-right'}`}>{t.stockIssues.issueCost}</th>
                  <th className="p-3.5">{t.stockIssues.testerRef} / {t.returns.reason}</th>
                  <th className="p-3.5 text-center">{t.common.status}</th>
                  <th className="p-3.5 text-center">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredIssues.map((iss) => {
                  const dateStr = iss.issueDate
                    ? new Date(iss.issueDate).toLocaleDateString(dateLocale)
                    : '';
                  const isVoid = iss.status === 'VOID';

                  return (
                    <tr
                      key={iss.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                        isVoid ? 'opacity-60 bg-gray-50/50 dark:bg-gray-900/50' : ''
                      }`}
                    >
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-gray-900 dark:text-white">
                          {iss.code}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{dateStr}</div>
                      </td>

                      <td className="p-3.5">
                        {iss.type === 'TESTER' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            <FlaskConical className="w-3 h-3" />
                            {t.stockIssues.typeTester}
                          </span>
                        )}
                        {iss.type === 'SAMPLE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                            <Gift className="w-3 h-3" />
                            {t.stockIssues.typeSample}
                          </span>
                        )}
                        {iss.type === 'DAMAGED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <AlertTriangle className="w-3 h-3" />
                            {t.stockIssues.typeDamaged}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {tLocalizedName(iss.item, locale)}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">{iss.item.code}</div>
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-gray-900 dark:text-white" dir="ltr">
                        {iss.qty}{' '}
                        <span className="text-xs font-normal text-gray-500">
                          {tUnit(iss.item.unit.name)}
                        </span>
                      </td>

                      <td className={`p-3.5 ${isRtl ? 'text-left' : 'text-right'} font-mono text-gray-600 dark:text-gray-300`} dir="ltr">
                        {(iss.unitCost || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        IDR
                      </td>

                      <td className={`p-3.5 ${isRtl ? 'text-left' : 'text-right'} font-mono font-bold text-amber-600 dark:text-amber-400`} dir="ltr">
                        {(iss.issueCost || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        IDR
                      </td>

                      <td className="p-3.5 max-w-xs">
                        {iss.testerRef && (
                          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            [{iss.testerRef}]
                          </div>
                        )}
                        <div className="text-xs text-gray-700 dark:text-gray-300 truncate" title={iss.reason}>
                          {iss.reason}
                        </div>
                        {iss.notes && (
                          <div className="text-[11px] text-gray-400 truncate" title={iss.notes}>
                            {t.common.notes}: {iss.notes}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {isVoid ? (
                          <span
                            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                            title={`ملغى: ${iss.voidReason || ''}`}
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
                              setTargetIssue(iss);
                              setVoidReason('');
                              setVoidError('');
                              setVoidModalOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title={t.stockIssues.voidTitle}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Stock Issue Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl max-w-xl w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <PackageMinus className="w-5 h-5 text-amber-600" />
                {t.stockIssues.newIssue}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t.stockIssues.issueDate} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t.stockIssues.issueType} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="TESTER">{t.stockIssues.typeTester}</option>
                    <option value="SAMPLE">{t.stockIssues.typeSample}</option>
                    <option value="DAMAGED">{t.stockIssues.typeDamaged}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t.purchases.item} <span className="text-red-500">*</span>
                </label>
                <SearchableCombobox
                  options={items.map((i) => ({
                    value: i.id,
                    label: i.name,
                    subtitle: `كود: ${i.code} | ${i.availableStock || 0} ${tUnit(i.unit?.name)}`,
                  }))}
                  value={selectedItemId}
                  onChange={(v) => setSelectedItemId(v)}
                  placeholder={loadingItems ? t.common.loading : t.stockIssues.selectItem}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {locale === 'ar' ? 'الكمية المصروفة' : 'Quantity to Issue'} <span className="text-red-500">*</span>
                  </label>
                  <QtyInput
                    value={qty}
                    unitName={tUnit(selectedItemObj?.unit?.name) || ''}
                    onChange={(v) => setQty(Number(v) || 0)}
                  />
                </div>

                {type === 'TESTER' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {t.stockIssues.testerRef}
                    </label>
                    <input
                      type="text"
                      value={testerRef}
                      onChange={(e) => setTesterRef(e.target.value)}
                      placeholder={
                        locale === 'ar'
                          ? 'مثال: تستر الواجهة أو رقم 1'
                          : 'e.g. Display Tester 1'
                      }
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                ) : (
                  <div className="hidden sm:block"></div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t.returns.reason} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={getReasonPlaceholder()}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
                <div className="mt-1.5 flex items-center flex-wrap gap-1.5">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {locale === 'ar' ? 'أمثلة مقترحة:' : 'Quick examples:'}
                  </span>
                  {getReasonSuggestions().map((sugg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReason(sugg)}
                      className="inline-block px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer"
                      title={locale === 'ar' ? 'اضغط للإدراج المباشر' : 'Click to insert'}
                    >
                      {sugg}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t.common.notes}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    locale === 'ar'
                      ? 'أي توضيحات أخرى...'
                      : 'Any additional notes...'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {submitting ? t.common.loading : t.stockIssues.saveIssue}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModalOpen && targetIssue && (
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
              {t.stockIssues.voidTitle} ({targetIssue.code})
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {locale === 'ar' ? (
                <>
                  سيتم إلغاء الإذن المحاسبي والمخزني وإعادة الكمية ({targetIssue.qty} {tUnit(targetIssue.item.unit.name)}) إلى المخزون.
                </>
              ) : (
                <>
                  Stock issue and accounting entry will be voided, quantity ({targetIssue.qty} {tUnit(targetIssue.item.unit.name)}) will return to warehouse stock.
                </>
              )}
            </p>

            {voidError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                {voidError}
              </div>
            )}

            <form onSubmit={handleVoidIssue} className="space-y-4">
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
