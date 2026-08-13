import { supabase } from '@/utils/supabase';
import { TODO_COLUMNS } from '@/utils/dbColumns';
import type { TodoItem } from '@/types';

export const todosService = {
  /**
   * Fetch todos with flexible filtering
   */
  async getTodos(options?: {
    userId?: string;
    todoDate?: string;
    ltDate?: string;
    gteDate?: string;
    lteDate?: string;
    status?: string;
    excludeStatus?: string;
    isAllTime?: boolean;
    limit?: number;
    orderBy?: 'activity' | 'date' | 'created';
  }) {
    let query = supabase.from('todos').select(TODO_COLUMNS);

    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }
    if (options?.todoDate) {
      query = query.eq('todo_date', options.todoDate);
    }
    if (options?.ltDate) {
      query = query.lt('todo_date', options.ltDate);
    }
    if (options?.gteDate) {
      query = query.gte('todo_date', options.gteDate);
    }
    if (options?.lteDate) {
      query = query.lte('todo_date', options.lteDate);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.excludeStatus) {
      query = query.neq('status', options.excludeStatus);
    }
    if (options?.isAllTime !== undefined) {
      query = query.eq('is_all_time', options.isAllTime);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.orderBy === 'date') {
      query = query
        .order('todo_date', { ascending: false })
        .order('created_at', { ascending: false });
    } else if (options?.orderBy === 'created') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('last_activity_at', { ascending: false });
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as TodoItem[], error };
  },

  /** Fetch only the latest earlier todo date for carry-over. */
  async getLatestTodoDateBefore(userId: string, beforeDate: string) {
    const { data, error } = await supabase
      .from('todos')
      .select('todo_date')
      .eq('user_id', userId)
      .lt('todo_date', beforeDate)
      .order('todo_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data: data?.todo_date ?? null, error };
  },

  /**
   * Create a new todo item
   */
  async createTodo(todo: Partial<TodoItem>) {
    const { data, error } = await supabase
      .from('todos')
      .insert(todo as any)
      .select(TODO_COLUMNS)
      .single();
    return { data: data as unknown as TodoItem | null, error };
  },

  /**
   * Bulk create todo items
   */
  async bulkCreateTodos(todos: Partial<TodoItem>[]) {
    const { data, error } = await supabase
      .from('todos')
      .insert(todos as any)
      .select(TODO_COLUMNS);
    return { data: (data || []) as unknown as TodoItem[], error };
  },

  /**
   * Update an existing todo item
   */
  async updateTodo(id: string, updates: Partial<TodoItem>) {
    const { data, error } = await supabase
      .from('todos')
      .update({
        ...updates,
        last_activity_at: new Date().toISOString(),
      } as any)
      .eq('id', id)
      .select(TODO_COLUMNS)
      .single();
    return { data: data as unknown as TodoItem | null, error };
  },

  /**
   * Delete a todo item or array of ids
   */
  async deleteTodo(id: string | string[]) {
    if (Array.isArray(id)) {
      const { data, error } = await supabase.from('todos').delete().in('id', id);
      return { data, error };
    } else {
      const { data, error } = await supabase.from('todos').delete().eq('id', id);
      return { data, error };
    }
  },
};
