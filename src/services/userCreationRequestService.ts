import { supabase } from '@/utils/supabase';
import { UserCreationRequest, UserCreationSubmittedData } from '@/types';

export const userCreationRequestService = {
  /**
   * Fetch user creation requests.
   * Admins fetch all active/historical requests.
   * Supervisors fetch their own requests.
   */
  async fetchRequests(params?: {
    status?: 'pending_admin_approval' | 'needs_review' | 'approved' | 'rejected' | 'all' | string[];
    requesterId?: string;
  }): Promise<{ data: UserCreationRequest[] | null; error: any }> {
    try {
      let query = supabase
        .from('user_creation_requests')
        .select(`
          id,
          requester_id,
          requester_role,
          status,
          submitted_data,
          review_notes,
          reviewed_by,
          reviewed_at,
          created_user_id,
          version,
          history,
          created_at,
          updated_at,
          requester:requester_id (
            id,
            username,
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (params?.requesterId) {
        query = query.eq('requester_id', params.requesterId);
      }

      if (params?.status && params.status !== 'all') {
        if (Array.isArray(params.status)) {
          query = query.in('status', params.status);
        } else {
          query = query.eq('status', params.status);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error('Failed to fetch user creation requests:', error);
        return { data: null, error };
      }

      const mapped = (data || []).map((row: any) => ({
        ...row,
        data: row.submitted_data,
        submitted_by_id: row.requester_id,
        submitted_by_name: row.requester?.full_name || row.requester?.username || 'Supervisor',
        admin_review_notes: row.review_notes,
      })) as UserCreationRequest[];

      return { data: mapped, error: null };
    } catch (err) {
      console.error('Error fetching user creation requests:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Supervisor submits a new user account creation request.
   */
  async submitRequest(data: UserCreationSubmittedData): Promise<{ data: string | null; error: any }> {
    try {
      const { data: requestId, error } = await supabase.rpc('submit_user_creation_request' as any, {
        p_data: data,
      });

      if (error) {
        console.error('Failed to submit user creation request:', error);
        return { data: null, error };
      }

      return { data: requestId as string, error: null };
    } catch (err) {
      console.error('Error in submitRequest:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Admin reviews a request and sends it back to the supervisor with notes.
   */
  async reviewRequest(
    requestId: string,
    notes: string,
    expectedVersion?: number
  ): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase.rpc('review_user_creation_request' as any, {
        p_request_id: requestId,
        p_notes: notes.trim(),
        p_expected_version: expectedVersion ?? null,
      });

      if (error) {
        console.error('Failed to review user creation request:', error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err) {
      console.error('Error in reviewRequest:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Supervisor resubmits a corrected user creation request.
   */
  async resubmitRequest(
    requestId: string,
    data: UserCreationSubmittedData,
    expectedVersion: number
  ): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase.rpc('resubmit_user_creation_request' as any, {
        p_request_id: requestId,
        p_data: data,
        p_expected_version: expectedVersion,
      });

      if (error) {
        console.error('Failed to resubmit user creation request:', error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err) {
      console.error('Error in resubmitRequest:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Admin approves a user creation request, provisioning the actual user account.
   */
  async approveRequest(
    requestId: string,
    expectedVersion?: number
  ): Promise<{ success: boolean; data: string | null; error: any }> {
    try {
      const { data: createdUserId, error } = await supabase.rpc('approve_user_creation_request' as any, {
        p_request_id: requestId,
        p_expected_version: expectedVersion ?? null,
      });

      if (error) {
        console.error('Failed to approve user creation request:', error);
        return { success: false, data: null, error };
      }

      return { success: true, data: createdUserId as string, error: null };
    } catch (err) {
      console.error('Error in approveRequest:', err);
      return { success: false, data: null, error: err };
    }
  },

  /**
   * Admin dismisses / deletes a user creation request.
   */
  async deleteRequest(requestId: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase
        .from('user_creation_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.error('Failed to delete user creation request:', error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err) {
      console.error('Error in deleteRequest:', err);
      return { success: false, error: err };
    }
  },
};
