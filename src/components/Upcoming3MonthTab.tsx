import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  CalendarClock,
  Shield,
  Plus,
  Copy,
  Check,
  Trash2,
  Wallet,
  Smartphone,
  Calculator,
  CloudCheck,
  RefreshCw,
  Gift
} from 'lucide-react';
import { BouGiftEntry, MonthMapping, Upcoming3MonthPlan } from '../types';
import {
  cleanMappingLabel,
  formatNumberLocale,
  getMonthKeyFromLabel,
  normalizeDate
} from '../utils/dateUtils';
import { cleanCategoryName } from '../utils/categoryUtils';
import { CategoryIcon } from './CategoryIcon';

interface Upcoming3MonthTabProps {
  expenseCategories: string[];
  monthMappings: MonthMapping[];
  selectedMonth: string;
  currentTab: string;
  remotePlan?: Upcoming3MonthPlan | null;
  remotePlanVersion?: number;
  onSyncPlan: (plan: Upcoming3MonthPlan) => Promise<boolean>;
  remoteBouGift?: BouGiftEntry[];
  remoteBouGiftVersion?: number;
  onSaveBouGift: (rows: BouGiftEntry[]) => Promise<boolean>;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

interface UpcomingMonthSlot {
  key: string; // YYYY-MM
  label: string; // e.g. Nov-2026 or '' if unmapped
  rangeText: string; // e.g. 01-Nov to 30-Nov or ''
  isMapped: boolean;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_TEMPLATE_ROWS: Array<{ category: string; values: [number, number, number] }> = [
  { category: 'Room Rent', values: [6000, 6000, 6000] },
  { category: 'Gas', values: [2100, 0, 0] },
  { category: 'Wifi', values: [525, 525, 525] },
  { category: 'Electricity', values: [750, 500, 500] },
  { category: 'Food Cost', values: [5000, 5000, 5000] },
  { category: 'Hand Cost', values: [2000, 2000, 2000] },
  { category: 'Relatives', values: [0, 0, 0] },
  { category: 'Abujar', values: [0, 0, 0] },
  { category: 'Bou Cost', values: [0, 0, 0] },
  { category: 'Saving', values: [0, 0, 0] },
  { category: 'Shopping', values: [0, 0, 0] },
  { category: 'Mr & Mrs', values: [0, 0, 0] },
  { category: 'Home', values: [1500, 1000, 1000] },
  { category: 'Loan (Bou)', values: [0, 0, 2000] },
  { category: 'Loan (Home)', values: [0, 5000, 3000] },
  { category: 'Loan (Bkash1)', values: [2909, 0, 0] },
  { category: 'Loan (Bkash2)', values: [1000, 0, 0] },
  { category: 'Loan (Bkash3)', values: [1721, 1721, 1721] },
  { category: 'Loan (Bkash4)', values: [3098, 3098, 3098] }
];

const DEFAULT_CORE_SET = new Set(DEFAULT_TEMPLATE_ROWS.map(r => r.category.toLowerCase()));

function isBkashLoanCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('bkash') && lower.includes('loan');
}

function normalizeBouMonthKey(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);

  const lower = s.toLowerCase();
  const monthIdx = MONTHS_SHORT.findIndex(m => lower.includes(m.toLowerCase()));
  if (monthIdx === -1) return '';

  const yr4 = lower.match(/(20\d{2})/);
  const yr2 = lower.match(/(?:-|\/|\s)(\d{2})$/);
  const year = yr4 ? Number(yr4[1]) : yr2 ? 2000 + Number(yr2[1]) : 2026;
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
}

function formatBouMonthLabel(year: number, month1Based: number): string {
  return `17-${MONTHS_SHORT[month1Based - 1] || ''}-${String(year).slice(-2)}`;
}

function mergeBouGiftEntries(saved?: BouGiftEntry[]): BouGiftEntry[] {
  const savedMap = new Map<string, BouGiftEntry>();
  const extraEntries: BouGiftEntry[] = [];
  if (Array.isArray(saved)) {
    saved.forEach(item => {
      if (!item || !item.month) return;
      const key = normalizeBouMonthKey(item.month);
      if (key) {
        savedMap.set(key, item);
      }
    });
  }

  const now = new Date();
  let endYear = now.getFullYear();
  let endMonth = now.getMonth() + 1;
  if (endYear < 2026 || (endYear === 2026 && endMonth < 2)) {
    endYear = 2026;
    endMonth = 2;
  }

  const rows: BouGiftEntry[] = [];
  const usedKeys = new Set<string>();
  let y = 2026;
  let m = 2; // Start from 17-Feb-26

  while (y < endYear || (y === endYear && m <= endMonth)) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    const label = formatBouMonthLabel(y, m);
    const defaultBudget = ym === '2026-02' ? 0 : 1000;
    const defaultGive = ym === '2026-03' || ym === '2026-04' ? 1000 : 0;
    const existing = savedMap.get(ym);
    usedKeys.add(ym);

    rows.push({
      month: label,
      budget: existing && existing.budget !== undefined ? Number(existing.budget) || 0 : defaultBudget,
      give: existing ? Number(existing.give) || 0 : defaultGive
    });

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  // Keep any extra rows that may already exist in AX:AZ beyond the standard range
  if (Array.isArray(saved)) {
    saved.forEach(item => {
      if (!item || !item.month) return;
      const key = normalizeBouMonthKey(item.month);
      if (key && !usedKeys.has(key)) {
        usedKeys.add(key);
        extraEntries.push({
          month: item.month,
          budget: Number(item.budget) || 0,
          give: Number(item.give) || 0
        });
      }
    });
  }

  return [...rows, ...extraEntries];
}

function createDefaultPlan(): Upcoming3MonthPlan {
  const categoryValues: Record<string, [number, number, number]> = {};
  DEFAULT_TEMPLATE_ROWS.forEach(row => {
    categoryValues[row.category] = [...row.values] as [number, number, number];
  });
  return {
    categories: DEFAULT_TEMPLATE_ROWS.map(r => r.category),
    categoryValues,
    salary: [0, 0, 0],
    have: [0, 0, 0],
    loan: [0, 0, 0],
    bkashLoanTotal: 0
  };
}

