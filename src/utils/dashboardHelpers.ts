import { ChutiRecord, generateUUID } from '@/utils/offlineSync';
import { LeaveSettlement } from '@/types';

export interface GlobalSettings {
  office_leave_h1: number;
  office_leave_h2: number;
  /** @deprecated Use office_leave_h1 + office_leave_h2 instead. Kept for backward compatibility. */
  office_leave_default?: number;
  eid_fitr_leave: number;
  eid_adha_leave: number;
  govt_holidays: any[]; // Supports date strings or { date: string; name: string } objects
  settlement_active_year?: string | null;
  settlement_active_period?: 'H1' | 'H2' | 'Instant' | null;
  settlement_active_category?: 'Office Leave' | 'Govt Holiday' | 'Eid-ul-Fitr' | 'Eid-ul-Adha' | null;
}

export const defaultGlobalSettings: GlobalSettings = {
  office_leave_h1: 7,
  office_leave_h2: 7,
  eid_fitr_leave: 0,
  eid_adha_leave: 0,
  govt_holidays: []
};

/** Helper: derive H1/H2 from legacy office_leave_default if new fields are missing */
const deriveH1H2 = (gs: any): { h1: number; h2: number } => {
  if (gs.office_leave_h1 != null && gs.office_leave_h2 != null) {
    return { h1: Number(gs.office_leave_h1), h2: Number(gs.office_leave_h2) };
  }
  const total = Number(gs.office_leave_default ?? 14);
  return { h1: Math.floor(total / 2), h2: total - Math.floor(total / 2) };
};

export const parseHolidayItem = (item: any): { date: string; name: string } => {
  if (item && typeof item === 'object' && item.date) {
    return { date: item.date, name: item.name || 'Government Holiday' };
  }
  return { date: String(item), name: 'Government Holiday' };
};

export const getGlobalSettingsFromProfile = (profile: any): GlobalSettings => {
  if (!profile) return defaultGlobalSettings;
  
  if (profile.global_settings) {
    try {
      const gs = typeof profile.global_settings === 'string'
        ? JSON.parse(profile.global_settings)
        : profile.global_settings;
      if (gs && typeof gs === 'object') {
        const derived = deriveH1H2(gs);
        return {
          office_leave_h1: derived.h1,
          office_leave_h2: derived.h2,
          office_leave_default: Number(gs.office_leave_default ?? 14),
          eid_fitr_leave: Number(gs.eid_fitr_leave ?? 0),
          eid_adha_leave: Number(gs.eid_adha_leave ?? 0),
          govt_holidays: Array.isArray(gs.govt_holidays) ? gs.govt_holidays : [],
          settlement_active_year: gs.settlement_active_year || null,
          settlement_active_period: gs.settlement_active_period || null,
          settlement_active_category: gs.settlement_active_category || null
        };
      }
    } catch (e) {
      console.error('Error parsing global_settings:', e);
    }
  }
  
  if (profile.requested_default_sign_in && profile.requested_default_sign_in.startsWith('{')) {
    try {
      const gs = JSON.parse(profile.requested_default_sign_in);
      if (gs && typeof gs === 'object') {
        const derived = deriveH1H2(gs);
        return {
          office_leave_h1: derived.h1,
          office_leave_h2: derived.h2,
          office_leave_default: Number(gs.office_leave_default ?? 14),
          eid_fitr_leave: Number(gs.eid_fitr_leave ?? 0),
          eid_adha_leave: Number(gs.eid_adha_leave ?? 0),
          govt_holidays: Array.isArray(gs.govt_holidays) ? gs.govt_holidays : [],
          settlement_active_year: gs.settlement_active_year || null,
          settlement_active_period: gs.settlement_active_period || null,
          settlement_active_category: gs.settlement_active_category || null
        };
      }
    } catch (e) {
      console.error('Error parsing fallback settings:', e);
    }
  }
  
  return defaultGlobalSettings;
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
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
};

