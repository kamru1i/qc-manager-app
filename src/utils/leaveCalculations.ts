import { ChutiRecord } from '@/utils/offlineSync';
import { GlobalSettings } from './globalSettingsHelpers';

export const applyLeaveFilters = <T extends ChutiRecord>(
  records: T[],
  selectedYear: string,
  filterType: string,
  filterStartDate: string,
  filterEndDate: string,
  searchQuery?: string
): T[] => {
  const filtered = records.filter(r => {
    const isApproved = r.status === 'approved';
    if (isApproved && selectedYear !== 'all' && r.date && r.date.substring(0, 4) !== selectedYear) return false;
    if (filterType !== 'all') {
      if (filterType === 'adjustment' && !r.adjustment) return false;
      if (filterType !== 'adjustment' && r.leave_type !== filterType) return false;
    }
    if (filterStartDate && r.date && r.date < filterStartDate) return false;
    if (filterEndDate && r.date && r.date > filterEndDate) return false;
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const commentMatch = (r.comment || '').toLowerCase().includes(q);
      const typeMatch = (r.leave_type || '').toLowerCase().includes(q);
      if (!commentMatch && !typeMatch) return false;
    }

    // Only keep Govt Holiday records if they are an adjustment
    const isGovtHolidayRecord = r.leave_type === 'Govt Holiday' || r.reserve_holiday === 'Govt Holiday' || (r.comment && r.comment.includes('Govt Holiday'));
    if (isGovtHolidayRecord && !r.adjustment) {
      return false;
    }

    return true;
  });

  return sortChutiRecordsDescending(filtered);
};

export const getAdjustedLeaveStats = (
  rawShortHours: string,
  rawFullLeaves: number,
  convertedHours: number = 0,
  convertedDays: number = 0
) => {
  const totalShortMins = parseIntervalToMinutes(rawShortHours);
  const netShortMins = Math.max(0, totalShortMins - convertedHours * 60);
  
  return {
    displayShortHours: formatDuration(netShortMins),
    displayFullLeaves: rawFullLeaves + convertedDays,
    netShortMins
  };
};

// Helper function to clean supervisor/admin approval prefix and adjustments from comment for table display
export const getCleanComment = (comment: string | null | undefined): string => {
  if (!comment) return '';
  let clean = comment;
  
  // Clean approval prefixes
  const regex = /^[A-Za-z0-9_-]+\s+Approved(?:\s*\|\s*)?/;
  while (regex.test(clean)) {
    clean = clean.replace(regex, '');
  }
  
  // Clean adjustment prefixes
  const adjRegex = /^Adjusted:\s*(?:Office Leave|Eid-ul-Fitr|Eid-ul-Adha|Govt Holiday)(?:\s*\|\s*)?/;
  while (adjRegex.test(clean)) {
    clean = clean.replace(adjRegex, '');
  }
  
  return clean.trim();
};

// Helper function to format date from YYYY-MM-DD to DD-MM-YYYY
export { formatDate, escapeHtml } from './formatters';

// Helper functions for time parsing and formatting
export const parseTimeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export const formatDuration = (totalMinutes: number) => {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  
  const hoursStr = String(hours).padStart(2, '0');
  const minsStr = String(mins).padStart(2, '0');
  
  return `${isNegative ? '-' : ''}${hoursStr}:${minsStr}`;
};

export const formatDaysAndHours = (daysVal: number, workingHours: number = 9.5): string => {
  const totalMins = Math.round(daysVal * workingHours * 60);
  if (totalMins === 0) return '0 days';
  const isNegative = totalMins < 0;
  const absMins = Math.abs(totalMins);
  
  const minutesPerDay = Math.round(workingHours * 60);
  const wholeDays = Math.floor(absMins / minutesPerDay);
  const remainingMins = absMins % minutesPerDay;
  const hours = Math.floor(remainingMins / 60);
  const mins = remainingMins % 60;
  
  const parts: string[] = [];
  if (wholeDays > 0) {
    parts.push(`${wholeDays} day${wholeDays > 1 ? 's' : ''}`);
  }
  if (hours > 0) {
    parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  }
  if (mins > 0) {
    parts.push(`${mins} min${mins > 1 ? 's' : ''}`);
  }
  return `${isNegative ? '-' : ''}${parts.join(' ')}`;
};

