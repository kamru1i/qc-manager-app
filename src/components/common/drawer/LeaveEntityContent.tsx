'use client';

import React from 'react';
import {
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Building2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Profile } from '@/types';
import { LeaveEntityDetails, EntityDrawerRequest } from '@/types/entityDrawer';
import { isAdminRole } from '@/utils/permissionService';
import { getRecordAdjustmentEntries, getRecordAdjustedMinutes, getRecordRemainingMinutes } from '@/utils/leaveCalculations';

interface LeaveEntityContentProps {
  details: LeaveEntityDetails;
  viewerProfile: Profile | null;
  onClose: () => void;
  onNavigateAction: (action: {
    tab: string;
    subtab?: string;
    search?: string;
    userId?: string;
    date?: string;
  }) => void;
  onOpenChildDrawer: (req: EntityDrawerRequest) => void;
}

export const LeaveEntityContent: React.FC<LeaveEntityContentProps> = ({
  details,
  viewerProfile,
  onClose,
  onNavigateAction,
  onOpenChildDrawer,
}) => {
  const { leave, employeeProfile } = details;

  const isSelf = viewerProfile?.id === leave.user_id;
  const isViewerAdmin = isAdminRole(viewerProfile);
  const isViewerSupervisor = viewerProfile?.role === 'supervisor';
  const isSupervisedByMe =
    isViewerSupervisor &&
    employeeProfile?.supervisor_ids?.includes(viewerProfile?.id || '');

  // Privileged adjustment data is only exposed to Admin, Direct Supervisor, or Self
  const canViewAdjustments = isViewerAdmin || isSelf || isSupervisedByMe;
  const canViewLeaveHistory = canViewAdjustments;

  const adjustmentEntries = canViewAdjustments ? getRecordAdjustmentEntries(leave) : [];
  const adjustedMins = canViewAdjustments ? getRecordAdjustedMinutes(leave) : 0;
  const remainingMins = canViewAdjustments ? getRecordRemainingMinutes(leave) : 0;

  const statusColor =
    leave.status === 'approved'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : leave.status === 'rejected'
      ? 'bg-red-500/15 text-red-400 border-red-500/30'
      : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

  const typeColor =
    leave.leave_type === 'Full Leave'
      ? 'bg-red-500/10 text-red-400 border-red-500/25'
      : leave.leave_type === 'Overtime'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
      : 'bg-sky-500/10 text-sky-400 border-sky-500/25';

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Header Banner */}
      <div className="p-4 bg-linear-to-br from-theme-card-bg/90 to-theme-page-bg/80 border border-theme-border-input/80 rounded-2xl shadow-md space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider block">
                Leave Request Record
              </span>
              <h3 className="text-sm font-bold text-theme-text-primary">
                {leave.leave_type} on {leave.date}
              </h3>
            </div>
          </div>

          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border shrink-0 ${statusColor}`}>
            {leave.status}
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-theme-border-input/40">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${typeColor}`}>
            {leave.leave_type}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold text-theme-text-primary bg-theme-page-bg border border-theme-border-input">
            <Clock className="w-3 h-3 text-sky-400" />
            Duration: {leave.leave_hour || 'Full Day'}
          </span>
        </div>
      </div>

      {/* 2. Employee Profile Link */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-amber-400" />
          Employee Details
        </h4>

        <div
          onClick={() => {
            if (employeeProfile) {
              onOpenChildDrawer({ type: 'user', profile: employeeProfile });
            } else if (leave.user_id) {
              onOpenChildDrawer({ type: 'user', userId: leave.user_id });
            }
          }}
          className="p-3 bg-theme-page-bg/60 hover:bg-theme-card-bg border border-theme-border-input/60 hover:border-theme-border-active rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 font-bold">
              {employeeProfile?.full_name?.charAt(0).toUpperCase() || 'E'}
            </div>
            <div>
              <span className="font-semibold text-theme-text-primary group-hover:text-blue-400 transition-colors block">
                {employeeProfile?.full_name || employeeProfile?.username || 'Employee'}
              </span>
              <span className="text-[11px] font-mono text-blue-400">
                {employeeProfile?.username?.toUpperCase() || '-'}
              </span>
            </div>
          </div>

          <span className="text-[11px] font-semibold text-theme-text-muted group-hover:text-theme-text-primary flex items-center gap-1 transition-colors">
            View employee <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* 3. Shift and Timing Details */}
      <div className="p-4 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl space-y-3 text-xs">
        <h4 className="text-[11px] uppercase font-bold tracking-wider text-theme-text-muted flex items-center gap-1.5">
          <Clock3 className="w-3.5 h-3.5 text-sky-400" />
          Timing & Schedule
        </h4>

        <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
          <div>
            <span className="text-theme-text-muted block">Shift Start</span>
            <span className="font-semibold text-theme-text-primary mt-0.5 block">
              {employeeProfile?.default_sign_in || '13:00'}
            </span>
          </div>

          <div>
            <span className="text-theme-text-muted block">Shift End</span>
            <span className="font-semibold text-theme-text-primary mt-0.5 block">
              {employeeProfile?.default_sign_out || '22:30'}
            </span>
          </div>

          {(leave.sign_in_time || leave.sign_out_time) && (
            <>
              <div>
                <span className="text-theme-text-muted block">Record Sign-In</span>
                <span className="font-semibold text-theme-text-primary mt-0.5 block">
                  {leave.sign_in_time || '-'}
                </span>
              </div>

              <div>
                <span className="text-theme-text-muted block">Record Sign-Out</span>
                <span className="font-semibold text-theme-text-primary mt-0.5 block">
                  {leave.sign_out_time || '-'}
                </span>
              </div>
            </>
          )}
        </div>

        {leave.comment && (
          <div className="pt-2 border-t border-theme-border-input/40">
            <span className="text-theme-text-muted block text-[10px] uppercase font-bold tracking-wider">
              Reason / Comment
            </span>
            <p className="mt-1 text-theme-text-secondary leading-relaxed bg-theme-card-bg/50 p-2.5 rounded-lg border border-theme-border-input/40">
              {leave.comment}
            </p>
          </div>
        )}
      </div>

      {/* 4. Adjustment Summary (Role-Gated) */}
      {canViewAdjustments && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Adjustment & Settlement Details
          </h4>

          <div className="p-3 bg-theme-page-bg/60 border border-theme-border-input/60 rounded-xl space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-theme-text-muted block">Adjusted Time</span>
                <span className="font-bold text-emerald-400 mt-0.5 block">
                  {(adjustedMins / 60).toFixed(1)} hrs
                </span>
              </div>
              <div>
                <span className="text-theme-text-muted block">Remaining Unadjusted</span>
                <span className="font-bold text-amber-400 mt-0.5 block">
                  {(remainingMins / 60).toFixed(1)} hrs
                </span>
              </div>
            </div>

            {adjustmentEntries.length > 0 && (
              <div className="pt-2 border-t border-theme-border-input/40 space-y-1.5">
                <span className="text-[10px] text-theme-text-muted uppercase font-bold tracking-wider block">
                  Adjustment Log:
                </span>
                {adjustmentEntries.map((adj) => (
                  <div
                    key={adj.id}
                    className="p-2 bg-theme-card-bg/60 rounded-lg border border-theme-border-input/40 flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <span className="font-semibold text-theme-text-primary block">{adj.source}</span>
                      {adj.comment && (
                        <span className="text-[10px] text-theme-text-muted block">{adj.comment}</span>
                      )}
                    </div>
                    <span className="font-bold text-emerald-400 shrink-0">
                      {(adj.amount_minutes / 60).toFixed(1)}h
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Action Bar */}
      <div className="pt-3 border-t border-theme-border-input/80 flex flex-wrap gap-2">
        <button
          onClick={() => {
            onClose();
            onNavigateAction({
              tab: 'chuti',
              subtab: isViewerAdmin && leave.user_id !== viewerProfile?.id ? 'settlement' : 'leave_history',
              userId: leave.user_id,
              date: leave.date,
            });
          }}
          className="flex-1 min-w-[140px] py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Leave Tracker
        </button>

        {canViewLeaveHistory && employeeProfile && (
          <button
            onClick={() => {
              onClose();
              onNavigateAction({
                tab: 'user_management',
                subtab: 'leave',
                userId: employeeProfile.id,
              });
            }}
            className="flex-1 min-w-[140px] py-2 px-3 bg-theme-card-bg hover:bg-theme-border-input border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            Full Leave History
          </button>
        )}
      </div>
    </div>
  );
};
