import { supabase } from '@/utils/supabase';
import { CHUTI_COLUMNS, LEAVE_SETTLEMENT_COLUMNS, LEAVE_DELETE_REQUEST_COLUMNS } from '@/utils/dbColumns';
import type { ChutiRecord, LeaveSettlement, LeaveDeleteRequest } from '@/types';

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

  /**
   * Fetch leave delete/removal requests
   */
  async getLeaveDeleteRequests(options?: { status?: string; requesterId?: string }) {
    let query = supabase
      .from('leave_delete_requests')
      .select(`${LEAVE_DELETE_REQUEST_COLUMNS}, profiles:requester_id (username, full_name, role), chuti:leave_id (${CHUTI_COLUMNS})`)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.requesterId) {
      query = query.eq('requester_id', options.requesterId);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as LeaveDeleteRequest[], error };
  },

  /**
   * Submit a leave removal request for an approved leave
   */
  async requestLeaveRemoval(leaveId: string, requesterId: string, reason?: string) {
    // 1. Insert into leave_delete_requests table
    const { data: requestData, error: requestError } = await supabase
      .from('leave_delete_requests')
      .insert({
        leave_id: leaveId,
        requester_id: requesterId,
        reason: reason || null,
        status: 'pending',
      } as any)
      .select(LEAVE_DELETE_REQUEST_COLUMNS)
      .single();

    if (requestError && requestError.code !== '23505') {
      return { data: null, error: requestError };
    }

    // 2. Also update chuti admin_edit_request for realtime reactivity
    const { data: chutiData } = await supabase
      .from('chuti')
      .select('admin_edit_request')
      .eq('id', leaveId)
      .maybeSingle();

    const existingMeta = (chutiData?.admin_edit_request as Record<string, unknown>) || {};
    const updatedMeta = {
      ...existingMeta,
      delete_requested: true,
      delete_reason: reason || null,
      delete_requested_at: new Date().toISOString(),
      delete_requester_id: requesterId,
    };

    const { error: updateError } = await supabase
      .from('chuti')
      .update({ admin_edit_request: updatedMeta } as any)
      .eq('id', leaveId);

    return { data: requestData as unknown as LeaveDeleteRequest | null, error: updateError || null };
  },

  /**
   * Admin approves or rejects a leave removal request
   */
  async reviewLeaveRemoval(
    requestId: string,
    leaveId: string,
    approve: boolean,
    reviewerId: string
  ) {
    const now = new Date().toISOString();

    // 1. Update request status in leave_delete_requests
    const { error: reqError } = await supabase
      .from('leave_delete_requests')
      .update({
        status: approve ? 'approved' : 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: now,
      } as any)
      .eq('id', requestId);

    if (reqError) return { error: reqError };

    if (approve) {
      // 2. Soft-delete the chuti record
      const { error: chutiError } = await supabase
        .from('chuti')
        .update({ deleted_at: now } as any)
        .eq('id', leaveId);
      return { error: chutiError };
    } else {
      // 3. Clear delete_requested from admin_edit_request on chuti
      const { data: chutiData } = await supabase
        .from('chuti')
        .select('admin_edit_request')
        .eq('id', leaveId)
        .maybeSingle();

      const existingMeta = (chutiData?.admin_edit_request as Record<string, unknown>) || {};
      const updatedMeta = {
        ...existingMeta,
        delete_requested: false,
        delete_rejected_at: now,
        delete_reviewed_by: reviewerId,
      };

      const { error: updateError } = await supabase
        .from('chuti')
        .update({ admin_edit_request: updatedMeta } as any)
        .eq('id', leaveId);

      return { error: updateError };
    }
  },
};

