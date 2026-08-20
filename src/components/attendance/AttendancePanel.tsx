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
  Calendar,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { attendanceService } from "@/services";
import { useRealtimeHandler, RealtimePayload } from "@/contexts/RealtimeContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { canWriteAttendance } from "@/utils/permissionService";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import {
  formatAttendanceTime,
  formatDurationSeconds,
  formatDurationMinutes,
  formatDateToDDMMYYYY,
  calculateWorkingSeconds,
  calculateBreakSessionSeconds,
  formatBreakSessionElapsed,
  calculateTotalBreakTypeSeconds,
  getLatestAttendanceActivityTimestamp,
} from "@/utils/attendanceHelpers";

interface AttendancePanelProps {
  profile: Profile | null;
}

// Module-level caches to preserve state across component remounts and focus changes
const _dailyAttendanceCache = new Map<string, { dailyList: AttendanceDaily[]; breaksList: AttendanceBreak[]; timestamp: number }>();
const _monthlyAttendanceCache = new Map<string, { dailyList: AttendanceDaily[]; breaksList: AttendanceBreak[]; timestamp: number }>();

export const AttendancePanel: React.FC<AttendancePanelProps> = ({ profile }) => {
  const { profilesList } = useProfiles();
  const datePickerRef = useRef<HTMLInputElement>(null);

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
  const profileId = profile?.id || "";

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
    if (!profileId) return null;
    return dailyAttendance.find((a) => a.user_id === profileId) || null;
  }, [profileId, dailyAttendance]);

  const myBreaks = useMemo(() => {
    if (!profileId) return [];
    return attendanceBreaks.filter((b) => b.user_id === profileId);
  }, [profileId, attendanceBreaks]);

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
    async (isSilent = false, signal?: AbortSignal) => {
      if (!isSilent) setLoading(true);
      try {
        const [dailyRes, breaksRes] = await Promise.all([
          attendanceService.getDailyAttendance({ date: selectedDate, signal }),
          attendanceService.getAttendanceBreaks({ date: selectedDate, signal }),
        ]);

        if (signal?.aborted) return;
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
        if (signal?.aborted) return;
        console.error("Failed to fetch daily attendance:", err);
        toast.error("Failed to load attendance records.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [selectedDate]
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

        const [dailyRes, breaksRes] = await Promise.all([
          attendanceService.getDailyAttendance({ startDate, endDate, signal }),
          attendanceService.getAttendanceBreaks({ startDate, endDate, signal }),
        ]);

        if (signal?.aborted) return;
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
        if (signal?.aborted) return;
        console.error("Failed to fetch monthly attendance:", err);
        toast.error("Failed to load monthly attendance.");
      } finally {
        if (!signal?.aborted) setMonthlyLoading(false);
      }
    },
    [selectedYear, selectedMonth]
  );

  // Initial & Dependency-driven fetch
  useEffect(() => {
    const controller = new AbortController();
    if (subTab === "daily") {
      const hasCached = _dailyAttendanceCache.has(selectedDate);
      fetchDailyAttendance(hasCached, controller.signal);
    } else {
      const hasCached = _monthlyAttendanceCache.has(`${selectedYear}_${selectedMonth}`);
      fetchMonthlyAttendance(hasCached, controller.signal);
    }
    return () => controller.abort();
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
          const next = exists ? prev.map((d) => (d.id === data.id ? data : d)) : [...prev, data];
          _dailyAttendanceCache.set(selectedDate, {
            dailyList: next,
            breaksList: attendanceBreaks,
            timestamp: Date.now(),
          });
          return next;
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
    const closeTimeMs = new Date(closeTimeIso).getTime();

    // Calculate total break & prayer seconds
    let currentTotalBreakSec = 0;
    let currentTotalPrayerSec = 0;

    myBreaks.forEach((b) => {
      if (b.end_time) {
        const s = new Date(b.start_time).getTime();
        const e = new Date(b.end_time).getTime();
        const dur = Math.max(0, Math.floor((e - s) / 1000));
        if (b.type === "snack") currentTotalBreakSec += dur;
        else currentTotalPrayerSec += dur;
      }
    });

    if (activeBreak) {
      const breakStartMs = new Date(activeBreak.start_time).getTime();
      const activeDurSec = Math.max(0, Math.floor((closeTimeMs - breakStartMs) / 1000));
      if (activeBreak.type === "snack") currentTotalBreakSec += activeDurSec;
      else currentTotalPrayerSec += activeDurSec;

      const durMin = activeDurSec / 60;
      await attendanceService.endBreak(
        activeBreak.id,
        myDailyRecord.id,
        closeTimeIso,
        durMin,
        currentTotalBreakSec / 60,
        currentTotalPrayerSec / 60
      );
    }

    const joinMs = myDailyRecord.join_time ? new Date(myDailyRecord.join_time).getTime() : closeTimeMs;
    const grossSec = Math.max(0, Math.floor((closeTimeMs - joinMs) / 1000));
    const netWorkSec = Math.max(0, grossSec - currentTotalBreakSec - currentTotalPrayerSec);
    const netWorkMin = netWorkSec / 60;

    try {
      const { data, error } = await attendanceService.closeShift(
        myDailyRecord.id,
        closeTimeIso,
        netWorkMin
      );
      if (error) throw error;
      if (data) {
        setDailyAttendance((prev) => {
          const next = prev.map((d) => (d.id === data.id ? { ...data, updated_at: closeTimeIso } : d));
          _dailyAttendanceCache.set(selectedDate, {
            dailyList: next,
            breaksList: attendanceBreaks,
            timestamp: Date.now(),
          });
          return next;
        });
        toast.success("Shift closed successfully. See you next time!");
      }
    } catch (err: unknown) {
      console.error("Failed to close shift:", err);
      toast.error("Failed to close shift.");
    }
  };

  // Toggle Snack Break (UI label: Break)
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
      const durSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const durMin = durSec / 60;

      let totalBreakSec = 0;
      myBreaks.forEach((b) => {
        if (b.id !== activeBreak.id && b.type === "snack" && b.end_time) {
          totalBreakSec += Math.max(0, Math.floor((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 1000));
        }
      });
      totalBreakSec += durSec;
      const totalBreakMin = totalBreakSec / 60;
      const totalPrayerMin = Number(myDailyRecord.total_prayer_minutes) || 0;

      try {
        const { error } = await attendanceService.endBreak(
          activeBreak.id,
          myDailyRecord.id,
          nowIso,
          durMin,
          totalBreakMin,
          totalPrayerMin
        );
        if (error) throw error;
        setDailyAttendance((prev) =>
          prev.map((d) =>
            d.id === myDailyRecord.id
              ? { ...d, status: "WORKING", total_break_minutes: totalBreakMin, updated_at: nowIso }
              : d
          )
        );
        setAttendanceBreaks((prev) =>
          prev.map((b) =>
            b.id === activeBreak.id ? { ...b, end_time: nowIso, duration_minutes: durMin, updated_at: nowIso } : b
          )
        );
        toast.success("Break ended. Back to work!");
      } catch (err: unknown) {
        console.error("Failed to end break:", err);
        toast.error("Failed to end break.");
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
            prev.map((d) => (d.id === myDailyRecord.id ? { ...d, status: "SNACK_BREAK", updated_at: nowIso } : d))
          );
          toast.success("Break started! Enjoy your break.");
        }
      } catch (err: unknown) {
        console.error("Failed to start break:", err);
        toast.error("Failed to start break.");
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
      const durSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const durMin = durSec / 60;

      let totalPrayerSec = 0;
      myBreaks.forEach((b) => {
        if (b.id !== activeBreak.id && b.type === "prayer" && b.end_time) {
          totalPrayerSec += Math.max(0, Math.floor((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 1000));
        }
      });
      totalPrayerSec += durSec;
      const totalPrayerMin = totalPrayerSec / 60;
      const totalBreakMin = Number(myDailyRecord.total_break_minutes) || 0;

      try {
        const { error } = await attendanceService.endBreak(
          activeBreak.id,
          myDailyRecord.id,
          nowIso,
          durMin,
          totalBreakMin,
          totalPrayerMin
        );
        if (error) throw error;
        setDailyAttendance((prev) =>
          prev.map((d) =>
            d.id === myDailyRecord.id
              ? { ...d, status: "WORKING", total_prayer_minutes: totalPrayerMin, updated_at: nowIso }
              : d
          )
        );
        setAttendanceBreaks((prev) =>
          prev.map((b) =>
            b.id === activeBreak.id ? { ...b, end_time: nowIso, duration_minutes: durMin, updated_at: nowIso } : b
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
            prev.map((d) => (d.id === myDailyRecord.id ? { ...d, status: "PRAYER_BREAK", updated_at: nowIso } : d))
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
  // Dynamic Row Ordering: Most Recent Attendance Action moves to TOP!
  // If user closed their shift, that action timestamp keeps them at top!
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
        const daily = dailyAttendance.find((d) => d.user_id === emp.id) || null;
        const breaks = attendanceBreaks.filter((b) => b.user_id === emp.id);
        const latestActivityTimestamp = getLatestAttendanceActivityTimestamp(daily, breaks);

        return {
          profile: emp,
          daily,
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

  // Determine single dynamic shift button state
  const isShiftActive = Boolean(
    myDailyRecord &&
      myDailyRecord.join_time &&
      myDailyRecord.status !== "CLOSED" &&
      myDailyRecord.status !== "DAY_OFF"
  );

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

                {/* Hidden Native Date Input */}
                <input
                  type="date"
                  ref={datePickerRef}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
                  tabIndex={-1}
                />
              </div>

              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-blue-600/15 border border-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-600/25 transition-all cursor-pointer shadow-sm"
                  title="Jump to today's attendance"
                >
                  Today
                </button>
              )}
            </div>
          ) : (
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
            </div>
          )}

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

        {/* Right Side: Quick Actions + Sub-tabs + Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end ml-auto">
          {/* Single Dynamic Shift Action Button (Join when not active, Close when active) */}
          {!isShiftActive ? (
            <button
              type="button"
              onClick={handleJoinShift}
              disabled={!hasWritePermission || isSunday}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm"
              title="Start your workday and record join time"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-400" />
              Join
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCloseShift}
              disabled={!hasWritePermission || isSunday}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm"
              title="Close your workday shift and finalize hours"
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
            title="Toggle normal break session"
          >
            <Coffee className="w-3.5 h-3.5" />
            {myDailyRecord?.status === "SNACK_BREAK" ? "End Break" : "Break"}
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
            onClick={() => (subTab === "daily" ? fetchDailyAttendance(false) : fetchMonthlyAttendance(false))}
            disabled={subTab === "daily" ? loading : monthlyLoading}
            className="p-2.5 bg-theme-card-bg border border-theme-border-input hover:border-theme-border-active text-theme-text-muted hover:text-theme-text-primary rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0 shadow-sm"
            title="Refresh attendance records"
            aria-label="Refresh attendance records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(subTab === "daily" ? loading : monthlyLoading) ? "animate-spin" : ""}`} />
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
          {/* Daily Live Attendance Table */}
          {loading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : (
            <div className="bg-theme-page-bg/40 border border-theme-border-muted/80 rounded-2xl overflow-hidden shadow-inner backdrop-blur-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-theme-card-container border-b border-theme-border-muted/80 text-[10px] text-theme-text-muted uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 min-w-[160px] text-left">Employee Codename</th>
                      <th className="px-4 py-3 min-w-[180px] text-center">Shift</th>
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
                      dailyRows.map(({ profile: emp, daily, breaks }) => {
                        const isClosed = daily?.status === "CLOSED";
                        const isWorking = daily?.status === "WORKING";
                        const isSnackBreak = daily?.status === "SNACK_BREAK";
                        const isPrayerBreak = daily?.status === "PRAYER_BREAK";
                        const isEmployeeSunday = isSunday;

                        const snackBreaks = breaks.filter((b) => b.type === "snack");
                        const prayerBreaks = breaks.filter((b) => b.type === "prayer");

                        // Net working seconds calculation
                        const workingSeconds = calculateWorkingSeconds(daily, breaks, now);

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

                            {/* Shift (Join, Close, Live Timer) */}
                            <td className="px-4 py-3 text-center">
                              {daily?.join_time ? (
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
                                      <span>Working: {formatDurationSeconds(workingSeconds)}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-theme-text-muted/60">-</span>
                              )}
                            </td>

                            {/* Break (Snack) */}
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
                                        className={`inline-flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg border font-mono ${
                                          isActive
                                            ? isRedWarning
                                              ? "bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse font-bold"
                                              : "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                                            : "bg-theme-card-bg/40 border-theme-border-input/40 text-theme-text-secondary"
                                        }`}
                                      >
                                        <span>
                                          {formatAttendanceTime(b.start_time)} - {isActive ? "Active" : formatAttendanceTime(b.end_time)}
                                        </span>
                                        <span className="text-[10px] ml-2 font-mono">
                                          ({formatBreakSessionElapsed(sessionSec)})
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>

                            {/* Prayer Break */}
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
                                        className={`inline-flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg border font-mono ${
                                          isActive
                                            ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold"
                                            : "bg-theme-card-bg/40 border-theme-border-input/40 text-theme-text-secondary"
                                        }`}
                                      >
                                        <span>
                                          {formatAttendanceTime(b.start_time)} - {isActive ? "Active" : formatAttendanceTime(b.end_time)}
                                        </span>
                                        <span className="text-[10px] ml-2 font-mono">
                                          ({formatBreakSessionElapsed(sessionSec)})
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

                            {/* Total Duration: Left-aligned with second-level precision */}
                            <td className="px-4 py-3 text-left">
                              {daily?.join_time ? (
                                <div className="space-y-0.5 text-[11px] font-mono flex flex-col items-start text-left">
                                  <div className="text-emerald-400 font-bold">
                                    Work: {formatDurationSeconds(workingSeconds)}
                                  </div>
                                  <div className="text-amber-400/90">
                                    Break: {formatDurationSeconds(totalSnackSec)}
                                  </div>
                                  <div className="text-sky-400/90">
                                    Prayer: {formatDurationSeconds(totalPrayerSec)}
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
          {/* Monthly Aggregated Table */}
          {monthlyLoading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : (
            <div className="bg-theme-page-bg/40 border border-theme-border-muted/80 rounded-2xl overflow-hidden shadow-inner backdrop-blur-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-theme-card-container border-b border-theme-border-muted/80 text-[10px] text-theme-text-muted uppercase tracking-wider font-bold">
                      <th className="px-4 py-3 min-w-[160px] text-left">Employee Codename</th>
                      <th className="px-4 py-3 min-w-[130px] text-center">Days Worked</th>
                      <th className="px-4 py-3 min-w-[150px] text-center">Total Work Time</th>
                      <th className="px-4 py-3 min-w-[150px] text-center">Total Break Time</th>
                      <th className="px-4 py-3 min-w-[150px] text-center">Total Prayer Time</th>
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

                          {/* Days Worked */}
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                              {daysWorked} {daysWorked === 1 ? "day" : "days"}
                            </span>
                          </td>

                          {/* Work Time */}
                          <td className="px-4 py-3 font-mono font-bold text-emerald-400 text-center">
                            {formatDurationMinutes(totalWorkMinutes)}
                          </td>

                          {/* Break Time */}
                          <td className="px-4 py-3 font-mono text-amber-400 text-center">
                            {formatDurationMinutes(totalBreakMinutes)}
                          </td>

                          {/* Prayer Time */}
                          <td className="px-4 py-3 font-mono text-sky-400 text-center">
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
