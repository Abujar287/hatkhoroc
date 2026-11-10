import { Transaction } from './types';

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Personal',
  'WiFi & Internet',
  'Others Expense',
  'Medicines',
  'Room Rent',
  "Family's Cost",
  'Official',
  'Electricity',
  'Shopping'
];

export const DEFAULT_INCOME_CATEGORIES: string[] = [
  'Borrowed Money',
  'Others Income',
  'Salary',
  'Previous Month Arrears'
];

export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;
export const INCOME_CATEGORIES = DEFAULT_INCOME_CATEGORIES;

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const GOOGLE_SCRIPT_URL =
  import.meta.env.VITE_GOOGLE_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwdR3oDJiUFWFopvUeLI-8r92-9uS-jRUdRKFW3CghmmIy84sQZjNEeEkY6yboG8g4z/exec';
