import React, { useState } from 'react';
import { Bell, Edit, RefreshCw } from 'lucide-react';
import { Profile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { Modal } from '@/components/Modal';

interface UserNotificationsModalProps {
  showUserNotificationsModal: boolean;
  setShowUserNotificationsModal: (val: boolean) => void;
  userNotificationsList: any[];
  adminActiveTab: 'user' | 'admin';
  setShowLeaveApprovalModal: (val: boolean) => void;
  setShowSupervisorApprovalModal: (val: boolean) => void;
  profile: Profile | null;
  setRevisionRecord: (val: ChutiRecord | null) => void;
  setRevisionDate: (val: string) => void;
  setRevisionLeaveType: (val: string) => void;
  setRevisionAdjustment: (val: boolean) => void;
  setRevisionAdjustShortLeave: (val: boolean) => void;
  setRevisionSignInTime: (val: string) => void;
  setRevisionSignOutTime: (val: string) => void;
  setRevisionLeaveHour: (val: string) => void;
  setRevisionComment: (val: string) => void;
  setShowUserRevisionModal: (val: boolean) => void;
  onSaveHolidayResponse: (holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => Promise<boolean>;
}

export function UserNotificationsModal({
  showUserNotificationsModal,
  setShowUserNotificationsModal,
  userNotificationsList,
  adminActiveTab,
  setShowLeaveApprovalModal,
  setShowSupervisorApprovalModal,
  profile,
  setRevisionRecord,
  setRevisionDate,
  setRevisionLeaveType,
  setRevisionAdjustment,
  setRevisionAdjustShortLeave,
  setRevisionSignInTime,
  setRevisionSignOutTime,
  setRevisionLeaveHour,
  setRevisionComment,
  setShowUserRevisionModal,
  onSaveHolidayResponse,
}: UserNotificationsModalProps) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleChoice = async (holidayDate: string, holidayName: string, choice: 'paid' | 'reserve', notifId: string) => {
    setSubmittingId(notifId);
    await onSaveHolidayResponse(holidayDate, holidayName, choice);
    setSubmittingId(null);
  };

  return (
    <Modal
      isOpen={showUserNotificationsModal}
      onClose={() => setShowUserNotificationsModal(false)}
      title="Leave Notifications"
      icon={<Bell className="h-5 w-5 text-amber-400" />}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
        {userNotificationsList.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No notifications.
          </div>
        ) : (
          userNotificationsList.map((n) => (
            <div key={n.id} className="p-4 bg-slate-955/60 border border-slate-855 rounded-xl flex flex-col gap-3 shadow-md">
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-mono font-medium">
                    {n.timestamp ? new Date(n.timestamp).toLocaleString('en-US', { hour12: true }) : ''}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold w-fit ${
                    n.type === 'govt_holiday_prompt'
                      ? 'bg-amber-955 border border-amber-900/50 text-amber-300'
                    : n.type === 'govt_holiday_choice'
                      ? 'bg-teal-955 border border-teal-900/50 text-teal-300'
                    : n.type === 'admin_holiday_response'
                      ? 'bg-orange-955 border border-orange-900/50 text-orange-300'
                    : n.type === 'admin_settlement_response'
                      ? 'bg-indigo-955 border border-indigo-900/50 text-indigo-300'
                    : n.type === 'settlement_processed'
                      ? 'bg-emerald-950/20 border border-emerald-900/40 text-emerald-400'
                    : n.type === 'pending_supervisor_request'
                      ? 'bg-orange-955 border border-orange-900/50 text-orange-300'
                    : n.type === 'pending_admin_chuti_request'
                      ? 'bg-orange-955 border border-orange-900/50 text-orange-300'
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
                      ? 'bg-orange-955 border border-orange-900 text-orange-400'
                    : n.record?.leave_type === 'Short Leave'
                      ? 'bg-amber-955 border border-amber-900 text-amber-400'
                    : 'bg-slate-955 border border-slate-900 text-slate-400'
                  }`}>
                    {n.type === 'govt_holiday_prompt' ? 'Govt Holiday (Choice)'
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
                
                {n.type === 'revision' && n.record && (
                  <button
                    onClick={() => {
                      const r = n.record!;
                      setRevisionRecord(r);
                      setRevisionDate(r.date);
                      setRevisionLeaveType(r.leave_type);
                      setRevisionAdjustment(r.adjustment);
                      setRevisionAdjustShortLeave(r.adjust_short_leave === true);
                      setRevisionSignInTime(r.sign_in_time ? r.sign_in_time.substring(0, 5) : '13:00');
                      setRevisionSignOutTime(r.sign_out_time ? r.sign_out_time.substring(0, 5) : '22:30');
                      setRevisionLeaveHour(r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '00:00');
                      setRevisionComment('');
                      setShowUserNotificationsModal(false);
                      setShowUserRevisionModal(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all border border-amber-700 shadow-md shrink-0 font-sans"
                  >
                    <Edit className="h-3.5 w-3.5" /> Modify
                  </button>
                )}
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800/80 text-slate-300 rounded-lg text-xs leading-relaxed font-sans">
                <span className="font-semibold text-slate-200 block mb-1">{n.title}</span>
                {n.body || n.text}
              </div>

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
            </div>
          ))
        )}
      </div>
      
      <div className="flex justify-between items-center pt-4 border-t border-slate-800/80 mt-5">
        {((profile?.role === 'admin' && adminActiveTab === 'admin') || profile?.role === 'supervisor') && (
          <button
            onClick={() => {
              setShowUserNotificationsModal(false);
              if (profile.role === 'admin') {
                setShowLeaveApprovalModal(true);
              } else {
                setShowSupervisorApprovalModal(true);
              }
            }}
            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-350 hover:text-white cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Bell className="h-3.5 w-3.5" /> Go to Approval Panel
          </button>
        )}
        <button
          onClick={() => setShowUserNotificationsModal(false)}
          className="px-4 py-2 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-350 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all ml-auto"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