export const parseIntervalToMinutes = (intervalStr: string | null | undefined) => {
  if (!intervalStr) return 0;
  const clean = intervalStr.toString().replace(/-/g, '');
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    return h * 60 + m;
  }
  return 0;
};

export const calculateStats = (records: ChutiRecord[], workingHours: number = 9.5) => {
  let totalShortMinutes = 0;
  let totalOvertimeMinutes = 0;
  let totalFullLeaves = 0;
  const totalReserveLeaves = 0;
  
  let officeLeavesTaken = 0;
  let eidFitrTaken = 0;
  let eidAdhaTaken = 0;
  let govtHolidaysTaken = 0;

  records.forEach(r => {
    // Count only approved leaves in total counters
    if (r.status === 'approved') {
      const isOfficeLeave = r.adjustment && (r.comment?.includes("Office Leave") || r.reserve_holiday === "Office Leave" || false);
      const isEidFitr = r.adjustment && (r.comment?.includes("Eid-ul-Fitr") || r.reserve_holiday === "Eid-ul-Fitr" || false);
      const isEidAdha = r.adjustment && (r.comment?.includes("Eid-ul-Adha") || r.reserve_holiday === "Eid-ul-Adha" || false);
      const isGovtHoliday = r.adjustment && (r.comment?.includes("Govt Holiday") || r.reserve_holiday === "Govt Holiday" || false);
      const hasCategoryAdj = isOfficeLeave || isEidFitr || isEidAdha || isGovtHoliday;

      if (r.leave_type === 'Full Leave') {
        totalFullLeaves++;
        if (hasCategoryAdj) {
          if (isOfficeLeave) officeLeavesTaken++;
          else if (isEidFitr) eidFitrTaken++;
          else if (isEidAdha) eidAdhaTaken++;
          else if (isGovtHoliday) govtHolidaysTaken++;
        } else if (!r.adjustment) {
          officeLeavesTaken++;
        }
      } else if (r.leave_type === 'Short Leave') {
        if (r.leave_hour) {
          let mins = parseIntervalToMinutes(r.leave_hour);
          const isNegative = r.leave_hour.toString().startsWith('-');
          if (r.adjustment) {
            mins = 0;
            const fullAdjMins = parseIntervalToMinutes(r.leave_hour);
            
            const isOfficeLeaveShort = r.reserve_holiday === "Office Leave" || r.comment?.includes("Office Leave") || false;
            const isEidFitrShort = r.reserve_holiday === "Eid-ul-Fitr" || r.comment?.includes("Eid-ul-Fitr") || false;
            const isEidAdhaShort = r.reserve_holiday === "Eid-ul-Adha" || r.comment?.includes("Eid-ul-Adha") || false;
            const isGovtHolidayShort = r.reserve_holiday === "Govt Holiday" || r.comment?.includes("Govt Holiday") || false;
            const isSalaryShort = r.reserve_holiday === "Salary" || r.comment?.includes("Salary") || false;

            if (isOfficeLeaveShort || isEidFitrShort || isEidAdhaShort || isGovtHolidayShort) {
              const daysEquivalent = fullAdjMins / (workingHours * 60);
              const signedDaysEquivalent = isNegative ? -daysEquivalent : daysEquivalent;
              if (isOfficeLeaveShort) officeLeavesTaken += signedDaysEquivalent;
              else if (isEidFitrShort) eidFitrTaken += signedDaysEquivalent;
              else if (isEidAdhaShort) eidAdhaTaken += signedDaysEquivalent;
              else if (isGovtHolidayShort) govtHolidaysTaken += signedDaysEquivalent;
            } else if (isSalaryShort) {
              // Salary adjusted short leave: does not deduct from overtime or reserves
            } else {
              totalOvertimeMinutes -= isNegative ? -fullAdjMins : fullAdjMins;
            }
          } else {
            // Default/unadjusted short leaves count against Office Leave automatically
            const daysEquivalent = mins / (workingHours * 60);
            officeLeavesTaken += isNegative ? -daysEquivalent : daysEquivalent;

            if (r.adjusted_hour) {
              const adjMins = parseIntervalToMinutes(r.adjusted_hour);
              mins = Math.max(0, mins - adjMins);
              const isSalaryShort = r.reserve_holiday === "Salary" || r.comment?.includes("Salary") || false;
              if (!isSalaryShort) {
                totalOvertimeMinutes -= isNegative ? -adjMins : adjMins;
              }
            }
          }
          totalShortMinutes += isNegative ? -mins : mins;
        }
      } else if (r.leave_type === 'Overtime') {
        if (r.leave_hour) {
          let mins = parseIntervalToMinutes(r.leave_hour);
          const isNegative = r.leave_hour.toString().startsWith('-');
          if (r.adjustment) {
            mins = 0;
            if (r.adjust_short_leave) {
              const otMins = parseIntervalToMinutes(r.leave_hour);
              totalShortMinutes -= isNegative ? -otMins : otMins;
            }
          } else if (r.adjusted_hour) {
            const adjMins = parseIntervalToMinutes(r.adjusted_hour);
            mins = Math.max(0, mins - adjMins);
            if (r.adjust_short_leave) {
              totalShortMinutes -= isNegative ? -adjMins : adjMins;
            }
          }
          totalOvertimeMinutes += isNegative ? -mins : mins;
        }
      }
    }
  });

  return {
    shortHours: formatDuration(totalShortMinutes),
    overtimeHours: formatDuration(totalOvertimeMinutes),
    fullLeaves: Math.max(0, totalFullLeaves),
    reserveLeaves: totalReserveLeaves,
    totalHours: formatDuration(totalShortMinutes),
    officeLeavesTaken,
    eidFitrTaken,
    eidAdhaTaken,
    govtHolidaysTaken
  };
};

