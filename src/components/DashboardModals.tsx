import React from 'react';
import { createPortal } from 'react-dom';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { ChutiRecordWithProfile, GovtHolidayResponse } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';

import { WelcomeModals } from '@/components/modals/WelcomeModals';
import { AdminAddLeaveModal } from '@/components/modals/AdminAddLeaveModal';
import { UserRevisionModal } from '@/components/modals/UserRevisionModal';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { AdjustmentModal } from '@/components/modals/AdjustmentModal';
import { SupervisorApprovalModal } from '@/components/modals/SupervisorApprovalModal';
import { AdminProfileSettingsModal } from '@/components/modals/AdminProfileSettingsModal';
import { AdminLeaveApprovalModal } from '@/components/modals/AdminLeaveApprovalModal';
import { AdminEditRecordModal } from '@/components/modals/AdminEditRecordModal';
import { AdminCancelAdjustmentModal } from '@/components/modals/AdminCancelAdjustmentModal';
import { AdminCreateUserModal } from '@/components/modals/AdminCreateUserModal';
import { AdminCredentialsModal } from '@/components/modals/AdminCredentialsModal';
import { AdminDeleteUserModal } from '@/components/modals/AdminDeleteUserModal';

export const DashboardModals = () => {
  const { dashboardData, derivedState, chutiOps, adjustmentOps, adminStaffOps } = useDashboardContext();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    sessionUser,
    profile,
    isPushSubscribed,
    setIsPushSubscribed,
    isPushLoading,
    setIsPushLoading,
    submitting,
    userRecords,
    adminRecords,
    profilesList,
    leaveSettlements,
    adminActiveTab,
    setAdminActiveTab,
    viewingStaffId,
    setViewingStaffId,
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

    showProfileSettingsModal,
    setShowProfileSettingsModal,
    editingStaffProfileId,
    isCodenameEditable,
    setIsCodenameEditable,
    editUsername,
    setEditUsername,
    editFullName,
    setEditFullName,
    editJobRole,
    setEditJobRole,
    editWorkingHours,
    setEditWorkingHours,
    editBreakTime,
    setEditBreakTime,
    profileSignInTime,
    setProfileSignInTime,
    profileSignOutTime,
    setProfileSignOutTime,
    editNeedsApproval,
    setEditNeedsApproval,
    editAllowReserve,
    setEditAllowReserve,
    editAllowOvertime,
    setEditAllowOvertime,
    editEligibleOfficeLeave,
    setEditEligibleOfficeLeave,
    editEligibleGovtHoliday,
    setEditEligibleGovtHoliday,
    isEditRequestMode,
    setIsEditRequestMode,

    handleUpdateSettings,
    handleApproveProfileChangeRequest,
    handleApprovePasswordResetRequest,
    newStaffSupervisorIds,
    setNewStaffSupervisorIds,
    editSupervisorIds,
    setEditSupervisorIds,
  } = adminStaffOps;

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
            window.dispatchEvent(new CustomEvent('open-user-notifications-modal'));
          }, 50);
        }}
        showRevisionPromptModal={showRevisionPromptModal}
        setShowRevisionPromptModal={setShowRevisionPromptModal}
        submittingRevision={submittingRevision}
        setRevisionPromptChutiId={setRevisionPromptChutiId}
        setRevisionPromptText={setRevisionPromptText}
        revisionPromptText={revisionPromptText}
        submitRevisionWithReason={submitRevisionWithReason}
      />

      <AdminProfileSettingsModal
        showProfileSettingsModal={showProfileSettingsModal}
        setShowProfileSettingsModal={setShowProfileSettingsModal}
        profile={profile}
        editingStaffProfileId={editingStaffProfileId}
        sessionUser={sessionUser}
        isPushSubscribed={isPushSubscribed}
        setIsPushSubscribed={setIsPushSubscribed}
        isPushLoading={isPushLoading}
        setIsPushLoading={setIsPushLoading}
        adminActiveTab={adminActiveTab}
        setAdminActiveTab={setAdminActiveTab}
        setViewingStaffId={setViewingStaffId}
        isCodenameEditable={isCodenameEditable}
        setIsCodenameEditable={setIsCodenameEditable}
        editUsername={editUsername}
        setEditUsername={setEditUsername}
        editFullName={editFullName}
        setEditFullName={setEditFullName}
        editJobRole={editJobRole}
        setEditJobRole={setEditJobRole}
        editWorkingHours={editWorkingHours}
        setEditWorkingHours={setEditWorkingHours}
        editBreakTime={editBreakTime}
        setEditBreakTime={setEditBreakTime}
        profileSignInTime={profileSignInTime}
        setProfileSignInTime={setProfileSignInTime}
        profileSignOutTime={profileSignOutTime}
        setProfileSignOutTime={setProfileSignOutTime}
        editNeedsApproval={editNeedsApproval}
        setEditNeedsApproval={setEditNeedsApproval}
        editAllowReserve={editAllowReserve}
        setEditAllowReserve={setEditAllowReserve}
        editAllowOvertime={editAllowOvertime}
        setEditAllowOvertime={setEditAllowOvertime}
        editEligibleOfficeLeave={editEligibleOfficeLeave}
        setEditEligibleOfficeLeave={setEditEligibleOfficeLeave}
        editEligibleGovtHoliday={editEligibleGovtHoliday}
        setEditEligibleGovtHoliday={setEditEligibleGovtHoliday}
        isEditRequestMode={isEditRequestMode}
        setIsEditRequestMode={setIsEditRequestMode}
        setupSubmitting={setupSubmitting}
        handleUpdateSettings={handleUpdateSettings}
        profilesList={profilesList}
        editSupervisorIds={editSupervisorIds}
        setEditSupervisorIds={setEditSupervisorIds}
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
        reviewingIds={reviewingIds}
        approvedIds={approvedIds}
        approvingIds={approvingIds}
        handleApproveChutiRequest={handleApproveChutiRequest}
        pendingReserveRequests={pendingReserveRequests}
        handleApproveReserveAdjustment={handleApproveReserveAdjustment}
        pendingProfileRequests={pendingProfileRequests}
        handleApproveProfileChangeRequest={handleApproveProfileChangeRequest}
        adminHolidayNotifications={adminHolidayNotifications}
        pendingPasswordResetRequests={pendingPasswordResetRequests}
        handleApprovePasswordResetRequest={handleApprovePasswordResetRequest}
        onSwitchToUserPanel={() => {
          sessionStorage.setItem('adminNotificationMode', 'user');
          setShowLeaveApprovalModal(false);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-user-notifications-modal'));
          }, 50);
        }}
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
