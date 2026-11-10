import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  User,
  Download,
  Upload,
  FileJson,
  LogOut,
  FileSpreadsheet,
  Archive,
  Smartphone,
  Calendar,
  Trash2,
  Plus,
  Shield,
  Layers,
  Settings2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Landmark,
  Banknote,
  ShoppingBag,
  Zap,
  Scale,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { AppUser, Transaction, TransactionType } from '../types';
import { cleanCategoryName } from '../utils/categoryUtils';
import {
  normalizeDate,
  formatNumberLocale,
  formatCleanDateTime,
  cleanMappingLabel,
  getMonthKeyFromLabel,
  findMonthMapping
} from '../utils/dateUtils';
import { exportMonthlyReportZip } from '../utils/exportZipReport';
import { AppsScriptModal, ExportMonthModal } from './Modals';

interface SettingsTabProps {
  currentUser: AppUser | null;
  expenseCategories: string[];
  incomeCategories: string[];
  onOpenAddCategoryModal: (type: TransactionType) => void;
  onDeleteCategory: (category: string, type: TransactionType) => void;
  transactions: Transaction[];
  lang: 'en' | 'bn';
  onOpenEditProfile: () => void;
  viewMode: 'mobile' | 'desktop';
  onLogout?: () => void;
  onImportJson?: (data: any) => boolean | void;
  t: (en: string, bn: string) => string;
  isSyncing?: boolean;
  onSync?: () => void;
  lastSyncTime?: string;
  toggleLanguage?: () => void;
  monthlyBudget?: number;
  onSaveMonthlyBudget?: (budget: number) => void;
  onOpenInstallModal?: () => void;
  onUpdateSpreadsheetId?: (id: string) => void;
  selectedMonth: string;
  monthMappings: import('../types').MonthMapping[];
  onAddMonthMapping: (mapping: import('../types').MonthMapping) => void;
  onDeleteMonthMapping: (id: string) => void;
  onSelectMonth: (month: string) => void;
  onSetDefaultMonth?: (monthLabel: string) => void;
  users?: AppUser[];
  onOpenCreateUserModal?: () => void;
  onOpenEditUserModal?: (user: AppUser) => void;
  onRequestDeleteUser?: (user: AppUser) => void;
  onSwitchUser?: (user: AppUser) => void;
  onToggleActiveUser?: (user: AppUser) => void;
  onCheckForUpdates?: () => void;
}

