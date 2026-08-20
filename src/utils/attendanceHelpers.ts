import { AttendanceDaily, AttendanceShift, AttendanceBreak } from "@/types";

/**
 * Formats an ISO string to "HH:MM:SS AM/PM" (with second-level precision)
 */
export function formatAttendanceTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "-";
  }
}

/**
 * Formats seconds into "HHh MMm SSs" format
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "00h 00m 00s";
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

/**
 * Formats total minutes (which can be fractional) into "HHh MMm SSs"
 */
export function formatDurationMinutes(totalMinutes: number): string {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return "00h 00m 00s";
  const totalSeconds = Math.round(totalMinutes * 60);
  return formatDurationSeconds(totalSeconds);
}

/**
 * Converts a "YYYY-MM-DD" string to "DD-MM-YYYY" display format
 */
export function formatDateToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/**
 * Formats a short elapsed time string for a break session, e.g. "10m 32s" or "02s"
 */
export function formatBreakSessionElapsed(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "00s";
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  }
  return `${secs}s`;
}

/**
 * Calculates elapsed seconds for a single break session
 */
export function calculateBreakSessionSeconds(
  b: AttendanceBreak,
  nowMs: number
): number {
  const startMs = new Date(b.start_time).getTime();
  if (isNaN(startMs)) return 0;
  if (b.end_time) {
    const endMs = new Date(b.end_time).getTime();
    if (isNaN(endMs)) return 0;
    return Math.max(0, Math.floor((endMs - startMs) / 1000));
  }
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

/**
 * Checks if a break belongs to a given shift session
 */
export function doesBreakBelongToShift(
  b: AttendanceBreak,
  shift: AttendanceShift
): boolean {
  if (b.shift_id && b.shift_id === shift.id) return true;
  const breakStartMs = new Date(b.start_time).getTime();
  const shiftJoinMs = new Date(shift.join_time).getTime();
  if (isNaN(breakStartMs) || isNaN(shiftJoinMs)) return false;
  if (breakStartMs < shiftJoinMs) return false;

  if (shift.close_time) {
    const shiftCloseMs = new Date(shift.close_time).getTime();
    if (!isNaN(shiftCloseMs) && breakStartMs > shiftCloseMs) return false;
  }
  return true;
}

/**
 * Calculates working seconds for a single shift session.
 * Break time is part of working time, so the working timer continues
 * running continuously from join time to close time (or current time if active).
 */
export function calculateShiftWorkingSeconds(
  shift: AttendanceShift,
  _breaks?: AttendanceBreak[],
  nowMs: number = Date.now()
): number {
  const joinMs = new Date(shift.join_time).getTime();
  if (isNaN(joinMs)) return 0;

  const isShiftClosed = !!shift.close_time;
  const endMs = isShiftClosed && shift.close_time ? new Date(shift.close_time).getTime() : nowMs;
  if (isNaN(endMs)) return 0;

  return Math.max(0, Math.floor((endMs - joinMs) / 1000));
}

/**
 * Calculates total daily working seconds across all shift sessions for a user today.
 * Break time is an integral part of working time, so working seconds accumulate continuously.
 */
export function calculateTotalDailyWorkingSeconds(
  daily: AttendanceDaily | null,
  shifts: AttendanceShift[],
  breaks: AttendanceBreak[],
  nowMs: number
): number {
  if (shifts && shifts.length > 0) {
    let totalSec = 0;
    shifts.forEach((s) => {
      totalSec += calculateShiftWorkingSeconds(s, breaks, nowMs);
    });
    return totalSec;
  }

  // Fallback for legacy single-shift daily record
  if (!daily?.join_time) return 0;
  const joinMs = new Date(daily.join_time).getTime();
  if (isNaN(joinMs)) return 0;
  const isClosed = daily.status === "CLOSED" && !!daily.close_time;
  const endMs = isClosed && daily.close_time ? new Date(daily.close_time).getTime() : nowMs;
  return Math.max(0, Math.floor((endMs - joinMs) / 1000));
}

/**
 * Legacy alias for backwards compatibility
 */
export function calculateWorkingSeconds(
  daily: AttendanceDaily | null,
  breaks: AttendanceBreak[],
  nowMs: number
): number {
  return calculateTotalDailyWorkingSeconds(daily, [], breaks, nowMs);
}

/**
 * Calculates total accumulated seconds for breaks of a given type ('snack' or 'prayer')
 */
export function calculateTotalBreakTypeSeconds(
  breaks: AttendanceBreak[],
  type: "snack" | "prayer",
  nowMs: number
): number {
  let totalSec = 0;
  breaks
    .filter((b) => b.type === type)
    .forEach((b) => {
      totalSec += calculateBreakSessionSeconds(b, nowMs);
    });
  return totalSec;
}

/**
 * Returns the most recent activity timestamp (in ms) for an employee's attendance
 * Covers: all shift joins/closes, break starts/ends, and daily updates
 */
export function getLatestAttendanceActivityTimestamp(
  daily: AttendanceDaily | null,
  shifts: AttendanceShift[] = [],
  breaks: AttendanceBreak[] = []
): number {
  let latest = 0;

  if (daily?.join_time) {
    const t = new Date(daily.join_time).getTime();
    if (!isNaN(t) && t > latest) latest = t;
  }
  if (daily?.close_time) {
    const t = new Date(daily.close_time).getTime();
    if (!isNaN(t) && t > latest) latest = t;
  }
  if (daily?.updated_at) {
    const t = new Date(daily.updated_at).getTime();
    if (!isNaN(t) && t > latest) latest = t;
  }

  shifts.forEach((s) => {
    if (s.join_time) {
      const t = new Date(s.join_time).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }
    if (s.close_time) {
      const t = new Date(s.close_time).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }
    if (s.updated_at) {
      const t = new Date(s.updated_at).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }
  });

  breaks.forEach((b) => {
    if (b.start_time) {
      const t = new Date(b.start_time).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }
    if (b.end_time) {
      const t = new Date(b.end_time).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }
    if (b.updated_at) {
      const t = new Date(b.updated_at).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    }
  });

  return latest;
}
