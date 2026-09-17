import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { isAdminRole, isSuperadmin, hasTodoAccess, canAccessModule } from '@/utils/permissionService';
import { DEFAULT_BRANCHES } from '@/utils/bulkQuoteParser';

export type SearchCategory =
  | 'users'
  | 'quotations'
  | 'mistakes'
  | 'leave'
  | 'rules'
  | 'branches'
  | 'login_codes'
  | 'todos'
  | 'navigation';

export interface SearchResultItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: string;
  priorityScore?: number;
  metadata?: Record<string, any>;
}

export interface SearchResultGroup {
  category: SearchCategory;
  label: string;
  items: SearchResultItem[];
  topScore: number;
}

export const CATEGORY_DISPLAY_CONFIG: Record<SearchCategory, { label: string; order: number }> = {
  users: { label: 'USER', order: 1 },
  quotations: { label: 'QUOTATIONS', order: 2 },
  mistakes: { label: 'MISTAKES', order: 3 },
  leave: { label: 'LEAVE', order: 4 },
  rules: { label: 'QUOTE RULES', order: 5 },
  branches: { label: 'BRANCHES', order: 6 },
  todos: { label: 'TODOS', order: 7 },
  login_codes: { label: 'LOGIN CODES', order: 8 },
  navigation: { label: 'NAVIGATION', order: 9 },
};

/**
 * Normalizes input date strings across DD-MM-YYYY and YYYY-MM-DD
 */
export function parseDateVariants(input: string): string[] {
  const trimmed = input.trim();
  const variants = [trimmed];

  // DD-MM-YYYY -> YYYY-MM-DD
  const ddmmyyyy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    variants.push(`${year}-${month}-${day}`);
  }

  // YYYY-MM-DD -> DD-MM-YYYY
  const yyyymmdd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    variants.push(`${day}-${month}-${year}`);
  }

  return Array.from(new Set(variants));
}

/**
 * Calculates a deterministic priority score based on exact matches:
 * 1. Exact Codename match: 100
 * 2. Exact Filename match: 90
 * 3. Exact User/Employee Name match: 80
 * 4. Exact Branch match: 75
 * 5. Exact Quote Rule company/title match: 80
 * 6. Exact Login Code match: 85
 * 7. Exact Title / Entity match: 60
 * 8. Starts-with match: 50
 * 9. Substring / partial text match: 30
 */
export function calculatePriorityScore(item: SearchResultItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const titleLower = (item.title || '').toLowerCase();
  const subtitleLower = (item.subtitle || '').toLowerCase();
  const cleanTitle = titleLower.replace(/ \[(sold|unsold)\]$/, '').trim();

  // 1. Exact Codename match
  if (item.category === 'users') {
    const codename = (item.metadata?.user?.codename || item.metadata?.user?.username || '').toLowerCase();
    if (codename === q) return 100;
  }
  if (item.category === 'quotations') {
    const codename = (item.metadata?.quotation?.codename || '').toLowerCase();
    if (codename === q) return 95;
  }
  if (item.category === 'mistakes') {
    const codename = (item.metadata?.mistake?.codename || '').toLowerCase();
    if (codename === q) return 95;
  }

  // 2. Exact Filename match
  if (item.category === 'quotations') {
    if (cleanTitle === q) return 90;
  }
  if (item.category === 'mistakes') {
    const fname = (item.metadata?.mistake?.filename || '').toLowerCase();
    if (fname === q) return 90;
  }

  // 3. Exact Employee Name match
  if (item.category === 'users') {
    const fullName = (item.metadata?.user?.full_name || '').toLowerCase();
    if (fullName === q) return 80;
  }

  // 4. Exact Branch match
  if (item.category === 'branches') {
    if (titleLower === q) return 75;
  }
  if (item.category === 'quotations') {
    const branch = (item.metadata?.quotation?.branch_name || '').toLowerCase();
    if (branch === q) return 72;
  }
  if (item.category === 'mistakes') {
    const branch = (item.metadata?.mistake?.branch || '').toLowerCase();
    if (branch === q) return 72;
  }

  // 5. Exact Quote Rule company/title match
  if (item.category === 'rules') {
    const company = (item.metadata?.rule?.company_name || '').toLowerCase();
    const ruleTitle = (item.metadata?.rule?.title || '').toLowerCase();
    if (company === q || ruleTitle === q) return 80;
  }

  // 6. Exact Login Code match
  if (item.category === 'login_codes') {
    const loginId = (item.metadata?.loginCode?.login_id || item.title || '').toLowerCase();
    const code = (item.metadata?.loginCode?.code || '').toLowerCase();
    if (loginId === q || code === q) return 85;
  }

  // 7. Exact Navigation match
  if (item.category === 'navigation') {
    if (titleLower === q) return 60;
  }

  // 8. Starts-with matches
  if (titleLower.startsWith(q) || cleanTitle.startsWith(q)) return 50;
  if (item.category === 'users') {
    const codename = (item.metadata?.user?.codename || item.metadata?.user?.username || '').toLowerCase();
    if (codename.startsWith(q)) return 55;
  }

  // 9. Substring matches
  if (titleLower.includes(q)) return 35;
  if (subtitleLower.includes(q)) return 30;

  return 20;
}

