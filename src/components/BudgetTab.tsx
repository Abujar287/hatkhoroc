import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Plus
} from 'lucide-react';
import { Transaction } from '../types';
import {
  normalizeDate,
  formatNumberLocale,
  formatDateShortDemo,
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
  transactions,
  selectedMonth,
  setSelectedMonth,
  lang,
  t,
  currentTab,
  monthMappings,
  onSaveBudget
}) => {
  // Category-wise budgets stored per tab and per month: { [categoryName]: number }
  const storageKey = `app_category_budgets_${currentTab}_${selectedMonth}`;
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {};
  });

  const currentMapping = useMemo(() => {
    return findMonthMapping(monthMappings, selectedMonth);
  }, [monthMappings, selectedMonth]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceTimerRef = React.useRef<any>(null);

  // Reload category budgets when selectedMonth or currentTab changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`app_category_budgets_${currentTab}_${selectedMonth}`);
      if (saved) {
        setCategoryBudgets(JSON.parse(saved));
      } else {
        setCategoryBudgets({});
      }
    } catch {
      setCategoryBudgets({});
    }
  }, [currentTab, selectedMonth]);

  // Total budget is derived directly from category budgets
  const totalBudget = useMemo(() => {
    return Object.values(categoryBudgets).reduce((sum, b) => sum + (Number(b) || 0), 0);
  }, [categoryBudgets]);

  // Calculate actual spending per category for selected month
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
        const catClean = cleanCategoryName(tx.category, 'en');
        const val = Number(tx.value) || 0;
        spendingMap[catClean] = (spendingMap[catClean] || 0) + val;
      }
    });

    return spendingMap;
  }, [transactions, selectedMonth, monthMappings]);

  const totalSpent = useMemo(() => {
    return Object.values(categorySpending).reduce((sum, s) => sum + (s || 0), 0);
  }, [categorySpending]);

  const remainingBudget = totalBudget - totalSpent;

  // Month display label
  const monthLabel = useMemo(() => {
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    if (mapping) {
      return mapping.label;
    }

    try {
      const monthKey = getMonthKeyFromLabel(selectedMonth) || selectedMonth;
      const [y, m] = monthKey.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD', {
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth, lang, monthMappings]);

  // Save budget handler - sends total budget (sum of categories) + category-wise breakdown (Mapping Month, Category, Budget, Spend, Remain)
  const handlePerformSave = (newCatBudgets?: Record<string, number>) => {
    const catsToUse = newCatBudgets || categoryBudgets;
    const catSum = Object.values(catsToUse).reduce((sum, b) => sum + (Number(b) || 0), 0);

    // Compile distinct categories for category-wise sheet storage
    const allCategoryNames = Array.from(new Set([
      ...expenseCategories.map(c => cleanCategoryName(c, 'en')),
      ...Object.keys(catsToUse),
      ...Object.keys(categorySpending)
    ])).filter(Boolean);

    const categoryRows: CategoryBudgetRow[] = allCategoryNames.map(cName => {
      const b = Number(catsToUse[cName] ?? 0);
      const s = Number(categorySpending[cName] ?? 0);
      const r = b - s;
      return {
        category: cName,
        budget: b,
        spend: s,
        remain: r
      };
    }).filter(row => row.budget > 0 || row.spend > 0);

    setSaveStatus('saving');
    if (onSaveBudget) {
      onSaveBudget(selectedMonth, catSum, catsToUse, categoryRows);
    }
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 400);
  };

  const handleBudgetChange = (category: string, value: string) => {
    const num = parseFloat(value) || 0;
    const updated = { ...categoryBudgets, [category]: num };
    setCategoryBudgets(updated);
    try {
      localStorage.setItem(`app_category_budgets_${currentTab}_${selectedMonth}`, JSON.stringify(updated));
    } catch {}

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      handlePerformSave(updated);
    }, 1200);
  };

  // Month shift helper
  const handleShiftMonth = (delta: number) => {
    // 1. Check if current matches a mapping
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

    // 2. Standard YYYY-MM logic
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
    
    // Add custom mappings first
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
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-slate-100 text-[#475569] flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-tight truncate">
                {t('Category-wise Monthly Budgets', 'ক্যাটাগরি ভিত্তিক মাসিক বাজেট')}
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">
                {expenseCategories.length} {t('categories', 'টি ক্যাটাগরি')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handlePerformSave()}
            disabled={saveStatus === 'saving'}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs shrink-0 ${
              saveStatus === 'saved'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {saveStatus === 'saving' && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saveStatus === 'saved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
            <span>
              {saveStatus === 'saving' ? t('Saving...', 'সেভ হচ্ছে...') : saveStatus === 'saved' ? t('Saved to Sheet ✓', 'শিটে সেভ হয়েছে ✓') : t('Save Budget', 'বাজেট সেভ')}
            </span>
          </button>
        </div>

        <div className="space-y-3 pt-1">
          {expenseCategories.map(cat => {
            const catClean = cleanCategoryName(cat, 'en');
            const budgetVal = categoryBudgets[catClean] || categoryBudgets[cat] || 0;
            const spentVal = categorySpending[catClean] || 0;
            const pct = budgetVal > 0 ? Math.min(100, (spentVal / budgetVal) * 100) : 0;
            const isOver = budgetVal > 0 && spentVal > budgetVal;
            const emoji = getCategoryEmoji(cat);
            const colorClass = getCategoryColor(cat);

            return (
              <div
                key={cat}
                className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 shadow-xs ${colorClass} text-slate-900 font-bold`}>
                      {emoji}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-[#0F172A] text-xs truncate block">
                        {cleanCategoryName(cat, lang)}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>
                          {t('Spend:', 'খরচ:')} <strong className="text-[#EF4444] tabular-nums">{formatNumberLocale(spentVal, lang)}</strong>
                        </span>
                        {budgetVal > 0 && (
                          <>
                            <span>•</span>
                            <span>
                              {t('Remain:', 'অবশিষ্ট:')} <strong className={`tabular-nums ${budgetVal - spentVal >= 0 ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
                                {budgetVal - spentVal >= 0 ? '+' : ''}{formatNumberLocale(budgetVal - spentVal, lang)}
                              </strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <label className="text-[9px] text-slate-500 block font-semibold uppercase">
                        {t('Budget Limit', 'বাজেট লিমিট')}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={budgetVal || ''}
                        onChange={e => {
                          const cleanVal = e.target.value.replace(/[^0-9.]/g, '');
                          handleBudgetChange(catClean, cleanVal);
                        }}
                        placeholder="0"
                        className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-[#0F172A] text-right font-bold focus:outline-none focus:border-slate-400 tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                {budgetVal > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">
                        {pct.toFixed(0)}% {t('used', 'ব্যবহৃত')}
                      </span>
                      <span className={isOver ? 'text-[#EF4444] font-bold' : 'text-[#16A34A] font-bold'}>
                        {isOver
                          ? `⚠️ ${t('Exceeded by', 'অতিরিক্ত খরচ')} ${formatNumberLocale(spentVal - budgetVal, lang)}`
                          : `${formatNumberLocale(budgetVal - spentVal, lang)} ${t('remaining', 'অবশিষ্ট')}`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300">
                      <div
                        className={`h-full transition-all duration-300 ${isOver ? 'bg-[#EF4444] animate-pulse' : 'bg-[#16A34A]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
