import { supabase } from '@/utils/supabase';
import { LOGIN_CODE_COLUMNS } from '@/utils/dbColumns';
import type { LoginCode } from '@/types';

export const loginCodesService = {
  /**
   * Fetch all login codes
   */
  async getLoginCodes() {
    const { data, error } = await supabase
      .from('login_codes')
      .select(LOGIN_CODE_COLUMNS)
      .order('name', { ascending: true });
    return { data: (data || []) as unknown as LoginCode[], error };
  },

  /**
   * Upsert a login code
   */
  async upsertLoginCode(codeData: Partial<LoginCode>) {
    const { data, error } = await supabase
      .from('login_codes')
      .upsert(codeData as any)
      .select(LOGIN_CODE_COLUMNS)
      .single();
    return { data: data as unknown as LoginCode | null, error };
  },

  /**
   * Delete a login code
   */
  async deleteLoginCode(loginId: string) {
    const { data, error } = await supabase
      .from('login_codes')
      .delete()
      .eq('login_id', loginId);
    return { data, error };
  },
};
