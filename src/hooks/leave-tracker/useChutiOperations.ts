'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { CHUTI_COLUMNS } from '@/utils/dbColumns';
import { Profile, ChutiRecordWithProfile } from '@/types';
import { 
  ChutiRecord, 
  saveOfflineRecord, 
  getOfflineRecords, 
  saveOfflineDelete, 
  deleteOfflineRecord,
  removeCacheItems
} from '@/utils/offlineSync';
import { generateUUID } from '@/utils/idbStoreFactory';
import { formatDate, calculateLeaveOrOvertime, getExistingNotifications, createNotification, calculateStats, parseIntervalToMinutes, GlobalSettings, checkIfHolidayOrWeekend, getLeaveValidationError, getMaxDaysInMonth, getCleanComment, getApprovalsPrefix } from '@/utils/dashboardHelpers';
import { toast } from 'sonner';
import { isAdminRole } from '@/utils/permissionService';
import { chutiService } from '@/services/chutiService';

interface useChutiOperationsParams {
  sessionUser: any;
  profile: Profile | null;
  isOnline: boolean;
  fetchRecords: () => Promise<void>;
  checkOfflineQueue: () => Promise<void>;
  userRecords: ChutiRecord[];
  setUserRecords: React.Dispatch<React.SetStateAction<ChutiRecord[]>>;
  adminRecords: ChutiRecordWithProfile[];
  setAdminRecords: React.Dispatch<React.SetStateAction<ChutiRecordWithProfile[]>>;
  setMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
  profilesList: Profile[];
  approvingIds: Set<string>;
  setApprovingIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  reviewingIds: Set<string>;
  setReviewingIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  approvedIds: Set<string>;
  setApprovedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  globalSettings: GlobalSettings;
}

