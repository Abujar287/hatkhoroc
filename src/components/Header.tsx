import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Users,
  Menu,
  LayoutDashboard,
  PlusCircle,
  ListFilter,
  PieChart,
  Clock,
  CalendarRange,
  CalendarClock,
  NotebookPen,
  Settings,
  Check,
  LogOut
} from 'lucide-react';
import { AppUser, AppTab } from '../types';
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
  monthMappings: import('../types').MonthMapping[];
  dueTodayTask?: import('../types').CostTask | null;
  onPayTask?: (task: import('../types').CostTask) => void;
  onProfileClick?: () => void;
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
  setActiveTab
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

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

    return baseTabs.filter(tab => tab !== 'upcoming_3_month' && tab !== 'notepad');
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
              onClick={() => setIsMenuOpen(!isMenuOpen)}
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

        {/* Right: Active Month + Compact Icon-Only Sync Button */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] sm:text-xs font-bold text-teal-200 px-2.5 py-1.5 rounded-xl bg-[#0B3C39] border border-teal-800/70 whitespace-nowrap">
            {formatMonth2DigitYear(activeMonthLabel) || activeMonthLabel}
          </span>

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
