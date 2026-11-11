import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calendar,
  Trash2,
  Edit3,
  UserPlus,
  User,
  Smartphone,
  Copy,
  CheckCheck,
  Tag,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  GripVertical,
  Download,
  DoorOpen,
  Calculator as CalculatorIcon,
  Delete,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Transaction, AppUser, TransactionType, AppTab, UserRole } from '../types';
import { formatNumberLocale, formatCleanDateTime, formatDateShortDemo, normalizeDate, formatDayHeader, getMonthKeyFromLabel } from '../utils/dateUtils';
import { cleanCategoryName, getCategoryEmoji, getCategoryColor } from '../utils/categoryUtils';
import { evaluateExpression } from '../utils/calcUtils';
import { GOOGLE_APPS_SCRIPT_CODE_V7 } from '../constants/appsScriptCode';
import { APP_VERSION } from '../utils/updateChecker';

// Global Portal Wrapper to guarantee modals render at viewport center with no parent scroll displacement
export const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(children, document.body);
};

// ========================================================
// 1. DAY DETAILS MODAL
// ========================================================
interface DayDetailsModalProps {
  dateStr: string | null;
  transactions: Transaction[];
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
  isReadOnly?: boolean;
}

export const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  dateStr,
  transactions,
  onClose,
  onEdit,
  onDelete,
  lang,
  t,
  isReadOnly
}) => {
  React.useEffect(() => {
    if (dateStr) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = 'unset'; };
    }
  }, [dateStr]);

  const formattedHeaderDate = useMemo(() => {
    if (!dateStr) return '';
    return formatDayHeader(dateStr, lang);
  }, [dateStr, lang]);

  if (!dateStr) return null;

  const dayTransactions = transactions.filter(tx => normalizeDate(tx.date) === normalizeDate(dateStr));

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[360px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring max-h-[85vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-teal-800/60 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[10px] sm:text-[11px] font-bold text-[#F0FDFA] truncate">
              {formattedHeaderDate} ({dayTransactions.length} {t('Records', 'টি রেকর্ড')})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/80 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {dayTransactions.length === 0 ? (
          <p className="text-[10px] text-teal-300/80 text-center py-4">
            {t('No records.', 'কোনো হিসাব নেই।')}
          </p>
        ) : (
          <div className="space-y-0.5 max-h-[50vh] overflow-y-auto pr-0.5">
            {dayTransactions.map((tx, idx) => {
              const isExpense = tx.type === 'Expense';
              const emoji = getCategoryEmoji(tx.category);
              const circleColor = getCategoryColor(tx.category);
              return (
                <div
                  key={tx.id ? `day_tx_${tx.id}_${idx}` : `day_tx_idx_${idx}`}
                  className="flex items-center justify-between py-2 px-1.5 hover:bg-[#062423] rounded-xl transition-all group border border-transparent hover:border-teal-700/60"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 shadow-sm ${circleColor} text-slate-900`}>
                      {emoji}
                    </div>
                    <span className="font-medium text-[#F0FDFA] text-[11px] truncate">
                      {cleanCategoryName(tx.category, lang)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-black text-[11px] tabular-nums ${isExpense ? 'text-[#FF7A59]' : 'text-emerald-400'}`}>
                      {isExpense ? '-' : ''}{formatNumberLocale(tx.value, lang)}
                    </span>
                    {!isReadOnly && (
                      <div className="flex items-center gap-1.5 ml-1">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEdit(tx);
                          }}
                          className="text-teal-300/70 hover:text-white cursor-pointer active:scale-90"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onDelete(tx);
                          }}
                          className="text-teal-300/70 hover:text-[#FF7A59] cursor-pointer active:scale-90"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 2. EDIT TRANSACTION MODAL
// ========================================================
interface EditTransactionModalProps {
  tx: Transaction | null;
  onClose: () => void;
  onSave: (updated: Transaction) => Promise<void>;
  expenseCategories: string[];
  incomeCategories: string[];
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  tx,
  onClose,
  onSave,
  expenseCategories,
  incomeCategories,
  lang,
  t
}) => {
  if (!tx) return null;

  const [type, setType] = useState<TransactionType>(tx.type);
  const [category, setCategory] = useState<string>(tx.category);
  const [date, setDate] = useState<string>(tx.date);
  const [amountInput, setAmountInput] = useState<string>(String(tx.value));
  const [note, setNote] = useState<string>(tx.note || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCalcOpen, setIsCalcOpen] = useState<boolean>(false);

  const categories = type === 'Expense' ? expenseCategories : incomeCategories;

  // Live expression calculation (e.g. 40+30 or +30 automatically calculates 70)
  const evaluatedAmount = useMemo(() => {
    if (!amountInput) return 0;
    const trimmed = amountInput.trim();
    let exprToEvaluate = trimmed;
    if (trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('/')) {
      exprToEvaluate = `${tx.value}${trimmed}`;
    }
    return evaluateExpression(exprToEvaluate);
  }, [amountInput, tx.value]);

  const hasMathExpression = useMemo(() => {
    return /[+\-*/]/.test(amountInput);
  }, [amountInput]);

  const handleQuickAdd = (addVal: number) => {
    setAmountInput(prev => {
      const trimmed = prev.trim();
      if (!trimmed || trimmed === '0') return String(addVal);
      return `${trimmed}+${addVal}`;
    });
  };

  const handleKeyClick = (key: string) => {
    if (key === 'C') {
      setAmountInput('0');
      return;
    }
    if (key === 'DEL') {
      if (amountInput.length <= 1) {
        setAmountInput('0');
      } else {
        setAmountInput(amountInput.slice(0, -1));
      }
      return;
    }
    if (key === '✓') {
      const evalVal = evaluateExpression(amountInput);
      if (evalVal > 0) {
        setAmountInput(String(evalVal));
      }
      setIsCalcOpen(false);
      return;
    }
    if (key === '+' || key === '-') {
      if (amountInput.endsWith('+') || amountInput.endsWith('-')) {
        setAmountInput(amountInput.slice(0, -1) + key);
        return;
      }
    }
    if (amountInput === '0' && key !== '.') {
      setAmountInput(key);
    } else {
      if (key === '.') {
        const parts = amountInput.split(/[+\-*/]/);
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) return;
      }
      if (amountInput.length < 15) {
        setAmountInput(amountInput + key);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalVal = evaluatedAmount > 0 ? evaluatedAmount : (parseFloat(amountInput) || tx.value);
    if (isNaN(finalVal) || finalVal <= 0) return;

    setIsSaving(true);
    await onSave({
      ...tx,
      type,
      category,
      date,
      value: finalVal,
      note
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[360px] rounded-2xl p-5 shadow-2xl relative border border-teal-800/90 animate-modalSpring max-h-[90vh] overflow-y-auto overscroll-contain my-auto space-y-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-teal-800/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#062423] text-teal-200 flex items-center justify-center border border-teal-700/70">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F0FDFA] leading-tight">
                  {t('Edit Transaction', 'লেনদেন এডিট')}
                </h3>
                <span className="text-[10px] text-teal-300/80 font-medium">
                  {t('Update amount or category', 'টাকা বা ক্যাটাগরি পরিবর্তন করুন')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/80 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Type Selector Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-[#062423] p-1 rounded-xl border border-teal-700/70">
              <button
                type="button"
                onClick={() => {
                  setType('Expense');
                  if (expenseCategories.length > 0 && !expenseCategories.includes(category)) {
                    setCategory(expenseCategories[0]);
                  }
                }}
                className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  type === 'Expense'
                    ? 'bg-[#FF7A59] text-white shadow-sm shadow-[#FF7A59]/40'
                    : 'text-teal-300/80 hover:text-white'
                }`}
              >
                {t('Expense', 'খরচ')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('Income');
                  if (incomeCategories.length > 0 && !incomeCategories.includes(category)) {
                    setCategory(incomeCategories[0]);
                  }
                }}
                className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  type === 'Income'
                    ? 'bg-[#16A34A] text-white shadow-sm'
                    : 'text-teal-300/80 hover:text-white'
                }`}
              >
                {t('Income', 'আয়')}
              </button>
            </div>

            {/* Smart Amount Field with Arithmetic & Calculator Modal Pop-up */}
            <div className="space-y-1.5 bg-[#062423] p-3 rounded-xl border border-teal-700/70">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider flex items-center gap-1">
                  <span>{t('Amount', 'টাকার পরিমাণ')}</span>
                  <span className="text-[9px] text-teal-400 font-normal">({t('Click to open calculator', 'ক্যালকুলেটর ওপেন করতে ট্যাপ করুন')})</span>
                </label>
                {hasMathExpression && evaluatedAmount > 0 && (
                  <span className="text-[11px] font-extrabold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800 animate-fadeIn">
                    = {formatNumberLocale(evaluatedAmount, lang)}
                  </span>
                )}
              </div>

              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  onClick={() => setIsCalcOpen(true)}
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#042F2E] border border-teal-700/70 hover:border-teal-400 focus:border-teal-400 rounded-xl px-3 py-2 text-lg font-black text-amber-300 tracking-tight focus:outline-none shadow-xs cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setIsCalcOpen(true)}
                  className="px-3 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 shadow-md cursor-pointer active:scale-95"
                  title={t('Open Calculator', 'ক্যালকুলেটর খুলুন')}
                >
                  <CalculatorIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Arithmetic Sum Helper Pills */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-0.5">
                <span className="text-[9px] font-bold text-teal-300/70 uppercase shrink-0">
                  {t('Add:', 'যোগ:')}
                </span>
                {[10, 20, 50, 100, 500].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAdd(val)}
                    className="px-2 py-0.5 rounded-md bg-[#042F2E] border border-teal-700/70 hover:border-teal-400 text-[10px] font-bold text-teal-100 active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            {/* Calculator Popup Overlay inside Edit Transaction */}
            {isCalcOpen && (
              <div className="fixed inset-0 z-[9999999] bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 animate-fadeIn">
                <div className="bg-[#0B3C39] border border-teal-600 rounded-2xl p-4 w-full max-w-xs shadow-2xl space-y-3 animate-modalSpring">
                  <div className="flex items-center justify-between pb-2 border-b border-teal-800">
                    <span className="text-xs font-bold text-teal-200 flex items-center gap-1">
                      <CalculatorIcon className="w-4 h-4 text-amber-400" />
                      {t('Calculator Keypad', 'ক্যালকুলেটর')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCalcOpen(false)}
                      className="p-1 text-teal-300 hover:text-white rounded-lg bg-teal-950"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Calculator Display */}
                  <div className="bg-[#042F2E] border border-teal-700/80 rounded-xl p-3 text-right">
                    <div className="text-[10px] text-teal-400 font-semibold">
                      {/[+\-*/]/.test(amountInput) ? `Value = ${evaluateExpression(amountInput)}` : 'Amount'}
                    </div>
                    <div className="text-2xl font-black text-amber-300 tabular-nums truncate">
                      {amountInput || '0'}
                    </div>
                  </div>

                  {/* Keypad Grid */}
                  <div className="grid grid-cols-4 gap-1.5 bg-[#062423] p-2 rounded-xl border border-teal-700/70">
                    {['7', '8', '9', 'DEL', '4', '5', '6', '+', '1', '2', '3', '-', 'C', '0', '.', '✓'].map(k => {
                      const isSave = k === '✓';
                      const isAction = k === 'C' || k === 'DEL' || k === '+' || k === '-';

                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleKeyClick(k)}
                          className={`h-11 rounded-xl text-sm font-extrabold transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none ${
                            isSave
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                              : k === 'C'
                              ? 'bg-[#FF7A59]/20 text-[#FF7A59] border border-[#FF7A59]/40'
                              : k === 'DEL'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : isAction
                              ? 'bg-teal-900 text-teal-200 border border-teal-700'
                              : 'bg-[#0B3C39] hover:bg-teal-800 text-[#F0FDFA] border border-teal-700/60'
                          }`}
                        >
                          {k === 'DEL' ? <Delete className="w-4 h-4" /> : isSave ? <Check className="w-5 h-5 stroke-[3]" /> : k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider ml-1">
                {t('Category', 'ক্যাটাগরি')}
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-[#062423] border border-teal-700/70 rounded-xl px-3 py-2 text-xs font-bold text-[#F0FDFA] focus:outline-none focus:border-teal-400 cursor-pointer shadow-xs"
              >
                {categories.map(c => (
                  <option key={c} value={c} className="bg-[#062423] text-[#F0FDFA]">
                    {cleanCategoryName(c, lang)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider ml-1">
                {t('Date', 'তারিখ')}
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-[#062423] border border-teal-700/70 rounded-xl px-3 py-2 text-xs font-semibold text-[#F0FDFA] focus:outline-none focus:border-teal-400 cursor-pointer shadow-xs"
                required
              />
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider ml-1">
                {t('Note (Optional)', 'বিবরণ (ঐচ্ছিক)')}
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t('Add description...', 'বিবরণ লিখুন...')}
                className="w-full bg-[#062423] border border-teal-700/70 rounded-xl px-3 py-2 text-xs text-[#F0FDFA] focus:outline-none focus:border-teal-400 placeholder:text-teal-500 shadow-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-[#062423] hover:bg-teal-900/80 text-teal-200 border border-teal-700/70 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                {t('Cancel', 'বাতিল')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-98 flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <span>{t('Saving...', 'সেভ হচ্ছে...')}</span>
                ) : (
                  <span>
                    {t('Save Changes', 'সেভ করুন')} {evaluatedAmount > 0 ? `(${formatNumberLocale(evaluatedAmount, lang)})` : ''}
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

// ========================================================
// 3. DELETE CONFIRMATION MODAL
// ========================================================
interface DeleteConfirmModalProps {
  tx: Transaction | null;
  onClose: () => void;
  onConfirm: (tx: Transaction) => Promise<void>;
  isDeleting: boolean;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  tx,
  onClose,
  onConfirm,
  isDeleting,
  lang,
  t
}) => {
  if (!tx) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[320px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring text-center space-y-3 my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="w-10 h-10 rounded-xl bg-rose-950/80 text-rose-300 border border-rose-800/80 flex items-center justify-center mx-auto">
          <Trash2 className="w-5 h-5" />
        </div>

        <div>
          <h3 className="text-xs font-bold text-[#F0FDFA]">
            {t('Delete Transaction?', 'লেনদেনটি মুছতে চান?')}
          </h3>
          <p className="text-[11px] text-teal-300/80 mt-0.5">
            {cleanCategoryName(tx.category, lang)} · {formatNumberLocale(tx.value, lang)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 bg-[#062423] hover:bg-teal-900/80 text-teal-200 border border-teal-700/70 rounded-lg text-xs font-semibold cursor-pointer active:scale-95"
          >
            {t('Cancel', 'বাতিল')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(tx)}
            disabled={isDeleting}
            className="py-1.5 bg-[#EF4444] hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer active:scale-95"
          >
            {isDeleting ? t('Deleting...', 'মুছছে...') : t('Yes, Delete', 'হ্যাঁ, মুছুন')}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 4. CREATE USER MODAL
// ========================================================
interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    username: string,
    pass: string,
    role: UserRole,
    allowedTabs: AppTab[],
    isReadOnly: boolean,
    viewTargetTab?: string
  ) => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  lang,
  t
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [allowedTabs, setAllowedTabs] = useState<AppTab[]>(['summary', 'entry', 'details', 'budget', 'upcoming_cost', 'settings']);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [viewTargetTab, setViewTargetTab] = useState<string>('abujar287');
  const [error, setError] = useState('');

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'super_admin' || newRole === 'admin') {
      setAllowedTabs(['summary', 'entry', 'details', 'budget', 'upcoming_cost', 'settings', 'users']);
      setIsReadOnly(false);
    } else if (newRole === 'super_admin_2') {
      setAllowedTabs(['summary', 'details']);
      setIsReadOnly(true);
      setViewTargetTab('abujar287');
    } else if (newRole === 'senior_member') {
      setAllowedTabs(['summary', 'entry', 'details', 'budget', 'upcoming_cost', 'settings']);
      setIsReadOnly(false);
    } else {
      setAllowedTabs(['summary', 'entry', 'details', 'budget', 'upcoming_cost', 'settings']);
      setIsReadOnly(false);
    }
  };

  const toggleTab = (tab: AppTab) => {
    if (allowedTabs.includes(tab)) {
      setAllowedTabs(allowedTabs.filter(t => t !== tab));
    } else {
      setAllowedTabs([...allowedTabs, tab]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) {
      setError(t('Please fill all fields', 'সবগুলো তথ্য পূরণ করুন'));
      return;
    }
    if (allowedTabs.length === 0) {
      setError(t('Select at least one allowed tab', 'কমপক্ষে একটি ট্যাব নির্বাচন করুন'));
      return;
    }
    onCreate(
      name.trim(),
      username.trim().toLowerCase(),
      password.trim(),
      role,
      allowedTabs,
      isReadOnly,
      role === 'super_admin_2' ? 'abujar287' : viewTargetTab
    );
    onClose();
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[350px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring max-h-[88vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-teal-800/60 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <h3 className="text-xs font-bold text-[#F0FDFA]">{t('Create New User', 'নতুন ব্যবহারকারী')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          {error && <div className="p-1.5 rounded-lg bg-rose-950/80 text-rose-300 text-[10px] border border-rose-800">{error}</div>}

          <div>
            <label className="text-[10px] font-semibold text-teal-300/80 block mb-0.5">{t('Full Name', 'নাম')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs text-[#F0FDFA] focus:outline-none focus:border-teal-400"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-teal-300/80 block mb-0.5">{t('Username', 'ইউজারনেম')}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs text-[#F0FDFA] focus:outline-none focus:border-teal-400"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-teal-300/80 block mb-0.5">{t('Password', 'পাসওয়ার্ড')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs text-[#F0FDFA] focus:outline-none focus:border-teal-400"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-teal-300/80 block mb-0.5">{t('Role', 'রোল')}</label>
            <select
              value={role}
              onChange={e => handleRoleChange(e.target.value as any)}
              className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs text-[#F0FDFA] focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              <option value="super_admin" className="bg-[#062423] text-[#F0FDFA]">{t('Super Admin', 'সুপার অ্যাডমিন')}</option>
              <option value="super_admin_2" className="bg-[#062423] text-[#F0FDFA]">{t('Super Admin 2 (Viewer @abujar287)', 'সুপার অ্যাডমিন ২ (আবুজারের হিসাব दर्शक)')}</option>
              <option value="admin" className="bg-[#062423] text-[#F0FDFA]">{t('Admin', 'অ্যাডমিন')}</option>
              <option value="senior_member" className="bg-[#062423] text-[#F0FDFA]">{t('Senior Member', 'সিনিয়র মেম্বার')}</option>
              <option value="member" className="bg-[#062423] text-[#F0FDFA]">{t('Member', 'মেম্বার')}</option>
            </select>
          </div>

          {/* Allowed Tabs Checkboxes */}
          <div>
            <label className="text-[10px] font-semibold text-teal-300/80 block mb-1">
              {t('Tab Access Permissions', 'ট্যাব এক্সেস')}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1.5 bg-[#062423] rounded-lg border border-teal-700/70">
              {[
                { id: 'summary' as AppTab, label: t('Summary', 'সারাংশ') },
                { id: 'details' as AppTab, label: t('Details', 'বিস্তারিত') },
                { id: 'entry' as AppTab, label: t('Add Entry', 'হিসাব যোগ') },
                { id: 'users' as AppTab, label: t('Users', 'ইউজার') },
                { id: 'settings' as AppTab, label: t('Settings', 'সেটিংস') }
              ].map(tabItem => {
                const checked = allowedTabs.includes(tabItem.id);
                return (
                  <label
                    key={tabItem.id}
                    className="flex items-center gap-1.5 p-1 rounded hover:bg-teal-900/40 cursor-pointer select-none text-[10px]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTab(tabItem.id)}
                      className="rounded border-teal-600 text-emerald-500 focus:ring-0 cursor-pointer w-3 h-3"
                    />
                    <span className="text-teal-100">{tabItem.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Read Only Toggle */}
          <div>
            <label className="flex items-center gap-2 p-1.5 rounded-lg bg-[#062423] border border-teal-700/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isReadOnly}
                onChange={e => setIsReadOnly(e.target.checked)}
                className="rounded border-teal-600 text-emerald-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
              />
              <span className="text-[10px] font-medium text-teal-100">
                {t('Read-Only Access', 'শুধুমাত্র পড়তে পারবে')}
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm cursor-pointer mt-2 active:scale-98 text-xs"
          >
            {t('Create User Account', 'অ্যাকাউন্ট তৈরি করুন')}
          </button>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 5. DELETE USER CONFIRMATION MODAL
// ========================================================
interface DeleteUserModalProps {
  user: AppUser | null;
  onClose: () => void;
  onConfirm: (user: AppUser) => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  user,
  onClose,
  onConfirm,
  lang,
  t
}) => {
  if (!user) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[320px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring text-center space-y-3 my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="w-10 h-10 rounded-xl bg-rose-950/80 text-rose-300 border border-rose-800/80 flex items-center justify-center mx-auto">
          <Trash2 className="w-5 h-5" />
        </div>

        <div>
          <h3 className="text-xs font-bold text-[#F0FDFA]">
            {t('Delete User Account?', 'ইউজার ডিলিট করতে চান?')}
          </h3>
          <p className="text-[11px] text-teal-300/80 mt-0.5">
            @{user.username} ({user.displayName})
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 bg-[#062423] hover:bg-teal-900/80 text-teal-200 border border-teal-700/70 rounded-lg text-xs font-semibold cursor-pointer active:scale-95"
          >
            {t('Cancel', 'বাতিল')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(user)}
            className="py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer active:scale-95"
          >
            {t('Yes, Delete', 'হ্যাঁ, মুছুন')}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 6. ADD CATEGORY MODAL
// ========================================================
interface AddCategoryModalProps {
  isOpen: boolean;
  type: TransactionType;
  onClose: () => void;
  onAdd: (catName: string, type: TransactionType) => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  type,
  onClose,
  onAdd,
  lang,
  t
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cleanName = cleanCategoryName(name.trim(), lang) || name.trim();
    onAdd(cleanName, type);
    onClose();
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-sm rounded-2xl p-4 sm:p-5 shadow-2xl relative border border-teal-800/90 animate-modalSpring max-h-[92vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-teal-800/60 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-[#F0FDFA]">
              {t('Add New Category', 'নতুন ক্যাটাগরি যোগ')} ({type === 'Expense' ? t('Expense', 'খরচ') : t('Income', 'আয়')})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-teal-300/80 block mb-1.5">
              {t('Category Name', 'ক্যাটাগরির নাম')}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('e.g., Gym, Bajar, Electricity', 'যেমন: বাজার, বিদ্যুৎ, যাতায়াত')}
              className="w-full bg-[#062423] border border-teal-700/70 rounded-xl px-3 py-2.5 text-xs text-[#F0FDFA] placeholder:text-teal-500 focus:outline-none focus:border-teal-400"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm cursor-pointer active:scale-98 text-xs transition-all"
          >
            {t('Add Category', 'ক্যাটাগরি যোগ করুন')}
          </button>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 7. MOBILE APP QR & INSTALL MODAL
// ========================================================
interface MobileInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  onInstall: () => Promise<boolean>;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const MobileInstallModal: React.FC<MobileInstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  onInstall,
  lang,
  t
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[340px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring text-xs space-y-3 max-h-[88vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-teal-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="HisabKitab Logo" className="w-6 h-6 rounded-lg object-cover shadow-sm border border-teal-700/60" />
            <div>
              <h3 className="text-xs font-bold text-[#F0FDFA]">হাত খরচ</h3>
              <p className="text-[9px] text-teal-300/80">{t('Install App', 'অ্যাপ ইনস্টল করুন')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* App Banner Card */}
        <div className="p-3 bg-[#062423] rounded-xl border border-teal-700/70 flex items-center gap-3">
          <div className="w-12 h-12 aspect-square rounded-full overflow-hidden shrink-0 shadow-sm border border-teal-500/60 bg-[#042F2E] flex items-center justify-center p-0.5">
            <img src="/logo.png" alt="হাত খরচ" className="w-full h-full object-contain aspect-square" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-[#F0FDFA] truncate">হাত খরচ</h4>
            <p className="text-[10px] text-teal-300/80 leading-tight mt-0.5">
              {t('Smart Expense & Task Reminder Tracker', 'স্মার্ট হাত খরচ, টাস্ক রিমাইন্ডার ও বাজেট ট্র্যাকার')}
            </p>
          </div>
        </div>

        {/* QR Code */}
        <div className="p-2.5 bg-[#062423] border border-teal-700/70 rounded-xl flex flex-col items-center justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(window.location.origin)}`}
            alt="হাত খরচ App QR Code"
            className="w-28 h-28 rounded-lg bg-white p-1"
          />
          <span className="text-[10px] font-bold text-teal-200 mt-1.5">
            {t('Scan with Camera', 'ক্যামেরা দিয়ে স্ক্যান করুন')}
          </span>
        </div>

        {/* Install Button (Always visible) */}
        <button
          type="button"
          onClick={async () => {
            if (isInstallable) {
              const success = await onInstall();
              if (success) {
                onClose();
                return;
              }
            }
            if (window.self !== window.top) {
              window.open(window.location.href, '_blank');
              return;
            }
            alert(
              lang === 'en'
                ? 'To install হাত খরচ:\n1. Open in Chrome or Safari\n2. Tap Browser Menu (⋮ or Share)\n3. Tap "Install App" or "Add to Home Screen"'
                : 'হাত খরচ ইনস্টল করতে:\n১. ক্রোম বা সাফারি ব্রাউজারে সাইটটি ওপেন করুন\n২. থ্রি-ডট (⋮) বা শেয়ার আইকন চাপুন\n৩. "Install App" বা "Add to Home Screen" অপশনে ট্যাপ করুন'
            );
          }}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 text-sm transition-all"
        >
          <Smartphone className="w-4 h-4" />
          <span>{t('Install হাত খরচ Now', 'হাত খরচ ইন্সটল করুন')}</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-2.5 bg-[#062423] hover:bg-teal-900/80 text-teal-100 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 text-xs transition-all border border-teal-700/70"
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-teal-300" />}
          <span>{copied ? t('Copied Link!', 'লিংক কপি হয়েছে!') : t('Copy হাত খরচ Link', ' হাত খরচ লিংক কপি করুন')}</span>
        </button>

        <div className="p-2 bg-[#062423] rounded-xl border border-teal-700/70 text-[10px] text-teal-300/80 space-y-0.5">
          <b className="text-[#F0FDFA] block">{t('Instructions:', 'ইন্সটল পদ্ধতি:')}</b>
          <p>
            {t(
              '1. Open link in Chrome.\n2. Tap menu (⋮) > "Install App" or "Add to Home screen".',
              '১. Chrome এ খুলুন।\n২. মেনু (⋮) > "Install App" বা "Add to Home screen" দিন।'
            )}
          </p>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 8. EDIT PROFILE MODAL
// ========================================================
interface EditProfileModalProps {
  user: AppUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    displayName: string,
    newPass?: string,
    role?: UserRole,
    allowedTabs?: AppTab[],
    isReadOnly?: boolean
  ) => void;
  isAdmin?: boolean;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
  isAdmin = false,
  lang,
  t
}) => {
  if (!isOpen || !user) return null;

  const [displayName, setDisplayName] = useState(user.displayName);
  const [password, setPassword] = useState(user.password);
  const [role, setRole] = useState<UserRole>(user.role || 'member');
  const [allowedTabs, setAllowedTabs] = useState<AppTab[]>(() => {
    if (user.allowedTabs && user.allowedTabs.length > 0) return user.allowedTabs;
    if (user.role === 'super_admin_2') return ['summary', 'details'];
    return ['summary', 'entry', 'details', 'users', 'settings'];
  });
  const [isReadOnly, setIsReadOnly] = useState<boolean>(() => {
    if (user.isReadOnly !== undefined) return user.isReadOnly;
    return user.role === 'super_admin_2';
  });

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'super_admin_2') {
      setAllowedTabs(['summary', 'details']);
      setIsReadOnly(true);
    } else if (newRole === 'super_admin' || newRole === 'admin') {
      setAllowedTabs(['summary', 'entry', 'details', 'users', 'settings']);
      setIsReadOnly(false);
    }
  };

  const toggleTab = (tab: AppTab) => {
    setAllowedTabs(prev => {
      if (prev.includes(tab)) {
        if (prev.length <= 1) return prev;
        return prev.filter(t => t !== tab);
      } else {
        return [...prev, tab];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    onSave(displayName.trim(), password.trim(), role, allowedTabs, isReadOnly);
    onClose();
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[340px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring max-h-[88vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-teal-800/60 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-300" />
            <h3 className="text-xs font-bold text-[#F0FDFA]">{t('Edit Profile', 'প্রোফাইল এডিট')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          <div>
            <label className="text-[10px] font-semibold text-teal-300/80 block mb-0.5">
              {t('Display Name', 'নাম')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs text-[#F0FDFA] focus:outline-none focus:border-teal-400"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-teal-300/80 block mb-0.5">
              {t('Username', 'ইউজারনেম')}
            </label>
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full bg-[#042F2E] border border-teal-800/60 rounded-lg px-2.5 py-1.5 text-xs text-teal-400/60 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-teal-300/80 block mb-0.5">
              {t('Password', 'পাসওয়ার্ড')}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs text-[#F0FDFA] focus:outline-none focus:border-teal-400"
              required
            />
          </div>

          {/* Role and Permissions for Admin */}
          {isAdmin && user.username !== 'abujar287' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-teal-300/80 block mb-0.5">
                  {t('Role', 'রোল')}
                </label>
                <select
                  value={role}
                  onChange={e => handleRoleChange(e.target.value as UserRole)}
                  className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs text-[#F0FDFA] focus:outline-none focus:border-teal-400 cursor-pointer"
                >
                  <option value="super_admin" className="bg-[#062423] text-[#F0FDFA]">{t('Super Admin', 'সুপার অ্যাডমিন')}</option>
                  <option value="super_admin_2" className="bg-[#062423] text-[#F0FDFA]">{t('Super Admin 2 (Viewer @abujar287)', 'সুপার অ্যাডমিন ২ (আবুজারের হিসাব दर्शक)')}</option>
                  <option value="admin" className="bg-[#062423] text-[#F0FDFA]">{t('Admin', 'অ্যাডমিন')}</option>
                  <option value="senior_member" className="bg-[#062423] text-[#F0FDFA]">{t('Senior Member', 'সিনিয়র মেম্বার')}</option>
                  <option value="member" className="bg-[#062423] text-[#F0FDFA]">{t('Member', 'মেম্বার')}</option>
                </select>
              </div>

              {/* Allowed Tabs */}
              <div>
                <label className="text-[10px] font-semibold text-teal-300/80 block mb-1">
                  {t('Tab Access Permissions', 'ট্যাব এক্সেস')}
                </label>
                <div className="grid grid-cols-2 gap-1 p-1.5 bg-[#062423] rounded-lg border border-teal-700/70">
                  {[
                    { id: 'summary' as AppTab, label: t('Summary', 'সারাংশ') },
                    { id: 'details' as AppTab, label: t('Details', 'বিস্তারিত') },
                    { id: 'entry' as AppTab, label: t('Add Entry', 'হিসাব যোগ') },
                    { id: 'users' as AppTab, label: t('Users', 'ইউজার') },
                    { id: 'settings' as AppTab, label: t('Settings', 'সেটিংস') }
                  ].map(tabItem => {
                    const checked = allowedTabs.includes(tabItem.id);
                    return (
                      <label
                        key={tabItem.id}
                        className="flex items-center gap-1.5 p-1 rounded hover:bg-teal-900/40 cursor-pointer select-none text-[10px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTab(tabItem.id)}
                          className="rounded border-teal-600 text-emerald-500 focus:ring-0 cursor-pointer w-3 h-3"
                        />
                        <span className="text-teal-100">{tabItem.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm cursor-pointer mt-2 active:scale-98 text-xs"
          >
            {t('Save Changes', 'সেভ করুন')}
          </button>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 9. CATEGORY DETAILS MODAL (POPUP WHEN TAPPING A CATEGORY)
// ========================================================
export interface CategoryDetailsModalProps {
  categoryName: string | null;
  transactions: Transaction[];
  onClose: () => void;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
  isReadOnly?: boolean;
}

export const CategoryDetailsModal: React.FC<CategoryDetailsModalProps> = ({
  categoryName,
  transactions,
  onClose,
  onEdit,
  onDelete,
  lang,
  t,
  isReadOnly
}) => {
  React.useEffect(() => {
    if (categoryName) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = 'unset'; };
    }
  }, [categoryName]);

  if (!categoryName) return null;

  const catTxs = transactions.filter(tx => {
    if (!categoryName) return false;
    const c1 = cleanCategoryName(tx.category, 'en').toLowerCase();
    const c2 = cleanCategoryName(categoryName, 'en').toLowerCase();
    if (c1 === c2) return true;
    const b1 = cleanCategoryName(tx.category, 'bn').toLowerCase();
    const b2 = cleanCategoryName(categoryName, 'bn').toLowerCase();
    if (b1 === b2) return true;
    return c1.includes(c2) || c2.includes(c1) || b1.includes(b2) || b2.includes(b1);
  });
  const totalVal = catTxs.reduce((sum, tx) => sum + Math.abs(evaluateExpression(tx.value)), 0);
  const isExpense = catTxs.length > 0 ? catTxs[0].type === 'Expense' : true;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[360px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring max-h-[85vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-teal-800/80 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Tag className="w-3.5 h-3.5 text-teal-300 shrink-0" />
            <h3 className="text-xs font-bold text-[#F0FDFA] truncate max-w-[220px]">
              {cleanCategoryName(categoryName, lang)} {t('Details', 'এর হিসাব')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/60 cursor-pointer shrink-0 border border-teal-800/80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category Total Header */}
        <div className="p-2.5 bg-[#062423] border border-teal-700/70 rounded-xl flex items-center justify-between mb-2.5">
          <div>
            <span className="text-[9.5px] text-teal-300/80 block font-semibold">
              {t('Total Records', 'মোট সংখ্যা')}
            </span>
            <span className="text-xs font-bold text-[#F0FDFA]">
              {catTxs.length} {t('items', 'টি')}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9.5px] text-teal-300/80 block font-semibold">
              {isExpense ? t('Total Spent', 'মোট খরচ') : t('Total Income', 'মোট আয়')}
            </span>
            <span
              className={`text-xs font-extrabold tabular-nums ${
                isExpense ? 'text-[#FF5252]' : 'text-[#34D399]'
              }`}
            >
              {isExpense ? '-' : '+'}
              {formatNumberLocale(totalVal, lang)}
            </span>
          </div>
        </div>

        {/* Transactions List */}
        {catTxs.length === 0 ? (
          <p className="text-[11px] text-teal-300/80 text-center py-6">
            {t('No transactions found in this category.', 'এই ক্যাটাগরিতে কোনো হিসাব নেই।')}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-0.5">
            {catTxs.map((tx, idx) => {
              const isExpense = tx.type === 'Expense';
              const emoji = getCategoryEmoji(tx.category);
              const circleColor = getCategoryColor(tx.category);
              return (
                <div
                  key={tx.id ? `cat_tx_${tx.id}_${idx}` : `cat_tx_idx_${idx}`}
                  className="flex items-center justify-between p-2 bg-[#062423] hover:bg-teal-900/60 border border-teal-700/70 rounded-xl transition-all group shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-2xs ${circleColor} text-slate-900 border border-teal-600/60`}>
                      {emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#F0FDFA] text-[11px] truncate">
                          {cleanCategoryName(tx.category, lang)}
                        </span>
                        <span className="text-[9.5px] text-teal-300/80 shrink-0 font-medium">
                          {formatDateShortDemo(tx.date, lang)}
                        </span>
                      </div>
                      {tx.note && (
                        <p className="text-[10px] text-teal-300/80 truncate mt-0.5">
                          {tx.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-extrabold text-[11px] tabular-nums ${
                        isExpense ? 'text-[#FF5252]' : 'text-[#34D399]'
                      }`}
                    >
                      {isExpense ? '-' : '+'}{formatNumberLocale(tx.value, lang)}
                    </span>

                    {!isReadOnly && onEdit && onDelete && (
                      <div className="flex items-center gap-1 ml-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEdit(tx);
                          }}
                          className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded hover:bg-[#042F2E] cursor-pointer transition-colors"
                          title={t('Edit', 'এডিট')}
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onDelete(tx);
                          }}
                          className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-[#FF5252] rounded hover:bg-[#042F2E] cursor-pointer transition-colors"
                          title={t('Delete', 'মুছুন')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 10. GOOGLE APPS SCRIPT CODE MODAL
// ========================================================
interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({
  isOpen,
  onClose,
  lang,
  t
}) => {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);

  const appsScriptCode = GOOGLE_APPS_SCRIPT_CODE_V7;

  const handleCopy = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[400px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring max-h-[88vh] overflow-y-auto overscroll-contain space-y-3 my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-teal-800/80 pb-2">
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-teal-300" />
            <h3 className="text-xs font-bold text-[#F0FDFA]">
              {t('Apps Script Backend Code', 'অ্যাপস স্ক্রিপ্ট কোড')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/60 cursor-pointer border border-teal-800/80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-2.5 bg-amber-950/80 rounded-xl border border-amber-800/80 text-[11px] text-amber-200 font-medium space-y-1">
          <p className="font-extrabold flex items-center gap-1 text-amber-300">
            <span>⚠️</span> {t('Apps Script v7.0 (Unified 1-Tab Multi-User):', 'অ্যাপস স্ক্রিপ্ট v৭.০ (ইউজার প্রতি সিঙ্গেল ট্যাব ও নিরাপদ ডিলিট):')}
          </p>
          <p className="text-[10px] leading-snug text-amber-200/90">
            {t(
              '1. Click Copy Code below. 2. In Google Sheet, go to Extensions > Apps Script and replace Code.gs. 3. Click Deploy > Manage Deployments > Edit (New version) > Deploy. Every user (e.g. abujar287, munni) gets their own tab with all 5 sections [Entry | Budget | Category | Month Mapping | Tasks] and non-destructive row deletes!',
              '১. নিচের কোডটি কপি করুন। ২. আপনার গুগল শিটের Extensions > Apps Script-এ গিয়ে Code.gs রিপ্লেস করুন। ৩. উপরে Deploy > New deployment চাপুন। প্রতিটি ইউজারের (যেমন abujar287, munni) সম্পূর্ণ ৫টি সেকশন [Entry | Budget | Category | Month Mapping | Tasks] একক ট্যাবে থাকবে এবং এন্ট্রি মুছলে ডানের অন্য সেকশনের তথ্য কখনোই নষ্ট হবে না!'
            )}
          </p>
        </div>

        <div className="relative">
          <pre className="p-2.5 rounded-xl bg-[#062423] border border-teal-700/70 text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-48 no-scrollbar">
            {appsScriptCode}
          </pre>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98 text-xs border border-teal-600/80"
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-[#34D399]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? t('Copied!', 'কপি হয়েছে!') : t('Copy Code', 'কোড কপি করুন')}</span>
        </button>
      </div>
    </div>
    </ModalPortal>
  );
};

// ========================================================
// 11. CATEGORY MANAGER MODAL (Move, Edit, Delete, Add)
// ========================================================
interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseCategories: string[];
  incomeCategories: string[];
  onUpdateCategories: (newCats: string[], type: TransactionType) => void;
  onOpenAddModal: (type: TransactionType) => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  expenseCategories,
  incomeCategories,
  onUpdateCategories,
  onOpenAddModal,
  lang,
  t
}) => {
  if (!isOpen) return null;

  const [activeType, setActiveType] = useState<TransactionType>('Expense');
  const categories = activeType === 'Expense' ? expenseCategories : incomeCategories;

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const cats = [...categories];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= cats.length) return;
    const temp = cats[index];
    cats[index] = cats[target];
    cats[target] = temp;
    onUpdateCategories(cats, activeType);
  };

  const handleEdit = (cat: string, index: number) => {
    const newName = prompt(t('Edit category name:', 'নতুন ক্যাটাগরির নাম দিন:'), cat);
    if (!newName || !newName.trim()) return;
    const cats = [...categories];
    cats[index] = newName.trim();
    onUpdateCategories(cats, activeType);
  };

  const handleDelete = (cat: string) => {
    if (categories.length <= 1) {
      alert(t('At least one category is required.', 'কমপক্ষে একটি ক্যাটাগরি থাকা আবশ্যক।'));
      return;
    }
    const cats = categories.filter(c => c !== cat);
    onUpdateCategories(cats, activeType);
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-md rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring max-h-[85vh] flex flex-col my-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-teal-800/80 pb-2 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-teal-300" />
              <h3 className="text-xs font-bold text-[#F0FDFA] uppercase">
                {t('Manage Categories', 'ক্যাটাগরি ম্যানেজমেন্ট')}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/60 cursor-pointer border border-teal-800/80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Type Tab Selector */}
          <div className="flex items-center bg-[#062423] p-1 rounded-xl mb-3 shrink-0 border border-teal-800/80">
            <button
              type="button"
              onClick={() => setActiveType('Expense')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeType === 'Expense' ? 'bg-[#FF5252] text-white shadow-sm' : 'text-teal-300 hover:text-white'
              }`}
            >
              {t('Expense Categories', 'খরচের ক্যাটাগরি')} ({expenseCategories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveType('Income')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeType === 'Income' ? 'bg-emerald-600 text-white shadow-sm' : 'text-teal-300 hover:text-white'
              }`}
            >
              {t('Income Categories', 'আয়ের ক্যাটাগরি')} ({incomeCategories.length})
            </button>
          </div>

          {/* List of Categories with Move Up, Move Down, Edit, Delete */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mb-3">
            {categories.map((cat, idx) => (
              <div
                key={cat}
                className="flex items-center justify-between p-2 rounded-xl bg-[#062423] border border-teal-700/70 text-xs shadow-sm"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div className="text-teal-300 hover:text-white cursor-grab active:cursor-grabbing p-0.5 rounded border border-teal-800/80 bg-[#042F2E]" title="Move / Drag">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-[#F0FDFA] truncate">
                    {cleanCategoryName(cat, lang)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 'up')}
                    disabled={idx === 0}
                    className="px-1.5 py-0.5 rounded border border-teal-800/80 bg-[#042F2E] text-teal-200 hover:text-white disabled:opacity-30 cursor-pointer text-[10px] font-bold shadow-sm"
                    title="Move Up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 'down')}
                    disabled={idx === categories.length - 1}
                    className="px-1.5 py-0.5 rounded border border-teal-800/80 bg-[#042F2E] text-teal-200 hover:text-white disabled:opacity-30 cursor-pointer text-[10px] font-bold shadow-sm"
                    title="Move Down"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(cat, idx)}
                    className="p-1 rounded border border-teal-800/80 bg-[#042F2E] text-teal-200 hover:text-white hover:bg-teal-900/60 cursor-pointer shadow-sm"
                    title="Edit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat)}
                    className="p-1 rounded border border-rose-800/80 bg-rose-950/60 text-[#FF5252] hover:bg-rose-900/80 cursor-pointer shadow-sm"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Category Button at Bottom */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddModal(activeType);
            }}
            className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-98 shrink-0 text-xs border border-teal-600/80"
          >
            <Plus className="w-4 h-4" />
            <span>{t('+ Add New Category', '+ নতুন ক্যাটাগরি যোগ করুন')}</span>
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};


// ========================================================
// 10. EXPORT MONTH SELECTION MODAL
// ========================================================
interface ExportMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (params: { month: string; startDate?: string; endDate?: string }) => void;
  currentMonth: string;
  monthMappings?: import('../types').MonthMapping[];
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const ExportMonthModal: React.FC<ExportMonthModalProps> = ({
  isOpen,
  onClose,
  onExport,
  currentMonth,
  monthMappings = [],
  lang,
  t
}) => {
  if (!isOpen) return null;

  // 'month' | 'custom' | 'all'
  const [exportScope, setExportScope] = useState<'month' | 'custom' | 'all'>(() => {
    if (currentMonth === 'all') return 'all';
    return 'month';
  });

  const [selectedMonth, setSelectedMonth] = useState(currentMonth === 'all' ? '' : currentMonth);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

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

  // Set initial month if empty
  useEffect(() => {
    if (exportScope === 'month' && !selectedMonth && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0].val);
    }
  }, [exportScope, selectedMonth, monthOptions]);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[340px] rounded-2xl p-5 shadow-2xl relative border border-teal-800/90 animate-modalSpring my-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-teal-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-[#F0FDFA]">{t('Export Report', 'রিপোর্ট এক্সপোর্ট')}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/60 cursor-pointer border border-teal-800/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Step 1: Select Scope */}
            <div>
              <label className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider block mb-1.5">
                {t('1. Select Export Type', '১. এক্সপোর্টের ধরন নির্বাচন করুন')}
              </label>
              <select
                value={exportScope}
                onChange={e => setExportScope(e.target.value as any)}
                className="w-full bg-[#062423] border border-teal-700/70 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[#F0FDFA] focus:outline-none focus:border-teal-400 cursor-pointer shadow-sm"
              >
                <option value="month" className="bg-[#0B3C39] text-[#F0FDFA]">{t('Specific Month', 'নির্দিষ্ট মাস অনুযায়ী')}</option>
                <option value="custom" className="bg-[#0B3C39] text-[#F0FDFA]">{t('Custom Date Range', 'কাস্টম তারিখ অনুযায়ী')}</option>
                <option value="all" className="bg-[#0B3C39] text-[#F0FDFA]">{t('Full History (All-Time)', 'শুরু থেকে আজ পর্যন্ত')}</option>
              </select>
            </div>

            {/* Step 2: Select Details based on Scope */}
            <div className="animate-fadeIn">
              {exportScope === 'month' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider block">
                    {t('2. Select Month', '২. মাস নির্বাচন করুন')}
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="w-full bg-[#062423] border border-teal-700/70 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[#F0FDFA] focus:outline-none focus:border-teal-400 cursor-pointer shadow-sm"
                  >
                    {monthOptions.map(m => (
                      <option key={m.val} value={m.val} className="bg-[#0B3C39] text-[#F0FDFA]">{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {exportScope === 'custom' && (
                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold text-teal-300/80 uppercase tracking-wider block">
                    {t('2. Select Date Range', '২. তারিখ নির্বাচন করুন')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-teal-300/80 uppercase ml-1">{t('Start', 'শুরু')}</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#F0FDFA] focus:outline-none focus:border-teal-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-teal-300/80 uppercase ml-1">{t('End', 'শেষ')}</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full bg-[#062423] border border-teal-700/70 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#F0FDFA] focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {exportScope === 'all' && (
                <div className="p-3 bg-indigo-950/80 border border-indigo-800/80 rounded-xl">
                  <p className="text-[10px] font-medium text-indigo-200 text-center">
                    {t('This will export all records since the beginning of time.', 'এটি শুরু থেকে আজ পর্যন্ত সমস্ত রেকর্ড এক্সপোর্ট করবে।')}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onExport({ 
                    month: exportScope === 'all' ? 'all' : (exportScope === 'custom' ? 'custom' : selectedMonth),
                    startDate: exportScope === 'custom' ? startDate : undefined, 
                    endDate: exportScope === 'custom' ? endDate : undefined 
                  });
                  onClose();
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 active:scale-98 transition-all text-sm border border-emerald-500/80"
              >
                <Download className="w-5 h-5" />
                <span>{t('Download ZIP Report', 'ZIP রিপোর্ট ডাউনলোড করুন')}</span>
              </button>
            </div>
            
            <p className="text-[10px] text-teal-300/70 text-center leading-relaxed">
              {t('Report is generated based on the "Date" column (Column E) of your Google Sheet.', 'রিপোর্টটি আপনার গুগল শিটের "Date" কলাম (Column E) অনুযায়ী ফিল্টার করে তৈরি করা হয়।')}
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// ========================================================
// 9. EXIT CONFIRMATION MODAL
// ========================================================
interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  lang,
  t
}) => {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[320px] rounded-2xl p-4 shadow-2xl relative border border-teal-800/90 animate-modalSpring text-center space-y-3 my-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-10 h-10 rounded-xl bg-[#062423] text-teal-300 flex items-center justify-center mx-auto border border-teal-800/80">
            <DoorOpen className="w-5 h-5" />
          </div>

          <div>
            <h3 className="text-xs font-bold text-[#F0FDFA]">
              {t('Exit Application?', 'অ্যাপ থেকে বের হতে চান?')}
            </h3>
            <p className="text-[11px] text-teal-300/80 mt-0.5">
              {t('Are you sure you want to close হাত খরচ?', 'আপনি কি নিশ্চিত যে আপনি হাত খরচ বন্ধ করতে চান?')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 bg-[#062423] hover:bg-teal-900/60 text-teal-200 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 border border-teal-800/80"
            >
              {t('Cancelled', 'বাতিল')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer active:scale-95"
            >
              {t('Exit', 'বের হন')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

// ========================================================
// 12. SELF SIGNUP MODAL (LOGIN PAGE ACCOUNT CREATION)
// ========================================================
interface SelfSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignup: (name: string, username: string, pass: string) => boolean | void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
}

export const SelfSignupModal: React.FC<SelfSignupModalProps> = ({
  isOpen,
  onClose,
  onSignup,
  lang,
  t
}) => {
  if (!isOpen) return null;

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      setError(t('Please fill out all 3 fields', 'সবকটি তথ্য (Full Name, Username, Password) সঠিকভাবে দিন'));
      return;
    }
    const result = onSignup(fullName.trim(), username.trim(), password.trim());
    if (result !== false) {
      onClose();
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[360px] rounded-2xl p-5 shadow-2xl relative border border-teal-700/80 animate-modalSpring space-y-4 my-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-teal-800/60 pb-2.5">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-teal-400" />
              <h3 className="text-sm font-bold text-[#F0FDFA]">
                {t('Create Account', 'নতুন একাউন্ট তৈরি করুন')}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/80 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block mb-1">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Enter Your Full Name"
                className="w-full p-2.5 bg-[#062423] border border-teal-700/70 text-[#F0FDFA] rounded-xl focus:outline-none focus:border-teal-400 text-xs font-medium placeholder:text-teal-600"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block mb-1">
                username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="Enter Your Username"
                className="w-full p-2.5 bg-[#062423] border border-teal-700/70 text-[#F0FDFA] rounded-xl focus:outline-none focus:border-teal-400 text-xs font-medium placeholder:text-teal-600"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block mb-1">
                password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your Password"
                  className="w-full p-2.5 bg-[#062423] border border-teal-700/70 text-[#F0FDFA] rounded-xl focus:outline-none focus:border-teal-400 text-xs font-medium placeholder:text-teal-600 pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-teal-400 hover:text-white"
                >
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-rose-400 text-xs font-semibold">{error}</p>}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 bg-[#062423] hover:bg-teal-900/80 text-teal-200 border border-teal-700/70 rounded-xl font-bold text-xs cursor-pointer"
              >
                {t('Cancel', 'বাতিল')}
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-xl font-bold text-xs cursor-pointer shadow-md"
              >
                {t('Create Account', 'একাউন্ট তৈরি করুন')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};


// ========================================================
// 12. USER PROFILE MODAL (FOR HEADER)
// ========================================================
interface UserProfileModalProps {
  user: AppUser | null;
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'bn';
  t: (en: string, bn: string) => string;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  lang,
  t,
  onLogout
}) => {
  if (!isOpen || !user) return null;

  const isSuperAdmin = user.role === 'super_admin';

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-[320px] rounded-2xl p-5 shadow-2xl relative border border-teal-800/90 animate-modalSpring space-y-4 my-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-teal-800/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-900/60 text-emerald-400 flex items-center justify-center border border-teal-700/70 shadow-sm">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F0FDFA]">{user.displayName}</h3>
                <span className="text-[10px] text-teal-300/80 font-bold uppercase tracking-wider">
                  {user.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-teal-300 hover:text-white rounded-full bg-[#062423] hover:bg-teal-900/80 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Stats/Info */}
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#062423] border border-teal-700/60">
              <span className="text-[11px] font-medium text-teal-300">{t('Username', 'ইউজারনেম')}</span>
              <span className="text-[11px] font-bold text-white">@{user.username}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#062423] border border-teal-700/60">
              <span className="text-[11px] font-medium text-teal-300">{t('Sheet Tab', 'শিট ট্যাব')}</span>
              <span className="text-[11px] font-bold text-emerald-400">{user.sheetTab}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#062423] border border-teal-700/60">
              <span className="text-[11px] font-medium text-teal-300">{t('Member Since', 'অ্যাকাউন্ট তৈরি')}</span>
              <span className="text-[11px] font-bold text-teal-100">{user.createdAt}</span>
            </div>

            {/* Direct Link to Users Tab for Admins */}
            {(user.role === 'super_admin' || user.username === 'abujar287') && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  // We need to trigger setActiveTab('users') in App.tsx
                  window.dispatchEvent(new CustomEvent('app-set-tab', { detail: 'users' }));
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-teal-900/40 border border-teal-600/50 hover:bg-teal-800/60 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-bold text-emerald-200">{t('Manage Team', 'টিম ম্যানেজমেন্ট')}</span>
                </div>
                <ArrowUpRight className="w-3 h-3 text-teal-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <DoorOpen className="w-4 h-4" />
              {t('Logout from App', 'লগআউট করুন')}
            </button>
            <p className="text-[10px] text-center text-teal-400/60 italic font-medium pt-1">
              হাত খরচ - {APP_VERSION}
            </p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo?: import('../utils/updateChecker').UpdateInfo | null;
  t: (en: string, bn: string) => string;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  isOpen,
  onClose,
  t
}) => {
  if (!isOpen) return null;

  const [isDownloading, setIsDownloading] = useState(false);

  const handleUpdateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDownloading) return;
    setIsDownloading(true);

    const downloadApkUrl = 'https://github.com/Abujar287/hatkhoroc/releases/download/latest/hatkhoroc.apk';

    try {
      window.location.href = downloadApkUrl;
    } catch {
      window.open(downloadApkUrl, '_blank');
    }

    setTimeout(() => {
      setIsDownloading(false);
      onClose();
    }, 2500);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-fadeIn">
        <div className="bg-[#0B3C39] text-[#F0FDFA] w-full max-w-xs rounded-3xl p-5 shadow-2xl relative border border-emerald-500/50 space-y-4 animate-modalSpring text-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-teal-400 hover:text-white p-1 rounded-full bg-[#062423] border border-teal-700/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="space-y-2 pt-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/60 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/60">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-black text-white tracking-tight">
              {t('New Update Available', 'নতুন আপডেট পাওয়া গেছে')}
            </h3>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleUpdateClick}
              disabled={isDownloading}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-black shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center disabled:opacity-80"
            >
              {isDownloading ? (
                <>
                  <Download className="w-4 h-4 text-emerald-200 animate-bounce shrink-0" />
                  <span>{t('Downloading...', 'ডাউনলোড হচ্ছে...')}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span>{t('Update Now', 'এখনই আপডেট করুন')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
