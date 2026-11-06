'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Check, ChevronDown } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  code?: string;
  name?: string;
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

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

/**
 * Extracts distinct code and name from an option.
 * If code/name are explicitly provided, uses them.
 * If label is in format "CODE | NAME", parses it automatically.
 */
function getOptionDisplay(opt: ComboboxOption): { code?: string; name: string } {
  if (opt.code && opt.name) {
    return { code: opt.code, name: opt.name };
  }
  if (opt.code) {
    return { code: opt.code, name: opt.name || opt.label };
  }
  const pipeIndex = opt.label.indexOf(' | ');
  if (pipeIndex > 0 && pipeIndex <= 25) {
    const code = opt.label.slice(0, pipeIndex).trim();
    const name = opt.label.slice(pipeIndex + 3).trim();
    return { code, name };
  }
  return { code: undefined, name: opt.label };
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
  const [mounted, setMounted] = useState(false);
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  // Calculate coordinates for portal dropdown
  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const vHeight = window.innerHeight;
    const vWidth = window.innerWidth;

    const spaceBelow = vHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Flip upwards if below space is small and above space is larger
    const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;

    // Minimum 360px width so code & name are fully readable and never squished
    const menuWidth = Math.min(vWidth - 24, Math.max(rect.width, 360));

    // RTL vs LTR alignment
    const isRtl =
      document.documentElement.dir === 'rtl' ||
      document.body.dir === 'rtl' ||
      document.documentElement.lang === 'ar';

    let left: number;
    if (isRtl) {
      // In RTL, align right edge of menu to right edge of button
      left = rect.right - menuWidth;
      if (left < 12) left = 12;
      if (left + menuWidth > vWidth - 12) left = vWidth - 12 - menuWidth;
    } else {
      // In LTR, align left edge
      left = rect.left;
      if (left + menuWidth > vWidth - 12) left = vWidth - 12 - menuWidth;
      if (left < 12) left = 12;
    }

    const availableHeight = openUp ? spaceAbove - 16 : spaceBelow - 16;
    const maxHeight = Math.max(140, Math.min(380, availableHeight));

    setMenuCoords({
      openUp,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? vHeight - rect.top + 4 : undefined,
      left,
      width: menuWidth,
      maxHeight,
    });
  }, []);

  // Update coords on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  // Focus search input when menu opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter options based on label, code, name, and subtitle/hint
  const filtered = options.filter((opt) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const { code, name: optName } = getOptionDisplay(opt);
    const sub = opt.subtitle || opt.hint || '';
    return (
      opt.label.toLowerCase().includes(term) ||
      (code ? code.toLowerCase().includes(term) : false) ||
      optName.toLowerCase().includes(term) ||
      sub.toLowerCase().includes(term)
    );
  });

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input type="hidden" id={id} name={name} value={value ?? ''} required={required} />

      <button
        type="button"
        ref={buttonRef}
        disabled={disabled}
        onClick={() => {
          if (!isOpen) {
            updateCoords();
          }
          setIsOpen((prev) => !prev);
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white py-2 px-3 text-right text-xs shadow-xs transition-all disabled:bg-slate-100 disabled:text-slate-400 ${
          isOpen
            ? 'border-amber-500 ring-2 ring-amber-500/20'
            : 'border-slate-300 hover:border-amber-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 text-right">
          {selectedOption ? (
            (() => {
              const { code, name: optName } = getOptionDisplay(selectedOption);
              return (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {code && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                      {code}
                    </span>
                  )}
                  <span
                    className="font-bold text-slate-900 text-xs truncate"
                    title={`${code ? `[${code}] ` : ''}${optName}`}
                  >
                    {optName}
                  </span>
                </div>
              );
            })()
          ) : (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-600' : ''
          }`}
        />
      </button>

      {isOpen &&
        mounted &&
        menuCoords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              zIndex: 99999,
              width: `${menuCoords.width}px`,
              ...(menuCoords.openUp
                ? { bottom: `${menuCoords.bottom}px` }
                : { top: `${menuCoords.top}px` }),
              left: `${menuCoords.left}px`,
              maxHeight: `${menuCoords.maxHeight}px`,
            }}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Search Box Header */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/90 backdrop-blur shrink-0 space-y-1.5">
              <div className="relative">
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onQuickAdd();
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-1.5 px-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{quickAddLabel}</span>
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="overflow-y-auto divide-y divide-slate-100 p-1 flex-1">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                  لا توجد نتائج مطابقة
                </div>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.value === value;
                  const { code, name: optName } = getOptionDisplay(opt);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange?.(opt.value);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={`flex w-full items-center justify-between gap-2.5 p-2.5 rounded-xl text-right transition-colors ${
                        isSelected
                          ? 'bg-amber-50/90 text-amber-950 font-bold'
                          : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {code && (
                          <span className="shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-amber-100/70 text-amber-900 border border-amber-300/60">
                            {code}
                          </span>
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-900 leading-snug break-words">
                            {optName}
                          </span>
                          {(opt.subtitle || opt.hint) && (
                            <span className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                              {opt.subtitle || opt.hint}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.badge && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              opt.badgeColor === 'green'
                                ? 'bg-emerald-100 text-emerald-800'
                                : opt.badgeColor === 'orange'
                                ? 'bg-amber-100 text-amber-800'
                                : opt.badgeColor === 'red'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="h-4 w-4 text-amber-600 shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
