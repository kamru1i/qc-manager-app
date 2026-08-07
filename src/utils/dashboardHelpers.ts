import { ChutiRecord, generateUUID } from '@/utils/offlineSync';
import { LeaveSettlement } from '@/types';
import {
  SanitizerRule,
  resolveSanitizerRules,
  enabledSanitizerWords,
} from '@/utils/fileNameSanitizer';

export interface GlobalSettings {
  office_leave_mode?: 'split' | 'merged';
  office_leave_h1: number;
  office_leave_h2: number;
  office_leave_split_h1?: number;
  office_leave_split_h2?: number;
  /** @deprecated Use office_leave_h1 + office_leave_h2 instead. Kept for backward compatibility. */
  office_leave_default?: number;
  eid_fitr_leave: number;
  eid_adha_leave: number;
  govt_holidays: any[]; // Supports date strings or { date: string; name: string } objects
  settlement_active_year?: string | null;
  settlement_active_period?: 'H1' | 'H2' | 'Instant' | null;
  settlement_active_category?: 'Office Leave' | 'Govt Holiday' | 'Eid-ul-Fitr' | 'Eid-ul-Adha' | null;
  /** @deprecated legacy custom-only list; superseded by sanitizer_rules. Still read for seeding. */
  sanitizer_words?: string[];
  /** Superadmin-managed filename sanitizer rules (word + enabled). Seeded from defaults on first run. */
  sanitizer_rules?: SanitizerRule[];
  /**
   * Superadmin-managed per-role tab/subtab visibility.
   * Shape: { [role]: { [tabKey]: boolean } }. A tab is hidden for a role only
   * when explicitly set to false; absent = visible (default allow).
   */
  role_visibility?: Record<string, Record<string, boolean>>;
  /** Superadmin feature flags. flagKey -> enabled. Absent or true = ON
   * (default), only explicit false disables. Gates functionality, not nav.
   */
  feature_flags?: Record<string, boolean>;
  /** Superadmin per-user feature flag overrides stored on user's profile. */
  user_feature_flags?: Record<string, boolean>;
  /** Superadmin-configured flags that Admins are allowed to manage globally and per-user. */
  admin_delegated_flags?: Record<string, boolean>;
  /** Superadmin time-boxed per-role tab overrides (auto-expire client-side). */
  temp_access?: TempAccessEntry[];
  /** Managed VPN list for Quotes Copy Helper dashboard. */
  vpn_list?: string[];
}

export const DEFAULT_VPN_LIST: string[] = [
  'ExpressVPN',
  'NordVPN',
  'Surfshark',
  'CyberGhost',
  'ProtonVPN',
  'Mullvad',
  'PureVPN',
  'PIA',
  'Windscribe',
  'VyprVPN',
  'TunnelBear',
  'PrivateVPN',
];

/** A time-boxed grant/revoke of a tab for a role. Ignored past expires_at. */
export interface TempAccessEntry {
  target_type?: 'role' | 'user';
  user_id?: string;
  user_codename?: string;
  role: string;
  tabKey: string;
  action: 'grant' | 'revoke';
  expires_at: string; // ISO timestamp
  comment?: string;
}

export const defaultGlobalSettings: GlobalSettings = {
  office_leave_mode: 'split',
  office_leave_h1: 7,
  office_leave_h2: 7,
  eid_fitr_leave: 0,
  eid_adha_leave: 0,
  govt_holidays: []
};

/** Helper: synchronously load initial global settings from local cache to prevent flash on reload */
export const getInitialGlobalSettings = (): GlobalSettings => {
  let fallbackMode: 'split' | 'merged' = 'split';
  if (typeof window !== 'undefined') {
    try {
      const savedMode = localStorage.getItem('qc_office_leave_mode');
      if (savedMode === 'merged' || savedMode === 'split') {
        fallbackMode = savedMode;
      }

      // 1. Priority: global_settings_cache
      const rawGs = localStorage.getItem('global_settings_cache');
      if (rawGs) {
        const parsedGs = JSON.parse(rawGs);
        if (parsedGs && typeof parsedGs === 'object') {
          const derived = deriveH1H2(parsedGs);
          const finalMode = savedMode === 'merged' ? 'merged' : derived.mode;
          if (finalMode === 'merged') {
            localStorage.setItem('qc_office_leave_mode', 'merged');
          }
          return {
            ...defaultGlobalSettings,
            ...parsedGs,
            office_leave_mode: finalMode,
            office_leave_h1: finalMode === 'merged' ? (parsedGs.office_leave_default ?? parsedGs.office_leave_h1 ?? 14) : derived.h1,
            office_leave_h2: finalMode === 'merged' ? 0 : derived.h2,
          };
        }
      }

      // 2. Priority: find cached profiles in localStorage (prefer admin role or explicit office_leave_mode)
      let foundSettings: GlobalSettings | null = null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cached_profile_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const cachedProfile = JSON.parse(raw);
            if (cachedProfile && cachedProfile.global_settings) {
              const res = getGlobalSettingsFromProfile(cachedProfile);
              if (cachedProfile.role === 'admin' || res.office_leave_mode === 'merged') {
                foundSettings = res;
                break;
              }
              if (!foundSettings) foundSettings = res;
            }
          }
        }
      }
      if (foundSettings) {
        if (savedMode === 'merged' && foundSettings.office_leave_mode !== 'merged') {
          return { ...foundSettings, office_leave_mode: 'merged', office_leave_h2: 0 };
        }
        return foundSettings;
      }
    } catch (e) {
      console.warn('Error reading initial global settings from storage:', e);
    }
  }

  if (fallbackMode === 'merged') {
    return { ...defaultGlobalSettings, office_leave_mode: 'merged', office_leave_h1: 14, office_leave_h2: 0 };
  }

  return defaultGlobalSettings;
};

