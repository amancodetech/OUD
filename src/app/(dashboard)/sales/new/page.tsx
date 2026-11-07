'use client';

import { apiFetch } from '@/lib/client-api';
import { useUiText } from '@/i18n/interface-text';
import { todayInStore } from '@/domain/period';
import { toDecimal, roundMoney, zero, formatInvoiceNumber } from '@/domain/decimal';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingCart,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  Save,
  DollarSign,
  Layers,
  FileText,
  Package,
  Search,
  Printer,
  RotateCcw,
  Check,
  User,
  CreditCard,
  Banknote,
  Clock,
  Sparkles,
  PauseCircle,
  PlayCircle,
  Store,
  Tag,
} from 'lucide-react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { QtyInput } from '@/components/forms/QtyInput';
import { SearchableCombobox } from '@/components/forms/SearchableCombobox';
import { QuickAddPartyModal } from '@/components/forms/QuickAddPartyModal';
import { ProductImage } from '@/components/common/ProductImage';
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
  code?: string;
  name?: string;
  imageUrl?: string | null;
  categoryPrefix?: string;
  categoryName?: string;
}

interface HeldTicket {
  id: string;
  timestamp: string;
  customerId: string;
  lines: SaleLineRow[];
  notes: string;
}

export default function NewSalePage() {
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());

  const ui = useUiText();
  const router = useRouter();
  const { locale, tUnit, tCategory } = useI18n();
  const formatNumber = (value: number) => formatInvoiceNumber(value, locale);

  // Modes: 'POS' (الكاشير السريع) | 'TABLE' (فاتورة جدول تفصيلية) | 'OPENING' (فاتورة سابقة بدون مخزون)
  const [saleMode, setSaleMode] = useState<'POS' | 'TABLE' | 'OPENING'>('POS');

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

  // POS Search & Category Filter
  const [posSearch, setPosSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('ALL');
  const posSearchInputRef = useRef<HTMLInputElement>(null);

  // Instant Collection Options: 'CASH_FULL' | 'BANK_FULL' | 'PARTIAL' | 'CREDIT'
  const [collectionType, setCollectionType] = useState<'CREDIT' | 'CASH_FULL' | 'BANK_FULL' | 'PARTIAL'>('CASH_FULL');
  const [customPaidAmount, setCustomPaidAmount] = useState<number>(0);
  const [customAccount, setCustomAccount] = useState<'CASH' | 'BANK'>('CASH');

  // Cash Change Calculator
  const [cashTendered, setCashTendered] = useState<number>(0);

  // Opening Invoice State
  const isOpeningInvoice = saleMode === 'OPENING';
  const [openingTotalAmount, setOpeningTotalAmount] = useState<number>(0);
  const [openingPaidAmount, setOpeningPaidAmount] = useState<number>(0);

  // Held Tickets (Park / Resume sale)
  const [heldTickets, setHeldTickets] = useState<HeldTicket[]>([]);

  // Lines
  const [lines, setLines] = useState<SaleLineRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

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

      // Find cash customer or default
      const cashCust = custList.find(
        (c: any) =>
          c.name?.includes('نقدي') ||
          c.name?.includes('كاشير') ||
          c.code === 'CASH' ||
          c.code === 'WALK-IN'
      );
      if (cashCust && !customerId) {
        setCustomerId(cashCust.id);
      }

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

  // Re-check stock when invoice date changes
  useEffect(() => {
    lines.forEach((l, idx) => {
      if (l.itemId) fetchItemStock(l.itemId, invoiceDate, idx);
    });
  }, [invoiceDate]);

  // Categories list with counts
  const categoriesMap = new Map<string, { id: string; name: string; prefix?: string; count: number }>();
  items.forEach((it) => {
    const catId = it.category?.id || it.categoryId || 'OTHER';
    const catName = it.category?.name || 'أخرى';
    const catPrefix = it.category?.prefix || '';
    if (!categoriesMap.has(catId)) {
      categoriesMap.set(catId, { id: catId, name: catName, prefix: catPrefix, count: 0 });
    }
    categoriesMap.get(catId)!.count += 1;
  });
  const categoriesList = Array.from(categoriesMap.values());

  // Filtered items for POS catalog
  const filteredCatalogItems = items.filter((it) => {
    const matchesCat =
      selectedCatId === 'ALL' ||
      (it.category?.id || it.categoryId) === selectedCatId;
    if (!matchesCat) return false;

    if (!posSearch.trim()) return true;
    const term = posSearch.toLowerCase().trim();
    const code = (it.code || '').toLowerCase();
    const customCode = (it.customCode || '').toLowerCase();
    const displayCode = (it.displayCode || '').toLowerCase();
    const name = (it.name || '').toLowerCase();
    const nameEn = (it.nameEn || '').toLowerCase();
    return (
      code.includes(term) ||
      customCode.includes(term) ||
      displayCode.includes(term) ||
      name.includes(term) ||
      nameEn.includes(term)
    );
  });

  // Fast Cart Operations
  const handleAddItemToCart = (item: any) => {
    const existingIndex = lines.findIndex((l) => l.itemId === item.id);
    if (existingIndex >= 0) {
      // Increment qty
      const updated = [...lines];
      updated[existingIndex].qty += 1;
      setLines(updated);
    } else {
      // Add new line
      const newLine: SaleLineRow = {
        id: `row-${Date.now()}-${Math.random()}`,
        itemId: item.id,
        qty: 1,
        unitPrice: Number(item.defaultSalePrice) || 0,
        discount: 0,
        unitName: item.unit?.name || 'وحدة',
        availableStock: item.availableQty ?? null,
        code: item.displayCode || item.code,
        name: tLocalizedName(item, locale),
        imageUrl: item.imageUrl || null,
        categoryPrefix: item.category?.prefix,
        categoryName: item.category?.name,
      };
      setLines((prev) => [...prev, newLine]);
      const newIdx = lines.length;
      fetchItemStock(item.id, invoiceDate, newIdx);
    }
  };

  const handleBarcodeOrEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = posSearch.trim();
      if (!term) return;

      const exactMatch = items.find(
        (it) =>
          (it.customCode && it.customCode.toLowerCase() === term.toLowerCase()) ||
          (it.code && it.code.toLowerCase() === term.toLowerCase()) ||
          (it.displayCode && it.displayCode.toLowerCase() === term.toLowerCase())
      );

      const target = exactMatch || (filteredCatalogItems.length > 0 ? filteredCatalogItems[0] : null);
      if (target) {
        handleAddItemToCart(target);
        setPosSearch('');
      }
    }
  };

  const updateLineQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeLine(index);
      return;
    }
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], qty: newQty };
      return updated;
    });
  };

  const updateLine = (index: number, field: keyof SaleLineRow, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    if (field === 'itemId') {
      const it = items.find((i) => i.id === value);
      if (it) {
        setLines((prev) => {
          const updated = [...prev];
          updated[index].unitName = it.unit?.name || 'وحدة';
          updated[index].unitPrice = Number(it.defaultSalePrice) || 0;
          updated[index].code = it.displayCode || it.code;
          updated[index].name = tLocalizedName(it, locale);
          updated[index].imageUrl = it.imageUrl || null;
          updated[index].categoryPrefix = it.category?.prefix;
          updated[index].categoryName = it.category?.name;
          return updated;
        });
      }
      fetchItemStock(value, invoiceDate, index);
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
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (lines.length === 0) return;
    if (confirm('هل أنت متأكد من تفريغ سلة الكاشير بالكامل؟')) {
      setLines([]);
      setCashTendered(0);
    }
  };

  // Park / Hold Ticket
  const handleHoldTicket = () => {
    if (lines.length === 0) return;
    const ticket: HeldTicket = {
      id: `ticket-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      customerId,
      lines: [...lines],
      notes,
    };
    setHeldTickets((prev) => [...prev, ticket]);
    setLines([]);
    setNotes('');
    setCashTendered(0);
    setSuccessToast('تم تعليق الفاتورة بنجاح. يمكنك استعادتها بأي وقت.');
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const handleResumeTicket = (ticket: HeldTicket) => {
    if (lines.length > 0) {
      if (!confirm('توجد سلة حالية قيد العمل، هل ترغب في استبدالها بالفاتورة المعلقة؟')) {
        return;
      }
    }
    setLines(ticket.lines);
    setCustomerId(ticket.customerId);
    setNotes(ticket.notes);
    setHeldTickets((prev) => prev.filter((t) => t.id !== ticket.id));
  };

  // Grand Totals
  const totalQty = isOpeningInvoice ? 0 : lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  const totalDiscount = isOpeningInvoice ? 0 : lines.reduce((sum, l) => sum + (Number(l.discount) || 0), 0);
  const subtotalBeforeDiscount = isOpeningInvoice
    ? 0
    : lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);

  const applyPercentageDiscount = (pct: number) => {
    if (pct <= 0) {
      setLines((prev) => prev.map((l) => ({ ...l, discount: 0 })));
      return;
    }
    const factor = pct / 100;
    setLines((prev) =>
      prev.map((l) => {
        const lineSubtotal = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
        return {
          ...l,
          discount: Math.round(lineSubtotal * factor),
        };
      })
    );
  };

  const netOpeningDebt = Math.max(0, (Number(openingTotalAmount) || 0) - (Number(openingPaidAmount) || 0));
  const grandTotalSale = isOpeningInvoice
    ? Number(openingTotalAmount) || 0
    : lines.reduce((sum, l) => {
        const net = roundMoney(toDecimal(Number(l.qty) || 0).times(Number(l.unitPrice) || 0).minus(Number(l.discount) || 0));
        return sum.plus(net.gt(0) ? net : 0);
      }, zero()).toNumber();

  // Determine instant paid amount and account
  let effectivePaidNow = 0;
  let effectiveAccount: 'CASH' | 'BANK' | null = null;
  const currentTotal = isOpeningInvoice ? netOpeningDebt : grandTotalSale;
  if (collectionType === 'CASH_FULL') {
    effectivePaidNow = currentTotal;
    effectiveAccount = 'CASH';
  } else if (collectionType === 'BANK_FULL') {
    effectivePaidNow = currentTotal;
    effectiveAccount = 'BANK';
  } else if (collectionType === 'PARTIAL') {
    effectivePaidNow = customPaidAmount;
    effectiveAccount = customAccount;
  }

  // Cash Change
  const changeDue = Math.max(0, cashTendered - currentTotal);

  // Submit Sale
  const handleSaveSale = async (shouldPrintReceipt: boolean = false) => {
    setError('');

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
        setError('المبلغ المحصل مسبقاً لا يمكن أن يكون سالباً');
        return;
      }
      if ((Number(openingPaidAmount) || 0) > (Number(openingTotalAmount) || 0)) {
        setError('المبلغ المحصل مسبقاً لا يمكن أن يتجاوز إجمالي الفاتورة');
        return;
      }
    } else {
      if (lines.length === 0) {
        setError('السلة فارغة. يرجى إضافة أصناف أولاً');
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
    }

    setSaving(true);
    try {
      const payload = {
        invoiceDate,
        invoiceNo: invoiceNo.trim(),
        customerId: customerId || undefined,
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

      // Refresh data immediately so the new invoice appears on the website without delay
      void apiFetch('/api/sales', { cache: 'reload' });

      if (shouldPrintReceipt && data?.id) {
        router.push(`/sales/${data.id}/print`);
      } else {
        // Reset for next sale in POS
        setLines([]);
        setNotes('');
        setCashTendered(0);
        setOperationKey(crypto.randomUUID());
        // Next invoice number
        const nextNum = parseInt(invoiceNo.replace(/\D/g, '')) + 1;
        setInvoiceNo(`S-${nextNum}`);
        setSuccessToast('تم حفظ الفاتورة بنجاح! جاهز للزبون التالي.');
        setTimeout(() => setSuccessToast(''), 3500);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard Shortcuts (F9 Print, F10 Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleSaveSale(true);
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleSaveSale(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lines, customerId, invoiceNo, invoiceDate, effectivePaidNow, effectiveAccount]);

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/sales"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              <span>{ui("نقطة بيع ومبيعات المتجر")}</span>
            </h1>
            <p className="text-xs text-slate-500">
              {saleMode === 'POS'
                ? 'واجهة الكاشير السريعة — اختيار المنتجات بضغطة واحدة، باركود، وحساب الباقي'
                : saleMode === 'TABLE'
                ? 'النمط التقليدي لإدخال سطور الفاتورة كجدول تفصيلي'
                : 'تسجيل دين سابق على العميل بدون صرف بضاعة من المخزون'}
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setSaleMode('POS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              saleMode === 'POS'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>نقطة بيع كاشير (POS)</span>
          </button>

          <button
            type="button"
            onClick={() => setSaleMode('TABLE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              saleMode === 'TABLE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>فاتورة تقليدية (جدول)</span>
          </button>

          <button
            type="button"
            onClick={() => setSaleMode('OPENING')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              saleMode === 'OPENING'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>فاتورة سابقة (بدون مخزون)</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Held Tickets Banner */}
      {heldTickets.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold">
            <PauseCircle className="w-4 h-4 text-amber-600" />
            <span>توجد {heldTickets.length} فواتير معلقة مؤقتاً:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {heldTickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleResumeTicket(t)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold shadow-2xs"
              >
                <PlayCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>استعادة ({t.timestamp} - {t.lines.length} أصناف)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. VISUAL POS CASHIER MODE (الوضع الافتراضي للكاشير) */}
      {/* ======================================================== */}
      {saleMode === 'POS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* RIGHT: Product Catalog & Fast Barcode (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* Search & Barcode Bar */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  ref={posSearchInputRef}
                  type="text"
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  onKeyDown={handleBarcodeOrEnterKey}
                  placeholder="امسح الباركود أو ابحث باسم الصنف / الكود... (اضغط Enter للإضافة)"
                  className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 bg-slate-50/50 focus:bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setPosSearch('');
                  posSearchInputRef.current?.focus();
                }}
                className="px-2.5 py-2 text-xs text-slate-400 hover:text-slate-600 rounded-lg"
              >
                مسح
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCatId('ALL')}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCatId === 'ALL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                الكل ({items.length})
              </button>
              {categoriesList.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedCatId === cat.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{tCategory(cat.name)}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      selectedCatId === cat.id
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[calc(100vh-270px)] overflow-y-auto p-1">
              {filteredCatalogItems.map((item) => {
                const inCartLine = lines.find((l) => l.itemId === item.id);
                const cartQty = inCartLine ? inCartLine.qty : 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddItemToCart(item)}
                    className={`relative text-right rounded-2xl border p-2.5 bg-white transition-all hover:shadow-md hover:border-amber-400 active:scale-[0.98] flex flex-col justify-between group ${
                      cartQty > 0 ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-slate-200'
                    }`}
                  >
                    {/* In-cart count badge */}
                    {cartQty > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white font-mono font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-md z-10 animate-in zoom-in-75">
                        {cartQty}
                      </span>
                    )}

                    <div>
                      {/* Product Image Thumbnail */}
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-2">
                        <ProductImage
                          src={item.imageUrl}
                          alt={item.name}
                          categoryPrefix={item.category?.prefix}
                          categoryName={item.category?.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Category Prefix Tag */}
                        {item.category?.prefix && (
                          <span className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                            {item.category.prefix}
                          </span>
                        )}
                      </div>

                      {/* Code & Name */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-amber-800">
                            {item.displayCode || item.code}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {tUnit(item.unit?.name)}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                          {tLocalizedName(item, locale)}
                        </h3>
                      </div>
                    </div>

                    {/* Price & Stock Badge */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {formatNumber(Number(item.defaultSalePrice) || 0)}{' '}
                        <span className="text-[10px] font-normal text-slate-500">IDR</span>
                      </span>

                      {item.availableQty !== undefined && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            item.availableQty > 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {item.availableQty > 0 ? `${formatNumber(item.availableQty)}` : 'نفذ'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredCatalogItems.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400 text-xs">
                  لا توجد أصناف مطابقة للبحث أو الفئة المحددة
                </div>
              )}
            </div>
          </div>

          {/* LEFT: Fixed Sticky Cart & Instant Cashier Checkout (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sticky top-4 max-h-[calc(100vh-100px)]">
            {/* Cart Header (Customer & Invoice #) */}
            <div className="p-3.5 border-b border-slate-100 space-y-2.5 shrink-0 bg-slate-50/70 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-900">سلة الكاشير</span>
                  <span className="text-[11px] font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                    {invoiceNo}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleHoldTicket}
                    disabled={lines.length === 0}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold transition disabled:opacity-40"
                    title="تعليق الفاتورة لخدمة زبون آخر مؤقتاً"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>تعليق</span>
                  </button>

                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={lines.length === 0}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition disabled:opacity-30"
                    title="تفريغ السلة"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Customer Selector */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchableCombobox
                    options={customers.map((c) => ({
                      value: c.id,
                      label: `${c.code} | ${tLocalizedName(c, locale)}`,
                      code: c.code,
                      name: tLocalizedName(c, locale),
                      hint: c.phone ? `هاتف: ${c.phone}` : undefined,
                    }))}
                    value={customerId}
                    onChange={setCustomerId}
                    placeholder="عميل نقدي (كاشير سريع)"
                    onQuickAdd={() => setQuickAddCustomerOpen(true)}
                    quickAddLabel="+ عميل جديد"
                  />
                </div>
              </div>
            </div>

            {/* Cart Items List (Scrollable) */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 min-h-[160px] max-h-[320px]">
              {lines.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-1">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                  <p className="text-xs font-medium">السلة فارغة</p>
                  <p className="text-[11px] text-slate-400">
                    اضغط على أي منتج من اليمين أو امسح الباركود
                  </p>
                </div>
              ) : (
                lines.map((line, idx) => {
                  const lineTotalBeforeDiscount = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
                  const net = roundMoney(
                    toDecimal(line.qty).times(line.unitPrice).minus(line.discount)
                  ).toNumber();

                  return (
                    <div
                      key={line.id}
                      className="p-2.5 hover:bg-slate-50/80 rounded-xl transition space-y-2 border border-slate-200/70 bg-white shadow-2xs"
                    >
                      {/* Top: Product Thumbnail, Name, Code, and Delete */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                          <ProductImage
                            src={line.imageUrl}
                            alt={line.name}
                            categoryPrefix={line.categoryPrefix}
                            categoryName={line.categoryName}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {line.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="p-1 text-slate-300 hover:text-rose-600 rounded transition shrink-0"
                              title="حذف البند من السلة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] text-amber-800 font-mono font-bold">
                            {line.code} • {line.unitName || 'وحدة'}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Controls (Quantity Stepper, Editable Price, Editable Discount) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 items-center pt-1 border-t border-slate-100">
                        {/* 1. Quantity Stepper */}
                        <div className="flex items-center justify-between bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => updateLineQty(idx, line.qty - 1)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-2xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-xs px-1 min-w-[24px] text-center">
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateLineQty(idx, line.qty + 1)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* 2. Editable Unit Price Input */}
                        <div
                          className={`flex items-center gap-1 rounded-lg px-2 py-1 border transition-all ${
                            line.unitPrice === 0
                              ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-300'
                              : 'bg-slate-50 border-slate-200 focus-within:border-amber-500 focus-within:bg-white'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">السعر:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={line.unitPrice ? formatNumber(line.unitPrice) : ''}
                            placeholder="أدخل السعر"
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, '');
                              updateLine(idx, 'unitPrice', Number(raw) || 0);
                            }}
                            className="w-full bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none text-left"
                            dir="ltr"
                            title="انقر لتعديل سعر الحبة"
                          />
                        </div>

                        {/* 3. Editable Discount Input */}
                        <div className="flex items-center gap-1 rounded-lg px-2 py-1 bg-slate-50 border border-slate-200 focus-within:border-rose-400 focus-within:bg-white">
                          <span className="text-[10px] font-bold text-rose-600 shrink-0">خصم:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={line.discount ? formatNumber(line.discount) : ''}
                            placeholder="0"
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, '');
                              const num = Number(raw) || 0;
                              updateLine(idx, 'discount', Math.min(num, lineTotalBeforeDiscount));
                            }}
                            className="w-full bg-transparent text-xs font-mono font-bold text-rose-700 focus:outline-none text-left"
                            dir="ltr"
                            title="خصم البند بالروبية"
                          />
                        </div>
                      </div>

                      {/* Bottom: Line Total */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100/70">
                        <span className="text-[10px] text-slate-400">
                          {line.qty} × {formatNumber(line.unitPrice)}
                          {line.discount > 0 ? ` (خصم: -${formatNumber(line.discount)})` : ''}
                        </span>
                        <div className="text-left font-mono">
                          <span className="text-[10px] text-slate-400 ml-1">الصافي:</span>
                          <span className="font-bold text-amber-800 text-xs" dir="ltr">
                            {formatNumber(net)} IDR
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Summary & Payment (Sticky Bottom of Cart) */}
            <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl space-y-3 shrink-0">
              {/* Subtotal & Discount Breakdown */}
              {lines.length > 0 && (
                <div className="space-y-1.5 pb-2 border-b border-slate-200 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>المجموع قبل الخصم:</span>
                    <span className="font-mono font-bold text-slate-700" dir="ltr">
                      {formatNumber(subtotalBeforeDiscount)} IDR
                    </span>
                  </div>

                  {totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-rose-600">
                      <span>إجمالي الخصم الممنوح:</span>
                      <span className="font-mono font-bold" dir="ltr">
                        -{formatNumber(totalDiscount)} IDR
                      </span>
                    </div>
                  )}

                  {/* Quick Overall Discount Bar */}
                  <div className="pt-1 flex items-center justify-between gap-1">
                    <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                      <Tag className="w-3 h-3 text-amber-600" />
                      <span>خصم الفاتورة:</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {[5, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => applyPercentageDiscount(pct)}
                          className="px-2 py-0.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold font-mono transition"
                        >
                          %{pct}
                        </button>
                      ))}
                      {totalDiscount > 0 && (
                        <button
                          type="button"
                          onClick={() => applyPercentageDiscount(0)}
                          className="px-1.5 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] transition"
                          title="إلغاء الخصم"
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">الإجمالي المطلوب:</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {totalQty} قطع • {lines.length} بنود
                  </span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-xl font-black text-amber-700" dir="ltr">
                    {formatNumber(grandTotalSale)}{' '}
                    <span className="text-xs font-normal">IDR</span>
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCollectionType('CASH_FULL')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    collectionType === 'CASH_FULL'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>نقدي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionType('BANK_FULL')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    collectionType === 'BANK_FULL'
                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>تحويل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionType('PARTIAL')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    collectionType === 'PARTIAL'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>جزئي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollectionType('CREDIT')}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    collectionType === 'CREDIT'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>آجل</span>
                </button>
              </div>

              {/* Cash Denominations & Change Calculator */}
              {collectionType === 'CASH_FULL' && grandTotalSale > 0 && (
                <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-950">فئات النقد السريع:</span>
                    <button
                      type="button"
                      onClick={() => setCashTendered(grandTotalSale)}
                      className="text-[11px] font-bold text-amber-700 hover:underline"
                    >
                      المبلغ بالتمام
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                    {[50000, 100000, 200000, 500000, 1000000].map((denom) => (
                      <button
                        key={denom}
                        type="button"
                        onClick={() => setCashTendered(denom)}
                        className={`px-2 py-1 rounded-lg border font-bold transition ${
                          cashTendered === denom
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white border-amber-200 text-amber-900 hover:bg-amber-100'
                        }`}
                      >
                        {formatNumber(denom)}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-medium">المستلم:</span>
                      <input
                        type="number"
                        value={cashTendered || ''}
                        onChange={(e) => setCashTendered(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24 px-2 py-1 rounded-lg border border-amber-300 font-mono text-xs focus:outline-none focus:border-amber-600 text-left"
                      />
                    </div>

                    <div className="text-left font-mono">
                      <span className="text-slate-500 text-[10px] block">الباقي للعميل:</span>
                      <span
                        className={`text-sm font-bold ${
                          changeDue > 0 ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {formatNumber(changeDue)} IDR
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: F9 Pay & Print / F10 Quick Save */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSaveSale(true)}
                  disabled={saving || lines.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-40"
                >
                  <Printer className="w-4 h-4" />
                  <span>دفع وطباعة (F9)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveSale(false)}
                  disabled={saving || lines.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-40"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ فقط (F10)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CLASSIC TABLE MODE OR OPENING DEBT MODE */}
      {/* ======================================================== */}
      {saleMode !== 'POS' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveSale(false);
          }}
          className="space-y-4"
        >
          {/* Header Information Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>بيانات رأس الفاتورة</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العميل*</label>
                <SearchableCombobox
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.code} | ${tLocalizedName(c, locale)}`,
                    code: c.code,
                    name: tLocalizedName(c, locale),
                    hint: c.phone ? `هاتف: ${c.phone}` : undefined,
                  }))}
                  value={customerId}
                  onChange={setCustomerId}
                  placeholder="اختر العميل..."
                  onQuickAdd={() => setQuickAddCustomerOpen(true)}
                  quickAddLabel="إضافة عميل جديد سريع"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الفاتورة*</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: S-1001"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الفاتورة*</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الاستحقاق</label>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الفاتورة</label>
              <input
                type="text"
                placeholder="أي ملاحظات أو تفاصيل خاصة بطلب العميل..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Opening Invoice Debt Card */}
          {isOpeningInvoice ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
              <h2 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span>بيانات قيمة الفاتورة السابقة ورصيد ذمة العميل (بدون مخزون)</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    إجمالي قيمة الفاتورة الأصلية (IDR)*
                  </label>
                  <MoneyInput
                    value={openingTotalAmount}
                    onChange={(v) => setOpeningTotalAmount(Number(v) || 0)}
                    placeholder="0"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    إجمالي قيمة الفاتورة السابقة الصادرة للعميل
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    المحصل مسبقاً قبل فتح المحل (IDR)
                  </label>
                  <MoneyInput
                    value={openingPaidAmount}
                    onChange={(v) => setOpeningPaidAmount(Number(v) || 0)}
                    placeholder="0"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    أي دفعات سددها العميل قبل بدء النظام
                  </span>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col justify-center">
                  <span className="text-xs text-amber-900 font-bold block mb-1">
                    صافي رصيد الدين المتبقي على العميل:
                  </span>
                  <span className="text-xl font-black font-mono text-amber-900" dir="ltr">
                    {formatNumber(netOpeningDebt)} <span className="text-xs font-normal">IDR</span>
                  </span>
                  <span className="text-[11px] text-amber-700 mt-1">
                    المبلغ المتبقي كدين رسمي في كشف حساب العميل
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Classic Table Rows */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span>سطور الأصناف المباعة</span>
                </h2>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة سطر صنف</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-8 text-center">#</th>
                      <th className="p-3 min-w-[320px] lg:min-w-[360px]">الصنف والمخزون المتاح*</th>
                      <th className="p-3 min-w-[140px]">الكمية*</th>
                      <th className="p-3 min-w-[140px]">سعر الوحدة (IDR)*</th>
                      <th className="p-3 min-w-[120px]">خصم البند</th>
                      <th className="p-3 min-w-[140px] text-left">صافي البيع</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => {
                      const netSale = roundMoney(
                        toDecimal(Number(line.qty) || 0)
                          .times(Number(line.unitPrice) || 0)
                          .minus(Number(line.discount) || 0)
                      ).toNumber();

                      return (
                        <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>

                          <td className="p-2 space-y-1">
                            <SearchableCombobox
                              options={items.map((i) => ({
                                value: i.id,
                                label: `${i.code} | ${tLocalizedName(i, locale)}`,
                                code: i.code,
                                name: tLocalizedName(i, locale),
                                hint: `الوحدة: ${tUnit(i.unit?.name)}`,
                              }))}
                              value={line.itemId}
                              onChange={(val) => updateLine(idx, 'itemId', val)}
                              placeholder="اختر الصنف المباع..."
                            />
                            {line.availableStock !== null && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Package className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-500">المتاح حتى هذا التاريخ:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    Number(line.qty) > line.availableStock
                                      ? 'text-rose-600'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {formatNumber(line.availableStock)} {line.unitName}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="p-2">
                            <QtyInput
                              value={line.qty}
                              onChange={(v) => updateLine(idx, 'qty', Number(v) || 0)}
                              unitName={line.unitName || 'وحدة'}
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
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
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

          {/* Payment Method Section */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>طريقة السداد والتحصيل الفوري</span>
            </h2>

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
                آجل (لم يُدفع الآن)
              </button>

              <button
                type="button"
                onClick={() => setCollectionType('CASH_FULL')}
                className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                  collectionType === 'CASH_FULL'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                نقدي كامل (خزينة)
              </button>

              <button
                type="button"
                onClick={() => setCollectionType('BANK_FULL')}
                className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                  collectionType === 'BANK_FULL'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                تحويل كامل (بنك)
              </button>

              <button
                type="button"
                onClick={() => {
                  setCollectionType('PARTIAL');
                  if (customPaidAmount === 0) setCustomPaidAmount(Math.round(currentTotal / 2));
                }}
                className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                  collectionType === 'PARTIAL'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                دفعة جزئية
              </button>
            </div>
          </div>

          {/* Submit Actions Footer */}
          <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1 text-xs">
              <p className="text-slate-400">
                المحصل الآن: <strong className="text-emerald-400">{formatNumber(effectivePaidNow)} IDR</strong> | المتبقي على العميل:{' '}
                <strong className="text-rose-400">{formatNumber(Math.max(0, currentTotal - effectivePaidNow))} IDR</strong>
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-left font-mono">
                <p className="text-xs text-slate-400">إجمالي الفاتورة:</p>
                <p className="text-2xl font-black text-amber-400" dir="ltr">
                  {formatNumber(currentTotal)} <span className="text-sm font-normal">IDR</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
              </button>
            </div>
          </div>
        </form>
      )}

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
