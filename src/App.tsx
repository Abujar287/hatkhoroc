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
  Sliders
} from 'lucide-react';
import { AppUser, Transaction, TransactionType, UserRole, AppTab, MonthMapping } from './types';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  GOOGLE_SCRIPT_URL
} from './constants';
import { normalizeDate, formatSyncDateTime, formatCleanDateTime } from './utils/dateUtils';
import { cleanCategoryName } from './utils/categoryUtils';
import { evaluateExpression } from './utils/calcUtils';

// Modular Components
import { Header } from './components/Header';
import { SummaryTab } from './components/SummaryTab';
import { EntryTab } from './components/EntryTab';
import { DetailsTab } from './components/DetailsTab';
import { BudgetTab } from './components/BudgetTab';
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
  allowedTabs: ['summary', 'entry', 'details', 'budget', 'users', 'settings'],
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
    setIsAppExited(true);
    window.location.href = 'about:blank'; 
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
        tabs = ['summary', 'entry', 'details', 'budget', 'users', 'settings'];
      }
    }
    if (!tabs.includes('budget') && currentUser?.role !== 'super_admin_2') {
      tabs = [...tabs, 'budget'];
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return deduplicateCategories(parsed);
        }
      }
    } catch {}
    return deduplicateCategories([...DEFAULT_EXPENSE_CATEGORIES]);
  });

  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`app_income_categories_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
      if (savedExp) {
        const parsed = JSON.parse(savedExp);
        setExpenseCategories(Array.isArray(parsed) && parsed.length > 0 ? deduplicateCategories(parsed) : deduplicateCategories([...DEFAULT_EXPENSE_CATEGORIES]));
      } else {
        setExpenseCategories(deduplicateCategories([...DEFAULT_EXPENSE_CATEGORIES]));
      }

      const savedInc = localStorage.getItem(`app_income_categories_${currentTab}`);
      if (savedInc) {
        const parsed = JSON.parse(savedInc);
        setIncomeCategories(Array.isArray(parsed) && parsed.length > 0 ? deduplicateCategories(parsed) : deduplicateCategories([...DEFAULT_INCOME_CATEGORIES]));
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
  // 7. VIEW & FILTER STATE
  // ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<AppTab>('summary');
  const [globalFilterMode, setGlobalFilterMode] = useState<'month' | 'all'>('month');

  const [monthMappings, setMonthMappings] = useState<MonthMapping[]>(() => {
    try {
      const saved = localStorage.getItem(`app_month_mappings_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const saveMonthMappings = useCallback((updated: MonthMapping[]) => {
    setMonthMappings(updated);
    try {
      localStorage.setItem(`app_month_mappings_${currentTab}`, JSON.stringify(updated));
    } catch {}
  }, [currentTab]);

  const currentMonthValue = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthValue);

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
    const mapping = monthMappings.find(m => m.label === selectedMonth);
    return transactions.filter(tx => {
      const txDate = normalizeDate(tx.date);
      if (mapping) return txDate >= mapping.startDate && txDate <= mapping.endDate;
      return txDate.startsWith(selectedMonth);
    });
  }, [transactions, globalFilterMode, selectedMonth, monthMappings]);

  // ----------------------------------------------------
  // 9. API & SYNC ACTIONS
  // ----------------------------------------------------
  const handleManualSync = useCallback(async (tabToSync = currentTab) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getDetails&sheetTab=${encodeURIComponent(tabToSync)}`);
      const data = await res.json();
      if (data && data.result === 'success' && Array.isArray(data.transactions)) {
        const formatted: Transaction[] = data.transactions.map((t: any) => ({
          id: String(t.id || Date.now() + Math.random()),
          rowNumber: t.rowNumber || t.row || t.rowIndex,
          datetime: formatCleanDateTime(t.datetime, 'en') || t.datetime || '',
          type: (String(t.type || '').toLowerCase().includes('inc') || String(t.type || '').includes('আয়')) ? 'Income' : 'Expense',
          category: t.category || 'Others',
          date: normalizeDate(t.date),
          value: Math.abs(Number(t.value) || 0),
          note: t.note || ''
        }));
        saveTransactionsLocally(formatted);
        
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          const cloudExp = data.categories.filter((c: any) => String(c.type).toLowerCase() === 'expense').map((c: any) => c.category);
          const cloudInc = data.categories.filter((c: any) => String(c.type).toLowerCase() === 'income').map((c: any) => c.category);
          if (cloudExp.length > 0) {
            setExpenseCategories(deduplicateCategories(cloudExp));
            localStorage.setItem(`app_expense_categories_${tabToSync}`, JSON.stringify(cloudExp));
          }
          if (cloudInc.length > 0) {
            setIncomeCategories(deduplicateCategories(cloudInc));
            localStorage.setItem(`app_income_categories_${tabToSync}`, JSON.stringify(cloudInc));
          }
        }
        setLastSyncDate(new Date());
        showToast(lang === 'en' ? 'Synced successfully!' : 'সফলভাবে সিঙ্ক হয়েছে!', 'success');
      }
    } catch {
      showToast(lang === 'en' ? 'Sync failed' : 'সিঙ্ক করা সম্ভব হয়নি', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [currentTab, lang, saveTransactionsLocally, showToast]);

  const handleSaveTransaction = async (overrideVal?: number) => {
    if (isReadOnly) return;
    const val = typeof overrideVal === 'number' ? overrideVal : Math.abs(evaluateExpression(calcDisplay));
    if (isNaN(val) || val <= 0) return;

    setIsSubmitting(true);
    const newTx: Transaction = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      datetime: formatCleanDateTime(new Date().toString(), 'en'),
      type: entryType,
      category: entryCategory || 'Others',
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
    setEntryNote('');
    setIsSubmitting(false);
    showToast(lang === 'en' ? 'Saved!' : 'সেভ হয়েছে!', 'success');
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
  const [entryCategory, setEntryCategory] = useState<string>(() => expenseCategories[0] || 'Others');
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

  const handleDeleteCategory = (cat: string, type: TransactionType) => {
    const updated = (type === 'Expense' ? expenseCategories : incomeCategories).filter(c => c !== cat);
    if (type === 'Expense') setExpenseCategories(updated);
    else setIncomeCategories(updated);
    localStorage.setItem(`app_${type.toLowerCase()}_categories_${currentTab}`, JSON.stringify(updated));
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl text-[#0F172A]">
          <div className="text-center mb-6">
            <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto mb-3 rounded-2xl shadow-sm" />
            <h1 className="text-2xl font-bold">HisabKitab</h1>
          </div>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="Username" className="w-full p-3 border rounded-xl" required />
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" className="w-full p-3 border rounded-xl" required />
            {loginError && <p className="text-rose-500 text-xs">{loginError}</p>}
            <button type="submit" className="w-full py-3 bg-[#475569] text-white rounded-xl font-bold">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: APP
  // ----------------------------------------------------
  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#F8FAFC] flex flex-col items-center">
      <div className={`w-full flex flex-col h-dvh bg-[#F8FAFC] relative ${viewMode === 'mobile' ? 'max-w-[430px] border-x border-slate-200' : 'max-w-6xl'}`}>
        
        {toast.show && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-white rounded-2xl shadow-xl border animate-fadeIn text-xs font-bold">
            {toast.message}
          </div>
        )}

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
        />

        <main className="flex-1 overflow-y-auto p-3">
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
              expenseCategories={expenseCategories} transactions={transactions}
              selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
              lang={lang} t={t} currentTab={currentTab} monthMappings={monthMappings}
            />
          )}

          {activeTab === 'users' && (
            <UsersTab
              users={users} currentUser={currentUser}
              onOpenCreateModal={() => setShowCreateUserModal(true)}
              onOpenEditModal={setEditingUser}
              onRequestDeleteUser={setUserToDelete}
              onSwitchUser={handleSwitchUser} onToggleActiveUser={handleToggleActiveUser}
              lang={lang} t={t}
            />
          )}

          {activeTab === 'settings' && (
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
            />
          )}
        </main>

        <nav className="bg-white border-t p-2 flex justify-around shadow-sm shrink-0">
          {[
            { id: 'summary' as const, label: 'Summary', icon: BarChart3 },
            { id: 'entry' as const, label: 'Entry', icon: PlusCircle },
            { id: 'details' as const, label: 'Details', icon: ListOrdered },
            { id: 'budget' as const, label: 'Budget', icon: Sliders },
            { id: 'settings' as const, label: 'Settings', icon: Settings }
          ].filter(x => allowedTabs.includes(x.id)).map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex-1 flex flex-col items-center py-2 rounded-xl ${activeTab === item.id ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] mt-1">{item.label}</span>
            </button>
          ))}
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
        <div className="fixed inset-0 z-[999] bg-white flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <Lock className="w-12 h-12 text-slate-400 mb-4" />
          <h2 className="text-xl font-bold">Closed</h2>
          <p className="text-slate-500 mb-6">You can close this tab now.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-700 text-white rounded-xl">Reopen</button>
        </div>
      )}
    </div>
  );
}
