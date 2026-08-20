import { supabase } from '@/utils/supabase';
import {
  ATTENDANCE_DAILY_COLUMNS,
  ATTENDANCE_SHIFT_COLUMNS,
  ATTENDANCE_BREAK_COLUMNS,
} from '@/utils/dbColumns';
import type { AttendanceDaily, AttendanceShift, AttendanceBreak } from '@/types';

export const attendanceService = {
  /**
   * Fetch daily attendance records with flexible filtering
   */
  async getDailyAttendance(options?: {
    date?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    signal?: AbortSignal;
  }) {
    if (!options?.date && !(options?.startDate && options?.endDate) && !options?.userId) {
      return { data: [] as AttendanceDaily[], error: new Error('Attendance queries require a date, user, or bounded date range.') };
    }

    let query = supabase.from('attendance_daily').select(ATTENDANCE_DAILY_COLUMNS);

    if (options?.date) {
      query = query.eq('attendance_date', options.date);
    }
    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }
    if (options?.startDate) {
      query = query.gte('attendance_date', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('attendance_date', options.endDate);
    }

    query = query.order('attendance_date', { ascending: false }).limit(2000);
    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as AttendanceDaily[], error };
  },

  /**
   * Fetch attendance shifts (multi-shift sessions per day)
   */
  async getAttendanceShifts(options?: {
    date?: string;
    userId?: string;
    attendanceId?: string;
    startDate?: string;
    endDate?: string;
    signal?: AbortSignal;
  }) {
    if (!options?.attendanceId && !options?.date && !(options?.startDate && options?.endDate) && !options?.userId) {
      return { data: [] as AttendanceShift[], error: new Error('Attendance shift queries require an attendance id, date, user, or bounded date range.') };
    }

    let query = supabase.from('attendance_shifts').select(ATTENDANCE_SHIFT_COLUMNS);

    if (options?.attendanceId) {
      query = query.eq('attendance_id', options.attendanceId);
    }
    if (options?.date) {
      query = query.eq('attendance_date', options.date);
    }
    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }
    if (options?.startDate) {
      query = query.gte('attendance_date', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('attendance_date', options.endDate);
    }

    query = query.order('join_time', { ascending: true }).limit(5000);
    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as AttendanceShift[], error };
  },

  /**
   * Fetch attendance break sessions
   */
  async getAttendanceBreaks(options?: {
    date?: string;
    userId?: string;
    attendanceId?: string;
    shiftId?: string;
    startDate?: string;
    endDate?: string;
    signal?: AbortSignal;
  }) {
    if (!options?.attendanceId && !options?.date && !(options?.startDate && options?.endDate) && !options?.userId) {
      return { data: [] as AttendanceBreak[], error: new Error('Attendance break queries require an attendance id, date, user, or bounded date range.') };
    }

    let query = supabase.from('attendance_breaks').select(ATTENDANCE_BREAK_COLUMNS);

    if (options?.attendanceId) {
      query = query.eq('attendance_id', options.attendanceId);
    }
    if (options?.shiftId) {
      query = query.eq('shift_id', options.shiftId);
    }
    if (options?.date) {
      query = query.eq('attendance_date', options.date);
    }
    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }
    if (options?.startDate) {
      query = query.gte('attendance_date', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('attendance_date', options.endDate);
    }

    query = query.order('start_time', { ascending: true }).limit(5000);
    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as AttendanceBreak[], error };
  },

  /**
   * Join Shift (Create/Resume today's attendance record and start a new shift session)
   */
  async joinShift(userId: string, attendanceDate: string, joinTime: string) {
    // 1. Check if daily record already exists for today
    const { data: existingDaily } = await supabase
      .from('attendance_daily')
      .select(ATTENDANCE_DAILY_COLUMNS)
      .eq('user_id', userId)
      .eq('attendance_date', attendanceDate)
      .maybeSingle();

    let dailyRecord: AttendanceDaily;

    if (existingDaily) {
      const { data: updatedDaily, error: updateErr } = await supabase
        .from('attendance_daily')
        .update({
          status: 'WORKING',
          close_time: null, // Clear close_time because an active shift is now in progress
          join_time: existingDaily.join_time || joinTime,
        })
        .eq('id', existingDaily.id)
        .select(ATTENDANCE_DAILY_COLUMNS)
        .single();

      if (updateErr) return { daily: null, shift: null, error: updateErr };
      dailyRecord = updatedDaily as unknown as AttendanceDaily;
    } else {
      const { data: insertedDaily, error: insertErr } = await supabase
        .from('attendance_daily')
        .insert({
          user_id: userId,
          attendance_date: attendanceDate,
          join_time: joinTime,
          close_time: null,
          status: 'WORKING',
          total_work_minutes: 0,
          total_break_minutes: 0,
          total_prayer_minutes: 0,
        })
        .select(ATTENDANCE_DAILY_COLUMNS)
        .single();

      if (insertErr) return { daily: null, shift: null, error: insertErr };
      dailyRecord = insertedDaily as unknown as AttendanceDaily;
    }

    // 2. Insert new session in attendance_shifts
    const { data: shiftRecord, error: shiftErr } = await supabase
      .from('attendance_shifts')
      .insert({
        attendance_id: dailyRecord.id,
        user_id: userId,
        attendance_date: attendanceDate,
        join_time: joinTime,
        close_time: null,
        duration_seconds: 0,
      })
      .select(ATTENDANCE_SHIFT_COLUMNS)
      .single();

    if (shiftErr) {
      console.error('Failed to create shift session record:', shiftErr);
      return { daily: dailyRecord, shift: null, error: shiftErr };
    }

    return {
      daily: dailyRecord,
      shift: shiftRecord as unknown as AttendanceShift,
      error: null,
    };
  },

  /**
   * Close Shift (Closes active shift and updates daily attendance totals)
   */
  async closeShift(params: {
    dailyId: string;
    shiftId?: string | null;
    closeTime: string;
    shiftDurationSeconds: number;
    totalWorkMinutes: number;
    totalBreakMinutes: number;
    totalPrayerMinutes: number;
  }) {
    // 1. Close the shift session if shiftId is provided
    let closedShift: AttendanceShift | null = null;
    if (params.shiftId) {
      const { data: sData, error: sErr } = await supabase
        .from('attendance_shifts')
        .update({
          close_time: params.closeTime,
          duration_seconds: params.shiftDurationSeconds,
        })
        .eq('id', params.shiftId)
        .select(ATTENDANCE_SHIFT_COLUMNS)
        .single();

      if (sErr) console.warn('Could not update shift record on close:', sErr);
      if (sData) closedShift = sData as unknown as AttendanceShift;
    }

    // 2. Update daily attendance record
    const { data: dData, error: dErr } = await supabase
      .from('attendance_daily')
      .update({
        close_time: params.closeTime,
        status: 'CLOSED',
        total_work_minutes: params.totalWorkMinutes,
        total_break_minutes: params.totalBreakMinutes,
        total_prayer_minutes: params.totalPrayerMinutes,
      })
      .eq('id', params.dailyId)
      .select(ATTENDANCE_DAILY_COLUMNS)
      .single();

    return {
      daily: (dData || null) as unknown as AttendanceDaily | null,
      shift: closedShift,
      error: dErr,
    };
  },

  /**
   * Start Break (Snack or Prayer)
   */
  async startBreak(params: {
    attendanceId: string;
    shiftId?: string | null;
    userId: string;
    attendanceDate: string;
    type: 'snack' | 'prayer';
    startTime: string;
  }) {
    // 1. Insert break session
    const { data: breakData, error: breakErr } = await supabase
      .from('attendance_breaks')
      .insert({
        attendance_id: params.attendanceId,
        shift_id: params.shiftId ?? null,
        user_id: params.userId,
        attendance_date: params.attendanceDate,
        type: params.type,
        start_time: params.startTime,
        duration_minutes: 0,
      })
      .select(ATTENDANCE_BREAK_COLUMNS)
      .single();

    if (breakErr) return { data: null, error: breakErr };

    // 2. Update status in attendance_daily
    const nextStatus = params.type === 'snack' ? 'SNACK_BREAK' : 'PRAYER_BREAK';
    const { error: dailyErr } = await supabase
      .from('attendance_daily')
      .update({ status: nextStatus })
      .eq('id', params.attendanceId);

    if (dailyErr) console.error('Failed to update status on break start:', dailyErr);

    return { data: breakData as unknown as AttendanceBreak | null, error: null };
  },

  /**
   * End Break (Snack or Prayer)
   */
  async endBreak(params: {
    breakId: string;
    attendanceId: string;
    endTime: string;
    durationMinutes: number;
    totalBreakMinutes: number;
    totalPrayerMinutes: number;
  }) {
    // 1. Close break session
    const { data: breakData, error: breakErr } = await supabase
      .from('attendance_breaks')
      .update({
        end_time: params.endTime,
        duration_minutes: params.durationMinutes,
      })
      .eq('id', params.breakId)
      .select(ATTENDANCE_BREAK_COLUMNS)
      .single();

    if (breakErr) return { data: null, error: breakErr };

    // 2. Update status & totals in attendance_daily
    const { error: dailyErr } = await supabase
      .from('attendance_daily')
      .update({
        status: 'WORKING',
        total_break_minutes: params.totalBreakMinutes,
        total_prayer_minutes: params.totalPrayerMinutes,
      })
      .eq('id', params.attendanceId);

    if (dailyErr) console.error('Failed to update status on break end:', dailyErr);

    return { data: breakData as unknown as AttendanceBreak | null, error: null };
  },

  /**
   * Update Daily Attendance directly
   */
  async updateDailyAttendance(id: string, updates: Partial<AttendanceDaily>) {
    const { data, error } = await supabase
      .from('attendance_daily')
      .update(updates)
      .eq('id', id)
      .select(ATTENDANCE_DAILY_COLUMNS)
      .single();

    return { data: data as unknown as AttendanceDaily | null, error };
  },
};
