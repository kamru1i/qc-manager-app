'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, Search } from 'lucide-react';
import { Profile, BulkRepresentative } from '@/types';
import { Modal } from '../Modal';
import { CustomSelect } from '../CustomSelect';

interface SupervisorApprovalModalProps {
  // Supervisor Approvals panel
  showSupervisorApprovalModal: boolean;
  setShowSupervisorApprovalModal: (val: boolean) => void;
  groupedSupervisorRequests: BulkRepresentative[];
  profilesList: Profile[];
  reviewingIds: Set<string>;
  approvedIds: Set<string>;
  approvingIds: Set<string>;
  handleSupervisorApproveChuti: (id: string, approve: boolean) => void;
  profile: Profile | null;

  // Custom Revision Prompt Modal
  showRevisionPromptModal: boolean;
  setShowRevisionPromptModal: (val: boolean) => void;
  submittingRevision: boolean;
  setRevisionPromptChutiId: (val: string | null) => void;
  setRevisionPromptText: (val: string) => void;
  revisionPromptText: string;
  submitRevisionWithReason: () => void;
}

// Helpers local to the component
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
};

const formatTimeToAMPM = (timeStr: string | null) => {
  if (!timeStr) return '-';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');
  return `${formattedHours}:${minutes} ${ampm}`;
};

