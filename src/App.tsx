import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';
import {
  ListOrdered,
  Lock,
  Eye,
  EyeOff,
  BarChart3,
  NotebookPen,
  CalendarClock,
  Settings,
  RefreshCw
} from 'lucide-react';
import {
  initAudioUnlock,
  setupWebPushSubscription,
  syncTasksToPushServer
} from './utils/taskAlarmManager';
import { AppUser, Transaction, TransactionType, UserRole, AppTab, MonthMapping, CostTask, Upcoming3MonthPlan, BouGiftEntry, NoteEntry, AppNotification } from './types';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES
} from './constants';
import {
  normalizeDate,
  normalizeTime,
  formatSyncDateTime,
  formatCleanDateTime,
  cleanMappingLabel,
  getMonthKeyFromLabel,
  findMonthMapping,
  formatTaskCreatedAt
} from './utils/dateUtils';
import { cleanCategoryName } from './utils/categoryUtils';
import { evaluateExpression } from './utils/calcUtils';
import { fetchSheetApi } from './utils/sheetApi';
import { processOfflineQueue, addToOfflineQueue, getOfflineQueue } from './utils/offlineQueue';
import { ExportMonthModal } from './components/Modals';

// Modular Components
import { Header } from './components/Header';
import { SummaryTab } from './components/SummaryTab';
import { EntryTab } from './components/EntryTab';
import { DetailsTab } from './components/DetailsTab';
import { BudgetTab } from './components/BudgetTab';
import { UpcomingCostTab } from './components/UpcomingCostTab';
import { SettingsTab } from './components/SettingsTab';
import { NotepadTab } from './components/NotepadTab';

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      await new Promise(r => setTimeout(r, 350));
      return await factory();
    }
  });
}

class TabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="py-12 px-4 text-center space-y-3">
          <p className="text-xs font-semibold text-teal-200/80">
            Tab could not load due to a recent update or network issue.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold cursor-pointer"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MonthlySummaryTab = lazyWithRetry(() =>
  import('./components/MonthlySummaryTab').then(m => ({ default: m.MonthlySummaryTab }))
);
const Upcoming3MonthTab = lazyWithRetry(() =>
  import('./components/Upcoming3MonthTab').then(m => ({ default: m.Upcoming3MonthTab }))
);
const UsersTab = lazyWithRetry(() =>
  import('./components/UsersTab').then(m => ({ default: m.UsersTab }))
);
import {
  DayDetailsModal,
  EditTransactionModal,
  DeleteConfirmModal,
  CreateUserModal,
  DeleteUserModal,
  AddCategoryModal,
  CategoryManagerModal,
  MobileInstallModal,
  EditProfileModal,
  ExitConfirmModal,
  SelfSignupModal,
  UserProfileModal,
  AppUpdateModal
} from './components/Modals';
import { usePWAInstall } from './usePWAInstall';
import { checkGitHubForUpdates, isUpdateDismissedRecently, recordUpdateDismissed, UpdateInfo, getAppLastUpdateTime, APP_VERSION } from './utils/updateChecker';

function normalizeUserTabs(role?: UserRole, username?: string, rawTabs?: AppTab[]): AppTab[] {
  const isSuper = role === 'super_admin' || username?.toLowerCase() === 'abujar287';
  const defaultTabs: AppTab[] =
    role === 'super_admin_2'
      ? ['summary', 'monthly_summary', 'details']
      : isSuper
        ? ['summary', 'monthly_summary', 'entry', 'details', 'budget', 'upcoming_cost', 'upcoming_3_month', 'notepad', 'users', 'settings']
        : ['summary', 'monthly_summary', 'entry', 'details', 'budget', 'upcoming_cost', 'settings'];

  let tabs = rawTabs && rawTabs.length > 0 ? [...rawTabs] : [...defaultTabs];
  if (!tabs.includes('monthly_summary')) tabs.push('monthly_summary');
  if (role !== 'super_admin_2') {
    if (!tabs.includes('budget')) tabs.push('budget');
    if (!tabs.includes('upcoming_cost')) tabs.push('upcoming_cost');
  }
  if (isSuper) {
    if (!tabs.includes('users')) tabs.push('users');
    if (!tabs.includes('upcoming_3_month')) tabs.push('upcoming_3_month');
    if (!tabs.includes('notepad')) tabs.push('notepad');
  } else {
    tabs = tabs.filter(tab => tab !== 'upcoming_3_month');
    if (role !== 'admin') {
      tabs = tabs.filter(tab => tab !== 'users');
    }
  }
  return Array.from(new Set(tabs));
}

// Default Admin User
const DEFAULT_ADMIN: AppUser = {
  username: 'abujar287',
  password: 'hisabkitab',
  displayName: 'Abujar Al-Gifari',
  initialUsername: 'abujar287',
  sheetTab: 'abujar287',
  createdAt: '2026-10-01',
  role: 'super_admin',
  isActive: true,
  allowedTabs: ['summary', 'monthly_summary', 'entry', 'details', 'budget', 'upcoming_cost', 'upcoming_3_month', 'notepad', 'users', 'settings'],
  isReadOnly: false
};

// Web Audio API feedback
function playSound(type: 'success' | 'delete' = 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {}
}

