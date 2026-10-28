'use client';

import React from 'react';
import { useI18n } from '@/i18n/LanguageContext';

export function HeaderShortcuts() {
  const { locale } = useI18n();

  const saleText = locale === 'ar' ? 'Alt+S بيع' : locale === 'id' ? 'Alt+S Jual' : 'Alt+S Sale';
  const purchaseText = locale === 'ar' ? 'Alt+P شراء' : locale === 'id' ? 'Alt+P Beli' : 'Alt+P Purchase';
  const cashText = locale === 'ar' ? 'Alt+C نقد' : locale === 'id' ? 'Alt+C Kas' : 'Alt+C Cash';

  return (
    <div className="flex items-center gap-2 text-[11px] text-[#6B5648] font-mono">
      <span className="hidden sm:inline bg-white px-2.5 py-1 rounded-lg border border-[#E6DDD3]">
        {saleText}
      </span>
      <span className="hidden sm:inline bg-white px-2.5 py-1 rounded-lg border border-[#E6DDD3]">
        {purchaseText}
      </span>
      <span className="hidden sm:inline bg-white px-2.5 py-1 rounded-lg border border-[#E6DDD3]">
        {cashText}
      </span>
    </div>
  );
}
