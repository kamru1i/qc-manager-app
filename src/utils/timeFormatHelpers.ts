import { useState, useEffect } from 'react';
import { formatTimeToAMPM } from '@/utils/quotesDashboardHelpers';

/**
 * Detects whether the user's browser / operating system environment
 * prefers 24-hour (international) time format or 12-hour (AM/PM) format.
 *
 * Checks:
 * 1. Intl.DateTimeFormat().resolvedOptions().hour12 (boolean)
 * 2. Intl.DateTimeFormat().resolvedOptions().hourCycle ('h11' | 'h12' | 'h23' | 'h24')
 * 3. Empirical formatting fallback at 13:00 (1 PM)
 */
export function detect24HourPreference(locale?: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric' });
    const resolved = formatter.resolvedOptions();

    if (typeof resolved.hour12 === 'boolean') {
      return !resolved.hour12;
    }
    if (resolved.hourCycle) {
      return resolved.hourCycle === 'h23' || resolved.hourCycle === 'h24';
    }

    // Empirical fallback formatting with 13:00 (1 PM)
    const testDate = new Date(2026, 0, 1, 13, 0, 0);
    const formatted = formatter.format(testDate);
    return formatted.includes('13');
  } catch {
    return false;
  }
}

/**
 * Formats a canonical "HH:mm" time string for input display according to locale preference.
 * - 24-hour mode: "13:00", "22:30", "00:00"
 * - 12-hour mode: "01:00 PM", "10:30 PM", "12:00 AM"
 */
export function formatTimeForDisplay(timeStr: string | null | undefined, is24Hour: boolean): string {
  if (!timeStr) return '';
  const clean = String(timeStr).trim();
  if (!clean) return '';

  if (is24Hour) {
    const parts = clean.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    return clean.substring(0, 5);
  }

  return formatTimeToAMPM(clean);
}

/**
 * Converts any time string (12-hour with AM/PM or 24-hour) into canonical "HH:mm" format.
 * Examples:
 *   "01:00 PM" -> "13:00"
 *   "12:00 AM" -> "00:00"
 *   "12:00 PM" -> "12:00"
 *   "13:00"    -> "13:00"
 *   "00:30"    -> "00:30"
 */
export function parseToCanonicalTime(inputStr: string | null | undefined): string {
  if (!inputStr) return '';
  const trimmed = String(inputStr).trim();
  if (!trimmed) return '';

  // Check if it has AM / PM designation
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const ampm = match12[3] ? match12[3].toUpperCase() : null;

    if (ampm) {
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // Handle standard 24h "HH:mm" or "HH:mm:ss"
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return trimmed;
}

/**
 * React hook to access user's preferred time format preference (12h vs 24h).
 * Avoids SSR hydration mismatch by detecting on client mount.
 */
export function usePreferredTimeFormat(): { is24Hour: boolean } {
  const [is24Hour, setIs24Hour] = useState<boolean>(false);

  useEffect(() => {
    setIs24Hour(detect24HourPreference());
  }, []);

  return { is24Hour };
}
