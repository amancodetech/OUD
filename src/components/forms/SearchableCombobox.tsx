'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Check, ChevronDown } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  subtitle?: string;
  hint?: string;
  badge?: string;
  badgeColor?: 'green' | 'orange' | 'red' | 'gray';
}

interface SearchableComboboxProps {
  id?: string;
  name?: string;
  options: ComboboxOption[];
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
}

export function SearchableCombobox({
  id,
  name,
  options,
  value,
  onChange,
  placeholder = 'اختر من القائمة...',
  searchPlaceholder = 'ابحث بالاسم أو الكود...',
  disabled = false,
  required = false,
  className = '',
  onQuickAdd,
  quickAddLabel = '+ إضافة سريعة',
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((opt) => {
    const term = searchTerm.toLowerCase();
    const sub = opt.subtitle || opt.hint;
    return (
      opt.label.toLowerCase().includes(term) ||
      (sub ? sub.toLowerCase().includes(term) : false)
    );
  });

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input type="hidden" id={id} name={name} value={value ?? ''} required={required} />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white py-2 px-3 text-right text-sm shadow-sm hover:border-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-gray-100 disabled:text-gray-400"
      >
        <span className="truncate">
          {selectedOption ? (
            <span className="font-medium text-gray-900">{selectedOption.label}</span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg">
          <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 p-2">
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded border border-gray-300 py-1.5 pl-3 pr-8 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            {onQuickAdd && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onQuickAdd();
                }}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded bg-amber-50 py-1 px-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{quickAddLabel}</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-500">لا توجد نتائج مطابقة</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange?.(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`flex w-full items-center justify-between p-2.5 text-right hover:bg-amber-50/60 ${
                      isSelected ? 'bg-amber-50 font-semibold text-amber-900' : 'text-gray-800'
                    }`}
                  >
                    <div className="flex flex-col truncate">
                      <span className="truncate">{opt.label}</span>
                      {(opt.subtitle || opt.hint) && (
                        <span className="text-xs text-gray-500">{opt.subtitle || opt.hint}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {opt.badge && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            opt.badgeColor === 'green'
                              ? 'bg-emerald-100 text-emerald-800'
                              : opt.badgeColor === 'orange'
                              ? 'bg-amber-100 text-amber-800'
                              : opt.badgeColor === 'red'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-amber-600" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
