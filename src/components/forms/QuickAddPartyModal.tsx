'use client';

import React, { useState } from 'react';
import { PartyType } from '@prisma/client';
import { X, Check } from 'lucide-react';

interface QuickAddPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: PartyType;
  onSuccess: (party: { id: string; code: string; name: string; type: PartyType }) => void;
}

export function QuickAddPartyModal({
  isOpen,
  onClose,
  defaultType = 'CLIENT',
  onSuccess,
}: QuickAddPartyModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<PartyType>(defaultType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          type,
          openingBalance: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل في إضافة الطرف');
      }
      onSuccess(data.data);
      setName('');
      setPhone('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-gray-900">إضافة طرف سريع</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">نوع الطرف</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PartyType)}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="CLIENT">عميل</option>
              <option value="SUPPLIER">مورد</option>
              <option value="DRIVER">سائق</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">الاسم الكامل *</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: سالم باحسن"
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">رقم الهاتف</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08123456789"
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-amber-500 focus:outline-none text-left"
              dir="ltr"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1 rounded-md bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:bg-amber-400"
            >
              <Check className="h-4 w-4" />
              <span>{loading ? 'جارٍ الحفظ...' : 'حفظ واختيار'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
