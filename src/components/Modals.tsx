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
  DoorOpen
} from 'lucide-react';
import { Transaction, AppUser, TransactionType, AppTab, UserRole } from '../types';
import { formatNumberLocale, formatCleanDateTime, formatDateShortDemo, normalizeDate, formatDayHeader, getMonthKeyFromLabel } from '../utils/dateUtils';
import { cleanCategoryName, getCategoryEmoji, getCategoryColor } from '../utils/categoryUtils';
import { evaluateExpression } from '../utils/calcUtils';

// Global Portal Wrapper to guarantee modals render at viewport center with no parent scroll displacement
const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  const totalInc = dayTransactions.reduce((acc, t) => t.type === 'Income' ? acc + (Number(t.value) || 0) : acc, 0);
  const totalExp = dayTransactions.reduce((acc, t) => t.type === 'Expense' ? acc + (Number(t.value) || 0) : acc, 0);
  const net = totalInc - totalExp;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-white text-[#0F172A] w-full max-w-[360px] rounded-2xl p-4 shadow-xl relative border border-slate-200 animate-modalSpring max-h-[85vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[10px] sm:text-[11px] font-bold text-[#0F172A] truncate">
              {formattedHeaderDate} ({dayTransactions.length} {t('Records', 'টি রেকর্ড')})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#0F172A] rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {dayTransactions.length === 0 ? (
          <p className="text-[10px] text-slate-500 text-center py-4">
            {t('No records.', 'কোনো হিসাব নেই।')}
          </p>
        ) : (
          <div className="space-y-0.5 max-h-[50vh] overflow-y-auto pr-0.5">
            {dayTransactions.map(tx => {
              const isExpense = tx.type === 'Expense';
              const emoji = getCategoryEmoji(tx.category);
              const circleColor = getCategoryColor(tx.category);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 shadow-sm ${circleColor} text-slate-900`}>
                      {emoji}
                    </div>
                    <span className="font-medium text-[#0F172A] text-[11px] truncate">
                      {cleanCategoryName(tx.category, lang)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-bold text-[11px] tabular-nums ${isExpense ? 'text-[#EF4444]' : 'text-[#16A34A]'}`}>
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
                          className="text-slate-400 hover:text-[#475569] cursor-pointer active:scale-90"
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
                          className="text-slate-400 hover:text-rose-600 cursor-pointer active:scale-90"
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

  const categories = type === 'Expense' ? expenseCategories : incomeCategories;

  // Live expression calculation (e.g. 40+30 or +30 automatically calculates 70)
  const evaluatedAmount = useMemo(() => {
    if (!amountInput) return 0;
    const trimmed = amountInput.trim();
    // If user starts with an operator like +30 or -10, prepend original value
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
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-white text-[#0F172A] w-full max-w-[360px] rounded-2xl p-5 shadow-2xl relative border border-slate-200 animate-modalSpring max-h-[90vh] overflow-y-auto overscroll-contain my-auto space-y-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#475569] flex items-center justify-center border border-slate-200">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] leading-tight">
                  {t('Edit Transaction', 'লেনদেন এডিট')}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  {t('Update amount or category', 'টাকা বা ক্যাটাগরি পরিবর্তন করুন')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Type Selector Tabs */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
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
                    ? 'bg-[#EF4444] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
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
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('Income', 'আয়')}
              </button>
            </div>

            {/* Smart Amount Field with Arithmetic Support */}
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('Amount', 'টাকার পরিমাণ')}
                </label>
                {hasMathExpression && evaluatedAmount > 0 && (
                  <span className="text-[11px] font-extrabold text-[#16A34A] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-fadeIn">
                    = {formatNumberLocale(evaluatedAmount, lang)}
                  </span>
                )}
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  placeholder="e.g. 40+30"
                  className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded-xl px-3 py-2 text-base font-black text-[#0F172A] tracking-tight focus:outline-none shadow-xs"
                />
              </div>

              {/* Quick Arithmetic Sum Helper Pills */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-0.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">
                  {t('Add:', 'যোগ:')}
                </span>
                {[10, 20, 50, 100, 500].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAdd(val)}
                    className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-slate-400 text-[10px] font-bold text-[#475569] active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer"
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                {t('Category', 'ক্যাটাগরি')}
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-slate-400 cursor-pointer shadow-xs"
              >
                {categories.map(c => (
                  <option key={c} value={c} className="bg-white text-[#0F172A]">
                    {cleanCategoryName(c, lang)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                {t('Date', 'তারিখ')}
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-slate-400 cursor-pointer shadow-xs"
                required
              />
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                {t('Note (Optional)', 'বিবরণ (ঐচ্ছিক)')}
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t('Add description...', 'বিবরণ লিখুন...')}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-slate-400 placeholder:text-slate-400 shadow-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                {t('Cancel', 'বাতিল')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-2 py-2.5 bg-[#475569] hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer active:scale-98 flex items-center justify-center gap-1.5"
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
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-white text-[#0F172A] w-full max-w-[320px] rounded-2xl p-4 shadow-xl relative border border-slate-200 animate-modalSpring text-center space-y-3 my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <Trash2 className="w-5 h-5" />
        </div>

        <div>
          <h3 className="text-xs font-bold text-[#0F172A]">
            {t('Delete Transaction?', 'লেনদেনটি মুছতে চান?')}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {cleanCategoryName(tx.category, lang)} · {formatNumberLocale(tx.value, lang)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer active:scale-95"
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
  const [allowedTabs, setAllowedTabs] = useState<AppTab[]>(['summary', 'entry', 'details']);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [viewTargetTab, setViewTargetTab] = useState<string>('abujar287');
  const [error, setError] = useState('');

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'super_admin' || newRole === 'admin') {
      setAllowedTabs(['summary', 'entry', 'details', 'users', 'settings']);
      setIsReadOnly(false);
    } else if (newRole === 'super_admin_2') {
      setAllowedTabs(['summary', 'details']);
      setIsReadOnly(true);
      setViewTargetTab('abujar287');
    } else if (newRole === 'senior_member') {
      setAllowedTabs(['summary', 'entry', 'details']);
      setIsReadOnly(false);
    } else {
      setAllowedTabs(['summary', 'entry', 'details']);
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
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-slate-800 text-slate-100 w-full max-w-[350px] rounded-2xl p-4 shadow-2xl relative border border-slate-700/50 animate-modalSpring max-h-[88vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-100">{t('Create New User', 'নতুন ব্যবহারকারী')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-100 rounded-full bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          {error && <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-[10px]">{error}</div>}

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">{t('Full Name', 'নাম')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">{t('Username', 'ইউজারনেম')}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">{t('Password', 'পাসওয়ার্ড')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">{t('Role', 'রোল')}</label>
            <select
              value={role}
              onChange={e => handleRoleChange(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="super_admin" className="bg-slate-900 text-white">{t('Super Admin', 'সুপার অ্যাডমিন')}</option>
              <option value="super_admin_2" className="bg-slate-900 text-white">{t('Super Admin 2 (Viewer @abujar287)', 'সুপার অ্যাডমিন ২ (আবুজারের হিসাব दर्शक)')}</option>
              <option value="admin" className="bg-slate-900 text-white">{t('Admin', 'অ্যাডমিন')}</option>
              <option value="senior_member" className="bg-slate-900 text-white">{t('Senior Member', 'সিনিয়র মেম্বার')}</option>
              <option value="member" className="bg-slate-900 text-white">{t('Member', 'মেম্বার')}</option>
            </select>
          </div>

          {/* Allowed Tabs Checkboxes */}
          <div>
            <label className="text-[10px] font-semibold text-slate-300 block mb-1">
              {t('Tab Access Permissions', 'ট্যাব এক্সেস')}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1.5 bg-slate-800/80 rounded-lg border border-slate-700">
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
                    className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-700/50 cursor-pointer select-none text-[10px]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTab(tabItem.id)}
                      className="rounded border-slate-600 text-indigo-600 focus:ring-0 cursor-pointer w-3 h-3"
                    />
                    <span className="text-slate-200">{tabItem.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Read Only Toggle */}
          <div>
            <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isReadOnly}
                onChange={e => setIsReadOnly(e.target.checked)}
                className="rounded border-slate-600 text-indigo-600 focus:ring-0 cursor-pointer w-3.5 h-3.5"
              />
              <span className="text-[10px] font-medium text-slate-200">
                {t('Read-Only Access', 'শুধুমাত্র পড়তে পারবে')}
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-lg font-bold shadow-sm cursor-pointer mt-2 active:scale-98 text-xs"
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
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-slate-800 text-slate-100 w-full max-w-[320px] rounded-2xl p-4 shadow-2xl relative border border-slate-700/50 animate-modalSpring text-center space-y-3 my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Trash2 className="w-5 h-5" />
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-100">
            {t('Delete User Account?', 'ইউজার ডিলিট করতে চান?')}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            @{user.username} ({user.displayName})
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer active:scale-95"
          >
            {t('Cancel', 'বাতিল')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(user)}
            className="py-1.5 bg-rose-600 hover:bg-rose-500 text-slate-100 rounded-lg text-xs font-bold shadow-sm cursor-pointer active:scale-95"
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
  const [emoji, setEmoji] = useState('🏷️');

  const presetEmojis = [
    '🏷️', '💰', '💳', '💵', '🪙', '📈', '📊', '💼', '🎁', '🎓', '✈️',
    '🍳', '☕', '🧋', '🍵', '🍕', '🍔', '🥗', '🍎', '🍌', '🛒', '🛍️',
    '🚗', '🚌', '🏍️', '⛽', '🚕', '🚂', '📱', '📶', '⚡', '💧', '💡',
    '🔌', '💊', '🏥', '🩺', '🏠', '🛋️', '🔑', '🧹', '🧴', '🧼', '👨‍👩‍👧',
    '👥', '💑', '🌙', '🐦', '🐾', '💻', '👕', '👔', '💇', '📚', '✏️',
    '🔧', '🔨', '⚽', '🏋️', '🎮', '🎬', '🎧', '💎', '⭐', '🔥'
  ];

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
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-slate-800 text-slate-100 w-full max-w-sm rounded-2xl p-4 sm:p-5 shadow-2xl relative border border-slate-700/50 animate-modalSpring max-h-[92vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-slate-700/50 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-100">
              {t('Add New Category', 'নতুন ক্যাটাগরি যোগ')} ({type === 'Expense' ? t('Expense', 'খরচ') : t('Income', 'আয়')})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-100 rounded-full bg-slate-700 hover:bg-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
              {t('Category Name', 'ক্যাটাগরির নাম')}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('e.g., Gym, Bajar, Electricity', 'যেমন: বাজার, বিদ্যুৎ, যাতায়াত')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-xl font-bold shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-98 text-xs transition-all"
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
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-white text-[#0F172A] w-full max-w-[340px] rounded-2xl p-4 shadow-xl relative border border-slate-200 animate-modalSpring text-xs space-y-3 max-h-[88vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="HisabKitab Logo" className="w-6 h-6 rounded-lg object-cover shadow-sm border border-slate-100" />
            <div>
              <h3 className="text-xs font-bold text-[#0F172A]">HisabKitab</h3>
              <p className="text-[9px] text-slate-500">{t('Install App', 'অ্যাপ ইনস্টল করুন')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#0F172A] rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* App Banner Card */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
          <img src="/logo.png" alt="HisabKitab" className="w-12 h-12 rounded-xl object-cover shadow-sm border border-slate-200 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-[#0F172A] truncate">HisabKitab</h4>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
              {t('Smart Expense & Income Tracker', 'স্মার্ট হিসাব কিতাব ও বাজেট ট্র্যাকার')}
            </p>
          </div>
        </div>

        {/* QR Code */}
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(window.location.origin)}`}
            alt="HisabKitab App QR Code"
            className="w-28 h-28 rounded-lg"
          />
          <span className="text-[10px] font-bold text-[#0F172A] mt-1">
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
                ? 'To install HisabKitab:\n1. Open in Chrome or Safari\n2. Tap Browser Menu (⋮ or Share)\n3. Tap "Install App" or "Add to Home Screen"'
                : 'HisabKitab ইনস্টল করতে:\n১. ক্রোম বা সাফারি ব্রাউজারে সাইটটি ওপেন করুন\n২. থ্রি-ডট (⋮) বা শেয়ার আইকন চাপুন\n৩. "Install App" বা "Add to Home Screen" অপশনে ট্যাপ করুন'
            );
          }}
          className="w-full py-3 bg-[#16A34A] hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 text-sm transition-all"
        >
          <Smartphone className="w-4 h-4" />
          <span>{t('Install HisabKitab Now', 'HisabKitab ইন্সটল করুন')}</span>
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#0F172A] rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 text-xs transition-all border border-slate-200"
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? t('Copied Link!', 'লিংক কপি হয়েছে!') : t('Copy HisabKitab Link', ' HisabKitab লিংক কপি করুন')}</span>
        </button>

        <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600 space-y-0.5">
          <b className="text-[#0F172A] block">{t('Instructions:', 'ইন্সটল পদ্ধতি:')}</b>
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
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-white text-[#0F172A] w-full max-w-[340px] rounded-2xl p-4 shadow-xl relative border border-slate-200 animate-modalSpring max-h-[88vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#475569]" />
            <h3 className="text-xs font-bold text-[#0F172A]">{t('Edit Profile', 'প্রোফাইল এডিট')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#0F172A] rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              {t('Display Name', 'নাম')}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-slate-400"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              {t('Username', 'ইউজারনেম')}
            </label>
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
              {t('Password', 'পাসওয়ার্ড')}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-slate-400"
              required
            />
          </div>

          {/* Role and Permissions for Admin */}
          {isAdmin && user.username !== 'abujar287' && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                  {t('Role', 'রোল')}
                </label>
                <select
                  value={role}
                  onChange={e => handleRoleChange(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="super_admin" className="bg-white text-[#0F172A]">{t('Super Admin', 'সুপার অ্যাডমিন')}</option>
                  <option value="super_admin_2" className="bg-white text-[#0F172A]">{t('Super Admin 2 (Viewer @abujar287)', 'সুপার অ্যাডমিন ২ (আবুজারের হিসাব दर्शक)')}</option>
                  <option value="admin" className="bg-white text-[#0F172A]">{t('Admin', 'অ্যাডমিন')}</option>
                  <option value="senior_member" className="bg-white text-[#0F172A]">{t('Senior Member', 'সিনিয়র মেম্বার')}</option>
                  <option value="member" className="bg-white text-[#0F172A]">{t('Member', 'মেম্বার')}</option>
                </select>
              </div>

              {/* Allowed Tabs */}
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                  {t('Tab Access Permissions', 'ট্যাব এক্সেস')}
                </label>
                <div className="grid grid-cols-2 gap-1 p-1.5 bg-slate-50 rounded-lg border border-slate-200">
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
                        className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-100 cursor-pointer select-none text-[10px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTab(tabItem.id)}
                          className="rounded border-slate-300 text-[#475569] focus:ring-0 cursor-pointer w-3 h-3"
                        />
                        <span className="text-[#0F172A]">{tabItem.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-[#475569] hover:bg-slate-700 text-white rounded-lg font-bold shadow-sm cursor-pointer mt-2 active:scale-98 text-xs"
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
  const totalVal = catTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.value) || 0), 0);
  const isExpense = catTxs.length > 0 ? catTxs[0].type === 'Expense' : true;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 animate-fadeIn"
        onClick={onClose}
      >
        <div
          className="bg-white text-[#0F172A] w-full max-w-[360px] rounded-2xl p-4 shadow-xl relative border border-slate-200 animate-modalSpring max-h-[85vh] overflow-y-auto overscroll-contain my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Tag className="w-3.5 h-3.5 text-[#475569] shrink-0" />
            <h3 className="text-xs font-bold text-[#0F172A] truncate max-w-[220px]">
              {cleanCategoryName(categoryName, lang)} {t('Details', 'এর হিসাব')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#0F172A] rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category Total Header */}
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between mb-2.5">
          <div>
            <span className="text-[9.5px] text-slate-500 block font-semibold">
              {t('Total Records', 'মোট সংখ্যা')}
            </span>
            <span className="text-xs font-bold text-[#0F172A]">
              {catTxs.length} {t('items', 'টি')}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9.5px] text-slate-500 block font-semibold">
              {isExpense ? t('Total Spent', 'মোট খরচ') : t('Total Income', 'মোট আয়')}
            </span>
            <span
              className={`text-xs font-extrabold tabular-nums ${
                isExpense ? 'text-[#EF4444]' : 'text-[#16A34A]'
              }`}
            >
              {isExpense ? '-' : '+'}
              {formatNumberLocale(totalVal, lang)}
            </span>
          </div>
        </div>

        {/* Transactions List */}
        {catTxs.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-6">
            {t('No transactions found in this category.', 'এই ক্যাটাগরিতে কোনো হিসাব নেই।')}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-0.5">
            {catTxs.map(tx => {
              const isExpense = tx.type === 'Expense';
              const emoji = getCategoryEmoji(tx.category);
              const circleColor = getCategoryColor(tx.category);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl transition-all group shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-2xs ${circleColor} text-slate-900 border border-slate-200/60`}>
                      {emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#0F172A] text-[11px] truncate">
                          {cleanCategoryName(tx.category, lang)}
                        </span>
                        <span className="text-[9.5px] text-slate-400 shrink-0 font-medium">
                          {formatDateShortDemo(tx.date, lang)}
                        </span>
                      </div>
                      {tx.note && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {tx.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-extrabold text-[11px] tabular-nums ${
                        isExpense ? 'text-[#EF4444]' : 'text-[#16A34A]'
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
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-[#475569] rounded hover:bg-white cursor-pointer transition-colors"
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
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 rounded hover:bg-white cursor-pointer transition-colors"
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

  const appsScriptCode = `// ====================================================================
// হিসাব-নিকাশ: গুগল শিট Apps Script কোড (Code.gs)
// ভার্সন: 6.0 (মাল্টি-ট্যাব সাপোর্ট ও কাস্টম মাস ভিত্তিক তারিখ রেঞ্জ)
// ====================================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = (e && e.parameter) ? e.parameter : {};
    }
    
    var tabName = (data.sheetTab || data.sheet || (e && e.parameter ? (e.parameter.sheetTab || e.parameter.sheet) : '') || '').toString().trim();
    var sheet = getTargetSheet(ss, tabName);
    var action = (data.action || (e && e.parameter ? e.parameter.action : '') || '').toString().toLowerCase().trim();
    
    // ১. নতুন ট্যাব তৈরি অ্যাকশন (CREATE TAB)
    if (action === 'createtab') {
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'শিট ট্যাব প্রস্তুত: ' + sheet.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ২. রো মুছে ফেলার অ্যাকশন (DELETE ROW)
    if (action === 'delete' || data.isDelete === true) {
      return handleDeleteRow(sheet, data, e ? e.parameter : null);
    }
    
    // ৩. ব্যাচ পুশ ব্যাকআপ (PUSH ALL)
    if (action === 'pushall' && Array.isArray(data.transactions)) {
      for (var k = 0; k < data.transactions.length; k++) {
        var t = data.transactions[k];
        insertRowIfNotExists(sheet, t.id, t.datetime || new Date().toLocaleString(), t.type, t.category, t.date, t.value, t.note || '');
      }
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        message: 'সব ডেটা সেভ হয়েছে',
        sheetTab: sheet.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ৪. আপডেট অ্যাকশন (UPDATE ROW)
    if (action === 'update') {
      return handleUpdateRow(sheet, data);
    }

    // ৫.১ একক ক্যাটাগরি নিচে যোগ করা (ADD CATEGORY - আগের কিছু না মুছে নিচে যুক্ত)
    if (action === 'addcategory') {
      var catSheet = getCategorySheet(ss);
      var cName = String(data.category || '').trim();
      var cType = String(data.type || 'Expense').trim();
      if (cName) {
        var rows = catSheet.getDataRange().getValues();
        var exists = false;
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][1]).trim().toLowerCase() === cName.toLowerCase()) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          catSheet.appendRow([cType, cName]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        message: 'ক্যাটাগরি যুক্ত হয়েছে: ' + cName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.২ নির্দিষ্ট ক্যাটাগরি ডিলিট (DELETE CATEGORY)
    if (action === 'deletecategory') {
      var catSheet = getCategorySheet(ss);
      var catToRemove = String(data.category || '').trim().toLowerCase();
      if (catToRemove) {
        var rows = catSheet.getDataRange().getValues();
        for (var dIdx = rows.length - 1; dIdx >= 1; dIdx--) {
          if (String(rows[dIdx][1] || '').trim().toLowerCase() === catToRemove) {
            catSheet.deleteRow(dIdx + 1);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        message: 'ক্যাটাগরি ডিলিট হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৩ সব ক্যাটাগরি নিরাপদ সিঙ্ক (বিদ্যমান ক্যাটাগরি অক্ষুণ্ণ রেখে নিচে যোগ)
    if (action === 'savecategories' || action === 'savecategory') {
      var catSheet = getCategorySheet(ss);
      var existingRows = catSheet.getDataRange().getValues();
      var existingMap = {};
      for (var eIdx = 1; eIdx < existingRows.length; eIdx++) {
        var eCat = String(existingRows[eIdx][1] || '').trim().toLowerCase();
        if (eCat) existingMap[eCat] = true;
      }
      
      var cats = Array.isArray(data.categories) ? data.categories : [];
      var addedCount = 0;
      for (var c = 0; c < cats.length; c++) {
        var item = cats[c];
        if (item && item.category) {
          var cleanName = String(item.category).trim();
          if (cleanName && !existingMap[cleanName.toLowerCase()]) {
            catSheet.appendRow([item.type || 'Expense', cleanName]);
            existingMap[cleanName.toLowerCase()] = true;
            addedCount++;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        message: 'ক্যাটাগরি নিরাপদ সিঙ্ক সম্পন্ন',
        added: addedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৪ কাস্টম মান্থ ম্যাপিং ও ডিফল্ট মাস সিঙ্ক (SAVE MAPPINGS - বাজেট কলাম সহ ৫ কলাম সাপোর্ট)
    if (action === 'savemappings' || action === 'setdefaultmonth' || action === 'updatedefaultmonth') {
      var mapSheet = ss.getSheetByName('month mapping');
      if (!mapSheet) {
        mapSheet = ss.insertSheet('month mapping');
      }

      var defaultLabel = parseLabelString(data.defaultMonth || data.defaultLabel || data.default || '').toLowerCase();
      var maps = Array.isArray(data.mappings) ? data.mappings : [];

      for (var d = 0; d < maps.length; d++) {
        var mItem = maps[d];
        if (mItem && (mItem.isDefault === true || String(mItem.isDefault).toLowerCase() === 'true' || String(mItem.isDefault).toLowerCase() === 'default' || String(mItem.defaultMonth).toLowerCase() === 'default')) {
          defaultLabel = parseLabelString(mItem.label || '').toLowerCase();
          break;
        }
      }

      // ১. বিদ্যমান শিট রো পড়া (Google Sheets Auto Date Conversion রিকভারি ও বাজেট রিড সহ)
      var rawValues = mapSheet.getDataRange().getValues();
      var combinedMap = {};

      if (rawValues.length > 1) {
        for (var r = 1; r < rawValues.length; r++) {
          var sDate = formatDateVal(rawValues[r][0]);
          var eDate = formatDateVal(rawValues[r][1]);
          var mLabel = parseLabelString(rawValues[r][2]);
          var mDef = String(rawValues[r][3] || '').trim().toLowerCase();
          var mBudget = (rawValues[r][4] !== undefined && rawValues[r][4] !== '') ? (Number(rawValues[r][4]) || 0) : '';
          if (mLabel) {
            var key = mLabel.toLowerCase();
            combinedMap[key] = {
              startDate: sDate,
              endDate: eDate,
              label: mLabel,
              isDefault: mDef === 'default' || mDef === 'true',
              budget: mBudget
            };
          }
        }
      }

      // ২. নতুন পে-লোড এর ডাটা আপডেট ও মার্জ করা (Unique by Month Label)
      for (var k = 0; k < maps.length; k++) {
        var item = maps[k];
        if (item && item.label) {
          var cleanL = parseLabelString(item.label);
          var itemKey = cleanL.toLowerCase();
          var isThisDef = item.isDefault === true ||
                          String(item.isDefault).toLowerCase() === 'true' ||
                          String(item.isDefault).toLowerCase() === 'default' ||
                          (defaultLabel && itemKey === defaultLabel);

          var itemBudget = (item.budget !== undefined && item.budget !== null && item.budget !== '') ? (Number(item.budget) || 0) : (combinedMap[itemKey] ? combinedMap[itemKey].budget : '');

          combinedMap[itemKey] = {
            startDate: formatDateVal(item.startDate) || (combinedMap[itemKey] ? combinedMap[itemKey].startDate : ''),
            endDate: formatDateVal(item.endDate) || (combinedMap[itemKey] ? combinedMap[itemKey].endDate : ''),
            label: cleanL,
            isDefault: isThisDef,
            budget: itemBudget
          };
          if (isThisDef) {
            defaultLabel = itemKey;
          }
        }
      }

      // ৩. ৫ কলাম বিশিষ্ট হেডার ও প্লেইন টেক্সট (@) ফরম্যাটে সেটিং
      mapSheet.clearContents();
      try {
        mapSheet.getRange(1, 1, Math.max(mapSheet.getMaxRows(), 30), 5).setNumberFormat('@');
      } catch (e) {}

      mapSheet.getRange(1, 1, 1, 5).setValues([['Start Date', 'End Date', 'Mapping Month', 'default month', 'Budget']]);
      try {
        mapSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
        mapSheet.setFrozenRows(1);
      } catch (err) {}

      var finalRows = [];
      var keys = Object.keys(combinedMap);
      var cleanDefKey = defaultLabel.replace(/[^a-z0-9]/g, '');

      for (var i = 0; i < keys.length; i++) {
        var obj = combinedMap[keys[i]];
        var cleanKey = keys[i].replace(/[^a-z0-9]/g, '');
        var isFinalDef = cleanDefKey ? (cleanKey === cleanDefKey) : obj.isDefault;
        finalRows.push([obj.startDate, obj.endDate, obj.label, isFinalDef ? 'default' : '', (obj.budget !== undefined && obj.budget !== '') ? obj.budget : '']);
      }

      if (finalRows.length > 0) {
        mapSheet.getRange(2, 1, finalRows.length, 5).setValues(finalRows);
      }

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        message: 'মান্থ ম্যাপিং ও বাজেট ৫ কলামে সফলভাবে সিঙ্ক হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ৫.৫ নির্দিষ্ট মাসের বাজেট সেভ (SAVE BUDGET - মান্থ ম্যাপিং কলাম ৫ ও ক্যাটাগরি শিটে স্টোর)
    if (action === 'savebudget' || action === 'setbudget') {
      var mapSheet = ss.getSheetByName('month mapping');
      if (!mapSheet) {
        mapSheet = ss.insertSheet('month mapping');
      }
      var targetMonth = parseLabelString(data.month || data.defaultMonth || (e && e.parameter ? e.parameter.month : '') || '').toLowerCase();
      var budgetVal = Number(data.budget !== undefined ? data.budget : (e && e.parameter ? e.parameter.budget : 0)) || 0;
      var cleanTarget = targetMonth.replace(/[^a-z0-9]/g, '');

      // ১. month mapping শিটের কলাম E (Budget) এ আপডেট
      var rawValues = mapSheet.getDataRange().getValues();
      if (rawValues.length <= 1 || !rawValues[0][0]) {
        mapSheet.getRange(1, 1, 1, 5).setValues([['Start Date', 'End Date', 'Mapping Month', 'default month', 'Budget']]);
        try {
          mapSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
          mapSheet.setFrozenRows(1);
        } catch (e) {}
        rawValues = mapSheet.getDataRange().getValues();
      }

      var matched = false;
      if (rawValues.length > 1) {
        for (var r = 1; r < rawValues.length; r++) {
          var mLabel = parseLabelString(rawValues[r][2]).toLowerCase();
          var cleanLabel = mLabel.replace(/[^a-z0-9]/g, '');
          var isMatch = cleanTarget && (cleanLabel === cleanTarget || (cleanLabel.length >= 3 && cleanTarget.length >= 3 && (cleanLabel.indexOf(cleanTarget) !== -1 || cleanTarget.indexOf(cleanLabel) !== -1)));
          if (isMatch) {
            mapSheet.getRange(r + 1, 5).setValue(budgetVal);
            matched = true;
            break;
          }
        }
      }
      if (!matched && targetMonth) {
        mapSheet.appendRow(['', '', parseLabelString(data.month || (e && e.parameter ? e.parameter.month : '')), '', budgetVal]);
      }

      // ২. ক্যাটাগরি বাজেট ব্রেকডাউন থাকলে 'Budget' শিটে ৫ কলামে সিঙ্ক (Mapping Month, Category, Budget, Spend, Remain)
      var catRows = Array.isArray(data.categoryRows) ? data.categoryRows : [];
      var catBudgets = data.categoryBudgets;
      if (catRows.length > 0 || (catBudgets && typeof catBudgets === 'object')) {
        var bSheet = ss.getSheetByName('Budget');
        if (!bSheet) {
          bSheet = ss.insertSheet('Budget');
        }

        // ৫ কলাম বিশিষ্ট হেডার নিশ্চিত করা: Mapping Month, Category, Budget, Spend, Remain
        var currentBData = bSheet.getDataRange().getValues();
        if (currentBData.length <= 1 || !currentBData[0][0] || String(currentBData[0][0]).toLowerCase().indexOf('mapping') === -1 || currentBData[0].length < 5) {
          bSheet.getRange(1, 1, 1, 5).setValues([['Mapping Month', 'Category', 'Budget', 'Spend', 'Remain']]);
          try {
            bSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
            bSheet.setFrozenRows(1);
          } catch (err) {}
          currentBData = bSheet.getDataRange().getValues();
        }

        // পূর্ববর্তী ডেটা অক্ষুণ্ণ রেখে (deleteRow না করে) ম্যাচিং ক্যাটাগরি আপডেট বা নিচে অ্যাপেন্ড করা
        var existingRowMap = {};
        for (var b = 1; b < currentBData.length; b++) {
          var bMonthKey = parseLabelString(currentBData[b][0]).toLowerCase().replace(/[^a-z0-9]/g, '');
          var bCatKey = String(currentBData[b][1] || '').trim().toLowerCase();
          if (bMonthKey && bCatKey) {
            existingRowMap[bMonthKey + '___' + bCatKey] = b + 1; // শিটের ১-ভিত্তিক রো ইনডেক্স
          }
        }

        var newBRowsToAppend = [];
        var monthName = parseLabelString(data.month || (e && e.parameter ? e.parameter.month : ''));
        var monthCleanKey = monthName.toLowerCase().replace(/[^a-z0-9]/g, '');

        var rowsToProcess = [];
        if (catRows.length > 0) {
          for (var c = 0; c < catRows.length; c++) {
            var item = catRows[c];
            if (item && item.category) {
              var cName = String(item.category).trim();
              var bVal = Number(item.budget) || 0;
              var sVal = Number(item.spend) || 0;
              var rVal = Number(item.remain !== undefined ? item.remain : (bVal - sVal)) || 0;
              rowsToProcess.push({ catName: cName, budget: bVal, spend: sVal, remain: rVal });
            }
          }
        } else if (catBudgets && typeof catBudgets === 'object') {
          var catKeys = Object.keys(catBudgets);
          for (var c = 0; c < catKeys.length; c++) {
            var cAmount = Number(catBudgets[catKeys[c]]) || 0;
            if (cAmount > 0) {
              rowsToProcess.push({ catName: catKeys[c], budget: cAmount, spend: 0, remain: cAmount });
            }
          }
        }

        for (var p = 0; p < rowsToProcess.length; p++) {
          var proc = rowsToProcess[p];
          var catKey = proc.catName.toLowerCase();
          var lookupKey = monthCleanKey + '___' + catKey;
          var existingRowIdx = existingRowMap[lookupKey];

          if (existingRowIdx) {
            // আগের রোতে ডেটা আপডেট (বাজেট, খরচ, অবশিষ্ট)
            bSheet.getRange(existingRowIdx, 3, 1, 3).setValues([[proc.budget, proc.spend, proc.remain]]);
          } else {
            // নতুন ক্যাটাগরি বা নতুন মাস নিচে যুক্ত হবে (আগের ডেটা মুছে ফেলা হবে না)
            newBRowsToAppend.push([monthName, proc.catName, proc.budget, proc.spend, proc.remain]);
          }
        }

        if (newBRowsToAppend.length > 0) {
          bSheet.getRange(bSheet.getLastRow() + 1, 1, newBRowsToAppend.length, 5).setValues(newBRowsToAppend);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        month: targetMonth,
        budget: budgetVal,
        message: 'বাজেট সফলভাবে শিটে সেভ হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ৬. নতুন রো যোগ করা (INSERT ROW)
    if (action === 'insert' || action === 'add' || action === 'create') {
      var id = data.id || ('ID-' + Date.now());
      var datetime = data.datetime || (new Date().toLocaleString());
      var type = data.type || 'Expense';
      var category = data.category || 'অন্যান্য';
      var date = data.date || (new Date().toISOString().split('T')[0]);
      var value = Number(data.value || 0);
      var note = data.note || '';
      
      insertRowIfNotExists(sheet, id, datetime, type, category, date, value, note);
      
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        id: id,
        sheetTab: sheet.getName(),
        message: 'রো সফলভাবে যোগ হয়েছে'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ result: 'unknown_action', sheetTab: sheet.getName() }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } finally {
    lock.releaseLock();
  }
}

// GET রিকোয়েস্ট হ্যান্ডলার
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var params = (e && e.parameter) ? e.parameter : {};
  var tabName = (params.sheetTab || params.sheet || '').toString().trim();
  var sheet = getTargetSheet(ss, tabName);
  var action = (params.action || '').toString().toLowerCase().trim();
  
  // ১. ট্যাব তৈরি
  if (action === 'createtab') {
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      sheetTab: sheet.getName(),
      message: 'শিট ট্যাব প্রস্তুত'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ২. রো ডিলিট (ব্রাউজার রিডাইরেক্ট সাপোর্ট)
  if (action === 'delete') {
    return handleDeleteRow(sheet, params, params);
  }

  // ৩. GET এর মাধ্যমেও রো ইনসার্ট সাপোর্ট
  if (action === 'insert' || action === 'add' || action === 'create') {
    var id = params.id || ('ID-' + Date.now());
    var datetime = params.datetime || (new Date().toLocaleString());
    var type = params.type || 'Expense';
    var category = params.category || 'অন্যান্য';
    var date = params.date || (new Date().toISOString().split('T')[0]);
    var value = Number(params.value || 0);
    var note = params.note || '';
    
    insertRowIfNotExists(sheet, id, datetime, type, category, date, value, note);
    
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      id: id,
      sheetTab: sheet.getName(),
      message: 'রো সফলভাবে যোগ হয়েছে'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৪. রো আপডেট
  if (action === 'update') {
    return handleUpdateRow(sheet, params);
  }

  // ৪.১ কাস্টম মান্থ ডিফল্ট সেট (GET পিন সাপোর্ট - ইনস্ট্যান্ট গুগল শিট আপডেট)
  if (action === 'setdefaultmonth' || action === 'updatedefaultmonth') {
    var mapSheet = ss.getSheetByName('month mapping');
    if (!mapSheet) {
      mapSheet = ss.insertSheet('month mapping');
    }
    var targetDef = parseLabelString(params.defaultMonth || params.defaultLabel || params.default || params.month || '').toLowerCase();
    var cleanTarget = targetDef.replace(/[^a-z0-9]/g, '');

    var rawValues = mapSheet.getDataRange().getValues();
    if (rawValues.length <= 1 || !rawValues[0][0]) {
      mapSheet.getRange(1, 1, 1, 4).setValues([['Start Date', 'End Date', 'Mapping Month', 'default month']]);
      try {
        mapSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
        mapSheet.setFrozenRows(1);
      } catch (e) {}
      rawValues = mapSheet.getDataRange().getValues();
    }

    if (rawValues.length > 1) {
      for (var r = 1; r < rawValues.length; r++) {
        var mLabel = parseLabelString(rawValues[r][2]).toLowerCase();
        var cleanLabel = mLabel.replace(/[^a-z0-9]/g, '');
        var targetRowIndex = r + 1;
        var isMatch = cleanTarget && (cleanLabel === cleanTarget || (cleanLabel.length >= 3 && cleanTarget.length >= 3 && (cleanLabel.indexOf(cleanTarget) !== -1 || cleanTarget.indexOf(cleanLabel) !== -1)));
        if (mLabel && isMatch) {
          mapSheet.getRange(targetRowIndex, 4).setValue('default');
        } else {
          mapSheet.getRange(targetRowIndex, 4).setValue('');
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      defaultMonth: targetDef,
      message: 'ডিফল্ট মাস সফলভাবে সেট হয়েছে: ' + targetDef
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৪.২ নির্দিষ্ট মাসের বাজেট সেভ (GET পিন সাপোর্ট - ইনস্ট্যান্ট গুগল শিট আপডেট)
  if (action === 'savebudget' || action === 'setbudget') {
    var mapSheet = ss.getSheetByName('month mapping');
    if (!mapSheet) {
      mapSheet = ss.insertSheet('month mapping');
    }
    var targetMonth = parseLabelString(params.month || params.defaultMonth || params.default || '').toLowerCase();
    var budgetVal = Number(params.budget || 0) || 0;
    var cleanTarget = targetMonth.replace(/[^a-z0-9]/g, '');

    var rawValues = mapSheet.getDataRange().getValues();
    if (rawValues.length <= 1 || !rawValues[0][0]) {
      mapSheet.getRange(1, 1, 1, 5).setValues([['Start Date', 'End Date', 'Mapping Month', 'default month', 'Budget']]);
      try {
        mapSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
        mapSheet.setFrozenRows(1);
      } catch (e) {}
      rawValues = mapSheet.getDataRange().getValues();
    }

    var matched = false;
    if (rawValues.length > 1) {
      for (var r = 1; r < rawValues.length; r++) {
        var mLabel = parseLabelString(rawValues[r][2]).toLowerCase();
        var cleanLabel = mLabel.replace(/[^a-z0-9]/g, '');
        var isMatch = cleanTarget && (cleanLabel === cleanTarget || (cleanLabel.length >= 3 && cleanTarget.length >= 3 && (cleanLabel.indexOf(cleanTarget) !== -1 || cleanTarget.indexOf(cleanLabel) !== -1)));
        if (isMatch) {
          mapSheet.getRange(r + 1, 5).setValue(budgetVal);
          matched = true;
          break;
        }
      }
    }
    if (!matched && targetMonth) {
      mapSheet.appendRow(['', '', parseLabelString(params.month || ''), '', budgetVal]);
    }
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      month: targetMonth,
      budget: budgetVal,
      message: 'বাজেট সফলভাবে সেট হয়েছে: ' + budgetVal
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৫.১ একক ক্যাটাগরি নিচে যোগ (GET সাপোর্ট - আগের কিছু না মুছে নিচে যুক্ত)
  if (action === 'addcategory') {
    var catSheet = getCategorySheet(ss);
    var cName = String(params.category || '').trim();
    var cType = String(params.type || 'Expense').trim();
    if (cName) {
      var rows = catSheet.getDataRange().getValues();
      var exists = false;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][1]).trim().toLowerCase() === cName.toLowerCase()) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        catSheet.appendRow([cType, cName]);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      message: 'ক্যাটাগরি যুক্ত হয়েছে: ' + cName
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৫.২ নির্দিষ্ট ক্যাটাগরি ডিলিট (GET সাপোর্ট)
  if (action === 'deletecategory') {
    var catSheet = getCategorySheet(ss);
    var catToRemove = String(params.category || '').trim().toLowerCase();
    if (catToRemove) {
      var rows = catSheet.getDataRange().getValues();
      for (var dIdx = rows.length - 1; dIdx >= 1; dIdx--) {
        if (String(rows[dIdx][1] || '').trim().toLowerCase() === catToRemove) {
          catSheet.deleteRow(dIdx + 1);
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      message: 'ক্যাটাগরি ডিলিট হয়েছে'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ৫.৩ শুধু ক্যাটাগরি পড়া
  if (action === 'getcategories') {
    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      categories: getCategoriesList(ss)
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ৬. নির্দিষ্ট ট্যাবের সব লেনদেন ও ক্যাটাগরি পড়া
  var rows = sheet.getDataRange().getValues();
  var transactions = [];
  
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] && !r[1] && !r[2] && !r[3] && !r[4] && !r[5]) continue;
    
    var txId = String(r[0] || ('row-' + (i + 1)));
    var txDateTime = String(r[1] || '');
    var txType = String(r[2] || '');
    var txCat = String(r[3] || '');
    var txDate = String(r[4] || '');
    var txVal = Number(r[5] || 0);
    var txNote = String(r[6] || '');
    
    if (txDate instanceof Date) {
      var y = txDate.getFullYear();
      var m = String(txDate.getMonth() + 1).padStart(2, '0');
      var d = String(txDate.getDate()).padStart(2, '0');
      txDate = y + '-' + m + '-' + d;
    }
    
    transactions.push({
      id: String(txId),
      rowNumber: i + 1,
      datetime: String(txDateTime),
      type: String(txType).toLowerCase().indexOf('income') !== -1 || String(txType).indexOf('আয়') !== -1 ? 'Income' : 'Expense',
      category: String(txCat),
      date: String(txDate),
      value: Number(txVal) || 0,
      note: String(txNote || '')
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    result: 'success',
    sheetTab: sheet.getName(),
    transactions: transactions,
    categories: getCategoriesList(ss),
    monthMappings: getMonthMappings(ss),
    categoryBudgets: getCategoryBudgets(ss),
    count: transactions.length
  })).setMimeType(ContentService.MimeType.JSON);
}

// ডুপ্লিকেট রোধ করে রো ইনসার্ট
function insertRowIfNotExists(sheet, id, datetime, type, category, date, value, note) {
  if (id) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(id).trim()) {
        return;
      }
    }
  }
  sheet.appendRow([id, datetime, type, category, date, value, note]);
}

// নির্দিষ্ট ট্যাব খোঁজা অথবা তৈরি করা
function getTargetSheet(ss, tabName) {
  var clean = (tabName || '').toString().trim();
  if (!clean) return ss.getActiveSheet() || ss.getSheets()[0];
  
  var target = ss.getSheetByName(clean);
  if (target) return target;
  
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var s = allSheets[i];
    if (s.getName().trim().toLowerCase() === clean.toLowerCase()) {
      return s;
    }
  }
  
  if (clean.toLowerCase() === 'abujar287') {
    var firstSheet = allSheets[0];
    if (firstSheet) {
      try {
        firstSheet.setName('abujar287');
      } catch (err) {}
      return firstSheet;
    }
  }
  
  try {
    target = ss.insertSheet(clean);
    target.appendRow(['ID', 'DateTime', 'Type', 'Category', 'Date', 'Value', 'Note']);
    try {
      target.getRange(1, 1, 1, 7).setFontWeight('bold');
      target.setFrozenRows(1);
    } catch (err) {}
    return target;
  } catch (e) {
    return ss.getSheetByName(clean) || ss.getActiveSheet();
  }
}

// ক্যাটাগরি শিট খোঁজা অথবা তৈরি করা
function getCategorySheet(ss) {
  var target = ss.getSheetByName('Category');
  if (target) return target;
  
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getName().trim().toLowerCase() === 'category') {
      return all[i];
    }
  }
  
  try {
    target = ss.insertSheet('Category');
    target.appendRow(['Type', 'Category']);
    try {
      target.getRange(1, 1, 1, 2).setFontWeight('bold');
      target.setFrozenRows(1);
    } catch (err) {}
    return target;
  } catch (e) {
    return ss.getSheetByName('Category') || ss.getActiveSheet();
  }
}

// ক্যাটাগরি তালিকা পড়া
function getCategoriesList(ss) {
  var catSheet = getCategorySheet(ss);
  var categories = [];
  if (catSheet) {
    var rows = catSheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var cType = String(rows[i][0] || '').trim();
      var cName = String(rows[i][1] || '').trim();
      if (cName) {
        categories.push({
          type: cType.toLowerCase().indexOf('inc') !== -1 || cType.indexOf('আয়') !== -1 ? 'Income' : 'Expense',
          category: cName
        });
      }
    }
  }
  return categories;
}

// রো স্থায়ীভাবে মুছে ফেলা
function handleDeleteRow(sheet, data, param) {
  var id = String((data && data.id) || (param && param.id) || '').trim();
  var date = String((data && data.date) || (param && param.date) || '').trim();
  var cat = String((data && data.category) || (param && param.category) || '').trim();
  var val = Number((data && data.value) || (param && param.value) || 0);
  
  var rows = sheet.getDataRange().getValues();
  
  for (var i = rows.length - 1; i >= 1; i--) {
    var row = rows[i];
    var matched = false;
    
    if (id && String(row[0]).trim() === id) {
      matched = true;
    }
    
    if (!matched && cat) {
      var r7Cat = String(row[3] || '').trim();
      var r7Date = String(row[4] || '').trim();
      var r7Val = Number(row[5] || 0);
      if (r7Cat === cat && (r7Date.indexOf(date) !== -1 || date.indexOf(r7Date) !== -1) && Math.abs(r7Val - val) < 1) {
        matched = true;
      }
    }
    
    if (!matched && date && val > 0) {
      var rowStr = row.join(' | ').toLowerCase();
      var hasDate = rowStr.indexOf(date.toLowerCase()) !== -1;
      var hasVal = row.some(function(c) { return Math.abs(Number(c) - val) < 0.5; });
      if (hasDate && hasVal) {
        matched = true;
      }
    }
    
    if (matched) {
      sheet.deleteRow(i + 1);
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'রো সফলভাবে ডিলিট হয়েছে (Row ' + (i + 1) + ' deleted)',
        deletedRow: i + 1
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    result: 'not_found',
    sheetTab: sheet.getName(),
    message: 'শিটে রো পাওয়া যায়নি'
  })).setMimeType(ContentService.MimeType.JSON);
}

// রো আপডেট ফাংশন
function handleUpdateRow(sheet, data) {
  var id = String(data.id || '');
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === id) {
      var r = i + 1;
      sheet.getRange(r, 3).setValue(data.type);
      sheet.getRange(r, 4).setValue(data.category);
      sheet.getRange(r, 5).setValue(data.date);
      sheet.getRange(r, 6).setValue(data.value);
      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        sheetTab: sheet.getName(),
        message: 'Row updated'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({
    result: 'not_found',
    sheetTab: sheet.getName()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ৭. মাস ভিত্তিক ম্যাপিং পড়া (বাজেট কলাম সহ)
function getMonthMappings(ss) {
  var sheet = ss.getSheetByName('month mapping');
  if (!sheet) {
    try {
      sheet = ss.insertSheet('month mapping');
      sheet.appendRow(['Start Date', 'End Date', 'Mapping Month', 'default month', 'Budget']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } catch (e) {
      return [];
    }
  }
  
  var rows = sheet.getDataRange().getValues();
  var mappings = [];
  for (var i = 1; i < rows.length; i++) {
    var start = formatDateVal(rows[i][0]);
    var end = formatDateVal(rows[i][1]);
    var label = parseLabelString(rows[i][2]);
    var rawDef = String(rows[i][3] || '').trim().toLowerCase();
    var isDef = rawDef === 'true' || rawDef === 'yes' || rawDef === 'default';
    var budget = (rows[i][4] !== undefined && rows[i][4] !== '') ? (Number(rows[i][4]) || 0) : 0;
    
    if (label && start && end) {
      mappings.push({
        startDate: start,
        endDate: end,
        label: label,
        isDefault: isDef,
        budget: budget
      });
    }
  }
  return mappings;
}

// ৮. ক্যাটাগরি বাজেট পড়া
function getCategoryBudgets(ss) {
  var bSheet = ss.getSheetByName('Budget');
  var budgets = {};
  if (!bSheet) return budgets;
  var rows = bSheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var m = parseLabelString(rows[i][0]);
    var cat = String(rows[i][1] || '').trim();
    var val = Number(rows[i][2]) || 0;
    if (m && cat) {
      if (!budgets[m]) budgets[m] = {};
      budgets[m][cat] = val;
    }
  }
  return budgets;
}

// লেবেল থেকে টেক্সট এক্সট্রাক্ট করা (Date object support সহ)
function parseLabelString(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[val.getMonth()] + '-' + val.getFullYear();
  }
  var str = String(val).trim();
  if (str.indexOf('GMT') !== -1 || str.indexOf('Standard Time') !== -1) {
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      var ms = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return ms[d.getMonth()] + '-' + d.getFullYear();
    }
  }
  return str;
}

// ডেট ভ্যালু ফরম্যাট করা (YYYY-MM-DD)
function formatDateVal(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, '0');
    var d = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  var str = String(val).trim();
  if (str.indexOf('GMT') !== -1 || str.indexOf('Standard Time') !== -1) {
    var dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      var y2 = dateObj.getFullYear();
      var m2 = String(dateObj.getMonth() + 1).padStart(2, '0');
      var d2 = String(dateObj.getDate()).padStart(2, '0');
      return y2 + '-' + m2 + '-' + d2;
    }
  }
  return str;
}
`;

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
          className="bg-white text-[#0F172A] w-full max-w-[400px] rounded-2xl p-4 shadow-xl relative border border-slate-200 animate-modalSpring max-h-[88vh] overflow-y-auto overscroll-contain space-y-3 my-auto"
          onClick={e => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-[#475569]" />
            <h3 className="text-xs font-bold text-[#0F172A]">
              {t('Apps Script Backend Code', 'অ্যাপস স্ক্রিপ্ট কোড')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#0F172A] rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-medium space-y-1">
          <p className="font-extrabold flex items-center gap-1 text-amber-950">
            <span>⚠️</span> {t('Crucial Google Apps Script Deployment Instructions:', 'জরুরী ধাপ (গুগল শিট আপডেট পাওয়ার জন্য):')}
          </p>
          <p className="text-[10px] leading-snug">
            {t(
              'After replacing code in Apps Script, click: Deploy > New deployment (or Deploy > Manage deployments > Edit > New Version) to activate updates.',
              'অ্যাপস স্ক্রিপ্টে এই কোডটি পেস্ট করার পর অবশ্যই top menu থেকে Deploy > New deployment (অথবা Deploy > Manage deployments > Edit > New Version) দিতে হবে।'
            )}
          </p>
        </div>

        <div className="relative">
          <pre className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-mono text-[#0F172A] overflow-x-auto max-h-48 no-scrollbar">
            {appsScriptCode}
          </pre>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-2 bg-[#475569] hover:bg-slate-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98 text-xs"
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
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
          className="bg-white text-[#0F172A] w-full max-w-md rounded-2xl p-4 shadow-xl relative border border-slate-200 animate-modalSpring max-h-[85vh] flex flex-col my-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#475569]" />
              <h3 className="text-xs font-bold text-[#0F172A] uppercase">
                {t('Manage Categories', 'ক্যাটাগরি ম্যানেজমেন্ট')}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-[#475569] hover:text-[#0F172A] rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Type Tab Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl mb-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveType('Expense')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeType === 'Expense' ? 'bg-[#EF4444] text-white shadow-sm' : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              {t('Expense Categories', 'খরচের ক্যাটাগরি')} ({expenseCategories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveType('Income')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeType === 'Income' ? 'bg-[#16A34A] text-white shadow-sm' : 'text-slate-600 hover:text-[#0F172A]'
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
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs shadow-sm"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5 rounded border border-slate-200 bg-white" title="Move / Drag">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-[#0F172A] truncate">
                    {cleanCategoryName(cat, lang)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 'up')}
                    disabled={idx === 0}
                    className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600 hover:text-[#0F172A] disabled:opacity-30 cursor-pointer text-[10px] font-bold shadow-sm"
                    title="Move Up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 'down')}
                    disabled={idx === categories.length - 1}
                    className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600 hover:text-[#0F172A] disabled:opacity-30 cursor-pointer text-[10px] font-bold shadow-sm"
                    title="Move Down"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(cat, idx)}
                    className="p-1 rounded border border-slate-200 bg-white text-[#475569] hover:bg-slate-100 cursor-pointer shadow-sm"
                    title="Edit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(cat)}
                    className="p-1 rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer shadow-sm"
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
            className="w-full py-2.5 bg-[#475569] hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-98 shrink-0 text-xs"
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
          className="bg-white text-[#0F172A] w-full max-w-[340px] rounded-2xl p-5 shadow-xl relative border border-slate-200 animate-modalSpring my-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-[#0F172A]">{t('Export Report', 'রিপোর্ট এক্সপোর্ট')}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-[#475569] hover:text-[#0F172A] rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Step 1: Select Scope */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                {t('1. Select Export Type', '১. এক্সপোর্টের ধরন নির্বাচন করুন')}
              </label>
              <select
                value={exportScope}
                onChange={e => setExportScope(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[#0F172A] focus:outline-none focus:border-slate-400 cursor-pointer shadow-sm"
              >
                <option value="month">{t('Specific Month', 'নির্দিষ্ট মাস অনুযায়ী')}</option>
                <option value="custom">{t('Custom Date Range', 'কাস্টম তারিখ অনুযায়ী')}</option>
                <option value="all">{t('Full History (All-Time)', 'শুরু থেকে আজ পর্যন্ত')}</option>
              </select>
            </div>

            {/* Step 2: Select Details based on Scope */}
            <div className="animate-fadeIn">
              {exportScope === 'month' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {t('2. Select Month', '২. মাস নির্বাচন করুন')}
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[#0F172A] focus:outline-none focus:border-slate-400 cursor-pointer shadow-sm"
                  >
                    {monthOptions.map(m => (
                      <option key={m.val} value={m.val}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {exportScope === 'custom' && (
                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {t('2. Select Date Range', '২. তারিখ নির্বাচন করুন')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">{t('Start', 'শুরু')}</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-slate-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">{t('End', 'শেষ')}</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F172A] focus:outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {exportScope === 'all' && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-[10px] font-medium text-indigo-700 text-center">
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
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-100 active:scale-98 transition-all text-sm"
              >
                <Download className="w-5 h-5" />
                <span>{t('Download ZIP Report', 'ZIP রিপোর্ট ডাউনলোড করুন')}</span>
              </button>
            </div>
            
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
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
          className="bg-white text-[#0F172A] w-full max-w-[320px] rounded-2xl p-4 shadow-xl relative border border-slate-200 animate-modalSpring text-center space-y-3 my-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#475569] flex items-center justify-center mx-auto">
            <DoorOpen className="w-5 h-5" />
          </div>

          <div>
            <h3 className="text-xs font-bold text-[#0F172A]">
              {t('Exit Application?', 'অ্যাপ থেকে বের হতে চান?')}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t('Are you sure you want to close HisabKitab?', 'আপনি কি নিশ্চিত যে আপনি HisabKitab বন্ধ করতে চান?')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer active:scale-95"
            >
              {t('Cancelled', 'বাতিল')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="py-1.5 bg-[#475569] hover:bg-[#334155] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer active:scale-95"
            >
              {t('Exit', 'বের হন')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
