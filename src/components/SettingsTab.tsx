import React, { useState, useRef } from 'react';
import {
  User,
  Download,
  Upload,
  FileJson,
  LogOut,
  FileSpreadsheet,
  Archive,
  Smartphone
} from 'lucide-react';
import { AppUser, Transaction, TransactionType } from '../types';
import { cleanCategoryName } from '../utils/categoryUtils';
import { normalizeDate, formatNumberLocale, formatCleanDateTime } from '../utils/dateUtils';
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
  onOpenAddCategoryModal,
  onDeleteCategory,
  transactions,
  lang,
  onOpenEditProfile,
  viewMode,
  onLogout,
  onImportJson,
  t,
  onOpenInstallModal,
  onUpdateSpreadsheetId
}) => {
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.username === 'abujar287';
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [categoryTypeTab, setCategoryTypeTab] = useState<TransactionType>('Expense');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeCategories = categoryTypeTab === 'Expense' ? expenseCategories : incomeCategories;

  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Export Full Month Report ZIP (Summary PDF + Details Excel)
  const handlePerformExportZip = async (targetMonth: string) => {
    setIsExportingZip(true);
    try {
      await exportMonthlyReportZip({
        month: targetMonth,
        transactions,
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
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* INSTALL APP CARD */}
      {onOpenInstallModal && (
        <div className="bg-white rounded-2xl p-4 border border-emerald-500/30 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-tight">
                  {t('Install HisabKitab App', 'হিসাব কিতাব অ্যাপ ইনস্টল করুন')}
                </h3>
                <p className="text-[10px] text-slate-500">
                  {t('Install on your phone or desktop for quick access', 'ফোন বা কম্পিউটারে অ্যাপটি ইনস্টল করে নিন')}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="w-full py-2.5 bg-[#16A34A] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-sm"
          >
            <Smartphone className="w-4 h-4" />
            <span>{t('Install App / Show QR Code', 'অ্যাপ ইনস্টল করুন / QR কোড দেখুন')}</span>
          </button>
        </div>
      )}



      {/* GOOGLE APPS SCRIPT INTEGRATION */}
      {isAdmin && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#475569] flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-tight">
                  {t('Apps Script', 'অ্যাপস স্ক্রিপ্ট')}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAppsScriptModal(true)}
              className="px-2.5 py-1 rounded-lg bg-[#475569] hover:bg-slate-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{t('View Code', 'কোড দেখুন')}</span>
            </button>
          </div>
        </div>
      )}

      {/* FULL MONTH ZIP REPORT (PDF + EXCEL) SECTION */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-tight">
                {t('Monthly Report (ZIP: PDF + Excel)', 'মাসিক রিপোর্ট (ZIP: PDF + Excel)')}
              </h3>
              <p className="text-[10px] text-slate-500">
                {t('Summary PDF statement & detailed Excel spreadsheet', 'সারাংশ PDF ফাইল ও বিস্তারিত Excel ডেটা ফাইলের জিপ')}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          disabled={isExportingZip}
          className="w-full py-2.5 bg-[#475569] hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-sm"
        >
          {isExportingZip ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{t('Generating ZIP (PDF + Excel)...', 'জিপ তৈরি হচ্ছে (PDF + Excel)...')}</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>{t('Print & Export Full Month Report (ZIP)', 'পূর্ণাঙ্গ মাসিক রিপোর্ট এক্সপোর্ট (ZIP: PDF + Excel)')}</span>
            </>
          )}
        </button>
      </div>

      {/* PROFILE CARD */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#475569] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-tight">
              {t('Profile', 'প্রোফাইল')}
            </h3>
          </div>

          <button
            type="button"
            onClick={onOpenEditProfile}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#475569] text-[10px] font-bold border border-slate-200 cursor-pointer active:scale-95"
          >
            {t('Edit', 'এডিট')}
          </button>
        </div>

        {currentUser && (
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">{t('Name', 'নাম')}</span>
              <span className="font-bold text-[#0F172A]">{currentUser.displayName}</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">{t('User', 'ইউজার')}</span>
              <span className="font-bold text-[#475569]">@{currentUser.username}</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 col-span-2">
              <span className="text-slate-500 block mb-0.5">{t('Role', 'রোল')}</span>
              <span className="font-bold text-[#0F172A]">{getRoleLabel(currentUser.role)}</span>
            </div>
          </div>
        )}
      </div>


      {/* JSON DATA BACKUP & RESTORE */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-tight">
                {t('JSON Data Management', 'JSON ডাটা ব্যাকআপ ও ইম্পোর্ট')}
              </h3>
              <p className="text-[9.5px] text-slate-500">
                {t('Export or import complete transactions backup (.json)', 'সম্পূর্ণ হিসাব ও ক্যাটাগরির JSON ফাইল এক্সপোর্ট বা ইম্পোর্ট করুন')}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Export JSON Button */}
          <button
            type="button"
            onClick={handleExportJson}
            className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-[#0F172A] rounded-xl text-[11px] font-bold border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm group"
          >
            <Download className="w-4 h-4 text-sky-600 group-hover:translate-y-0.5 transition-transform shrink-0" />
            <span className="truncate">{t('Export JSON', 'JSON এক্সপোর্ট')}</span>
          </button>

          {/* Import JSON Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-[#0F172A] rounded-xl text-[11px] font-bold border border-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm group"
          >
            <Upload className="w-4 h-4 text-[#475569] group-hover:-translate-y-0.5 transition-transform shrink-0" />
            <span className="truncate">{t('Import JSON', 'JSON ইম্পোর্ট')}</span>
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

      {/* LOGOUT */}
      {onLogout && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-[#EF4444] rounded-xl text-[11px] font-bold border border-rose-200 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('Log Out', 'লগআউট করুন')}</span>
          </button>
        </div>
      )}

      {/* Apps Script Modal */}
      <AppsScriptModal
        isOpen={showAppsScriptModal}
        onClose={() => setShowAppsScriptModal(false)}
        lang={lang}
        t={t}
      />

      {/* Export Month Selection Modal */}
      <ExportMonthModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handlePerformExportZip}
        currentMonth={selectedMonth}
        lang={lang}
        t={t}
      />

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
                <td className="p-2  font-bold text-emerald-700">+{formatNumberLocale(monthInc, lang)}</td>
                <td className="p-2 font-bold bg-slate-100 w-1/4">Total Expense</td>
                <td className="p-2  font-bold text-rose-700">-{formatNumberLocale(monthExp, lang)}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold bg-slate-100">Net Balance</td>
                <td className="p-2  font-bold text-slate-900">{monthNet >= 0 ? '+' : ''}{formatNumberLocale(monthNet, lang)}</td>
                <td className="p-2 font-bold bg-slate-100">Total Transactions</td>
                <td className="p-2 ">{monthTransactions.length} records</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <table className="w-full text-xs border border-slate-300 ">
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
                  <td className="p-1.5 text-[10.5px]  whitespace-nowrap">{formatCleanDateTime(tx.datetime || tx.date, lang)}</td>
                  <td className="p-1.5 text-center font-semibold">{tx.type}</td>
                  <td className="p-1.5 font-semibold">{cleanCategoryName(tx.category, lang)}</td>
                  <td className="p-1.5 text-slate-700">{tx.note || '—'}</td>
                  <td className={`p-1.5 text-right  font-bold ${tx.type === 'Expense' ? 'text-rose-700' : 'text-emerald-700'}`}>
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
