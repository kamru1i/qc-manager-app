import { AttendanceDaily, AttendanceBreak } from "@/types";

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
 * Calculates net working seconds for a daily attendance record and its break sessions
 */
export function calculateWorkingSeconds(
  daily: AttendanceDaily | null,
  breaks: AttendanceBreak[],
  nowMs: number
): number {
  if (!daily?.join_time) return 0;
  const isClosed = daily.status === "CLOSED";
  const joinMs = new Date(daily.join_time).getTime();
  const endMs = isClosed && daily.close_time ? new Date(daily.close_time).getTime() : nowMs;

  const grossSeconds = Math.max(0, Math.floor((endMs - joinMs) / 1000));

  let totalBreakSeconds = 0;
  breaks.forEach((b) => {
    if (b.end_time) {
      const s = new Date(b.start_time).getTime();
      const e = new Date(b.end_time).getTime();
      totalBreakSeconds += Math.max(0, Math.floor((e - s) / 1000));
    } else if (!isClosed) {
      // Active break
      const s = new Date(b.start_time).getTime();
      totalBreakSeconds += Math.max(0, Math.floor((nowMs - s) / 1000));
    }
  });

  return Math.max(0, grossSeconds - totalBreakSeconds);
}

/**
 * Calculates elapsed seconds for a single break session
 */
export function calculateBreakSessionSeconds(
  b: AttendanceBreak,
  nowMs: number
): number {
  const startMs = new Date(b.start_time).getTime();
  if (b.end_time) {
    const endMs = new Date(b.end_time).getTime();
    return Math.max(0, Math.floor((endMs - startMs) / 1000));
  }
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
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
 * Covers: join_time, close_time, updated_at, break start/end times
 */
export function getLatestAttendanceActivityTimestamp(
  daily: AttendanceDaily | null,
  breaks: AttendanceBreak[]
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
