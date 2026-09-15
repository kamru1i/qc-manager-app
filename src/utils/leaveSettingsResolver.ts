import { GlobalSettings, defaultGlobalSettings, UserLeaveOverrides } from '@/utils/globalSettingsHelpers';
import { Profile } from '@/types';

export interface EffectiveLeaveSettings {
  /** Effective H1 quota (after override or global inheritance, and eligibility check) */
  office_leave_h1: number;
  /** Effective H2 quota (after override or global inheritance, and eligibility check) */
  office_leave_h2: number;
  /** Total annual office leave (H1 + H2) */
  office_leave_total: number;
  /** Raw H1 allocation before eligibility zeroing */
  raw_office_leave_h1: number;
  /** Raw H2 allocation before eligibility zeroing */
  raw_office_leave_h2: number;
  /** Whether H1 is currently overridden for this user */
  is_h1_overridden: boolean;
  /** Whether H2 is currently overridden for this user */
  is_h2_overridden: boolean;
  /** The explicit H1 override value, if present */
  h1_override_value: number | null;
  /** The explicit H2 override value, if present */
  h2_override_value: number | null;
  /** Whether office leave is eligible for this user */
  is_office_leave_eligible: boolean;
}

/**
 * Canonical resolver for user leave settings.
 * Resolves user-specific overrides against global defaults and user eligibility.
 * 
 * Rules:
 * 1. Global Leave Settings are the default source.
 * 2. If user override exists (typeof value === 'number', including 0) -> use user override.
 * 3. If no override (null or undefined) -> inherit global value.
 * 4. Explicit 0 remains 0 and does NOT mean inherit.
 * 5. If profile.eligible_office_leave === false -> effective office leave is 0 across H1 and H2.
 */
export function resolveEffectiveLeaveSettings(
  profile: Profile | null | undefined,
  globalSettings: GlobalSettings = defaultGlobalSettings
): EffectiveLeaveSettings {
  const isEligible = profile?.eligible_office_leave !== false;

  let userGs = profile?.global_settings;
  if (typeof userGs === 'string') {
    try {
      userGs = JSON.parse(userGs);
    } catch {
      userGs = {};
    }
  }

  const rawOverrides = (userGs as Record<string, unknown> | null | undefined)?.leave_overrides as UserLeaveOverrides | undefined;

  const hasH1Override = typeof rawOverrides?.office_leave_h1_override === 'number';
  const hasH2Override = typeof rawOverrides?.office_leave_h2_override === 'number';

  const rawH1 = hasH1Override
    ? rawOverrides!.office_leave_h1_override!
    : (globalSettings?.office_leave_h1 ?? 7);

  const rawH2 = hasH2Override
    ? rawOverrides!.office_leave_h2_override!
    : (globalSettings?.office_leave_h2 ?? 7);

  const effectiveH1 = isEligible ? rawH1 : 0;
  const effectiveH2 = isEligible ? rawH2 : 0;

  return {
    office_leave_h1: effectiveH1,
    office_leave_h2: effectiveH2,
    office_leave_total: effectiveH1 + effectiveH2,
    raw_office_leave_h1: rawH1,
    raw_office_leave_h2: rawH2,
    is_h1_overridden: hasH1Override,
    is_h2_overridden: hasH2Override,
    h1_override_value: hasH1Override ? rawOverrides!.office_leave_h1_override! : null,
    h2_override_value: hasH2Override ? rawOverrides!.office_leave_h2_override! : null,
    is_office_leave_eligible: isEligible,
  };
}
