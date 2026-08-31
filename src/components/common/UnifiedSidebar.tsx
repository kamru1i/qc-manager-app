'use client';

import React, { useState, useEffect } from 'react';
import { useAppEventBus } from '@/contexts/AppEventBusContext';
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
  Home,
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
  activeSection: 'chuti' | 'quotes' | 'user_management' | 'todo' | 'leaderboard' | 'reports' | 'kpi' | 'profile_settings' | 'my_report' | 'all_report';
  onSectionChange?: (section: 'chuti' | 'quotes' | 'user_management' | 'todo' | 'leaderboard' | 'reports' | 'kpi' | 'profile_settings' | 'my_report' | 'all_report') => void;
  profile: Profile | null;
  activeQuotesTab?: 'entry' | 'monthly' | 'sale_summary' | 'leaderboard' | 'reports' | 'rules' | 'login_codes' | 'causality' | 'copy_helper' | 'save_file' | 'quick_import' | 'mistakes';
  onQuotesTabChange?: (tab: 'entry' | 'monthly' | 'leaderboard' | 'reports' | 'rules' | 'login_codes' | 'causality' | 'copy_helper' | 'save_file' | 'quick_import' | 'mistakes') => void;
  activeChutiTab?: 'add_leave' | 'leave_history' | 'settlement' | 'leave_settings' | 'team_leaves';
  onChutiTabChange?: (tab: 'add_leave' | 'leave_history' | 'settlement' | 'leave_settings' | 'team_leaves') => void;
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
  const { emit } = useAppEventBus();
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

  const tabHidden = (key: string): boolean => {
    if (isSuperAdmin) return false;
    return !isTabVisibleForRole(profile, key, profile.global_settings, profilesList);
  };

  // Navigation handlers
  const handleChutiNav = () => {
    localStorage.setItem('last_active_dashboard', 'chuti');
    emit('workspace-change', 'chuti');
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
    emit('workspace-change', 'quotes');
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

  const handleReportsNav = () => {
    const hasQuotes = canAccessModule(profile, null, 'quotes');
    const canKpi = canAccessModule(profile, null, 'kpi') && !tabHidden('kpi');
    const canLeaderboard = hasQuotes && canAccessModule(profile, null, 'leaderboard');
    const canMyReport = hasQuotes && canAccessModule(profile, null, 'my_report');
    const canAllReport = hasQuotes && (isAdminRole(profile) || profile?.role === 'supervisor') && canAccessModule(profile, null, 'all_report');

    let savedSubtab = localStorage.getItem('last_active_reports_subtab');
    if (savedSubtab === 'leaderboard' && !canLeaderboard) savedSubtab = null;
    if (savedSubtab === 'my_report' && !canMyReport) savedSubtab = null;
    if (savedSubtab === 'all_report' && !canAllReport) savedSubtab = null;
    if (savedSubtab === 'kpi' && !canKpi) savedSubtab = null;

    let target = savedSubtab;
    if (!target) {
      if (canLeaderboard) target = 'leaderboard';
      else if (canKpi) target = 'kpi';
      else if (canMyReport) target = 'my_report';
      else if (canAllReport) target = 'all_report';
      else target = 'kpi';
    }

    localStorage.setItem('last_active_dashboard', target);
    emit('workspace-change', target);
    router.push('/');
    onNavItemClick?.();
  };

  const handleUserManagementNav = () => {
    localStorage.setItem('settings_active_subtab', 'user_management');
    localStorage.setItem('last_active_dashboard', 'profile_settings');
    emit('workspace-change', 'profile_settings');
    emit('settings-subtab-change', { subtab: 'user_management' });
    router.push('/');
    onNavItemClick?.();
  };

  const handleTodoNav = () => {
    localStorage.setItem('last_active_dashboard', 'todo');
    emit('workspace-change', 'todo');
    router.push('/');
    onNavItemClick?.();
  };



  const handleProfileSettingsNav = () => {
    localStorage.setItem('last_active_dashboard', 'profile_settings');
    emit('workspace-change', 'profile_settings');
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
            title={isSidebarCollapsed ? 'Chuti' : undefined}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
            } ${
              activeSection === 'chuti'
                ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-955/5'
                : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
            }`}
          >
            <Calendar className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span className="whitespace-nowrap">Chuti</span>}
          </button>
        )}

        {/* Workspace 2: Quotes & Sales Tracker */}
        {canAccessModule(profile, null, 'quotes') && (
          <button
            onClick={handleQuotesNav}
            title={isSidebarCollapsed ? 'Quotation' : undefined}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
            } ${
              activeSection === 'quotes'
                ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
            }`}
          >
            <FileText className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span className="whitespace-nowrap">Quotation</span>}
          </button>
        )}

        {/* Workspace: Reports (KPI Report & Leaderboard) */}
        {(
          (canAccessModule(profile, null, 'kpi') && !tabHidden('kpi')) ||
          (canAccessModule(profile, null, 'quotes') && (canAccessModule(profile, null, 'reports') || canAccessModule(profile, null, 'leaderboard')))
        ) && (
          <div className="space-y-1">
            <button
              onClick={handleReportsNav}
              title={isSidebarCollapsed ? 'Reports' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'kpi' || activeSection === 'leaderboard' || activeSection === 'reports' || activeSection === 'my_report' || activeSection === 'all_report'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                  : 'text-theme-text-secondary hover:bg-theme-border-active/80 hover:text-theme-text-inverse border border-transparent'
              }`}
            >
              <BarChart2 className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Reports</span>}
            </button>
          </div>
        )}

        {/* Workspace: Todos (Superadmin or explicitly granted View-Only users) */}
        {canAccessModule(profile, null, 'todo') && (
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
      </div>
    </aside>
  );
};
