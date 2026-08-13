import { supabase } from '@/utils/supabase';
import { PROFILE_COLUMNS } from '@/utils/dbColumns';
import { fetchOwnProfileRow } from '@/utils/profileFetcher';
import type { Profile } from '@/types';

export const profilesService = {
  /**
   * Fetch own profile with in-flight Promise deduplication
   */
  async getOwnProfile(userId: string) {
    return fetchOwnProfileRow(userId);
  },

  /**
   * Fetch a single profile by ID
   */
  async getProfileById(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single();
    return { data: data as unknown as Profile | null, error };
  },

  /**
   * Fetch all profiles ordered by username
   */
  async getAllProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('username', { ascending: true });
    return { data: (data || []) as unknown as Profile[], error };
  },

  /**
   * Update profile columns directly
   */
  async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates as any)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();
    return { data: data as unknown as Profile | null, error };
  },

  /**
   * RPC: Set sanitizer rules for a target user
   */
  async setSanitizerRules(targetUserId: string, words: string[]) {
    const { data, error } = await supabase.rpc('set_sanitizer_rules' as any, {
      p_target_user_id: targetUserId,
      p_words: words,
    });
    return { data, error };
  },

  /**
   * RPC: Set role visibility for a target user
   */
  async setRoleVisibility(targetUserId: string, visibility: Record<string, boolean>) {
    const { data, error } = await supabase.rpc('set_role_visibility' as any, {
      p_target_user_id: targetUserId,
      p_visibility: visibility,
    });
    return { data, error };
  },

  /**
   * RPC: Set feature flags for a target user
   */
  async setFeatureFlags(targetUserId: string, flags: Record<string, boolean>) {
    const { data, error } = await supabase.rpc('set_feature_flags' as any, {
      p_target_user_id: targetUserId,
      p_flags: flags,
    });
    return { data, error };
  },

  /**
   * RPC: Set admin delegated flags for a target user
   */
  async setAdminDelegatedFlags(targetUserId: string, flags: Record<string, boolean>) {
    const { data, error } = await supabase.rpc('set_admin_delegated_flags' as any, {
      p_target_user_id: targetUserId,
      p_flags: flags,
    });
    return { data, error };
  },

  /**
   * RPC: Set temporary access for a target user
   */
  async setTempAccess(targetUserId: string, accessConfig: Record<string, any>) {
    const { data, error } = await supabase.rpc('set_temp_access' as any, {
      p_target_user_id: targetUserId,
      p_access: accessConfig,
    });
    return { data, error };
  },

  /**
   * RPC: Sync top performer badges
   */
  async syncTopPerformerBadges() {
    const { data, error } = await supabase.rpc('sync_top_performer_badges' as any);
    return { data, error };
  },

  /**
   * RPC: Atomic key update for global_settings JSONB
   */
  async updateGlobalSettingsKey(userId: string, key: string, value: any) {
    const { data, error } = await supabase.rpc('update_global_settings_key' as any, {
      p_user_id: userId,
      p_key: key,
      p_value: typeof value === 'string' ? value : JSON.stringify(value),
    });
    return { data, error };
  },
};
