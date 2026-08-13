import { supabase } from '@/utils/supabase';
import { RECORD_COLUMNS, LEADERBOARD_ARCHIVE_COLUMNS } from '@/utils/dbColumns';
import type { RecordItem } from '@/types';

export const recordsService = {
  /**
   * Fetch QC records for a user or date range
   */
  async getRecords(options?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    fileType?: string;
  }) {
    let query = supabase
      .from('records')
      .select(RECORD_COLUMNS)
      .order('submitted_at', { ascending: false });

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }
    if (options?.startDate) {
      query = query.gte('submitted_at', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('submitted_at', options.endDate);
    }
    if (options?.fileType) {
      query = query.eq('file_type', options.fileType);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as RecordItem[], error };
  },

  /**
   * Insert a new record
   */
  async createRecord(record: Partial<RecordItem>) {
    const { data, error } = await supabase
      .from('records')
      .insert(record as any)
      .select(RECORD_COLUMNS)
      .single();
    return { data: data as unknown as RecordItem | null, error };
  },

  /**
   * Update an existing record
   */
  async updateRecord(id: string, updates: Partial<RecordItem>) {
    const { data, error } = await supabase
      .from('records')
      .update(updates as any)
      .eq('id', id)
      .select(RECORD_COLUMNS)
      .single();
    return { data: data as unknown as RecordItem | null, error };
  },

  /**
   * Delete a record
   */
  async deleteRecord(id: string) {
    const { data, error } = await supabase.from('records').delete().eq('id', id);
    return { data, error };
  },

  /**
   * RPC: Fetch sargable leaderboard data
   */
  async getLeaderboardData(params: {
    p_year: string;
    p_month: string;
    p_period: string;
    p_today: string;
    p_tz?: string;
  }) {
    const { data, error } = await supabase.rpc('get_leaderboard_data' as any, {
      p_year: params.p_year,
      p_month: params.p_month,
      p_period: params.p_period,
      p_today: params.p_today,
      p_tz: params.p_tz || 'UTC',
    });
    return { data: (data || []) as unknown as any[], error };
  },

  /**
   * RPC: Fetch admin sales summary
   */
  async getAdminSalesSummary(todayStr: string, timeZone = 'UTC') {
    const { data, error } = await supabase.rpc('get_admin_sales_summary' as any, {
      p_today: todayStr,
      p_tz: timeZone,
    });
    return { data: (data && data[0]) ? data[0] : null, error };
  },

  /**
   * Fetch leaderboard archive entries
   */
  async getLeaderboardArchive(year?: number) {
    let query = supabase
      .from('leaderboard_archive')
      .select(LEADERBOARD_ARCHIVE_COLUMNS)
      .order('rank', { ascending: true });

    if (year) {
      query = query.eq('year', year);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  },
};
