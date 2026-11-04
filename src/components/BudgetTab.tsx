import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sliders,
  Plus,
  Search,
  Check,
  X,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';
import { Transaction } from '../types';
import { DEFAULT_INCOME_CATEGORIES } from '../constants';
import {
  normalizeDate,
  formatNumberLocale,
  findMonthMapping,
  getMonthKeyFromLabel
} from '../utils/dateUtils';
import { cleanCategoryName, getCategoryEmoji, getCategoryColor } from '../utils/categoryUtils';

export interface CategoryBudgetRow {
  category: string;
  budget: number;
  spend: number;
  remain: number;
}

interface BudgetTabProps {
  expenseCategories: string[];
  incomeCategories?: string[];
  transactions: Transaction[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
  currentTab: string;
  monthMappings: import('../types').MonthMapping[];
  onSaveBudget?: (
    monthLabel: string, 
    totalBudget: number, 
    categoryBudgets?: Record<string, number>,
    categoryRows?: CategoryBudgetRow[]
  ) => void;
}

export const BudgetTab: React.FC<BudgetTabProps> = ({
  expenseCategories,
  incomeCategories,
  transactions,
  selectedMonth,
  setSelectedMonth,
  lang,
  t,
  currentTab,
  monthMappings,
  onSaveBudget
}) => {
  const budgetStorageKey = `app_category_budgets_${currentTab}_${selectedMonth}`;
  const selectedCatsStorageKey = `app_selected_budget_cats_${currentTab}_${selectedMonth}`;

  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(budgetStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceTimerRef = useRef<any>(null);

  // Modal state for selecting categories for budget
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // Strictly filter to ONLY pure Expense categories (exclude all income categories)
  const validExpenseCategories = useMemo(() => {
    const incomeSet = new Set(
      (incomeCategories || DEFAULT_INCOME_CATEGORIES).map(c =>
        cleanCategoryName(c, 'en').toLowerCase().trim()
      )
    );
    const knownIncomeWords = [
      'salary', 'arrear', 'borrowed', 'borrowed money', 'business', 'bonus', 'other income', 'income',
      'বেতন', 'বকেয়া', 'ধার নেওয়া', 'ধার নেওয়া', 'ব্যবসা', 'বোনাস', 'অন্যান্য আয়', 'অন্যান্য আয়', 'আয়', 'আয়'
    ];

    const list: Array<{ rawName: string; cleanName: string }> = [];
    const seen = new Set<string>();

    (expenseCategories || []).forEach(cat => {
      const cleanEn = cleanCategoryName(cat, 'en');
      if (!cleanEn) return;
      const lower = cleanEn.toLowerCase();
      if (seen.has(lower) || incomeSet.has(lower)) return;
      for (const word of knownIncomeWords) {
        if (lower === word || lower.startsWith(word + ' ')) return;
      }
      seen.add(lower);
      list.push({
        rawName: cat,
        cleanName: cleanEn
      });
    });

    return list;
  }, [expenseCategories, incomeCategories]);

  // Selected categories that appear in the budget list
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(selectedCatsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  // Reload category budgets & selected list when selectedMonth or currentTab changes
  useEffect(() => {
    try {
      const savedBudgets = localStorage.getItem(`app_category_budgets_${currentTab}_${selectedMonth}`);
      if (savedBudgets) {
        setCategoryBudgets(JSON.parse(savedBudgets));
      } else {
        setCategoryBudgets({});
      }
    } catch {
      setCategoryBudgets({});
    }

    try {
      const savedCats = localStorage.getItem(`app_selected_budget_cats_${currentTab}_${selectedMonth}`);
      if (savedCats) {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed)) {
          // Keep only valid expense categories
          const validSet = new Set(validExpenseCategories.map(c => c.cleanName.toLowerCase()));
          const filtered = parsed.filter(c => validSet.has(c.toLowerCase()));
          setSelectedCategoryNames(filtered);
          return;
        }
      }
    } catch {}

    // If nothing saved for this month, default to categories that already have a budget > 0
    try {
      const savedBudgets = localStorage.getItem(`app_category_budgets_${currentTab}_${selectedMonth}`);
      if (savedBudgets) {
        const parsedB = JSON.parse(savedBudgets);
        const existingWithBudget = Object.keys(parsedB).filter(k => {
          const lower = k.toLowerCase();
          return Number(parsedB[k]) > 0 && validExpenseCategories.some(c => c.cleanName.toLowerCase() === lower);
        });
        if (existingWithBudget.length > 0) {
          setSelectedCategoryNames(existingWithBudget);
          return;
        }
      }
    } catch {}

    // Fallback default: select the first 5 expense categories
    const initialList = validExpenseCategories.slice(0, 5).map(c => c.cleanName);
    setSelectedCategoryNames(initialList);
    try {
      localStorage.setItem(`app_selected_budget_cats_${currentTab}_${selectedMonth}`, JSON.stringify(initialList));
    } catch {}
  }, [currentTab, selectedMonth, validExpenseCategories]);

  const currentMapping = useMemo(() => {
    return findMonthMapping(monthMappings, selectedMonth);
  }, [monthMappings, selectedMonth]);

  // Calculate actual spending per category for selected month (strictly expenses)
  const categorySpending = useMemo(() => {
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    const spendingMap: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.type !== 'Expense') return;
      const cleanDate = normalizeDate(tx.date);
      let isMatch = false;
      if (mapping) {
        isMatch = cleanDate >= mapping.startDate && cleanDate <= mapping.endDate;
      } else {
        const monthKey = getMonthKeyFromLabel(selectedMonth) || selectedMonth;
        isMatch = cleanDate.startsWith(monthKey);
      }

      if (isMatch) {
        const catEn = cleanCategoryName(tx.category, 'en');
        const catBn = cleanCategoryName(tx.category, 'bn');
        const raw = String(tx.category).trim();
        const val = Number(tx.value) || 0;

        spendingMap[catEn] = (spendingMap[catEn] || 0) + val;
        spendingMap[catEn.toLowerCase()] = (spendingMap[catEn.toLowerCase()] || 0) + val;
        if (catBn) {
          spendingMap[catBn] = (spendingMap[catBn] || 0) + val;
          spendingMap[catBn.toLowerCase()] = (spendingMap[catBn.toLowerCase()] || 0) + val;
        }
        if (raw) {
          spendingMap[raw] = (spendingMap[raw] || 0) + val;
          spendingMap[raw.toLowerCase()] = (spendingMap[raw.toLowerCase()] || 0) + val;
        }
      }
    });

