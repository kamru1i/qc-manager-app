'use client';

import React from 'react';
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
  ListTodo
} from 'lucide-react';

interface UnifiedSidebarProps {
  activeSection: 'chuti' | 'quotes';
  profile: Profile | null;
  activeQuotesTab?: 'entry' | 'monthly' | 'users' | 'analytics' | 'audit_logs' | 'rules' | 'todo';
  onQuotesTabChange?: (tab: 'entry' | 'monthly' | 'users' | 'analytics' | 'audit_logs' | 'rules' | 'todo') => void;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
}

export const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({
  activeSection,
  profile,
  activeQuotesTab,
  onQuotesTabChange,
  isSidebarCollapsed,
  onSidebarToggle,
}) => {
  const router = useRouter();

  if (!profile) return null;

  const hasChutiAccess = !!profile.has_chuti_access;
  const hasQuotesAccess = !!profile.has_quotes_access;

  // Navigation handlers
  const handleChutiNav = () => {
    localStorage.setItem('last_active_dashboard', 'chuti');
    router.push('/chuti');
  };

  const handleQuotesNav = () => {
    localStorage.setItem('last_active_dashboard', 'quotes');
    router.push('/quotes');
  };

  // Quotes admin role helper (supervisors and admins both access Quotes admin panel)
  const isQuotesAdmin = profile.role === 'admin' || profile.role === 'supervisor';

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
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-850 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Main Workspace Tabs */}
      <div className="space-y-4">
        {/* Workspace 1: Chuti Leave Tracker */}
        {hasChutiAccess && (
          <div>
            <button
              onClick={handleChutiNav}
              title={isSidebarCollapsed ? 'Leave Tracker' : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isSidebarCollapsed ? 'justify-center p-3' : 'justify-start px-4 py-3 gap-3'
              } ${
                activeSection === 'chuti'
                  ? 'bg-orange-600/15 border border-orange-500/30 text-orange-400 shadow-md shadow-orange-950/5'
                  : 'text-slate-400 hover:bg-slate-850/80 hover:text-white border border-transparent'
              }`}
            >
              <Calendar className="h-5 w-5 shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Leave Tracker</span>}
            </button>
          </div>
        )}

        {/* Workspace 2: Quotes & Sales Tracker */}
        {hasQuotesAccess && (
          <div className="space-y-1">
            <button
              onClick={handleQuotesNav}
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
            {activeSection === 'quotes' && onQuotesTabChange && activeQuotesTab && (
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

                {/* 3. Todo Panel */}
                <button
                  onClick={() => onQuotesTabChange('todo')}
                  title={isSidebarCollapsed ? 'Todos' : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                  } ${
                    activeQuotesTab === 'todo'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                  }`}
                >
                  <ListTodo className="h-4 w-4 shrink-0" />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">Todos</span>}
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

                {/* 5. Analytics (Admin) */}
                {isQuotesAdmin && (
                  <button
                    onClick={() => onQuotesTabChange('analytics')}
                    title={isSidebarCollapsed ? 'Analytics' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'analytics'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Analytics</span>}
                  </button>
                )}

                {/* 6. User Management (Admin) */}
                {isQuotesAdmin && (
                  <button
                    onClick={() => onQuotesTabChange('users')}
                    title={isSidebarCollapsed ? 'User Management' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'users'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                    }`}
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Staff Admin</span>}
                  </button>
                )}

                {/* 7. Audit Logs (Admin) */}
                {isQuotesAdmin && (
                  <button
                    onClick={() => onQuotesTabChange('audit_logs')}
                    title={isSidebarCollapsed ? 'Audit Logs' : undefined}
                    className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2 gap-2.5'
                    } ${
                      activeQuotesTab === 'audit_logs'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-850/60 hover:text-white'
                    }`}
                  >
                    <ScrollText className="h-4 w-4 shrink-0" />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">Audit Logs</span>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
