export type TransactionType = 'Expense' | 'Income';

export type UserRole = 'super_admin' | 'super_admin_2' | 'senior_member' | 'member' | 'admin';

export type AppTab = 'summary' | 'entry' | 'details' | 'budget' | 'users' | 'settings';

export interface Transaction {
  id: string;
  rowNumber?: number;
  datetime?: string;
  type: TransactionType;
  category: string;
  date: string; // YYYY-MM-DD
  value: number;
  note?: string;
}

export interface DaySummary {
  day: number;
  dateStr: string;
  dayOfWeek: string;
  exp: number;
  inc: number;
  net: number;
  count: number;
  hasActivity: boolean;
}

export interface AppUser {
  username: string;
  password: string;
  displayName: string;
  sheetTab: string;
  initialUsername: string;
  createdAt: string;
  needsSetup?: boolean;
  role?: UserRole;
  isActive?: boolean;
  allowedTabs?: AppTab[];
  isReadOnly?: boolean;
  viewTargetTab?: string;
  googleId?: string;
  googleEmail?: string;
  spreadsheetId?: string;
}

export interface MonthMapping {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // e.g., "Oct-2026"
}
