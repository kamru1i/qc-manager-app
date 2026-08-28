import { supabase } from '@/utils/supabase';
import { TODO_ACCESS_COLUMNS } from '@/utils/dbColumns';
import type { TodoAccessRecord } from '@/types';

export const todoAccessService = {
  /**
   * Fetch all users who have been granted Todo view access.
   */
  async getTodoAccessList() {
    const { data, error } = await supabase
      .from('todo_access')
      .select(`${TODO_ACCESS_COLUMNS}, profiles:user_id(id, username, full_name, codename, role)`)
      .order('created_at', { ascending: false });

    return {
      data: (data || []) as unknown as TodoAccessRecord[],
      error,
    };
  },

  /**
   * Check if a specific user has active Todo view access.
   */
  async getUserTodoAccess(userId: string) {
    if (!userId) return { hasAccess: false, error: null };

    const { data, error } = await supabase
      .from('todo_access')
      .select('id, permission')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      hasAccess: !!data,
      permission: data?.permission || null,
      error,
    };
  },

  /**
   * Grant Todo view access to multiple registered users.
   */
  async grantTodoAccess(userIds: string[], grantedBy: string) {
    if (!userIds || userIds.length === 0) return { error: null };

    const rows = userIds.map((userId) => ({
      user_id: userId,
      permission: 'TODO_VIEW' as const,
      granted_by: grantedBy || null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('todo_access')
      .upsert(rows, { onConflict: 'user_id, permission' })
      .select(TODO_ACCESS_COLUMNS);

    return { data, error };
  },

  /**
   * Revoke Todo view access from multiple users.
   */
  async revokeTodoAccess(userIds: string[]) {
    if (!userIds || userIds.length === 0) return { error: null };

    const { error } = await supabase
      .from('todo_access')
      .delete()
      .in('user_id', userIds);

    return { error };
  },

  /**
   * Reconciles current vs new selected user IDs:
   * Grants access to newly selected users and revokes access from unselected users.
   */
  async saveTodoAccess(selectedUserIds: string[], grantedBy: string) {
    // 1. Fetch current access list
    const { data: currentAccess, error: fetchErr } = await this.getTodoAccessList();
    if (fetchErr) return { error: fetchErr };

    const existingUserIds = (currentAccess || []).map((a) => a.user_id);
    const existingSet = new Set(existingUserIds);
    const selectedSet = new Set(selectedUserIds);

    const toGrant = selectedUserIds.filter((id) => !existingSet.has(id));
    const toRevoke = existingUserIds.filter((id) => !selectedSet.has(id));

    // 2. Perform grants
    if (toGrant.length > 0) {
      const { error: grantErr } = await this.grantTodoAccess(toGrant, grantedBy);
      if (grantErr) return { error: grantErr };
    }

    // 3. Perform revokes
    if (toRevoke.length > 0) {
      const { error: revokeErr } = await this.revokeTodoAccess(toRevoke);
      if (revokeErr) return { error: revokeErr };
    }

    return { error: null, grantedCount: toGrant.length, revokedCount: toRevoke.length };
  },
};
