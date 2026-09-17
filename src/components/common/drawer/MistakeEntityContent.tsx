'use client';

import React from 'react';
import {
  AlertTriangle,
  Building2,
  User,
  Calendar,
  FileCode,
  ExternalLink,
  ChevronRight,
  Gavel,
  FileSpreadsheet,
  Copy,
  Check,
} from 'lucide-react';
import { Profile } from '@/types';
import { MistakeEntityDetails, EntityDrawerRequest } from '@/types/entityDrawer';
import { toast } from 'sonner';

interface MistakeEntityContentProps {
  details: MistakeEntityDetails;
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

export const MistakeEntityContent: React.FC<MistakeEntityContentProps> = ({
  details,
  viewerProfile: _viewerProfile,
  onClose,
  onNavigateAction,
  onOpenChildDrawer,
}) => {
  const { mistake, submitterProfile, matchingRecord } = details;
  const [copied, setCopied] = React.useState(false);

  const handleCopyName = () => {
    navigator.clipboard.writeText(mistake.filename);
    setCopied(true);
    toast.success('Copied filename to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Header Banner */}
      <div className="p-4 bg-linear-to-br from-rose-950/40 via-theme-card-bg to-theme-page-bg/80 border border-rose-500/30 rounded-2xl shadow-md space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider block">
                Quotation Mistake Record
              </span>
              <h3 className="text-sm font-mono font-bold text-theme-text-primary break-all select-all">
                {mistake.filename}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyName}
            className="p-2 rounded-xl bg-theme-page-bg border border-theme-border-input hover:border-theme-border-active text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer shrink-0"
            title="Copy filename"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-theme-border-input/40">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Gavel className="w-3 h-3" />
            Penalty: {mistake.penalty || 'Recorded'}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Building2 className="w-3 h-3" />
            {mistake.branch}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold text-theme-text-muted bg-theme-page-bg border border-theme-border-input">
            <Calendar className="w-3 h-3 text-blue-400" />
            {mistake.date}
          </span>
        </div>
      </div>

      {/* 2. Submitter Info */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-amber-400" />
          Responsible User
        </h4>

        <div
          onClick={() => {
            if (submitterProfile) {
              onOpenChildDrawer({ type: 'user', profile: submitterProfile, sourceContext: 'mistake' });
            } else if (mistake.codename) {
              onOpenChildDrawer({ type: 'user', username: mistake.codename, sourceContext: 'mistake' });
            }
          }}
          className="p-3 bg-theme-page-bg/60 hover:bg-theme-card-bg border border-theme-border-input/60 hover:border-theme-border-active rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 font-bold">
              {mistake.codename?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <span className="font-mono font-bold text-blue-400 block group-hover:text-blue-300 transition-colors">
                {mistake.codename?.toUpperCase()}
              </span>
              <span className="text-[11px] text-theme-text-muted">
                {submitterProfile?.full_name || 'Staff Member'}
              </span>
            </div>
          </div>

          <span className="text-[11px] font-semibold text-theme-text-muted group-hover:text-theme-text-primary flex items-center gap-1 transition-colors">
            View user <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* 3. Mistake Details & Comment */}
      <div className="p-4 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl space-y-2.5 text-xs">
        <h4 className="text-[11px] uppercase font-bold tracking-wider text-theme-text-muted flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5 text-rose-400" />
          Mistake Details & Description
        </h4>

        <div className="p-3 bg-theme-card-bg/60 border border-theme-border-input/50 rounded-lg text-theme-text-secondary leading-relaxed text-xs">
          {mistake.mistake_details || 'No additional mistake details recorded.'}
        </div>
      </div>

      {/* 4. Related Quotation Submission Check */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
          Corresponding Quotation Entry
        </h4>

        {matchingRecord ? (
          <div
            onClick={() => onOpenChildDrawer({ type: 'quotation', record: matchingRecord })}
            className="p-3 bg-theme-page-bg/60 hover:bg-theme-card-bg border border-theme-border-input/60 hover:border-purple-500/40 rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs group"
          >
            <div>
              <div className="font-mono font-semibold text-theme-text-primary group-hover:text-purple-400 transition-colors">
                {matchingRecord.file_name}
              </div>
              <div className="text-[10px] text-theme-text-muted flex items-center gap-2 mt-0.5">
                <span>{matchingRecord.branch_name}</span>
                <span>•</span>
                <span>Type: {matchingRecord.file_type}</span>
              </div>
            </div>

            <span className="text-[11px] font-semibold text-purple-400 flex items-center gap-1 shrink-0">
              Inspect quote <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        ) : (
          <div className="p-3 bg-theme-page-bg/40 border border-theme-border-input/40 rounded-xl text-xs text-theme-text-muted">
            Original quotation submission record not located in database.
          </div>
        )}
      </div>

      {/* 5. Action Bar */}
      <div className="pt-3 border-t border-theme-border-input/80 flex flex-wrap gap-2">
        <button
          onClick={() => {
            onClose();
            onNavigateAction({
              tab: 'quotes',
              subtab: 'quotation_mistakes',
              search: mistake.filename,
            });
          }}
          className="flex-1 min-w-[140px] py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Mistakes Tab
        </button>

        {submitterProfile && (
          <button
            onClick={() => {
              onClose();
              onNavigateAction({
                tab: 'user_management',
                subtab: 'quotes',
                userId: submitterProfile.id,
              });
            }}
            className="flex-1 min-w-[140px] py-2 px-3 bg-theme-card-bg hover:bg-theme-border-input border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <User className="w-3.5 h-3.5 text-amber-400" />
            User History
          </button>
        )}
      </div>
    </div>
  );
};
