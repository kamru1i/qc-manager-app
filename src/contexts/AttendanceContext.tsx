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
import { Profile, AttendanceDaily, AttendanceBreak, AttendanceStatus } from '@/types';
import { attendanceService } from '@/services';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import { toast } from 'sonner';
import {
  calculateWorkingSeconds,
  calculateBreakSessionSeconds,
} from '@/utils/attendanceHelpers';

// ─── Module-level cache for today's attendance ─────────────────────────────
const _todayAttendanceCache = {
  dailyList: [] as AttendanceDaily[],
  breaksList: [] as AttendanceBreak[],
  date: '',
  timestamp: 0,
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface AttendanceContextValue {
  dailyAttendance: AttendanceDaily[];
  attendanceBreaks: AttendanceBreak[];
  loading: boolean;
  now: number;
  myDailyRecord: AttendanceDaily | null;
  myBreaks: AttendanceBreak[];
  myActiveBreak: AttendanceBreak | null;
  myWorkingSeconds: number;
  myActiveBreakSeconds: number;
  myStatus: AttendanceStatus | 'NOT_JOINED' | 'DAY_OFF';
  isSunday: boolean;
  joinShift: () => Promise<void>;
  closeShift: () => Promise<void>;
  toggleSnackBreak: () => Promise<void>;
  togglePrayerBreak: () => Promise<void>;
  refreshAttendance: (isSilent?: boolean) => Promise<void>;
}

const defaultAttendanceContextValue: AttendanceContextValue = {
  dailyAttendance: [],
  attendanceBreaks: [],
  loading: false,
  now: Date.now(),
  myDailyRecord: null,
  myBreaks: [],
  myActiveBreak: null,
  myWorkingSeconds: 0,
  myActiveBreakSeconds: 0,
  myStatus: 'NOT_JOINED',
  isSunday: false,
  joinShift: async () => {},
  closeShift: async () => {},
  toggleSnackBreak: async () => {},
  togglePrayerBreak: async () => {},
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

  // 1-second local timer tick (updates UI smoothly with zero per-second DB/realtime writes)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
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
        const [dailyRes, breaksRes] = await Promise.all([
          attendanceService.getDailyAttendance({ date: todayStr, signal }),
          attendanceService.getAttendanceBreaks({ date: todayStr, signal }),
        ]);

        if (signal?.aborted) return;
        if (dailyRes.error) throw dailyRes.error;
        if (breaksRes.error) throw breaksRes.error;

        const nextDaily = dailyRes.data || [];
        const nextBreaks = breaksRes.data || [];

        setDailyAttendance(nextDaily);
        setAttendanceBreaks(nextBreaks);

        _todayAttendanceCache.dailyList = nextDaily;
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
  useRealtimeHandler('attendance_breaks', handleBreaksRealtime);

  // Current logged in user's state
  const myDailyRecord = useMemo(() => {
    if (!profileId) return null;
    return dailyAttendance.find((a) => a.user_id === profileId) || null;
  }, [profileId, dailyAttendance]);

  const myBreaks = useMemo(() => {
    if (!profileId) return [];
    return attendanceBreaks.filter((b) => b.user_id === profileId);
  }, [profileId, attendanceBreaks]);

  const myActiveBreak = useMemo(() => {
    return myBreaks.find((b) => !b.end_time) || null;
  }, [myBreaks]);

  const myWorkingSeconds = useMemo(() => {
    return calculateWorkingSeconds(myDailyRecord, myBreaks, now);
  }, [myDailyRecord, myBreaks, now]);

  const myActiveBreakSeconds = useMemo(() => {
    return myActiveBreak ? calculateBreakSessionSeconds(myActiveBreak, now) : 0;
  }, [myActiveBreak, now]);

  const myStatus: AttendanceStatus | 'NOT_JOINED' = useMemo(() => {
    if (isSunday) return 'DAY_OFF';
    if (!myDailyRecord || !myDailyRecord.join_time) return 'NOT_JOINED';
    return myDailyRecord.status;
  }, [isSunday, myDailyRecord]);

  // Actions
  const joinShift = async () => {
    if (!profileId) return;
    if (isSunday) {
      toast.error('Today is Sunday (Weekly Holiday). Joining is disabled.');
      return;
    }
    const nowIso = new Date().toISOString();
    try {
      const { data, error } = await attendanceService.joinShift(profileId, todayStr, nowIso);
      if (error) throw error;
      if (data) {
        setDailyAttendance((prev) => {
          const exists = prev.some((d) => d.id === data.id);
          const next = exists ? prev.map((d) => (d.id === data.id ? data : d)) : [...prev, data];
          _todayAttendanceCache.dailyList = next;
          return next;
        });
        toast.success('Joined shift successfully! Have a great workday.');
      }
    } catch (err) {
      console.error('Failed to join shift:', err);
      toast.error('Failed to record shift join.');
    }
  };

  const closeShift = async () => {
    if (!profileId || !myDailyRecord) return;
    const closeTimeIso = new Date().toISOString();
    const closeTimeMs = new Date(closeTimeIso).getTime();

    // If an active break session exists, end it first
    let currentTotalBreakSec = 0;
    let currentTotalPrayerSec = 0;

    myBreaks.forEach((b) => {
      if (b.end_time) {
        const s = new Date(b.start_time).getTime();
        const e = new Date(b.end_time).getTime();
        const dur = Math.max(0, Math.floor((e - s) / 1000));
        if (b.type === 'snack') currentTotalBreakSec += dur;
        else currentTotalPrayerSec += dur;
      }
    });

    if (myActiveBreak) {
      const breakStartMs = new Date(myActiveBreak.start_time).getTime();
      const activeDurSec = Math.max(0, Math.floor((closeTimeMs - breakStartMs) / 1000));
      if (myActiveBreak.type === 'snack') currentTotalBreakSec += activeDurSec;
      else currentTotalPrayerSec += activeDurSec;

      const durMin = activeDurSec / 60;
      await attendanceService.endBreak(
        myActiveBreak.id,
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
          const next = prev.map((d) => (d.id === data.id ? data : d));
          _todayAttendanceCache.dailyList = next;
          return next;
        });
        toast.success('Shift closed successfully. See you next time!');
      }
    } catch (err) {
      console.error('Failed to close shift:', err);
      toast.error('Failed to close shift.');
    }
  };

  const toggleSnackBreak = async () => {
    if (!profileId || !myDailyRecord) return;
    const nowIso = new Date().toISOString();

    if (myDailyRecord.status === 'SNACK_BREAK' && myActiveBreak && myActiveBreak.type === 'snack') {
      // End snack break
      const startMs = new Date(myActiveBreak.start_time).getTime();
      const durSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const durMin = durSec / 60;

      let totalBreakSec = 0;
      myBreaks.forEach((b) => {
        if (b.id !== myActiveBreak.id && b.type === 'snack' && b.end_time) {
          totalBreakSec += Math.max(0, Math.floor((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 1000));
        }
      });
      totalBreakSec += durSec;
      const totalBreakMin = totalBreakSec / 60;
      const totalPrayerMin = Number(myDailyRecord.total_prayer_minutes) || 0;

      try {
        const { error } = await attendanceService.endBreak(
          myActiveBreak.id,
          myDailyRecord.id,
          nowIso,
          durMin,
          totalBreakMin,
          totalPrayerMin
        );
        if (error) throw error;
        setDailyAttendance((prev) => {
          const next = prev.map((d) =>
            d.id === myDailyRecord.id
              ? { ...d, status: 'WORKING' as AttendanceStatus, total_break_minutes: totalBreakMin, updated_at: nowIso }
              : d
          );
          _todayAttendanceCache.dailyList = next;
          return next;
        });
        setAttendanceBreaks((prev) => {
          const next = prev.map((b) =>
            b.id === myActiveBreak.id
              ? { ...b, end_time: nowIso, duration_minutes: durMin, updated_at: nowIso }
              : b
          );
          _todayAttendanceCache.breaksList = next;
          return next;
        });
        toast.success('Break ended. Back to work!');
      } catch (err) {
        console.error('Failed to end snack break:', err);
        toast.error('Failed to end break.');
      }
    } else if (myDailyRecord.status === 'WORKING') {
      // Start snack break
      try {
        const { data, error } = await attendanceService.startBreak(
          myDailyRecord.id,
          profileId,
          todayStr,
          'snack',
          nowIso
        );
        if (error) throw error;
        if (data) {
          setAttendanceBreaks((prev) => {
            const next = [...prev, data];
            _todayAttendanceCache.breaksList = next;
            return next;
          });
          setDailyAttendance((prev) => {
            const next = prev.map((d) =>
              d.id === myDailyRecord.id ? { ...d, status: 'SNACK_BREAK' as AttendanceStatus, updated_at: nowIso } : d
            );
            _todayAttendanceCache.dailyList = next;
            return next;
          });
          toast.success('Break started! Enjoy your break.');
        }
      } catch (err) {
        console.error('Failed to start snack break:', err);
        toast.error('Failed to start break.');
      }
    }
  };

  const togglePrayerBreak = async () => {
    if (!profileId || !myDailyRecord) return;
    const nowIso = new Date().toISOString();

    if (myDailyRecord.status === 'PRAYER_BREAK' && myActiveBreak && myActiveBreak.type === 'prayer') {
      // End prayer break
      const startMs = new Date(myActiveBreak.start_time).getTime();
      const durSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const durMin = durSec / 60;

      let totalPrayerSec = 0;
      myBreaks.forEach((b) => {
        if (b.id !== myActiveBreak.id && b.type === 'prayer' && b.end_time) {
          totalPrayerSec += Math.max(0, Math.floor((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 1000));
        }
      });
      totalPrayerSec += durSec;
      const totalPrayerMin = totalPrayerSec / 60;
      const totalBreakMin = Number(myDailyRecord.total_break_minutes) || 0;

      try {
        const { error } = await attendanceService.endBreak(
          myActiveBreak.id,
          myDailyRecord.id,
          nowIso,
          durMin,
          totalBreakMin,
          totalPrayerMin
        );
        if (error) throw error;
        setDailyAttendance((prev) => {
          const next = prev.map((d) =>
            d.id === myDailyRecord.id
              ? { ...d, status: 'WORKING' as AttendanceStatus, total_prayer_minutes: totalPrayerMin, updated_at: nowIso }
              : d
          );
          _todayAttendanceCache.dailyList = next;
          return next;
        });
        setAttendanceBreaks((prev) => {
          const next = prev.map((b) =>
            b.id === myActiveBreak.id
              ? { ...b, end_time: nowIso, duration_minutes: durMin, updated_at: nowIso }
              : b
          );
          _todayAttendanceCache.breaksList = next;
          return next;
        });
        toast.success('Prayer break ended. Back to work!');
      } catch (err) {
        console.error('Failed to end prayer break:', err);
        toast.error('Failed to end prayer break.');
      }
    } else if (myDailyRecord.status === 'WORKING') {
      // Start prayer break
      try {
        const { data, error } = await attendanceService.startBreak(
          myDailyRecord.id,
          profileId,
          todayStr,
          'prayer',
          nowIso
        );
        if (error) throw error;
        if (data) {
          setAttendanceBreaks((prev) => {
            const next = [...prev, data];
            _todayAttendanceCache.breaksList = next;
            return next;
          });
          setDailyAttendance((prev) => {
            const next = prev.map((d) =>
              d.id === myDailyRecord.id ? { ...d, status: 'PRAYER_BREAK' as AttendanceStatus, updated_at: nowIso } : d
            );
            _todayAttendanceCache.dailyList = next;
            return next;
          });
          toast.success('Prayer break started.');
        }
      } catch (err) {
        console.error('Failed to start prayer break:', err);
        toast.error('Failed to start prayer break.');
      }
    }
  };

  const value = useMemo(
    () => ({
      dailyAttendance,
      attendanceBreaks,
      loading,
      now,
      myDailyRecord,
      myBreaks,
      myActiveBreak,
      myWorkingSeconds,
      myActiveBreakSeconds,
      myStatus,
      isSunday,
      joinShift,
      closeShift,
      toggleSnackBreak,
      togglePrayerBreak,
      refreshAttendance,
    }),
    [
      dailyAttendance,
      attendanceBreaks,
      loading,
      now,
      myDailyRecord,
      myBreaks,
      myActiveBreak,
      myWorkingSeconds,
      myActiveBreakSeconds,
      myStatus,
      isSunday,
      refreshAttendance,
    ]
  );

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

// ─── Consumer hook ─────────────────────────────────────────────────────────

export function useAttendance(): AttendanceContextValue {
  return useContext(AttendanceContext);
}
