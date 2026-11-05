import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

// Icon mapper matching the screenshot circular categories
const CategoryIcon: React.FC<{ category: string }> = ({ category }) => {
  const lower = category.toLowerCase();

  if (lower.includes('saving') || lower.includes('সঞ্চয়')) return <PiggyBank className="w-5 h-5" />;
  if (lower.includes('gas') || lower.includes('গ্যাস')) return <Flame className="w-5 h-5" />;
  if (lower.includes('travel') || lower.includes('transport') || lower.includes('যাতায়াত') || lower.includes('ভ্রমণ')) return <Navigation className="w-5 h-5" />;
  if (lower.includes('wifi') || lower.includes('ওয়াইফাই')) return <Wifi className="w-5 h-5" />;
  if (lower.includes('electricity') || lower.includes('বিদ্যুৎ')) return <Zap className="w-5 h-5" />;
  if (lower.includes('relative') || lower.includes('আত্মীয়')) return <Users className="w-5 h-5" />;
  if (lower.includes('medicine') || lower.includes('ঔষধ')) return <Pill className="w-5 h-5" />;
  if (lower.includes('room rent') || lower.includes('রুম ভাড়া')) return <Key className="w-5 h-5" />;
  if (lower.includes('accessories') || lower.includes('সামগ্রী')) return <Armchair className="w-5 h-5" />;
  if (lower.includes('bajar') || lower.includes('bazar') || lower.includes('বাজার')) return <ShoppingBag className="w-5 h-5" />;
  if (lower.includes('family') || lower.includes('পারিবারিক')) return <Users className="w-5 h-5" />;
  if (lower.includes('mr & mrs') || lower.includes('দাম্পত্য')) return <Heart className="w-5 h-5" />;
  if (lower.includes('eid') || lower.includes('ঈদ')) return <Moon className="w-5 h-5" />;
  if (lower.includes('official') || lower.includes('অফিস')) return <Monitor className="w-5 h-5" />;
  if (lower.includes('fruit') || lower.includes('ফল')) return <Apple className="w-5 h-5" />;
  if (lower.includes('hangout') || lower.includes('আড্ডা')) return <Coffee className="w-5 h-5" />;
  if (lower.includes('ধার দিয়েছি') || lower.includes('lent')) return <Handshake className="w-5 h-5" />;
  if (lower.includes('ধার শোধ') || lower.includes('repaid')) return <CheckCircle2 className="w-5 h-5" />;
  if (lower.includes('personal') || lower.includes('পার্সোনাল')) return <User className="w-5 h-5" />;
  if (lower.includes('shopping') || lower.includes('শপিং') || lower.includes('কেনাকাটা')) return <ShoppingCart className="w-5 h-5" />;
  if (lower.includes('food') || lower.includes('খাবার')) return <Utensils className="w-5 h-5" />;
  if (lower.includes('home') || lower.includes('বাসা') || lower.includes('house')) return <Home className="w-5 h-5" />;
  if (lower.includes('salary') || lower.includes('বেতন')) return <Wallet className="w-5 h-5" />;
  if (lower.includes('loan') || lower.includes('ধার')) return <Handshake className="w-5 h-5" />;

  // Emoji or fallback icon
  const emoji = getCategoryEmoji(category);
  if (emoji && emoji !== '🏷️') {
    return <span className="text-xl leading-none">{emoji}</span>;
  }

  return <Tag className="w-5 h-5" />;
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

  useEffect(() => {
    if (isCalculatorOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCalculatorOpen]);

  const currentCategories = entryType === 'Expense' ? expenseCategories : incomeCategories;

  // Handle Category Click -> Sets category & Opens Calculator
  const handleSelectCategory = (cat: string) => {
    setEntryCategory(cat);
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
    <div className="max-w-md mx-auto space-y-4 pb-12 select-none pt-1">
      {/* 1. Sleek Animated Type Selector Tabs: Expense | Income */}
      <div className="bg-[#0B3C39] border border-teal-800/80 p-1.5 rounded-2xl grid grid-cols-2 gap-1.5 shadow-sm relative overflow-hidden">
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
              className="absolute inset-0 bg-[#EF4444] rounded-xl shadow-md z-[-1]"
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
                entryType === 'Expense' ? 'bg-[#EF4444]' : 'bg-[#16A34A]'
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
                  entryType === 'Expense' ? 'text-rose-400' : 'text-emerald-400'
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

      {/* 3. Circular 4-Column Category Grid with Stagger & Spring Animations */}
      <motion.div
        key={entryType}
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-y-4 gap-x-2 pt-1"
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
                className={`w-13 h-13 sm:w-15 sm:h-15 rounded-full flex items-center justify-center transition-all shadow-md ${
                  isSelected
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-[#042F2E] scale-105'
                    : 'bg-[#0B3C39] border border-teal-700/70 text-teal-100 group-hover:border-emerald-400/80 group-hover:bg-teal-800/80'
                }`}
              >
                <CategoryIcon category={cat} />
              </div>

              {/* Category Name Underneath */}
              <span className="text-[10.5px] sm:text-[11px] font-bold text-[#F0FDFA] group-hover:text-teal-200 text-center leading-tight max-w-[78px] truncate mt-1.5">
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
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-teal-900/50 border-2 border-dashed border-teal-500/80 flex items-center justify-center text-teal-200 group-hover:text-white group-hover:border-teal-300 transition-all shadow-md">
            <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-[10.5px] sm:text-[11px] font-bold text-teal-200 group-hover:text-white text-center leading-tight mt-1.5">
            {t('Add Category', 'ক্যাটাগরি')}
          </span>
        </motion.button>
      </motion.div>

      {/* 4. Compact Calculator Bottom Sheet Modal with AnimatePresence */}
      <AnimatePresence>
        {isCalculatorOpen && (
          createPortal(
            <div
              className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
            >
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsCalculatorOpen(false)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />

              {/* Modal Container */}
              <motion.div
                initial={{ y: '100%', opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring' as const, stiffness: 380, damping: 32 }}
                className="relative bg-white text-[#0F172A] w-full max-w-md rounded-t-3xl sm:rounded-2xl p-4 border-t sm:border border-slate-200 shadow-2xl space-y-3 overflow-hidden z-10"
                onClick={e => e.stopPropagation()}
              >
                {/* Header: Category + Date + Close */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm ${
                      entryType === 'Expense' ? 'bg-[#EF4444]' : 'bg-[#16A34A]'
                    }`}>
                      <CategoryIcon category={entryCategory} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-extrabold text-[#0F172A] truncate block max-w-[140px]">
                        {cleanCategoryName(entryCategory, lang)}
                      </span>
                      <span className={`text-[9.5px] font-bold uppercase leading-none block ${
                        entryType === 'Expense' ? 'text-[#EF4444]' : 'text-[#16A34A]'
                      }`}>
                        {entryType === 'Expense' ? t('Expense', 'খরচ') : t('Income', 'আয়')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <input
                        type="date"
                        value={entryDate}
                        onChange={e => setEntryDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-[#0F172A] focus:outline-none cursor-pointer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCalculatorOpen(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-[#0F172A] transition-colors cursor-pointer"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-[#0F172A] font-semibold focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
                  />

                  <div className="bg-slate-50 rounded-2xl px-3.5 py-2 border border-slate-200 flex items-baseline justify-between shadow-inner">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t('Amount', 'পরিমাণ')}
                    </span>
                    <div className="flex items-baseline gap-2">
                      {/[+\-*/]/.test(calcDisplay) && (
                        <span className="text-xs font-bold text-slate-500">
                          = {formatNumberLocale(evaluateExpression(calcDisplay), lang)}
                        </span>
                      )}
                      <span className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                        entryType === 'Expense' ? 'text-[#EF4444]' : 'text-[#16A34A]'
                      }`}>
                        {calcDisplay}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4x4 Calculator Keypad with micro-interactions */}
                <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                  {['7', '8', '9', 'DEL', '4', '5', '6', '+', '1', '2', '3', '-', 'C', '0', '.', '✓'].map(key => {
                    const isSave = key === '✓';
                    const isAction = key === 'C' || key === 'DEL' || key === '+' || key === '-';

                    return (
                      <motion.button
                        key={key}
                        whileTap={{ scale: 0.92 }}
                        type="button"
                        onClick={() => handleKeyClick(key)}
                        disabled={isSave && isSubmitting}
                        className={`h-11 sm:h-12 rounded-xl text-base font-extrabold transition-colors flex items-center justify-center cursor-pointer select-none ${
                          isSave
                            ? entryType === 'Expense'
                              ? 'bg-[#EF4444] hover:bg-red-600 text-white shadow-md'
                              : 'bg-[#16A34A] hover:bg-green-700 text-white shadow-md'
                            : key === 'C'
                            ? 'bg-rose-50 text-[#EF4444] border border-rose-200 hover:bg-rose-100'
                            : key === 'DEL'
                            ? 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
                            : isAction
                            ? 'bg-slate-200 text-[#475569] hover:bg-slate-300 border border-slate-300'
                            : 'bg-white hover:bg-slate-100 text-[#0F172A] border border-slate-200 shadow-xs'
                        }`}
                      >
                        {key === 'DEL' ? (
                          <Delete className="w-4 h-4" />
                        ) : isSave ? (
                          <Check className="w-5 h-5 stroke-[3]" />
                        ) : (
                          key
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </div>,
            document.body
          )
        )}
      </AnimatePresence>
    </div>
  );
};