export const checkIfHolidayOrWeekend = (dateString: string, globalSettings: GlobalSettings): boolean => {
  if (!dateString) return false;
  
  const parts = dateString.split('-').map(Number);
  if (parts.length === 3) {
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = dateObj.getDay();
    if (day === 5 || day === 6) { // Friday and Saturday
      return true;
    }
  }
  
  const holidays = globalSettings?.govt_holidays || [];
  const isGovtHoliday = holidays.some((h: any) => {
    const hDate = typeof h === 'object' ? h.date : String(h);
    return hDate === dateString;
  });
  
  return isGovtHoliday;
};

export const calculateLeaveOrOvertime = (
  type: string,
  actualStart: string,
  actualEnd: string,
  shiftStart: string,
  _shiftEnd: string,
  workingHours: number = 9.5,
  isHoliday: boolean = false
) => {
  if (type === 'Full Leave') {
    return '00:00';
  }
  if (!actualStart || !actualEnd) return '00:00';

  const shiftStartMins = parseTimeToMinutes(shiftStart);
  
  const getShiftRelativeMins = (t: string) => {
    let m = parseTimeToMinutes(t);
    if (m < shiftStartMins - 4 * 60) {
      m += 24 * 60;
    }
    return m;
  };

  const actualStartMins = getShiftRelativeMins(actualStart);
  const actualEndMins = getShiftRelativeMins(actualEnd);

  if (type === 'Short Leave') {
    let leaveDuration = actualEndMins - actualStartMins;
    if (leaveDuration < 0) {
      leaveDuration += 24 * 60;
    }
    return formatDuration(leaveDuration);
  } else if (type === 'Early Leave') {
    let worked = actualEndMins - actualStartMins;
    if (worked < 0) {
      worked += 24 * 60;
    }
    const required = workingHours * 60;
    return formatDuration(Math.max(0, required - worked));
  } else if (type === 'Overtime') {
    let worked = actualEndMins - actualStartMins;
    if (worked < 0) {
      worked += 24 * 60;
    }
    const regular = workingHours * 60;
    return formatDuration(Math.max(0, worked - regular));
  }
  return '00:00';
};

export const getLeaveValidationError = (
  type: string,
  signInTime: string,
  signOutTime: string,
  workingHours: number = 9.5,
  _isHoliday: boolean = false
): string | null => {
  if (type === 'Full Leave' || !type) return null;
  if (!signInTime || !signOutTime) return null;

  const startMins = parseTimeToMinutes(signInTime);
  let endMins = parseTimeToMinutes(signOutTime);
  if (endMins < startMins) {
    endMins += 24 * 60;
  }
  
  const workedMins = endMins - startMins;
  const regularMins = workingHours * 60;

  if (type === 'Overtime') {
    if (workedMins <= regularMins) {
      return 'Overtime must be extra from working hour';
    }
  }

  return null;
};

