import { Profile, UserCreationRequest } from '@/types';

/**
 * Maps a raw profile row from Supabase to include the virtual `password_reset_status` field.
 * `password_reset_status` is stored inside `global_settings` JSONB but consumed
 * as a top-level field throughout the app. This helper centralizes the 6+ duplicated
 * mapping expressions.
 */
export function mapProfilePasswordResetStatus<T extends Record<string, any>>(profile: T): T & { password_reset_status: string } {
  return {
    ...profile,
    password_reset_status:
      profile.password_reset_status ||
      (profile.global_settings as Record<string, string> | undefined)?.password_reset_status ||
      'none',
  };
}

/**
 * Resolves the assigned supervisor(s) for a UserCreationRequest.
 * Returns formatted codename (e.g. '@NS720') and full name (e.g. 'Nahid Hossain').
 */
export function resolveAssignedSupervisor(
  req: UserCreationRequest,
  profilesList: Profile[] = []
): { codename: string | null; fullName: string | null } {
  const d = req.data || req.submitted_data;

  // 1. Gather all potential supervisor IDs
  const supIds: string[] = [
    ...(Array.isArray(d?.supervisor_ids) ? d.supervisor_ids : []),
    ...(Array.isArray(d?.supervisorIds) ? d.supervisorIds : []),
    ...(d?.assigned_supervisor_id ? [d.assigned_supervisor_id] : []),
  ].filter(Boolean);

  let matchedSups = profilesList.filter((p) => supIds.includes(p.id));

  // 2. Fallback to requester if requester is a supervisor/admin and approval is required
  if (matchedSups.length === 0 && req.requester_id) {
    const reqSup = profilesList.find((p) => p.id === req.requester_id);
    if (reqSup && (reqSup.role === 'supervisor' || reqSup.role === 'admin')) {
      if (d?.needs_supervisor_approval !== false && d?.needsApproval !== false) {
        matchedSups = [reqSup];
      }
    }
  }

  // 3. Matched profiles in profilesList
  if (matchedSups.length > 0) {
    const codenames = matchedSups
      .map((s) => (s.username ? `@${s.username.replace(/^@/, '').toUpperCase()}` : ''))
      .filter(Boolean)
      .join(', ');
    const fullNames = matchedSups
      .map((s) => s.full_name || s.username)
      .filter(Boolean)
      .join(', ');
    return {
      codename: codenames || null,
      fullName: fullNames || null,
    };
  }

  // 4. Stored assigned_supervisor_codename
  if (d?.assigned_supervisor_codename) {
    const codenames = d.assigned_supervisor_codename
      .split(',')
      .map((c) => `@${c.trim().replace(/^@/, '').toUpperCase()}`)
      .join(', ');
    return {
      codename: codenames,
      fullName: d.assigned_supervisor_name || null,
    };
  }

  // 5. Lookup by assigned_supervisor_name
  if (d?.assigned_supervisor_name && d.assigned_supervisor_name !== 'Self') {
    const byName = profilesList.find(
      (p) =>
        (p.full_name && p.full_name.toLowerCase() === d.assigned_supervisor_name?.toLowerCase()) ||
        (p.username && p.username.toLowerCase() === d.assigned_supervisor_name?.toLowerCase())
    );
    if (byName?.username) {
      return {
        codename: `@${byName.username.replace(/^@/, '').toUpperCase()}`,
        fullName: byName.full_name || byName.username,
      };
    }
    const nameVal = d.assigned_supervisor_name.trim();
    if (!nameVal.includes(' ') && nameVal.length <= 10) {
      return {
        codename: `@${nameVal.replace(/^@/, '').toUpperCase()}`,
        fullName: nameVal,
      };
    }
    return {
      codename: `@${nameVal.replace(/^@/, '')}`,
      fullName: nameVal,
    };
  }

  return { codename: null, fullName: null };
}
