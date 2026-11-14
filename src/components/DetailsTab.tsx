import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { Transaction, AppUser } from '../types';
import { normalizeDate, formatNumberLocale, formatDayHeader } from '../utils/dateUtils';
import { cleanCategoryName, isOthersCategory } from '../utils/categoryUtils';
import { evaluateExpression } from '../utils/calcUtils';
import { CategoryIcon } from './CategoryIcon';


interface DetailsTabProps {
  transactions: Transaction[];
  currentUser?: AppUser | null;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  isReadOnly?: boolean;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const DetailsTab: React.FC<DetailsTabProps> = ({
  transactions,
  currentUser,
  onEdit,
  onDelete,
  isReadOnly: isReadOnlyProp,
  lang,
  t
}) => {
  const isReadOnly = isReadOnlyProp || currentUser?.isReadOnly || currentUser?.role === 'super_admin_2';
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Expense' | 'Income'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Extract unique categories across transactions based on selected type filter
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(tx => {
      if (typeFilter !== 'All' && tx.type !== typeFilter) return;
      if (tx.category) set.add(tx.category);
    });
    return Array.from(set);
  }, [transactions, typeFilter]);

  // Check if any filter is currently applied
  const isFilterActive = searchTerm.trim() !== '' || typeFilter !== 'All' || categoryFilter !== 'All';

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('All');
    setCategoryFilter('All');
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (typeFilter !== 'All' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'All') {
        const filterIsOthers = isOthersCategory(categoryFilter, typeFilter === 'Income' ? 'Income' : 'Expense') ||
          cleanCategoryName(categoryFilter, 'en').toLowerCase() === 'others' ||
          cleanCategoryName(categoryFilter, 'en').toLowerCase() === 'other income';

        if (filterIsOthers) {
          const targetType = typeFilter !== 'All' ? typeFilter : tx.type;
          if (!isOthersCategory(tx.category, targetType)) return false;
        } else {
          const targetClean = cleanCategoryName(categoryFilter, 'en').toLowerCase();
          const txClean = cleanCategoryName(tx.category, 'en').toLowerCase();
          if (tx.category !== categoryFilter && txClean !== targetClean) return false;
        }
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const catMatch = (tx.category || '').toLowerCase().includes(query);
        const noteMatch = (tx.note || '').toLowerCase().includes(query);
        const valMatch = String(tx.value || '').includes(query);
        const dateMatch = (tx.date || '').includes(query);
        if (!catMatch && !noteMatch && !valMatch && !dateMatch) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, searchTerm]);

  // Overall Filtered Totals
  const filteredTotals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach(tx => {
      const val = evaluateExpression(tx.value);
      if (tx.type === 'Expense') exp += val;
      else inc += val;
    });
    return { inc, exp, net: inc - exp, count: filteredTransactions.length };
  }, [filteredTransactions]);

  // Date-wise Grouping
  const dateGroups = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(tx => {
      const d = normalizeDate(tx.date);
      if (!map[d]) map[d] = [];
      map[d].push(tx);
    });

    const sortedDates = Object.keys(map).sort((a, b) => {
      return b.localeCompare(a);
    });

    return sortedDates.map(dateStr => {
      const txs = map[dateStr];
      let totalIncome = 0;
      let totalExpense = 0;
      txs.forEach(t => {
        const val = evaluateExpression(t.value);
        if (t.type === 'Expense') totalExpense += val;
        else totalIncome += val;
      });

      const dateObj = new Date(dateStr);
      const monStr = dateObj.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = dateObj.getDate();
      const weekDay = dateObj.toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD', { weekday: 'long' });

      return {
        dateStr,
        displayDate: `${monStr} ${dayNum}`,
        displayWeekDay: weekDay,
        transactions: txs,
        totalIncome,
        totalExpense
      };
    });
  }, [filteredTransactions, lang]);



  return (
    <div 
      className="space-y-4 pb-16 animate-fadeIn"
    >
      {/* Search & Filter Header (Always Hidden in Print) */}
      <div className="print:hidden space-y-2">
        <div className="bg-[#0B3C39] p-2.5 rounded-xl border border-teal-800/80 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-teal-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('Search...', 'খুঁজুন...')}
                className="w-full h-8.5 bg-[#062423] border border-teal-700/70 rounded-lg pl-8 pr-2.5 text-xs text-[#F0FDFA] placeholder:text-teal-400/60 focus:outline-none focus:border-emerald-400 transition-colors"
              />
            </div>
            {isFilterActive && (
              <button onClick={handleClearFilters} className="h-8.5 px-2.5 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60 transition-colors cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="h-8 bg-[#062423] border border-teal-700/70 rounded-lg px-2 text-[11px] font-semibold text-[#F0FDFA] focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="All" className="bg-[#042F2E] text-[#F0FDFA]">{t('All Types', 'সব ধরন')}</option>
              <option value="Expense" className="bg-[#042F2E] text-[#F0FDFA]">{t('Expense', 'খরচ')}</option>
              <option value="Income" className="bg-[#042F2E] text-[#F0FDFA]">{t('Income', 'আয়')}</option>
            </select>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-8 bg-[#062423] border border-teal-700/70 rounded-lg px-2 text-[11px] font-semibold text-[#F0FDFA] focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              <option value="All" className="bg-[#042F2E] text-[#F0FDFA]">{t('All Categories', 'সব ক্যাটাগরি')}</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat} className="bg-[#042F2E] text-[#F0FDFA]">
                  {cleanCategoryName(cat, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Summary Row */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-[9px] text-teal-200 font-bold uppercase tracking-tight">
            <span>{t('Inc:', 'আয়:')} <span className="text-emerald-400 font-black">+{formatNumberLocale(filteredTotals.inc, lang)}</span></span>
            <span>{t('Exp:', 'ব্যয়:')} <span className="text-[#FF7A59] font-black">-{formatNumberLocale(filteredTotals.exp, lang)}</span></span>
          </div>
        </div>
      </div>

      {/* Main Ledger List */}
      <div className="space-y-4">
        {dateGroups.map(group => (
          <div key={group.dateStr} className="space-y-1 animate-fadeIn">
            {/* Header: Date and Daily Summary */}
            <div className="flex items-center justify-between px-1 text-[11px] font-bold text-teal-200 tracking-tight border-b border-teal-800/60 pb-1.5 mb-1 mt-2 uppercase">
              <div className="flex items-center gap-1.5">
                <span className="text-[#F0FDFA] font-extrabold">
                  {formatDayHeader(group.dateStr, lang)}
                </span>
                <span className="text-teal-300/80 font-semibold">
                  ({group.transactions.length} {t('Records', 'টি রেকর্ড')})
                </span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                {group.totalExpense > 0 && (
                  <span className="text-teal-200">
                    {t('Exp:', 'ব্যয়:')} <span className="text-[#FF7A59] font-black">-{formatNumberLocale(group.totalExpense, lang)}</span>
                  </span>
                )}
                {group.totalIncome > 0 && (
                  <span className="text-teal-200">
                    {t('Inc:', 'আয়:')} <span className="text-emerald-400 font-bold">+{formatNumberLocale(group.totalIncome, lang)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Transaction Rows */}
            <div className="space-y-1.5">
              {group.transactions.map((tx, idx) => {
                const isExpense = tx.type === 'Expense';
                return (
                  <motion.div
                    key={tx.id ? `dt_tx_${tx.id}_${group.dateStr}_${idx}` : `dt_tx_idx_${group.dateStr}_${idx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.2) }}
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => !isReadOnly && onEdit(tx)}
                    className="flex items-center justify-between py-2.5 px-3 bg-[#0B3C39] border border-teal-800/80 hover:border-teal-600/80 hover:bg-[#0E4945] rounded-xl transition-colors duration-200 cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon category={tx.category} withBadge size="md" className="group-hover:scale-105 transition-transform" />
                      <div className="min-w-0">
                        <span className="font-bold text-[#F0FDFA] text-xs block truncate transition-colors">
                          {cleanCategoryName(tx.category, lang)}
                        </span>
                        {tx.note && (
                          <span className="text-[10px] text-teal-300/80 block truncate">
                            {tx.note}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-black text-xs sm:text-sm tracking-tight tabular-nums ${isExpense ? 'text-[#FF7A59] drop-shadow-[0_1px_3px_rgba(255,122,89,0.3)]' : 'text-emerald-400 drop-shadow-[0_1px_3px_rgba(52,211,153,0.3)]'}`}>
                        {isExpense ? '-' : '+'}{formatNumberLocale(tx.value, lang)}
                      </span>
                      {!isReadOnly && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(tx); }}
                          className="w-8 h-8 flex items-center justify-center text-teal-400/60 hover:text-[#FF7A59] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {dateGroups.length === 0 && (
          <div className="py-20 text-center text-teal-200/80 font-medium text-xs">
            {t('No records found.', 'কোনো হিসাব খুঁজে পাওয়া যায়নি।')}
          </div>
        )}
      </div>

      {/* Hidden Print Layout (A4 optimized) */}
      <div id="printable-details-report" className="hidden print:block printable-container text-slate-900 bg-white">
          <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-center">
            <h1 className="text-xl font-black uppercase italic">Hisab Kitab Ledger</h1>
            <span className="text-xs">{new Date().toLocaleDateString()}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-2">Date</th>
                <th className="py-2">Category</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx, idx) => (
                <tr key={tx.id ? `dt_print_${tx.id}_${idx}` : `dt_print_${idx}`} className="border-b border-slate-100">
                  <td className="py-2">{tx.date}</td>
                  <td className="py-2">{cleanCategoryName(tx.category, lang)}</td>
                  <td className={`py-2 text-right font-bold ${tx.type === 'Expense' ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {tx.type === 'Expense' ? '-' : '+'}{tx.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
};