function normalizeLoadedPlan(raw: any): Upcoming3MonthPlan | null {
  if (!raw || !Array.isArray(raw.categories) || !raw.categoryValues) return null;
  const toTuple = (arr: any): [number, number, number] => [
    Number(arr?.[0]) || 0,
    Number(arr?.[1]) || 0,
    Number(arr?.[2]) || 0
  ];
  const cleanVals: Record<string, [number, number, number]> = {};
  raw.categories.forEach((cat: string) => {
    if (cat && typeof cat === 'string') {
      cleanVals[cat] = toTuple(raw.categoryValues[cat]);
    }
  });
  return {
    monthLabels: Array.isArray(raw.monthLabels)
      ? [String(raw.monthLabels[0] || ''), String(raw.monthLabels[1] || ''), String(raw.monthLabels[2] || '')]
      : undefined,
    categories: raw.categories.filter((c: any) => typeof c === 'string' && c.trim()),
    categoryValues: cleanVals,
    salary: toTuple(raw.salary),
    have: toTuple(raw.have),
    loan: toTuple(raw.loan),
    bkashLoanTotal: Number(raw.bkashLoanTotal) || 0
  };
}

function formatShortDayMonth(isoDate: string): string {
  const clean = normalizeDate(isoDate);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[1]) || isNaN(parts[2])) return clean;
  return `${String(parts[2]).padStart(2, '0')}-${MONTHS_SHORT[parts[1] - 1] || ''}`;
}

function parseNumericInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

