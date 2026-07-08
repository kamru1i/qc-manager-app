'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile, ChutiRecordWithProfile } from '@/types';
import { ChutiRecord, saveOfflineUpdate } from '@/utils/offlineSync';
import { formatDate, formatTimeToAMPM, getDetailedLeaveLabel, getExistingNotifications, createNotification } from '@/utils/dashboardHelpers';
import { sendPushNotification } from '@/utils/webPushHelper';

interface useAdjustmentOperationsParams {
  profile: Profile | null;
  adminActiveTab: 'user' | 'admin';
  isOnline: boolean;
  fetchRecords: () => Promise<void>;
  setUserRecords: React.Dispatch<React.SetStateAction<ChutiRecord[]>>;
  setAdminRecords: React.Dispatch<React.SetStateAction<ChutiRecordWithProfile[]>>;
  setMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
  setApprovingIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setApprovedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const useAdjustmentOperations = ({
  profile,
  adminActiveTab,
  isOnline,
  fetchRecords,
  setUserRecords,
  setAdminRecords,
  setMessage,
  submitting,
  setSubmitting,
  setApprovingIds,
  setApprovedIds,
}: useAdjustmentOperationsParams) => {
  // --- Adjustment activation states ---
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentRecord, setAdjustmentRecord] = useState<ChutiRecord | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'full' | 'partial'>('full');
  const [partialAdjustmentTime, setPartialAdjustmentTime] = useState('02:00');
  const [adjustShortLeaveOption, setAdjustShortLeaveOption] = useState(false);

  // --- Adjustment cancel states ---
  const [showCancelAdjustmentModal, setShowCancelAdjustmentModal] = useState(false);
  const [cancelAdjustmentRecord, setCancelAdjustmentRecord] = useState<ChutiRecord | null>(null);

  // Toggle Adjustment Status click trigger
  const handleToggleAdjustmentClick = (record: ChutiRecord) => {
    if (record.adjustment || record.adjusted_hour || record.reserve_adjustment_status === 'pending') {
      setCancelAdjustmentRecord(record);
      setShowCancelAdjustmentModal(true);
    } else {
      setAdjustmentRecord(record);
      setAdjustShortLeaveOption(record.adjust_short_leave === true);
      if (record.leave_type === 'Short Leave') {
        setAdjustmentType('full');
        setPartialAdjustmentTime(record.leave_hour ? record.leave_hour.toString().split('.')[0].substring(0, 5) : '02:00');
      }
      setShowAdjustmentModal(true);
    }
  };

  // Confirm cancel adjustment request
  const handleConfirmCancelAdjustment = async () => {
    if (!cancelAdjustmentRecord || submitting) return;
    setSubmitting(true);
    const record = cancelAdjustmentRecord;
    try {
      const isShortOrOvertime = record.leave_type === 'Short Leave' || record.leave_type === 'Overtime';
      const dateTimeStr = isShortOrOvertime
        ? `${formatDate(record.date)} (${formatTimeToAMPM(record.sign_in_time)} - ${formatTimeToAMPM(record.sign_out_time)})`
        : formatDate(record.date);
      const leaveLabel = getDetailedLeaveLabel(record);

      const existingNotifications = getExistingNotifications(record);
      const isAdmin = profile?.role === 'admin' && adminActiveTab === 'admin';

      let updates: Record<string, unknown> = {};

      if (isAdmin) {
        const newNotification = createNotification(
          'cancelled',
          'Leave Adjustment Cancelled ⚠️',
          `Your adjustment for ${leaveLabel} on date ${dateTimeStr} has been cancelled.`
        );

        updates = { 
          adjustment: false, 
          adjusted_hour: null, 
          adjust_short_leave: false,
          reserve_adjustment_status: 'none',
          admin_edit_request: {
            notifications: [...existingNotifications, newNotification]
          }
        };
      } else {
        updates = {
          reserve_adjustment_status: 'pending',
          admin_edit_request: {
            adjustment: false,
            adjusted_hour: null,
            adjust_short_leave: false,
            notifications: existingNotifications
          }
        };
      }

      setUserRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
      setAdminRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));