/** Helper: derive H1/H2 from legacy office_leave_default if new fields are missing */
const deriveH1H2 = (gs: any): { h1: number; h2: number; mode: 'split' | 'merged' } => {
  let mode: 'split' | 'merged' = 'split';
  if (gs.office_leave_mode === 'merged' || (gs.office_leave_h2 === 0 && gs.office_leave_mode !== 'split')) {
    mode = 'merged';
  } else if (gs.office_leave_mode === 'split') {
    mode = 'split';
  }

  if (mode === 'merged') {
    const total = Number(
      gs.office_leave_default ??
      (gs.office_leave_h1 != null ? gs.office_leave_h1 : 14)
    );
    return { h1: total, h2: 0, mode: 'merged' };
  }
  if (gs.office_leave_h1 != null && gs.office_leave_h2 != null) {
    return { h1: Number(gs.office_leave_h1), h2: Number(gs.office_leave_h2), mode: 'split' };
  }
  const total = Number(gs.office_leave_default ?? 14);
  return { h1: Math.floor(total / 2), h2: total - Math.floor(total / 2), mode: 'split' };
};

export const parseHolidayItem = (item: any): { date: string; name: string } => {
  if (item && typeof item === 'object' && item.date) {
    return { date: item.date, name: item.name || 'Government Holiday' };
  }
  return { date: String(item), name: 'Government Holiday' };
};

