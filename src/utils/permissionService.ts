import { Profile } from "@/types";

/**
 * Checks if targetUser is in the supervisor's team (either direct or delegated team-level supervision).
 */
export const isSupervisedTeam = (
  currentUser: Profile | null,
  targetUser: Profile | null,
  profilesList: Profile[]
): boolean => {
  if (!currentUser || !targetUser) return false;
  if (targetUser.id === currentUser.id) return true;
  
  // Direct team supervision
  const supervisorIds = targetUser.supervisor_ids || [];
  if (supervisorIds.includes(currentUser.id)) return true;
  
  // Delegated team-level supervision (B is delegated supervisor of A, where employee has supervisor A)
  if (currentUser.role === 'supervisor') {
    const delegatedFromSupervisorIds = profilesList
      .filter((p) => p.delegated_supervisor_id === currentUser.id)
      .map((p) => p.id);
    if (supervisorIds.some((id) => delegatedFromSupervisorIds.includes(id))) return true;
  }
  
  return false;
};

/**
 * Checks if targetUser is directly supervised by currentUser.
 */
export const isDirectlySupervised = (
  currentUser: Profile | null,
  targetUser: Profile | null
): boolean => {
  if (!currentUser || !targetUser) return false;
  if (targetUser.id === currentUser.id) return true;
  
  const supervisorIds = targetUser.supervisor_ids || [];
  return supervisorIds.includes(currentUser.id);
};

/**
 * Centralized authorization rules for module access.
 */
export const canAccessModule = (
  currentUser: Profile | null,
  targetUser: Profile | null,
  module: 'kpi' | 'leave' | 'profile_settings' | 'quotes' | 'user_management' | 'todo' | 'leaderboard' | 'reports' | 'audit_logs',
  profilesList: Profile[] = []
): boolean => {
  if (!currentUser) return false;
  
  // Admin / Super Admin (highest permission priority)
  if (currentUser.role === 'admin') {
    if (module === 'todo') {
      return currentUser.username?.toUpperCase() === 'KAMRUL' || currentUser.full_name === 'Kamrul Islam';
    }
    return true;
  }
  
  // Regular User permissions
  if (currentUser.role === 'user') {
    if (module === 'todo') {
      return currentUser.username?.toUpperCase() === 'KAMRUL' || currentUser.full_name === 'Kamrul Islam';
    }
    if (module === 'kpi') return targetUser ? targetUser.id === currentUser.id : true;
    if (module === 'leave') return targetUser ? targetUser.id === currentUser.id : true;
    if (module === 'profile_settings') return true;
    if (module === 'quotes') return !!currentUser.has_quotes_access;
    if (module === 'leaderboard' || module === 'reports') return true;
    return false;
  }
  
  // Supervisor permissions
  if (currentUser.role === 'supervisor') {
    if (module === 'audit_logs') return false; // explicitly revoked for supervisors
    if (module === 'todo') {
      return currentUser.username?.toUpperCase() === 'KAMRUL' || currentUser.full_name === 'Kamrul Islam';
    }
    if (module === 'user_management') return true;
    if (module === 'quotes') return !!currentUser.has_quotes_access;
    if (module === 'leaderboard' || module === 'reports') return true;
    
    // Checks for specific target users
    if (targetUser) {
      if (targetUser.id === currentUser.id) return true; // full access to self
      
      switch (module) {
        case 'leave':
          return (
            isSupervisedTeam(currentUser, targetUser, profilesList) ||
            targetUser.delegated_leave_supervisor_id === currentUser.id
          );
        case 'kpi':
          return (
            isDirectlySupervised(currentUser, targetUser) ||
            targetUser.delegated_kpi_supervisor_id === currentUser.id
          );
        case 'profile_settings':
          return true; // allowed to access Profile Settings tab, but specific sections are restricted
        default:
          return false;
      }
    }
    return true;
  }
  
  return false;
};

/**
 * Checks supervisor permissions on specific sections inside User Profile Settings.
 */
export const canAccessProfileSection = (
  currentUser: Profile | null,
  targetUser: Profile | null,
  section: 'leave_settings' | 'kpi_settings' | 'quotes_settings' | 'basic_details',
  _profilesList: Profile[] = []
): boolean => {
  if (!currentUser || !targetUser) return false;
  if (currentUser.role === 'admin') return true;
  if (targetUser.id === currentUser.id) return true;
  
  if (currentUser.role === 'supervisor') {
    switch (section) {
      case 'basic_details':
      case 'quotes_settings':
        return true; // supervisors can edit basic details and quotes settings of all users
      case 'leave_settings':
        return true; // supervisors can read leave settings of all users (write is blocked via disabled={!isAdmin} in form)
      case 'kpi_settings':
        return isDirectlySupervised(currentUser, targetUser);
      default:
        return false;
    }
  }
  
  return false;
};
