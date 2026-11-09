import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModalPortal } from './Modals';
import {
  Calendar,
  Delete,
  Check,
  X,
  Plus,
  Wifi,
  Zap,
  Pill,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Home,
  User,
  Users,
  Heart,
  Coffee,
  Flame,
  Moon,
  Monitor,
  Key,
  Armchair,
  Navigation,
  PiggyBank,
  Handshake,
  Apple,
  Wallet,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { TransactionType } from '../types';
import { cleanCategoryName, getCategoryEmoji } from '../utils/categoryUtils';
import { evaluateExpression } from '../utils/calcUtils';
import { formatNumberLocale } from '../utils/dateUtils';

interface EntryTabProps {
  entryType: TransactionType;
  setEntryType: (type: TransactionType) => void;
  entryCategory: string;
  setEntryCategory: (cat: string) => void;
  entryDate: string;
  setEntryDate: (date: string) => void;
  entryNote: string;
  setEntryNote: (note: string) => void;
  calcDisplay: string;
  setCalcDisplay: (val: string) => void;
  expenseCategories: string[];
  incomeCategories: string[];
  onOpenCategoryManager: () => void;
  onSubmit: (evaluatedAmount?: number) => Promise<void>;
  isSubmitting: boolean;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

// Dynamic icon mapper sourced from sheet category or hash
const CategoryIcon: React.FC<{ category: string }> = ({ category }) => {
  const emoji = getCategoryEmoji(category);
  return <span className="text-xl leading-none select-none">{emoji}</span>;
};

export const EntryTab: React.FC<EntryTabProps> = ({
  entryType,
  setEntryType,
  entryCategory,
  setEntryCategory,
  entryDate,
  setEntryDate,
  entryNote,
  setEntryNote,
  calcDisplay,
  setCalcDisplay,
  expenseCategories,
  incomeCategories,
  onOpenCategoryManager,
  onSubmit,
  isSubmitting,
  lang,
  t
}) => {
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);

  // Listen for back button / external close events
  useEffect(() => {
    const handleCloseEvent = () => {
      setIsCalculatorOpen(false);
    };
    window.addEventListener('close-calc-modal', handleCloseEvent);
    return () => window.removeEventListener('close-calc-modal', handleCloseEvent);
  }, []);

  // Keyboard navigation when calculator is open
  useEffect(() => {
    if (!isCalculatorOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCalculatorOpen(false);
        return;
      }
      // If typing inside input or textarea, let default typing occur
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-', '*', '/', '.'].includes(e.key)) {
        handleKeyClick(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyClick('DEL');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveTransaction();
      } else if (e.key.toLowerCase() === 'c') {
        handleKeyClick('C');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCalculatorOpen, calcDisplay]);

  const currentCategories = entryType === 'Expense' ? expenseCategories : incomeCategories;

  // Handle Category Click -> Sets category & Opens Calculator
  const handleSelectCategory = (cat: string) => {
    setEntryCategory(cat);
    if (!calcDisplay || calcDisplay === '') {
      setCalcDisplay('0');
    }
    setIsCalculatorOpen(true);
  };

  // Calculator Keypad operations
  const handleKeyClick = (key: string) => {
    if (key === 'C') {
      setCalcDisplay('0');
      return;
    }
    if (key === 'DEL') {
      if (calcDisplay.length <= 1) {
        setCalcDisplay('0');
      } else {
        setCalcDisplay(calcDisplay.slice(0, -1));
      }
      return;
    }

    if (key === '✓') {
      handleSaveTransaction();
      return;
    }

    if (key === '=') {
      const res = evaluateExpression(calcDisplay);
      setCalcDisplay(String(res));
      return;
    }

    // Mathematical operators +, -, *, /
    if (['+', '-', '*', '/'].includes(key)) {
      const lastChar = calcDisplay.slice(-1);
      if (['+', '-', '*', '/'].includes(lastChar)) {
        setCalcDisplay(calcDisplay.slice(0, -1) + key);
      } else {
        setCalcDisplay(calcDisplay + key);
      }
      return;
    }

    // Number or dot
    if (calcDisplay === '0' && key !== '.') {
      setCalcDisplay(key);
    } else {
      if (key === '.') {
        const parts = calcDisplay.split(/[+\-*/]/);
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) return;
      }
      if (calcDisplay.length < 15) {
        setCalcDisplay(calcDisplay + key);
      }
    }
  };

  const handleSaveTransaction = async () => {
    const evaluated = evaluateExpression(calcDisplay);
    if (evaluated > 0) {
      setCalcDisplay(String(evaluated));
    }
    await onSubmit(evaluated > 0 ? evaluated : undefined);
    setIsCalculatorOpen(false);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.85 },
    show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 350, damping: 25 } }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-16 select-none pt-1 px-1 sm:px-3 animate-fadeIn">
      {/* 1. Sleek Animated Type Selector Tabs: Expense | Income */}
      <div className="w-full max-w-md mx-auto bg-[#0B3C39] border border-teal-800/80 p-1.5 rounded-2xl grid grid-cols-2 gap-1.5 shadow-sm relative overflow-hidden">
        <button
          type="button"
          onClick={() => {
            setEntryType('Expense');
            setEntryCategory('');
          }}
          className={`relative py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 z-10 ${
            entryType === 'Expense' ? 'text-white' : 'text-teal-200/80 hover:text-white'
          }`}
        >
          {entryType === 'Expense' && (
            <motion.div
              layoutId="entryTypeBg"
              className="absolute inset-0 bg-gradient-to-r from-[#FF7A59] to-[#FF6B4A] rounded-xl shadow-[0_4px_16px_rgba(255,122,89,0.35)] z-[-1]"
              transition={{ type: 'spring' as const, stiffness: 450, damping: 32 }}
            />
          )}
          <span>{t('Expense', 'খরচ')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEntryType('Income');
            setEntryCategory('');
          }}
          className={`relative py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 z-10 ${
            entryType === 'Income' ? 'text-white' : 'text-teal-200/80 hover:text-white'
          }`}
        >
          {entryType === 'Income' && (
            <motion.div
              layoutId="entryTypeBg"
              className="absolute inset-0 bg-[#16A34A] rounded-xl shadow-md z-[-1]"
              transition={{ type: 'spring' as const, stiffness: 450, damping: 32 }}
            />
          )}
          <span>{t('Income', 'আয়')}</span>
        </button>
      </div>

      {/* 2. Selected Category Card OR Minimal Prompt */}
      <div className="w-full max-w-xl mx-auto">
        <AnimatePresence mode="wait">
          {entryCategory ? (
            <motion.div
              key="selected-card"
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              onClick={() => setIsCalculatorOpen(true)}
              className="bg-[#0B3C39] border border-teal-800/80 p-3.5 rounded-2xl shadow-sm flex items-center justify-between cursor-pointer hover:bg-teal-900/80 transition-all active:scale-98"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 ${
                  entryType === 'Expense' ? 'bg-[#FF7A59] shadow-sm shadow-[#FF7A59]/40' : 'bg-[#16A34A]'
                }`}>
                  <CategoryIcon category={entryCategory} />
                </div>
                <div className="min-w-0">
                  <span className="text-[9.5px] font-bold text-teal-300/80 uppercase tracking-wider block">
                    {t('Selected Category', 'নির্বাচিত ক্যাটাগরি')}
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-[#F0FDFA] truncate block leading-tight">
                    {cleanCategoryName(entryCategory, lang)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end">
                  <span className="text-[9.5px] font-bold text-teal-300/80 uppercase">
                    {t('Amount', 'পরিমাণ')}
                  </span>
                  <span className={`text-lg sm:text-xl font-black tabular-nums ${
                    entryType === 'Expense' ? 'text-[#FF7A59] drop-shadow-[0_1px_3px_rgba(255,122,89,0.3)]' : 'text-emerald-400'
                  }`}>
                    {calcDisplay}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-teal-900/80 border border-teal-700/60 flex items-center justify-center text-teal-200 hover:bg-teal-800">
                  <Plus className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty-prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-2"
            >
              <p className="text-xs font-bold text-[#F0FDFA] opacity-90 tracking-wide">
                {t('Select a category to enter amount', 'টাকার পরিমাণ যোগ করতে একটি ক্যাটাগরি ছুনুন')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Circular Responsive Category Grid with Stagger & Spring Animations */}
      <motion.div
        key={entryType}
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-y-5 sm:gap-y-6 gap-x-2 sm:gap-x-4 pt-2"
      >
        {currentCategories.map(cat => {
          const isSelected = entryCategory === cat;
          return (
            <motion.button
              key={cat}
              variants={itemVariants}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => handleSelectCategory(cat)}
              className="flex flex-col items-center group cursor-pointer transition-transform"
            >
              {/* Circular Icon Container */}
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all shadow-md ${
                  isSelected
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-[#042F2E] scale-105'
                    : 'bg-[#0B3C39] border border-teal-700/70 text-teal-100 group-hover:border-emerald-400/80 group-hover:bg-teal-800/80'
                }`}
              >
                <CategoryIcon category={cat} />
              </div>

              {/* Category Name Underneath */}
              <span className="text-[11px] sm:text-xs font-bold text-[#F0FDFA] group-hover:text-teal-200 text-center leading-tight max-w-[85px] sm:max-w-[100px] truncate mt-1.5">
                {cleanCategoryName(cat, lang)}
              </span>
            </motion.button>
          );
        })}

        {/* Plus / Add Category Button at the end of grid */}
        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={onOpenCategoryManager}
          className="flex flex-col items-center group cursor-pointer transition-transform"
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-teal-900/50 border-2 border-dashed border-teal-500/80 flex items-center justify-center text-teal-200 group-hover:text-white group-hover:border-teal-300 transition-all shadow-md">
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-teal-200 group-hover:text-white text-center leading-tight mt-1.5">
            {t('Add Category', 'ক্যাটাগরি')}
          </span>
        </motion.button>
      </motion.div>

      {/* 4. Compact Calculator Bottom Sheet Modal via ModalPortal */}
      {isCalculatorOpen && (
        <ModalPortal>
          <div
            data-calc-modal="true"
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center z-[999999] p-0 sm:p-4 select-none animate-fadeIn"
            onClick={() => setIsCalculatorOpen(false)}
          >
            <div
              className="relative bg-[#0B3C39] text-[#F0FDFA] w-full max-w-md md:max-w-lg rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 border-t sm:border border-teal-800/90 shadow-2xl space-y-3 overflow-hidden z-10 animate-modalSpring max-h-[92vh] overflow-y-auto overscroll-contain"
              onClick={e => e.stopPropagation()}
            >
              {/* Header: Category + Date + Close */}
              <div className="flex items-center justify-between gap-2 border-b border-teal-800/80 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm ${
                    entryType === 'Expense' ? 'bg-[#FF7A59] shadow-sm shadow-[#FF7A59]/40' : 'bg-[#16A34A]'
                  }`}>
                    <CategoryIcon category={entryCategory} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold text-[#F0FDFA] truncate block max-w-[140px]">
                      {cleanCategoryName(entryCategory, lang)}
                    </span>
                    <span className={`text-[9.5px] font-black uppercase leading-none block ${
                      entryType === 'Expense' ? 'text-[#FF7A59]' : 'text-emerald-400'
                    }`}>
                      {entryType === 'Expense' ? t('Expense', 'খরচ') : t('Income', 'আয়')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 bg-[#062423] border border-teal-700/70 rounded-xl px-2.5 py-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <input
                      type="date"
                      value={entryDate}
                      onChange={e => setEntryDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-[#F0FDFA] focus:outline-none cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCalculatorOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-teal-900/80 hover:bg-teal-800 text-teal-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Note input & Amount Display */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={entryNote}
                  onChange={e => setEntryNote(e.target.value)}
                  placeholder={t('Add note (optional)...', 'নোট লিখুন (ঐচ্ছিক)...')}
                  className="w-full bg-[#062423] border border-teal-700/70 rounded-xl px-3 py-2 text-xs text-[#F0FDFA] font-semibold focus:outline-none focus:border-emerald-400 placeholder:text-teal-400/60"
                />

                <div className="bg-[#062423] rounded-2xl px-3.5 py-2.5 border border-teal-700/70 flex items-baseline justify-between shadow-inner">
                  <span className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider">
                    {t('Amount', 'পরিমাণ')}
                  </span>
                  <div className="flex items-baseline gap-2">
                    {/[+\-*/]/.test(calcDisplay) && (
                      <span className="text-xs font-bold text-teal-300 animate-fadeIn">
                        = {formatNumberLocale(evaluateExpression(calcDisplay), lang)}
                      </span>
                    )}
                    <span className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                      entryType === 'Expense' ? 'text-[#FF7A59] drop-shadow-[0_1px_4px_rgba(255,122,89,0.35)]' : 'text-emerald-400'
                    }`}>
                      {calcDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4x4 Calculator Keypad with micro-interactions */}
              <div className="grid grid-cols-4 gap-1.5 bg-[#062423] p-2 rounded-2xl border border-teal-700/70">
                {['7', '8', '9', 'DEL', '4', '5', '6', '+', '1', '2', '3', '-', 'C', '0', '.', '✓'].map(key => {
                  const isSave = key === '✓';
                  const isAction = key === 'C' || key === 'DEL' || key === '+' || key === '-';

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeyClick(key)}
                      disabled={isSave && isSubmitting}
                      className={`h-11 sm:h-12 rounded-xl text-base font-extrabold transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none ${
                        isSave
                          ? entryType === 'Expense'
                            ? 'bg-gradient-to-r from-[#FF7A59] to-[#FF6B4A] hover:brightness-110 active:brightness-95 text-white shadow-lg shadow-[#FF7A59]/30'
                            : 'bg-[#16A34A] hover:bg-green-700 active:bg-green-800 text-white shadow-md'
                          : key === 'C'
                          ? 'bg-[#FF7A59]/15 text-[#FF7A59] border border-[#FF7A59]/40 hover:bg-[#FF7A59]/25'
                          : key === 'DEL'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60 hover:bg-amber-900/80'
                          : isAction
                          ? 'bg-teal-900/80 text-teal-200 hover:bg-teal-800 border border-teal-700/60'
                          : 'bg-[#0B3C39] hover:bg-teal-800/80 text-[#F0FDFA] border border-teal-700/60 shadow-xs'
                      }`}
                    >
                      {key === 'DEL' ? (
                        <Delete className="w-4 h-4" />
                      ) : isSave ? (
                        <Check className="w-5 h-5 stroke-[3]" />
                      ) : (
                        key
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

