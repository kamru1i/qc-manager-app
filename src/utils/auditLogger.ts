import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';

export type AuditActionType =
  | 'CREATE_MISTAKE'
  | 'UPDATE_MISTAKE'
  | 'DELETE_MISTAKE'
  | 'CREATE_LEAVE'
  | 'UPDATE_LEAVE'
  | 'APPROVE_LEAVE'
  | 'REJECT_LEAVE'
  | 'DELETE_LEAVE'
  | 'SETTLE_LEAVE'
  | 'ADJUST_LEAVE'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | string;

export interface AuditLogPayload {
  actor: Profile | null;
  actionType: AuditActionType;
  targetId?: string | null;
  details: string;
}

export const logAuditEvent = async ({ actor, actionType, targetId, details }: AuditLogPayload): Promise<void> => {
  if (!actor) return;
  try {
    const actorCodename = actor.codename || actor.full_name || actor.username || 'System User';
    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_codename: actorCodename,
      action_type: actionType,
      target_id: targetId || null,
      details: details,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
};