const getRoleLabel = (role?: string) => {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'super_admin_2': return 'Super Admin (Viewer)';
    case 'admin': return 'Admin';
    case 'senior_member': return 'Senior Member';
    case 'member': return 'Member';
    default: return 'User';
  }
};

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  expenseCategories,
  incomeCategories,
  transactions,
  lang,
  onOpenEditProfile,
  onLogout,
  onImportJson,
  t,
  onOpenInstallModal,
  selectedMonth,
  monthMappings,
  onAddMonthMapping,
  onDeleteMonthMapping,
  onSelectMonth,
  onSetDefaultMonth,
  users = [],
  onOpenCreateUserModal,
  onOpenEditUserModal,
  onRequestDeleteUser,
  onSwitchUser,
  onToggleActiveUser,
  onCheckForUpdates
}) => {
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.username === 'abujar287';
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Custom Month Mapping State
  const [isMonthMappingExpanded, setIsMonthMappingExpanded] = useState(false);
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [newMappingLabel, setNewMappingLabel] = useState('');
  const [newMappingStart, setNewMappingStart] = useState('');
  const [newMappingEnd, setNewMappingEnd] = useState('');
  const [newMappingBudget, setNewMappingBudget] = useState('');
  const [newMappingIsDefault, setNewMappingIsDefault] = useState(false);

  const handleStartEditMapping = (m: import('../types').MonthMapping) => {
    setEditingMappingId(m.id);
    setNewMappingLabel(m.label);
    setNewMappingStart(m.startDate);
    setNewMappingEnd(m.endDate);
    setNewMappingBudget(m.budget ? String(m.budget) : '');
    setNewMappingIsDefault(Boolean(m.isDefault));
    setIsAddingMapping(true);
    setIsMonthMappingExpanded(true);
  };

  const handleSaveOrUpdateMapping = () => {
    if (!newMappingLabel.trim() || !newMappingStart || !newMappingEnd) {
      alert(t('Please fill all fields for custom month', 'সবগুলো ঘর পূরণ করুন'));
      return;
    }
    const cleanLabel = cleanMappingLabel(newMappingLabel) || newMappingLabel.trim();
    const budgetNum = parseFloat(newMappingBudget);
    
    onAddMonthMapping({
      id: editingMappingId || Date.now().toString(),
      label: cleanLabel,
      startDate: normalizeDate(newMappingStart),
      endDate: normalizeDate(newMappingEnd),
      isDefault: newMappingIsDefault,
      budget: !isNaN(budgetNum) && budgetNum > 0 ? budgetNum : undefined
    });

    setNewMappingLabel('');
    setNewMappingStart('');
    setNewMappingEnd('');
    setNewMappingBudget('');
    setNewMappingIsDefault(false);
    setIsAddingMapping(false);
    setEditingMappingId(null);
  };

  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Month dropdown options with clean labels
  const monthOptions = React.useMemo(() => {
    const opts: { val: string; label: string }[] = [];
    const mappedMonthKeys = new Set<string>();
    
    // Add custom mappings
    monthMappings.forEach(m => {
      opts.push({
        val: m.label,
        label: m.label
      });
      const mKey = getMonthKeyFromLabel(m.label);
      if (mKey) mappedMonthKeys.add(mKey);
    });

    const now = new Date();
    for (let i = -12; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!mappedMonthKeys.has(val)) {
        const label = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD', {
          month: 'short',
          year: 'numeric'
        });
        if (!opts.find(o => o.val === val)) {
          opts.push({ val, label });
        }
      }
    }
    return opts;
  }, [lang, monthMappings]);

  // Export Full Month Report ZIP (Summary PDF + Details Excel)
  const handlePerformExportZip = async (params: { month: string; startDate?: string; endDate?: string }) => {
    setIsExportingZip(true);
    try {
      await exportMonthlyReportZip({
        ...params,
        transactions,
        monthMappings,
        lang,
        userName: currentUser?.displayName || currentUser?.username || 'Abujar Al-Gifari'
      });
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExportingZip(false);
    }
  };

  // Full month stats for printing
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter(tx => normalizeDate(tx.date).startsWith(currentMonthPrefix));
  const monthInc = monthTransactions.reduce((acc, tx) => tx.type === 'Income' ? acc + (Number(tx.value) || 0) : acc, 0);
  const monthExp = monthTransactions.reduce((acc, tx) => tx.type === 'Expense' ? acc + (Number(tx.value) || 0) : acc, 0);
  const monthNet = monthInc - monthExp;

  // Export full JSON backup
  const handleExportJson = () => {
    const backupData = {
      appName: 'hisab_kitab',
      exportDate: new Date().toISOString(),
      user: currentUser?.username || 'abujar287',
      totalTransactions: transactions.length,
      transactions,
      expenseCategories,
      incomeCategories
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `hisab_kitab_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON file handler
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (onImportJson) {
          onImportJson(parsed);
        }
      } catch (err) {
        alert(lang === 'en' ? 'Invalid JSON file format!' : 'ভুল ফরম্যাটের JSON ফাইল!');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // ----------------------------------------------------
  // MATRICS AMOUNT (ASSET RECONCILIATION) STATE & CALCULATION
  // ----------------------------------------------------
  const [metrics, setMetrics] = useState<{
    cityBank: string;
    bkash: string;
    nagad: string;
    cash: string;
    moneyBag: string;
  }>(() => {
    try {
      const userKey = currentUser?.username || 'user';
      const saved = localStorage.getItem(`app_matrics_amount_${userKey}_${selectedMonth}`);
      if (saved) return JSON.parse(saved);
      const fallback = localStorage.getItem(`app_matrics_amount_${userKey}`);
      if (fallback) return JSON.parse(fallback);
    } catch {}
    return {
      cityBank: '',
      bkash: '',
      nagad: '',
      cash: '',
      moneyBag: ''
    };
  });

  useEffect(() => {
    try {
      const userKey = currentUser?.username || 'user';
      const saved = localStorage.getItem(`app_matrics_amount_${userKey}_${selectedMonth}`);
      if (saved) {
        setMetrics(JSON.parse(saved));
        return;
      }
      const fallback = localStorage.getItem(`app_matrics_amount_${userKey}`);
      if (fallback) {
        setMetrics(JSON.parse(fallback));
        return;
      }
    } catch {}
    setMetrics({
      cityBank: '',
      bkash: '',
      nagad: '',
      cash: '',
      moneyBag: ''
    });
  }, [selectedMonth, currentUser?.username]);

  const updateMetric = (field: 'cityBank' | 'bkash' | 'nagad' | 'cash' | 'moneyBag', value: string) => {
    setMetrics(prev => {
      const next = { ...prev, [field]: value };
      try {
        const userKey = currentUser?.username || 'user';
        localStorage.setItem(`app_matrics_amount_${userKey}_${selectedMonth}`, JSON.stringify(next));
        localStorage.setItem(`app_matrics_amount_${userKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleResetMetrics = () => {
    const empty = { cityBank: '', bkash: '', nagad: '', cash: '', moneyBag: '' };
    setMetrics(empty);
    try {
      const userKey = currentUser?.username || 'user';
      localStorage.setItem(`app_matrics_amount_${userKey}_${selectedMonth}`, JSON.stringify(empty));
      localStorage.setItem(`app_matrics_amount_${userKey}`, JSON.stringify(empty));
    } catch {}
  };

  // Active Month Transactions & Real-time Monthly Balance Calculation
  const selectedMapping = useMemo(() => findMonthMapping(monthMappings, selectedMonth), [monthMappings, selectedMonth]);
  const activeMonthTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = normalizeDate(tx.date);
      if (selectedMapping) {
        return txDate >= selectedMapping.startDate && txDate <= selectedMapping.endDate;
      }
      const monthKey = getMonthKeyFromLabel(selectedMonth) || selectedMonth;
      return txDate.startsWith(monthKey);
    });
  }, [transactions, selectedMapping, selectedMonth]);

  const activeMonthInc = useMemo(() =>
    activeMonthTransactions.reduce((acc, tx) => tx.type === 'Income' ? acc + (Number(tx.value) || 0) : acc, 0),
    [activeMonthTransactions]
  );
  const activeMonthExp = useMemo(() =>
    activeMonthTransactions.reduce((acc, tx) => tx.type === 'Expense' ? acc + (Number(tx.value) || 0) : acc, 0),
    [activeMonthTransactions]
  );
  const activeMonthlyBalance = activeMonthInc - activeMonthExp;

  // Real-time Sums
  const numCityBank = parseFloat(metrics.cityBank) || 0;
  const numBkash = parseFloat(metrics.bkash) || 0;
  const numNagad = parseFloat(metrics.nagad) || 0;
  const numCash = parseFloat(metrics.cash) || 0;
  const numMoneyBag = parseFloat(metrics.moneyBag) || 0;

  const totalMatricsAmount = numCityBank + numBkash + numNagad + numCash + numMoneyBag;
  const difference = totalMatricsAmount - activeMonthlyBalance;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-16 animate-fadeIn px-1 sm:px-3">
      {/* 0. MATRICS AMOUNT (CLEAN & SIMPLE REPORTING FORMAT) */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-sm overflow-hidden animate-fadeIn">
        {/* Header - Minimal & Clean */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-teal-800/80 flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-extrabold text-[#F0FDFA] flex items-center gap-2">
            <span>Matrics Amount</span>
            {selectedMonth && (
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-teal-900/80 text-emerald-400 border border-teal-700/60">
                {selectedMonth}
              </span>
            )}
          </h3>

          {(metrics.cityBank || metrics.bkash || metrics.nagad || metrics.cash || metrics.moneyBag) && (
            <button
              type="button"
              onClick={handleResetMetrics}
              className="text-xs font-semibold text-teal-300/80 hover:text-white flex items-center gap-1 cursor-pointer"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-teal-800/60">
          {/* Rows for City Bank, Bkash, Nagad, Cash, Money Bag */}
          <div className="lg:col-span-7 divide-y divide-teal-800/60">
            {/* City Bank */}
            <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-teal-900/30">
              <span className="text-xs sm:text-sm font-semibold text-[#F0FDFA]">
                City Bank
              </span>
              <div className="w-36 sm:w-48">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={metrics.cityBank}
                  onChange={e => updateMetric('cityBank', e.target.value)}
                  placeholder="0"
                  className="w-full text-right font-mono font-bold px-3 py-1.5 bg-[#062423] border border-teal-700/70 rounded-lg text-[#F0FDFA] focus:outline-none focus:border-emerald-400 text-xs sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Bkash */}
            <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-teal-900/30">
              <span className="text-xs sm:text-sm font-semibold text-[#F0FDFA]">
                Bkash
              </span>
              <div className="w-36 sm:w-48">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={metrics.bkash}
                  onChange={e => updateMetric('bkash', e.target.value)}
                  placeholder="0"
                  className="w-full text-right font-mono font-bold px-3 py-1.5 bg-[#062423] border border-teal-700/70 rounded-lg text-[#F0FDFA] focus:outline-none focus:border-emerald-400 text-xs sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Nagad */}
            <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-teal-900/30">
              <span className="text-xs sm:text-sm font-semibold text-[#F0FDFA]">
                Nagad
              </span>
              <div className="w-36 sm:w-48">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={metrics.nagad}
                  onChange={e => updateMetric('nagad', e.target.value)}
                  placeholder="0"
                  className="w-full text-right font-mono font-bold px-3 py-1.5 bg-[#062423] border border-teal-700/70 rounded-lg text-[#F0FDFA] focus:outline-none focus:border-emerald-400 text-xs sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Cash */}
            <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-teal-900/30">
              <span className="text-xs sm:text-sm font-semibold text-[#F0FDFA]">
                Cash
              </span>
              <div className="w-36 sm:w-48">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={metrics.cash}
                  onChange={e => updateMetric('cash', e.target.value)}
                  placeholder="0"
                  className="w-full text-right font-mono font-bold px-3 py-1.5 bg-[#062423] border border-teal-700/70 rounded-lg text-[#F0FDFA] focus:outline-none focus:border-emerald-400 text-xs sm:text-sm transition-colors"
                />
              </div>
            </div>

            {/* Money Bag */}
            <div className="px-4 py-2.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-teal-900/30">
              <span className="text-xs sm:text-sm font-semibold text-[#F0FDFA]">
                Money Bag
              </span>
              <div className="w-36 sm:w-48">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={metrics.moneyBag}
                  onChange={e => updateMetric('moneyBag', e.target.value)}
                  placeholder="0"
                  className="w-full text-right font-mono font-bold px-3 py-1.5 bg-[#062423] border border-teal-700/70 rounded-lg text-[#F0FDFA] focus:outline-none focus:border-emerald-400 text-xs sm:text-sm transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Right Column / Bottom on Mobile: Summary Cards */}
          <div className="lg:col-span-5 bg-teal-950/40 p-4 sm:p-5 flex flex-col justify-center gap-3">
            <div className="bg-[#062423] border border-teal-800/80 rounded-xl p-3 sm:p-3.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-300/80">Total in Accounts</span>
              <span className="text-base sm:text-lg font-extrabold font-mono text-[#F0FDFA]">
                {formatNumberLocale(totalMatricsAmount, lang)}
              </span>
            </div>

            <div className="bg-[#062423] border border-teal-800/80 rounded-xl p-3 sm:p-3.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-300/80">Monthly Balance</span>
              <span className="text-base sm:text-lg font-extrabold font-mono text-[#F0FDFA]">
                {formatNumberLocale(activeMonthlyBalance, lang)}
              </span>
            </div>

            <div className="bg-[#062423] border border-teal-800/80 rounded-xl p-3 sm:p-3.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-300/80">Difference</span>
              <span className={`text-base sm:text-lg font-extrabold font-mono ${
                difference < 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {difference >= 0 ? '+' : ''}{formatNumberLocale(difference, lang)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. MONTH MAPPING (DROPDOWN ACCORDION) */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-sm overflow-hidden transition-all">
        {/* Accordion Header - Click to expand/collapse */}
        <div
          onClick={() => setIsMonthMappingExpanded(!isMonthMappingExpanded)}
          className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-teal-900/30 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-900/80 text-emerald-400 flex items-center justify-center border border-teal-700/60 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#F0FDFA] tracking-tight">
                  Month Mapping
                </h3>
                {selectedMonth && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-teal-900/80 text-emerald-400 border border-teal-700/60">
                    {selectedMonth}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-teal-300/80 font-medium mt-0.5">
                {isMonthMappingExpanded
                  ? t('Click to collapse options', 'অপশন হাইড করতে ক্লিক করুন')
                  : t('Click to view month ranges & options', 'মাস রেঞ্জ ও অপশন দেখতে ক্লিক করুন')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMonthMappingExpanded(!isMonthMappingExpanded);
              }}
              className="p-2 text-teal-300 hover:text-white bg-teal-900/80 hover:bg-teal-800 rounded-xl transition-all cursor-pointer border border-teal-700/60"
              title={isMonthMappingExpanded ? t('Collapse', 'হাইড করুন') : t('Expand', 'দেখুন')}
            >
              {isMonthMappingExpanded ? (
                <ChevronUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-teal-300" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsable Content Body */}
        {isMonthMappingExpanded && (
          <div className="p-4 sm:p-5 pt-0 border-t border-teal-800/80 space-y-3.5 animate-fadeIn">
            {/* Top Action Bar inside Accordion: Add Range Button */}
            <div className="flex items-center justify-between pt-3 pb-1">
              <span className="text-xs font-bold text-teal-300/80 uppercase tracking-wider">
                {t('Month Mappings List', 'মাস ম্যাপিং তালিকা')}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isAddingMapping) {
                    setIsAddingMapping(false);
                    setEditingMappingId(null);
                  } else {
                    setEditingMappingId(null);
                    setNewMappingLabel('');
                    setNewMappingStart('');
                    setNewMappingEnd('');
                    setNewMappingIsDefault(false);
                    setIsAddingMapping(true);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs ${
                  isAddingMapping
                    ? 'bg-teal-900/80 hover:bg-teal-800 text-teal-200 border border-teal-700/60'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isAddingMapping ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-teal-300" />
                    <span>{t('Hide Form', 'হাইড ফর্ম')}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('Add Range', 'রেঞ্জ যুক্ত করুন')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Add / Edit Form */}
            {isAddingMapping && (
              <div className="p-3.5 bg-[#062423] rounded-xl border border-teal-700/70 space-y-3 transition-all animate-fadeIn">
                <div className="flex items-center justify-between border-b border-teal-800/80 pb-2">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                    {editingMappingId ? t('Edit Range Mapping', 'রেঞ্জ ম্যপিং এডিট') : t('New Range Mapping', 'নতুন রেঞ্জ ম্যাপিং')}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsAddingMapping(false); setEditingMappingId(null); }}
                    className="text-xs text-teal-400/80 hover:text-white font-bold cursor-pointer"
                  >
                    {t('Cancel', 'বাতিল')}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-teal-300/80 uppercase block mb-1">Month Label</label>
                    <input
                      type="text"
                      value={newMappingLabel}
                      onChange={e => setNewMappingLabel(e.target.value)}
                      placeholder="e.g. Oct-2026"
                      className="w-full bg-[#0B3C39] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#F0FDFA] focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-300/80 uppercase block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newMappingStart}
                      onChange={e => setNewMappingStart(e.target.value)}
                      className="w-full bg-[#0B3C39] border border-teal-700/70 rounded-lg px-2 py-1.5 text-xs font-bold text-[#F0FDFA] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-300/80 uppercase block mb-1">End Date</label>
                    <input
                      type="date"
                      value={newMappingEnd}
                      onChange={e => setNewMappingEnd(e.target.value)}
                      className="w-full bg-[#0B3C39] border border-teal-700/70 rounded-lg px-2 py-1.5 text-xs font-bold text-[#F0FDFA] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-300/80 uppercase block mb-1">{t('Budget', 'বাজেট')}</label>
                    <input
                      type="number"
                      value={newMappingBudget}
                      onChange={e => setNewMappingBudget(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full bg-[#0B3C39] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#F0FDFA] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-teal-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newMappingIsDefault}
                      onChange={e => setNewMappingIsDefault(e.target.checked)}
                      className="rounded border-teal-700 text-emerald-500 focus:ring-emerald-400"
                    />
                    <span>{t('Make Default Month', 'ডিফল্ট মাস করুন')}</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveOrUpdateMapping}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-xs"
                  >
                    {t('Save Range', 'সংরক্ষণ করুন')}
                  </button>
                </div>
              </div>
            )}

            {/* List of Mappings */}
            <div className="space-y-2">
              {monthMappings.length === 0 ? (
                <div className="py-4 text-center text-xs text-teal-300/60 italic">
                  {t('No month range mappings added yet.', 'কোন মাস রেঞ্জ যোগ করা হয়নি।')}
                </div>
              ) : (
                monthMappings.map(m => {
                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        m.isDefault ? 'bg-amber-950/40 border-amber-800/60 shadow-2xs' : 'bg-[#062423] hover:bg-teal-900/40 border-teal-700/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-[#F0FDFA]">
                            {m.label}
                          </span>
                          {m.isDefault && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-900/80 text-amber-300 border border-amber-700/80 flex items-center gap-1">
                              ⭐ Default
                            </span>
                          )}
                          {m.budget !== undefined && Number(m.budget) > 0 && (
                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                              {formatNumberLocale(Number(m.budget), lang)}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-teal-300/80 font-mono font-medium block mt-0.5">
                          {m.startDate} ~ {m.endDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!m.isDefault && onSetDefaultMonth && (
                          <button
                            type="button"
                            onClick={() => onSetDefaultMonth(m.label)}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-300 bg-amber-950/80 hover:bg-amber-900/80 rounded-lg border border-amber-800/60 cursor-pointer transition-all active:scale-95 shadow-2xs"
                          >
                            {t('Make Default', 'ডিফল্ট করুন')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditMapping(m)}
                          className="p-1.5 text-teal-200 hover:text-white bg-teal-900/80 border border-teal-700/60 rounded-lg cursor-pointer hover:bg-teal-800 transition-colors shadow-2xs"
                          title={t('Edit', 'এডিট')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMonthMapping(m.id)}
                          className="p-1.5 text-rose-300 hover:text-white bg-rose-950/60 border border-rose-800/60 rounded-lg cursor-pointer hover:bg-rose-900/60 transition-colors shadow-2xs"
                          title={t('Remove', 'মুছুন')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. ACTIONS & TOOLS (EXPORT ZIP, INSTALL APP, SCRIPT, UPDATE IN 1 LINE) */}
      <div className="bg-[#0B3C39] rounded-2xl p-3 sm:p-4 border border-teal-800/80 shadow-sm space-y-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* 1. Export ZIP */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            disabled={isExportingZip}
            className="py-3 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md shadow-emerald-950/40"
            title={t('Download Monthly Report (ZIP: PDF + Excel)', 'মাসিক রিপোর্ট ডাউনলোড (ZIP: PDF + Excel)')}
          >
            {isExportingZip ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
            ) : (
              <Archive className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{t('Export ZIP', 'Export ZIP')}</span>
          </button>

          {/* 2. Install App */}
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="py-3 px-2 bg-gradient-to-r from-teal-800 to-teal-900 hover:from-teal-700 hover:to-teal-800 text-[#F0FDFA] rounded-xl text-xs font-extrabold border border-teal-700/70 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md shadow-teal-950/40"
            title={t('Install App / Add to Home Screen', 'অ্যাপ ইনস্টল করুন')}
          >
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{t('Install App', 'Install App')}</span>
          </button>

          {/* 3. Google Apps Script */}
          <button
            type="button"
            onClick={() => setShowAppsScriptModal(true)}
            className="py-3 px-2 bg-gradient-to-r from-teal-900 to-slate-900 hover:from-teal-800 hover:to-slate-800 text-[#F0FDFA] rounded-xl text-xs font-extrabold border border-teal-700/70 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md shadow-slate-950/40"
            title={t('Apps Script Code', 'গুগল স্ক্রিপ্ট কোড')}
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">{t('Script', 'Script')}</span>
          </button>

          {/* 4. Check for Updates */}
          <button
            type="button"
            onClick={onCheckForUpdates}
            className="py-3 px-2 bg-gradient-to-r from-teal-800 to-emerald-900 hover:from-teal-700 hover:to-emerald-800 text-[#F0FDFA] rounded-xl text-xs font-extrabold border border-teal-700/70 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md shadow-emerald-950/30"
            title={t('Check for App Updates from GitHub', 'GitHub থেকে অ্যাপ আপডেট চেক করুন')}
          >
            <RefreshCw className="w-4 h-4 text-teal-300 shrink-0" />
            <span className="truncate">{t('Check Update', 'আপডেট চেক')}</span>
          </button>
        </div>
      </div>

      {/* 3. USER DETAILS (CONSOLIDATED IN ONE PLACE) */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-sm overflow-hidden">
        {/* Active Profile Info Header (No edit profile button, clean & simple) */}
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap border-b border-teal-800/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 border border-emerald-400/60 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
              {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : <User className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-[#F0FDFA] leading-tight">
                  {currentUser?.displayName || 'User'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-900/80 text-emerald-400 border border-teal-700/60 whitespace-nowrap">
                  {getRoleLabel(currentUser?.role)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-teal-300/80 mt-0.5">
                <span>@{currentUser?.username || 'user'}</span>
                {currentUser?.sheetTab && (
                  <>
                    <span>·</span>
                    <span className="text-teal-200 font-mono text-[11px]">Tab: {currentUser.sheetTab}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 cursor-pointer active:scale-95 transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs"
                title={t('Log Out', 'লগআউট')}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('Log Out', 'লগআউট')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Team Members List (If Admin, embedded cleanly in this single place) */}
        {isAdmin && users && users.length > 0 && (
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-bold text-[#F0FDFA]">
                  {t('Team Members', 'টিম মেম্বার্স')} ({users.length})
                </span>
              </div>
              {onOpenCreateUserModal && (
                <button
                  type="button"
                  onClick={onOpenCreateUserModal}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('Add User', 'ইউজার যোগ')}</span>
                </button>
              )}
            </div>

            {/* User Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {users.map(u => {
                const isCurrent = currentUser?.username === u.username;
                const isMainAdmin = u.username === 'abujar287';

                return (
                  <div
                    key={u.username}
                    className={`p-3 sm:p-3.5 rounded-xl border border-teal-700/70 bg-[#062423] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                      isCurrent ? 'bg-teal-900/30 border-teal-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#0B3C39] border border-teal-700/70 flex items-center justify-center font-bold text-[#F0FDFA] text-xs shrink-0">
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[#F0FDFA] text-xs sm:text-sm truncate">{u.displayName}</span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 font-bold border border-emerald-800/60">
                              {t('YOU', 'আপনি')}
                            </span>
                          )}
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-teal-900/80 text-teal-200 border border-teal-700/60">
                            {getRoleLabel(u.role)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-teal-300/80 mt-0.5">
                          <span>@{u.username}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-mono">
                            <span>{visiblePasswords[u.username] ? u.password : '••••••'}</span>
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [u.username]: !prev[u.username] }))}
                              className="text-teal-400 hover:text-white p-0.5 cursor-pointer"
                              title={visiblePasswords[u.username] ? 'Hide' : 'Show'}
                            >
                              {visiblePasswords[u.username] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end shrink-0">
                      {onToggleActiveUser && (
                        <button
                          type="button"
                          onClick={() => onToggleActiveUser(u)}
                          disabled={isMainAdmin}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                            u.isActive !== false
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                              : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                          } ${isMainAdmin ? 'opacity-70' : 'cursor-pointer active:scale-95'}`}
                        >
                          {u.isActive !== false ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          <span>{u.isActive !== false ? t('Active', 'সক্রিয়') : t('Inactive', 'নিষ্ক্রিয়')}</span>
                        </button>
                      )}

                      {onOpenEditUserModal && (
                        <button
                          type="button"
                          onClick={() => onOpenEditUserModal(u)}
                          className="p-1.5 rounded-lg bg-teal-900/80 hover:bg-teal-800 text-[#F0FDFA] border border-teal-700/60 cursor-pointer active:scale-95"
                          title={t('Edit User', 'এডিট')}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      )}

                      {onRequestDeleteUser && !isMainAdmin && (
                        <button
                          type="button"
                          onClick={() => onRequestDeleteUser(u)}
                          className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 cursor-pointer active:scale-95"
                          title={t('Delete User', 'মুছুন')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Apps Script Modal */}
      {showAppsScriptModal && (
        <AppsScriptModal
          isOpen={showAppsScriptModal}
          onClose={() => setShowAppsScriptModal(false)}
          lang={lang}
          t={t}
        />
      )}

      {/* Export Month Selection Modal */}
      {showExportModal && (
        <ExportMonthModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handlePerformExportZip}
          currentMonth={selectedMonth}
          monthMappings={monthMappings}
          lang={lang}
          t={t}
        />
      )}

      {/* Printable Full Month Overall Report (Hidden except in print mode) */}
      <div className="hidden print:block printable-container text-slate-900 bg-white p-4">
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
              Hisab Kitab - Full Month Overall Report ({currentMonthPrefix})
            </h1>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              User: @{currentUser?.username || 'user'} ({currentUser?.displayName})
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-semibold">Generated: {new Date().toLocaleDateString()}</p>
            <p>{new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="mb-4">
          <table className="w-full text-xs border border-slate-300">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-bold bg-slate-100 w-1/4">Total Income</td>
                <td className="p-2 font-bold text-emerald-700">+{formatNumberLocale(monthInc, lang)}</td>
                <td className="p-2 font-bold bg-slate-100 w-1/4">Total Expense</td>
                <td className="p-2 font-bold text-rose-700">-{formatNumberLocale(monthExp, lang)}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold bg-slate-100">Net Balance</td>
                <td className="p-2 font-bold text-slate-900">{monthNet >= 0 ? '+' : ''}{formatNumberLocale(monthNet, lang)}</td>
                <td className="p-2 font-bold bg-slate-100">Total Transactions</td>
                <td className="p-2">{monthTransactions.length} records</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <table className="w-full text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-300">
                <th className="p-1.5 text-left">Date / Time</th>
                <th className="p-1.5 text-center">Type</th>
                <th className="p-1.5 text-left">Category</th>
                <th className="p-1.5 text-left">Note</th>
                <th className="p-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {monthTransactions.map(tx => (
                <tr key={tx.id} className="border-b border-slate-200">
                  <td className="p-1.5 text-[10.5px] whitespace-nowrap">{formatCleanDateTime(tx.datetime || tx.date, lang)}</td>
                  <td className="p-1.5 text-center font-semibold">{tx.type}</td>
                  <td className="p-1.5 font-semibold">{cleanCategoryName(tx.category, lang)}</td>
                  <td className="p-1.5 text-slate-700">{tx.note || '—'}</td>
                  <td className={`p-1.5 text-right font-bold ${tx.type === 'Expense' ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {tx.type === 'Expense' ? '-' : '+'}{formatNumberLocale(Math.abs(tx.value), lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
