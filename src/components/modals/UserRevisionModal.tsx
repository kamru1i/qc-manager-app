'use client';

import React from 'react';
import { Edit, AlertTriangle, RefreshCw } from 'lucide-react';
import { Profile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { getCleanComment } from '@/utils/dashboardHelpers';
import { ChutiFormFields } from '../ChutiFormFields';

import { Modal } from '../Modal';

interface UserRevisionModalProps {
  showUserRevisionModal: boolean;
  setShowUserRevisionModal: (val: boolean) => void;
  revisionRecord: ChutiRecord | null;
  setRevisionRecord: (val: ChutiRecord | null) => void;
  revisionDate: string;
  setRevisionDate: (val: string) => void;
  revisionLeaveType: string;
  setRevisionLeaveType: (val: string) => void;
  revisionAdjustment: boolean;
  setRevisionAdjustment: (val: boolean) => void;
  revisionAdjustShortLeave: boolean;
  setRevisionAdjustShortLeave: (val: boolean) => void;
  revisionSignInTime: string;
  setRevisionSignInTime: (val: string) => void;
  revisionSignOutTime: string;
  setRevisionSignOutTime: (val: string) => void;
  revisionLeaveHour: string;
  setRevisionLeaveHour: (val: string) => void;
  revisionComment: string;
  setRevisionComment: (val: string) => void;
  handleUserSubmitRevision: (e: React.FormEvent) => void;
  profile: Profile | null;
  submitting: boolean;
}

export function UserRevisionModal({
  showUserRevisionModal,
  setShowUserRevisionModal,
  revisionRecord,
  setRevisionRecord,
  revisionDate,
  setRevisionDate,
  revisionLeaveType,
  setRevisionLeaveType,
  revisionAdjustment,
  setRevisionAdjustment,
  revisionAdjustShortLeave,
  setRevisionAdjustShortLeave,
  revisionSignInTime,
  setRevisionSignInTime,
  revisionSignOutTime,
  setRevisionSignOutTime,
  revisionLeaveHour,
  setRevisionLeaveHour,
  revisionComment,
  setRevisionComment,
  handleUserSubmitRevision,
  profile,
  submitting,
}: UserRevisionModalProps) {
  return (
    <Modal
      isOpen={showUserRevisionModal && revisionRecord !== null}
      onClose={() => {
        setShowUserRevisionModal(false);
        setRevisionRecord(null);
      }}
      title="Revise and Resubmit Leave Details"
      icon={<Edit className="h-5 w-5 text-purple-500" />}
      glowClass="bg-purple-900/10"
      maxWidthClass="max-w-md"
    >
      {revisionRecord && (
        <form onSubmit={handleUserSubmitRevision} className="space-y-4">
          <ChutiFormFields
            date={revisionDate}
            setDate={setRevisionDate}
            leaveType={revisionLeaveType}
            setLeaveType={setRevisionLeaveType}
            signInTime={revisionSignInTime}
            setSignInTime={setRevisionSignInTime}
            signOutTime={revisionSignOutTime}
            setSignOutTime={setRevisionSignOutTime}
            leaveHour={revisionLeaveHour}
            setLeaveHour={setRevisionLeaveHour}
            adjustment={revisionAdjustment}
            setAdjustment={setRevisionAdjustment}
            adjustShortLeave={revisionAdjustShortLeave}
            setAdjustShortLeave={setRevisionAdjustShortLeave}
            comment={revisionComment}
            setComment={setRevisionComment}
            allowOvertime={profile?.allow_overtime || revisionLeaveType === 'Overtime'}
          />

          {revisionRecord.comment && (
            <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg text-xs leading-relaxed">
              <div className="font-semibold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Revision Instructions (Supervisor/Admin Remark):
              </div>
              <p className="text-slate-355">{getCleanComment(revisionRecord.comment)}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setShowUserRevisionModal(false);
                setRevisionRecord(null);
              }}
              className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-355 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all"
            >
              Cancel
            </button>
             <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-500 hover:to-purple-400 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? 'Submitting...' : 'Resubmit'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
