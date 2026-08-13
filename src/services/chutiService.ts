import { supabase } from '@/utils/supabase';
import { CHUTI_COLUMNS, LEAVE_SETTLEMENT_COLUMNS } from '@/utils/dbColumns';
import type { ChutiRecord, LeaveSettlement } from '@/types';

export const chutiService = {
  /**
   * Fetch chuti records for a user with optional 90-day cutoff and delta sync
   */
  async getChutiRecords(options: {
    userId?: string;
    cutoffDate?: string;
    lastSyncTimestamp?: string | null;
  }) {
    let query = supabase
      .from('chuti')
      .select(`${CHUTI_COLUMNS}, profiles (username, full_name, role, supervisor_ids)`);

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    if (options.cutoffDate) {
      query = query.gte('date', options.cutoffDate);
    }

    if (options.lastSyncTimestamp) {
      query = query.gte('updated_at', options.lastSyncTimestamp);
    }

    query = query.is('deleted_at', null).order('date', { ascending: false });

    const { data, error } = await query;
    return { data: (data || []) as unknown as ChutiRecord[], error };
  },

  /**
   * Fetch paginated admin chuti records
   */
  async getChutiRecordsPaginated(from: number, to: number, cutoffDate: string) {
    const { data, error } = await supabase
      .from('chuti')
      .select(`${CHUTI_COLUMNS}, profiles (username, full_name, role, supervisor_ids)`)
      .is('deleted_at', null)
      .gte('date', cutoffDate)
      .order('date', { ascending: false })
      .range(from, to);

    return { data: (data || []) as unknown as ChutiRecord[], error };
  },

  /**
   * Create a single chuti record
   */
  async createChutiRecord(record: Partial<ChutiRecord>) {
    const { data, error } = await supabase
      .from('chuti')
      .insert(record as any)
      .select(CHUTI_COLUMNS)
      .single();
    return { data: data as unknown as ChutiRecord | null, error };
  },

  /**
   * Update a chuti record
   */
  async updateChutiRecord(id: string, updates: Partial<ChutiRecord>) {
    const { data, error } = await supabase
      .from('chuti')
      .update(updates as any)
      .eq('id', id)
      .select(CHUTI_COLUMNS)
      .single();
    return { data: data as unknown as ChutiRecord | null, error };
  },

  /**
   * Soft delete or hard delete a chuti record
   */
  async deleteChutiRecord(id: string, softDelete = true) {
    if (softDelete) {
      const { data, error } = await supabase
        .from('chuti')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', id);
      return { data, error };
    } else {
      const { data, error } = await supabase.from('chuti').delete().eq('id', id);
      return { data, error };
    }
  },

  /** Atomically convert verified short-leave hours into full-leave rows. */
  async convertShortLeaveToFullLeave(
    userId: string,
    adjustmentCategory: 'Office Leave' | 'Govt Holiday',
  ) {
    const { data, error } = await supabase.rpc('convert_short_leave_to_full_leave' as any, {
      p_user_id: userId,
      p_adjust_category: adjustmentCategory,
    });
    return {
      data: data as { days_converted?: number; hours_converted?: number } | null,
      error,
    };
  },

  /**
   * Fetch leave settlements
   */
  async getLeaveSettlements(userId?: string) {
    let query = supabase
      .from('leave_settlements')
      .select(LEAVE_SETTLEMENT_COLUMNS)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as LeaveSettlement[], error };
  },

  /**
   * Create leave settlement
   */
  async createLeaveSettlement(settlement: Partial<LeaveSettlement>) {
    const { data, error } = await supabase
      .from('leave_settlements')
      .insert(settlement as any)
      .select(LEAVE_SETTLEMENT_COLUMNS)
      .single();
    return { data: data as unknown as LeaveSettlement | null, error };
  },
};
