'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Profile } from '@/types';
import {
  PanelLeftOpen,
  PanelLeftClose,
  Calendar,
  FileText,
  Clock,
  BookOpen,
  TrendingUp,
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
  activeSection: 'chuti' | 'quotes' | 'user_management' | 'todo' | 'analytics' | 'audit_logs' | 'kpi';
  profile: Profile | null;
  activeQuotesTab?: 'entry' | 'monthly' | 'analytics' | 'audit_logs' | 'rules' | 'ip_checker' | 'login_codes' | 'asitis_causality' | 'eui_causality' | 'copy_helper' | 'save_file';
  onQuotesTabChange?: (tab: 'entry' | 'monthly' | 'analytics' | 'audit_logs' | 'rules' | 'ip_checker' | 'login_codes' | 'asitis_causality' | 'eui_causality' | 'copy_helper' | 'save_file') => void;
  activeChutiTab?: 'add_leave' | 'leave_history' | 'govt_responses' | 'settlement' | 'leave_settings' | 'team_leaves';
  onChutiTabChange?: (tab: 'add_leave' | 'leave_history' | 'govt_responses' | 'settlement' | 'leave_settings' | 'team_leaves') => void;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
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

  const hasChutiAccess = !!profile.has_chuti_access;
  const hasQuotesAccess = !!profile.has_quotes_access;
  const isSuperAdmin = profile.codename?.toUpperCase() === 'KAMRUL' || profile.full_name === 'Kamrul Islam';
  const showTodoTab = profile.username?.toUpperCase() === 'KAMRUL' || profile.full_name === 'Kamrul Islam';

  // Navigation handlers
  const handleChutiNav = () => {
    localStorage.setItem('last_active_dashboard', 'chuti');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'chuti' }));
    router.push('/');
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
  };

  const handleUserManagementNav = () => {
    localStorage.setItem('last_active_dashboard', 'user_management');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'user_management' }));
    router.push('/');
  };

  const handleTodoNav = () => {
    localStorage.setItem('last_active_dashboard', 'todo');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'todo' }));
    router.push('/');
  };

  const handleAnalyticsNav = () => {
    localStorage.setItem('last_active_dashboard', 'analytics');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'analytics' }));
    router.push('/');
  };

  const handleAuditLogsNav = () => {
    localStorage.setItem('last_active_dashboard', 'audit_logs');
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: 'audit_logs' }));
    router.push('/');
  };

  return (
    <aside
      className={`shrink-0 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl select-none transition-all duration-300 ease-out ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sidebar Header / Toggle Button */}
      <div className={`flex items-center mb-5 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isSidebarCollapsed && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Workspaces
          </span>
        )}
        <button
          type="button"
          onClick={onSidebarToggle}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-955/60 text-slate-400 hover:text-white hover:bg-slate-850 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Main Workspace Tabs */}
      <div className="space-y-4">
        {/* Workspace 1: Chuti Leave Tracker */}
        {hasChutiAccess && (
          <div className="space-y-1">
            <button
              onClick={handleChutiClick}
              title={isSidebarCollapsed ? 'Leave Tracker' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'chuti'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-950/5'
                  : 'text-slate-400 hover:bg-slate-850/80 hover:text-white border border-transparent'
              }`}
            >
              <Calendar className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Leave Tracker</span>}
            </button>

            {/* Embedded Chuti sub-tabs when chuti section is active */}
            {activeSection === 'chuti' && isChutiExpanded && onChutiTabChange && activeChutiTab && (
              <div className={`pt-2 space-y-1 ${isSidebarCollapsed ? 'flex flex-col items-center' : 'pl-4 border-l border-slate-800/80 ml-6'}`}>
                {/* 1. Add Leave */}
                <button
                  onClick={() => onChutiTabChange('add_leave')}
                  title={isSidebarCollapsed ? 'Add Leave' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeChutiTab === 'add_leave'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Add Leave</span>}
                </button>


                {/* 3. Leave History (All Users) */}
                <button
                  onClick={() => onChutiTabChange('leave_history')}
                  title={isSidebarCollapsed ? 'Leave History' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeChutiTab === 'leave_history'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <History className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Leave History</span>}
                </button>

                {/* Team Leave Records (Admin and Supervisor Only) */}
                {(profile?.role === 'admin' || profile?.role === 'supervisor') && (
                  <button
                    onClick={() => onChutiTabChange('team_leaves')}
                    title={isSidebarCollapsed ? 'Team Leave Records' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'team_leaves'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                    }`}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Team Leave Records</span>}
                  </button>
                )}

                {/* 3. Govt Holiday Response (Admin Only) */}
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => onChutiTabChange('govt_responses')}
                    title={isSidebarCollapsed ? 'Govt Holiday Response' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'govt_responses'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                    }`}
                  >
                    <Calendar className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Govt Holiday Response</span>}
                  </button>
                )}

                {/* 4. Review & Settlements (Admin Only) */}
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => onChutiTabChange('settlement')}
                    title={isSidebarCollapsed ? 'Review & Settlements' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'settlement'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                    }`}
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Review & Settlements</span>}
                  </button>
                )}

                {/* 5. Leave Settings (Admin Only) */}
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => onChutiTabChange('leave_settings')}
                    title={isSidebarCollapsed ? 'Leave Settings' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeChutiTab === 'leave_settings'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
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
        {hasQuotesAccess && (
          <div className="space-y-1">
            <button
              onClick={handleQuotesClick}
              title={isSidebarCollapsed ? 'Quotes Tracker' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'quotes'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                  : 'text-slate-400 hover:bg-slate-850/80 hover:text-white border border-transparent'
              }`}
            >
              <FileText className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Quotes Tracker</span>}
            </button>

            {/* Embedded Quotes sub-tabs when quotes section is active */}
            {activeSection === 'quotes' && isQuotesExpanded && onQuotesTabChange && activeQuotesTab && (
              <div className={`pt-2 space-y-1 ${isSidebarCollapsed ? 'flex flex-col items-center' : 'pl-4 border-l border-slate-800/80 ml-6'}`}>
                {/* 1. Daily Entry */}
                <button
                  onClick={() => onQuotesTabChange('entry')}
                  title={isSidebarCollapsed ? 'Daily Entry' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'entry'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Daily Entry</span>}
                </button>

                {/* 2. Monthly List */}
                <button
                  onClick={() => onQuotesTabChange('monthly')}
                  title={isSidebarCollapsed ? 'Monthly List' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'monthly'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <ScrollText className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Monthly List</span>}
                </button>



                {/* 4. Quote Rules */}
                <button
                  onClick={() => onQuotesTabChange('rules')}
                  title={isSidebarCollapsed ? 'Quote Rules' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'rules'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Quote Rules</span>}
                </button>

                {/* 5. IP Checker */}
                <button
                  onClick={() => onQuotesTabChange('ip_checker')}
                  title={isSidebarCollapsed ? 'IP Checker' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'ip_checker'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">IP Checker</span>}
                </button>

                {/* 6. Login Codes */}
                <button
                  onClick={() => onQuotesTabChange('login_codes')}
                  title={isSidebarCollapsed ? 'Login Codes' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'login_codes'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <Key className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Login Codes</span>}
                </button>

                {/* 7. Asitis Causality */}
                <button
                  onClick={() => onQuotesTabChange('asitis_causality')}
                  title={isSidebarCollapsed ? 'Asitis Causality' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'asitis_causality'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Asitis Causality</span>}
                </button>

                {/* 8. EUI Causality */}
                <button
                  onClick={() => onQuotesTabChange('eui_causality')}
                  title={isSidebarCollapsed ? 'EUI Causality' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'eui_causality'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">EUI Causality</span>}
                </button>

                {/* 9. Copy Helper (Superadmin only) */}
                {isSuperAdmin && (
                  <button
                    onClick={() => onQuotesTabChange?.('copy_helper')}
                    title={isSidebarCollapsed ? 'Copy Helper' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'copy_helper'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                    }`}
                  >
                    <ScrollText className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Copy Helper</span>}
                  </button>
                )}

                {/* 10. Save File (Superadmin only) */}
                {isSuperAdmin && (
                  <button
                    onClick={() => onQuotesTabChange?.('save_file')}
                    title={isSidebarCollapsed ? 'Save File' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'save_file'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                    }`}
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Save File</span>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Workspace: KPI & Performance */}
        <div className="space-y-1">
          <button
            onClick={handleKpiNav}
            title={isSidebarCollapsed ? 'KPI & Performance' : undefined}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
            } ${
              activeSection === 'kpi'
                ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                : 'text-slate-400 hover:bg-slate-850/80 hover:text-white border border-transparent'
            }`}
          >
            <BarChart2 className="h-5 w-5 shrink-0" />
            {!isSidebarCollapsed && <span className="whitespace-nowrap">KPI & Performance</span>}
          </button>
        </div>

        {/* Workspace: Todos (Only for superadmin Kamrul) */}
        {showTodoTab && (
          <div className="space-y-1">
            <button
              onClick={handleTodoNav}
              title={isSidebarCollapsed ? 'Todos' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'todo'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-950/5'
                  : 'text-slate-400 hover:bg-slate-850/80 hover:text-white border border-transparent'
              }`}
            >
              <ListTodo className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Todos</span>}
            </button>
          </div>
        )}

        {/* Workspace: Analytics (Admin & Supervisor Only) */}
        {(profile.role === 'admin' || profile.role === 'supervisor') && (
          <div className="space-y-1">
            <button
              onClick={handleAnalyticsNav}
              title={isSidebarCollapsed ? 'Analytics' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'analytics'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                  : 'text-slate-400 hover:bg-slate-850/80 hover:text-white border border-transparent'
              }`}
            >
              <TrendingUp className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Analytics</span>}
            </button>
          </div>
        )}

        {/* Workspace: Audit Logs (Admin & Supervisor Only) */}
        {(profile.role === 'admin' || profile.role === 'supervisor') && (
          <div className="space-y-1">
            <button
              onClick={handleAuditLogsNav}
              title={isSidebarCollapsed ? 'Audit Logs' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'audit_logs'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-md shadow-blue-900/5'
                  : 'text-slate-400 hover:bg-slate-850/80 hover:text-white border border-transparent'
              }`}
            >
              <ScrollText className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Audit Logs</span>}
            </button>
          </div>
        )}

        {/* Workspace 3: User Management (Admin & Supervisor Only) */}
        {(profile.role === 'admin' || profile.role === 'supervisor') && (
          <div className="space-y-1">
            <button
              onClick={handleUserManagementNav}
              title={isSidebarCollapsed ? 'User Management' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'user_management'
                  ? 'bg-purple-600/15 border border-purple-500/30 text-purple-400 shadow-md shadow-purple-900/5'
                  : 'text-slate-400 hover:bg-slate-850/80 hover:text-white border border-transparent'
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
