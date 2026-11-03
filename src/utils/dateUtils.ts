export function normalizeDate(rawDate: any): string {
  if (!rawDate) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // If already a Date object (sometimes happens with certain APIs)
  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return normalizeDate(null);
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(rawDate).trim();

  // 1. Standard ISO format or partial: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = String(Number(isoMatch[2])).padStart(2, '0');
    const d = String(Number(isoMatch[3])).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Full Date / ISO string like "2026-10-09T14:30:00.000Z"
  if (s.includes('T')) {
    const datePart = s.split('T')[0];
    const parts = datePart.split(/[-/]/);
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }

  // 3. Formats with slashes or dashes like DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    const p1 = Number(slashMatch[1]);
    const p2 = Number(slashMatch[2]);
    const y = slashMatch[3];

    // Heuristic: If p1 > 12, it must be DD/MM/YYYY
    if (p1 > 12) {
      return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
    // Heuristic: If p2 > 12, it must be MM/DD/YYYY
    if (p2 > 12) {
      return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }
    // If ambiguous (both <= 12), we default to DD/MM/YYYY as it's common in many locales
    // But let's check if the raw string looks like it was meant to be MM/DD (US style)
    // Actually, most non-US users use DD/MM. 
    return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
  }

  // 3.5. GMT or full date string like "Tue Oct 27 2026 00:00:00 GMT+0600..." or "Thu Oct 01 2026..."
  const gmtTextMatch = s.match(/(?:[A-Za-z]{3},\s*)?(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (gmtTextMatch) {
    const mStr = gmtTextMatch[1].toLowerCase();
    const d = String(Number(gmtTextMatch[2])).padStart(2, '0');
    const y = gmtTextMatch[3];
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIdx = months.findIndex(m => mStr.startsWith(m));
    if (mIdx !== -1) {
      return `${y}-${String(mIdx + 1).padStart(2, '0')}-${d}`;
    }
  }

  // 4. Alphabetic months like "12-Oct-26" or "Oct-2026"
  const alphaMatch = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,9})[-\/\s](\d{2,4})/);
  if (alphaMatch) {
    const d = alphaMatch[1];
    const mStr = alphaMatch[2].toLowerCase();
    let y = alphaMatch[3];
    if (y.length === 2) y = '20' + y;
    
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIdx = months.findIndex(m => mStr.startsWith(m));
    if (mIdx !== -1) {
      return `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 5. Month-Year format like "Oct-2026" or "10-2026" (for mappings)
  const myMatch = s.match(/^([A-Za-z]{3,9}|[\d]{1,2})[-\/\s](\d{2,4})$/);
  if (myMatch) {
    const mStr = myMatch[1].toLowerCase();
    let y = myMatch[2];
    if (y.length === 2) y = '20' + y;
    
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIdx = months.findIndex(m => mStr.startsWith(m)) + 1 || Number(mStr);
    if (!isNaN(mIdx) && mIdx >= 1 && mIdx <= 12) {
      return `${y}-${String(mIdx).padStart(2, '0')}`;
    }
  }

  // 6. Try parsing as numeric timestamp or other formats
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    // Extract local components to avoid UTC shift
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }


  // Fallback: today's date
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatSyncDateTime(date: Date, lang: 'en' | 'bn'): string {
  if (!date || isNaN(date.getTime())) return lang === 'en' ? 'Just now' : 'এইমাত্র';
  
  if (lang === 'en') {
    const d = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const y = String(date.getFullYear()).slice(-2);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${d}-${month}-${y} ${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
  }

  // Bengali numbers & month names
  const toBnDigits = (n: number | string) => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(n).replace(/\d/g, d => bnDigits[Number(d)]);
  };

  const bnMonths = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
  const d = toBnDigits(String(date.getDate()).padStart(2, '0'));
  const month = bnMonths[date.getMonth()];
  const y = toBnDigits(date.getFullYear());
  let hours = date.getHours();
  const minutes = toBnDigits(String(date.getMinutes()).padStart(2, '0'));
  const period = hours >= 12 ? 'অপরাহ্ন' : 'পূর্বাহ্ন';
  hours = hours % 12 || 12;
  const hoursBn = toBnDigits(String(hours).padStart(2, '0'));

  return `${d} ${month} ${y}, ${hoursBn}:${minutes} ${period}`;
}

export function formatCleanDateTime(rawStr: string | undefined | null, lang: 'en' | 'bn' = 'en'): string {
  if (!rawStr) return '';
  const s = String(rawStr).trim();
  if (!s) return '';

  // Clean bracketed timezone annotations like (Bangladesh Standard Time) or (孟加拉標準時間)
  const cleaned = s.replace(/\s*\([^)]*\)/g, '').trim();

  // Try parsing date
  const parts = cleaned.split(/[-T:]/);
  let parsed: Date;
  if (parts.length >= 3 && parts[0].length === 4) {
    parsed = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else {
    parsed = new Date(cleaned);
  }
  
  if (!isNaN(parsed.getTime())) {
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const wday = dayNamesEn[parsed.getDay()];
    const m = monthNamesEn[parsed.getMonth()];
    const day = String(parsed.getDate()).padStart(2, '0');
    const yr = parsed.getFullYear();
    let hours = parsed.getHours();
    const mins = String(parsed.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hrStr = String(hours).padStart(2, '0');

    if (lang === 'bn') {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      const toBn = (v: any) => String(v).replace(/\d/g, digit => bnDigits[Number(digit)]);
      const bnDays = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
      const bnMonths = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
      const period = parsed.getHours() >= 12 ? 'অপরাহ্ন' : 'পূর্বাহ্ন';
      return `${bnDays[parsed.getDay()]} ${toBn(day)} ${bnMonths[parsed.getMonth()]} ${toBn(yr)}, ${toBn(hrStr)}:${toBn(mins)} ${period}`;
    }

    return `${wday} ${m} ${day} ${yr} ${hrStr}:${mins}${ampm}`;
  }

  // Fallback: strip GMT+... and parentheses via regex directly
  return s
    .replace(/\s*GMT[+-]\d{4}/gi, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
}

export function formatNumberLocale(num: number, lang: 'en' | 'bn'): string {
  if (isNaN(num)) return '0';
  const formatted = num.toLocaleString('en-US');
  if (lang === 'en') return formatted;
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return formatted.replace(/\d/g, d => bnDigits[Number(d)]);
}

export function formatDayDisplay(dayNum: number, lang: 'en' | 'bn'): string {
  if (lang === 'en') return String(dayNum).padStart(2, '0');
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(dayNum).padStart(2, '0').replace(/\d/g, d => bnDigits[Number(d)]);
}

export function formatDateFull(dateStr: string, lang: 'en' | 'bn'): string {
  try {
    const clean = normalizeDate(dateStr);
    const [y, m, d] = clean.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return dateStr;

    if (lang === 'en') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}, ${days[date.getDay()]}`;
    }

    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const toBn = (n: number | string) => String(n).replace(/\d/g, digit => bnDigits[Number(digit)]);
    const bnMonths = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
    const bnDays = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    return `${toBn(String(d).padStart(2, '0'))} ${bnMonths[m - 1]} ${toBn(y)}, ${bnDays[date.getDay()]}`;
  } catch {
    return dateStr;
  }
}

