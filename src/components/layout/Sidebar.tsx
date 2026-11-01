'use client';
import { apiFetch } from '@/lib/client-api';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  BookOpen,
  ShoppingCart,
  Wallet,
  ShoppingBag,
  RotateCcw,
  Sparkles,
  FlaskConical,
  Users,
  Layers,
  Contact,
  Landmark,
  Award,
  Settings,
  Sliders,
  ShieldCheck,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Flame,
  X,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { PermissionKey, canAccessHref } from '@/lib/permissions';
import { useI18n } from '@/i18n/LanguageContext';

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userPermissions?: PermissionKey[];
  storeName?: string;
}

export function Sidebar({
  userRole = 'ADMIN',
  userName,
  userPermissions,
  storeName,
}: SidebarProps) {
  const pathname = usePathname();
  const { mode, mobileOpen, toggleCollapse, setMobileOpen } = useSidebar();
  const { t, locale, isRtl } = useI18n();

  const defaultAdminName = locale === 'ar' ? 'مدير النظام' : locale === 'id' ? 'Admin Sistem' : 'System Admin';
  const currentUserName = (!userName || userName === 'مدير النظام') ? defaultAdminName : userName;
  const [currentStoreName, setCurrentStoreName] = useState<string>(storeName || 'محل العود والعطور');
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(true);

  // Check setup completion status and storeName to keep sidebar dynamically unified
  useEffect(() => {
    const checkStatus = () => {
      apiFetch('/api/settings?status=true')
        .then((res) => res.json())
        .then((res) => {
          if (res.ok && res.data) {
            setIsSetupComplete(Boolean(res.data.isComplete));
          }
        })
        .catch(() => {});

      apiFetch('/api/settings/branding')
        .then((res) => res.json())
        .then((res) => {
          if (res.ok && res.data?.storeName) {
            setCurrentStoreName(res.data.storeName);
          }
        })
        .catch(() => {});
    };
    checkStatus();
    window.addEventListener('focus', checkStatus);
    const interval = setInterval(checkStatus, 10000);
    return () => {
      window.removeEventListener('focus', checkStatus);
      clearInterval(interval);
    };
  }, [pathname]);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const rawGroups = [
    {
      title: t.sidebar.groupAnalytics,
      shortTitle: t.sidebar.dashboard,
      items: [
        { label: t.sidebar.dashboard, href: '/', icon: LayoutDashboard },
        { label: t.sidebar.inventory, href: '/inventory', icon: Package },
        { label: t.sidebar.debts, href: '/debts', icon: BookOpen },
      ],
    },
    {
      title: t.sidebar.groupDailyOps,
      shortTitle: t.sidebar.sales,
      items: [
        { label: t.sidebar.sales, href: '/sales', icon: ShoppingCart },
        { label: t.sidebar.cash, href: '/cash', icon: Wallet },
        { label: t.sidebar.purchases, href: '/purchases', icon: ShoppingBag },
        { label: t.sidebar.returns, href: '/returns', icon: RotateCcw },
      ],
    },
    {
      title: t.sidebar.groupWarehouse,
      shortTitle: t.sidebar.manufacturing,
      items: [
        { label: t.sidebar.stockIssues, href: '/stock-issues', icon: Sparkles },
        { label: t.sidebar.manufacturing, href: '/manufacturing', icon: FlaskConical },
        { label: t.sidebar.drivers, href: '/drivers', icon: Users },
      ],
    },
    {
      title: t.sidebar.groupMasterData,
      shortTitle: t.sidebar.settings,
      items: [
        { label: t.sidebar.items, href: '/items', icon: Layers },
        { label: t.sidebar.parties, href: '/parties', icon: Contact },
        { label: t.sidebar.partners, href: '/partners', icon: Landmark },
        {
          label: locale === 'ar' ? 'سياسة الهدايا' : locale === 'id' ? 'Kebijakan Hadiah' : 'Gift Policy',
          href: '/drivers/policies',
          icon: Award,
        },
        {
          label: locale === 'ar' ? 'المستخدمون والصلاحيات' : locale === 'id' ? 'Pengguna & Hak Akses' : 'Users & Permissions',
          href: '/settings/users',
          icon: ShieldCheck,
        },
        { label: t.sidebar.settings, href: '/settings', icon: Settings },
        ...(!isSetupComplete
          ? [{ label: t.sidebar.setup, href: '/setup', icon: Sliders }]
          : []),
      ],
    },
  ];

  // Filter items according to user's granted permissions (ADMIN sees everything)
  const groups = rawGroups
    .map((grp) => ({
      ...grp,
      items: grp.items.filter((item) => {
        if (userRole === 'ADMIN') {
          return true;
        }
        return canAccessHref(item.href, userPermissions ?? []);
      }),
    }))
    .filter((grp) => grp.items.length > 0);

  const handleLogout = async () => {
    if (window.confirm(t.sidebar.logoutConfirm)) {
      try {
        const response = await apiFetch('/api/auth/logout', { method: 'POST' });
        if (response.ok) window.location.href = '/login';
      } catch {
        // The session provider hides local data and offers a logout retry.
      }
    }
  };

  const isCollapsed = mode === 'collapsed';

  const roleLabel =
    userRole === 'ADMIN'
      ? locale === 'ar' ? 'مدير النظام' : locale === 'id' ? 'Admin Sistem' : 'Admin'
      : userRole === 'ACCOUNTANT'
      ? locale === 'ar' ? 'محاسب' : locale === 'id' ? 'Akuntan' : 'Accountant'
      : locale === 'ar' ? 'ريسبشن / كاشير' : locale === 'id' ? 'Kasir / Resepsionis' : 'Cashier / Reception';

  const renderSidebarContent = (forMobile = false) => {
    const compact = !forMobile && isCollapsed;

    return (
      <div className={`flex flex-col h-full bg-[#241112] text-[#F5EFEA] ${isRtl ? 'border-l' : 'border-r'} border-[#381C1E] select-none`}>
        {/* Brand Header + Collapse/Expand Toggle */}
        <div
          className={`p-3.5 border-b border-[#381C1E] flex items-center ${
            compact ? 'flex-col gap-2.5 justify-center' : 'justify-between'
          }`}
        >
          <Link href="/" prefetch={true} className="flex items-center gap-2.5 min-w-0 group">
            <div className="w-9 h-9 rounded-xl bg-[#6E1E24] shrink-0 flex items-center justify-center border border-[#9A6533]/50 shadow-xs">
              <Flame className="w-4 h-4 text-[#E6B88A]" />
            </div>
            {!compact && (
              <div className="truncate">
                <h1 className="text-sm font-bold text-[#F5EFEA] tracking-wide truncate">
                  {currentStoreName || t.meta.brandTitle}
                </h1>
                <p className="text-[11px] text-[#B89F8D] truncate">
                  {t.meta.brandSubtitle}
                </p>
              </div>
            )}
          </Link>

          {/* Toggle Collapse/Expand Button inside Sidebar */}
          {forMobile ? (
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg text-[#B89F8D] hover:text-white hover:bg-[#381C1E] transition"
              title={t.common.close}
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={toggleCollapse}
              title={compact ? t.sidebar.expandSidebar : t.sidebar.collapseSidebar}
              className={`rounded-lg text-[#D4B895] hover:text-white hover:bg-[#381C1E] transition flex items-center justify-center ${
                compact ? 'w-full py-1.5 bg-[#311719]' : 'p-1.5'
              }`}
            >
              {compact ? (
                isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto sidebar-scroll p-2.5 space-y-4">
          {groups.map((grp) => (
            <div key={grp.title}>
              {!compact ? (
                <h2 className="px-2.5 mb-1.5 text-[11px] font-bold text-[#C8A98E] tracking-wide">
                  {grp.title}
                </h2>
              ) : (
                <div className="text-[10px] font-semibold text-center text-[#B89F8D] mb-1 pb-0.5 border-b border-[#381C1E]">
                  {grp.shortTitle}
                </div>
              )}

              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : item.href === '/settings'
                      ? pathname === '/settings'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      title={compact ? item.label : undefined}
                      className={`group relative flex items-center ${
                        compact ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2'
                      } rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? `bg-[#6E1E24] text-white font-bold shadow-xs ${isRtl ? 'border-r-2' : 'border-l-2'} border-[#D4B895]`
                          : 'text-[#DFD3C8] hover:bg-[#311719] hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? 'text-[#E6B88A]' : 'text-[#B89F8D] group-hover:text-[#E6B88A]'
                        }`}
                      />
                      {!compact && <span className="truncate">{item.label}</span>}

                      {/* Floating Tooltip when Collapsed */}
                      {compact && (
                        <span
                          className={`pointer-events-none absolute ${
                            isRtl ? 'right-full mr-2' : 'left-full ml-2'
                          } hidden group-hover:flex items-center whitespace-nowrap rounded-lg bg-[#241112] border border-[#5C3A21] px-3 py-1.5 text-xs font-semibold text-[#F5EFEA] shadow-lg z-50`}
                        >
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Info & Logout Footer */}
        <div
          className={`p-3 border-t border-[#381C1E] bg-[#1C0D0E] flex items-center ${
            compact ? 'flex-col gap-2 justify-center' : 'justify-between'
          }`}
        >
          {!compact ? (
            <div className="truncate">
              <div className="text-xs font-bold text-[#F5EFEA] truncate">{currentUserName}</div>
              <div className="text-[10px] text-[#C8A98E]">
                {roleLabel}
              </div>
            </div>
          ) : (
            <div
              className="w-7 h-7 rounded-full bg-[#381C1E] text-[#E6B88A] flex items-center justify-center text-xs font-bold"
              title={`${currentUserName} (${userRole})`}
            >
              {currentUserName.charAt(0)}
            </div>
          )}

          <button
            onClick={handleLogout}
            title={t.sidebar.logout}
            className="p-1.5 rounded-lg text-[#B89F8D] hover:text-rose-300 hover:bg-[#381C1E] transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar: switches smoothly between Expanded (w-64) and Collapsed Icon Bar (w-20) */}
      <aside
        className={`hidden md:block print:!hidden shrink-0 transition-all duration-300 ease-in-out z-40 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderSidebarContent(false)}</div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex print:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-[85vw] h-full z-10">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
