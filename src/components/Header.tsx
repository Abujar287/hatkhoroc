import React from 'react';
import {
  Wallet,
  RefreshCw,
  PlusCircle,
  BarChart3,
  ListOrdered,
  Users,
  Settings,
  Sliders,
  Smartphone,
  CalendarClock
} from 'lucide-react';
import { AppUser, AppTab } from '../types';
import { findMonthMapping, formatDateShortDemo, getMonthKeyFromLabel } from '../utils/dateUtils';

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
  activeTab,
  setActiveTab,
  lastSyncTime,
  isSyncing,
  onSync,
  viewMode,
  t,
  lang = 'en',
  selectedMonth,
  monthMappings,
  taskDueCount = 0
}) => {
  const activeMonthLabel = React.useMemo(() => {
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    if (mapping) {
      return mapping.label;
    }

    try {
      const monthKey = getMonthKeyFromLabel(selectedMonth) || selectedMonth;
      const [y, m] = monthKey.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD', {
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth, lang, monthMappings]);

  const allNavItems = [
    { id: 'summary' as const, label: t('Summary', 'সারাংশ'), icon: BarChart3 },
    { id: 'entry' as const, label: t('Add Entry', 'হিসাব যোগ'), icon: PlusCircle },
    { id: 'details' as const, label: t('Details', 'বিস্তারিত'), icon: ListOrdered },
    { id: 'budget' as const, label: t('Budget', 'বাজেট'), icon: Sliders },
    { id: 'task' as const, label: t('Task', 'টাস্ক খরচ'), icon: CalendarClock },
    { id: 'settings' as const, label: t('Settings', 'সেটিংস'), icon: Settings }
  ];

  let allowedTabs: AppTab[] = currentUser?.allowedTabs || (
    currentUser?.role === 'super_admin_2'
      ? ['summary', 'details']
      : ['summary', 'entry', 'details', 'budget', 'task', 'users', 'settings']
  );
  if (!allowedTabs.includes('budget') && currentUser?.role !== 'super_admin_2') {
    allowedTabs = [...allowedTabs, 'budget'];
  }
  if (!allowedTabs.includes('task') && currentUser?.role !== 'super_admin_2') {
    allowedTabs = [...allowedTabs, 'task'];
  }

  const navItems = allNavItems.filter(item => allowedTabs.includes(item.id));

  return (
    <header className="shrink-0 z-40 bg-[#042F2E] text-[#F0FDFA] w-full shadow-md pt-safe">
      <div className="w-full px-3 py-2 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 aspect-square rounded-full overflow-hidden shrink-0 shadow-lg border border-teal-500/60 bg-[#062423] flex items-center justify-center p-0.5">
            <img src="/logo.png" alt="হাত খরচ Logo" className="w-full h-full object-contain aspect-square" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-extrabold block truncate leading-tight text-[#F0FDFA]">
              {t('হাত খরচ', 'হাত খরচ')}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
              <span className="text-[10px] font-bold text-teal-200 truncate">
                {activeMonthLabel}
              </span>
              {taskDueCount > 0 && (
                <span className="px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-bold rounded-full animate-bounce">
                  {taskDueCount} Due
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
              isSyncing
                ? 'bg-teal-900 text-teal-300 border-teal-800'
                : 'bg-teal-900/60 hover:bg-teal-900 text-[#F0FDFA] border-teal-700/60 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-4 h-4 text-teal-300 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? '...' : t('Sync', 'সিঙ্ক')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
