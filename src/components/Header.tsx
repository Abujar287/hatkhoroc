import React from 'react';
import { RefreshCw } from 'lucide-react';
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
  taskDueCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isSyncing,
  onSync,
  t,
  lang = 'en',
  selectedMonth,
  monthMappings,
  taskDueCount = 0
}) => {
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

  return (
    <header className="shrink-0 z-40 bg-[#042F2E] text-[#F0FDFA] w-full shadow-md pt-safe border-b border-teal-800/60">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Left: App Title & User Full Name */}
        <div className="flex items-center gap-2.5 min-w-0">
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

        {/* Right: Month Name Badge (Left of Sync) + Sync Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Month Name Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-[#062A28] border border-teal-700/60 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold text-emerald-300 tracking-wide">
              {activeMonthLabel}
            </span>
            {taskDueCount > 0 && (
              <span className="px-1.5 py-0.5 bg-[#FF7A59] text-white text-[9px] font-black rounded-full shadow-xs animate-pulse ml-0.5">
                {taskDueCount}
              </span>
            )}
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border shadow-xs ${
              isSyncing
                ? 'bg-teal-900 text-teal-300 border-teal-800'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/80 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-white ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? '...' : t('Sync', 'সিঙ্ক')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
