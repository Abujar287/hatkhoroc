import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Menu,
  CalendarRange,
  CalendarClock,
  Sliders,
  Check,
  LogOut
} from 'lucide-react';
import { AppUser, AppTab, AppNotification, CostTask, MonthMapping } from '../types';
import { findMonthMapping, getMonthKeyFromLabel, formatMonth2DigitYear } from '../utils/dateUtils';

interface HeaderProps {
  currentUser: AppUser | null;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  lastSyncTime?: string;
  isSyncing?: boolean;
  onSync?: () => void;
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

  const userDisplayName = currentUser?.displayName || currentUser?.username || 'User';
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
      return baseTabs;
    }

    if (currentUser?.role === 'admin' && !baseTabs.includes('users')) {
      baseTabs.push('users');
    }

    return baseTabs.filter(tab => tab !== 'upcoming_3_month');
  }, [currentUser, isSuperAdmin]);

  const menuItems: { id: AppTab; label: string; icon: React.FC<{ className?: string }>; superAdminOnly?: boolean }[] = [
    { id: 'monthly_summary', label: t('Monthly Summary', 'মাসিক সারসংক্ষেপ'), icon: CalendarRange },
    { id: 'budget', label: t('Budget', 'বাজেট'), icon: Sliders },
    { id: 'upcoming_3_month', label: t('Upcoming 3 Month', 'আগামী ৩ মাস'), icon: CalendarClock },
    { id: 'users', label: t('Users', 'ইউজার'), icon: Users },
  ];

  const visibleMenuItems = menuItems.filter(
    item => userAllowedTabs.includes(item.id) && (!item.superAdminOnly || isSuperAdmin)
  );

  return (
    <header className="shrink-0 z-40 bg-[#042F2E]/95 backdrop-blur-xl text-[#F0FDFA] w-full pt-safe border-b border-teal-800/50 sticky top-0">
      <AnimatePresence>
        {dueTodayTask && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#D95338] text-white px-3.5 py-1.5 flex items-center justify-between border-b border-white/15 overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-2 sm:gap-6">
        {/* Left Zone: 3-line Menu, Logo & Stacked App Name + User Name */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
          <div className="relative shrink-0" ref={menuRef}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsMenuOpen(prev => !prev)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                isMenuOpen
                  ? 'bg-teal-900 border-emerald-500/60 text-white'
                  : 'bg-[#0B3C39] hover:bg-teal-900/80 text-teal-200 hover:text-white border-teal-700/55'
              }`}
              title={t('Menu', 'মেনু')}
              aria-label={t('Menu', 'মেনু')}
            >
              <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </motion.button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 top-full mt-2 w-60 bg-[#0B3C39] border border-teal-700/70 rounded-2xl shadow-2xl z-50 p-1.5 origin-top-left"
                >
                  <div className="px-3 py-1.5 border-b border-teal-800/70 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider">
                      {t('Menu', 'মেনু')}
                    </span>
                    <span className="text-[10px] font-medium text-teal-300/70 truncate max-w-[120px]">
                      {userDisplayName}
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className="flex items-center gap-1.5 sm:gap-2 min-w-0 text-left cursor-pointer select-none group"
          >
            <img
              src="/logo.png"
              alt="হাত খরচ Logo"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-lg shrink-0 border border-teal-700/50 bg-[#062423] p-0.5 transition-transform duration-150 group-hover:scale-105"
            />
            <div className="min-w-0">
              <h1 className="text-[12.5px] sm:text-sm font-bold tracking-tight leading-tight text-white whitespace-nowrap">
                হাত খরচ
              </h1>
              <p className="text-[9.5px] sm:text-[11px] font-medium text-teal-300/80 truncate leading-tight mt-0.5 max-w-[115px] sm:max-w-[180px]">
                {userDisplayName}
              </p>
            </div>
          </button>
        </div>

        {/* Center Breathing Space */}
        <div className="flex-1 min-w-[16px] sm:min-w-[32px]" aria-hidden="true" />

        {/* Right Zone: Month Name */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
          <span className="h-7 sm:h-8 inline-flex items-center text-[10.5px] sm:text-xs font-bold text-teal-100 px-2 sm:px-2.5 rounded-lg sm:rounded-xl bg-[#0B3C39] border border-teal-700/70 whitespace-nowrap tabular-nums">
            {formatMonth2DigitYear(activeMonthLabel) || activeMonthLabel}
          </span>
        </div>
      </div>
    </header>
  );
};
