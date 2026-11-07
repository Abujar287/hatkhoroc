import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
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
  CalendarClock
} from 'lucide-react';
import { AppUser, Transaction, TransactionType, UserRole, AppTab, MonthMapping, CostTask } from './types';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  GOOGLE_SCRIPT_URL
} from './constants';
import {
  normalizeDate,
  formatSyncDateTime,
  formatCleanDateTime,
  cleanMappingLabel,
  getMonthKeyFromLabel,
  findMonthMapping
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
import { UsersTab } from './components/UsersTab';
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
  ExitConfirmModal
} from './components/Modals';
import { usePWAInstall } from './usePWAInstall';
import { initAuth, googleSignIn, logout as firebaseLogout } from './lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';


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
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // ----------------------------------------------------
  // 1. FUNDAMENTAL STATE
  // ----------------------------------------------------
  const [lang] = useState<'en'>('en');
  const t = useCallback((en: string, _bn?: string) => en, []);
  
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>(() => {
    return window.innerWidth < 768 ? 'mobile' : 'desktop';
  });

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
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // ----------------------------------------------------
  // 2. BACK BUTTON EXIT LOGIC (Robust Interception)
  // ----------------------------------------------------
  // Moved up so it has access to the above modal states but defined after they exist
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('active_user_v2');
      return saved !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    const pushGuardState = () => {
      if (window.history.state?.exitGuard !== true) {
        window.history.pushState({ exitGuard: true }, '');
      }
    };

    pushGuardState();

    const handlePopState = (event: PopStateEvent) => {
      pushGuardState();
      
      if (document.querySelector('[data-calc-modal="true"]')) {
        window.dispatchEvent(new CustomEvent('close-calc-modal'));
        return;
      }
      if (selectedDateModal) {
        setSelectedDateModal(null);
        return;
      }
      if (editingTx) {
        setEditingTx(null);
        return;
      }
      if (deletingTx) {
        setDeletingTx(null);
        return;
      }
      if (showAddCatModal) {
        setShowAddCatModal(false);
        return;
      }
      if (showCategoryManager) {
        setShowCategoryManager(false);
        return;
      }
      if (showCreateUserModal) {
        setShowCreateUserModal(false);
        return;
      }
      if (editingUser) {
        setEditingUser(null);
        return;
      }

      setShowExitModal(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isAppExited && isAuthenticated) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to exit?';
        return 'Are you sure you want to exit?';
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    const interval = setInterval(pushGuardState, 1000);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
    };
  }, [
    isAppExited, 
    isAuthenticated, 
    selectedDateModal, 
    editingTx, 
    deletingTx, 
    showAddCatModal, 
    showCategoryManager,
    showCreateUserModal,
    editingUser
  ]);

  const handleCloseExitModal = () => {
    setShowExitModal(false);
    if (window.history.state?.exitGuard !== true) {
      window.history.pushState({ exitGuard: true }, '');
    }
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    setIsAppExited(true);
    try {
      if ((window as any).navigator?.app?.exitApp) {
        (window as any).navigator.app.exitApp();
      }
    } catch {}
    try {
      window.close();
    } catch {}
    try {
      window.history.back();
    } catch {}
  };

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
            let tabs = u.allowedTabs || ['summary', 'entry', 'details', 'budget', 'users', 'settings'];
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
      const saved = localStorage.getItem('active_user_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username) {
          let tabs = parsed.allowedTabs || ['summary', 'entry', 'details', 'budget', 'users', 'settings'];
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
      } else {
        tabs = ['summary', 'entry', 'details', 'budget', 'task', 'users', 'settings'];
      }
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
        if (Array.isArray(parsed)) setExpenseCategories(deduplicateCategories(parsed));
      }

      const savedInc = localStorage.getItem(`app_income_categories_${currentTab}`);
      if (savedInc !== null) {
        const parsed = JSON.parse(savedInc);
        if (Array.isArray(parsed)) setIncomeCategories(deduplicateCategories(parsed));
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
    // Initial sample tasks
    return [
      {
        id: 'task_sample_1',
        title: 'বিদ্যুৎ বিল (Electricity Bill)',
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        dueTime: '10:00',
        amount: 1450,
        category: 'Bills',
        priority: 'high',
        notes: 'Pay via Bkash / Nagad',
        status: 'pending',
        reminderDaysBefore: 1,
        autoNotify: true,
        createdBy: currentTab,
        createdAt: new Date().toISOString()
      },
      {
        id: 'task_sample_2',
        title: 'বাসা ভাড়া (House Rent)',
        dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
        dueTime: '09:00',
        amount: 15000,
        category: 'House',
        priority: 'high',
        notes: 'Monthly house rent to landlord',
        status: 'pending',
        reminderDaysBefore: 2,
        autoNotify: true,
        createdBy: currentTab,
        createdAt: new Date().toISOString()
      }
    ];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`app_tasks_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setTasks(parsed);
      }
    } catch {}
  }, [currentTab]);

  const saveTasks = useCallback((updated: CostTask[]) => {
    setTasks(updated);
    try {
      localStorage.setItem(`app_tasks_${currentTab}`, JSON.stringify(updated));
    } catch {}
  }, [currentTab]);

  const handleAddTask = async (newTaskData: Omit<CostTask, 'id' | 'createdAt'>) => {
    const newTask: CostTask = {
      ...newTaskData,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
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
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      const savedMappings = localStorage.getItem(`app_month_mappings_${currentTab}`);
      if (savedMappings) {
        const parsed = JSON.parse(savedMappings);
        if (Array.isArray(parsed)) {
          const defMap = parsed.find((m: any) => m.isDefault || String(m['default month'] || m.isDefault).toLowerCase() === 'default');
          if (defMap && defMap.label) return defMap.label;
        }
      }
    } catch {}

    try {
      const savedDefault = localStorage.getItem(`app_default_selected_month_${currentTab}`);
      if (savedDefault) return savedDefault;
    } catch {}

    try {
      const savedMappings = localStorage.getItem(`app_month_mappings_${currentTab}`);
      if (savedMappings) {
        const parsed = JSON.parse(savedMappings);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].label) {
          return parsed[0].label;
        }
      }
    } catch {}

    return currentMonthValue;
  });

  useEffect(() => {
    try {
      if (selectedMonth) {
        localStorage.setItem(`app_default_selected_month_${currentTab}`, selectedMonth);
      }
    } catch {}
  }, [selectedMonth, currentTab]);

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
          const formatted: Transaction[] = data.transactions.map((t: any) => ({
            id: String(t.id || Date.now() + Math.random()),
            rowNumber: t.rowNumber || t.row || t.rowIndex,
            datetime: formatCleanDateTime(t.datetime, 'en') || t.datetime || '',
            type: (String(t.type || '').toLowerCase().includes('inc') || String(t.type || '').includes('আয়')) ? 'Income' : 'Expense',
            category: t.category || '',
            date: normalizeDate(t.date),
            value: Math.abs(Number(t.value) || 0),
            note: t.note || ''
          }));
          saveTransactionsLocally(formatted);
        }
        
        if (Array.isArray(data.tasks)) {
          const cloudTasks: CostTask[] = data.tasks.map((t: any) => ({
            id: String(t.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
            title: String(t.title || t.Title || ''),
            dueDate: normalizeDate(t.dueDate || t['Due Date'] || new Date().toISOString().split('T')[0]),
            dueTime: String(t.dueTime || t['Due Time'] || '09:00'),
            amount: Number(t.amount || t.Amount || 0),
            category: String(t.category || t.Category || 'General'),
            priority: (String(t.priority || t.Priority || 'medium').toLowerCase() as any),
            notes: String(t.notes || t.Notes || ''),
            status: (String(t.status || t.Status || t.action || 'pending').toLowerCase() as any),
            reminderDaysBefore: Number(t.reminderDaysBefore || t['Reminder Days'] || 1),
            autoNotify: t.autoNotify === true || String(t.autoNotify).toLowerCase() === 'true' || String(t.autoNotify).toLowerCase() === 'yes',
            createdBy: String(t.createdBy || t['Created By'] || tabToSync),
            createdAt: String(t.createdAt || t['Created At'] || new Date().toISOString())
          })).filter((t: CostTask) => Boolean(t.title));

          if (cloudTasks.length > 0) {
            saveTasks(cloudTasks);
          }
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

        const knownIncomeWords = ['salary', 'arrear', 'borrowed money', 'borrowed', 'bonus', 'business', 'other income', 'others income', 'income', 'previous month arrears', 'বেতন', 'বকেয়া', 'ধার নেওয়া', 'ব্যবসা', 'বোনাস', 'আয়', 'আয়'];
        const isIncomeCat = (catName: string) => {
          const clean = cleanCategoryName(catName, 'en').toLowerCase().trim();
          if (clean === 'loan repaid' || clean === 'others expense' || clean === "family's cost") return false;
          return knownIncomeWords.some(w => clean === w);
        };

        // Load categories EXCLUSIVELY from Google Sheet's Category tab (data.categories)
        const aggregatedExp: string[] = [];
        const aggregatedInc: string[] = [];

        if (Array.isArray(data.categories) && data.categories.length > 0) {
          data.categories.forEach((c: any) => {
            if (typeof c === 'string' && c.trim()) {
              const str = c.trim();
              if (isIncomeCat(str)) aggregatedInc.push(str);
              else aggregatedExp.push(str);
            } else if (typeof c === 'object' && c !== null) {
              const catName = String(c.category || c.Category || c.name || c.Name || c.cName || '').trim();
              const rawType = String(c.type || c.Type || c.cType || '').toLowerCase().trim();

              if (catName) {
                if (rawType.includes('exp') || rawType.includes('খরচ') || rawType === 'expense') {
                  aggregatedExp.push(catName);
                } else if (rawType.includes('inc') || rawType.includes('আয়') || rawType === 'income') {
                  aggregatedInc.push(catName);
                } else if (isIncomeCat(catName)) {
                  aggregatedInc.push(catName);
                } else {
                  aggregatedExp.push(catName);
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

        const finalExpList = deduplicateCategories(aggregatedExp);
        const finalIncList = deduplicateCategories(aggregatedInc);

        if (finalExpList.length > 0) {
          setExpenseCategories(finalExpList);
          try {
            localStorage.setItem(`app_expense_categories_${tabToSync}`, JSON.stringify(finalExpList));
          } catch {}
        }
        if (finalIncList.length > 0) {
          setIncomeCategories(finalIncList);
          try {
            localStorage.setItem(`app_income_categories_${tabToSync}`, JSON.stringify(finalIncList));
          } catch {}
        }
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

    saveTransactionsLocally([newTx, ...transactions]);
    handleUpdateTask({ ...task, status: 'completed' });
    playSound('success');

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'insert', sheetTab: currentTab, ...newTx })
      });
    } catch {}

    showToast(t(`৳${task.amount} paid & added to expenses!`, `৳${task.amount} খরচে যোগ করা হয়েছে!`), 'success');
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

  const handleAddCategory = (newCat: string, type: TransactionType) => {
    const updated = type === 'Expense' ? [...expenseCategories, newCat] : [...incomeCategories, newCat];
    if (type === 'Expense') setExpenseCategories(deduplicateCategories(updated));
    else setIncomeCategories(deduplicateCategories(updated));
    localStorage.setItem(`app_${type.toLowerCase()}_categories_${currentTab}`, JSON.stringify(updated));
    showToast('Category Added', 'success');
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
    const target = users.find(u => u.username.toLowerCase() === loginUsername.toLowerCase());
    if (target && target.password === loginPassword) {
      setCurrentUser(target);
      setIsAuthenticated(true);
      localStorage.setItem('active_user_v2', JSON.stringify(target));
      showToast('Welcome!', 'success');
    } else {
      setLoginError('Invalid credentials');
    }
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('active_user_v2');
  };

  const handleSaveProfile = (name: string, pass?: string) => {
    if (!currentUser) return;
    const updated = { ...currentUser, displayName: name, password: pass || currentUser.password };
    setCurrentUser(updated);
    setUsers(users.map(u => u.username === updated.username ? updated : u));
    localStorage.setItem('active_user_v2', JSON.stringify(updated));
    setEditingUser(null);
  };

  const handleCreateUser = (name: string, uname: string, pass: string, role: UserRole) => {
    const newUser: AppUser = { 
      username: uname, 
      password: pass, 
      displayName: name, 
      initialUsername: uname, 
      role, 
      sheetTab: uname, 
      isActive: true, 
      allowedTabs: ['summary', 'entry', 'details', 'budget'],
      createdAt: new Date().toISOString().split('T')[0]
    };
    setUsers([...users, newUser]);
    showToast('User Created', 'success');
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
            <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="Username" className="w-full p-3 bg-[#062423] border border-teal-700/70 text-[#F0FDFA] rounded-xl focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 placeholder:text-teal-500 font-medium" required />
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" className="w-full p-3 bg-[#062423] border border-teal-700/70 text-[#F0FDFA] rounded-xl focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 placeholder:text-teal-500 font-medium" required />
            {loginError && <p className="text-rose-400 text-xs">{loginError}</p>}
            <button type="submit" className="w-full py-3 bg-[#0D9488] hover:bg-[#0F766E] text-[#F0FDFA] rounded-xl font-bold cursor-pointer transition-colors shadow-md text-sm">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: APP
  // ----------------------------------------------------
  return (
    <div className="fixed inset-0 h-full w-full overflow-hidden bg-[#042F2E] flex flex-col items-center">
      <div className={`w-full flex flex-col h-full bg-[#042F2E] relative overflow-hidden ${viewMode === 'mobile' ? 'max-w-[430px] shadow-2xl' : 'max-w-6xl'}`}>
        
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

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 bg-[#042F2E]">
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
            />
          )}
        </main>

        <nav className="shrink-0 bg-[#042F2E]/95 backdrop-blur-md px-2 py-2 pb-safe flex justify-around items-center shadow-[0_-4px_24px_rgba(4,47,46,0.3)] z-40 w-full min-h-[64px] gap-1 sm:gap-2">
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
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 animated-nav-btn ${isActive ? 'active' : 'inactive'} cursor-pointer relative`}
              >
                {isActive ? (
                  <div className="animated-nav-inner">
                    <item.icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-[#F0FDFA] drop-shadow-xs" />
                    <span className="text-[9.5px] sm:text-[10.5px] font-bold mt-1 tracking-tight leading-none text-[#F0FDFA] truncate max-w-full">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-full py-1 relative">
                    <item.icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-teal-300/70 group-hover:text-[#14B8A6] transition-colors" />
                    <span className="text-[9.5px] sm:text-[10.5px] font-semibold mt-1 tracking-tight leading-none text-teal-200/80 truncate max-w-full">
                      {item.label}
                    </span>
                    {item.id === 'task' && taskDueCount > 0 && (
                      <span className="absolute -top-1 right-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
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
