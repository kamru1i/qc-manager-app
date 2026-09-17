'use client';

import React from 'react';
import {
  User,
  Building2,
  Briefcase,
  Shield,
  FileSpreadsheet,
  AlertTriangle,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Award,
  CheckCircle2,
} from 'lucide-react';
import { Profile } from '@/types';
import { UserEntityDetails, EntityDrawerRequest } from '@/types/entityDrawer';
import { isAdminRole, isSuperadmin, canAccessModule } from '@/utils/permissionService';
import { formatBusinessDate, formatBusinessTime } from '@/utils/businessDateTime';

interface UserEntityContentProps {
  details: UserEntityDetails;
  viewerProfile: Profile | null;
  onClose: () => void;
  onNavigateAction: (action: {
    tab: string;
    subtab?: string;
    search?: string;
    userId?: string;
  }) => void;
  onOpenChildDrawer: (req: EntityDrawerRequest) => void;
}

export const UserEntityContent: React.FC<UserEntityContentProps> = ({
  details,
  viewerProfile,
  onClose,
  onNavigateAction,
  onOpenChildDrawer,
}) => {
  const {
    profile,
    supervisorName,
    recentRecords,
    recentMistakes,
    recentLeaves,
    todaySubmissionsCount,
    monthSubmissionsCount,
    conversionRate,
    totalMistakesCount,
    leaveSummary,
  } = details;

  const isSelf = viewerProfile?.id === profile.id;
  const isViewerAdmin = isAdminRole(viewerProfile);
  const isViewerSupervisor = viewerProfile?.role === 'supervisor';
  const hasSupervisorAccess =
    isViewerAdmin ||
    isSelf ||
    (isViewerSupervisor && profile.supervisor_ids?.includes(viewerProfile?.id || ''));

  const canViewProfile = hasSupervisorAccess;
  const canViewLeaveHistory = hasSupervisorAccess;
  const canViewQuotations = canAccessModule(viewerProfile, null, 'quotes');
  const canViewMistakes = canAccessModule(viewerProfile, null, 'quotes');
  const canViewKpi = canAccessModule(viewerProfile, null, 'leaderboard') || isViewerAdmin;

  const roleColor =
    profile.role === 'superadmin'
      ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
      : profile.role === 'admin'
      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      : profile.role === 'supervisor'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : 'bg-slate-500/10 text-slate-400 border-slate-500/30';

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Header Profile Banner */}
      <div className="p-4 bg-linear-to-br from-theme-card-bg/90 to-theme-page-bg/80 border border-theme-border-input/80 rounded-2xl shadow-md">
        <div className="flex items-start gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-500/20 shrink-0">
            {profile.full_name?.charAt(0).toUpperCase() || profile.username?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-theme-text-primary truncate">
              {profile.full_name || profile.username}
            </h3>
            
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {/* Codename Chip */}
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-theme-page-bg border border-theme-border-input text-blue-400 select-all">
                {profile.username?.toUpperCase() || '-'}
              </span>

              {/* Role Badge */}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${roleColor}`}>
                {profile.role}
              </span>

              {/* Job Role */}
              {profile.job_role && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Building2 className="w-3 h-3" />
                  {profile.job_role}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-theme-page-bg/70 border border-theme-border-input/60 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider">Today</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-theme-text-primary">{todaySubmissionsCount}</span>
            <span className="text-[10px] text-theme-text-muted">files</span>
          </div>
        </div>

        <div className="p-3 bg-theme-page-bg/70 border border-theme-border-input/60 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider">Month</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-blue-400">{monthSubmissionsCount}</span>
            <span className="text-[10px] text-theme-text-muted">files</span>
          </div>
        </div>

        <div className="p-3 bg-theme-page-bg/70 border border-theme-border-input/60 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider">Conv. Rate</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-400">{conversionRate}%</span>
          </div>
        </div>
      </div>

      {/* 3. Organization & Workspaces Status */}
      <div className="p-3.5 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl space-y-2.5 text-xs">
        <h4 className="text-[11px] uppercase font-bold tracking-wider text-theme-text-muted flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-blue-400" />
          Employment & Access
        </h4>
        
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          <div>
            <span className="text-theme-text-muted block">Job Role</span>
            <span className="font-semibold text-theme-text-primary">{profile.job_role || 'General Staff'}</span>
          </div>
          <div>
            <span className="text-theme-text-muted block">Supervisor</span>
            <span className="font-semibold text-theme-text-primary">{supervisorName || 'Unassigned'}</span>
          </div>
          <div>
            <span className="text-theme-text-muted block">Quotes Workspace</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${profile.has_quotes_access !== false ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${profile.has_quotes_access !== false ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {profile.has_quotes_access !== false ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div>
            <span className="text-theme-text-muted block">Leave Quota</span>
            <span className={`inline-flex items-center gap-1 font-semibold ${profile.eligible_office_leave !== false ? 'text-emerald-400' : 'text-slate-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${profile.eligible_office_leave !== false ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              {profile.eligible_office_leave !== false ? 'Eligible' : 'Not Eligible'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Recent Quotation Submissions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
            Recent Quotations
          </h4>
          {canViewQuotations && (
            <button
              onClick={() => {
                onClose();
                onNavigateAction({
                  tab: 'quotes',
                  subtab: 'entry',
                  search: profile.username || '',
                });
              }}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {recentRecords.length === 0 ? (
          <div className="p-3 text-center text-xs text-theme-text-muted bg-theme-page-bg/40 border border-theme-border-input/40 rounded-xl">
            No recent quotation submissions found.
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentRecords.map((r) => (
              <div
                key={r.id}
                onClick={() => onOpenChildDrawer({ type: 'quotation', record: r })}
                className="p-2.5 bg-theme-page-bg/60 hover:bg-theme-card-bg border border-theme-border-input/60 hover:border-theme-border-active rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 text-xs group"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-theme-text-primary truncate font-mono group-hover:text-blue-400 transition-colors">
                    {r.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, '')}
                  </div>
                  <div className="text-[10px] text-theme-text-muted flex items-center gap-2 mt-0.5">
                    <span>{formatBusinessDate(r.submitted_at)}</span>
                    <span>•</span>
                    <span>{formatBusinessTime(r.submitted_at)}</span>
                    <span>•</span>
                    <span className="text-theme-text-secondary">{r.branch_name}</span>
                  </div>
                </div>

                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-theme-card-bg border border-theme-border-input text-theme-text-secondary shrink-0">
                  {r.file_type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Recent Mistakes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Quotation Quality & Mistakes
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20 font-bold">
              {totalMistakesCount}
            </span>
          </h4>
          {canViewMistakes && (
            <button
              onClick={() => {
                onClose();
                onNavigateAction({
                  tab: 'quotes',
                  subtab: 'quotation_mistakes',
                  search: profile.username || '',
                });
              }}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {recentMistakes.length === 0 ? (
          <div className="p-3 text-center text-xs text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Clean track record — zero recent mistakes</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentMistakes.map((m) => (
              <div
                key={m.id}
                onClick={() => onOpenChildDrawer({ type: 'mistake', mistake: m })}
                className="p-2.5 bg-theme-page-bg/60 hover:bg-theme-card-bg border border-theme-border-input/60 hover:border-rose-500/30 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 text-xs group"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-theme-text-primary truncate group-hover:text-rose-400 transition-colors">
                    {m.filename}
                  </div>
                  <div className="text-[10px] text-theme-text-muted flex items-center gap-2 mt-0.5">
                    <span>{m.date}</span>
                    <span>•</span>
                    <span className="text-theme-text-secondary">{m.branch}</span>
                    {m.mistake_details && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[140px]">{m.mistake_details}</span>
                      </>
                    )}
                  </div>
                </div>

                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                  {m.penalty || 'Logged'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Leave Summary & Recent Leaves */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            Leave Activity
          </h4>
          {canViewLeaveHistory && (
            <button
              onClick={() => {
                onClose();
                onNavigateAction({
                  tab: 'chuti',
                  subtab: 'leave_history',
                  search: profile.username || profile.full_name || '',
                  userId: profile.id,
                });
              }}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 cursor-pointer"
            >
              Leave history <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Compact Leave Tally */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-theme-page-bg/60 border border-theme-border-input/50 rounded-lg">
            <span className="text-[10px] text-theme-text-muted block">Office Leaves</span>
            <span className="font-bold text-theme-text-primary mt-0.5 block">{leaveSummary.officeLeavesTaken}</span>
          </div>
          <div className="p-2 bg-theme-page-bg/60 border border-theme-border-input/50 rounded-lg">
            <span className="text-[10px] text-theme-text-muted block">Short Leave</span>
            <span className="font-bold text-theme-text-primary mt-0.5 block">{leaveSummary.shortLeaveHours}</span>
          </div>
          <div className="p-2 bg-theme-page-bg/60 border border-theme-border-input/50 rounded-lg">
            <span className="text-[10px] text-theme-text-muted block">Overtime</span>
            <span className="font-bold text-emerald-400 mt-0.5 block">{leaveSummary.overtimeHours}</span>
          </div>
        </div>

        {recentLeaves.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {recentLeaves.map((l) => (
              <div
                key={l.id}
                onClick={() => onOpenChildDrawer({ type: 'leave', leaveRecord: l })}
                className="p-2 bg-theme-page-bg/40 hover:bg-theme-card-bg border border-theme-border-input/40 rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs group"
              >
                <div className="min-w-0">
                  <span className="font-medium text-theme-text-primary group-hover:text-blue-400 transition-colors">
                    {l.date}
                  </span>
                  <span className="text-[11px] text-theme-text-muted ml-2">
                    {l.leave_type} ({l.leave_hour || 'Full Day'})
                  </span>
                </div>

                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    l.status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : l.status === 'rejected'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. Action Bar */}
      <div className="pt-3 border-t border-theme-border-input/80 flex flex-wrap gap-2">
        {canViewProfile && (
          <button
            onClick={() => {
              onClose();
              onNavigateAction({
                tab: 'user_management',
                subtab: 'profile',
                userId: profile.id,
              });
            }}
            className="flex-1 min-w-[120px] py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            Full Profile
          </button>
        )}

        {canViewLeaveHistory && (
          <button
            onClick={() => {
              onClose();
              onNavigateAction({
                tab: 'chuti',
                subtab: 'leave_history',
                search: profile.username || profile.full_name || '',
              });
            }}
            className="flex-1 min-w-[120px] py-2 px-3 bg-theme-card-bg hover:bg-theme-border-input border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Open Leave Tracker with employee filter"
          >
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            Leave History
          </button>
        )}

        {canViewQuotations && (
          <button
            onClick={() => {
              onClose();
              onNavigateAction({
                tab: 'quotes',
                subtab: 'entry',
                search: profile.username || '',
              });
            }}
            className="flex-1 min-w-[100px] py-2 px-3 bg-theme-card-bg hover:bg-theme-border-input border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
            Quotations
          </button>
        )}

        {canViewKpi && (
          <button
            onClick={() => {
              onClose();
              onNavigateAction({
                tab: 'leaderboard',
                subtab: 'kpi',
                userId: profile.id,
              });
            }}
            className="flex-1 min-w-[100px] py-2 px-3 bg-theme-card-bg hover:bg-theme-border-input border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            KPI Report
          </button>
        )}
      </div>
    </div>
  );
};
