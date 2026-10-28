'use client';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Gift,
  ArrowRight,
  AlertCircle,
  Save,
  Package,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { QtyInput } from '@/components/forms/QtyInput';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';

export default function DriverGiftDeliveryPage() {
  const [operationKey] = useState(() => crypto.randomUUID());

  const router = useRouter();
  const searchParams = useSearchParams();

  const [invoiceDate, setInvoiceDate] = useState(todayInStore());
  const [driverId, setDriverId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [settlementValue, setSettlementValue] = useState<number>(100000); // Typical 100k IDR gift
  const [notes, setNotes] = useState('');

  const [drivers, setDrivers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedItemUnit, setSelectedItemUnit] = useState('وحدة');
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const qDriverId = searchParams.get('driverId');
    if (qDriverId) {
      setDriverId(qDriverId);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      try {
        const [drvRes, itmRes] = await Promise.all([
          fetch('/api/parties?type=DRIVER'),
          fetch('/api/items'),
        ]);
        const drvData = await drvRes.json();
        const itmData = await itmRes.json();
        const drvList = Array.isArray(drvData) ? drvData : drvData?.data || [];
        const itmList = Array.isArray(itmData) ? itmData : itmData?.data || [];
        setDrivers(drvList.filter((d: any) => d.isDriverGiftEnabled));
        setItems(itmList);
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, []);

  const handleItemChange = async (newId: string) => {
    setItemId(newId);
    const itmObj = items.find((i) => i.id === newId);
    setSelectedItemUnit(itmObj?.unit?.name || 'وحدة');

    if (newId) {
      try {
        const res = await fetch(`/api/sales/stock-check?itemId=${newId}&date=${invoiceDate}`);
        const data = await res.json();
        if (res.ok) setAvailableStock(data.availableQty);
      } catch (e) {
        console.error(e);
      }
    } else {
      setAvailableStock(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!driverId) {
      setError('يرجى اختيار السائق');
      return;
    }
    if (!itemId) {
      setError('يرجى اختيار الصنف المُهدى');
      return;
    }
    if (qty <= 0) {
      setError('الكمية يجب أن تكون أكبر من الصفر');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/sales/driver-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationKey },
        body: JSON.stringify({
          invoiceDate,
          driverId,
          itemId,
          qty,
          driverGiftSettlementValue: settlementValue,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل تسليم الهدية العينية');

      router.push('/sales');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/sales"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Gift className="w-6 h-6 text-amber-600" />
              تسليم هدية سائق عينية (بضاعة)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              صرف بضاعة من المخزون لسائق مقابل استحقاق زياراته (سعر البيع 0 وتُحسب تكلفة مبيع)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ التسليم*</label>
          <input
            type="date"
            required
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">السائق المستلم*</label>
          <SearchableCombobox
            options={drivers.map((d) => ({
              value: d.id,
              label: `${d.code} | ${d.name}`,
              hint: d.carNumber ? `سيارة: ${d.carNumber}` : undefined,
            }))}
            value={driverId}
            onChange={setDriverId}
            placeholder="اختر السائق..."
          />
          <p className="text-[11px] text-slate-400 mt-1">
            * تظهر هنا فقط السائقين المفعّل لديهم خيار هدايا السائقين.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">الصنف المُسلّم كهدية*</label>
          <SearchableCombobox
            options={items.map((i) => ({
              value: i.id,
              label: `${i.code} | ${i.name}`,
              hint: `الوحدة: ${i.unit?.name}`,
            }))}
            value={itemId}
            onChange={handleItemChange}
            placeholder="اختر الصنف من المخزن..."
          />
          {availableStock !== null && (
            <div className="flex items-center gap-1 text-[11px] mt-1 text-emerald-700">
              <Package className="w-3.5 h-3.5" />
              <span>المتاح حتى هذا التاريخ:</span>
              <strong className="font-mono">{availableStock.toLocaleString()} {selectedItemUnit}</strong>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الكمية المسلمة*</label>
            <QtyInput
              value={qty}
              onChange={(v) => setQty(Number(v) || 0)}
              unitName={selectedItemUnit}
              min={0.0001}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              قيمة تسوية الهدية (IDR)*
            </label>
            <MoneyInput
              value={settlementValue}
              onChange={(v) => setSettlementValue(Number(v) || 0)}
              placeholder="0"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              المبلغ الذي يُخصم من استحقاق السائق في جدول هدايا السائقين
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: هدية عود بمناسبة إكمال 10 زوار..."
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100 text-xs text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-1">
            <Gift className="w-4 h-4 text-amber-700" />
            معاملة محاسبية تلقائية:
          </p>
          <p className="text-[11px] text-amber-800">
            سيتم حفظ السطر بسعر بيع 0 وخصم 0، وسيخرج الصنف من المخزون حاملاً تكلفة بضاعة مبيعة (`COGS`)
            تساوي `الكمية × متوسط التكلفة الشهري`، وتُسجل تسوية الهدية بقيمة ({settlementValue.toLocaleString()} IDR).
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'جاري التسجيل...' : 'تأكيد وحفظ تسليم الهدية'}
          </button>
        </div>
      </form>
    </div>
  );
}
