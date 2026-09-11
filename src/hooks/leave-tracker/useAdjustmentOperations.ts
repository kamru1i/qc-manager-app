'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile, ChutiRecordWithProfile } from '@/types';
import { ChutiRecord, saveOfflineUpdate } from '@/utils/offlineSync';
import { 
  formatDate, 
  formatTimeToAMPM, 
  getDetailedLeaveLabel, 
  getExistingNotifications, 
  createNotification, 
  formatLeaveDuration, 
  getCleanComment, 
  getApprovalsPrefix,
  parseIntervalToMinutes,
  formatDuration,
  calculateStats,
  getRecordAdjustedMinutes,
  getRecordRemainingMinutes,
  getRecordAdjustmentEntries,
  LeaveAdjustmentEntry
} from '@/utils/dashboardHelpers';
import { isAdminRole, isSuperadmin } from '@/utils/permissionService';

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

  // Open adjustment modal for additional adjustment on partially adjusted record
  const handleOpenAdditionalAdjustment = (record: ChutiRecord) => {
    setAdjustmentRecord(record);
    setAdjustShortLeaveOption(record.adjust_short_leave === true);
    if (['Short Leave', 'Early Leave', 'Late Join'].includes(record.leave_type)) {
      const remMins = getRecordRemainingMinutes(record);
      setAdjustmentType('full');
      setPartialAdjustmentTime(formatDuration(remMins));
    }
    setShowAdjustmentModal(true);
  };

  // Toggle Adjustment Status click trigger
  const handleToggleAdjustmentClick = (record: ChutiRecord) => {
    const isPartialLeave = ['Short Leave', 'Early Leave', 'Late Join'].includes(record.leave_type);
    const remMins = isPartialLeave ? getRecordRemainingMinutes(record) : 0;

    // If fully adjusted or pending, open cancel modal
    if (record.adjustment || record.reserve_adjustment_status === 'pending' || (isPartialLeave && remMins === 0)) {
      setCancelAdjustmentRecord(record);
      setShowCancelAdjustmentModal(true);
    } else if (record.adjusted_hour && isPartialLeave && remMins > 0) {
      // Partially adjusted: toggle switch allows cancellation, or opening additional adjustment
      setCancelAdjustmentRecord(record);
      setShowCancelAdjustmentModal(true);
    } else {
      setAdjustmentRecord(record);
      setAdjustShortLeaveOption(record.adjust_short_leave === true);
      if (isPartialLeave) {
        setAdjustmentType('full');
        setPartialAdjustmentTime(record.leave_hour ? record.leave_hour.toString().split('.')[0].substring(0, 5) : '00:30');
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
      const isShortOrOvertime = ['Short Leave', 'Early Leave', 'Late Join', 'Overtime'].includes(record.leave_type);
      const dateTimeStr = isShortOrOvertime
        ? `${formatDate(record.date)} (${formatTimeToAMPM(record.sign_in_time)} - ${formatTimeToAMPM(record.sign_out_time)})`
        : formatDate(record.date);
      const leaveLabel = getDetailedLeaveLabel(record);

      const existingNotifications = getExistingNotifications(record);
      const isAdmin = isAdminRole(profile) && adminActiveTab === 'admin';

      let updates: Record<string, unknown> = {};

      if (isAdmin) {
        const newNotification = createNotification(
          'cancelled',
          'Leave Adjustment Cancelled ⚠️',
          `Your adjustment for ${leaveLabel} on date ${dateTimeStr} has been cancelled.`
        );

        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const restoredComment = cleanComment
          ? (approvalsPrefix ? `${approvalsPrefix} | ${cleanComment}` : cleanComment)
          : (approvalsPrefix || null);

        updates = { 
          adjustment: false, 
          adjusted_hour: null, 
          adjust_short_leave: false,
          reserve_holiday: null,
          reserve_adjustment_status: 'none',
          comment: restoredComment,
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
  const handleSaveAdjustment = async (
    overrideAdjustShortLeave?: boolean,
    adjustmentCategoryInput?: string,
    specificHoliday?: { date: string; name: string } | null,
    salaryInfo?: { month: string; year: string } | null,
    generalDetails?: string | null
  ) => {
    if (!adjustmentRecord || submitting) return;
    setSubmitting(true);
    const record = adjustmentRecord;
    try {
      const isPartialLeave = ['Short Leave', 'Early Leave', 'Late Join'].includes(record.leave_type);
      const isAdmin = isAdminRole(profile) && adminActiveTab === 'admin';
      const selectedCat = adjustmentCategoryInput || 'None';

      // Permission verification for normal users
      if (!isAdmin) {
        if (record.leave_type === 'Overtime' && !profile?.allow_overtime) {
          setMessage({ type: 'error', text: 'You do not have permission for Overtime adjustments.' });
          setSubmitting(false);
          return;
        }
        if (isPartialLeave && !profile?.allow_overtime) {
          setMessage({ type: 'error', text: 'You do not have permission for Short Leave / Partial Leave adjustments.' });
          setSubmitting(false);
          return;
        }
        if (record.leave_type === 'Full Leave' && selectedCat === 'Govt Holiday' && !profile?.allow_reserve) {
          setMessage({ type: 'error', text: 'You do not have permission for Government Holiday Reserve adjustments.' });
          setSubmitting(false);
          return;
        }
      }

      let requestedUpdates: Record<string, unknown> = {};

      if (selectedCat === 'Salary') {
        const salaryLabel = salaryInfo ? `${salaryInfo.month} ${salaryInfo.year}` : `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const adjMessage = `Adjusted with ${salaryLabel} salary deduction.`;
        const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${adjMessage}${cleanComment ? ` | ${cleanComment}` : ''}`;
        requestedUpdates = { 
          adjustment: true, 
          adjusted_hour: null, 
          adjust_short_leave: false, 
          reserve_holiday: 'Salary',
          comment: finalComment || null,
          admin_edit_request: {
            salary_month: salaryInfo?.month || null,
            salary_year: salaryInfo?.year || null,
          }
        };
      } else if (selectedCat === 'Govt Holiday' && specificHoliday) {
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const adjMessage = `Adjusted with Government Holiday on ${formatDate(specificHoliday.date)} — ${specificHoliday.name}`;
        const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${adjMessage}${cleanComment ? ` | ${cleanComment}` : ''}`;
        requestedUpdates = {
          adjustment: true,
          adjusted_hour: null,
          adjust_short_leave: false,
          reserve_holiday: `${specificHoliday.date} — ${specificHoliday.name}`,
          comment: finalComment || null,
          admin_edit_request: {
            holiday_date: specificHoliday.date,
            holiday_name: specificHoliday.name,
          }
        };
      } else if (selectedCat === 'General Adjustment' || (record.leave_type === 'Full Leave' && selectedCat === 'None')) {
        const reason = generalDetails?.trim() || '';
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const adjMessage = reason ? `Adjusted with General Adjustment — ${reason}` : 'Adjusted with General Adjustment';
        const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${adjMessage}${cleanComment ? ` | ${cleanComment}` : ''}`;
        requestedUpdates = {
          adjustment: true,
          adjusted_hour: null,
          adjust_short_leave: false,
          reserve_holiday: 'General Adjustment',
          comment: finalComment || null,
          admin_edit_request: {
            adjustment_source: 'General Adjustment',
            adjustment_reason: reason,
          }
        };
      } else if (isPartialLeave) {
        const originalMins = record.leave_hour ? parseIntervalToMinutes(record.leave_hour) : 0;
        const alreadyAdjustedMins = getRecordAdjustedMinutes(record);
        const remainingMins = Math.max(0, originalMins - alreadyAdjustedMins);

        if (remainingMins <= 0) {
          setMessage({ type: 'error', text: 'This leave record is already fully adjusted.' });
          setSubmitting(false);
          return;
        }

        let amountToAdjust = remainingMins;
        let adjSource = selectedCat;
        let adjMessage = '';

        if (selectedCat === 'Overtime') {
          adjSource = 'Overtime';

          // Query approved records for this user in the relevant year to obtain available Overtime balance
          const recordYear = record.date ? record.date.substring(0, 4) : new Date().getFullYear().toString();
          let availableOvertimeMins = 0;
          try {
            const { data: userApprovedRecords, error: fetchErr } = await supabase
              .from('chuti')
              .select('*')
              .eq('user_id', record.user_id)
              .eq('status', 'approved')
              .gte('date', `${recordYear}-01-01`)
              .lte('date', `${recordYear}-12-31`);

            if (!fetchErr && userApprovedRecords) {
              const userStats = calculateStats(userApprovedRecords as ChutiRecord[], profile?.working_hours || 9.5);
              availableOvertimeMins = parseIntervalToMinutes(userStats.overtimeHours);
            }
          } catch (e) {
            console.error('Failed to compute available overtime balance:', e);
          }

          if (availableOvertimeMins <= 0) {
            setMessage({ type: 'error', text: 'No available Overtime balance to adjust.' });
            setSubmitting(false);
            return;
          }

          if (adjustmentType === 'partial') {
            const timeRegex = /^([0-9]{1,2}):([0-5][0-9])$/;
            if (!timeRegex.test(partialAdjustmentTime)) {
              setMessage({ type: 'error', text: 'Please use correct time format (e.g. 00:30).' });
              setSubmitting(false);
              return;
            }
            amountToAdjust = parseIntervalToMinutes(partialAdjustmentTime);
          } else {
            // Full adjustment: Cap to available Overtime balance
            amountToAdjust = Math.min(remainingMins, availableOvertimeMins);
          }

          if (amountToAdjust <= 0) {
            setMessage({ type: 'error', text: 'Adjustment time must be greater than zero.' });
            setSubmitting(false);
            return;
          }
          if (amountToAdjust > remainingMins) {
            setMessage({ type: 'error', text: `Adjustment amount (${formatDuration(amountToAdjust)}) cannot exceed remaining leave duration (${formatDuration(remainingMins)}).` });
            setSubmitting(false);
            return;
          }
          if (amountToAdjust > availableOvertimeMins) {
            setMessage({ type: 'error', text: `Adjustment amount (${formatDuration(amountToAdjust)}) cannot exceed available Overtime (${formatDuration(availableOvertimeMins)}).` });
            setSubmitting(false);
            return;
          }
          adjMessage = `${formatDuration(amountToAdjust)} minutes of ${record.leave_type} adjusted with Overtime`;
        } else if (selectedCat === 'None' || selectedCat === 'General Adjustment') {
          adjSource = 'General Adjustment';
          if (adjustmentType === 'partial') {
            const timeRegex = /^([0-9]{1,2}):([0-5][0-9])$/;
            if (!timeRegex.test(partialAdjustmentTime)) {
              setMessage({ type: 'error', text: 'Please use correct time format (e.g. 00:30).' });
              setSubmitting(false);
              return;
            }
            amountToAdjust = parseIntervalToMinutes(partialAdjustmentTime);
          } else {
            amountToAdjust = remainingMins;
          }

          if (amountToAdjust <= 0) {
            setMessage({ type: 'error', text: 'Adjustment time must be greater than zero.' });
            setSubmitting(false);
            return;
          }
          if (amountToAdjust > remainingMins) {
            setMessage({ type: 'error', text: `Adjustment amount (${formatDuration(amountToAdjust)}) cannot exceed remaining leave duration (${formatDuration(remainingMins)}).` });
            setSubmitting(false);
            return;
          }
          const reason = generalDetails?.trim();
          adjMessage = reason 
            ? `${formatDuration(amountToAdjust)} minutes of ${record.leave_type} adjusted with General Adjustment — ${reason}`
            : `${formatDuration(amountToAdjust)} minutes of ${record.leave_type} adjusted with General Adjustment`;
        } else if (selectedCat === 'Govt Holiday' && specificHoliday) {
          adjSource = 'Govt Holiday';
          amountToAdjust = remainingMins;
          adjMessage = `Adjusted with Government Holiday on ${formatDate(specificHoliday.date)} — ${specificHoliday.name}`;
        } else if (selectedCat === 'Salary') {
          adjSource = 'Salary';
          amountToAdjust = remainingMins;
          const salaryLabel = salaryInfo ? `${salaryInfo.month} ${salaryInfo.year}` : `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;
          adjMessage = `Adjusted with ${salaryLabel} salary deduction`;
        } else if (selectedCat === 'Eid-ul-Fitr' || selectedCat === 'Eid-ul-Adha') {
          adjSource = selectedCat;
          amountToAdjust = remainingMins;
          adjMessage = `Adjusted with ${selectedCat}`;
        }

        const existingAdjustments = getRecordAdjustmentEntries(record);
        const newEntry: LeaveAdjustmentEntry = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `adj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          amount_minutes: amountToAdjust,
          source: adjSource,
          source_date: specificHoliday?.date || null,
          source_name: specificHoliday?.name || null,
          salary_month: salaryInfo?.month || null,
          salary_year: salaryInfo?.year || null,
          reason: generalDetails?.trim() || null,
          action_date: new Date().toISOString(),
          comment: adjMessage,
          adjusted_by: profile?.id || null
        };

        const updatedAdjustments = [...existingAdjustments, newEntry];
        const newTotalAdjusted = updatedAdjustments.reduce((sum, a) => sum + (Number(a.amount_minutes) || 0), 0);
        const newRemaining = Math.max(0, originalMins - newTotalAdjusted);
        const isFullyAdjusted = (newRemaining === 0);
        const formattedAdjHour = `${formatDuration(newTotalAdjusted)}:00`;

        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${adjMessage}${cleanComment ? ` | ${cleanComment}` : ''}`;

        requestedUpdates = {
          adjustment: isFullyAdjusted,
          adjusted_hour: formattedAdjHour,
          adjust_short_leave: false,
          reserve_holiday: isFullyAdjusted 
            ? (updatedAdjustments.length === 1 ? updatedAdjustments[0].source : 'Multiple Adjustments') 
            : (adjSource === 'General Adjustment' ? 'General Adjustment' : (record.reserve_holiday || adjSource)),
          comment: finalComment || null,
          admin_edit_request: {
            adjustments: updatedAdjustments,
            last_adjustment_source: adjSource,
            last_adjusted_at: new Date().toISOString()
          }
        };
      } else if (record.leave_type === 'Overtime') {
        const shouldAdjust = overrideAdjustShortLeave !== undefined ? overrideAdjustShortLeave : adjustShortLeaveOption;
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const finalComment = shouldAdjust ? `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}Adjusted: Short Leave${cleanComment ? ` | ${cleanComment}` : ''}` : (cleanComment ? `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${cleanComment}` : (approvalsPrefix || null));
        requestedUpdates = { adjustment: true, adjusted_hour: null, adjust_short_leave: shouldAdjust, reserve_holiday: null, comment: finalComment || null };
      } else {
        const isCat = selectedCat !== 'None';
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const finalComment = isCat 
          ? `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}Adjusted: ${selectedCat}${cleanComment ? ` | ${cleanComment}` : ''}`
          : (cleanComment ? `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${cleanComment}` : (approvalsPrefix || null));

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
        let notifTitle = 'Leave Adjustment Completed ✅';
        let notifBody = '';

        if (selectedCat === 'Salary') {
          const salaryLabel = salaryInfo ? `${salaryInfo.month} ${salaryInfo.year}` : `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;
          notifTitle = 'Salary Adjustment Applied 💸';
          notifBody = `Your leave for ${formatDate(record.date)} has been adjusted with ${salaryLabel} salary deduction.`;
        } else if (selectedCat === 'Govt Holiday' && specificHoliday) {
          notifTitle = 'Government Holiday Adjustment Applied 📅';
          notifBody = `Your leave for ${formatDate(record.date)} has been adjusted with the Government Holiday of ${formatDate(specificHoliday.date)} — ${specificHoliday.name}.`;
        } else if (selectedCat === 'General Adjustment' || (record.leave_type === 'Full Leave' && selectedCat === 'None')) {
          notifTitle = 'Leave Adjusted (General) ⚙️';
          notifBody = `Your Full Leave on ${formatDate(record.date)} has been adjusted: ${generalDetails?.trim() || 'General Adjustment'}.`;
        } else {
          const leaveLabel = getDetailedLeaveLabel(record);
          const isShortOrOvertime = ['Short Leave', 'Early Leave', 'Late Join', 'Overtime'].includes(record.leave_type);
          const dateTimeStr = isShortOrOvertime
            ? `${formatDate(record.date)} (${formatTimeToAMPM(record.sign_in_time)} - ${formatTimeToAMPM(record.sign_out_time)})`
            : formatDate(record.date);
          notifBody = `Your ${leaveLabel} adjustment for date ${dateTimeStr} has been completed.`;
        }

        const newNotification = createNotification(
          'adjusted',
          notifTitle,
          notifBody
        );

        const mergedMeta = {
          ...((record.admin_edit_request as Record<string, unknown>) || {}),
          ...((requestedUpdates.admin_edit_request as Record<string, unknown>) || {}),
          notifications: [...existingNotifications, newNotification]
        };

        updates = {
          ...requestedUpdates,
          reserve_adjustment_status: 'none',
          admin_edit_request: mergedMeta
        };
      } else {
        const mergedMeta = {
          ...((record.admin_edit_request as Record<string, unknown>) || {}),
          ...((requestedUpdates.admin_edit_request as Record<string, unknown>) || {}),
          notifications: existingNotifications
        };

        updates = {
          ...requestedUpdates,
          reserve_adjustment_status: 'pending',
          admin_edit_request: mergedMeta
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

      setMessage({ 
        type: 'success', 
        text: isAdmin
          ? (selectedCat === 'Salary' ? 'Leave adjusted with salary deduction.' : 'Leave adjustment successfully completed.')
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
          const cleanComment = getCleanComment(record.comment);
          const approvalsPrefix = getApprovalsPrefix(record.comment);
          const restoredComment = cleanComment
            ? (approvalsPrefix ? `${approvalsPrefix} | ${cleanComment}` : cleanComment)
            : (approvalsPrefix || null);

          updates.reserve_adjustment_status = 'none';
          updates.adjustment = false;
          updates.adjusted_hour = null;
          updates.adjust_short_leave = false;
          updates.reserve_holiday = null;
          updates.comment = restoredComment;
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
          const cleanComment = getCleanComment(record.comment);
          const approvalsPrefix = getApprovalsPrefix(record.comment);
          const restoredComment = cleanComment
            ? (approvalsPrefix ? `${approvalsPrefix} | ${cleanComment}` : cleanComment)
            : (approvalsPrefix || null);

          updates.adjustment = false;
          updates.adjusted_hour = null;
          updates.adjust_short_leave = false;
          updates.reserve_holiday = null;
          updates.comment = restoredComment;
        }
      }

      const adminName = isSuperadmin(profile)
        ? 'Admin'
        : (profile?.full_name ? `Admin ${profile.full_name}` : 'Admin');
      const leaveLabel = getDetailedLeaveLabel(record);
      const isShortOrOvertime = ['Short Leave', 'Early Leave', 'Late Join', 'Overtime'].includes(record.leave_type);
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
    handleOpenAdditionalAdjustment,
    handleConfirmCancelAdjustment,
    handleSaveAdjustment,
    handleApproveReserveAdjustment,
  };
};
