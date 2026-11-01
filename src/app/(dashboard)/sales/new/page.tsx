'use client';
import { apiFetch } from '@/lib/client-api';
import { useUiText } from '@/i18n/interface-text';
import { todayInStore } from '@/domain/period';
import { toDecimal, roundMoney, zero, formatInvoiceNumber } from '@/domain/decimal';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart,
  ArrowRight,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  DollarSign,
  Layers,
  FileText,
  Package,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { QtyInput } from '@/components/forms/QtyInput';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';
import { QuickAddPartyModal } from '@/components/forms/QuickAddPartyModal';
import { useI18n } from '@/i18n/LanguageContext';
import { tLocalizedName } from '@/i18n/translate-domain';

interface SaleLineRow {
  id: string;
  itemId: string;
  qty: number;
  unitPrice: number;
  discount: number;
  unitName: string;
  availableStock: number | null;
}

export default function NewSalePage() {
  const [operationKey] = useState(() => crypto.randomUUID());

  const ui = useUiText();

  const router = useRouter();
  const { locale, tUnit } = useI18n();
  const formatNumber = (value: number) => formatInvoiceNumber(value, locale);

  // Header state
  const [invoiceDate, setInvoiceDate] = useState(todayInStore());
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Customers & Items options
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);

  // Instant Collection Options: 'CREDIT' | 'CASH_FULL' | 'BANK_FULL' | 'PARTIAL'
  const [collectionType, setCollectionType] = useState<'CREDIT' | 'CASH_FULL' | 'BANK_FULL' | 'PARTIAL'>('CREDIT');
  const [customPaidAmount, setCustomPaidAmount] = useState<number>(0);
  const [customAccount, setCustomAccount] = useState<'CASH' | 'BANK'>('CASH');

  // Lines
  const [lines, setLines] = useState<SaleLineRow[]>([
    {
      id: 'row-1',
      itemId: '',
      qty: 1,
      unitPrice: 0,
      discount: 0,
      unitName: '',
      availableStock: null,
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadDependencies = async () => {
    try {
      const [custRes, itmRes, salesCountRes] = await Promise.all([
        apiFetch('/api/parties?type=CLIENT&lookup=true'),
        apiFetch('/api/items?lookup=true'),
        apiFetch('/api/sales?countOnly=true'),
      ]);
      const custData = await custRes.json();
      const itmData = await itmRes.json();
      const salesCountData = await salesCountRes.json();

      const custList = Array.isArray(custData) ? custData : custData?.data || [];
      const itmList = Array.isArray(itmData) ? itmData : itmData?.data || [];
      setCustomers(custList);
      setItems(itmList);

      // Auto-suggest next invoice number like S-1001, S-1002...
      if (salesCountData?.nextNumber) {
        setInvoiceNo(`S-${salesCountData.nextNumber}`);
      } else {
        setInvoiceNo('S-1001');
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  const fetchItemStock = async (itemId: string, date: string, lineIndex: number) => {
    if (!itemId) return;
    try {
      const res = await apiFetch(`/api/sales/stock-check?itemId=${itemId}&date=${date}`);
      const data = await res.json();
      if (res.ok) {
        setLines((prev) => {
          const updated = [...prev];
          if (updated[lineIndex]) {
            updated[lineIndex].availableStock = data.availableQty;
            updated[lineIndex].unitName = data.unitName || updated[lineIndex].unitName;
            if (data.defaultSalePrice && updated[lineIndex].unitPrice === 0) {
              updated[lineIndex].unitPrice = data.defaultSalePrice;
            }
          }
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        itemId: '',
        qty: 1,
        unitPrice: 0,
        discount: 0,
        unitName: '',
        availableStock: null,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof SaleLineRow, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    if (field === 'itemId') {
      fetchItemStock(value, invoiceDate, index);
    }
  };

  // Re-check stock when invoice date changes
  useEffect(() => {
    lines.forEach((l, idx) => {
      if (l.itemId) fetchItemStock(l.itemId, invoiceDate, idx);
    });
  }, [invoiceDate]);

  // Grand Totals
  const totalQty = lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const totalDiscount = lines.reduce((sum, l) => sum + (Number(l.discount) || 0), 0);
  const grandTotalSale = lines.reduce((sum, l) => {
    const net = roundMoney(toDecimal(Number(l.qty) || 0).times(Number(l.unitPrice) || 0).minus(Number(l.discount) || 0));
    return sum.plus(net.gt(0) ? net : 0);
  }, zero()).toNumber();

  // Determine instant paid amount and account
  let effectivePaidNow = 0;
  let effectiveAccount: 'CASH' | 'BANK' | null = null;
  if (collectionType === 'CASH_FULL') {
    effectivePaidNow = grandTotalSale;
    effectiveAccount = 'CASH';
  } else if (collectionType === 'BANK_FULL') {
    effectivePaidNow = grandTotalSale;
    effectiveAccount = 'BANK';
  } else if (collectionType === 'PARTIAL') {
    effectivePaidNow = customPaidAmount;
    effectiveAccount = customAccount;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerId) {
      setError('يرجى اختيار العميل');
      return;
    }
    if (!invoiceNo.trim()) {
      setError('يرجى إدخال رقم الفاتورة');
      return;
    }
    if (lines.some((l) => !l.itemId)) {
      setError('يرجى اختيار الصنف لجميع السطور');
      return;
    }
    if (lines.some((l) => Number(l.qty) <= 0)) {
      setError('كمية الصنف يجب أن تكون أكبر من الصفر');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoiceDate,
        invoiceNo: invoiceNo.trim(),
        customerId,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discount: l.discount,
        })),
        paidNow: effectivePaidNow > 0 ? effectivePaidNow : 0,
        collectionAccount: effectivePaidNow > 0 ? effectiveAccount : null,
      };

      const res = await apiFetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationKey },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الفاتورة');

      router.push('/sales');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/sales"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-amber-600" />
              {ui("إنشاء فاتورة بيع جديدة")}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {ui("إدخال رأس الفاتورة والعميل، فحص المخزون المتاح لحظياً، وخيارات التحصيل الفوري")}</p>
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

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Sale Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Information Box */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-600" />
            {ui("بيانات رأس الفاتورة")}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{ui("العميل*")}</label>
              <SearchableCombobox
                options={customers.map((c) => ({
                  value: c.id,
                  label: `${c.code} | ${tLocalizedName(c, locale)}`,
                  hint: c.phone ? `هاتف: ${c.phone}` : undefined,
                }))}
                value={customerId}
                onChange={setCustomerId}
                placeholder={ui("اختر العميل...")}
                onQuickAdd={() => setQuickAddCustomerOpen(true)}
                quickAddLabel="إضافة عميل جديد سريع"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{ui("رقم الفاتورة*")}</label>
              <input
                type="text"
                required
                placeholder={ui("مثال: S-1001")}
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
              placeholder={ui("أي ملاحظات أو تفاصيل خاصة بطلب العميل...")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Lines Table Box */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              {ui("سطور الأصناف المباعة")}</h2>
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
                  <th className="p-3 min-w-[240px]">{ui("الصنف والمخزون المتاح*")}</th>
                  <th className="p-3 min-w-[140px]">{ui("الكمية*")}</th>
                  <th className="p-3 min-w-[140px]">{ui("سعر الوحدة (IDR)*")}</th>
                  <th className="p-3 min-w-[120px]">{ui("خصم البند")}</th>
                  <th className="p-3 min-w-[140px] text-left">{ui("صافي البيع")}</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const netSale = roundMoney(toDecimal(Number(line.qty) || 0).times(Number(line.unitPrice) || 0).minus(Number(line.discount) || 0)).toNumber();

                  const isExceedingStock =
                    line.availableStock !== null && Number(line.qty) > line.availableStock;

                  return (
                    <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                      <td className="p-2 space-y-1">
                        <SearchableCombobox
                          options={items.map((i) => ({
                            value: i.id,
                            label: `${i.code} | ${tLocalizedName(i, locale)}`,
                            hint: `${locale === 'en' ? 'Unit' : ui("الوحدة")}: ${tUnit(i.unit?.name)}`,
                          }))}
                          value={line.itemId}
                          onChange={(val) => updateLine(idx, 'itemId', val)}
                          placeholder={ui("اختر الصنف المباع...")}
                        />
                        {line.availableStock !== null && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-500">{ui("المتاح حتى هذا التاريخ:")}</span>
                            <span
                              className={`font-mono font-bold ${
                                isExceedingStock ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              {formatNumber(line.availableStock)} {line.unitName}
                            </span>
                            {isExceedingStock && (
                              <span className="text-[10px] text-rose-500 font-bold">
                                {ui("(تجاوز للمخزون!)")}</span>
                            )}
                          </div>
                        )}
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
                          value={line.unitPrice}
                          onChange={(v) => updateLine(idx, 'unitPrice', Number(v) || 0)}
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
                        {netSale > 0 ? formatNumber(netSale) : '0'}
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

        {/* Instant Collection Section (Frictionless Entry) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            {ui("طريقة السداد والتحصيل الفوري")}</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setCollectionType('CREDIT')}
              className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                collectionType === 'CREDIT'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ui("آجل (لم يُدفع الآن)")}</button>

            <button
              type="button"
              onClick={() => setCollectionType('CASH_FULL')}
              className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                collectionType === 'CASH_FULL'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ui("نقدي كامل (خزينة)")}</button>

            <button
              type="button"
              onClick={() => setCollectionType('BANK_FULL')}
              className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                collectionType === 'BANK_FULL'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ui("تحويل كامل (بنك)")}</button>

            <button
              type="button"
              onClick={() => {
                setCollectionType('PARTIAL');
                if (customPaidAmount === 0) setCustomPaidAmount(Math.round(grandTotalSale / 2));
              }}
              className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                collectionType === 'PARTIAL'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ui("دفعة جزئية")}</button>
          </div>

          {collectionType === 'PARTIAL' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {ui("المبلغ المحصل الآن (IDR)")}</label>
                <MoneyInput
                  value={customPaidAmount}
                  onChange={(v) => setCustomPaidAmount(Number(v) || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{ui("حساب التحصيل")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomAccount('CASH')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      customAccount === 'CASH'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {ui("نقدي (الخزينة)")}</button>
                  <button
                    type="button"
                    onClick={() => setCustomAccount('BANK')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                      customAccount === 'BANK'
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
            <p className="text-slate-400">
              {ui("عدد السطور:")}<strong className="text-white">{lines.length}</strong> {ui("| إجمالي الكميات المباعة:")}{' '}
              <strong className="text-white">{formatNumber(totalQty)}</strong>
            </p>
            {totalDiscount > 0 && (
              <p className="text-emerald-400">
                {ui("مجموع الخصم الممنوح:")}<strong>{formatNumber(totalDiscount)} IDR</strong>
              </p>
            )}
            <p className="text-slate-400">
              {ui("المحصل الآن:")}<strong className="text-emerald-400">{formatNumber(effectivePaidNow)} IDR</strong> {ui("| المتبقي على العميل:")}{' '}
              <strong className="text-rose-400">{formatNumber(toDecimal(grandTotalSale).minus(effectivePaidNow).toNumber())} IDR</strong>
            </p>
          </div>

          <div className="text-left sm:text-left w-full sm:w-auto">
            <p className="text-xs text-slate-400">{ui("صافي قيمة الفاتورة الإجمالية")}</p>
            <p className="text-2xl font-black text-amber-400 font-mono mt-0.5" dir="ltr">
              {formatNumber(grandTotalSale)} <span className="text-sm font-normal">IDR</span>
            </p>
          </div>
        </div>
      </form>

      {/* Quick Add Customer Modal */}
      <QuickAddPartyModal
        isOpen={quickAddCustomerOpen}
        onClose={() => setQuickAddCustomerOpen(false)}
        defaultType="CLIENT"
        onSuccess={(newParty) => {
          setCustomers((prev) => [...prev, newParty]);
          setCustomerId(newParty.id);
        }}
      />
    </div>
  );
}