/**
 * Groups and deterministically sorts search results by priority score.
 * Only returns groups that contain matching results.
 */
export function groupSearchResults(
  results: SearchResultItem[],
  query: string
): SearchResultGroup[] {
  if (!results.length) return [];

  const groupsMap = new Map<SearchCategory, SearchResultItem[]>();
  results.forEach((item) => {
    // Ensure priority score is populated
    if (item.priorityScore === undefined) {
      item.priorityScore = calculatePriorityScore(item, query);
    }
    const cat = item.category;
    if (!groupsMap.has(cat)) {
      groupsMap.set(cat, []);
    }
    groupsMap.get(cat)!.push(item);
  });

  const groups: SearchResultGroup[] = [];

  groupsMap.forEach((items, category) => {
    if (items.length > 0) {
      // Sort items within group by priorityScore descending
      items.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
      const topScore = items[0]?.priorityScore ?? 0;
      const config = CATEGORY_DISPLAY_CONFIG[category] || { label: category.toUpperCase(), order: 99 };
      groups.push({
        category,
        label: config.label,
        items,
        topScore,
      });
    }
  });

  // Sort groups primarily by topScore descending, and secondarily by canonical display order
  groups.sort((a, b) => {
    if (b.topScore !== a.topScore) {
      return b.topScore - a.topScore;
    }
    const orderA = CATEGORY_DISPLAY_CONFIG[a.category]?.order ?? 99;
    const orderB = CATEGORY_DISPLAY_CONFIG[b.category]?.order ?? 99;
    return orderA - orderB;
  });

  return groups;
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
 * Searches remote database tables (Quotations, Mistakes, Leave, Todos, Rules, Login Codes)
 * with strict role-based access control, date parsing, and maximum 6 results per entity.
 */
export async function searchRemoteEntities(params: {
  query: string;
  sessionUser: { id: string } | null;
  profile: Profile | null;
  profilesList?: Profile[];
  signal?: AbortSignal;
}): Promise<SearchResultItem[]> {
  const { query, sessionUser, profile, profilesList = [], signal } = params;
  const q = query.trim();
  const qLower = q.toLowerCase();
  if (!q || !sessionUser) return [];

  const isAdmin = isAdminRole(profile);
  const isSuper = isSuperadmin(profile);
  const hasTodo = hasTodoAccess(profile);
  const dateVariants = parseDateVariants(q);

  const results: SearchResultItem[] = [];

  // Helper to wrap Supabase queries with AbortSignal support
  const executeQuery = async (p: PromiseLike<any>) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return p;
  };

  try {
    // 1. Quotations Search (`records`)
    // Matches file_name, codename, branch_name, file_type, or submitted_at date
    const dateFilters = dateVariants.map((d) => `submitted_at.ilike.%${d}%`).join(',');
    const quotesOr = `file_name.ilike.%${q}%,codename.ilike.%${q}%,branch_name.ilike.%${q}%,file_type.ilike.%${q}%${dateFilters ? `,${dateFilters}` : ''}`;

    let quotesQuery = supabase
      .from('records')
      .select('id, user_id, file_name, branch_name, codename, file_type, submitted_at')
      .or(quotesOr)
      .order('submitted_at', { ascending: false })
      .limit(6);

    if (!isAdmin) {
      quotesQuery = quotesQuery.eq('user_id', sessionUser.id);
    }

    // 2. Quotation Mistakes Search (`quotation_mistakes`)
    const mistakeDateFilters = dateVariants.map((d) => `date.ilike.%${d}%`).join(',');
    const mistakeOr = `filename.ilike.%${q}%,codename.ilike.%${q}%,branch.ilike.%${q}%,mistake_details.ilike.%${q}%,penalty.ilike.%${q}%${mistakeDateFilters ? `,${mistakeDateFilters}` : ''}`;

    let mistakesQuery = supabase
      .from('quotation_mistakes')
      .select('id, date, filename, branch, user_id, codename, mistake_details, penalty')
      .or(mistakeOr)
      .order('date', { ascending: false })
      .limit(6);

    if (!isAdmin) {
      mistakesQuery = mistakesQuery.eq('user_id', sessionUser.id);
    }

    // 3. Leave Search (`chuti`)
    // Strictly respects permissions: non-admin users ONLY search their own leave records
    let leaveQueryPromise: PromiseLike<any>;
    if (!isAdmin) {
      const leaveDateFilters = dateVariants.map((d) => `date.ilike.%${d}%`).join(',');
      const leaveOr = `comment.ilike.%${q}%,leave_type.ilike.%${q}%${leaveDateFilters ? `,${leaveDateFilters}` : ''}`;
      const leaveQuery = supabase
        .from('chuti')
        .select('id, user_id, date, leave_type, status, comment, leave_hour')
        .eq('user_id', sessionUser.id)
        .or(leaveOr)
        .order('date', { ascending: false })
        .limit(6);
      leaveQueryPromise = executeQuery(leaveQuery);
    } else {
      // Admin: can search across all records by comment, leave_type, date
      // AND if the query matches employees in profilesList, search by their user IDs
      const matchingUserIds = profilesList
        .filter(
          (p) =>
            p.username?.toLowerCase().includes(qLower) ||
            p.codename?.toLowerCase().includes(qLower) ||
            p.full_name?.toLowerCase().includes(qLower)
        )
        .map((p) => p.id)
        .slice(0, 5);

      const leaveDateFilters = dateVariants.map((d) => `date.ilike.%${d}%`).join(',');
      let leaveOr = `comment.ilike.%${q}%,leave_type.ilike.%${q}%${leaveDateFilters ? `,${leaveDateFilters}` : ''}`;
      if (matchingUserIds.length > 0) {
        leaveOr += `,user_id.in.(${matchingUserIds.join(',')})`;
      }

      const leaveQuery = supabase
        .from('chuti')
        .select('id, user_id, date, leave_type, status, comment, leave_hour')
        .or(leaveOr)
        .order('date', { ascending: false })
        .limit(6);
      leaveQueryPromise = executeQuery(leaveQuery);
    }

    // 4. Compliance Rules Search (`compliance_rules`)
    let rulesPromise: PromiseLike<any> | null = null;
    if (canAccessModule(profile, null, 'rules') || canAccessModule(profile, null, 'quotes')) {
      const rulesQuery = supabase
        .from('compliance_rules')
        .select('id, category, sub_category, company_name, title, content')
        .eq('is_deleted', false)
        .or(`title.ilike.%${q}%,content.ilike.%${q}%,company_name.ilike.%${q}%,category.ilike.%${q}%,sub_category.ilike.%${q}%`)
        .limit(6);
      rulesPromise = executeQuery(rulesQuery);
    }

    // 5. Login Codes Search (`login_codes`) - gated by quotes access
    let loginCodesPromise: PromiseLike<any> | null = null;
    if (canAccessModule(profile, null, 'quotes')) {
      const loginCodesQuery = supabase
        .from('login_codes')
        .select('login_id, name, code')
        .or(`login_id.ilike.%${q}%,name.ilike.%${q}%,code.ilike.%${q}%`)
        .limit(6);
      loginCodesPromise = executeQuery(loginCodesQuery);
    }

    // 6. Todos Search (`todos`) - only if permitted
    let todoQueryPromise: PromiseLike<any> | null = null;
    if (hasTodo) {
      let todoQuery = supabase
        .from('todos')
        .select('id, user_id, codename, task, todo_date, status, comment')
        .or(`task.ilike.%${q}%,comment.ilike.%${q}%,codename.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(6);

      if (!isSuper) {
        todoQuery = todoQuery.eq('user_id', sessionUser.id);
      }
      todoQueryPromise = executeQuery(todoQuery);
    }

    // Execute remote queries in parallel
    const [quotesRes, mistakesRes, leaveRes, rulesRes, loginCodesRes, todosRes] = await Promise.all([
      executeQuery(quotesQuery),
      executeQuery(mistakesQuery),
      leaveQueryPromise,
      rulesPromise || Promise.resolve({ data: [] }),
      loginCodesPromise || Promise.resolve({ data: [] }),
      todoQueryPromise || Promise.resolve({ data: [] }),
    ]);

    if (signal?.aborted) return [];

    // Map Quotations
    if (quotesRes.data) {
      quotesRes.data.forEach((r: any) => {
        const item: SearchResultItem = {
          id: `quote-${r.id}`,
          category: 'quotations',
          title: r.file_name || 'Untitled File',
          subtitle: `${r.file_type || 'Quote'} • ${r.branch_name || 'No Branch'} • @${(r.codename || '').toUpperCase()} (${r.submitted_at || ''})`,
          badge: r.file_type || 'QUOTE',
          icon: 'file-text',
          metadata: { quotation: r },
        };
        item.priorityScore = calculatePriorityScore(item, q);
        results.push(item);
      });
    }

    // Map Mistakes
    if (mistakesRes.data) {
      mistakesRes.data.forEach((m: any) => {
        const item: SearchResultItem = {
          id: `mistake-${m.id}`,
          category: 'mistakes',
          title: m.filename || 'Mistake Record',
          subtitle: `${m.branch || 'Branch'} • @${(m.codename || '').toUpperCase()} • ${m.mistake_details || ''}`,
          badge: m.penalty ? `Penalty: ${m.penalty}` : 'MISTAKE',
          icon: 'alert-triangle',
          metadata: { mistake: m },
        };
        item.priorityScore = calculatePriorityScore(item, q);
        results.push(item);
      });
    }

    // Map Leave
    if (leaveRes.data) {
      leaveRes.data.forEach((l: any) => {
        // Find staff display name if available
        const staff = profilesList.find((p) => p.id === l.user_id);
        const staffPrefix = staff ? `@${(staff.codename || staff.username || '').toUpperCase()} • ` : '';
        const item: SearchResultItem = {
          id: `leave-${l.id}`,
          category: 'leave',
          title: `${l.leave_type || 'Leave'} on ${l.date || ''}`,
          subtitle: `${staffPrefix}${l.comment || (l.leave_hour ? `Duration: ${l.leave_hour}` : `Status: ${l.status || 'Pending'}`)}`,
          badge: (l.status || 'PENDING').toUpperCase(),
          icon: 'calendar',
          metadata: { leave: l },
        };
        item.priorityScore = calculatePriorityScore(item, q);
        results.push(item);
      });
    }

    // Map Rules
    if (rulesRes.data) {
      rulesRes.data.forEach((rule: any) => {
        const item: SearchResultItem = {
          id: `rule-${rule.id}`,
          category: 'rules',
          title: rule.title || rule.company_name || 'Quote Rule',
          subtitle: rule.content ? (rule.content.length > 90 ? rule.content.slice(0, 90) + '...' : rule.content) : '',
          badge: rule.company_name || rule.category || 'RULE',
          icon: 'shield-check',
          metadata: { rule },
        };
        item.priorityScore = calculatePriorityScore(item, q);
        results.push(item);
      });
    }

    // Map Login Codes
    if (loginCodesRes.data) {
      loginCodesRes.data.forEach((lc: any) => {
        const item: SearchResultItem = {
          id: `login-${lc.login_id}`,
          category: 'login_codes',
          title: lc.login_id,
          subtitle: `${lc.name || 'Portal Login'} • Code: ${lc.code || '-'}`,
          badge: 'LOGIN CODE',
          icon: 'key',
          metadata: { loginCode: lc },
        };
        item.priorityScore = calculatePriorityScore(item, q);
        results.push(item);
      });
    }

    // Map Todos
    if (todosRes.data) {
      todosRes.data.forEach((t: any) => {
        const item: SearchResultItem = {
          id: `todo-${t.id}`,
          category: 'todos',
          title: t.task || 'Todo Task',
          subtitle: `${t.codename ? `@${t.codename} • ` : ''}${t.todo_date || ''} • ${t.comment || ''}`,
          badge: (t.status || 'TODO').toUpperCase(),
          icon: 'check-square',
          metadata: { todo: t },
        };
        item.priorityScore = calculatePriorityScore(item, q);
        results.push(item);
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
