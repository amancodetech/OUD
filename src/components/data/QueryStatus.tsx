'use client';
import { useI18n } from '@/i18n/LanguageContext';
export function QueryStatus({ query }: { query: { error?: Error; isValidating: boolean; fetchedAt?: number; mutate: () => unknown } }) {
  const { locale } = useI18n();
  const text = locale === 'ar'
    ? { error: 'تعذر التحديث؛ تحقق من الاتصال قبل الاعتماد على البيانات المعروضة.', updating: 'جارٍ تحديث البيانات…', updated: 'آخر تحديث', retry: 'إعادة المحاولة' }
    : locale === 'id'
    ? { error: 'Pembaruan gagal; periksa koneksi sebelum menggunakan data.', updating: 'Memperbarui data…', updated: 'Diperbarui', retry: 'Coba lagi' }
    : { error: 'Refresh failed; check connectivity before relying on displayed data.', updating: 'Updating data…', updated: 'Updated', retry: 'Retry' };
  return <div role={query.error ? 'alert' : 'status'} className={`text-xs ${query.error ? 'text-red-700' : 'text-[#6B5648]'}`}>
    {query.error ? text.error : query.isValidating ? text.updating : text.updated}{' '}
    {query.fetchedAt && <time dateTime={new Date(query.fetchedAt).toISOString()}>{new Date(query.fetchedAt).toLocaleTimeString(locale)}</time>}
    {query.error && <button type="button" className="mx-2 underline" onClick={() => void query.mutate()}>{text.retry}</button>}
  </div>;
}
