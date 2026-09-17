import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { isAdminRole, isSuperadmin, hasTodoAccess, canAccessModule } from '@/utils/permissionService';
import { DEFAULT_BRANCHES } from '@/utils/bulkQuoteParser';

export type SearchCategory =
  | 'navigation'
  | 'users'
  | 'branches'
  | 'quotations'
  | 'mistakes'
  | 'leave'
  | 'todos'
  | 'rules';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: string;
  metadata?: Record<string, any>;
}

export interface NavigationTarget {
  tab: string;
  subtab?: string;
  label: string;
  description?: string;
  badge?: string;
  requiredModule?: string;
}

export const APP_NAVIGATION_TARGETS: NavigationTarget[] = [
  // Quotes Module
  { tab: 'quotes', subtab: 'entry', label: 'Quotation Daily Entry', description: 'Add or edit daily quotes and sales', requiredModule: 'quotes' },
  { tab: 'quotes', subtab: 'monthly', label: 'Monthly Summary', description: 'Monthly quote submission summary and breakdowns', requiredModule: 'quotes' },
  { tab: 'quotes', subtab: 'sale_summary', label: 'Sales Summary', description: 'Monthly and yearly sales performance', requiredModule: 'quotes' },
  { tab: 'quotes', subtab: 'mistakes', label: 'Quotation Mistakes', description: 'QC quotation error tracker & penalty records', requiredModule: 'quotes' },
  { tab: 'quotes', subtab: 'leaderboard', label: 'Leaderboard', description: 'Quotes and performance rankings', requiredModule: 'leaderboard' },
  { tab: 'quotes', subtab: 'reports', label: 'Quotes Reports', description: 'Staff reports and performance records', requiredModule: 'reports' },
  { tab: 'quotes', subtab: 'rules', label: 'Quote Rules', description: 'Compliance rules & quoting specifications', requiredModule: 'rules' },
  { tab: 'quotes', subtab: 'login_codes', label: 'Login Codes', description: 'Supplier portal and portal logins', requiredModule: 'quotes' },
  { tab: 'quotes', subtab: 'causality', label: 'Causality Analysis', description: 'Quote conversion and loss causality', requiredModule: 'quotes' },
  { tab: 'quotes', subtab: 'quick_import', label: 'Quick Import', description: 'Bulk copy and import quotation records', requiredModule: 'quotes' },
  { tab: 'quotes', subtab: 'save_file', label: 'Save File Helper', description: 'Superadmin quotation file generator', requiredModule: 'save_file' },
  
  // Chuti (Leave) Module
  { tab: 'chuti', subtab: 'add_leave', label: 'Apply Leave (Add Leave)', description: 'Submit a new leave request or short leave', requiredModule: 'leave' },
  { tab: 'chuti', subtab: 'leave_history', label: 'Leave History', description: 'View past leave submissions and status', requiredModule: 'leave' },
  { tab: 'chuti', subtab: 'team_leaves', label: 'Team Leaves Calendar', description: 'Active and upcoming team leaves', requiredModule: 'leave' },
  { tab: 'chuti', subtab: 'settlement', label: 'Review & Settlement', description: 'Leave balance review and year-end settlements', requiredModule: 'settlement' },
  { tab: 'chuti', subtab: 'leave_settings', label: 'Leave Settings', description: 'Configure global leave rules and allowances', requiredModule: 'leave_settings' },

  // Top-Level Management & Utilities
  { tab: 'profile_settings', subtab: 'user_management', label: 'User Management (Settings > Users)', description: 'Staff profiles, access control, and 360 overview', requiredModule: 'user_management' },
  { tab: 'todo', label: 'Todo Tasks', description: 'Assigned tasks and action items', requiredModule: 'todo' },
  { tab: 'kpi', label: 'KPI Performance Panel', description: 'Employee Key Performance Indicators', requiredModule: 'kpi' },
  { tab: 'profile_settings', label: 'My Profile Settings', description: 'Personal details, working hours & password' },
];

/**
 * Searches local in-memory sources (Navigation, Users, Branches) with 0ms latency.
 */
