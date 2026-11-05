export function cleanCategoryName(cat: string, targetLang: 'en' | 'bn' = 'en'): string {
  if (!cat) return '';

  let cleaned = String(cat).trim();

  // 1. Strip all emojis and symbols
  cleaned = cleaned.replace(/[\p{Extended_Pictographic}\p{Emoji}]/gu, '').trim();

  // Exact matching for specific user categories to avoid unwanted alterations
  if (/^others?\s*expense$/i.test(cleaned) || /^অন্যান্য\s*খরচ$/i.test(cleaned)) return 'Others Expense';
  if (/^others?\s*income$/i.test(cleaned) || /^other\s*income$/i.test(cleaned) || /^অন্যান্য\s*আয়$/i.test(cleaned)) return 'Others Income';
  if (/^previous\s*month\s*arrears$/i.test(cleaned) || /^পূর্ববর্তী\s*মাসের\s*বকেয়া$/i.test(cleaned)) return 'Previous Month Arrears';
  if (/^borrowed\s*money$/i.test(cleaned) || /^ধার\s*নেওয়া$/i.test(cleaned)) return 'Borrowed Money';
  if (/^loan\s*repaid$/i.test(cleaned) || /^ধার\s*শোধ$/i.test(cleaned)) return 'Loan Repaid';
  if (/^family'?s?\s*cost$/i.test(cleaned) || /^পারিবারিক\s*খরচ$/i.test(cleaned)) return "Family's Cost";
  if (/^wifi(?:\s*&\s*internet)?$/i.test(cleaned) || /^ওয়াইফাই$/i.test(cleaned)) return 'WiFi & Internet';
  if (/^mr\s*&\s*mrs$/i.test(cleaned) || /^দাম্পত্য$/i.test(cleaned)) return 'Mr & Mrs';

  // 2. Remove redundant '(Expense)', ': Expense', '- Expense' only when explicit delimiter is present
  cleaned = cleaned
    .replace(/\s*[-:]\s*(?:expense|expanse|income|খরচ|ব্যয়|আয়)\s*$/gi, '')
    .replace(/\s*\((?:expense|expanse|income|খরচ|ব্যয়|আয়)\)\s*$/gi, '')
    .trim();

  // 3. Remove bilingual parentheses e.g. (পাখি), (Personal), etc.
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();

  if (targetLang === 'en') {
    if (/^(?:অন্যান্য\s*আয়|other\s*income)$/i.test(cleaned)) return 'Others Income';
    if (/^(?:অন্যান্য(?:\s*খরচ)?|others?)$/i.test(cleaned)) return 'Others';
    if (/^(?:রুম\s*ভাড়া|room\s*rent|rent)$/i.test(cleaned)) return 'Room Rent';
    if (/^(?:রুম\s*সামগ্রী|room\s*accessories)$/i.test(cleaned)) return 'Room Accessories';
    if (/^(?:বাজার|bajar|bazar|grocery)$/i.test(cleaned)) return 'Bajar';
    if (/^(?:খাবার|food|meal)$/i.test(cleaned)) return 'Food';
    if (/^(?:পার্সোনাল|personal)$/i.test(cleaned)) return 'Personal';
    if (/^(?:ওয়াইফাই|wifi)$/i.test(cleaned)) return 'WiFi & Internet';
    if (/^(?:বিদ্যুৎ|electricity|electric)$/i.test(cleaned)) return 'Electricity';
    if (/^(?:ঔষধ|medicines?|medicine|meds?)$/i.test(cleaned)) return 'Medicines';
    if (/^(?:পাখি|pakhi|bird)$/i.test(cleaned)) return 'Pakhi';
    if (/^(?:শপিং|কেনাকাটা|shopping)$/i.test(cleaned)) return 'Shopping';
    if (/^(?:যাতায়াত|পরিবহন|travel|transport)$/i.test(cleaned)) return 'Travel';
    if (/^(?:সঞ্চয়|savings?)$/i.test(cleaned)) return 'Savings';
    if (/^(?:গ্যাস|gas|fuel)$/i.test(cleaned)) return 'Gas';
    if (/^(?:আত্মীয়স্বজন|relatives)$/i.test(cleaned)) return 'Relatives';
    if (/^(?:পারিবারিক\s*খরচ|family'?s?\s*cost)$/i.test(cleaned)) return "Family's Cost";
    if (/^(?:দাম্পত্য|mr\s*&\s*mrs)$/i.test(cleaned)) return 'Mr & Mrs';
    if (/^(?:ঈদ|eid)$/i.test(cleaned)) return 'Eid';
    if (/^(?:অফিসিয়াল|official)$/i.test(cleaned)) return 'Official';
    if (/^(?:ফলমূল|fruits?)$/i.test(cleaned)) return 'Fruits';
    if (/^(?:ধার\s*দিয়েছি|lent\s*money|lent)$/i.test(cleaned)) return 'Lent Out';
    if (/^(?:আড্ডা|hangout)$/i.test(cleaned)) return 'Hangout';
    if (/^(?:ধার\s*শোধ|repaid\s*loan|repaid)$/i.test(cleaned)) return 'Loan Repaid';
    if (/^(?:বাসা|home|house)$/i.test(cleaned)) return 'Home';
    if (/^(?:বেতন|salary)$/i.test(cleaned)) return 'Salary';
    if (/^(?:বকেয়া|arrear)$/i.test(cleaned)) return 'Arrear';
    if (/^(?:ধার\s*নেওয়া|borrowed\s*money|borrowed)$/i.test(cleaned)) return 'Borrowed Money';
    if (/^(?:ধার\/ঋণ|ঋণ|loan)$/i.test(cleaned)) return 'Loan';
    if (/^(?:ব্যবসা|business)$/i.test(cleaned)) return 'Business';
    if (/^(?:বোনাস|bonus)$/i.test(cleaned)) return 'Bonus';

    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // targetLang === 'bn'
  if (/^(?:other\s*income|others?\s*income|অন্যান্য\s*আয়)$/i.test(cleaned)) return 'অন্যান্য আয়';
  if (/^(?:others?\s*expense|others?|অন্যান্য(?:\s*খরচ)?)$/i.test(cleaned)) return 'অন্যান্য';
  if (/^(?:room\s*rent|rent|রুম\s*ভাড়া)$/i.test(cleaned)) return 'রুম ভাড়া';
  if (/^(?:room\s*accessories|রুম\s*সামগ্রী)$/i.test(cleaned)) return 'রুম সামগ্রী';
  if (/^(?:bajar|bazar|grocery|বাজার)$/i.test(cleaned)) return 'বাজার';
  if (/^(?:food|meal|খাবার)$/i.test(cleaned)) return 'খাবার';
  if (/^(?:personal|পার্সোনাল)$/i.test(cleaned)) return 'পার্সোনাল';
  if (/^(?:wifi|ওয়াইফাই)$/i.test(cleaned)) return 'ওয়াইফাই';
  if (/^(?:electricity|electric|বিদ্যুৎ)$/i.test(cleaned)) return 'বিদ্যুৎ';
  if (/^(?:medicines?|medicine|meds?|ঔষধ)$/i.test(cleaned)) return 'ঔষধ';
  if (/^(?:pakhi|bird|পাখি)$/i.test(cleaned)) return 'পাখি';
  if (/^(?:shopping|কেনাকাটা|শপিং)$/i.test(cleaned)) return 'শপিং';
  if (/^(?:transport|travel|যাতায়াত|ভ্রমণ)$/i.test(cleaned)) return 'ভ্রমণ/যাতায়াত';
  if (/^(?:savings?|সঞ্চয়)$/i.test(cleaned)) return 'সঞ্চয়';
  if (/^(?:gas|গ্যাস)$/i.test(cleaned)) return 'গ্যাস';
  if (/^(?:relatives|আত্মীয়স্বজন)$/i.test(cleaned)) return 'আত্মীয়স্বজন';
  if (/^(?:family'?s?\s*cost|পারিবারিক\s*খরচ)$/i.test(cleaned)) return 'পারিবারিক খরচ';
  if (/^(?:mr\s*&\s*mrs|দাম্পত্য)$/i.test(cleaned)) return 'Mr & Mrs';
  if (/^(?:eid|ঈদ)$/i.test(cleaned)) return 'ঈদ';
  if (/^(?:official|অফিসিয়াল)$/i.test(cleaned)) return 'অফিসিয়াল';
  if (/^(?:fruits?|ফলমূল)$/i.test(cleaned)) return 'ফলমূল';
  if (/^(?:ধার\s*দিয়েছি|lent\s*money)$/i.test(cleaned)) return 'ধার দিয়েছি';
  if (/^(?:hangout|আড্ডা)$/i.test(cleaned)) return 'আড্ডা';
  if (/^(?:ধার\s*শোধ|repaid\s*loan)$/i.test(cleaned)) return 'ধার শোধ';
  if (/^(?:home|বাসা)$/i.test(cleaned)) return 'বাসা';
  if (/^(?:salary|বেতন)$/i.test(cleaned)) return 'বেতন';
  if (/^(?:arrear|বকেয়া)$/i.test(cleaned)) return 'বকেয়া';
  if (/^(?:borrowed\s*money|borrowed|ধার\s*নেওয়া)$/i.test(cleaned)) return 'ধার নেওয়া';
  if (/^(?:loan|ঋণ|ধার\/ঋণ)$/i.test(cleaned)) return 'ধার/ঋণ';
  if (/^(?:business|ব্যবসা)$/i.test(cleaned)) return 'ব্যবসা';
  if (/^(?:bonus|বোনাস)$/i.test(cleaned)) return 'বোনাস';

  return cleaned;
}

export function getCategoryEmoji(catName: string): string {
  const match = catName.match(/^(\p{Extended_Pictographic}|\p{Emoji})/u);
  if (match) return match[0];

  const lower = catName.toLowerCase();
  if (lower.includes('rent') || lower.includes('রুম ভাড়া')) return '🏠';
  if (lower.includes('accessories') || lower.includes('সামগ্রী')) return '🛋️';
  if (lower.includes('bajar') || lower.includes('bazar') || lower.includes('বাজার') || lower.includes('grocery')) return '🛒';
  if (lower.includes('food') || lower.includes('খাবার')) return '🍲';
  if (lower.includes('personal') || lower.includes('পার্সোনাল')) return '👤';
  if (lower.includes('wifi') || lower.includes('ওয়াইফাই')) return '📶';
  if (lower.includes('electricity') || lower.includes('বিদ্যুৎ')) return '⚡';
  if (lower.includes('medicine') || lower.includes('ঔষধ')) return '💊';
  if (lower.includes('pakhi') || lower.includes('পাখি')) return '🐦';
  if (lower.includes('travel') || lower.includes('transport') || lower.includes('যাতায়াত')) return '🏍️';
  if (lower.includes('shopping') || lower.includes('শপিং')) return '🛍️';
  if (lower.includes('savings') || lower.includes('সঞ্চয়')) return '💰';
  if (lower.includes('gas') || lower.includes('গ্যাস')) return '🔥';
  if (lower.includes('relative') || lower.includes('আত্মীয়')) return '👥';
  if (lower.includes('family') || lower.includes('পরিবার')) return '👨‍👩‍👧';
  if (lower.includes('mr & mrs') || lower.includes('দাম্পত্য')) return '💑';
  if (lower.includes('eid') || lower.includes('ঈদ')) return '🌙';
  if (lower.includes('official') || lower.includes('অফিস')) return '💻';
  if (lower.includes('fruit') || lower.includes('ফল')) return '🍍';
  if (lower.includes('hangout') || lower.includes('আড্ডা')) return '☕';
  if (lower.includes('ধার')) return '🤝';
  if (lower.includes('home') || lower.includes('বাসা')) return '🏡';
  if (lower.includes('salary') || lower.includes('বেতন')) return '💰';
  if (lower.includes('loan') || lower.includes('ঋণ')) return '🤝';
  return '🏷️';
}

export function getCategoryColor(catName: string): string {
  const lower = catName.toLowerCase();
  if (lower.includes('food') || lower.includes('খাবার')) return 'bg-teal-400/80';
  if (lower.includes('bajar') || lower.includes('bazar') || lower.includes('বাজার')) return 'bg-orange-300/80';
  if (lower.includes('pakhi') || lower.includes('পাখি')) return 'bg-indigo-300/80';
  if (lower.includes('medicine') || lower.includes('ঔষধ')) return 'bg-emerald-400/80';
  if (lower.includes('rent') || lower.includes('রুম')) return 'bg-rose-400/80';
  if (lower.includes('wifi') || lower.includes('ওয়াইফাই')) return 'bg-sky-400/80';
  if (lower.includes('electricity') || lower.includes('বিদ্যুৎ')) return 'bg-amber-400/80';
  if (lower.includes('salary') || lower.includes('বেতন')) return 'bg-emerald-500/80';
  
  // Hash-based fallback
  const colors = ['bg-slate-400/80', 'bg-blue-400/80', 'bg-purple-400/80', 'bg-pink-400/80', 'bg-teal-400/80'];
  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function isOthersCategory(catName: string, type: 'Income' | 'Expense'): boolean {
  if (!catName) return false;
  const clean = cleanCategoryName(catName, 'en').toLowerCase();
  if (type === 'Income') {
    return clean === 'other income' || clean === 'others' || catName.includes('Other Income') || catName.includes('অন্যান্য আয়');
  } else {
    return clean === 'others' || (catName.includes('Others') || catName.includes('অন্যান্য')) && !catName.includes('আয়');
  }
}

