import { GlobalSettings, defaultGlobalSettings, UserLeaveOverrides } from '@/utils/globalSettingsHelpers';
import { Profile } from '@/types';

export interface EffectiveLeaveSettings {
  /** Active office leave mode ('split' | 'merged') */
  office_leave_mode: 'split' | 'merged';
  /** Effective annual quota (in merged mode, the annual pool; in split mode, H1 + H2) */
  office_leave_annual: number;
  /** Effective H1 quota (after override or global inheritance, and eligibility check) */
  office_leave_h1: number;
  /** Effective H2 quota (after override or global inheritance, and eligibility check) */
  office_leave_h2: number;
  /** Total annual office leave (office_leave_annual in merged, H1 + H2 in split) */
  office_leave_total: number;
  /** Raw annual allocation before eligibility zeroing */
  raw_office_leave_annual: number;
  /** Raw H1 allocation before eligibility zeroing */
  raw_office_leave_h1: number;
  /** Raw H2 allocation before eligibility zeroing */
  raw_office_leave_h2: number;
  /** Whether annual quota is currently overridden for this user */
  is_annual_overridden: boolean;
  /** Whether H1 is currently overridden for this user */
  is_h1_overridden: boolean;
  /** Whether H2 is currently overridden for this user */
  is_h2_overridden: boolean;
  /** The explicit annual override value, if present */
  annual_override_value: number | null;
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
 * 2. In Merged mode:
 *    - Uses office_leave_annual_override if present, else global annual allocation.
 *    - office_leave_h1 represents the full-year bucket (compatible with calculateHalfYearlyOfficeLeave).
 *    - office_leave_h2 is 0.
 * 3. In Split mode:
 *    - Uses office_leave_h1_override / office_leave_h2_override if present, else global H1/H2.
 * 4. Explicit 0 remains 0 and does NOT mean inherit.
 * 5. If profile.eligible_office_leave === false -> effective office leave is 0 across all quotas.
 * 6. Switching global modes preserves user overrides in the alternate mode without destructive deletion.
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

  const isMergedMode = globalSettings?.office_leave_mode === 'merged' ||
    (globalSettings?.office_leave_h2 === 0 && globalSettings?.office_leave_mode !== 'split');

  const hasAnnualOverride = typeof rawOverrides?.office_leave_annual_override === 'number';
  const hasH1Override = typeof rawOverrides?.office_leave_h1_override === 'number';
  const hasH2Override = typeof rawOverrides?.office_leave_h2_override === 'number';

  const globalH1 = globalSettings?.office_leave_h1 ?? 7;
  const globalH2 = globalSettings?.office_leave_h2 ?? 7;
  const globalAnnual = globalSettings?.office_leave_default ?? (isMergedMode ? globalH1 : (globalH1 + globalH2));

  if (isMergedMode) {
    const rawAnnual = hasAnnualOverride
      ? rawOverrides!.office_leave_annual_override!
      : globalAnnual;
    const effectiveAnnual = isEligible ? rawAnnual : 0;

    return {
      office_leave_mode: 'merged',
      office_leave_annual: effectiveAnnual,
      office_leave_h1: effectiveAnnual,
      office_leave_h2: 0,
      office_leave_total: effectiveAnnual,
      raw_office_leave_annual: rawAnnual,
      raw_office_leave_h1: rawAnnual,
      raw_office_leave_h2: 0,
      is_annual_overridden: hasAnnualOverride,
      is_h1_overridden: hasH1Override,
      is_h2_overridden: hasH2Override,
      annual_override_value: hasAnnualOverride ? rawOverrides!.office_leave_annual_override! : null,
      h1_override_value: hasH1Override ? rawOverrides!.office_leave_h1_override! : null,
      h2_override_value: hasH2Override ? rawOverrides!.office_leave_h2_override! : null,
      is_office_leave_eligible: isEligible,
    };
  }

  // Split mode
  const rawH1 = hasH1Override
    ? rawOverrides!.office_leave_h1_override!
    : globalH1;
  const rawH2 = hasH2Override
    ? rawOverrides!.office_leave_h2_override!
    : globalH2;

  const effectiveH1 = isEligible ? rawH1 : 0;
  const effectiveH2 = isEligible ? rawH2 : 0;
  const effectiveAnnual = effectiveH1 + effectiveH2;
  const rawAnnual = rawH1 + rawH2;

  return {
    office_leave_mode: 'split',
    office_leave_annual: effectiveAnnual,
    office_leave_h1: effectiveH1,
    office_leave_h2: effectiveH2,
    office_leave_total: effectiveAnnual,
    raw_office_leave_annual: rawAnnual,
    raw_office_leave_h1: rawH1,
    raw_office_leave_h2: rawH2,
    is_annual_overridden: hasAnnualOverride,
    is_h1_overridden: hasH1Override,
    is_h2_overridden: hasH2Override,
    annual_override_value: hasAnnualOverride ? rawOverrides!.office_leave_annual_override! : null,
    h1_override_value: hasH1Override ? rawOverrides!.office_leave_h1_override! : null,
    h2_override_value: hasH2Override ? rawOverrides!.office_leave_h2_override! : null,
    is_office_leave_eligible: isEligible,
  };
}