    return spendingMap;
  }, [transactions, selectedMonth, monthMappings]);

  // Robust getter for category budget
  const getBudgetVal = (cat: string, budgetsMap: Record<string, number> = categoryBudgets) => {
    const en = cleanCategoryName(cat, 'en');
    const bn = cleanCategoryName(cat, 'bn');
    const raw = String(cat).trim();
    return Number(
      budgetsMap[en] ??
      budgetsMap[en.toLowerCase()] ??
      budgetsMap[bn] ??
      budgetsMap[bn.toLowerCase()] ??
      budgetsMap[raw] ??
      budgetsMap[raw.toLowerCase()] ??
      0
    ) || 0;
  };

  // Robust getter for category spending
  const getSpendVal = (cat: string) => {
    const en = cleanCategoryName(cat, 'en');
    const bn = cleanCategoryName(cat, 'bn');
    const raw = String(cat).trim();
    return Number(
      categorySpending[en] ??
      categorySpending[en.toLowerCase()] ??
      categorySpending[bn] ??
      categorySpending[bn.toLowerCase()] ??
      categorySpending[raw] ??
      categorySpending[raw.toLowerCase()] ??
      0
    ) || 0;
  };

  // Total budget & spending derived directly from selected categories
  const totalBudget = useMemo(() => {
    return selectedCategoryNames.reduce((sum, cName) => sum + getBudgetVal(cName), 0);
  }, [selectedCategoryNames, categoryBudgets]);

  const totalSpent = useMemo(() => {
    return selectedCategoryNames.reduce((sum, cName) => sum + getSpendVal(cName), 0);
  }, [selectedCategoryNames, categorySpending]);

  const remainingBudget = totalBudget - totalSpent;

  // Sort selected categories DESC by (spend + budget)
  const sortedSelectedCategories = useMemo(() => {
    return [...selectedCategoryNames].sort((a, b) => {
      const bSpend = getSpendVal(b);
      const bBudget = getBudgetVal(b);
      const bTotal = bSpend + bBudget; // spend + budget যোগফল

      const aSpend = getSpendVal(a);
      const aBudget = getBudgetVal(a);
      const aTotal = aSpend + aBudget; // spend + budget যোগফল

      // Descending order: highest (spend + budget) at top
      if (bTotal !== aTotal) {
        return bTotal - aTotal;
      }
      if (bSpend !== aSpend) {
        return bSpend - aSpend;
      }
      if (bBudget !== aBudget) {
        return bBudget - aBudget;
      }
      return cleanCategoryName(a, 'en').localeCompare(cleanCategoryName(b, 'en'));
    });
  }, [selectedCategoryNames, categoryBudgets, categorySpending]);

  // Auto-save budget handler - writes selected categories to Google Sheet sorted DESC
  const handlePerformSave = (
    newCatBudgets?: Record<string, number>,
    newSelectedCats?: string[]
  ) => {
    const catsToUse = newCatBudgets || categoryBudgets;
    const baseList = newSelectedCats || sortedSelectedCategories;

    // Keep rows in exact descending order of (spend + budget)
    const sortedList = [...baseList].sort((a, b) => {
      const bS = getSpendVal(b);
      const bB = getBudgetVal(b, catsToUse);
      const aS = getSpendVal(a);
      const aB = getBudgetVal(a, catsToUse);
      return (bS + bB) - (aS + aB);
    });

    const catSum = sortedList.reduce((sum, cName) => sum + getBudgetVal(cName, catsToUse), 0);

    const categoryRows: CategoryBudgetRow[] = sortedList.map(cName => {
      const cleanPlainName = cleanCategoryName(cName, 'en') || cName;
      const b = getBudgetVal(cName, catsToUse);
      const s = getSpendVal(cName);
      const r = b - s;
      return {
        category: cleanPlainName,
        budget: b,
        spend: s,
        remain: r
      };
    });

    setSaveStatus('saving');
    if (onSaveBudget) {
      setTimeout(() => {
        onSaveBudget(selectedMonth, catSum, catsToUse, categoryRows);
      }, 0);
    }
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 400);
  };

  const handleBudgetChange = (category: string, value: string) => {
    const num = parseFloat(value) || 0;
    const cleanPlainName = cleanCategoryName(category, 'en') || category;
    const updated = { ...categoryBudgets, [cleanPlainName]: num };
    setCategoryBudgets(updated);
    try {
      localStorage.setItem(`app_category_budgets_${currentTab}_${selectedMonth}`, JSON.stringify(updated));
    } catch {}

    // Auto store to sheet with 700ms debounce
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      handlePerformSave(updated, selectedCategoryNames);
    }, 700);
  };

  // Toggle category inclusion in active budget list
  const handleToggleCategory = (cleanName: string) => {
    const exists = selectedCategoryNames.includes(cleanName);
    const next = exists
      ? selectedCategoryNames.filter(c => c !== cleanName)
      : [...selectedCategoryNames, cleanName];
    setSelectedCategoryNames(next);
    try {
      localStorage.setItem(`app_selected_budget_cats_${currentTab}_${selectedMonth}`, JSON.stringify(next));
    } catch {}
    handlePerformSave(categoryBudgets, next);
  };

  // Select all expense categories
  const handleSelectAll = () => {
    const allNames = validExpenseCategories.map(c => c.cleanName);
    setSelectedCategoryNames(allNames);
    try {
      localStorage.setItem(`app_selected_budget_cats_${currentTab}_${selectedMonth}`, JSON.stringify(allNames));
    } catch {}
    handlePerformSave(categoryBudgets, allNames);
  };

  // Deselect / Clear all categories
  const handleDeselectAll = () => {
    setSelectedCategoryNames([]);
    try {
      localStorage.setItem(`app_selected_budget_cats_${currentTab}_${selectedMonth}`, JSON.stringify([]));
    } catch {}
    handlePerformSave(categoryBudgets, []);
  };

  // Remove category from active budget list
  const handleRemoveCategory = (cleanName: string) => {
    const next = selectedCategoryNames.filter(c => c !== cleanName);
    setSelectedCategoryNames(next);
    try {
      localStorage.setItem(`app_selected_budget_cats_${currentTab}_${selectedMonth}`, JSON.stringify(next));
    } catch {}
    handlePerformSave(categoryBudgets, next);
  };

  // Filtered categories for the selection modal
  const filteredModalCategories = useMemo(() => {
    const query = modalSearch.toLowerCase().trim();
    if (!query) return validExpenseCategories;
    return validExpenseCategories.filter(cat => {
      const enMatch = cat.cleanName.toLowerCase().includes(query);
      const rawMatch = cat.rawName.toLowerCase().includes(query);
      const bnMatch = cleanCategoryName(cat.cleanName, 'bn').toLowerCase().includes(query);
      return enMatch || rawMatch || bnMatch;
    });
  }, [validExpenseCategories, modalSearch]);

  // Month shift helper
  const handleShiftMonth = (delta: number) => {
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    if (mapping) {
      const mappingIdx = monthMappings.findIndex(m => m.id === mapping.id || m.label === mapping.label);
      if (mappingIdx !== -1) {
        const nextIdx = mappingIdx + delta;
        if (nextIdx >= 0 && nextIdx < monthMappings.length) {
          setSelectedMonth(monthMappings[nextIdx].label);
          return;
        }
      }
    }

    const monthKey = getMonthKeyFromLabel(selectedMonth) || selectedMonth;
    if (monthKey.includes('-')) {
      const [y, m] = monthKey.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        const d = new Date(y, m - 1 + delta, 1);
        const ny = d.getFullYear();
        const nm = String(d.getMonth() + 1).padStart(2, '0');
        const nextVal = `${ny}-${nm}`;
        const targetMap = findMonthMapping(monthMappings, nextVal);
        setSelectedMonth(targetMap ? targetMap.label : nextVal);
        return;
      }
    }
  };

  // Month dropdown options
  const monthOptions = useMemo(() => {
    const opts: { val: string; label: string }[] = [];
    const mappedMonthKeys = new Set<string>();
    
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

  const allSelected = validExpenseCategories.length > 0 && selectedCategoryNames.length === validExpenseCategories.length;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fadeIn pb-16">
      {/* MONTH SELECTOR BAR */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => handleShiftMonth(-1)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer active:scale-95 transition-all border border-slate-200 shrink-0"
          title={t('Previous Month', 'পূর্ববর্তী মাস')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <div className="flex items-center gap-2 max-w-full">
            <Calendar className="w-4 h-4 text-[#475569] shrink-0" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-[13px] font-bold text-[#0F172A] uppercase tracking-wide focus:outline-none cursor-pointer truncate max-w-full"
            >
              {monthOptions.map(m => (
                <option key={m.val} value={m.val} className="bg-white text-[#0F172A] normal-case">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {currentMapping && (
            <span className="text-[10px] text-slate-500 font-mono truncate">
              {currentMapping.startDate} ~ {currentMapping.endDate}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleShiftMonth(1)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer active:scale-95 transition-all border border-slate-200 shrink-0"
          title={t('Next Month', 'পরবর্তী মাস')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* BUDGET OVERVIEW CARDS */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
          <span className="text-[10px] text-slate-500 font-semibold block mb-1">
            {t('Total Budget', 'মোট বাজেট')}
          </span>
          <span className="text-sm sm:text-base font-extrabold text-[#0F172A] tabular-nums">
            {formatNumberLocale(totalBudget, lang)}
          </span>
        </div>

        <div className="bg-rose-50/50 rounded-2xl p-3 border border-rose-200 shadow-sm">
          <span className="text-[10px] text-rose-600 font-semibold block mb-1">
            {t('Total Spent', 'মোট খরচ')}
          </span>
          <span className="text-sm sm:text-base font-extrabold text-[#EF4444] tabular-nums">
            {formatNumberLocale(totalSpent, lang)}
          </span>
        </div>

        <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-200 shadow-sm">
          <span className="text-[10px] text-emerald-700 font-semibold block mb-1">
            {t('Remaining', 'অবশিষ্ট')}
          </span>
          <span className={`text-sm sm:text-base font-extrabold tabular-nums ${remainingBudget >= 0 ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
            {remainingBudget >= 0 ? '+' : ''}{formatNumberLocale(remainingBudget, lang)}
          </span>
        </div>
      </div>

      {/* CATEGORY-WISE BUDGET LIST */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-slate-100 text-[#475569] flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-tight truncate">
                {t('Selected Expense Budgets', 'নির্বাচিত খরচের বাজেট')}
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">
                {selectedCategoryNames.length} {t('expense categories active', 'টি খরচের ক্যাটাগরি যুক্ত')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold animate-pulse">
                <div className="w-2.5 h-2.5 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
                <span>{t('Saving to Sheet...', 'শিটে সেভ হচ্ছে...')}</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('Auto Saved to Sheet ✓', 'অটো সেভ হয়েছে ✓')}</span>
              </div>
            )}

            {/* SINGLE + BUTTON ON THE RIGHT OF THE HEADER LINE */}
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs"
              title={t('Select Expense Categories', 'খরচের ক্যাটাগরি বাছুন')}
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* ACTIVE BUDGET ITEMS - PURE TEXT ONLY (NO ICONS IN FRONT) */}
        {sortedSelectedCategories.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">
            {t('No categories selected. Tap + above to select categories.', 'কোনো ক্যাটাগরি নির্বাচিত নেই। ক্যাটাগরি বাছতে উপরের + বাটনে চাপুন।')}
          </p>
        ) : (
          <div className="space-y-2.5 pt-1">
            {sortedSelectedCategories.map(catClean => {
              const budgetVal = getBudgetVal(catClean);
              const spentVal = getSpendVal(catClean);
              const pct = budgetVal > 0 ? Math.min(100, (spentVal / budgetVal) * 100) : 0;
              const isOver = budgetVal > 0 && spentVal > budgetVal;
              const emoji = getCategoryEmoji(catClean);
              const circleColor = getCategoryColor(catClean);

              return (
                <div
                  key={catClean}
                  className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl transition-all shadow-2xs space-y-2.5 group"
                >
                  {/* ROW 1: [Icon] [Category Name]        [% of used] [x] */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Icon circle matching DetailsTab */}
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg shrink-0 shadow-2xs ${circleColor} text-slate-900 border border-slate-200/50`}>
                        {emoji}
                      </div>
                      <span className="font-bold text-[#0F172A] text-xs sm:text-sm truncate">
                        {cleanCategoryName(catClean, lang)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* % of used */}
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                          isOver
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : budgetVal > 0
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : 'text-slate-400 bg-slate-50'
                        }`}
                      >
                        {budgetVal > 0 ? `${pct.toFixed(0)}% ${t('used', 'ব্যবহৃত')}` : `--% ${t('used', 'ব্যবহৃত')}`}
                      </span>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(catClean)}
                        className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
                        title={t('Remove from budget', 'বাজেট থেকে বাদ দিন')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* ROW 2: Spend: XXX   Remain: +YYY    Budget [input] */}
                  <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                    <div className="flex items-center gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium text-[10px] block leading-none mb-0.5">
                          {t('Spend:', 'খরচ:')}
                        </span>
                        <strong className="text-[#EF4444] font-bold tabular-nums">
                          {formatNumberLocale(spentVal, lang)}
                        </strong>
                      </div>

                      <div className="h-5 w-[1px] bg-slate-200" />

                      <div>
                        <span className="text-slate-400 font-medium text-[10px] block leading-none mb-0.5">
                          {t('Remain:', 'অবশিষ্ট:')}
                        </span>
                        <strong
                          className={`tabular-nums font-bold ${
                            budgetVal - spentVal >= 0 ? 'text-[#16A34A]' : 'text-[#EF4444]'
                          }`}
                        >
                          {budgetVal > 0 ? (
                            <>
                              {budgetVal - spentVal >= 0 ? '+' : ''}
                              {formatNumberLocale(budgetVal - spentVal, lang)}
                            </>
                          ) : (
                            '-'
                          )}
                        </strong>
                      </div>
                    </div>

                    {/* Budget Input */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {t('Budget', 'বাজেট')}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={budgetVal || ''}
                        onChange={e => {
                          const cleanVal = e.target.value.replace(/[^0-9.]/g, '');
                          handleBudgetChange(catClean, cleanVal);
                        }}
                        onBlur={() => {
                          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                          handlePerformSave();
                        }}
                        placeholder="0"
                        className="w-20 sm:w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-[#0F172A] text-right font-bold focus:outline-none focus:border-slate-400 focus:bg-white tabular-nums shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* ROW 3: Sleek Progress Bar */}
                  {budgetVal > 0 && (
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isOver ? 'bg-[#EF4444] animate-pulse' : 'bg-[#16A34A]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CATEGORY SELECTION MODAL - ONLY EXPENSE CATEGORIES & SELECT ALL OPTION */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden">
            {/* MODAL HEADER */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/60">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-slate-600" />
                  <span>{t('Select Expense Categories', 'খরচের ক্যাটাগরি নির্বাচন করুন')}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t(
                    'Pick which expense categories to include in this month’s budget',
                    'এই মাসের বাজেটে কোন কোন খরচের ক্যাটাগরি রাখবেন তা নির্বাচন করুন'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SEARCH & SELECT ALL / CLEAR ALL ACTION BAR */}
            <div className="p-3 border-b border-slate-100 space-y-2.5 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder={t('Search expense category...', 'খরচের ক্যাটাগরি খুঁজুন...')}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#0F172A] focus:outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              {/* SELECT ALL / DESELECT ALL BUTTONS */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      allSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{t('Select All', 'সবগুলো সিলেক্ট করুন')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-all"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('Clear All', 'সব মুছুন')}</span>
                  </button>
                </div>

                <span className="text-[11px] font-bold text-slate-600 tabular-nums">
                  {selectedCategoryNames.length}/{validExpenseCategories.length} {t('selected', 'নির্বাচিত')}
                </span>
              </div>
            </div>

            {/* CATEGORIES LIST - PURE PLAIN TEXT (NO ICONS IN FRONT) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-slate-100">
              {filteredModalCategories.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {t('No expense categories found', 'কোনো খরচের ক্যাটাগরি পাওয়া যায়নি')}
                </div>
              ) : (
                filteredModalCategories.map(cat => {
                  const isSelected = selectedCategoryNames.includes(cat.cleanName);

                  return (
                    <div
                      key={cat.cleanName}
                      onClick={() => handleToggleCategory(cat.cleanName)}
                      className={`pt-1.5 first:pt-0 pb-1.5 flex items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-100/90 font-medium'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Checkbox indicator */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        {/* PURE PLAIN TEXT CATEGORY NAME (NO ICON PREPENDED) */}
                        <span className="text-xs text-[#0F172A] font-semibold truncate block">
                          {cleanCategoryName(cat.cleanName, lang)}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {isSelected ? t('Active', 'যুক্ত') : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                <strong className="text-slate-800">{selectedCategoryNames.length}</strong> {t('categories in budget', 'টি খরচের ক্যাটাগরি বাজেটে যুক্ত')}
              </div>

              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-sm"
              >
                {t('Done', 'সম্পন্ন')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
