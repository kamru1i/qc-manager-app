'use client';

import React from 'react';
import {
  FileSpreadsheet,
  Building2,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Tag,
  DollarSign,
  Copy,
  Check,
} from 'lucide-react';
import { Profile } from '@/types';
import { QuotationEntityDetails, EntityDrawerRequest } from '@/types/entityDrawer';
import { formatBusinessDate, formatBusinessTime } from '@/utils/businessDateTime';
import { toast } from 'sonner';

interface QuotationEntityContentProps {
  details: QuotationEntityDetails;
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

export const QuotationEntityContent: React.FC<QuotationEntityContentProps> = ({
  details,
  viewerProfile: _viewerProfile,
  onClose,
  onNavigateAction,
  onOpenChildDrawer,
}) => {
  const { record, submitterProfile, matchingMistake } = details;
  const [copied, setCopied] = React.useState(false);

  const cleanName = record.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, '').trim();
  const isSold = record.file_name.endsWith(' [SOLD]');
  const isUnsold = record.file_name.endsWith(' [UNSOLD]');
  const isSaleType = record.file_type === 'Sale';

  const handleCopyName = () => {
    navigator.clipboard.writeText(cleanName);
    setCopied(true);
    toast.success('Copied file name to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Header Filename Banner */}
      <div className="p-4 bg-linear-to-br from-theme-card-bg/90 to-theme-page-bg/80 border border-theme-border-input/80 rounded-2xl shadow-md space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider block">
                Quotation File
              </span>
              <h3 className="text-sm font-mono font-bold text-theme-text-primary break-all select-all">
                {cleanName}
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-theme-page-bg border border-theme-border-input text-theme-text-primary">
            {record.file_type}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Building2 className="w-3 h-3" />
            {record.branch_name}
          </span>

          {isSaleType && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold ${
                isSold
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : isUnsold
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
              }`}
            >
              <DollarSign className="w-3 h-3" />
              {isSold ? 'SOLD' : isUnsold ? 'UNSOLD' : 'Sale Submission'}
            </span>
          )}
        </div>
      </div>

      {/* 2. Quotation Metadata Details */}
      <div className="p-4 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl space-y-3 text-xs">
        <h4 className="text-[11px] uppercase font-bold tracking-wider text-theme-text-muted flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-blue-400" />
          Submission Details
        </h4>

        <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
          <div>
            <span className="text-theme-text-muted block">Date</span>
            <div className="flex items-center gap-1 font-semibold text-theme-text-primary mt-0.5">
              <Calendar className="w-3 h-3 text-blue-400" />
              <span>{formatBusinessDate(record.submitted_at)}</span>
            </div>
          </div>

          <div>
            <span className="text-theme-text-muted block">Submitted Time</span>
            <div className="flex items-center gap-1 font-semibold text-theme-text-primary mt-0.5">
              <Clock className="w-3 h-3 text-purple-400" />
              <span>{formatBusinessTime(record.submitted_at)} (Dhaka)</span>
            </div>
          </div>

          <div>
            <span className="text-theme-text-muted block">Branch</span>
            <span className="font-semibold text-theme-text-primary mt-0.5 block">{record.branch_name}</span>
          </div>

          <div>
            <span className="text-theme-text-muted block">Category</span>
            <span className="font-semibold text-theme-text-primary mt-0.5 block">{record.file_type}</span>
          </div>
        </div>
      </div>

      {/* 3. Submitter Information */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-amber-400" />
          Logged By
        </h4>

        <div
          onClick={() => {
            if (submitterProfile) {
              onOpenChildDrawer({ type: 'user', profile: submitterProfile, sourceContext: 'quotation' });
            } else if (record.codename) {
              onOpenChildDrawer({ type: 'user', username: record.codename, sourceContext: 'quotation' });
            }
          }}
          className="p-3 bg-theme-page-bg/60 hover:bg-theme-card-bg border border-theme-border-input/60 hover:border-theme-border-active rounded-xl transition-all cursor-pointer flex items-center justify-between text-xs group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 font-bold">
              {record.codename?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <span className="font-mono font-bold text-blue-400 block group-hover:text-blue-300 transition-colors">
                {record.codename?.toUpperCase()}
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

      {/* 4. Quality & Mistakes Link */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-theme-text-primary flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          Quotation Quality Status
        </h4>

        {matchingMistake ? (
          <div
            onClick={() => onOpenChildDrawer({ type: 'mistake', mistake: matchingMistake })}
            className="p-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/25 rounded-xl transition-all cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Mistake Logged on this File</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                {matchingMistake.penalty || 'Recorded'}
              </span>
            </div>

            <p className="text-[11px] text-theme-text-secondary line-clamp-2">
              {matchingMistake.mistake_details || 'Quality defect logged by QC reviewer.'}
            </p>

            <div className="text-[10px] text-rose-400/80 font-semibold flex items-center justify-between pt-1 border-t border-rose-500/20">
              <span>Date: {matchingMistake.date}</span>
              <span className="group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Inspect mistake <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Clean submission — no mistakes logged for this file</span>
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
              subtab: 'entry',
              search: cleanName,
            });
          }}
          className="flex-1 min-w-[130px] py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Daily Entry
        </button>

        <button
          onClick={() => {
            onClose();
            onNavigateAction({
              tab: 'quotes',
              subtab: 'monthly',
              search: cleanName,
            });
          }}
          className="flex-1 min-w-[130px] py-2 px-3 bg-theme-card-bg hover:bg-theme-border-input border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-purple-400" />
          Monthly Summary
        </button>

        {(submitterProfile?.id || record.codename) && (
          <button
            onClick={() => {
              onClose();
              onNavigateAction({
                tab: 'user_management',
                subtab: 'quotes',
                userId: submitterProfile?.id,
                search: !submitterProfile?.id ? record.codename : undefined,
              });
            }}
            className="flex-1 min-w-[130px] py-2 px-3 bg-theme-card-bg hover:bg-theme-border-input border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <User className="w-3.5 h-3.5 text-amber-400" />
            User History
          </button>
        )}
      </div>
    </div>
  );
};
