import { parseTimeToMinutes, formatDuration } from './leaveCalculations';

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
