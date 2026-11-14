import React, { useMemo } from 'react';
import { CalendarRange, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Transaction, MonthMapping } from '../types';
import {
  normalizeDate,
  formatNumberLocale,
  cleanMappingLabel,
  getMonthKeyFromLabel
} from '../utils/dateUtils';
import { evaluateExpression } from '../utils/calcUtils';

interface MonthlySummaryTabProps {
  transactions: Transaction[];
  monthMappings: MonthMapping[];
  onSelectMonth?: (monthLabel: string) => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatShortDayMonth(isoDate: string): string {
  const clean = normalizeDate(isoDate);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[1]) || isNaN(parts[2])) return clean;
  const day = String(parts[2]).padStart(2, '0');
  const mon = MONTHS_SHORT[parts[1] - 1] || '';
  return `${day}-${mon}`;
}

function formatDateRangeText(startDate: string, endDate: string): string {
  return `${formatShortDayMonth(startDate)} to ${formatShortDayMonth(endDate)}`;
}

export const MonthlySummaryTab: React.FC<MonthlySummaryTabProps> = ({
  transactions,
  monthMappings,
  onSelectMonth,
  lang,
  t
}) => {
  const monthlyRows = useMemo(() => {
    interface RowData {
      key: string;
      monthLabel: string;
      startDate: string;
      endDate: string;
      dateRangeText: string;
      income: number;
      expense: number;
      balance: number;
      txCount: number;
      sortKey: string;
    }

    const rows: RowData[] = [];
    const mappedTxIds = new Set<string>();

    // 1. Compute rows for all configured custom monthMappings
    monthMappings.forEach((m, idx) => {
      const start = normalizeDate(m.startDate);
      const end = normalizeDate(m.endDate);
      const sDate = start <= end ? start : end;
      const eDate = start <= end ? end : start;

      let income = 0;
      let expense = 0;
      let txCount = 0;

      transactions.forEach((tx, txIdx) => {
        const d = normalizeDate(tx.date);
        if (d >= sDate && d <= eDate) {
          const val = Math.abs(evaluateExpression(tx.value));
          if (tx.type === 'Income') income += val;
          else expense += val;
          txCount += 1;
          mappedTxIds.add(tx.id || `idx_${txIdx}`);
        }
      });

      const label = cleanMappingLabel(m.label) || m.label;
      const sortKey = getMonthKeyFromLabel(label) || sDate.slice(0, 7);

      rows.push({
        key: m.id || `map_${idx}_${label}`,
        monthLabel: label,
        startDate: sDate,
        endDate: eDate,
        dateRangeText: formatDateRangeText(sDate, eDate),
        income,
        expense,
        balance: income - expense,
        txCount,
        sortKey
      });
    });

    // 2. Group any remaining transactions not covered by a mapping into standard calendar months
    const unmappedBuckets: Record<string, { income: number; expense: number; count: number }> = {};
    transactions.forEach((tx, txIdx) => {
      if (mappedTxIds.has(tx.id || `idx_${txIdx}`)) return;
      const d = normalizeDate(tx.date);
      const ym = d.slice(0, 7);
      if (!ym || !ym.includes('-')) return;
      if (!unmappedBuckets[ym]) {
        unmappedBuckets[ym] = { income: 0, expense: 0, count: 0 };
      }
      const val = Math.abs(evaluateExpression(tx.value));
      if (tx.type === 'Income') unmappedBuckets[ym].income += val;
      else unmappedBuckets[ym].expense += val;
      unmappedBuckets[ym].count += 1;
    });

    Object.entries(unmappedBuckets).forEach(([ym, bucket]) => {
      const [y, m] = ym.split('-').map(Number);
      if (isNaN(y) || isNaN(m)) return;
      const lastDay = new Date(y, m, 0).getDate();
      const sDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const eDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const label = `${MONTHS_SHORT[m - 1] || 'Mon'}-${y}`;

      rows.push({
        key: `std_${ym}`,
        monthLabel: label,
        startDate: sDate,
        endDate: eDate,
        dateRangeText: formatDateRangeText(sDate, eDate),
        income: bucket.income,
        expense: bucket.expense,
        balance: bucket.income - bucket.expense,
        txCount: bucket.count,
        sortKey: ym
      });
    });

    return rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [transactions, monthMappings]);

  const grandTotals = useMemo(() => {
    return monthlyRows.reduce(
      (acc, r) => {
        acc.income += r.income;
        acc.expense += r.expense;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [monthlyRows]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 pb-16 animate-fadeIn px-0.5 sm:px-2">
      {/* Header & Totals Strip */}
      <div className="bg-gradient-to-b from-[#0D4441] to-[#0A3734] rounded-2xl p-3.5 sm:p-5 border border-teal-700/50 shadow-md space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#062423] border border-teal-700/70 text-emerald-400 flex items-center justify-center shrink-0">
              <CalendarRange className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#F0FDFA] tracking-tight">
                {t('Monthly Summary', 'মাসিক সারসংক্ষেপ')}
              </h2>
              <p className="text-[10.5px] sm:text-xs text-teal-300/80 font-medium">
                {monthlyRows.length} {t('months overview', 'টি মাসের হিসাব')}
              </p>
            </div>
          </div>
        </div>

        {/* 2 Summary Cards (Income & Expense) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="bg-[#062423] rounded-xl p-2.5 sm:p-3 border border-emerald-700/50">
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-teal-300/80 uppercase">
              <ArrowUpRight className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">{t('Total Income', 'মোট আয়')}</span>
            </div>
            <span className="text-xs sm:text-base font-black text-emerald-400 tabular-nums mt-0.5 block truncate">
              {formatNumberLocale(grandTotals.income, lang)}
            </span>
          </div>

          <div className="bg-[#062423] rounded-xl p-2.5 sm:p-3 border border-[#FF7A59]/40">
            <div className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-bold text-teal-300/80 uppercase">
              <ArrowDownLeft className="w-3 h-3 text-[#FF7A59] shrink-0" />
              <span className="truncate">{t('Total Expense', 'মোট খরচ')}</span>
            </div>
            <span className="text-xs sm:text-base font-black text-[#FF7A59] tabular-nums mt-0.5 block truncate">
              {formatNumberLocale(grandTotals.expense, lang)}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Summary Table */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-md overflow-hidden">
        {monthlyRows.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <CalendarRange className="w-8 h-8 text-teal-500/60 mx-auto" />
            <p className="text-xs font-bold text-teal-200/80">
              {t('No monthly summary records yet.', 'এখনও কোনো মাসিক হিসাব পাওয়া যায়নি।')}
            </p>
            <p className="text-[11px] text-teal-300/60">
              {t('Add transactions or configure Month Mappings to view your monthly breakdown.', 'মাসিক হিসাব দেখতে এন্ট্রি যোগ করুন অথবা মাস ম্যাপিং সেট করুন।')}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#062423] text-teal-300/90 border-b border-teal-800/80">
                  <th scope="col" className="py-2.5 px-2.5 sm:px-4 text-[10px] sm:text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
                    {t('Month', 'মাস')}
                  </th>
                  <th scope="col" className="py-2.5 px-2 sm:px-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider whitespace-nowrap">
                    {t('Date Range', 'সময়সীমা')}
                  </th>
                  <th scope="col" className="py-2.5 px-2 sm:px-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-right whitespace-nowrap">
                    {t('Income', 'আয়')}
                  </th>
                  <th scope="col" className="py-2.5 px-2 sm:px-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-right whitespace-nowrap">
                    {t('Expense', 'ব্যয়')}
                  </th>
                  <th scope="col" className="py-2.5 px-2.5 sm:px-4 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-right whitespace-nowrap">
                    {t('Balance', 'ব্যালেন্স')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-800/50 text-[11px] sm:text-xs text-[#F0FDFA]">
                {monthlyRows.map(row => (
                  <tr
                    key={row.key}
                    onClick={() => onSelectMonth?.(row.monthLabel)}
                    className={`transition-colors hover:bg-teal-900/40 ${onSelectMonth ? 'cursor-pointer' : ''}`}
                  >
                    <td className="py-2.5 px-2.5 sm:px-4 font-extrabold text-[#F0FDFA] whitespace-nowrap">
                      {row.monthLabel}
                    </td>
                    <td className="py-2.5 px-2 sm:px-3 text-[10px] sm:text-[11px] text-teal-200/90 font-medium whitespace-nowrap">
                      {row.dateRangeText}
                    </td>
                    <td className="py-2.5 px-2 sm:px-3 text-right font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                      {formatNumberLocale(row.income, lang)}
                    </td>
                    <td className="py-2.5 px-2 sm:px-3 text-right font-bold text-[#FF7A59] tabular-nums whitespace-nowrap">
                      {formatNumberLocale(row.expense, lang)}
                    </td>
                    <td
                      className={`py-2.5 px-2.5 sm:px-4 text-right font-black tabular-nums whitespace-nowrap ${
                        row.balance >= 0 ? 'text-emerald-300' : 'text-rose-400'
                      }`}
                    >
                      {formatNumberLocale(row.balance, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
