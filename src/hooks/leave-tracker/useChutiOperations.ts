'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile, ChutiRecordWithProfile } from '@/types';
import { 
  ChutiRecord, 
  saveOfflineRecord, 
  getOfflineRecords, 
  saveOfflineDelete, 
  deleteOfflineRecord,
  generateUUID,
  removeCacheItems
} from '@/utils/offlineSync';
import { formatDate, calculateLeaveOrOvertime, getExistingNotifications, createNotification, calculateStats, parseIntervalToMinutes, GlobalSettings, checkIfHolidayOrWeekend, getLeaveValidationError } from '@/utils/dashboardHelpers';
import { toast } from 'react-hot-toast';

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
  const [revisionPromptText, setRevisionPromptText] = useState('');
  const [revisionPromptChutiId, setRevisionPromptChutiId] = useState<string | null>(null);
  const [revisionPromptIsSupervisor, setRevisionPromptIsSupervisor] = useState(false);
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
    if (bulkDates.length + 1 >= 10) {
      setMessage({ type: 'error', text: 'You can apply for a maximum of 10 days of leave at once!' });
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

    const hasDuplicateDate = allDates.some(d => userRecords.some(r => r.date === d));
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
      profile?.role === 'admin' ||
      profile?.role === 'supervisor' ||
      !profile?.supervisor_ids ||
      profile.supervisor_ids.length === 0;

    // Calculate available overtime and short leave minutes
    const selectedYear = date ? date.substring(0, 4) : new Date().getFullYear().toString();
    const approvedRecords = userRecords.filter(r => r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear);
    const stats = calculateStats(approvedRecords);
    
    const availableOvertimeMins = parseIntervalToMinutes(stats.overtimeHours);
    const availableShortLeaveMins = parseIntervalToMinutes(stats.shortHours);
    const leaveMins = parseIntervalToMinutes(`${leaveHour}:00`);

    let finalAdjustment = false;
    let finalAdjustedHour: string | null = null;
    let finalAdjustShortLeave = false;

    if (leaveType === 'Full Leave') {
      finalAdjustment = adjustmentCategory !== 'None';
      finalAdjustedHour = null;
      finalAdjustShortLeave = false;
    } else if (leaveType === 'Short Leave') {
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
      } else if (leaveType === 'Short Leave' && finalAdjustment) {
        commentWithCategory = `Adjusted: ${adjustmentCategory} | ${comment}`;
      } else if (leaveType === 'Short Leave' && finalAdjustedHour) {
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
        reserve_holiday: leaveType === 'Short Leave' && finalAdjustment ? adjustmentCategory : (leaveType === 'Full Leave' && targetAdjustment && adjustmentCategory !== 'None' ? adjustmentCategory : null),
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

      const targetRoles = bypassSupervisor 
        ? ['admins'] 
        : (profile?.supervisor_ids && profile.supervisor_ids.length > 0
            ? [...profile.supervisor_ids, 'admins'] 
            : ['supervisors', 'admins']);
      const formattedDates = allDates.map(d => formatDate(d)).join(', ');



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
        .select();
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
        profile?.role === 'admin' ||
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

      const targetRoles = bypassSupervisor 
        ? ['admins'] 
        : (profile?.supervisor_ids && profile.supervisor_ids.length > 0
            ? [...profile.supervisor_ids, 'admins'] 
            : ['supervisors', 'admins']);


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
        comment: adminEditComment || null,
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
      const isBulk = chutiId.startsWith('bulk-');
      const bulkId = isBulk ? chutiId.replace('bulk-', '') : null;

      let targets: ChutiRecordWithProfile[] = [];
      if (isBulk) {
        targets = adminRecords.filter(r => r.bulk_id === bulkId);
      } else {
        const target = (adminRecords.find(r => r.id === chutiId) || userRecords.find(r => r.id === chutiId)) as ChutiRecordWithProfile | undefined;
        if (target) targets = [target];
      }

      if (targets.length === 0) throw new Error('Record not found.');

      const user_id = targets[0].user_id;
      const leave_type = targets[0].leave_type;
      const formattedDates = targets.map(t => formatDate(t.date)).join(', ');

      if (revisionPromptIsSupervisor) {
        const updatedCommentPrefix = `${profile?.username || 'Supervisor'} Revision: ${reasonText}`;

        await Promise.all(targets.map(async (t) => {
          let updatedComment = t.comment || '';
          updatedComment = updatedComment ? `${updatedCommentPrefix} | ${updatedComment}` : updatedCommentPrefix;

          const newNotification = createNotification(
            'revision',
            'Leave Revision Request ⚠️',
            `Your ${t.leave_type} request was sent for revision by supervisor (Date: ${formatDate(t.date)}). Reason: ${reasonText}`
          );
          const existingNotifications = getExistingNotifications(t);

          const updates = { 
            status: 'needs_review',
            comment: updatedComment,
            admin_edit_request: {
              ...(t.admin_edit_request || {}),
              notifications: [...existingNotifications, newNotification]
            }
          };

          setUserRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));
          setAdminRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));

          const { data, error } = await supabase
            .from('chuti')
            .update(updates)
            .eq('id', t.id)
            .select();

          if (error) throw error;

          if (!data || data.length === 0) {
            // Prune local caches
            await removeCacheItems('chuti_cache', [t.id]);
            const offlineRecords = await getOfflineRecords();
            const targetOffline = offlineRecords.find(r => r.id === t.id);
            if (targetOffline && targetOffline.localId) {
              await deleteOfflineRecord(targetOffline.localId);
            }
            setUserRecords(prev => prev.filter(r => r.id !== t.id));
            setAdminRecords(prev => prev.filter(r => r.id !== t.id));
            throw new Error(`The request for date ${formatDate(t.date)} was not found in the database. Cleaned up from local cache.`);
          }
        }));



        setMessage({ 
          type: 'success', 
          text: 'Leave request has been returned to the user for revision.' 
        });
      } else {
        const updatedCommentPrefix = `${profile?.username || 'Admin'} Revision: ${reasonText}`;

        await Promise.all(targets.map(async (t) => {
          let updatedComment = t.comment || '';
          updatedComment = updatedComment ? `${updatedCommentPrefix} | ${updatedComment}` : updatedCommentPrefix;

          const newNotification = createNotification(
            'revision',
            'Leave Revision Request ⚠️',
            `Your ${t.leave_type} request was sent for revision by admin (Date: ${formatDate(t.date)}). Reason: ${reasonText}`
          );
          const existingNotifications = getExistingNotifications(t);

          const updates = {
            status: 'needs_review',
            reserve_adjustment_status: 'none',
            comment: updatedComment,
            admin_edit_request: {
              ...(t.admin_edit_request || {}),
              notifications: [...existingNotifications, newNotification]
            }
          };

          setUserRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));
          setAdminRecords(prev => prev.map(r => r.id === t.id ? { ...r, ...updates } : r));

          const { data, error } = await supabase
            .from('chuti')
            .update(updates)
            .eq('id', t.id)
            .select();

          if (error) throw error;

          if (!data || data.length === 0) {
            // Prune local caches
            await removeCacheItems('chuti_cache', [t.id]);
            const offlineRecords = await getOfflineRecords();
            const targetOffline = offlineRecords.find(r => r.id === t.id);
            if (targetOffline && targetOffline.localId) {
              await deleteOfflineRecord(targetOffline.localId);
            }
            setUserRecords(prev => prev.filter(r => r.id !== t.id));
            setAdminRecords(prev => prev.filter(r => r.id !== t.id));
            throw new Error(`The request for date ${formatDate(t.date)} was not found in the database. Cleaned up from local cache.`);
          }
        }));



        setMessage({ 
          type: 'success', 
          text: 'Leave request has been returned to the user for revision.' 
        });
      }
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
  const handleSupervisorApproveChuti = async (chutiId: string, approve: boolean) => {
    if (approve) {
      setApprovingIds(prev => new Set(prev).add(chutiId));
    } else {
      setRevisionPromptChutiId(chutiId);
      setRevisionPromptIsSupervisor(true);
      setRevisionPromptText('');
      setShowRevisionPromptModal(true);
      return;
    }

    try {
      const isBulk = chutiId.startsWith('bulk-');
      const bulkId = isBulk ? chutiId.replace('bulk-', '') : null;

      let targets: ChutiRecordWithProfile[] = [];
      if (isBulk) {
        targets = adminRecords.filter(r => r.bulk_id === bulkId);
      } else {
        const target = (adminRecords.find(r => r.id === chutiId) || userRecords.find(r => r.id === chutiId)) as ChutiRecordWithProfile | undefined;
        if (target) targets = [target];
      }

      if (targets.length === 0) throw new Error('Record not found.');

      const supervisorName = profile?.full_name ? `Supervisor ${profile.full_name}` : 'Supervisor';
      const supervisorUsername = profile?.username || 'Supervisor';
      const leave_type = targets[0].leave_type;
      const formattedDates = targets.map(t => formatDate(t.date)).join(', ');

      const user_id = targets[0].user_id;

      await Promise.all(targets.map(async (t) => {
        const updatedCommentPrefix = `${supervisorUsername} Approved`;
        let updatedComment = t.comment || '';
        updatedComment = updatedComment ? `${updatedCommentPrefix} | ${updatedComment}` : updatedCommentPrefix;

        const newNotification = createNotification(
          'supervisor_approved',
          'Leave Verified by Supervisor ✅',
          `Supervisor approved your ${t.leave_type} request for date (${formatDate(t.date)}) and forwarded it to Admin.`
        );
        const existingNotifications = getExistingNotifications(t);

        const updates = { 
          status: 'approved_by_supervisor',
          comment: updatedComment,
          admin_edit_request: {
            ...(t.admin_edit_request || {}),
            notifications: [...existingNotifications, newNotification]
          }
        };

        const { data, error } = await supabase
          .from('chuti')
          .update(updates)
          .eq('id', t.id)
          .select();

        if (error) throw error;

        if (!data || data.length === 0) {
          // Prune local caches
          await removeCacheItems('chuti_cache', [t.id]);
          const offlineRecords = await getOfflineRecords();
          const targetOffline = offlineRecords.find(r => r.id === t.id);
          if (targetOffline && targetOffline.localId) {
            await deleteOfflineRecord(targetOffline.localId);
          }
          setUserRecords(prev => prev.filter(r => r.id !== t.id));
          setAdminRecords(prev => prev.filter(r => r.id !== t.id));
          throw new Error(`The request for date ${formatDate(t.date)} was not found in the database. Cleaned up from local cache.`);
        }
      }));



      const updateLocalState = () => {
        targets.forEach(t => {
          const updatedCommentPrefix = `${supervisorUsername} Approved`;
          let updatedComment = t.comment || '';
          updatedComment = updatedComment ? `${updatedCommentPrefix} | ${updatedComment}` : updatedCommentPrefix;

          const newNotification = createNotification(
            'supervisor_approved',
            'Leave Verified by Supervisor ✅',
            `Supervisor approved your ${t.leave_type} request for date (${formatDate(t.date)}) and forwarded it to Admin.`
          );
          const existingNotifications = getExistingNotifications(t);

          const updates = { 
            status: 'approved_by_supervisor',
            comment: updatedComment,
            admin_edit_request: {
              ...(t.admin_edit_request || {}),
              notifications: [...existingNotifications, newNotification]
            }
          };

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

      setMessage({ type: 'success', text: 'The leave request has been successfully approved by the supervisor.' });
    } catch (err) {
      setApprovingIds(prev => { const s = new Set(prev); s.delete(chutiId); return s; });
      setMessage({ type: 'error', text: 'Failed to approve: ' + (err as Error).message });
    }
  };

  // Admin Approvals
  const handleApproveChutiRequest = async (chutiId: string, approve: boolean) => {
    if (approve) {
      setApprovingIds(prev => new Set(prev).add(chutiId));
    } else {
      setRevisionPromptChutiId(chutiId);
      setRevisionPromptIsSupervisor(false);
      setRevisionPromptText('');
      setShowRevisionPromptModal(true);
      return;
    }

    try {
      const isBulk = chutiId.startsWith('bulk-');
      const bulkId = isBulk ? chutiId.replace('bulk-', '') : null;

      let targets: ChutiRecordWithProfile[] = [];
      if (isBulk) {
        targets = adminRecords.filter(r => r.bulk_id === bulkId);
      } else {
        const target = (adminRecords.find(r => r.id === chutiId) || userRecords.find(r => r.id === chutiId)) as ChutiRecordWithProfile | undefined;
        if (target) targets = [target];
      }

      if (targets.length === 0) throw new Error('Record not found.');

      const adminUsername = profile?.username || 'Admin';
      const user_id = targets[0].user_id;
      const leave_type = targets[0].leave_type;
      const formattedDates = targets.map(t => formatDate(t.date)).join(', ');

      await Promise.all(targets.map(async (t) => {
        const updatedCommentPrefix = `${adminUsername} Approved`;
        let updatedComment = t.comment || '';
        updatedComment = updatedComment ? `${updatedCommentPrefix} | ${updatedComment}` : updatedCommentPrefix;

        const newNotification = createNotification(
          'approved',
          'Leave Request Approved ✅',
          `Admin approved your ${t.leave_type} request for date (${formatDate(t.date)}).`
        );
        const existingNotifications = getExistingNotifications(t);

        const updates = { 
          status: 'approved',
          comment: updatedComment,
          admin_edit_request: {
            ...(t.admin_edit_request || {}),
            notifications: [...existingNotifications, newNotification]
          }
        };

        const { data, error } = await supabase
          .from('chuti')
          .update(updates)
          .eq('id', t.id)
          .select();

        if (error) throw error;

        if (!data || data.length === 0) {
          // Prune local caches
          await removeCacheItems('chuti_cache', [t.id]);
          const offlineRecords = await getOfflineRecords();
          const targetOffline = offlineRecords.find(r => r.id === t.id);
          if (targetOffline && targetOffline.localId) {
            await deleteOfflineRecord(targetOffline.localId);
          }
          setUserRecords(prev => prev.filter(r => r.id !== t.id));
          setAdminRecords(prev => prev.filter(r => r.id !== t.id));
          throw new Error(`The request for date ${formatDate(t.date)} was not found in the database. Cleaned up from local cache.`);
        }
      }));



      const updateLocalState = () => {
        targets.forEach(t => {
          const updatedCommentPrefix = `${adminUsername} Approved`;
          let updatedComment = t.comment || '';
          updatedComment = updatedComment ? `${updatedCommentPrefix} | ${updatedComment}` : updatedCommentPrefix;

          const newNotification = createNotification(
            'approved',
            'Leave Request Approved ✅',
            `Admin approved your ${t.leave_type} request for date (${formatDate(t.date)}).`
          );
          const existingNotifications = getExistingNotifications(t);

          const updates = { 
            status: 'approved',
            comment: updatedComment,
            admin_edit_request: {
              ...(t.admin_edit_request || {}),
              notifications: [...existingNotifications, newNotification]
            }
          };

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
