import { supabase } from '@/utils/supabase';
import { QUOTATION_MISTAKE_COLUMNS } from '@/utils/dbColumns';
import type { QuotationMistake } from '@/types';

export const mistakesService = {
  /**
   * Fetch quotation mistakes ordered by date descending
   */
  async getQuotationMistakes(options?: {
    userId?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    branch?: string;
    year?: string;
    month?: string;
    date?: string;
    signal?: AbortSignal;
  }) {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 15));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('quotation_mistakes')
      .select(QUOTATION_MISTAKE_COLUMNS, { count: 'exact' })
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    const search = options?.search?.trim();
    if (search) {
      const escaped = search.replace(/[,%()]/g, '');
      query = query.or(`filename.ilike.%${escaped}%,codename.ilike.%${escaped}%`);
    }
    if (options?.branch) query = query.eq('branch', options.branch);
    if (options?.date) {
      query = query.eq('date', options.date);
    } else if (options?.year) {
      const month = options.month || '01';
      const start = `${options.year}-${month}-01`;
      const endDate = options.month
        ? new Date(Date.UTC(Number(options.year), Number(options.month), 1))
        : new Date(Date.UTC(Number(options.year) + 1, 0, 1));
      query = query
        .gte('date', start)
        .lt('date', endDate.toISOString().slice(0, 10));
    }
    if (options?.signal) query = query.abortSignal(options.signal);

    const { data, error, count } = await query;
    return { data: (data || []) as unknown as QuotationMistake[], count: count ?? 0, error };
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