export const formatWorkingHours = (hours: number | string) => {
  const h = parseFloat(String(hours));
  if (isNaN(h)) return '9 hours 30 mins';
  const wholeHours = Math.floor(h);
  const fraction = h - wholeHours;
  if (fraction === 0.5) {
    return `${wholeHours} hours 30 mins`;
  }
  if (fraction === 0) {
    return `${wholeHours} hours`;
  }
  return `${h} hours`;
};

// Time format to AM/PM style (e.g. 07:25 PM)
export const formatTimeToAMPM = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '-';
  const str = String(timeStr).trim();
  if (!str) return '-';

  // 1. Check if it is a HH:mm or HH:mm:ss string e.g. "13:00" or "22:30"
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

  // 2. Fallback to ISO timestamp Date parsing
  try {
    const d = new Date(str.includes('T') ? str : `1970-01-01T${str}`);
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = String(hours).padStart(2, '0');
      return `${strHours}:${minutes} ${ampm}`;
    }
  } catch {}

  return str;
};

export const getDetailedLeaveLabel = (rec: { leave_type: string; reserve_holiday?: string | null }) => {
  return rec.leave_type;
};

/**
 * Formats duration of a leave record dynamically for notifications and messages
 * Examples: "1 day", "3 days", "4 hours", "46 mins", "1 hour 30 mins"
 */
export function formatLeaveDuration(record: { leave_type: string; leave_hour?: string | null; dates?: string[] }): string {
  if (record.leave_type === 'Short Leave' || record.leave_type === 'Early Leave') {
    if (record.leave_hour) {
      const parts = String(record.leave_hour).split(':');
      if (parts.length >= 2) {
        const hrs = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        if (hrs > 0 && mins > 0) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ${mins} mins`;
        if (hrs > 0) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'}`;
        if (mins > 0) return `${mins} mins`;
      }
      return `${record.leave_hour} hours`;
    }
    return '1 hour';
  }
  const count = (record.dates && record.dates.length) || 1;
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}


export const parseDateToMs = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 0;
  const str = String(dateStr).trim();
  if (!str) return 0;

  // 1. Check DD-MM-YYYY or DD/MM/YYYY format
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const ms = new Date(`${year}-${month}-${day}T00:00:00`).getTime();
    if (!isNaN(ms)) return ms;
  }

  // 2. Standard ISO / YYYY-MM-DD format
  const ISO_STR = str.includes('T') ? str : `${str}T00:00:00`;
  const ms = new Date(ISO_STR).getTime();
  if (!isNaN(ms)) return ms;

  // Fallback: standard Date.parse
  const fallback = Date.parse(str);
  return isNaN(fallback) ? 0 : fallback;
};

/**
 * Sorts an array of leave records in descending order (latest date first).
 * If dates are identical, falls back to created_at / submitted_at / timestamp descending (newest submission first).
 */
export function sortChutiRecordsDescending<T extends { date?: string | null; created_at?: string | null; submitted_at?: string | null; timestamp?: string | null }>(records: T[]): T[] {
  if (!records || !Array.isArray(records)) return [];
  return [...records].sort((a, b) => {
    const dateA = parseDateToMs(a.date);
    const dateB = parseDateToMs(b.date);

    if (dateB !== dateA) {
      return dateB - dateA; // Latest date first
    }

    // Secondary sort by created_at / submitted_at / timestamp
    const timeA = parseDateToMs(a.created_at || a.submitted_at || a.timestamp);
    const timeB = parseDateToMs(b.created_at || b.submitted_at || b.timestamp);
    return timeB - timeA;
  });
}

/**
 * Calculates total number of days in the running month (e.g. 28, 29, 30, or 31)
 * based on the provided date string (YYYY-MM-DD or DD-MM-YYYY), or defaults to current month.
 */
export function getMaxDaysInMonth(dateString?: string): number {
  if (!dateString) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  const cleanDate = dateString.trim();
  if (!cleanDate) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  const parts = cleanDate.split(/[-/]/);
  let year = new Date().getFullYear();
  let month = new Date().getMonth(); // 0-indexed

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
    } else {
      // DD-MM-YYYY
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  }

  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
    const d = new Date(cleanDate);
    if (!isNaN(d.getTime())) {
      return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  return new Date(year, month + 1, 0).getDate();
}