export function searchLocalEntities(params: {
  query: string;
  profile: Profile | null;
  profilesList: Profile[];
}): SearchResultItem[] {
  const { query, profile, profilesList } = params;
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResultItem[] = [];

  // 1. Navigation Targets (filtered by permissions)
  const matchingNav = APP_NAVIGATION_TARGETS.filter((target) => {
    if (target.requiredModule && !canAccessModule(profile, null, target.requiredModule)) {
      return false;
    }
    const labelMatch = target.label.toLowerCase().includes(q);
    const descMatch = target.description?.toLowerCase().includes(q);
    const tabMatch = target.tab.toLowerCase().includes(q) || (target.subtab && target.subtab.toLowerCase().includes(q));
    return labelMatch || descMatch || tabMatch;
  }).slice(0, 5);

  matchingNav.forEach((target) => {
    results.push({
      id: `nav-${target.tab}-${target.subtab || 'main'}`,
      category: 'navigation',
      title: target.label,
      subtitle: target.description || `Go to ${target.tab}`,
      badge: target.subtab ? `${target.tab} > ${target.subtab}` : target.tab,
      icon: 'navigation',
      metadata: {
        tab: target.tab,
        subtab: target.subtab,
      },
    });
  });

  // 2. Users / Profiles (from ProfilesContext)
  const matchingUsers = profilesList
    .filter((p) => {
      const codename = (p.codename || p.username || '').toLowerCase();
      const fullName = (p.full_name || '').toLowerCase();
      const role = (p.role || '').toLowerCase();
      const jobRole = (p.job_role || '').toLowerCase();
      return codename.includes(q) || fullName.includes(q) || role.includes(q) || jobRole.includes(q);
    })
    .slice(0, 5);

  matchingUsers.forEach((user) => {
    results.push({
      id: `user-${user.id}`,
      category: 'users',
      title: user.full_name || user.codename || user.username,
      subtitle: `@${user.codename || user.username} • ${user.job_role || user.role}`,
      badge: user.role.toUpperCase(),
      icon: 'user',
      metadata: {
        user,
        userId: user.id,
      },
    });
  });

  // 3. Branches (from DEFAULT_BRANCHES)
  const matchingBranches = DEFAULT_BRANCHES.filter((b) =>
    b.toLowerCase().includes(q)
  ).slice(0, 5);

  matchingBranches.forEach((branch) => {
    results.push({
      id: `branch-${branch}`,
      category: 'branches',
      title: branch,
      subtitle: 'Quotation branch filter',
      badge: 'BRANCH',
      icon: 'building',
      metadata: {
        branch,
      },
    });
  });

  return results;
}

/**
 * Searches remote database tables (Quotations, Mistakes, Leave, Todos, Rules)
 * with strict role-based access control and maximum 5 results per entity.
 */
