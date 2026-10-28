'use client';
import { todayInStore } from '@/domain/period';

import React, { useState, useEffect } from 'react';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { formatMoney } from '@/domain/decimal';
import { Award, Plus, Lock, CheckCircle2, AlertCircle, X, Check, Pencil, Trash2, AlertTriangle } from 'lucide-react';

interface PolicyRow {
  id: string;
  effectiveDate: string;
  customersPerGift: number;
  giftValue: string;
  notes?: string | null;
  canModify: boolean;
}

export default function GiftPoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Add Form State
  const [formDate, setFormDate] = useState(todayInStore());
  const [formThreshold, setFormThreshold] = useState(10);
  const [formGiftValue, setFormGiftValue] = useState('100000');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Edit Form State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyRow | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editThreshold, setEditThreshold] = useState(10);
  const [editGiftValue, setEditGiftValue] = useState('100000');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete Form State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<PolicyRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchPolicies = () => {
    setLoading(true);
    fetch('/api/drivers/policies')
      .then((res) => res.json())
      .then((res) => {
        if (res.ok) setPolicies(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch('/api/drivers/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          effectiveDate: formDate,
          customersPerGift: formThreshold,
          giftValue: formGiftValue,
          notes: formNotes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حفظ سياسة الهدايا');
      }

      setIsModalOpen(false);
      setFormNotes('');
      fetchPolicies();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenEdit = (p: PolicyRow) => {
    setEditingPolicy(p);
    setEditDate(p.effectiveDate);
    setEditThreshold(p.customersPerGift);
    setEditGiftValue(p.giftValue);
    setEditNotes(p.notes || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;
    setEditError(null);
    setEditSubmitting(true);

    try {
      const res = await fetch(`/api/drivers/policies/${editingPolicy.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          effectiveDate: editDate,
          customersPerGift: editThreshold,
          giftValue: editGiftValue,
          notes: editNotes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تعديل سياسة الهدايا');
      }

      setIsEditModalOpen(false);
      fetchPolicies();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'حدث خطأ أثناء التعديل');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenDelete = (p: PolicyRow) => {
    setDeletingPolicy(p);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingPolicy) return;
    setDeleteError(null);
    setDeleteSubmitting(true);

    try {
      const res = await fetch(`/api/drivers/policies/${deletingPolicy.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف سياسة الهدايا');
      }

      setIsDeleteModalOpen(false);
      fetchPolicies();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            سياسة هدايا السائقين (Gift Policies)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            تحديد عدد العملاء المؤهلين لاستحقاق الهدية وقيمتها النقدية حسب تاريخ بدء التطبيق
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow"
        >
          <Plus className="h-4 w-4" />
          <span>+ إضافة سياسة جديدة</span>
        </button>
      </div>

      <div className="rounded-lg bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
        <Lock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">قاعدة حماية السجلات السابقة (عدم التعديل بأثر رجعي): </span>
          السياسات التي سُجلت زيارات في تاريخ تطبيقها تصبح مقفلة للقراءة فقط، لضمان عدم تغيير استحقاقات السائقين المحسوبة تاريخياً. لتغيير الشروط، أضف صف سياسة جديد بتاريخ بدء تطبيق جديد.
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4">تاريخ بدء التطبيق</th>
                <th className="py-3 px-4 text-center">عدد العملاء لكل هدية</th>
                <th className="py-3 px-4 text-left">قيمة الهدية</th>
                <th className="py-3 px-4">ملاحظات</th>
                <th className="py-3 px-4 text-center">حالة السجل</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    جارٍ تحميل سياسات الهدايا...
                  </td>
                </tr>
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    لا توجد سياسات هدايا مسجلة حتى الآن
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.effectiveDate}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-900">
                      {p.customersPerGift} عملاء
                    </td>
                    <td className="py-3 px-4 text-left font-mono font-bold text-emerald-800" dir="ltr">
                      {formatMoney(p.giftValue)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{p.notes || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      {p.canModify ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          نشط وقابل للتعديل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          <Lock className="h-3 w-3" />
                          <span>مقفل (مرتبط بزيارات)</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.canModify ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            title="تعديل السياسة"
                            className="p-1 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(p)}
                            title="حذف السياسة"
                            className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">إضافة سياسة هدايا جديدة</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">تاريخ بدء التطبيق *</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  عدد العملاء المطلوب لكل هدية *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(parseInt(e.target.value, 10))}
                  className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">قيمة الهدية *</label>
                <div className="mt-1">
                  <MoneyInput
                    value={formGiftValue}
                    onChange={setFormGiftValue}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">ملاحظات أو بيان</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="ملاحظة حول سبب إضافة السياسة"
                  className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-1.5 rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:bg-amber-400"
                >
                  <Check className="h-4 w-4" />
                  <span>{formSubmitting ? 'جارٍ الحفظ...' : 'حفظ السياسة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingPolicy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">تعديل سياسة الهدايا</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">تاريخ بدء التطبيق *</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  عدد العملاء المطلوب لكل هدية *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editThreshold}
                  onChange={(e) => setEditThreshold(parseInt(e.target.value, 10))}
                  className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">قيمة الهدية *</label>
                <div className="mt-1">
                  <MoneyInput
                    value={editGiftValue}
                    onChange={setEditGiftValue}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">ملاحظات أو بيان</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="ملاحظة حول سبب تعديل السياسة"
                  className="mt-1 block w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editSubmitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 rounded-md bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:bg-amber-400"
                >
                  <Check className="h-4 w-4" />
                  <span>{editSubmitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingPolicy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="rounded-full bg-rose-50 p-2 border border-rose-200">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف السياسة</h3>
                <p className="text-xs text-slate-500">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {deleteError}
              </div>
            )}

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف سياسة الهدايا المطبقة في تاريخ{' '}
              <span className="font-mono font-bold text-slate-900">{deletingPolicy.effectiveDate}</span> بقيمة{' '}
              <span className="font-mono font-bold text-emerald-800">{formatMoney(deletingPolicy.giftValue)}</span>؟
            </p>

            <div className="mt-6 flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleteSubmitting}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex items-center gap-1.5 rounded-md bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:bg-rose-400"
              >
                <Trash2 className="h-4 w-4" />
                <span>{deleteSubmitting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
