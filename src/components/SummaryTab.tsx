import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarDays,
  SlidersHorizontal,
  Filter,
  RotateCcw,
  BarChart2,
  PieChart
} from 'lucide-react';
import { Transaction, DaySummary } from '../types';
import {
  normalizeDate,
  formatNumberLocale,
  formatDayDisplay,
  formatDateFull,
  formatDateShortDemo,
  formatCleanDateTime,
  findMonthMapping,
  cleanMappingLabel,
  getMonthKeyFromLabel
} from '../utils/dateUtils';
import { cleanCategoryName } from '../utils/categoryUtils';
import { CategoryDetailsModal } from './Modals';

interface SummaryTabProps {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  globalFilterMode: 'month' | 'all';
  setGlobalFilterMode: (mode: 'month' | 'all') => void;
  onSelectDate: (dateStr: string) => void;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  isReadOnly?: boolean;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
  monthMappings: import('../types').MonthMapping[];
}

export const SummaryTab: React.FC<SummaryTabProps> = ({
  transactions,
  filteredTransactions,
  selectedMonth,
  setSelectedMonth,
  globalFilterMode,
  setGlobalFilterMode,
  onSelectDate,
  onEdit,
  onDelete,
  isReadOnly,
  lang,
  t,
  monthMappings
}) => {
  const [showCalendarGrid, setShowCalendarGrid] = useState<boolean>(true);
  const [dayFilterMode, setDayFilterMode] = useState<'active' | 'all'>('active');
  const [daySortOrder, setDaySortOrder] = useState<'asc' | 'desc'>('desc');
  const [chartType, setChartType] = useState<'Expense' | 'Income'>('Expense');
  const [chartMode, setChartMode] = useState<'top5' | 'all'>('top5');
  const [categoryBreakdownType, setCategoryBreakdownType] = useState<'Expense' | 'Income'>('Expense');
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<string | null>(null);
  const [showAdvancedFilterDropdown, setShowAdvancedFilterDropdown] = useState<boolean>(false);

  // Custom date filter below calendar
  const [filterPreset, setFilterPreset] = useState<string>(globalFilterMode === 'all' ? 'all_time' : 'this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Sync with global filter mode
  React.useEffect(() => {
    if (globalFilterMode === 'all') {
      setFilterPreset('all_time');
    } else {
      setFilterPreset('this_month');
    }
  }, [globalFilterMode]);


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

  // Month display label
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

  // Month dropdown options
  const monthOptions = useMemo(() => {
    const opts: { val: string; label: string }[] = [];
    const mappedMonthKeys = new Set<string>();
    
    // Add custom mappings first with clean labels
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
      
      // If this month already has a custom mapping, do NOT duplicate with a bare standard month
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

  // COMPUTE DATE RANGE
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = normalizeDate(now);

    if (filterPreset === 'custom') {
      const s = customStartDate || '0000-01-01';
      const e = customEndDate || '9999-12-31';
      return { start: s, end: e, label: `${customStartDate || '...'} ~ ${customEndDate || '...'}` };
    }

    if (filterPreset === 'all_time') {
      return { start: '', end: '', label: t('All Time', 'সর্বমোট সময়') };
    }
    if (filterPreset === 'today') {
      return { start: todayStr, end: todayStr, label: t('Today', 'আজ') };
    }
    if (filterPreset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      return { start: normalizeDate(yest), end: normalizeDate(yest), label: t('Yesterday', 'গতকাল') };
    }
    if (filterPreset === 'this_week') {
      const curr = new Date(now);
      const first = curr.getDate() - curr.getDay();
      const firstDay = new Date(curr.setDate(first));
      return { start: normalizeDate(firstDay), end: todayStr, label: t('This Week', 'এই সপ্তাহ') };
    }
    if (filterPreset === 'last_7_days') {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 6);
      return { start: normalizeDate(past7), end: todayStr, label: t('Last 7 Days', 'গত ৭ দিন') };
    }
    if (filterPreset === 'last_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      return { start: `${ym}-01`, end: `${ym}-31`, label: t('Last Month', 'গত মাস') };
    }
    
    // Default: selectedMonth (from top bar or 'this_month')
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    if (mapping) {
      return {
        start: mapping.startDate,
        end: mapping.endDate,
        label: mapping.label
      };
    }

    const monthKey = getMonthKeyFromLabel(selectedMonth) || selectedMonth;
    if (monthKey.includes('-')) {
      const [y, m] = monthKey.split('-');
      return {
        start: `${y}-${m}-01`,
        end: `${y}-${m}-31`,
        label: monthLabel
      };
    }

    return { start: '', end: '', label: t('All Time', 'সর্বমোট সময়') };
  }, [filterPreset, selectedMonth, monthLabel, customStartDate, customEndDate, t, monthMappings]);

  // 3. FILTER TRANSACTIONS
  const displayTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const clean = normalizeDate(tx.date);
      if (dateRange.start && clean < dateRange.start) return false;
      if (dateRange.end && clean > dateRange.end) return false;
      return true;
    });
  }, [transactions, dateRange]);

  // 4. COMPUTE UNIFIED STATS
  const stats = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const dailyMap: Record<string, { inc: number; exp: number; count: number }> = {};

    displayTransactions.forEach(tx => {
      const val = Number(tx.value) || 0;
      const cleanDate = normalizeDate(tx.date);
      if (!dailyMap[cleanDate]) dailyMap[cleanDate] = { inc: 0, exp: 0, count: 0 };
      dailyMap[cleanDate].count += 1;

      if (tx.type === 'Expense') {
        exp += val;
        dailyMap[cleanDate].exp += val;
      } else {
        inc += val;
        dailyMap[cleanDate].inc += val;
      }
    });

    const net = inc - exp;
    const savingsRate = inc > 0 ? Math.max(0, (net / inc) * 100).toFixed(1) : '0';

    return { inc, exp, net, savingsRate, dailyMap };
  }, [displayTransactions]);

  // Compatibility aliases
  const activeTotals = stats;
  const filteredRangeTransactions = displayTransactions;
  const filteredRangeStats = stats;

  const filteredDayWiseList = useMemo(() => {
    const allDateMap: Record<string, { inc: number; exp: number; count: number }> = {};
    transactions.forEach(tx => {
      const clean = normalizeDate(tx.date);
      if (!allDateMap[clean]) allDateMap[clean] = { inc: 0, exp: 0, count: 0 };
      const val = Number(tx.value) || 0;
      allDateMap[clean].count += 1;
      if (tx.type === 'Expense') allDateMap[clean].exp += val;
      else allDateMap[clean].inc += val;
    });

    const sortedDates = Object.keys(allDateMap).sort();
    let cumulative = 0;
    const allSummaries: DaySummary[] = sortedDates.map(dateStr => {
      const d = allDateMap[dateStr];
      const net = d.inc - d.exp;
      cumulative += net;
      
      const [y, m, dayNum] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, dayNum);
      const dayOfWeek = isNaN(dateObj.getTime())
        ? ''
        : dateObj.toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD', { weekday: 'short' });

      return {
        day: dayNum,
        dateStr,
        dayOfWeek,
        inc: d.inc,
        exp: d.exp,
        net: cumulative,
        count: d.count,
        hasActivity: d.inc > 0 || d.exp > 0
      };
    });

    return allSummaries.filter(item => {
      if (dateRange.start && item.dateStr < dateRange.start) return false;
      if (dateRange.end && item.dateStr > dateRange.end) return false;
      if (dayFilterMode === 'active') return item.hasActivity;
      return true;
    }).sort((a, b) => {
      return daySortOrder === 'desc' ? b.dateStr.localeCompare(a.dateStr) : a.dateStr.localeCompare(b.dateStr);
    });
  }, [transactions, dateRange, dayFilterMode, daySortOrder, lang]);

  // 7-day Sun-Sat week aligned calendar grid
  const calendarGrid = useMemo(() => {
    const now = new Date();
    const todayStr = normalizeDate(now);

    // If dateRange has a bounded start and end date (e.g. within 65 days), use it
    if (dateRange.start && dateRange.end) {
      const [sy, sm, sd] = dateRange.start.split('-').map(Number);
      const [ey, em, ed] = dateRange.end.split('-').map(Number);
      if (sy && sm && sd && ey && em && ed) {
        const start = new Date(sy, sm - 1, sd, 12, 0, 0);
        const end = new Date(ey, em - 1, ed, 12, 0, 0);
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // If range is between 1 and 65 days, render the week-aligned range
        if (diffDays > 0 && diffDays <= 65) {
          const firstDayOfWeek = start.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
          const emptySlots = Array.from({ length: firstDayOfWeek });
          const rawDays: { dateStr: string; isToday: boolean; dayNum: number; currMonth: number }[] = [];
          
          let curr = new Date(start);
          const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          
          while (curr <= end) {
            const dateStr = normalizeDate(curr);
            const isToday = dateStr === todayStr;
            const dayNum = curr.getDate();
            const currMonth = curr.getMonth();

            rawDays.push({
              dateStr,
              isToday,
              dayNum,
              currMonth
            });
            curr.setDate(curr.getDate() + 1);
          }

          const days = rawDays.map((d, idx) => {
            const isStart = idx === 0;
            const isEnd = idx === rawDays.length - 1;
            const isMonthStart = d.dayNum === 1;

            let displayLabel = String(d.dayNum);
            if (isStart || isEnd || isMonthStart) {
              displayLabel = `${d.dayNum}-${monthsShort[d.currMonth]}`;
            }

            return {
              dateStr: d.dateStr,
              isToday: d.isToday,
              displayLabel
            };
          });

          return { emptySlots, days };
        }
      }
    }

    // Fallback: Standard month view (1st to last day of selectedMonth)
    const mapping = findMonthMapping(monthMappings, selectedMonth);
    let ym = mapping ? (getMonthKeyFromLabel(mapping.label) || mapping.startDate.slice(0, 7)) : getMonthKeyFromLabel(selectedMonth);

    if (!ym || !ym.includes('-')) {
      ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [year, month] = ym.split('-').map(Number);
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();
    const emptySlots = Array.from({ length: firstDayIndex });
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days: { dateStr: string; isToday: boolean; displayLabel: string }[] = [];

    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const isStart = dayNum === 1;
      const isEnd = dayNum === totalDays;
      const displayLabel = (isStart || isEnd)
        ? `${dayNum}-${monthsShort[month - 1]}`
        : String(dayNum);
      days.push({
        dateStr,
        isToday,
        displayLabel
      });
    }

    return { emptySlots, days };
  }, [dateRange, selectedMonth, monthMappings]);

  const renderDayCell = (dateStr: string, isToday: boolean, customLabel?: string) => {
    const dayData = stats.dailyMap[dateStr];
    const hasExp = dayData && dayData.exp > 0;
    const hasInc = dayData && dayData.inc > 0;
    
    // Check if within active date range
    const isWithinRange = (!dateRange.start || dateStr >= dateRange.start) && (!dateRange.end || dateStr <= dateRange.end);

    return (
      <button
        key={dateStr}
        type="button"
        onClick={() => onSelectDate(dateStr)}
        className={`relative min-h-[58px] sm:min-h-[64px] p-1 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 text-center ${
          isToday
            ? 'border-2 border-[#475569] bg-slate-100 shadow-sm'
            : isWithinRange
            ? 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300'
            : 'border-slate-100 bg-slate-50/20 opacity-35'
        }`}
      >
        {isToday && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#475569]" />
        )}

        <span className={`text-[10px] sm:text-[11px] font-bold leading-none mb-1 shrink-0 ${
          isToday ? 'text-white bg-[#475569] px-1.5 py-0.5 rounded-md shadow-xs' : 'text-[#0F172A]'
        }`}>
          {customLabel || dateStr.split('-')[2]}
        </span>

        {hasExp && (
          <span className="text-[8px] sm:text-[9px] font-bold text-[#EF4444] tabular-nums leading-none">
            -{formatNumberLocale(dayData!.exp, lang)}
          </span>
        )}
        {hasInc && (
          <span className="text-[8px] sm:text-[9px] font-bold text-[#16A34A] tabular-nums leading-none">
            +{formatNumberLocale(dayData!.inc, lang)}
          </span>
        )}
        {!hasExp && !hasInc && (
          <span className="text-[8px] text-slate-300 font-bold">—</span>
        )}
      </button>
    );
  };

  // Use global filtered transactions for the main stats
  const activeTransactions = globalFilterMode === 'all' ? transactions : filteredTransactions;

  // Filtered Chart Categories based on active filter, chartType and chartMode (Top 5 normalized to 100% with no dummy slices)
  const filteredChartCategories = useMemo(() => {
    const catMap: Record<string, { val: number; rawCat: string }> = {};

    filteredRangeTransactions.forEach(tx => {
      if (tx.type !== chartType) return;
      const c = cleanCategoryName(tx.category || 'Others', lang);
      if (!catMap[c]) catMap[c] = { val: 0, rawCat: tx.category || c };
      catMap[c].val += Math.abs(Number(tx.value) || 0);
    });

    const allSorted = Object.entries(catMap)
      .map(([cat, info]) => ({
        cat,
        rawCat: info.rawCat,
        val: info.val,
        percent: '0',
        isOthers: false
      }))
      .sort((a, b) => b.val - a.val);

    // If 'top5' mode, strictly take the Top 5 categories
    const categoriesToShow = chartMode === 'top5' ? allSorted.slice(0, 5) : allSorted;

    // Normalize percentage strictly based on the categories shown so that they represent 100% of the chart
    const baseTotal = categoriesToShow.reduce((sum, item) => sum + item.val, 0) || 1;

    return categoriesToShow.map(item => ({
      ...item,
      percent: ((item.val / baseTotal) * 100).toFixed(1),
      isOthers: false
    }));
  }, [filteredRangeTransactions, chartType, chartMode, lang]);

  const chartDisplayedTotal = useMemo(() => {
    return filteredChartCategories.reduce((sum, item) => sum + item.val, 0);
  }, [filteredChartCategories]);

  const top5Ratio = useMemo(() => {
    const overallTotal = (chartType === 'Expense' ? filteredRangeStats.exp : filteredRangeStats.inc) || 0;
    if (overallTotal <= 0) return 0;
    return Math.min(100, Math.round((chartDisplayedTotal / overallTotal) * 100));
  }, [chartType, filteredRangeStats.exp, filteredRangeStats.inc, chartDisplayedTotal]);

  // All Categories Breakdown (Expense & Income) for filtered range
  const filteredAllCategoryBreakdown = useMemo(() => {
    const catMap: Record<string, { total: number; count: number; rawCat: string }> = {};

    filteredRangeTransactions.forEach(tx => {
      if (tx.type !== categoryBreakdownType) return;
      const c = cleanCategoryName(tx.category || 'Others', lang);
      if (!catMap[c]) catMap[c] = { total: 0, count: 0, rawCat: tx.category || c };
      catMap[c].total += Math.abs(Number(tx.value) || 0);
      catMap[c].count += 1;
    });

    const targetTotal = categoryBreakdownType === 'Expense' ? filteredRangeStats.exp : filteredRangeStats.inc;
    const baseTotal = targetTotal || 1;

    return Object.entries(catMap)
      .map(([cat, info]) => ({
        cat,
        rawCat: info.rawCat,
        total: info.total,
        count: info.count,
        percent: ((info.total / baseTotal) * 100).toFixed(1)
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRangeTransactions, categoryBreakdownType, filteredRangeStats.exp, filteredRangeStats.inc, lang]);

  // Monthly History Comparison
  const monthlyHistory = useMemo(() => {
    const map: Record<string, { inc: number; exp: number; topCat: string; topCatVal: number }> = {};
    const catByMonth: Record<string, Record<string, number>> = {};

    transactions.forEach(tx => {
      const clean = normalizeDate(tx.date);
      const [y, m] = clean.split('-');
      const monthKey = `${y}-${m}`;
      if (!map[monthKey]) {
        map[monthKey] = { inc: 0, exp: 0, topCat: '', topCatVal: 0 };
        catByMonth[monthKey] = {};
      }
      const val = Number(tx.value) || 0;
      if (tx.type === 'Expense') {
        map[monthKey].exp += val;
        const c = cleanCategoryName(tx.category || 'Others', lang);
        catByMonth[monthKey][c] = (catByMonth[monthKey][c] || 0) + val;
      } else {
        map[monthKey].inc += val;
      }
    });

    return Object.keys(map)
      .sort()
      .reverse()
      .slice(0, 12)
      .map(mk => {
        const data = map[mk];
        const [y, m] = mk.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        const label = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD', {
          month: 'short',
          year: 'numeric'
        });

        const cats = catByMonth[mk] || {};
        let topCat = 'None';
        let topCatVal = 0;
        Object.entries(cats).forEach(([c, v]) => {
          if (v > topCatVal) {
            topCat = c;
            topCatVal = v;
          }
        });

        const net = data.inc - data.exp;
        return {
          monthKey: mk,
          label,
          inc: data.inc,
          exp: data.exp,
          net,
          topCat,
          topCatVal
        };
      });
  }, [transactions, lang]);

  return (
    <div className="space-y-3 sm:sm:space-y-4 pb-12 animate-fadeIn">
      {/* ON-SCREEN DASHBOARD VIEW (HIDDEN IN PRINT) */}
      <div className="print:hidden space-y-3 sm:space-y-4">

      {/* 2. HERO FINANCIAL DASHBOARD CARDS */}
      <div className="rounded-2xl bg-white text-[#0F172A] p-3 sm:p-5 shadow-sm border border-slate-200 relative overflow-hidden">
        {/* Top Header of Hero Card */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {globalFilterMode === 'month' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(-1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 transition-all cursor-pointer shrink-0 border border-slate-200"
                  title={t('Previous Month', 'পূর্ববর্তী মাস')}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <select
                  value={selectedMonth}
                  onChange={e => {
                    setSelectedMonth(e.target.value);
                    setFilterPreset('this_month');
                  }}
                  className="bg-white border border-slate-200 text-[#0F172A] text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-slate-400 cursor-pointer shadow-xs"
                >
                  {monthOptions.map(m => (
                    <option key={m.val} value={m.val} className="bg-white text-[#0F172A]">
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleShiftMonth(1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 transition-all cursor-pointer shrink-0 border border-slate-200"
                  title={t('Next Month', 'পরবর্তী মাস')}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#475569]">
                <Globe className="w-3.5 h-3.5 text-[#475569] shrink-0" />
                <span>{t('All-Time Overview', 'লাইফটাইম সর্বমোট')}</span>
              </div>
            )}

            {/* Custom Filter Button & Direct Date Inputs Popup */}
            <div className="flex items-center gap-1 relative">
              <button
                type="button"
                onClick={() => {
                  setShowAdvancedFilterDropdown(prev => !prev);
                  if (filterPreset !== 'custom') {
                    setFilterPreset('custom');
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-all ${
                  filterPreset === 'custom'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <CalendarDays className="w-3 h-3 text-indigo-600" />
                <span>{t('Custom Filter', 'কাস্টম ফিল্টার')}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterPreset('this_month');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setShowAdvancedFilterDropdown(false);
                }}
                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-[#EF4444] transition-all cursor-pointer border border-rose-200 shadow-xs active:scale-95"
                title={t('Reset Filter', 'ফিল্টার রিসেট')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Direct Custom Date Range Portal Modal */}
              {showAdvancedFilterDropdown && createPortal(
                <div
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
                  onClick={() => setShowAdvancedFilterDropdown(false)}
                >
                  <div
                    className="bg-white text-[#0F172A] w-full max-w-[320px] rounded-2xl p-4 shadow-2xl relative border border-slate-200 animate-modalSpring space-y-3 my-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-xs font-bold text-[#0F172A] uppercase">
                          {t('Custom Date Range Filter', 'কাস্টম তারিখ রেঞ্জ ফিল্টার')}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedFilterDropdown(false)}
                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-full bg-slate-100 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{t('Start Date', 'শুরু তারিখ')}</span>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={e => {
                            setCustomStartDate(e.target.value);
                            setFilterPreset('custom');
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-indigo-400 shadow-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{t('End Date', 'শেষ তারিখ')}</span>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={e => {
                            setCustomEndDate(e.target.value);
                            setFilterPreset('custom');
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-indigo-400 shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterPreset('this_month');
                          setCustomStartDate('');
                          setCustomEndDate('');
                          setShowAdvancedFilterDropdown(false);
                        }}
                        className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-all"
                      >
                        {t('Reset', 'রিসেট')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedFilterDropdown(false)}
                        className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm active:scale-95 transition-all"
                      >
                        {t('Apply', 'প্রয়োগ')}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Savings Badge */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#16A34A] font-bold px-1.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200">
              {activeTotals.savingsRate}%
            </span>
          </div>
        </div>

        {/* Big Net Balance Display */}
        <div className="mb-3">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
            {globalFilterMode === 'all'
              ? t('All-Time Balance', 'সর্বমোট অবশিষ্ট ব্যালেন্স')
              : t('Monthly Balance', 'এই মাসের অবশিষ্ট')}
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums ${
                activeTotals.net >= 0 ? 'text-[#16A34A]' : 'text-[#EF4444]'
              }`}
            >
              {activeTotals.net >= 0 ? '+' : ''}
              {formatNumberLocale(activeTotals.net, lang)}
            </span>
          </div>
        </div>

        {/* 2-Column KPI Cards (Income vs Expense) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-emerald-50/50 rounded-xl p-2 border border-emerald-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#16A34A] flex items-center justify-center shrink-0 border border-emerald-200">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-slate-500 font-semibold block truncate">
                {t('Income', 'আয়')}
              </span>
              <span className="text-[11px] font-bold text-[#16A34A] tabular-nums truncate block">
                +{formatNumberLocale(activeTotals.inc, lang)}
              </span>
            </div>
          </div>

          <div className="bg-rose-50/50 rounded-xl p-2 border border-rose-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-rose-100 text-[#EF4444] flex items-center justify-center shrink-0 border border-rose-200">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-slate-500 font-semibold block truncate">
                {t('Expense', 'খরচ')}
              </span>
              <span className="text-[11px] font-bold text-[#EF4444] tabular-nums truncate block">
                -{formatNumberLocale(activeTotals.exp, lang)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DYNAMIC CALENDAR / RANGE GRID */}
      {globalFilterMode === 'month' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 border border-slate-200 text-[#475569] flex items-center justify-center shrink-0 shadow-sm">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                  {t('Monthly Calendar', 'মাসিক ক্যালেন্ডার')}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {monthLabel} · {t('Tap day for details', 'বিস্তারিত দেখতে ক্লিক করুন')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCalendarGrid(!showCalendarGrid)}
              className="text-xs font-semibold text-[#475569] hover:text-slate-900 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{showCalendarGrid ? t('Hide Grid', 'গ্রিড লুকান') : t('Show Grid', 'গ্রিড দেখুন')}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showCalendarGrid ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showCalendarGrid && (
            <div className="space-y-3 animate-fadeIn">
              {/* Standard 7-Column (Sun - Sat) Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] font-bold text-slate-500 py-0.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <span key={d} className="tracking-tight">{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarGrid.emptySlots.map((_, idx) => (
                  <div key={`empty-${idx}`} className="min-h-[58px] sm:min-h-[64px]" />
                ))}
                {calendarGrid.days.map(d => renderDayCell(d.dateStr, d.isToday, d.displayLabel))}
              </div>

              {/* Bottom Legend */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 pt-2 text-[10px] sm:text-[11px] font-medium text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0" />
                  <span>{t('Expense', 'খরচ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                  <span>{t('Income', 'আয়')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#475569] shrink-0" />
                  <span>{t('Today', 'আজ')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}



      {/* 5. SUMMARY CARDS */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-white rounded-xl p-2 border border-slate-200 text-center shadow-sm">
          <span className="text-[9px] text-slate-500 font-bold uppercase block">{t('Inc', 'আয়')}</span>
          <span className="text-[11px] font-bold text-[#16A34A] block mt-0.5">
            +{formatNumberLocale(filteredRangeStats.inc, lang)}
          </span>
        </div>
        <div className="bg-white rounded-xl p-2 border border-slate-200 text-center shadow-sm">
          <span className="text-[9px] text-slate-500 font-bold uppercase block">{t('Exp', 'ব্যয়')}</span>
          <span className="text-[11px] font-bold text-[#EF4444] block mt-0.5">
            -{formatNumberLocale(filteredRangeStats.exp, lang)}
          </span>
        </div>
        <div className="bg-white rounded-xl p-2 border border-slate-200 text-center shadow-sm">
          <span className="text-[9px] text-slate-500 font-bold uppercase block">{t('Bal', 'ব্যালেন্স')}</span>
          <span className={`text-[11px] font-bold block mt-0.5 ${filteredRangeStats.net >= 0 ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
            {formatNumberLocale(filteredRangeStats.net, lang)}
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 7. CATEGORY DONUT CHART (FULL 100% CIRCLE, DYNAMIC FILTER, DEFAULT THIS MONTH TOP 5) */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
              chartType === 'Expense'
                ? 'bg-rose-50 text-[#EF4444] border-rose-200'
                : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
            }`}>
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <span>{chartType === 'Expense' ? t('Expense Breakdown Chart', 'ব্যয় বিশ্লেষণ চার্ট') : t('Income Breakdown Chart', 'আয় বিশ্লেষণ চার্ট')}</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-medium block">
                {dateRange.label} · {chartMode === 'top5' ? t('Top 5 Categories', 'শীর্ষ ৫টি খাত') : t('All Categories', 'সকল খাত')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Top 5 vs All toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setChartMode('top5')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  chartMode === 'top5' ? 'bg-[#475569] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('Top 5', 'শীর্ষ ৫')}
              </button>
              <button
                type="button"
                onClick={() => setChartMode('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  chartMode === 'all' ? 'bg-[#475569] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('All', 'সব')}
              </button>
            </div>

            {/* Expense vs Income toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setChartType('Expense')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  chartType === 'Expense' ? 'bg-[#EF4444] text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('Exp', 'খরচ')}
              </button>
              <button
                type="button"
                onClick={() => setChartType('Income')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  chartType === 'Income' ? 'bg-[#16A34A] text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('Inc', 'আয়')}
              </button>
            </div>
          </div>
        </div>

        {filteredChartCategories.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            {chartType === 'Expense'
              ? t('No expense records found for this period.', 'এই সময়ের জন্য কোনো খরচের রেকর্ড পাওয়া যায়নি।')
              : t('No income records found for this period.', 'এই সময়ের জন্য কোনো আয়ের রেকর্ড পাওয়া যায়নি।')}
          </div>
        ) : (
          <div className="flex flex-row items-center gap-3 sm:gap-6 p-0.5 sm:p-2">
            {/* Left: Round Donut Chart (Full 100% Complete Circle) */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg viewBox="0 0 160 160" className="w-[90px] h-[90px] sm:w-36 sm:h-36 -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r="52"
                  strokeWidth="20"
                  fill="none"
                  stroke="#e2e8f0"
                />
                {/* Segment Arcs */}
                {(() => {
                  const palette = ['#EF4444', '#f97316', '#eab308', '#16A34A', '#06b6d4', '#475569', '#a855f7', '#ec4899', '#14b8a6'];
                  const circumference = 326.72; // 2 * pi * 52
                  let offset = 0;
                  return filteredChartCategories.map((item, idx) => {
                    const pct = Math.max(0, Math.min(100, Number(item.percent) || 0));
                    const arcLength = (pct / 100) * circumference;
                    const strokeDasharray = `${arcLength} ${circumference}`;
                    const strokeDashoffset = -offset;
                    offset += arcLength;
                    const color = palette[idx % palette.length];

                    return (
                      <circle
                        key={item.cat}
                        cx="80"
                        cy="80"
                        r="52"
                        strokeWidth="20"
                        fill="none"
                        stroke={color}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-700"
                      />
                    );
                  });
                })()}
              </svg>
              {/* Center of Donut: Value and Ratio without label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className={`text-xs sm:text-sm font-extrabold tabular-nums leading-tight ${
                  chartType === 'Expense' ? 'text-[#EF4444]' : 'text-[#16A34A]'
                }`}>
                  {formatNumberLocale(chartDisplayedTotal, lang)}
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-[#475569] tabular-nums leading-tight mt-0.5">
                  {top5Ratio}%
                </span>
              </div>
            </div>

            {/* Right: Category, Ratio, and Amount */}
            <div className="flex-1 min-w-0 space-y-1.5 max-h-56 overflow-y-auto pr-0.5 no-scrollbar">
              {filteredChartCategories.map((item, idx) => {
                const palette = ['#EF4444', '#f97316', '#eab308', '#16A34A', '#06b6d4', '#475569', '#a855f7', '#ec4899', '#14b8a6'];
                const color = palette[idx % palette.length];

                return (
                  <button
                    key={item.cat}
                    type="button"
                    onClick={() => item.rawCat && setSelectedCategoryModal(item.rawCat || item.cat)}
                    className="w-full px-2 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all flex items-center justify-between gap-1 text-[11px] cursor-pointer active:scale-98 text-left"
                  >
                    {/* Category name & Dot */}
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-[#0F172A] truncate">
                        {item.cat}
                      </span>
                    </div>

                    {/* Ratio & Amount */}
                    <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                      <span className="text-[9px] font-bold text-slate-500">
                        {item.percent}%
                      </span>
                      <span className={`font-bold text-right ${
                        chartType === 'Expense' ? 'text-[#EF4444]' : 'text-[#16A34A]'
                      }`}>
                        {chartType === 'Expense' ? '-' : '+'}{formatNumberLocale(item.val, lang)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 8. CATEGORY BREAKDOWN REPORT (MATCHING DETAILS TAB FONT SIZE) */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                {t('Category Breakdown Report', 'ক্যাটাগরিভিত্তিক বিস্তারিত রিপোর্ট')}
              </h3>
              <p className="text-[10px] text-slate-500">
                {t('Tap any category to view individual transaction list', 'যেকোনো ক্যাটাগরিতে ক্লিক করে বিস্তারিত হিসাব দেখুন')}
              </p>
            </div>
          </div>

          {/* Toggle between Expense and Income */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setCategoryBreakdownType('Expense')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoryBreakdownType === 'Expense'
                  ? 'bg-[#EF4444] text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('Expenses', 'খরচ')}
            </button>
            <button
              type="button"
              onClick={() => setCategoryBreakdownType('Income')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoryBreakdownType === 'Income'
                  ? 'bg-[#16A34A] text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('Income', 'আয়')}
            </button>
          </div>
        </div>

        {filteredAllCategoryBreakdown.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            {t('No categories found for this period.', 'এই সময়ের জন্য কোনো ক্যাটাগরি রেকর্ড নেই।')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
            {filteredAllCategoryBreakdown.map(item => (
              <button
                key={item.cat}
                type="button"
                onClick={() => setSelectedCategoryModal(item.rawCat || item.cat)}
                className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between text-[11px] cursor-pointer active:scale-98 transition-all text-left group"
                title={t('Click to view details', 'বিস্তারিত দেখতে ক্লিক করুন')}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-[#0F172A] group-hover:text-[#475569] transition-colors truncate text-[11px]">
                    {item.cat}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    {item.count} {t('records', 'টি')} · {item.percent}%
                  </div>
                </div>
                <div
                  className={`font-bold text-[11px] tabular-nums shrink-0 ${
                    categoryBreakdownType === 'Expense' ? 'text-[#EF4444]' : 'text-[#16A34A]'
                  }`}
                >
                  {categoryBreakdownType === 'Expense' ? '-' : '+'}{formatNumberLocale(item.total, lang)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6. DAY-WISE BREAKDOWN */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#16A34A]" />
            <h3 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-tight">
              {t('Day-Wise Breakdown', 'দিনভিত্তিক হিসাব')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setDaySortOrder(daySortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
          >
            <SlidersHorizontal className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-1">
          {/* Header Row: Date Balance Expense Balance */}
          <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-1 px-1.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
            <span>{t('Date', 'তারিখ')}</span>
            <span className="text-right">{t('Income', 'আয়')}</span>
            <span className="text-right">{t('Expense', 'ব্যয়')}</span>
            <span className="text-right">{t('Balance', 'ব্যালেন্স')}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredDayWiseList.map(item => (
              <div
                key={item.dateStr}
                onClick={() => onSelectDate(item.dateStr)}
                className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-1 items-center py-2 px-1.5 hover:bg-slate-50 rounded-xl transition-all cursor-pointer text-[11px] group tabular-nums"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[#0F172A]">
                    {formatDateShortDemo(item.dateStr, lang)}
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold opacity-80">
                    ({formatNumberLocale(item.count, lang)} {t('rec', 'টি')})
                  </span>
                </div>
                <div className={`text-right font-bold ${item.inc > 0 ? 'text-[#16A34A]' : 'text-slate-300'}`}>
                  {item.inc > 0 ? `+${formatNumberLocale(item.inc, lang)}` : '—'}
                </div>
                <div className={`text-right font-bold ${item.exp > 0 ? 'text-[#EF4444]' : 'text-slate-300'}`}>
                  {item.exp > 0 ? `-${formatNumberLocale(item.exp, lang)}` : '—'}
                </div>
                <div className={`text-right font-bold ${item.net >= 0 ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
                  {formatNumberLocale(item.net, lang)}
                </div>
              </div>
            ))}
          </div>
          {filteredDayWiseList.length === 0 && (
            <div className="py-6 text-center text-slate-500 text-[10px] italic">
              {t('No activity.', 'কোনো হিসাব নেই।')}
            </div>
          )}
        </div>
      </div>

      {/* 9. MONTHLY HISTORY */}
      {globalFilterMode === 'all' && (
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <RotateCcw className="w-4 h-4 text-[#475569]" />
            <h3 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-tight">
              {t('Monthly History', 'মাসিক ইতিহাস')}
            </h3>
          </div>
          <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead className="text-[9px] text-slate-400 font-bold uppercase border-b border-slate-100">
                <tr>
                  <th className="py-1.5 px-1">{t('Month', 'মাস')}</th>
                  <th className="py-1.5 px-1 text-right">{t('Income', 'আয়')}</th>
                  <th className="py-1.5 px-1 text-right">{t('Expense', 'খরচ')}</th>
                  <th className="py-1.5 px-1 text-right">{t('Net', 'ব্যালেন্স')}</th>
                </tr>
              </thead>
              <tbody className="text-[10px] divide-y divide-slate-100">
                {monthlyHistory.map(row => (
                  <tr
                    key={row.monthKey}
                    onClick={() => {
                      setSelectedMonth(row.monthKey);
                      setGlobalFilterMode('month');
                    }}
                    className="hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <td className="py-1.5 px-1 font-bold text-[#0F172A]">{row.label}</td>
                    <td className="py-1.5 px-1 text-right text-[#16A34A] font-medium">+{formatNumberLocale(row.inc, lang)}</td>
                    <td className="py-1.5 px-1 text-right text-[#EF4444] font-medium">-{formatNumberLocale(row.exp, lang)}</td>
                    <td className={`py-1.5 px-1 text-right font-bold ${row.net >= 0 ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
                      {formatNumberLocale(row.net, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* 10. PRINTABLE REPORT VIEW */}
      <div id="printable-report" className="hidden print:block  text-slate-900 bg-white p-4">
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
              {(() => {
                const [y, m] = selectedMonth.split('-');
                const d = new Date(Number(y), Number(m) - 1, 1);
                const mName = isNaN(d.getTime()) ? 'month' : d.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
                return `${mName}-${y} hisab_kitab`;
              })()}
            </h1>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Statement Period: {dateRange.label} ({dateRange.start} ~ {dateRange.end})
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-semibold">Hisab Kitab Statement</p>
            <p>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="mb-5 print-avoid-break">
          <h2 className="text-sm font-bold uppercase border-b border-slate-400 pb-1 mb-2 text-slate-800">
            1. Financial Summary Overview
          </h2>
          <table className="w-full text-xs border border-slate-300">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-bold bg-slate-100 w-1/4">Total Income</td>
                <td className="p-2 font-bold text-emerald-700">+{formatNumberLocale(filteredRangeStats.inc, lang)}</td>
                <td className="p-2 font-bold bg-slate-100 w-1/4">Total Expense</td>
                <td className="p-2 font-bold text-rose-700">-{formatNumberLocale(filteredRangeStats.exp, lang)}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold bg-slate-100">Net Balance</td>
                <td className="p-2 font-bold text-slate-900">{filteredRangeStats.net >= 0 ? '+' : ''}{formatNumberLocale(filteredRangeStats.net, lang)}</td>
                <td className="p-2 font-bold bg-slate-100">Total Transactions</td>
                <td className="p-2">{displayTransactions.length} items</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-5 print-avoid-break">
          <h2 className="text-sm font-bold uppercase border-b border-slate-400 pb-1 mb-2 text-slate-800">
            2. Day-Wise Breakdown
          </h2>
          <table className="w-full text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-300">
                <th className="p-1.5 text-left">Date</th>
                <th className="p-1.5 text-right">Income</th>
                <th className="p-1.5 text-right">Expense</th>
                <th className="p-1.5 text-right">Balance</th>
                <th className="p-1.5 text-center">Items</th>
              </tr>
            </thead>
            <tbody>
              {filteredDayWiseList.map(item => (
                <tr key={item.dateStr} className="border-b border-slate-200">
                  <td className="p-1.5 text-left font-medium">{formatDateShortDemo(item.dateStr, lang)}</td>
                  <td className="p-1.5 text-right text-emerald-700">{item.inc > 0 ? `+${formatNumberLocale(item.inc, lang)}` : '—'}</td>
                  <td className="p-1.5 text-right text-rose-700">{item.exp > 0 ? `-${formatNumberLocale(item.exp, lang)}` : '—'}</td>
                  <td className="p-1.5 text-right font-bold">{item.hasActivity ? `${item.net >= 0 ? '+' : ''}${formatNumberLocale(item.net, lang)}` : '0'}</td>
                  <td className="p-1.5 text-center">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Details Popup Modal */}
      <CategoryDetailsModal
        categoryName={selectedCategoryModal}
        transactions={(() => {
          if (!selectedCategoryModal) return [];
          const sNorm = cleanCategoryName(selectedCategoryModal, 'en').toLowerCase();
          const inRange = filteredRangeTransactions.filter(tx => 
            cleanCategoryName(tx.category, 'en').toLowerCase() === sNorm
          );
          return inRange.length > 0 ? inRange : transactions;
        })()}
        onClose={() => setSelectedCategoryModal(null)}
        onEdit={onEdit}
        onDelete={onDelete}
        lang={lang}
        t={t}
        isReadOnly={isReadOnly}
      />
    </div>
  );
};
