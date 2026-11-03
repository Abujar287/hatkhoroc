import React, { useState, useRef } from 'react';
import {
  User,
  Download,
  Upload,
  FileJson,
  LogOut,
  FileSpreadsheet,
  Archive,
  Smartphone,
  Calendar,
  Trash2,
  Plus,
  Shield,
  Layers,
  Settings2,
  Edit3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AppUser, Transaction, TransactionType } from '../types';
import { cleanCategoryName } from '../utils/categoryUtils';
import {
  normalizeDate,
  formatNumberLocale,
  formatCleanDateTime,
  cleanMappingLabel,
  getMonthKeyFromLabel
} from '../utils/dateUtils';
import { exportMonthlyReportZip } from '../utils/exportZipReport';
import { AppsScriptModal, ExportMonthModal } from './Modals';

interface SettingsTabProps {
  currentUser: AppUser | null;
  expenseCategories: string[];
  incomeCategories: string[];
  onOpenAddCategoryModal: (type: TransactionType) => void;
  onDeleteCategory: (category: string, type: TransactionType) => void;
  transactions: Transaction[];
  lang: 'en' | 'bn';
  onOpenEditProfile: () => void;
  viewMode: 'mobile' | 'desktop';
  onLogout?: () => void;
  onImportJson?: (data: any) => boolean | void;
  t: (en: string, bn: string) => string;
  isSyncing?: boolean;
  onSync?: () => void;
  lastSyncTime?: string;
  toggleLanguage?: () => void;
  monthlyBudget?: number;
  onSaveMonthlyBudget?: (budget: number) => void;
  onOpenInstallModal?: () => void;
  onUpdateSpreadsheetId?: (id: string) => void;
  selectedMonth: string;
  monthMappings: import('../types').MonthMapping[];
  onAddMonthMapping: (mapping: import('../types').MonthMapping) => void;
  onDeleteMonthMapping: (id: string) => void;
  onSelectMonth: (month: string) => void;
  onSetDefaultMonth?: (monthLabel: string) => void;
}

