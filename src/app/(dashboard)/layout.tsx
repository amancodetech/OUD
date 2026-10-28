import React from 'react';
import { ReportPeriodProvider } from '@/components/layout/ReportPeriodContext';
import { todayInStore } from '@/domain/period';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { SidebarToggleControls } from '@/components/layout/SidebarToggleControls';
import { SetupStatusBanner } from '@/components/layout/SetupStatusBanner';
import { DailyClosingButton } from '@/components/layout/DailyClosingButton';
import { NotificationCenter } from '@/components/layout/NotificationCenter';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';
import { HeaderShortcuts } from '@/components/layout/HeaderShortcuts';
import { getSession } from '@/lib/auth';
import { getSystemSetting } from '@/services/settings.service';
import { PageAccessGate } from '@/components/layout/PageAccessGate';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  const setting = await getSystemSetting();

  return (
    <SidebarProvider>
      <KeyboardShortcuts />
      <div className="flex min-h-screen bg-[#F9F6F2] text-[#241112] print:block print:min-h-0 print:bg-white">
        {/* Sidebar (Expanded w-64 or Collapsed Icon Bar w-20) */}
        <Sidebar
          userRole={session?.role ?? 'ADMIN'}
          userName={session?.displayName ?? 'مدير النظام'}
          userPermissions={session?.permissions}
          storeName={setting.storeName}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 print:block">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-[#E6DDD3] bg-[#F9F6F2]/95 backdrop-blur-md px-6 py-2.5 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <SidebarToggleControls />
              <SetupStatusBanner />
              <DailyClosingButton />
              <NotificationCenter />
              <LanguageSwitcher />
            </div>

            <HeaderShortcuts />
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 overflow-x-auto print:p-0 print:overflow-visible"><PageAccessGate permissions={session.permissions ?? []} currency={setting.currencyCode}><ReportPeriodProvider startYear={setting.startYear} today={todayInStore()}>{children}</ReportPeriodProvider></PageAccessGate></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