export const SupervisorApprovalModal: React.FC<SupervisorApprovalModalProps> = ({
  showSupervisorApprovalModal,
  setShowSupervisorApprovalModal,
  groupedSupervisorRequests,
  profilesList,
  reviewingIds,
  approvedIds,
  approvingIds,
  handleSupervisorApproveChuti,
  profile,

  showRevisionPromptModal,
  setShowRevisionPromptModal,
  submittingRevision,
  setRevisionPromptChutiId,
  setRevisionPromptText,
  revisionPromptText,
  submitRevisionWithReason,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = React.useState('all');

  const leaveTypeOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'Short Leave', label: 'Short Leave' },
    { value: 'Full Leave', label: 'Full Leave' },
    { value: 'Overtime', label: 'Overtime' },
  ];

  React.useEffect(() => {
    if (!showSupervisorApprovalModal) {
      setSearchQuery('');
      setLeaveTypeFilter('all');
    }
  }, [showSupervisorApprovalModal]);

  const filteredSupervisorRequests = React.useMemo(() => {
    return groupedSupervisorRequests.filter(r => {
      const user = profilesList.find(p => p.id === r.user_id);
      const name = (user?.full_name || '').toLowerCase();
      const username = (user?.username || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch = !query || name.includes(query) || username.includes(query);
      const matchesType = leaveTypeFilter === 'all' || r.leave_type === leaveTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [groupedSupervisorRequests, profilesList, searchQuery, leaveTypeFilter]);

  if (profile?.role !== 'supervisor') return null;

  const handleCloseMain = () => setShowSupervisorApprovalModal(false);
  const handleCloseRevision = () => {
    if (submittingRevision) return;
    setShowRevisionPromptModal(false);
    setRevisionPromptChutiId(null);
    setRevisionPromptText('');
  };

  return (
    <>
      {/* Supervisor Leave Approvals Modal */}
      <Modal
        isOpen={showSupervisorApprovalModal}
        onClose={handleCloseMain}
        title={`Pending Verification Panel (Supervisor) (Pending: ${filteredSupervisorRequests.length})`}
        icon={<AlertTriangle className="h-5 w-5 text-orange-400 animate-pulse" />}
        maxWidthClass="max-w-3xl"
        glowClass="bg-orange-900/10"
      >
        <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-1 font-sans">
          <div className="p-4 rounded-xl bg-slate-955/40 border border-slate-800/80 text-xs text-slate-400 space-y-1 font-sans">
            <p className="font-semibold text-amber-400 font-sans">💡 Instructions for Information Revision:</p>
            <p>Supervisors cannot directly reject leave requests. If any correction is required, click <strong>'Needs Review'</strong> to return it to the user. Once the user updates and resubmits, it will come back for your approval.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-955/20 border border-slate-800/60 relative font-sans">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider font-bold">Search Staff (Name or Codename)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs transition-all font-sans"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-355 transition-colors cursor-pointer text-sm font-semibold font-sans"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider font-bold">Filter Leave Type</label>
                <CustomSelect
                  value={leaveTypeFilter}
                  onChange={setLeaveTypeFilter}
                  options={leaveTypeOptions}
                  className="w-full"
                />
              </div>
              {(searchQuery || leaveTypeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setLeaveTypeFilter('all');
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-800 rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center h-[32px] w-[32px]"
                  title="Reset Filter"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {groupedSupervisorRequests.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm font-medium font-sans">
              No pending leaves for verification.
            </div>
          ) : filteredSupervisorRequests.length === 0 ? (
            <div className="text-center py-12 bg-slate-955/40 border border-slate-850 rounded-xl text-amber-500/80 text-xs font-medium font-sans flex items-center justify-center gap-1.5 bg-amber-955/10 border-amber-950/20">
              <AlertTriangle className="h-4 w-4 shrink-0" /> No matching search results found.
            </div>
          ) : (
            <div className="space-y-3 font-sans">
              {filteredSupervisorRequests.map(r => {
                const user = profilesList.find(p => p.id === r.user_id);
                return (
                  <div key={r.id} className="bg-slate-955/60 border border-slate-850 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 font-sans">
                    <div className="space-y-1 text-xs text-slate-355 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{user?.full_name || 'No Name'}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded text-slate-400 font-mono">@{(user?.username || '').toUpperCase()}</span>
                      </div>
                      <p><span className="text-slate-500 font-medium font-sans">Date:</span> <span className="font-semibold text-slate-200">{r.is_bulk ? r.formatted_bulk_dates : formatDate(r.date)}</span></p>
                      <p><span className="text-slate-500 font-medium font-sans">Leave Type:</span> <span className="font-bold text-orange-400">{r.leave_type}</span></p>
                      {r.leave_type !== 'Full Leave' && (
                        <p><span className="text-slate-500 font-medium font-sans">Time & Hours:</span> <span className="font-mono text-slate-300">{formatTimeToAMPM(r.sign_in_time)} - {formatTimeToAMPM(r.sign_out_time)} ({r.leave_hour ? r.leave_hour.substring(0, 5) : '-'} hrs)</span></p>
                      )}
                      <p>
                        <span className="text-slate-500 font-medium font-sans">Adjustment:</span>{' '}
                        <span className={`font-semibold ${r.adjustment ? 'text-orange-400 font-bold' : r.adjusted_hour ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
                          {r.adjustment ? 'Yes' : r.adjusted_hour ? `Partial (${r.adjusted_hour.toString().split('.')[0].substring(0, 5)} hrs)` : 'No'}
                        </span>
                      </p>
                      {r.leave_type === 'Overtime' && (
                        <p>
                          <span className="text-slate-500 font-medium font-sans">Short Leave Adj:</span>{' '}
                          <span className={`font-semibold ${r.adjust_short_leave ? 'text-orange-400 font-bold' : 'text-slate-400'}`}>
                            {r.adjust_short_leave ? 'Yes' : 'No'}
                          </span>
                        </p>
                      )}
                      <p><span className="text-slate-500 font-medium font-sans">Reason/Comment:</span> <span className="italic text-slate-300 font-medium">{r.comment || '-'}</span></p>
                    </div>

                    <div className="flex md:flex-col justify-end items-end gap-2 shrink-0 font-sans">
                      <button
                        onClick={() => handleSupervisorApproveChuti(r.id, false)}
                        disabled={reviewingIds.has(r.id) || approvedIds.has(r.id)}
                        className="px-3 py-1.5 border border-amber-500/30 hover:border-amber-500 bg-amber-955/20 hover:bg-amber-955/50 text-amber-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {reviewingIds.has(r.id) && (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {reviewingIds.has(r.id) ? 'Sending to revision...' : 'Needs Review'}
                      </button>
                      <button
                        onClick={() => handleSupervisorApproveChuti(r.id, true)}
                        disabled={approvingIds.has(r.id) || approvedIds.has(r.id)}
                        className="px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500 bg-emerald-900/20 hover:bg-emerald-900/50 text-emerald-450 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-80 flex items-center gap-1.5"
                      >
                        {approvingIds.has(r.id) && (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {approvedIds.has(r.id) && (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        {approvedIds.has(r.id) ? 'Approved' : approvingIds.has(r.id) ? 'Approving...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Custom Revision Prompt Modal */}
      <Modal
        isOpen={showRevisionPromptModal}
        onClose={handleCloseRevision}
        title="Reason for Revision"
        icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        maxWidthClass="max-w-md"
        glowClass="bg-amber-900/10"
      >
        <div className="space-y-4 font-sans">
          <p className="text-xs text-slate-400 leading-relaxed font-medium font-sans">
            Please enter the reason or comment for returning this leave request for revision. It will be displayed on the user's revision dashboard:
          </p>
          
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Revision Comment/Reason (Required)</label>
            <textarea
              required
              disabled={submittingRevision}
              placeholder="e.g. Please change the date or select the correct leave type..."
              value={revisionPromptText}
              onChange={(e) => setRevisionPromptText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-24 resize-none font-sans disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-800/80 font-sans">
            <button
              type="button"
              disabled={submittingRevision}
              onClick={handleCloseRevision}
              className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-355 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all disabled:opacity-50 font-sans"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submittingRevision || !revisionPromptText.trim()}
              onClick={submitRevisionWithReason}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
            >
              {submittingRevision && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {submittingRevision ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
