import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  FileSpreadsheet,
  Calendar,
  Trash2,
  Plus,
  Edit3,
  ChevronDown,
  ChevronUp,
  EyeOff,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { AppUser, PocketAuditMetrics, Transaction } from '../types';
import { APP_VERSION, getAppLastUpdateTime } from '../utils/updateChecker';
import { cleanCategoryName } from '../utils/categoryUtils';
import { evaluateExpression } from '../utils/calcUtils';
import {
  normalizeDate,
  formatNumberLocale,
  formatCleanDateTime,
  cleanMappingLabel,
  getMonthKeyFromLabel,
  findMonthMapping
} from '../utils/dateUtils';
import { AppsScriptModal } from './Modals';

interface SettingsTabProps {
  currentUser: AppUser | null;
  transactions: Transaction[];
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
  selectedMonth: string;
  monthMappings: import('../types').MonthMapping[];
  onAddMonthMapping: (mapping: import('../types').MonthMapping) => void;
  onDeleteMonthMapping: (id: string) => void;
  onSetDefaultMonth?: (monthLabel: string) => void;
  onCheckForUpdates?: () => void;
  appLastUpdateTime?: string;
  pocketAuditMap?: Record<string, PocketAuditMetrics>;
  pocketAuditVersion?: number;
  onSavePocketAudit?: (month: string, metrics: PocketAuditMetrics) => void;
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
  transactions,
  lang,
  t,
  selectedMonth,
  monthMappings,
  onAddMonthMapping,
  onDeleteMonthMapping,
  onSetDefaultMonth,
  onCheckForUpdates,
  appLastUpdateTime,
  pocketAuditMap,
  pocketAuditVersion = 0,
  onSavePocketAudit
}) => {
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [currentAppUpdateTime, setCurrentAppUpdateTime] = useState<string>(() => getAppLastUpdateTime());

  useEffect(() => {
    setCurrentAppUpdateTime(getAppLastUpdateTime());
  }, [selectedMonth, transactions.length, appLastUpdateTime]);

  // Custom Month Mapping State
  const [isMonthMappingExpanded, setIsMonthMappingExpanded] = useState(false);
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [newMappingLabel, setNewMappingLabel] = useState('');
  const [newMappingStart, setNewMappingStart] = useState('');
  const [newMappingEnd, setNewMappingEnd] = useState('');
  const [newMappingBudget, setNewMappingBudget] = useState('');
  const [newMappingIsDefault, setNewMappingIsDefault] = useState(false);
  const [mappingError, setMappingError] = useState('');

  const handleStartEditMapping = (m: import('../types').MonthMapping) => {
    setMappingError('');
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
      setMappingError(t('Please fill all fields for custom month', 'সবগুলো ঘর পূরণ করুন'));
      return;
    }
    setMappingError('');
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

  // Show only 4-month window in Month Mapping UI: [current - 1 month ... current + 2 months]
  // All older/other month mappings remain preserved in Google Sheet & app state
  const { visibleMonthMappings, hiddenMappingsCount } = useMemo(() => {
    const now = new Date();
    const currentTotalMonths = now.getFullYear() * 12 + now.getMonth();
    const minMonth = currentTotalMonths - 1;
    const maxMonth = currentTotalMonths + 2;

    const getMappingMonths = (m: import('../types').MonthMapping): number | null => {
      const key = getMonthKeyFromLabel(m.label) || (m.startDate ? m.startDate.slice(0, 7) : '');
      const match = key.match(/^(\d{4})-(\d{1,2})/);
      if (!match) return null;
      const y = Number(match[1]);
      const mo = Number(match[2]);
      if (isNaN(y) || isNaN(mo) || mo < 1 || mo > 12) return null;
      return y * 12 + (mo - 1);
    };

    const filtered = monthMappings
      .filter(m => {
        const total = getMappingMonths(m);
        if (total === null) return false;
        return total >= minMonth && total <= maxMonth;
      })
      .sort((a, b) => (getMappingMonths(a) ?? 0) - (getMappingMonths(b) ?? 0));

    return {
      visibleMonthMappings: filtered,
      hiddenMappingsCount: Math.max(0, monthMappings.length - filtered.length)
    };
  }, [monthMappings]);

  // Full month stats for printing
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter(tx => normalizeDate(tx.date).startsWith(currentMonthPrefix));
  const monthInc = monthTransactions.reduce((acc, tx) => tx.type === 'Income' ? acc + evaluateExpression(tx.value) : acc, 0);
  const monthExp = monthTransactions.reduce((acc, tx) => tx.type === 'Expense' ? acc + evaluateExpression(tx.value) : acc, 0);
  const monthNet = monthInc - monthExp;

  // ----------------------------------------------------
  // MATRICS AMOUNT (ASSET RECONCILIATION) STATE & SHEET SYNC
  // ----------------------------------------------------
  const emptyMetrics: PocketAuditMetrics = {
    cityBank: '',
    bkash: '',
    nagad: '',
    cash: '',
    moneyBag: ''
  };

  const resolveRemotePocketAudit = (month: string): PocketAuditMetrics | null => {
    if (!pocketAuditMap || typeof pocketAuditMap !== 'object') return null;
    const cleanM = cleanMappingLabel(month) || month;
    const key = getMonthKeyFromLabel(cleanM);
    const candidates = [month, cleanM, key, '_default', 'default'].filter(Boolean);
    for (const c of candidates) {
      if (pocketAuditMap[c]) return pocketAuditMap[c];
      const matchKey = Object.keys(pocketAuditMap).find(k => k.toLowerCase() === c.toLowerCase());
      if (matchKey) return pocketAuditMap[matchKey];
    }
    return null;
  };

  const [metrics, setMetrics] = useState<PocketAuditMetrics>(() => {
    const remote = resolveRemotePocketAudit(selectedMonth);
    if (remote) return { ...emptyMetrics, ...remote };
    try {
      const userKey = currentUser?.username || 'user';
      const saved = localStorage.getItem(`app_matrics_amount_${userKey}_${selectedMonth}`);
      if (saved) return { ...emptyMetrics, ...JSON.parse(saved) };
      const fallback = localStorage.getItem(`app_matrics_amount_${userKey}`);
      if (fallback) return { ...emptyMetrics, ...JSON.parse(fallback) };
    } catch {}
    return { ...emptyMetrics };
  });

  const auditDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const auditDirtyRef = React.useRef(false);

  useEffect(() => {
    if (auditDirtyRef.current) return;
    const remote = resolveRemotePocketAudit(selectedMonth);
    const userKey = currentUser?.username || 'user';
    if (remote) {
      const next = { ...emptyMetrics, ...remote };
      setMetrics(next);
      try {
        localStorage.setItem(`app_matrics_amount_${userKey}_${selectedMonth}`, JSON.stringify(next));
      } catch {}
      return;
    }
    if (pocketAuditVersion > 0 && pocketAuditMap && Object.keys(pocketAuditMap).length === 0) {
      setMetrics({ ...emptyMetrics });
      try {
        localStorage.removeItem(`app_matrics_amount_${userKey}_${selectedMonth}`);
      } catch {}
      return;
    }
    try {
      const saved = localStorage.getItem(`app_matrics_amount_${userKey}_${selectedMonth}`);
      if (saved) {
        setMetrics({ ...emptyMetrics, ...JSON.parse(saved) });
        return;
      }
      const fallback = localStorage.getItem(`app_matrics_amount_${userKey}`);
      if (fallback) {
        setMetrics({ ...emptyMetrics, ...JSON.parse(fallback) });
        return;
      }
    } catch {}
    setMetrics({ ...emptyMetrics });
  }, [selectedMonth, currentUser?.username, pocketAuditMap, pocketAuditVersion]);

  const updateMetric = (field: 'cityBank' | 'bkash' | 'nagad' | 'cash' | 'moneyBag', value: string) => {
    auditDirtyRef.current = true;
    setMetrics(prev => {
      const next = { ...prev, [field]: value };
      try {
        const userKey = currentUser?.username || 'user';
        localStorage.setItem(`app_matrics_amount_${userKey}_${selectedMonth}`, JSON.stringify(next));
        localStorage.setItem(`app_matrics_amount_${userKey}`, JSON.stringify(next));
      } catch {}
      if (auditDebounceRef.current) clearTimeout(auditDebounceRef.current);
      auditDebounceRef.current = setTimeout(() => {
        auditDirtyRef.current = false;
        onSavePocketAudit?.(selectedMonth, next);
      }, 650);
      return next;
    });
  };

  const handleResetMetrics = () => {
    if (auditDebounceRef.current) clearTimeout(auditDebounceRef.current);
    auditDirtyRef.current = false;
    const empty = { ...emptyMetrics };
    setMetrics(empty);
    try {
      const userKey = currentUser?.username || 'user';
      localStorage.setItem(`app_matrics_amount_${userKey}_${selectedMonth}`, JSON.stringify(empty));
      localStorage.setItem(`app_matrics_amount_${userKey}`, JSON.stringify(empty));
    } catch {}
    onSavePocketAudit?.(selectedMonth, empty);
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
    activeMonthTransactions.reduce((acc, tx) => tx.type === 'Income' ? acc + evaluateExpression(tx.value) : acc, 0),
    [activeMonthTransactions]
  );
  const activeMonthExp = useMemo(() =>
    activeMonthTransactions.reduce((acc, tx) => tx.type === 'Expense' ? acc + evaluateExpression(tx.value) : acc, 0),
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
      {/* 0. MANUAL POCKET BALANCE AUDIT (COMPACT UPCOMING-3-MONTH STYLE SEGMENT) */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-md overflow-hidden animate-fadeIn">
        <div className="px-2.5 sm:px-3.5 py-2 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-2">
          <h3 className="text-[11px] sm:text-sm font-black text-[#F0FDFA]">
            Manual Pocket Balance Audit
          </h3>

          <button
            type="button"
            onClick={handleResetMetrics}
            className="text-[10px] sm:text-xs font-bold text-teal-300/90 hover:text-white flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg bg-[#0B3C39] hover:bg-teal-900/80 border border-teal-700/60 transition-colors active:scale-95 shrink-0"
            title="Reset"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#062423]/90 text-teal-300/90 border-b border-teal-800/80">
              <th
                scope="col"
                className="w-[52%] py-1.5 px-2 sm:px-3 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider border-r border-teal-800/60"
              >
                Source
              </th>
              <th
                scope="col"
                className="w-[48%] py-1.5 px-2 sm:px-3 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-right"
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-800/50 text-[10px] sm:text-xs text-[#F0FDFA]">
            {[
              { key: 'cityBank' as const, label: 'Bank' },
              { key: 'bkash' as const, label: 'Bkash' },
              { key: 'nagad' as const, label: 'Nagad' },
              { key: 'cash' as const, label: 'Cash' },
              { key: 'moneyBag' as const, label: 'Wallet' }
            ].map(row => (
              <tr key={row.key} className="hover:bg-teal-900/30 transition-colors">
                <td className="py-1 px-2 sm:px-3 border-r border-teal-800/60 font-semibold text-[#F0FDFA]">
                  {row.label}
                </td>
                <td className="py-0.5 px-1.5 sm:px-3 text-right">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={metrics[row.key]}
                    onChange={e => updateMetric(row.key, e.target.value)}
                    placeholder="0"
                    className="w-full h-6 sm:h-7 text-right font-mono font-bold px-2 bg-white border border-teal-700/70 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 text-[10px] sm:text-xs tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#062423] border-t-2 border-teal-700/80 text-[10px] sm:text-xs font-extrabold">
              <td className="py-1.5 px-2 sm:px-3 border-r border-teal-800/60 text-teal-200">
                Pocket In Total:
              </td>
              <td className="py-1.5 px-2 sm:px-3 text-right font-mono text-[#F0FDFA] tabular-nums">
                {formatNumberLocale(totalMatricsAmount, lang)}
              </td>
            </tr>
            <tr className="bg-[#062423] border-t border-teal-800/60 text-[10px] sm:text-xs font-extrabold">
              <td className="py-1.5 px-2 sm:px-3 border-r border-teal-800/60 text-teal-200">
                Apps Balance
              </td>
              <td className="py-1.5 px-2 sm:px-3 text-right font-mono text-[#F0FDFA] tabular-nums">
                {formatNumberLocale(activeMonthlyBalance, lang)}
              </td>
            </tr>
            <tr className="bg-[#041D1C] border-t border-teal-700/80 text-[10px] sm:text-xs font-black">
              <td className="py-1.5 px-2 sm:px-3 border-r border-teal-800/60 text-teal-100">
                Difference:
              </td>
              <td
                className={`py-1.5 px-2 sm:px-3 text-right font-mono tabular-nums ${
                  difference < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {difference >= 0 ? '+' : ''}
                {formatNumberLocale(difference, lang)}
              </td>
            </tr>
          </tfoot>
        </table>
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
        <AnimatePresence initial={false}>
        {isMonthMappingExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-teal-800/80"
          >
          <div className="p-4 sm:p-5 pt-0 space-y-3.5">
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
            <AnimatePresence initial={false}>
            {isAddingMapping && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="p-3.5 bg-[#062423] rounded-xl border border-teal-700/70 space-y-3"
              >
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
                      className="w-full bg-white border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-300/80 uppercase block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newMappingStart}
                      onChange={e => setNewMappingStart(e.target.value)}
                      className="w-full bg-white border border-teal-700/70 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-300/80 uppercase block mb-1">End Date</label>
                    <input
                      type="date"
                      value={newMappingEnd}
                      onChange={e => setNewMappingEnd(e.target.value)}
                      className="w-full bg-white border border-teal-700/70 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-300/80 uppercase block mb-1">{t('Budget', 'বাজেট')}</label>
                    <input
                      type="number"
                      value={newMappingBudget}
                      onChange={e => setNewMappingBudget(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full bg-white border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                {mappingError && (
                  <p className="text-[11px] font-semibold text-rose-300 bg-rose-950/60 border border-rose-800/60 rounded-lg px-2.5 py-1.5">
                    {mappingError}
                  </p>
                )}

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
              </motion.div>
            )}
            </AnimatePresence>

            {/* List of Mappings (Filtered to previous 1 + current + next 2 months) */}
            <div className="space-y-2">
              {visibleMonthMappings.length === 0 ? (
                <div className="py-4 text-center text-xs text-teal-300/60 italic">
                  {t('No recent or upcoming month mappings found.', 'সাম্প্রতিক বা আসন্ন কোনো মাস রেঞ্জ যোগ করা হয়নি।')}
                </div>
              ) : (
                visibleMonthMappings.map(m => {
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
              {hiddenMappingsCount > 0 && (
                <p className="text-[10.5px] text-teal-300/60 text-center pt-1 font-medium">
                  {t(
                    `${hiddenMappingsCount} older/other month mapping(s) safely stored in Sheet`,
                    `অন্যান্য ${formatNumberLocale(hiddenMappingsCount, lang)}টি মাস শিটে সংরক্ষিত আছে`
                  )}
                </p>
              )}
            </div>
          </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* 2. ACTIONS & TOOLS (SCRIPT, UPDATE) */}
      <div className="bg-[#0B3C39] rounded-2xl p-3 sm:p-4 border border-teal-800/80 shadow-sm space-y-0">
        <div className={`grid ${(currentUser?.username === 'abujar287' || currentUser?.role === 'super_admin') ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
          {/* 1. Google Apps Script */}
          {(currentUser?.username === 'abujar287' || currentUser?.role === 'super_admin') && (
            <button
              type="button"
              onClick={() => setShowAppsScriptModal(true)}
              className="min-h-[44px] py-2.5 px-2.5 bg-[#062423] hover:bg-teal-900/80 text-[#F0FDFA] rounded-xl text-xs font-bold border border-teal-700/70 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-colors"
              title={t('Apps Script Code', 'গুগল স্ক্রিপ্ট কোড')}
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="truncate">{t('Script', 'Script')}</span>
            </button>
          )}

          {/* 2. Check for Updates */}
          <button
            type="button"
            onClick={onCheckForUpdates}
            className="min-h-[44px] py-2.5 px-2.5 bg-[#062423] hover:bg-teal-900/80 text-[#F0FDFA] rounded-xl text-xs font-bold border border-teal-700/70 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-colors"
            title={t('Check for App Updates from GitHub', 'GitHub থেকে অ্যাপ আপডেট চেক করুন')}
          >
            <RefreshCw className="w-4 h-4 text-teal-300 shrink-0" />
            <span className="truncate">{t('Check Update', 'আপডেট চেক')}</span>
          </button>
        </div>
      </div>

      {/* 3. ACTIVE PROFILE OVERVIEW */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-sm overflow-hidden">
        {/* Active Profile Info Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
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
        </div>
      </div>

      {/* Small Clean Version Footer */}
      <div className="pt-3 pb-6 text-center select-none space-y-0.5">
        <p className="text-xs font-bold text-teal-300/80 tracking-wide font-mono">
          হাত খরচ - {APP_VERSION} {appLastUpdateTime || currentAppUpdateTime}
        </p>
        <p className="text-[10px] text-teal-400/50">
          Smart Personal Expense, Task Reminder & Budget Tracker
        </p>
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

      {/* Printable Full Month Overall Report (Hidden except in print mode) */}
      <div className="hidden print:block printable-container text-slate-900 bg-white p-4">
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
              হাত খরচ - Full Month Overall Report ({currentMonthPrefix})
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
              {monthTransactions.map((tx, idx) => (
                <tr key={tx.id ? `set_tx_${tx.id}_${idx}` : `set_tx_idx_${idx}`} className="border-b border-slate-200">
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
