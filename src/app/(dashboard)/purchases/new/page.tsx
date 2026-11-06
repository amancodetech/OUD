'use client';
import { apiFetch } from '@/lib/client-api';
import { useUiText } from '@/i18n/interface-text';
import { todayInStore } from '@/domain/period';
import { toDecimal, roundMoney, zero, formatInvoiceNumber } from '@/domain/decimal';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingBag,
  ArrowRight,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  DollarSign,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { QtyInput } from '@/components/forms/QtyInput';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';
import { QuickAddPartyModal } from '@/components/forms/QuickAddPartyModal';
import { useI18n } from '@/i18n/LanguageContext';
import { tLocalizedName } from '@/i18n/translate-domain';

interface LineRow {
  id: string;
  itemId: string;
  qty: number;
  unitCost: number;
  landedCost: number;
  discount: number;
  unitName: string;
}

export default function NewPurchasePage() {
  const [operationKey] = useState(() => crypto.randomUUID());

  const ui = useUiText();

  const router = useRouter();
  const { locale, tUnit, tItemRole } = useI18n();
  const formatNumber = (value: number) => formatInvoiceNumber(value, locale);

  // Header state
  const [invoiceDate, setInvoiceDate] = useState(todayInStore());
  const [invoiceNo, setInvoiceNo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Suppliers & Items options
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [quickAddSupplierOpen, setQuickAddSupplierOpen] = useState(false);

  // Instant Payment
  const [payNow, setPayNow] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentAccount, setPaymentAccount] = useState<'CASH' | 'BANK'>('CASH');

  // Opening Invoice State
  const [isOpeningInvoice, setIsOpeningInvoice] = useState(false);
  const [openingTotalAmount, setOpeningTotalAmount] = useState<number>(0);
  const [openingPaidAmount, setOpeningPaidAmount] = useState<number>(0);

  // Lines
  const [lines, setLines] = useState<LineRow[]>([
    {
      id: 'row-1',
      itemId: '',
      qty: 1,
      unitCost: 0,
      landedCost: 0,
      discount: 0,
      unitName: '',
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadDependencies = async () => {
    try {
      const [supRes, itmRes] = await Promise.all([
        apiFetch('/api/parties?type=SUPPLIER'),
        apiFetch('/api/items?lookup=true'),
      ]);
      const supData = await supRes.json();
      const itmData = await itmRes.json();
      const supList = Array.isArray(supData) ? supData : supData?.data || [];
      const itmList = Array.isArray(itmData) ? itmData : itmData?.data || [];
      setSuppliers(supList);
      setItems(itmList);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        itemId: '',
        qty: 1,
        unitCost: 0,
        landedCost: 0,
        discount: 0,
        unitName: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof LineRow, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'itemId') {
        const itemObj = items.find((itm) => itm.id === value);
        updated[index].unitName = itemObj?.unit?.name || '';
      }
      return updated;
    });
  };

  // Grand Totals calculation
  const totalQty = isOpeningInvoice ? 0 : lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const totalBaseCost = isOpeningInvoice ? 0 : lines.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitCost) || 0),
    0
  );
  const totalLanded = isOpeningInvoice ? 0 : lines.reduce((sum, l) => sum + (Number(l.landedCost) || 0), 0);
  const totalDiscount = isOpeningInvoice ? 0 : lines.reduce((sum, l) => sum + (Number(l.discount) || 0), 0);
  const grandTotalCost = isOpeningInvoice
    ? Number(openingTotalAmount) || 0
    : lines.reduce((sum, l) => {
        const lineCost = roundMoney(toDecimal(Number(l.qty) || 0).times(Number(l.unitCost) || 0).plus(Number(l.landedCost) || 0).minus(Number(l.discount) || 0));
        return sum.plus(lineCost.gt(0) ? lineCost : 0);
      }, zero()).toNumber();

  const netOpeningDebt = Math.max(0, (Number(openingTotalAmount) || 0) - (Number(openingPaidAmount) || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!supplierId) {
      setError('يرجى اختيار المورد');
      return;
    }
    if (!invoiceNo.trim()) {
      setError('يرجى إدخال رقم الفاتورة');
      return;
    }
    if (isOpeningInvoice) {
      if ((Number(openingTotalAmount) || 0) <= 0) {
        setError('يرجى إدخال إجمالي قيمة الفاتورة السابقة أكبر من الصفر');
        return;
      }
      if ((Number(openingPaidAmount) || 0) < 0) {
        setError('المبلغ المسدد مسبقاً لا يمكن أن يكون سالباً');
        return;
      }
      if ((Number(openingPaidAmount) || 0) > (Number(openingTotalAmount) || 0)) {
        setError('المبلغ المسدد مسبقاً لا يمكن أن يتجاوز إجمالي الفاتورة');
        return;
      }
    } else {
      if (lines.some((l) => !l.itemId)) {
        setError('يرجى اختيار الصنف لجميع السطور');
        return;
      }
      if (lines.some((l) => Number(l.qty) <= 0)) {
        setError('كمية الصنف يجب أن تكون أكبر من الصفر');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        invoiceDate,
        invoiceNo: invoiceNo.trim(),
        supplierId,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
        isOpeningInvoice,
        openingTotalAmount: isOpeningInvoice ? openingTotalAmount : 0,
        openingPaidAmount: isOpeningInvoice ? openingPaidAmount : 0,
        lines: isOpeningInvoice
          ? []
          : lines.map((l) => ({
              itemId: l.itemId,
              qty: l.qty,
              unitCost: l.unitCost,
              landedCost: l.landedCost,
              discount: l.discount,
            })),
        paidNow: payNow ? paidAmount : 0,
        paymentAccount: payNow ? paymentAccount : null,
      };

      const res = await apiFetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationKey },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الفاتورة');

      // Refresh data immediately so the new invoice appears on the website without delay
      void apiFetch('/api/purchases', { cache: 'reload' });
      router.push('/purchases');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
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
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-amber-600" />
              {ui("تسجيل فاتورة شراء جديدة")}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {ui("إدخال رأس الفاتورة وسطور الأصناف وحساب تكلفة الوصول والسداد الفوري")}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? ui("جاري الحفظ...") : ui("حفظ الفاتورة")}
        </button>
      </div>

      {/* Invoice Mode Toggle */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setIsOpeningInvoice(false);
            if (payNow) setPaidAmount(grandTotalCost);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            !isOpeningInvoice
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>{ui("فاتورة مشتريات عادية (بضاعة ومخزون)")}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsOpeningInvoice(true);
            if (payNow) setPaidAmount(netOpeningDebt);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            isOpeningInvoice
              ? 'bg-amber-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{ui("فاتورة سابقة / رصيد افتتاحي (بدون مخزون)")}</span>
        </button>
      </div>

      {isOpeningInvoice && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">تسجيل فاتورة سابقة لإثبات مديونية مورد (بدون التأثير على المخزون الحالي):</p>
            <p className="text-amber-800 leading-relaxed">
              هذا الخيار مخصص للفواتير والذمم المستحقة للموردين قبل بدء استخدام النظام. يتم توثيق رقم الفاتورة وتاريخها وتاريخ استحقاقها وربط الدين بها مباشرة، دون إدخال أصناف أو التأثير على رصيد المخزن الحالي ومتوسط تكلفة البضاعة.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Invoice Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Information Box */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-600" />
            {ui("بيانات رأس الفاتورة")}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{ui("المورد*")}</label>
              <SearchableCombobox
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: `${s.code} | ${tLocalizedName(s, locale)}`,
                  code: s.code,
                  name: tLocalizedName(s, locale),
                  hint: s.phone ? `هاتف: ${s.phone}` : undefined,
                }))}
                value={supplierId}
                onChange={setSupplierId}
                placeholder={ui("اختر المورد...")}
                onQuickAdd={() => setQuickAddSupplierOpen(true)}
                quickAddLabel="إضافة مورد جديد"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{ui("رقم الفاتورة*")}</label>
              <input
                type="text"
                required
                placeholder={ui("مثال: P-1001")}
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{ui("تاريخ الفاتورة*")}</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{ui("تاريخ الاستحقاق")}</label>
              <input
                type="date"
                value={dueDate}
                min={invoiceDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{ui("ملاحظات الفاتورة")}</label>
            <input
              type="text"
              placeholder={ui("أي ملاحظات إضافية على أمر الشراء أو الشحنة...")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Conditional Content: Opening Invoice Debt Card OR Lines Table */}
        {isOpeningInvoice ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <h2 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-600" />
              <span>{ui("بيانات قيمة الفاتورة السابقة والذمة المالية")}</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {ui("إجمالي قيمة الفاتورة الأصلية (IDR)*")}
                </label>
                <MoneyInput
                  value={openingTotalAmount}
                  onChange={(v) => {
                    const val = Number(v) || 0;
                    setOpeningTotalAmount(val);
                    if (payNow) {
                      setPaidAmount(Math.max(0, val - openingPaidAmount));
                    }
                  }}
                  placeholder="0"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">إجمالي مبلغ الفاتورة عند إصدارها للمورد</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {ui("المسدد مسبقاً قبل فتح المحل (IDR)")}
                </label>
                <MoneyInput
                  value={openingPaidAmount}
                  onChange={(v) => {
                    const val = Number(v) || 0;
                    setOpeningPaidAmount(val);
                    if (payNow) {
                      setPaidAmount(Math.max(0, openingTotalAmount - val));
                    }
                  }}
                  placeholder="0"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">أي دفعات سُددت للمورد قبل استخدام النظام</span>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-xs text-amber-900 font-bold block mb-1">صافي الدين الافتتاحي المتبقي للمورد:</span>
                <span className="text-xl font-black font-mono text-amber-900" dir="ltr">
                  {formatNumber(netOpeningDebt)} <span className="text-xs font-normal">IDR</span>
                </span>
                <span className="text-[11px] text-amber-700 mt-1">المبلغ المتبقي كدين رسمي في كشف حساب المورد</span>
              </div>
            </div>
          </div>
        ) : (
          /* Lines Table Box */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                {ui("سطور الأصناف المشتراة")}</h2>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all"
              >
                <Plus className="w-4 h-4" />
                {ui("إضافة سطر صنف")}</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-8 text-center">#</th>
                    <th className="p-3 min-w-[320px] lg:min-w-[360px]">{ui("الصنف*")}</th>
                    <th className="p-3 min-w-[130px]">{ui("الكمية*")}</th>
                    <th className="p-3 min-w-[140px]">{ui("تكلفة الوحدة (IDR)*")}</th>
                    <th className="p-3 min-w-[130px]">{ui("تكلفة الوصول")}</th>
                    <th className="p-3 min-w-[120px]">{ui("الخصم")}</th>
                    <th className="p-3 min-w-[140px] text-left">{ui("تكلفة البند")}</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => {
                    const lineTotal = roundMoney(toDecimal(Number(line.qty) || 0).times(Number(line.unitCost) || 0).plus(Number(line.landedCost) || 0).minus(Number(line.discount) || 0)).toNumber();

                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                        <td className="p-2">
                          <SearchableCombobox
                            options={items.map((i) => ({
                              value: i.id,
                              label: `${i.code} | ${tLocalizedName(i, locale)}`,
                              code: i.code,
                              name: tLocalizedName(i, locale),
                              hint: `${locale === 'en' ? 'Unit' : ui("الوحدة")}: ${tUnit(i.unit?.name)} — ${tItemRole(i.role)}`,
                            }))}
                            value={line.itemId}
                            onChange={(val) => updateLine(idx, 'itemId', val)}
                            placeholder={ui("اختر الصنف...")}
                          />
                        </td>

                        <td className="p-2">
                          <QtyInput
                            value={line.qty}
                            onChange={(v) => updateLine(idx, 'qty', Number(v) || 0)}
                            unitName={line.unitName || ui("وحدة")}
                            min={0.0001}
                          />
                        </td>

                        <td className="p-2">
                          <MoneyInput
                            value={line.unitCost}
                            onChange={(v) => updateLine(idx, 'unitCost', Number(v) || 0)}
                            placeholder="0"
                          />
                        </td>

                        <td className="p-2">
                          <MoneyInput
                            value={line.landedCost}
                            onChange={(v) => updateLine(idx, 'landedCost', Number(v) || 0)}
                            placeholder="0"
                          />
                        </td>

                        <td className="p-2">
                          <MoneyInput
                            value={line.discount}
                            onChange={(v) => updateLine(idx, 'discount', Number(v) || 0)}
                            placeholder="0"
                          />
                        </td>

                        <td className="p-3 font-bold text-slate-900 text-left font-mono" dir="ltr">
                          {lineTotal > 0 ? formatNumber(lineTotal) : '0'}
                        </td>

                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-30"
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
        )}

        {/* Instant Payment Section */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={payNow}
                onChange={(e) => {
                  setPayNow(e.target.checked);
                  if (e.target.checked && paidAmount === 0) {
                    setPaidAmount(isOpeningInvoice ? netOpeningDebt : grandTotalCost);
                  }
                }}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                {ui("هل دُفع مبلغ للمورد الآن؟ (سداد فوري)")}</span>
            </label>
          </div>

          {payNow && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {ui("المبلغ المدفوع الآن (IDR)")}</label>
                <MoneyInput
                  value={paidAmount}
                  onChange={(v) => setPaidAmount(Number(v) || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{ui("حساب الدفع")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAccount('CASH')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      paymentAccount === 'CASH'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {ui("نقدي (الخزينة)")}</button>
                  <button
                    type="button"
                    onClick={() => setPaymentAccount('BANK')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      paymentAccount === 'BANK'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {ui("تحويل (البنك)")}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Invoice Summary Box */}
        <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1 text-xs">
            {isOpeningInvoice ? (
              <>
                <p className="text-amber-300 font-bold">
                  نوع الفاتورة: فاتورة سابقة / رصيد افتتاحي (بدون حركة مخزون)
                </p>
                <p className="text-slate-300">
                  المسدد سابقاً: <strong className="text-white">{formatNumber(openingPaidAmount)} IDR</strong> | صافي الدين المستحق: <strong className="text-amber-400">{formatNumber(netOpeningDebt)} IDR</strong>
                </p>
              </>
            ) : (
              <>
                <p className="text-slate-400">
                  {ui("عدد السطور:")}<strong className="text-white">{lines.length}</strong> {ui("| إجمالي الكميات:")}{' '}
                  <strong className="text-white">{formatNumber(totalQty)}</strong>
                </p>
                {totalLanded > 0 && (
                  <p className="text-amber-400">
                    {ui("تكاليف الوصول المحملة:")}<strong>{formatNumber(totalLanded)} IDR</strong>
                  </p>
                )}
                {totalDiscount > 0 && (
                  <p className="text-emerald-400">
                    {ui("مجموع الخصم:")}<strong>{formatNumber(totalDiscount)} IDR</strong>
                  </p>
                )}
              </>
            )}
          </div>

          <div className="text-left sm:text-left w-full sm:w-auto">
            <p className="text-xs text-slate-400">{isOpeningInvoice ? ui("إجمالي الفاتورة الأصلية") : ui("صافي تكلفة الفاتورة الإجمالية")}</p>
            <p className="text-2xl font-black text-amber-400 font-mono mt-0.5" dir="ltr">
              {formatNumber(grandTotalCost)} <span className="text-sm font-normal">IDR</span>
            </p>
          </div>
        </div>
      </form>

      {/* Quick Add Supplier Modal */}
      <QuickAddPartyModal
        isOpen={quickAddSupplierOpen}
        onClose={() => setQuickAddSupplierOpen(false)}
        defaultType="SUPPLIER"
        onSuccess={(newParty) => {
          setSuppliers((prev) => [...prev, newParty]);
          setSupplierId(newParty.id);
        }}
      />
    </div>
  );
}
