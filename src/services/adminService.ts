import { supabase } from '@/utils/supabase';

export const adminService = {
  /**
   * RPC: Create new user via admin RPC
   */
  async createNewUser(params: {
    p_username: string;
    p_full_name: string;
    p_role: string;
    p_job_role: string;
    p_password?: string;
    p_working_hours?: string;
    p_break_time?: string;
    p_default_sign_in?: string;
    p_default_sign_out?: string;
    p_supervisor_ids?: string[];
    p_has_chuti_access?: boolean;
    p_has_quotes_access?: boolean;
    p_can_manage_rules?: boolean;
    p_eligible_govt_holiday?: boolean;
    p_eligible_office_leave?: boolean;
    p_allow_overtime?: boolean;
    p_allow_reserve?: boolean;
    p_needs_supervisor_approval?: boolean;
    p_max_full_leaves?: number;
    p_max_short_leaves?: number;
  }) {
    const { data, error } = await supabase.rpc('create_new_user' as any, params);
    return { data, error };
  },

  /**
   * RPC: Update user credentials (username and/or password) with H1 role hierarchy check
   */
  async updateUserCredentials(params: {
    p_user_id: string;
    p_new_username?: string | null;
    p_new_password?: string | null;
  }) {
    const { data, error } = await supabase.rpc(
      'admin_update_user_credentials' as any,
      params
    );
    return { data, error };
  },

  /**
   * RPC: Delete user profile and auth record by ID
   */
  async deleteUserById(userId: string) {
    const { data, error } = await supabase.rpc('delete_user_by_id' as any, {
      p_target_user_id: userId,
    });
    return { data, error };
  },

  /**
   * RPC: Reset all user feature flags
   */
  async resetAllUserFeatureFlags() {
    const { data, error } = await supabase.rpc(
      'reset_all_user_feature_flags' as any
    );
    return { data, error };
  },
};
