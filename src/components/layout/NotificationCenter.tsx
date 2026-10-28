'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Package,
  Receipt,
  Users,
  DollarSign,
  Sliders,
  X,
  ExternalLink,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { useI18n } from '@/i18n/LanguageContext';
import type {
  SystemNotification,
  SystemNotificationCounts,
  NotificationCategory,
  NotificationSeverity,
} from '@/services/notification.service';

const STORAGE_KEY = 'oud_read_notification_ids';

export function NotificationCenter() {
  const router = useRouter();
  const { locale, isRtl } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [counts, setCounts] = useState<SystemNotificationCounts>({
    critical: 0,
    warning: 0,
    info: 0,
    total: 0,
    byCategory: {
      INVENTORY: 0,
      DEBTS: 0,
      DRIVERS: 0,
      FINANCIAL: 0,
      SETUP: 0,
    },
  });
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'ALL'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setReadIds(new Set(parsed));
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          setNotifications(json.data.notifications || []);
          setCounts(
            json.data.counts || {
              critical: 0,
              warning: 0,
              info: 0,
              total: 0,
              byCategory: {
                INVENTORY: 0,
                DEBTS: 0,
                DRIVERS: 0,
                FINANCIAL: 0,
                SETUP: 0,
              },
            }
          );
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and poll every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = new Set([...Array.from(readIds), ...notifications.map((n) => n.id)]);
    setReadIds(allIds);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const handleNavigate = (n: SystemNotification) => {
    markAsRead(n.id);
    setIsOpen(false);
    router.push(n.actionUrl);
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (selectedCategory === 'ALL') return notifications;
    return notifications.filter((n) => n.category === selectedCategory);
  }, [notifications, selectedCategory]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.has(n.id)).length;
  }, [notifications, readIds]);

  const hasUnreadCritical = useMemo(() => {
    return notifications.some((n) => n.severity === 'CRITICAL' && !readIds.has(n.id));
  }, [notifications, readIds]);

  const hasUnreadWarning = useMemo(() => {
    return notifications.some((n) => n.severity === 'WARNING' && !readIds.has(n.id));
  }, [notifications, readIds]);

  // Translations
  const txt = {
    ar: {
      title: 'مركز التنبيهات والإشعارات',
      all: 'الكل',
      inventory: 'المخزون',
      debts: 'الديون',
      drivers: 'السائقين',
      financial: 'المالية',
      setup: 'التهيئة',
      markAllRead: 'تحديد الكل كمقروء',
      refresh: 'تحديث',
      emptyTitle: 'لا توجد تنبيهات حالياً',
      emptySub: 'جميع المؤشرات التشغيلية والمالية تعمل بأفضل حال ✅',
      dismiss: 'تجاهل',
      unreadBadge: 'تنبيه جديد',
    },
    id: {
      title: 'Pusat Notifikasi & Peringatan',
      all: 'Semua',
      inventory: 'Inventaris',
      debts: 'Utang/Piutang',
      drivers: 'Pengemudi',
      financial: 'Keuangan',
      setup: 'Pengaturan',
      markAllRead: 'Tandai Semua Dibaca',
      refresh: 'Segarkan',
      emptyTitle: 'Tidak Ada Peringatan',
      emptySub: 'Semua operasional dan keuangan berjalan dengan baik ✅',
      dismiss: 'Tutup',
      unreadBadge: 'Baru',
    },
    en: {
      title: 'Alerts & Notifications',
      all: 'All',
      inventory: 'Inventory',
      debts: 'Debts',
      drivers: 'Drivers',
      financial: 'Finance',
      setup: 'Setup',
      markAllRead: 'Mark all as read',
      refresh: 'Refresh',
      emptyTitle: 'No active alerts',
      emptySub: 'All operational and financial metrics look good ✅',
      dismiss: 'Dismiss',
      unreadBadge: 'New',
    },
  }[locale] || {
    title: 'مركز التنبيهات والإشعارات',
    all: 'الكل',
    inventory: 'المخزون',
    debts: 'الديون',
    drivers: 'السائقين',
    financial: 'المالية',
    setup: 'التهيئة',
    markAllRead: 'تحديد الكل كمقروء',
    refresh: 'تحديث',
    emptyTitle: 'لا توجد تنبيهات حالياً',
    emptySub: 'جميع المؤشرات التشغيلية والمالية تعمل بأفضل حال ✅',
    dismiss: 'تجاهل',
    unreadBadge: 'تنبيه جديد',
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'INVENTORY':
        return <Package className="w-4 h-4 text-amber-600" />;
      case 'DEBTS':
        return <Receipt className="w-4 h-4 text-rose-600" />;
      case 'DRIVERS':
        return <Users className="w-4 h-4 text-emerald-600" />;
      case 'FINANCIAL':
        return <DollarSign className="w-4 h-4 text-indigo-600" />;
      case 'SETUP':
        return <Sliders className="w-4 h-4 text-amber-500" />;
    }
  };

  const getSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
            <AlertOctagon className="w-3 h-3" />
            {locale === 'ar' ? 'حرج' : 'Critical'}
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            {locale === 'ar' ? 'تنبيه' : 'Warning'}
          </span>
        );
      case 'INFO':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
            <Info className="w-3 h-3" />
            {locale === 'ar' ? 'معلومة' : 'Info'}
          </span>
        );
    }
  };

  const getLocalizedTitle = (n: SystemNotification) => {

    if (locale === 'en' && n.titleEn) return n.titleEn;
    return n.titleAr || n.title;
  };

  const getLocalizedDesc = (n: SystemNotification) => {

    if (locale === 'en' && n.descriptionEn) return n.descriptionEn;
    return n.descriptionAr || n.description;
  };

  const getLocalizedAction = (n: SystemNotification) => {

    if (locale === 'en' && n.actionLabelEn) return n.actionLabelEn;
    return n.actionLabelAr || n.actionLabel;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        aria-label="Notifications"
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 shadow-sm ${
          isOpen
            ? 'bg-[#1F160F] text-white border-[#1F160F]'
            : 'bg-white hover:bg-[#F4EFEA] text-[#4A3B32] border-[#E6DDD3]'
        }`}
      >
        <Bell className="w-4 h-4" />

        {/* Counter Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full text-[11px] font-bold text-white shadow-md border-2 border-white ${
              hasUnreadCritical
                ? 'bg-rose-600 animate-pulse'
                : hasUnreadWarning
                ? 'bg-amber-600'
                : 'bg-blue-600'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-[92vw] max-h-[82vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-[#E6DDD3] overflow-hidden ${
            isRtl ? 'right-0 left-auto' : 'left-0 right-auto'
          }`}
          style={{ transformOrigin: 'top' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#FAF7F2] border-b border-[#E6DDD3]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#2A1E17] text-white flex items-center justify-center shadow-sm">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#2A1E17] leading-none">{txt.title}</h3>
                <span className="text-[10px] text-[#8C7A6B]">
                  {unreadCount > 0 ? `${unreadCount} ${txt.unreadBadge}` : txt.emptyTitle}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={fetchNotifications}
                title={txt.refresh}
                disabled={loading}
                className="p-1.5 text-[#8C7A6B] hover:text-[#2A1E17] hover:bg-[#EFE8DF] rounded-lg transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  title={txt.markAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#2A1E17] hover:bg-[#EFE8DF] rounded-lg transition-colors"
                >
                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                  <span>{txt.markAllRead}</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[#F0EAE1] bg-white overflow-x-auto text-[11px] scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedCategory === 'ALL'
                  ? 'bg-[#2A1E17] text-white'
                  : 'text-[#6B5648] hover:bg-[#F4EFEA]'
              }`}
            >
              <span>{txt.all}</span>
              <span className="text-[10px] opacity-75 font-mono">({counts.total})</span>
            </button>

            {counts.byCategory.INVENTORY > 0 && (
              <button
                onClick={() => setSelectedCategory('INVENTORY')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedCategory === 'INVENTORY'
                    ? 'bg-[#2A1E17] text-white'
                    : 'text-[#6B5648] hover:bg-[#F4EFEA]'
                }`}
              >
                <span>{txt.inventory}</span>
                <span className="text-[10px] font-mono">({counts.byCategory.INVENTORY})</span>
              </button>
            )}

            {counts.byCategory.DEBTS > 0 && (
              <button
                onClick={() => setSelectedCategory('DEBTS')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedCategory === 'DEBTS'
                    ? 'bg-[#2A1E17] text-white'
                    : 'text-[#6B5648] hover:bg-[#F4EFEA]'
                }`}
              >
                <span>{txt.debts}</span>
                <span className="text-[10px] font-mono">({counts.byCategory.DEBTS})</span>
              </button>
            )}

            {counts.byCategory.DRIVERS > 0 && (
              <button
                onClick={() => setSelectedCategory('DRIVERS')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedCategory === 'DRIVERS'
                    ? 'bg-[#2A1E17] text-white'
                    : 'text-[#6B5648] hover:bg-[#F4EFEA]'
                }`}
              >
                <span>{txt.drivers}</span>
                <span className="text-[10px] font-mono">({counts.byCategory.DRIVERS})</span>
              </button>
            )}

            {counts.byCategory.FINANCIAL > 0 && (
              <button
                onClick={() => setSelectedCategory('FINANCIAL')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedCategory === 'FINANCIAL'
                    ? 'bg-[#2A1E17] text-white'
                    : 'text-[#6B5648] hover:bg-[#F4EFEA]'
                }`}
              >
                <span>{txt.financial}</span>
                <span className="text-[10px] font-mono">({counts.byCategory.FINANCIAL})</span>
              </button>
            )}

            {counts.byCategory.SETUP > 0 && (
              <button
                onClick={() => setSelectedCategory('SETUP')}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedCategory === 'SETUP'
                    ? 'bg-[#2A1E17] text-white'
                    : 'text-[#6B5648] hover:bg-[#F4EFEA]'
                }`}
              >
                <span>{txt.setup}</span>
                <span className="text-[10px] font-mono">({counts.byCategory.SETUP})</span>
              </button>
            )}
          </div>

          {/* List of Notification Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F0EAE1] max-h-[58vh]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-[#2A1E17]">{txt.emptyTitle}</p>
                <p className="text-xs text-[#8C7A6B] max-w-xs">{txt.emptySub}</p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isRead = readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 transition-colors relative group hover:bg-[#FAF7F2] ${
                      isRead ? 'opacity-70 bg-white' : 'bg-amber-50/20'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Icon */}
                      <div className="mt-0.5 p-1.5 rounded-lg bg-white border border-[#E6DDD3] shadow-xs shrink-0">
                        {getCategoryIcon(n.category)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {getSeverityBadge(n.severity)}
                          {!isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          )}
                        </div>

                        <h4
                          onClick={() => handleNavigate(n)}
                          className="text-xs font-bold text-[#2A1E17] hover:text-amber-800 cursor-pointer transition-colors leading-snug line-clamp-2"
                        >
                          {getLocalizedTitle(n)}
                        </h4>

                        <p className="text-[11px] text-[#6B5648] mt-1 leading-relaxed">
                          {getLocalizedDesc(n)}
                        </p>

                        {/* Action Link & Dismiss */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 border-t border-dashed border-[#EAE3D9]">
                          <button
                            onClick={() => handleNavigate(n)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B08968] hover:text-[#2A1E17] transition-colors"
                          >
                            <span>{getLocalizedAction(n)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>

                          {!isRead && (
                            <button
                              onClick={(e) => markAsRead(n.id, e)}
                              title={txt.dismiss}
                              className="text-[10px] text-[#8C7A6B] hover:text-[#2A1E17] px-1.5 py-0.5 rounded hover:bg-white transition-colors"
                            >
                              {txt.dismiss}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