export const escapeHtml = (unsafeStr: unknown): string => {
  if (unsafeStr === null || unsafeStr === undefined) return '';
  return unsafeStr
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

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
        if (hasCategoryAdj) {
          if (isOfficeLeave) officeLeavesTaken++;
          else if (isEidFitr) eidFitrTaken++;
          else if (isEidAdha) eidAdhaTaken++;
          else if (isGovtHoliday) govtHolidaysTaken++;
        } else {
          if (!r.adjustment) totalFullLeaves++;
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

            if (isOfficeLeaveShort || isEidFitrShort || isEidAdhaShort || isGovtHolidayShort) {
              const daysEquivalent = fullAdjMins / (workingHours * 60);
              const signedDaysEquivalent = isNegative ? -daysEquivalent : daysEquivalent;
              if (isOfficeLeaveShort) officeLeavesTaken += signedDaysEquivalent;
              else if (isEidFitrShort) eidFitrTaken += signedDaysEquivalent;
              else if (isEidAdhaShort) eidAdhaTaken += signedDaysEquivalent;
              else if (isGovtHolidayShort) govtHolidaysTaken += signedDaysEquivalent;
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
              totalOvertimeMinutes -= isNegative ? -adjMins : adjMins;
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
    if (isHoliday) {
      return formatDuration(Math.max(0, worked));
    } else {
      const regular = workingHours * 60;
      return formatDuration(Math.max(0, worked - regular));
    }
  }
  return '00:00';
};

export const getLeaveValidationError = (
  type: string,
  signInTime: string,
  signOutTime: string,
  workingHours: number = 9.5,
  isHoliday: boolean = false
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

  if (type === 'Short Leave') {
    if (workedMins >= regularMins) {
      return 'Short leave must be less than working time';
    }
  } else if (type === 'Overtime') {
    if (!isHoliday && workedMins <= regularMins) {
      return 'Overtime must be extra from working hour';
    }
    if (isHoliday && workedMins === 0) {
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
export const formatTimeToAMPM = (timeStr: string | null) => {
  if (!timeStr) return '-';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour should be 12
  const formattedHours = String(hours).padStart(2, '0');
  return `${formattedHours}:${minutes} ${ampm}`;
};

export const getDetailedLeaveLabel = (rec: { leave_type: string; reserve_holiday?: string | null }) => {
  return rec.leave_type;
};

export interface HalfYearlyOfficeLeaveStats {
  h1Base: number;
  h1Total: number;
  h1Taken: number;
  h1Remaining: number;
  carryForward: number;
  h2Base: number;
  h2Total: number;
  h2Taken: number;
  h2Remaining: number;
  currentHalf: 1 | 2;
}

export const getSettlementSplits = (s: LeaveSettlement) => {
  const carry_forward = s.carry_forward_days ?? (s.action_type === 'carry_forward' ? s.remaining_days : 0);
      const payment = s.payment_days ?? (s.action_type === 'payment' ? s.remaining_days : 0);
  const adjust_leave = s.adjust_leave_days ?? (s.action_type === 'adjust_leave' ? s.remaining_days : 0);
  return { carry_forward, payment, adjust_leave };
};

export const getSettlementLabel = (s: LeaveSettlement, workingHours: number = 9.5): string => {
  if (s.remaining_days < 0) {
    if (s.action_type === 'payment') {
      return 'Salary Deduction';
    }
    if (s.action_type === 'carry_forward') {
      return s.period === 'H1' ? 'Adjust with H2 Office Leave' : "Adjust with Next Year's H1";
    }
    if (s.action_type === 'adjust_leave') {
      return 'Adjust with Holiday/Eid Reserve';
    }
    return 'Salary Deduction';
  }
  if (s.action_type === 'split') {
    const parts: string[] = [];
    const splits = getSettlementSplits(s);
    if (splits.carry_forward > 0) parts.push(`${formatDaysAndHours(splits.carry_forward, workingHours)} Carry Forward`);
    if (splits.payment > 0) parts.push(`${formatDaysAndHours(splits.payment, workingHours)} Cash Out`);
    if (splits.adjust_leave > 0) parts.push(`${formatDaysAndHours(splits.adjust_leave, workingHours)} Adjust`);
    return parts.length > 0 ? parts.join(', ') : 'Split';
  }
  return s.action_type === 'carry_forward' ? 'Carry Forward' : s.action_type === 'payment' ? 'Cash Out' : 'Adjust Leaves';
};

export const calculateHalfYearlyOfficeLeave = (
  records: ChutiRecord[],
  officeLeaveH1: number,
  officeLeaveH2: number,
  selectedYear: string,
  leaveSettlements?: LeaveSettlement[],
  userId?: string,
  ignoreSettlementPeriod?: 'H1' | 'H2' | 'Instant' | 'all',
  workingHours: number = 9.5
): HalfYearlyOfficeLeaveStats => {
  // 1. Calculate carried over office leave from previous year
  let carriedOffice = 0;
  if (leaveSettlements && userId) {
    const prevYear = (Number(selectedYear) - 1).toString();
    carriedOffice = leaveSettlements
      .filter((s) => s.user_id === userId && s.year === prevYear && s.leave_category === 'Office Leave')
      .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);
  }

  // 2. Base quotas: H1 uses admin-set h1 quota + any carried over from previous year.
  const h1Quota = officeLeaveH1 + carriedOffice;
  const h2Quota = officeLeaveH2;

  // Filter approved full-day/short-day records for the selected year and target user
  const approvedRecs = records.filter(r => 
    r.status === 'approved' && 
    r.date && 
    r.date.substring(0, 4) === selectedYear &&
    (!userId || r.user_id === userId)
  );

  let h1Taken = 0;
  let h2Taken = 0;

  approvedRecs.forEach(r => {
    const isFullLeave = r.leave_type === 'Full Leave';
    const isShortLeave = r.leave_type === 'Short Leave';

    if (isFullLeave) {
      // Check if it should count against office leave: 
      // It should count only if it is NOT adjusted, OR if it is adjusted specifically as "Office Leave".
      const shouldCountAsOffice = !r.adjustment || (r.adjustment && (r.comment?.includes("Office Leave") || r.reserve_holiday === "Office Leave"));
      if (!shouldCountAsOffice) return;

      const month = parseInt(r.date.substring(5, 7), 10);
      if (month <= 6) {
        h1Taken += 1;
      } else {
        h2Taken += 1;
      }
    } else if (isShortLeave) {
      // Short leave only counts against office leave if it is adjusted specifically as "Office Leave"
      const shouldCountAsOffice = !r.adjustment || (r.adjustment && (r.comment?.includes("Office Leave") || r.reserve_holiday === "Office Leave"));
      if (!shouldCountAsOffice) return;

      const mins = parseIntervalToMinutes(r.leave_hour);
      const dayEquivalent = mins / (workingHours * 60);

      const month = parseInt(r.date.substring(5, 7), 10);
      if (month <= 6) {
        h1Taken += dayEquivalent;
      } else {
        h2Taken += dayEquivalent;
      }
    }
  });

  let h1Remaining = h1Quota - h1Taken;
  
  // Calculate H1 carry forward dynamically based on H1 settlement
  let carryForward = 0;
  if (leaveSettlements && userId) {
    const h1Settlements = leaveSettlements.filter(
      (s) => s.user_id === userId && s.year === selectedYear && s.period === 'H1' && s.leave_category === 'Office Leave'
    );
    if (h1Settlements.length > 0) {
      const activeSettlement = h1Settlements.find((s) => s.status === 'processed' || s.status === 'responded');
      if (activeSettlement) {
        if (ignoreSettlementPeriod !== 'H1' && ignoreSettlementPeriod !== 'all') {
          h1Remaining = 0;
        }
        carryForward = getSettlementSplits(activeSettlement).carry_forward;
      }
    }
  }

  const h2Total = h2Quota + carryForward;
  let h2Remaining = h2Total - h2Taken;
  if (leaveSettlements && userId) {
    const h2Settlements = leaveSettlements.filter(
      (s) => s.user_id === userId && s.year === selectedYear && s.period === 'H2' && s.leave_category === 'Office Leave'
    );
    if (h2Settlements.length > 0) {
      const activeSettlement = h2Settlements.find((s) => s.status === 'processed' || s.status === 'responded');
      if (activeSettlement) {
        if (ignoreSettlementPeriod !== 'H2' && ignoreSettlementPeriod !== 'all') {
          h2Remaining = 0;
        }
      }
    }
  }

  // Determine current active half
  const now = new Date();
  const currentYear = now.getFullYear().toString();
  let currentHalf: 1 | 2 = 1;
  if (selectedYear < currentYear) {
    currentHalf = 2;
  } else if (selectedYear > currentYear) {
    currentHalf = 1;
  } else {
    currentHalf = (now.getMonth() + 1) <= 6 ? 1 : 2;
  }

  return {
    h1Base: officeLeaveH1,
    h1Total: h1Quota,
    h1Taken,
    h1Remaining,
    carryForward,
    h2Base: officeLeaveH2,
    h2Total,
    h2Taken,
    h2Remaining,
    currentHalf,
  };
};

// Helper to safely extract existing notifications from a ChutiRecord's admin_edit_request
export const getExistingNotifications = (record: ChutiRecord): any[] => {
  if (record.admin_edit_request && typeof record.admin_edit_request === 'object' && 'notifications' in record.admin_edit_request) {
    return (record.admin_edit_request as { notifications?: any[] }).notifications || [];
  }
  return [];
};

// Factory to create a notification object with auto-generated id and timestamp
export const createNotification = (type: string, title: string, body: string) => ({
  id: generateUUID(),
  type,
  timestamp: new Date().toISOString(),
  title,
  body,
});

export const getOutstandingOfficeLeave = (
  records: ChutiRecord[],
  officeLeaveH1: number,
  officeLeaveH2: number,
  selectedYear: string,
  leaveSettlements: LeaveSettlement[],
  userId: string,
  workingHours: number = 9.5
): number => {
  const rawStats = calculateHalfYearlyOfficeLeave(
    records,
    officeLeaveH1,
    officeLeaveH2,
    selectedYear,
    leaveSettlements,
    userId,
    'all',
    workingHours
  );

  const h1Processed = leaveSettlements.some(
    (s) => s.user_id === userId && s.year === selectedYear && s.leave_category === 'Office Leave' && s.period === 'H1' && s.status === 'processed'
  );
  const h2Processed = leaveSettlements.some(
    (s) => s.user_id === userId && s.year === selectedYear && s.leave_category === 'Office Leave' && s.period === 'H2' && s.status === 'processed'
  );

  const h1Outstanding = !h1Processed && rawStats.h1Remaining < 0 ? -rawStats.h1Remaining : 0;
  const h2Outstanding = !h2Processed && rawStats.h2Remaining < 0 ? -rawStats.h2Remaining : 0;

  return h1Outstanding + h2Outstanding;
};

/**
 * Checks if today is Friday or if the given date string is a Friday.
 */
export const isFriday = (dateString?: string): boolean => {
  // Check if the input date is Friday
  if (dateString) {
    const parts = dateString.split('-').map(Number);
    if (parts.length === 3) {
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      return dateObj.getDay() === 5;
    }
  }
  // Fallback: Check if today is Friday
  const today = new Date();
  return today.getDay() === 5;
};

/**
 * Deducts 20 minutes from the calculated short leave duration string.
 * Ensures the value never drops below "00:00".
 */
export const adjustShortLeaveForJummah = (leaveHourStr: string, enabled: boolean): string => {
  if (!enabled || !leaveHourStr || leaveHourStr === '00:00') {
    return leaveHourStr;
  }
  if (leaveHourStr.startsWith('-')) {
    return leaveHourStr; // Ignore negative bounds
  }

  const mins = parseTimeToMinutes(leaveHourStr);
  const adjustedMins = Math.max(0, mins - 20);
  return formatDuration(adjustedMins);
};