export const Upcoming3MonthTab: React.FC<Upcoming3MonthTabProps> = ({
  expenseCategories,
  monthMappings,
  selectedMonth,
  currentTab,
  remotePlan,
  remotePlanVersion = 0,
  onSyncPlan,
  remoteBouGift,
  remoteBouGiftVersion = 0,
  onSaveBouGift,
  lang,
  t
}) => {
  const storageKey = `app_upcoming_3m_plan_v2_${currentTab}`;
  const bouStorageKey = `app_bou_gift_v1_${currentTab}`;

  const [plan, setPlan] = useState<Upcoming3MonthPlan>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = normalizeLoadedPlan(JSON.parse(saved));
        if (parsed) return parsed;
      }
    } catch {}
    return createDefaultPlan();
  });

  const [bouGiftRows, setBouGiftRows] = useState<BouGiftEntry[]>(() => {
    try {
      const saved = localStorage.getItem(bouStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return mergeBouGiftEntries(parsed);
      }
    } catch {}
    return mergeBouGiftEntries();
  });

  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [copiedCategory, setCopiedCategory] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'queued'>('idle');

  const isDirtyRef = useRef(false);
  const structureDirtyRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string>('');

  const bouDirtyRef = useRef(false);
  const bouDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedBouJsonRef = useRef<string>('');

  // Reload when user tab switches
  useEffect(() => {
    isDirtyRef.current = false;
    structureDirtyRef.current = false;
    setSyncState('idle');
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = normalizeLoadedPlan(JSON.parse(saved));
        if (parsed) {
          setPlan(parsed);
          lastSavedJsonRef.current = JSON.stringify({ ...parsed, forceRebuild: false });
        } else {
          const fresh = createDefaultPlan();
          setPlan(fresh);
          lastSavedJsonRef.current = '';
        }
      } else {
        const fresh = createDefaultPlan();
        setPlan(fresh);
        lastSavedJsonRef.current = '';
      }
    } catch {
      const fresh = createDefaultPlan();
      setPlan(fresh);
      lastSavedJsonRef.current = '';
    }

    bouDirtyRef.current = false;
    try {
      const savedBou = localStorage.getItem(bouStorageKey);
      if (savedBou) {
        const parsedBou = JSON.parse(savedBou);
        if (Array.isArray(parsedBou)) {
          const mergedBou = mergeBouGiftEntries(parsedBou);
          setBouGiftRows(mergedBou);
          lastSavedBouJsonRef.current = JSON.stringify(mergedBou);
          return;
        }
      }
    } catch {}
    const freshBou = mergeBouGiftEntries();
    setBouGiftRows(freshBou);
    lastSavedBouJsonRef.current = '';
  }, [storageKey, bouStorageKey]);

  // Hydrate from Google Sheet AS2:AV on sync
  useEffect(() => {
    if (!remotePlan || isDirtyRef.current) return;
    const normalized = normalizeLoadedPlan(remotePlan);
    if (!normalized) return;

    lastSavedJsonRef.current = JSON.stringify({
      ...normalized,
      monthLabels: normalized.monthLabels || ['', '', '']
    });
    setPlan(normalized);
    try {
      localStorage.setItem(storageKey, JSON.stringify(normalized));
    } catch {}
  }, [remotePlan, remotePlanVersion, storageKey]);

  // Hydrate Bou Gift from Google Sheet AX:AZ on sync (never wipes existing sheet rows; appends only missing new month)
  useEffect(() => {
    if (!remoteBouGiftVersion || bouDirtyRef.current) return;
    const remoteArr = Array.isArray(remoteBouGift) ? remoteBouGift : [];
    const merged = mergeBouGiftEntries(remoteArr);
    const remoteKeys = new Set(remoteArr.map(r => normalizeBouMonthKey(r.month)).filter(Boolean));
    const hasMissingMonth = merged.some(r => !remoteKeys.has(normalizeBouMonthKey(r.month)));

    if (!hasMissingMonth) {
      lastSavedBouJsonRef.current = JSON.stringify(merged);
    } else {
      bouDirtyRef.current = true;
    }

    setBouGiftRows(merged);
    try {
      localStorage.setItem(bouStorageKey, JSON.stringify(merged));
    } catch {}
  }, [remoteBouGift, remoteBouGiftVersion, bouStorageKey]);

  // Default month from Month Mapping -> compute next 3 months (+1, +2, +3)
  const { defaultMonthLabel, upcomingMonths } = useMemo(() => {
    const defMapping = monthMappings.find(m => m.isDefault);
    const rawBaseLabel = defMapping?.label || selectedMonth || '';
    const cleanedBase = cleanMappingLabel(rawBaseLabel) || rawBaseLabel;

    let baseKey = getMonthKeyFromLabel(cleanedBase);
    if (!/^\d{4}-\d{2}$/.test(baseKey) && defMapping?.startDate) {
      const sd = normalizeDate(defMapping.startDate);
      if (/^\d{4}-\d{2}/.test(sd)) {
        baseKey = sd.slice(0, 7);
      }
    }

    const now = new Date();
    let baseYear = now.getFullYear();
    let baseMonth = now.getMonth() + 1;

    if (/^\d{4}-\d{2}$/.test(baseKey)) {
      const [yNum, mNum] = baseKey.split('-').map(Number);
      if (!isNaN(yNum) && !isNaN(mNum) && mNum >= 1 && mNum <= 12) {
        baseYear = yNum;
        baseMonth = mNum;
      }
    }

    const slots: UpcomingMonthSlot[] = [];
    for (let offset = 1; offset <= 3; offset++) {
      const d = new Date(baseYear, baseMonth - 1 + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const expectedLabel = `${MONTHS_SHORT[m - 1]}-${y}`;

      const mapped = monthMappings.find(item => {
        if (!item || !item.label) return false;
        const itemKey = getMonthKeyFromLabel(item.label);
        const itemClean = cleanMappingLabel(item.label).toLowerCase();
        return itemKey === ym || itemClean === expectedLabel.toLowerCase();
      });

      if (mapped) {
        const mappedLabel = cleanMappingLabel(mapped.label) || expectedLabel;
        const sDate = mapped.startDate ? normalizeDate(mapped.startDate) : '';
        const eDate = mapped.endDate ? normalizeDate(mapped.endDate) : '';
        slots.push({
          key: ym,
          label: mappedLabel,
          rangeText: sDate && eDate ? `${formatShortDayMonth(sDate)} to ${formatShortDayMonth(eDate)}` : '',
          isMapped: true
        });
      } else {
        slots.push({
          key: ym,
          label: '',
          rangeText: '',
          isMapped: false
        });
      }
    }

    return {
      defaultMonthLabel: cleanedBase,
      upcomingMonths: slots
    };
  }, [monthMappings, selectedMonth]);

  const monthLabelsTuple = useMemo<[string, string, string]>(
    () => [
      upcomingMonths[0]?.label || '',
      upcomingMonths[1]?.label || '',
      upcomingMonths[2]?.label || ''
    ],
    [upcomingMonths]
  );

  // Debounced auto-save to Google Sheet AS2:AV whenever edited
  useEffect(() => {
    if (!isDirtyRef.current) return;

    const shouldRebuild = structureDirtyRef.current;
    const payload: Upcoming3MonthPlan = {
      ...plan,
      monthLabels: monthLabelsTuple,
      forceRebuild: shouldRebuild
    };
    const serialized = JSON.stringify({ ...plan, monthLabels: monthLabelsTuple });
    if (!shouldRebuild && serialized === lastSavedJsonRef.current) return;

    setSyncState('saving');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const ok = await onSyncPlan(payload);
        lastSavedJsonRef.current = serialized;
        isDirtyRef.current = false;
        structureDirtyRef.current = false;
        setSyncState(ok ? 'saved' : 'queued');
      } catch {
        setSyncState('queued');
      }
    }, 650);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [plan, monthLabelsTuple, onSyncPlan]);

  // Debounced auto-save for Bou Gift to Google Sheet AX:AZ (updates only changed cells & appends new months)
  useEffect(() => {
    if (!bouDirtyRef.current) return;

    const serialized = JSON.stringify(bouGiftRows);
    if (serialized === lastSavedBouJsonRef.current) return;

    setSyncState('saving');
    if (bouDebounceRef.current) clearTimeout(bouDebounceRef.current);

    bouDebounceRef.current = setTimeout(async () => {
      try {
        const ok = await onSaveBouGift(bouGiftRows);
        lastSavedBouJsonRef.current = serialized;
        bouDirtyRef.current = false;
        setSyncState(ok ? 'saved' : 'queued');
      } catch {
        setSyncState('queued');
      }
    }, 650);

    return () => {
      if (bouDebounceRef.current) clearTimeout(bouDebounceRef.current);
    };
  }, [bouGiftRows, onSaveBouGift]);

  const updatePlan = (updater: (prev: Upcoming3MonthPlan) => Upcoming3MonthPlan) => {
    isDirtyRef.current = true;
    setPlan(prev => {
      const next = updater(prev);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ ...next, monthLabels: monthLabelsTuple }));
      } catch {}
      return next;
    });
  };

  // Suggestions from expenseCategories not already in the plan
  const suggestedExtraCats = useMemo(() => {
    const existingLower = new Set(plan.categories.map(c => c.toLowerCase()));
    return expenseCategories
      .map(c => cleanCategoryName(c, 'en').trim())
      .filter(c => c && !existingLower.has(c.toLowerCase()));
  }, [expenseCategories, plan.categories]);

  // Handlers
  const handleCategoryAmountChange = (cat: string, monthIdx: 0 | 1 | 2, rawVal: string) => {
    const num = parseNumericInput(rawVal);
    updatePlan(prev => {
      const row = [...(prev.categoryValues[cat] || [0, 0, 0])] as [number, number, number];
      row[monthIdx] = num;
      return {
        ...prev,
        categoryValues: {
          ...prev.categoryValues,
          [cat]: row
        }
      };
    });
  };

  const handleCopyFirstMonthToAll = (cat: string) => {
    updatePlan(prev => {
      const row = prev.categoryValues[cat] || [0, 0, 0];
      const v = row[0] || 0;
      return {
        ...prev,
        categoryValues: {
          ...prev.categoryValues,
          [cat]: [v, v, v]
        }
      };
    });
    setCopiedCategory(cat);
    setTimeout(() => setCopiedCategory(null), 1400);
  };

  const handleAddCategoryRow = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanCategoryName(newCategoryInput, 'en').trim();
    if (!cleaned) return;
    if (plan.categories.some(c => c.toLowerCase() === cleaned.toLowerCase())) {
      setNewCategoryInput('');
      return;
    }
    structureDirtyRef.current = true;
    updatePlan(prev => ({
      ...prev,
      categories: [...prev.categories, cleaned],
      categoryValues: {
        ...prev.categoryValues,
        [cleaned]: [0, 0, 0]
      }
    }));
    setNewCategoryInput('');
  };

  const handleRemoveExtraCategory = (cat: string) => {
    if (DEFAULT_CORE_SET.has(cat.toLowerCase())) return;
    structureDirtyRef.current = true;
    updatePlan(prev => {
      const nextVals = { ...prev.categoryValues };
      delete nextVals[cat];
      return {
        ...prev,
        categories: prev.categories.filter(c => c !== cat),
        categoryValues: nextVals
      };
    });
  };

  const handleFundingChange = (field: 'salary' | 'have' | 'loan', monthIdx: 0 | 1 | 2, rawVal: string) => {
    const num = parseNumericInput(rawVal);
    updatePlan(prev => {
      const tuple = [...prev[field]] as [number, number, number];
      tuple[monthIdx] = num;
      return { ...prev, [field]: tuple };
    });
  };

  const handleBkashTotalChange = (rawVal: string) => {
    const num = parseNumericInput(rawVal);
    updatePlan(prev => ({ ...prev, bkashLoanTotal: num }));
  };

  const handleBouGiftGiveChange = (monthLabel: string, rawVal: string) => {
    const num = parseNumericInput(rawVal);
    bouDirtyRef.current = true;
    setBouGiftRows(prev => {
      const next = mergeBouGiftEntries(prev).map(entry =>
        entry.month === monthLabel ? { ...entry, give: num } : entry
      );
      try {
        localStorage.setItem(bouStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Formula Calculations (Matching Spreadsheet Exactly)
  const calc = useMemo(() => {
    const categoryTotals: [number, number, number] = [0, 0, 0];
    const bkashPayments: [number, number, number] = [0, 0, 0];

    plan.categories.forEach(cat => {
      const vals = plan.categoryValues[cat] || [0, 0, 0];
      const isBkash = isBkashLoanCategory(cat);
      for (let i = 0; i < 3; i++) {
        const v = Number(vals[i]) || 0;
        categoryTotals[i] += v;
        if (isBkash) bkashPayments[i] += v;
      }
    });

    const fundingTotals: [number, number, number] = [
      (Number(plan.salary[0]) || 0) + (Number(plan.have[0]) || 0) + (Number(plan.loan[0]) || 0),
      (Number(plan.salary[1]) || 0) + (Number(plan.have[1]) || 0) + (Number(plan.loan[1]) || 0),
      (Number(plan.salary[2]) || 0) + (Number(plan.have[2]) || 0) + (Number(plan.loan[2]) || 0)
    ];

    const arrears: [number, number, number] = [
      fundingTotals[0] - categoryTotals[0],
      fundingTotals[1] - categoryTotals[1],
      fundingTotals[2] - categoryTotals[2]
    ];

    const startDebt = Number(plan.bkashLoanTotal) || 0;
    const due1 = startDebt - bkashPayments[0];
    const due2 = due1 - bkashPayments[1];
    const due3 = due2 - bkashPayments[2];
    const bkashFinalDue: [number, number, number] = [due1, due2, due3];

    const bouTotalAmount = bouGiftRows.reduce((sum, r) => sum + (Number(r.budget) || 0), 0);
    const bouTotalGive = bouGiftRows.reduce((sum, r) => sum + (Number(r.give) || 0), 0);
    const bouDue = bouTotalAmount - bouTotalGive;

    return {
      categoryTotals,
      fundingTotals,
      arrears,
      bkashPayments,
      bkashFinalDue,
      sum3MExpense: categoryTotals[0] + categoryTotals[1] + categoryTotals[2],
      sum3MFunds: fundingTotals[0] + fundingTotals[1] + fundingTotals[2],
      sum3MArrear: fundingTotals[0] + fundingTotals[1] + fundingTotals[2] - (categoryTotals[0] + categoryTotals[1] + categoryTotals[2]),
      sum3MBkashPaid: bkashPayments[0] + bkashPayments[1] + bkashPayments[2],
      bouGiftRows,
      bouTotalAmount,
      bouTotalGive,
      bouDue
    };
  }, [plan, bouGiftRows]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-4 pb-16 animate-fadeIn">
      {/* ================================================================ */}
      {/* TOP SUMMARY: NEXT 3 MONTHS AFTER DEFAULT MONTH                   */}
      {/* ================================================================ */}
      <div className="bg-gradient-to-b from-[#0D4441] to-[#0A3734] rounded-2xl p-2.5 sm:p-5 border border-teal-700/50 shadow-md space-y-2.5 sm:space-y-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#062423] border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-base font-black text-[#F0FDFA] tracking-tight">
                  {t('Upcoming 3 Month Plan', 'আগামী ৩ মাসের পরিকল্পনা')}
                </h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-950/80 border border-purple-700/60 text-purple-200 text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider">
                  <Shield className="w-2.5 h-2.5 text-purple-400" />
                  Super Admin
                </span>
              </div>
              {defaultMonthLabel && (
                <p className="text-[10px] sm:text-xs text-teal-300/80 font-medium mt-0.5">
                  {t('Default:', 'ডিফল্ট:')} {defaultMonthLabel}
                </p>
              )}
            </div>
          </div>

          {syncState !== 'idle' && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-[#062423] border border-teal-700/60 text-[9.5px] sm:text-[10px] font-bold">
              {syncState === 'saving' && (
                <>
                  <RefreshCw className="w-3 h-3 text-amber-300 animate-spin" />
                  <span className="text-amber-300">{t('Saving...', 'সেভ হচ্ছে...')}</span>
                </>
              )}
              {syncState === 'saved' && (
                <>
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">{t('Saved to Sheet', 'শিটে সেভ হয়েছে')}</span>
                </>
              )}
              {syncState === 'queued' && (
                <>
                  <CloudCheck className="w-3.5 h-3.5 text-teal-300" />
                  <span className="text-teal-300">{t('Saved Locally', 'অফলাইনে সেভ')}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Summary Matrix Table: Metrics | Month 1 | Month 2 | Month 3 (100% Mobile Fit) */}
        <div className="bg-[#062423] rounded-xl border border-teal-800/80 overflow-hidden">
          <table className="w-full table-fixed text-left border-collapse">
            <thead>
              <tr className="bg-[#041D1C] text-teal-300/90 border-b border-teal-800/70">
                <th
                  scope="col"
                  className="w-[34%] py-1.5 px-2 sm:px-3.5 text-[9.5px] sm:text-[11px] font-black uppercase tracking-wider border-r border-teal-800/60"
                >
                  {t('Metrics', 'বিবরণ')}
                </th>
                {upcomingMonths.map(slot => (
                  <th
                    key={slot.key}
                    scope="col"
                    className="w-[22%] py-1.5 px-1 sm:px-3 text-[9.5px] sm:text-xs font-black text-right text-[#F0FDFA] truncate"
                  >
                    {slot.isMapped && slot.label ? slot.label : '\u00A0'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-800/50 text-[10px] sm:text-xs">
              <tr className="hover:bg-teal-900/20">
                <td className="py-1.5 px-2 sm:px-3.5 font-bold text-teal-200 border-r border-teal-800/60 leading-tight">
                  {t('Total Income', 'মোট আয়')}
                </td>
                {calc.fundingTotals.map((income, idx) => (
                  <td key={idx} className="py-1.5 px-1 sm:px-3 text-right font-extrabold text-emerald-400 tabular-nums">
                    {formatNumberLocale(income, lang)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-teal-900/20">
                <td className="py-1.5 px-2 sm:px-3.5 font-bold text-teal-200 border-r border-teal-800/60 leading-tight">
                  {t('Expense', 'খরচ')}
                </td>
                {calc.categoryTotals.map((exp, idx) => (
                  <td key={idx} className="py-1.5 px-1 sm:px-3 text-right font-extrabold text-[#FF7A59] tabular-nums">
                    {formatNumberLocale(exp, lang)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-teal-900/20">
                <td className="py-1.5 px-2 sm:px-3.5 font-bold text-teal-200 border-r border-teal-800/60 leading-tight">
                  {t('Arrear', 'বকেয়া')}
                </td>
                {calc.arrears.map((arrear, idx) => (
                  <td
                    key={idx}
                    className={`py-1.5 px-1 sm:px-3 text-right font-extrabold tabular-nums ${
                      arrear >= 0 ? 'text-emerald-300' : 'text-rose-400'
                    }`}
                  >
                    {arrear >= 0 ? '+' : ''}
                    {formatNumberLocale(arrear, lang)}
                  </td>
                ))}
              </tr>

              <tr className="bg-[#082C2A]/70 hover:bg-teal-900/25">
                <td className="py-1.5 px-2 sm:px-3.5 font-bold text-amber-200 border-r border-teal-800/60 leading-tight">
                  {t('Bkash Paid / Due', 'বিকাশ / বাকি')}
                </td>
                {upcomingMonths.map((slot, idx) => (
                  <td key={slot.key} className="py-1.5 px-1 sm:px-3 text-right font-bold text-amber-300 tabular-nums leading-tight">
                    <span>{formatNumberLocale(calc.bkashPayments[idx], lang)}</span>
                    <span className="hidden sm:inline"> / </span>
                    <span className="block sm:inline text-[9px] sm:text-xs text-amber-200/85">
                      <span className="sm:hidden">/ </span>
                      {formatNumberLocale(calc.bkashFinalDue[idx], lang)}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SECTION 1: CATEGORY-WISE INPUTS (AS3:AV...)                      */}
      {/* ================================================================ */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-md overflow-hidden">
        <div className="px-2.5 sm:px-3.5 py-2 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <h3 className="text-[11px] sm:text-sm font-black text-[#F0FDFA]">
              {t('1. Category-Wise Inputs', '১. ক্যাটাগরি অনুযায়ী ইনপুট')}
            </h3>
          </div>
          <span className="text-[9.5px] sm:text-[10px] font-semibold text-teal-300/80">
            {plan.categories.length} {t('categories', 'টি ক্যাটাগরি')}
          </span>
        </div>

        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#062423]/90 text-teal-300/90 border-b border-teal-800/80">
              <th
                scope="col"
                className="w-[32%] py-1.5 px-1.5 sm:px-3 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider border-r border-teal-800/60"
              >
                {t('Category', 'ক্যাটাগরি')}
              </th>
              {upcomingMonths.map(slot => (
                <th
                  key={slot.key}
                  scope="col"
                  className="w-[17%] py-1.5 px-0.5 sm:px-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-right"
                >
                  <div className="text-[#F0FDFA] min-h-[13px] truncate">
                    {slot.isMapped && slot.label ? slot.label : '\u00A0'}
                  </div>
                  {slot.isMapped && slot.rangeText && (
                    <div className="hidden sm:block text-[8px] font-semibold text-teal-400/75 normal-case leading-tight">
                      {slot.rangeText}
                    </div>
                  )}
                </th>
              ))}
              <th
                scope="col"
                className="w-[17%] py-1.5 px-1 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-right"
              >
                {t('Total', 'মোট')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-800/50 text-[10px] sm:text-xs text-[#F0FDFA]">
            {plan.categories.map(cat => {
              const vals = plan.categoryValues[cat] || [0, 0, 0];
              const rowTotal = (Number(vals[0]) || 0) + (Number(vals[1]) || 0) + (Number(vals[2]) || 0);
              const isCopied = copiedCategory === cat;
              const isBkash = isBkashLoanCategory(cat);
              const isExtra = !DEFAULT_CORE_SET.has(cat.toLowerCase());

              return (
                <tr
                  key={cat}
                  className={`hover:bg-teal-900/30 transition-colors ${
                    isBkash ? 'bg-amber-950/15' : ''
                  }`}
                >
                  <td className="py-1 px-1.5 sm:px-3 border-r border-teal-800/60">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CategoryIcon category={cat} size="xs" className="hidden sm:block text-teal-300/80 shrink-0" />
                        <span className="font-semibold text-[#F0FDFA] text-[10px] sm:text-xs leading-tight break-words">
                          {cat}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyFirstMonthToAll(cat)}
                          title={t('Copy 1st value to all 3 columns', '১ম মান ৩ কলামে কপি করুন')}
                          className="p-0.5 rounded bg-[#062423] hover:bg-teal-800 text-teal-300/75 hover:text-white border border-teal-700/50 cursor-pointer transition-colors"
                        >
                          {isCopied ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5" />
                          )}
                        </button>
                        {isExtra && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraCategory(cat)}
                            title={t('Remove row', 'সরিয়ে ফেলুন')}
                            className="p-0.5 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </td>

                  {[0, 1, 2].map(monthIdx => {
                    const val = Number(vals[monthIdx]) || 0;
                    return (
                      <td key={monthIdx} className="py-0.5 px-0.5 sm:px-2 text-right">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={val > 0 ? String(val) : ''}
                          onChange={e =>
                            handleCategoryAmountChange(cat, monthIdx as 0 | 1 | 2, e.target.value)
                          }
                          placeholder="0"
                          className="w-full h-6 sm:h-7 bg-[#062423] border border-teal-700/70 rounded-md px-1 sm:px-1.5 text-right text-[10px] sm:text-xs font-bold text-amber-300 placeholder:text-teal-600 focus:outline-none focus:border-emerald-400 tabular-nums"
                        />
                      </td>
                    );
                  })}

                  <td className="py-1 px-1 sm:px-3 text-right font-extrabold text-[10px] sm:text-xs text-emerald-300 tabular-nums">
                    {rowTotal > 0 ? formatNumberLocale(rowTotal, lang) : '0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#062423] border-t-2 border-teal-700/80 text-[10px] sm:text-xs font-black">
              <td className="py-2 px-1.5 sm:px-3 border-r border-teal-800/60 text-[#F0FDFA] leading-tight">
                {t('Total Expense', 'মোট খরচ')}
              </td>
              {calc.categoryTotals.map((total, idx) => (
                <td key={idx} className="py-2 px-0.5 sm:px-2 text-right text-[#FF7A59] tabular-nums">
                  {formatNumberLocale(total, lang)}
                </td>
              ))}
              <td className="py-2 px-1 sm:px-3 text-right text-[#FF7A59] tabular-nums">
                {formatNumberLocale(calc.sum3MExpense, lang)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Add Extra Category Row */}
        <form
          onSubmit={handleAddCategoryRow}
          className="p-2 sm:p-2.5 bg-[#062423]/70 border-t border-teal-800/80 flex items-center gap-2"
        >
          <input
            type="text"
            list="upcoming-3m-cat-suggestions"
            value={newCategoryInput}
            onChange={e => setNewCategoryInput(e.target.value)}
            placeholder={t('Add extra category row...', 'নতুন ক্যাটাগরি যোগ করুন...')}
            className="flex-1 min-w-0 bg-[#0B3C39] border border-teal-700/70 rounded-xl px-2.5 py-1.5 text-xs text-[#F0FDFA] placeholder:text-teal-400/60 focus:outline-none focus:border-emerald-400"
          />
          <datalist id="upcoming-3m-cat-suggestions">
            {suggestedExtraCats.map(c => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Add', 'যোগ')}</span>
          </button>
        </form>
      </div>

      {/* ================================================================ */}
      {/* SECTION 2: FUNDS & ARREAR CALCULATION                            */}
      {/* ================================================================ */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-md overflow-hidden">
        <div className="px-2.5 sm:px-3.5 py-2 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <h3 className="text-[11px] sm:text-sm font-black text-[#F0FDFA]">
              {t('2. Funds & Arrear', '২. ফান্ড ও বকেয়া')}
            </h3>
          </div>
          <span className="text-[9.5px] sm:text-[10px] font-semibold text-teal-300/75">
            {t('Arrear = Total − Expense', 'বকেয়া = মোট − খরচ')}
          </span>
        </div>

        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#062423]/90 text-teal-300/90 border-b border-teal-800/80">
              <th className="w-[32%] py-1.5 px-1.5 sm:px-3 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider border-r border-teal-800/60">
                {t('Income / Funds', 'আয় / ফান্ড')}
              </th>
              {upcomingMonths.map(slot => (
                <th key={slot.key} className="w-[17%] py-1.5 px-0.5 sm:px-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-right truncate">
                  {slot.isMapped && slot.label ? slot.label : '\u00A0'}
                </th>
              ))}
              <th className="w-[17%] py-1.5 px-1 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-right">
                {t('Total', 'মোট')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-800/50 text-[10px] sm:text-xs text-[#F0FDFA]">
            {(
              [
                { key: 'salary', label: 'Salary' },
                { key: 'have', label: 'Have' },
                { key: 'loan', label: 'Loan' }
              ] as const
            ).map(row => {
              const rowVals = plan[row.key];
              const rowSum = (Number(rowVals[0]) || 0) + (Number(rowVals[1]) || 0) + (Number(rowVals[2]) || 0);
              return (
                <tr key={row.key} className="hover:bg-teal-900/30">
                  <td className="py-1 px-1.5 sm:px-3 font-bold border-r border-teal-800/60">
                    {row.label}
                  </td>
                  {[0, 1, 2].map(idx => {
                    const val = Number(rowVals[idx]) || 0;
                    return (
                      <td key={idx} className="py-0.5 px-0.5 sm:px-2 text-right">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={val > 0 ? String(val) : ''}
                          onChange={e =>
                            handleFundingChange(row.key, idx as 0 | 1 | 2, e.target.value)
                          }
                          placeholder="0"
                          className="w-full h-6 sm:h-7 bg-[#062423] border border-teal-700/70 rounded-md px-1 sm:px-1.5 text-right text-[10px] sm:text-xs font-bold text-emerald-300 placeholder:text-teal-600 focus:outline-none focus:border-emerald-400 tabular-nums"
                        />
                      </td>
                    );
                  })}
                  <td className="py-1 px-1 sm:px-3 text-right font-extrabold text-emerald-300 tabular-nums">
                    {formatNumberLocale(rowSum, lang)}
                  </td>
                </tr>
              );
            })}

            {/* Total Income = Salary + Have + Loan */}
            <tr className="bg-[#062423]/70 font-black">
              <td className="py-2 px-1.5 sm:px-3 border-r border-teal-800/60 text-emerald-300 leading-tight">
                Total Income
              </td>
              {calc.fundingTotals.map((total, idx) => (
                <td key={idx} className="py-2 px-0.5 sm:px-2 text-right text-emerald-400 tabular-nums">
                  {formatNumberLocale(total, lang)}
                </td>
              ))}
              <td className="py-2 px-1 sm:px-3 text-right text-emerald-300 tabular-nums">
                {formatNumberLocale(calc.sum3MFunds, lang)}
              </td>
            </tr>

            {/* Arrear = Total - Category Expense */}
            <tr className="bg-teal-950/70 border-t-2 border-teal-600/60 font-black">
              <td className="py-2 px-1.5 sm:px-3 border-r border-teal-800/60 text-[#F0FDFA]">
                Arrear
              </td>
              {calc.arrears.map((val, idx) => (
                <td
                  key={idx}
                  className={`py-2 px-0.5 sm:px-2 text-right tabular-nums ${
                    val >= 0 ? 'text-emerald-300' : 'text-rose-400'
                  }`}
                >
                  {val >= 0 ? '+' : ''}
                  {formatNumberLocale(val, lang)}
                </td>
              ))}
              <td
                className={`py-2 px-1 sm:px-3 text-right tabular-nums ${
                  calc.sum3MArrear >= 0 ? 'text-emerald-300' : 'text-rose-400'
                }`}
              >
                {calc.sum3MArrear >= 0 ? '+' : ''}
                {formatNumberLocale(calc.sum3MArrear, lang)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ================================================================ */}
      {/* SECTION 3: BKASH LOAN PAYOFF TRACKER                             */}
      {/* ================================================================ */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-md overflow-hidden">
        <div className="px-2.5 sm:px-3.5 py-2 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <h3 className="text-[11px] sm:text-sm font-black text-[#F0FDFA]">
              {t('3. Bkash Loan Tracker', '৩. বিকাশ লোন হিসাব')}
            </h3>
          </div>
          <span className="text-[9.5px] sm:text-[10px] font-semibold text-amber-300/80">
            Loan (Bkash1–4)
          </span>
        </div>

        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#062423]/90 text-teal-300/90 border-b border-teal-800/80">
              <th className="w-[32%] py-1.5 px-1.5 sm:px-3 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider border-r border-teal-800/60">
                Bkash Loan
              </th>
              {upcomingMonths.map(slot => (
                <th key={slot.key} className="w-[17%] py-1.5 px-0.5 sm:px-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-right truncate">
                  {slot.isMapped && slot.label ? slot.label : '\u00A0'}
                </th>
              ))}
              <th className="w-[17%] py-1.5 px-1 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-right">
                {t('Total', 'মোট')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-800/50 text-[10px] sm:text-xs text-[#F0FDFA]">
            <tr className="hover:bg-teal-900/30">
              <td className="py-1 px-1.5 sm:px-3 font-bold border-r border-teal-800/60 leading-tight">
                Bkash Loan Total
              </td>
              <td className="py-0.5 px-0.5 sm:px-2 text-right">
                <input
                  type="text"
                  inputMode="numeric"
                  value={plan.bkashLoanTotal > 0 ? String(plan.bkashLoanTotal) : ''}
                  onChange={e => handleBkashTotalChange(e.target.value)}
                  placeholder="0"
                  className="w-full h-6 sm:h-7 bg-[#062423] border border-amber-500/60 rounded-md px-1 sm:px-1.5 text-right text-[10px] sm:text-xs font-black text-amber-300 placeholder:text-teal-600 focus:outline-none focus:border-amber-400 tabular-nums"
                />
              </td>
              <td className="py-1 px-0.5 sm:px-2 text-right text-teal-500/60 font-semibold">—</td>
              <td className="py-1 px-0.5 sm:px-2 text-right text-teal-500/60 font-semibold">—</td>
              <td className="py-1 px-1 sm:px-3 text-right font-extrabold text-amber-300 tabular-nums">
                {formatNumberLocale(plan.bkashLoanTotal, lang)}
              </td>
            </tr>

            <tr className="bg-[#062423]/60 font-bold">
              <td className="py-1.5 px-1.5 sm:px-3 border-r border-teal-800/60 leading-tight">
                Bkash Loan Payment
              </td>
              {calc.bkashPayments.map((paid, idx) => (
                <td key={idx} className="py-1.5 px-0.5 sm:px-2 text-right text-emerald-400 font-extrabold tabular-nums">
                  {formatNumberLocale(paid, lang)}
                </td>
              ))}
              <td className="py-1.5 px-1 sm:px-3 text-right text-emerald-300 font-black tabular-nums">
                {formatNumberLocale(calc.sum3MBkashPaid, lang)}
              </td>
            </tr>

            <tr className="bg-amber-950/25 border-t-2 border-amber-700/50 font-black">
              <td className="py-2 px-1.5 sm:px-3 border-r border-teal-800/60 text-amber-200 leading-tight">
                Final Due
              </td>
              {calc.bkashFinalDue.map((due, idx) => (
                <td
                  key={idx}
                  className={`py-2 px-0.5 sm:px-2 text-right tabular-nums ${
                    due <= 0 ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {formatNumberLocale(due, lang)}
                </td>
              ))}
              <td className="py-2 px-1 sm:px-3 text-right text-teal-300/80 text-[9px] sm:text-[11px] font-bold leading-tight">
                {plan.bkashLoanTotal > 0
                  ? calc.bkashFinalDue[2] <= 0
                    ? t('Paid Off', 'পরিশোধিত')
                    : `${t('Left:', 'বাকি:')} ${formatNumberLocale(calc.bkashFinalDue[2], lang)}`
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ================================================================ */}
      {/* SECTION 4: BOU GIFT TRACKER (AUTO TILL ONGOING MONTH)            */}
      {/* ================================================================ */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-md overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 bg-[#062423] border-b border-teal-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-rose-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-black text-[#F0FDFA]">
              {t('Bou Gift', 'বউ গিফট')}
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-teal-300/75">
            {calc.bouGiftRows[0]?.month || '17-Feb-26'} – {calc.bouGiftRows[calc.bouGiftRows.length - 1]?.month || ''}
          </span>
        </div>

        {/* Clean Summary Row: Total Amount | Give | Due */}
        <div className="grid grid-cols-3 divide-x divide-teal-800/60 bg-[#082C2A] border-b border-teal-800/80 text-center">
          <div className="py-2 px-1.5 sm:py-2.5 sm:px-3">
            <div className="text-[9.5px] sm:text-[10px] font-bold text-teal-300/75">
              {t('Total Amount', 'মোট বাজেট')}
            </div>
            <div className="text-xs sm:text-base font-black text-[#F0FDFA] tabular-nums mt-0.5">
              {formatNumberLocale(calc.bouTotalAmount, lang)}
            </div>
          </div>

          <div className="py-2 px-1.5 sm:py-2.5 sm:px-3">
            <div className="text-[9.5px] sm:text-[10px] font-bold text-teal-300/75">
              {t('Give', 'দেওয়া')}
            </div>
            <div className="text-xs sm:text-base font-black text-emerald-400 tabular-nums mt-0.5">
              {formatNumberLocale(calc.bouTotalGive, lang)}
            </div>
          </div>

          <div className="py-2 px-1.5 sm:py-2.5 sm:px-3">
            <div className="text-[9.5px] sm:text-[10px] font-bold text-teal-300/75">
              {t('Due', 'বাকি')}
            </div>
            <div
              className={`text-xs sm:text-base font-black tabular-nums mt-0.5 ${
                calc.bouDue <= 0 ? 'text-emerald-300' : 'text-rose-400'
              }`}
            >
              {formatNumberLocale(calc.bouDue, lang)}
            </div>
          </div>
        </div>

        <table className="w-full table-fixed text-left border-collapse">
          <thead>
            <tr className="bg-[#062423]/90 text-teal-300/90 border-b border-teal-800/80 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
              <th
                scope="col"
                className="w-[34%] py-2 px-2.5 sm:px-4 border-r border-teal-800/60"
              >
                {t('Month', 'মাস')}
              </th>
              <th
                scope="col"
                className="w-[33%] py-2 px-2.5 sm:px-4 text-right"
              >
                {t('Budget', 'বাজেট')}
              </th>
              <th
                scope="col"
                className="w-[33%] py-2 px-2.5 sm:px-4 text-right"
              >
                {t('Give', 'দেওয়া')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-800/45 text-[11px] sm:text-xs text-[#F0FDFA]">
            {calc.bouGiftRows.map(row => {
              const isPaid = row.budget > 0 && row.give >= row.budget;
              return (
                <tr
                  key={row.month}
                  className={`transition-colors hover:bg-teal-900/30 ${
                    isPaid ? 'bg-emerald-950/20' : ''
                  }`}
                >
                  <td className="py-1.5 px-2.5 sm:px-4 font-bold text-[#F0FDFA] border-r border-teal-800/60">
                    {row.month}
                  </td>
                  <td className="py-1.5 px-2.5 sm:px-4 text-right font-semibold text-teal-200 tabular-nums">
                    {formatNumberLocale(row.budget, lang)}
                  </td>
                  <td className="py-1 px-2 sm:px-3.5 text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.give > 0 ? String(row.give) : ''}
                      onChange={e => handleBouGiftGiveChange(row.month, e.target.value)}
                      placeholder="0"
                      className={`w-full h-7 sm:h-8 bg-[#062423] border rounded-lg px-2 text-right text-[11px] sm:text-xs font-bold placeholder:text-teal-600 focus:outline-none focus:border-emerald-400 tabular-nums transition-colors ${
                        isPaid
                          ? 'border-emerald-600/70 text-emerald-300'
                          : 'border-teal-700/70 text-amber-300'
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#062423] border-t-2 border-teal-700/80 text-[11px] sm:text-xs font-black">
              <td className="py-2 px-2.5 sm:px-4 border-r border-teal-800/60 text-[#F0FDFA]">
                {t('Total', 'মোট')}
              </td>
              <td className="py-2 px-2.5 sm:px-4 text-right text-teal-200 tabular-nums">
                {formatNumberLocale(calc.bouTotalAmount, lang)}
              </td>
              <td className="py-2 px-2.5 sm:px-4 text-right text-emerald-400 tabular-nums">
                {formatNumberLocale(calc.bouTotalGive, lang)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

