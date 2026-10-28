'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { useI18n } from '@/i18n/LanguageContext';

export function SidebarToggleControls() {
  const { setMobileOpen } = useSidebar();
  const { locale } = useI18n();
  const label = locale === 'ar' ? 'القائمة' : locale === 'id' ? 'Menu' : 'Menu';

  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      className="md:hidden inline-flex items-center gap-1.5 rounded-xl border border-[#DFD3C8] bg-white px-2.5 py-1.5 text-xs font-bold text-[#241112] shadow-xs hover:bg-[#F5EFEA] transition"
      title={locale === 'ar' ? 'فتح القائمة الجانبية' : locale === 'id' ? 'Buka menu samping' : 'Open sidebar'}
    >
      <Menu className="h-4 w-4 text-[#6E1E24]" />
      <span>{label}</span>
    </button>
  );
}
