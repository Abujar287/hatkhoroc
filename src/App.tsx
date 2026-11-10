import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';
import {
  Wallet,
  Calendar,
  PlusCircle,
  ListOrdered,
  Users,
  Settings,
  Lock,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Plus,
  Sliders,
  CalendarClock,
  BellRing,
  VolumeX,
  Zap,
  X
} from 'lucide-react';
import {
  playTaskAlarmSound,
  stopTaskAlarmSound,
  vibrateDevice,
  sendSystemNotification,
  hasTaskBeenNotified,
  markTaskAsNotified,
  initAudioUnlock,
  ensureNotificationPermission,
  setupWebPushSubscription,
  syncTasksToPushServer
} from './utils/taskAlarmManager';
import { AppUser, Transaction, TransactionType, UserRole, AppTab, MonthMapping, CostTask } from './types';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  GOOGLE_SCRIPT_URL
} from './constants';
import {
  normalizeDate,
  normalizeTime,
  formatTime12h,
  formatSyncDateTime,
  formatCleanDateTime,
  cleanMappingLabel,
  getMonthKeyFromLabel,
  findMonthMapping,
  formatTaskCreatedAt
} from './utils/dateUtils';
import { cleanCategoryName } from './utils/categoryUtils';
import { evaluateExpression } from './utils/calcUtils';

// Modular Components
import { Header } from './components/Header';
import { SummaryTab } from './components/SummaryTab';
import { EntryTab } from './components/EntryTab';
import { DetailsTab } from './components/DetailsTab';
import { BudgetTab } from './components/BudgetTab';
import { TaskTab } from './components/TaskTab';
import { SettingsTab } from './components/SettingsTab';
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
  ModalPortal
} from './components/Modals';
import { usePWAInstall } from './usePWAInstall';
import { initAuth, googleSignIn, logout as firebaseLogout } from './lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

