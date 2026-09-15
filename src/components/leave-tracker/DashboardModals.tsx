import React from 'react';
import { createPortal } from 'react-dom';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { ChutiRecordWithProfile, GovtHolidayResponse, Profile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { isAdminRole } from '@/utils/permissionService';

import { WelcomeModals } from '@/components/common/modals/WelcomeModals';
import { useAppEventBus, useAppEvent } from '@/contexts/AppEventBusContext';
import { useRealtimeHandler } from '@/contexts/RealtimeContext';
import { toast } from 'sonner';
import { userCreationRequestService } from '@/services/userCreationRequestService';
import { UserCreationRequest } from '@/types';
import { AdminAddLeaveModal } from '@/components/leave-tracker/modals/AdminAddLeaveModal';
import { UserRevisionModal } from '@/components/leave-tracker/modals/UserRevisionModal';
import { DeleteConfirmModal } from '@/components/common/modals/DeleteConfirmModal';
import { AdjustmentModal } from '@/components/leave-tracker/modals/AdjustmentModal';
import { SupervisorApprovalModal } from '@/components/leave-tracker/modals/SupervisorApprovalModal';
import { RevisionPromptModal } from '@/components/leave-tracker/modals/RevisionPromptModal';
import { AdminLeaveApprovalModal } from '@/components/leave-tracker/modals/AdminLeaveApprovalModal';
import { RequestRemovalModal } from '@/components/leave-tracker/modals/RequestRemovalModal';
import { AdminEditRecordModal } from '@/components/leave-tracker/modals/AdminEditRecordModal';
import { AdminCancelAdjustmentModal } from '@/components/leave-tracker/modals/AdminCancelAdjustmentModal';
import { AdminCreateUserModal } from '@/components/leave-tracker/modals/AdminCreateUserModal';
import { AdminCredentialsModal } from '@/components/leave-tracker/modals/AdminCredentialsModal';
import { AdminDeleteUserModal } from '@/components/leave-tracker/modals/AdminDeleteUserModal';

export const DashboardModals = () => {
  const { dashboardData, derivedState, chutiOps, adjustmentOps, adminStaffOps } = useDashboardContext();
  const { emit } = useAppEventBus();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    sessionUser,
    profile,
    submitting,
    userRecords,
    adminRecords,
    profilesList,
    leaveSettlements,
    adminActiveTab,
    viewingStaffId,
    showLeaveApprovalModal,
    setShowLeaveApprovalModal,
    showSupervisorApprovalModal,
    setShowSupervisorApprovalModal,
    approvingIds,
    reviewingIds,
    approvedIds,
    fetchRecords,
    globalSettings,
    holidayResponses,
    handleDismissNotifications,
  } = dashboardData;

  const {
    pendingProfileRequests,
    pendingPasswordResetRequests,
    pendingReserveRequests,
    groupedSupervisorRequests,
    groupedChutiRequests,
    adminHolidayNotifications,
    staffProfile,
    unreadUserNotificationsCount,
  } = derivedState;

  const {
    // Delete
    showDeleteModal,
    setShowDeleteModal,
    recordToDelete,
    setRecordToDelete,
    deletingRecord,
    handleConfirmDelete,

    // User Revision
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

    // Admin Edit
    showAdminEditModal,
    setShowAdminEditModal,
    adminEditRecord,
    adminEditDate,
    setAdminEditDate,
    adminEditLeaveType,
    setAdminEditLeaveType,
    adminEditSignInTime,
    setAdminEditSignInTime,
    adminEditSignOutTime,
    setAdminEditSignOutTime,
    adminEditLeaveHour,
    setAdminEditLeaveHour,
    adminEditAdjustment,
    setAdminEditAdjustment,
    adminEditAdjustShortLeave,
    setAdminEditAdjustShortLeave,
    adminEditComment,
    setAdminEditComment,
    handleAdminSaveEdit,

    // Approvals
    handleSupervisorApproveChuti,
    handleApproveChutiRequest,

    // Revision prompt
    showRevisionPromptModal,
    setShowRevisionPromptModal,
    submittingRevision,
    setRevisionPromptChutiId,
    setRevisionPromptText,
    revisionPromptText,
    submitRevisionWithReason,
    showAdminAddLeaveModal,
    setShowAdminAddLeaveModal,
    showRequestRemovalModal,
    setShowRequestRemovalModal,
    removalRecord,
    handleUserSubmitRemoval,
    submittingRemoval,
    handleApproveLeaveRemoval,
  } = chutiOps;

  const {
    showAdjustmentModal,
    setShowAdjustmentModal,
    adjustmentRecord,
    setAdjustmentRecord,
    adjustmentType,
    setAdjustmentType,
    partialAdjustmentTime,
    setPartialAdjustmentTime,
    setAdjustShortLeaveOption,
    showCancelAdjustmentModal,
    setShowCancelAdjustmentModal,
    cancelAdjustmentRecord,
    setCancelAdjustmentRecord,
    handleConfirmCancelAdjustment,
    handleSaveAdjustment,
    handleApproveReserveAdjustment,
  } = adjustmentOps;

  const {
    showWelcomePopup,
    setShowWelcomePopup,
    welcomePopupType,
    showFirstTimePasswordModal,
    showOnboardingModal,
    firstTimePassword,
    setFirstTimePassword,
    firstTimeConfirmPassword,
    setFirstTimeConfirmPassword,
    firstTimePasswordSubmitting,
    firstTimePasswordError,

    handleFirstTimeSetupSubmit,
    handleLogout,

    setupFullName,
    setSetupFullName,
    setupUsername,
    setupWorkingHours,
    setSetupWorkingHours,
    setupBreakTime,
    setSetupBreakTime,
    setupJobRole,
    setSetupJobRole,
    setupSignInTime,
    setSetupSignInTime,
    setupSignOutTime,
    setSetupSignOutTime,
    setupSubmitting,
    setupError,
    handleSetupSubmit,

    showCreateUserModal,
    setShowCreateUserModal,
    setNewStaffPassword,
    setNewStaffConfirmPassword,
    newStaffUsername,
    setNewStaffUsername,
    newStaffRole,
    setNewStaffRole,
    newStaffNeedsApproval,
    setNewStaffNeedsApproval,
    newStaffAllowReserve,
    setNewStaffAllowReserve,
    newStaffAllowOvertime,
    setNewStaffAllowOvertime,
    creatingUser,
    handleCreateNewUser,
    newStaffEligibleOfficeLeave,
    setNewStaffEligibleOfficeLeave,
    newStaffEligibleGovtHoliday,
    setNewStaffEligibleGovtHoliday,

    showCredentialsModal,
    setShowCredentialsModal,
    credTargetUserId,
    setCredTargetUserId,
    credNewUsername,
    setCredNewUsername,
    credNewPassword,
    setCredNewPassword,
    credConfirmPassword,
    setCredConfirmPassword,
    updatingCredentials,
    handleUpdateCredentials,

    showDeleteUserModal,
    setShowDeleteUserModal,
    deleteTargetUser,
    setDeleteTargetUser,
    deletingUser,
    handleDeleteUser,

    handleApproveProfileChangeRequest,
    handleApprovePasswordResetRequest,
    newStaffSupervisorIds,
    setNewStaffSupervisorIds,
  } = adminStaffOps;

  // User Creation Requests management
  const [pendingUserCreationRequests, setPendingUserCreationRequests] = React.useState<UserCreationRequest[]>([]);
  const [approvingUserReqIds, setApprovingUserReqIds] = React.useState<Set<string>>(new Set());
  const [reviewingUserReqIds, setReviewingUserReqIds] = React.useState<Set<string>>(new Set());

  const fetchPendingUserCreationRequests = React.useCallback(async () => {
    if (!isAdminRole(profile)) return;
    try {
      const { data } = await userCreationRequestService.fetchRequests({
        status: 'pending_admin_approval',
      });
      if (data) {
        setPendingUserCreationRequests(data);
      }
    } catch (err) {
      console.error('Error fetching user creation requests in DashboardModals:', err);
    }
  }, [profile]);

  React.useEffect(() => {
    fetchPendingUserCreationRequests();
  }, [fetchPendingUserCreationRequests]);

  useAppEvent('user-creation-requests-updated', () => {
    fetchPendingUserCreationRequests();
  }, [fetchPendingUserCreationRequests]);

  useRealtimeHandler(
    'user_creation_requests',
    React.useCallback(() => {
      fetchPendingUserCreationRequests();
    }, [fetchPendingUserCreationRequests])
  );

  const handleApproveUserCreationRequest = async (req: UserCreationRequest) => {
    setApprovingUserReqIds(prev => new Set(prev).add(req.id));
    try {
      const { success, error } = await userCreationRequestService.approveRequest(req.id, req.version);
      if (error) {
        toast.error(error.message || 'Failed to approve user creation request.');
        return;
      }
      toast.success(`User account for "${req.data?.full_name || req.data?.codename}" approved & created!`);
      fetchPendingUserCreationRequests();
      emit('user-creation-requests-updated');
    } catch (err: any) {
      toast.error(err?.message || 'Error approving user request');
    } finally {
      setApprovingUserReqIds(prev => {
        const next = new Set(prev);
        next.delete(req.id);
        return next;
      });
    }
  };

  const handleReviewUserCreationRequest = async (req: UserCreationRequest, notes: string) => {
    setReviewingUserReqIds(prev => new Set(prev).add(req.id));
    try {
      const { success, error } = await userCreationRequestService.reviewRequest(req.id, notes);
      if (error) {
        toast.error(error.message || 'Failed to send request back for review.');
        return;
      }
      toast.success(`Account request sent back to supervisor with review notes.`);
      fetchPendingUserCreationRequests();
      emit('user-creation-requests-updated');
    } catch (err: any) {
      toast.error(err?.message || 'Error sending request for review');
    } finally {
      setReviewingUserReqIds(prev => {
        const next = new Set(prev);
        next.delete(req.id);
        return next;
      });
    }
  };

  const effectiveApprovingIds = React.useMemo<Set<string>>(() => {
    return new Set<string>([
      ...Array.from(approvingIds || []).map(String),
      ...Array.from(approvingUserReqIds),
    ]);
  }, [approvingIds, approvingUserReqIds]);

  const effectiveReviewingIds = React.useMemo<Set<string>>(() => {
    return new Set<string>([
      ...Array.from(reviewingIds || []).map(String),
      ...Array.from(reviewingUserReqIds),
    ]);
  }, [reviewingIds, reviewingUserReqIds]);

  if (!mounted || typeof window === 'undefined') return null;
  const portalTarget = document.getElementById('root-modals-portal');
  if (!portalTarget) return null;

  return createPortal(
    <>
      <WelcomeModals
        showWelcomePopup={showWelcomePopup}
        setShowWelcomePopup={setShowWelcomePopup}
        welcomePopupType={welcomePopupType}
        showFirstTimePasswordModal={showFirstTimePasswordModal}
        showOnboardingModal={showOnboardingModal}
        firstTimePasswordError={firstTimePasswordError || null}
        firstTimePassword={firstTimePassword}
        setFirstTimePassword={setFirstTimePassword}
        firstTimeConfirmPassword={firstTimeConfirmPassword}
        setFirstTimeConfirmPassword={setFirstTimeConfirmPassword}
        profile={profile}

        firstTimePasswordSubmitting={firstTimePasswordSubmitting}
        sessionUser={sessionUser}
        handleFirstTimeSetupSubmit={handleFirstTimeSetupSubmit}
        handleLogout={handleLogout || dashboardData.handleLogout}
        setupError={setupError || null}
        setupFullName={setupFullName}
        setSetupFullName={setSetupFullName}
        setupUsername={setupUsername}
        setupJobRole={setupJobRole}
        setSetupJobRole={setSetupJobRole}
        setupWorkingHours={setupWorkingHours}
        setSetupWorkingHours={setSetupWorkingHours}
        setupBreakTime={setupBreakTime}
        setSetupBreakTime={setSetupBreakTime}
        setupSignInTime={setupSignInTime}
        setSetupSignInTime={setSetupSignInTime}
        setupSignOutTime={setupSignOutTime}
        setSetupSignOutTime={setSetupSignOutTime}
        setupSubmitting={setupSubmitting}
        handleSetupSubmit={handleSetupSubmit}
      />

      <AdminAddLeaveModal
        showModal={showAdminAddLeaveModal}
        setShowModal={setShowAdminAddLeaveModal}
        staffProfile={staffProfile}
        onSuccess={fetchRecords}
        records={viewingStaffId ? adminRecords.filter((r: ChutiRecordWithProfile) => r.user_id === viewingStaffId) : []}
        globalSettings={globalSettings}
        leaveSettlements={leaveSettlements}
      />

      <UserRevisionModal
        showUserRevisionModal={showUserRevisionModal}
        setShowUserRevisionModal={setShowUserRevisionModal}
        revisionRecord={revisionRecord}
        setRevisionRecord={setRevisionRecord}
        revisionDate={revisionDate}
        setRevisionDate={setRevisionDate}
        revisionLeaveType={revisionLeaveType}
        setRevisionLeaveType={setRevisionLeaveType}
        revisionAdjustment={revisionAdjustment}
        setRevisionAdjustment={setRevisionAdjustment}
        revisionAdjustShortLeave={revisionAdjustShortLeave}
        setRevisionAdjustShortLeave={setRevisionAdjustShortLeave}
        revisionSignInTime={revisionSignInTime}
        setRevisionSignInTime={setRevisionSignInTime}
        revisionSignOutTime={revisionSignOutTime}
        setRevisionSignOutTime={setRevisionSignOutTime}
        revisionLeaveHour={revisionLeaveHour}
        setRevisionLeaveHour={setRevisionLeaveHour}
        revisionComment={revisionComment}
        setRevisionComment={setRevisionComment}
        handleUserSubmitRevision={handleUserSubmitRevision}
        profile={profile}
        submitting={submitting}
      />



      <DeleteConfirmModal
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        recordToDelete={recordToDelete}
        setRecordToDelete={setRecordToDelete}
        deletingRecord={deletingRecord}
        handleConfirmDelete={handleConfirmDelete}
      />

      <AdjustmentModal
        showAdjustmentModal={showAdjustmentModal}
        setShowAdjustmentModal={setShowAdjustmentModal}
        adjustmentRecord={adjustmentRecord}
        setAdjustmentRecord={setAdjustmentRecord}
        adjustmentType={adjustmentType}
        setAdjustmentType={setAdjustmentType}
        partialAdjustmentTime={partialAdjustmentTime}
        setPartialAdjustmentTime={setPartialAdjustmentTime}
        setAdjustShortLeaveOption={setAdjustShortLeaveOption}
        handleSaveAdjustment={handleSaveAdjustment}
        records={adjustmentRecord ? (adminActiveTab === 'admin' ? adminRecords : userRecords).filter((r: ChutiRecord | ChutiRecordWithProfile) => r.user_id === adjustmentRecord.user_id) : []}
        holidayResponses={adjustmentRecord ? holidayResponses.filter((r: GovtHolidayResponse) => r.user_id === adjustmentRecord.user_id) : []}
        globalSettings={globalSettings}
        submitting={submitting}
        targetProfile={adjustmentRecord ? profilesList.find((p: Profile) => p.id === adjustmentRecord.user_id) || profile : profile}
        isAdmin={isAdminRole(profile) && adminActiveTab === 'admin'}
      />

      <SupervisorApprovalModal
        showSupervisorApprovalModal={showSupervisorApprovalModal}
        setShowSupervisorApprovalModal={setShowSupervisorApprovalModal}
        groupedSupervisorRequests={groupedSupervisorRequests}
        profilesList={profilesList}
        reviewingIds={reviewingIds}
        approvedIds={approvedIds}
        approvingIds={approvingIds}
        handleSupervisorApproveChuti={handleSupervisorApproveChuti}
        profile={profile}
        onSwitchToUserPanel={() => {
          sessionStorage.setItem('supervisorNotificationMode', 'user');
          setShowSupervisorApprovalModal(false);
          setTimeout(() => {
            emit('open-user-notifications-modal');
          }, 50);
        }}
        userNotificationsCount={unreadUserNotificationsCount}
      />

      {/* Shared "Reason for Revision" prompt — used by BOTH admin and supervisor
          approval panels (admins were locked out when it lived inside the
          supervisor-gated modal) */}
      <RevisionPromptModal
        showRevisionPromptModal={showRevisionPromptModal}
        setShowRevisionPromptModal={setShowRevisionPromptModal}
        submittingRevision={submittingRevision}
        setRevisionPromptChutiId={setRevisionPromptChutiId}
        setRevisionPromptText={setRevisionPromptText}
        revisionPromptText={revisionPromptText}
        submitRevisionWithReason={submitRevisionWithReason}
      />

      <AdminLeaveApprovalModal
        showLeaveApprovalModal={showLeaveApprovalModal}
        setShowLeaveApprovalModal={(val) => {
          if (!val && handleDismissNotifications) {
            handleDismissNotifications('admin');
          }
          setShowLeaveApprovalModal(val);
        }}
        profile={profile}
        groupedChutiRequests={groupedChutiRequests}
        profilesList={profilesList}
        reviewingIds={effectiveReviewingIds}
        approvedIds={approvedIds}
        approvingIds={effectiveApprovingIds}
        handleApproveChutiRequest={handleApproveChutiRequest}
        pendingReserveRequests={pendingReserveRequests}
        handleApproveReserveAdjustment={handleApproveReserveAdjustment}
        pendingProfileRequests={pendingProfileRequests}
        handleApproveProfileChangeRequest={handleApproveProfileChangeRequest}
        adminHolidayNotifications={adminHolidayNotifications}
        pendingPasswordResetRequests={pendingPasswordResetRequests}
        handleApprovePasswordResetRequest={handleApprovePasswordResetRequest}
        handleApproveLeaveRemoval={handleApproveLeaveRemoval}
        pendingUserCreationRequests={pendingUserCreationRequests}
        handleApproveUserCreationRequest={handleApproveUserCreationRequest}
        handleReviewUserCreationRequest={handleReviewUserCreationRequest}
        onSwitchToUserPanel={() => {
          sessionStorage.setItem('adminNotificationMode', 'user');
          setShowLeaveApprovalModal(false);
          setTimeout(() => {
            emit('open-user-notifications-modal');
          }, 50);
        }}
        userNotificationsCount={unreadUserNotificationsCount}
      />

      <RequestRemovalModal
        isOpen={showRequestRemovalModal}
        onClose={() => setShowRequestRemovalModal(false)}
        record={removalRecord}
        onSubmit={handleUserSubmitRemoval}
        submitting={submittingRemoval}
      />

      <AdminEditRecordModal
        showAdminEditModal={showAdminEditModal}
        setShowAdminEditModal={setShowAdminEditModal}
        profile={profile}
        profilesList={profilesList}
        adminEditRecord={adminEditRecord}
        adminEditDate={adminEditDate}
        setAdminEditDate={setAdminEditDate}
        adminEditLeaveType={adminEditLeaveType}
        setAdminEditLeaveType={setAdminEditLeaveType}
        adminEditSignInTime={adminEditSignInTime}
        setAdminEditSignInTime={setAdminEditSignInTime}
        adminEditSignOutTime={adminEditSignOutTime}
        setAdminEditSignOutTime={setAdminEditSignOutTime}
        adminEditLeaveHour={adminEditLeaveHour}
        setAdminEditLeaveHour={setAdminEditLeaveHour}
        adminEditAdjustment={adminEditAdjustment}
        setAdminEditAdjustment={setAdminEditAdjustment}
        adminEditAdjustShortLeave={adminEditAdjustShortLeave}
        setAdminEditAdjustShortLeave={setAdminEditAdjustShortLeave}
        adminEditComment={adminEditComment}
        setAdminEditComment={setAdminEditComment}
        handleAdminSaveEdit={handleAdminSaveEdit}
        submitting={submitting}
      />

      <AdminCancelAdjustmentModal
        showCancelAdjustmentModal={showCancelAdjustmentModal}
        setShowCancelAdjustmentModal={setShowCancelAdjustmentModal}
        cancelAdjustmentRecord={cancelAdjustmentRecord}
        setCancelAdjustmentRecord={setCancelAdjustmentRecord}
        handleConfirmCancelAdjustment={handleConfirmCancelAdjustment}
        profile={profile}
        adminActiveTab={adminActiveTab}
        submitting={submitting}
      />

      <AdminCreateUserModal
        showCreateUserModal={showCreateUserModal}
        setShowCreateUserModal={setShowCreateUserModal}
        profile={profile}
        setNewStaffPassword={setNewStaffPassword}
        newStaffUsername={newStaffUsername}
        setNewStaffUsername={setNewStaffUsername}
        newStaffRole={newStaffRole}
        setNewStaffRole={setNewStaffRole}
        newStaffNeedsApproval={newStaffNeedsApproval}
        setNewStaffNeedsApproval={setNewStaffNeedsApproval}
        newStaffAllowReserve={newStaffAllowReserve}
        setNewStaffAllowReserve={setNewStaffAllowReserve}
        newStaffAllowOvertime={newStaffAllowOvertime}
        setNewStaffAllowOvertime={setNewStaffAllowOvertime}
        creatingUser={creatingUser}
        setNewStaffConfirmPassword={setNewStaffConfirmPassword}
        handleCreateNewUser={handleCreateNewUser}
        newStaffEligibleOfficeLeave={newStaffEligibleOfficeLeave}
        setNewStaffEligibleOfficeLeave={setNewStaffEligibleOfficeLeave}
        newStaffEligibleGovtHoliday={newStaffEligibleGovtHoliday}
        setNewStaffEligibleGovtHoliday={setNewStaffEligibleGovtHoliday}
        profilesList={profilesList}
        newStaffSupervisorIds={newStaffSupervisorIds}
        setNewStaffSupervisorIds={setNewStaffSupervisorIds}
      />

      <AdminCredentialsModal
        showCredentialsModal={showCredentialsModal}
        setShowCredentialsModal={setShowCredentialsModal}
        profile={profile}
        credTargetUserId={credTargetUserId}
        setCredTargetUserId={setCredTargetUserId}
        credNewUsername={credNewUsername}
        setCredNewUsername={setCredNewUsername}
        credNewPassword={credNewPassword}
        setCredNewPassword={setCredNewPassword}
        credConfirmPassword={credConfirmPassword}
        setCredConfirmPassword={setCredConfirmPassword}
        updatingCredentials={updatingCredentials}
        handleUpdateCredentials={handleUpdateCredentials}
      />

      <AdminDeleteUserModal
        showDeleteUserModal={showDeleteUserModal}
        setShowDeleteUserModal={setShowDeleteUserModal}
        deleteTargetUser={deleteTargetUser}
        setDeleteTargetUser={setDeleteTargetUser}
        deletingUser={deletingUser}
        handleDeleteUser={handleDeleteUser}
        profile={profile}
      />
    </>,
    portalTarget
  );
};
