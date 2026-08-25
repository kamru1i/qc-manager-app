import { SanitizerRule, resolveSanitizerRules, enabledSanitizerWords } from '@/utils/fileNameSanitizer';

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
}

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
      const profileKeys = Object.keys(localStorage).filter((k) => k.startsWith('cached_profile_'));
      for (const key of profileKeys) {
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

export const parseHolidayItem = (item: any): { date: string; name: string; created_at?: string } => {
  if (item && typeof item === 'object' && item.date) {
    return { date: item.date, name: item.name || 'Government Holiday', created_at: item.created_at };
  }
  return { date: String(item), name: 'Government Holiday' };
};

export const findAdminProfileWithGlobalSettings = (profilesList: any[], currentProfile?: any): any => {
  const superAdmin = (profilesList || []).find((p) => p && p.role === 'superadmin');
  if (superAdmin) return superAdmin;

  const firstAdmin = (profilesList || []).find((p) => p && p.role === 'admin');
  if (firstAdmin) return firstAdmin;

  if (currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'superadmin')) {
    return currentProfile;
  }

  return null;
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
          temp_access: Array.isArray(gs.temp_access) ? gs.temp_access : undefined
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
          temp_access: Array.isArray(gs.temp_access) ? gs.temp_access : undefined
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

