import { Bell, Edit, XCircle, ArrowRight } from "lucide-react";
import { Profile, ChutiRecordWithProfile } from "@/types";
import { ChutiRecord } from "@/utils/offlineSync";
import { Modal } from "@/components/common/Modal";
import { isAdminRole } from '@/utils/permissionService';
import { useAppEventBus } from '@/contexts/AppEventBusContext';

interface UserNotificationsModalProps {
  showUserNotificationsModal: boolean;
  setShowUserNotificationsModal: (val: boolean) => void;
  userNotificationsList: any[];
  profile: Profile | null;

  onRevisionClick?: (record: ChutiRecord) => void;
  // Optional backwards-compatible approval handlers (actions handled in Action Center)
  onApproveChutiRequest?: (id: string, approve: boolean) => void;
  onApproveReserveAdjustment?: (
    record: ChutiRecordWithProfile,
    approve: boolean,
  ) => void;
  onApproveProfileChangeRequest?: (id: string, approve: boolean) => void;
  onApprovePasswordResetRequest?: (id: string, approve: boolean) => void;
  onSupervisorApproveChuti?: (id: string, approve: boolean) => void;
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

  onRevisionClick,
  onSwitchToAdminPanel,
  onSwitchToSupervisorPanel,
  onDismiss,
  onDismissAll,
  approvalsCount = 0,
}: UserNotificationsModalProps) {
  const { emit } = useAppEventBus();

  return (
    <Modal
      isOpen={showUserNotificationsModal}
      onClose={() => setShowUserNotificationsModal(false)}
      title="Notifications"
      icon={<Bell className="h-5 w-5 text-purple-400" />}
      maxWidthClass="max-w-lg"
      headerExtra={
        isAdminRole(profile) && onSwitchToAdminPanel ? (
          <button
            onClick={onSwitchToAdminPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all font-sans"
          >
            <span>Admin Panel</span>
            {approvalsCount > 0 && (
              <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 animate-pulse">
                <span className="text-[9px] font-sans font-bold text-white leading-none">
                  {approvalsCount}
                </span>
              </span>
            )}
          </button>
        ) : profile?.role === "supervisor" && onSwitchToSupervisorPanel ? (
          <button
            onClick={onSwitchToSupervisorPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all font-sans"
          >
            <span>Supervisor Panel</span>
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
            <div
              key={n.id}
              className="p-4 bg-theme-page-bg/60 border border-theme-border-muted rounded-xl flex flex-col gap-3 shadow-md"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-theme-text-muted font-mono font-medium">
                    {n.timestamp
                      ? new Date(n.timestamp).toLocaleString("en-US", {
                          hour12: true,
                        })
                      : ""}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold w-fit ${
                      n.type === "compliance_rule"
                        ? "bg-blue-955 border border-blue-900/50 text-blue-300"
                        : n.type === "govt_holiday_prompt"
                          ? "bg-purple-955 border border-purple-900/50 text-purple-300"
                          : n.type === "govt_holiday_history"
                            ? "bg-teal-955 border border-teal-900/50 text-teal-300"
                            : n.type === "admin_holiday_response"
                              ? "bg-blue-955 border border-blue-900/50 text-blue-300"
                              : n.type === "admin_settlement_response"
                                ? "bg-indigo-955 border border-indigo-900/50 text-indigo-300"
                                : n.type === "settlement_processed"
                                  ? "bg-emerald-950/20 border border-emerald-900/40 text-emerald-400"
                                  : n.type === "pending_supervisor_request"
                                    ? "bg-blue-955 border border-blue-900/50 text-blue-300"
                                    : n.type === "pending_admin_chuti_request"
                                      ? "bg-blue-955 border border-blue-900/50 text-blue-300"
                                      : n.type === "pending_admin_reserve_request"
                                        ? "bg-emerald-955 border border-emerald-900/50 text-emerald-300"
                                        : n.type === "pending_admin_profile_request"
                                          ? "bg-cyan-955 border border-cyan-900/50 text-cyan-300"
                                          : n.type === "pending_admin_password_request"
                                            ? "bg-red-955 border border-red-900/50 text-red-300"
                                            : n.type === "user_creation_review"
                                              ? "bg-amber-955 border border-amber-900/50 text-amber-300"
                                              : n.type === "user_creation_approved"
                                                ? "bg-emerald-955 border border-emerald-900/50 text-emerald-300"
                                                : n.type === "user_creation_rejected"
                                                  ? "bg-red-955 border border-red-900/50 text-red-300"
                                                  : n.type === "pending_user_creation_request"
                                                    ? "bg-blue-955 border border-blue-900/50 text-blue-300"
                                                    : n.type === "supervisor_approved"
                                                      ? "bg-emerald-955 border border-emerald-900/50 text-emerald-300"
                                                      : n.record?.leave_type === "Full Leave"
                                                        ? "bg-red-955 border border-red-900 text-red-400"
                                                        : n.record?.leave_type === "Overtime"
                                                          ? "bg-blue-955 border border-blue-900 text-blue-400"
                                                          : ['Short Leave', 'Early Leave', 'Late Join'].includes(n.record?.leave_type || '')
                                                            ? "bg-purple-955 border border-purple-900 text-purple-400"
                                                            : "bg-theme-page-bg border border-theme-card-bg text-theme-text-muted"
                    }`}
                  >
                    {n.type === "compliance_rule"
                      ? "Compliance Rule"
                      : n.type === "govt_holiday_prompt"
                        ? "Govt Holiday (Choice)"
                        : n.type === "govt_holiday_history"
                          ? "Govt Holiday (History)"
                          : n.type === "admin_holiday_response"
                            ? "Govt Holiday History (Staff)"
                            : n.type === "admin_settlement_response"
                              ? "Settle Response (Staff)"
                              : n.type === "settlement_processed"
                                ? "Settlement Processed"
                                : n.type === "pending_supervisor_request"
                                  ? "Leave Verification"
                                  : n.type === "pending_admin_chuti_request"
                                    ? "Leave Approval"
                                    : n.type === "pending_admin_reserve_request"
                                      ? "Reserve / Adjustment"
                                      : n.type === "pending_admin_profile_request"
                                        ? "Profile Edit"
                                        : n.type === "pending_admin_password_request"
                                          ? "Password Reset"
                                          : n.type === "user_creation_review"
                                            ? "Account Review Required"
                                            : n.type === "user_creation_approved"
                                              ? "Account Approved"
                                              : n.type === "user_creation_rejected"
                                                ? "Account Rejected"
                                                : n.type === "pending_user_creation_request"
                                                  ? "User Creation Request"
                                                  : n.type === "supervisor_approved"
                                                    ? "Supervisor Verified"
                                                    : n.record?.leave_type || "Notification"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {n.type === "revision" && n.record && (
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
                  {n.type === "user_creation_review" && n.data && (
                    <button
                      onClick={() => {
                        setShowUserNotificationsModal(false);
                        emit('workspace-change', 'user_management');
                        setTimeout(() => {
                          emit('open-user-creation-review', n.data);
                        }, 100);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all border border-amber-700 shadow-md shrink-0 font-sans"
                    >
                      <Edit className="h-3.5 w-3.5" /> Review & Update
                    </button>
                  )}
                  {n.type === "pending_user_creation_request" && onSwitchToAdminPanel && (
                    <button
                      onClick={() => {
                        setShowUserNotificationsModal(false);
                        onSwitchToAdminPanel();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all border border-blue-700 shadow-md shrink-0 font-sans"
                    >
                      <ArrowRight className="h-3.5 w-3.5" /> View in Panel
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
                <span className="font-semibold text-theme-text-primary block mb-1">
                  {n.title}
                </span>
                {n.body || n.text}
              </div>

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
        ) : (
          <div />
        )}
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
