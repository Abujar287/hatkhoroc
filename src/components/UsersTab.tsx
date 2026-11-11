import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Search, 
  Shield, 
  Layers,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { AppUser } from '../types';

interface UsersTabProps {
  currentUser: AppUser | null;
  users: AppUser[];
  onOpenCreateUserModal: () => void;
  onOpenEditUserModal: (user: AppUser) => void;
  onRequestDeleteUser: (user: AppUser) => void;
  onToggleActiveUser: (user: AppUser) => void;
  syncStatus?: { loading: boolean; error: string | null; lastSuccess: string | null };
  onManualSync?: () => void;
  t: (en: string, bn: string) => string;
}

export const UsersTab: React.FC<UsersTabProps> = ({
  currentUser,
  users,
  onOpenCreateUserModal,
  onOpenEditUserModal,
  onRequestDeleteUser,
  onToggleActiveUser,
  syncStatus,
  t
}) => {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const togglePasswordVisibility = (username: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-950/70 border border-purple-700/60 text-purple-200 text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
            <Shield className="w-2.5 h-2.5 text-purple-400" />
            Super Admin
          </span>
        );
      case 'super_admin_2':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/70 border border-blue-700/60 text-blue-200 text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
            Viewer
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-700/60 text-amber-200 text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
            Admin
          </span>
        );
      case 'senior_member':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-700/60 text-cyan-200 text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
            Sr Member
          </span>
        );
      case 'member':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-900/70 border border-teal-700/60 text-teal-200 text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
            Member
          </span>
        );
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const q = searchTerm.toLowerCase().trim();
    return users.filter(u => 
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.sheetTab && u.sheetTab.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }, [users, searchTerm]);

  const totalRecords = useMemo(() => {
    return filteredUsers.reduce((sum, u) => sum + (u.recordCount || 0), 0);
  }, [filteredUsers]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 pb-16 animate-fadeIn px-1 sm:px-2">
      {/* Top Card Container */}
      <div className="bg-[#0B3C39] rounded-2xl border border-teal-800/80 shadow-md overflow-hidden">
        
        {/* Header Bar */}
        <div className="p-3 sm:p-4 border-b border-teal-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-900/80 text-emerald-400 flex items-center justify-center border border-teal-700/80 shadow-inner shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-[#F0FDFA] tracking-tight">
                    {t('Users Management', 'ইউজার তালিকা')}
                  </h2>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 text-[10px] font-bold">
                    {users.length} {t('Users', 'জন')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-teal-950/90 text-teal-300 border border-teal-700/60 text-[10px] font-black font-mono shadow-xs">
                    {totalRecords} {t('total records', 'মোট রেকর্ডস')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-teal-300/80">
                  <span>Google Sheet abujar287 (AL:AQ)</span>
                  {syncStatus?.lastSuccess && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400 font-mono">
                        {t('Auto Synced:', 'অটো সিঙ্ক:')} {syncStatus.lastSuccess}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Search bar on left, Add User button on right in the same row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-teal-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('Search by name, username, or sheet tab...', 'নাম, ইউজারনেম বা শিট ট্যাব দিয়ে খুঁজুন...')}
                className="w-full pl-8 pr-3 py-1.5 bg-[#062423] border border-teal-700/60 rounded-lg text-xs text-[#F0FDFA] placeholder:text-teal-600 focus:outline-none focus:border-teal-400 font-medium"
              />
              {searchTerm && (
                <button 
                  type="button" 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-teal-400 hover:text-white text-[11px]"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenCreateUserModal}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">{t('Add User', 'নতুন ইউজার')}</span>
            </button>
          </div>
        </div>

        {/* DATA TABLE (Compact: Full Name | username | records | password | sheet tab name | role | access tab | edit | remove) */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px] select-text">
            <thead>
              <tr className="bg-[#062423] text-teal-300/90 border-b border-teal-800/80">
                <th scope="col" className="py-2.5 px-3 text-[10px] font-black uppercase tracking-wider">
                  Full Name
                </th>
                <th scope="col" className="py-2.5 px-2.5 text-[10px] font-black uppercase tracking-wider">
                  username
                </th>
                <th scope="col" className="py-2.5 px-2.5 text-[10px] font-black uppercase tracking-wider">
                  records
                </th>
                <th scope="col" className="py-2.5 px-2.5 text-[10px] font-black uppercase tracking-wider">
                  password
                </th>
                <th scope="col" className="py-2.5 px-2.5 text-[10px] font-black uppercase tracking-wider">
                  sheet tab name
                </th>
                <th scope="col" className="py-2.5 px-2.5 text-[10px] font-black uppercase tracking-wider">
                  role
                </th>
                <th scope="col" className="py-2.5 px-2.5 text-[10px] font-black uppercase tracking-wider">
                  access tab
                </th>
                <th scope="col" className="py-2.5 px-1.5 text-[10px] font-black uppercase tracking-wider text-center w-10">
                  edit
                </th>
                <th scope="col" className="py-2.5 px-1.5 text-[10px] font-black uppercase tracking-wider text-center w-10">
                  remove
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-800/40 text-xs text-[#F0FDFA]">
              {filteredUsers.map(u => {
                const isCurrent = currentUser?.username === u.username;
                const isMainAdmin = u.username === 'abujar287';
                const isPassVisible = visiblePasswords[u.username] ?? false;
                const displayPass = String(u.password ?? '');

                // Format access tabs as a clean comma-separated string
                const accessTabString = (u.allowedTabs && u.allowedTabs.length > 0)
                  ? u.allowedTabs.join(', ')
                  : 'summary, entry, details, budget, task, settings';

                const recordVal = u.recordCount ?? 0;

                return (
                  <tr 
                    key={u.username}
                    className={`transition-colors hover:bg-teal-900/30 ${
                      isCurrent ? 'bg-teal-900/20' : ''
                    }`}
                  >
                    {/* 1. Full Name (Compact Font & Spacing) */}
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-800 to-slate-900 border border-teal-700/80 flex items-center justify-center font-bold text-xs text-emerald-300 shrink-0 shadow-xs">
                          {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-bold text-[#F0FDFA] text-xs tracking-tight truncate">
                              {u.displayName || u.username}
                            </span>
                            {isCurrent && (
                              <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-950 text-emerald-400 border border-emerald-800/70">
                                {t('YOU', 'আপনি')}
                              </span>
                            )}
                          </div>
                          
                          {/* Active Status Indicator */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onToggleActiveUser(u)}
                              disabled={isMainAdmin}
                              className={`inline-flex items-center gap-1 text-[9px] font-semibold ${
                                u.isActive !== false 
                                  ? 'text-emerald-400/90 hover:text-emerald-300' 
                                  : 'text-rose-400/90 hover:text-rose-300'
                              } ${isMainAdmin ? 'cursor-default' : 'cursor-pointer hover:underline'}`}
                              title={isMainAdmin ? 'Super Admin cannot be deactivated' : 'Click to toggle Active / Inactive'}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.isActive !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              <span>{u.isActive !== false ? t('Active', 'সক্রিয়') : t('Inactive', 'নিষ্ক্রিয়')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. username + Record Count Badge */}
                    <td className="py-1.5 px-2.5 font-mono font-bold text-[11px] sm:text-xs text-emerald-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>@{u.username}</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono text-[9px] font-extrabold shadow-xs">
                          ({recordVal} {t('records', 'রেকর্ডস')})
                        </span>
                      </div>
                    </td>

                    {/* 3. records count column */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono text-[11px] font-black shadow-xs">
                        <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{recordVal} {t('records', 'রেকর্ডস')}</span>
                      </span>
                    </td>

                    {/* 4. password (Compact Box with Eye Toggle) */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 bg-[#062423] border border-teal-700/60 px-2 py-0.5 rounded-lg font-mono text-[11px]">
                        <span className={`tracking-wider ${isPassVisible ? 'text-[#F0FDFA] font-bold select-all' : 'text-teal-400 font-extrabold select-none'}`}>
                          {isPassVisible ? displayPass : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(u.username)}
                          className="text-teal-400 hover:text-white p-0.5 cursor-pointer transition-colors"
                          title={isPassVisible ? 'Hide password' : 'Show password'}
                        >
                          {isPassVisible ? <EyeOff className="w-3 h-3 text-teal-300" /> : <Eye className="w-3 h-3 text-teal-400" />}
                        </button>
                      </div>
                    </td>

                    {/* 5. sheet tab name (Compact Pill) */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-800/60 text-amber-300 font-mono text-[11px] font-bold shadow-xs">
                        <FileSpreadsheet className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        <span className="truncate max-w-[110px]">{u.sheetTab || u.username}</span>
                      </span>
                    </td>

                    {/* 6. role (Compact Badge) */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      {getRoleBadge(u.role)}
                    </td>

                    {/* 7. access tab (Comma-separated text on single line without breaks) */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <span className="text-[10px] sm:text-[11px] font-mono text-teal-200/90 whitespace-nowrap">
                        {accessTabString}
                      </span>
                    </td>

                    {/* 8. edit (Icon Button Only - No text label) */}
                    <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenEditUserModal(u)}
                        className="w-7 h-7 mx-auto rounded-lg bg-teal-800/70 hover:bg-emerald-600 text-teal-200 hover:text-white border border-teal-700/60 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
                        title={t('Edit user details', 'ইউজার তথ্য এডিট')}
                        aria-label="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-emerald-300 hover:text-white" />
                      </button>
                    </td>

                    {/* 9. remove (Icon Button Only - No text label) */}
                    <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                      {isMainAdmin ? (
                        <span className="inline-block text-[8px] font-bold text-teal-600 bg-teal-950/40 px-1 py-0.5 rounded border border-teal-900/60 select-none">
                          Main
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRequestDeleteUser(u)}
                          className="w-7 h-7 mx-auto rounded-lg bg-rose-950/50 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-800/60 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
                          title={t('Remove user', 'ইউজার মুছুন')}
                          aria-label="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <div className="py-12 text-center space-y-2">
            <Users className="w-10 h-10 text-teal-800/40 mx-auto" />
            <p className="text-teal-400/70 text-xs font-semibold">
              {searchTerm 
                ? t('No users match your search query.', 'এই নামে কোনো ইউজার পাওয়া যায়নি।') 
                : t('No registered users found.', 'কোনো রেজিস্টার্ড ইউজার পাওয়া যায়নি।')}
            </p>
          </div>
        )}

        {/* Table Footer Summary */}
        <div className="p-2.5 sm:p-3 bg-[#062423] border-t border-teal-800/80 flex items-center justify-between flex-wrap gap-2 text-[10px] text-teal-300/80">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>
                {t('Total Accounts:', 'মোট অ্যাকাউন্ট:')} <strong className="text-white">{filteredUsers.length}</strong>
              </span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-emerald-400" />
              <span>
                {t('Total Synced Records:', 'মোট সিঙ্ক হওয়া এন্ট্রি রেকর্ড:')} <strong className="text-emerald-300 font-mono font-bold">{totalRecords}</strong>
              </span>
            </div>
          </div>
          <div className="font-mono text-teal-400/70">
            Sheet Range: abujar287!AL:AQ
          </div>
        </div>

      </div>
    </div>
  );
};
