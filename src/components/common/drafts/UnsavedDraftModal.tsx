'use client';

import React from 'react';
import { Modal } from '@/components/common/Modal';
import { FileEdit, Trash2, ArrowRight, Clock, Tag } from 'lucide-react';
import { formatDraftAge, DraftFormType } from '@/services/draftService';

export interface UnsavedDraftModalProps {
  isOpen: boolean;
  formType: DraftFormType;
  timestamp?: number;
  previewData?: Record<string, string | number | boolean | undefined | null>;
  onContinue: () => void;
  onDiscard: () => void;
  onClose?: () => void;
}

export function UnsavedDraftModal({
  isOpen,
  formType,
  timestamp,
  previewData = {},
  onContinue,
  onDiscard,
  onClose,
}: UnsavedDraftModalProps) {
  const [formattedAge, setFormattedAge] = React.useState('Saved recently');

  React.useEffect(() => {
    if (isOpen && timestamp) {
      setFormattedAge(formatDraftAge(timestamp));
    }
  }, [isOpen, timestamp]);

  const getFormTitle = () => {
    switch (formType) {
      case 'quotation_entry':
        return 'Daily Quotation Entry';
      case 'leave_add':
        return 'Leave Application';
      case 'quotation_add_mistake':
        return 'Quotation Mistake';
      case 'quotation_quick_import':
        return 'Quick Import Batch';
      default:
        return 'Form';
    }
  };

  const previewEntries = Object.entries(previewData).filter(
    ([_, val]) => val !== undefined && val !== null && String(val).trim().length > 0 && val !== false,
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose || onDiscard}
      title="Unsaved Draft Found"
      icon={<FileEdit className="w-5 h-5 text-amber-400 animate-pulse" />}
      maxWidthClass="max-w-md"
      glowClass="bg-amber-500/10"
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-center gap-2 text-xs text-theme-text-muted bg-theme-bg/60 border border-theme-border-input/50 px-3 py-1.5 rounded-lg w-fit">
          <Clock className="w-3.5 h-3.5 text-amber-400/80" />
          <span>{formattedAge}</span>
          <span className="text-theme-border-input">•</span>
          <span className="font-medium text-theme-text-primary">{getFormTitle()}</span>
        </div>

        <p className="text-sm text-theme-text-muted leading-relaxed">
          You have an unsaved draft from a previous session. Would you like to continue editing where you left off or discard it?
        </p>

        {previewEntries.length > 0 && (
          <div className="bg-theme-bg/50 border border-theme-border-input/60 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-theme-text-secondary uppercase tracking-wider text-[10px]">
              <Tag className="w-3 h-3 text-purple-400" />
              <span>Draft Details</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {previewEntries.map(([label, val]) => (
                <div key={label} className="bg-theme-card-bg/70 px-2.5 py-1.5 rounded-lg border border-theme-border-input/40">
                  <div className="text-[10px] text-theme-text-muted capitalize">
                    {label.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="font-medium text-theme-text-primary truncate" title={String(val)}>
                    {String(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onDiscard}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all cursor-pointer active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard Draft</span>
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-purple-600/20 transition-all cursor-pointer active:scale-95"
          >
            <span>Continue Draft</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