export const findAdminProfileWithGlobalSettings = (profilesList: any[], currentProfile?: any): any => {
  if (currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'superadmin') && currentProfile.global_settings) {
    try {
      const gs = typeof currentProfile.global_settings === 'string' ? JSON.parse(currentProfile.global_settings) : currentProfile.global_settings;
      if (gs && typeof gs === 'object' && Array.isArray(gs.govt_holidays) && gs.govt_holidays.length > 0) {
        return currentProfile;
      }
    } catch (e) {}
  }

  const adminWithHolidays = (profilesList || []).find((p) => {
    if (!p || (p.role !== 'admin' && p.role !== 'superadmin') || !p.global_settings) return false;
    try {
      const gs = typeof p.global_settings === 'string' ? JSON.parse(p.global_settings) : p.global_settings;
      return gs && typeof gs === 'object' && Array.isArray(gs.govt_holidays) && gs.govt_holidays.length > 0;
    } catch (e) {
      return false;
    }
  });
  if (adminWithHolidays) return adminWithHolidays;

  const adminWithSettings = (profilesList || []).find((p) => {
    if (!p || (p.role !== 'admin' && p.role !== 'superadmin') || !p.global_settings) return false;
    try {
      const gs = typeof p.global_settings === 'string' ? JSON.parse(p.global_settings) : p.global_settings;
      return gs && typeof gs === 'object' && Object.keys(gs).length > 0;
    } catch (e) {
      return false;
    }
  });
  if (adminWithSettings) return adminWithSettings;

  if (currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'superadmin')) return currentProfile;
  return (profilesList || []).find((p) => p && (p.role === 'admin' || p.role === 'superadmin')) || currentProfile || null;
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
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('qc_office_leave_mode', derived.mode);
          } catch (e) {}
        }
        return {
          office_leave_mode: derived.mode,
          office_leave_h1: derived.h1,
          office_leave_h2: derived.h2,
          office_leave_split_h1: gs.office_leave_split_h1 != null ? Number(gs.office_leave_split_h1) : undefined,
          office_leave_split_h2: gs.office_leave_split_h2 != null ? Number(gs.office_leave_split_h2) : undefined,
          office_leave_default: Number(gs.office_leave_default ?? (derived.h1 + derived.h2)),
          eid_fitr_leave: Number(gs.eid_fitr_leave ?? 0),
          eid_adha_leave: Number(gs.eid_adha_leave ?? 0),
          govt_holidays: Array.isArray(gs.govt_holidays) ? gs.govt_holidays : [],
          settlement_active_year: gs.settlement_active_year || null,
          settlement_active_period: gs.settlement_active_period || null,
          settlement_active_category: gs.settlement_active_category || null,
          sanitizer_words: Array.isArray(gs.sanitizer_words) ? gs.sanitizer_words : [],
          sanitizer_rules: Array.isArray(gs.sanitizer_rules) ? gs.sanitizer_rules : undefined,
          role_visibility: (gs.role_visibility && typeof gs.role_visibility === "object") ? gs.role_visibility : undefined,
          feature_flags: (gs.feature_flags && typeof gs.feature_flags === "object") ? gs.feature_flags : undefined,
          admin_delegated_flags: (gs.admin_delegated_flags && typeof gs.admin_delegated_flags === "object") ? gs.admin_delegated_flags : undefined,
          temp_access: Array.isArray(gs.temp_access) ? gs.temp_access : undefined,
          vpn_list: Array.isArray(gs.vpn_list) && gs.vpn_list.length > 0 ? gs.vpn_list : DEFAULT_VPN_LIST
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
          settlement_active_category: gs.settlement_active_category || null,
          sanitizer_words: Array.isArray(gs.sanitizer_words) ? gs.sanitizer_words : [],
          sanitizer_rules: Array.isArray(gs.sanitizer_rules) ? gs.sanitizer_rules : undefined,
          role_visibility: (gs.role_visibility && typeof gs.role_visibility === "object") ? gs.role_visibility : undefined,
          feature_flags: (gs.feature_flags && typeof gs.feature_flags === "object") ? gs.feature_flags : undefined,
          admin_delegated_flags: (gs.admin_delegated_flags && typeof gs.admin_delegated_flags === "object") ? gs.admin_delegated_flags : undefined,
          temp_access: Array.isArray(gs.temp_access) ? gs.temp_access : undefined,
          vpn_list: Array.isArray(gs.vpn_list) && gs.vpn_list.length > 0 ? gs.vpn_list : DEFAULT_VPN_LIST
        };
      }
    } catch (e) {
      console.error('Error parsing fallback settings:', e);
    }
  }
  
  return defaultGlobalSettings;
};

/**
 * Effective sanitizer rules for a profile's global settings, with defaults
 * seeded on first run (so the list is never empty and existing hardcoded
 * behavior is preserved). Single source of truth for the sanitizer UI.
 */
export const getSanitizerRules = (globalSettings: GlobalSettings): SanitizerRule[] =>
  resolveSanitizerRules(globalSettings.sanitizer_rules, globalSettings.sanitizer_words);

