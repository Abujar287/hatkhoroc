import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Users,
  Menu,
  CalendarRange,
  CalendarClock,
  NotebookPen,
  Check,
  LogOut,
  Bell,
  AlertTriangle,
  Clock,
  Wallet,
  CloudOff,
  Download,
  CheckCheck
} from 'lucide-react';
import { AppUser, AppTab, AppNotification, CostTask, MonthMapping } from '../types';
import { findMonthMapping, getMonthKeyFromLabel, formatMonth2DigitYear } from '../utils/dateUtils';

interface HeaderProps {
  currentUser: AppUser | null;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  lastSyncTime?: string;
  isSyncing: boolean;
  onSync: () => void;
  viewMode: 'mobile' | 'desktop';
  t: (en: string, bn: string) => string;
  lang?: 'en' | 'bn';
  toggleLanguage?: () => void;
  onLogout?: () => void;
  selectedMonth: string;
  monthMappings: MonthMapping[];
  dueTodayTask?: CostTask | null;
  onPayTask?: (task: CostTask) => void;
  onProfileClick?: () => void;
  notifications?: AppNotification[];
  onNotificationAction?: (notification: AppNotification) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isSyncing,
  onSync,
  t,
  lang = 'en',
  selectedMonth,
  monthMappings,
  dueTodayTask,
  onPayTask,
  onLogout,
  activeTab,
  setActiveTab,
  notifications = [],
  onNotificationAction
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('app_read_notifications_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isMenuOpen || isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, isNotifOpen]);

  const unreadNotifications = useMemo(() => {
    return notifications.filter(n => !readNotifIds.includes(n.id));
  }, [notifications, readNotifIds]);

  const unreadCount = unreadNotifications.length;

  const markAsRead = (id: string) => {
    setReadNotifIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev.slice(-80), id];
      try {
        localStorage.setItem('app_read_notifications_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleMarkAllRead = () => {
    const ids = notifications.map(n => n.id);
    setReadNotifIds(prev => {
      const merged = Array.from(new Set([...prev, ...ids])).slice(-100);
      try {
        localStorage.setItem('app_read_notifications_v1', JSON.stringify(merged));
      } catch {}
      return merged;
    });
  };

  const activeMonthLabel = React.useMemo(() => {
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    if (mapping && mapping.label) {
      return mapping.label;
    }

    try {
      const monthKey = getMonthKeyFromLabel(selectedMonth) || selectedMonth;
      if (monthKey.includes('-')) {
        const parts = monthKey.split('-');
        if (parts.length === 2) {
          const y = Number(parts[0]);
          const m = Number(parts[1]);
          if (!isNaN(y) && !isNaN(m)) {
            const d = new Date(y, m - 1, 1);
            return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD', {
              month: 'short',
              year: 'numeric'
            });
          }
        }
      }
      return selectedMonth;
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth, lang, monthMappings]);

  const userDisplayName = currentUser?.displayName || currentUser?.username || 'Abujar Al-Gifari';
  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.username?.toLowerCase() === 'abujar287';

  const userAllowedTabs: AppTab[] = React.useMemo(() => {
    const baseTabs: AppTab[] = currentUser?.allowedTabs
      ? [...currentUser.allowedTabs]
      : ['summary', 'entry', 'details', 'budget', 'upcoming_cost', 'settings'];

    if (!baseTabs.includes('monthly_summary')) {
      baseTabs.push('monthly_summary');
    }

    if (isSuperAdmin) {
      if (!baseTabs.includes('users')) baseTabs.push('users');
      if (!baseTabs.includes('upcoming_3_month')) baseTabs.push('upcoming_3_month');
      if (!baseTabs.includes('notepad')) baseTabs.push('notepad');
      return baseTabs;
    }

    if (currentUser?.role === 'admin' && !baseTabs.includes('users')) {
      baseTabs.push('users');
    }

    return baseTabs.filter(tab => tab !== 'upcoming_3_month');
  }, [currentUser, isSuperAdmin]);

  const menuItems: { id: AppTab; label: string; icon: React.FC<{ className?: string }>; superAdminOnly?: boolean }[] = [
    { id: 'monthly_summary', label: t('Monthly Summary', 'মাসিক সারসংক্ষেপ'), icon: CalendarRange },
    { id: 'upcoming_3_month', label: t('Upcoming 3 Month', 'আগামী ৩ মাস'), icon: CalendarClock },
    { id: 'notepad', label: t('Notepad', 'নোটপ্যাড'), icon: NotebookPen },
    { id: 'users', label: t('Users', 'ইউজার'), icon: Users },
  ];

  const visibleMenuItems = menuItems.filter(
    item => userAllowedTabs.includes(item.id) && (!item.superAdminOnly || isSuperAdmin)
  );

  const renderNotifIcon = (kind: AppNotification['kind']) => {
    switch (kind) {
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'due_today':
        return <Bell className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'upcoming':
        return <Clock className="w-4 h-4 text-cyan-400 shrink-0" />;
      case 'budget':
        return <Wallet className="w-4 h-4 text-orange-400 shrink-0" />;
      case 'offline_sync':
        return <CloudOff className="w-4 h-4 text-amber-300 shrink-0" />;
      case 'update':
        return <Download className="w-4 h-4 text-emerald-400 shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-teal-300 shrink-0" />;
    }
  };

  return (
    <header className="shrink-0 z-40 bg-[#042F2E]/95 backdrop-blur-xl text-[#F0FDFA] w-full pt-safe border-b border-teal-800/60 sticky top-0">
      {dueTodayTask && (
        <div className="bg-[#D95338] text-white px-3.5 py-1.5 flex items-center justify-between border-b border-white/15">
          <span className="truncate mr-2 text-[11px] font-semibold tabular-nums">
            {dueTodayTask.title} : {dueTodayTask.amount.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => onPayTask?.(dueTodayTask)}
            className="bg-white text-[#C24127] px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0 active:scale-95 transition-transform cursor-pointer whitespace-nowrap"
          >
            Pay Now
          </button>
        </div>
      )}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2">
        {/* Left: 3-Line Menu, App Logo, Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen(false);
                setIsMenuOpen(!isMenuOpen);
              }}
              className="w-10 h-10 rounded-xl bg-[#0B3C39] hover:bg-teal-900/80 text-teal-200 hover:text-white border border-teal-700/60 transition-colors cursor-pointer active:scale-95 flex items-center justify-center shrink-0 shadow-xs"
              title={t('Menu', 'মেনু')}
              aria-label={t('Menu', 'মেনু')}
            >
              <Menu className="w-5 h-5 text-emerald-400" />
            </button>

            {isMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-60 bg-[#0B3C39] border border-teal-700/70 rounded-2xl shadow-2xl z-50 p-1.5 animate-fadeIn">
                <div className="px-3 py-1.5 border-b border-teal-800/70 mb-1">
                  <span className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider">
                    {t('Menu', 'মেনু')}
                  </span>
                </div>
                <div className="space-y-0.5 max-h-[70vh] overflow-y-auto">
                  {visibleMenuItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMenuOpen(false);
                        }}
                        className={`w-full min-h-[40px] px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer rounded-xl ${
                          isActive
                            ? 'bg-[#0D9488] text-white font-bold'
                            : 'text-[#F0FDFA] hover:bg-[#062423] hover:text-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-400'}`} />
                          <span>{item.label}</span>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </div>

                {onLogout && (
                  <div className="border-t border-teal-800/70 mt-1.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full min-h-[40px] px-3 py-2 text-xs font-bold text-rose-300 hover:text-white hover:bg-rose-950/70 flex items-center gap-2.5 transition-colors cursor-pointer rounded-xl"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>{t('Log Out', 'লগআউট')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 min-w-0 select-none">
            <img
              src="/logo.png"
              alt="হাত খরচ Logo"
              className="w-9 h-9 object-contain rounded-xl shrink-0 border border-teal-700/60 bg-[#062423] p-0.5"
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight leading-tight text-white truncate">
                হাত খরচ
              </h1>
              <p className="text-[11px] font-medium text-teal-300/85 truncate leading-none mt-0.5">
                {userDisplayName}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Active Month + Notification Bell + Compact Icon-Only Sync Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-[11px] sm:text-xs font-bold text-teal-200 px-2 sm:px-2.5 py-1.5 rounded-xl bg-[#0B3C39] border border-teal-800/70 whitespace-nowrap">
            {formatMonth2DigitYear(activeMonthLabel) || activeMonthLabel}
          </span>

          {/* Notification Bell Icon */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsNotifOpen(prev => !prev);
              }}
              className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer border shrink-0 active:scale-95 ${
                notifications.length > 0
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-950/70'
                  : isNotifOpen
                    ? 'bg-teal-800 text-white border-emerald-400/70'
                    : 'bg-[#0B3C39] hover:bg-teal-900/80 text-teal-200 hover:text-white border-teal-700/60'
              }`}
              title={t('Notifications', 'নোটিফিকেশন')}
              aria-label={t('Notifications', 'নোটিফিকেশন')}
            >
              <Bell className={`w-4 h-4 ${notifications.length > 0 ? 'text-white' : 'text-teal-200'}`} />
              {notifications.length > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#F0FDFA] text-rose-700 text-[9px] font-black flex items-center justify-center border border-rose-500 shadow-sm tabular-nums ${unreadCount > 0 ? 'animate-pulse' : ''}`}>
                  {(unreadCount > 0 ? unreadCount : notifications.length) > 9 ? '9+' : (unreadCount > 0 ? unreadCount : notifications.length)}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-24px)] max-w-xs sm:w-80 bg-[#0B3C39] border border-teal-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                <div className="px-3.5 py-2.5 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bell className={`w-3.5 h-3.5 ${notifications.length > 0 ? 'text-rose-400' : 'text-teal-300'}`} />
                    <span className="text-xs font-bold text-[#F0FDFA]">
                      {t('Notifications', 'নোটিফিকেশন')}
                    </span>
                    {notifications.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-teal-900 text-emerald-300 text-[10px] font-bold tabular-nums">
                        {notifications.length}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>{t('Mark read', 'সব দেখা হয়েছে')}</span>
                    </button>
                  )}
                </div>

                <div className="max-h-[65vh] overflow-y-auto divide-y divide-teal-800/50">
                  {notifications.length === 0 ? (
                    <div className="py-8 px-4 text-center space-y-1.5">
                      <Bell className="w-7 h-7 text-teal-700/70 mx-auto" />
                      <p className="text-xs font-semibold text-teal-300/80">
                        {t('No notifications right now', 'এই মুহূর্তে কোনো নোটিফিকেশন নেই')}
                      </p>
                      <p className="text-[10px] text-teal-400/60">
                        {t('Due tasks, reminders, and alerts will appear here.', 'আজকের টাস্ক, রিমাইন্ডার এবং অ্যালার্ট এখানে দেখা যাবে।')}
                      </p>
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const isUnread = !readNotifIds.includes(notif.id);
                      return (
                        <div
                          key={notif.id}
                          onClick={() => {
                            markAsRead(notif.id);
                            setIsNotifOpen(false);
                            if (onNotificationAction) {
                              onNotificationAction(notif);
                            } else if (notif.targetTab) {
                              setActiveTab(notif.targetTab);
                            }
                          }}
                          className={`px-3.5 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                            isUnread ? 'bg-teal-900/35 hover:bg-teal-900/55' : 'hover:bg-[#062423]/60 opacity-85'
                          }`}
                        >
                          <div className="mt-0.5 p-1.5 rounded-lg bg-[#062423] border border-teal-800/70 shrink-0">
                            {renderNotifIcon(notif.kind)}
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[11px] font-bold text-[#F0FDFA] truncate">
                                {notif.title}
                              </span>
                              {notif.badgeText && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                                    notif.kind === 'overdue'
                                      ? 'bg-rose-950/90 text-rose-300 border border-rose-800/70'
                                      : notif.kind === 'due_today'
                                      ? 'bg-amber-950/90 text-amber-300 border border-amber-800/70'
                                      : notif.kind === 'budget'
                                      ? 'bg-orange-950/90 text-orange-300 border border-orange-800/70'
                                      : 'bg-teal-950 text-emerald-300 border border-teal-800/70'
                                  }`}
                                >
                                  {notif.badgeText}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-teal-200/85 leading-snug break-words">
                              {notif.message}
                            </p>
                            {notif.task && onPayTask && (
                              <div className="pt-1 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    markAsRead(notif.id);
                                    setIsNotifOpen(false);
                                    onPayTask(notif.task!);
                                  }}
                                  className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer active:scale-95"
                                >
                                  {t('Pay Now', 'পরিশোধ করুন')}
                                </button>
                              </div>
                            )}
                          </div>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer border shrink-0 ${
              isSyncing
                ? 'bg-teal-900/90 text-teal-300 border-teal-800 cursor-not-allowed'
                : 'bg-[#0D9488] hover:bg-[#0F766E] text-white border-teal-500/40 active:scale-95 shadow-sm'
            }`}
            title={isSyncing ? t('Syncing...', 'সিঙ্ক হচ্ছে...') : t('Sync Data', 'ডাটা সিঙ্ক')}
            aria-label={t('Sync Data', 'ডাটা সিঙ্ক')}
          >
            <RefreshCw className={`w-4 h-4 text-white shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
