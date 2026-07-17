'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Profile } from '@/types';
import { canAccessModule } from '@/utils/permissionService';
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
  activeQuotesTab?: 'entry' | 'monthly' | 'leaderboard' | 'reports' | 'audit_logs' | 'rules' | 'ip_checker' | 'login_codes' | 'causality' | 'copy_helper' | 'save_file';
  onQuotesTabChange?: (tab: 'entry' | 'monthly' | 'leaderboard' | 'reports' | 'audit_logs' | 'rules' | 'ip_checker' | 'login_codes' | 'causality' | 'copy_helper' | 'save_file') => void;
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

  // Subtabs expanded/collapsed state
  const [isChutiExpanded, setIsChutiExpanded] = useState(true);
  const [isQuotesExpanded, setIsQuotesExpanded] = useState(true);

  // Auto-expand active workspace tabs
  useEffect(() => {
    if (activeSection === 'chuti') {
      setIsChutiExpanded(true);
    } else if (activeSection === 'quotes') {
      setIsQuotesExpanded(true);
    }
  }, [activeSection]);

  if (!profile) return null;

  const isSuperAdmin = profile.codename?.toUpperCase() === 'KAMRUL' || profile.full_name === 'Kamrul Islam';
  const hiddenTabs = profile.global_settings?.hidden_tabs || [];

  // Navigation handlers
  const handleChutiNav = () => {
    localStorage.setItem('last_active_dashboard', 'chuti');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'chuti' }));
    router.push('/');
    onNavItemClick?.();
  };

  const handleChutiClick = () => {
    if (activeSection === 'chuti') {
      setIsChutiExpanded(prev => !prev);
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
      setIsQuotesExpanded(prev => !prev);
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
      className={`shrink-0 bg-theme-card-bg/50 backdrop-blur-xl border border-theme-border-input/80 rounded-2xl p-4 shadow-xl select-none transition-all duration-300 ease-out ${
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
      <div className="space-y-4">
        {/* Workspace 1: Chuti Leave Tracker */}
        {canAccessModule(profile, null, 'leave') && (
          <div className="space-y-1">
            <button
              onClick={handleChutiClick}
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
 
            {/* Embedded Chuti sub-tabs when chuti section is active */}
            {activeSection === 'chuti' && isChutiExpanded && onChutiTabChange && activeChutiTab && (
              <div className={`pt-2 space-y-1 ${isSidebarCollapsed ? 'flex flex-col items-center' : 'pl-4 border-l border-theme-border-input/80 ml-6'}`}>
                {/* 1. Add Leave */}
                <button
                  onClick={() => { onChutiTabChange('add_leave'); onNavItemClick?.(); }}
                  title={isSidebarCollapsed ? 'Add Leave' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeChutiTab === 'add_leave'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                  }`}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Add Leave</span>}
                </button>


                {/* 3. Leave History (All Users) */}
                {!hiddenTabs.includes('leave_history') && (
                  <button
                    onClick={() => { onChutiTabChange('leave_history'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Leave History' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'leave_history'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <History className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Leave History</span>}
                  </button>
                )}

                {/* Team Leave Records (Admin and Supervisor Only) */}
                {(profile?.role === 'admin' || profile?.role === 'supervisor') && !hiddenTabs.includes('team_leaves') && (
                  <button
                    onClick={() => { onChutiTabChange('team_leaves'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Team Leave Records' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'team_leaves'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Team Leave Records</span>}
                  </button>
                )}

                {/* 3. Govt Holiday Response (Admin Only) */}
                {profile?.role === 'admin' && !hiddenTabs.includes('govt_responses') && (
                  <button
                    onClick={() => { onChutiTabChange('govt_responses'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Govt Holiday Response' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'govt_responses'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <Calendar className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Govt Holiday Response</span>}
                  </button>
                )}

                {/* 4. Review & Settlements (Admin Only) */}
                {profile?.role === 'admin' && !hiddenTabs.includes('settlement') && (
                  <button
                    onClick={() => { onChutiTabChange('settlement'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Review & Settlements' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'settlement'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Review & Settlements</span>}
                  </button>
                )}

                {/* 5. Leave Settings (Admin Only) */}
                {profile?.role === 'admin' && !hiddenTabs.includes('leave_settings') && (
                  <button
                    onClick={() => { onChutiTabChange('leave_settings'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Leave Settings' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'leave_settings'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Leave Settings</span>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Workspace 2: Quotes & Sales Tracker */}
        {canAccessModule(profile, null, 'quotes') && (
          <div className="space-y-1">
            <button
              onClick={handleQuotesClick}
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

            {/* Embedded Quotes sub-tabs when quotes section is active */}
            {activeSection === 'quotes' && isQuotesExpanded && onQuotesTabChange && activeQuotesTab && (
              <div className={`pt-2 space-y-1 ${isSidebarCollapsed ? 'flex flex-col items-center' : 'pl-4 border-l border-theme-border-input/80 ml-6'}`}>
                {/* 1. Daily Entry */}
                <button
                  onClick={() => { onQuotesTabChange('entry'); onNavItemClick?.(); }}
                  title={isSidebarCollapsed ? 'Daily Entry' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'entry'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Daily Entry</span>}
                </button>

                {/* Copy Helper (Superadmin only) */}
                {isSuperAdmin && !hiddenTabs.includes('copy_helper') && (
                  <button
                    onClick={() => { onQuotesTabChange?.('copy_helper'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Copy Helper' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'copy_helper'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <ScrollText className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Copy Helper</span>}
                  </button>
                )}

                {/* Save File (Superadmin only) */}
                {isSuperAdmin && !hiddenTabs.includes('save_file') && (
                  <button
                    onClick={() => { onQuotesTabChange?.('save_file'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Save File' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'save_file'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Save File</span>}
                  </button>
                )}

                {/* 2. Monthly List */}
                {!hiddenTabs.includes('monthly') && (
                  <button
                    onClick={() => { onQuotesTabChange('monthly'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Monthly List' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'monthly'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <ScrollText className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Monthly List</span>}
                  </button>
                )}



                {/* 4. Quote Rules */}
                {!hiddenTabs.includes('rules') && (
                  <button
                    onClick={() => { onQuotesTabChange('rules'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Quote Rules' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'rules'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Quote Rules</span>}
                  </button>
                )}

                {/* 5. IP Checker */}
                {!hiddenTabs.includes('ip_checker') && (
                  <button
                    onClick={() => { onQuotesTabChange('ip_checker'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'IP Checker' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'ip_checker'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">IP Checker</span>}
                  </button>
                )}

                {/* 6. Login Codes */}
                {!hiddenTabs.includes('login_codes') && (
                  <button
                    onClick={() => { onQuotesTabChange('login_codes'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Login Codes' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'login_codes'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <Key className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Login Codes</span>}
                  </button>
                )}

                {/* 7. Causality (Asitis + EUI) */}
                {!hiddenTabs.includes('causality') && (
                  <button
                    onClick={() => { onQuotesTabChange('causality'); onNavItemClick?.(); }}
                    title={isSidebarCollapsed ? 'Causality' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'causality'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-theme-text-secondary hover:bg-theme-border-active/60 hover:text-theme-text-inverse'
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Causality</span>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Workspace: KPI & Performance */}
        {canAccessModule(profile, null, 'kpi') && !hiddenTabs.includes('kpi') && (
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
        {canAccessModule(profile, null, 'todo') && !hiddenTabs.includes('todo') && (
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
        {canAccessModule(profile, null, 'leaderboard') && !hiddenTabs.includes('leaderboard') && (
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
        {canAccessModule(profile, null, 'audit_logs') && !hiddenTabs.includes('audit_logs') && (
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
        {canAccessModule(profile, null, 'profile_settings') && !hiddenTabs.includes('profile_settings') && (
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
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Profile Settings</span>}
            </button>
          </div>
        )}

        {/* Workspace 3: User Management (Admin & Supervisor Only) */}
        {canAccessModule(profile, null, 'user_management') && !hiddenTabs.includes('user_management') && (
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
