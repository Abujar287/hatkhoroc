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
  Smartphone
} from 'lucide-react';
import { AppUser, AppTab } from '../types';

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
  onOpenInstallModal?: () => void;
  globalFilterMode?: 'month' | 'all';
  setGlobalFilterMode?: (mode: 'month' | 'all') => void;
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
  onOpenInstallModal,
  globalFilterMode = 'month',
  setGlobalFilterMode
}) => {
  const allNavItems = [
    { id: 'summary' as const, label: t('Summary', 'সারাংশ'), icon: BarChart3 },
    { id: 'entry' as const, label: t('Add Entry', 'হিসাব যোগ'), icon: PlusCircle },
    { id: 'details' as const, label: t('Details', 'বিস্তারিত'), icon: ListOrdered },
    { id: 'budget' as const, label: t('Budget', 'বাজেট'), icon: Sliders },
    { id: 'users' as const, label: t('Users', 'ইউজার'), icon: Users },
    { id: 'settings' as const, label: t('Settings', 'সেটিংস'), icon: Settings }
  ];

  let allowedTabs: AppTab[] = currentUser?.allowedTabs || (
    currentUser?.role === 'super_admin_2'
      ? ['summary', 'details']
      : ['summary', 'entry', 'details', 'budget', 'users', 'settings']
  );
  if (!allowedTabs.includes('budget') && currentUser?.role !== 'super_admin_2') {
    allowedTabs = [...allowedTabs, 'budget'];
  }

  const navItems = allNavItems.filter(item => allowedTabs.includes(item.id));

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-[#0F172A] w-full shadow-sm">
      <div className="w-full px-3 py-2 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-100 bg-white">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-0.5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold block truncate leading-tight text-[#0F172A]">
              {t('HisabKitab', 'HisabKitab')}
            </span>
          </div>
        </div>

        {/* Global Filter Toggle */}
        {setGlobalFilterMode && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setGlobalFilterMode('month')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                globalFilterMode === 'month'
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('Month', 'মাস')}
            </button>
            <button
              type="button"
              onClick={() => setGlobalFilterMode('all')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                globalFilterMode === 'all'
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('All', 'সব')}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-[#16A34A] border border-emerald-200 transition-colors cursor-pointer"
              title={t('Install App', 'অ্যাপ ইনস্টল করুন')}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Install', 'ইন্সটল')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
              isSyncing
                ? 'bg-slate-100 text-slate-400 border-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 text-[#475569] border-slate-200'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? '...' : t('Sync', 'সিঙ্ক')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
