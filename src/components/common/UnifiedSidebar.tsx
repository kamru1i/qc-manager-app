'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Profile } from '@/types';
import { canAccessModule, isSuperadmin, isAdminRole, isTabVisibleForRole } from '@/utils/permissionService';
import { useProfiles } from '@/contexts/ProfilesContext';
import {
  PanelLeftOpen,
  PanelLeftClose,
  Calendar,
  FileText,
  Clock,
  BookOpen,
  Award,
  Users,
  ScrollText,
  ListTodo,
  RotateCcw,
  Plus,
  Settings,
  History,
  BarChart2,
  Globe,
  Key,
  Save
} from 'lucide-react';

interface UnifiedSidebarProps {
  activeSection: 'chuti' | 'quotes' | 'user_management' | 'todo' | 'leaderboard' | 'reports' | 'audit_logs' | 'kpi' | 'profile_settings';
  profile: Profile | null;
  activeQuotesTab?: 'entry' | 'monthly' | 'leaderboard' | 'reports' | 'audit_logs' | 'rules' | 'login_codes' | 'causality' | 'copy_helper' | 'save_file';
  onQuotesTabChange?: (tab: 'entry' | 'monthly' | 'leaderboard' | 'reports' | 'audit_logs' | 'rules' | 'login_codes' | 'causality' | 'copy_helper' | 'save_file') => void;
  activeChutiTab?: 'add_leave' | 'leave_history' | 'govt_responses' | 'settlement' | 'leave_settings' | 'team_leaves';
  onChutiTabChange?: (tab: 'add_leave' | 'leave_history' | 'govt_responses' | 'settlement' | 'leave_settings' | 'team_leaves') => void;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  hideCollapseButton?: boolean;
  onNavItemClick?: () => void;
}

