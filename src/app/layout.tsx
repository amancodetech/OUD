import type { Metadata } from 'next';
import './cairo.css';
import { cookies } from 'next/headers';
import { Locale } from '@/i18n/types';
import { LanguageProvider } from '@/i18n/LanguageContext';
import './globals.css';

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  title: 'Oud ERP | نظام محل العود والعطور ودهن العود',
  description: 'النظام المحاسبي والإداري المتكامل لمحل العود والعطور ودهن العود',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('oud_locale')?.value as Locale | undefined;
  const initialLocale: Locale =
    localeCookie === 'en' ? 'en' : localeCookie === 'id' ? 'id' : 'ar';
  const dir = initialLocale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={initialLocale} dir={dir} className="font-cairo" suppressHydrationWarning>
      <body className="font-sans tabular-nums antialiased bg-[#FAF6F0] text-[#24110D] selection:bg-[#8B1E24] selection:text-white">
        <LanguageProvider initialLocale={initialLocale}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