import { checkGitHubForUpdates, isUpdateDismissedRecently, recordUpdateAcknowledged, UpdateInfo, APP_VERSION } from './utils/updateChecker';


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
  allowedTabs: ['summary', 'entry', 'details', 'budget', 'task', 'users', 'settings'],
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
  const googleAccessToken = null;

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
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [showMobileModal, setShowMobileModal] = useState<boolean>(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
  const [showSelfSignupModal, setShowSelfSignupModal] = useState<boolean>(false);
  const [rememberLogin, setRememberLogin] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_remember_login') === 'true';
    } catch {
      return false;
    }
  });
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

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

  const handleCheckForUpdates = useCallback(async (isManual = false) => {
    try {
      if (isManual) {
        showToast(lang === 'en' ? 'Checking for updates...' : 'আপডেট চেক করা হচ্ছে...', 'info');
      }
      const info = await checkGitHubForUpdates();
      if (info && info.hasUpdate) {
        recordUpdateAcknowledged(info.latestSha);
        showToast(
          lang === 'en' ? 'Updating app...' : 'অ্যাপ আপডেট হচ্ছে...',
          'info'
        );
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else if (isManual) {
        showToast(
          lang === 'en' ? `App is completely up to date (${APP_VERSION})!` : `আপনার অ্যাপটি সম্পূর্ণ আপ-টু-ডেট আছে (${APP_VERSION})!`,
          'success'
        );
      }
    } catch {
      if (isManual) {
        showToast(
          lang === 'en' ? 'Could not check for updates. Check internet connection.' : 'আপডেট চেক করা সম্ভব হয়নি। ইন্টারনেট কানেকশন চেক করুন।',
          'error'
        );
      }
    }
  }, [lang, showToast]);

  // Automatic GitHub update check on entry (for APK / Web / PWA)
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      checkGitHubForUpdates().then(info => {
        if (info && info.hasUpdate) {
          recordUpdateAcknowledged(info.latestSha);
          window.location.reload();
        }
      }).catch(() => {});
    }, 1800);
    return () => clearTimeout(timer);
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
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('app_registered_users_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u: AppUser) => {
            let defaultTabs: AppTab[] = u.username === 'abujar287' || u.role === 'super_admin'
              ? ['summary', 'entry', 'details', 'budget', 'task', 'users', 'settings']
              : ['summary', 'entry', 'details', 'budget', 'task', 'settings'];
            let tabs: AppTab[] = (u.allowedTabs as AppTab[]) || defaultTabs;
            if (u.username !== 'abujar287' && u.role !== 'super_admin') {
              tabs = tabs.filter((tabItem: AppTab) => tabItem !== 'users');
            }
            if (!tabs.includes('budget') && u.role !== 'super_admin_2') {
              tabs = [...tabs, 'budget'];
            }
            if (u.username === 'abujar287') {
              return {
                ...u,
                role: 'super_admin',
                allowedTabs: tabs,
                isReadOnly: false
              };
            }
            return { ...u, allowedTabs: tabs };
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
          let defaultTabs: AppTab[] = parsed.username === 'abujar287' || parsed.role === 'super_admin'
            ? ['summary', 'entry', 'details', 'budget', 'task', 'users', 'settings']
            : ['summary', 'entry', 'details', 'budget', 'task', 'settings'];
          let tabs: AppTab[] = (parsed.allowedTabs as AppTab[]) || defaultTabs;
          if (parsed.username !== 'abujar287' && parsed.role !== 'super_admin') {
            tabs = tabs.filter((tabItem: AppTab) => tabItem !== 'users');
          }
          if (!tabs.includes('budget') && parsed.role !== 'super_admin_2') {
            tabs = [...tabs, 'budget'];
          }
          if (parsed.username === 'abujar287') {
            return {
              ...parsed,
              role: 'super_admin',
              allowedTabs: tabs,
              isReadOnly: false
            };
          }
          return { ...parsed, allowedTabs: tabs };
        }
      }
    } catch {}
    return null;
  });

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

  const allowedTabs: AppTab[] = useMemo(() => {
    let tabs = currentUser?.allowedTabs;
    if (!tabs || tabs.length === 0) {
      if (currentUser?.role === 'super_admin_2') {
        tabs = ['summary', 'details'];
      } else if (currentUser?.username === 'abujar287' || currentUser?.role === 'super_admin') {
        tabs = ['summary', 'entry', 'details', 'budget', 'task', 'users', 'settings'];
      } else {
        tabs = ['summary', 'entry', 'details', 'budget', 'task', 'settings'];
      }
    }

    // Strictly ensure non-admin users never get access to the 'users' tab
    if (currentUser?.username !== 'abujar287' && currentUser?.role !== 'super_admin') {
      tabs = tabs.filter(t => t !== 'users');
    }

    if (!tabs.includes('budget') && currentUser?.role !== 'super_admin_2') {
      tabs = [...tabs, 'budget'];
    }
    if (!tabs.includes('task') && currentUser?.role !== 'super_admin_2') {
      tabs = [...tabs, 'task'];
    }
    return tabs;
  }, [currentUser]);

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

  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`app_monthly_budget_${currentTab}`);
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
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

      const savedBudget = localStorage.getItem(`app_monthly_budget_${currentTab}`);
      setMonthlyBudget(savedBudget ? Number(savedBudget) || 0 : 0);
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

  const [activeRingingTask, setActiveRingingTask] = useState<CostTask | null>(null);
  const [showDueEntryModal, setShowDueEntryModal] = useState<boolean>(true);
  const [hasNotifiedOnEntry, setHasNotifiedOnEntry] = useState<boolean>(false);

  // Compute tasks due today or overdue
  const dueTodayTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return tasks.filter(t => (t.status === 'pending' || !t.status) && t.dueDate <= todayStr);
  }, [tasks]);

  const handleStopRingingAlarm = useCallback(() => {
    stopTaskAlarmSound();
    setActiveRingingTask(null);
  }, []);

  useEffect(() => {
    initAudioUnlock();
    // Register Web Push notification subscription with browser and server
    setupWebPushSubscription().catch(() => {});

    // Listen for broadcast messages from Service Worker when a background Push arrives
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (e: MessageEvent) => {
        if (e.data?.type === 'TASK_ALARM_PUSH_RECEIVED' && e.data?.taskId) {
          const target = tasks.find(t => t.id === e.data.taskId) || tasks[0];
          if (target) {
            setActiveRingingTask(target);
            playTaskAlarmSound();
            vibrateDevice([500, 200, 500, 200, 500, 200, 800]);
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [tasks]);

  // Sync scheduled tasks to server push scheduler so phone wakes up even when app is closed
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      syncTasksToPushServer(tasks).catch(() => {});
    }
  }, [tasks]);

  // Check if opened via notification click (?ringTask=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ringTaskId = urlParams.get('ringTask');
      if (ringTaskId && tasks && tasks.length > 0) {
        const found = tasks.find(t => t.id === ringTaskId);
        if (found) {
          setActiveRingingTask(found);
          playTaskAlarmSound();
          vibrateDevice([500, 200, 500, 200, 500, 200, 800]);
        }
      }
    } catch {}
  }, [tasks]);

  // When entering the app: auto-trigger sound, vibration, notification, and highlight for tasks due today
  useEffect(() => {
    if (dueTodayTasks.length > 0 && !hasNotifiedOnEntry) {
      setHasNotifiedOnEntry(true);
      ensureNotificationPermission();
      setupWebPushSubscription().catch(() => {});
      playTaskAlarmSound();
      vibrateDevice([500, 200, 500, 200, 500, 200, 800]);
      setActiveRingingTask(dueTodayTasks[0]);

      dueTodayTasks.forEach(task => {
        sendSystemNotification(`🚨 ${t('Due Today', 'আজকের দিন পরিশোধ')}: ${task.title}`, {
          body: `${t('Amount', 'পরিমাণ')}: ${task.amount.toLocaleString()} | ${t('Due Date', 'তারিখ')}: ${task.dueDate} ${task.dueTime ? formatTime12h(task.dueTime) : ''}`,
          tag: `due-today-${task.id}`,
          requireInteraction: true,
          renotify: true
        });
      });
    }
  }, [dueTodayTasks, hasNotifiedOnEntry, t]);

  // Background Task Alarm Engine (Active while app is running in foreground/background tab)
  useEffect(() => {
    const checkTaskAlarms = () => {
      if (!tasks || tasks.length === 0) return;

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMins}`;

      tasks.forEach(task => {
        if (task.status !== 'pending' || task.autoNotify === false) return;

        const isDueTodayOrOverdue = task.dueDate <= todayStr;
        const remDays = task.reminderDaysBefore ?? 1;
        const targetDate = new Date(task.dueDate);
        targetDate.setDate(targetDate.getDate() - remDays);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        const targetTime = task.dueTime || '09:00';

        if (isDueTodayOrOverdue || (todayStr >= targetDateStr && currentTimeStr >= targetTime)) {
          const triggerKey = `${task.id}_${todayStr}`;
          if (!hasTaskBeenNotified(task.id, triggerKey)) {
            markTaskAsNotified(task.id, triggerKey);
            // Send system notification quietly without repeatedly looping alarm audio in app
            sendSystemNotification(`🚨 ${t('Due Task Reminder', 'আজকের বকেয়া বিল/টাস্ক')}: ${task.title}`, {
              body: `${t('Amount', 'পরিমাণ')}: ${task.amount.toLocaleString()} | ${t('Due', 'তারিখ')}: ${task.dueDate} ${task.dueTime ? formatTime12h(task.dueTime) : ''}`,
              tag: `task-alarm-${task.id}`,
              requireInteraction: true,
              renotify: true
            });
          }
        }
      });
    };

    const timer = setInterval(checkTaskAlarms, 30000);
    return () => clearInterval(timer);
  }, [tasks, t]);

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
      let isSaved = false;
      try {
        const proxyRes = await fetch('/api/sheet-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (proxyRes.ok) {
          const resJson = await proxyRes.json();
          if (resJson && (resJson.result === 'success' || resJson.message)) {
            isSaved = true;
          }
        }
      } catch (err) {
        console.warn('Proxy insert task error:', err);
      }

      if (!isSaved) {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      }

      const qParams = new URLSearchParams({
        action: 'insertTask',
        sheetTab: currentTab,
        id: newTask.id,
        title: newTask.title,
        dueDate: newTask.dueDate,
        dueTime: newTask.dueTime || '09:00',
        amount: String(newTask.amount),
        category: newTask.category,
        priority: newTask.priority,
        notes: newTask.notes || '',
        status: newTask.status,
        reminderDaysBefore: String(newTask.reminderDaysBefore),
        autoNotify: newTask.autoNotify ? 'true' : 'false'
      }).toString();

      fetch(`${GOOGLE_SCRIPT_URL}?${qParams}`, { mode: 'no-cors' }).catch(() => {});

      showToast(lang === 'en' ? 'Task saved & synced to Google Sheet!' : 'টাস্ক সেভ এবং গুগল শিটে যুক্ত হয়েছে!', 'success');
    } catch (err) {
      showToast(lang === 'en' ? 'Task saved locally' : 'টাস্ক লোকালি সেভ হয়েছে', 'info');
    }
  };

  const handleUpdateTask = async (updatedTask: CostTask) => {
    const updated = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    saveTasks(updated);

    const payload = { action: 'updateTask', sheetTab: currentTab, ...updatedTask };

    try {
      let isSaved = false;
      try {
        const proxyRes = await fetch('/api/sheet-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (proxyRes.ok) isSaved = true;
      } catch {}

      if (!isSaved) {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      }

      const qParams = new URLSearchParams({
        action: 'updateTask',
        sheetTab: currentTab,
        id: updatedTask.id,
        title: updatedTask.title,
        dueDate: updatedTask.dueDate,
        dueTime: updatedTask.dueTime || '09:00',
        amount: String(updatedTask.amount),
        category: updatedTask.category,
        priority: updatedTask.priority,
        notes: updatedTask.notes || '',
        status: updatedTask.status,
        reminderDaysBefore: String(updatedTask.reminderDaysBefore),
        autoNotify: updatedTask.autoNotify ? 'true' : 'false'
      }).toString();

      fetch(`${GOOGLE_SCRIPT_URL}?${qParams}`, { mode: 'no-cors' }).catch(() => {});
    } catch {}
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
      let isSaved = false;
      try {
        const proxyRes = await fetch('/api/sheet-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (proxyRes.ok) isSaved = true;
      } catch {}

      if (!isSaved) {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      }

      fetch(`${GOOGLE_SCRIPT_URL}?action=deleteTask&sheetTab=${encodeURIComponent(currentTab)}&id=${encodeURIComponent(taskId)}&title=${encodeURIComponent(taskToDeleteObj?.title || '')}&amount=${taskToDeleteObj?.amount || 0}`, { mode: 'no-cors' }).catch(() => {});

      showToast(lang === 'en' ? 'Task deleted from Google Sheet' : 'টাস্ক গুগল শিট থেকে ডিলিট হয়েছে', 'info');
    } catch {}
  };

  const taskDueCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return tasks.filter(t => t.status === 'pending' && t.dueDate <= todayStr).length;
  }, [tasks]);

  // ----------------------------------------------------
  // 7. VIEW & FILTER STATE
  // ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<AppTab>('summary');
  const [globalFilterMode, setGlobalFilterMode] = useState<'month' | 'all'>('month');

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
    showDueEntryModal,
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
      showDueEntryModal,
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
    showDueEntryModal,
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

    if (modalStateRef.current.showDueEntryModal) {
      setShowDueEntryModal(false);
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
      fetch(`${GOOGLE_SCRIPT_URL}?action=setdefaultmonth&defaultMonth=${encodeURIComponent(defMonthLabel)}`, {
        mode: 'no-cors'
      }).catch(() => {});

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
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
      let isSaved = false;
      try {
        const proxyRes = await fetch('/api/sheet-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (proxyRes.ok) {
          isSaved = true;
        }
      } catch (proxyErr) {
        console.warn('Proxy save error, trying direct POST:', proxyErr);
      }

      if (!isSaved) {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
      }

      fetch(`${GOOGLE_SCRIPT_URL}?action=savebudget&month=${encodeURIComponent(cleanLabel)}&budget=${totalBudget}&sheetTab=${encodeURIComponent(currentTab)}`, {
        mode: 'no-cors'
      }).catch(() => {});

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
    fetch(`${GOOGLE_SCRIPT_URL}?action=setdefaultmonth&defaultMonth=${encodeURIComponent(cleanLabel)}&sheetTab=${encodeURIComponent(currentTab)}`, {
      mode: 'no-cors'
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
  const [lastSyncDate, setLastSyncDate] = useState<Date>(() => new Date());
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => formatSyncDateTime(new Date(), lang));

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
        const proxyRes = await fetch(`/api/sheet-proxy?action=getDetails&sheetTab=${encodeURIComponent(tabToSync)}`);
        data = await proxyRes.json();
      } catch (proxyErr) {
        console.warn('Proxy fetch failed, using direct fetch:', proxyErr);
      }

      if (!data || data.result !== 'success') {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getDetails&sheetTab=${encodeURIComponent(tabToSync)}`);
        data = await res.json();
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
          saveTransactionsLocally(formatted);
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

        const finalExpList = aggregatedExp.length > 0
          ? deduplicateCategories(aggregatedExp)
          : deduplicateCategories([...DEFAULT_EXPENSE_CATEGORIES]);

        const finalIncList = aggregatedInc.length > 0
          ? deduplicateCategories(aggregatedInc)
          : deduplicateCategories([...DEFAULT_INCOME_CATEGORIES]);

        setExpenseCategories(finalExpList);
        try {
          localStorage.setItem(`app_expense_categories_${tabToSync}`, JSON.stringify(finalExpList));
        } catch {}

        setIncomeCategories(finalIncList);
        try {
          localStorage.setItem(`app_income_categories_${tabToSync}`, JSON.stringify(finalIncList));
        } catch {}
        setLastSyncDate(new Date());
        showToast(lang === 'en' ? 'Synced successfully!' : 'সফলভাবে সিঙ্ক হয়েছে!', 'success');
      }
    } catch (err) {
      console.error('Sync Error:', err);
      showToast(lang === 'en' ? 'Sync failed' : 'সিঙ্ক করা সম্ভব হয়নি', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [currentTab, lang, saveTransactionsLocally, showToast]);

  // Initial sync on mount or auth
  useEffect(() => {
    if (isAuthenticated) {
      handleManualSync(currentTab);
    }
  }, [isAuthenticated, currentTab, handleManualSync]);

  const handleSaveTransaction = async (overrideVal?: number) => {
    if (isReadOnly) return;
    const val = typeof overrideVal === 'number' ? overrideVal : Math.abs(evaluateExpression(calcDisplay));
    if (isNaN(val) || val <= 0) return;

    setIsSubmitting(true);
    const newTx: Transaction = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      datetime: formatCleanDateTime(new Date().toString(), 'en'),
      type: entryType,
      category: entryCategory || (entryType === 'Expense' ? (expenseCategories[0] || '') : (incomeCategories[0] || '')),
      date: entryDate,
      value: val,
      note: entryNote.trim()
    };

    saveTransactionsLocally([newTx, ...transactions]);
    playSound('success');

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'insert', sheetTab: currentTab, ...newTx })
      });
    } catch {}

    setCalcDisplay('0');
    setEntryCategory('');
    setEntryNote('');
    setIsSubmitting(false);
    showToast(lang === 'en' ? 'Saved!' : 'সেভ হয়েছে!', 'success');
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

    handleStopRingingAlarm();
    saveTransactionsLocally([newTx, ...transactions]);
    
    // Automatically delete/remove task from task list upon payment
    handleDeleteTask(task.id);
    
    playSound('success');

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'insert', sheetTab: currentTab, ...newTx })
      });
    } catch {}

    showToast(t(`${task.amount.toLocaleString()} paid & removed from tasks!`, `${task.amount.toLocaleString()} খরচে যোগ করা হয়েছে এবং টাস্ক লিস্ট থেকে সরানো হয়েছে!`), 'success');
  };

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    const updatedList = transactions.map(t => (t.id === updatedTx.id ? updatedTx : t));
    saveTransactionsLocally(updatedList);
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'update', sheetTab: currentTab, ...updatedTx })
      });
    } catch {}
    showToast('Updated!', 'success');
  };

  const handleConfirmDelete = async (txToDelete: Transaction) => {
    if (isReadOnly) return;
    setIsDeleting(true);
    saveTransactionsLocally(transactions.filter(t => t.id !== txToDelete.id));
    playSound('delete');
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'delete', sheetTab: currentTab, id: txToDelete.id })
      });
    } catch {}
    setIsDeleting(false);
    setDeletingTx(null);
    showToast('Deleted', 'info');
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

    // Cloud Save: Write new category to Google Sheet (Cols 15-16 / O-P range in currentTab sheet)
    const payload = {
      action: 'addcategory',
      sheetTab: currentTab,
      category: cleanCat,
      type
    };

    try {
      await fetch('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {}

    const qParams = new URLSearchParams({
      action: 'addcategory',
      sheetTab: currentTab,
      category: cleanCat,
      type
    }).toString();
    fetch(`${GOOGLE_SCRIPT_URL}?${qParams}`, { mode: 'no-cors' }).catch(() => {});
  };

  const handleUpdateCategories = (newCats: string[], type: TransactionType) => {
    if (type === 'Expense') setExpenseCategories(newCats);
    else setIncomeCategories(newCats);
    localStorage.setItem(`app_${type.toLowerCase()}_categories_${currentTab}`, JSON.stringify(newCats));
  };

  const handleDeleteCategory = async (cat: string, type: TransactionType) => {
    const updated = (type === 'Expense' ? expenseCategories : incomeCategories).filter(c => c !== cat);
    if (type === 'Expense') setExpenseCategories(updated);
    else setIncomeCategories(updated);
    localStorage.setItem(`app_${type.toLowerCase()}_categories_${currentTab}`, JSON.stringify(updated));

    // Also remove from category budgets in local storage
    try {
      const budgetKey = `app_category_budgets_${currentTab}_${selectedMonth}`;
      const savedBudgets = localStorage.getItem(budgetKey);
      if (savedBudgets) {
        const parsed = JSON.parse(savedBudgets);
        delete parsed[cat];
        const clean = cleanCategoryName(cat, 'en');
        if (clean) delete parsed[clean];
        localStorage.setItem(budgetKey, JSON.stringify(parsed));
      }
    } catch {}

    // Cloud Delete: delete category row from Google Sheet
    try {
      await fetch('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deletecategory',
          sheetTab: currentTab,
          category: cat,
          type
        })
      });
    } catch {}

    fetch(`${GOOGLE_SCRIPT_URL}?action=deletecategory&sheetTab=${encodeURIComponent(currentTab)}&category=${encodeURIComponent(cat)}`, {
      mode: 'no-cors'
    }).catch(() => {});

    showToast(lang === 'en' ? `Category '${cat}' deleted from Google Sheet` : `'${cat}' ক্যাটাগরি গুগল শিট থেকে ডিলিট হয়েছে`, 'info');
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
      setCurrentUser(target);
      setIsAuthenticated(true);
      if (rememberLogin) {
        localStorage.setItem('app_remember_login', 'true');
        localStorage.setItem('active_user_v2', JSON.stringify(target));
      } else {
        localStorage.removeItem('app_remember_login');
        localStorage.removeItem('active_user_v2');
      }
      showToast(lang === 'en' ? `Welcome, ${target.displayName}!` : `স্বাগতম, ${target.displayName}!`, 'success');
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
      allowedTabs: ['summary', 'entry', 'details', 'budget', 'task', 'settings'],
      createdAt: new Date().toISOString().split('T')[0]
    };

    // Purge any old local storage keys for this tab so it starts 100% clean
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.includes(`_${cleanUname}`)) {
          localStorage.removeItem(k);
        }
      });
    } catch {}

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updatedUsers));
    } catch {}

    // Auto-create unified Google Sheet tab for this user and sync user details to abujar287 tab
    try {
      syncUserToSheet(newUser);
      fetch(`${GOOGLE_SCRIPT_URL}?action=createtab&sheetTab=${encodeURIComponent(cleanUname)}`, { mode: 'no-cors' }).catch(() => {});
      fetch('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createtab', sheetTab: cleanUname })
      }).catch(() => {});
    } catch {}

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
        accessTab: (user.allowedTabs || ['summary', 'entry', 'details', 'settings']).join(', ')
      };

      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});

      fetch('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch {}
  };

  const handleSaveProfile = (name: string, pass?: string) => {
    if (!currentUser) return;
    const updated = { ...currentUser, displayName: name, password: pass || currentUser.password };
    setCurrentUser(updated);
    const newUsersList = users.map(u => u.username === updated.username ? updated : u);
    setUsers(newUsersList);
    localStorage.setItem('active_user_v2', JSON.stringify(updated));
    localStorage.setItem('app_registered_users_v2', JSON.stringify(newUsersList));
    syncUserToSheet(updated);
    setEditingUser(null);
  };

  const handleCreateUser = (name: string, uname: string, pass: string, role: UserRole) => {
    const cleanUname = uname.trim().toLowerCase();
    const newUser: AppUser = { 
      username: cleanUname, 
      password: pass, 
      displayName: name, 
      initialUsername: cleanUname, 
      role, 
      sheetTab: cleanUname, 
      isActive: true, 
      allowedTabs: ['summary', 'entry', 'details', 'budget', 'task', 'settings'],
      createdAt: new Date().toISOString().split('T')[0]
    };

    // Purge any old local storage keys for this tab so it starts 100% clean with 0 budgets
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.includes(`_${cleanUname}`)) {
          localStorage.removeItem(k);
        }
      });
    } catch {}

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updatedUsers));
    } catch {}

    // Auto-create unified Google Sheet tab for this user and sync user details to abujar287 tab
    try {
      syncUserToSheet(newUser);
      fetch(`${GOOGLE_SCRIPT_URL}?action=createtab&sheetTab=${encodeURIComponent(cleanUname)}`, { mode: 'no-cors' }).catch(() => {});
      fetch('/api/sheet-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createtab', sheetTab: cleanUname })
      }).catch(() => {});
    } catch {}

    showToast(lang === 'en' ? `User @${cleanUname} created with sheet tab "${cleanUname}"!` : `ইউজার @${cleanUname} ও গুগল শিট ট্যাব "${cleanUname}" তৈরি হয়েছে!`, 'success');
  };

  const handleSwitchUser = (user: AppUser) => {
    setCurrentUser(user);
    localStorage.setItem('active_user_v2', JSON.stringify(user));
  };

  const handleToggleActiveUser = (user: AppUser) => {
    setUsers(users.map(u => u.username === user.username ? { ...u, isActive: !u.isActive } : u));
  };

  const handleConfirmDeleteUser = (user: AppUser) => {
    setUsers(users.filter(u => u.username !== user.username));
    setUserToDelete(null);
  };

  const handleImportJson = (data: any) => {
    if (data && data.transactions) {
      saveTransactionsLocally(data.transactions);
      showToast('Imported!', 'success');
      return true;
    }
    return false;
  };

  const handleUpdateSpreadsheetId = (id: string) => {
    if (currentUser) setCurrentUser({ ...currentUser, spreadsheetId: id });
  };

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
              className="w-full p-3 bg-[#062423] border border-teal-700/70 text-[#F0FDFA] rounded-xl focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 placeholder:text-teal-500 font-medium"
              required
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-3 bg-[#062423] border border-teal-700/70 text-[#F0FDFA] rounded-xl focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 placeholder:text-teal-500 font-medium pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 hover:text-white cursor-pointer"
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
    <div className="fixed inset-0 h-full w-full overflow-hidden bg-[#042F2E] flex flex-col items-center">
      <div className="w-full flex flex-col h-full bg-[#042F2E] relative overflow-hidden">
        
        {toast.show && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#0B3C39] rounded-2xl shadow-xl border border-teal-700 animate-fadeIn text-xs font-bold text-[#F0FDFA]">
            {toast.message}
          </div>
        )}

        <Header
          currentUser={currentUser}
          activeTab={activeTab === 'users' ? 'settings' : activeTab}
          setActiveTab={setActiveTab}
          lastSyncTime={lastSyncTime}
          isSyncing={isSyncing}
          onSync={() => handleManualSync(currentTab)}
          viewMode={viewMode}
          t={t}
          lang={lang}
          selectedMonth={selectedMonth}
          monthMappings={monthMappings}
          taskDueCount={taskDueCount}
        />

        <main id="main-scroll-container" className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 md:p-6 bg-[#042F2E] w-full [overscroll-behavior-y:contain] [-webkit-overflow-scrolling:touch]">
          <div className="w-full max-w-7xl mx-auto space-y-4">
            {/* Active Ringing Alarm Banner */}
          {activeRingingTask && (
            <div className="mb-3 bg-red-600 p-3.5 rounded-xl border-2 border-amber-300 shadow-xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/40 flex items-center justify-center shrink-0">
                  <BellRing className="w-6 h-6 text-amber-200 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-300 text-amber-950 font-black text-[9px] uppercase tracking-wider shadow-sm">
                      Alarm Ringing
                    </span>
                    <span className="text-xs text-white/90">{activeRingingTask.dueDate} ({formatTime12h(activeRingingTask.dueTime)})</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-0.5">
                    {activeRingingTask.title} — {activeRingingTask.amount.toLocaleString()}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleStopRingingAlarm}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-1 cursor-pointer border border-slate-700"
                >
                  <VolumeX className="w-3.5 h-3.5 text-amber-300" />
                  <span>Stop</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleStopRingingAlarm();
                    handleConvertTaskToExpense(activeRingingTask);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-300 hover:bg-amber-200 text-amber-950 font-black text-xs flex items-center gap-1 cursor-pointer shadow-md"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Pay Now</span>
                </button>
              </div>
            </div>
          )}

          {/* Today's Due Task Banner (Visible on entry if tasks are due today) */}
          {!activeRingingTask && dueTodayTasks.length > 0 && (
            <div className="mb-3 bg-[#0B3C39] p-3 rounded-xl border border-teal-700/80 shadow-md text-[#F0FDFA] flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-950 text-amber-300 border border-teal-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-teal-800 text-teal-200 font-bold text-[9px] uppercase tracking-wider">
                      Due Today
                    </span>
                    <span className="text-xs font-semibold text-teal-200">
                      {dueTodayTasks.length} task(s) require payment
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-0.5">
                    {dueTodayTasks[0].title} — {dueTodayTasks[0].amount.toLocaleString()}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeTab !== 'task' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('task')}
                    className="px-3 py-1.5 rounded-lg bg-teal-950 hover:bg-teal-900 text-teal-200 border border-teal-700 font-semibold text-xs cursor-pointer"
                  >
                    View Tasks
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleConvertTaskToExpense(dueTodayTasks[0])}
                  className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-teal-950 font-black text-xs flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Pay Now</span>
                </button>
              </div>
            </div>
          )}

          <div className="w-full">
              {activeTab === 'summary' && (
                <SummaryTab
                  transactions={transactions}
                  filteredTransactions={filteredTransactions}
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

              {activeTab === 'task' && (
                <TaskTab
                  tasks={tasks}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onConvertTaskToExpense={handleConvertTaskToExpense}
                  t={t}
                  showToast={showToast}
                  currentUser={currentUser}
                  categories={expenseCategories}
                  activeRingingTask={activeRingingTask}
                  onStopRingingAlarm={handleStopRingingAlarm}
                />
              )}

              {(activeTab === 'settings' || (activeTab as string) === 'users') && (
                <SettingsTab
                  currentUser={currentUser} expenseCategories={expenseCategories} incomeCategories={incomeCategories}
                  onOpenAddCategoryModal={type => { setCatModalType(type); setShowAddCatModal(true); }}
                  onDeleteCategory={handleDeleteCategory} transactions={transactions}
                  lang={lang} onOpenEditProfile={() => setEditingUser(currentUser)}
                  viewMode={viewMode} onLogout={handleLogout} onImportJson={handleImportJson} t={t}
                  onUpdateSpreadsheetId={handleUpdateSpreadsheetId} onOpenInstallModal={() => setShowMobileModal(true)}
                  selectedMonth={selectedMonth} monthMappings={monthMappings}
                  onAddMonthMapping={m => saveMonthMappings([...monthMappings, m])}
                  onDeleteMonthMapping={id => saveMonthMappings(monthMappings.filter(x => x.id !== id))}
                  onSelectMonth={setSelectedMonth}
                  onSetDefaultMonth={handleSetDefaultMonth}
                  users={users}
                  onOpenCreateUserModal={() => setShowCreateUserModal(true)}
                  onOpenEditUserModal={setEditingUser}
                  onRequestDeleteUser={setUserToDelete}
                  onSwitchUser={handleSwitchUser}
                  onToggleActiveUser={handleToggleActiveUser}
                  onCheckForUpdates={() => handleCheckForUpdates(true)}
                />
              )}
            </div>
          </div>
        </main>

        <nav className="shrink-0 bg-[#042F2E]/95 backdrop-blur-md px-2 sm:px-4 py-1.5 pb-safe flex justify-center items-center shadow-[0_-4px_24px_rgba(4,47,46,0.3)] z-40 w-full min-h-[64px] border-t border-teal-800/60">
          <div className="w-full max-w-3xl lg:max-w-4xl flex items-center justify-around gap-1 sm:gap-2 relative">
            {[
              { id: 'summary' as const, label: 'Summary', icon: BarChart3 },
              { id: 'entry' as const, label: 'Entry', icon: PlusCircle },
              { id: 'details' as const, label: 'Details', icon: ListOrdered },
              { id: 'budget' as const, label: 'Budget', icon: Sliders },
              { id: 'task' as const, label: 'Task', icon: CalendarClock },
              { id: 'settings' as const, label: 'Settings', icon: Settings }
            ].filter(x => allowedTabs.includes(x.id)).map(item => {
              const isActive = activeTab === item.id || (item.id === 'settings' && (activeTab as string) === 'users');
              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setActiveTab(item.id)}
                  className="flex-1 relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl cursor-pointer select-none transition-colors"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-gradient-to-b from-[#0D5F58] to-[#0A4B45] rounded-xl border border-teal-500/40 shadow-sm"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <item.icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 relative z-10 transition-transform duration-200 ${isActive ? 'text-[#F0FDFA] scale-110 drop-shadow-xs' : 'text-teal-300/70 hover:text-teal-200'}`} />
                  <span className={`text-[9.5px] sm:text-[10.5px] font-bold mt-1 tracking-tight leading-none relative z-10 truncate max-w-full ${isActive ? 'text-[#F0FDFA]' : 'text-teal-300/70'}`}>
                    {item.label}
                  </span>
                  {item.id === 'task' && taskDueCount > 0 && (
                    <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#FF7A59] ring-2 ring-[#042F2E] animate-ping" />
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
      <MobileInstallModal isOpen={showMobileModal} onClose={() => setShowMobileModal(false)} isInstallable={isInstallable} onInstall={install} lang={lang} t={t} />
      <EditProfileModal user={editingUser} isOpen={editingUser !== null} onClose={() => setEditingUser(null)} onSave={handleSaveProfile} isAdmin={currentUser?.role === 'super_admin'} lang={lang} t={t} />
      <ExitConfirmModal isOpen={showExitModal} onClose={handleCloseExitModal} onConfirm={handleConfirmExit} lang={lang} t={t} />


      {/* Entrance Due Task Alert Modal (shows automatically when entering app if tasks due today) */}
      {showDueEntryModal && dueTodayTasks.length > 0 && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
            onClick={() => setShowDueEntryModal(false)}
          >
            <div
              className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative border-2 border-[#FF7A59]/80 animate-modalSpring space-y-0 my-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Coral Gradient Header */}
              <div className="bg-gradient-to-r from-[#FF7A59] to-[#E05338] px-5 py-4 text-white flex items-center justify-between border-b border-[#FF7A59]/40">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-6 h-6 text-white animate-bounce shrink-0" />
                  <div>
                    <h2 className="text-base font-black">
                      {t("Today's Due Task Notice!", 'আজকের বকেয়া বিলের নোটিশ!')}
                    </h2>
                    <p className="text-xs text-white/90 font-medium">
                      {dueTodayTasks.length} {t('task(s) due today or overdue', 'টি বিল আজকের দিনে পরিশোধ করতে হবে')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDueEntryModal(false)}
                  className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Task Items List */}
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2.5 divide-y divide-teal-800/40">
                {dueTodayTasks.map(task => (
                  <div key={task.id} className="pt-2.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FF7A59]/20 text-[#FF7A59] border border-[#FF7A59]/40">
                          {task.category}
                        </span>
                        <h4 className="text-sm font-bold text-white truncate">{task.title}</h4>
                      </div>
                      <p className="text-xs text-teal-200 mt-0.5 flex items-center gap-1">
                        <span>{task.dueDate}</span>
                        {task.dueTime && <span className="text-amber-300">({formatTime12h(task.dueTime)})</span>}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-amber-300">
                        {task.amount.toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDueEntryModal(false);
                          handleConvertTaskToExpense(task);
                        }}
                        className="mt-1 px-2.5 py-1 rounded-lg bg-amber-300 hover:bg-amber-200 text-amber-950 font-black text-xs cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <Zap className="w-3 h-3" />
                        <span>{t('Pay Now', 'পরিশোধ')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-teal-950/80 border-t border-teal-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowDueEntryModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-900 text-teal-200 text-xs font-bold border border-teal-700 cursor-pointer"
                >
                  {t('Dismiss', 'পরে দেখব')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDueEntryModal(false);
                    setActiveTab('task');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs cursor-pointer shadow-md"
                >
                  {t('View in Task Tab', 'টাস্ক লিস্টে যান')}
                </button>
              </div>

            </div>
          </div>
        </ModalPortal>
      )}

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
  );
}
