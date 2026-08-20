"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Profile,
  AttendanceDaily,
  AttendanceShift,
  AttendanceBreak,
  AttendanceStatus,
  AttendanceRowData,
} from "@/types";
import {
  Clock,
  Play,
  Square,
  Coffee,
  Sun,
  CalendarDays,
  RefreshCw,
  Calendar,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { attendanceService } from "@/services";
import { useRealtimeHandler, RealtimePayload } from "@/contexts/RealtimeContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { useAttendance } from "@/contexts/AttendanceContext";
import { canWriteAttendance } from "@/utils/permissionService";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import { ConfirmModal } from "@/components/common/modals/ConfirmModal";
import {
  formatAttendanceTime,
  formatDurationSeconds,
  formatDurationMinutes,
  formatDateToDDMMYYYY,
  formatBreakSessionElapsed,
  calculateShiftWorkingSeconds,
  calculateTotalDailyWorkingSeconds,
  calculateBreakSessionSeconds,
  calculateTotalBreakTypeSeconds,
  getLatestAttendanceActivityTimestamp,
} from "@/utils/attendanceHelpers";

interface AttendancePanelProps {
  profile: Profile | null;
}

// Module-level cache for historical daily & monthly data
const _historicalDailyCache = new Map<
  string,
  {
    dailyList: AttendanceDaily[];
    shiftsList: AttendanceShift[];
    breaksList: AttendanceBreak[];
    timestamp: number;
  }
>();
const _monthlyAttendanceCache = new Map<
  string,
  {
    dailyList: AttendanceDaily[];
    shiftsList: AttendanceShift[];
    breaksList: AttendanceBreak[];
    timestamp: number;
  }
>();

export const AttendancePanel: React.FC<AttendancePanelProps> = ({ profile }) => {
  const { profilesList } = useProfiles();
  const datePickerRef = useRef<HTMLInputElement>(null);

  // Consume shared canonical context for today's state & actions
  const attendanceContext = useAttendance();

  const [subTab, setSubTab] = useState<"daily" | "monthly">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("attendance_active_subtab");
      if (saved === "daily" || saved === "monthly") return saved;
    }
    return "daily";
  });

  useEffect(() => {
    localStorage.setItem("attendance_active_subtab", subTab);
  }, [subTab]);

  // Daily State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const todayStr = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const isToday = selectedDate === todayStr;

  // Monthly State
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [searchQuery, setSearchQuery] = useState("");

  // Historical Daily State (when selectedDate !== todayStr)
  const cachedHistorical = _historicalDailyCache.get(selectedDate);
  const [histDaily, setHistDaily] = useState<AttendanceDaily[]>(() => cachedHistorical?.dailyList || []);
  const [histShifts, setHistShifts] = useState<AttendanceShift[]>(() => cachedHistorical?.shiftsList || []);
  const [histBreaks, setHistBreaks] = useState<AttendanceBreak[]>(() => cachedHistorical?.breaksList || []);
  const [histLoading, setHistLoading] = useState(() => !cachedHistorical && !isToday);

  // Monthly State
  const cachedMonthlyKey = `${selectedYear}_${selectedMonth}`;
  const cachedMonthly = _monthlyAttendanceCache.get(cachedMonthlyKey);
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceDaily[]>(() => cachedMonthly?.dailyList || []);
  const [monthlyShifts, setMonthlyShifts] = useState<AttendanceShift[]>(() => cachedMonthly?.shiftsList || []);
  const [monthlyBreaks, setMonthlyBreaks] = useState<AttendanceBreak[]>(() => cachedMonthly?.breaksList || []);
  const [monthlyLoading, setMonthlyLoading] = useState(() => !cachedMonthly);

  // Effective datasets for current selected daily view
  const effectiveDaily = isToday ? attendanceContext.dailyAttendance : histDaily;
  const effectiveShifts = isToday ? attendanceContext.attendanceShifts : histShifts;
  const effectiveBreaks = isToday ? attendanceContext.attendanceBreaks : histBreaks;
  const effectiveLoading = isToday ? attendanceContext.loading : histLoading;
  const now = attendanceContext.now;

  // Check if selected date is Sunday
  const isSunday = useMemo(() => {
    try {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.getDay() === 0;
      }
    } catch {
      // fallback
    }
    return false;
  }, [selectedDate]);

  // Permission check
  const hasWritePermission = useMemo(() => {
    return canWriteAttendance(profile, profile?.global_settings, profilesList);
  }, [profile, profilesList]);

  // Superadmin check for granular deletion
  const isSuperAdmin = profile?.role === 'superadmin';

  // Superadmin deletion state
  const [deletingSession, setDeletingSession] = useState<{
    type: 'shift' | 'snack_break' | 'prayer_break';
    shift?: AttendanceShift;
    breakItem?: AttendanceBreak;
    employee: Profile;
    attendanceDate: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Current logged in user's status & active items
  const myStatus = isToday ? attendanceContext.myStatus : "NOT_JOINED";
  const isShiftActive = isToday && (myStatus === "WORKING" || myStatus === "SNACK_BREAK" || myStatus === "PRAYER_BREAK");

  const handleConfirmDeleteSession = async () => {
    if (!deletingSession || isDeleting) return;
    setIsDeleting(true);
    try {
      if (deletingSession.type === 'shift' && deletingSession.shift) {
        if (isToday) {
          await attendanceContext.deleteShiftSession(
            deletingSession.shift,
            deletingSession.employee.id,
            deletingSession.attendanceDate
          );
        } else {
          const { error } = await attendanceService.deleteShiftSession({
            shiftId: deletingSession.shift.id,
            attendanceId: deletingSession.shift.attendance_id,
            userId: deletingSession.employee.id,
            attendanceDate: deletingSession.attendanceDate,
          });
          if (error) throw error;
          setHistShifts((prev) => prev.filter((s) => s.id !== deletingSession.shift!.id));
          setHistBreaks((prev) => prev.filter((b) => b.shift_id !== deletingSession.shift!.id));
          fetchHistoricalDaily(true);
          toast.success('Shift session deleted successfully.');
        }
      } else if (
        (deletingSession.type === 'snack_break' || deletingSession.type === 'prayer_break') &&
        deletingSession.breakItem
      ) {
        if (isToday) {
          await attendanceContext.deleteBreakSession(
            deletingSession.breakItem,
            deletingSession.employee.id,
            deletingSession.attendanceDate
          );
        } else {
          const { error } = await attendanceService.deleteBreakSession({
            breakId: deletingSession.breakItem.id,
            attendanceId: deletingSession.breakItem.attendance_id,
            userId: deletingSession.employee.id,
            attendanceDate: deletingSession.attendanceDate,
          });
          if (error) throw error;
          setHistBreaks((prev) => prev.filter((b) => b.id !== deletingSession.breakItem!.id));
          fetchHistoricalDaily(true);
          toast.success('Break session deleted successfully.');
        }
      }
    } catch (err: unknown) {
      console.error('Failed to delete session:', err);
      toast.error('Failed to delete session: ' + ((err as Error).message || 'unknown error'));
    } finally {
      setIsDeleting(false);
      setDeletingSession(null);
    }
  };

  // Fetch Historical Daily Attendance (when selectedDate !== todayStr)
  const fetchHistoricalDaily = useCallback(
    async (isSilent = false, signal?: AbortSignal) => {
      if (isToday) return;
      if (!isSilent) setHistLoading(true);
      try {
        const [dailyRes, shiftsRes, breaksRes] = await Promise.all([
          attendanceService.getDailyAttendance({ date: selectedDate, signal }),
          attendanceService.getAttendanceShifts({ date: selectedDate, signal }),
          attendanceService.getAttendanceBreaks({ date: selectedDate, signal }),
        ]);

        if (signal?.aborted) return;
        if (dailyRes.error) throw dailyRes.error;
        if (shiftsRes.error) throw shiftsRes.error;
        if (breaksRes.error) throw breaksRes.error;

        const nextDaily = dailyRes.data || [];
        const nextShifts = shiftsRes.data || [];
        const nextBreaks = breaksRes.data || [];

        setHistDaily(nextDaily);
        setHistShifts(nextShifts);
        setHistBreaks(nextBreaks);

        _historicalDailyCache.set(selectedDate, {
          dailyList: nextDaily,
          shiftsList: nextShifts,
          breaksList: nextBreaks,
          timestamp: Date.now(),
        });
      } catch (err: unknown) {
        if (signal?.aborted) return;
        console.error("Failed to fetch historical attendance:", err);
        toast.error("Failed to load attendance records.");
      } finally {
        if (!signal?.aborted) setHistLoading(false);
      }
    },
    [selectedDate, isToday]
  );

  // Fetch Monthly Attendance
  const fetchMonthlyAttendance = useCallback(
    async (isSilent = false, signal?: AbortSignal) => {
      if (!isSilent) setMonthlyLoading(true);
      try {
        const yearNum = parseInt(selectedYear, 10);
        const monthNum = parseInt(selectedMonth, 10);
        const lastDay = new Date(yearNum, monthNum, 0).getDate();

        const startDate = `${selectedYear}-${selectedMonth}-01`;
        const endDate = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

        const [dailyRes, shiftsRes, breaksRes] = await Promise.all([
          attendanceService.getDailyAttendance({ startDate, endDate, signal }),
          attendanceService.getAttendanceShifts({ startDate, endDate, signal }),
          attendanceService.getAttendanceBreaks({ startDate, endDate, signal }),
        ]);

        if (signal?.aborted) return;
        if (dailyRes.error) throw dailyRes.error;
        if (shiftsRes.error) throw shiftsRes.error;
        if (breaksRes.error) throw breaksRes.error;

        const nextDaily = dailyRes.data || [];
        const nextShifts = shiftsRes.data || [];
        const nextBreaks = breaksRes.data || [];

        setMonthlyAttendance(nextDaily);
        setMonthlyShifts(nextShifts);
        setMonthlyBreaks(nextBreaks);

        _monthlyAttendanceCache.set(`${selectedYear}_${selectedMonth}`, {
          dailyList: nextDaily,
          shiftsList: nextShifts,
          breaksList: nextBreaks,
          timestamp: Date.now(),
        });
      } catch (err: unknown) {
        if (signal?.aborted) return;
        console.error("Failed to fetch monthly attendance:", err);
        toast.error("Failed to load monthly attendance.");
      } finally {
        if (!signal?.aborted) setMonthlyLoading(false);
      }
    },
    [selectedYear, selectedMonth]
  );

  // Trigger historical fetch when date changes
  useEffect(() => {
    if (!isToday) {
      const controller = new AbortController();
      fetchHistoricalDaily(false, controller.signal);
      return () => controller.abort();
    }
  }, [selectedDate, isToday, fetchHistoricalDaily]);

  // Trigger monthly fetch when subTab is monthly
  useEffect(() => {
    if (subTab === "monthly") {
      const controller = new AbortController();
      fetchMonthlyAttendance(false, controller.signal);
      return () => controller.abort();
    }
  }, [subTab, selectedYear, selectedMonth, fetchMonthlyAttendance]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleJoinShift = async () => {
    if (!hasWritePermission) {
      toast.error("You do not have write permission for Attendance.");
      return;
    }
    await attendanceContext.joinShift();
  };

  const handleCloseShift = async () => {
    if (!hasWritePermission) {
      toast.error("You do not have write permission for Attendance.");
      return;
    }
    await attendanceContext.closeShift();
  };

  const handleToggleSnackBreak = async () => {
    if (!hasWritePermission) {
      toast.error("You do not have write permission for Attendance.");
      return;
    }
    await attendanceContext.toggleSnackBreak();
  };

  const handleTogglePrayerBreak = async () => {
    if (!hasWritePermission) {
      toast.error("You do not have write permission for Attendance.");
      return;
    }
    await attendanceContext.togglePrayerBreak();
  };

  // Compile full Daily Table Rows (Employees list + Attendance records)
  // Dynamic Row Ordering: Most Recent Attendance Action moves to TOP!
  // Any action (Join, Close, Break Start/End, Prayer Start/End) moves row to top!
  const dailyRows: (AttendanceRowData & { latestActivityTimestamp: number })[] = useMemo(() => {
    return profilesList
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (p.codename && p.codename.toLowerCase().includes(q)) ||
          p.username.toLowerCase().includes(q) ||
          (p.full_name && p.full_name.toLowerCase().includes(q))
        );
      })
      .map((emp) => {
        const daily = effectiveDaily.find((d) => d.user_id === emp.id) || null;
        const shifts = effectiveShifts.filter((s) => s.user_id === emp.id);
        const breaks = effectiveBreaks.filter((b) => b.user_id === emp.id);
        const latestActivityTimestamp = getLatestAttendanceActivityTimestamp(daily, shifts, breaks);

        return {
          profile: emp,
          daily,
          shifts,
          breaks,
          latestActivityTimestamp,
        };
      })
      .sort((a, b) => {
        // Priority 1: Users with attendance activity today, sorted by most recent action timestamp descending
        const aHasActivity = a.latestActivityTimestamp > 0;
        const bHasActivity = b.latestActivityTimestamp > 0;

        if (aHasActivity && bHasActivity) {
          return b.latestActivityTimestamp - a.latestActivityTimestamp;
        }
        if (aHasActivity && !bHasActivity) return -1;
        if (!aHasActivity && bHasActivity) return 1;

        // Priority 2: Inactive users sorted alphabetically by codename / username
        const codeA = (a.profile.codename || a.profile.username).toUpperCase();
        const codeB = (b.profile.codename || b.profile.username).toUpperCase();
        return codeA.localeCompare(codeB);
      });
  }, [profilesList, effectiveDaily, effectiveShifts, effectiveBreaks, searchQuery]);

  // Monthly aggregated statistics
  const monthlySummary = useMemo(() => {
    const map = new Map<
      string,
      {
        profile: Profile;
        daysWorked: number;
        totalWorkMinutes: number;
        totalBreakMinutes: number;
        totalPrayerMinutes: number;
      }
    >();

    profilesList.forEach((p) => {
      map.set(p.id, {
        profile: p,
        daysWorked: 0,
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        totalPrayerMinutes: 0,
      });
    });

    monthlyAttendance.forEach((rec) => {
      const entry = map.get(rec.user_id);
      if (entry) {
        if (rec.join_time) {
          entry.daysWorked += 1;
        }
        entry.totalWorkMinutes += Number(rec.total_work_minutes) || 0;
        entry.totalBreakMinutes += Number(rec.total_break_minutes) || 0;
        entry.totalPrayerMinutes += Number(rec.total_prayer_minutes) || 0;
      }
    });

    return Array.from(map.values())
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (item.profile.codename && item.profile.codename.toLowerCase().includes(q)) ||
          item.profile.username.toLowerCase().includes(q) ||
          (item.profile.full_name && item.profile.full_name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const codeA = (a.profile.codename || a.profile.username).toUpperCase();
        const codeB = (b.profile.codename || b.profile.username).toUpperCase();
        return codeA.localeCompare(codeB);
      });
  }, [profilesList, monthlyAttendance, searchQuery]);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  }, []);

  const monthsList = [
    { val: "01", name: "January" },
    { val: "02", name: "February" },
    { val: "03", name: "March" },
    { val: "04", name: "April" },
    { val: "05", name: "May" },
    { val: "06", name: "June" },
    { val: "07", name: "July" },
    { val: "08", name: "August" },
    { val: "09", name: "September" },
    { val: "10", name: "October" },
    { val: "11", name: "November" },
    { val: "12", name: "December" },
  ];

  // Helper to open the native date picker when clicking the formatted date display
  const handleOpenDatePicker = () => {
    try {
      if (datePickerRef.current) {
        if (typeof datePickerRef.current.showPicker === "function") {
          datePickerRef.current.showPicker();
        } else {
          datePickerRef.current.focus();
          datePickerRef.current.click();
        }
      }
    } catch {
      datePickerRef.current?.focus();
    }
  };

  return (
    <div className="space-y-4 w-full pb-12 animate-fade-in">
      {/* Controls & Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-theme-card-bg/40 p-3.5 sm:p-4 rounded-2xl border border-theme-border-input/60 shadow-sm backdrop-blur-md">
        {/* Left Side: Filters (Daily: Date & Search | Monthly: Year, Month & Search) */}
        <div className="flex items-center gap-3 flex-wrap">
          {subTab === "daily" ? (
            <div className="flex items-center gap-2">
              {/* Date Control: Custom DD-MM-YYYY display with immediate picker trigger on click */}
              <div
                onClick={handleOpenDatePicker}
                className="relative flex items-center px-3 py-1.5 rounded-xl border border-theme-border-input bg-theme-card-bg hover:border-theme-border-active cursor-pointer transition-colors select-none group shadow-sm"
                title="Click to select date"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-400 mr-2 shrink-0 group-hover:text-blue-300 transition-colors" />
                <span className="text-xs font-mono font-semibold text-theme-text-primary tracking-wide">
                  {formatDateToDDMMYYYY(selectedDate)}
                </span>
                <input
                  ref={datePickerRef}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                  tabIndex={-1}
                  aria-label="Select Date"
                />
              </div>

              {!isToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/15 border border-blue-500/30 text-blue-400 hover:bg-blue-600/25 transition-all cursor-pointer shadow-sm"
                  title="Return to today"
                >
                  Today
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Year Select */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 bg-theme-card-bg border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm"
                aria-label="Select Year"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {/* Month Select */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-theme-card-bg border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm"
                aria-label="Select Month"
              >
                {monthsList.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter codename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-theme-card-bg border border-theme-border-input rounded-xl text-xs text-theme-text-primary placeholder:text-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56 shadow-sm"
              aria-label="Filter codename"
            />
            <Search className="w-3.5 h-3.5 text-theme-text-muted absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Right Side: Shift & Break Action Buttons (Only 1 Shift Button) */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Shift Action Button (Single Dynamic Toggle: Join <-> Close) */}
          {!isShiftActive ? (
            <button
              type="button"
              onClick={handleJoinShift}
              disabled={!hasWritePermission || isSunday || !isToday}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm border bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              title="Join Shift"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-400" />
              Join
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCloseShift}
              disabled={!hasWritePermission || !isToday}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm border bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
              title="Close Shift (Automatically closes any open break)"
            >
              <Square className="w-3.5 h-3.5 fill-rose-400" />
              Close
            </button>
          )}

          {/* Break Action (Renamed from Snack Break to Break) */}
          <button
            type="button"
            onClick={handleToggleSnackBreak}
            disabled={
              !hasWritePermission ||
              isSunday ||
              !isToday ||
              !isShiftActive ||
              myStatus === "PRAYER_BREAK"
            }
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm border ${
              myStatus === "SNACK_BREAK"
                ? "bg-amber-500/25 border-amber-500/60 text-amber-300 animate-pulse"
                : "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
            }`}
            title="Toggle normal break session"
          >
            <Coffee className="w-3.5 h-3.5" />
            {myStatus === "SNACK_BREAK" ? "End Break" : "Break"}
          </button>

          {/* Prayer Break Action */}
          <button
            type="button"
            onClick={handleTogglePrayerBreak}
            disabled={
              !hasWritePermission ||
              isSunday ||
              !isToday ||
              !isShiftActive ||
              myStatus === "SNACK_BREAK"
            }
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm border ${
              myStatus === "PRAYER_BREAK"
                ? "bg-sky-500/25 border-sky-500/60 text-sky-300 animate-pulse"
                : "bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/20"
            }`}
            title="Toggle prayer break session"
          >
            <Sun className="w-3.5 h-3.5" />
            {myStatus === "PRAYER_BREAK" ? "End Prayer Break" : "Prayer Break"}
          </button>

          <div className="h-6 w-px bg-theme-border-input/80 hidden sm:block mx-1" />

          {/* Sub-tabs Selector (Daily List | Monthly View) */}
          <div className="flex bg-theme-card-container p-1 rounded-xl border border-theme-border-input text-xs shrink-0">
            <button
              onClick={() => setSubTab("daily")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === "daily"
                  ? "bg-blue-600/15 border border-blue-500/20 text-blue-400"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Daily
            </button>
            <button
              onClick={() => setSubTab("monthly")}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === "monthly"
                  ? "bg-blue-600/15 border border-blue-500/20 text-blue-400"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Monthly
            </button>
          </div>

          {/* Refresh Action: Icon-only [ ↻ ] */}
          <button
            type="button"
            onClick={() => {
              if (subTab === "daily") {
                if (isToday) attendanceContext.refreshAttendance(false);
                else fetchHistoricalDaily(false);
              } else {
                fetchMonthlyAttendance(false);
              }
            }}
            disabled={subTab === "daily" ? effectiveLoading : monthlyLoading}
            className="p-2.5 bg-theme-card-bg border border-theme-border-input hover:border-theme-border-active text-theme-text-muted hover:text-theme-text-primary rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0 shadow-sm"
            title="Refresh attendance records"
            aria-label="Refresh attendance records"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                (subTab === "daily" ? effectiveLoading : monthlyLoading) ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Sunday Holiday Warning Banner */}
      {isSunday && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-purple-300">
          <Calendar className="w-5 h-5 text-purple-400 shrink-0" />
          <div className="text-xs">
            <strong className="font-bold text-sm block">Sunday — Weekly Holiday</strong>
            Office shifts and break actions are disabled today. Enjoy your day off!
          </div>
        </div>
      )}

      {/* SUBTAB 1: DAILY VIEW */}
      {subTab === "daily" && (
        <div className="space-y-4">
          {effectiveLoading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : (
            <div className="bg-theme-page-bg/40 border border-theme-border-muted/80 rounded-2xl overflow-hidden shadow-inner backdrop-blur-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-theme-card-container border-b border-theme-border-muted/80 text-[10px] text-theme-text-muted uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 min-w-[160px] text-left">Employee Codename</th>
                      <th className="px-4 py-3 min-w-[200px] text-center">Shift</th>
                      <th className="px-4 py-3 min-w-[210px] text-center">Break</th>
                      <th className="px-4 py-3 min-w-[210px] text-center">Prayer Break</th>
                      <th className="px-4 py-3 min-w-[130px] text-center">Status</th>
                      <th className="px-4 py-3 min-w-[170px] text-left">Total Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border-muted/40 text-theme-text-secondary">
                    {dailyRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-theme-text-muted">
                          No employee records matching criteria.
                        </td>
                      </tr>
                    ) : (
                      dailyRows.map(({ profile: emp, daily, shifts, breaks }) => {
                        const isClosed = daily?.status === "CLOSED";
                        const isWorking = daily?.status === "WORKING";
                        const isSnackBreak = daily?.status === "SNACK_BREAK";
                        const isPrayerBreak = daily?.status === "PRAYER_BREAK";
                        const isEmployeeSunday = isSunday;

                        // Sort breaks newest session on top
                        const snackBreaks = breaks
                          .filter((b) => b.type === "snack")
                          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
                        const prayerBreaks = breaks
                          .filter((b) => b.type === "prayer")
                          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

                        // Sort shifts newest session on top
                        const sortedShifts = [...shifts].sort(
                          (a, b) => new Date(b.join_time).getTime() - new Date(a.join_time).getTime()
                        );

                        // Net working seconds across all shifts today
                        const totalWorkingSeconds = calculateTotalDailyWorkingSeconds(
                          daily,
                          shifts,
                          breaks,
                          now
                        );

                        // Total break & prayer seconds with exact second precision
                        const totalSnackSec = calculateTotalBreakTypeSeconds(breaks, "snack", now);
                        const totalPrayerSec = calculateTotalBreakTypeSeconds(breaks, "prayer", now);

                        return (
                          <tr
                            key={emp.id}
                            className={`transition-colors duration-150 ${
                              isClosed
                                ? "bg-theme-card-bg/10 opacity-70 hover:opacity-90"
                                : isWorking
                                ? "bg-emerald-950/10 hover:bg-emerald-950/15"
                                : isSnackBreak
                                ? "bg-amber-950/10 hover:bg-amber-950/15"
                                : isPrayerBreak
                                ? "bg-sky-950/10 hover:bg-sky-950/15"
                                : "hover:bg-theme-card-bg/25"
                            }`}
                          >
                            {/* Employee Codename */}
                            <td className="px-4 py-3 font-semibold text-theme-text-primary text-left">
                              <div className="min-w-0">
                                <span className="font-mono text-xs font-bold text-theme-text-primary block truncate">
                                  {emp.codename || emp.username.toUpperCase()}
                                </span>
                                <span className="text-[10px] text-theme-text-muted block truncate">
                                  {emp.full_name || emp.job_role || emp.role}
                                </span>
                              </div>
                            </td>

                            {/* Shift (Join, Close, Live Timer — Multi-shift supported) */}
                            <td className="px-4 py-3 text-center">
                              {sortedShifts.length > 0 ? (
                                <div className="space-y-1 max-h-28 overflow-y-auto pr-1 custom-scrollbar flex flex-col items-center">
                                  {sortedShifts.map((s, idx) => {
                                    const isShiftActive = !s.close_time;
                                    const sWorkingSec = calculateShiftWorkingSeconds(s, breaks, now);

                                    return (
                                      <div
                                        key={s.id || idx}
                                        className={`group relative inline-flex flex-col items-center justify-center text-[11px] px-2.5 py-1 rounded-lg border font-mono w-full max-w-[190px] ${
                                          isShiftActive
                                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 font-bold"
                                            : "bg-theme-card-bg/40 border-theme-border-input/40 text-theme-text-secondary"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between w-full text-[10px]">
                                          <span className="text-theme-text-muted truncate">
                                            {formatAttendanceTime(s.join_time)} - {isShiftActive ? "Active" : formatAttendanceTime(s.close_time)}
                                          </span>
                                          {isSuperAdmin && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeletingSession({
                                                  type: 'shift',
                                                  shift: s,
                                                  employee: emp,
                                                  attendanceDate: selectedDate,
                                                });
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 ml-1 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 rounded transition-all cursor-pointer shrink-0"
                                              title="Delete Shift Session (Superadmin)"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold">
                                          {isShiftActive && <Clock className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />}
                                          <span>Work: {formatDurationSeconds(sWorkingSec)}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : daily?.join_time ? (
                                <div className="space-y-1 flex flex-col items-center">
                                  <div className="flex items-center justify-center gap-1.5 text-[11px]">
                                    <span className="text-theme-text-muted">Join:</span>
                                    <span className="font-mono font-semibold text-theme-text-primary">
                                      {formatAttendanceTime(daily.join_time)}
                                    </span>
                                  </div>
                                  {isClosed && daily.close_time && (
                                    <div className="flex items-center justify-center gap-1.5 text-[11px]">
                                      <span className="text-theme-text-muted">Close:</span>
                                      <span className="font-mono font-semibold text-theme-text-primary">
                                        {formatAttendanceTime(daily.close_time)}
                                      </span>
                                    </div>
                                  )}
                                  {!isClosed && (
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                      <Clock className="w-2.5 h-2.5 animate-pulse" />
                                      <span>Working: {formatDurationSeconds(totalWorkingSeconds)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-theme-text-muted/60">-</span>
                              )}
                            </td>

                            {/* Break (Snack — Newest Session on Top) */}
                            <td className="px-4 py-3 text-center">
                              {snackBreaks.length === 0 ? (
                                <span className="text-theme-text-muted/60">-</span>
                              ) : (
                                <div className="space-y-1 max-h-24 overflow-y-auto pr-1 custom-scrollbar flex flex-col items-center">
                                  {snackBreaks.map((b) => {
                                    const isActive = !b.end_time;
                                    const sessionSec = calculateBreakSessionSeconds(b, now);
                                    const sessionMinutes = Math.floor(sessionSec / 60);
                                    const isRedWarning = isActive && sessionMinutes >= 8;

                                    return (
                                      <div
                                        key={b.id}
                                        className={`group relative inline-flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg border font-mono w-full max-w-[190px] ${
                                          isActive
                                            ? isRedWarning
                                              ? "bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse font-bold"
                                              : "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                                            : "bg-theme-card-bg/40 border-theme-border-input/40 text-theme-text-secondary"
                                        }`}
                                      >
                                        <span className="truncate">
                                          {formatAttendanceTime(b.start_time)} - {isActive ? "Active" : formatAttendanceTime(b.end_time)}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-[10px] ml-1 font-mono">
                                            ({formatBreakSessionElapsed(sessionSec)})
                                          </span>
                                          {isSuperAdmin && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeletingSession({
                                                  type: 'snack_break',
                                                  breakItem: b,
                                                  employee: emp,
                                                  attendanceDate: selectedDate,
                                                });
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 rounded transition-all cursor-pointer"
                                              title="Delete Break Session (Superadmin)"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>

                            {/* Prayer Break (Newest Session on Top) */}
                            <td className="px-4 py-3 text-center">
                              {prayerBreaks.length === 0 ? (
                                <span className="text-theme-text-muted/60">-</span>
                              ) : (
                                <div className="space-y-1 max-h-24 overflow-y-auto pr-1 custom-scrollbar flex flex-col items-center">
                                  {prayerBreaks.map((b) => {
                                    const isActive = !b.end_time;
                                    const sessionSec = calculateBreakSessionSeconds(b, now);

                                    return (
                                      <div
                                        key={b.id}
                                        className={`group relative inline-flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg border font-mono w-full max-w-[190px] ${
                                          isActive
                                            ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold"
                                            : "bg-theme-card-bg/40 border-theme-border-input/40 text-theme-text-secondary"
                                        }`}
                                      >
                                        <span className="truncate">
                                          {formatAttendanceTime(b.start_time)} - {isActive ? "Active" : formatAttendanceTime(b.end_time)}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-[10px] ml-1 font-mono">
                                            ({formatBreakSessionElapsed(sessionSec)})
                                          </span>
                                          {isSuperAdmin && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeletingSession({
                                                  type: 'prayer_break',
                                                  breakItem: b,
                                                  employee: emp,
                                                  attendanceDate: selectedDate,
                                                });
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 rounded transition-all cursor-pointer"
                                              title="Delete Prayer Break Session (Superadmin)"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3 text-center">
                              {isEmployeeSunday ? (
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                  Day Off
                                </span>
                              ) : (!daily?.join_time && shifts.length === 0) ? (
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                  Not Joined
                                </span>
                              ) : isClosed ? (
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-500/15 text-slate-400 border border-slate-500/30">
                                  Closed
                                </span>
                              ) : isSnackBreak ? (
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                                  Break
                                </span>
                              ) : isPrayerBreak ? (
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/40">
                                  Prayer
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  Working
                                </span>
                              )}
                            </td>

                            {/* Total Duration (Left-aligned) */}
                            <td className="px-4 py-3 text-left">
                              {daily?.join_time || shifts.length > 0 ? (
                                <div className="font-mono text-[11px] space-y-0.5 flex flex-col items-start text-left">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-emerald-400 font-bold">Work:</span>
                                    <span className="text-emerald-300 font-bold">
                                      {formatDurationSeconds(totalWorkingSeconds)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-purple-400 font-semibold">Break:</span>
                                    <span className="text-purple-300">
                                      {formatDurationSeconds(totalSnackSec)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sky-400 font-semibold">Prayer:</span>
                                    <span className="text-sky-300">
                                      {formatDurationSeconds(totalPrayerSec)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-theme-text-muted/60">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: MONTHLY VIEW */}
      {subTab === "monthly" && (
        <div className="space-y-4">
          {monthlyLoading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : (
            <div className="bg-theme-page-bg/40 border border-theme-border-muted/80 rounded-2xl overflow-hidden shadow-inner backdrop-blur-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-theme-card-container border-b border-theme-border-muted/80 text-[10px] text-theme-text-muted uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 min-w-[160px] text-left">Employee Codename</th>
                      <th className="px-4 py-3 min-w-[100px] text-center">Days Worked</th>
                      <th className="px-4 py-3 min-w-[150px] text-center">Total Working</th>
                      <th className="px-4 py-3 min-w-[150px] text-center">Total Break</th>
                      <th className="px-4 py-3 min-w-[150px] text-center">Total Prayer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border-muted/40 text-theme-text-secondary">
                    {monthlySummary.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-theme-text-muted">
                          No employee records matching criteria.
                        </td>
                      </tr>
                    ) : (
                      monthlySummary.map((item) => (
                        <tr key={item.profile.id} className="hover:bg-theme-card-bg/25 transition-colors">
                          <td className="px-4 py-3 font-semibold text-theme-text-primary text-left">
                            <div className="min-w-0">
                              <span className="font-mono text-xs font-bold text-theme-text-primary block truncate">
                                {item.profile.codename || item.profile.username.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-theme-text-muted block truncate">
                                {item.profile.full_name || item.profile.job_role || item.profile.role}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold font-mono text-theme-text-primary">
                            {item.daysWorked} days
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                            {formatDurationMinutes(item.totalWorkMinutes)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-purple-400">
                            {formatDurationMinutes(item.totalBreakMinutes)}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-sky-400">
                            {formatDurationMinutes(item.totalPrayerMinutes)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Superadmin Delete Session Confirmation Modal */}
      {deletingSession && (
        <ConfirmModal
          isOpen={!!deletingSession}
          onClose={() => !isDeleting && setDeletingSession(null)}
          onConfirm={handleConfirmDeleteSession}
          title={
            deletingSession.type === 'shift'
              ? 'Delete Shift Session'
              : deletingSession.type === 'snack_break'
              ? 'Delete Snack Break Session'
              : 'Delete Prayer Break Session'
          }
          message={
            <div className="space-y-2 font-sans">
              <p className="text-theme-text-secondary text-xs">
                Are you sure you want to permanently delete this{' '}
                <strong className="text-theme-text-primary">
                  {deletingSession.type === 'shift'
                    ? 'Shift session'
                    : deletingSession.type === 'snack_break'
                    ? 'Break session'
                    : 'Prayer Break session'}
                </strong>{' '}
                for employee{' '}
                <strong className="text-theme-text-primary">
                  {(deletingSession.employee.codename || deletingSession.employee.username).toUpperCase()}
                </strong>{' '}
                on date <strong className="text-theme-text-primary">{formatDateToDDMMYYYY(deletingSession.attendanceDate)}</strong>?
              </p>
              {deletingSession.type === 'shift' && deletingSession.shift && (
                <div className="p-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs font-mono text-theme-text-secondary space-y-1">
                  <div><strong className="text-theme-text-primary">Join Time:</strong> {formatAttendanceTime(deletingSession.shift.join_time)}</div>
                  <div><strong className="text-theme-text-primary">Close Time:</strong> {deletingSession.shift.close_time ? formatAttendanceTime(deletingSession.shift.close_time) : 'Active'}</div>
                  <div><strong className="text-theme-text-primary">Duration:</strong> {formatDurationSeconds(calculateShiftWorkingSeconds(deletingSession.shift, [], now))}</div>
                </div>
              )}
              {(deletingSession.type === 'snack_break' || deletingSession.type === 'prayer_break') && deletingSession.breakItem && (
                <div className="p-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs font-mono text-theme-text-secondary space-y-1">
                  <div><strong className="text-theme-text-primary">Category:</strong> {deletingSession.type === 'snack_break' ? 'Break' : 'Prayer Break'}</div>
                  <div><strong className="text-theme-text-primary">Start Time:</strong> {formatAttendanceTime(deletingSession.breakItem.start_time)}</div>
                  <div><strong className="text-theme-text-primary">End Time:</strong> {deletingSession.breakItem.end_time ? formatAttendanceTime(deletingSession.breakItem.end_time) : 'Active'}</div>
                  <div><strong className="text-theme-text-primary">Duration:</strong> {formatBreakSessionElapsed(calculateBreakSessionSeconds(deletingSession.breakItem, now))}</div>
                </div>
              )}
              <p className="text-[11px] text-rose-400">
                ⚠️ This will recalculate the employee&apos;s daily attendance metrics automatically.
              </p>
            </div>
          }
          confirmText={isDeleting ? 'Deleting...' : 'Permanently Delete'}
          cancelText="Cancel"
          isDanger={true}
        />
      )}
    </div>
  );
};