export const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({
  activeSection,
  profile,
  activeQuotesTab,
  onQuotesTabChange,
  activeChutiTab,
  onChutiTabChange,
  isSidebarCollapsed,
  onSidebarToggle,
  hideCollapseButton = false,
  onNavItemClick,
}) => {
  const router = useRouter();
  const { profilesList } = useProfiles();

  // Subtabs expanded/collapsed state persisted in localStorage
  const [isChutiExpanded, setIsChutiExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_subtab_chuti_expanded');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const [isQuotesExpanded, setIsQuotesExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_subtab_quotes_expanded');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  // Auto-expand active workspace tabs ONLY if user has not explicitly saved a preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (activeSection === 'chuti') {
        const saved = localStorage.getItem('sidebar_subtab_chuti_expanded');
        if (saved === null) {
          setIsChutiExpanded(true);
        }
      } else if (activeSection === 'quotes') {
        const saved = localStorage.getItem('sidebar_subtab_quotes_expanded');
        if (saved === null) {
          setIsQuotesExpanded(true);
        }
      }
    }
  }, [activeSection]);

  if (!profile) return null;

  const isSuperAdmin = isSuperadmin(profile);
  const userHiddenTabs = profile.global_settings?.hidden_tabs || [];
  
  // A tab is hidden when the user explicitly hid it in Settings > Menu (per-user hidden_tabs).
  // If not explicitly hidden: Superadmins see everything. Other roles check role_visibility.
  const tabHidden = (key: string): boolean => {
    if (userHiddenTabs.includes(key)) return true;
    if (isSuperAdmin) return false;
    return !isTabVisibleForRole(profile, key, profile.global_settings, profilesList);
  };

  // Navigation handlers
  const handleChutiNav = () => {
    localStorage.setItem('last_active_dashboard', 'chuti');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'chuti' }));
    router.push('/');
    onNavItemClick?.();
  };

  const handleChutiClick = () => {
    if (activeSection === 'chuti') {
      setIsChutiExpanded(prev => {
        const next = !prev;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sidebar_subtab_chuti_expanded', String(next));
        }
        return next;
      });
    } else {
      handleChutiNav();
    }
  };

  const handleQuotesNav = () => {
    localStorage.setItem('last_active_dashboard', 'quotes');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'quotes' }));
    router.push('/');
    onNavItemClick?.();
  };

  const handleQuotesClick = () => {
    if (activeSection === 'quotes') {
      setIsQuotesExpanded(prev => {
        const next = !prev;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sidebar_subtab_quotes_expanded', String(next));
        }
        return next;
      });
    } else {
      handleQuotesNav();
    }
  };

  const handleKpiNav = () => {
    localStorage.setItem('last_active_dashboard', 'kpi');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'kpi' }));
    router.push('/');
    onNavItemClick?.();
  };

  const handleUserManagementNav = () => {
    localStorage.setItem('last_active_dashboard', 'user_management');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'user_management' }));
    router.push('/');
    onNavItemClick?.();
  };

  const handleTodoNav = () => {
    localStorage.setItem('last_active_dashboard', 'todo');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'todo' }));
    router.push('/');
    onNavItemClick?.();
  };

  const handleLeaderboardNav = () => {
    localStorage.setItem('last_active_dashboard', 'leaderboard');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'leaderboard' }));
    router.push('/');
    onNavItemClick?.();
  };

  const handleAuditLogsNav = () => {
    localStorage.setItem('last_active_dashboard', 'audit_logs');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'audit_logs' }));
    router.push('/');
    onNavItemClick?.();
  };

  const handleProfileSettingsNav = () => {
    localStorage.setItem('last_active_dashboard', 'profile_settings');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'profile_settings' }));
    router.push('/');
    onNavItemClick?.();
  };

  return (
    <aside
      className={`shrink-0 bg-theme-card-bg/40 backdrop-blur-xl border-r border-theme-border-input/60 rounded-none p-4 select-none transition-all duration-300 ease-out h-full overflow-y-auto custom-scrollbar ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Header / Toggle Button */}
      <div className={`flex items-center mb-5 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isSidebarCollapsed && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">
            Workspaces
          </span>
        )}
        {!hideCollapseButton && (
          <button
            type="button"
            onClick={onSidebarToggle}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-theme-border-input bg-theme-page-bg/60 text-theme-text-secondary hover:text-theme-text-inverse hover:bg-theme-border-active transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Main Workspace Tabs */}
      <div className="space-y-2">
        {/* Workspace 1: Chuti Leave Tracker */}
        {canAccessModule(profile, null, 'leave') && (
          <button
            onClick={handleChutiNav}
            title={isSidebarCollapsed ? 'Leave Tracker' : undefined}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
            } ${
              activeSection === 'chuti'
                ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-955/5'
                : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
            }`}
          >
            <Calendar className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span className="whitespace-nowrap">Leave Tracker</span>}
          </button>
        )}

        {/* Workspace 2: Quotes & Sales Tracker */}
        {canAccessModule(profile, null, 'quotes') && (
          <button
            onClick={handleQuotesNav}
            title={isSidebarCollapsed ? 'Quotes Tracker' : undefined}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
            } ${
              activeSection === 'quotes'
                ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
            }`}
          >
            <FileText className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span className="whitespace-nowrap">Quotes Tracker</span>}
          </button>
        )}

        {/* Workspace: KPI & Performance */}
        {canAccessModule(profile, null, 'kpi') && !tabHidden('kpi') && (
          <div className="space-y-1">
            <button
              onClick={handleKpiNav}
              title={isSidebarCollapsed ? 'KPI & Performance' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'kpi'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                  : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
              }`}
            >
              <BarChart2 className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">KPI & Performance</span>}
            </button>
          </div>
        )}

        {/* Workspace: Todos (Only for superadmin Kamrul) */}
        {canAccessModule(profile, null, 'todo') && !tabHidden('todo') && (
          <div className="space-y-1">
            <button
              onClick={handleTodoNav}
              title={isSidebarCollapsed ? 'Todos' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'todo'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-955/5'
                  : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
              }`}
            >
              <ListTodo className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Todos</span>}
            </button>
          </div>
        )}

        {/* Workspace: Leaderboard (Everyone) */}
        {canAccessModule(profile, null, 'leaderboard') && !tabHidden('leaderboard') && (
          <div className="space-y-1">
            <button
              onClick={handleLeaderboardNav}
              title={isSidebarCollapsed ? 'Leaderboard' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'leaderboard'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                  : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
              }`}
            >
              <Award className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Leaderboard</span>}
            </button>
          </div>
        )}

        {/* Workspace: Audit Logs (Admin Only) */}
        {canAccessModule(profile, null, 'audit_logs') && !tabHidden('audit_logs') && (
          <div className="space-y-1">
            <button
              onClick={handleAuditLogsNav}
              title={isSidebarCollapsed ? 'Audit Logs' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'audit_logs'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                  : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
              }`}
            >
              <ScrollText className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Audit Logs</span>}
            </button>
          </div>
        )}

        {/* Workspace: Profile Settings (All Users) */}
        {canAccessModule(profile, null, 'profile_settings') && !tabHidden('profile_settings') && (
          <div className="space-y-1">
            <button
              onClick={handleProfileSettingsNav}
              title={isSidebarCollapsed ? 'Profile Settings' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'profile_settings'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                  : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
              }`}
            >
              <Settings className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Settings</span>}
            </button>
          </div>
        )}

        {/* Workspace 3: User Management (Admin & Supervisor Only) */}
        {canAccessModule(profile, null, 'user_management') && !tabHidden('user_management') && (
          <div className="space-y-1">
            <button
              onClick={handleUserManagementNav}
              title={isSidebarCollapsed ? 'User Management' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'user_management'
                  ? 'bg-purple-600/15 border border-purple-500/30 text-purple-400 shadow-md shadow-purple-900/5'
                  : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
              }`}
            >
              <Users className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">User Management</span>}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
