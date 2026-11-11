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
  Settings,
  Check,
  LogOut
} from 'lucide-react';
import { AppUser, AppTab } from '../types';
import { findMonthMapping, getMonthKeyFromLabel } from '../utils/dateUtils';

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
  onProfileClick,
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

  const userAllowedTabs: AppTab[] = React.useMemo(() => {
    if (!currentUser) return ['summary', 'entry', 'details', 'budget', 'upcoming_cost', 'settings'];
    const tabs = currentUser.allowedTabs || ['summary', 'entry', 'details', 'budget', 'upcoming_cost', 'settings'];
    if (['super_admin', 'super_admin_2', 'admin'].includes(currentUser.role || '') || currentUser.username === 'abujar287') {
      if (!tabs.includes('users')) return [...tabs, 'users'];
    }
    return tabs;
  }, [currentUser]);

  const menuItems: { id: AppTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'summary', label: t('Summary', 'হিসাব'), icon: LayoutDashboard },
    { id: 'entry', label: t('Add Entry', 'এন্ট্রি'), icon: PlusCircle },
    { id: 'details', label: t('Details', 'ডিটেইলস'), icon: ListFilter },
    { id: 'budget', label: t('Budget', 'বাজেট'), icon: PieChart },
    { id: 'upcoming_cost', label: t('Upcoming Cost', 'আপকামিং'), icon: Clock },
    { id: 'settings', label: t('Settings', 'সেটিং'), icon: Settings },
    { id: 'users', label: t('Users', 'ইউজার'), icon: Users },
  ];

  const visibleMenuItems = menuItems.filter(item => userAllowedTabs.includes(item.id));

  return (
    <header className="shrink-0 z-40 bg-[#042F2E] text-[#F0FDFA] w-full shadow-md pt-safe border-b border-teal-800/60">
      {dueTodayTask && (
        <div className="bg-[#FF7A59] text-white px-3 py-1 flex items-center justify-between animate-pulse">
          <span className="truncate mr-2 text-[10px] font-bold">
            {dueTodayTask.title} : {dueTodayTask.amount.toLocaleString()}
          </span>
          <button 
            type="button" 
            onClick={() => onPayTask?.(dueTodayTask)}
            className="bg-white text-[#FF7A59] px-2 py-0.5 rounded-lg text-[9px] font-black uppercase shrink-0"
          >
            Pay Now
          </button>
        </div>
      )}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Left: 3-Line Menu, App Logo, Title */}
        <div className="flex items-center gap-2 min-w-0">
          {/* 3-Line Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 rounded-xl bg-[#062423] hover:bg-teal-900/80 text-teal-200 hover:text-white border border-teal-700/60 transition-colors cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
              title={t('Menu', 'মেনু')}
            >
              <Menu className="w-5 h-5 text-emerald-400" />
            </button>

            {isMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-52 bg-[#0B3C39] border border-teal-700/80 rounded-2xl shadow-2xl z-50 py-1.5 animate-fadeIn backdrop-blur-md">
                <div className="px-3 py-1.5 border-b border-teal-800/60 mb-1">
                  <span className="text-[10px] font-black text-teal-300/80 uppercase tracking-wider">
                    {t('Navigation Menu', 'মেনু নেভিগেশন')}
                  </span>
                </div>
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
                      className={`w-full px-3 py-2 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600/90 text-white font-black'
                          : 'text-[#F0FDFA] hover:bg-[#062423]'
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

                {onLogout && (
                  <div className="border-t border-teal-800/60 mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-2 text-xs font-extrabold text-rose-300 hover:text-white hover:bg-rose-950/60 flex items-center justify-between transition-colors cursor-pointer rounded-b-xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span>{t('Log Out', 'লগআউট')}</span>
                      </div>
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
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl shadow-md shrink-0 border border-teal-500/30 bg-[#062423] p-0.5"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight text-white truncate">
                হাত খরচ
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-teal-200/90 truncate leading-none mt-0.5">
                {userDisplayName}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Month Name Badge (Left of Sync) + Sync Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Month Name Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-[#062A28] border border-teal-700/60 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold text-emerald-300 tracking-wide">
              {activeMonthLabel}
            </span>
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer border shadow-xs ${
              isSyncing
                ? 'bg-teal-900 text-teal-300 border-teal-800'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/80 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-3 h-3 text-white ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? '...' : t('Sync', 'সিঙ্ক')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

