import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    categoryRows?: CategoryBudgetRow[],
    removedCategories?: string[]
  ) => void;
  onDeleteCategoryFromSheet?: (catName: string) => void;
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
  onSaveBudget,
  onDeleteCategoryFromSheet
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

  // Expense categories for budget selection
  const validExpenseCategories = useMemo(() => {
    const list: Array<{ rawName: string; cleanName: string }> = [];
    const seen = new Set<string>();

    (expenseCategories || []).forEach(cat => {
      const cleanEn = cleanCategoryName(cat, 'en') || cat;
      const lower = cleanEn.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      list.push({
        rawName: cat,
        cleanName: cleanEn
      });
    });

    return list;
  }, [expenseCategories]);

  // Selected categories that appear in the budget list
  const [selectedCategoryNames, setSelectedCategoryNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(selectedCatsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const currentMapping = useMemo(() => {
    return findMonthMapping(monthMappings, selectedMonth);
  }, [monthMappings, selectedMonth]);

  // Calculate actual spending per category strictly within month mapping date range
  const categorySpending = useMemo(() => {
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    const spendingMap: Record<string, number> = {};

    let sDate = '';
    let eDate = '';
    if (mapping && mapping.startDate && mapping.endDate) {
      const normS = normalizeDate(mapping.startDate);
      const normE = normalizeDate(mapping.endDate);
      sDate = normS <= normE ? normS : normE;
      eDate = normS <= normE ? normE : normS;
    }

    transactions.forEach(tx => {
      const isExpense = String(tx.type || '').toLowerCase().includes('exp') || String(tx.type || '').includes('খরচ');
      if (!isExpense) return;

      const txDate = normalizeDate(tx.date);
      let isMatch = false;

      if (sDate && eDate) {
        isMatch = txDate >= sDate && txDate <= eDate;
      } else {
        const monthKey = getMonthKeyFromLabel(selectedMonth) || selectedMonth;
        isMatch = txDate.startsWith(monthKey);
      }

      if (isMatch) {
        const val = Number(tx.value) || 0;
        if (val <= 0) return;

        const raw = String(tx.category || '').trim();
        const en = cleanCategoryName(tx.category, 'en');
        const bn = cleanCategoryName(tx.category, 'bn');

        const keys = new Set<string>();
        if (raw) {
          keys.add(raw);
          keys.add(raw.toLowerCase());
          keys.add(raw.toLowerCase().replace(/[^a-z0-9]/g, ''));
        }
        if (en) {
          keys.add(en);
          keys.add(en.toLowerCase());
          keys.add(en.toLowerCase().replace(/[^a-z0-9]/g, ''));
        }
        if (bn) {
          keys.add(bn);
          keys.add(bn.toLowerCase());
        }

        keys.forEach(k => {
          spendingMap[k] = (spendingMap[k] || 0) + val;
        });
      }
    });

    return spendingMap;
  }, [transactions, selectedMonth, monthMappings]);

  // Robust getter for category spending
  const getSpendVal = useCallback((cat: string, spendingMap: Record<string, number> = categorySpending) => {
    const en = cleanCategoryName(cat, 'en');
    const bn = cleanCategoryName(cat, 'bn');
    const raw = String(cat).trim();
    const alpha = en.toLowerCase().replace(/[^a-z0-9]/g, '');

    const candidates = [
      en,
      en.toLowerCase(),
      alpha,
      bn,
      bn.toLowerCase(),
      raw,
      raw.toLowerCase()
    ];

    for (const key of candidates) {
      if (key && spendingMap[key] !== undefined && Number(spendingMap[key]) > 0) {
        return Number(spendingMap[key]);
      }
    }
    return 0;
  }, [categorySpending]);

  // Reload category budgets & selected list when selectedMonth or currentTab changes
  useEffect(() => {
    let loadedBudgets: Record<string, number> = {};
    try {
      const savedBudgets = localStorage.getItem(`app_category_budgets_${currentTab}_${selectedMonth}`);
      if (savedBudgets) {
        loadedBudgets = JSON.parse(savedBudgets);
        setCategoryBudgets(loadedBudgets);
      } else {
        setCategoryBudgets({});
      }
    } catch {
      setCategoryBudgets({});
    }

    // Default ONLY to categories where costing occurred in the selected month or budget > 0
    const activeCategories = validExpenseCategories
      .map(c => c.cleanName)
      .filter(name => getSpendVal(name) > 0 || (loadedBudgets[name] && loadedBudgets[name] > 0));

    setSelectedCategoryNames(activeCategories);
    try {
      localStorage.setItem(`app_selected_budget_cats_${currentTab}_${selectedMonth}`, JSON.stringify(activeCategories));
    } catch {}
  }, [currentTab, selectedMonth, validExpenseCategories, getSpendVal]);

  // Robust getter for category budget
  const getBudgetVal = useCallback((cat: string, budgetsMap: Record<string, number> = categoryBudgets) => {
    const en = cleanCategoryName(cat, 'en');
    const bn = cleanCategoryName(cat, 'bn');
    const raw = String(cat).trim();
    const alpha = en.toLowerCase().replace(/[^a-z0-9]/g, '');

    const candidates = [
      en,
      en.toLowerCase(),
      alpha,
      bn,
      bn.toLowerCase(),
      raw,
      raw.toLowerCase()
    ];

    for (const key of candidates) {
      if (key && budgetsMap[key] !== undefined && Number(budgetsMap[key]) > 0) {
        return Number(budgetsMap[key]);
      }
    }
    return 0;
  }, [categoryBudgets]);

  // Derive visible categories: ALL valid expense categories from mapped expenseCategories (validExpenseCategories)
  const visibleCategories = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    validExpenseCategories.forEach(c => {
      const canonicalName = c.cleanName;
      const lower = canonicalName.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      list.push(canonicalName);
    });

    return list;
  }, [validExpenseCategories]);

  // Total budget & spending derived directly from visible categories
  const totalBudget = useMemo(() => {
    return visibleCategories.reduce((sum, cName) => sum + getBudgetVal(cName), 0);
  }, [visibleCategories, categoryBudgets]);

  const totalSpent = useMemo(() => {
    return visibleCategories.reduce((sum, cName) => sum + getSpendVal(cName), 0);
  }, [visibleCategories, categorySpending]);

  const remainingBudget = totalBudget - totalSpent;

  // Sort visible categories DESC by (spend + budget)
  const sortedSelectedCategories = useMemo(() => {
    return [...visibleCategories].sort((a, b) => {
      const bSpend = getSpendVal(b);
      const bBudget = getBudgetVal(b);
      const bTotal = bSpend + bBudget;

      const aSpend = getSpendVal(a);
      const aBudget = getBudgetVal(a);
      const aTotal = aSpend + aBudget;

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
  }, [visibleCategories, categoryBudgets, categorySpending]);

  // Auto-save budget handler - writes selected categories to Google Sheet sorted DESC
  const handlePerformSave = (
    newCatBudgets?: Record<string, number>,
    newSelectedCats?: string[],
    removedCats?: string[]
  ) => {
    const catsToUse = { ...(newCatBudgets || categoryBudgets) };

    if (removedCats && removedCats.length > 0) {
      removedCats.forEach(r => {
        catsToUse[r] = 0;
        const clean = cleanCategoryName(r, 'en') || r;
        catsToUse[clean] = 0;
      });
    }

    // Collect all candidate categories:
    const catSet = new Set<string>();

    Object.keys(catsToUse).forEach(k => {
      if (Number(catsToUse[k]) > 0) {
        const clean = cleanCategoryName(k, 'en') || k;
        catSet.add(clean);
      }
    });

    const explicitList = newSelectedCats !== undefined ? newSelectedCats : selectedCategoryNames;
    explicitList.forEach(c => {
      const clean = cleanCategoryName(c, 'en') || c;
      if (!removedCats || !removedCats.includes(clean)) {
        catSet.add(clean);
      }
    });

    visibleCategories.forEach(c => {
      const clean = cleanCategoryName(c, 'en') || c;
      if (!removedCats || !removedCats.includes(clean)) {
        catSet.add(clean);
      }
    });

    const validLowerSet = new Set(validExpenseCategories.map(c => c.cleanName.toLowerCase()));

    const activeList = Array.from(catSet).filter(c => {
      const clean = (cleanCategoryName(c, 'en') || c).toLowerCase();
      if (!validLowerSet.has(clean) && !validLowerSet.has(c.toLowerCase())) return false;
      if (removedCats && removedCats.includes(c)) return false;
      return getBudgetVal(c, catsToUse) > 0 || getSpendVal(c) > 0 || explicitList.includes(c);
    });

    // Keep rows in exact descending order of (spend + budget)
    const sortedList = [...activeList].sort((a, b) => {
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

    // Explicitly add any removed categories with budget: 0 to categoryRows so the sheet clears the row
    if (removedCats && removedCats.length > 0) {
      removedCats.forEach(r => {
        const cleanPlainName = cleanCategoryName(r, 'en') || r;
        categoryRows.push({
          category: cleanPlainName,
          budget: 0,
          spend: getSpendVal(cleanPlainName),
          remain: 0 - getSpendVal(cleanPlainName)
        });
      });
    }

    setSaveStatus('saving');
    if (onSaveBudget) {
      onSaveBudget(selectedMonth, catSum, catsToUse, categoryRows, removedCats);
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

    // Auto store to sheet with 600ms debounce
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      handlePerformSave(updated);
    }, 600);
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
    handlePerformSave(categoryBudgets, next, exists ? [cleanName] : []);
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
    handlePerformSave(categoryBudgets, [], selectedCategoryNames);
  };

  // Remove category from active budget list (sets budget to 0 for this month without deleting master category from Google Sheet)
  const handleRemoveCategory = (cleanName: string) => {
    const next = selectedCategoryNames.filter(c => c !== cleanName);
    setSelectedCategoryNames(next);
    const updatedBudgets = { ...categoryBudgets, [cleanName]: 0 };
    setCategoryBudgets(updatedBudgets);
    try {
      localStorage.setItem(`app_category_budgets_${currentTab}_${selectedMonth}`, JSON.stringify(updatedBudgets));
      localStorage.setItem(`app_selected_budget_cats_${currentTab}_${selectedMonth}`, JSON.stringify(next));
    } catch {}
    handlePerformSave(updatedBudgets, next, [cleanName]);
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
      <div className="bg-[#0B3C39] rounded-2xl p-3.5 border border-teal-800/80 shadow-sm flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => handleShiftMonth(-1)}
          className="p-2 rounded-xl bg-teal-900/70 hover:bg-teal-800 text-teal-200 cursor-pointer active:scale-95 transition-all border border-teal-700/60 shrink-0"
          title={t('Previous Month', 'পূর্ববর্তী মাস')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <div className="flex items-center gap-2 max-w-full">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-[13px] font-bold text-[#F0FDFA] uppercase tracking-wide focus:outline-none cursor-pointer truncate max-w-full"
            >
              {monthOptions.map(m => (
                <option key={m.val} value={m.val} className="bg-[#042F2E] text-[#F0FDFA] normal-case">
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {currentMapping && (
            <span className="text-[10px] text-teal-300/80 font-mono truncate">
              {currentMapping.startDate} ~ {currentMapping.endDate}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleShiftMonth(1)}
          className="p-2 rounded-xl bg-teal-900/70 hover:bg-teal-800 text-teal-200 cursor-pointer active:scale-95 transition-all border border-teal-700/60 shrink-0"
          title={t('Next Month', 'পরবর্তী মাস')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* BUDGET OVERVIEW CARDS */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#0B3C39] rounded-2xl p-3 border border-teal-800/80 shadow-sm">
          <span className="text-[10px] text-teal-300/80 font-semibold block mb-1">
            {t('Total Budget', 'মোট বাজেট')}
          </span>
          <span className="text-sm sm:text-base font-extrabold text-[#F0FDFA] tabular-nums">
            {formatNumberLocale(totalBudget, lang)}
          </span>
        </div>

        <div className="bg-rose-950/50 rounded-2xl p-3 border border-rose-800/60 shadow-sm">
          <span className="text-[10px] text-rose-200 font-semibold block mb-1">
            {t('Total Spent', 'মোট খরচ')}
          </span>
          <span className="text-sm sm:text-base font-extrabold text-[#FF5252] tabular-nums">
            {formatNumberLocale(totalSpent, lang)}
          </span>
        </div>

        <div className="bg-emerald-950/50 rounded-2xl p-3 border border-emerald-800/60 shadow-sm">
          <span className="text-[10px] text-emerald-200 font-semibold block mb-1">
            {t('Remaining', 'অবশিষ্ট')}
          </span>
          <span className={`text-sm sm:text-base font-extrabold tabular-nums ${remainingBudget >= 0 ? 'text-[#34D399]' : 'text-[#FF5252]'}`}>
            {remainingBudget >= 0 ? '+' : ''}{formatNumberLocale(remainingBudget, lang)}
          </span>
        </div>
      </div>

      {/* CATEGORY-WISE BUDGET LIST */}
      <div className="space-y-3">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between px-1 pb-1 border-b border-teal-800/60 gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-[#062423] text-emerald-400 flex items-center justify-center shrink-0 border border-teal-700/60 shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-extrabold text-[#F0FDFA] uppercase tracking-tight truncate">
                {t('Costing Expense Categories', 'এই মাসে খরচ হওয়া ক্যাটাগরি')}
              </h3>
              <p className="text-[10px] text-teal-300/80 font-mono">
                {sortedSelectedCategories.length} {t('categories with cost this month', 'টি ক্যাটাগরিতে এই মাসে খরচ হয়েছে')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-2.5 py-1 bg-teal-800 hover:bg-teal-700 text-teal-100 border border-teal-600/80 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('Add Category', 'ক্যাটাগরি যোগ')}</span>
            </button>

            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] font-semibold animate-pulse">
                <div className="w-2.5 h-2.5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                <span>{t('Saving...', 'সেভ হচ্ছে...')}</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-[11px] font-semibold animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('Saved ✓', 'সেভ হয়েছে ✓')}</span>
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE BUDGET ITEMS - 2-ROW COMPACT CARDS */}
        {sortedSelectedCategories.length === 0 ? (
          <div className="text-center py-8 px-4 space-y-3 bg-[#0B3C39] rounded-2xl border border-teal-800/80">
            <p className="text-xs text-teal-200/90 font-medium">
              {t('No expenses recorded for this month yet. Only categories with costing will appear.', 'এই মাসে এখনো কোনো খরচ লিপিবদ্ধ করা হয়নি। শুধুমাত্র যেসব ক্যাটাগরিতে খরচ হবে সেগুলোই এখানে আসবে।')}
            </p>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('Set Budget / Add Category', 'ক্যাটাগরি বাছুন ও বাজেট দিন')}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-0.5">
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
                  className="bg-[#0B3C39] border border-teal-800/80 hover:border-teal-700/90 rounded-2xl p-3 transition-all shadow-xs space-y-2.5 group"
                >
                  {/* ROW 1: CATEGORY NAME & REMOVE BUTTON */}
                  <div className="flex items-center justify-between gap-2 border-b border-teal-800/60 pb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base shrink-0 shadow-2xs ${circleColor} text-slate-900 border border-teal-600/60`}>
                        {emoji}
                      </div>
                      <span className="font-extrabold text-[#F0FDFA] text-xs sm:text-sm truncate">
                        {cleanCategoryName(catClean, lang)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(catClean)}
                      className="w-6 h-6 rounded-lg text-teal-300/60 hover:text-[#FF5252] hover:bg-rose-950/40 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                      title={t('Remove from budget', 'বাজেট থেকে বাদ দিন')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* ROW 2: BUDGET INPUT, SPENT, REMAIN, % */}
                  <div className="grid grid-cols-4 gap-2 items-center text-center">
                    {/* 1. Budget Input */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9.5px] font-bold text-teal-300/80 uppercase block mb-1">
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
                        className="w-full max-w-[80px] bg-[#062423] border border-teal-700/70 rounded-lg px-2 py-1 text-xs text-[#F0FDFA] text-right font-bold focus:outline-none focus:border-teal-400 tabular-nums shadow-2xs"
                      />
                    </div>

                    {/* 2. Spent */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9.5px] font-bold text-teal-300/80 uppercase block mb-1">
                        {t('Spent', 'খরচ')}
                      </span>
                      <span className="font-extrabold text-[#FF5252] text-xs tabular-nums truncate max-w-full">
                        {formatNumberLocale(spentVal, lang)}
                      </span>
                    </div>

                    {/* 3. Remaining */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9.5px] font-bold text-teal-300/80 uppercase block mb-1">
                        {t('Remain', 'অবশিষ্ট')}
                      </span>
                      <span
                        className={`font-extrabold text-xs tabular-nums truncate max-w-full ${
                          budgetVal - spentVal >= 0 ? 'text-[#34D399]' : 'text-[#FF5252]'
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
                      </span>
                    </div>

                    {/* 4. % Badge */}
                    <div className="flex flex-col items-center">
                      <span className="text-[9.5px] font-bold text-teal-300/80 uppercase block mb-1">
                        %
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${
                          isOver
                            ? 'bg-rose-950/80 text-[#FF5252] border-rose-800/80'
                            : budgetVal > 0
                            ? 'bg-teal-950/80 text-teal-200 border-teal-800/80'
                            : 'text-teal-400/50 bg-[#062423] border-teal-800/40'
                        }`}
                      >
                        {budgetVal > 0 ? `${pct.toFixed(0)}%` : `--%`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CATEGORY SELECTION MODAL - ONLY EXPENSE CATEGORIES & SELECT ALL OPTION */}
      {/* CATEGORY SELECTION MODAL - ONLY EXPENSE CATEGORIES & SELECT ALL OPTION */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-md rounded-2xl shadow-2xl border border-teal-800/90 flex flex-col max-h-[85vh] overflow-hidden">
            {/* MODAL HEADER */}
            <div className="p-4 border-b border-teal-800/80 flex items-center justify-between gap-3 bg-teal-950/40">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#F0FDFA] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>{t('Select Expense Categories', 'খরচের ক্যাটাগরি নির্বাচন করুন')}</span>
                </h3>
                <p className="text-[11px] text-teal-200/80 mt-0.5">
                  {t(
                    'Pick which expense categories to include in this month’s budget',
                    'এই মাসের বাজেটে কোন কোন খরচের ক্যাটাগরি রাখবেন তা নির্বাচন করুন'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-teal-900/80 hover:bg-teal-800 text-teal-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SEARCH & SELECT ALL / CLEAR ALL ACTION BAR */}
            <div className="p-3 border-b border-teal-800/80 space-y-2.5 bg-[#0B3C39]">
              <div className="relative">
                <Search className="w-4 h-4 text-teal-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder={t('Search expense category...', 'খরচের ক্যাটাগরি খুঁজুন...')}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#062423] border border-teal-700/70 text-xs text-[#F0FDFA] placeholder:text-teal-400/60 focus:outline-none focus:border-emerald-400"
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
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-teal-900/80 hover:bg-teal-800 text-teal-200 border border-teal-700/60'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{t('Select All', 'সবগুলো সিলেক্ট করুন')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-teal-900/80 hover:bg-teal-800 text-teal-200 border border-teal-700/60 cursor-pointer transition-all"
                  >
                    <Square className="w-3.5 h-3.5 text-teal-400" />
                    <span>{t('Clear All', 'সব মুছুন')}</span>
                  </button>
                </div>

                <span className="text-[11px] font-bold text-teal-200/90 tabular-nums">
                  {selectedCategoryNames.length}/{validExpenseCategories.length} {t('selected', 'নির্বাচিত')}
                </span>
              </div>
            </div>

            {/* CATEGORIES LIST - PURE PLAIN TEXT (NO ICONS IN FRONT) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-teal-900/40">
              {filteredModalCategories.length === 0 ? (
                <div className="py-8 text-center text-teal-300/60 text-xs">
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
                          ? 'bg-teal-900/60 font-medium'
                          : 'hover:bg-teal-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Checkbox indicator */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-2xs'
                              : 'bg-[#062423] border-teal-700/70'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        {/* PURE PLAIN TEXT CATEGORY NAME */}
                        <span className="text-xs text-[#F0FDFA] font-semibold truncate block">
                          {cleanCategoryName(cat.cleanName, lang)}
                        </span>
                      </div>

                      <span className="text-[10px] text-teal-300/80 font-mono shrink-0">
                        {isSelected ? t('Active', 'যুক্ত') : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-3 border-t border-teal-800/80 bg-teal-950/40 flex items-center justify-between gap-3">
              <div className="text-[11px] text-teal-200/80">
                <strong className="text-[#F0FDFA]">{selectedCategoryNames.length}</strong> {t('categories in budget', 'টি খরচের ক্যাটাগরি বাজেটে যুক্ত')}
              </div>

              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-sm"
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
