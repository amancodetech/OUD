'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { canAccessHref, PermissionKey } from '@/lib/permissions';
import { useI18n } from '@/i18n/LanguageContext';
import { StoreCurrencyContext } from '@/i18n/interface-text';

export function PageAccessGate({ permissions, currency, children }: { permissions: PermissionKey[]; currency: string; children: React.ReactNode }) {
  const path = usePathname();
  const { locale } = useI18n();
  if (!canAccessHref(path, permissions)) {
    const home = ['/drivers', '/sales', '/cash', '/inventory', '/parties', '/settings'].find(href => canAccessHref(href, permissions));
    return <div role="alert" className="rounded-xl border bg-white p-6">
      <p>{locale === 'ar' ? 'ليس لديك صلاحية عرض هذه الصفحة' : locale === 'id' ? 'Anda tidak memiliki izin membuka halaman ini' : 'You do not have permission to view this page'}</p>
      {home && <Link className="mt-3 inline-block underline" href={home}>{locale === 'ar' ? 'الانتقال إلى صفحة مسموحة' : locale === 'id' ? 'Buka halaman yang diizinkan' : 'Open an allowed page'}</Link>}
    </div>;
  }
  return <StoreCurrencyContext.Provider value={currency}>{children}</StoreCurrencyContext.Provider>;
}