      if (!isOnline) {
        await saveOfflineUpdate(record.id || '', updates);
      } else {
        const { error } = await supabase
          .from('chuti')
          .update(updates)
          .eq('id', record.id || '');

        if (error) throw error;

        if (isAdmin) {
          if (record?.user_id) {
            const actionLabel = 'Leave Adjustment';
            sendPushNotification({
              userIds: [record.user_id],
              title: `${actionLabel} Cancelled ⚠️`,
              body: `Your adjustment for ${leaveLabel} on date ${dateTimeStr} has been cancelled.`,
              url: '/'
            }).catch(err => console.error('Error sending cancel push:', err));
          }
        } else {
          sendPushNotification({
            userIds: ['admins'],
            title: 'Leave Adjustment Cancellation Request 🔄',
            body: `${profile?.full_name || profile?.username || 'Staff'} has requested to cancel leave adjustment for (${record.leave_type}) on date ${formatDate(record.date)}.`,
            url: '/'
          }).catch(err => console.error('Error triggering cancel adjustment request push:', err));
        }
      }
      fetchRecords();
      setMessage({ 
        type: 'success', 
        text: isAdmin 
          ? 'Leave adjustment successfully cancelled.' 
          : 'Adjustment cancellation request successfully sent and is pending approval.' 
      });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message || 'Failed to cancel adjustment.' });
    } finally {
      setShowCancelAdjustmentModal(false);
      setCancelAdjustmentRecord(null);
      setSubmitting(false);
    }
  };

  // Save Adjustment details
  const handleSaveAdjustment = async (overrideAdjustShortLeave?: boolean, adjustmentCategoryInput?: string) => {
    if (!adjustmentRecord || submitting) return;
    setSubmitting(true);
    const record = adjustmentRecord;
    try {
      const isShortLeave = record.leave_type === 'Short Leave';
      const isAdmin = profile?.role === 'admin' && adminActiveTab === 'admin';
      let requestedUpdates: Record<string, unknown> = {};

      if (isShortLeave) {
        if (adjustmentType === 'full') {
          requestedUpdates = { adjustment: true, adjusted_hour: null, adjust_short_leave: false };
        } else {
          const timeRegex = /^([0-9]{1,2}):([0-5][0-9])$/;
          if (!timeRegex.test(partialAdjustmentTime)) {
            setMessage({ type: 'error', text: 'Please use correct time format (e.g. 02:30).' });
            setSubmitting(false);
            return;
          }
          requestedUpdates = { adjustment: false, adjusted_hour: `${partialAdjustmentTime}:00`, adjust_short_leave: false };
        }
      } else if (record.leave_type === 'Overtime') {
        const shouldAdjust = overrideAdjustShortLeave !== undefined ? overrideAdjustShortLeave : adjustShortLeaveOption;
        requestedUpdates = { adjustment: true, adjusted_hour: null, adjust_short_leave: shouldAdjust };
      } else {
        const selectedCat = adjustmentCategoryInput || 'None';
        const isCat = selectedCat !== 'None';
        let cleanComment = record.comment || '';
        // Clean any existing prefixes
        cleanComment = cleanComment.replace(/Adjusted:\s*(?:Govt Holiday|Eid-ul-Fitr|Eid-ul-Adha|Office Leave)(?:\s*\|\s*)?/g, '').trim();
        const finalComment = isCat 
          ? `Adjusted: ${selectedCat}${cleanComment ? ` | ${cleanComment}` : ''}`
          : cleanComment;

        requestedUpdates = { 
          adjustment: true, 
          adjusted_hour: null, 
          adjust_short_leave: false,
          reserve_holiday: isCat ? selectedCat : null,
          comment: finalComment || null
        };
      }

      let updates: Record<string, unknown> = {};
      const existingNotifications = getExistingNotifications(record);

      if (isAdmin) {
        const actionLabel = 'Leave Adjustment';
        const leaveLabel = getDetailedLeaveLabel(record);
        const isShortOrOvertime = record.leave_type === 'Short Leave' || record.leave_type === 'Overtime';
        const dateTimeStr = isShortOrOvertime
          ? `${formatDate(record.date)} (${formatTimeToAMPM(record.sign_in_time)} - ${formatTimeToAMPM(record.sign_out_time)})`
          : formatDate(record.date);

        const newNotification = createNotification(
          'adjusted',
          `${actionLabel} Completed ✅`,
          `Your ${leaveLabel} adjustment for date ${dateTimeStr} has been completed.`
        );

        updates = {
          ...requestedUpdates,
          reserve_adjustment_status: 'none',
          admin_edit_request: {
            notifications: [...existingNotifications, newNotification]
          }
        };
      } else {
        updates = {
          reserve_adjustment_status: 'pending',
          admin_edit_request: {
            ...requestedUpdates,
            notifications: existingNotifications
          }
        };
      }

      setUserRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
      setAdminRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));

      if (!isOnline) {
        await saveOfflineUpdate(record.id || '', updates);
      } else {
        const { error } = await supabase
          .from('chuti')
          .update(updates)
          .eq('id', record.id || '');

        if (error) throw error;
      }
      fetchRecords();

      if (!isAdmin) {
        sendPushNotification({
          userIds: ['admins'],
          title: 'Leave Adjustment Request 🔄',
          body: `${profile?.full_name || profile?.username || 'Staff'} has requested leave adjustment for (${record.leave_type}) on date ${formatDate(record.date)}.`,
          url: '/'
        }).catch(err => console.error('Error triggering push notification for adjustment:', err));
      } else if (record?.user_id) {
        const actionLabel = 'Leave Adjustment';
        const leaveLabel = getDetailedLeaveLabel(record);
        const isShortOrOvertime = record.leave_type === 'Short Leave' || record.leave_type === 'Overtime';
        const dateTimeStr = isShortOrOvertime
          ? `${formatDate(record.date)} (${formatTimeToAMPM(record.sign_in_time)} - ${formatTimeToAMPM(record.sign_out_time)})`
          : formatDate(record.date);

        sendPushNotification({
          userIds: [record.user_id],
          title: `${actionLabel} Completed ✅`,
          body: `Your ${leaveLabel} adjustment for date ${dateTimeStr} has been completed.`,
          url: '/'
        }).catch(err => console.error('Error sending adjustment push to user:', err));
      }

      setMessage({ 
        type: 'success', 
        text: isAdmin
          ? 'Leave adjustment successfully completed.'
          : 'Adjustment request successfully sent and is pending approval.'
      });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message || 'An error occurred while processing adjustment.' });
    } finally {
      setShowAdjustmentModal(false);
      setAdjustmentRecord(null);
      setSubmitting(false);
    }
  };

  // Approve Reserve/Overtime Adjustment Request
  const handleApproveReserveAdjustment = async (record: ChutiRecordWithProfile, approve: boolean) => {
    setApprovingIds(prev => new Set(prev).add(record.id));
    try {
      const isCancelRequest = record.admin_edit_request && typeof record.admin_edit_request === 'object' && record.admin_edit_request.adjustment === false;
      const updates: Record<string, unknown> = {};

      if (isCancelRequest) {
        if (approve) {
          updates.reserve_adjustment_status = 'none';
          updates.adjustment = false;
          updates.adjusted_hour = null;
          updates.adjust_short_leave = false;
        } else {
          updates.reserve_adjustment_status = 'approved';
        }
      } else {
        updates.reserve_adjustment_status = approve ? 'approved' : 'rejected';
        if (approve) {
          if (record.admin_edit_request && typeof record.admin_edit_request === 'object') {
            updates.adjustment = record.admin_edit_request.adjustment === true;
            updates.adjusted_hour = record.admin_edit_request.adjusted_hour || null;
            updates.adjust_short_leave = record.admin_edit_request.adjust_short_leave === true;
          } else {
            updates.adjustment = true;
            updates.adjusted_hour = null;
          }
        } else {
          updates.adjustment = false;
          updates.adjusted_hour = null;
          updates.adjust_short_leave = false;
        }
      }

      const adminName = profile?.full_name ? `Admin ${profile.full_name}` : 'Admin';
      const leaveLabel = getDetailedLeaveLabel(record);
      const isShortOrOvertime = record.leave_type === 'Short Leave' || record.leave_type === 'Overtime';
      const dateTimeStr = isShortOrOvertime
        ? `${formatDate(record.date)} (${formatTimeToAMPM(record.sign_in_time)} - ${formatTimeToAMPM(record.sign_out_time)})`
        : formatDate(record.date);

      const requestTypeLabel = isCancelRequest ? 'adjustment cancellation' : 'adjustment';

      const bodyText = approve 
        ? `${adminName} approved your ${requestTypeLabel} request for ${leaveLabel} on date ${dateTimeStr}.`
        : `Your ${requestTypeLabel} request for ${leaveLabel} on date ${dateTimeStr} has been rejected.`;

      const existingNotifications = getExistingNotifications(record);

      const titleLabel = isCancelRequest 
        ? 'Leave Adjustment Cancellation' 
        : 'Leave Adjustment';

      const newNotification = createNotification(
        approve ? 'approved' : 'rejected',
        `${titleLabel} ${approve ? 'Approved ✅' : 'Rejected ❌'}`,
        bodyText
      );

      updates.admin_edit_request = {
        notifications: [...existingNotifications, newNotification]
      };

      if (record.status === 'approved_by_supervisor') {
        updates.status = approve ? 'approved' : 'needs_review';
      }

      const { error } = await supabase
        .from('chuti')
        .update(updates)
        .eq('id', record.id || '');
      
      if (error) throw error;

      if (record?.user_id) {
        sendPushNotification({
          userIds: [record.user_id],
          title: `${titleLabel} ${approve ? 'Approved ✅' : 'Rejected ❌'}`,
          body: bodyText,
          url: '/'
        }).catch(err => console.error('Error sending adjustment response push:', err));
      }
      
      const updateLocalState = () => {
        setUserRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
        setAdminRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
        fetchRecords();
      };

      setApprovingIds(prev => { const s = new Set(prev); s.delete(record.id); return s; });
      if (approve) {
        setApprovedIds(prev => new Set(prev).add(record.id));
        setTimeout(() => {
          setApprovedIds(prev => { const s = new Set(prev); s.delete(record.id); return s; });
          updateLocalState();
        }, 1500);
      } else {
        updateLocalState();
      }

      setMessage({ type: 'success', text: approve ? 'Adjustment approved.' : 'Request rejected.' });
    } catch (err) {
      setApprovingIds(prev => { const s = new Set(prev); s.delete(record.id); return s; });
      setMessage({ type: 'error', text: 'Failed to complete action: ' + (err as Error).message });
    }
  };

  return {
    showAdjustmentModal,
    setShowAdjustmentModal,
    adjustmentRecord,
    setAdjustmentRecord,
    adjustmentType,
    setAdjustmentType,
    partialAdjustmentTime,
    setPartialAdjustmentTime,
    adjustShortLeaveOption,
    setAdjustShortLeaveOption,
    showCancelAdjustmentModal,
    setShowCancelAdjustmentModal,
    cancelAdjustmentRecord,
    setCancelAdjustmentRecord,

    handleToggleAdjustmentClick,
    handleConfirmCancelAdjustment,
    handleSaveAdjustment,
    handleApproveReserveAdjustment,
  };
};
