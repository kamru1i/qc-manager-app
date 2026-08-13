import { supabase } from '@/utils/supabase';
import { GOVT_HOLIDAY_RESPONSE_COLUMNS, COMPLIANCE_RULE_COLUMNS } from '@/utils/dbColumns';
import type { GovtHolidayResponse, ComplianceRule } from '@/types';

export const holidaysService = {
  /**
   * Fetch govt holiday responses (bounded with limit 1000 for egress protection)
   */
  async getGovtHolidayResponses(options?: { userId?: string; limit?: number }) {
    let query = supabase
      .from('govt_holiday_responses')
      .select(`${GOVT_HOLIDAY_RESPONSE_COLUMNS}, profiles (full_name, username)`)
      .order('created_at', { ascending: false });

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    query = query.limit(options?.limit || 1000);

    const { data, error } = await query;
    return { data: (data || []) as unknown as GovtHolidayResponse[], error };
  },

  /**
   * Upsert a govt holiday response
   */
  async upsertGovtHolidayResponse(response: Partial<GovtHolidayResponse>) {
    const { data, error } = await supabase
      .from('govt_holiday_responses')
      .upsert(response as any, { onConflict: 'user_id,holiday_date' })
      .select(GOVT_HOLIDAY_RESPONSE_COLUMNS)
      .single();
    return { data: data as unknown as GovtHolidayResponse | null, error };
  },

  /**
   * Fetch compliance rules
   */
  async getComplianceRules(includeDeleted = false) {
    let query = supabase
      .from('compliance_rules')
      .select(COMPLIANCE_RULE_COLUMNS)
      .order('created_at', { ascending: false });

    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as ComplianceRule[], error };
  },

  /**
   * Insert a compliance rule
   */
  async createComplianceRule(rule: Partial<ComplianceRule>) {
    const { data, error } = await supabase
      .from('compliance_rules')
      .insert(rule as any)
      .select(COMPLIANCE_RULE_COLUMNS)
      .single();
    return { data: data as unknown as ComplianceRule | null, error };
  },

  /**
   * Update a compliance rule
   */
  async updateComplianceRule(id: string, updates: Partial<ComplianceRule>) {
    const { data, error } = await supabase
      .from('compliance_rules')
      .update(updates as any)
      .eq('id', id)
      .select(COMPLIANCE_RULE_COLUMNS)
      .single();
    return { data: data as unknown as ComplianceRule | null, error };
  },

  /**
   * Soft delete a compliance rule
   */
  async deleteComplianceRule(id: string) {
    const { data, error } = await supabase
      .from('compliance_rules')
      .update({ is_deleted: true } as any)
      .eq('id', id);
    return { data, error };
  },
};
