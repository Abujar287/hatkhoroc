import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  FileText,
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
  MoreHorizontal,
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

  return (
    <div className="max-w-md mx-auto space-y-3.5 animate-fadeIn pb-12 select-none">
      {/* 1. Header Bar: Clear | Add | Settings */}
      <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
        <button
          type="button"
          onClick={() => {
            setCalcDisplay('0');
            setEntryNote('');
          }}
          className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          {t('Clear', 'ক্লিয়ার')}
        </button>

        <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] tracking-wide">
          {t('Add', 'যোগ করুন')}
        </h2>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenCategoryManager}
            className="text-[11px] font-bold text-[#475569] hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 active:scale-95"
            title={t('Add Category', 'নতুন ক্যাটাগরি')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Add Category', 'ক্যাটাগরি')}</span>
          </button>
        </div>
      </div>

      {/* 2. Type Selector Tabs: Expense | Income */}
      <div className="bg-white border border-slate-200 p-1 rounded-xl grid grid-cols-2 gap-1 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setEntryType('Expense');
            if (expenseCategories.length > 0) setEntryCategory(expenseCategories[0]);
          }}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
            entryType === 'Expense'
              ? 'bg-[#EF4444] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('Expense', 'খরচ')}
        </button>

        <button
          type="button"
          onClick={() => {
            setEntryType('Income');
            if (incomeCategories.length > 0) setEntryCategory(incomeCategories[0]);
          }}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
            entryType === 'Income'
              ? 'bg-[#16A34A] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('Income', 'আয়')}
        </button>
      </div>

      {/* 3. Amount Display Area (Click to open calculator) */}
      <div 
        onClick={() => setIsCalculatorOpen(true)}
        className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {t('Amount', 'টাকার পরিমাণ')}
          </span>
          <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${
            entryType === 'Expense' ? 'text-[#EF4444]' : 'text-[#16A34A]'
          }`}>
            {calcDisplay}
          </span>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
          <Plus className="w-5 h-5" />
        </div>
      </div>

      {/* 4. Circular 4-Column Category Grid */}
      <div className="grid grid-cols-4 gap-y-4 gap-x-2 pt-1">
        {currentCategories.map(cat => {
          const isSelected = entryCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleSelectCategory(cat)}
              className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
            >
              {/* Circular Icon Container */}
              <div
                className={`w-13 h-13 sm:w-15 sm:h-15 rounded-full flex items-center justify-center transition-all shadow-sm ${
                  isSelected
                    ? 'bg-[#475569] text-white ring-2 ring-slate-400 ring-offset-2 ring-offset-[#FAF9F6] scale-105'
                    : 'bg-white border border-slate-200 text-[#475569] group-hover:border-slate-400 group-hover:bg-slate-50'
                }`}
              >
                <CategoryIcon category={cat} />
              </div>

              {/* Category Name Underneath */}
              <span className="text-[10px] sm:text-[10.5px] font-semibold text-[#0F172A] group-hover:text-slate-600 text-center leading-tight max-w-[76px] truncate mt-1.5">
                {cleanCategoryName(cat, lang)}
              </span>
            </button>
          );
        })}

        {/* Plus / Settings Button at the end of grid */}
        <button
          type="button"
          onClick={onOpenCategoryManager}
          className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
        >
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-white border border-dashed border-slate-300 flex items-center justify-center text-slate-400 group-hover:text-[#475569] group-hover:border-slate-500 transition-all shadow-sm">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-[10px] sm:text-[10.5px] font-medium text-slate-500 group-hover:text-[#0F172A] text-center leading-tight mt-1.5">
            {t('Category', 'ক্যাটাগরি')}
          </span>
        </button>
      </div>

      {/* 4. Compact Calculator Bottom Sheet */}
      {isCalculatorOpen &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={() => setIsCalculatorOpen(false)}
          >
            <div
              className="bg-white text-[#0F172A] w-full max-w-md rounded-t-3xl sm:rounded-2xl p-3.5 sm:p-4 border-t sm:border border-slate-200 shadow-2xl space-y-2.5 animate-slideUp overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header: Category + Date + Close */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm ${
                    entryType === 'Expense' ? 'bg-[#EF4444]' : 'bg-[#16A34A]'
                  }`}>
                    <CategoryIcon category={entryCategory} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#0F172A] truncate block max-w-[120px]">
                      {cleanCategoryName(entryCategory, lang)}
                    </span>
                    <span className={`text-[9px] font-bold uppercase leading-none block ${
                      entryType === 'Expense' ? 'text-[#EF4444]' : 'text-[#16A34A]'
                    }`}>
                      {entryType === 'Expense' ? t('Expense', 'খরচ') : t('Income', 'আয়')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    <Calendar className="w-3 h-3 text-[#475569] shrink-0" />
                    <input
                      type="date"
                      value={entryDate}
                      onChange={e => setEntryDate(e.target.value)}
                      className="bg-transparent text-[10.5px] font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCalculatorOpen(false)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-[#0F172A] transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Note input & Amount Display */}
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={entryNote}
                  onChange={e => setEntryNote(e.target.value)}
                  placeholder={t('Add note (optional)...', 'নোট লিখুন (ঐচ্ছিক)...')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-[#0F172A] focus:outline-none placeholder:text-slate-400"
                />

                <div className="bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-200 flex items-baseline justify-between shadow-inner">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {t('Amount', 'পরিমাণ')}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    {/[+\-*/]/.test(calcDisplay) && (
                      <span className="text-[10px] font-semibold text-slate-500">
                        = {formatNumberLocale(evaluateExpression(calcDisplay), lang)}
                      </span>
                    )}
                    <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                      entryType === 'Expense' ? 'text-[#EF4444]' : 'text-[#16A34A]'
                    }`}>
                      {calcDisplay}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4x4 Calculator Keypad */}
              <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                {['7', '8', '9', 'DEL', '4', '5', '6', '+', '1', '2', '3', '-', 'C', '0', '.', '✓'].map(key => {
                  const isSave = key === '✓';
                  const isAction = key === 'C' || key === 'DEL' || key === '+' || key === '-';

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeyClick(key)}
                      disabled={isSave && isSubmitting}
                      className={`h-11 sm:h-12 rounded-xl text-base font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 select-none ${
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
                          : 'bg-white hover:bg-slate-100 text-[#0F172A] border border-slate-200 shadow-sm'
                      }`}
                    >
                      {key === 'DEL' ? (
                        <Delete className="w-4 h-4" />
                      ) : isSave ? (
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      ) : (
                        key
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
