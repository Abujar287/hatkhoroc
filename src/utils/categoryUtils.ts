// Category helpers & realistic daily-life icon pack mapping.

export type DailyIconId =
  | 'home_rent'
  | 'wifi'
  | 'electricity'
  | 'gas_cooking'
  | 'water'
  | 'grocery'
  | 'food_meal'
  | 'tea_coffee'
  | 'medicine'
  | 'doctor_health'
  | 'transport_bus'
  | 'car_ride'
  | 'fuel_bike'
  | 'mobile'
  | 'shopping'
  | 'family'
  | 'personal'
  | 'office'
  | 'education'
  | 'salary'
  | 'bank_savings'
  | 'borrowed'
  | 'arrears'
  | 'gift'
  | 'repair'
  | 'laundry'
  | 'salon'
  | 'fitness'
  | 'travel'
  | 'entertainment'
  | 'wallet_cash'
  | 'other';

export interface DailyIconMeta {
  id: DailyIconId;
  label: string;
  emoji: string;
  colorClass: string;
  textClass: string;
  bgClass: string;
  keywords: string[];
}

export const DAILY_LIFE_ICON_PACK: DailyIconMeta[] = [
  {
    id: 'home_rent',
    label: 'Home / Rent',
    emoji: '🏠',
    colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    textClass: 'text-amber-300',
    bgClass: 'bg-amber-500/20 border-amber-500/40',
    keywords: ['rent', 'room', 'house', 'flat', 'apartment', 'vara', 'basha', 'বাসা', 'ভাড়া']
  },
  {
    id: 'wifi',
    label: 'WiFi / Net',
    emoji: '📶',
    colorClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    textClass: 'text-cyan-300',
    bgClass: 'bg-cyan-500/20 border-cyan-500/40',
    keywords: ['wifi', 'internet', 'broadband', 'net', 'data', 'mb', 'ওয়াইফাই', 'ইন্টারনেট']
  },
  {
    id: 'electricity',
    label: 'Electricity',
    emoji: '⚡',
    colorClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    textClass: 'text-yellow-300',
    bgClass: 'bg-yellow-500/20 border-yellow-500/40',
    keywords: ['electric', 'electricity', 'power', 'current', 'desco', 'dpdc', 'nesco', 'biddut', 'বিদ্যুৎ', 'কারেন্ট']
  },
  {
    id: 'gas_cooking',
    label: 'Gas / Fuel',
    emoji: '🔥',
    colorClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    textClass: 'text-orange-300',
    bgClass: 'bg-orange-500/20 border-orange-500/40',
    keywords: ['gas', 'cylinder', 'lpg', 'stove', 'cooking', 'titas', 'গ্যাস', 'সিলিন্ডার']
  },
  {
    id: 'water',
    label: 'Water Bill',
    emoji: '💧',
    colorClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    textClass: 'text-sky-300',
    bgClass: 'bg-sky-500/20 border-sky-500/40',
    keywords: ['water', 'wasa', 'drink', 'pani', 'পানি', 'জল']
  },
  {
    id: 'grocery',
    label: 'Grocery / Bajar',
    emoji: '🛒',
    colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    textClass: 'text-emerald-300',
    bgClass: 'bg-emerald-500/20 border-emerald-500/40',
    keywords: ['grocery', 'bajar', 'bazar', 'market', 'vegetable', 'rice', 'fish', 'meat', 'super', 'বাজার', 'মুদি']
  },
  {
    id: 'food_meal',
    label: 'Food / Meal',
    emoji: '🍽️',
    colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    textClass: 'text-rose-300',
    bgClass: 'bg-rose-500/20 border-rose-500/40',
    keywords: ['food', 'meal', 'lunch', 'dinner', 'breakfast', 'eat', 'restaurant', 'hotel', 'khawa', 'khabar', 'খাবার', 'হোটেল']
  },
  {
    id: 'tea_coffee',
    label: 'Tea / Snacks',
    emoji: '☕',
    colorClass: 'bg-amber-600/20 text-amber-200 border-amber-500/40',
    textClass: 'text-amber-200',
    bgClass: 'bg-amber-600/20 border-amber-500/40',
    keywords: ['tea', 'coffee', 'snack', 'nasta', 'cha', 'cafe', 'চা', 'নাস্তা', 'কফি']
  },
  {
    id: 'medicine',
    label: 'Medicines',
    emoji: '💊',
    colorClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    textClass: 'text-red-300',
    bgClass: 'bg-red-500/20 border-red-500/40',
    keywords: ['medicine', 'medicines', 'med', 'pharmacy', 'drug', 'tablet', 'oshudh', 'oushod', 'ওষুধ', 'ঔষধ']
  },
  {
    id: 'doctor_health',
    label: 'Doctor / Clinic',
    emoji: '🩺',
    colorClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    textClass: 'text-pink-300',
    bgClass: 'bg-pink-500/20 border-pink-500/40',
    keywords: ['doctor', 'hospital', 'clinic', 'health', 'medical', 'test', 'checkup', 'ডাক্তার', 'চিকিৎসা', 'হাসপাতাল']
  },
  {
    id: 'transport_bus',
    label: 'Bus / Commute',
    emoji: '🚌',
    colorClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    textClass: 'text-blue-300',
    bgClass: 'bg-blue-500/20 border-blue-500/40',
    keywords: ['transport', 'bus', 'rickshaw', 'train', 'metro', 'commute', 'fare', 'jatayat', 'যাতায়াত', 'ভাড়া', 'বাস']
  },
  {
    id: 'car_ride',
    label: 'Car / Ride',
    emoji: '🚕',
    colorClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    textClass: 'text-indigo-300',
    bgClass: 'bg-indigo-500/20 border-indigo-500/40',
    keywords: ['car', 'taxi', 'uber', 'pathao', 'cng', 'auto', 'ride', 'cab', 'গাড়ি', 'উবার']
  },
  {
    id: 'fuel_bike',
    label: 'Fuel / Bike',
    emoji: '⛽',
    colorClass: 'bg-orange-600/20 text-orange-300 border-orange-500/40',
    textClass: 'text-orange-300',
    bgClass: 'bg-orange-600/20 border-orange-500/40',
    keywords: ['fuel', 'petrol', 'octane', 'diesel', 'oil', 'bike', 'motorcycle', 'তেল', 'পেট্রোল', 'বাইক']
  },
  {
    id: 'mobile',
    label: 'Mobile / Recharge',
    emoji: '📱',
    colorClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    textClass: 'text-teal-300',
    bgClass: 'bg-teal-500/20 border-teal-500/40',
    keywords: ['mobile', 'phone', 'recharge', 'sim', 'flexiload', 'bkash', 'call', 'মোবাইল', 'রিচার্জ']
  },
  {
    id: 'shopping',
    label: 'Shopping',
    emoji: '🛍️',
    colorClass: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
    textClass: 'text-fuchsia-300',
    bgClass: 'bg-fuchsia-500/20 border-fuchsia-500/40',
    keywords: ['shopping', 'shop', 'buy', 'mall', 'dress', 'shoe', 'watch', 'kenakata', 'শপিং', 'কেনাকাটা']
  },
  {
    id: 'family',
    label: 'Family Cost',
    emoji: '👨‍👩‍👧',
    colorClass: 'bg-rose-500/20 text-[#FF7A59] border-[#FF7A59]/40',
    textClass: 'text-[#FF7A59]',
    bgClass: 'bg-rose-500/20 border-[#FF7A59]/40',
    keywords: ['family', 'home', 'parents', 'mother', 'father', 'wife', 'bou', 'mrs', 'relatives', 'relative', 'abujar', 'baby', 'bari', 'পরিবার', 'বাড়ি', 'মা', 'বাবা']
  },
  {
    id: 'personal',
    label: 'Personal',
    emoji: '👤',
    colorClass: 'bg-teal-500/20 text-teal-200 border-teal-500/40',
    textClass: 'text-teal-200',
    bgClass: 'bg-teal-500/20 border-teal-500/40',
    keywords: ['personal', 'self', 'own', 'pocket', 'ব্যক্তিগত', 'নিজের']
  },
  {
    id: 'office',
    label: 'Official / Work',
    emoji: '💼',
    colorClass: 'bg-slate-400/20 text-slate-200 border-slate-400/40',
    textClass: 'text-slate-200',
    bgClass: 'bg-slate-400/20 border-slate-400/40',
    keywords: ['official', 'office', 'work', 'business', 'job', 'client', 'অফিস', 'অফিশিয়াল', 'কাজ']
  },
  {
    id: 'education',
    label: 'Education',
    emoji: '🎓',
    colorClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    textClass: 'text-indigo-300',
    bgClass: 'bg-indigo-500/20 border-indigo-500/40',
    keywords: ['education', 'book', 'books', 'tuition', 'school', 'college', 'course', 'exam', 'fee', 'বই', 'পড়াশোনা', 'বেতন']
  },
  {
    id: 'salary',
    label: 'Salary / Income',
    emoji: '💵',
    colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    textClass: 'text-emerald-300',
    bgClass: 'bg-emerald-500/20 border-emerald-500/40',
    keywords: ['salary', 'wage', 'pay', 'income', 'bonus', 'freelance', 'earning', 'বেতন', 'আয়', 'বোনাস']
  },
  {
    id: 'bank_savings',
    label: 'Bank / Savings',
    emoji: '🏦',
    colorClass: 'bg-green-500/20 text-green-300 border-green-500/40',
    textClass: 'text-green-300',
    bgClass: 'bg-green-500/20 border-green-500/40',
    keywords: ['bank', 'saving', 'savings', 'dps', 'deposit', 'profit', 'ব্যাংক', 'সঞ্চয়', 'জমা']
  },
  {
    id: 'borrowed',
    label: 'Borrowed / Loan',
    emoji: '🤝',
    colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    textClass: 'text-amber-300',
    bgClass: 'bg-amber-500/20 border-amber-500/40',
    keywords: ['borrow', 'borrowed', 'loan', 'debt', 'lend', 'emi', 'dhar', 'rin', 'ধার', 'ঋণ', 'কিস্তি']
  },
  {
    id: 'arrears',
    label: 'Arrears / Due',
    emoji: '📅',
    colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    textClass: 'text-purple-300',
    bgClass: 'bg-purple-500/20 border-purple-500/40',
    keywords: ['arrears', 'previous', 'due', 'balance', 'carry', 'bokeya', 'বকেয়া', 'আগের']
  },
  {
    id: 'gift',
    label: 'Gift / Charity',
    emoji: '🎁',
    colorClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    textClass: 'text-pink-300',
    bgClass: 'bg-pink-500/20 border-pink-500/40',
    keywords: ['gift', 'charity', 'donate', 'zakat', 'sadaka', 'eid', 'present', 'উপহার', 'দান']
  },
  {
    id: 'repair',
    label: 'Repair / Service',
    emoji: '🔧',
    colorClass: 'bg-zinc-400/20 text-zinc-200 border-zinc-400/40',
    textClass: 'text-zinc-200',
    bgClass: 'bg-zinc-400/20 border-zinc-400/40',
    keywords: ['repair', 'fix', 'service', 'maintenance', 'mechanic', 'plumber', 'মেরামত', 'সার্ভিস']
  },
  {
    id: 'laundry',
    label: 'Clothes / Laundry',
    emoji: '👕',
    colorClass: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
    textClass: 'text-sky-200',
    bgClass: 'bg-sky-500/20 border-sky-500/40',
    keywords: ['laundry', 'wash', 'iron', 'cloth', 'clothes', 'shirt', 'pant', 'tailor', 'কাপড়', 'লন্ড্রি']
  },
  {
    id: 'salon',
    label: 'Salon / Care',
    emoji: '✂️',
    colorClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    textClass: 'text-violet-300',
    bgClass: 'bg-violet-500/20 border-violet-500/40',
    keywords: ['salon', 'hair', 'haircut', 'barber', 'grooming', 'beauty', 'cosmetic', 'সেলুন', 'চুল']
  },
  {
    id: 'fitness',
    label: 'Gym / Sports',
    emoji: '🏋️',
    colorClass: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
    textClass: 'text-lime-300',
    bgClass: 'bg-lime-500/20 border-lime-500/40',
    keywords: ['gym', 'fitness', 'workout', 'sport', 'cricket', 'football', 'জিম', 'খেলা']
  },
  {
    id: 'travel',
    label: 'Travel / Trip',
    emoji: '✈️',
    colorClass: 'bg-blue-500/20 text-sky-300 border-sky-500/40',
    textClass: 'text-sky-300',
    bgClass: 'bg-blue-500/20 border-sky-500/40',
    keywords: ['travel', 'trip', 'tour', 'ticket', 'flight', 'vacation', 'ভ্রমণ', 'টিকিট', 'ট্যুর']
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    emoji: '📺',
    colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    textClass: 'text-purple-300',
    bgClass: 'bg-purple-500/20 border-purple-500/40',
    keywords: ['movie', 'cinema', 'netflix', 'youtube', 'game', 'sub', 'tv', 'বিনোদন', 'সিনেমা']
  },
  {
    id: 'wallet_cash',
    label: 'Cash / Expenses',
    emoji: '👛',
    colorClass: 'bg-emerald-500/20 text-teal-200 border-teal-500/40',
    textClass: 'text-teal-200',
    bgClass: 'bg-emerald-500/20 border-teal-500/40',
    keywords: ['cash', 'wallet', 'pocket', 'hand', 'spend', 'খরচ', 'নগদ']
  },
  {
    id: 'other',
    label: 'Other / General',
    emoji: '🏷️',
    colorClass: 'bg-teal-500/20 text-teal-300 border-teal-600/50',
    textClass: 'text-teal-300',
    bgClass: 'bg-teal-500/20 border-teal-600/50',
    keywords: ['other', 'others', 'misc', 'general', 'extra', 'অন্যান্য']
  }
];