export default function App() {

  // ----------------------------------------------------
  // 1. FUNDAMENTAL STATE
  // ----------------------------------------------------
  const [lang] = useState<'en'>('en');
  const t = useCallback((en: string, _bn?: string) => en, []);
  
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success'
  });

  const { isInstallable, install, isInstalled } = usePWAInstall();
  const [hasPromptedInstall, setHasPromptedInstall] = useState(false);
  
  // MODAL STATES (Must be declared before exit guard logic)
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [isAppExited, setIsAppExited] = useState<boolean>(false);
  const [selectedDateModal, setSelectedDateModal] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [showMobileModal, setShowMobileModal] = useState<boolean>(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
  const [showSelfSignupModal, setShowSelfSignupModal] = useState<boolean>(false);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  const handlePerformExportZip = async (params: { month: string; startDate?: string; endDate?: string }) => {
    setShowExportModal(false);
    setIsExportingZip(true);
    try {
      const { exportMonthlyReportZip } = await import('./utils/exportZipReport');
      await exportMonthlyReportZip({
        month: params.month,
        startDate: params.startDate,
        endDate: params.endDate,
        transactions,
        lang,
        userName: currentUser?.displayName || currentUser?.username || 'Abujar Al-Gifari',
        monthMappings
      });
      showToast(t('Monthly report ZIP downloaded!', 'মাসিক রিপোর্ট ZIP ডাউনলোড সম্পন্ন!'), 'success');
    } catch (err: any) {
      showToast(err?.message || t('Failed to export ZIP report', 'ZIP রিপোর্ট এক্সপোর্ট করা যায়নি'), 'error');
    } finally {
      setIsExportingZip(false);
    }
  };
  const [rememberLogin, setRememberLogin] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_remember_login') === 'true';
    } catch {
      return false;
    }
  });
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [updateInfoModal, setUpdateInfoModal] = useState<UpdateInfo | null>(null);
  const [updateAutoStart, setUpdateAutoStart] = useState<boolean>(false);

  // ----------------------------------------------------
  // 2. BACK BUTTON EXIT LOGIC (Robust Interception)
  // ----------------------------------------------------
  // Moved up so it has access to the above modal states but defined after they exist
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const isRemembered = localStorage.getItem('app_remember_login') === 'true';
      if (!isRemembered) return false;
      const saved = localStorage.getItem('active_user_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username) return true;
      }
    } catch {}
    return false;
  });


  useEffect(() => {
    if (isInstallable && !isInstalled && !hasPromptedInstall) {
      const timer = setTimeout(() => {
        setShowMobileModal(true);
        setHasPromptedInstall(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, hasPromptedInstall]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  }, []);

  const [appLastUpdateTime, setAppLastUpdateTime] = useState<string>(() => getAppLastUpdateTime());

  const handleCheckForUpdates = useCallback(async (isManual = false) => {
    try {
      if (isManual) {
        showToast(lang === 'en' ? 'Checking for updates...' : 'আপডেট চেক করা হচ্ছে...', 'info');
      }
      const info = await checkGitHubForUpdates(isManual);
      setAppLastUpdateTime(getAppLastUpdateTime());

      if (isManual) {
        if (!info || !info.hasUpdate) {
          // Versions match! Notify user cleanly that they are already on the latest version!
          showToast(
            lang === 'en'
              ? `Already installed latest version (হাত খরচ ${APP_VERSION})`
              : `অলরেডি লেটেস্ট ভার্সন ইনস্টল করা আছে (হাত খরচ ${APP_VERSION})`,
            'success'
          );
          return;
        }

        // New version exists on GitHub! Start auto-download -> install -> Open flow immediately in-app
        setUpdateInfoModal(info);
        setUpdateAutoStart(true);
        setShowUpdateModal(true);
      } else if (info && info.hasUpdate) {
        setUpdateInfoModal(info);
        setUpdateAutoStart(false);
        setShowUpdateModal(true);
      }
    } catch {
      if (isManual) {
        showToast(
          lang === 'en'
            ? `Already installed latest version (হাত খরচ ${APP_VERSION})`
            : `অলরেডি লেটেস্ট ভার্সন ইনস্টল করা আছে (হাত খরচ ${APP_VERSION})`,
          'success'
        );
      }
    }
  }, [lang, showToast]);

  // Automatic GitHub update check on entry (for APK / Web / PWA)
  useEffect(() => {
    if (!isAuthenticated) return;
    const checkUpdate = async () => {
      try {
        const info = await checkGitHubForUpdates();
        setAppLastUpdateTime(getAppLastUpdateTime());
        if (info && info.hasUpdate && !isUpdateDismissedRecently()) {
          setUpdateInfoModal(info);
          setUpdateAutoStart(false);
          setShowUpdateModal(true);
        }
      } catch (err) {
        console.warn('Auto update check failed', err);
      }
    };

    // Check immediately and then every 15 minutes
    checkUpdate();
    const interval = setInterval(checkUpdate, 900000); 
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Lightweight wheel scroll forwarding for margins without lag
  useEffect(() => {
    let mainEl: HTMLElement | null = null;
    const handleWheel = (e: WheelEvent) => {
      if (!mainEl) {
        mainEl = document.getElementById('main-scroll-container');
      }
      if (!mainEl) return;
      const target = e.target as HTMLElement | null;
      if (!target || mainEl.contains(target)) return;
      mainEl.scrollBy({ top: e.deltaY, behavior: 'auto' });
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // ----------------------------------------------------
  // 3. USER MANAGEMENT & AUTHENTICATION STATE
  // ----------------------------------------------------
  const DELETED_USERS_STORAGE_KEY = 'app_deleted_users_v1';

  const getDeletedUsernamesSet = useCallback((): Set<string> => {
    const set = new Set<string>();
    try {
      const raw = localStorage.getItem(DELETED_USERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(u => {
            const clean = String(u || '').trim().toLowerCase();
            if (clean) set.add(clean);
          });
        }
      }
    } catch {}
    getOfflineQueue().forEach(q => {
      if (q.action === 'deleteuser' && q.payload?.username) {
        set.add(String(q.payload.username).trim().toLowerCase());
      }
    });
    return set;
  }, []);

  const [pendingSheetDeletedUsers, setPendingSheetDeletedUsers] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DELETED_USERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(u => String(u || '').trim().toLowerCase()).filter(Boolean);
        }
      }
    } catch {}
    return [];
  });

  const markUserDeletedLocally = useCallback((username: string) => {
    const clean = String(username || '').trim().toLowerCase();
    if (!clean || clean === 'abujar287') return;
    setPendingSheetDeletedUsers(prev => {
      const next = prev.includes(clean) ? prev : [...prev, clean];
      try {
        localStorage.setItem(DELETED_USERS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearUserDeletedLocally = useCallback((username: string) => {
    const clean = String(username || '').trim().toLowerCase();
    if (!clean) return;
    setPendingSheetDeletedUsers(prev => {
      if (!prev.includes(clean)) return prev;
      const next = prev.filter(u => u !== clean);
      try {
        localStorage.setItem(DELETED_USERS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const deletedSet = new Set<string>();
      try {
        const rawDel = localStorage.getItem(DELETED_USERS_STORAGE_KEY);
        if (rawDel) {
          const parsedDel = JSON.parse(rawDel);
          if (Array.isArray(parsedDel)) {
            parsedDel.forEach(u => {
              const clean = String(u || '').trim().toLowerCase();
              if (clean) deletedSet.add(clean);
            });
          }
        }
      } catch {}
      const saved = localStorage.getItem('app_registered_users_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((u: AppUser) => !deletedSet.has(String(u.username || '').trim().toLowerCase()))
            .map((u: AppUser) => {
              const role: UserRole = u.username === 'abujar287' ? 'super_admin' : (u.role || 'member');
              return {
                ...u,
                role,
                allowedTabs: normalizeUserTabs(role, u.username, u.allowedTabs as AppTab[]),
                isReadOnly: u.username === 'abujar287' ? false : u.isReadOnly
              };
            });
        }
      }
    } catch {}
    return [DEFAULT_ADMIN];
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const isRemembered = localStorage.getItem('app_remember_login') === 'true';
      if (!isRemembered) return null;
      const saved = localStorage.getItem('active_user_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username) {
          const role: UserRole = parsed.username === 'abujar287' ? 'super_admin' : (parsed.role || 'member');
          return {
            ...parsed,
            role,
            allowedTabs: normalizeUserTabs(role, parsed.username, parsed.allowedTabs as AppTab[]),
            isReadOnly: parsed.username === 'abujar287' ? false : parsed.isReadOnly
          };
        }
      }
    } catch {}
    return null;
  });

  const usersRef = React.useRef<AppUser[]>(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const isRefreshingUserCountsRef = React.useRef(false);
  const fetchedUserTabsRef = React.useRef<Set<string>>(new Set());
  const pendingInsertMapRef = React.useRef<Map<string, Transaction>>(new Map());

  const mapUserFromSheet = useCallback((
    u: any,
    prevUsers?: AppUser[],
    activeTabName?: string,
    activeTxCount?: number
  ): AppUser => {
    const role = (u.username === 'abujar287' ? 'super_admin' : (u.role || 'member')) as UserRole;
    const tabs = normalizeUserTabs(role, u.username, u.allowedTabs as AppTab[]);

    const userTab = String(u.sheetTab || u.username || 'abujar287').trim().toLowerCase();
    const hasExplicitCount =
      typeof u.recordCount === 'number' ||
      typeof u.recordsCount === 'number' ||
      typeof u.records === 'number' ||
      typeof u.txCount === 'number';

    let recordCount: number = 0;
    if (hasExplicitCount) {
      recordCount = Number(u.recordCount ?? u.recordsCount ?? u.records ?? u.txCount ?? 0);
      fetchedUserTabsRef.current.add(userTab);
    } else if (activeTabName && userTab === activeTabName.toLowerCase() && typeof activeTxCount === 'number') {
      recordCount = activeTxCount;
    } else {
      const prevMatch = prevUsers?.find(
        p => (p.sheetTab || p.username || '').trim().toLowerCase() === userTab
      );
      if (prevMatch && typeof prevMatch.recordCount === 'number' && prevMatch.recordCount > 0) {
        recordCount = prevMatch.recordCount;
      } else {
        try {
          const storedTxs = localStorage.getItem(`app_transactions_${userTab}`);
          if (storedTxs) {
            const parsed = JSON.parse(storedTxs);
            if (Array.isArray(parsed)) recordCount = parsed.length;
          }
        } catch {}
      }
    }

    return {
      username: String(u.username || '').trim(),
      password: String(u.password || '').trim(),
      displayName: String(u.displayName || u.username || 'User').trim(),
      sheetTab: userTab,
      initialUsername: String(u.username || '').trim(),
      createdAt: u.createdAt || '2026-10-01',
      role: role as UserRole,
      isActive: u.isActive !== false && String(u.isActive).toLowerCase() !== 'false',
      allowedTabs: tabs,
      isReadOnly: u.isReadOnly === true || String(u.isReadOnly).toLowerCase() === 'true',
      recordCount
    };
  }, []);

  const refreshMissingUserRecordCounts = useCallback(async (userList: AppUser[], activeTabName: string, activeTxCount: number, forceAll = false) => {
    if (isRefreshingUserCountsRef.current || !Array.isArray(userList) || userList.length === 0) return;

    const targets = userList.filter(u => {
      const tab = (u.sheetTab || u.username || '').trim().toLowerCase();
      if (!tab) return false;
      if (tab === activeTabName.toLowerCase()) return false;
      return forceAll || !fetchedUserTabsRef.current.has(tab);
    });

    if (targets.length === 0) return;
    isRefreshingUserCountsRef.current = true;
    try {
      const countsByTab = new Map<string, number>();
      await Promise.allSettled(
        targets.map(async u => {
          const tab = (u.sheetTab || u.username || '').trim().toLowerCase();
          try {
            const res = await fetchSheetApi(`/api/sheet-proxy?action=getDetails&sheetTab=${encodeURIComponent(tab)}`);
            if (!res.ok) return;
            const txt = await res.text();
            const d = JSON.parse(txt);
            if (d && d.result === 'success') {
              const count = Array.isArray(d.transactions)
                ? d.transactions.length
                : (typeof d.count === 'number' ? d.count : Number(d.count) || 0);
              countsByTab.set(tab, count);
              fetchedUserTabsRef.current.add(tab);
            }
          } catch {}
        })
      );

      setUsers(prevUsers => {
        let changed = false;
        const nextUsers = prevUsers.map(u => {
          const tab = (u.sheetTab || u.username || '').trim().toLowerCase();
          let nextCount = u.recordCount ?? 0;
          if (tab === activeTabName.toLowerCase()) {
            nextCount = activeTxCount;
          } else if (countsByTab.has(tab)) {
            nextCount = countsByTab.get(tab)!;
          }
          if (nextCount !== u.recordCount) {
            changed = true;
            return { ...u, recordCount: nextCount };
          }
          return u;
        });
        if (changed) {
          try {
            localStorage.setItem('app_registered_users_v2', JSON.stringify(nextUsers));
          } catch {}
        }
        return changed ? nextUsers : prevUsers;
      });
    } finally {
      isRefreshingUserCountsRef.current = false;
    }
  }, []);

  const [userSyncStatus, setUserSyncStatus] = useState<{ loading: boolean; error: string | null; lastSuccess: string | null }>({
    loading: false,
    error: null,
    lastSuccess: null
  });

  useEffect(() => {
    if (isAuthenticated) {
      const syncUsers = () => {
        setUserSyncStatus(prev => ({ ...prev, loading: true, error: null }));
        const url = `/api/sheet-proxy?action=getusers`;
        fetchSheetApi(url)
          .then(async res => {
            if (!res.ok) {
              const text = await res.text();
              throw new Error(`HTTP ${res.status}: ${text || 'Unknown Error'}`);
            }
            return res.json();
          })
          .then(data => {
            if (data && Array.isArray(data.users)) {
              if (data.users.length > 0) {
                const activeTabKey = (currentUser?.role === 'super_admin_2'
                  ? (currentUser?.viewTargetTab || 'abujar287')
                  : (currentUser?.sheetTab || currentUser?.username || 'abujar287')).trim().toLowerCase();
                let activeTxLen: number | undefined;
                try {
                  const saved = localStorage.getItem(`app_transactions_${activeTabKey}`);
                  if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) activeTxLen = parsed.length;
                  }
                } catch {}

                const prevSnapshot = usersRef.current;
                const pendingDeleteUsernames = getDeletedUsernamesSet();
                let mappedUsers = data.users
                  .map((rawU: any) =>
                    mapUserFromSheet(rawU, prevSnapshot, activeTabKey, activeTxLen)
                  )
                  .filter((u: AppUser) => !pendingDeleteUsernames.has(u.username.trim().toLowerCase()));
                if (!mappedUsers.some((u: AppUser) => u.username.toLowerCase() === 'abujar287')) {
                  const prevAdmin = prevSnapshot.find(u => u.username.toLowerCase() === 'abujar287');
                  mappedUsers = [prevAdmin ? { ...DEFAULT_ADMIN, recordCount: prevAdmin.recordCount ?? 0 } : DEFAULT_ADMIN, ...mappedUsers];
                }
                setUsers(mappedUsers);
                try {
                  localStorage.setItem('app_registered_users_v2', JSON.stringify(mappedUsers));
                } catch {}

                if (mappedUsers.length > 0) {
                  refreshMissingUserRecordCounts(mappedUsers, activeTabKey, activeTxLen ?? 0, false);
                }

                // Auto-update active user profile if found in synced list (Case-Insensitive)
                if (currentUser && currentUser.username) {
                  const myLower = currentUser.username.toLowerCase();
                  const updatedMe = mappedUsers.find((u: AppUser) =>
                    u.username && u.username.toLowerCase() === myLower
                  );
                  if (updatedMe) {
                    setCurrentUser(updatedMe);
                    localStorage.setItem('active_user_v2', JSON.stringify(updatedMe));
                  }
                }
              }

              if (data.needsDeployUpdate) {
                setUserSyncStatus({
                  loading: false,
                  error: 'Apps Script deployment needs update (Deploy > Manage deployments > Edit > New version)',
                  lastSuccess: null
                });
              } else {
                setUserSyncStatus({ loading: false, error: null, lastSuccess: new Date().toLocaleTimeString() });
              }
            } else {
              setUserSyncStatus({
                loading: false,
                error: 'Apps Script deployment needs update (Deploy > Manage deployments > Edit > New version)',
                lastSuccess: null
              });
            }
          })
          .catch(err => {
            console.warn('Sync users notice:', err.message);
            setUserSyncStatus(prev => ({ ...prev, loading: false, error: err.message }));
          });
      };

      syncUsers();
      const interval = setInterval(syncUsers, 60000); // Sync users every minute for admins
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentUser?.username, mapUserFromSheet, refreshMissingUserRecordCounts]);

  // Login form state
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // ----------------------------------------------------
  // 4. STORAGE KEYS PER USER TAB
  // ----------------------------------------------------
  const currentTab = useMemo(() => {
    if (currentUser?.role === 'super_admin_2') {
      return (currentUser?.viewTargetTab || 'abujar287').trim().toLowerCase();
    }
    return (currentUser?.sheetTab || currentUser?.username || 'abujar287').trim().toLowerCase();
  }, [currentUser]);

  const isReadOnly = useMemo(() => {
    return Boolean(currentUser?.isReadOnly || currentUser?.role === 'super_admin_2');
  }, [currentUser]);

  const isSuperAdmin = useMemo(() => {
    return currentUser?.role === 'super_admin' || currentUser?.username?.toLowerCase() === 'abujar287';
  }, [currentUser]);

  const allowedTabs: AppTab[] = useMemo(() => {
    return normalizeUserTabs(currentUser?.role, currentUser?.username, currentUser?.allowedTabs);
  }, [currentUser]);

  const hasNotepadAccess = useMemo(() => {
    return isSuperAdmin || allowedTabs.includes('notepad');
  }, [isSuperAdmin, allowedTabs]);

  // ----------------------------------------------------
  // 5. ISOLATED CATEGORIES STATE
  // ----------------------------------------------------
  const deduplicateCategories = (categories: string[]): string[] => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      if (!cat) continue;
      const trimmed = String(cat).trim();
      const cleanKey = cleanCategoryName(trimmed, 'en').toLowerCase();
      if (!map.has(cleanKey)) {
        map.set(cleanKey, trimmed);
      } else {
        const existing = map.get(cleanKey)!;
        const hasEmoji = /^[\p{Extended_Pictographic}\p{Emoji}]/u.test(trimmed);
        const existingHasEmoji = /^[\p{Extended_Pictographic}\p{Emoji}]/u.test(existing);
        if (hasEmoji && !existingHasEmoji) {
          map.set(cleanKey, trimmed);
        }
      }
    }
    return Array.from(map.values());
  };

  const applySavedCategoryOrder = (categories: string[], tab: string, type: TransactionType): string[] => {
    try {
      const savedOrderRaw = localStorage.getItem(`app_category_order_${tab}_${type.toLowerCase()}`);
      if (!savedOrderRaw) return categories;
      const savedOrder = JSON.parse(savedOrderRaw);
      if (!Array.isArray(savedOrder) || savedOrder.length === 0) return categories;
      const orderIndex = new Map<string, number>();
      savedOrder.forEach((key: string, idx: number) => {
        const norm = String(key || '').trim().toLowerCase();
        if (norm && !orderIndex.has(norm)) orderIndex.set(norm, idx);
      });
      return [...categories].sort((a, b) => {
        const ka = cleanCategoryName(a, 'en').toLowerCase();
        const kb = cleanCategoryName(b, 'en').toLowerCase();
        const ia = orderIndex.has(ka) ? orderIndex.get(ka)! : Number.MAX_SAFE_INTEGER;
        const ib = orderIndex.has(kb) ? orderIndex.get(kb)! : Number.MAX_SAFE_INTEGER;
        return ia - ib;
      });
    } catch {
      return categories;
    }
  };

  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`app_expense_categories_${currentTab}`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateCategories(parsed);
        }
      }
    } catch {}
    return deduplicateCategories([...DEFAULT_EXPENSE_CATEGORIES]);
  });

  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`app_income_categories_${currentTab}`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateCategories(parsed);
        }
      }
    } catch {}
    return deduplicateCategories([...DEFAULT_INCOME_CATEGORIES]);
  });

  useEffect(() => {
    try {
      const savedExp = localStorage.getItem(`app_expense_categories_${currentTab}`);
      if (savedExp !== null) {
        const parsed = JSON.parse(savedExp);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExpenseCategories(deduplicateCategories(parsed));
        } else {
          setExpenseCategories(deduplicateCategories([...DEFAULT_EXPENSE_CATEGORIES]));
        }
      } else {
        setExpenseCategories(deduplicateCategories([...DEFAULT_EXPENSE_CATEGORIES]));
      }

      const savedInc = localStorage.getItem(`app_income_categories_${currentTab}`);
      if (savedInc !== null) {
        const parsed = JSON.parse(savedInc);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setIncomeCategories(deduplicateCategories(parsed));
        } else {
          setIncomeCategories(deduplicateCategories([...DEFAULT_INCOME_CATEGORIES]));
        }
      } else {
        setIncomeCategories(deduplicateCategories([...DEFAULT_INCOME_CATEGORIES]));
      }
    } catch {}
  }, [currentTab]);

  // ----------------------------------------------------
  // 6. TRANSACTIONS STATE
  // ----------------------------------------------------
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(`app_transactions_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`app_transactions_${currentTab}`);
      setTransactions(saved ? (JSON.parse(saved) || []) : []);
    } catch {
      setTransactions([]);
    }
  }, [currentTab]);

  const saveTransactionsLocally = useCallback((updated: Transaction[]) => {
    setTransactions(updated);
    try {
      localStorage.setItem(`app_transactions_${currentTab}`, JSON.stringify(updated));
    } catch {}

    // Auto-update record count for active user/tab in users list
    setUsers(prevUsers =>
      prevUsers.map(u => {
        const uTab = (u.sheetTab || u.username || '').toLowerCase();
        return uTab === currentTab.toLowerCase()
          ? { ...u, recordCount: updated.length }
          : u;
      })
    );
  }, [currentTab]);

  // ----------------------------------------------------
  // 6.5 TASKS & REMINDERS STATE
  // ----------------------------------------------------
  const [tasks, setTasks] = useState<CostTask[]>(() => {
    try {
      const saved = localStorage.getItem(`app_tasks_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    initAudioUnlock();
    setupWebPushSubscription().catch(() => {});
  }, []);

  // Sync scheduled tasks to server push scheduler so phone wakes up even when app is closed
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      syncTasksToPushServer(tasks).catch(() => {});
    }
  }, [tasks]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`app_tasks_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setTasks(parsed);
          return;
        }
      }
      setTasks([]);
    } catch {
      setTasks([]);
    }
  }, [currentTab]);

  const saveTasks = useCallback((updated: CostTask[]) => {
    setTasks(updated);
    try {
      localStorage.setItem(`app_tasks_${currentTab}`, JSON.stringify(updated));
      syncTasksToPushServer(updated).catch(() => {});
    } catch {}
  }, [currentTab]);

  const handleAddTask = async (newTaskData: Omit<CostTask, 'id' | 'createdAt'>) => {
    const newTask: CostTask = {
      ...newTaskData,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: formatTaskCreatedAt()
    };
    const updated = [newTask, ...tasks];
    saveTasks(updated);
    playSound('success');

    const payload = { action: 'insertTask', sheetTab: currentTab, ...newTask };

    try {
      const proxyRes = await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!proxyRes.ok) throw new Error('Task sync failed');
      showToast(lang === 'en' ? 'Task saved & synced to Google Sheet!' : 'টাস্ক সেভ এবং গুগল শিটে যুক্ত হয়েছে!', 'success');
    } catch {
      addToOfflineQueue({ action: 'insertTask', sheetTab: currentTab, payload });
      showToast(lang === 'en' ? 'Task saved offline! Will sync when online.' : 'টাস্ক অফলাইনে সেভ হয়েছে! ইন্টারনেট আসলে অটো-সিঙ্ক হবে।', 'info');
    }
  };

  const handleUpdateTask = async (updatedTask: CostTask) => {
    const updated = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    saveTasks(updated);

    const payload = { action: 'updateTask', sheetTab: currentTab, ...updatedTask };

    try {
      const proxyRes = await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!proxyRes.ok) throw new Error('Task update failed');
    } catch {
      addToOfflineQueue({ action: 'updateTask', sheetTab: currentTab, payload });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const taskToDeleteObj = tasks.find(t => t.id === taskId);
    const updated = tasks.filter(t => t.id !== taskId);
    saveTasks(updated);
    playSound('delete');

    const payload = {
      action: 'deleteTask',
      sheetTab: currentTab,
      id: taskId,
      title: taskToDeleteObj?.title || '',
      amount: taskToDeleteObj?.amount || 0
    };

    try {
      const proxyRes = await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!proxyRes.ok) throw new Error('Task delete failed');
      showToast(lang === 'en' ? 'Task deleted from Google Sheet' : 'টাস্ক গুগল শিট থেকে ডিলিট হয়েছে', 'info');
    } catch {
      addToOfflineQueue({ action: 'deleteTask', sheetTab: currentTab, payload });
    }
  };

  const taskDueCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return tasks.filter(t => t.status === 'pending' && t.dueDate <= todayStr).length;
  }, [tasks]);

  // ----------------------------------------------------
  // 7. VIEW & FILTER STATE
  // ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<AppTab>('summary');
  const [tabDirection, setTabDirection] = useState<number>(1);
  const [globalFilterMode, setGlobalFilterMode] = useState<'month' | 'all'>('month');

  const handleSelectFooterTab = useCallback((nextTab: AppTab) => {
    const order: AppTab[] = ['summary', 'details', 'upcoming_cost', 'settings', 'notepad'];
    const prevIdx = order.indexOf(activeTab);
    const nextIdx = order.indexOf(nextTab);
    if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
      setTabDirection(nextIdx > prevIdx ? 1 : -1);
    } else {
      setTabDirection(1);
    }
    setActiveTab(nextTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'upcoming_3_month' && !isSuperAdmin) {
      setActiveTab('summary');
    } else if (activeTab === 'notepad' && !hasNotepadAccess) {
      setActiveTab('summary');
    }
  }, [activeTab, isSuperAdmin, hasNotepadAccess]);

  // Keep active user's recordCount synced with live transactions & refresh all user tab counts when opening Users tab
  useEffect(() => {
    if (!isAuthenticated) return;
    setUsers(prevUsers => {
      let changed = false;
      const next = prevUsers.map(u => {
        const uTab = (u.sheetTab || u.username || '').trim().toLowerCase();
        if (uTab === currentTab.toLowerCase() && u.recordCount !== transactions.length) {
          changed = true;
          return { ...u, recordCount: transactions.length };
        }
        return u;
      });
      if (changed) {
        try {
          localStorage.setItem('app_registered_users_v2', JSON.stringify(next));
        } catch {}
      }
      return changed ? next : prevUsers;
    });
  }, [isAuthenticated, currentTab, transactions.length]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'users' && users.length > 0) {
      refreshMissingUserRecordCounts(users, currentTab, transactions.length, true);
    }
  }, [isAuthenticated, activeTab, users.length, currentTab, transactions.length, refreshMissingUserRecordCounts]);

  // ----------------------------------------------------
  // ROBUST BACK BUTTON & APP EXIT LOGIC (Android APK / Capacitor / PWA / Web)
  // ----------------------------------------------------
  const isAppExitingRef = React.useRef(false);

  const modalStateRef = React.useRef({
    showExitModal,
    selectedDateModal,
    editingTx,
    deletingTx,
    userToDelete,
    editingUser,
    showAddCatModal,
    showCategoryManager,
    showCreateUserModal,
    showMobileModal,
    activeTab
  });

  useEffect(() => {
    modalStateRef.current = {
      showExitModal,
      selectedDateModal,
      editingTx,
      deletingTx,
      userToDelete,
      editingUser,
      showAddCatModal,
      showCategoryManager,
      showCreateUserModal,
      showMobileModal,
      activeTab
    };
  }, [
    showExitModal,
    selectedDateModal,
    editingTx,
    deletingTx,
    userToDelete,
    editingUser,
    showAddCatModal,
    showCategoryManager,
    showCreateUserModal,
    showMobileModal,
    activeTab
  ]);

  const handleBackButtonAction = useCallback(() => {
    if (isAppExitingRef.current) return;

    // 1. Close Entry tab's calculator modal if open
    if (document.querySelector('[data-calc-modal="true"]')) {
      window.dispatchEvent(new CustomEvent('close-calc-modal'));
      return;
    }

    // 2. If exit confirmation modal is already open, pressing back cancels it
    if (modalStateRef.current.showExitModal) {
      setShowExitModal(false);
      return;
    }

    // 3. Close active top-level dialogs/modals
    if (modalStateRef.current.selectedDateModal) {
      setSelectedDateModal(null);
      return;
    }
    if (modalStateRef.current.editingTx) {
      setEditingTx(null);
      return;
    }
    if (modalStateRef.current.deletingTx) {
      setDeletingTx(null);
      return;
    }
    if (modalStateRef.current.userToDelete) {
      setUserToDelete(null);
      return;
    }
    if (modalStateRef.current.editingUser) {
      setEditingUser(null);
      return;
    }
    if (modalStateRef.current.showAddCatModal) {
      setShowAddCatModal(false);
      return;
    }
    if (modalStateRef.current.showCategoryManager) {
      setShowCategoryManager(false);
      return;
    }
    if (modalStateRef.current.showCreateUserModal) {
      setShowCreateUserModal(false);
      return;
    }
    if (modalStateRef.current.showMobileModal) {
      setShowMobileModal(false);
      return;
    }



    // 4. If in another tab, return to summary tab first
    if (modalStateRef.current.activeTab !== 'summary') {
      setActiveTab('summary');
      return;
    }

    // 5. If on summary tab and no modals are open, show exit confirmation modal
    setShowExitModal(true);
  }, []);

  const handleCloseExitModal = useCallback(() => {
    setShowExitModal(false);
    if (window.history.state?.exitGuard !== true) {
      window.history.pushState({ exitGuard: true }, '');
    }
  }, []);

  const handleConfirmExit = useCallback(async () => {
    setShowExitModal(false);
    setIsAppExited(true);
    isAppExitingRef.current = true;

    // 1. Capacitor Native Android Exit (Immediately exits Android activity to phone home screen)
    try {
      await CapApp.exitApp();
      return;
    } catch {}

    // 2. Global Capacitor bridge fallback
    try {
      if ((window as any).Capacitor?.Plugins?.App?.exitApp) {
        await (window as any).Capacitor.Plugins.App.exitApp();
        return;
      }
    } catch {}

    // 3. Android WebView JavascriptInterface or Cordova fallback
    try {
      if ((navigator as any)?.app?.exitApp) {
        (navigator as any).app.exitApp();
        return;
      }
      if ((navigator as any)?.device?.exitApp) {
        (navigator as any).device.exitApp();
        return;
      }
      if ((window as any)?.Android?.exitApp) {
        (window as any).Android.exitApp();
        return;
      }
      if ((window as any)?.android?.exitApp) {
        (window as any).android.exitApp();
        return;
      }
    } catch {}

    // 4. Try window.close() for PWA / popup
    try {
      window.close();
    } catch {}

    // 5. Browser history back fallback
    try {
      if (window.history.length > 1) {
        window.history.back();
      }
    } catch {}
  }, []);

  // Register Capacitor Android hardware back button listener
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    try {
      CapApp.addListener('backButton', () => {
        handleBackButtonAction();
      }).then(handle => {
        removeListener = () => handle.remove();
      }).catch(() => {});
    } catch {}

    return () => {
      if (removeListener) removeListener();
    };
  }, [handleBackButtonAction]);

  // Register Cordova / document backbutton listener
  useEffect(() => {
    const onDocumentBackButton = (e: Event) => {
      e.preventDefault();
      handleBackButtonAction();
    };
    document.addEventListener('backbutton', onDocumentBackButton);
    return () => {
      document.removeEventListener('backbutton', onDocumentBackButton);
    };
  }, [handleBackButtonAction]);

  // Register browser popstate history guard listener (single registration, no history stack explosion)
  useEffect(() => {
    const pushGuardState = () => {
      if (window.history.state?.exitGuard !== true) {
        window.history.pushState({ exitGuard: true }, '');
      }
    };

    pushGuardState();

    const handlePopState = () => {
      if (isAppExitingRef.current) return;
      pushGuardState();
      handleBackButtonAction();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleBackButtonAction]);

  useEffect(() => {
    const handleSetTab = (e: any) => {
      if (e.detail && typeof e.detail === 'string') {
        setActiveTab(e.detail as AppTab);
      }
    };
    window.addEventListener('app-set-tab', handleSetTab);
    return () => window.removeEventListener('app-set-tab', handleSetTab);
  }, []);

  const [monthMappings, setMonthMappings] = useState<MonthMapping[]>(() => {
    try {
      const saved = localStorage.getItem(`app_month_mappings_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((m: any, idx: number) => ({
            id: String(m.id || `map_${idx}`),
            startDate: normalizeDate(m.startDate),
            endDate: normalizeDate(m.endDate),
            label: cleanMappingLabel(m.label),
            isDefault: Boolean(m.isDefault)
          })).filter(m => m.label && m.startDate && m.endDate);
        }
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`app_month_mappings_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const list = parsed.map((m: any, idx: number) => ({
            id: String(m.id || `map_${idx}`),
            startDate: normalizeDate(m.startDate),
            endDate: normalizeDate(m.endDate),
            label: cleanMappingLabel(m.label),
            isDefault: Boolean(m.isDefault)
          })).filter(m => m.label && m.startDate && m.endDate);
          setMonthMappings(list);

          // Always set default month across the app
          const def = list.find(m => m.isDefault);
          if (def && def.label) {
            setSelectedMonth(def.label);
          }
          return;
        }
      }
      setMonthMappings([]);
    } catch {
      setMonthMappings([]);
    }
  }, [currentTab]);

  const saveMonthMappings = useCallback(async (updated: MonthMapping[]) => {
    // Determine target default month label if any entry is explicitly marked default
    let targetDefaultKey = '';
    for (let i = updated.length - 1; i >= 0; i--) {
      if (updated[i].isDefault) {
        targetDefaultKey = cleanMappingLabel(updated[i].label).toLowerCase();
        break;
      }
    }

    // Unique Map by label to prevent duplicate month rows
    const uniqueMap = new Map<string, MonthMapping>();
    updated.forEach((m, idx) => {
      const cleanedLabel = cleanMappingLabel(m.label);
      const key = cleanedLabel.toLowerCase();
      if (key && m.startDate && m.endDate) {
        const isDef = targetDefaultKey ? (key === targetDefaultKey) : Boolean(m.isDefault);
        const bVal = (m.budget !== undefined && m.budget !== null && !isNaN(Number(m.budget)) && Number(m.budget) > 0) ? Number(m.budget) : undefined;
        uniqueMap.set(key, {
          id: String(m.id || `map_${idx}`),
          startDate: normalizeDate(m.startDate),
          endDate: normalizeDate(m.endDate),
          label: cleanedLabel,
          isDefault: isDef,
          defaultMonth: isDef ? 'default' : '',
          budget: bVal
        });
      }
    });

    const cleaned = Array.from(uniqueMap.values());

    setMonthMappings(cleaned);
    try {
      localStorage.setItem(`app_month_mappings_${currentTab}`, JSON.stringify(cleaned));
      const defItem = cleaned.find(x => x.isDefault);
      if (defItem) {
        localStorage.setItem(`app_default_selected_month_${currentTab}`, defItem.label);
      }
      
      // Dual Cloud Sync: POST + GET param ping for max reliability
      const defMonthLabel = defItem ? defItem.label : '';
      fetchSheetApi(`?action=setdefaultmonth&defaultMonth=${encodeURIComponent(defMonthLabel)}`).catch(() => {});

      await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        body: JSON.stringify({
          action: 'savemappings',
          defaultMonth: defMonthLabel,
          mappings: cleaned
        })
      });
    } catch {}
  }, [currentTab]);

  const handleSaveBudget = useCallback(async (
    monthLabel: string, 
    totalBudget: number, 
    categoryBudgets?: Record<string, number>,
    categoryRows?: Array<{ category: string; budget: number; spend: number; remain: number }>,
    removedCategories?: string[]
  ) => {
    const cleanLabel = cleanMappingLabel(monthLabel) || monthLabel;
    const targetKey = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '');

    const cleanBudgets = { ...(categoryBudgets || {}) };
    if (removedCategories && removedCategories.length > 0) {
      removedCategories.forEach(r => {
        cleanBudgets[r] = 0;
        const clean = cleanCategoryName(r, 'en') || r;
        cleanBudgets[clean] = 0;
      });
    }

    if (categoryBudgets) {
      try {
        localStorage.setItem(`app_category_budgets_${currentTab}_${cleanLabel}`, JSON.stringify(cleanBudgets));
      } catch {}
      setBudgetVersion(v => v + 1);
    }

    let found = false;
    const updatedMappings = monthMappings.map(m => {
      const rawLabel = cleanMappingLabel(m.label) || m.label;
      const key = rawLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isMatch = key === targetKey || (key.length >= 3 && targetKey.length >= 3 && (key.includes(targetKey) || targetKey.includes(key)));
      if (isMatch) {
        found = true;
        return { ...m, label: rawLabel, budget: totalBudget };
      }
      return m;
    });

    let finalList = updatedMappings;
    if (!found) {
      const monthKey = getMonthKeyFromLabel(cleanLabel) || cleanLabel;
      let startDate = `${monthKey}-01`;
      let endDate = `${monthKey}-31`;
      if (monthKey.includes('-')) {
        const [y, m] = monthKey.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          const lastDay = new Date(y, m, 0).getDate();
          startDate = `${y}-${String(m).padStart(2, '0')}-01`;
          endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
      }
      finalList = [
        ...updatedMappings,
        {
          id: Date.now().toString(),
          label: cleanLabel,
          startDate,
          endDate,
          isDefault: false,
          budget: totalBudget
        }
      ];
    }

    setMonthMappings(finalList);
    try {
      localStorage.setItem(`app_month_mappings_${currentTab}`, JSON.stringify(finalList));
    } catch {}

    // Multi-Layer Cloud Sync to Google Sheet for Budget:
    const payload = {
      action: 'savebudget',
      sheetTab: currentTab,
      month: cleanLabel,
      budget: totalBudget,
      categoryBudgets: cleanBudgets,
      categoryRows: categoryRows || [],
      mappings: finalList,
      removedCategories: removedCategories || []
    };

    try {
      const proxyRes = await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!proxyRes.ok) throw new Error('Budget sync failed');
      showToast(lang === 'en' ? `Budget updated in Google Sheet for ${cleanLabel}` : `${cleanLabel} এর বাজেট গুগল শিটে আপডেট হয়েছে`, 'success');
    } catch (err) {
      console.error('Save budget error:', err);
      showToast(lang === 'en' ? 'Budget saved locally' : 'বাজেট লোকালি সেভ হয়েছে', 'info');
    }
  }, [currentTab, monthMappings, showToast, lang]);

  const handleSetDefaultMonth = useCallback((monthLabel: string) => {
    const cleanLabel = cleanMappingLabel(monthLabel) || monthLabel;
    const targetKey = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '');

    setSelectedMonth(cleanLabel);
    localStorage.setItem(`app_default_selected_month_${currentTab}`, cleanLabel);

    let found = false;
    const uniqueMap = new Map<string, MonthMapping>();

    monthMappings.forEach(m => {
      const rawLabel = cleanMappingLabel(m.label) || m.label;
      const key = rawLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isMatch = key === targetKey || (key.length >= 3 && targetKey.length >= 3 && (key.includes(targetKey) || targetKey.includes(key)));
      if (isMatch) found = true;
      uniqueMap.set(key, {
        ...m,
        label: rawLabel,
        isDefault: isMatch
      });
    });

    if (!found) {
      const monthKey = getMonthKeyFromLabel(cleanLabel) || cleanLabel;
      let startDate = `${monthKey}-01`;
      let endDate = `${monthKey}-31`;
      if (monthKey.includes('-')) {
        const [y, m] = monthKey.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m)) {
          const lastDay = new Date(y, m, 0).getDate();
          startDate = `${y}-${String(m).padStart(2, '0')}-01`;
          endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
      }
      uniqueMap.set(targetKey, {
        id: Date.now().toString(),
        label: cleanLabel,
        startDate,
        endDate,
        isDefault: true
      });
    }

    const updatedList = Array.from(uniqueMap.values());

    // 1. Update React State
    setMonthMappings(updatedList);

    // 2. Synchronous Cloud Push
    saveMonthMappings(updatedList);

    // 3. Direct GET Parameter Cloud Ping
    fetchSheetApi(`?action=setdefaultmonth&defaultMonth=${encodeURIComponent(cleanLabel)}&sheetTab=${encodeURIComponent(currentTab)}`, {
      
    }).catch(() => {});

    showToast(lang === 'en' ? `'${cleanLabel}' set as default month` : `'${cleanLabel}' ডিফল্ট মাস করা হয়েছে`, 'success');
  }, [currentTab, monthMappings, saveMonthMappings, showToast, lang]);

  const currentMonthValue = useMemo(() => {
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[now.getMonth()]}-${now.getFullYear()}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      const savedMappings = localStorage.getItem(`app_month_mappings_${currentTab}`);
      if (savedMappings) {
        const parsed = JSON.parse(savedMappings);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const defMap = parsed.find((m: any) => m.isDefault || String(m['default month'] || m.isDefault).toLowerCase() === 'default');
          if (defMap && defMap.label) return defMap.label;
        }
      }
    } catch {}

    return currentMonthValue;
  });

  // Default to current month label if no month mapping exists for current user
  useEffect(() => {
    if (!monthMappings || monthMappings.length === 0) {
      setSelectedMonth(currentMonthValue);
    } else {
      const def = monthMappings.find(m => m.isDefault);
      if (def && def.label) {
        setSelectedMonth(def.label);
      }
    }
  }, [monthMappings, currentTab, currentMonthValue]);

  // ----------------------------------------------------
  // 8. CLOUD SYNC STATE
  // ----------------------------------------------------
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [budgetVersion, setBudgetVersion] = useState<number>(0);
  const [lastSyncDate, setLastSyncDate] = useState<Date>(() => new Date());
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => formatSyncDateTime(new Date(), lang));
  const [upcoming3MonthRemotePlan, setUpcoming3MonthRemotePlan] = useState<Upcoming3MonthPlan | null>(null);
  const [upcoming3MonthVersion, setUpcoming3MonthVersion] = useState<number>(0);
  const [bouGiftRemote, setBouGiftRemote] = useState<BouGiftEntry[]>([]);
  const [bouGiftVersion, setBouGiftVersion] = useState<number>(0);

  useEffect(() => {
    setUpcoming3MonthRemotePlan(null);
    setBouGiftRemote([]);
  }, [currentTab]);

  const handleSaveUpcoming3Month = useCallback(async (planPayload: Upcoming3MonthPlan): Promise<boolean> => {
    const payload = {
      action: 'saveupcoming3month',
      sheetTab: currentTab,
      ...planPayload
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addToOfflineQueue({ action: 'saveupcoming3month', sheetTab: currentTab, payload });
      return false;
    }

    try {
      const res = await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Upcoming 3M sync failed');
      return true;
    } catch {
      addToOfflineQueue({ action: 'saveupcoming3month', sheetTab: currentTab, payload });
      return false;
    }
  }, [currentTab]);

  const handleSaveBouGift = useCallback(async (rows: BouGiftEntry[]): Promise<boolean> => {
    const payload = {
      action: 'savebougift',
      sheetTab: currentTab,
      bouGift: rows
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addToOfflineQueue({ action: 'savebougift', sheetTab: currentTab, payload });
      return false;
    }

    try {
      const res = await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Bou Gift sync failed');
      return true;
    } catch {
      addToOfflineQueue({ action: 'savebougift', sheetTab: currentTab, payload });
      return false;
    }
  }, [currentTab]);

  // ----------------------------------------------------
  // 8.5 NOTEPAD STATE & SYNC (BB:BF - per user sheetTab)
  // ----------------------------------------------------
  const [notes, setNotes] = useState<NoteEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`app_notes_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [noteCategories, setNoteCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`app_note_categories_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [isSyncingNotes, setIsSyncingNotes] = useState(false);
  const pendingNoteMapRef = React.useRef<Map<string, { tab: string; note: NoteEntry }>>(new Map());

  const extractNoteCategories = useCallback((rawCats: any, notesList: NoteEntry[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    const pushCat = (val: any) => {
      const trimmed = String(val || '').trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (lower === 'category' || lower === 'notepad' || lower === 'all') return;
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed);
      }
    };
    if (Array.isArray(rawCats)) rawCats.forEach(pushCat);
    notesList.forEach(n => pushCat(n.category));
    return result;
  }, []);

  useEffect(() => {
    if (!hasNotepadAccess) {
      setNotes([]);
      setNoteCategories([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`app_notes_${currentTab}`);
      setNotes(saved ? (JSON.parse(saved) || []) : []);
    } catch {
      setNotes([]);
    }
    try {
      const savedCats = localStorage.getItem(`app_note_categories_${currentTab}`);
      setNoteCategories(savedCats ? (JSON.parse(savedCats) || []) : []);
    } catch {
      setNoteCategories([]);
    }
  }, [hasNotepadAccess, currentTab]);

  const formatNotepadDatetime = (d = new Date()) => {
    return d.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const mapRawNotes = (rawList: any[]): NoteEntry[] => {
    return rawList
      .map((n: any, idx: number) => ({
        id: String(n.id || `note_${n.rowNumber || idx}_${Date.now()}`),
        rowNumber: n.rowNumber ? Number(n.rowNumber) : undefined,
        datetime: String(n.datetime || n.Datetime || '').trim(),
        notename: String(n.notename || n.Notename || n.title || 'Untitled').trim(),
        category: String(n.category || n.Category || 'Uncategorized').trim() || 'Uncategorized',
        note: String(n.note ?? n.Note ?? ''),
        action: String(n.action || n.Action || 'SYNC').trim() || 'SYNC'
      }))
      .filter((n: NoteEntry) => Boolean(n.notename || n.note));
  };

  const mergeNotesWithPending = useCallback((remoteNotes: NoteEntry[], targetTab: string): NoteEntry[] => {
    const existingKeys = new Set(
      remoteNotes.map(n => `${(n.notename || '').trim().toLowerCase()}___${(n.datetime || '').trim()}`)
    );
    const extra: NoteEntry[] = [];
    pendingNoteMapRef.current.forEach((entry, tempId) => {
      if (entry.tab !== targetTab) return;
      const key = `${(entry.note.notename || '').trim().toLowerCase()}___${(entry.note.datetime || '').trim()}`;
      if (existingKeys.has(key)) {
        pendingNoteMapRef.current.delete(tempId);
      } else {
        extra.push(entry.note);
        existingKeys.add(key);
      }
    });
    getOfflineQueue().forEach(qItem => {
      if (qItem.action === 'addnote' && qItem.sheetTab === targetTab && qItem.payload) {
        const nName = String(qItem.payload.notename || 'Untitled').trim();
        const nDt = String(qItem.payload.datetime || '').trim();
        const key = `${nName.toLowerCase()}___${nDt}`;
        if (!existingKeys.has(key)) {
          extra.push({
            id: String(qItem.id || `note_q_${Date.now()}`),
            datetime: nDt,
            notename: nName,
            category: String(qItem.payload.category || 'Uncategorized').trim(),
            note: String(qItem.payload.note || ''),
            action: 'SYNC'
          });
          existingKeys.add(key);
        }
      }
    });
    return extra.length > 0 ? [...remoteNotes, ...extra] : remoteNotes;
  }, []);

  const handleSyncNotes = useCallback(async (silent = false, tabOverride?: string) => {
    if (!hasNotepadAccess) return;
    const targetTab = tabOverride || currentTab;
    setIsSyncingNotes(true);
    try {
      let data: any = null;
      try {
        const res = await fetchSheetApi(`/api/sheet-proxy?action=getnotes&sheetTab=${encodeURIComponent(targetTab)}`);
        if (res.ok) {
          const text = await res.text();
          try { data = JSON.parse(text); } catch {}
        }
      } catch {}

      if (!data || data.result !== 'success') {
        try {
          const directRes = await fetchSheetApi(`?action=getnotes&sheetTab=${encodeURIComponent(targetTab)}`);
          if (directRes.ok) {
            const text = await directRes.text();
            try { data = JSON.parse(text); } catch {}
          }
        } catch {}
      }

      if (data && data.result === 'success' && Array.isArray(data.notes)) {
        const mapped = mapRawNotes(data.notes);
        const merged = mergeNotesWithPending(mapped, targetTab);
        const nextCats = extractNoteCategories(data.noteCategories, merged);
        setNotes(merged);
        setNoteCategories(nextCats);
        try {
          localStorage.setItem(`app_notes_${targetTab}`, JSON.stringify(merged));
          localStorage.setItem(`app_note_categories_${targetTab}`, JSON.stringify(nextCats));
        } catch {}
        if (silent !== true) {
          showToast(`Synced ${merged.length} notes from ${targetTab} BB:BF`, 'success');
        }
      } else if (silent !== true) {
        showToast('Could not fetch notes from Sheet (check Apps Script deploy)', 'error');
      }
    } finally {
      setIsSyncingNotes(false);
    }
  }, [currentTab, hasNotepadAccess, mergeNotesWithPending, extractNoteCategories, showToast]);

  useEffect(() => {
    if (isAuthenticated && hasNotepadAccess && activeTab === 'notepad') {
      handleSyncNotes(true);
    }
  }, [isAuthenticated, hasNotepadAccess, activeTab, handleSyncNotes]);

  const handleAddNote = useCallback(async (input: { notename: string; category: string; note: string }) => {
    if (!hasNotepadAccess) return;
    const targetTab = currentTab;
    const tempId = `note_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newNote: NoteEntry = {
      id: tempId,
      datetime: formatNotepadDatetime(new Date()),
      notename: input.notename.trim() || 'Untitled',
      category: input.category.trim() || 'Uncategorized',
      note: input.note,
      action: 'SYNC'
    };

    pendingNoteMapRef.current.set(tempId, { tab: targetTab, note: newNote });
    setNotes(prev => {
      const appended = [...prev, newNote];
      try {
        localStorage.setItem(`app_notes_${targetTab}`, JSON.stringify(appended));
      } catch {}
      return appended;
    });
    setNoteCategories(prev => {
      const updatedCats = extractNoteCategories([...prev, newNote.category], []);
      try {
        localStorage.setItem(`app_note_categories_${targetTab}`, JSON.stringify(updatedCats));
      } catch {}
      return updatedCats;
    });
    playSound('success');

    const payload = {
      action: 'addnote',
      sheetTab: targetTab,
      datetime: newNote.datetime,
      notename: newNote.notename,
      category: newNote.category,
      note: newNote.note,
      actionLabel: 'SYNC'
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      pendingNoteMapRef.current.delete(tempId);
      addToOfflineQueue({ action: 'addnote', sheetTab: targetTab, payload });
      showToast('Note saved offline! Will append to Sheet BB:BF when online.', 'info');
      return;
    }

    showToast('Note saved!', 'success');

    fetchSheetApi('/api/sheet-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) throw new Error('Note sync failed');
        const resText = await res.text();
        let resData: any = null;
        try { resData = JSON.parse(resText); } catch {}
        if (resData?.result === 'forbidden') {
          showToast('Sheet write blocked by old Apps Script deploy — please Deploy New Version from Settings Script!', 'error');
          addToOfflineQueue({ action: 'addnote', sheetTab: targetTab, payload });
          return;
        }
        if (resData?.result && resData.result !== 'success') {
          throw new Error(resData.message || 'Sheet save error');
        }
        if (resData?.note?.rowNumber) {
          setNotes(prev => {
            const next = prev.map(n =>
              n.id === tempId
                ? { ...n, id: String(resData.note.id || n.id), rowNumber: Number(resData.note.rowNumber) }
                : n
            );
            try {
              localStorage.setItem(`app_notes_${targetTab}`, JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      })
      .catch(() => {
        addToOfflineQueue({ action: 'addnote', sheetTab: targetTab, payload });
      })
      .finally(() => {
        pendingNoteMapRef.current.delete(tempId);
      });
  }, [currentTab, hasNotepadAccess, showToast]);

  const handleUpdateNote = useCallback(async (
    updatedNote: NoteEntry,
    original?: { notename: string; datetime: string }
  ) => {
    if (!hasNotepadAccess) return;
    const targetTab = currentTab;
    setNotes(prev => {
      const nextList = prev.map(n => (n.id === updatedNote.id ? updatedNote : n));
      try {
        localStorage.setItem(`app_notes_${targetTab}`, JSON.stringify(nextList));
      } catch {}
      return nextList;
    });
    setNoteCategories(prev => {
      const updatedCats = extractNoteCategories([...prev, updatedNote.category], []);
      try {
        localStorage.setItem(`app_note_categories_${targetTab}`, JSON.stringify(updatedCats));
      } catch {}
      return updatedCats;
    });

    const payload = {
      action: 'updatenote',
      sheetTab: targetTab,
      rowNumber: updatedNote.rowNumber,
      datetime: updatedNote.datetime,
      notename: updatedNote.notename,
      category: updatedNote.category,
      note: updatedNote.note,
      actionLabel: 'SYNC',
      originalNotename: original?.notename || updatedNote.notename,
      originalDatetime: original?.datetime || updatedNote.datetime
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addToOfflineQueue({ action: 'updatenote', sheetTab: targetTab, payload });
      showToast('Note updated offline! Will sync when online.', 'info');
      return;
    }

    showToast('Note updated!', 'success');

    fetchSheetApi('/api/sheet-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        if (!res.ok) throw new Error('Update note failed');
        const txt = await res.text();
        let resData: any = null;
        try { resData = JSON.parse(txt); } catch {}
        if (resData?.result === 'forbidden') {
          showToast('Sheet update blocked by old Apps Script deploy — please Deploy New Version!', 'error');
          addToOfflineQueue({ action: 'updatenote', sheetTab: targetTab, payload });
        }
      })
      .catch(() => {
        addToOfflineQueue({ action: 'updatenote', sheetTab: targetTab, payload });
      });
  }, [currentTab, hasNotepadAccess, showToast]);

  const handleDeleteNote = useCallback(async (targetNote: NoteEntry) => {
    if (!hasNotepadAccess) return;
    const targetTab = currentTab;
    setNotes(prev => {
      const nextList = prev.filter(n => n.id !== targetNote.id);
      try {
        localStorage.setItem(`app_notes_${targetTab}`, JSON.stringify(nextList));
      } catch {}
      return nextList;
    });
    pendingNoteMapRef.current.delete(targetNote.id);
    playSound('delete');

    const payload = {
      action: 'deletenote',
      sheetTab: targetTab,
      rowNumber: targetNote.rowNumber,
      notename: targetNote.notename,
      datetime: targetNote.datetime,
      originalNotename: targetNote.notename,
      originalDatetime: targetNote.datetime
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addToOfflineQueue({ action: 'deletenote', sheetTab: targetTab, payload });
      showToast('Note deleted offline; queued for sync.', 'info');
      return;
    }

    showToast('Note deleted', 'info');

    fetchSheetApi('/api/sheet-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Delete note failed');
      })
      .catch(() => {
        addToOfflineQueue({ action: 'deletenote', sheetTab: targetTab, payload });
      });
  }, [currentTab, hasNotepadAccess, showToast]);

  useEffect(() => {
    setLastSyncTime(formatSyncDateTime(lastSyncDate, lang));
  }, [lang, lastSyncDate]);

  const filteredTransactions = useMemo(() => {
    if (globalFilterMode === 'all') return transactions;
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    return transactions.filter(tx => {
      const txDate = normalizeDate(tx.date);
      if (mapping) {
        return txDate >= mapping.startDate && txDate <= mapping.endDate;
      }
      const monthKey = getMonthKeyFromLabel(selectedMonth);
      return txDate.startsWith(monthKey);
    });
  }, [transactions, globalFilterMode, selectedMonth, monthMappings]);

  // ----------------------------------------------------
  // 9. API & SYNC ACTIONS
  // ----------------------------------------------------
  const handleManualSync = useCallback(async (tabToSync = currentTab) => {
    setIsSyncing(true);
    try {
      let data: any = null;
      try {
        const proxyRes = await fetchSheetApi(`/api/sheet-proxy?action=getDetails&sheetTab=${encodeURIComponent(tabToSync)}`);
        if (proxyRes.ok) {
          const text = await proxyRes.text();
          try { data = JSON.parse(text); } catch {}
        }
      } catch (proxyErr) {
        console.warn('Proxy fetch failed, using direct fetch:', proxyErr);
      }

      if (!data || data.result !== 'success') {
        try {
          const res = await fetchSheetApi(`?action=getDetails&sheetTab=${encodeURIComponent(tabToSync)}`);
          if (res.ok) {
            const text = await res.text();
            try { data = JSON.parse(text); } catch {}
          }
        } catch (directErr) {
          console.warn('Direct fetch failed:', directErr);
        }
      }

      if (data && data.result === 'success') {
        if (Array.isArray(data.transactions)) {
          const seenTxIds = new Set<string>();
          const formatted: Transaction[] = data.transactions.map((t: any, idx: number) => {
            let rawId = String(t.id || `tx_${idx}_${Date.now()}`).trim();
            if (seenTxIds.has(rawId)) {
              rawId = `${rawId}_row${t.rowNumber || t.row || idx}`;
            }
            seenTxIds.add(rawId);
            if (pendingInsertMapRef.current.has(rawId)) {
              pendingInsertMapRef.current.delete(rawId);
            }
            return {
              id: rawId,
              rowNumber: t.rowNumber || t.row || t.rowIndex,
              datetime: formatCleanDateTime(t.datetime, 'en') || t.datetime || '',
              type: (String(t.type || '').toLowerCase().includes('inc') || String(t.type || '').includes('আয়')) ? 'Income' : 'Expense',
              category: t.category || '',
              date: normalizeDate(t.date),
              value: Math.abs(Number(t.value) || 0),
              note: t.note || ''
            };
          });

          const preservedPending: Transaction[] = [];
          pendingInsertMapRef.current.forEach((pendingTx, id) => {
            if (!seenTxIds.has(id)) {
              preservedPending.push(pendingTx);
              seenTxIds.add(id);
            }
          });
          getOfflineQueue().forEach(qItem => {
            if (qItem.action === 'insert' && qItem.sheetTab === tabToSync && qItem.payload?.id) {
              const qId = String(qItem.payload.id).trim();
              if (qId && !seenTxIds.has(qId)) {
                preservedPending.push({
                  id: qId,
                  datetime: formatCleanDateTime(qItem.payload.datetime, 'en') || qItem.payload.datetime || '',
                  type: qItem.payload.type === 'Income' ? 'Income' : 'Expense',
                  category: qItem.payload.category || '',
                  date: normalizeDate(qItem.payload.date),
                  value: Math.abs(Number(qItem.payload.value) || 0),
                  note: qItem.payload.note || ''
                });
                seenTxIds.add(qId);
              }
            }
          });

          saveTransactionsLocally(preservedPending.length > 0 ? [...preservedPending, ...formatted] : formatted);
        }
        
        if (Array.isArray(data.tasks)) {
          const cloudTasks: CostTask[] = data.tasks.map((t: any, idx: number) => {
            const titleVal = String(
              t.title || t.Title || t.task || t.Task || t.name || t.Name ||
              t['Task Name'] || t['Task Title'] || t.description || t.Details || t['টাস্ক'] || t['নাম'] || ''
            ).trim();

            const dueDateRaw = t.dueDate || t['Due Date'] || t['Target Date'] || t.date || t.Date || t['তারিখ'] || new Date().toISOString().split('T')[0];
            const dueTimeRaw = t.dueTime || t['Due Time'] || t.time || t.Time || t['সময়'] || '09:00';

            const amountVal = Number(t.amount || t.Amount || t.cost || t.Cost || t.expense || t.Expense || t['পরিমাণ'] || t['খরচ'] || 0);

            const categoryVal = String(t.category || t.Category || t['ক্যাটাগরি'] || 'General');
            const notesVal = String(t.notes || t.Notes || t.note || t.Note || t['নোট'] || '');
            const prioRaw = String(t.priority || t.Priority || t['গুরুত্ব'] || 'medium').toLowerCase();
            const priorityVal = prioRaw.includes('high') ? 'high' : prioRaw.includes('low') ? 'low' : 'medium';

            const statusRaw = String(t.status || t.Status || t.state || t.State || t.action || t['স্ট্যাটাস'] || 'pending').toLowerCase().trim();
            const isCompleted = statusRaw.includes('complete') || statusRaw.includes('paid') || statusRaw.includes('done') || statusRaw.includes('পরিশোধ') || statusRaw.includes('সম্পন্ন');
            const statusVal: 'pending' | 'completed' = isCompleted ? 'completed' : 'pending';

            return {
              id: String(t.id || `task_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`),
              title: titleVal,
              dueDate: normalizeDate(dueDateRaw),
              dueTime: normalizeTime(dueTimeRaw),
              amount: amountVal,
              category: categoryVal,
              priority: priorityVal as any,
              notes: notesVal,
              status: statusVal,
              reminderDaysBefore: Number(t.reminderDaysBefore || t['Reminder Days'] || 1),
              autoNotify: t.autoNotify === false || String(t.autoNotify).toLowerCase() === 'false' || String(t.autoNotify).toLowerCase() === 'no' ? false : true,
              createdBy: String(t.createdBy || t['Created By'] || tabToSync),
              createdAt: formatTaskCreatedAt(String(t.createdAt || t['Created At'] || ''))
            };
          }).filter((t: CostTask) => Boolean(t.title));

          if (Array.isArray(data.tasks)) {
            setTasks(cloudTasks);
            try {
              localStorage.setItem(`app_tasks_${tabToSync}`, JSON.stringify(cloudTasks));
            } catch {}
          }
        } else {
          setTasks([]);
          try {
            localStorage.setItem(`app_tasks_${tabToSync}`, JSON.stringify([]));
          } catch {}
        }
        
        const rawMappings = data.monthMappings || data.mappings;
        if (Array.isArray(rawMappings)) {
          const mapDeduplicated = new Map<string, MonthMapping>();
          rawMappings.forEach((m: any, idx: number) => {
            const rawLabel = m.label || m.MappingMonth || m['Mapping Month'] || '';
            const cleanedLabel = cleanMappingLabel(rawLabel) || `Custom-${idx + 1}`;
            const key = cleanedLabel.toLowerCase();
            const sDate = normalizeDate(m.startDate || m.StartDate || m['Start Date']);
            const eDate = normalizeDate(m.endDate || m.EndDate || m['End Date']);
            
            if (key && sDate && eDate) {
              const defaultVal = m.isDefault ?? m.IsDefault ?? m['Is Default'] ?? m['is_default'] ?? m['default month'] ?? m['Default Month'] ?? m['default_month'] ?? m['default'] ?? m['Default'];
              const rawIsDefault = Boolean(
                defaultVal === true ||
                String(defaultVal).toLowerCase() === 'true' ||
                String(defaultVal).toLowerCase() === 'yes' ||
                String(defaultVal).toLowerCase() === 'default'
              );

              const existing = mapDeduplicated.get(key);
              const finalDef = rawIsDefault || Boolean(existing && existing.isDefault);
              const rawBudget = (m.budget !== undefined && m.budget !== null && m.budget !== '') ? (Number(m.budget) || undefined) : undefined;

              mapDeduplicated.set(key, {
                id: String(m.id || `map_${idx}_${Date.now()}`),
                startDate: sDate,
                endDate: eDate,
                label: cleanedLabel,
                isDefault: finalDef,
                budget: rawBudget
              });
            }
          });

          const normalized = Array.from(mapDeduplicated.values());

          setMonthMappings(normalized);
          localStorage.setItem(`app_month_mappings_${tabToSync}`, JSON.stringify(normalized));

          // Auto-sync default month if designated in sheet
          const defMap = normalized.find(x => x.isDefault);
          if (defMap) {
            setSelectedMonth(defMap.label);
            localStorage.setItem(`app_default_selected_month_${tabToSync}`, defMap.label);
          } else if (data.defaultMonth || data.default_month) {
            const sheetDefMonth = cleanMappingLabel(data.defaultMonth || data.default_month);
            if (sheetDefMonth) {
              setSelectedMonth(sheetDefMonth);
              localStorage.setItem(`app_default_selected_month_${tabToSync}`, sheetDefMonth);
            }
          }
        } else {
          setMonthMappings([]);
          try {
            localStorage.setItem(`app_month_mappings_${tabToSync}`, JSON.stringify([]));
          } catch {}
        }

        if (data.categoryBudgets && typeof data.categoryBudgets === 'object') {
          Object.keys(data.categoryBudgets).forEach(mKey => {
            try {
              localStorage.setItem(`app_category_budgets_${tabToSync}_${mKey}`, JSON.stringify(data.categoryBudgets[mKey]));
              const cleanKey = cleanMappingLabel(mKey);
              if (cleanKey && cleanKey !== mKey) {
                localStorage.setItem(`app_category_budgets_${tabToSync}_${cleanKey}`, JSON.stringify(data.categoryBudgets[mKey]));
              }
            } catch {}
          });
          setBudgetVersion(v => v + 1);
        }

        if (data.upcoming3Month && typeof data.upcoming3Month === 'object' && Array.isArray(data.upcoming3Month.categories)) {
          try {
            localStorage.setItem(`app_upcoming_3m_plan_v2_${tabToSync}`, JSON.stringify(data.upcoming3Month));
          } catch {}
          setUpcoming3MonthRemotePlan(data.upcoming3Month as Upcoming3MonthPlan);
          setUpcoming3MonthVersion(v => v + 1);
        }

        if (Array.isArray(data.bouGift)) {
          try {
            localStorage.setItem(`app_bou_gift_v1_${tabToSync}`, JSON.stringify(data.bouGift));
          } catch {}
          setBouGiftRemote(data.bouGift as BouGiftEntry[]);
          setBouGiftVersion(v => v + 1);
        }

        if (hasNotepadAccess) {
          if (Array.isArray(data.notes)) {
            const mappedNotes = mergeNotesWithPending(mapRawNotes(data.notes), tabToSync);
            const nextCats = extractNoteCategories(data.noteCategories, mappedNotes);
            setNotes(mappedNotes);
            setNoteCategories(nextCats);
            try {
              localStorage.setItem(`app_notes_${tabToSync}`, JSON.stringify(mappedNotes));
              localStorage.setItem(`app_note_categories_${tabToSync}`, JSON.stringify(nextCats));
            } catch {}
          } else {
            if (Array.isArray(data.noteCategories)) {
              const nextCats = extractNoteCategories(data.noteCategories, []);
              setNoteCategories(nextCats);
              try {
                localStorage.setItem(`app_note_categories_${tabToSync}`, JSON.stringify(nextCats));
              } catch {}
            }
            handleSyncNotes(true, tabToSync);
          }
        }

        // Load categories EXCLUSIVELY from Google Sheet (100% dynamic, zero hardcoding in codebase)
        const aggregatedExp: string[] = [];
        const aggregatedInc: string[] = [];

        // Build dynamic category type map based on transactions present in sheet
        const dynamicCatTypeFromTx = new Map<string, 'Income' | 'Expense'>();
        if (Array.isArray(data.transactions)) {
          data.transactions.forEach((tx: any) => {
            const cat = String(tx.category || '').trim().toLowerCase();
            const rawT = String(tx.type || '').toLowerCase();
            if (cat && !dynamicCatTypeFromTx.has(cat)) {
              if (rawT.includes('inc') || rawT.includes('আয়') || rawT === 'income') {
                dynamicCatTypeFromTx.set(cat, 'Income');
              } else if (rawT.includes('exp') || rawT.includes('খরচ') || rawT === 'expense') {
                dynamicCatTypeFromTx.set(cat, 'Expense');
              }
            }
          });
        }

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          data.categories.forEach((c: any) => {
            if (typeof c === 'string' && c.trim()) {
              const str = c.trim();
              const lower = str.toLowerCase();
              const txType = dynamicCatTypeFromTx.get(lower);
              if (txType === 'Income' || lower.includes('income') || lower.includes('আয়')) {
                aggregatedInc.push(str);
              } else {
                aggregatedExp.push(str);
              }
            } else if (typeof c === 'object' && c !== null) {
              const catName = String(c.category || c.Category || c.name || c.Name || c.cName || '').trim();
              const rawType = String(c.type || c.Type || c.cType || '').toLowerCase().trim();

              if (catName) {
                if (rawType.includes('inc') || rawType.includes('আয়') || rawType === 'income') {
                  aggregatedInc.push(catName);
                } else if (rawType.includes('exp') || rawType.includes('খরচ') || rawType === 'expense') {
                  aggregatedExp.push(catName);
                } else {
                  const txType = dynamicCatTypeFromTx.get(catName.toLowerCase());
                  if (txType === 'Income') {
                    aggregatedInc.push(catName);
                  } else {
                    aggregatedExp.push(catName);
                  }
                }
              }
            }
          });
        }

        // Fallback to active transactions ONLY if Category tab returned 0 items
        if (aggregatedExp.length === 0 && aggregatedInc.length === 0 && Array.isArray(data.transactions)) {
          data.transactions.forEach((tx: any) => {
            const isExp = String(tx.type || '').toLowerCase().includes('exp') || String(tx.type || '').includes('খরচ');
            if (tx.category && tx.category.trim()) {
              const catTrim = tx.category.trim();
              if (isExp) {
                aggregatedExp.push(catTrim);
              } else {
                aggregatedInc.push(catTrim);
              }
            }
          });
        }

        const finalExpList = applySavedCategoryOrder(
          aggregatedExp.length > 0
            ? deduplicateCategories(aggregatedExp)
            : deduplicateCategories([...DEFAULT_EXPENSE_CATEGORIES]),
          tabToSync,
          'Expense'
        );

        const finalIncList = applySavedCategoryOrder(
          aggregatedInc.length > 0
            ? deduplicateCategories(aggregatedInc)
            : deduplicateCategories([...DEFAULT_INCOME_CATEGORIES]),
          tabToSync,
          'Income'
        );

        setExpenseCategories(finalExpList);
        try {
          localStorage.setItem(`app_expense_categories_${tabToSync}`, JSON.stringify(finalExpList));
        } catch {}

        setIncomeCategories(finalIncList);
        try {
          localStorage.setItem(`app_income_categories_${tabToSync}`, JSON.stringify(finalIncList));
        } catch {}
        const syncedTxCount = Array.isArray(data.transactions) ? data.transactions.length : transactions.length;
        const applySyncedUsers = (rawUsersList: any[]) => {
          const prevSnapshot = usersRef.current;
          let mappedUsers = rawUsersList.map((rawU: any) =>
            mapUserFromSheet(rawU, prevSnapshot, tabToSync, syncedTxCount)
          );
          if (!mappedUsers.some((u: AppUser) => u.username.toLowerCase() === 'abujar287')) {
            const prevAdmin = prevSnapshot.find(u => u.username.toLowerCase() === 'abujar287');
            mappedUsers = [prevAdmin ? { ...DEFAULT_ADMIN, recordCount: prevAdmin.recordCount ?? 0 } : DEFAULT_ADMIN, ...mappedUsers];
          }
          setUsers(mappedUsers);
          try {
            localStorage.setItem('app_registered_users_v2', JSON.stringify(mappedUsers));
          } catch {}

          if (mappedUsers.length > 0) {
            refreshMissingUserRecordCounts(mappedUsers, tabToSync, syncedTxCount, false);
          }

          if (currentUser && currentUser.username) {
            const myLower = currentUser.username.toLowerCase();
            const updatedMe = mappedUsers.find((u: AppUser) =>
              u.username && u.username.toLowerCase() === myLower
            );
            if (updatedMe) {
              setCurrentUser(updatedMe);
              localStorage.setItem('active_user_v2', JSON.stringify(updatedMe));
            }
          }
        };

        if (Array.isArray(data.users) && data.users.length > 0) {
          applySyncedUsers(data.users);
        } else {
          fetchSheetApi('/api/sheet-proxy?action=getusers')
            .then(async uRes => {
              if (!uRes.ok) return;
              const uText = await uRes.text();
              let uData: any = null;
              try { uData = JSON.parse(uText); } catch {}
              if (uData && Array.isArray(uData.users) && uData.users.length > 0) {
                applySyncedUsers(uData.users);
              }
            })
            .catch(() => {});
        }

        setLastSyncDate(new Date());
        showToast(lang === 'en' ? 'Synced successfully!' : 'সফলভাবে সিঙ্ক হয়েছে!', 'success');
      } else {
        setLastSyncDate(new Date());
        showToast(lang === 'en' ? 'Synced with local device cache' : 'ডিভাইস ডাটা দিয়ে সিঙ্ক সম্পন্ন', 'info');
      }
    } catch (err) {
      console.error('Sync Error:', err);
      showToast(lang === 'en' ? 'Sync failed' : 'সিঙ্ক করা সম্ভব হয়নি', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [currentTab, handleSyncNotes, hasNotepadAccess, lang, mapUserFromSheet, refreshMissingUserRecordCounts, saveTransactionsLocally, showToast, transactions.length]);

  const handleManualSyncRef = useRef(handleManualSync);
  useEffect(() => {
    handleManualSyncRef.current = handleManualSync;
  }, [handleManualSync]);

  // Initial sync on mount or auth / tab switch only (never re-trigger on transaction count edits)
  useEffect(() => {
    if (isAuthenticated) {
      handleManualSyncRef.current(currentTab);
    }
  }, [isAuthenticated, currentTab]);

  // Universal Pull-Down-To-Sync & Horizontal Swipe Between Footer Tabs
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const pullStartXRef = useRef<number | null>(null);
  const isPullActiveRef = useRef<boolean>(false);
  const pullDistanceRef = useRef<number>(0);

  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeAxisRef = useRef<'x' | 'y' | null>(null);
  const swipeBlockedRef = useRef<boolean>(false);

  const handleMainTouchStart = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const el = mainScrollRef.current;

    if ((window as any).__isCategoryDragging) {
      swipeBlockedRef.current = true;
      pullStartYRef.current = null;
      isPullActiveRef.current = false;
      return;
    }

    // Horizontal swipe tracking (works at any scroll offset)
    swipeStartXRef.current = touch.clientX;
    swipeStartYRef.current = touch.clientY;
    swipeAxisRef.current = null;

    let blocked = false;
    let pullBlocked = false;
    let node = e.target as HTMLElement | null;
    while (node && node !== el) {
      const tag = node.tagName;
      if (node.hasAttribute('data-no-pull-sync')) {
        pullBlocked = true;
      }
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        node.hasAttribute('data-no-tab-swipe')
      ) {
        blocked = true;
        break;
      }
      if (node.scrollWidth > node.clientWidth + 4) {
        const overflowX = window.getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          blocked = true;
          break;
        }
      }
      node = node.parentElement;
    }
    swipeBlockedRef.current = blocked;

    // Pull-to-sync tracking (only when scrolled to top and not touching drag-reorder elements)
    if (isSyncing || pullBlocked) {
      pullStartYRef.current = null;
      isPullActiveRef.current = false;
      return;
    }
    if (el && el.scrollTop > 2) return;
    pullStartYRef.current = touch.clientY;
    pullStartXRef.current = touch.clientX;
    isPullActiveRef.current = false;
  }, [isSyncing]);

  const handleMainTouchMove = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if ((window as any).__isCategoryDragging) {
      pullStartYRef.current = null;
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      if (isPullActiveRef.current || pullDistanceRef.current > 0) {
        isPullActiveRef.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        setIsPulling(false);
      }
      return;
    }

    // Axis lock for horizontal tab swipe
    if (swipeStartXRef.current !== null && swipeStartYRef.current !== null && swipeAxisRef.current === null) {
      const sdx = touch.clientX - swipeStartXRef.current;
      const sdy = touch.clientY - swipeStartYRef.current;
      if (Math.abs(sdx) > 12 || Math.abs(sdy) > 12) {
        swipeAxisRef.current = Math.abs(sdx) > Math.abs(sdy) * 1.35 ? 'x' : 'y';
      }
    }

    if (swipeAxisRef.current === 'x') {
      // Cancel pull-to-sync if user is swiping horizontally
      pullStartYRef.current = null;
      if (isPullActiveRef.current) {
        isPullActiveRef.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        setIsPulling(false);
      }
      return;
    }

    if (pullStartYRef.current === null || isSyncing) return;
    const el = mainScrollRef.current;
    if (el && el.scrollTop > 2) {
      pullStartYRef.current = null;
      isPullActiveRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    const dy = touch.clientY - pullStartYRef.current;
    const dx = Math.abs(touch.clientX - (pullStartXRef.current ?? touch.clientX));

    if (!isPullActiveRef.current) {
      if (dy <= 10 || dx > dy) {
        if (dy < -4) pullStartYRef.current = null;
        return;
      }
      isPullActiveRef.current = true;
      setIsPulling(true);
    }

    if (dy <= 0) {
      pullDistanceRef.current = 0;
      setPullDistance(0);
      return;
    }

    const damped = Math.min(72, Math.round(dy * 0.42));
    pullDistanceRef.current = damped;
    setPullDistance(damped);
  }, [isSyncing]);

  const handleMainTouchEnd = useCallback((e: React.TouchEvent<HTMLElement>) => {
    const isCatDragging = Boolean((window as any).__isCategoryDragging);
    const startX = swipeStartXRef.current;
    const axis = swipeAxisRef.current;
    const blocked = swipeBlockedRef.current || isCatDragging;

    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    swipeAxisRef.current = null;
    swipeBlockedRef.current = false;

    if (!blocked && axis === 'x' && startX !== null && e.changedTouches.length > 0) {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) >= 52) {
        const footerTabs: AppTab[] = (
          ['summary', 'details', 'upcoming_cost', 'settings', 'notepad'] as AppTab[]
        ).filter(id => allowedTabs.includes(id));
        const curIdx = footerTabs.indexOf(activeTab);
        if (curIdx !== -1) {
          if (dx < 0 && curIdx < footerTabs.length - 1) {
            handleSelectFooterTab(footerTabs[curIdx + 1]);
          } else if (dx > 0 && curIdx > 0) {
            handleSelectFooterTab(footerTabs[curIdx - 1]);
          }
        }
      }
    }

    const shouldSync = !isCatDragging && isPullActiveRef.current && pullDistanceRef.current >= 46 && !isSyncing;
    pullStartYRef.current = null;
    pullStartXRef.current = null;
    isPullActiveRef.current = false;
    pullDistanceRef.current = 0;
    setIsPulling(false);
    setPullDistance(0);

    if (shouldSync) {
      handleManualSync(currentTab);
    }
  }, [activeTab, allowedTabs, currentTab, handleManualSync, handleSelectFooterTab, isSyncing]);

  // Offline queue listener & auto-sync when back online
  useEffect(() => {
    const triggerQueueSync = async () => {
      if (getOfflineQueue().length === 0) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const count = await processOfflineQueue((syncedCount) => {
        showToast(
          lang === 'en'
            ? `${syncedCount} offline item(s) auto-synced!`
            : `${syncedCount}টি অফলাইন ডাটা অটো-সিঙ্ক হয়েছে!`,
          'success'
        );
      });
      if (count > 0 && isAuthenticated) {
        handleManualSync(currentTab);
      }
    };

    const handleOnline = () => triggerQueueSync();
    const handleFocus = () => triggerQueueSync();
    const handleVisChange = () => {
      if (document.visibilityState === 'visible') triggerQueueSync();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisChange);

    const intervalId = setInterval(() => {
      if (navigator.onLine && getOfflineQueue().length > 0) {
        triggerQueueSync();
      }
    }, 5000);

    if (navigator.onLine) {
      triggerQueueSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisChange);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, currentTab, handleManualSync, lang, showToast]);

  const handleSaveTransaction = async (overrideVal?: number) => {
    if (isReadOnly) return;
    const val = typeof overrideVal === 'number' ? overrideVal : Math.abs(evaluateExpression(calcDisplay));
    if (isNaN(val) || val <= 0) return;

    const newTx: Transaction = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      datetime: formatCleanDateTime(new Date().toString(), 'en'),
      type: entryType,
      category: entryCategory || (entryType === 'Expense' ? (expenseCategories[0] || '') : (incomeCategories[0] || '')),
      date: entryDate,
      value: val,
      note: entryNote.trim()
    };

    // Optimistic instant local commit (<100ms UI response, zero waiting for network)
    pendingInsertMapRef.current.set(newTx.id, newTx);
    saveTransactionsLocally([newTx, ...transactions]);
    playSound('success');
    setCalcDisplay('0');
    setEntryCategory('');
    setEntryNote('');
    setIsSubmitting(false);

    const payload = { action: 'insert', sheetTab: currentTab, ...newTx };

    if (!navigator.onLine) {
      pendingInsertMapRef.current.delete(newTx.id);
      addToOfflineQueue({ action: 'insert', sheetTab: currentTab, payload });
      showToast(lang === 'en' ? 'Saved offline! Will sync when online.' : 'অফলাইনে সেভ হয়েছে! ইন্টারনেট আসলে অটো-সিঙ্ক হবে।', 'info');
      return;
    }

    showToast(lang === 'en' ? 'Saved!' : 'সেভ হয়েছে!', 'success');

    // Non-blocking background sync with offline queue fallback
    fetchSheetApi('/api/sheet-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Proxy failed');
      })
      .catch(() => {
        addToOfflineQueue({ action: 'insert', sheetTab: currentTab, payload });
      })
      .finally(() => {
        pendingInsertMapRef.current.delete(newTx.id);
      });
  };

  const handleConvertTaskToExpense = async (task: CostTask) => {
    if (isReadOnly) return;
    const newTx: Transaction = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      datetime: formatCleanDateTime(new Date().toString(), 'en'),
      type: 'Expense',
      category: task.category || (expenseCategories[0] || 'Uncategorized'),
      date: task.dueDate || new Date().toISOString().split('T')[0],
      value: task.amount,
      note: `[Task] ${task.title}${task.notes ? ' - ' + task.notes : ''}`
    };

    pendingInsertMapRef.current.set(newTx.id, newTx);
    saveTransactionsLocally([newTx, ...transactions]);
    handleDeleteTask(task.id);
    playSound('success');

    const payload = { action: 'insert', sheetTab: currentTab, ...newTx };

    if (!navigator.onLine) {
      pendingInsertMapRef.current.delete(newTx.id);
      addToOfflineQueue({ action: 'insert', sheetTab: currentTab, payload });
    } else {
      fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => {
          if (!res.ok) throw new Error('Proxy failed');
        })
        .catch(() => {
          addToOfflineQueue({ action: 'insert', sheetTab: currentTab, payload });
        })
        .finally(() => {
          pendingInsertMapRef.current.delete(newTx.id);
        });
    }

    showToast(t(`${task.amount.toLocaleString()} paid & removed from tasks!`, `${task.amount.toLocaleString()} খরচে যোগ করা হয়েছে এবং টাস্ক লিস্ট থেকে সরানো হয়েছে!`), 'success');
  };

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    const updatedList = transactions.map(t => (t.id === updatedTx.id ? updatedTx : t));
    saveTransactionsLocally(updatedList);

    const payload = { action: 'update', sheetTab: currentTab, ...updatedTx };

    if (!navigator.onLine) {
      addToOfflineQueue({ action: 'update', sheetTab: currentTab, payload });
      showToast(lang === 'en' ? 'Updated offline!' : 'অফলাইনে আপডেট হয়েছে!', 'info');
      return;
    }

    showToast('Updated!', 'success');
    fetchSheetApi('/api/sheet-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Proxy failed');
      })
      .catch(() => {
        addToOfflineQueue({ action: 'update', sheetTab: currentTab, payload });
      });
  };

  const handleConfirmDelete = async (txToDelete: Transaction) => {
    if (isReadOnly) return;
    saveTransactionsLocally(transactions.filter(t => t.id !== txToDelete.id));
    playSound('delete');
    setIsDeleting(false);
    setDeletingTx(null);

    const payload = { action: 'delete', sheetTab: currentTab, id: txToDelete.id };

    if (!navigator.onLine) {
      addToOfflineQueue({ action: 'delete', sheetTab: currentTab, payload });
      showToast(lang === 'en' ? 'Deleted offline' : 'অফলাইনে ডিলিট হয়েছে', 'info');
      return;
    }

    showToast('Deleted', 'info');
    fetchSheetApi('/api/sheet-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Proxy failed');
      })
      .catch(() => {
        addToOfflineQueue({ action: 'delete', sheetTab: currentTab, payload });
      });
  };

  // ----------------------------------------------------
  // 10. ENTRY & MODAL LOGIC
  // ----------------------------------------------------
  const [entryType, setEntryType] = useState<TransactionType>('Expense');
  const [entryCategory, setEntryCategory] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [entryNote, setEntryNote] = useState<string>('');
  const [calcDisplay, setCalcDisplay] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [catModalType, setCatModalType] = useState<TransactionType>('Expense');

  const handleAddCategory = async (newCat: string, type: TransactionType) => {
    const cleanCat = newCat.trim();
    if (!cleanCat) return;

    const updated = type === 'Expense' ? [...expenseCategories, cleanCat] : [...incomeCategories, cleanCat];
    const deduped = deduplicateCategories(updated);
    if (type === 'Expense') setExpenseCategories(deduped);
    else setIncomeCategories(deduped);

    try {
      localStorage.setItem(`app_${type.toLowerCase()}_categories_${currentTab}`, JSON.stringify(deduped));
    } catch {}

    showToast(lang === 'en' ? `Category '${cleanCat}' added!` : `'${cleanCat}' ক্যাটাগরি গুগল শিটে যুক্ত হয়েছে!`, 'success');

    // Cloud Save: Write new category to Google Sheet
    try {
      await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addcategory',
          sheetTab: currentTab,
          category: cleanCat,
          type
        })
      });
    } catch {}
  };

  const handleUpdateCategories = (newCats: string[], type: TransactionType) => {
    if (type === 'Expense') setExpenseCategories(newCats);
    else setIncomeCategories(newCats);
    try {
      localStorage.setItem(`app_${type.toLowerCase()}_categories_${currentTab}`, JSON.stringify(newCats));
      localStorage.setItem(
        `app_category_order_${currentTab}_${type.toLowerCase()}`,
        JSON.stringify(newCats.map(c => cleanCategoryName(c, 'en').toLowerCase()))
      );
    } catch {}
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    const cleanU = loginUsername.trim().toLowerCase();
    const cleanP = loginPassword.trim();

    if (!cleanU || !cleanP) {
      setLoginError(lang === 'en' ? 'Please enter username and password' : 'ইউজারনেম এবং পাসওয়ার্ড দিন');
      setIsLoggingIn(false);
      return;
    }

    let target = users.find(u => u.username.toLowerCase() === cleanU);
    if (!target && (cleanU === 'abujar287' || cleanU === 'abujar')) {
      target = DEFAULT_ADMIN;
    }

    if (target && target.password === cleanP) {
      const normalizedTarget: AppUser = {
        ...target,
        allowedTabs: normalizeUserTabs(target.role, target.username, target.allowedTabs)
      };
      setCurrentUser(normalizedTarget);
      setIsAuthenticated(true);
      if (rememberLogin) {
        localStorage.setItem('app_remember_login', 'true');
        localStorage.setItem('active_user_v2', JSON.stringify(normalizedTarget));
      } else {
        localStorage.removeItem('app_remember_login');
        localStorage.removeItem('active_user_v2');
      }
      showToast(lang === 'en' ? `Welcome, ${normalizedTarget.displayName}!` : `স্বাগতম, ${normalizedTarget.displayName}!`, 'success');
      setLoginError('');
    } else {
      setLoginError(lang === 'en' ? 'Invalid username or password' : 'ইউজারনেম অথবা পাসওয়ার্ড ভুল হয়েছে');
      showToast(lang === 'en' ? 'Invalid username or password' : 'ইউজারনেম অথবা পাসওয়ার্ড ভুল হয়েছে', 'error');
    }
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('active_user_v2');
    localStorage.removeItem('app_remember_login');
  };

  const syncUserToSheet = (user: AppUser) => {
    try {
      const payload = {
        action: 'saveuser',
        sheetTab: 'abujar287',
        fullName: user.displayName,
        username: user.username,
        password: user.password,
        userSheetTab: user.sheetTab || user.username,
        role: user.role,
        accessTab: (user.allowedTabs || ['summary', 'monthly_summary', 'entry', 'details', 'settings']).join(', ')
      };

      fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch {}
  };

  const handleSelfSignupSubmit = (fullName: string, uname: string, pass: string) => {
    const cleanUname = uname.trim().toLowerCase();
    if (users.some(u => u.username.toLowerCase() === cleanUname)) {
      showToast(lang === 'en' ? 'Username already exists!' : 'ইউজারনেমটি পূর্বে তৈরি করা হয়েছে!', 'error');
      return false;
    }

    const newUser: AppUser = {
      username: cleanUname,
      password: pass,
      displayName: fullName.trim(),
      initialUsername: cleanUname,
      role: 'member',
      sheetTab: cleanUname,
      isActive: true,
      allowedTabs: normalizeUserTabs('member', cleanUname),
      createdAt: new Date().toISOString().split('T')[0]
    };

    try {
      Object.keys(localStorage).forEach(k => {
        if (k.includes(`_${cleanUname}`)) localStorage.removeItem(k);
      });
    } catch {}

    clearUserDeletedLocally(cleanUname);
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updatedUsers));
    } catch {}

    syncUserToSheet(newUser);
    fetchSheetApi('/api/sheet-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createtab', sheetTab: cleanUname })
    }).catch(() => {});

    setLoginUsername(cleanUname);
    setLoginPassword(pass);
    showToast(
      lang === 'en'
        ? `Account @${cleanUname} created successfully! Please sign in.`
        : `একাউন্ট @${cleanUname} তৈরি হয়েছে! এখন লগইন করুন।`,
      'success'
    );
    return true;
  };

  const handleSaveProfile = (
    name: string,
    pass?: string,
    role?: UserRole,
    userAllowedTabs?: AppTab[],
    userIsReadOnly?: boolean
  ) => {
    const targetUser = editingUser || currentUser;
    if (!targetUser) return;

    const nextRole = role || targetUser.role;
    const updated: AppUser = {
      ...targetUser,
      displayName: name,
      password: pass || targetUser.password,
      role: nextRole,
      allowedTabs: normalizeUserTabs(nextRole, targetUser.username, userAllowedTabs || targetUser.allowedTabs),
      isReadOnly: userIsReadOnly !== undefined ? userIsReadOnly : targetUser.isReadOnly
    };

    if (currentUser && updated.username === currentUser.username) {
      setCurrentUser(updated);
      localStorage.setItem('active_user_v2', JSON.stringify(updated));
    }
    const newUsersList = users.map(u => u.username === updated.username ? updated : u);
    setUsers(newUsersList);
    localStorage.setItem('app_registered_users_v2', JSON.stringify(newUsersList));
    syncUserToSheet(updated);
    setEditingUser(null);
  };

  const handleCreateUser = (
    name: string,
    uname: string,
    pass: string,
    role: UserRole,
    userAllowedTabs?: AppTab[],
    userIsReadOnly?: boolean,
    viewTargetTab?: string
  ) => {
    const cleanUname = uname.trim().toLowerCase();
    const newUser: AppUser = {
      username: cleanUname,
      password: pass,
      displayName: name,
      initialUsername: cleanUname,
      role,
      sheetTab: cleanUname,
      isActive: true,
      allowedTabs: normalizeUserTabs(role, cleanUname, userAllowedTabs),
      isReadOnly: userIsReadOnly,
      viewTargetTab,
      createdAt: new Date().toISOString().split('T')[0]
    };

    try {
      Object.keys(localStorage).forEach(k => {
        if (k.includes(`_${cleanUname}`)) localStorage.removeItem(k);
      });
    } catch {}

    clearUserDeletedLocally(cleanUname);
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updatedUsers));
    } catch {}

    syncUserToSheet(newUser);
    fetchSheetApi('/api/sheet-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createtab', sheetTab: cleanUname })
    }).catch(() => {});

    showToast(lang === 'en' ? `User @${cleanUname} created with sheet tab "${cleanUname}"!` : `ইউজার @${cleanUname} ও গুগল শিট ট্যাব "${cleanUname}" তৈরি হয়েছে!`, 'success');
  };

  const handleToggleActiveUser = (user: AppUser) => {
    const updatedUsers = users.map(u => u.username === user.username ? { ...u, isActive: !u.isActive } : u);
    setUsers(updatedUsers);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updatedUsers));
    } catch {}
  };

  const sendDeleteUserToSheet = useCallback(async (username: string): Promise<'deleted' | 'needs_deploy' | 'failed'> => {
    const clean = String(username || '').trim();
    if (!clean) return 'failed';
    const payload = {
      action: 'deleteuser',
      sheetTab: 'abujar287',
      username: clean
    };
    try {
      const res = await fetchSheetApi('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let resData: any = null;
      try { resData = JSON.parse(text); } catch {}

      if (resData?.result === 'success' || resData?.result === 'not_found') {
        return 'deleted';
      }

      if (resData?.result === 'unknown_action') {
        // Fallback GET ping in case a proxy only routes GET action=deleteuser
        try {
          const getRes = await fetchSheetApi(
            `/api/sheet-proxy?action=deleteuser&sheetTab=abujar287&username=${encodeURIComponent(clean)}`
          );
          const getText = await getRes.text();
          let getData: any = null;
          try { getData = JSON.parse(getText); } catch {}
          if (getData?.result === 'success' || getData?.result === 'not_found') {
            return 'deleted';
          }
        } catch {}
        return 'needs_deploy';
      }

      if (resData?.result === 'forbidden') {
        return 'needs_deploy';
      }

      return res.ok ? 'failed' : 'failed';
    } catch {
      return 'failed';
    }
  }, []);

  const handleConfirmDeleteUser = async (user: AppUser) => {
    const targetLower = String(user.username || '').trim().toLowerCase();
    if (!targetLower || targetLower === 'abujar287') {
      setUserToDelete(null);
      return;
    }

    markUserDeletedLocally(targetLower);
    setUsers(prev => {
      const next = prev.filter(u => String(u.username || '').trim().toLowerCase() !== targetLower);
      try {
        localStorage.setItem('app_registered_users_v2', JSON.stringify(next));
      } catch {}
      return next;
    });
    setUserToDelete(null);

    const payload = {
      action: 'deleteuser',
      sheetTab: 'abujar287',
      username: user.username
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addToOfflineQueue({ action: 'deleteuser', sheetTab: 'abujar287', payload });
      showToast(
        lang === 'en'
          ? `User ${user.username} removed from app; queued for Sheet deletion when online.`
          : `ইউজার ${user.username} অ্যাপ থেকে রিমুভ হয়েছে; অনলাইনে আসলে শিট থেকে ডিলিট হবে।`,
        'info'
      );
      return;
    }

    const status = await sendDeleteUserToSheet(user.username);
    if (status === 'deleted') {
      clearUserDeletedLocally(targetLower);
      showToast(
        lang === 'en'
          ? `User ${user.username} deleted from app & Google Sheet!`
          : `ইউজার ${user.username} অ্যাপ এবং গুগল শিট থেকে ডিলিট হয়েছে!`,
        'success'
      );
      return;
    }

    if (status === 'needs_deploy') {
      showToast(
        lang === 'en'
          ? `User ${user.username} removed from app. Deploy updated Apps Script (New version) in Settings to remove from Sheet AL:AQ.`
          : `ইউজার ${user.username} অ্যাপ থেকে রিমুভ হয়েছে। শিট AL:AQ থেকে মুছতে Settings থেকে Apps Script (New version) Deploy করুন।`,
        'info'
      );
      return;
    }

    addToOfflineQueue({ action: 'deleteuser', sheetTab: 'abujar287', payload });
    showToast(
      lang === 'en'
        ? `User ${user.username} removed from app (Sheet delete queued)`
        : `ইউজার ${user.username} অ্যাপ থেকে রিমুভ হয়েছে (শিট ডিলিট কিউতে আছে)`,
      'info'
    );
  };

  const handleRetryPendingSheetUserDeletes = useCallback(async () => {
    if (pendingSheetDeletedUsers.length === 0) return;
    let deletedCount = 0;
    let needsDeploy = false;

    for (const uname of pendingSheetDeletedUsers) {
      const status = await sendDeleteUserToSheet(uname);
      if (status === 'deleted') {
        clearUserDeletedLocally(uname);
        deletedCount++;
      } else if (status === 'needs_deploy') {
        needsDeploy = true;
      }
    }

    if (deletedCount > 0 && !needsDeploy) {
      showToast(
        lang === 'en'
          ? `Removed ${deletedCount} user(s) from Google Sheet AL:AQ!`
          : `${deletedCount}টি ইউজার গুগল শিট AL:AQ থেকে ডিলিট হয়েছে!`,
        'success'
      );
    } else if (needsDeploy) {
      showToast(
        lang === 'en'
          ? 'Apps Script is still on old version. Copy updated script from Settings & Deploy > New version.'
          : 'Apps Script এখনো পুরোনো ভার্সনে আছে। Settings থেকে নতুন স্ক্রিপ্ট কপি করে New version Deploy করুন।',
        'error'
      );
    } else {
      showToast(
        lang === 'en' ? 'Could not connect to Sheet. Please try again.' : 'শিটের সাথে কানেক্ট করা যায়নি। আবার চেষ্টা করুন।',
        'info'
      );
    }
  }, [pendingSheetDeletedUsers, sendDeleteUserToSheet, clearUserDeletedLocally, showToast, lang]);

  const headerNotifications: AppNotification[] = useMemo(() => {
    const items: AppNotification[] = [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayMs = new Date(`${todayStr}T00:00:00`).getTime();

    tasks
      .filter(task => task.status === 'pending')
      .forEach(task => {
        if (!task.dueDate) return;
        if (task.dueDate === todayStr) {
          items.push({
            id: `due_today_${task.id}_${task.dueDate}`,
            kind: 'due_today',
            title: lang === 'en' ? `Due Today: ${task.title}` : `আজকের ডিউ: ${task.title}`,
            message: `${task.dueTime || '09:00'}${task.amount > 0 ? ` • ৳${task.amount.toLocaleString()}` : ''}`,
            badgeText: lang === 'en' ? 'Today' : 'আজ',
            targetTab: 'upcoming_cost',
            task,
            actionType: 'pay_task'
          });
        } else if (task.dueDate < todayStr) {
          items.push({
            id: `overdue_${task.id}_${task.dueDate}`,
            kind: 'overdue',
            title: lang === 'en' ? `Overdue: ${task.title}` : `সময় উত্তীর্ণ: ${task.title}`,
            message: `${task.dueDate}${task.dueTime ? ` • ${task.dueTime}` : ''}${task.amount > 0 ? ` • ৳${task.amount.toLocaleString()}` : ''}`,
            badgeText: lang === 'en' ? 'Overdue' : 'বকেয়া',
            targetTab: 'upcoming_cost',
            task,
            actionType: 'pay_task'
          });
        } else {
          const dueMs = new Date(`${task.dueDate}T00:00:00`).getTime();
          const diffDays = Math.ceil((dueMs - todayMs) / 86400000);
          const reminderWindow = Math.max(1, Number(task.reminderDaysBefore ?? 1));
          if (diffDays > 0 && diffDays <= reminderWindow) {
            items.push({
              id: `upcoming_${task.id}_${task.dueDate}`,
              kind: 'upcoming',
              title: lang === 'en' ? `Upcoming: ${task.title}` : `আসন্ন খরচ: ${task.title}`,
              message: `${task.dueDate} (${diffDays === 1 ? (lang === 'en' ? 'Tomorrow' : 'আগামীকাল') : (lang === 'en' ? `In ${diffDays} days` : `${diffDays} দিন পর`)})${task.amount > 0 ? ` • ৳${task.amount.toLocaleString()}` : ''}`,
              badgeText: diffDays === 1 ? (lang === 'en' ? '1d' : '১ দিন') : `${diffDays}d`,
              targetTab: 'upcoming_cost',
              task,
              actionType: 'navigate'
            });
          }
        }
      });

    // Monthly budget alert (>= 85% spent)
    const activeMap = findMonthMapping(monthMappings, selectedMonth);
    let totalBudget = Number(activeMap?.budget || 0);
    if (!totalBudget || totalBudget <= 0) {
      try {
        const savedBudgets = localStorage.getItem(`app_category_budgets_${currentTab}_${selectedMonth}`);
        if (savedBudgets) {
          const parsed = JSON.parse(savedBudgets);
          if (parsed && typeof parsed === 'object') {
            totalBudget = Object.values(parsed).reduce((sum: number, val: any) => sum + (Number(val) > 0 ? Number(val) : 0), 0);
          }
        }
      } catch {}
    }

    if (totalBudget > 0) {
      const monthKey = getMonthKeyFromLabel(selectedMonth);
      const monthExpense = transactions.reduce((sum, tx) => {
        if (tx.type !== 'Expense') return sum;
        const txDate = normalizeDate(tx.date);
        const inMonth = activeMap
          ? txDate >= activeMap.startDate && txDate <= activeMap.endDate
          : txDate.startsWith(monthKey);
        return inMonth ? sum + (Number(tx.value) || 0) : sum;
      }, 0);

      if (monthExpense >= totalBudget * 0.85) {
        const pct = Math.round((monthExpense / totalBudget) * 100);
        const exceeded = monthExpense >= totalBudget;
        items.push({
          id: `budget_${currentTab}_${selectedMonth}_${exceeded ? 'over' : 'warn'}`,
          kind: 'budget',
          title: exceeded
            ? (lang === 'en' ? `Budget Exceeded (${selectedMonth})` : `বাজেট অতিক্রম করেছে (${selectedMonth})`)
            : (lang === 'en' ? `Budget ${pct}% Used (${selectedMonth})` : `বাজেটের ${pct}% শেষ (${selectedMonth})`),
          message: lang === 'en'
            ? `Spent ৳${Math.round(monthExpense).toLocaleString()} of ৳${Math.round(totalBudget).toLocaleString()}`
            : `৳${Math.round(totalBudget).toLocaleString()} এর মধ্যে ৳${Math.round(monthExpense).toLocaleString()} খরচ হয়েছে`,
          badgeText: `${pct}%`,
          targetTab: 'budget',
          actionType: 'navigate'
        });
      }
    }

    const pendingOfflineCount = getOfflineQueue().length;
    if (pendingOfflineCount > 0) {
      items.push({
        id: `offline_queue_${pendingOfflineCount}`,
        kind: 'offline_sync',
        title: lang === 'en' ? `${pendingOfflineCount} Offline Change(s) Pending` : `${pendingOfflineCount}টি অফলাইন সিঙ্ক বাকি`,
        message: lang === 'en' ? 'Tap to sync pending data to Google Sheet' : 'গুগল শিটে পাঠাতে ট্যাপ করুন',
        badgeText: String(pendingOfflineCount),
        actionType: 'sync'
      });
    }

    if (updateInfoModal?.hasUpdate) {
      items.push({
        id: `update_${updateInfoModal.latestSha || updateInfoModal.newVersion || 'new'}`,
        kind: 'update',
        title: lang === 'en' ? 'App Update Available' : 'অ্যাপের নতুন আপডেট এসেছে',
        message: lang === 'en'
          ? `New version ${updateInfoModal.newVersion || ''} is ready`
          : `নতুন ভার্সন ${updateInfoModal.newVersion || ''} পাওয়া গেছে`,
        badgeText: 'NEW',
        actionType: 'update'
      });
    }

    return items;
  }, [tasks, transactions, monthMappings, selectedMonth, currentTab, updateInfoModal, lastSyncDate, lang]);

  const handleNotificationAction = useCallback((notif: AppNotification) => {
    if (notif.actionType === 'sync') {
      handleManualSync(currentTab);
      return;
    }
    if (notif.actionType === 'update') {
      setShowUpdateModal(true);
      return;
    }
    if (notif.targetTab && allowedTabs.includes(notif.targetTab)) {
      setActiveTab(notif.targetTab);
    }
  }, [handleManualSync, currentTab, allowedTabs]);

  // ----------------------------------------------------
  // RENDER: LOGIN
  // ----------------------------------------------------
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen bg-[#042F2E] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0B3C39] border border-teal-800/80 rounded-2xl p-8 shadow-2xl text-[#F0FDFA]">
          <div className="text-center mb-6">
            <img src="/logo.png" alt="হাত খরচ Logo" className="w-24 h-24 mx-auto mb-3 object-contain rounded-2xl shadow-xl border border-teal-600/60" />
            <h1 className="text-2xl font-extrabold text-[#F0FDFA]">হাত খরচ</h1>
            <p className="text-xs text-teal-300/80 mt-1">Smart Expense, Task Reminder & Budget Manager</p>
          </div>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <input
              type="text"
              value={loginUsername}
              onChange={e => setLoginUsername(e.target.value)}
              placeholder="Username"
              className="w-full p-3 bg-white border border-teal-700/70 text-slate-900 rounded-xl focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 placeholder:text-slate-400 font-medium"
              required
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-3 bg-white border border-teal-700/70 text-slate-900 rounded-xl focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 placeholder:text-slate-400 font-medium pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Remember Me / Save Login Info Checkbox */}
            <div className="flex items-center justify-between text-xs px-1 text-teal-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={e => setRememberLogin(e.target.checked)}
                  className="w-4 h-4 rounded border-teal-700 bg-[#062423] text-teal-500 focus:ring-teal-400 accent-teal-500 cursor-pointer"
                />
                <span>{lang === 'en' ? 'Save Login Info (Remember Me)' : 'লগইন সেভ রাখুন (Remember Me)'}</span>
              </label>
            </div>

            {loginError && <p className="text-rose-400 text-xs font-semibold">{loginError}</p>}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSelfSignupModal(true)}
                className="flex-1 py-3 bg-[#062423] hover:bg-teal-900/80 text-teal-200 border border-teal-700/70 rounded-xl font-bold cursor-pointer transition-colors text-xs text-center"
              >
                {lang === 'en' ? 'Create Account' : 'একাউন্ট তৈরি করুন'}
              </button>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="flex-1 py-3 bg-[#0D9488] hover:bg-[#0F766E] text-[#F0FDFA] rounded-xl font-bold cursor-pointer transition-colors shadow-md text-sm text-center"
              >
                {isLoggingIn ? (lang === 'en' ? 'Logging in...' : 'লগইন হচ্ছে...') : (lang === 'en' ? 'Sign In' : 'লগইন')}
              </button>
            </div>
          </form>
        </div>

        {/* Self Signup Modal */}
        <SelfSignupModal
          isOpen={showSelfSignupModal}
          onClose={() => setShowSelfSignupModal(false)}
          onSignup={handleSelfSignupSubmit}
          lang={lang}
          t={t}
        />
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: APP
  // ----------------------------------------------------
  return (
    <MotionConfig reducedMotion="user">
    <div className="fixed inset-0 h-full w-full overflow-hidden bg-[#042F2E] flex flex-col items-center">
      <div className="w-full flex flex-col h-full bg-transparent relative overflow-hidden">
        
        <AnimatePresence>
          {toast.show && (
            <motion.div
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#0B3C39] rounded-xl shadow-2xl border border-teal-600/60 text-xs font-bold text-[#F0FDFA] flex items-center gap-2 max-w-[90vw]"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                toast.type === 'error' ? 'bg-rose-400' : toast.type === 'info' ? 'bg-amber-300' : 'bg-emerald-400'
              }`} />
              <span className="truncate">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <Header
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lastSyncTime={lastSyncTime}
          isSyncing={isSyncing}
          onSync={() => handleManualSync(currentTab)}
          viewMode={viewMode}
          t={t}
          lang={lang}
          selectedMonth={selectedMonth}
          monthMappings={monthMappings}
          dueTodayTask={tasks.find(t => t.status === 'pending' && t.dueDate === new Date().toISOString().split('T')[0]) || null}
          onPayTask={handleConvertTaskToExpense}
          onProfileClick={() => setShowProfileModal(true)}
          onLogout={handleLogout}
          notifications={headerNotifications}
          onNotificationAction={handleNotificationAction}
        />

        <main
          id="main-scroll-container"
          ref={mainScrollRef}
          onTouchStart={handleMainTouchStart}
          onTouchMove={handleMainTouchMove}
          onTouchEnd={handleMainTouchEnd}
          onTouchCancel={handleMainTouchEnd}
          className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 md:p-6 bg-[#042F2E] w-full [overscroll-behavior-y:contain] [-webkit-overflow-scrolling:touch] relative"
        >
          {/* Pull-to-Sync Visual Indicator */}
          {(pullDistance > 0 || isSyncing) && (
            <div
              className="w-full flex items-center justify-center overflow-hidden transition-all duration-150 mb-2"
              style={{ height: isSyncing ? 36 : Math.max(24, Math.round(pullDistance * 0.65)) }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B3C39] border border-teal-700/70 text-[11px] font-semibold text-emerald-300 shadow-sm">
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-teal-200'}`}
                  style={!isSyncing ? { transform: `rotate(${pullDistance * 4}deg)` } : undefined}
                />
                <span>
                  {isSyncing
                    ? t('Syncing...', 'সিঙ্ক হচ্ছে...')
                    : pullDistance >= 46
                    ? t('Release to sync', 'ছেড়ে দিন সিঙ্ক হবে')
                    : t('Pull down to sync', 'সিঙ্ক করতে নিচে টানুন')}
                </span>
              </div>
            </div>
          )}

          <div
            className="w-full max-w-7xl mx-auto space-y-4"
            style={{
              transform: pullDistance > 0 ? `translateY(${Math.round(pullDistance * 0.35)}px)` : undefined,
              transition: isPulling ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <TabErrorBoundary>
            <Suspense
              fallback={
                <div className="py-16 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-teal-600/30 border-t-emerald-400 rounded-full animate-spin" />
                </div>
              }
            >
            <AnimatePresence mode="wait" custom={tabDirection}>
              <motion.div
                key={activeTab}
                custom={tabDirection}
                initial={{ opacity: 0, x: tabDirection * 18, scale: 0.99 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: tabDirection * -18, scale: 0.99 }}
                transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
              {activeTab === 'summary' && (
                <SummaryTab
                  transactions={transactions}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  globalFilterMode={globalFilterMode}
                  setGlobalFilterMode={setGlobalFilterMode}
                  onSelectDate={setSelectedDateModal}
                  onEdit={setEditingTx}
                  onDelete={setDeletingTx}
                  isReadOnly={isReadOnly}
                  lang={lang}
                  t={t}
                  monthMappings={monthMappings}
                  currentTab={currentTab}
                  budgetVersion={budgetVersion}
                />
              )}

              {activeTab === 'monthly_summary' && (
                <MonthlySummaryTab
                  transactions={transactions}
                  monthMappings={monthMappings}
                  onSelectMonth={(monthLabel) => {
                    setSelectedMonth(monthLabel);
                    setGlobalFilterMode('month');
                    setActiveTab('summary');
                  }}
                  onExportZip={() => setShowExportModal(true)}
                  isExportingZip={isExportingZip}
                  lang={lang}
                  t={t}
                />
              )}

              {activeTab === 'entry' && !isReadOnly && (
                <EntryTab
                  entryType={entryType} setEntryType={setEntryType}
                  entryCategory={entryCategory} setEntryCategory={setEntryCategory}
                  entryDate={entryDate} setEntryDate={setEntryDate}
                  entryNote={entryNote} setEntryNote={setEntryNote}
                  calcDisplay={calcDisplay} setCalcDisplay={setCalcDisplay}
                  expenseCategories={expenseCategories} incomeCategories={incomeCategories}
                  onReorderCategories={handleUpdateCategories}
                  onOpenCategoryManager={() => setShowCategoryManager(true)}
                  onSubmit={handleSaveTransaction} isSubmitting={isSubmitting}
                  lang={lang} t={t}
                />
              )}

              {activeTab === 'details' && (
                <DetailsTab
                  transactions={filteredTransactions} currentUser={currentUser}
                  onEdit={setEditingTx} onDelete={setDeletingTx}
                  isReadOnly={isReadOnly} lang={lang} t={t}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetTab
                  expenseCategories={expenseCategories}
                  incomeCategories={incomeCategories}
                  transactions={transactions}
                  selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
                  lang={lang} t={t} currentTab={currentTab} monthMappings={monthMappings}
                  onSaveBudget={handleSaveBudget}
                />
              )}

              {activeTab === 'upcoming_cost' && (
                <UpcomingCostTab
                  tasks={tasks}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onConvertTaskToExpense={handleConvertTaskToExpense}
                  t={t}
                  showToast={showToast}
                  currentUser={currentUser}
                  categories={expenseCategories}
                  lang={lang}
                />
              )}

              {activeTab === 'upcoming_3_month' && isSuperAdmin && (
                <Upcoming3MonthTab
                  expenseCategories={expenseCategories}
                  monthMappings={monthMappings}
                  selectedMonth={selectedMonth}
                  currentTab={currentTab}
                  remotePlan={upcoming3MonthRemotePlan}
                  remotePlanVersion={upcoming3MonthVersion}
                  onSyncPlan={handleSaveUpcoming3Month}
                  remoteBouGift={bouGiftRemote}
                  remoteBouGiftVersion={bouGiftVersion}
                  onSaveBouGift={handleSaveBouGift}
                  lang={lang}
                  t={t}
                />
              )}

              {activeTab === 'notepad' && hasNotepadAccess && (
                <NotepadTab
                  notes={notes}
                  sheetCategories={noteCategories}
                  isSyncing={isSyncingNotes || isSyncing}
                  onSyncNotes={() => handleSyncNotes(false)}
                  onAddNote={handleAddNote}
                  onUpdateNote={handleUpdateNote}
                  onDeleteNote={handleDeleteNote}
                  showToast={showToast}
                />
              )}

              {activeTab === 'users' && (
                <UsersTab
                  currentUser={currentUser}
                  users={users}
                  onOpenCreateUserModal={() => setShowCreateUserModal(true)}
                  onOpenEditUserModal={setEditingUser}
                  onRequestDeleteUser={setUserToDelete}
                  onToggleActiveUser={handleToggleActiveUser}
                  syncStatus={userSyncStatus}
                  pendingSheetDeletesCount={pendingSheetDeletedUsers.length}
                  onRetrySheetDeletes={handleRetryPendingSheetUserDeletes}
                  onOpenSettings={() => setActiveTab('settings')}
                  onManualSync={() => {
                    setUserSyncStatus(prev => ({ ...prev, loading: true, error: null }));
                    fetchSheetApi(`/api/sheet-proxy?action=getusers`)
                      .then(async res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res.json();
                      })
                      .then(data => {
                        if (data && Array.isArray(data.users) && data.users.length > 0) {
                          const prevSnapshot = usersRef.current;
                          const pendingDeleteUsernames = getDeletedUsernamesSet();
                          let mapped = data.users
                            .map((rawU: any) =>
                              mapUserFromSheet(rawU, prevSnapshot, currentTab, transactions.length)
                            )
                            .filter((u: AppUser) => !pendingDeleteUsernames.has(u.username.trim().toLowerCase()));
                          if (!mapped.some((u: AppUser) => u.username.toLowerCase() === 'abujar287')) {
                            const prevAdmin = prevSnapshot.find(u => u.username.toLowerCase() === 'abujar287');
                            mapped = [prevAdmin ? { ...DEFAULT_ADMIN, recordCount: prevAdmin.recordCount ?? 0 } : DEFAULT_ADMIN, ...mapped];
                          }
                          setUsers(mapped);
                          try {
                            localStorage.setItem('app_registered_users_v2', JSON.stringify(mapped));
                          } catch {}
                          if (mapped.length > 0) {
                            refreshMissingUserRecordCounts(mapped, currentTab, transactions.length, true);
                          }
                          setUserSyncStatus({ loading: false, error: null, lastSuccess: new Date().toLocaleTimeString() });
                          showToast(t('User list synced from Sheet AL:AQ!', 'শিট AL:AQ থেকে ইউজার সিঙ্ক সম্পন্ন!'), 'success');
                        } else if (data && data.needsDeployUpdate) {
                          setUserSyncStatus({
                            loading: false,
                            error: 'Apps Script deployment needs update (Deploy > Manage deployments > Edit > New version)',
                            lastSuccess: null
                          });
                          showToast(t('Deploy new version in Apps Script to sync users', 'ইউজার পেতে Apps Script এ New version দিয়ে Deploy করুন'), 'info');
                        } else {
                          setUserSyncStatus({ loading: false, error: null, lastSuccess: new Date().toLocaleTimeString() });
                          showToast(t('No additional users found in AL:AQ', 'AL:AQ তে অতিরিক্ত ইউজার পাওয়া যায়নি'), 'info');
                        }
                      })
                      .catch(err => {
                        console.warn('Manual sync error:', err);
                        setUserSyncStatus(prev => ({ ...prev, loading: false, error: err.message }));
                        showToast(t('Sync failed', 'সিঙ্ক ব্যর্থ হয়েছে'), 'error');
                      });
                  }}
                  t={t}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  currentUser={currentUser}
                  transactions={transactions}
                  lang={lang}
                  t={t}
                  selectedMonth={selectedMonth}
                  monthMappings={monthMappings}
                  onAddMonthMapping={m => saveMonthMappings([...monthMappings, m])}
                  onDeleteMonthMapping={id => saveMonthMappings(monthMappings.filter(x => x.id !== id))}
                  onSetDefaultMonth={handleSetDefaultMonth}
                  onCheckForUpdates={() => handleCheckForUpdates(true)}
                  appLastUpdateTime={appLastUpdateTime}
                />
              )}
              </motion.div>
            </AnimatePresence>
            </Suspense>
            </TabErrorBoundary>
          </div>
        </main>

        <nav className="shrink-0 bg-[#042F2E]/95 backdrop-blur-xl px-2 sm:px-4 py-1.5 pb-safe flex justify-center items-center z-40 w-full min-h-[66px] border-t border-teal-800/50">
          <div className="w-full max-w-3xl lg:max-w-4xl flex items-center justify-around gap-1 sm:gap-2 relative">
            {[
              { id: 'summary' as const, label: 'Summary', icon: BarChart3 },
              { id: 'details' as const, label: 'Details', icon: ListOrdered },
              { id: 'upcoming_cost' as const, label: 'Upcoming Cost', icon: CalendarClock },
              { id: 'settings' as const, label: 'Settings', icon: Settings },
              { id: 'notepad' as const, label: 'Notepad', icon: NotebookPen }
            ].filter(x => allowedTabs.includes(x.id)).map(item => {
              const isActive = activeTab === item.id;
              const isNotepad = item.id === 'notepad';

              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => handleSelectFooterTab(item.id)}
                  className={`flex-1 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl cursor-pointer select-none transition-colors duration-200 border border-transparent ${
                    !isActive && isNotepad
                      ? 'bg-amber-500/10 hover:bg-amber-500/18'
                      : !isActive
                      ? 'hover:bg-teal-900/40'
                      : ''
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className={`absolute inset-0 rounded-xl ${
                        isNotepad
                          ? 'bg-amber-500/15'
                          : 'bg-[#0B4A45]/75'
                      }`}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}

                  <motion.div
                    animate={{
                      y: isActive ? -1.5 : 0,
                      scale: isActive ? 1.12 : 1
                    }}
                    transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                    className="relative z-10 flex items-center justify-center"
                  >
                    <item.icon
                      className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-colors ${
                        isActive
                          ? isNotepad
                            ? 'text-amber-200 drop-shadow-[0_0_6px_rgba(253,230,138,0.85)]'
                            : 'text-teal-200 drop-shadow-[0_0_6px_rgba(94,234,212,0.8)]'
                          : isNotepad
                          ? 'text-amber-300'
                          : 'text-teal-300/75'
                      }`}
                    />
                  </motion.div>

                  {isActive ? (
                    <span
                      className={`relative z-10 mt-1 inline-flex items-center justify-center px-2 py-[3px] rounded-full overflow-hidden max-w-full ${
                        isNotepad
                          ? 'shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                          : 'shadow-[0_0_12px_rgba(45,212,191,0.45)]'
                      }`}
                    >
                      {/* Continuously moving loading border line around the active tab name */}
                      <span
                        aria-hidden="true"
                        className="tab-loading-ring pointer-events-none"
                        style={{
                          background: isNotepad
                            ? 'conic-gradient(from 0deg, transparent 0deg 200deg, #F59E0B 260deg, #FDE68A 320deg, #FFFFFF 360deg)'
                            : 'conic-gradient(from 0deg, transparent 0deg 200deg, #14B8A6 260deg, #5EEAD4 320deg, #FFFFFF 360deg)'
                        }}
                      />
                      <span
                        aria-hidden="true"
                        className={`absolute inset-[1.5px] rounded-full ${
                          isNotepad ? 'bg-[#3B2407]' : 'bg-[#063835]'
                        }`}
                      />
                      <motion.span
                        initial={{ scale: 0.94 }}
                        animate={{ scale: 1.02 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                        className={`relative z-10 text-[10px] sm:text-[11px] font-extrabold tracking-tight leading-none truncate max-w-full tab-name-highlight bg-clip-text text-transparent ${
                          isNotepad
                            ? 'bg-gradient-to-r from-amber-200 via-white to-amber-200'
                            : 'bg-gradient-to-r from-teal-200 via-white to-emerald-200'
                        }`}
                      >
                        {item.label}
                      </motion.span>
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] sm:text-[11px] mt-1 tracking-tight leading-none relative z-10 truncate max-w-full font-bold ${
                        isNotepad ? 'text-amber-300' : 'text-teal-300/75'
                      }`}
                    >
                      {item.label}
                    </span>
                  )}

                  {item.id === 'upcoming_cost' && taskDueCount > 0 && (
                    <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-[#FF7A59] ring-2 ring-[#042F2E] z-20" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* MODALS */}
      <DayDetailsModal dateStr={selectedDateModal} transactions={transactions} onClose={() => setSelectedDateModal(null)} onEdit={setEditingTx} onDelete={setDeletingTx} lang={lang} t={t} />
      <EditTransactionModal tx={editingTx} onClose={() => setEditingTx(null)} onSave={handleUpdateTransaction} expenseCategories={expenseCategories} incomeCategories={incomeCategories} lang={lang} t={t} />
      <DeleteConfirmModal tx={deletingTx} onClose={() => setDeletingTx(null)} onConfirm={handleConfirmDelete} isDeleting={isDeleting} lang={lang} t={t} />
      <CreateUserModal isOpen={showCreateUserModal} onClose={() => setShowCreateUserModal(false)} onCreate={handleCreateUser} lang={lang} t={t} />
      <DeleteUserModal user={userToDelete} onClose={() => setUserToDelete(null)} onConfirm={handleConfirmDeleteUser} lang={lang} t={t} />
      <AddCategoryModal isOpen={showAddCatModal} type={catModalType} onClose={() => setShowAddCatModal(false)} onAdd={handleAddCategory} lang={lang} t={t} />
      <CategoryManagerModal isOpen={showCategoryManager} onClose={() => setShowCategoryManager(false)} expenseCategories={expenseCategories} incomeCategories={incomeCategories} onUpdateCategories={handleUpdateCategories} onOpenAddModal={t => { setCatModalType(t); setShowAddCatModal(true); }} lang={lang} t={t} />
      <ExportMonthModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onExport={handlePerformExportZip} currentMonth={selectedMonth} monthMappings={monthMappings} lang={lang} t={t} />
      <MobileInstallModal isOpen={showMobileModal} onClose={() => setShowMobileModal(false)} isInstallable={isInstallable} onInstall={install} lang={lang} t={t} />
      <EditProfileModal user={editingUser} isOpen={editingUser !== null} onClose={() => setEditingUser(null)} onSave={handleSaveProfile} isAdmin={isSuperAdmin || currentUser?.role === 'admin'} lang={lang} t={t} />
      <ExitConfirmModal isOpen={showExitModal} onClose={handleCloseExitModal} onConfirm={handleConfirmExit} lang={lang} t={t} />
      <UserProfileModal user={currentUser} isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} lang={lang} t={t} onLogout={handleLogout} />
      <AppUpdateModal 
        isOpen={showUpdateModal} 
        onClose={() => {
          if (updateInfoModal?.latestSha) {
            recordUpdateDismissed(updateInfoModal.latestSha);
          }
          setUpdateAutoStart(false);
          setShowUpdateModal(false);
        }} 
        updateInfo={updateInfoModal}
        autoStartDownload={updateAutoStart}
        t={t} 
      />




      {isAppExited && (
        <div className="fixed inset-0 z-[9999999] bg-[#042F2E] flex flex-col items-center justify-center p-6 text-center animate-fadeIn text-[#F0FDFA]">
          <div className="w-16 h-16 rounded-full bg-[#062423] border border-teal-700/80 flex items-center justify-center mb-4 shadow-2xl">
            <Lock className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-[#F0FDFA] mb-1">
            {t('হাত খরচ Closed', 'অ্যাপস বন্ধ করা হয়েছে')}
          </h2>
          <p className="text-xs text-teal-300/80 mb-6 max-w-xs leading-relaxed">
            {t('You have exited the application. You can close this tab or tap below to reopen.', 'আপনি নিশ্চিতভাবে অ্যাপস থেকে বের হয়ে গেছেন। এই ব্রাউজার ট্যাবটি বন্ধ করতে পারেন অথবা পুনরায় অ্যাপে প্রবেশ করতে পারেন।')}
          </p>
          <button
            onClick={() => {
              setIsAppExited(false);
              window.location.reload();
            }}
            className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded-xl shadow-lg cursor-pointer transition-all active:scale-95 text-xs border border-teal-600/80"
          >
            {t('Reopen হাত খরচ', 'পুনরায় অ্যাপে প্রবেশ করুন')}
          </button>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}
