'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Locale, Dictionary } from './types';
import { ar } from './dictionaries/ar';
import { en } from './dictionaries/en';
import { id } from './dictionaries/id';
import {
  tCategory,
  tUnit,
  tItemRole,
  tPartyType,
  tCashType,
  tAging,
  tInvoiceKey,
  tLocalizedName,
} from './translate-domain';

const DICTIONARIES: Record<Locale, Dictionary> = { ar, en, id };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  tCategory: (name: string | null | undefined, locale?: Locale) => string;
  tUnit: (name: string | null | undefined, locale?: Locale) => string;
  tItemRole: (role: string | null | undefined, locale?: Locale) => string;
  tPartyType: (type: string | null | undefined, locale?: Locale) => string;
  tCashType: (type: string | null | undefined, locale?: Locale) => string;
  tAging: (bucket: string | null | undefined, locale?: Locale) => string;
  tInvoiceKey: (key: string | null | undefined, locale?: Locale) => string;
  tLocalizedName: (entity: { name: string; nameId?: string | null; nameEn?: string | null } | null | undefined, locale?: Locale) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale = 'ar',
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const saved = localStorage.getItem('oud_locale') as Locale | null;
    if (saved && (saved === 'ar' || saved === 'en' || saved === 'id')) {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    const dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    localStorage.setItem('oud_locale', locale);
    document.cookie = `oud_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTIONARIES[locale] || ar;
    const dir = dict.meta.dir;
    return {
      locale,
      setLocale,
      t: dict,
      dir,
      isRtl: dir === 'rtl',
      tCategory: (name, explicitLocale) => tCategory(name, explicitLocale ?? locale),
      tUnit: (name, explicitLocale) => tUnit(name, explicitLocale ?? locale),
      tItemRole: (role, explicitLocale) => tItemRole(role, explicitLocale ?? locale),
      tPartyType: (type, explicitLocale) => tPartyType(type, explicitLocale ?? locale),
      tCashType: (type, explicitLocale) => tCashType(type, explicitLocale ?? locale),
      tAging: (bucket, explicitLocale) => tAging(bucket, explicitLocale ?? locale),
      tInvoiceKey: (key, explicitLocale) => tInvoiceKey(key, explicitLocale ?? locale),
      tLocalizedName: (entity, explicitLocale) => tLocalizedName(entity, explicitLocale ?? locale),
    };
  }, [locale]);

  return (
    <I18nContext.Provider value={value}>
      <div dir={value.dir} className="min-h-screen">
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within a LanguageProvider');
  }
  return ctx;
}
