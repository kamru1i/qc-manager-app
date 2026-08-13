import { supabase } from '@/utils/supabase';

export const adminService = {
  /**
   * RPC: Create new user via admin RPC
   */
  async createConfiguredUser(params: {
    p_email: string;
    p_password: string;
    p_username: string;
    p_full_name: string;
    p_role: string;
    p_profile_options: Record<string, unknown>;
  }) {
    const { data, error } = await supabase.rpc('create_configured_user' as any, params);
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
      p_user_id: userId,
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