export const useChutiOperations = ({
  sessionUser,
  profile,
  isOnline,
  fetchRecords,
  checkOfflineQueue,
  userRecords,
  setUserRecords,
  adminRecords,
  setAdminRecords,
  setMessage,
  submitting,
  setSubmitting,
  profilesList,
  approvingIds,
  setApprovingIds,
  reviewingIds,
  setReviewingIds,
  approvedIds,
  setApprovedIds,
  globalSettings,
}: useChutiOperationsParams) => {
  // --- Form states for Adding Leave ---
  const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
  const [date, setDate] = useState('');
  const [leaveType, setLeaveType] = useState('Short Leave');
  const [adjustment, setAdjustment] = useState(false);
  const [adjustmentCategory, setAdjustmentCategory] = useState('None');
  const [adjustShortLeave, setAdjustShortLeave] = useState(false);
  const [signInTime, setSignInTime] = useState('13:00');
  const [signOutTime, setSignOutTime] = useState('22:30');
  const [leaveHour, setLeaveHour] = useState('00:00');
  const [comment, setComment] = useState('');
  const [bulkDates, setBulkDates] = useState<string[]>([]);
  const [bulkAdjustments, setBulkAdjustments] = useState<boolean[]>([]);
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);

  // --- Form states for Revision ---
  const [showUserRevisionModal, setShowUserRevisionModal] = useState(false);
  const [revisionRecord, setRevisionRecord] = useState<ChutiRecord | null>(null);
  const [revisionDate, setRevisionDate] = useState('');
  const [revisionLeaveType, setRevisionLeaveType] = useState('Short Leave');
  const [revisionAdjustment, setRevisionAdjustment] = useState(false);
  const [revisionSignInTime, setRevisionSignInTime] = useState('13:00');
  const [revisionSignOutTime, setRevisionSignOutTime] = useState('22:30');
  const [revisionLeaveHour, setRevisionLeaveHour] = useState('00:00');
  const [revisionComment, setRevisionComment] = useState('');
  const [revisionAdjustShortLeave, setRevisionAdjustShortLeave] = useState(false);

  // --- Deletion States ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<ChutiRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);

  // --- Request Removal States (for approved user leaves) ---
  const [showRequestRemovalModal, setShowRequestRemovalModal] = useState(false);
  const [removalRecord, setRemovalRecord] = useState<ChutiRecord | null>(null);
  const [submittingRemoval, setSubmittingRemoval] = useState(false);

  // --- Admin Edit States ---
  const [showAdminEditModal, setShowAdminEditModal] = useState(false);
  const [adminEditRecord, setAdminEditRecord] = useState<ChutiRecord | null>(null);
  const [adminEditDate, setAdminEditDate] = useState('');
  const [adminEditLeaveType, setAdminEditLeaveType] = useState('Short Leave');
  const [adminEditAdjustment, setAdminEditAdjustment] = useState(false);
  const [adminEditSignInTime, setAdminEditSignInTime] = useState('13:00');
  const [adminEditSignOutTime, setAdminEditSignOutTime] = useState('22:30');
  const [adminEditLeaveHour, setAdminEditLeaveHour] = useState('00:00');
  const [adminEditComment, setAdminEditComment] = useState('');
  const [adminEditAdjustShortLeave, setAdminEditAdjustShortLeave] = useState(false);

  // --- Supervisor Revision Prompt States ---
  const [showRevisionPromptModal, setShowRevisionPromptModal] = useState(false);
  const [revisionPromptChutiId, setRevisionPromptChutiId] = useState<string | null>(null);
  const [revisionPromptAllBulkIds, setRevisionPromptAllBulkIds] = useState<string[] | undefined>(undefined);
  const [revisionPromptIsSupervisor, setRevisionPromptIsSupervisor] = useState(false);
  const [revisionPromptText, setRevisionPromptText] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);



  // Form setups on mount / leave type change
  useEffect(() => {
    if (leaveType !== 'Full Leave') {
      setBulkDates([]);
      setBulkAdjustments([]);
    }
  }, [leaveType]);

  useEffect(() => {
    if (!showAddLeaveModal) {
      setBulkDates([]);
      setBulkAdjustments([]);
    }
  }, [showAddLeaveModal]);

  // Set default form date to today (respecting local timezone)
  useEffect(() => {
    const today = new Date();
    const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    setDate(localDate);
  }, []);

  // Update default form sign-in/out times from profile
  useEffect(() => {
    if (profile) {
      setSignInTime(profile.default_sign_in || '13:00');
      setSignOutTime(profile.default_sign_out || '22:30');
    }
  }, [profile]);

  // Main Form Leave Hour Calculation
  useEffect(() => {
    const shiftStart = profile?.default_sign_in || '13:00';
    const shiftEnd = profile?.default_sign_out || '22:30';
    const workingHours = profile?.working_hours ?? 9.5;
    const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
    const calc = calculateLeaveOrOvertime(leaveType, signInTime, signOutTime, shiftStart, shiftEnd, workingHours, isHoliday);
    setLeaveHour(calc);
  }, [signInTime, signOutTime, leaveType, date, profile, globalSettings]);

  // Admin Edit Hour Auto-Calculation
  useEffect(() => {
    if (!adminEditRecord) return;
    const targetProfile = profilesList.find(p => p.id === adminEditRecord.user_id) || profile;
    const shiftStart = targetProfile?.default_sign_in || '13:00';
    const shiftEnd = targetProfile?.default_sign_out || '22:30';
    const workingHours = targetProfile?.working_hours ?? 9.5;
    const isHoliday = checkIfHolidayOrWeekend(adminEditDate, globalSettings);
    const calc = calculateLeaveOrOvertime(adminEditLeaveType, adminEditSignInTime, adminEditSignOutTime, shiftStart, shiftEnd, workingHours, isHoliday);
    setAdminEditLeaveHour(calc);
  }, [adminEditSignInTime, adminEditSignOutTime, adminEditLeaveType, adminEditDate, adminEditRecord, profilesList, profile, globalSettings]);

  // User Revision Hour Auto-Calculation
  useEffect(() => {
    const shiftStart = profile?.default_sign_in || '13:00';
    const shiftEnd = profile?.default_sign_out || '22:30';
    const workingHours = profile?.working_hours ?? 9.5;
    const isHoliday = checkIfHolidayOrWeekend(revisionDate, globalSettings);
    const calc = calculateLeaveOrOvertime(revisionLeaveType, revisionSignInTime, revisionSignOutTime, shiftStart, shiftEnd, workingHours, isHoliday);
    setRevisionLeaveHour(calc);
  }, [revisionSignInTime, revisionSignOutTime, revisionLeaveType, revisionDate, profile, globalSettings]);

  const handleAddBulkDate = () => {
    const maxDays = getMaxDaysInMonth(date);
    if (bulkDates.length + 1 >= maxDays) {
      setMessage({ type: 'error', text: `You can apply for a maximum of ${maxDays} days of leave at once!` });
      return;
    }
    setBulkDates(prev => [...prev, '']);
    setBulkAdjustments(prev => [...prev, false]);
  };

  const handleUpdateBulkDate = (index: number, val: string) => {
    if (val === date || bulkDates.some((d, idx) => idx !== index && d === val)) {
      setMessage({ type: 'error', text: 'This date has already been selected!' });
      return;
    }
    setBulkDates(prev => prev.map((d, idx) => idx === index ? val : d));
  };

  const handleUpdateBulkAdjustment = (index: number, val: boolean) => {
    setBulkAdjustments(prev => prev.map((adj, idx) => idx === index ? val : adj));
  };

  const handleRemoveBulkDate = (index: number) => {
    setBulkDates(prev => prev.filter((_, idx) => idx !== index));
    setBulkAdjustments(prev => prev.filter((_, idx) => idx !== index));
  };

  // Submit Leave Request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || submitting) return;

    setSubmitting(true);
    setMessage(null);

    const isFullLeave = leaveType === 'Full Leave';

    // Gather all selected dates with their adjustments
    const datesWithAdjustment = isFullLeave
      ? [
          { date, adjustment: adjustmentCategory !== 'None' },
          ...bulkDates.map((d, idx) => ({ date: d, adjustment: bulkAdjustments[idx] || false }))
        ].filter(item => item.date)
      : [{ date, adjustment: false }];

    const allDates = datesWithAdjustment.map(item => item.date);

    if (allDates.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one date!' });
      setSubmitting(false);
      return;
    }

    const hasDuplicateDate = allDates.some(d => {
      const recordsOnDate = userRecords.filter(r => r.date === d && r.status !== 'rejected');
      if (recordsOnDate.length === 0) return false;
      if (leaveType === 'Full Leave') return true;
      if (recordsOnDate.some(r => r.leave_type === 'Full Leave')) return true;
      if (leaveType === 'Early Leave') return recordsOnDate.some(r => r.leave_type === 'Early Leave');
      if (leaveType === 'Late Join') return recordsOnDate.some(r => r.leave_type === 'Late Join');
      if (leaveType === 'Overtime') return recordsOnDate.some(r => r.leave_type === 'Overtime');
      return false;
    });
    if (hasDuplicateDate) {
      toast.error('duplicated leave detected, please confirm the leave date again.');
      setSubmitting(false);
      return;
    }

    if (!isFullLeave && leaveHour === '00:00') {
      setMessage({ type: 'error', text: `${leaveType} requests cannot be submitted with 00:00 hours. Please adjust your Sign-in and Sign-out times.` });
      setSubmitting(false);
      return;
    }

    if (!isFullLeave) {
      const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
      const valError = getLeaveValidationError(leaveType, signInTime, signOutTime, profile?.working_hours || 9.5, isHoliday);
      if (valError) {
        setMessage({ type: 'error', text: valError });
        setSubmitting(false);
        return;
      }
    }

    const bulkId = allDates.length > 1 ? generateUUID() : null;

    const bypassSupervisor = 
      profile?.needs_supervisor_approval === false ||
      isAdminRole(profile) ||
      profile?.role === 'supervisor' ||
      !profile?.supervisor_ids ||
      profile.supervisor_ids.length === 0;

    // Calculate available overtime and short leave minutes
    const selectedYear = date ? date.substring(0, 4) : new Date().getFullYear().toString();
    const approvedRecords = userRecords.filter(r => r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear);
    const stats = calculateStats(approvedRecords);
    
    const availableShortLeaveMins = parseIntervalToMinutes(stats.shortHours);
    const leaveMins = parseIntervalToMinutes(`${leaveHour}:00`);

    let finalAdjustment = false;
    let finalAdjustedHour: string | null = null;
    let finalAdjustShortLeave = false;

    if (leaveType === 'Full Leave') {
      finalAdjustment = adjustmentCategory !== 'None';
      finalAdjustedHour = null;
      finalAdjustShortLeave = false;
    } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType)) {
      if (adjustment) {
        finalAdjustment = true;
        finalAdjustedHour = null;
      } else {
        finalAdjustment = false;
        finalAdjustedHour = null;
      }
      finalAdjustShortLeave = false;
    } else if (leaveType === 'Overtime') {
      if (adjustShortLeave && availableShortLeaveMins > 0) {
        finalAdjustShortLeave = true;
        if (leaveMins <= availableShortLeaveMins) {
          finalAdjustment = true;
          finalAdjustedHour = null;
        } else {
          finalAdjustment = false;
          const slHours = Math.floor(availableShortLeaveMins / 60);
          const slMins = availableShortLeaveMins % 60;
          finalAdjustedHour = `${String(slHours).padStart(2, '0')}:${String(slMins).padStart(2, '0')}:00`;
        }
      } else {
        finalAdjustment = false;
        finalAdjustedHour = null;
        finalAdjustShortLeave = false;
      }
    }

    const getRecordForDate = (targetDate: string, targetAdjustment: boolean) => {
      let commentWithCategory = comment;
      if (leaveType === 'Full Leave') {
        commentWithCategory = (targetAdjustment && adjustmentCategory !== 'None')
          ? `Adjusted: ${adjustmentCategory} | ${comment}`
          : comment;
      } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && finalAdjustment) {
        commentWithCategory = `Adjusted: ${adjustmentCategory} | ${comment}`;
      } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && finalAdjustedHour) {
        commentWithCategory = `Partially Adjusted with Overtime (${finalAdjustedHour.substring(0, 5)}) | ${comment}`;
      } else if (leaveType === 'Overtime' && finalAdjustment) {
        commentWithCategory = `Adjusted with Short Leave | ${comment}`;
      } else if (leaveType === 'Overtime' && finalAdjustedHour) {
        commentWithCategory = `Partially Adjusted with Short Leave (${finalAdjustedHour.substring(0, 5)}) | ${comment}`;
      }

      return {
        user_id: sessionUser.id,
        date: targetDate,
        leave_type: leaveType,
        adjustment: leaveType === 'Full Leave' ? targetAdjustment : finalAdjustment,
        adjusted_hour: leaveType === 'Full Leave' ? null : finalAdjustedHour,
        adjust_short_leave: finalAdjustShortLeave,
        sign_in_time: isFullLeave ? null : signInTime,
        sign_out_time: isFullLeave ? null : signOutTime,
        leave_hour: isFullLeave ? null : `${leaveHour}:00`,
        reserve_holiday: ['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && finalAdjustment ? adjustmentCategory : (leaveType === 'Full Leave' && targetAdjustment && adjustmentCategory !== 'None' ? adjustmentCategory : null),
        reserve_adjustment_status: 'none',
        status: bypassSupervisor ? 'approved_by_supervisor' : 'pending_supervisor',
        comment: commentWithCategory || null,
        bulk_id: bulkId,
        admin_edit_request: (!bypassSupervisor && profile?.supervisor_ids && profile.supervisor_ids.length > 0)
          ? { supervisor_ids: profile.supervisor_ids }
          : null
      };
    };

    const offlineItems = await getOfflineRecords();
    const offlineDuplicates = allDates.filter(d => 
      offlineItems.some(item => item.user_id === sessionUser.id && item.date === d)
    );

    if (offlineDuplicates.length > 0) {
      const dupStrings = offlineDuplicates.map(d => formatDate(d)).join(', ');
      setMessage({ type: 'error', text: `Entries for these dates are already saved offline: ${dupStrings}` });
      setSubmitting(false);
      return;
    }

    if (!isOnline) {
      try {
        const addedTempRecords: ChutiRecord[] = [];
        for (const item of datesWithAdjustment) {
          const rec = getRecordForDate(item.date, item.adjustment);
          await saveOfflineRecord(rec);
          addedTempRecords.push({
            ...rec,
            id: `temp-${Date.now()}-${item.date}`,
            localId: `local-${Date.now()}-${item.date}`,
            synced: false
          });
        }
        setMessage({ 
          type: 'success', 
          text: 'No internet connection. Data has been saved offline. It will sync automatically once online.' 
        });
        checkOfflineQueue();
        setUserRecords(prev => [...addedTempRecords, ...prev]);

        setComment('');
        setAdjustShortLeave(false);
        setAdjustmentCategory('None');
        setBulkDates([]);
        setBulkAdjustments([]);
        setShowAddLeaveModal(false);
      } catch {
        setMessage({ type: 'error', text: 'An error occurred while saving data offline.' });
      }
      setSubmitting(false);
      return;
    }

    try {
      const { data: existing, error: checkError } = await supabase
        .from('chuti')
        .select('date')
        .eq('user_id', sessionUser.id)
        .in('date', allDates)
        .is('deleted_at', null);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        const dupStrings = existing.map((e) => formatDate(e.date)).join(', ');
        setMessage({ type: 'error', text: `Data has already been submitted for these dates: ${dupStrings}` });
        setSubmitting(false);
        return;
      }

      const recordsToInsert = datesWithAdjustment.map(item => getRecordForDate(item.date, item.adjustment));
      const { error: insertError } = await supabase.from('chuti').insert(recordsToInsert);
      if (insertError) throw insertError;

      setMessage({ type: 'success', text: 'Your leave application has been successfully submitted!' });
      fetchRecords();

      setComment('');
      setAdjustShortLeave(false);
      setAdjustmentCategory('None');
      setBulkDates([]);
      setBulkAdjustments([]);
      setSelectedSupervisors([]);
      setShowAddLeaveModal(false);
    } catch (err) {
      console.warn('Online submission failed, falling back to offline storage:', err);
      try {
        const addedTempRecords: ChutiRecord[] = [];
        for (const item of datesWithAdjustment) {
          const rec = getRecordForDate(item.date, item.adjustment);
          await saveOfflineRecord(rec);
          addedTempRecords.push({
            ...rec,
            id: `temp-${Date.now()}-${item.date}`,
            localId: `local-${Date.now()}-${item.date}`,
            synced: false
          });
        }
        setMessage({ 
          type: 'success', 
          text: 'Internet connection is unstable. Data has been saved offline and will sync automatically once connection stabilizes.' 
        });
        checkOfflineQueue();
        setUserRecords(prev => [...addedTempRecords, ...prev]);

        setComment('');
        setAdjustShortLeave(false);
        setAdjustmentCategory('None');
        setBulkDates([]);
        setBulkAdjustments([]);
        setSelectedSupervisors([]);
        setShowAddLeaveModal(false);
      } catch (fallbackErr) {
        console.error('Offline fallback failed:', fallbackErr);
        setMessage({ type: 'error', text: 'Failed to submit online and offline storage failed: ' + ((err as Error).message || 'Unknown error') });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // executeDeleteRecord handles the actual deletion DB call
  const executeDeleteRecord = async (record: ChutiRecord) => {
    if (!sessionUser) return;
    setDeletingRecord(true);
    
    try {
      if (record.id && typeof record.id === 'string' && record.id.startsWith('temp-')) {
        const records = await getOfflineRecords();
        const target = records.find(r => r.date === record.date && r.user_id === sessionUser.id);
        if (target && target.localId) {
          await deleteOfflineRecord(target.localId);
        }
        setUserRecords(prev => prev.filter(r => r.id !== record.id));
        checkOfflineQueue();
        setMessage({ type: 'success', text: 'Offline record successfully deleted.' });
        return;
      }

      if (!isOnline) {
        if (record.id) {
          await saveOfflineDelete(record.id);
          setUserRecords(prev => prev.filter(r => r.id !== record.id));
          setAdminRecords(prev => prev.filter(r => r.id !== record.id));
          checkOfflineQueue();
          setMessage({ type: 'success', text: 'Deletion request saved offline. It will sync once online.' });
        }
        return;
      }

      const { data, error } = await supabase
        .from('chuti')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', record.id || '')
        .select(CHUTI_COLUMNS);
      if (error) throw error;
      
      if (!data || data.length === 0) {
        // Double check: does this record exist on the server?
        const { data: serverCheck, error: checkError } = await supabase
          .from('chuti')
          .select('id')
          .eq('id', record.id || '')
          .maybeSingle();

        if (!checkError && !serverCheck) {
          // Record is a ghost record (not found in the database at all)
          // Clean it up from local caches
          await removeCacheItems('chuti_cache', [record.id || '']);
          const offlineRecords = await getOfflineRecords();
          const targetOffline = offlineRecords.find(r => r.id === record.id);
          if (targetOffline && targetOffline.localId) {
            await deleteOfflineRecord(targetOffline.localId);
          }
          // Remove from local states
          setUserRecords(prev => prev.filter(r => r.id !== record.id));
          setAdminRecords(prev => prev.filter(r => r.id !== record.id));
          
          checkOfflineQueue();
          setMessage({ type: 'success', text: 'This record was not found in the database. It has been cleaned up from your local browser cache.' });
          return;
        }

        throw new Error('You do not have permission to delete this record or it was not found in the database.');
      }
      
      // If an Admin directly deleted another user's leave, log to leave_delete_requests
      // so the affected user receives a persistent notification
      if (isAdminRole(profile) && record.user_id && record.user_id !== sessionUser.id && record.id) {
        try {
          await supabase.from('leave_delete_requests').insert({
            leave_id: record.id,
            requester_id: record.user_id,
            status: 'approved',
            reason: 'Direct deletion by Admin',
            reviewed_by: sessionUser.id,
            reviewed_at: new Date().toISOString(),
          } as any);
        } catch (e) {
          console.error('Failed to log admin direct delete event:', e);
        }
      }

      setUserRecords(prev => prev.filter(r => r.id !== record.id));
      setAdminRecords(prev => prev.filter(r => r.id !== record.id));
      
      setMessage({ type: 'success', text: 'Record successfully deleted.' });
      fetchRecords();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message || 'An error occurred while deleting the record.' });
    } finally {
      setDeletingRecord(false);
    }
  };

  // Open user request removal modal
  const handleOpenRequestRemoval = (record: ChutiRecord) => {
    setRemovalRecord(record);
    setShowRequestRemovalModal(true);
  };

  // User submits removal request for an approved leave
  const handleUserSubmitRemoval = async (record: ChutiRecord, reason: string) => {
    if (!sessionUser || !record.id) return;
    setSubmittingRemoval(true);
    try {
      const { error } = await chutiService.requestLeaveRemoval(record.id, sessionUser.id, reason);
      if (error) throw error;

      // Optimistic update of local records
      setUserRecords(prev => prev.map(r => {
        if (r.id === record.id) {
          const meta = (r.admin_edit_request as Record<string, unknown>) || {};
          return {
            ...r,
            admin_edit_request: {
              ...meta,
              delete_requested: true,
              delete_reason: reason,
              delete_requested_at: new Date().toISOString(),
              delete_requester_id: sessionUser.id,
            }
          };
        }
        return r;
      }));

      setMessage({ type: 'success', text: 'Leave removal request submitted to Admin for approval.' });
      toast.success('Leave removal request submitted for Admin approval.');
      fetchRecords();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to request removal: ' + ((err as Error).message || 'unknown error') });
      toast.error('Failed to request leave removal.');
    } finally {
      setSubmittingRemoval(false);
      setShowRequestRemovalModal(false);
      setRemovalRecord(null);
    }
  };

  // Admin approves or rejects a leave removal request
  const handleApproveLeaveRemoval = async (record: ChutiRecord, approve: boolean) => {
    if (!sessionUser || !record.id) return;
    try {
      const { error } = await chutiService.reviewLeaveRemoval(
        record.id,
        record.id,
        approve,
        sessionUser.id
      );
      if (error) throw error;

      if (approve) {
        setUserRecords(prev => prev.filter(r => r.id !== record.id));
        setAdminRecords(prev => prev.filter(r => r.id !== record.id));
        toast.success(`Leave removal approved for ${formatDate(record.date)}.`);
      } else {
        // Clear delete_requested
        setUserRecords(prev => prev.map(r => {
          if (r.id === record.id) {
            const meta = (r.admin_edit_request as Record<string, unknown>) || {};
            return {
              ...r,
              admin_edit_request: {
                ...meta,
                delete_requested: false,
              }
            };
          }
          return r;
        }));
        setAdminRecords(prev => prev.map(r => {
          if (r.id === record.id) {
            const meta = (r.admin_edit_request as Record<string, unknown>) || {};
            return {
              ...r,
              admin_edit_request: {
                ...meta,
                delete_requested: false,
              }
            };
          }
          return r;
        }));
        toast.success(`Leave removal rejected for ${formatDate(record.date)}.`);
      }
      fetchRecords();
    } catch (err) {
      console.error(err);
      toast.error('Failed to process removal review: ' + ((err as Error).message || 'unknown error'));
    }
  };

  // Confirm Delete (used by the global DeleteConfirmModal if triggered)
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    await executeDeleteRecord(recordToDelete);
    setShowDeleteModal(false);
    setRecordToDelete(null);
  };

  // User submits revision for a revision-requested record
  const handleUserSubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionRecord) return;
    setSubmitting(true);

    try {
      const isFullLeave = revisionLeaveType === 'Full Leave';

      if (!isFullLeave && revisionLeaveHour === '00:00') {
        setMessage({ type: 'error', text: `${revisionLeaveType} requests cannot be submitted with 00:00 hours. Please adjust your Sign-in and Sign-out times.` });
        setSubmitting(false);
        return;
      }

      if (!isFullLeave) {
        const isHoliday = checkIfHolidayOrWeekend(revisionDate, globalSettings);
        const valError = getLeaveValidationError(revisionLeaveType, revisionSignInTime, revisionSignOutTime, profile?.working_hours || 9.5, isHoliday);
        if (valError) {
          setMessage({ type: 'error', text: valError });
          setSubmitting(false);
          return;
        }
      }

      const bypassSupervisor = 
        profile?.needs_supervisor_approval === false ||
        isAdminRole(profile) ||
        profile?.role === 'supervisor';

      const updates = {
        date: revisionDate,
        leave_type: revisionLeaveType,
        adjustment: revisionAdjustment,
        adjust_short_leave: revisionLeaveType === 'Overtime' && revisionAdjustment ? revisionAdjustShortLeave : false,
        sign_in_time: isFullLeave ? null : revisionSignInTime,
        sign_out_time: isFullLeave ? null : revisionSignOutTime,
        leave_hour: isFullLeave ? null : `${revisionLeaveHour}:00`,
        reserve_holiday: null,
        reserve_adjustment_status: 'none',
        comment: revisionComment || null,
        status: bypassSupervisor ? 'approved_by_supervisor' : 'pending_supervisor',
        admin_edit_request: (!bypassSupervisor && profile?.supervisor_ids && profile.supervisor_ids.length > 0)
          ? { supervisor_ids: profile.supervisor_ids }
          : null
      };

      const { error } = await supabase
        .from('chuti')
        .update(updates)
        .eq('id', revisionRecord.id);

      if (error) throw error;


      fetchRecords();
      setShowUserRevisionModal(false);
      setMessage({ 
        type: 'success', 
        text: bypassSupervisor 
          ? 'Revised information has been sent to the admin.' 
          : 'Revised information has been sent to the supervisor.' 
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred while submitting revision: ' + (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  // Admin save edited chuti record
  const handleAdminSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEditRecord) return;
    setSubmitting(true);
    
    try {
      const isFullLeave = adminEditLeaveType === 'Full Leave';

      if (!isFullLeave && adminEditLeaveHour === '00:00') {
        setMessage({ type: 'error', text: `${adminEditLeaveType} requests cannot be submitted with 00:00 hours. Please adjust Sign-in and Sign-out times.` });
        setSubmitting(false);
        return;
      }

      if (!isFullLeave) {
        const targetProfile = profilesList.find(p => p.id === adminEditRecord.user_id) || profile;
        const isHoliday = checkIfHolidayOrWeekend(adminEditDate, globalSettings);
        const valError = getLeaveValidationError(adminEditLeaveType, adminEditSignInTime, adminEditSignOutTime, targetProfile?.working_hours || 9.5, isHoliday);
        if (valError) {
          setMessage({ type: 'error', text: valError });
          setSubmitting(false);
          return;
        }
      }
      
      const newNotification = createNotification(
        'edited',
        'Leave Info Edited ✏️',
        `Admin has edited your leave details for date (${formatDate(adminEditDate)}).`
      );
      const existingNotifications = getExistingNotifications(adminEditRecord);

      const approvalsPrefix = getApprovalsPrefix(adminEditRecord.comment);
      const cleanEnteredComment = adminEditComment.trim();
      let baseComment = cleanEnteredComment
        ? (approvalsPrefix ? `${approvalsPrefix} | ${cleanEnteredComment}` : cleanEnteredComment)
        : (approvalsPrefix || '');

      let changeDescription = '';
      if (adminEditRecord.date !== adminEditDate) changeDescription += `Date (${adminEditRecord.date} -> ${adminEditDate}), `;
      if (adminEditRecord.leave_type !== adminEditLeaveType) changeDescription += `Leave Type (${adminEditRecord.leave_type} -> ${adminEditLeaveType}), `;
      const formattedLeaveHour = isFullLeave ? '00:00' : adminEditLeaveHour;
      const originalLeaveHourStr = adminEditRecord.leave_hour ? adminEditRecord.leave_hour.toString().split('.')[0].substring(0, 5) : '00:00';
      if (originalLeaveHourStr !== formattedLeaveHour) changeDescription += `Hours (${originalLeaveHourStr} -> ${formattedLeaveHour}), `;
      const oldCleanComment = getCleanComment(adminEditRecord.comment);
      if (oldCleanComment !== cleanEnteredComment) changeDescription += `Comment updated, `;
      changeDescription = changeDescription.replace(/,\s*$/, '');
      let finalCommentWithLog = baseComment;
      if (changeDescription) {
        const adminName = profile?.username?.toUpperCase() || 'ADMIN';
        finalCommentWithLog = baseComment + `\n[Admin Edit by ${adminName}: ${changeDescription}]`;
      }

      const updates = {
        date: adminEditDate,
        leave_type: adminEditLeaveType,
        adjustment: adminEditAdjustment,
        adjust_short_leave: adminEditLeaveType === 'Overtime' && adminEditAdjustment ? adminEditAdjustShortLeave : false,
        sign_in_time: isFullLeave ? null : adminEditSignInTime,
        sign_out_time: isFullLeave ? null : adminEditSignOutTime,
        leave_hour: isFullLeave ? null : `${adminEditLeaveHour}:00`,
        reserve_holiday: null,
        reserve_adjustment_status: 'none',
        comment: finalCommentWithLog || null,
        is_edited: true,
        admin_edit_request: {
          notifications: [...existingNotifications, newNotification]
        },
        admin_edit_status: 'none'
      };

      setUserRecords(prev => prev.map(r => r.id === adminEditRecord.id ? { ...r, ...updates } : r));
      setAdminRecords(prev => prev.map(r => r.id === adminEditRecord.id ? { ...r, ...updates } : r));

      const { error } = await supabase
        .from('chuti')
        .update(updates)
        .eq('id', adminEditRecord.id);

      if (error) throw error;

      fetchRecords();
      setShowAdminEditModal(false);
      setMessage({ 
        type: 'success', 
        text: 'Leave info successfully updated.' 
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred while editing: ' + (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Revision Reason (Supervisors or Admins)

  // Build a status-change payload: prefixed comment + appended user notification.
  // Shared by the revision and approval flows below (was copy-pasted 4×).
  const buildStatusUpdatePayload = (
    t: ChutiRecordWithProfile,
    opts: {
      status: string;
      commentPrefix: string;
      notifType: string;
      notifTitle: string;
      notifBody: string;
      extraFields?: Record<string, unknown>;
    }
  ) => {
    let cleanBaseComment = t.comment || '';
    if (!t.adjustment && !t.adjusted_hour) {
      const cleanHuman = getCleanComment(t.comment);
      const approvals = getApprovalsPrefix(t.comment);
      cleanBaseComment = cleanHuman ? (approvals ? `${approvals} | ${cleanHuman}` : cleanHuman) : (approvals || '');
    }
    const updatedComment = cleanBaseComment.includes(opts.commentPrefix)
      ? cleanBaseComment
      : (cleanBaseComment ? `${opts.commentPrefix} | ${cleanBaseComment}` : opts.commentPrefix);
    const newNotification = createNotification(opts.notifType, opts.notifTitle, opts.notifBody);
    const existingNotifications = getExistingNotifications(t);
    return {
      status: opts.status,
      ...(!t.adjustment && !t.adjusted_hour ? { reserve_holiday: null, reserve_adjustment_status: 'none' } : {}),
      ...(opts.extraFields || {}),
      comment: updatedComment || null,
      admin_edit_request: {
        ...(t.admin_edit_request || {}),
        notifications: [...existingNotifications, newNotification]
      }
    };
  };

  // A status update matched 0 rows → the record was deleted on the server.
  // Purge it from IndexedDB caches + local state, then surface an error.
  const pruneMissingRecord = async (t: ChutiRecordWithProfile): Promise<never> => {
    await removeCacheItems('chuti_cache', [t.id!]);
    const offlineRecords = await getOfflineRecords();
    const targetOffline = offlineRecords.find(r => r.id === t.id);
    if (targetOffline && targetOffline.localId) {
      await deleteOfflineRecord(targetOffline.localId);
    }
    setUserRecords(prev => prev.filter(r => r.id !== t.id));
    setAdminRecords(prev => prev.filter(r => r.id !== t.id));
    throw new Error(`The request for date ${formatDate(t.date)} was not found in the database. Cleaned up from local cache.`);
  };

  const submitRevisionWithReason = async () => {
    const chutiId = revisionPromptChutiId;
    if (!chutiId) return;
    const reasonText = revisionPromptText.trim();
    if (!reasonText) {
      setMessage({ type: 'error', text: 'Reason/Comment is required before sending for revision!' });
      return;
    }

    setSubmittingRevision(true);
    setReviewingIds(prev => new Set(prev).add(chutiId));

    try {
      let targets: ChutiRecordWithProfile[] = [];
      const allBulkIds = revisionPromptAllBulkIds;
      if (allBulkIds && allBulkIds.length > 0) {
        targets = adminRecords.filter(r => allBulkIds.includes(r.id)) as ChutiRecordWithProfile[];
      } else {
        const isBulk = chutiId.startsWith('bulk-');
        const bulkId = isBulk ? chutiId.replace('bulk-', '') : null;

        if (isBulk) {
          targets = adminRecords.filter(r => r.bulk_id === bulkId);
        } else {
          const target = (adminRecords.find(r => r.id === chutiId) || userRecords.find(r => r.id === chutiId)) as ChutiRecordWithProfile | undefined;
          if (target) targets = [target];
        }
      }

      if (targets.length === 0) throw new Error('Record not found.');

      const isSupervisor = revisionPromptIsSupervisor;
      const senderName = profile?.username || (isSupervisor ? 'Supervisor' : 'Admin');
      const senderRole = isSupervisor ? 'supervisor' : 'admin';

      await Promise.all(targets.map(async (t) => {
        const updates = buildStatusUpdatePayload(t, {
          status: 'needs_review',
          commentPrefix: `${senderName} Revision: ${reasonText}`,
          notifType: 'revision',
          notifTitle: 'Leave Revision Request ⚠️',
          notifBody: `Your ${t.leave_type} request was sent for revision by ${senderRole} (Date: ${formatDate(t.date)}). Reason: ${reasonText}`,
          // Admin revisions also reset any pending reserve adjustment
          extraFields: isSupervisor ? undefined : { reserve_adjustment_status: 'none' }
        });

        setUserRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));
        setAdminRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));

        const { data, error } = await supabase
          .from('chuti')
          .update(updates)
          .eq('id', t.id)
          .select(CHUTI_COLUMNS);

        if (error) throw error;

        if (!data || data.length === 0) {
          await pruneMissingRecord(t);
        }
      }));

      setMessage({
        type: 'success',
        text: 'Leave request has been returned to the user for revision.'
      });
      setShowRevisionPromptModal(false);
      setRevisionPromptChutiId(null);
      setRevisionPromptText('');
      fetchRecords();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to complete action: ' + (err as Error).message });
    } finally {
      setSubmittingRevision(false);
      setReviewingIds(prev => { const s = new Set(prev); s.delete(chutiId); return s; });
    }
  };

  // Supervisor Approvals
  const handleSupervisorApproveChuti = async (chutiId: string, approve: boolean, allBulkIds?: string[]) => {
    if (approve) {
      setApprovingIds(prev => new Set(prev).add(chutiId));
    } else {
      setRevisionPromptChutiId(chutiId);
      setRevisionPromptAllBulkIds(allBulkIds);
      setRevisionPromptIsSupervisor(true);
      setRevisionPromptText('');
      setShowRevisionPromptModal(true);
      return;
    }

    try {
      let targets: ChutiRecordWithProfile[] = [];
      
      if (allBulkIds && allBulkIds.length > 0) {
        targets = adminRecords.filter(r => allBulkIds.includes(r.id)) as ChutiRecordWithProfile[];
      } else {
        const isBulk = chutiId.startsWith('bulk-');
        const bulkId = isBulk ? chutiId.replace('bulk-', '') : null;

        if (isBulk) {
          targets = adminRecords.filter(r => r.bulk_id === bulkId);
        } else {
          const target = (adminRecords.find(r => r.id === chutiId) || userRecords.find(r => r.id === chutiId)) as ChutiRecordWithProfile | undefined;
          if (target) targets = [target];
        }
      }

      if (targets.length === 0) throw new Error('Record not found.');

      const supervisorUsername = profile?.username || 'Supervisor';
      const buildApprovalUpdates = (t: ChutiRecordWithProfile) => buildStatusUpdatePayload(t, {
        status: 'approved_by_supervisor',
        commentPrefix: `${supervisorUsername} Approved`,
        notifType: 'supervisor_approved',
        notifTitle: 'Leave Verified by Supervisor ✅',
        notifBody: `Supervisor approved your ${t.leave_type} request for date (${formatDate(t.date)}) and forwarded it to Admin.`
      });

      await Promise.all(targets.map(async (t) => {
        const updates = buildApprovalUpdates(t);

        const { data, error } = await supabase
          .from('chuti')
          .update(updates)
          .eq('id', t.id)
          .select(CHUTI_COLUMNS);

        if (error) throw error;

        if (!data || data.length === 0) {
          await pruneMissingRecord(t);
        }
      }));

      const updateLocalState = () => {
        targets.forEach(t => {
          const updates = buildApprovalUpdates(t);
          setUserRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));
          setAdminRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));
        });
        fetchRecords();
      };

      setApprovingIds(prev => { const s = new Set(prev); s.delete(chutiId); return s; });
      setApprovedIds(prev => new Set(prev).add(chutiId));
      setTimeout(() => {
        setApprovedIds(prev => { const s = new Set(prev); s.delete(chutiId); return s; });
        updateLocalState();
      }, 1500);

      setMessage({ type: 'success', text: 'Leave verified and forwarded to Admin successfully.' });
    } catch (err) {
      setApprovingIds(prev => { const s = new Set(prev); s.delete(chutiId); return s; });
      setMessage({ type: 'error', text: 'Failed to approve: ' + (err as Error).message });
    }
  };

  // Admin Approvals
  const handleApproveChutiRequest = async (chutiId: string, approve: boolean, allBulkIds?: string[]) => {
    if (approve) {
      setApprovingIds(prev => new Set(prev).add(chutiId));
    } else {
      setRevisionPromptChutiId(chutiId);
      setRevisionPromptAllBulkIds(allBulkIds);
      setRevisionPromptIsSupervisor(false);
      setRevisionPromptText('');
      setShowRevisionPromptModal(true);
      return;
    }

    try {
      let targets: ChutiRecordWithProfile[] = [];
      
      if (allBulkIds && allBulkIds.length > 0) {
         targets = adminRecords.filter(r => allBulkIds.includes(r.id)) as ChutiRecordWithProfile[];
      } else {
        const isBulk = chutiId.startsWith('bulk-');
        const bulkId = isBulk ? chutiId.replace('bulk-', '') : null;

        if (isBulk) {
          targets = adminRecords.filter(r => r.bulk_id === bulkId);
        } else {
          const target = (adminRecords.find(r => r.id === chutiId) || userRecords.find(r => r.id === chutiId)) as ChutiRecordWithProfile | undefined;
          if (target) targets = [target];
        }
      }

      if (targets.length === 0) throw new Error('Record not found.');

      const adminUsername = profile?.username || 'Admin';
      const buildApprovalUpdates = (t: ChutiRecordWithProfile) => buildStatusUpdatePayload(t, {
        status: 'approved',
        commentPrefix: `${adminUsername} Approved`,
        notifType: 'approved',
        notifTitle: 'Leave Request Approved ✅',
        notifBody: `Admin approved your ${t.leave_type} request for date (${formatDate(t.date)}).`
      });

      await Promise.all(targets.map(async (t) => {
        const updates = buildApprovalUpdates(t);

        const { data, error } = await supabase
          .from('chuti')
          .update(updates)
          .eq('id', t.id)
          .select(CHUTI_COLUMNS);

        if (error) throw error;

        if (!data || data.length === 0) {
          await pruneMissingRecord(t);
        }
      }));

      const updateLocalState = () => {
        targets.forEach(t => {
          const updates = buildApprovalUpdates(t);
          setUserRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));
          setAdminRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));
        });
        fetchRecords();
      };

      setApprovingIds(prev => { const s = new Set(prev); s.delete(chutiId); return s; });
      setApprovedIds(prev => new Set(prev).add(chutiId));
      setTimeout(() => {
        setApprovedIds(prev => { const s = new Set(prev); s.delete(chutiId); return s; });
        updateLocalState();
      }, 1500);

      setMessage({ type: 'success', text: 'The leave request has been successfully approved by the admin.' });
    } catch (err) {
      setApprovingIds(prev => { const s = new Set(prev); s.delete(chutiId); return s; });
      setMessage({ type: 'error', text: 'Failed to approve: ' + (err as Error).message });
    }
  };

  const triggerDeleteRecord = async (record: ChutiRecord) => {
    // Delete directly since the table has already confirmed via its own ConfirmModal
    await executeDeleteRecord(record);
  };

  return {
    triggerDeleteRecord,
    // states
    showAddLeaveModal,
    setShowAddLeaveModal,
    date,
    setDate,
    leaveType,
    setLeaveType,
    adjustment,
    setAdjustment,
    adjustmentCategory,
    setAdjustmentCategory,
    adjustShortLeave,
    setAdjustShortLeave,
    signInTime,
    setSignInTime,
    signOutTime,
    setSignOutTime,
    leaveHour,
    setLeaveHour,
    comment,
    setComment,
    selectedSupervisors,
    setSelectedSupervisors,
    bulkDates,
    setBulkDates,
    bulkAdjustments,
    setBulkAdjustments,

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

    showDeleteModal,
    setShowDeleteModal,
    recordToDelete,
    setRecordToDelete,
    deletingRecord,

    showAdminEditModal,
    setShowAdminEditModal,
    adminEditRecord,
    setAdminEditRecord,
    adminEditDate,
    setAdminEditDate,
    adminEditLeaveType,
    setAdminEditLeaveType,
    adminEditAdjustment,
    setAdminEditAdjustment,
    adminEditSignInTime,
    setAdminEditSignInTime,
    adminEditSignOutTime,
    setAdminEditSignOutTime,
    adminEditLeaveHour,
    setAdminEditLeaveHour,
    adminEditComment,
    setAdminEditComment,
    adminEditAdjustShortLeave,
    setAdminEditAdjustShortLeave,

    showRevisionPromptModal,
    setShowRevisionPromptModal,
    revisionPromptText,
    setRevisionPromptText,
    revisionPromptChutiId,
    setRevisionPromptChutiId,
    revisionPromptIsSupervisor,
    setRevisionPromptIsSupervisor,
    submittingRevision,

    approvingIds,
    reviewingIds,
    approvedIds,

    // removal states & handlers
    showRequestRemovalModal,
    setShowRequestRemovalModal,
    removalRecord,
    setRemovalRecord,
    submittingRemoval,
    handleOpenRequestRemoval,
    handleUserSubmitRemoval,
    handleApproveLeaveRemoval,

    // handlers
    handleAddBulkDate,
    handleUpdateBulkDate,
    handleUpdateBulkAdjustment,
    handleRemoveBulkDate,
    handleSubmit,
    handleConfirmDelete,
    handleUserSubmitRevision,
    handleAdminSaveEdit,
    submitRevisionWithReason,
    handleSupervisorApproveChuti,
    handleApproveChutiRequest,
  };
};
