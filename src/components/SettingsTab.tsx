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
  AlertCircle
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
  onSetDefaultMonth
}) => {
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.username === 'abujar287';
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
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
    <div className="max-w-2xl mx-auto space-y-4 pb-14 animate-fadeIn">
      {/* 0. MATRICS AMOUNT (CLEAN & SIMPLE REPORTING FORMAT) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
        {/* Header - Minimal & Clean */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
            <span>Matrics Amount</span>
            {selectedMonth && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                {selectedMonth}
              </span>
            )}
          </h3>

          {(metrics.cityBank || metrics.bkash || metrics.nagad || metrics.cash || metrics.moneyBag) && (
            <button
              type="button"
              onClick={handleResetMetrics}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              title="Reset"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Rows for City Bank, Bkash, Nagad, Cash, Money Bag */}
        <div className="divide-y divide-slate-100">
          {/* City Bank */}
          <div className="px-4 py-2 flex items-center justify-between gap-3 hover:bg-slate-50/50">
            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              City Bank
            </span>
            <div className="relative w-36 sm:w-44">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={metrics.cityBank}
                onChange={e => updateMetric('cityBank', e.target.value)}
                placeholder="0"
                className="w-full text-right font-mono font-bold pl-7 pr-3 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Bkash */}
          <div className="px-4 py-2 flex items-center justify-between gap-3 hover:bg-slate-50/50">
            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              Bkash
            </span>
            <div className="relative w-36 sm:w-44">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={metrics.bkash}
                onChange={e => updateMetric('bkash', e.target.value)}
                placeholder="0"
                className="w-full text-right font-mono font-bold pl-7 pr-3 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Nagad */}
          <div className="px-4 py-2 flex items-center justify-between gap-3 hover:bg-slate-50/50">
            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              Nagad
            </span>
            <div className="relative w-36 sm:w-44">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={metrics.nagad}
                onChange={e => updateMetric('nagad', e.target.value)}
                placeholder="0"
                className="w-full text-right font-mono font-bold pl-7 pr-3 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Cash */}
          <div className="px-4 py-2 flex items-center justify-between gap-3 hover:bg-slate-50/50">
            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              Cash
            </span>
            <div className="relative w-36 sm:w-44">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={metrics.cash}
                onChange={e => updateMetric('cash', e.target.value)}
                placeholder="0"
                className="w-full text-right font-mono font-bold pl-7 pr-3 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Money Bag */}
          <div className="px-4 py-2 flex items-center justify-between gap-3 hover:bg-slate-50/50">
            <span className="text-xs sm:text-sm font-semibold text-slate-800">
              Money Bag
            </span>
            <div className="relative w-36 sm:w-44">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={metrics.moneyBag}
                onChange={e => updateMetric('moneyBag', e.target.value)}
                placeholder="0"
                className="w-full text-right font-mono font-bold pl-7 pr-3 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500 text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* 1 Single Row for Total, Monthly Balance, Difference */}
        <div className="border-t-2 border-slate-200 bg-slate-50/90 grid grid-cols-3 divide-x divide-slate-200 text-center py-2.5 px-1">
          <div className="px-1">
            <span className="text-[11px] font-semibold text-slate-500 block">Total</span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900">
              ৳{formatNumberLocale(totalMatricsAmount, lang)}
            </span>
          </div>
          <div className="px-1">
            <span className="text-[11px] font-semibold text-slate-500 block">Monthly Balance</span>
            <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900">
              ৳{formatNumberLocale(activeMonthlyBalance, lang)}
            </span>
          </div>
          <div className="px-1">
            <span className="text-[11px] font-semibold text-slate-500 block">Difference</span>
            <span className={`text-sm sm:text-base font-extrabold font-mono ${
              difference < 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}>
              {difference >= 0 ? '+' : ''}৳{formatNumberLocale(difference, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* 1. USER PROFILE CARD */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-[#475569] flex items-center justify-center font-black text-lg shadow-xs shrink-0">
              {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : <User className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0F172A] leading-tight">
                {currentUser?.displayName || 'Abujar Al-Gifari'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-semibold text-slate-500">
                  @{currentUser?.username || 'abujar287'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {getRoleLabel(currentUser?.role)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenEditProfile}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#475569] text-xs font-bold border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t('Edit Profile', 'প্রোফাইল এডিট')}</span>
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#EF4444] border border-rose-200 cursor-pointer active:scale-95 transition-all"
                title={t('Log Out', 'লগআউট')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. MONTH MAPPING (DROPDOWN ACCORDION) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
        {/* Accordion Header - Click to expand/collapse */}
        <div
          onClick={() => setIsMonthMappingExpanded(!isMonthMappingExpanded)}
          className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#0F172A] tracking-tight">
                  Month Mapping
                </h3>
                {selectedMonth && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedMonth}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
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
              className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer border border-slate-200"
              title={isMonthMappingExpanded ? t('Collapse', 'হাইড করুন') : t('Expand', 'দেখুন')}
            >
              {isMonthMappingExpanded ? (
                <ChevronUp className="w-4 h-4 text-indigo-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsable Content Body */}
        {isMonthMappingExpanded && (
          <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 space-y-3.5 animate-fadeIn">
            {/* Top Action Bar inside Accordion: Add Range Button */}
            <div className="flex items-center justify-between pt-3 pb-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
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
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isAddingMapping ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-500" />
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
              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3 transition-all animate-fadeIn">
                <div className="flex items-center justify-between border-b border-indigo-100/80 pb-2">
                  <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                    {editingMappingId ? t('Edit Range Mapping', 'রেঞ্জ ম্যপিং এডিট') : t('New Range Mapping', 'নতুন রেঞ্জ ম্যাপিং')}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsAddingMapping(false); setEditingMappingId(null); }}
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                  >
                    {t('Cancel', 'বাতিল')}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Month Label</label>
                    <input
                      type="text"
                      value={newMappingLabel}
                      onChange={e => setNewMappingLabel(e.target.value)}
                      placeholder="e.g. Oct-2026"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newMappingStart}
                      onChange={e => setNewMappingStart(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-[#0F172A] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">End Date</label>
                    <input
                      type="date"
                      value={newMappingEnd}
                      onChange={e => setNewMappingEnd(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-[#0F172A] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{t('Budget (৳)', 'বাজেট (৳)')}</label>
                    <input
                      type="number"
                      value={newMappingBudget}
                      onChange={e => setNewMappingBudget(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F172A] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newMappingIsDefault}
                      onChange={e => setNewMappingIsDefault(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{t('Make Default Month', 'ডিফল্ট মাস করুন')}</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveOrUpdateMapping}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-xs"
                  >
                    {t('Save Range', 'সংরক্ষণ করুন')}
                  </button>
                </div>
              </div>
            )}

            {/* List of Mappings */}
            <div className="space-y-2">
              {monthMappings.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 italic">
                  {t('No month range mappings added yet.', 'কোন মাস রেঞ্জ যোগ করা হয়নি।')}
                </div>
              ) : (
                monthMappings.map(m => {
                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        m.isDefault ? 'bg-amber-50/80 border-amber-200 shadow-2xs' : 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-[#0F172A]">
                            {m.label}
                          </span>
                          {m.isDefault && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              ⭐ Default
                            </span>
                          )}
                          {m.budget !== undefined && Number(m.budget) > 0 && (
                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ৳ {formatNumberLocale(Number(m.budget), lang)}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono font-medium block mt-0.5">
                          {m.startDate} ~ {m.endDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!m.isDefault && onSetDefaultMonth && (
                          <button
                            type="button"
                            onClick={() => onSetDefaultMonth(m.label)}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 cursor-pointer transition-all active:scale-95 shadow-2xs"
                          >
                            {t('Make Default', 'ডিফল্ট করুন')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditMapping(m)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors shadow-2xs"
                          title={t('Edit', 'এডিট')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMonthMapping(m.id)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 rounded-lg cursor-pointer hover:bg-rose-100 transition-colors shadow-2xs"
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

      {/* COMPACT ACTIONS & TOOLS (EXPORT ZIP, EXPORT JSON, IMPORT JSON, INSTALL APP/QR, APPS SCRIPT) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {/* Export ZIP */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            disabled={isExportingZip}
            className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition-all shadow-xs"
            title={t('Download Monthly Report (ZIP: PDF + Excel)', 'মাসিক রিপোর্ট ডাউনলোড (ZIP: PDF + Excel)')}
          >
            {isExportingZip ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
            ) : (
              <Archive className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">{t('Export ZIP', 'Export ZIP')}</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="py-2.5 px-2 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-xs"
            title={t('Export Backup (.json)', 'JSON ব্যাকআপ')}
          >
            <Download className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="truncate">{t('Export JSON', 'Export JSON')}</span>
          </button>

          {/* Import JSON */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-2 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-xs"
            title={t('Import Backup (.json)', 'JSON ইমপোর্ট')}
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">{t('Import JSON', 'Import JSON')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-xs"
            >
              <Smartphone className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span className="truncate">{t('Install App / QR Code', 'Install App / QR Code')}</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAppsScriptModal(true)}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">{t('Apps Script Code', 'Apps Script Code')}</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileImport}
          className="hidden"
        />
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
