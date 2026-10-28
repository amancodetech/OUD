'use client';
import { createContext, useContext } from 'react';
import { useI18n } from './LanguageContext';
import type { Locale } from './types';
import translations from './interface-text.json';

export const StoreCurrencyContext = createContext('IDR');
export function translateUi(text: string, locale: Locale, currency = 'IDR'): string {
  const entry = (translations as Record<string, { en: string; id: string }>)[text];
  const translated = locale === 'ar' ? text : entry?.[locale] ?? text;
  return translated.replace(/ر\.س|\bIDR\b/g, currency);
}
export function useUiText() {
  const { locale } = useI18n();
  const currency = useContext(StoreCurrencyContext);
  return (text: string) => translateUi(text, locale, currency);
}
