'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { DailyClosingChecklistModal } from '@/components/modals/DailyClosingChecklistModal';

export function DailyClosingButton() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-[#DFD3C8] bg-white px-3 py-1.5 text-xs font-bold text-[#6E1E24] hover:bg-[#F5EFEA] shadow-2xs transition"
        title={t.header.dailyClosingBtn}
      >
        <ShieldCheck className="h-4 w-4 text-[#9A6533]" />
        <span>{t.header.dailyClosingBtn}</span>
      </button>

      {isOpen && (
        <DailyClosingChecklistModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