const getRoleLabel = (role?: string) => {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'super_admin_2': return 'Super Admin (Viewer)';
    case 'admin': return 'Admin';
    case 'senior_member': return 'Senior Member';
    case 'member': return 'Member';
    default: return 'User';
  }
};

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  expenseCategories,
  incomeCategories,
  transactions,
  lang,
  onOpenEditProfile,
  onLogout,
  onImportJson,
  t,
  onOpenInstallModal,
  selectedMonth,
  monthMappings,
  onAddMonthMapping,
  onDeleteMonthMapping,
  onSelectMonth,
  onSetDefaultMonth
}) => {
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.username === 'abujar287';
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Custom Month Mapping State
  const [isMappingDropdownOpen, setIsMappingDropdownOpen] = useState(false);
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [selectedMappingViewId, setSelectedMappingViewId] = useState<string>('');
  const [newMappingLabel, setNewMappingLabel] = useState('');
  const [newMappingStart, setNewMappingStart] = useState('');
  const [newMappingEnd, setNewMappingEnd] = useState('');
  const [newMappingIsDefault, setNewMappingIsDefault] = useState(false);

  const handleAddMapping = () => {
    if (!newMappingLabel.trim() || !newMappingStart || !newMappingEnd) {
      alert(t('Please fill all fields for custom month', 'সবগুলো ঘর পূরণ করুন'));
      return;
    }
    const cleanLabel = cleanMappingLabel(newMappingLabel) || newMappingLabel.trim();
    onAddMonthMapping({
      id: Date.now().toString(),
      label: cleanLabel,
      startDate: normalizeDate(newMappingStart),
      endDate: normalizeDate(newMappingEnd),
      isDefault: newMappingIsDefault
    });
    setNewMappingLabel('');
    setNewMappingStart('');
    setNewMappingEnd('');
    setNewMappingIsDefault(false);
  };

  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Month dropdown options with clean labels
  const monthOptions = React.useMemo(() => {
    const opts: { val: string; label: string }[] = [];
    const mappedMonthKeys = new Set<string>();
    
    // Add custom mappings
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

  // Export Full Month Report ZIP (Summary PDF + Details Excel)
  const handlePerformExportZip = async (params: { month: string; startDate?: string; endDate?: string }) => {
    setIsExportingZip(true);
    try {
      await exportMonthlyReportZip({
        ...params,
        transactions,
        monthMappings,
        lang,
        userName: currentUser?.displayName || currentUser?.username || 'Abujar Al-Gifari'
      });
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExportingZip(false);
    }
  };

  // Full month stats for printing
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter(tx => normalizeDate(tx.date).startsWith(currentMonthPrefix));
  const monthInc = monthTransactions.reduce((acc, tx) => tx.type === 'Income' ? acc + (Number(tx.value) || 0) : acc, 0);
  const monthExp = monthTransactions.reduce((acc, tx) => tx.type === 'Expense' ? acc + (Number(tx.value) || 0) : acc, 0);
  const monthNet = monthInc - monthExp;

  // Export full JSON backup
  const handleExportJson = () => {
    const backupData = {
      appName: 'hisab_kitab',
      exportDate: new Date().toISOString(),
      user: currentUser?.username || 'abujar287',
      totalTransactions: transactions.length,
      transactions,
      expenseCategories,
      incomeCategories
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `hisab_kitab_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON file handler
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (onImportJson) {
          onImportJson(parsed);
        }
      } catch (err) {
        alert(lang === 'en' ? 'Invalid JSON file format!' : 'ভুল ফরম্যাটের JSON ফাইল!');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-14 animate-fadeIn">
      {/* 1. USER PROFILE CARD */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-[#475569] flex items-center justify-center font-black text-lg shadow-xs shrink-0">
              {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : <User className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0F172A] leading-tight">
                {currentUser?.displayName || 'Abujar Al-Gifari'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-semibold text-slate-500">
                  @{currentUser?.username || 'abujar287'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {getRoleLabel(currentUser?.role)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenEditProfile}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#475569] text-xs font-bold border border-slate-200 cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t('Edit Profile', 'প্রোফাইল এডিট')}</span>
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#EF4444] border border-rose-200 cursor-pointer active:scale-95 transition-all"
                title={t('Log Out', 'লগআউট')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. CUSTOM MONTH RANGE MAPPING (FINANCIAL PERIODS) IN COMPACT DROPDOWN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
        {/* Dropdown Header Toggle */}
        <button
          type="button"
          onClick={() => setIsMappingDropdownOpen(prev => !prev)}
          className="w-full p-3 sm:p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/80 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-extrabold text-[#0F172A] uppercase tracking-tight">
                  {t('Month Range Mappings', 'মাসিক তারিখ রেঞ্জ ম্যাপিং')}
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  {monthMappings.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                {monthMappings.length > 0 
                  ? monthMappings.map(m => `${m.label} (${m.startDate} ~ ${m.endDate})`).join(', ')
                  : t('Map financial month to custom start & end dates', 'যেকোনো মাসের শুরু ও শেষ তারিখ নির্ধারণ করুন')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="text-[10px] font-bold text-indigo-600 hidden sm:inline">
              {isMappingDropdownOpen ? t('Close', 'বন্ধ করুন') : t('Open Dropdown', 'ড্রপডাউন দেখুন')}
            </span>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-slate-400 transition-transform duration-200 ${isMappingDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`}>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </button>

        {/* Dropdown Body: Active when expanded */}
        {isMappingDropdownOpen && (
          <div className="p-3 sm:p-4 pt-1 border-t border-slate-100 space-y-2.5 animate-fadeIn">
            {/* Quick Dropdown Selector to select/view mapped range */}
            {monthMappings.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('Select Mapped Period', 'ম্যাপিং সিলেক্ট করুন')}
                  </label>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {monthMappings.length} {t('configured', 'টি যুক্ত আছে')}
                  </span>
                </div>
                
                <select
                  value={selectedMappingViewId}
                  onChange={e => {
                    const found = monthMappings.find(m => m.id === e.target.value);
                    if (found) {
                      onSelectMonth(found.label);
                    }
                    setSelectedMappingViewId(e.target.value);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[#0F172A] focus:outline-none focus:border-indigo-400 cursor-pointer shadow-xs"
                >
                  <option value="">{t('-- View Mapped Month Ranges --', '-- ম্যাপিং রেঞ্জ তালিকা --')}</option>
                  {monthMappings.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.startDate} ~ {m.endDate})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Existing Mappings List in Small Font */}
            {monthMappings.length > 0 ? (
              <div className="space-y-1 pt-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t('Saved Mappings', 'সংরক্ষিত ম্যাপিং তালিকা')}
                </span>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                  {monthMappings.map(m => {
                    const isDef = Boolean(m.isDefault || selectedMonth === m.label);
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-colors ${
                          m.isDefault ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-bold text-[#0F172A] shrink-0">
                            {m.label}
                          </span>
                          {m.isDefault && (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              ⭐ {t('Default', 'ডিফল্ট')}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono font-medium truncate">
                            {m.startDate} ~ {m.endDate}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {!m.isDefault && onSetDefaultMonth && (
                            <button
                              type="button"
                              onClick={() => onSetDefaultMonth(m.label)}
                              className="px-1.5 py-0.5 text-[8.5px] font-bold text-amber-700 hover:bg-amber-100 rounded border border-amber-300 cursor-pointer transition-all"
                              title={t('Set as Default Month', 'ডিফল্ট মাস করুন')}
                            >
                              ⭐ {t('Make Default', 'ডিফল্ট করুন')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectMonth(m.label)}
                            className="px-2 py-0.5 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200 cursor-pointer transition-all"
                          >
                            {t('Apply', 'প্রয়োগ')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMonthMapping(m.id)}
                            className="w-5 h-5 flex items-center justify-center text-rose-500 hover:bg-rose-100/80 rounded transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-2 text-center text-[10px] text-slate-400 italic">
                {t('No month range mappings added yet.', 'এখনো কোনো তারিখ রেঞ্জ ম্যাপিং যোগ করা হয়নি।')}
              </div>
            )}

            {/* Toggle to Add New Mapping */}
            <div className="pt-1 border-t border-slate-100">
              {!isAddingMapping ? (
                <button
                  type="button"
                  onClick={() => setIsAddingMapping(true)}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('Add New Mapping Range', 'নতুন রেঞ্জ ম্যাপিং যোগ করুন')}</span>
                </button>
              ) : (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('New Mapping Form', 'নতুন ম্যাপিং ফরম')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingMapping(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                    >
                      {t('Cancel', 'বাতিল')}
                    </button>
                  </div>
                  
                  <div className="space-y-0.5">
                    <label className="text-[8.5px] font-bold text-slate-400 uppercase">
                      {t('Month Label (e.g. Oct-2026)', 'মাসের লেবেল (উদা: Oct-2026)')}
                    </label>
                    <input
                      type="text"
                      value={newMappingLabel}
                      onChange={e => setNewMappingLabel(e.target.value)}
                      placeholder="Oct-2026"
                      className="w-full h-7 bg-white border border-slate-200 rounded-md px-2 text-[11px] font-bold text-[#0F172A] focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[8.5px] font-bold text-slate-400 uppercase">
                        {t('Start Date', 'শুরু তারিখ')}
                      </label>
                      <input
                        type="date"
                        value={newMappingStart}
                        onChange={e => setNewMappingStart(e.target.value)}
                        className="w-full h-7 bg-white border border-slate-200 rounded-md px-1.5 text-[10px] font-bold text-[#0F172A] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8.5px] font-bold text-slate-400 uppercase">
                        {t('End Date', 'শেষ তারিখ')}
                      </label>
                      <input
                        type="date"
                        value={newMappingEnd}
                        onChange={e => setNewMappingEnd(e.target.value)}
                        className="w-full h-7 bg-white border border-slate-200 rounded-md px-1.5 text-[10px] font-bold text-[#0F172A] focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={newMappingIsDefault}
                      onChange={e => setNewMappingIsDefault(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>⭐ {t('Set as Default Month', 'এই মাসটি অ্যাপের ডিফল্ট মাস করুন')}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      handleAddMapping();
                      setIsAddingMapping(false);
                    }}
                    className="w-full py-1.5 bg-[#475569] hover:bg-slate-800 text-white rounded-md text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-98 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('Save Mapping', 'ম্যাপিং সেভ করুন')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. REPORTS & DATA MANAGEMENT */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-[#0F172A] uppercase tracking-tight">
                {t('Reports & Data Backup', 'রিপোর্ট ও ডাটা ব্যাকআপ')}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {t('Export complete statements or backup files', 'সম্পূর্ণ স্টেটমেন্ট বা ডাটা ব্যাকআপ ফাইল ডাউনলোড করুন')}
              </p>
            </div>
          </div>
        </div>

        {/* Full Month ZIP Report Button */}
        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          disabled={isExportingZip}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-sm"
        >
          {isExportingZip ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t('Generating ZIP...', 'জিপ তৈরি হচ্ছে...')}</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>{t('Download Monthly Report (ZIP: PDF + Excel)', 'মাসিক রিপোর্ট ডাউনলোড (ZIP: PDF + Excel)')}</span>
            </>
          )}
        </button>

        {/* JSON Backup & Restore */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleExportJson}
            className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-xs"
          >
            <Download className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="truncate">{t('Export Backup (.json)', 'JSON ব্যাকআপ')}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-xs"
          >
            <Upload className="w-4 h-4 text-[#475569] shrink-0" />
            <span className="truncate">{t('Restore Backup (.json)', 'JSON রিস্টোর')}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>
      </div>

      {/* 4. APP INTEGRATIONS & SHORTCUTS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#475569] flex items-center justify-center border border-slate-200">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-[#0F172A] uppercase tracking-tight">
                {t('App & Integrations', 'অ্যাপ ও ইন্টিগ্রেশন')}
              </h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-xs"
            >
              <Smartphone className="w-4 h-4 text-[#16A34A]" />
              <span>{t('Install App / QR Code', 'অ্যাপ ইনস্টল / QR কোড')}</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAppsScriptModal(true)}
              className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>{t('View Apps Script Code', 'অ্যাপস স্ক্রিপ্ট কোড')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Apps Script Modal */}
      {showAppsScriptModal && (
        <AppsScriptModal
          isOpen={showAppsScriptModal}
          onClose={() => setShowAppsScriptModal(false)}
          lang={lang}
          t={t}
        />
      )}

      {/* Export Month Selection Modal */}
      {showExportModal && (
        <ExportMonthModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handlePerformExportZip}
          currentMonth={selectedMonth}
          monthMappings={monthMappings}
          lang={lang}
          t={t}
        />
      )}

      {/* Printable Full Month Overall Report (Hidden except in print mode) */}
      <div className="hidden print:block printable-container text-slate-900 bg-white p-4">
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
              Hisab Kitab - Full Month Overall Report ({currentMonthPrefix})
            </h1>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              User: @{currentUser?.username || 'user'} ({currentUser?.displayName})
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-semibold">Generated: {new Date().toLocaleDateString()}</p>
            <p>{new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="mb-4">
          <table className="w-full text-xs border border-slate-300">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="p-2 font-bold bg-slate-100 w-1/4">Total Income</td>
                <td className="p-2 font-bold text-emerald-700">+{formatNumberLocale(monthInc, lang)}</td>
                <td className="p-2 font-bold bg-slate-100 w-1/4">Total Expense</td>
                <td className="p-2 font-bold text-rose-700">-{formatNumberLocale(monthExp, lang)}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold bg-slate-100">Net Balance</td>
                <td className="p-2 font-bold text-slate-900">{monthNet >= 0 ? '+' : ''}{formatNumberLocale(monthNet, lang)}</td>
                <td className="p-2 font-bold bg-slate-100">Total Transactions</td>
                <td className="p-2">{monthTransactions.length} records</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <table className="w-full text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-300">
                <th className="p-1.5 text-left">Date / Time</th>
                <th className="p-1.5 text-center">Type</th>
                <th className="p-1.5 text-left">Category</th>
                <th className="p-1.5 text-left">Note</th>
                <th className="p-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {monthTransactions.map(tx => (
                <tr key={tx.id} className="border-b border-slate-200">
                  <td className="p-1.5 text-[10.5px] whitespace-nowrap">{formatCleanDateTime(tx.datetime || tx.date, lang)}</td>
                  <td className="p-1.5 text-center font-semibold">{tx.type}</td>
                  <td className="p-1.5 font-semibold">{cleanCategoryName(tx.category, lang)}</td>
                  <td className="p-1.5 text-slate-700">{tx.note || '—'}</td>
                  <td className={`p-1.5 text-right font-bold ${tx.type === 'Expense' ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {tx.type === 'Expense' ? '-' : '+'}{formatNumberLocale(Math.abs(tx.value), lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
