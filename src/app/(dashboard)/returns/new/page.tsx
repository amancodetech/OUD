'use client';
import { useUiText } from '@/i18n/interface-text';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RotateCcw,
  ArrowRight,
  Save,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  User,
  Package,
  Layers,
  DollarSign,
  Calendar,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { QtyInput } from '@/components/forms/QtyInput';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';
import { QuickAddPartyModal } from '@/components/forms/QuickAddPartyModal';

interface SourceLineOption {
  id: string;
  code: string;
  itemId: string;
  itemName: string;
  unitName: string;
  originalQty: number;
  alreadyReturnedQty: number;
  remainingReturnableQty: number;
  originalNetUnitPrice: number;
}

export default function NewReturnPage() {
  const [operationKey] = useState(() => crypto.randomUUID());

  const ui = useUiText();

  const router = useRouter();

  // Step 1: Return Type
  const [returnType, setReturnType] = useState<'SALE_RETURN' | 'PURCHASE_RETURN'>('SALE_RETURN');

  // Step 2: Party Selection
  const [partyId, setPartyId] = useState('');
  const [parties, setParties] = useState<any[]>([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [quickAddPartyOpen, setQuickAddPartyOpen] = useState(false);

  // Step 3: Source Invoice
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceKey, setSelectedInvoiceKey] = useState('');

  // Step 4: Source Lines
  const [sourceLines, setSourceLines] = useState<SourceLineOption[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState('');

  // Step 5: Return Entry Fields
  const [returnDate, setReturnDate] = useState(todayInStore());
  const [returnDocNo, setReturnDocNo] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [saleReturnCondition, setSaleReturnCondition] = useState<'GOOD' | 'DAMAGED'>('GOOD');
  const [refundCashNow, setRefundCashNow] = useState(false);
  const [refundAccount, setRefundAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [supplierCreditNote, setSupplierCreditNote] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 1. Fetch parties when return type changes
  useEffect(() => {
    async function fetchParties() {
      setLoadingParties(true);
      setPartyId('');
      setSelectedInvoiceKey('');
      setSelectedLineId('');
      setSourceLines([]);
      setInvoices([]);
      try {
        const pType = returnType === 'SALE_RETURN' ? 'CLIENT' : 'SUPPLIER';
        const res = await fetch(`/api/parties?type=${pType}`);
        const json = await res.json();
        const list = Array.isArray(json) ? json : json.data || [];
        setParties(list);
      } catch (e) {
        console.error('Failed to fetch parties', e);
      } finally {
        setLoadingParties(false);
      }
    }
    fetchParties();
  }, [returnType]);

  // 2. Fetch invoices when party is selected
  useEffect(() => {
    if (!partyId) {
      setInvoices([]);
      setSelectedInvoiceKey('');
      setSourceLines([]);
      setSelectedLineId('');
      return;
    }

    async function fetchInvoices() {
      setLoadingInvoices(true);
      setSelectedInvoiceKey('');
      setSelectedLineId('');
      setSourceLines([]);
      try {
        if (returnType === 'SALE_RETURN') {
          const res = await fetch(`/api/returns/source-invoices?type=SALE_RETURN&partyId=${encodeURIComponent(partyId)}`);
          const json = await res.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setInvoices(list);
        } else {
          const res = await fetch(`/api/returns/source-invoices?type=PURCHASE_RETURN&partyId=${encodeURIComponent(partyId)}`);
          const json = await res.json();
          const list = Array.isArray(json) ? json : json.data || [];
          setInvoices(list);
        }
      } catch (e) {
        console.error('Failed to fetch invoices', e);
      } finally {
        setLoadingInvoices(false);
      }
    }
    fetchInvoices();
  }, [partyId, returnType]);

  // 3. Fetch source lines when invoice is selected
  useEffect(() => {
    if (!selectedInvoiceKey) {
      setSourceLines([]);
      setSelectedLineId('');
      return;
    }

    async function fetchLines() {
      setLoadingLines(true);
      setSelectedLineId('');
      try {
        const res = await fetch(
          `/api/returns/source-lines?invoiceKey=${encodeURIComponent(
            selectedInvoiceKey
          )}&type=${returnType}&partyId=${encodeURIComponent(partyId)}`
        );
        const json = await res.json();
        if (Array.isArray(json)) {
          setSourceLines(json);
          // Auto select first line if available and has returnable qty
          const firstEligible = json.find((l: SourceLineOption) => l.remainingReturnableQty > 0);
          if (firstEligible) {
            setSelectedLineId(firstEligible.id);
            setQty(1);
          }
        } else {
          setSourceLines([]);
        }
      } catch (e) {
        console.error('Failed to fetch source lines', e);
      } finally {
        setLoadingLines(false);
      }
    }
    fetchLines();
  }, [selectedInvoiceKey, returnType]);

  // Selected Line Object
  const selectedLine = sourceLines.find((l) => l.id === selectedLineId);

  // Max allowed quantity
  const maxQty = selectedLine ? selectedLine.remainingReturnableQty : 0;

  // Set default return doc no suggestion
  useEffect(() => {
    if (!returnDocNo) {
      const prefix = returnType === 'SALE_RETURN' ? 'RT-SAL' : 'RT-PUR';
      const rand = Math.floor(1000 + Math.random() * 9000);
      setReturnDocNo(`${prefix}-${rand}`);
    }
  }, [returnType]);

  // Calculations
  const unitPrice = selectedLine?.originalNetUnitPrice || 0;
  const calculatedTotal = (Number(qty) || 0) * unitPrice;
  const finalRefundAmount =
    returnType === 'PURCHASE_RETURN' && supplierCreditNote !== null && supplierCreditNote !== undefined
      ? supplierCreditNote
      : calculatedTotal;

  // Handle Form Submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const errors: Record<string, string> = {};

    if (!partyId) errors.partyId = 'يرجى اختيار الطرف';
    if (!selectedInvoiceKey) errors.selectedInvoiceKey = 'يرجى اختيار الفاتورة الأصلية';
    if (!selectedLineId) errors.selectedLineId = 'يرجى اختيار سطر الفاتورة المراد إرجاعه';
    if (!returnDocNo.trim()) errors.returnDocNo = 'رقم المستند إلزامي';
    if (!qty || Number(qty) <= 0) errors.qty = 'الكمية يجب أن تكون أكبر من صفر';
    if (selectedLine && Number(qty) > selectedLine.remainingReturnableQty) {
      errors.qty = `الكمية تتجاوز الحد المتبقي القابل للإرجاع (${selectedLine.remainingReturnableQty})`;
    }
    if (!reason.trim()) errors.reason = 'سبب الإرجاع إلزامي ولا يمكن تركه فارغاً';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('يرجى تصحيح الحقول المميزة باللون الأحمر');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        type: returnType,
        returnDate,
        returnDocNo: returnDocNo.trim(),
        partyId,
        invoiceKey: selectedInvoiceKey,
        qty: Number(qty),
        reason: reason.trim(),
        notes: notes ? notes.trim() : null,
      };

      if (returnType === 'SALE_RETURN') {
        payload.sourceSaleLineId = selectedLineId;
        payload.saleReturnCondition = saleReturnCondition;
        payload.refundCashNow = refundCashNow;
        if (refundCashNow) {
          payload.refundAccount = refundAccount;
        }
      } else {
        payload.sourcePurchaseLineId = selectedLineId;
        if (supplierCreditNote !== null && supplierCreditNote !== undefined) {
          payload.supplierCreditNote = Number(supplierCreditNote);
        }
      }

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationKey },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'فشل في حفظ المرتجع');
      }

      router.push('/returns');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ المرتجع');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/returns"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={ui("رجوع للمرتجعات")}
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-amber-600" />
              {ui("تسجيل مرتجع جديد")}</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mr-9">
            {ui("ربط إلزامي بالفاتورة الأصلية والتحقق الصارم من سقف الكمية التراكمي")}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/returns"
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            {ui("إلغاء")}</Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {submitting ? ui("جاري الحفظ...") : ui("حفظ وترحيل المرتجع")}
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

      {/* Main Form Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Return Type Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
            {ui("1. نوع المرتجع")}<span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setReturnType('SALE_RETURN')}
              className={`p-4 rounded-xl border-2 text-right transition-all flex items-start gap-4 ${
                returnType === 'SALE_RETURN'
                  ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 shadow-sm'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  returnType === 'SALE_RETURN'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}
              >
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-base">{ui("مرتجع بيع (من عميل)")}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {ui("استرجاع بضاعة مباعة مسبقاً من عميل، مع تحديد الحالة (صالح/تالف) وخيار رد المبلغ نقداً.")}</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setReturnType('PURCHASE_RETURN')}
              className={`p-4 rounded-xl border-2 text-right transition-all flex items-start gap-4 ${
                returnType === 'PURCHASE_RETURN'
                  ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200 shadow-sm'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  returnType === 'PURCHASE_RETURN'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}
              >
                <RotateCcw className="w-5 h-5 transform rotate-180" />
              </div>
              <div>
                <div className="font-bold text-base">{ui("مرتجع شراء (إلى مورد)")}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {ui("إعادة بضاعة تم شراؤها إلى المورد، مع حساب فروق المرتجع وإشعار دائن المورد.")}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2 & 3: Party & Invoice Selection */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-gray-500" />
            {ui("2. اختيار الطرف والفاتورة الأصلية")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Party Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {returnType === 'SALE_RETURN' ? ui("العميل") : ui("المورد")}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setQuickAddPartyOpen(true)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                >
                  {ui("+ إضافة سريعاً")}</button>
              </div>

              <SearchableCombobox
                options={parties.map((p) => ({
                  value: p.id,
                  label: p.name,
                  subtitle: p.code,
                }))}
                value={partyId}
                onChange={(val) => {
                  setPartyId(val);
                  setFieldErrors((prev) => ({ ...prev, partyId: '' }));
                }}
                placeholder={
                  loadingParties
                    ? ui("جاري التحميل...")
                    : returnType === 'SALE_RETURN'
                    ? ui("اختر العميل...")
                    : ui("اختر المورد...")
                }
                onQuickAdd={() => setQuickAddPartyOpen(true)}
                quickAddLabel="إضافة طرف جديد"
              />
              {fieldErrors.partyId && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.partyId}</p>
              )}
            </div>

            {/* Invoice Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {ui("الفاتورة الأصلية")}<span className="text-red-500">*</span>
              </label>
              <select
                value={selectedInvoiceKey}
                onChange={(e) => {
                  setSelectedInvoiceKey(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, selectedInvoiceKey: '' }));
                }}
                disabled={!partyId || loadingInvoices}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">
                  {!partyId
                    ? ui("اختر الطرف أولاً لتظهر فواتيره")
                    : loadingInvoices
                    ? ui("جاري تحميل الفواتير...")
                    : invoices.length === 0
                    ? ui("لا توجد فواتير مرحلة لهذا الطرف")
                    : ui("اختر الفاتورة الأصلية...")}
                </option>
                {invoices.map((inv) => {
                  const key = inv.invoiceKey;
                  const dateStr = inv.invoiceDate
                    ? new Date(inv.invoiceDate).toISOString().split('T')[0]
                    : '';
                  const total = inv.netTotal || inv.totalAmount || 0;
                  return (
                    <option key={inv.id} value={key}>
                      {key} {ui("| تاريخ:")}{dateStr} {ui("| الإجمالي:")}{Number(total).toLocaleString('en-US')}{' '}
                      {ui("ر.س")}</option>
                  );
                })}
              </select>
              {fieldErrors.selectedInvoiceKey && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.selectedInvoiceKey}</p>
              )}
            </div>
          </div>
        </div>

        {/* Step 4: Source Lines Card */}
        {selectedInvoiceKey && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-gray-500" />
                {ui("3. اختر سطر الفاتورة المراد إرجاعه")}</h2>
              <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-1 rounded-full font-semibold">
                {ui("الفاتورة:")}{selectedInvoiceKey}
              </span>
            </div>

            {loadingLines ? (
              <div className="text-center py-6 text-sm text-gray-500">{ui("جاري تحميل سطور الفاتورة...")}</div>
            ) : sourceLines.length === 0 ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center text-sm text-gray-500">
                {ui("لا توجد سطور مؤهلة للإرجاع في هذه الفاتورة")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase">
                    <tr>
                      <th className="p-3">{ui("اختيار")}</th>
                      <th className="p-3">{ui("كود السطر")}</th>
                      <th className="p-3">{ui("الصنف")}</th>
                      <th className="p-3 text-center">{ui("الكمية الأصلية")}</th>
                      <th className="p-3 text-center">{ui("المرتجع سابقاً")}</th>
                      <th className="p-3 text-center">{ui("المتبقي القابل للإرجاع")}</th>
                      <th className="p-3 text-left">{ui("صافي سعر الوحدة الأصلي")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sourceLines.map((line) => {
                      const isSelected = selectedLineId === line.id;
                      const isExhausted = line.remainingReturnableQty <= 0;

                      return (
                        <tr
                          key={line.id}
                          onClick={() => {
                            if (!isExhausted) {
                              setSelectedLineId(line.id);
                              setFieldErrors((prev) => ({ ...prev, selectedLineId: '' }));
                              if (qty > line.remainingReturnableQty) {
                                setQty(line.remainingReturnableQty);
                              }
                            }
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-50/70 dark:bg-amber-950/30'
                              : isExhausted
                              ? 'opacity-50 bg-gray-50 dark:bg-gray-900 cursor-not-allowed'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <td className="p-3">
                            <input
                              type="radio"
                              name="sourceLine"
                              checked={isSelected}
                              disabled={isExhausted}
                              onChange={() => setSelectedLineId(line.id)}
                              className="text-amber-600 focus:ring-amber-500"
                            />
                          </td>
                          <td className="p-3 font-mono font-medium text-gray-800 dark:text-gray-200">
                            {line.code}
                          </td>
                          <td className="p-3 font-bold text-gray-900 dark:text-white">
                            {line.itemName}
                          </td>
                          <td className="p-3 text-center text-gray-700 dark:text-gray-300">
                            {line.originalQty} {line.unitName}
                          </td>
                          <td className="p-3 text-center text-gray-500">
                            {line.alreadyReturnedQty} {line.unitName}
                          </td>
                          <td className="p-3 text-center font-bold">
                            {isExhausted ? (
                              <span className="text-red-500 text-xs">{ui("تم إرجاع كامل الكمية")}</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {line.remainingReturnableQty} {line.unitName}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-gray-900 dark:text-white">
                            {line.originalNetUnitPrice.toFixed(2)} {ui("ر.س")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {fieldErrors.selectedLineId && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.selectedLineId}</p>
            )}
          </div>
        )}

        {/* Step 5: Return Entry Parameters */}
        {selectedLine && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-500" />
              {ui("4. تفاصيل المرتجع والشروط")}</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Return Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {ui("تاريخ المرتجع")}<span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Doc No */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {ui("رقم مستند المرتجع / الإشعار")}<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={returnDocNo}
                  onChange={(e) => {
                    setReturnDocNo(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, returnDocNo: '' }));
                  }}
                  placeholder={ui("مثال: RT-001")}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                />
                {fieldErrors.returnDocNo && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.returnDocNo}</p>
                )}
              </div>

              {/* Return Qty */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {ui("الكمية المرتجعة")}<span className="text-red-500">*</span> {ui("(حد أقصى:")}{maxQty}{' '}
                  {selectedLine.unitName})
                </label>
                <QtyInput
                  value={qty}
                  unitName={selectedLine.unitName}
                  onChange={(v) => {
                    const num = Number(v) || 0;
                    setQty(num);
                    setFieldErrors((prev) => ({ ...prev, qty: '' }));
                  }}
                />
                {fieldErrors.qty && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.qty}</p>
                )}
              </div>
            </div>

            {/* Condition for Sales Return */}
            {returnType === 'SALE_RETURN' && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    {ui("حالة البضاعة المرتجعة")}<span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                        saleReturnCondition === 'GOOD'
                          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="condition"
                        value="GOOD"
                        checked={saleReturnCondition === 'GOOD'}
                        onChange={() => setSaleReturnCondition('GOOD')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="font-bold text-sm">{ui("صالح (GOOD)")}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {ui("يعود للمخزون المتاح بسعر تكلفة شهر البيع الأصلي")}</div>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                        saleReturnCondition === 'DAMAGED'
                          ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20 text-red-900 dark:text-red-300'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="condition"
                        value="DAMAGED"
                        checked={saleReturnCondition === 'DAMAGED'}
                        onChange={() => setSaleReturnCondition('DAMAGED')}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <div>
                        <div className="font-bold text-sm">{ui("تالف (DAMAGED)")}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {ui("لا يعود للمخزون، ويُحمل كمصروف تلف مرتجع في قائمة الدخل")}</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Instant Cash Refund Feature */}
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refundCashNow}
                      onChange={(e) => setRefundCashNow(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="font-bold text-sm text-gray-900 dark:text-white">
                      {ui("تسجيل رد المبلغ نقداً للعميل الآن (سداد فوري)")}</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mr-6">
                    {ui("يقوم بإنشاء حركة صرف نقدية تلقائية (CUSTOMER_REFUND) بقيمة المرتجع (")}{calculatedTotal.toFixed(2)} {ui("ر.س) داخل نفس العملية المحاسبية.")}</p>

                  {refundCashNow && (
                    <div className="mr-6 pt-2 flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {ui("الحساب المنصرف منه:")}</span>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="refundAccount"
                          value="CASH"
                          checked={refundAccount === 'CASH'}
                          onChange={() => setRefundAccount('CASH')}
                          className="text-amber-600"
                        />
                        {ui("الخزينة النقدية (CASH)")}</label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="refundAccount"
                          value="BANK"
                          checked={refundAccount === 'BANK'}
                          onChange={() => setRefundAccount('BANK')}
                          className="text-amber-600"
                        />
                        {ui("الحساب البنكي (BANK)")}</label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Supplier Credit Note for Purchase Return */}
            {returnType === 'PURCHASE_RETURN' && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-2">
                  <label className="block text-sm font-semibold text-purple-950 dark:text-purple-200">
                    {ui("قيمة إشعار دائن المورد الفعلي (اختياري)")}</label>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {ui("إذا كان المورد أصدر إشعاراً بقيمة محددة تختلف عن صافي الشراء، أدخل القيمة هنا لحساب فروق المرتجع (PurchaseVariance) بدقة. إذا تُرِك فارغاً، يُحسب تلقائياً (")}{calculatedTotal.toFixed(2)} {ui("ر.س).")}</p>
                  <div className="max-w-xs pt-1">
                    <MoneyInput
                      value={supplierCreditNote ?? ''}
                      onChange={(v) => setSupplierCreditNote(v ? Number(v) : null)}
                      placeholder={calculatedTotal.toFixed(2)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Reason & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {ui("سبب الإرجاع")}<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, reason: '' }));
                  }}
                  placeholder={ui("مثال: الصنف غير مطابق للمواصفات المطلوبة")}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                />
                {fieldErrors.reason && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.reason}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {ui("ملاحظات إضافية (اختياري)")}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={ui("أي تفاصيل تود إثباتها في السجل...")}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Live Impact Preview Card */}
        {selectedLine && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-6 shadow-md space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {ui("معاينة الأثر المحاسبي والمخزني المباشر")}</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <div className="text-xs text-gray-400">{ui("الصنف المحدد")}</div>
                <div className="text-base font-bold text-white mt-0.5">{selectedLine.itemName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{ui("الكمية المرتجعة")}</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">
                  {qty} {selectedLine.unitName}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{ui("صافي سعر الوحدة الأصلي")}</div>
                <div className="text-base font-mono font-bold text-white mt-0.5">
                  {unitPrice.toFixed(2)} {ui("ر.س")}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{ui("إجمالي القيمة المستردة/الدائنة")}</div>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
                  {finalRefundAmount.toFixed(2)} {ui("ر.س")}</div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-3 text-xs text-gray-300 flex flex-col sm:flex-row gap-4 justify-between">
              <div>
                <span className="font-bold text-gray-200">{ui("الأثر المخزني:")}</span>
                {returnType === 'SALE_RETURN' ? (
                  saleReturnCondition === 'GOOD' ? (
                    <span className="text-emerald-400 font-semibold">
                      {ui("+ إضافة")}{qty} {selectedLine.unitName} {ui("إلى المخزون المتاح (صالح)")}</span>
                  ) : (
                    <span className="text-rose-400 font-semibold">
                      {ui("0 مخزون (تالف لا يعود للمخزون، ويُثبت كمصروف تلف مرتجع)")}</span>
                  )
                ) : (
                  <span className="text-amber-400 font-semibold">
                    {ui("- خصم")}{qty} {selectedLine.unitName} {ui("من المخزون وإعادتها للمورد")}</span>
                )}
              </div>

              <div>
                <span className="font-bold text-gray-200">{ui("الأثر المالي:")}</span>
                {returnType === 'SALE_RETURN' ? (
                  refundCashNow ? (
                    <span className="text-sky-300 font-semibold">
                      {ui("صرف فوري (")}{calculatedTotal.toFixed(2)} {ui("ر.س) من")}{refundAccount === 'CASH' ? ui("الخزينة") : ui("البنك")} {ui("للعميل")}</span>
                  ) : (
                    <span>{ui("قيد رصيد دائن للعميل في حسابه لتسوية الفواتير أو المتبقي")}</span>
                  )
                ) : (
                  <span>{ui("تخفيض مستحقات المورد بموجب إشعار الخصم")}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Quick Add Party Modal */}
      <QuickAddPartyModal
        isOpen={quickAddPartyOpen}
        onClose={() => setQuickAddPartyOpen(false)}
        defaultType={returnType === 'SALE_RETURN' ? 'CLIENT' : 'SUPPLIER'}
        onSuccess={(newParty) => {
          setParties((prev) => [newParty, ...prev]);
          setPartyId(newParty.id);
        }}
      />
    </div>
  );
}
