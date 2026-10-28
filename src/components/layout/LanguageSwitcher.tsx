'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import { Locale } from '@/i18n/types';

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-[#E6DDD3] bg-white p-1 text-xs shadow-2xs"
      role="group"
      aria-label="Language Switcher"
    >
      {!compact && (
        <span className="flex items-center gap-1 px-1.5 text-[#6E1E24]">
          <Globe className="h-3.5 w-3.5" />
        </span>
      )}
      {LANGUAGES.map((lang) => {
        const active = locale === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLocale(lang.code)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 font-semibold transition-all ${
              active
                ? 'bg-[#6E1E24] text-white shadow-2xs'
                : 'text-[#5C4A42] hover:bg-[#F5EFEA] hover:text-[#241112]'
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        );
      })}
    </div>
  );
}
