import { Transaction } from './types';

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  '💰 Savings (সঞ্চয়)',
  '🍳 Breakfast (সকালের নাস্তা)',
  '☕ Tea & Snacks (চা ও নাস্তা)',
  '🛒 Bajar (বাজার)',
  '🍽️ Food (খাবার)',
  '🍳 Cooking Ingredients (রান্নার বাজার)',
  '🚌 Transport & Fare (যাতায়াত ও ভাড়া)',
  '🏍️ Travel & Fuel (ভ্রমণ ও জ্বালানি)',
  '📱 Mobile Recharge (মোবাইল রিচার্জ)',
  '📶 WiFi & Internet (ওয়াইফাই ও ইন্টারনেট)',
  '⚡ Electricity (বিদ্যুৎ বিল)',
  '💧 Water Bill (পানি বিল)',
  '🗑️ Garbage/Service (ময়লা বিল)',
  '💊 Medicine (ঔষধ)',
  '🏥 Doctor & Medical (ডাক্তার ও চিকিৎসা)',
  '🏠 Room Rent (রুম ভাড়া)',
  '🛋️ Room Accessories (সামগ্রী)',
  '👨‍👩‍👧 Family\'s Cost (পারিবারিক খরচ)',
  '👥 Relatives (আত্মীয়-স্বজন)',
  '💑 Mr & Mrs (দাম্পত্য খরচ)',
  '🌙 Eid & Festivals (ঈদ ও উৎসব)',
  '🐦 Birds & Pets (পাখি ও পোষাপ্রাণী)',
  '💻 Official (অফিস খরচ)',
  '🍍 Fruits (ফল)',
  '🛍️ Shopping (কেনাকাটা)',
  '👕 Laundry & Iron (লন্ড্রি ও ইস্ত্রি)',
  '💇 Haircut & Salon (হেয়ারকাট ও পার্লার)',
  '📚 Books & Stationery (বই ও স্টেশনারি)',
  '🎁 Gift & Donation (উপহার ও দান)',
  '🔧 Maintenance & Repair (মেরামত)',
  '🤝 ধার দিয়েছি (Lent Out)',
  '💳 ধার শোধ (Loan Repaid)',
  '👤 Personal (পার্সোনাল)',
  '🏷️ Others (অন্যান্য)'
];

export const DEFAULT_INCOME_CATEGORIES: string[] = [
  '💰 Salary (বেতন)',
  '📈 Arrear (বকেয়া)',
  '🤝 Borrowed Money (ধার নেওয়া)',
  '💼 Business (ব্যবসা)',
  '🎁 Bonus (বোনাস)',
  '🏷️ Other Income (অন্যান্য আয়)',
];

export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;
export const INCOME_CATEGORIES = DEFAULT_INCOME_CATEGORIES;

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const GOOGLE_SCRIPT_URL =
  import.meta.env.VITE_GOOGLE_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwdR3oDJiUFWFopvUeLI-8r92-9uS-jRUdRKFW3CghmmIy84sQZjNEeEkY6yboG8g4z/exec';