const CATEGORY_ICONS_STORAGE_KEY = 'app_category_icons_v1';

export function cleanCategoryName(cat: string, _targetLang: 'en' | 'bn' = 'en'): string {
  if (!cat) return '';
  let cleaned = String(cat).trim();

  // Strip trailing redundant type suffixes like "- Expense", "(Expense)", "- Income", "(Income)" if present
  cleaned = cleaned.replace(/\s*[-:(]\s*(?:expense|income|খরচ|ব্যয়|আয়)\s*\)?$/gi, '').trim();

  return cleaned;
}

export function getSavedCategoryIcons(): Record<string, DailyIconId> {
  try {
    const raw = localStorage.getItem(CATEGORY_ICONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

export function saveCategoryIcon(catName: string, iconId: DailyIconId): void {
  const clean = cleanCategoryName(catName, 'en').toLowerCase();
  if (!clean) return;
  try {
    const map = getSavedCategoryIcons();
    map[clean] = iconId;
    localStorage.setItem(CATEGORY_ICONS_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function getIconMetaById(iconId: DailyIconId): DailyIconMeta {
  return DAILY_LIFE_ICON_PACK.find(item => item.id === iconId) || DAILY_LIFE_ICON_PACK[DAILY_LIFE_ICON_PACK.length - 1];
}

export function resolveCategoryIconId(catName: string): DailyIconId {
  if (!catName) return 'other';
  const clean = cleanCategoryName(catName, 'en').toLowerCase().trim();

  // 1. User-selected custom icon mapping
  const saved = getSavedCategoryIcons();
  if (saved[clean]) return saved[clean];
  const rawLower = String(catName).toLowerCase().trim();
  if (saved[rawLower]) return saved[rawLower];

  // 2. Smart semantic keyword match for everyday daily-life items
  if (clean.includes('loan') || clean.includes('borrow') || clean.includes('ঋণ') || clean.includes('ধার')) {
    return 'borrowed';
  }

  for (const meta of DAILY_LIFE_ICON_PACK) {
    if (meta.id === 'other') continue;
    for (const kw of meta.keywords) {
      if (clean.includes(kw)) {
        return meta.id;
      }
    }
  }

  // Fallback check for 'other' keywords
  if (clean.includes('other') || clean.includes('অন্যান্য')) {
    return 'other';
  }

  // 3. Deterministic realistic fallback across core daily-life icons
  const fallbackPool: DailyIconId[] = [
    'wallet_cash',
    'shopping',
    'food_meal',
    'transport_bus',
    'home_rent',
    'mobile',
    'office',
    'personal'
  ];
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  return fallbackPool[Math.abs(hash) % fallbackPool.length];
}

export function resolveCategoryIconMeta(catName: string): DailyIconMeta {
  return getIconMetaById(resolveCategoryIconId(catName));
}

export function getCategoryEmoji(catName: string): string {
  if (!catName) return '🏷️';

  // If the category name itself starts with an emoji, preserve it
  const match = String(catName).match(/^(\p{Extended_Pictographic}|\p{Emoji})/u);
  if (match && !/^[0-9#*]$/.test(match[0])) return match[0];

  return resolveCategoryIconMeta(catName).emoji;
}

export function getCategoryColor(catName: string): string {
  if (!catName) return 'bg-teal-500/20 text-teal-300 border-teal-600/50';
  return resolveCategoryIconMeta(catName).colorClass;
}

export function isOthersCategory(catName: string, type: 'Income' | 'Expense'): boolean {
  if (!catName) return false;
  const lower = String(catName).toLowerCase().trim();
  if (type === 'Income') {
    return lower.includes('other income') || lower.includes('অন্যান্য আয়');
  }
  return lower.includes('others') || lower.includes('অন্যান্য');
}
