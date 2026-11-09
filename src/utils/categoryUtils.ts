// Pure category helper logic with ZERO hardcoded categories or stored data.
// All categories, names, and transactions are sourced dynamically from Google Sheet.

export function cleanCategoryName(cat: string, _targetLang: 'en' | 'bn' = 'en'): string {
  if (!cat) return '';
  let cleaned = String(cat).trim();

  // Strip trailing redundant type suffixes like "- Expense", "(Expense)", "- Income", "(Income)" if present
  cleaned = cleaned.replace(/\s*[-:(]\s*(?:expense|income|খরচ|ব্যয়|আয়)\s*\)?$/gi, '').trim();

  return cleaned;
}

export function getCategoryEmoji(catName: string): string {
  if (!catName) return '🏷️';

  // If the category name itself contains an emoji, preserve and use it
  const match = String(catName).match(/^(\p{Extended_Pictographic}|\p{Emoji})/u);
  if (match) return match[0];

  // Dynamic deterministic hashing logic - assigns a clean icon based on string hash
  // Zero stored categories in code; works dynamically for any category from Google Sheet
  const emojiSet = ['💼', '🛒', '🍔', '⚡', '💊', '🚗', '🏠', '📱', '🎁', '🎓', '🛠️', '✈️', '☕', '💰', '🏷️'];
  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return emojiSet[Math.abs(hash) % emojiSet.length];
}

export function getCategoryColor(catName: string): string {
  if (!catName) return 'bg-teal-500/20 text-teal-300';

  // Dynamic color palette based on string hash - no hardcoded categories
  const colorSet = [
    'bg-teal-500/20 text-teal-300 border-teal-600/50',
    'bg-emerald-500/20 text-emerald-300 border-emerald-600/50',
    'bg-amber-500/20 text-amber-300 border-amber-600/50',
    'bg-cyan-500/20 text-cyan-300 border-cyan-600/50',
    'bg-indigo-500/20 text-indigo-300 border-indigo-600/50',
    'bg-rose-500/20 text-[#FF7A59] border-[#FF7A59]/40',
    'bg-purple-500/20 text-purple-300 border-purple-600/50',
    'bg-blue-500/20 text-blue-300 border-blue-600/50'
  ];
  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorSet[Math.abs(hash) % colorSet.length];
}

export function isOthersCategory(catName: string, type: 'Income' | 'Expense'): boolean {
  if (!catName) return false;
  const lower = String(catName).toLowerCase().trim();
  if (type === 'Income') {
    return lower.includes('other income') || lower.includes('অন্যান্য আয়');
  }
  return lower.includes('others') || lower.includes('অন্যান্য');
}
