import { Transaction } from './types';

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [];

export const DEFAULT_INCOME_CATEGORIES: string[] = [];

export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;
export const INCOME_CATEGORIES = DEFAULT_INCOME_CATEGORIES;

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export { GOOGLE_SCRIPT_URL, DIRECT_GOOGLE_SCRIPT_URL } from './utils/sheetApi';
