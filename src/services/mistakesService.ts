import { supabase } from '@/utils/supabase';
import { QUOTATION_MISTAKE_COLUMNS } from '@/utils/dbColumns';
import type { QuotationMistake } from '@/types';

export const mistakesService = {
  /**
   * Fetch quotation mistakes ordered by date descending
   */
  async getQuotationMistakes(options?: { userId?: string; limit?: number }) {
    let query = supabase
      .from('quotation_mistakes')
      .select(QUOTATION_MISTAKE_COLUMNS)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(1000);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as QuotationMistake[], error };
  },

  /**
   * Insert a new quotation mistake record
   */
  async createQuotationMistake(mistake: Partial<QuotationMistake>) {
    const { data, error } = await supabase
      .from('quotation_mistakes')
      .insert(mistake as any)
      .select(QUOTATION_MISTAKE_COLUMNS)
      .single();
    return { data: data as unknown as QuotationMistake | null, error };
  },

  /**
   * Update a quotation mistake record
   */
  async updateQuotationMistake(id: string, updates: Partial<QuotationMistake>) {
    const { data, error } = await supabase
      .from('quotation_mistakes')
      .update(updates as any)
      .eq('id', id)
      .select(QUOTATION_MISTAKE_COLUMNS)
      .single();
    return { data: data as unknown as QuotationMistake | null, error };
  },

  /**
   * Delete a quotation mistake record
   */
  async deleteQuotationMistake(id: string) {
    const { data, error } = await supabase
      .from('quotation_mistakes')
      .delete()
      .eq('id', id);
    return { data, error };
  },

  /**
   * Bulk delete quotation mistake records
   */
  async bulkDeleteQuotationMistakes(ids: string[]) {
    const { data, error } = await supabase
      .from('quotation_mistakes')
      .delete()
      .in('id', ids);
    return { data, error };
  },
};