export function formatDateShortDemo(dateStr: string, lang: 'en' | 'bn'): string {
  try {
    const clean = normalizeDate(dateStr);
    const [y, m, d] = clean.split('-').map(Number);
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayStr = String(d).padStart(2, '0');
    const yr2 = String(y).slice(-2);
    const monStr = monthsEn[m - 1] || 'Oct';

    if (lang === 'bn') {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      const toBn = (n: number | string) => String(n).replace(/\d/g, digit => bnDigits[Number(digit)]);
      const bnMonths = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
      return `${toBn(dayStr)}-${bnMonths[m - 1] || 'অক্টো'}-${toBn(yr2)}`;
    }

    return `${dayStr}-${monStr}-${yr2}`;
  } catch {
    return dateStr;
  }
}

export function formatDayHeader(dateStr: string, lang: 'en' | 'bn'): string {
  try {
    const clean = normalizeDate(dateStr);
    const [y, m, d] = clean.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return dateStr;

    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const wday = dayNamesEn[date.getDay()];
    const mon = monthNamesEn[m - 1];
    const dayStr = String(d).padStart(2, '0');
    const yrStr = String(y).slice(-2);

    if (lang === 'bn') {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      const toBn = (n: number | string) => String(n).replace(/\d/g, digit => bnDigits[Number(digit)]);
      const bnDays = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
      const bnMonths = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
      return `${bnDays[date.getDay()]}, ${toBn(dayStr)}-${bnMonths[m - 1]}-${toBn(yrStr)}`;
    }

    return `${wday}, ${dayStr}-${mon}-${yrStr}`;
  } catch {
    return dateStr;
  }
}

/**
 * Normalizes any month label (e.g. from Google Sheets Date string, "Thu Oct 01 2026...",
 * "2026-10", "oct-26", "October 2026") into standardized "Oct-2026"
 */