export async function searchRemoteEntities(params: {
  query: string;
  sessionUser: { id: string } | null;
  profile: Profile | null;
  signal?: AbortSignal;
}): Promise<SearchResultItem[]> {
  const { query, sessionUser, profile, signal } = params;
  const q = query.trim();
  if (!q || !sessionUser) return [];

  const isAdmin = isAdminRole(profile);
  const isSuper = isSuperadmin(profile);
  const hasTodo = hasTodoAccess(profile);

  const results: SearchResultItem[] = [];

  // Helper to wrap Supabase queries with AbortSignal support
  const executeQuery = async (p: PromiseLike<any>) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return p;
  };

  try {
    // 1. Quotations Search (`records`)
    let quotesQuery = supabase
      .from('records')
      .select('id, user_id, file_name, branch_name, codename, file_type, submitted_at')
      .or(`file_name.ilike.%${q}%,codename.ilike.%${q}%`)
      .order('submitted_at', { ascending: false })
      .limit(5);

    if (!isAdmin) {
      quotesQuery = quotesQuery.eq('user_id', sessionUser.id);
    }

    // 2. Quotation Mistakes Search (`quotation_mistakes`)
    let mistakesQuery = supabase
      .from('quotation_mistakes')
      .select('id, date, filename, branch, user_id, codename, mistake_details, penalty')
      .or(`filename.ilike.%${q}%,codename.ilike.%${q}%,branch.ilike.%${q}%,mistake_details.ilike.%${q}%`)
      .order('date', { ascending: false })
      .limit(5);

    if (!isAdmin) {
      mistakesQuery = mistakesQuery.eq('user_id', sessionUser.id);
    }

    // 3. Leave Search (`chuti`)
    let leaveQuery = supabase
      .from('chuti')
      .select('id, user_id, date, leave_type, status, comment, leave_hour')
      .or(`comment.ilike.%${q}%,leave_type.ilike.%${q}%`)
      .order('date', { ascending: false })
      .limit(5);

    if (!isAdmin) {
      leaveQuery = leaveQuery.eq('user_id', sessionUser.id);
    }

    // 4. Compliance Rules Search (`compliance_rules`)
    const rulesQuery = supabase
      .from('compliance_rules')
      .select('id, category, sub_category, company_name, title, content')
      .eq('is_deleted', false)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%,company_name.ilike.%${q}%`)
      .limit(5);

    // 5. Todos Search (`todos`) - only if permitted
    let todoQueryPromise: PromiseLike<any> | null = null;
    if (hasTodo) {
      let todoQuery = supabase
        .from('todos')
        .select('id, user_id, codename, task, todo_date, status, comment')
        .or(`task.ilike.%${q}%,comment.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!isSuper) {
        todoQuery = todoQuery.eq('user_id', sessionUser.id);
      }
      todoQueryPromise = executeQuery(todoQuery);
    }

    // Execute remote queries in parallel
    const [quotesRes, mistakesRes, leaveRes, rulesRes, todosRes] = await Promise.all([
      executeQuery(quotesQuery),
      executeQuery(mistakesQuery),
      executeQuery(leaveQuery),
      executeQuery(rulesQuery),
      todoQueryPromise || Promise.resolve({ data: [] }),
    ]);

    if (signal?.aborted) return [];

    // Map Quotations
    if (quotesRes.data) {
      quotesRes.data.forEach((r: any) => {
        results.push({
          id: `quote-${r.id}`,
          category: 'quotations',
          title: r.file_name || 'Untitled File',
          subtitle: `${r.file_type || 'Quote'} • ${r.branch_name || 'No Branch'} • ${r.codename || ''} (${r.submitted_at || ''})`,
          badge: r.file_type || 'QUOTE',
          icon: 'file-text',
          metadata: { quotation: r },
        });
      });
    }

    // Map Mistakes
    if (mistakesRes.data) {
      mistakesRes.data.forEach((m: any) => {
        results.push({
          id: `mistake-${m.id}`,
          category: 'mistakes',
          title: m.filename || 'Mistake Record',
          subtitle: `${m.branch || 'Branch'} • ${m.codename || ''} • ${m.mistake_details || ''}`,
          badge: m.penalty ? `Penalty: ${m.penalty}` : 'MISTAKE',
          icon: 'alert-triangle',
          metadata: { mistake: m },
        });
      });
    }

    // Map Leave
    if (leaveRes.data) {
      leaveRes.data.forEach((l: any) => {
        results.push({
          id: `leave-${l.id}`,
          category: 'leave',
          title: `${l.leave_type || 'Leave'} (${l.date || ''})`,
          subtitle: l.comment || `Status: ${l.status || 'Pending'}`,
          badge: (l.status || 'PENDING').toUpperCase(),
          icon: 'calendar',
          metadata: { leave: l },
        });
      });
    }

    // Map Rules
    if (rulesRes.data) {
      rulesRes.data.forEach((rule: any) => {
        results.push({
          id: `rule-${rule.id}`,
          category: 'rules',
          title: rule.title || rule.company_name || 'Rule',
          subtitle: rule.content ? (rule.content.length > 80 ? rule.content.slice(0, 80) + '...' : rule.content) : '',
          badge: rule.company_name || rule.category || 'RULE',
          icon: 'shield-check',
          metadata: { rule },
        });
      });
    }

    // Map Todos
    if (todosRes.data) {
      todosRes.data.forEach((t: any) => {
        results.push({
          id: `todo-${t.id}`,
          category: 'todos',
          title: t.task || 'Todo Task',
          subtitle: `${t.codename ? `@${t.codename} • ` : ''}${t.todo_date || ''} • ${t.comment || ''}`,
          badge: (t.status || 'TODO').toUpperCase(),
          icon: 'check-square',
          metadata: { todo: t },
        });
      });
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return [];
    }
    console.error('[GlobalSearchService] Remote search error:', err);
  }

  return results;
}
