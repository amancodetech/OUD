'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ItemRole } from '@prisma/client';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { QtyInput } from '@/components/forms/QtyInput';
import { formatMoney, formatQty } from '@/domain/decimal';
import {
  Layers,
  Plus,
  Search,
  X,
  Check,
  Tag,
  Ruler,
  Info,
  Pencil,
  Trash2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { tLocalizedName } from '@/i18n/translate-domain';

interface ItemRow {
  id: string;
  code: string;
  displayCode?: string | null;
  customCode?: string | null;
  name: string;
  nameId?: string | null;
  nameEn?: string | null;
  role: ItemRole;
  category: { id: string; name: string; prefix: string };
  unit: { id: string; name: string };
  reorderLevel: any;
  openingQty: any;
  openingValue: any;
  defaultSalePrice?: any;
  availableQty: any;
  monthlyAvgCost: any;
  availableValue: any;
  stockStatus: string;
  costCheck?: string;
}

export default function ItemsPage() {
  const { t, locale, isRtl, tCategory, tUnit, tItemRole } = useI18n();

  interface CategoryOption {
    id: string;
    name: string;
    prefix: string;
    _count?: { items: number };
  }

  interface UnitOptionItem {
    id: string;
    name: string;
    _count?: { items: number };
  }

  const [items, setItems] = useState<ItemRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [units, setUnits] = useState<UnitOptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Category Management Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catPrefixInput, setCatPrefixInput] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [catSuccess, setCatSuccess] = useState<string | null>(null);
  const [catDeletingId, setCatDeletingId] = useState<string | null>(null);

  // Unit Management Modal State
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitNameInput, setUnitNameInput] = useState('');
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [unitSuccess, setUnitSuccess] = useState<string | null>(null);
  const [unitDeletingId, setUnitDeletingId] = useState<string | null>(null);

  // Item Form states
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formUnitId, setFormUnitId] = useState('');
  const [formRole, setFormRole] = useState<ItemRole>('MERCHANDISE');
  const [formReorderLevel, setFormReorderLevel] = useState('0');
  const [formOpeningQty, setFormOpeningQty] = useState('0');
  const [formOpeningValue, setFormOpeningValue] = useState('0');
  const [formCustomCode, setFormCustomCode] = useState('');
  const [formDefaultSalePrice, setFormDefaultSalePrice] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Edit Item Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editUnitId, setEditUnitId] = useState('');
  const [editRole, setEditRole] = useState<ItemRole>('MERCHANDISE');
  const [editReorderLevel, setEditReorderLevel] = useState('0');
  const [editCustomCode, setEditCustomCode] = useState('');
  const [editDefaultSalePrice, setEditDefaultSalePrice] = useState('0');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Item Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ItemRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleOpenEdit = (it: ItemRow) => {
    setEditingItem(it);
    setEditName(it.name);
    setEditNameEn(it.nameEn || '');
    setEditCategoryId(it.category.id);
    setEditUnitId(it.unit.id);
    setEditRole(it.role);
    setEditReorderLevel(String(it.reorderLevel || 0));
    setEditCustomCode(it.customCode || '');
    setEditDefaultSalePrice(it.defaultSalePrice ? String(it.defaultSalePrice) : '0');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditError(null);
    setEditSubmitting(true);

    try {
      const res = await fetch(`/api/items/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          nameEn: editNameEn.trim() || null,
          categoryId: editCategoryId,
          unitId: editUnitId,
          role: editRole,
          reorderLevel: editReorderLevel,
          customCode: editCustomCode || null,
          defaultSalePrice: parseFloat(editDefaultSalePrice) > 0 ? editDefaultSalePrice : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.common.errorOccurred);

      setIsEditModalOpen(false);
      setEditingItem(null);
      fetchItems();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenDelete = (it: ItemRow) => {
    setDeletingItem(it);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleteError(null);
    setDeleteSubmitting(true);

    try {
      const res = await fetch(`/api/items/${deletingItem.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.common.errorOccurred);

      setIsDeleteModalOpen(false);
      setDeletingItem(null);
      fetchItems();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const fetchItems = () => {
    setLoading(true);
    fetch('/api/items')
      .then((res) => res.json())
      .then((res) => {
        if (res.ok) setItems(res.data);
      })
      .finally(() => setLoading(false));
  };

  const fetchCategoriesAndUnits = async () => {
    try {
      const res = await fetch('/api/categories-units');
      const data = await res.json();
      if (data.ok) {
        setCategories(data.categories);
        setUnits(data.units);
        if (!formCategoryId && data.categories.length > 0) {
          setFormCategoryId(data.categories[0].id);
        }
        if (!formUnitId && data.units.length > 0) {
          setFormUnitId(data.units[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategoriesAndUnits();
  }, []);

  const resetCatModal = () => {
    setEditingCatId(null);
    setCatNameInput('');
    setCatPrefixInput('');
    setCatError(null);
    setCatSuccess(null);
  };

  const handleStartEditCat = (cat: { id: string; name: string; prefix: string }) => {
    setEditingCatId(cat.id);
    setCatNameInput(cat.name);
    setCatPrefixInput(cat.prefix);
    setCatError(null);
    setCatSuccess(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError(null);
    setCatSuccess(null);
    setCatSaving(true);
    try {
      const isEdit = Boolean(editingCatId);
      const res = await fetch('/api/categories-units', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CATEGORY',
          id: editingCatId,
          name: catNameInput,
          prefix: catPrefixInput || 'CT',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (isEdit ? 'فشل تعديل التصنيف' : 'فشل إضافة التصنيف'));

      await fetchCategoriesAndUnits();
      if (isEdit) {
        fetchItems();
        setCatSuccess(`تم تحديث التصنيف «${catNameInput}» بنجاح`);
        setEditingCatId(null);
        setCatNameInput('');
        setCatPrefixInput('');
      } else {
        setCatSuccess(`تمت إضافة التصنيف «${catNameInput}» بنجاح`);
        if (json.data?.id) {
          setFormCategoryId(json.data.id);
        }
        setCatNameInput('');
        setCatPrefixInput('');
      }
    } catch (err: unknown) {
      setCatError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ التصنيف');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: { id: string; name: string; prefix: string; _count?: { items: number } }) => {
    setCatError(null);
    setCatSuccess(null);
    if ((cat._count?.items ?? 0) > 0) {
      setCatError(`لا يمكن حذف التصنيف «${cat.name}» لأنه مرتبط بـ (${cat._count?.items}) صنف.`);
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف التصنيف «${cat.name}» نهائياً؟`)) return;

    setCatDeletingId(cat.id);
    try {
      const res = await fetch('/api/categories-units', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CATEGORY',
          id: cat.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل حذف التصنيف');

      await fetchCategoriesAndUnits();
      setCatSuccess(`تم حذف التصنيف «${cat.name}» بنجاح`);
      if (editingCatId === cat.id) {
        resetCatModal();
      }
    } catch (err: unknown) {
      setCatError(err instanceof Error ? err.message : 'حدث خطأ أثناء حذف التصنيف');
    } finally {
      setCatDeletingId(null);
    }
  };

  const resetUnitModal = () => {
    setEditingUnitId(null);
    setUnitNameInput('');
    setUnitError(null);
    setUnitSuccess(null);
  };

  const handleStartEditUnit = (unit: { id: string; name: string }) => {
    setEditingUnitId(unit.id);
    setUnitNameInput(unit.name);
    setUnitError(null);
    setUnitSuccess(null);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnitError(null);
    setUnitSuccess(null);
    setUnitSaving(true);
    try {
      const isEdit = Boolean(editingUnitId);
      const res = await fetch('/api/categories-units', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'UNIT',
          id: editingUnitId,
          name: unitNameInput,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || (isEdit ? 'فشل تعديل وحدة القياس' : 'فشل إضافة وحدة القياس'));

      await fetchCategoriesAndUnits();
      if (isEdit) {
        fetchItems();
        setUnitSuccess(`تم تحديث وحدة القياس «${unitNameInput}» بنجاح`);
        setEditingUnitId(null);
        setUnitNameInput('');
      } else {
        setUnitSuccess(`تمت إضافة وحدة القياس «${unitNameInput}» بنجاح`);
        if (json.data?.id) {
          setFormUnitId(json.data.id);
        }
        setUnitNameInput('');
      }
    } catch (err: unknown) {
      setUnitError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ وحدة القياس');
    } finally {
      setUnitSaving(false);
    }
  };

  const handleDeleteUnit = async (unit: { id: string; name: string; _count?: { items: number } }) => {
    setUnitError(null);
    setUnitSuccess(null);
    if ((unit._count?.items ?? 0) > 0) {
      setUnitError(`لا يمكن حذف وحدة القياس «${unit.name}» لأنها مرتبطة بـ (${unit._count?.items}) صنف.`);
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف وحدة القياس «${unit.name}» نهائياً؟`)) return;

    setUnitDeletingId(unit.id);
    try {
      const res = await fetch('/api/categories-units', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'UNIT',
          id: unit.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل حذف وحدة القياس');

      await fetchCategoriesAndUnits();
      setUnitSuccess(`تم حذف وحدة القياس «${unit.name}» بنجاح`);
      if (editingUnitId === unit.id) {
        resetUnitModal();
      }
    } catch (err: unknown) {
      setUnitError(err instanceof Error ? err.message : 'حدث خطأ أثناء حذف وحدة القياس');
    } finally {
      setUnitDeletingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          nameEn: formNameEn.trim() || null,
          categoryId: formCategoryId,
          unitId: formUnitId,
          role: formRole,
          reorderLevel: formReorderLevel,
          openingQty: formOpeningQty,
          openingValue: formOpeningValue,
          customCode: formCustomCode || null,
          defaultSalePrice: parseFloat(formDefaultSalePrice) > 0 ? formDefaultSalePrice : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.common.errorOccurred);

      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t.common.errorOccurred);
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormNameEn('');
    setFormRole('MERCHANDISE');
    setFormReorderLevel('0');
    setFormOpeningQty('0');
    setFormOpeningValue('0');
    setFormCustomCode('');
    setFormDefaultSalePrice('0');
    setFormError(null);
  };

  const filteredItems = items.filter((item) => {
    const matchesRole = roleFilter === 'ALL' || item.role === roleFilter;
    const matchesCategory = categoryFilter === 'ALL' || item.category.id === categoryFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(term) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(term)) ||
      item.code.toLowerCase().includes(term) ||
      (item.displayCode && item.displayCode.toLowerCase().includes(term));
    return matchesRole && matchesCategory && matchesSearch;
  });

  const getStockStatusLabel = (status: string): string => {
    if (status === 'متاح') return t.inventory.stockStatusOk;
    if (status === 'أعد الطلب') return t.inventory.stockStatusLow;
    return t.inventory.stockStatusOut;
  };

  const selectedUnitObj = units.find((u) => u.id === formUnitId);
  const selectedCatObj = categories.find((c) => c.id === formCategoryId);

  const editingCategory = categories.find((c) => c.id === editCategoryId);
  const numPart = editingItem ? editingItem.code.replace(/^[A-Za-z_-]+/i, '') : '';
  const editingDisplayCode = editingCategory?.prefix && numPart
    ? `${editingCategory.prefix}-${numPart}`
    : (editingItem ? (editingItem.displayCode || editingItem.code) : '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6DDD3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#241112] flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#6E1E24]" />
            {t.items.title}
          </h1>
          <p className="text-xs text-[#6B5648] mt-1">{t.items.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetCatModal();
              setIsCatModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[#E6DDD3] bg-white px-3.5 py-2 text-xs font-bold text-[#241112] hover:bg-[#F5EFEA] transition shadow-2xs"
            title="إدارة وتعديل وإضافة تصنيفات المنتجات"
          >
            <Tag className="h-4 w-4 text-[#6E1E24]" />
            <span>إدارة وتعديل التصنيفات</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetUnitModal();
              setIsUnitModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[#E6DDD3] bg-white px-3.5 py-2 text-xs font-bold text-[#241112] hover:bg-[#F5EFEA] transition shadow-2xs"
            title="إدارة وتعديل وإضافة وحدات القياس"
          >
            <Ruler className="h-4 w-4 text-[#9A6533]" />
            <span>إدارة وتعديل وحدات القياس</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#6E1E24] px-4 py-2 text-xs font-bold text-white hover:bg-[#58161B] shadow-xs transition"
          >
            <Plus className="h-4 w-4 text-[#E6B88A]" />
            <span>{t.items.addItem}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E6DDD3]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#F5EFEA] p-1 rounded-lg">
            {[
              { id: 'ALL', label: t.common.all },
              { id: 'MERCHANDISE', label: tItemRole('MERCHANDISE') },
              { id: 'RAW', label: 'خام (أو بيع + تصنيع معاً)' },
              { id: 'FINISHED', label: tItemRole('FINISHED') },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                  roleFilter === tab.id
                    ? 'bg-[#6E1E24] text-white shadow-xs'
                    : 'text-[#6B5648] hover:text-[#241112]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-[#E6DDD3] bg-[#F5EFEA] py-1.5 px-3 text-xs font-medium text-[#241112] focus:border-[#6E1E24] focus:outline-none"
          >
            <option value="ALL">{t.inventory.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {tCategory(c.name)} ({c.prefix})
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className={`absolute top-2.5 h-4 w-4 text-[#6B5648] ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t.inventory.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 text-xs text-[#241112] placeholder-[#6B5648] focus:border-[#6E1E24] focus:bg-white focus:outline-none ${
              isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'
            }`}
          />
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xs border border-[#E6DDD3]">
        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-[#F6F1EB] text-[#241112] border-b border-[#E6DDD3] font-bold">
              <tr>
                <th className="py-3 px-4">{t.items.code}</th>
                <th className="py-3 px-4">{t.items.name}</th>
                <th className="py-3 px-4">{t.items.category}</th>
                <th className="py-3 px-4">{t.items.unit}</th>
                <th className="py-3 px-4">{t.items.role}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.inventory.currentStock}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.inventory.weightedAvgCost}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t.inventory.totalInventoryValue}</th>
                <th className="py-3 px-4 text-center">{t.common.status}</th>
                <th className="py-3 px-4 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2ECE4] text-[#241112]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[#6B5648]">
                    {t.common.loading}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[#6B5648]">
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F9F6F2] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#6E1E24]">
                      {item.displayCode || item.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#241112]">
                        {tLocalizedName(item, locale)}
                      </div>
                      {(locale === 'en' || locale === 'id') && item.name && item.name !== tLocalizedName(item, locale) && (
                        <div className="text-[10px] text-[#6B5648] font-normal" dir="rtl">
                          {item.name}
                        </div>
                      )}
                      {locale === 'ar' && item.nameEn && (
                        <div className="text-[10px] text-[#6B5648] font-normal font-sans" dir="ltr">
                          {item.nameEn}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#6B5648]">
                      {tCategory(item.category.name)}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#6B5648]">
                      {tUnit(item.unit.name)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                          item.role === 'RAW'
                            ? 'bg-amber-50 text-[#9A6533] border border-amber-200'
                            : item.role === 'FINISHED'
                            ? 'bg-[#FAF5EE] text-[#6E1E24] border border-[#D4B895]'
                            : 'bg-[#F5EFEA] text-[#241112]'
                        }`}
                      >
                        {item.role === 'RAW' ? 'خام (تجهيز/بيع)' : tItemRole(item.role)}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-mono font-bold ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {formatQty(item.availableQty, tUnit(item.unit.name))}
                    </td>
                    <td className={`py-3 px-4 font-mono ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {formatMoney(item.monthlyAvgCost)}
                    </td>
                    <td className={`py-3 px-4 font-mono font-bold text-[#6E1E24] ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {formatMoney(item.availableValue)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.stockStatus === 'متاح'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.stockStatus === 'أعد الطلب'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {getStockStatusLabel(item.stockStatus)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/inventory/${item.id}`}
                          className="rounded-lg p-1 text-[#6B5648] hover:bg-[#F5EFEA] hover:text-[#6E1E24] transition"
                          title={isRtl ? 'بطاقة الصنف وحركة المخزون' : 'Stock Card'}
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-lg p-1 text-[#6B5648] hover:bg-[#F5EFEA] hover:text-[#241112] transition"
                          title={isRtl ? 'تعديل المنتج' : 'Edit Product'}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(item)}
                          className="rounded-lg p-1 text-[#6B5648] hover:bg-rose-50 hover:text-rose-600 transition"
                          title={isRtl ? 'حذف المنتج' : 'Delete Product'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto border border-[#E6DDD3]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6DDD3] pb-3">
              <h3 className="text-base font-bold text-[#241112] flex items-center gap-2">
                <Plus className="h-5 w-5 text-[#6E1E24]" />
                <span>{t.items.addItem}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {t.items.name} (بالعربية) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: عود كلمنتان سوبر طبيعي"
                    className="mt-1 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    الاسم بالإنجليزية (English Name)
                  </label>
                  <input
                    type="text"
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    placeholder="e.g. Kalimantan Super Natural Oud"
                    className="mt-1 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none font-sans"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#241112]">
                      {t.items.category} *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        resetCatModal();
                        setIsCatModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-[#6E1E24] hover:underline"
                    >
                      + تصنيف جديد
                    </button>
                  </div>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {tCategory(c.name)} ({c.prefix})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#241112]">
                      {t.items.unit} *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        resetUnitModal();
                        setIsUnitModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-[#6E1E24] hover:underline"
                    >
                      + وحدة جديدة
                    </button>
                  </div>
                  <select
                    value={formUnitId}
                    onChange={(e) => setFormUnitId(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {tUnit(u.name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {t.items.role} *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as ItemRole)}
                    className="mt-1 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none"
                  >
                    <option value="MERCHANDISE">
                      بضاعة جاهزة (تُشترى وتُباع مباشرة فقط)
                    </option>
                    <option value="RAW">
                      خام (يُستخدم في التصنيع + ويقبل البيع المباشر أيضاً)
                    </option>
                    <option value="FINISHED">
                      منتج تام مُصنّع (ينتج من التصنيع ويُباع)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {t.items.reorderPoint}
                  </label>
                  <div className="mt-1">
                    <QtyInput
                      value={formReorderLevel}
                      onChange={setFormReorderLevel}
                      unitName={
                        selectedUnitObj ? tUnit(selectedUnitObj.name) : t.items.unit
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Auto-generated Product Code Preview */}
              <div className="rounded-xl border border-dashed border-[#D4B895] bg-[#FAF5EE] p-3 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#6E1E24]">كود المنتج التلقائي:</span>
                  <span className="font-mono font-bold text-[#6E1E24] bg-white border border-[#D4B895] px-2.5 py-1 rounded-lg text-xs">
                    {selectedCatObj?.prefix ? `${selectedCatObj.prefix}-...` : 'توليد تلقائي'}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  يتولد تلقائياً من النظام ⚡
                </span>
              </div>

              {/* Helpful Guidance Box for ItemRole */}
              <div className="rounded-xl bg-[#FAF5EE] border border-[#D4B895] p-3 text-[11px] text-[#3D2414] flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 text-[#6E1E24] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#6E1E24]">
                    ماذا تختار إذا كان الصنف يُباع للعملاء ويُستخدم أيضاً كمادة خام في التصنيع؟
                  </span>{' '}
                  اختر دوره <strong>«خام (RAW)»</strong>؛ لأن المحرك المحاسبي يسمح ببيع الصنف الخام مباشرة في شاشة المبيعات (مع احتساب تكلفته تلقائياً بمتوسط `RAVG`)، وفي نفس الوقت يظهر ضمن قائمة المواد الخام في شاشة التصنيع.
                </div>
              </div>

              {/* Opening Stock */}
              <div className="border-t border-[#E6DDD3] pt-4">
                <h4 className="text-xs font-bold text-[#6E1E24] mb-2">
                  {t.inventory.openingQty}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#241112]">
                      {t.items.openingQty}
                    </label>
                    <div className="mt-1">
                      <QtyInput
                        value={formOpeningQty}
                        onChange={setFormOpeningQty}
                        unitName={
                          selectedUnitObj ? tUnit(selectedUnitObj.name) : t.items.unit
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#241112]">
                      {isRtl
                        ? 'قيمة أول المدة الإجمالية'
                        : 'Total Opening Stock Value'}
                    </label>
                    <div className="mt-1">
                      <MoneyInput
                        value={formOpeningValue}
                        onChange={setFormOpeningValue}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#E6DDD3] pt-4">
                <div>
                  <label className="block text-xs font-medium text-[#241112]">
                    {isRtl
                      ? 'باركود دولي / كود إضافي (اختياري)'
                      : 'Barcode / Custom SKU (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={formCustomCode}
                    onChange={(e) => setFormCustomCode(e.target.value)}
                    placeholder="اختياري - في حال وجود باركود مطبوع"
                    className="mt-1 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none font-mono text-left"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-[#6B5648] mt-1">
                    اتركه فارغاً وسيقوم النظام بتوليد كود المنتج التلقائي فوراً ({selectedCatObj?.prefix ? `${selectedCatObj.prefix}-...` : 'تلقائي'}).
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#241112]">
                    {t.items.defaultSalePrice}
                  </label>
                  <div className="mt-1">
                    <MoneyInput
                      value={formDefaultSalePrice}
                      onChange={setFormDefaultSalePrice}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E6DDD3] pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  className="rounded-xl border border-[#E6DDD3] bg-white px-4 py-2 text-xs font-bold text-[#6B5648] hover:bg-[#F5EFEA]"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#6E1E24] px-5 py-2 text-xs font-bold text-white hover:bg-[#58161B] disabled:opacity-50"
                >
                  <Check className="h-4 w-4 text-[#E6B88A]" />
                  <span>{formSubmitting ? t.common.saving : t.common.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Category Management Modal */}
      {isCatModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => {
            setIsCatModalOpen(false);
            resetCatModal();
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#E6DDD3] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6DDD3] px-6 py-4 bg-[#FAF7F2]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6E1E24]/10 text-[#6E1E24]">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#241112]">
                    إدارة وتعديل التصنيفات (الفئات)
                  </h3>
                  <p className="text-[11px] text-[#6B5648]">
                    إضافة تصنيفات جديدة، تعديل الأسماء ورموز البادئة، ومتابعة الأصناف التابعة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCatModalOpen(false);
                  resetCatModal();
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Alert messages */}
              {catError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{catError}</span>
                </div>
              )}

              {catSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{catSuccess}</span>
                </div>
              )}

              {/* Form Card (Add / Edit) */}
              <div className={`rounded-xl border p-4 transition ${editingCatId ? 'bg-amber-50/50 border-amber-300' : 'bg-[#FAF7F2] border-[#E6DDD3]'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#241112] flex items-center gap-1.5">
                    {editingCatId ? (
                      <>
                        <Pencil className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-amber-800">تعديل التصنيف المحدد</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 text-[#6E1E24]" />
                        <span>إضافة تصنيف جديد</span>
                      </>
                    )}
                  </span>
                  {editingCatId && (
                    <button
                      type="button"
                      onClick={resetCatModal}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline"
                    >
                      إلغاء وضع التعديل
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveCategory} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#241112] mb-1">
                        اسم التصنيف *
                      </label>
                      <input
                        type="text"
                        required
                        value={catNameInput}
                        onChange={(e) => setCatNameInput(e.target.value)}
                        placeholder="مثال: عود طبيعي، دهون..."
                        className="block w-full rounded-xl border border-[#E6DDD3] bg-white py-2 px-3 text-xs focus:border-[#6E1E24] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#241112] mb-1">
                        رمز البادئة للكود (Prefix) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        value={catPrefixInput}
                        onChange={(e) => setCatPrefixInput(e.target.value.toUpperCase())}
                        placeholder="مثال: OUD أو DHN"
                        className="block w-full rounded-xl border border-[#E6DDD3] bg-white py-2 px-3 text-xs font-mono uppercase focus:border-[#6E1E24] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[11px] text-[#6B5648]">
                      الرمز يظهر في بداية كود الأصناف التابعة لهذا التصنيف (مثل: OUD-001).
                    </p>
                    <div className="flex gap-2">
                      {editingCatId && (
                        <button
                          type="button"
                          onClick={resetCatModal}
                          className="rounded-xl border border-[#E6DDD3] bg-white px-3 py-1.5 text-xs font-bold text-[#6B5648] hover:bg-slate-50"
                        >
                          إلغاء
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={catSaving}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-xs transition ${
                          editingCatId
                            ? 'bg-amber-700 hover:bg-amber-800'
                            : 'bg-[#6E1E24] hover:bg-[#58161B]'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>
                          {catSaving
                            ? 'جارٍ الحفظ...'
                            : editingCatId
                            ? 'حفظ التعديلات'
                            : 'إضافة التصنيف'}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Existing Categories Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#241112]">
                    التصنيفات المسجلة في النظام ({categories.length})
                  </h4>
                </div>

                <div className="rounded-xl border border-[#E6DDD3] overflow-hidden bg-white">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-[#FAF7F2] text-[#6B5648] border-b border-[#E6DDD3] font-bold">
                        <th className="py-2.5 px-3">اسم التصنيف</th>
                        <th className="py-2.5 px-3">رمز البادئة (Prefix)</th>
                        <th className="py-2.5 px-3 text-center">الأصناف المرتبطة</th>
                        <th className="py-2.5 px-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6DDD3]/50">
                      {categories.map((cat) => {
                        const itemCount = cat._count?.items ?? 0;
                        const isCurrentEditing = editingCatId === cat.id;

                        return (
                          <tr
                            key={cat.id}
                            className={`transition hover:bg-[#FDFBF9] ${isCurrentEditing ? 'bg-amber-50/70 font-bold' : ''}`}
                          >
                            <td className="py-2.5 px-3 font-bold text-[#241112]">
                              {cat.name}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-[#F5EFEA] border border-[#E6DDD3] text-[#6E1E24]">
                                {cat.prefix}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  itemCount > 0
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {itemCount} صنف
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCat(cat)}
                                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                                  title="تعديل اسم أو بادئة التصنيف"
                                >
                                  <Pencil className="h-3 w-3" />
                                  <span>تعديل</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={itemCount > 0 || catDeletingId === cat.id}
                                  onClick={() => handleDeleteCategory(cat)}
                                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                                    itemCount > 0
                                      ? 'text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed'
                                      : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                                  }`}
                                  title={
                                    itemCount > 0
                                      ? 'لا يمكن حذف التصنيف لأنه مرتبط بأصناف'
                                      : 'حذف التصنيف'
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#E6DDD3] px-6 py-3 bg-[#FAF7F2] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCatModalOpen(false);
                  resetCatModal();
                }}
                className="rounded-xl border border-[#E6DDD3] bg-white px-5 py-2 text-xs font-bold text-[#6B5648] hover:bg-slate-50 shadow-2xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Management Modal */}
      {isUnitModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => {
            setIsUnitModalOpen(false);
            resetUnitModal();
          }}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#E6DDD3] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6DDD3] px-6 py-4 bg-[#FAF7F2]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#9A6533]/10 text-[#9A6533]">
                  <Ruler className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#241112]">
                    إدارة وتعديل وحدات القياس
                  </h3>
                  <p className="text-[11px] text-[#6B5648]">
                    إضافة وتعديل وحدات القياس (غرام، حبة، علبة، تولة، أوقية...) ومتابعة استخدامها
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUnitModalOpen(false);
                  resetUnitModal();
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Alert messages */}
              {unitError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{unitError}</span>
                </div>
              )}

              {unitSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{unitSuccess}</span>
                </div>
              )}

              {/* Form Card (Add / Edit) */}
              <div className={`rounded-xl border p-4 transition ${editingUnitId ? 'bg-amber-50/50 border-amber-300' : 'bg-[#FAF7F2] border-[#E6DDD3]'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#241112] flex items-center gap-1.5">
                    {editingUnitId ? (
                      <>
                        <Pencil className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-amber-800">تعديل وحدة القياس</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 text-[#9A6533]" />
                        <span>إضافة وحدة قياس جديدة</span>
                      </>
                    )}
                  </span>
                  {editingUnitId && (
                    <button
                      type="button"
                      onClick={resetUnitModal}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline"
                    >
                      إلغاء وضع التعديل
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveUnit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#241112] mb-1">
                      اسم وحدة القياس *
                    </label>
                    <input
                      type="text"
                      required
                      value={unitNameInput}
                      onChange={(e) => setUnitNameInput(e.target.value)}
                      placeholder="مثال: ربع تولة، أوقية، كرتون، حبة..."
                      className="block w-full rounded-xl border border-[#E6DDD3] bg-white py-2 px-3 text-xs focus:border-[#9A6533] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {editingUnitId && (
                      <button
                        type="button"
                        onClick={resetUnitModal}
                        className="rounded-xl border border-[#E6DDD3] bg-white px-3 py-1.5 text-xs font-bold text-[#6B5648] hover:bg-slate-50"
                      >
                        إلغاء
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={unitSaving}
                      className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-xs transition ${
                        editingUnitId
                          ? 'bg-amber-700 hover:bg-amber-800'
                          : 'bg-[#9A6533] hover:bg-[#835427]'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>
                        {unitSaving
                          ? 'جارٍ الحفظ...'
                          : editingUnitId
                          ? 'حفظ التعديلات'
                          : 'إضافة وحدة القياس'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Units Table */}
              <div>
                <h4 className="text-xs font-bold text-[#241112] mb-2">
                  وحدات القياس المسجلة في النظام ({units.length})
                </h4>

                <div className="rounded-xl border border-[#E6DDD3] overflow-hidden bg-white">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-[#FAF7F2] text-[#6B5648] border-b border-[#E6DDD3] font-bold">
                        <th className="py-2.5 px-3">اسم وحدة القياس</th>
                        <th className="py-2.5 px-3 text-center">الأصناف المرتبطة</th>
                        <th className="py-2.5 px-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6DDD3]/50">
                      {units.map((unit) => {
                        const itemCount = unit._count?.items ?? 0;
                        const isCurrentEditing = editingUnitId === unit.id;

                        return (
                          <tr
                            key={unit.id}
                            className={`transition hover:bg-[#FDFBF9] ${isCurrentEditing ? 'bg-amber-50/70 font-bold' : ''}`}
                          >
                            <td className="py-2.5 px-3 font-bold text-[#241112]">
                              {unit.name}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  itemCount > 0
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {itemCount} صنف
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditUnit(unit)}
                                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                                  title="تعديل اسم وحدة القياس"
                                >
                                  <Pencil className="h-3 w-3" />
                                  <span>تعديل</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={itemCount > 0 || unitDeletingId === unit.id}
                                  onClick={() => handleDeleteUnit(unit)}
                                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                                    itemCount > 0
                                      ? 'text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed'
                                      : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                                  }`}
                                  title={
                                    itemCount > 0
                                      ? 'لا يمكن حذف وحدة القياس لأنها مرتبطة بأصناف'
                                      : 'حذف وحدة القياس'
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#E6DDD3] px-6 py-3 bg-[#FAF7F2] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsUnitModalOpen(false);
                  resetUnitModal();
                }}
                className="rounded-xl border border-[#E6DDD3] bg-white px-5 py-2 text-xs font-bold text-[#6B5648] hover:bg-slate-50 shadow-2xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Item Modal */}
      {isEditModalOpen && editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto border border-[#E6DDD3]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6DDD3] pb-3">
              <h3 className="text-base font-bold text-[#241112] flex items-center gap-2">
                <Pencil className="h-4 w-4 text-[#6E1E24]" />
                <span>{isRtl ? `تعديل المنتج: ${editingItem.name}` : `Edit Product: ${editingItem.name}`}</span>
                <span className="text-xs font-mono font-bold text-[#6E1E24] bg-[#FAF5EE] px-2 py-0.5 rounded border border-[#D4B895]">
                  {editingDisplayCode}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {t.items.name} (بالعربية) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    الاسم بالإنجليزية (English Name)
                  </label>
                  <input
                    type="text"
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    placeholder="e.g. Kalimantan Super Natural Oud"
                    className="mt-1.5 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none font-sans"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {t.items.category} *
                  </label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {tCategory(c.name)} ({c.prefix})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {t.items.unit} *
                  </label>
                  <select
                    value={editUnitId}
                    onChange={(e) => setEditUnitId(e.target.value)}
                    className="mt-1.5 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {tUnit(u.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {t.items.role}
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as ItemRole)}
                    className="mt-1.5 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm focus:border-[#6E1E24] focus:bg-white focus:outline-none"
                  >
                    <option value="MERCHANDISE">{tItemRole('MERCHANDISE')}</option>
                    <option value="RAW_MATERIAL">مادة خام (خشب/زيوت/كحول)</option>
                    <option value="PACKAGING">تغليف وزجاجات وصناديق</option>
                    <option value="FINISHED_PRODUCT">{tItemRole('FINISHED_PRODUCT')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {isRtl ? 'كود المنتج' : 'Product Code'}
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="block w-full rounded-xl border border-[#E6DDD3] bg-[#F5EFEA] py-2 px-3 text-sm font-mono font-bold text-[#6E1E24]">
                      {editingDisplayCode}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                      تلقائي ⚡
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6B5648] mt-1">
                    يتحدث تلقائياً حسب فئة المنتج.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#E6DDD3] pt-3">
                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {isRtl ? 'باركود دولي / كود إضافي (اختياري)' : 'Barcode / Custom SKU (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={editCustomCode}
                    onChange={(e) => setEditCustomCode(e.target.value)}
                    placeholder="اختياري - في حال وجود باركود مطبوع"
                    className="mt-1.5 block w-full rounded-xl border border-[#E6DDD3] bg-[#F9F6F2] py-2 px-3 text-sm font-mono focus:border-[#6E1E24] focus:bg-white focus:outline-none text-left"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-[#6B5648] mt-1">
                    إذا كان للمنتج باركود مصنعي يمكنك كتابته هنا للبحث به لاحقاً.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#241112]">
                    {isRtl ? 'سعر البيع الافتراضي' : 'Default Sale Price'}
                  </label>
                  <div className="mt-1.5">
                    <MoneyInput value={editDefaultSalePrice} onChange={setEditDefaultSalePrice} />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E6DDD3] pt-3">
                <label className="block text-xs font-bold text-[#241112]">
                  {t.items.reorderPoint}
                </label>
                <div className="mt-1.5 max-w-xs">
                  <QtyInput value={editReorderLevel} onChange={setEditReorderLevel} />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E6DDD3] pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editSubmitting}
                  className="rounded-xl border border-[#E6DDD3] bg-white px-4 py-2 text-xs font-bold text-[#6B5648] hover:bg-[#F9F6F2]"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#6E1E24] px-5 py-2 text-xs font-bold text-white hover:bg-[#58161B] disabled:opacity-50"
                >
                  <Check className="h-4 w-4 text-[#E6B88A]" />
                  <span>{editSubmitting ? t.common.saving : t.common.save}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {isDeleteModalOpen && deletingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-rose-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-700 border-b border-rose-100 pb-3">
              <div className="p-2 bg-rose-50 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isRtl ? 'تأكيد حذف المنتج' : 'Confirm Delete Product'}
                </h3>
                <p className="text-xs text-slate-500">
                  {deletingItem.name} ({deletingItem.displayCode || deletingItem.code})
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {deleteError}
              </div>
            )}

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              {isRtl
                ? 'هل أنت متأكد من رغبتك في حذف هذا المنتج نهائياً؟ سيتحقق النظام من عدم وجود أي فواتير شراء أو بيع أو صرف أو رصيد مخزني له للحفاظ على سلامة التكلفة.'
                : 'Are you sure you want to delete this product? The system will verify that no purchases, sales, stock issues, or inventory balances exist for it.'}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleteSubmitting}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex items-center gap-1.5 rounded-md bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>
                  {deleteSubmitting
                    ? isRtl
                      ? 'جاري الحذف...'
                      : 'Deleting...'
                    : isRtl
                    ? 'تأكيد الحذف'
                    : 'Confirm Delete'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
