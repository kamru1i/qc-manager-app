import { supabase } from '@/utils/supabase';
import { ATTENDANCE_DAILY_COLUMNS, ATTENDANCE_BREAK_COLUMNS } from '@/utils/dbColumns';
import type { AttendanceDaily, AttendanceBreak } from '@/types';

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
   * Fetch attendance break sessions
   */
  async getAttendanceBreaks(options?: {
    date?: string;
    userId?: string;
    attendanceId?: string;
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
   * Join Shift (Create today's attendance record)
   */
  async joinShift(userId: string, attendanceDate: string, joinTime: string) {
    const { data, error } = await supabase
      .from('attendance_daily')
      .upsert(
        {
          user_id: userId,
          attendance_date: attendanceDate,
          join_time: joinTime,
          status: 'WORKING',
          total_work_minutes: 0,
          total_break_minutes: 0,
          total_prayer_minutes: 0,
        },
        { onConflict: 'user_id,attendance_date' }
      )
      .select(ATTENDANCE_DAILY_COLUMNS)
      .single();

    return { data: data as unknown as AttendanceDaily | null, error };
  },

  /**
   * Close Shift
   */
  async closeShift(
    dailyId: string,
    closeTime: string,
    totalWorkMinutes: number
  ) {
    const { data, error } = await supabase
      .from('attendance_daily')
      .update({
        close_time: closeTime,
        status: 'CLOSED',
        total_work_minutes: totalWorkMinutes,
      })
      .eq('id', dailyId)
      .select(ATTENDANCE_DAILY_COLUMNS)
      .single();

    return { data: data as unknown as AttendanceDaily | null, error };
  },

  /**
   * Start Break (Snack or Prayer)
   */
  async startBreak(
    attendanceId: string,
    userId: string,
    attendanceDate: string,
    type: 'snack' | 'prayer',
    startTime: string
  ) {
    // 1. Insert break session
    const { data: breakData, error: breakErr } = await supabase
      .from('attendance_breaks')
      .insert({
        attendance_id: attendanceId,
        user_id: userId,
        attendance_date: attendanceDate,
        type,
        start_time: startTime,
        duration_minutes: 0,
      })
      .select(ATTENDANCE_BREAK_COLUMNS)
      .single();

    if (breakErr) return { data: null, error: breakErr };

    // 2. Update status in attendance_daily
    const nextStatus = type === 'snack' ? 'SNACK_BREAK' : 'PRAYER_BREAK';
    const { error: dailyErr } = await supabase
      .from('attendance_daily')
      .update({ status: nextStatus })
      .eq('id', attendanceId);

    if (dailyErr) console.error('Failed to update status on break start:', dailyErr);

    return { data: breakData as unknown as AttendanceBreak | null, error: null };
  },

  /**
   * End Break (Snack or Prayer)
   */
  async endBreak(
    breakId: string,
    attendanceId: string,
    endTime: string,
    durationMinutes: number,
    totalBreakMinutes: number,
    totalPrayerMinutes: number
  ) {
    // 1. Close break session
    const { data: breakData, error: breakErr } = await supabase
      .from('attendance_breaks')
      .update({
        end_time: endTime,
        duration_minutes: durationMinutes,
      })
      .eq('id', breakId)
      .select(ATTENDANCE_BREAK_COLUMNS)
      .single();

    if (breakErr) return { data: null, error: breakErr };

    // 2. Update status & totals in attendance_daily
    const { error: dailyErr } = await supabase
      .from('attendance_daily')
      .update({
        status: 'WORKING',
        total_break_minutes: totalBreakMinutes,
        total_prayer_minutes: totalPrayerMinutes,
      })
      .eq('id', attendanceId);

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
