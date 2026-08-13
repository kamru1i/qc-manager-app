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
    isAllTime?: boolean;
    limit?: number;
  }) {
    let query = supabase
      .from('todos')
      .select(TODO_COLUMNS)
      .order('last_activity_at', { ascending: false });

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
    if (options?.isAllTime !== undefined) {
      query = query.eq('is_all_time', options.isAllTime);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    return { data: (data || []) as unknown as TodoItem[], error };
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