export function cleanMappingLabel(rawLabel: any): string {
  if (!rawLabel) return '';
  const s = String(rawLabel).trim();
  if (!s) return '';

  const monthsProper = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsLower = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // 1. GMT / ISO / Full Date String (e.g. "Thu Oct 01 2026 00:00:00 GMT+0600...") or "Oct 01 2026"
  const gmtTextMatch = s.match(/(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (gmtTextMatch) {
    const mStr = gmtTextMatch[1].toLowerCase();
    const y = gmtTextMatch[3];
    const idx = monthsLower.findIndex(m => mStr.startsWith(m));
    if (idx !== -1) {
      return `${monthsProper[idx]}-${y}`;
    }
  }

  // 2. YYYY-MM or YYYY-MM-DD
  const ymMatch = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (ymMatch) {
    const y = ymMatch[1];
    const m = parseInt(ymMatch[2], 10);
    if (m >= 1 && m <= 12) {
      return `${monthsProper[m - 1]}-${y}`;
    }
  }

  // 3. Month name and year (e.g. "Oct-2026", "oct-26", "October 2026", "oct 26")
  const alphaMatch = s.match(/^([A-Za-z]{3,9})[-\s/]?(\d{2,4})$/);
  if (alphaMatch) {
    const mStr = alphaMatch[1].toLowerCase();
    let y = alphaMatch[2];
    if (y.length === 2) y = '20' + y;
    const idx = monthsLower.findIndex(m => mStr.startsWith(m));
    if (idx !== -1) {
      return `${monthsProper[idx]}-${y}`;
    }
  }

  return s;
}

/**
 * Returns YYYY-MM key from any month label or date representation
 * e.g., "Oct-2026" -> "2026-10", "Thu Oct 01 2026..." -> "2026-10"
 */
export function getMonthKeyFromLabel(labelOrDate: any): string {
  if (!labelOrDate) return '';
  const s = String(labelOrDate).trim();
  const monthsLower = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // GMT or Full Date string
  const gmtTextMatch = s.match(/(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (gmtTextMatch) {
    const mStr = gmtTextMatch[1].toLowerCase();
    const y = gmtTextMatch[3];
    const idx = monthsLower.findIndex(m => mStr.startsWith(m));
    if (idx !== -1) {
      return `${y}-${String(idx + 1).padStart(2, '0')}`;
    }
  }

  // YYYY-MM
  const ymMatch = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (ymMatch) {
    return `${ymMatch[1]}-${String(Number(ymMatch[2])).padStart(2, '0')}`;
  }

  // Month-Year alphabetic e.g. "Oct-2026" or "oct 2026"
  const alphaMatch = s.match(/([A-Za-z]{3,9})[-\s/]?(\d{2,4})/);
  if (alphaMatch) {
    const mStr = alphaMatch[1].toLowerCase();
    let y = alphaMatch[2];
    if (y.length === 2) y = '20' + y;
    const idx = monthsLower.findIndex(m => mStr.startsWith(m));
    if (idx !== -1) {
      return `${y}-${String(idx + 1).padStart(2, '0')}`;
    }
  }

  return s;
}

/**
 * Universally finds the corresponding MonthMapping for a given selectedMonth query.
 * Matches whether query is "Oct-2026", "2026-10", "Thu Oct 01 2026...", "Oct 2026", etc.
 */
export function findMonthMapping<T extends { label: string; startDate: string; endDate: string }>(
  mappings: T[] | undefined | null,
  query: string | undefined | null
): T | undefined {
  if (!mappings || !Array.isArray(mappings) || mappings.length === 0 || !query) {
    return undefined;
  }

  const cleanQuery = cleanMappingLabel(query).toLowerCase();
  const queryMonthKey = getMonthKeyFromLabel(query);
  const rawQuery = String(query).trim().toLowerCase();

  return mappings.find(m => {
    if (!m || !m.label) return false;
    const rawLabel = String(m.label).trim().toLowerCase();
    if (rawLabel === rawQuery) return true;

    const cleanedLabel = cleanMappingLabel(m.label).toLowerCase();
    if (cleanedLabel === cleanQuery) return true;

    const mMonthKey = getMonthKeyFromLabel(m.label);
    if (queryMonthKey && mMonthKey && queryMonthKey === mMonthKey) return true;

    // Check if query is YYYY-MM and mapping range covers this month
    if (queryMonthKey) {
      const startKey = m.startDate ? m.startDate.slice(0, 7) : '';
      const endKey = m.endDate ? m.endDate.slice(0, 7) : '';
      if (cleanedLabel.toLowerCase().includes(cleanQuery)) return true;
      if (startKey === queryMonthKey || endKey === queryMonthKey) {
        if (cleanedLabel.toLowerCase() === cleanQuery || mMonthKey === queryMonthKey) {
          return true;
        }
      }
    }

    return false;
  });
}


