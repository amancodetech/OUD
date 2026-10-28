'use client';

import React from 'react';

interface QtyInputProps {
  id?: string;
  name?: string;
  value?: string | number;
  onChange?: (val: string) => void;
  unitName?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  min?: number;
  step?: string | number;
}

function normalizeArabicNumerals(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(arabicDigits[i], String(i));
  }
  return res;
}

export function QtyInput({
  id,
  name,
  value,
  onChange,
  unitName = 'وحدة',
  placeholder = '0',
  disabled = false,
  required = false,
  className = '',
  step = 'any',
}: QtyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = normalizeArabicNumerals(e.target.value);
    const cleaned = raw.replace(/[^\d.]/g, '');
    onChange?.(cleaned);
  };

  return (
    <div className="relative flex rounded-md shadow-sm">
      <input
        type="text"
        inputMode="decimal"
        id={id}
        name={name}
        dir="ltr"
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`block w-full rounded-r-md border border-gray-300 py-2 px-3 text-left font-mono text-base tabular-nums text-gray-900 focus:border-amber-500 focus:bg-amber-50/40 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-gray-100 disabled:text-gray-500 sm:text-sm ${className}`}
      />
      <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-xs font-medium text-gray-700">
        {unitName}
      </span>
    </div>
  );
}