/** Enabled sanitizer words derived from settings — feed to buildCleanFileName. */
export const getSanitizerWords = (globalSettings: GlobalSettings): string[] =>
  enabledSanitizerWords(getSanitizerRules(globalSettings));

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

  if (type === 'Overtime') {
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
  isMergedMode?: boolean;
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

  const isMergedMode = officeLeaveH2 === 0;

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
      if (isMergedMode || month <= 6) {
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
      if (isMergedMode || month <= 6) {
        h1Taken += dayEquivalent;
      } else {
        h2Taken += dayEquivalent;
      }
    }
  });

  // Calculate H1 carry forward dynamically based on H1 settlement
  let carryForward = 0;
  if (leaveSettlements && userId) {
    const h1Settlements = leaveSettlements.filter(
      (s) => s.user_id === userId && s.year === selectedYear && s.period === 'H1' && s.leave_category === 'Office Leave'
    );
    if (h1Settlements.length > 0) {
      const activeSettlement = h1Settlements.find((s) => s.status === 'processed' || s.status === 'responded');
      if (activeSettlement) {
        carryForward = getSettlementSplits(activeSettlement).carry_forward;
      }
    }
  }

  const h1TotalAllocated = isMergedMode ? (h1Quota + carryForward) : h1Quota;
  let h1Remaining = h1TotalAllocated - h1Taken;
  if (leaveSettlements && userId && !isMergedMode) {
    const h1Settlements = leaveSettlements.filter(
      (s) => s.user_id === userId && s.year === selectedYear && s.period === 'H1' && s.leave_category === 'Office Leave'
    );
    if (h1Settlements.length > 0) {
      const activeSettlement = h1Settlements.find((s) => s.status === 'processed' || s.status === 'responded');
      if (activeSettlement && ignoreSettlementPeriod !== 'H1' && ignoreSettlementPeriod !== 'all') {
        h1Remaining = 0;
      }
    }
  }

  const h2Total = h2Quota + carryForward;
  let h2Remaining = h2Total - h2Taken;
  if (leaveSettlements && userId) {
    const h2Settlements = leaveSettlements.filter(
      (s) => s.user_id === userId && s.year === selectedYear && (s.period === 'H2' || (s.period as string) === 'Full Year') && s.leave_category === 'Office Leave'
    );
    if (h2Settlements.length > 0) {
      const activeSettlement = h2Settlements.find((s) => s.status === 'processed' || s.status === 'responded');
      if (activeSettlement && ignoreSettlementPeriod !== 'H2' && ignoreSettlementPeriod !== 'all') {
        h2Remaining = 0;
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
    currentHalf = now.getMonth() >= 6 ? 2 : 1;
  }

  return {
    h1Base: officeLeaveH1,
    h1Total: h1TotalAllocated,
    h1Taken,
    h1Remaining,
    carryForward,
    h2Base: officeLeaveH2,
    h2Total,
    h2Taken,
    h2Remaining,
    currentHalf,
    isMergedMode,
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

// ─── Short-leave break time ──────────────────────────────────────────
// Office rule: a user who signs in at least 1 hour after their shift start
// may log a break (01–40 min). The break COUNTS AS short leave, so it is
// added on top of the calculated short-leave duration. Stored as a comment
// marker (no dedicated column) and re-parsed on edit, mirroring the Jummah
// adjustment pattern above.
export const BREAK_MIN_MINUTES = 1;
export const BREAK_MAX_MINUTES = 40;
const BREAK_COMMENT_MARKER_RE = /(\d{1,2})\s*Min Break Added/;
// Global variant used only for stripping (has its own lastIndex; never reused for capture).
const BREAK_COMMENT_STRIP_RE = /\s*\|?\s*\d{1,2}\s*Min Break Added/g;

/**
 * Minutes the user signed in AFTER their shift start. Mirrors the shift-relative
 * wrap handling in calculateLeaveOrOvertime so late nights aren't misread.
 */
export const getShortLeaveLateMinutes = (signInTime: string, shiftStart: string): number => {
  if (!signInTime || !shiftStart) return 0;
  const shiftMins = parseTimeToMinutes(shiftStart);
  let signMins = parseTimeToMinutes(signInTime);
  if (signMins < shiftMins - 4 * 60) {
    signMins += 24 * 60;
  }
  return signMins - shiftMins;
};

/** Break option is offered only for Short Leave when signed in MORE than 1 hour late (e.g. shift 1PM → shows at 2:01PM+, not at exactly 2PM). */
export const isBreakEligible = (
  leaveType: string,
  signInTime: string,
  shiftStart: string,
): boolean => {
  if (leaveType !== 'Short Leave') return false;
  return getShortLeaveLateMinutes(signInTime, shiftStart) > 60;
};

/** Adds the break minutes (clamped 0–40) to a short-leave duration string. */
export const addBreakToShortLeave = (
  leaveHourStr: string,
  breakMinutes: number,
  enabled: boolean,
): string => {
  if (!enabled || !breakMinutes || breakMinutes <= 0 || !leaveHourStr) {
    return leaveHourStr;
  }
  if (leaveHourStr.startsWith('-')) {
    return leaveHourStr; // Ignore negative bounds
  }
  const clamped = Math.min(BREAK_MAX_MINUTES, Math.max(0, Math.round(breakMinutes)));
  return formatDuration(parseTimeToMinutes(leaveHourStr) + clamped);
};

/** Reads a previously-stored break duration back out of a comment (null if none). */
export const parseBreakMinutesFromComment = (comment: string | null | undefined): number | null => {
  if (!comment) return null;
  const m = comment.match(BREAK_COMMENT_MARKER_RE);
  return m ? Number(m[1]) : null;
};

/** Removes any existing break marker, then re-appends one when enabled. */
export const applyBreakComment = (
  comment: string,
  breakMinutes: number,
  enabled: boolean,
): string => {
  const cleaned = (comment || '').replace(BREAK_COMMENT_STRIP_RE, '').trim();
  if (enabled && breakMinutes > 0) {
    const marker = `${Math.round(breakMinutes)} Min Break Added`;
    return cleaned ? `${cleaned} | ${marker}` : marker;
  }
  return cleaned;
};

/**
 * Safely parses any date string (YYYY-MM-DD, ISO string, or DD-MM-YYYY) into milliseconds timestamp.
 */
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

