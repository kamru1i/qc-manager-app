'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import {
  Profile,
  AttendanceDaily,
  AttendanceShift,
  AttendanceBreak,
  AttendanceStatus,
} from '@/types';
import { attendanceService } from '@/services';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import { toast } from 'sonner';
import {
  calculateTotalDailyWorkingSeconds,
  calculateShiftWorkingSeconds,
  calculateBreakSessionSeconds,
  calculateTotalBreakTypeSeconds,
} from '@/utils/attendanceHelpers';

// ─── Module-level cache for today's attendance ─────────────────────────────
const _todayAttendanceCache = {
  dailyList: [] as AttendanceDaily[],
  shiftsList: [] as AttendanceShift[],
  breaksList: [] as AttendanceBreak[],
  date: '',
  timestamp: 0,
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface AttendanceContextValue {
  dailyAttendance: AttendanceDaily[];
  attendanceShifts: AttendanceShift[];
  attendanceBreaks: AttendanceBreak[];
  loading: boolean;
  now: number;
  myDailyRecord: AttendanceDaily | null;
  myShifts: AttendanceShift[];
  myActiveShift: AttendanceShift | null;
  myBreaks: AttendanceBreak[];
  myActiveBreak: AttendanceBreak | null;
  myWorkingSeconds: number;
  myActiveShiftWorkingSeconds: number;
  myActiveBreakSeconds: number;
  myStatus: AttendanceStatus | 'NOT_JOINED' | 'DAY_OFF';
  isSunday: boolean;
  joinShift: () => Promise<void>;
  closeShift: () => Promise<void>;
  toggleSnackBreak: () => Promise<void>;
  togglePrayerBreak: () => Promise<void>;
  deleteShiftSession: (shift: AttendanceShift, employeeId: string, attendanceDate: string) => Promise<void>;
  deleteBreakSession: (breakItem: AttendanceBreak, employeeId: string, attendanceDate: string) => Promise<void>;
  refreshAttendance: (isSilent?: boolean) => Promise<void>;
}

const defaultAttendanceContextValue: AttendanceContextValue = {
  dailyAttendance: [],
  attendanceShifts: [],
  attendanceBreaks: [],
  loading: false,
  now: Date.now(),
  myDailyRecord: null,
  myShifts: [],
  myActiveShift: null,
  myBreaks: [],
  myActiveBreak: null,
  myWorkingSeconds: 0,
  myActiveShiftWorkingSeconds: 0,
  myActiveBreakSeconds: 0,
  myStatus: 'NOT_JOINED',
  isSunday: false,
  joinShift: async () => {},
  closeShift: async () => {},
  toggleSnackBreak: async () => {},
  togglePrayerBreak: async () => {},
  deleteShiftSession: async () => {},
  deleteBreakSession: async () => {},
  refreshAttendance: async () => {},
};

const AttendanceContext = createContext<AttendanceContextValue>(defaultAttendanceContextValue);

// ─── Provider ──────────────────────────────────────────────────────────────

interface AttendanceProviderProps {
  children: React.ReactNode;
  sessionUser: SupabaseUser | null;
  profile: Profile | null;
}

export function AttendanceProvider({ children, sessionUser, profile }: AttendanceProviderProps) {
  const profileId = profile?.id || '';
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  const [dailyAttendance, setDailyAttendance] = useState<AttendanceDaily[]>(() => {
    if (_todayAttendanceCache.date === todayStr && _todayAttendanceCache.dailyList.length > 0) {
      return _todayAttendanceCache.dailyList;
    }
    return [];
  });

  const [attendanceShifts, setAttendanceShifts] = useState<AttendanceShift[]>(() => {
    if (_todayAttendanceCache.date === todayStr && _todayAttendanceCache.shiftsList.length > 0) {
      return _todayAttendanceCache.shiftsList;
    }
    return [];
  });

  const [attendanceBreaks, setAttendanceBreaks] = useState<AttendanceBreak[]>(() => {
    if (_todayAttendanceCache.date === todayStr && _todayAttendanceCache.breaksList.length > 0) {
      return _todayAttendanceCache.breaksList;
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    return !(_todayAttendanceCache.date === todayStr && _todayAttendanceCache.timestamp > 0);
  });

  const [now, setNow] = useState<number>(() => Date.now());

  // Sub-second local timer tick (keeps all UI timers and clocks in lockstep synchrony)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Check if today is Sunday (Weekly holiday)
  const isSunday = useMemo(() => {
    try {
      const parts = todayStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.getDay() === 0;
      }
    } catch {
      // fallback
    }
    return false;
  }, [todayStr]);

  // Fetch today's attendance records
  const refreshAttendance = useCallback(
    async (isSilent = false, signal?: AbortSignal) => {
      if (!profileId) return;
      if (!isSilent) setLoading(true);
      try {
        const [dailyRes, shiftsRes, breaksRes] = await Promise.all([
          attendanceService.getDailyAttendance({ date: todayStr, signal }),
          attendanceService.getAttendanceShifts({ date: todayStr, signal }),
          attendanceService.getAttendanceBreaks({ date: todayStr, signal }),
        ]);

        if (signal?.aborted) return;
        if (dailyRes.error) throw dailyRes.error;
        if (shiftsRes.error) throw shiftsRes.error;
        if (breaksRes.error) throw breaksRes.error;

        const nextDaily = dailyRes.data || [];
        const nextShifts = shiftsRes.data || [];
        const nextBreaks = breaksRes.data || [];

        setDailyAttendance(nextDaily);
        setAttendanceShifts(nextShifts);
        setAttendanceBreaks(nextBreaks);

        _todayAttendanceCache.dailyList = nextDaily;
        _todayAttendanceCache.shiftsList = nextShifts;
        _todayAttendanceCache.breaksList = nextBreaks;
        _todayAttendanceCache.date = todayStr;
        _todayAttendanceCache.timestamp = Date.now();
      } catch (err: unknown) {
        if (signal?.aborted) return;
        console.error('AttendanceProvider: failed to fetch attendance:', err);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [profileId, todayStr]
  );

  // Initial load
  useEffect(() => {
    if (!profileId) return;
    const controller = new AbortController();
    const isCached = _todayAttendanceCache.date === todayStr && _todayAttendanceCache.timestamp > 0;
    refreshAttendance(isCached, controller.signal);
    return () => controller.abort();
  }, [profileId, todayStr, refreshAttendance]);

  // Realtime Handler for attendance_daily
  const handleDailyRealtime = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = (payload.old as { id?: string })?.id;
        if (!deletedId) return;
        setDailyAttendance((prev) => prev.filter((d) => d.id !== deletedId));
        return;
      }

      const row = payload.new as unknown as AttendanceDaily;
      if (!row?.id) return;

      if (row.attendance_date === todayStr) {
        setDailyAttendance((prev) => {
          const exists = prev.some((d) => d.id === row.id);
          const next = exists ? prev.map((d) => (d.id === row.id ? { ...d, ...row } : d)) : [...prev, row];
          _todayAttendanceCache.dailyList = next;
          return next;
        });
      }
    },
    [todayStr]
  );

  // Realtime Handler for attendance_shifts
  const handleShiftsRealtime = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = (payload.old as { id?: string })?.id;
        if (!deletedId) return;
        setAttendanceShifts((prev) => prev.filter((s) => s.id !== deletedId));
        return;
      }

      const row = payload.new as unknown as AttendanceShift;
      if (!row?.id) return;

      if (row.attendance_date === todayStr) {
        setAttendanceShifts((prev) => {
          const exists = prev.some((s) => s.id === row.id);
          const next = exists ? prev.map((s) => (s.id === row.id ? { ...s, ...row } : s)) : [...prev, row];
          _todayAttendanceCache.shiftsList = next;
          return next;
        });
      }
    },
    [todayStr]
  );

  // Realtime Handler for attendance_breaks
  const handleBreaksRealtime = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = (payload.old as { id?: string })?.id;
        if (!deletedId) return;
        setAttendanceBreaks((prev) => prev.filter((b) => b.id !== deletedId));
        return;
      }

      const row = payload.new as unknown as AttendanceBreak;
      if (!row?.id) return;

      if (row.attendance_date === todayStr) {
        setAttendanceBreaks((prev) => {
          const exists = prev.some((b) => b.id === row.id);
          const next = exists ? prev.map((b) => (b.id === row.id ? { ...b, ...row } : b)) : [...prev, row];
          _todayAttendanceCache.breaksList = next;
          return next;
        });
      }
    },
    [todayStr]
  );

  useRealtimeHandler('attendance_daily', handleDailyRealtime);
  useRealtimeHandler('attendance_shifts', handleShiftsRealtime);
  useRealtimeHandler('attendance_breaks', handleBreaksRealtime);

  // Current logged in user's state
  const myDailyRecord = useMemo(() => {
    if (!profileId) return null;
    return dailyAttendance.find((a) => a.user_id === profileId) || null;
  }, [profileId, dailyAttendance]);

  const myShifts = useMemo(() => {
    if (!profileId) return [];
    return attendanceShifts.filter((s) => s.user_id === profileId);
  }, [profileId, attendanceShifts]);

  const myActiveShift = useMemo(() => {
    return myShifts.find((s) => !s.close_time) || null;
  }, [myShifts]);

  const myBreaks = useMemo(() => {
    if (!profileId) return [];
    return attendanceBreaks.filter((b) => b.user_id === profileId);
  }, [profileId, attendanceBreaks]);

  const myActiveBreak = useMemo(() => {
    return myBreaks.find((b) => !b.end_time) || null;
  }, [myBreaks]);

  const myWorkingSeconds = useMemo(() => {
    return calculateTotalDailyWorkingSeconds(myDailyRecord, myShifts, myBreaks, now);
  }, [myDailyRecord, myShifts, myBreaks, now]);

  const myActiveShiftWorkingSeconds = useMemo(() => {
    if (!myActiveShift) return 0;
    return calculateShiftWorkingSeconds(myActiveShift, myBreaks, now);
  }, [myActiveShift, myBreaks, now]);

  const myActiveBreakSeconds = useMemo(() => {
    return myActiveBreak ? calculateBreakSessionSeconds(myActiveBreak, now) : 0;
  }, [myActiveBreak, now]);

  const myStatus: AttendanceStatus | 'NOT_JOINED' | 'DAY_OFF' = useMemo(() => {
    if (isSunday) return 'DAY_OFF';
    if (!myDailyRecord || (!myDailyRecord.join_time && myShifts.length === 0)) return 'NOT_JOINED';
    return myDailyRecord.status;
  }, [isSunday, myDailyRecord, myShifts]);

  // Actions
  const joinShift = async () => {
    if (!profileId) return;
    if (isSunday) {
      toast.error('Today is Sunday (Weekly Holiday). Joining is disabled.');
      return;
    }
    const nowIso = new Date().toISOString();

    try {
      const { daily, shift, error } = await attendanceService.joinShift(profileId, todayStr, nowIso);
      if (error) throw error;

      if (daily) {
        setDailyAttendance((prev) => {
          const exists = prev.some((d) => d.id === daily.id);
          const next = exists ? prev.map((d) => (d.id === daily.id ? daily : d)) : [...prev, daily];
          _todayAttendanceCache.dailyList = next;
          return next;
        });
      }

      if (shift) {
        setAttendanceShifts((prev) => {
          const exists = prev.some((s) => s.id === shift.id);
          const next = exists ? prev.map((s) => (s.id === shift.id ? shift : s)) : [...prev, shift];
          _todayAttendanceCache.shiftsList = next;
          return next;
        });
      }

      toast.success('Joined shift successfully! Have a great workday.');
    } catch (err) {
      console.error('Failed to join shift:', err);
      toast.error('Failed to record shift join.');
    }
  };

  const closeShift = async () => {
    if (!profileId || !myDailyRecord) return;
    const closeTimeIso = new Date().toISOString();
    const closeTimeMs = new Date(closeTimeIso).getTime();

    try {
      // 1. Auto-close any active break session
      let updatedBreaks = [...myBreaks];
      if (myActiveBreak) {
        const breakStartMs = new Date(myActiveBreak.start_time).getTime();
        const activeDurSec = Math.max(0, Math.floor((closeTimeMs - breakStartMs) / 1000));
        const durMin = activeDurSec / 60;

        const totalBreakSec = calculateTotalBreakTypeSeconds(
          myBreaks.map((b) => (b.id === myActiveBreak.id ? { ...b, end_time: closeTimeIso, duration_minutes: durMin } : b)),
          'snack',
          closeTimeMs
        );
        const totalPrayerSec = calculateTotalBreakTypeSeconds(
          myBreaks.map((b) => (b.id === myActiveBreak.id ? { ...b, end_time: closeTimeIso, duration_minutes: durMin } : b)),
          'prayer',
          closeTimeMs
        );

        const { data: closedBreakData } = await attendanceService.endBreak({
          breakId: myActiveBreak.id,
          attendanceId: myDailyRecord.id,
          endTime: closeTimeIso,
          durationMinutes: durMin,
          totalBreakMinutes: totalBreakSec / 60,
          totalPrayerMinutes: totalPrayerSec / 60,
        });

        if (closedBreakData) {
          updatedBreaks = updatedBreaks.map((b) => (b.id === closedBreakData.id ? closedBreakData : b));
          setAttendanceBreaks((prev) => {
            const next = prev.map((b) => (b.id === closedBreakData.id ? closedBreakData : b));
            _todayAttendanceCache.breaksList = next;
            return next;
          });
        }
      }

      // 2. Calculate shift duration and overall day totals
      const targetShift = myActiveShift || myShifts[myShifts.length - 1];
      const shiftJoinMs = targetShift?.join_time ? new Date(targetShift.join_time).getTime() : closeTimeMs;
      const shiftGrossSec = Math.max(0, Math.floor((closeTimeMs - shiftJoinMs) / 1000));
      const shiftDurationSec = shiftGrossSec;

      // Updated shifts array with this shift closed
      const updatedShifts = myShifts.map((s) => {
        if (targetShift && s.id === targetShift.id) {
          return { ...s, close_time: closeTimeIso, duration_seconds: shiftDurationSec };
        }
        return s;
      });

      const totalDayWorkSec = calculateTotalDailyWorkingSeconds(myDailyRecord, updatedShifts, updatedBreaks, closeTimeMs);
      const totalDayBreakSec = calculateTotalBreakTypeSeconds(updatedBreaks, 'snack', closeTimeMs);
      const totalDayPrayerSec = calculateTotalBreakTypeSeconds(updatedBreaks, 'prayer', closeTimeMs);

      const { daily: closedDaily, shift: closedShiftRecord, error } = await attendanceService.closeShift({
        dailyId: myDailyRecord.id,
        shiftId: targetShift?.id,
        closeTime: closeTimeIso,
        shiftDurationSeconds: shiftDurationSec,
        totalWorkMinutes: totalDayWorkSec / 60,
        totalBreakMinutes: totalDayBreakSec / 60,
        totalPrayerMinutes: totalDayPrayerSec / 60,
      });

      if (error) throw error;

      if (closedDaily) {
        setDailyAttendance((prev) => {
          const next = prev.map((d) => (d.id === closedDaily.id ? closedDaily : d));
          _todayAttendanceCache.dailyList = next;
          return next;
        });
      }

      if (closedShiftRecord) {
        setAttendanceShifts((prev) => {
          const next = prev.map((s) => (s.id === closedShiftRecord.id ? closedShiftRecord : s));
          _todayAttendanceCache.shiftsList = next;
          return next;
        });
      } else if (targetShift) {
        setAttendanceShifts((prev) => {
          const next = prev.map((s) => (s.id === targetShift.id ? { ...s, close_time: closeTimeIso, duration_seconds: shiftDurationSec } : s));
          _todayAttendanceCache.shiftsList = next;
          return next;
        });
      }

      toast.success('Shift closed successfully. See you next time!');
    } catch (err) {
      console.error('Failed to close shift:', err);
      toast.error('Failed to close shift.');
    }
  };

  const toggleSnackBreak = async () => {
    if (!profileId || !myDailyRecord) return;
    const nowIso = new Date().toISOString();
    const nowMs = new Date(nowIso).getTime();

    if (myDailyRecord.status === 'SNACK_BREAK' && myActiveBreak && myActiveBreak.type === 'snack') {
      // End snack break
      const startMs = new Date(myActiveBreak.start_time).getTime();
      const durSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      const durMin = durSec / 60;

      const updatedBreaks = myBreaks.map((b) => (b.id === myActiveBreak.id ? { ...b, end_time: nowIso, duration_minutes: durMin } : b));
      const totalBreakSec = calculateTotalBreakTypeSeconds(updatedBreaks, 'snack', nowMs);
      const totalPrayerSec = calculateTotalBreakTypeSeconds(updatedBreaks, 'prayer', nowMs);

      try {
        const { data: closedBreak, error } = await attendanceService.endBreak({
          breakId: myActiveBreak.id,
          attendanceId: myDailyRecord.id,
          endTime: nowIso,
          durationMinutes: durMin,
          totalBreakMinutes: totalBreakSec / 60,
          totalPrayerMinutes: totalPrayerSec / 60,
        });

        if (error) throw error;

        if (closedBreak) {
          setAttendanceBreaks((prev) => {
            const next = prev.map((b) => (b.id === closedBreak.id ? closedBreak : b));
            _todayAttendanceCache.breaksList = next;
            return next;
          });
        }

        setDailyAttendance((prev) => {
          const next = prev.map((d) =>
            d.id === myDailyRecord.id
              ? {
                  ...d,
                  status: 'WORKING' as AttendanceStatus,
                  total_break_minutes: totalBreakSec / 60,
                  total_prayer_minutes: totalPrayerSec / 60,
                }
              : d
          );
          _todayAttendanceCache.dailyList = next;
          return next;
        });

        toast.success('Break ended. Back to work!');
      } catch (err) {
        console.error('Failed to end break:', err);
        toast.error('Failed to end break.');
      }
    } else {
      // Start snack break
      try {
        const { data: newBreak, error } = await attendanceService.startBreak({
          attendanceId: myDailyRecord.id,
          shiftId: myActiveShift?.id,
          userId: profileId,
          attendanceDate: todayStr,
          type: 'snack',
          startTime: nowIso,
        });

        if (error) throw error;

        if (newBreak) {
          setAttendanceBreaks((prev) => {
            const next = [...prev, newBreak];
            _todayAttendanceCache.breaksList = next;
            return next;
          });
        }

        setDailyAttendance((prev) => {
          const next = prev.map((d) =>
            d.id === myDailyRecord.id ? { ...d, status: 'SNACK_BREAK' as AttendanceStatus } : d
          );
          _todayAttendanceCache.dailyList = next;
          return next;
        });

        toast.success('Break started. Enjoy your break!');
      } catch (err) {
        console.error('Failed to start break:', err);
        toast.error('Failed to start break.');
      }
    }
  };

  const togglePrayerBreak = async () => {
    if (!profileId || !myDailyRecord) return;
    const nowIso = new Date().toISOString();
    const nowMs = new Date(nowIso).getTime();

    if (myDailyRecord.status === 'PRAYER_BREAK' && myActiveBreak && myActiveBreak.type === 'prayer') {
      // End prayer break
      const startMs = new Date(myActiveBreak.start_time).getTime();
      const durSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      const durMin = durSec / 60;

      const updatedBreaks = myBreaks.map((b) => (b.id === myActiveBreak.id ? { ...b, end_time: nowIso, duration_minutes: durMin } : b));
      const totalBreakSec = calculateTotalBreakTypeSeconds(updatedBreaks, 'snack', nowMs);
      const totalPrayerSec = calculateTotalBreakTypeSeconds(updatedBreaks, 'prayer', nowMs);

      try {
        const { data: closedBreak, error } = await attendanceService.endBreak({
          breakId: myActiveBreak.id,
          attendanceId: myDailyRecord.id,
          endTime: nowIso,
          durationMinutes: durMin,
          totalBreakMinutes: totalBreakSec / 60,
          totalPrayerMinutes: totalPrayerSec / 60,
        });

        if (error) throw error;

        if (closedBreak) {
          setAttendanceBreaks((prev) => {
            const next = prev.map((b) => (b.id === closedBreak.id ? closedBreak : b));
            _todayAttendanceCache.breaksList = next;
            return next;
          });
        }

        setDailyAttendance((prev) => {
          const next = prev.map((d) =>
            d.id === myDailyRecord.id
              ? {
                  ...d,
                  status: 'WORKING' as AttendanceStatus,
                  total_break_minutes: totalBreakSec / 60,
                  total_prayer_minutes: totalPrayerSec / 60,
                }
              : d
          );
          _todayAttendanceCache.dailyList = next;
          return next;
        });

        toast.success('Prayer break ended. Back to work!');
      } catch (err) {
        console.error('Failed to end prayer break:', err);
        toast.error('Failed to end prayer break.');
      }
    } else {
      // Start prayer break
      try {
        const { data: newBreak, error } = await attendanceService.startBreak({
          attendanceId: myDailyRecord.id,
          shiftId: myActiveShift?.id,
          userId: profileId,
          attendanceDate: todayStr,
          type: 'prayer',
          startTime: nowIso,
        });

        if (error) throw error;

        if (newBreak) {
          setAttendanceBreaks((prev) => {
            const next = [...prev, newBreak];
            _todayAttendanceCache.breaksList = next;
            return next;
          });
        }

        setDailyAttendance((prev) => {
          const next = prev.map((d) =>
            d.id === myDailyRecord.id ? { ...d, status: 'PRAYER_BREAK' as AttendanceStatus } : d
          );
          _todayAttendanceCache.dailyList = next;
          return next;
        });

        toast.success('Prayer break started.');
      } catch (err) {
        console.error('Failed to start prayer break:', err);
        toast.error('Failed to start prayer break.');
      }
    }
  };

  const deleteShiftSession = async (shift: AttendanceShift, employeeId: string, attendanceDate: string) => {
    if (!profile || profile.role !== 'superadmin') {
      toast.error('Only Superadmin can delete shift sessions.');
      return;
    }

    try {
      const { daily: updatedDaily, error } = await attendanceService.deleteShiftSession({
        shiftId: shift.id,
        attendanceId: shift.attendance_id,
        userId: employeeId,
        attendanceDate: attendanceDate,
      });

      if (error) throw error;

      // Update local shifts
      setAttendanceShifts((prev) => {
        const next = prev.filter((s) => s.id !== shift.id);
        _todayAttendanceCache.shiftsList = next;
        return next;
      });

      // Update local breaks (remove breaks tied to this shift)
      setAttendanceBreaks((prev) => {
        const next = prev.filter((b) => b.shift_id !== shift.id);
        _todayAttendanceCache.breaksList = next;
        return next;
      });

      // Update local daily record
      setDailyAttendance((prev) => {
        let next: AttendanceDaily[];
        if (!updatedDaily) {
          next = prev.filter((d) => d.id !== shift.attendance_id);
        } else {
          next = prev.map((d) => (d.id === updatedDaily.id ? updatedDaily : d));
        }
        _todayAttendanceCache.dailyList = next;
        return next;
      });

      toast.success('Shift session deleted successfully.');
    } catch (err: unknown) {
      console.error('Failed to delete shift session:', err);
      toast.error('Failed to delete shift session: ' + ((err as Error).message || 'unknown error'));
    }
  };

  const deleteBreakSession = async (breakItem: AttendanceBreak, employeeId: string, attendanceDate: string) => {
    if (!profile || profile.role !== 'superadmin') {
      toast.error('Only Superadmin can delete break sessions.');
      return;
    }

    try {
      const { daily: updatedDaily, error } = await attendanceService.deleteBreakSession({
        breakId: breakItem.id,
        attendanceId: breakItem.attendance_id,
        userId: employeeId,
        attendanceDate: attendanceDate,
      });

      if (error) throw error;

      // Update local breaks
      setAttendanceBreaks((prev) => {
        const next = prev.filter((b) => b.id !== breakItem.id);
        _todayAttendanceCache.breaksList = next;
        return next;
      });

      // Update local daily record
      if (updatedDaily) {
        setDailyAttendance((prev) => {
          const next = prev.map((d) => (d.id === updatedDaily.id ? updatedDaily : d));
          _todayAttendanceCache.dailyList = next;
          return next;
        });
      }

      toast.success('Break session deleted successfully.');
    } catch (err: unknown) {
      console.error('Failed to delete break session:', err);
      toast.error('Failed to delete break session: ' + ((err as Error).message || 'unknown error'));
    }
  };

  const value: AttendanceContextValue = {
    dailyAttendance,
    attendanceShifts,
    attendanceBreaks,
    loading,
    now,
    myDailyRecord,
    myShifts,
    myActiveShift,
    myBreaks,
    myActiveBreak,
    myWorkingSeconds,
    myActiveShiftWorkingSeconds,
    myActiveBreakSeconds,
    myStatus,
    isSunday,
    joinShift,
    closeShift,
    toggleSnackBreak,
    togglePrayerBreak,
    deleteShiftSession,
    deleteBreakSession,
    refreshAttendance,
  };

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

// ─── Consumer Hook ─────────────────────────────────────────────────────────

export function useAttendance() {
  return useContext(AttendanceContext);
}
