"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Profile, AttendanceDaily, AttendanceBreak, AttendanceStatus, AttendanceRowData } from "@/types";
import {
  Clock,
  Play,
  Square,
  Coffee,
  Sun,
  CalendarDays,
  RefreshCw,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Calendar,
  Sparkles,
  Shield,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { attendanceService } from "@/services";
import { useRealtimeHandler, RealtimePayload } from "@/contexts/RealtimeContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { canWriteAttendance, isSuperadmin } from "@/utils/permissionService";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";

interface AttendancePanelProps {
  profile: Profile | null;
}

// Module-level caches to preserve state across component remounts and focus changes
const _dailyAttendanceCache = new Map<string, { dailyList: AttendanceDaily[]; breaksList: AttendanceBreak[]; timestamp: number }>();
const _monthlyAttendanceCache = new Map<string, { dailyList: AttendanceDaily[]; breaksList: AttendanceBreak[]; timestamp: number }>();

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "-";
  }
}

function formatDurationMinutes(totalMinutes: number): string {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return "00h 00m";
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.floor(totalMinutes % 60);
  return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}

function formatDurationSeconds(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "00h 00m";
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}

export const AttendancePanel: React.FC<AttendancePanelProps> = ({ profile }) => {
  const { profilesList } = useProfiles();
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

  const cachedDaily = _dailyAttendanceCache.get(selectedDate);
  const [dailyAttendance, setDailyAttendance] = useState<AttendanceDaily[]>(() => cachedDaily?.dailyList || []);
  const [attendanceBreaks, setAttendanceBreaks] = useState<AttendanceBreak[]>(() => cachedDaily?.breaksList || []);
  const [loading, setLoading] = useState(() => !cachedDaily);

  const cachedMonthlyKey = `${selectedYear}_${selectedMonth}`;
  const cachedMonthly = _monthlyAttendanceCache.get(cachedMonthlyKey);
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceDaily[]>(() => cachedMonthly?.dailyList || []);
  const [monthlyBreaks, setMonthlyBreaks] = useState<AttendanceBreak[]>(() => cachedMonthly?.breaksList || []);
  const [monthlyLoading, setMonthlyLoading] = useState(() => !cachedMonthly);

  // Live timer tick state (updates every second in client without writing to DB)
  const [now, setNow] = useState<number>(() => Date.now());

  // Check if today / selected date is Sunday
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

  // Current logged in user's daily record & active break
  const myDailyRecord = useMemo(() => {
    if (!profile?.id) return null;
    return dailyAttendance.find((a) => a.user_id === profile.id) || null;
  }, [profile?.id, dailyAttendance]);

  const myBreaks = useMemo(() => {
    if (!profile?.id) return [];
    return attendanceBreaks.filter((b) => b.user_id === profile.id);
  }, [profile?.id, attendanceBreaks]);

  const activeBreak = useMemo(() => {
    return myBreaks.find((b) => !b.end_time) || null;
  }, [myBreaks]);

  // Timer interval: tick every second if there is any active shift or break
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch Daily Attendance
  const fetchDailyAttendance = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      try {
        const [dailyRes, breaksRes] = await Promise.all([
          attendanceService.getDailyAttendance({ date: selectedDate }),
          attendanceService.getAttendanceBreaks({ date: selectedDate }),
        ]);

        if (dailyRes.error) throw dailyRes.error;
        if (breaksRes.error) throw breaksRes.error;

        const nextDaily = dailyRes.data || [];
        const nextBreaks = breaksRes.data || [];

        setDailyAttendance(nextDaily);
        setAttendanceBreaks(nextBreaks);

        _dailyAttendanceCache.set(selectedDate, {
          dailyList: nextDaily,
          breaksList: nextBreaks,
          timestamp: Date.now(),
        });
      } catch (err: unknown) {
        console.error("Failed to fetch daily attendance:", err);
        toast.error("Failed to load attendance records.");
      } finally {
        setLoading(false);
      }
    },
    [selectedDate]
  );

  // Fetch Monthly Attendance
  const fetchMonthlyAttendance = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setMonthlyLoading(true);
      try {
        const yearNum = parseInt(selectedYear, 10);
        const monthNum = parseInt(selectedMonth, 10);
        const lastDay = new Date(yearNum, monthNum, 0).getDate();

        const startDate = `${selectedYear}-${selectedMonth}-01`;
        const endDate = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

        const [dailyRes, breaksRes] = await Promise.all([
          attendanceService.getDailyAttendance({ startDate, endDate }),
          attendanceService.getAttendanceBreaks({ startDate, endDate }),
        ]);

        if (dailyRes.error) throw dailyRes.error;
        if (breaksRes.error) throw breaksRes.error;

        const nextDaily = dailyRes.data || [];
        const nextBreaks = breaksRes.data || [];

        setMonthlyAttendance(nextDaily);
        setMonthlyBreaks(nextBreaks);

        _monthlyAttendanceCache.set(`${selectedYear}_${selectedMonth}`, {
          dailyList: nextDaily,
          breaksList: nextBreaks,
          timestamp: Date.now(),
        });
      } catch (err: unknown) {
        console.error("Failed to fetch monthly attendance:", err);
        toast.error("Failed to load monthly attendance.");
      } finally {
        setMonthlyLoading(false);
      }
    },
    [selectedYear, selectedMonth]
  );

  // Initial & Dependency-driven fetch
  useEffect(() => {
    if (subTab === "daily") {
      const hasCached = _dailyAttendanceCache.has(selectedDate);
      fetchDailyAttendance(hasCached);
    } else {
      const hasCached = _monthlyAttendanceCache.has(`${selectedYear}_${selectedMonth}`);
      fetchMonthlyAttendance(hasCached);
    }
  }, [subTab, selectedDate, selectedYear, selectedMonth, fetchDailyAttendance, fetchMonthlyAttendance]);

  // Realtime handler for attendance_daily
  const handleDailyRealtime = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === "DELETE") {
        const deletedId = (payload.old as { id?: string })?.id;
        if (!deletedId) return;
        setDailyAttendance((prev) => prev.filter((d) => d.id !== deletedId));
        return;
      }

      const row = payload.new as unknown as AttendanceDaily;
      if (!row?.id) return;

      // Only update if matches current date in daily view
      if (row.attendance_date === selectedDate) {
        setDailyAttendance((prev) => {
          const exists = prev.some((d) => d.id === row.id);
          const next = exists ? prev.map((d) => (d.id === row.id ? { ...d, ...row } : d)) : [...prev, row];
          _dailyAttendanceCache.set(selectedDate, {
            dailyList: next,
            breaksList: attendanceBreaks,
            timestamp: Date.now(),
          });
          return next;
        });
      }
    },
    [selectedDate, attendanceBreaks]
  );

  // Realtime handler for attendance_breaks
  const handleBreaksRealtime = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === "DELETE") {
        const deletedId = (payload.old as { id?: string })?.id;
        if (!deletedId) return;
        setAttendanceBreaks((prev) => prev.filter((b) => b.id !== deletedId));
        return;
      }

      const row = payload.new as unknown as AttendanceBreak;
      if (!row?.id) return;

      if (row.attendance_date === selectedDate) {
        setAttendanceBreaks((prev) => {
          const exists = prev.some((b) => b.id === row.id);
          const next = exists ? prev.map((b) => (b.id === row.id ? { ...b, ...row } : b)) : [...prev, row];
          _dailyAttendanceCache.set(selectedDate, {
            dailyList: dailyAttendance,
            breaksList: next,
            timestamp: Date.now(),
          });
          return next;
        });
      }
    },
    [selectedDate, dailyAttendance]
  );

  useRealtimeHandler("attendance_daily", handleDailyRealtime);
  useRealtimeHandler("attendance_breaks", handleBreaksRealtime);

  // ── Actions ─────────────────────────────────────────────────────────────

  // Join Shift
  const handleJoinShift = async () => {
    if (!profile?.id) return;
    if (isSunday) {
      toast.error("Today is Sunday (Weekly Holiday). Joining is disabled.");
      return;
    }
    if (!hasWritePermission) {
      toast.error("You do not have write permission for Attendance.");
      return;
    }

    const joinTimeIso = new Date().toISOString();
    try {
      const { data, error } = await attendanceService.joinShift(profile.id, todayStr, joinTimeIso);
      if (error) throw error;
      if (data) {
        setDailyAttendance((prev) => {
          const exists = prev.some((d) => d.id === data.id);
          return exists ? prev.map((d) => (d.id === data.id ? data : d)) : [...prev, data];
        });
        toast.success("Joined shift successfully! Have a great workday.");
      }
    } catch (err: unknown) {
      console.error("Failed to join shift:", err);
      toast.error("Failed to record shift join.");
    }
  };

  // Close Shift
  const handleCloseShift = async () => {
    if (!profile?.id || !myDailyRecord) return;
    if (!hasWritePermission) {
      toast.error("You do not have write permission for Attendance.");
      return;
    }

    const closeTimeIso = new Date().toISOString();
    const joinTimeMs = myDailyRecord.join_time ? new Date(myDailyRecord.join_time).getTime() : Date.now();
    const closeTimeMs = new Date(closeTimeIso).getTime();

    // If there is an active break session, end it first
    let currentTotalBreak = Number(myDailyRecord.total_break_minutes) || 0;
    let currentTotalPrayer = Number(myDailyRecord.total_prayer_minutes) || 0;

    if (activeBreak) {
      const breakStartMs = new Date(activeBreak.start_time).getTime();
      const breakDurationMin = Math.max(0, Math.round((closeTimeMs - breakStartMs) / 60000));
      if (activeBreak.type === "snack") {
        currentTotalBreak += breakDurationMin;
      } else {
        currentTotalPrayer += breakDurationMin;
      }
      await attendanceService.endBreak(
        activeBreak.id,
        myDailyRecord.id,
        closeTimeIso,
        breakDurationMin,
        currentTotalBreak,
        currentTotalPrayer
      );
    }

    const grossMinutes = Math.max(0, Math.round((closeTimeMs - joinTimeMs) / 60000));
    const netWorkMinutes = Math.max(0, grossMinutes - currentTotalBreak - currentTotalPrayer);

    try {
      const { data, error } = await attendanceService.closeShift(
        myDailyRecord.id,
        closeTimeIso,
        netWorkMinutes
      );
      if (error) throw error;
      if (data) {
        setDailyAttendance((prev) => prev.map((d) => (d.id === data.id ? data : d)));
        toast.success("Shift closed successfully. See you next time!");
      }
    } catch (err: unknown) {
      console.error("Failed to close shift:", err);
      toast.error("Failed to close shift.");
    }
  };

  // Toggle Snack Break
  const handleToggleSnackBreak = async () => {
    if (!profile?.id || !myDailyRecord) return;
    if (!hasWritePermission) {
      toast.error("You do not have write permission for Attendance.");
      return;
    }

    const nowIso = new Date().toISOString();

    if (myDailyRecord.status === "SNACK_BREAK" && activeBreak && activeBreak.type === "snack") {
      // End snack break
      const startMs = new Date(activeBreak.start_time).getTime();
      const durationMin = Math.max(0, Math.round((Date.now() - startMs) / 60000));
      const nextTotalBreak = (Number(myDailyRecord.total_break_minutes) || 0) + durationMin;

      try {
        const { error } = await attendanceService.endBreak(
          activeBreak.id,
          myDailyRecord.id,
          nowIso,
          durationMin,
          nextTotalBreak,
          Number(myDailyRecord.total_prayer_minutes) || 0
        );
        if (error) throw error;
        setDailyAttendance((prev) =>
          prev.map((d) =>
            d.id === myDailyRecord.id
              ? { ...d, status: "WORKING", total_break_minutes: nextTotalBreak }
              : d
          )
        );
        setAttendanceBreaks((prev) =>
          prev.map((b) =>
            b.id === activeBreak.id ? { ...b, end_time: nowIso, duration_minutes: durationMin } : b
          )
        );
        toast.success("Snack break ended. Back to work!");
      } catch (err: unknown) {
        console.error("Failed to end snack break:", err);
        toast.error("Failed to end snack break.");
      }
    } else if (myDailyRecord.status === "WORKING") {
      // Start snack break
      try {
        const { data, error } = await attendanceService.startBreak(
          myDailyRecord.id,
          profile.id,
          todayStr,
          "snack",
          nowIso
        );
        if (error) throw error;
        if (data) {
          setAttendanceBreaks((prev) => [...prev, data]);
          setDailyAttendance((prev) =>
            prev.map((d) => (d.id === myDailyRecord.id ? { ...d, status: "SNACK_BREAK" } : d))
          );
          toast.success("Snack break started! Enjoy your break.");
        }
      } catch (err: unknown) {
        console.error("Failed to start snack break:", err);
        toast.error("Failed to start snack break.");
      }
    }
  };

  // Toggle Prayer Break
  const handleTogglePrayerBreak = async () => {
    if (!profile?.id || !myDailyRecord) return;
    if (!hasWritePermission) {
      toast.error("You do not have write permission for Attendance.");
      return;
    }

    const nowIso = new Date().toISOString();

    if (myDailyRecord.status === "PRAYER_BREAK" && activeBreak && activeBreak.type === "prayer") {
      // End prayer break
      const startMs = new Date(activeBreak.start_time).getTime();
      const durationMin = Math.max(0, Math.round((Date.now() - startMs) / 60000));
      const nextTotalPrayer = (Number(myDailyRecord.total_prayer_minutes) || 0) + durationMin;

      try {
        const { error } = await attendanceService.endBreak(
          activeBreak.id,
          myDailyRecord.id,
          nowIso,
          durationMin,
          Number(myDailyRecord.total_break_minutes) || 0,
          nextTotalPrayer
        );
        if (error) throw error;
        setDailyAttendance((prev) =>
          prev.map((d) =>
            d.id === myDailyRecord.id
              ? { ...d, status: "WORKING", total_prayer_minutes: nextTotalPrayer }
              : d
          )
        );
        setAttendanceBreaks((prev) =>
          prev.map((b) =>
            b.id === activeBreak.id ? { ...b, end_time: nowIso, duration_minutes: durationMin } : b
          )
        );
        toast.success("Prayer break ended. Back to work!");
      } catch (err: unknown) {
        console.error("Failed to end prayer break:", err);
        toast.error("Failed to end prayer break.");
      }
    } else if (myDailyRecord.status === "WORKING") {
      // Start prayer break
      try {
        const { data, error } = await attendanceService.startBreak(
          myDailyRecord.id,
          profile.id,
          todayStr,
          "prayer",
          nowIso
        );
        if (error) throw error;
        if (data) {
          setAttendanceBreaks((prev) => [...prev, data]);
          setDailyAttendance((prev) =>
            prev.map((d) => (d.id === myDailyRecord.id ? { ...d, status: "PRAYER_BREAK" } : d))
          );
          toast.success("Prayer break started.");
        }
      } catch (err: unknown) {
        console.error("Failed to start prayer break:", err);
        toast.error("Failed to start prayer break.");
      }
    }
  };

  // Compile full Daily Table Rows (Employees list + Attendance records)
  const dailyRows: AttendanceRowData[] = useMemo(() => {
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
        const daily = dailyAttendance.find((d) => d.user_id === emp.id) || null;
        const breaks = attendanceBreaks.filter((b) => b.user_id === emp.id);
        return {
          profile: emp,
          daily,
          breaks,
        };
      })
      .sort((a, b) => {
        // Sort: Active users first, then alphabetically by codename/username
        const aActive = a.daily?.status === "WORKING" || a.daily?.status === "SNACK_BREAK" || a.daily?.status === "PRAYER_BREAK";
        const bActive = b.daily?.status === "WORKING" || b.daily?.status === "SNACK_BREAK" || b.daily?.status === "PRAYER_BREAK";
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        const codeA = (a.profile.codename || a.profile.username).toUpperCase();
        const codeB = (b.profile.codename || b.profile.username).toUpperCase();
        return codeA.localeCompare(codeB);
      });
  }, [profilesList, dailyAttendance, attendanceBreaks, searchQuery]);

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

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-theme-card-bg/40 p-4 sm:p-5 rounded-2xl border border-theme-border-input/60 shadow-sm backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-theme-text-primary flex items-center gap-2">
                Attendance & Shift Tracking
              </h1>
              <p className="text-xs text-theme-text-muted">
                Live office join, break, and prayer tracking for all team members.
              </p>
            </div>
          </div>
        </div>

        {/* User Quick Actions (Join, Close, Snack Break, Prayer Break) */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
          {/* Join Shift Action */}
          <button
            type="button"
            onClick={handleJoinShift}
            disabled={!hasWritePermission || isSunday || (!!myDailyRecord && myDailyRecord.status !== "DAY_OFF" && myDailyRecord.status !== "CLOSED")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm"
            title="Start your workday and record join time"
          >
            <Play className="w-3.5 h-3.5 fill-emerald-400" />
            Join
          </button>

          {/* Snack Break Action */}
          <button
            type="button"
            onClick={handleToggleSnackBreak}
            disabled={
              !hasWritePermission ||
              isSunday ||
              !myDailyRecord ||
              myDailyRecord.status === "CLOSED" ||
              myDailyRecord.status === "PRAYER_BREAK" ||
              myDailyRecord.status === "DAY_OFF"
            }
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm border ${
              myDailyRecord?.status === "SNACK_BREAK"
                ? "bg-amber-500/25 border-amber-500/60 text-amber-300 animate-pulse"
                : "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
            }`}
            title="Toggle normal snack break session"
          >
            <Coffee className="w-3.5 h-3.5" />
            {myDailyRecord?.status === "SNACK_BREAK" ? "End Snack Break" : "Snack Break"}
          </button>

          {/* Prayer Break Action */}
          <button
            type="button"
            onClick={handleTogglePrayerBreak}
            disabled={
              !hasWritePermission ||
              isSunday ||
              !myDailyRecord ||
              myDailyRecord.status === "CLOSED" ||
              myDailyRecord.status === "SNACK_BREAK" ||
              myDailyRecord.status === "DAY_OFF"
            }
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm border ${
              myDailyRecord?.status === "PRAYER_BREAK"
                ? "bg-sky-500/25 border-sky-500/60 text-sky-300 animate-pulse"
                : "bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/20"
            }`}
            title="Toggle prayer break session"
          >
            <Sun className="w-3.5 h-3.5" />
            {myDailyRecord?.status === "PRAYER_BREAK" ? "End Prayer Break" : "Prayer Break"}
          </button>

          {/* Close Shift Action */}
          <button
            type="button"
            onClick={handleCloseShift}
            disabled={
              !hasWritePermission ||
              isSunday ||
              !myDailyRecord ||
              myDailyRecord.status === "CLOSED" ||
              myDailyRecord.status === "DAY_OFF"
            }
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm"
            title="Close your workday shift and finalize hours"
          >
            <Square className="w-3.5 h-3.5 fill-rose-400" />
            Close
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
          {/* Controls Bar: Date Selector, Search, Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-theme-card-container/40 p-3.5 border border-theme-border-input/60 rounded-xl">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">
                  Date:
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-theme-border-input bg-theme-card-bg text-xs text-theme-text-primary font-medium focus:outline-none focus:border-blue-500 transition-colors"
                />
                {selectedDate !== todayStr && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-blue-600/15 border border-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-600/25 transition-all cursor-pointer"
                  >
                    Today
                  </button>
                )}
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                <input
                  type="text"
                  placeholder="Filter codename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-theme-border-input bg-theme-card-bg text-xs text-theme-text-primary placeholder:text-theme-text-muted/60 focus:outline-none focus:border-blue-500 transition-colors w-40 sm:w-56"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchDailyAttendance(false)}
              disabled={loading}
              className="p-2 bg-theme-card-bg border border-theme-border-input hover:border-theme-border-active text-theme-text-muted hover:text-theme-text-primary rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold ml-auto"
              title="Refresh attendance records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Daily Live Attendance Table */}
          {loading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : (
            <div className="bg-theme-page-bg/40 border border-theme-border-muted/80 rounded-2xl overflow-hidden shadow-inner backdrop-blur-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-theme-card-container border-b border-theme-border-muted/80 text-[10px] text-theme-text-muted uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 min-w-[160px]">Employee Codename</th>
                      <th className="px-4 py-3 min-w-[180px]">Shift</th>
                      <th className="px-4 py-3 min-w-[200px]">Break (Snack)</th>
                      <th className="px-4 py-3 min-w-[200px]">Prayer Break</th>
                      <th className="px-4 py-3 min-w-[130px] text-center">Status</th>
                      <th className="px-4 py-3 min-w-[150px]">Total Duration</th>
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
                      dailyRows.map(({ profile: emp, daily, breaks }) => {
                        const isClosed = daily?.status === "CLOSED";
                        const isWorking = daily?.status === "WORKING";
                        const isSnackBreak = daily?.status === "SNACK_BREAK";
                        const isPrayerBreak = daily?.status === "PRAYER_BREAK";
                        const isEmployeeSunday = isSunday;

                        const snackBreaks = breaks.filter((b) => b.type === "snack");
                        const prayerBreaks = breaks.filter((b) => b.type === "prayer");

                        // Live calculation of elapsed working timer
                        let liveWorkingSeconds = 0;
                        if (daily?.join_time && !isClosed) {
                          const joinMs = new Date(daily.join_time).getTime();
                          const grossSec = Math.max(0, Math.floor((now - joinMs) / 1000));

                          // Subtract completed snack & prayer breaks
                          let totalBreakSec = 0;
                          breaks.forEach((b) => {
                            if (b.end_time) {
                              const s = new Date(b.start_time).getTime();
                              const e = new Date(b.end_time).getTime();
                              totalBreakSec += Math.max(0, Math.floor((e - s) / 1000));
                            } else {
                              // Active break
                              const s = new Date(b.start_time).getTime();
                              totalBreakSec += Math.max(0, Math.floor((now - s) / 1000));
                            }
                          });

                          liveWorkingSeconds = Math.max(0, grossSec - totalBreakSec);
                        }

                        return (
                          <tr
                            key={emp.id}
                            className={`transition-colors duration-150 ${
                              isClosed
                                ? "bg-theme-card-bg/10 opacity-60 hover:opacity-80"
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
                            <td className="px-4 py-3 font-semibold text-theme-text-primary">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-theme-card-bg border border-theme-border-input flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
                                  {(emp.codename || emp.username).slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-mono text-xs font-bold text-theme-text-primary block truncate">
                                    {emp.codename || emp.username.toUpperCase()}
                                  </span>
                                  <span className="text-[10px] text-theme-text-muted block truncate">
                                    {emp.full_name || emp.job_role || emp.role}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Shift (Join, Close, Live Timer) */}
                            <td className="px-4 py-3">
                              {daily?.join_time ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <span className="text-theme-text-muted">Join:</span>
                                    <span className="font-mono font-semibold text-theme-text-primary">
                                      {formatTime(daily.join_time)}
                                    </span>
                                  </div>
                                  {isClosed && daily.close_time && (
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                      <span className="text-theme-text-muted">Close:</span>
                                      <span className="font-mono font-semibold text-theme-text-primary">
                                        {formatTime(daily.close_time)}
                                      </span>
                                    </div>
                                  )}
                                  {!isClosed && (
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                      <Clock className="w-2.5 h-2.5 animate-pulse" />
                                      <span>Working: {formatDurationSeconds(liveWorkingSeconds)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-theme-text-muted/60">-</span>
                              )}
                            </td>

                            {/* Break (Snack) */}
                            <td className="px-4 py-3">
                              {snackBreaks.length === 0 ? (
                                <span className="text-theme-text-muted/60">-</span>
                              ) : (
                                <div className="space-y-1 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                                  {snackBreaks.map((b) => {
                                    const isActive = !b.end_time;
                                    let elapsedSec = 0;
                                    if (isActive) {
                                      elapsedSec = Math.max(0, Math.floor((now - new Date(b.start_time).getTime()) / 1000));
                                    } else if (b.end_time) {
                                      elapsedSec = Math.max(0, Math.floor((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 1000));
                                    }
                                    const elapsedMinutes = Math.floor(elapsedSec / 60);
                                    const isRedWarning = isActive && elapsedMinutes >= 8;

                                    return (
                                      <div
                                        key={b.id}
                                        className={`flex items-center justify-between text-[11px] px-2 py-1 rounded-lg border font-mono ${
                                          isActive
                                            ? isRedWarning
                                              ? "bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse font-bold"
                                              : "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                                            : "bg-theme-card-bg/40 border-theme-border-input/40 text-theme-text-secondary"
                                        }`}
                                      >
                                        <span>
                                          {formatTime(b.start_time)} - {isActive ? "Active" : formatTime(b.end_time)}
                                        </span>
                                        <span className="text-[10px] ml-2">
                                          ({elapsedMinutes}m)
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>

                            {/* Prayer Break */}
                            <td className="px-4 py-3">
                              {prayerBreaks.length === 0 ? (
                                <span className="text-theme-text-muted/60">-</span>
                              ) : (
                                <div className="space-y-1 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                                  {prayerBreaks.map((b) => {
                                    const isActive = !b.end_time;
                                    let elapsedSec = 0;
                                    if (isActive) {
                                      elapsedSec = Math.max(0, Math.floor((now - new Date(b.start_time).getTime()) / 1000));
                                    } else if (b.end_time) {
                                      elapsedSec = Math.max(0, Math.floor((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 1000));
                                    }
                                    const elapsedMinutes = Math.floor(elapsedSec / 60);

                                    return (
                                      <div
                                        key={b.id}
                                        className={`flex items-center justify-between text-[11px] px-2 py-1 rounded-lg border font-mono ${
                                          isActive
                                            ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold"
                                            : "bg-theme-card-bg/40 border-theme-border-input/40 text-theme-text-secondary"
                                        }`}
                                      >
                                        <span>
                                          {formatTime(b.start_time)} - {isActive ? "Active" : formatTime(b.end_time)}
                                        </span>
                                        <span className="text-[10px] ml-2">
                                          ({elapsedMinutes}m)
                                        </span>
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
                              ) : !daily?.join_time ? (
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

                            {/* Total Duration */}
                            <td className="px-4 py-3">
                              {daily?.join_time ? (
                                <div className="space-y-0.5 text-[10px] font-mono">
                                  <div className="text-emerald-400 font-bold">
                                    Work: {isClosed ? formatDurationMinutes(Number(daily.total_work_minutes) || 0) : formatDurationSeconds(liveWorkingSeconds)}
                                  </div>
                                  <div className="text-amber-400/80">
                                    Break: {formatDurationMinutes(Number(daily.total_break_minutes) || 0)}
                                  </div>
                                  <div className="text-sky-400/80">
                                    Prayer: {formatDurationMinutes(Number(daily.total_prayer_minutes) || 0)}
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
          {/* Monthly Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-theme-card-container/40 p-3.5 border border-theme-border-input/60 rounded-xl">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Year Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">
                  Year:
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-1.5 bg-theme-card-bg border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary focus:outline-none focus:border-blue-500"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">
                  Month:
                </span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-theme-card-bg border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary focus:outline-none focus:border-blue-500"
                >
                  {monthsList.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                <input
                  type="text"
                  placeholder="Filter codename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-theme-border-input bg-theme-card-bg text-xs text-theme-text-primary placeholder:text-theme-text-muted/60 focus:outline-none focus:border-blue-500 transition-colors w-40 sm:w-56"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchMonthlyAttendance(false)}
              disabled={monthlyLoading}
              className="p-2 bg-theme-card-bg border border-theme-border-input hover:border-theme-border-active text-theme-text-muted hover:text-theme-text-primary rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold ml-auto"
              title="Refresh monthly records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${monthlyLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Monthly Aggregated Table */}
          {monthlyLoading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : (
            <div className="bg-theme-page-bg/40 border border-theme-border-muted/80 rounded-2xl overflow-hidden shadow-inner backdrop-blur-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-theme-card-container border-b border-theme-border-muted/80 text-[10px] text-theme-text-muted uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 min-w-[160px]">Employee Codename</th>
                      <th className="px-4 py-3 min-w-[130px] text-center">Days Worked</th>
                      <th className="px-4 py-3 min-w-[150px]">Total Work Time</th>
                      <th className="px-4 py-3 min-w-[150px]">Total Break Time</th>
                      <th className="px-4 py-3 min-w-[150px]">Total Prayer Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border-muted/40 text-theme-text-secondary">
                    {monthlySummary.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-theme-text-muted">
                          No monthly records found for this period.
                        </td>
                      </tr>
                    ) : (
                      monthlySummary.map(({ profile: emp, daysWorked, totalWorkMinutes, totalBreakMinutes, totalPrayerMinutes }) => (
                        <tr key={emp.id} className="hover:bg-theme-card-bg/25 transition-colors">
                          {/* Employee */}
                          <td className="px-4 py-3 font-semibold text-theme-text-primary">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-theme-card-bg border border-theme-border-input flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
                                {(emp.codename || emp.username).slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-mono text-xs font-bold text-theme-text-primary block truncate">
                                  {emp.codename || emp.username.toUpperCase()}
                                </span>
                                <span className="text-[10px] text-theme-text-muted block truncate">
                                  {emp.full_name || emp.job_role || emp.role}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Days Worked */}
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                              {daysWorked} {daysWorked === 1 ? "day" : "days"}
                            </span>
                          </td>

                          {/* Work Time */}
                          <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                            {formatDurationMinutes(totalWorkMinutes)}
                          </td>

                          {/* Break Time */}
                          <td className="px-4 py-3 font-mono text-amber-400">
                            {formatDurationMinutes(totalBreakMinutes)}
                          </td>

                          {/* Prayer Time */}
                          <td className="px-4 py-3 font-mono text-sky-400">
                            {formatDurationMinutes(totalPrayerMinutes)}
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
    </div>
  );
};
