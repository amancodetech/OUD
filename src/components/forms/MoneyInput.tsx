'use client';

import React, { useState, useEffect } from 'react';

interface MoneyInputProps {
  id?: string;
  name?: string;
  value?: string | number;
  onChange?: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  currencyLabel?: string;
  autoFocus?: boolean;
}

// Convert Eastern Arabic numerals (٠-٩) to Latin (0-9)
function normalizeArabicNumerals(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(arabicDigits[i], String(i));
  }
  return res;
}

// Format number with commas: 1234567 -> 1,234,567
function formatCommas(raw: string): string {
  if (!raw) return '';
  const parts = raw.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

// Basic Arabic currency words helper for millions and thousands
function getArabicSpokenAmount(valStr: string, currency: string = 'روبية'): string {
  const num = parseFloat(valStr.replace(/,/g, ''));
  if (isNaN(num) || num <= 0) return '';

  if (num >= 1000000000) {
    const b = (num / 1000000000).toFixed(2).replace(/\.00$/, '');
    return `${b} مليار ${currency}`;
  }
  if (num >= 1000000) {
    const m = (num / 1000000).toFixed(2).replace(/\.00$/, '');
    return `${m} مليون ${currency}`;
  }
  if (num >= 1000) {
    const k = (num / 1000).toFixed(2).replace(/\.00$/, '');
    return `${k} ألف ${currency}`;
  }
  return `${num} ${currency}`;
}

export function MoneyInput({
  id,
  name,
  value,
  onChange,
  placeholder = '0',
  disabled = false,
  required = false,
  className = '',
  currencyLabel = 'IDR',
  autoFocus = false,
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>('');

  useEffect(() => {
    if (value !== undefined && value !== null) {
      const clean = String(value).replace(/,/g, '');
      setDisplayValue(formatCommas(clean));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = normalizeArabicNumerals(e.target.value);

    // Support shortcuts 'k' or 'K' (x1,000) and 'm' or 'M' (x1,000,000)
    const lower = raw.toLowerCase();
    if (lower.includes('k')) {
      const numPart = parseFloat(lower.replace(/,/g, '').replace('k', ''));
      if (!isNaN(numPart)) {
        raw = String(Math.round(numPart * 1000));
      }
    } else if (lower.includes('m')) {
      const numPart = parseFloat(lower.replace(/,/g, '').replace('m', ''));
      if (!isNaN(numPart)) {
        raw = String(Math.round(numPart * 1000000));
      }
    }

    // Keep only numbers and a single decimal point
    const cleaned = raw.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    let formattedNum = parts[0];
    if (parts.length > 1) {
      formattedNum += '.' + parts.slice(1).join('');
    }

    setDisplayValue(formatCommas(formattedNum));
    onChange?.(formattedNum);
  };

  const spoken = getArabicSpokenAmount(displayValue, currencyLabel);

  return (
    <div className="w-full">
      <div className="relative rounded-md shadow-sm">
        <input
          type="text"
          inputMode="numeric"
          id={id}
          name={name}
          dir="ltr"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          className={`block w-full rounded-md border border-gray-300 py-2 pl-3 pr-14 text-left font-mono text-base tabular-nums text-gray-900 focus:border-amber-500 focus:bg-amber-50/40 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-gray-100 disabled:text-gray-500 sm:text-sm ${className}`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-xs font-semibold text-gray-500">{currencyLabel}</span>
        </div>
      </div>
      {spoken && (
        <p className="mt-1 text-xs text-amber-800 font-medium">{spoken}</p>
      )}
    </div>
  );
}
