import React, { useState } from 'react';
import { Bell, Edit, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Profile, ChutiRecordWithProfile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { Modal } from '@/components/common/Modal';

interface UserNotificationsModalProps {
  showUserNotificationsModal: boolean;
  setShowUserNotificationsModal: (val: boolean) => void;
  userNotificationsList: any[];
  profile: Profile | null;
  onSaveHolidayResponse: (holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => Promise<boolean>;
  onRevisionClick?: (record: ChutiRecord) => void;
  // Approval handlers (for admin/supervisor)
  onApproveChutiRequest?: (id: string, approve: boolean) => void;
  onApproveReserveAdjustment?: (record: ChutiRecordWithProfile, approve: boolean) => void;
  onApproveProfileChangeRequest?: (id: string, approve: boolean) => void;
  onApprovePasswordResetRequest?: (id: string, approve: boolean) => void;
  onSupervisorApproveChuti?: (id: string, approve: boolean) => void;
  // Track processing state
  approvingIds?: Set<string>;
  reviewingIds?: Set<string>;
  approvedIds?: Set<string>;
  onSwitchToAdminPanel?: () => void;
  onSwitchToSupervisorPanel?: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  approvalsCount?: number;
}

export function UserNotificationsModal({
  showUserNotificationsModal,
  setShowUserNotificationsModal,
  userNotificationsList,
  profile,
  onSaveHolidayResponse,
  onRevisionClick,
  onApproveChutiRequest,
  onApproveReserveAdjustment,
  onApproveProfileChangeRequest,
  onApprovePasswordResetRequest,
  onSupervisorApproveChuti,
  approvingIds = new Set(),
  reviewingIds = new Set(),
  approvedIds = new Set(),
  onSwitchToAdminPanel,
  onSwitchToSupervisorPanel,
  onDismiss,
  onDismissAll,
  approvalsCount = 0,
}: UserNotificationsModalProps) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleChoice = async (holidayDate: string, holidayName: string, choice: 'paid' | 'reserve', notifId: string) => {
    setSubmittingId(notifId);
    await onSaveHolidayResponse(holidayDate, holidayName, choice);
    setSubmittingId(null);
  };

  const isProcessing = (id: string) => approvingIds.has(id) || reviewingIds.has(id);
  const isDone = (id: string) => approvedIds.has(id);

  return (
    <Modal
      isOpen={showUserNotificationsModal}
      onClose={() => setShowUserNotificationsModal(false)}
      title="Notifications"
      icon={<Bell className="h-5 w-5 text-purple-400" />}
      maxWidthClass="max-w-lg"
      headerExtra={
        profile?.role === 'admin' && onSwitchToAdminPanel ? (
          <button
            onClick={onSwitchToAdminPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all font-sans"
          >
            <span>Go to Admin Panel</span>
            {approvalsCount > 0 && (
              <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 animate-pulse">
                <span className="text-[9px] font-sans font-bold text-white leading-none">
                  {approvalsCount}
                </span>
              </span>
            )}
          </button>
        ) : profile?.role === 'supervisor' && onSwitchToSupervisorPanel ? (
          <button
            onClick={onSwitchToSupervisorPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all font-sans"
          >
            <span>Go to Supervisor Panel</span>
            {approvalsCount > 0 && (
              <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 animate-pulse">
                <span className="text-[9px] font-sans font-bold text-white leading-none">
                  {approvalsCount}
                </span>
              </span>
            )}
          </button>
        ) : undefined
      }
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .notification-scrollbar::-webkit-scrollbar {
              width: 4px;
              height: 4px;
            }
            .notification-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .notification-scrollbar::-webkit-scrollbar-thumb {
              background: transparent;
              border-radius: 9999px;
              transition: background 0.15s ease;
            }
            .notification-scrollbar:hover::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.2);
            }
            .notification-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(148, 163, 184, 0.35);
            }
          `,
        }}
      />
      <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 notification-scrollbar">
        {userNotificationsList.length === 0 ? (
          <div className="py-8 text-center text-theme-text-muted text-sm">
            No notifications.
          </div>
        ) : (
          userNotificationsList.map((n) => (
            <div key={n.id} className="p-4 bg-theme-page-bg/60 border border-theme-border-muted rounded-xl flex flex-col gap-3 shadow-md">
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-theme-text-muted font-mono font-medium">
                    {n.timestamp ? new Date(n.timestamp).toLocaleString('en-US', { hour12: true }) : ''}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold w-fit ${
                    n.type === 'compliance_rule'
                      ? 'bg-blue-955 border border-blue-900/50 text-blue-300'
                    : n.type === 'govt_holiday_prompt'
                      ? 'bg-purple-955 border border-purple-900/50 text-purple-300'
                    : n.type === 'govt_holiday_choice'
                      ? 'bg-teal-955 border border-teal-900/50 text-teal-300'
                    : n.type === 'admin_holiday_response'
                      ? 'bg-blue-955 border border-blue-900/50 text-blue-300'
                    : n.type === 'admin_settlement_response'
                      ? 'bg-indigo-955 border border-indigo-900/50 text-indigo-300'
                    : n.type === 'settlement_processed'
                      ? 'bg-emerald-950/20 border border-emerald-900/40 text-emerald-400'
                    : n.type === 'pending_supervisor_request'
                      ? 'bg-blue-955 border border-blue-900/50 text-blue-300'
                    : n.type === 'pending_admin_chuti_request'
                      ? 'bg-blue-955 border border-blue-900/50 text-blue-300'
                    : n.type === 'pending_admin_reserve_request'
                      ? 'bg-emerald-955 border border-emerald-900/50 text-emerald-300'
                    : n.type === 'pending_admin_profile_request'
                      ? 'bg-cyan-955 border border-cyan-900/50 text-cyan-300'
                    : n.type === 'pending_admin_password_request'
                      ? 'bg-red-955 border border-red-900/50 text-red-300'
                    : n.type === 'supervisor_approved'
                      ? 'bg-emerald-955 border border-emerald-900/50 text-emerald-300'
                    : n.record?.leave_type === 'Full Leave' 
                      ? 'bg-red-955 border border-red-900 text-red-400' 
                    : n.record?.leave_type === 'Overtime'
                      ? 'bg-blue-955 border border-blue-900 text-blue-400'
                    : n.record?.leave_type === 'Short Leave'
                      ? 'bg-purple-955 border border-purple-900 text-purple-400'
                    : 'bg-theme-page-bg border border-theme-card-bg text-theme-text-muted'
                  }`}>
                    {n.type === 'compliance_rule' ? 'Compliance Rule'
                     : n.type === 'govt_holiday_prompt' ? 'Govt Holiday (Choice)'
                     : n.type === 'govt_holiday_choice' ? 'Govt Holiday (Response)'
                     : n.type === 'admin_holiday_response' ? 'Govt Holiday Response (Staff)'
                     : n.type === 'admin_settlement_response' ? 'Settle Response (Staff)'
                     : n.type === 'settlement_processed' ? 'Settlement Processed'
                     : n.type === 'pending_supervisor_request' ? 'Leave Verification'
                     : n.type === 'pending_admin_chuti_request' ? 'Leave Approval'
                     : n.type === 'pending_admin_reserve_request' ? 'Reserve / Adjustment'
                     : n.type === 'pending_admin_profile_request' ? 'Profile Edit'
                     : n.type === 'pending_admin_password_request' ? 'Password Reset'
                     : n.type === 'supervisor_approved' ? 'Supervisor Verified'
                     : n.record?.leave_type || 'Notification'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {n.type === 'revision' && n.record && (
                    <button
                      onClick={() => {
                        setShowUserNotificationsModal(false);
                        if (onRevisionClick && n.record) {
                          onRevisionClick(n.record);
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all border border-purple-700 shadow-md shrink-0 font-sans"
                    >
                      <Edit className="h-3.5 w-3.5" /> Modify
                    </button>
                  )}
                  <button
                    onClick={() => onDismiss(n.id)}
                    className="p-1 hover:bg-theme-border-input text-theme-text-muted hover:text-theme-text-secondary rounded-lg transition-colors cursor-pointer"
                    title="Dismiss notification"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-3 bg-theme-card-bg/60 border border-theme-border-input/80 text-theme-text-secondary rounded-lg text-xs leading-relaxed font-sans whitespace-pre-wrap">
                <span className="font-semibold text-theme-text-primary block mb-1">{n.title}</span>
                {n.body || n.text}
              </div>

              {/* Govt Holiday Prompt - Get Paid / Reserve */}
              {n.type === 'govt_holiday_prompt' && n.holidayDate && n.holidayName && (
                <div className="flex gap-2 justify-end mt-1">
                  <button
                    type="button"
                    disabled={submittingId !== null}
                    onClick={() => handleChoice(n.holidayDate, n.holidayName, 'paid', n.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-555 text-white border border-emerald-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                  >
                    {submittingId === n.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Get Paid'}
                  </button>
                  <button
                    type="button"
                    disabled={submittingId !== null}
                    onClick={() => handleChoice(n.holidayDate, n.holidayName, 'reserve', n.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-555 text-white border border-teal-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                  >
                    {submittingId === n.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Reserve'}
                  </button>
                </div>
              )}

              {/* Admin: Leave Approval - Approve / Reject */}
              {n.type === 'pending_admin_chuti_request' && n.record && onApproveChutiRequest && (
                <div className="flex gap-2 justify-end mt-1">
                  {isDone(n.record.id) ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><CheckCircle className="h-3.5 w-3.5" /> Done</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing(n.record.id)}
                        onClick={() => onApproveChutiRequest(n.record.id, true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-555 text-white border border-emerald-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.record.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>}
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing(n.record.id)}
                        onClick={() => onApproveChutiRequest(n.record.id, false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-555 text-white border border-red-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.record.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</>}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Admin: Reserve / Adjustment Approval */}
              {n.type === 'pending_admin_reserve_request' && n.record && onApproveReserveAdjustment && (
                <div className="flex gap-2 justify-end mt-1">
                  {isDone(n.record.id) ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><CheckCircle className="h-3.5 w-3.5" /> Done</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing(n.record.id)}
                        onClick={() => onApproveReserveAdjustment(n.record, true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-555 text-white border border-emerald-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.record.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>}
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing(n.record.id)}
                        onClick={() => onApproveReserveAdjustment(n.record, false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-555 text-white border border-red-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.record.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</>}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Admin: Profile Change Request Approval */}
              {n.type === 'pending_admin_profile_request' && n.profileRecord && onApproveProfileChangeRequest && (
                <div className="flex gap-2 justify-end mt-1">
                  {isDone(n.profileRecord.id) ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><CheckCircle className="h-3.5 w-3.5" /> Done</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing(n.profileRecord.id)}
                        onClick={() => onApproveProfileChangeRequest(n.profileRecord.id, true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-555 text-white border border-emerald-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.profileRecord.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>}
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing(n.profileRecord.id)}
                        onClick={() => onApproveProfileChangeRequest(n.profileRecord.id, false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-555 text-white border border-red-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.profileRecord.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</>}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Admin: Password Reset Request Approval */}
              {n.type === 'pending_admin_password_request' && n.profileRecord && onApprovePasswordResetRequest && (
                <div className="flex gap-2 justify-end mt-1">
                  {isDone(n.profileRecord.id) ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><CheckCircle className="h-3.5 w-3.5" /> Done</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing(n.profileRecord.id)}
                        onClick={() => onApprovePasswordResetRequest(n.profileRecord.id, true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-555 text-white border border-emerald-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.profileRecord.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>}
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing(n.profileRecord.id)}
                        onClick={() => onApprovePasswordResetRequest(n.profileRecord.id, false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-555 text-white border border-red-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.profileRecord.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</>}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Supervisor: Leave Verification - Verify / Reject */}
              {n.type === 'pending_supervisor_request' && n.record && onSupervisorApproveChuti && (
                <div className="flex gap-2 justify-end mt-1">
                  {isDone(n.record.id) ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold"><CheckCircle className="h-3.5 w-3.5" /> Done</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing(n.record.id)}
                        onClick={() => onSupervisorApproveChuti(n.record.id, true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-555 text-white border border-emerald-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.record.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Verify</>}
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing(n.record.id)}
                        onClick={() => onSupervisorApproveChuti(n.record.id, false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-555 text-white border border-red-500 shadow-md transition-all cursor-pointer disabled:opacity-50 h-8 flex items-center justify-center font-sans min-w-[75px]"
                      >
                        {isProcessing(n.record.id) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</>}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      <div className="flex justify-between items-center pt-4 border-t border-theme-border-input/80 mt-5">
        {userNotificationsList.length > 0 ? (
          <button
            onClick={onDismissAll}
            className="px-4 py-2 border border-red-950 text-red-400 hover:text-red-300 hover:border-red-900 rounded-lg text-xs font-semibold bg-red-950/20 hover:bg-red-900/10 cursor-pointer transition-all font-sans"
          >
            Dismiss All
          </button>
        ) : <div />}
        <button
          onClick={() => setShowUserNotificationsModal(false)}
          className="px-4 py-2 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
