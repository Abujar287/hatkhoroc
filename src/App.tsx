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
import { AppUser, Transaction, TransactionType, UserRole, AppTab } from './types';
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
  // 1. LANGUAGE & LOCALIZATION STATE (Default: English)
  // ----------------------------------------------------
  const [lang] = useState<'en'>('en');

  const toggleLanguage = () => {};

  const t = useCallback((en: string, _bn?: string) => en, []);

  // ----------------------------------------------------
  // VIEW MODE STATE (Automatic based on window width)
  // ----------------------------------------------------
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>(() => {
    return window.innerWidth < 768 ? 'mobile' : 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ----------------------------------------------------
  // 2. TOAST NOTIFICATION STATE
  // ----------------------------------------------------
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success'
  });
  
  const { isInstallable, install, isInstalled } = usePWAInstall();
  const [hasPromptedInstall, setHasPromptedInstall] = useState(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [isAppExited, setIsAppExited] = useState<boolean>(false);

  useEffect(() => {
    if (isInstallable && !isInstalled && !hasPromptedInstall) {
      // Small delay to ensure the app is fully loaded and user can see it
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

  // ----------------------------------------------------
  // BACK BUTTON EXIT LOGIC (Strict Interception)
  // ----------------------------------------------------
  useEffect(() => {
    // Initial dummy state to give the user something to go "back" from
    window.history.pushState({ exitGuard: true }, '');

    const handlePopState = (event: PopStateEvent) => {
      // User pressed back! 
      // 1. Immediately push the state back to "trap" them on the page
      window.history.pushState({ exitGuard: true }, '');
      
      // 2. Show the exit confirmation modal
      setShowExitModal(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => currentUser !== null);

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
  // 5. ISOLATED CATEGORIES STATE WITH DEDUPLICATION
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

  // Monthly Budget State
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`app_monthly_budget_${currentTab}`);
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });

  // Reload categories & budget on user switch
  useEffect(() => {
    try {
      const savedExp = localStorage.getItem(`app_expense_categories_${currentTab}`);
      if (savedExp) {
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
      if (savedInc) {
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

  const handleSaveMonthlyBudget = async (budget: number) => {
    setMonthlyBudget(budget);
    try {
      localStorage.setItem(`app_monthly_budget_${currentTab}`, String(budget));
      
      // Save to Google Sheets if connected
      if (googleAccessToken && currentUser?.spreadsheetId) {
        await saveBudgetToGoogleSheet(currentUser.spreadsheetId, budget);
      }
    } catch {}
    showToast(lang === 'en' ? 'Monthly budget updated!' : 'মাসিক বাজেট আপডেট হয়েছে!', 'success');
  };

  const saveBudgetToGoogleSheet = async (spreadsheetId: string, budget: number) => {
    if (!googleAccessToken) return;

    try {
      const sheetName = 'budget';
      
      // 1. Try to create the sheet first (it might already exist, which will error)
      try {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: sheetName }
              }
            }]
          })
        });
      } catch (e) {
        // Sheet likely already exists
      }

      // 2. Clear and write header if it's potentially new, or just append/update.
      // For simplicity, we'll maintain a list: [Month, Budget]
      // Check if entry for current month exists
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:B`, {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
      });
      const data = await response.json();
      const rows = data.values || [];
      
      const currentMonth = selectedMonth; // e.g., "2026-10"
      let foundIndex = -1;
      
      if (rows.length === 0) {
        // Add header
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:B1?valueInputOption=RAW`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [['Month', 'Budget']] })
        });
      } else {
        foundIndex = rows.findIndex((r: string[]) => r[0] === currentMonth);
      }

      if (foundIndex !== -1) {
        // Update existing row
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!B${foundIndex + 1}?valueInputOption=RAW`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [[budget]] })
        });
      } else {
        // Append new row
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:B:append?valueInputOption=RAW`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [[currentMonth, budget]] })
        });
      }
      
      showToast('Budget synced to Google Sheet!', 'success');
    } catch (error) {
      console.error('Failed to save budget to Google Sheets:', error);
      showToast('Failed to sync budget to Google Sheets', 'error');
    }
  };

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

  // Sync transactions on user switch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`app_transactions_${currentTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setTransactions(parsed);
        else setTransactions([]);
      } else {
        setTransactions([]);
      }
    } catch {}
  }, [currentTab]);

  // Persist transactions locally
  const saveTransactionsLocally = useCallback((updated: Transaction[]) => {
    setTransactions(updated);
    try {
      localStorage.setItem(`app_transactions_${currentTab}`, JSON.stringify(updated));
    } catch {}
  }, [currentTab]);

  // ----------------------------------------------------
  // 7. ACTIVE VIEW TAB
  // ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<AppTab>('summary');

  // Enforce allowed tabs for currentUser
  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] || 'summary');
    }
  }, [allowedTabs, activeTab]);

  const [globalFilterMode, setGlobalFilterMode] = useState<'month' | 'all'>('month');

  // Selected Month (YYYY-MM)
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

  // Derived filtered transactions based on global filter mode
  const filteredTransactions = useMemo(() => {
    if (globalFilterMode === 'all') return transactions;
    
    // Filter by selectedMonth (YYYY-MM)
    return transactions.filter(tx => {
      const txDate = normalizeDate(tx.date);
      return txDate.startsWith(selectedMonth);
    });
  }, [transactions, globalFilterMode, selectedMonth]);

  // Manual Cloud Sync Function
  const handleManualSync = useCallback(async (tabToSync = currentTab) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getDetails&sheetTab=${encodeURIComponent(tabToSync)}`, {
        method: 'GET'
      });
      const data = await res.json();
      if (data && data.result === 'success' && Array.isArray(data.transactions)) {
        const formatted: Transaction[] = data.transactions.map((t: any) => {
          const rawType = String(t.type || '').trim().toLowerCase();
          const isIncome =
            rawType === 'income' ||
            rawType === 'income ' ||
            rawType === 'আয়' ||
            rawType === 'আয়' ||
            rawType === 'inc' ||
            (rawType === '' && Number(t.value) > 0);
          const txType: TransactionType = isIncome ? 'Income' : 'Expense';

          return {
            id: String(t.id || Date.now() + Math.random()),
            rowNumber: t.rowNumber || t.row || t.rowIndex,
            datetime: formatCleanDateTime(t.datetime, 'en') || t.datetime || '',
            type: txType,
            category: t.category || 'Others',
            date: normalizeDate(t.date),
            value: Math.abs(Number(t.value) || 0),
            note: t.note || ''
          };
        });
        saveTransactionsLocally(formatted);

        // Sync categories from Google Sheet Category tab if available
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          const cloudExp = data.categories.filter((c: any) => String(c.type).toLowerCase() === 'expense').map((c: any) => c.category);
          const cloudInc = data.categories.filter((c: any) => String(c.type).toLowerCase() === 'income').map((c: any) => c.category);

          if (cloudExp.length > 0) {
            const cleanExp = deduplicateCategories(cloudExp);
            setExpenseCategories(cleanExp);
            try {
              localStorage.setItem(`app_expense_categories_${tabToSync}`, JSON.stringify(cleanExp));
            } catch {}
          }
          if (cloudInc.length > 0) {
            const cleanInc = deduplicateCategories(cloudInc);
            setIncomeCategories(cleanInc);
            try {
              localStorage.setItem(`app_income_categories_${tabToSync}`, JSON.stringify(cleanInc));
            } catch {}
          }
        } else {
          // Fallback to auto-discovery if Category tab is empty
          const sheetExpCats: string[] = [];
          const sheetIncCats: string[] = [];
          data.transactions.forEach((tx: any) => {
            if (!tx.category) return;
            const rType = String(tx.type || '').trim().toLowerCase();
            const isInc = rType === 'income' || rType === 'আয়' || rType === 'আয়' || rType === 'inc';
            if (isInc) sheetIncCats.push(tx.category);
            else sheetExpCats.push(tx.category);
          });

          if (sheetExpCats.length > 0) {
            setExpenseCategories(prev => {
              const merged = deduplicateCategories([...prev, ...sheetExpCats]);
              try {
                localStorage.setItem(`app_expense_categories_${tabToSync}`, JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }

          if (sheetIncCats.length > 0) {
            setIncomeCategories(prev => {
              const merged = deduplicateCategories([...prev, ...sheetIncCats]);
              try {
                localStorage.setItem(`app_income_categories_${tabToSync}`, JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        }

        setLastSyncDate(new Date());
        showToast(
          lang === 'en'
            ? `Synced ${formatted.length} transactions from cloud!`
            : `ক্লাউড থেকে ${formatted.length}টি লেনদেন সফলভাবে সিঙ্ক হয়েছে!`,
          'success'
        );
      } else {
        showToast(lang === 'en' ? 'Sync finished' : 'সিঙ্ক সম্পন্ন হয়েছে', 'info');
      }
    } catch (err) {
      showToast(lang === 'en' ? 'Cloud connection failed' : 'ক্লাউড কানেকশন পাওয়া যায়নি', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [currentTab, lang, saveTransactionsLocally, showToast]);

  // Import JSON backup handler
  const handleImportJson = useCallback((importedData: any) => {
    try {
      let txsToImport: any[] = [];
      let expCats: string[] | undefined;
      let incCats: string[] | undefined;

      if (Array.isArray(importedData)) {
        txsToImport = importedData;
      } else if (importedData && typeof importedData === 'object') {
        if (Array.isArray(importedData.transactions)) {
          txsToImport = importedData.transactions;
        }
        if (Array.isArray(importedData.expenseCategories)) {
          expCats = importedData.expenseCategories;
        }
        if (Array.isArray(importedData.incomeCategories)) {
          incCats = importedData.incomeCategories;
        }
      }

      if (!Array.isArray(txsToImport) || txsToImport.length === 0) {
        showToast(
          lang === 'en'
            ? 'No valid transactions found in JSON file!'
            : 'JSON ফাইলে কোনো লেনদেন পাওয়া যায়নি!',
          'error'
        );
        return false;
      }

      // Format & validate imported records
      const cleanTxs: Transaction[] = txsToImport.map((t: any, idx: number) => {
        const val = Math.abs(Number(t.value) || 0);
        const type: TransactionType = t.type === 'Income' ? 'Income' : 'Expense';
        const date = normalizeDate(t.date || new Date().toISOString().split('T')[0]);
        return {
          id: String(t.id || Date.now() + idx),
          type,
          category: String(t.category || (type === 'Income' ? '💰 Salary' : '🍔 Food')),
          value: val,
          date,
          note: String(t.note || ''),
          datetime: t.datetime || new Date().toISOString()
        };
      });

      saveTransactionsLocally(cleanTxs);

      if (expCats && expCats.length > 0) {
        setExpenseCategories(prev => {
          const merged = deduplicateCategories([...prev, ...expCats!]);
          try {
            localStorage.setItem(`app_expense_categories_${currentTab}`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      if (incCats && incCats.length > 0) {
        setIncomeCategories(prev => {
          const merged = deduplicateCategories([...prev, ...incCats!]);
          try {
            localStorage.setItem(`app_income_categories_${currentTab}`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      showToast(
        lang === 'en'
          ? `Successfully imported ${cleanTxs.length} transactions!`
          : `সফলভাবে ${cleanTxs.length}টি হিসাব ইম্পোর্ট হয়েছে!`,
        'success'
      );
      return true;
    } catch (err) {
      showToast(
        lang === 'en' ? 'Failed to parse JSON file' : 'JSON ফাইল লোড করতে সমস্যা হয়েছে',
        'error'
      );
      return false;
    }
  }, [lang, currentTab, saveTransactionsLocally, showToast]);

  // Initial auto sync on login
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      handleManualSync(currentTab);
    }
  }, [isAuthenticated, currentUser?.username]);

  // ----------------------------------------------------
  // 9. ADD ENTRY STATE
  // ----------------------------------------------------
  const [entryType, setEntryType] = useState<TransactionType>('Expense');
  const [entryCategory, setEntryCategory] = useState<string>(() => expenseCategories[0] || 'Others');
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [entryNote, setEntryNote] = useState<string>('');
  const [calcDisplay, setCalcDisplay] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Submit new transaction with SINGLE DISPATCH (avoids double entry!)
  const handleSaveTransaction = async (overrideVal?: number) => {
    if (isReadOnly) {
      showToast(lang === 'en' ? 'Account is read-only!' : 'এই অ্যাকাউন্ট শুধুমাত্র পড়ার জন্য!', 'error');
      return;
    }

    const val = typeof overrideVal === 'number' && !isNaN(overrideVal)
      ? Math.abs(overrideVal)
      : Math.abs(evaluateExpression(calcDisplay));

    if (isNaN(val) || val <= 0) {
      showToast(lang === 'en' ? 'Please enter a valid amount!' : 'সঠিক টাকার পরিমাণ দিন!', 'error');
      return;
    }

    setIsSubmitting(true);
    const newTx: Transaction = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      datetime: formatCleanDateTime(new Date().toString(), 'en'),
      type: entryType,
      category: entryCategory || (entryType === 'Expense' ? 'Others' : 'Other Income'),
      date: entryDate,
      value: val,
      note: entryNote.trim()
    };

    // Update local state immediately
    const updated = [newTx, ...transactions];
    saveTransactionsLocally(updated);
    playSound('success');

    // Single dispatch POST to Google Apps Script
    try {
      const payload = {
        action: 'insert',
        sheetTab: currentTab,
        id: newTx.id,
        datetime: newTx.datetime,
        type: newTx.type,
        category: newTx.category,
        date: newTx.date,
        value: newTx.value,
        note: newTx.note
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch {
      // Offline fallback: already saved locally
    }

    // Reset keypad and note
    setCalcDisplay('0');
    setEntryNote('');
    setIsSubmitting(false);
    showToast(
      lang === 'en' ? 'Transaction saved & synced successfully!' : 'লেনদেনটি সফলভাবে সেভ হয়েছে!',
      'success'
    );
  };

  // ----------------------------------------------------
  // 10. EDIT & DELETE ACTIONS
  // ----------------------------------------------------
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    const updatedList = transactions.map(t => (t.id === updatedTx.id ? updatedTx : t));
    saveTransactionsLocally(updatedList);
    playSound('success');

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'update',
          sheetTab: currentTab,
          ...updatedTx
        })
      });
    } catch {}

    showToast(lang === 'en' ? 'Transaction updated!' : 'লেনদেন আপডেট হয়েছে!', 'success');
  };

  const handleConfirmDelete = async (txToDelete: Transaction) => {
    if (isReadOnly) {
      showToast(lang === 'en' ? 'Cannot delete in read-only mode!' : 'শুধুমাত্র পড়ার সুবিধা, মোছা যাবে না!', 'error');
      setDeletingTx(null);
      return;
    }

    setIsDeleting(true);
    const updatedList = transactions.filter(t => t.id !== txToDelete.id);
    saveTransactionsLocally(updatedList);
    playSound('delete');

    try {
      const payload = {
        action: 'delete',
        sheetTab: currentTab,
        id: txToDelete.id,
        rowNumber: txToDelete.rowNumber,
        row: txToDelete.rowNumber,
        rowIndex: txToDelete.rowNumber,
        datetime: txToDelete.datetime,
        date: txToDelete.date,
        type: txToDelete.type,
        category: txToDelete.category,
        value: txToDelete.value,
        note: txToDelete.note
      };

      // 1. Dual-method dispatch: GET with query params (many Apps Scripts handle doGet for delete)
      const deleteUrl = `${GOOGLE_SCRIPT_URL}?action=delete&sheetTab=${encodeURIComponent(currentTab)}&id=${encodeURIComponent(txToDelete.id)}&rowNumber=${txToDelete.rowNumber || ''}&row=${txToDelete.rowNumber || ''}&rowIndex=${txToDelete.rowNumber || ''}`;
      fetch(deleteUrl, { method: 'GET', mode: 'no-cors' }).catch(() => {});

      // 2. POST with plain text to avoid CORS preflight blocking
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch {}

    setIsDeleting(false);
    setDeletingTx(null);
    showToast(lang === 'en' ? 'Transaction deleted & removed from sheet!' : 'লেনদেন মুছে ফেলা হয়েছে ও শিট আপডেট হয়েছে!', 'info');
  };

  // ----------------------------------------------------
  // 11. CATEGORY MANAGEMENT ACTIONS
  // ----------------------------------------------------
  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [catModalType, setCatModalType] = useState<TransactionType>('Expense');

  const addCategoryToCloud = useCallback(async (newCat: string, type: TransactionType) => {
    try {
      const payload = {
        action: 'addcategory',
        sheetTab: currentTab,
        category: newCat,
        type: type
      };
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch {}
  }, [currentTab]);

  const deleteCategoryFromCloud = useCallback(async (catToDelete: string) => {
    try {
      const payload = {
        action: 'deletecategory',
        sheetTab: currentTab,
        category: catToDelete
      };
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch {}
  }, [currentTab]);

  const syncCategoriesToCloud = useCallback(async (expCats: string[], incCats: string[]) => {
    try {
      const payload = {
        action: 'savecategories',
        sheetTab: currentTab,
        categories: [
          ...expCats.map(c => ({ type: 'Expense', category: c })),
          ...incCats.map(c => ({ type: 'Income', category: c }))
        ]
      };
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch {}
  }, [currentTab]);

  const handleUpdateCategories = (newCats: string[], type: TransactionType) => {
    let finalExp = expenseCategories;
    let finalInc = incomeCategories;
    if (type === 'Expense') {
      finalExp = deduplicateCategories(newCats);
      setExpenseCategories(finalExp);
      try {
        localStorage.setItem(`app_expense_categories_${currentTab}`, JSON.stringify(finalExp));
      } catch {}
    } else {
      finalInc = deduplicateCategories(newCats);
      setIncomeCategories(finalInc);
      try {
        localStorage.setItem(`app_income_categories_${currentTab}`, JSON.stringify(finalInc));
      } catch {}
    }
    syncCategoriesToCloud(finalExp, finalInc);
    showToast(lang === 'en' ? 'Categories updated & synced!' : 'ক্যাটাগরি আপডেট ও সিঙ্ক হয়েছে!', 'success');
  };

  const handleAddCategory = (newCat: string, type: TransactionType) => {
    const cleanCat = newCat.trim();
    if (!cleanCat) return;

    if (type === 'Expense') {
      const updated = deduplicateCategories([...expenseCategories, cleanCat]);
      setExpenseCategories(updated);
      try {
        localStorage.setItem(`app_expense_categories_${currentTab}`, JSON.stringify(updated));
      } catch {}
    } else {
      const updated = deduplicateCategories([...incomeCategories, cleanCat]);
      setIncomeCategories(updated);
      try {
        localStorage.setItem(`app_income_categories_${currentTab}`, JSON.stringify(updated));
      } catch {}
    }
    // Just append the new category to Google Sheet Category tab - never clears anything!
    addCategoryToCloud(cleanCat, type);
    showToast(lang === 'en' ? `Category '${cleanCat}' added & synced!` : `'${cleanCat}' ক্যাটাগরি যুক্ত ও সিঙ্ক হয়েছে!`, 'success');
  };

  const handleDeleteCategory = (catToDelete: string, type: TransactionType) => {
    if (type === 'Expense') {
      const updated = expenseCategories.filter(c => c !== catToDelete);
      setExpenseCategories(updated);
      try {
        localStorage.setItem(`app_expense_categories_${currentTab}`, JSON.stringify(updated));
      } catch {}
    } else {
      const updated = incomeCategories.filter(c => c !== catToDelete);
      setIncomeCategories(updated);
      try {
        localStorage.setItem(`app_income_categories_${currentTab}`, JSON.stringify(updated));
      } catch {}
    }
    deleteCategoryFromCloud(catToDelete);
    showToast(lang === 'en' ? 'Category removed & synced' : 'ক্যাটাগরি মুছে ফেলা হয়েছে ও সিঙ্ক হয়েছে', 'info');
  };

  // ----------------------------------------------------
  // 12. USER MANAGEMENT ACTIONS
  // ----------------------------------------------------
  const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showMobileModal, setShowMobileModal] = useState<boolean>(false);
  const [selectedDateModal, setSelectedDateModal] = useState<string | null>(null);

  const handleSaveProfile = (
    newDisplayName: string,
    newPass?: string,
    newRole?: UserRole,
    newAllowedTabs?: AppTab[],
    newIsReadOnly?: boolean
  ) => {
    if (!editingUser) return;
    const updatedUsers = users.map(u => {
      if (u.username === editingUser.username) {
        return {
          ...u,
          displayName: newDisplayName,
          password: newPass || u.password,
          role: newRole || u.role,
          allowedTabs: newAllowedTabs || u.allowedTabs,
          isReadOnly: newIsReadOnly !== undefined ? newIsReadOnly : u.isReadOnly
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updatedUsers));
    } catch {}

    if (currentUser?.username === editingUser.username) {
      const updatedCurrent: AppUser = {
        ...currentUser,
        displayName: newDisplayName,
        password: newPass || currentUser.password,
        role: newRole || currentUser.role,
        allowedTabs: newAllowedTabs || currentUser.allowedTabs,
        isReadOnly: newIsReadOnly !== undefined ? newIsReadOnly : currentUser.isReadOnly
      };
      setCurrentUser(updatedCurrent);
      try {
        localStorage.setItem('active_user_v2', JSON.stringify(updatedCurrent));
      } catch {}
    }
    setEditingUser(null);
    showToast(lang === 'en' ? 'Profile & permissions updated!' : 'প্রোফাইল ও পারমিশন সফলভাবে আপডেট হয়েছে!', 'success');
  };

  const handleUpdateSpreadsheetId = (id: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, spreadsheetId: id };
    setCurrentUser(updatedUser);
    
    const updatedUsers = users.map(u => u.username === currentUser.username ? updatedUser : u);
    setUsers(updatedUsers);
    
    try {
      localStorage.setItem('active_user_v2', JSON.stringify(updatedUser));
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updatedUsers));
    } catch {}
  };

  const handleCreateUser = (
    name: string,
    uname: string,
    pass: string,
    role: UserRole,
    allowedTabs?: AppTab[],
    isReadOnly?: boolean,
    viewTargetTab?: string
  ) => {
    const exists = users.some(u => u.username === uname);
    if (exists) {
      showToast(lang === 'en' ? 'Username already exists!' : 'এই ইউজারনেম ইতিমধ্যে রয়েছে!', 'error');
      return;
    }

    const newUser: AppUser = {
      username: uname,
      password: pass,
      displayName: name,
      initialUsername: uname,
      sheetTab: viewTargetTab || uname,
      createdAt: new Date().toISOString().split('T')[0],
      role,
      isActive: true,
      allowedTabs,
      isReadOnly,
      viewTargetTab
    };

    const updated = [...users, newUser];
    setUsers(updated);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updated));
    } catch {}

    showToast(lang === 'en' ? `User @${uname} created!` : `@${uname} ইউজার তৈরি হয়েছে!`, 'success');
  };

  const handleSwitchUser = (user: AppUser) => {
    if (user.isActive === false) {
      showToast(lang === 'en' ? 'Account is inactive!' : 'এই অ্যাকাউন্ট নিষ্ক্রিয় রয়েছে!', 'error');
      return;
    }
    setCurrentUser(user);
    try {
      localStorage.setItem('active_user_v2', JSON.stringify(user));
    } catch {}
    showToast(lang === 'en' ? `Switched to ${user.displayName}` : `${user.displayName} অ্যাকাউন্টে সুইচ করা হয়েছে`, 'info');
  };

  const handleToggleActiveUser = (user: AppUser) => {
    if (user.username === 'abujar287') {
      showToast(lang === 'en' ? 'Main admin cannot be disabled!' : 'মূল অ্যাডমিন নিষ্ক্রিয় করা যাবে না!', 'error');
      return;
    }
    const updated = users.map(u => (u.username === user.username ? { ...u, isActive: !u.isActive } : u));
    setUsers(updated);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updated));
    } catch {}
    showToast(lang === 'en' ? 'Status updated' : 'স্ট্যাটাস আপডেট হয়েছে', 'info');
  };

  const handleConfirmDeleteUser = (user: AppUser) => {
    if (user.username === 'abujar287') {
      showToast(lang === 'en' ? 'Admin cannot be deleted!' : 'অ্যাডমিন অ্যাকাউন্ট ডিলিট করা যাবে না!', 'error');
      return;
    }
    const updated = users.filter(u => u.username !== user.username);
    setUsers(updated);
    try {
      localStorage.setItem('app_registered_users_v2', JSON.stringify(updated));
    } catch {}

    // If currently logged into this user, switch back to admin
    if (currentUser?.username === user.username) {
      const admin = users.find(u => u.username === 'abujar287') || DEFAULT_ADMIN;
      setCurrentUser(admin);
      try {
        localStorage.setItem('active_user_v2', JSON.stringify(admin));
      } catch {}
    }

    setUserToDelete(null);
    showToast(lang === 'en' ? 'User deleted' : 'ইউজার মুছে ফেলা হয়েছে', 'info');
  };

  // ----------------------------------------------------
  // 13. AUTHENTICATION (LOGIN / LOGOUT)
  // ----------------------------------------------------
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    const targetUser = users.find(
      u =>
        u.username.toLowerCase() === loginUsername.trim().toLowerCase() ||
        (u.initialUsername && u.initialUsername.toLowerCase() === loginUsername.trim().toLowerCase())
    );

    if (!targetUser) {
      setLoginError(t('User not found! Check username.', 'ইউজার পাওয়া যায়নি! সঠিক ইউজারনেম দিন।'));
      setIsLoggingIn(false);
      return;
    }

    if (targetUser.password !== loginPassword.trim()) {
      setLoginError(t('Incorrect password! Try again.', 'ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।'));
      setIsLoggingIn(false);
      return;
    }

    if (targetUser.isActive === false) {
      setLoginError(t('Account deactivated by administrator.', 'অ্যাকাউন্টটি অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।'));
      setIsLoggingIn(false);
      return;
    }

    setCurrentUser(targetUser);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('active_user_v2', JSON.stringify(targetUser));
    } catch {}

    setIsLoggingIn(false);
    showToast(lang === 'en' ? `Welcome back, ${targetUser.displayName}!` : `স্বাগতম, ${targetUser.displayName}!`, 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    try {
      localStorage.removeItem('active_user_v2');
    } catch {}
    showToast(lang === 'en' ? 'Logged out successfully' : 'লগআউট সম্পন্ন হয়েছে', 'info');
  };

  // ----------------------------------------------------
  // RENDER: LOGIN SCREEN (IF NOT AUTHENTICATED)
  // ----------------------------------------------------
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden text-[#0F172A]">
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-slate-100 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -top-12 w-48 h-48 bg-slate-100 rounded-full blur-3xl pointer-events-none" />

          {/* Logo & Heading */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto shadow-md border border-slate-100">
              <img src="/logo.png" alt="HisabKitab Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
              {t('HisabKitab', 'HisabKitab')}
            </h1>
            <p className="text-xs text-slate-500">
              {t('Smart Personal & Team Expense Tracker', 'ব্যক্তিগত ও ব্যবসায়িক আয়-ব্যয় ট্র্যাকার')}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                {t('Username', 'ইউজারনেম')}
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder={t('Enter your username', 'Enter your username')}
                className="w-full min-h-[46px] bg-white border border-slate-200 rounded-xl p-3 text-base sm:text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                {t('Password', 'পাসওয়ার্ড')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder={t('Enter your password', 'Enter your password')}
                  className="w-full min-h-[46px] bg-white border border-slate-200 rounded-xl p-3 pr-10 text-base sm:text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:border-slate-500"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[#EF4444] text-xs font-medium animate-fadeIn">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full min-h-[48px] py-3 bg-[#475569] hover:bg-[#334155] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoggingIn ? t('Verifying...', 'যাচাই করা হচ্ছে...') : t('Sign In', 'লগইন করুন')}</span>
            </button>
          </form>

          {/* Secure Cloud Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#475569]" />
            <span>{t('Encrypted & Synced with Cloud', 'সুরক্ষিত ক্লাউড ডেটাবেস সিঙ্ক')}</span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: MAIN AUTHENTICATED APP
  // ----------------------------------------------------
  return (
  <div className={`h-[100dvh] w-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A] antialiased selection:bg-slate-200 selection:text-slate-900 flex flex-col ${
    viewMode === 'mobile' ? 'items-center justify-center bg-[#F8FAFC]' : ''
  }`}>
      {/* App Frame: Mobile Phone Container when mobile mode; Full Width when desktop/tablet mode */}
      <div className={`w-full flex flex-col h-dvh bg-[#F8FAFC] relative ${
        viewMode === 'mobile'
          ? 'max-w-[430px] mx-auto border-x border-slate-200 shadow-lg'
          : 'max-w-6xl mx-auto'
      }`}>
        {/* Floating Modern Toast Notification */}
        {toast.show && (
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-xl flex items-center gap-2 text-xs font-bold border animate-modalSpring max-w-sm text-center ${
              toast.type === 'error'
                ? 'bg-white/95 text-[#EF4444] border-rose-200 shadow-rose-100'
                : toast.type === 'info'
                ? 'bg-white/95 text-slate-700 border-slate-200 shadow-slate-100'
                : 'bg-white/95 text-[#16A34A] border-emerald-200 shadow-emerald-100'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
            ) : toast.type === 'info' ? (
              <HelpCircle className="w-4 h-4 text-[#475569] shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* HEADER COMPONENT - Permanently pinned at top, shrink-0 */}
        <div className="shrink-0 w-full z-40">
          <Header
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            lastSyncTime={lastSyncTime}
            isSyncing={isSyncing}
            onSync={() => handleManualSync(currentTab)}
            viewMode={viewMode}
            t={t}
          />
        </div>

        {/* MAIN VIEWPORT CONTENT - Exclusively scrollable area */}
        <main className={`flex-1 overflow-y-auto overscroll-contain overflow-x-hidden w-full bg-[#F8FAFC] ${viewMode === 'mobile' ? 'px-2.5 sm:px-3 py-3 pb-4' : 'px-4 py-5 pb-6'}`}>
          {activeTab === 'summary' && (
            <SummaryTab
              transactions={transactions}
              filteredTransactions={filteredTransactions}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              globalFilterMode={globalFilterMode}
              setGlobalFilterMode={setGlobalFilterMode}
              onSelectDate={dateStr => setSelectedDateModal(dateStr)}
              onEdit={isReadOnly ? undefined : (tx => setEditingTx(tx))}
              onDelete={isReadOnly ? undefined : (tx => setDeletingTx(tx))}
              isReadOnly={isReadOnly}
              lang={lang}
              t={t}
            />
          )}

          {activeTab === 'entry' && !isReadOnly && (
            <EntryTab
              entryType={entryType}
              setEntryType={setEntryType}
              entryCategory={entryCategory}
              setEntryCategory={setEntryCategory}
              entryDate={entryDate}
              setEntryDate={setEntryDate}
              entryNote={entryNote}
              setEntryNote={setEntryNote}
              calcDisplay={calcDisplay}
              setCalcDisplay={setCalcDisplay}
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              onOpenCategoryManager={() => setShowCategoryManager(true)}
              onSubmit={handleSaveTransaction}
              isSubmitting={isSubmitting}
              lang={lang}
              t={t}
            />
          )}

          {activeTab === 'details' && (
            <DetailsTab
              transactions={filteredTransactions}
              currentUser={currentUser}
              onEdit={tx => setEditingTx(tx)}
              onDelete={tx => setDeletingTx(tx)}
              isReadOnly={isReadOnly}
              lang={lang}
              t={t}
            />
          )}

          {activeTab === 'budget' && (
            <BudgetTab
              expenseCategories={expenseCategories}
              transactions={transactions}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              lang={lang}
              t={t}
              currentTab={currentTab}
            />
          )}

          {activeTab === 'users' && (
            <UsersTab
              users={users}
              currentUser={currentUser}
              onOpenCreateModal={() => setShowCreateUserModal(true)}
              onOpenEditModal={user => setEditingUser(user)}
              onRequestDeleteUser={user => setUserToDelete(user)}
              onSwitchUser={handleSwitchUser}
              onToggleActiveUser={handleToggleActiveUser}
              lang={lang}
              t={t}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              currentUser={currentUser}
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              onOpenAddCategoryModal={type => {
                setCatModalType(type);
                setShowAddCatModal(true);
              }}
              onDeleteCategory={handleDeleteCategory}
              transactions={transactions}
              lang={lang}
              onOpenEditProfile={() => setEditingUser(currentUser)}
              viewMode={viewMode}
              onLogout={handleLogout}
              onImportJson={handleImportJson}
              t={t}
              onUpdateSpreadsheetId={handleUpdateSpreadsheetId}
              onOpenInstallModal={() => setShowMobileModal(true)}
              selectedMonth={selectedMonth}
            />
          )}
        </main>

        {/* BOTTOM NAVIGATION BAR */}
        <nav
          className="shrink-0 w-full z-40 bg-white border-t border-slate-200 p-2 pb-safe flex items-center justify-around gap-1.5 shadow-sm"
        >
          {[
            { id: 'summary' as const, label: t('Summary', 'সারাংশ'), icon: BarChart3 },
            { id: 'entry' as const, label: t('Entry', 'হিসাব'), icon: PlusCircle },
            { id: 'details' as const, label: t('Details', 'বিস্তারিত'), icon: ListOrdered },
            { id: 'budget' as const, label: t('Budget', 'বাজেট'), icon: Sliders },
            { id: 'settings' as const, label: t('Settings', 'সেটিংস'), icon: Settings }
          ]
            .filter(item => allowedTabs.includes(item.id))
            .map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#475569] text-white border-slate-600 shadow-lg scale-102 font-bold'
                      : 'bg-slate-50 text-slate-600 border-slate-300 shadow-sm'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold mt-1 tracking-tight leading-tight">{item.label}</span>
                </button>
              );
            })}
        </nav>
      </div>

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}
      <DayDetailsModal
        dateStr={selectedDateModal}
        transactions={transactions}
        onClose={() => setSelectedDateModal(null)}
        onEdit={tx => setEditingTx(tx)}
        onDelete={tx => setDeletingTx(tx)}
        lang={lang}
        t={t}
      />

      <EditTransactionModal
        tx={editingTx}
        onClose={() => setEditingTx(null)}
        onSave={handleUpdateTransaction}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        lang={lang}
        t={t}
      />

      <DeleteConfirmModal
        tx={deletingTx}
        onClose={() => setDeletingTx(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        lang={lang}
        t={t}
      />

      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onCreate={handleCreateUser}
        lang={lang}
        t={t}
      />

      <DeleteUserModal
        user={userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDeleteUser}
        lang={lang}
        t={t}
      />

      <AddCategoryModal
        isOpen={showAddCatModal}
        type={catModalType}
        onClose={() => setShowAddCatModal(false)}
        onAdd={handleAddCategory}
        lang={lang}
        t={t}
      />

      <CategoryManagerModal
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        onUpdateCategories={handleUpdateCategories}
        onOpenAddModal={type => {
          setCatModalType(type);
          setShowAddCatModal(true);
        }}
        lang={lang}
        t={t}
      />

      <MobileInstallModal
        isOpen={showMobileModal}
        onClose={() => setShowMobileModal(false)}
        isInstallable={isInstallable}
        onInstall={install}
        lang={lang}
        t={t}
      />

      <EditProfileModal
        user={editingUser}
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        onSave={handleSaveProfile}
        isAdmin={currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.username === 'abujar287'}
        lang={lang}
        t={t}
      />

      <ExitConfirmModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={() => {
          setShowExitModal(false);
          setIsAppExited(true);
          window.close();
        }}
        lang={lang}
        t={t}
      />

      {isAppExited && (
        <div className="fixed inset-0 z-[9999999] bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-[#475569]">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">{t('Application Closed', 'অ্যাপটি বন্ধ করা হয়েছে')}</h2>
          <p className="text-slate-500 mb-6 max-w-xs">{t('You can now safely close this browser tab.', 'আপনি এখন ব্রাউজার ট্যাবটি সরাসরি বন্ধ করতে পারেন।')}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-[#475569] text-white rounded-xl font-bold shadow-md active:scale-95 transition-all"
          >
            {t('Re-open HisabKitab', 'পুনরায় ওপেন করুন')}
          </button>
        </div>
      )}
      
      {needRefresh && (
        <div className="fixed bottom-20 left-4 right-4 z-[9999] bg-white border border-emerald-500/30 rounded-xl p-4 shadow-xl flex items-center justify-between animate-modalSpring">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">Update Available</h3>
            <p className="text-xs text-slate-500">A new version is available!</p>
          </div>
          <button
            onClick={() => updateServiceWorker(true)}
            className="px-4 py-2 bg-[#16A34A] text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Update Now
          </button>
        </div>
      )}
    </div>
  );
}
