/**
 * Canonical Business Date and Time Layer for QC Manager.
 * 
 * Single source of truth for all date, time, and period calculations.
 * Standardizes on the Bangladesh business timezone ('Asia/Dhaka', UTC+06:00)
 * so that clients in any local browser/OS timezone compute identical
 * calendar days, months, and years.
 */

export const BUSINESS_TIMEZONE = 'Asia/Dhaka' as const;

// Module-level cached formatters for Asia/Dhaka (+06:00)
const dhakaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dhakaTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const dhakaDatePartsCache = new Map<string, { year: string; month: string; day: string; dateKey: string }>();
const MAX_DHAKA_CACHE_SIZE = 10000;

export interface BusinessDateParts {
  year: string;
  month: string;
  day: string;
  dateKey: string; // 'YYYY-MM-DD'
}

/**
 * Returns the Year ('YYYY'), Month ('MM'), Day ('DD'), and full Date string ('YYYY-MM-DD')
 * for an ISO timestamp string or Date object interpreted strictly in Asia/Dhaka (+06:00).
 */
export function getBusinessDateParts(dateInput?: string | Date | null): BusinessDateParts {
  if (!dateInput) return { year: '', month: '', day: '', dateKey: '' };

  const cacheKey = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
  const cached = dhakaDatePartsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return { year: '', month: '', day: '', dateKey: '' };

    const parts = dhakaDateFormatter.format(d).split('-');
    if (parts.length === 3) {
      const res: BusinessDateParts = {
        year: parts[0],
        month: parts[1],
        day: parts[2],
        dateKey: `${parts[0]}-${parts[1]}-${parts[2]}`,
      };
      if (dhakaDatePartsCache.size >= MAX_DHAKA_CACHE_SIZE) {
        dhakaDatePartsCache.clear();
      }
      dhakaDatePartsCache.set(cacheKey, res);
      return res;
    }
  } catch {}

  return { year: '', month: '', day: '', dateKey: '' };
}

/** Alias for backward compatibility */
export const getDhakaDateParts = getBusinessDateParts;

/**
 * Returns the current moment interpreted in Asia/Dhaka (+06:00).
 * Completely immune to client browser / device timezone offsets.
 */
export function getBusinessToday(): BusinessDateParts {
  return getBusinessDateParts(new Date());
}

/**
 * Returns today's business date key in 'YYYY-MM-DD' format (Asia/Dhaka).
 */
export function getBusinessTodayDateKey(): string {
  return getBusinessToday().dateKey;
}

/**
 * Returns the current 4-digit business year ('YYYY') in Asia/Dhaka.
 */
export function getBusinessYear(): string {
  return getBusinessToday().year;
}

/**
 * Returns the current 2-digit business month ('MM') in Asia/Dhaka.
 */
export function getBusinessMonth(): string {
  return getBusinessToday().month;
}

/**
 * Canonical UTC ISO start and end timestamps for a given Year and Month in Asia/Dhaka (+06:00).
 * Immune to client browser / OS local timezone variations.
 */
export function getBusinessMonthRange(yearStr: string, monthStr: string): { startIso: string; endIso: string } {
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const mm = String(m).padStart(2, '0');
  const startIso = new Date(`${y}-${mm}-01T00:00:00+06:00`).toISOString();
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const nextMm = String(nextM).padStart(2, '0');
  const endIso = new Date(new Date(`${nextY}-${nextMm}-01T00:00:00+06:00`).getTime() - 1).toISOString();
  return { startIso, endIso };
}

/** Alias for backward compatibility */
export const getDhakaMonthRange = getBusinessMonthRange;

/**
 * Format any date string (ISO, YYYY-MM-DD, or DD-MM-YYYY) into canonical 'DD-MM-YYYY' display format.
 */
export function formatBusinessDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    // If already formatted as DD-MM-YYYY
    const ddmmyyyyMatch = String(dateStr).match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyyMatch) return dateStr;

    // Interpret ISO timestamps in Asia/Dhaka (+06:00)
    const { day, month, year } = getBusinessDateParts(dateStr);
    if (day && month && year) {
      return `${day}-${month}-${year}`;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const dayFallback = String(date.getDate()).padStart(2, '0');
    const monthFallback = String(date.getMonth() + 1).padStart(2, '0');
    const yearFallback = date.getFullYear();
    return `${dayFallback}-${monthFallback}-${yearFallback}`;
  } catch {
    return dateStr;
  }
}

/** Alias for backward compatibility */
export const formatDate = formatBusinessDate;

/**
 * Converts any date string format (ISO, DD-MM-YYYY, YYYY-MM-DD) into 'YYYY-MM-DD' for HTML date inputs.
 */
export function formatDateToYYYYMMDD(val: string | null | undefined): string {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  // Match DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    const mm = month.padStart(2, '0');
    const dd = day.padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  // Match YYYY-MM-DD
  const yyyymmddMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    const mm = month.padStart(2, '0');
    const dd = day.padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
}

/**
 * Format timestamp/time string to 12-hour AM/PM format in Asia/Dhaka (e.g. "03:04 PM").
 */
export function formatBusinessTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const str = String(dateStr).trim();
  if (!str) return '-';

  // Check if it is a HH:mm or HH:mm:ss string e.g. "13:00" or "22:30"
  const hhmmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    let hours = parseInt(hhmmMatch[1], 10);
    const minutes = hhmmMatch[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${strHours}:${minutes} ${ampm}`;
  }

  // Format ISO timestamp in Asia/Dhaka (+06:00)
  try {
    const d = new Date(str.includes('T') ? str : `1970-01-01T${str}`);
    if (!isNaN(d.getTime())) {
      return dhakaTimeFormatter.format(d);
    }
  } catch {}

  return str;
}

/** Alias for backward compatibility */
export const formatTimeToAMPM = formatBusinessTime;

/**
 * Format timestamp/time string to 24-hour HH:MM format for HTML time inputs.
 */
export function formatTimeToHHMM(val: string | null | undefined): string {
  if (!val) return '12:00';
  const str = String(val).trim();
  if (!str) return '12:00';

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = ampmMatch[2];
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${minutes}`;
  }

  return '12:00';
}
