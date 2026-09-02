'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, AlertTriangle, User, Calendar } from 'lucide-react';
import { Profile, GovtHolidayResponse, LeaveSettlement } from '@/types';
import { ChutiRecord, AdminEditRequest } from '@/utils/offlineSync';
import { generateUUID } from '@/utils/idbStoreFactory';
import { supabase } from '@/utils/supabase';
import {
  calculateStats,
  GlobalSettings,
  checkIfHolidayOrWeekend,
  getLeaveValidationError,
  calculateLeaveOrOvertime,
  formatDate,
  formatDuration,
  formatTimeToAMPM,
  getSettlementSplits,
  isFriday,
  adjustShortLeaveForJummah,
  isBreakEligible,
  addBreakToShortLeave,
  applyBreakComment,
  parseBreakMinutesFromComment,
  getMaxDaysInMonth,
  getCleanComment,
  getApprovalsPrefix
} from '@/utils/dashboardHelpers';
import { useGovtHolidayStats, useHalfYearlyStats } from '@/hooks/leave-tracker/useLeaveQuotaStats';

import { getApiUrl } from '@/utils/apiUrlHelper';
import { toast } from 'sonner';
import { AddLeaveFormFields } from '@/components/leave-tracker/AddLeaveFormFields';
import { LeaveUsageSummary } from '@/components/leave-tracker/LeaveUsageSummary';
import { isAdminRole, isSuperadmin, isFeatureEnabled } from '@/utils/permissionService';

interface AddLeaveProps {
  profile: Profile | null;
  profilesList: Profile[];
  records: ChutiRecord[];
  globalSettings: GlobalSettings;
  leaveSettlements?: LeaveSettlement[];
  onSuccess: (newRecords?: ChutiRecord[]) => void;
  onConvertShortLeaveToFullLeave: (userId: string, workingHours: number, shortMins: number) => void;
  holidayResponses: GovtHolidayResponse[];
  initialFetchDone: boolean;
  /** When set, supervisor is adding leave on behalf of this user */
  targetUser?: Profile | null;
  /** When true, bypasses supervisor approval — leave goes straight to admin queue */
  addedBySupervisor?: boolean;
  editingRecord?: ChutiRecord | null;
  /** When true, admin is editing another user's record directly — no re-approval needed */
  adminDirectEdit?: boolean;
}

export function AddLeave({
  profile,
  records = [],
  globalSettings,
  leaveSettlements = [],
  onSuccess,
  holidayResponses = [],
  targetUser = null,
  addedBySupervisor = false,
  editingRecord = null,
  adminDirectEdit = false,
}: AddLeaveProps) {
  // If supervisor is adding on behalf of a user, use that user as the target
  const targetProfile = targetUser ?? profile;

  const [date, setDate] = useState(() => editingRecord?.date || '');
  const [leaveType, setLeaveType] = useState(() => editingRecord?.leave_type || 'Select');
  const [adjustment, setAdjustment] = useState(() => editingRecord ? !!editingRecord.adjustment : false);
  const [adjustmentCategory, setAdjustmentCategory] = useState(() => {
    if (editingRecord && editingRecord.reserve_holiday) {
      return editingRecord.reserve_holiday;
    }
    return 'None';
  });
  const [adjustShortLeave, setAdjustShortLeave] = useState(() => editingRecord ? !!editingRecord.adjust_short_leave : false);
  const [signInTime, setSignInTime] = useState(() => editingRecord?.sign_in_time ? editingRecord.sign_in_time.substring(0, 5) : '13:00');
  const [signOutTime, setSignOutTime] = useState(() => editingRecord?.sign_out_time ? editingRecord.sign_out_time.substring(0, 5) : '22:30');
  const [leaveHour, setLeaveHour] = useState(() => editingRecord?.leave_hour ? editingRecord.leave_hour.toString().split('.')[0].substring(0, 5) : '00:00');
  const [comment, setComment] = useState(() => getCleanComment(editingRecord?.comment) || '');
  const [adjustJummah, setAdjustJummah] = useState(() => {
    if (editingRecord) {
      return !!editingRecord.comment?.includes('20 Min Adjusted with Jummah Prayer');
    }
    return false;
  });
  // Break time (Short Leave only). On edit, restore from the stored comment marker.
  const [breakEnabled, setBreakEnabled] = useState(
    () => parseBreakMinutesFromComment(editingRecord?.comment) !== null,
  );
  const [breakMinutes, setBreakMinutes] = useState(
    () => parseBreakMinutesFromComment(editingRecord?.comment) ?? 20,
  );
  const [bulkDates, setBulkDates] = useState<string[]>([]);
  const [bulkAdjustments, setBulkAdjustments] = useState<boolean[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [dateErrors, setDateErrors] = useState<Record<string, boolean>>({});
  const [showMultipleShortLeaveModal, setShowMultipleShortLeaveModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hasDateError = Object.values(dateErrors).some(Boolean);

  const isSupervisorRole = profile?.role === 'supervisor';
  const isUserRole = profile?.role === 'user';
  // Admin direct edit: no re-approval needed. Any edit on an approved record in dashboard requires re-approval and goes to approval queue.
  const needsReapproval = !adminDirectEdit && !!editingRecord && (editingRecord.status === 'approved' || editingRecord.status === 'settled');

  const targetProfileId = targetProfile?.id;
  const defaultSignIn = targetProfile?.default_sign_in;
  const defaultSignOut = targetProfile?.default_sign_out;
  const targetWorkingHours = targetProfile?.working_hours;

  // Feature flags (superadmin-controlled; default ON)
  const effectiveProfileForFlags = targetProfile || profile;
  // Only admin or supervisor adding/editing on behalf of a staff member in User Management can set adjustments
  const isStaffManagementOnBehalf = !!targetUser && targetUser.id !== profile?.id && (isAdminRole(profile) || profile?.role === 'supervisor');
  const canSubmitAdjustment = isStaffManagementOnBehalf;

  const breakFeatureOn = isFeatureEnabled('break_time', globalSettings, effectiveProfileForFlags);
  const jummahFeatureOn = isFeatureEnabled('jummah_adjustment', globalSettings, effectiveProfileForFlags);
  const leaveAdjustmentsOn = canSubmitAdjustment && isFeatureEnabled('leave_adjustments', globalSettings, effectiveProfileForFlags);
  const bulkLeaveOn = isFeatureEnabled('bulk_leave_submission', globalSettings, effectiveProfileForFlags);
  const reserveClaimingOn = canSubmitAdjustment && isFeatureEnabled('reserve_holiday_claiming', globalSettings, effectiveProfileForFlags);

  // Break time is only offered for Short Leave when signed in more than 1 hour late.
  const breakEligible = breakFeatureOn && isBreakEligible(leaveType, signInTime, defaultSignIn || '13:00');

  // Filter records belonging to the target staff member
  const staffRecords = React.useMemo(() => {
    if (!targetProfile) return [];
    return records.filter(r => r.user_id === targetProfile.id && !r.deleted_at);
  }, [records, targetProfile]);

  const parseHHMMToMinutes = (str: string) => {
    if (!str) return 0;
    const parts = str.replace('-', '').split(':').map(Number);
    if (parts.length >= 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  // Same-day records inspection
  const existingRecordsOnDate = React.useMemo(() => {
    if (!date || !targetProfile) return [];
    return staffRecords.filter(r =>
      r.date === date &&
      (editingRecord ? r.id !== editingRecord.id : true) &&
      r.status !== 'rejected' &&
      !r.deleted_at
    );
  }, [date, targetProfile, staffRecords, editingRecord]);

  const existingShortLeavesOnDate = React.useMemo(() => {
    return existingRecordsOnDate.filter(r => r.leave_type === 'Short Leave');
  }, [existingRecordsOnDate]);

  const existingEarlyLeavesOnDate = React.useMemo(() => {
    return existingRecordsOnDate.filter(r => r.leave_type === 'Early Leave');
  }, [existingRecordsOnDate]);

  const existingLateJoinsOnDate = React.useMemo(() => {
    return existingRecordsOnDate.filter(r => r.leave_type === 'Late Join');
  }, [existingRecordsOnDate]);

  const existingFullLeavesOnDate = React.useMemo(() => {
    return existingRecordsOnDate.filter(r => r.leave_type === 'Full Leave');
  }, [existingRecordsOnDate]);

  const existingShortLeaveMinutes = React.useMemo(() => {
    return existingShortLeavesOnDate.reduce((acc, r) => {
      const mins = r.leave_hour ? parseHHMMToMinutes(r.leave_hour.toString()) : 0;
      return acc + mins;
    }, 0);
  }, [existingShortLeavesOnDate]);

  // Initialize today's date and default times
  useEffect(() => {
    if (targetProfile && !editingRecord) {
      const today = new Date();
      const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      setDate(localDate);

      setSignInTime(defaultSignIn || '13:00');
      setSignOutTime(defaultSignOut || '22:30');
      setLeaveType('Select');
      setAdjustment(false);
      setAdjustmentCategory('None');
      setAdjustShortLeave(false);
      setComment('');
      setBulkDates([]);
      setBulkAdjustments([]);
    }
  }, [targetProfileId, defaultSignIn, defaultSignOut, editingRecord]);

  // Jummah is opt-in (never auto-enabled). Only clear a stale ON state when the
  // date is no longer a Friday or the type is no longer a partial leave.
  useEffect(() => {
    if (adjustJummah && (!['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) || !isFriday(date))) {
      setAdjustJummah(false);
    }
  }, [date, leaveType, adjustJummah]);

  // Reset the break toggle when it stops being applicable (type change / no
  // longer late enough) so a stale break can't be silently folded in on submit.
  useEffect(() => {
    if (!breakEligible && breakEnabled) {
      setBreakEnabled(false);
    }
  }, [breakEligible, breakEnabled]);

  // Recalculate leave hour when inputs change
  useEffect(() => {
    if (!targetProfile) return;
    if (!leaveType || leaveType === 'Select') {
      setLeaveHour('00:00');
      return;
    }
    const shiftStart = defaultSignIn || '13:00';
    const shiftEnd = defaultSignOut || '22:30';
    const workingHours = targetWorkingHours ?? 9.5;
    const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
    const calc = calculateLeaveOrOvertime(
      leaveType,
      signInTime,
      signOutTime,
      shiftStart,
      shiftEnd,
      workingHours,
      isHoliday
    );
    const jummahApplied = (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && isFriday(date) && jummahFeatureOn)
      ? adjustShortLeaveForJummah(calc, adjustJummah)
      : calc;
    // Break time counts as short leave, added on top of the (Jummah-adjusted) hours.
    const finalCalc = (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && breakEligible)
      ? addBreakToShortLeave(jummahApplied, breakMinutes, breakEnabled)
      : jummahApplied;
    setLeaveHour(finalCalc);
  }, [signInTime, signOutTime, leaveType, date, defaultSignIn, defaultSignOut, targetWorkingHours, globalSettings, targetProfile, adjustJummah, breakEligible, breakEnabled, breakMinutes]);

  // Real-time balance calculations
  const selectedYear = date ? date.substring(0, 4) : new Date().getFullYear().toString();
  const approvedRecords = staffRecords.filter(r => r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear);
  const stats = calculateStats(approvedRecords, targetProfile?.working_hours || 9.5);

  const isOfficeLeaveEligible = targetProfile?.eligible_office_leave !== false;
  const isGovtHolidayEligible = targetProfile?.eligible_govt_holiday !== false;

  // Previous year carried balances
  const prevYear = (Number(selectedYear) - 1).toString();
  const carriedOffice = leaveSettlements
    .filter((s) => s.user_id === targetProfile?.id && s.year === prevYear && s.leave_category === 'Office Leave')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedGovt = leaveSettlements
    .filter((s) => s.user_id === targetProfile?.id && s.year === prevYear && s.leave_category === 'Govt Holiday')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedEidFitr = leaveSettlements
    .filter((s) => s.user_id === targetProfile?.id && s.year === prevYear && s.leave_category === 'Eid-ul-Fitr')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedEidAdha = leaveSettlements
    .filter((s) => s.user_id === targetProfile?.id && s.year === prevYear && s.leave_category === 'Eid-ul-Adha')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  // Government Holiday calculations using shared hook
  const { govtHolidayStats } = useGovtHolidayStats(
    targetProfile?.id,
    holidayResponses,
    globalSettings,
    isGovtHolidayEligible,
    stats.govtHolidaysTaken || 0
  );

  const activeGovtSettled = leaveSettlements
    .filter(s => s.user_id === targetProfile?.id && s.year === selectedYear && s.leave_category === 'Govt Holiday' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const activeEidFitrSettled = leaveSettlements
    .filter(s => s.user_id === targetProfile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Fitr' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const activeEidAdhaSettled = leaveSettlements
    .filter(s => s.user_id === targetProfile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Adha' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const adjustedGovtHolidayStats = {
    ...govtHolidayStats,
    total: govtHolidayStats.total + carriedGovt,
    remaining: Math.max(0, govtHolidayStats.reserved + carriedGovt - govtHolidayStats.taken - activeGovtSettled)
  };

  const govtHolidayRemaining = adjustedGovtHolidayStats.remaining;
  const govtHolidayTotal = adjustedGovtHolidayStats.total;

  const officeLeaveTotalBase = isOfficeLeaveEligible ? (globalSettings.office_leave_h1 + globalSettings.office_leave_h2) : 0;
  const officeLeaveTotal = isOfficeLeaveEligible
    ? officeLeaveTotalBase + carriedOffice + (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr + (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha
    : (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr + (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha;

  const convertedDays = targetProfile?.converted_short_leaves_days ?? 0;

  const officeLeaveTaken = (stats.officeLeavesTaken ?? 0)
    + (stats.fullLeaves ?? 0)
    + convertedDays;

  const officeLeaveRemaining = officeLeaveTotal - officeLeaveTaken;

  const eidFitrTotal = (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr;
  const eidFitrRemaining = Math.max(0, eidFitrTotal - (stats.eidFitrTaken ?? 0) - activeEidFitrSettled);

  const eidAdhaTotal = (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha;
  const eidAdhaRemaining = Math.max(0, eidAdhaTotal - (stats.eidAdhaTaken ?? 0) - activeEidAdhaSettled);

  const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
  const validationError = getLeaveValidationError(leaveType, signInTime, signOutTime, targetProfile?.working_hours || 9.5, isHoliday);

  const isAdminAddingForStaff = Boolean(
    profile && isAdminRole(profile) && targetProfile && targetProfile.id !== profile.id
  );

  const isDuplicateDate = React.useMemo(() => {
    if (!date) return false;
    if (!leaveType || leaveType === 'Select') return false;
    const recordsToCheck = (editingRecord
      ? staffRecords.filter(r => r.id !== editingRecord.id)
      : staffRecords
    ).filter(r => r.status !== 'rejected' && !r.deleted_at);

    if (leaveType === 'Full Leave') {
      const allDates = [date, ...bulkDates.filter(Boolean)];
      return allDates.some(d => recordsToCheck.some(r => r.date === d));
    }

    const sameDay = recordsToCheck.filter(r => r.date === date);
    if (sameDay.length === 0) return false;

    // Rule 1: If Full Leave already exists on this date -> block
    if (sameDay.some(r => r.leave_type === 'Full Leave')) {
      return true;
    }

    // Rule 2: For Early Leave, only 1 Early Leave per date
    if (leaveType === 'Early Leave') {
      return sameDay.some(r => r.leave_type === 'Early Leave');
    }

    // Rule 3: For Late Join, only 1 Late Join per date
    if (leaveType === 'Late Join') {
      return sameDay.some(r => r.leave_type === 'Late Join');
    }

    // Rule 4: Overtime duplicates
    if (leaveType === 'Overtime') {
      return sameDay.some(r => r.leave_type === 'Overtime');
    }

    // Rule 5: Short Leave can coexist with Early Leave, Late Join, and other Short Leaves
    if (leaveType === 'Short Leave') {
      return false;
    }

    return false;
  }, [date, leaveType, bulkDates, staffRecords, editingRecord]);

  // Real-time deduction preview logic based on state
  let officeDeduction = 0;
  let govtDeduction = 0;
  let eidFitrDeduction = 0;
  let eidAdhaDeduction = 0;

  if (leaveType === 'Full Leave') {
    const totalDays = 1 + bulkDates.length;
    const adjustedDays = (adjustment ? 1 : 0) + bulkAdjustments.slice(0, bulkDates.length).filter(Boolean).length;
    const unadjustedDays = totalDays - adjustedDays;

    officeDeduction = unadjustedDays;

    if (adjustmentCategory === 'Govt Holiday') {
      govtDeduction = adjustedDays;
    } else if (adjustmentCategory === 'Eid-ul-Fitr') {
      eidFitrDeduction = adjustedDays;
    } else if (adjustmentCategory === 'Eid-ul-Adha') {
      eidAdhaDeduction = adjustedDays;
    }
  } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType)) {
    const mins = parseHHMMToMinutes(leaveHour);
    if (mins > 0) {
      const dayEquivalent = mins / ((targetProfile?.working_hours || 9.5) * 60);
      if (!adjustment || adjustmentCategory === 'Office Leave') {
        officeDeduction = dayEquivalent;
      } else if (adjustment) {
        if (adjustmentCategory === 'Govt Holiday') {
          govtDeduction = dayEquivalent;
        } else if (adjustmentCategory === 'Eid-ul-Fitr') {
          eidFitrDeduction = dayEquivalent;
        } else if (adjustmentCategory === 'Eid-ul-Adha') {
          eidAdhaDeduction = dayEquivalent;
        }
      }
    }
  }

  const isFullLeaveQuotaExceeded = false;

  const halfYearlyStats = useHalfYearlyStats(
    staffRecords,
    isOfficeLeaveEligible ? globalSettings.office_leave_h1 : 0,
    isOfficeLeaveEligible ? globalSettings.office_leave_h2 : 0,
    selectedYear,
    leaveSettlements,
    targetProfile?.id,
    targetProfile?.working_hours || 9.5
  ).halfYearlyStats;



  const isFullLeave = leaveType === 'Full Leave';

  const handleAddBulkDate = () => {
    const maxDays = getMaxDaysInMonth(date);
    if (bulkDates.length + 1 >= maxDays) {
      toast.error(`You can enter up to ${maxDays} days of leaves at once!`);
      return;
    }
    setBulkDates(prev => [...prev, '']);
    setBulkAdjustments(prev => [...prev, false]);
  };

  const handleUpdateBulkDate = (index: number, val: string) => {
    if (val === date || bulkDates.some((d, idx) => idx !== index && d === val)) {
      toast.error('This date has already been selected!');
      return;
    }
    setBulkDates(prev => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const handleUpdateBulkAdjustment = (index: number, val: boolean) => {
    setBulkAdjustments(prev => prev.map((adj, idx) => idx === index ? val : adj));
  };

  const handleRemoveBulkDate = (index: number) => {
    setBulkDates(prev => prev.filter((_, idx) => idx !== index));
    setBulkAdjustments(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProfile) return;
    if (!leaveType || leaveType === 'Select') {
      toast.error('Please choose a Leave Type.');
      return;
    }
    setSubmitting(true);

    if (needsReapproval && !editReason.trim()) {
      toast.error('Please enter a reason for this edit.');
      setSubmitting(false);
      return;
    }

    if (editingRecord) {
      // ─── UPDATE EXISTING RECORD ───
      if (!isFullLeave && leaveHour === '00:00') {
        toast.error(`${leaveType} requests cannot be submitted with 00:00 hours. Please adjust your Sign-in and Sign-out times.`);
        setSubmitting(false);
        return;
      }

      if (!isFullLeave && validationError) {
        toast.error(validationError);
        setSubmitting(false);
        return;
      }

      let commentWithCategory = comment.trim();
      const jummahMsg = '20 Min Adjusted with Jummah Prayer';

      // Pre-process form comment for Jummah adjustment
      if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && isFriday(date) && adjustJummah) {
        if (!commentWithCategory.includes(jummahMsg)) {
          commentWithCategory = commentWithCategory ? `${commentWithCategory} | ${jummahMsg}` : jummahMsg;
        }
      } else {
        commentWithCategory = commentWithCategory
          .replace(new RegExp(`\\s*\\|\\s*${jummahMsg}`), '')
          .replace(jummahMsg, '')
          .trim();
      }

      // Break time marker (Short Leave, eligible)
      commentWithCategory = applyBreakComment(
        commentWithCategory,
        breakMinutes,
        ['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && breakEligible && breakEnabled,
      );

      let finalStatus = editingRecord.status;

      if (adminDirectEdit) {
        // ─── ADMIN DIRECT EDIT — no re-approval, status stays as-is ───
        const approvalsPrefix = getApprovalsPrefix(editingRecord.comment);
        const cleanEnteredComment = comment.trim();
        let baseComment = cleanEnteredComment
          ? (approvalsPrefix ? `${approvalsPrefix} | ${cleanEnteredComment}` : cleanEnteredComment)
          : (approvalsPrefix || '');

        if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && isFriday(date) && adjustJummah) {
          if (!baseComment.includes(jummahMsg)) {
            baseComment = baseComment ? `${baseComment} | ${jummahMsg}` : jummahMsg;
          }
        } else {
          baseComment = baseComment
            .replace(new RegExp(`\\s*\\|\\s*${jummahMsg}`), '')
            .replace(jummahMsg, '')
            .trim();
        }
        baseComment = applyBreakComment(
          baseComment,
          breakMinutes,
          ['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && breakEligible && breakEnabled,
        );

        // Build a change log for audit trail
        let changeDescription = '';
        if (editingRecord.date !== date) changeDescription += `Date (${editingRecord.date} -> ${date}), `;
        if (editingRecord.leave_type !== leaveType) changeDescription += `Leave Type (${editingRecord.leave_type} -> ${leaveType}), `;
        const formattedLeaveHour = leaveType === 'Full Leave' ? '00:00' : leaveHour;
        const originalLeaveHourStr = editingRecord.leave_hour ? editingRecord.leave_hour.toString().split('.')[0].substring(0, 5) : '00:00';
        if (originalLeaveHourStr !== formattedLeaveHour) changeDescription += `Hours (${originalLeaveHourStr} -> ${formattedLeaveHour}), `;
        const oldCleanComment = getCleanComment(editingRecord.comment);
        if (oldCleanComment !== cleanEnteredComment) changeDescription += `Comment updated, `;
        changeDescription = changeDescription.replace(/,\s*$/, '');
        if (changeDescription) {
          if (isSuperadmin(profile)) {
            commentWithCategory = baseComment;
          } else {
            const adminName = profile?.username?.toUpperCase() || 'ADMIN';
            const editLog = `\n[Admin Edit by ${adminName}: ${changeDescription}]`;
            commentWithCategory = baseComment + editLog;
          }
        } else {
          commentWithCategory = baseComment;
        }
        // Keep finalStatus unchanged — admin edit doesn't require re-approval
      } else if (needsReapproval) {
        // ─── SUPERVISOR / USER re-approval flow ───
        const approvalsPrefix = getApprovalsPrefix(editingRecord.comment);
        const cleanEnteredComment = comment.trim();
        let baseComment = cleanEnteredComment
          ? (approvalsPrefix ? `${approvalsPrefix} | ${cleanEnteredComment}` : cleanEnteredComment)
          : (approvalsPrefix || '');

        if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && isFriday(date) && adjustJummah) {
          if (!baseComment.includes(jummahMsg)) {
            baseComment = baseComment ? `${baseComment} | ${jummahMsg}` : jummahMsg;
          }
        } else {
          baseComment = baseComment
            .replace(new RegExp(`\\s*\\|\\s*${jummahMsg}`), '')
            .replace(jummahMsg, '')
            .trim();
        }
        baseComment = applyBreakComment(
          baseComment,
          breakMinutes,
          ['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && breakEligible && breakEnabled,
        );

        let changeDescription = '';
        if (editingRecord.date !== date) {
          changeDescription += `Date (${editingRecord.date} -> ${date}), `;
        }
        if (editingRecord.leave_type !== leaveType) {
          changeDescription += `Leave Type (${editingRecord.leave_type} -> ${leaveType}), `;
        }
        const formattedLeaveHour = leaveType === 'Full Leave' ? '00:00' : leaveHour;
        const originalLeaveHourStr = editingRecord.leave_hour ? editingRecord.leave_hour.toString().split('.')[0].substring(0, 5) : '00:00';
        if (originalLeaveHourStr !== formattedLeaveHour) {
          changeDescription += `Hours (${originalLeaveHourStr} -> ${formattedLeaveHour}), `;
        }
        const oldCleanComment = getCleanComment(editingRecord.comment);
        if (oldCleanComment !== cleanEnteredComment) {
          changeDescription += `Comment updated (${oldCleanComment || 'None'} -> ${cleanEnteredComment || 'None'}), `;
        }

        changeDescription = changeDescription.replace(/,\s*$/, '');
        if (isSuperadmin(profile)) {
          commentWithCategory = baseComment;
        } else {
          const editorName = isAdminRole(profile)
            ? (profile?.username?.toUpperCase() || 'ADMIN')
            : isSupervisorRole
            ? (profile?.username?.toUpperCase() || 'SUPERVISOR')
            : (profile?.username?.toUpperCase() || 'USER');
          const editLog = `\n[Edited by ${editorName}: ${changeDescription}. Reason: ${editReason}]`;
          commentWithCategory = baseComment + editLog;
        }

        // Reset status for re-approval -> goes to admin approval queue
        if (isSupervisorRole || isAdminRole(profile)) {
          finalStatus = 'approved_by_supervisor';
        } else if (isUserRole) {
          // If user has no supervisor assigned, skip to admin approval directly
          const hasSupervisors = targetProfile?.supervisor_ids && targetProfile.supervisor_ids.length > 0;
          finalStatus = hasSupervisors ? 'pending_supervisor' : 'approved_by_supervisor';
        }
      } else {
        // If not approved yet, set to approved_by_supervisor for supervisor/admin, or pending_supervisor for user
        if (isSupervisorRole || isAdminRole(profile)) {
          finalStatus = 'approved_by_supervisor';
        } else if (isUserRole) {
          const hasSupervisors = targetProfile?.supervisor_ids && targetProfile.supervisor_ids.length > 0;
          finalStatus = hasSupervisors ? 'pending_supervisor' : 'approved_by_supervisor';
        }
      }

      let finalAdjustment = false;
      let finalAdjustedHour: string | null = null;
      let finalAdjustShortLeave = false;

      const availableShortLeaveMins = parseHHMMToMinutes(stats.shortHours);
      const leaveMins = parseHHMMToMinutes(`${leaveHour}:00`);

      if (leaveType === 'Full Leave') {
        finalAdjustment = adjustmentCategory !== 'None';
        finalAdjustedHour = null;
        finalAdjustShortLeave = false;
      } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType)) {
        finalAdjustment = adjustment;
        finalAdjustedHour = null;
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

      if (!canSubmitAdjustment) {
        finalAdjustment = false;
        finalAdjustedHour = null;
        finalAdjustShortLeave = false;
      }

      const updateData = {
        date: date,
        leave_type: leaveType,
        sign_in_time: leaveType === 'Full Leave' ? null : `${signInTime}:00`,
        sign_out_time: leaveType === 'Full Leave' ? null : `${signOutTime}:00`,
        leave_hour: leaveType === 'Full Leave' ? null : `${leaveHour}:00`,
        comment: commentWithCategory || null,
        status: finalStatus,
        adjustment: canSubmitAdjustment ? (leaveType === 'Full Leave' ? (adjustmentCategory !== 'None') : finalAdjustment) : false,
        adjusted_hour: canSubmitAdjustment ? finalAdjustedHour : null,
        adjust_short_leave: canSubmitAdjustment ? finalAdjustShortLeave : false,
        reserve_holiday: canSubmitAdjustment ? (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && finalAdjustment ? adjustmentCategory : (leaveType === 'Full Leave' && (adjustmentCategory !== 'None') ? adjustmentCategory : null)) : null,
        reserve_adjustment_status: 'none',
      };

      try {
        const { data: updatedData, error: updateError } = await supabase
          .from('chuti')
          .update(updateData)
          .eq('id', editingRecord.id)
          .select();

        if (updateError) throw updateError;

        toast.success(
          adminDirectEdit
            ? 'Leave updated by admin.'
            : needsReapproval
            ? 'Leave updated. Admin re-approval is required.'
            : 'Leave updated successfully.'
        );



        onSuccess(updatedData || undefined);
      } catch (err: unknown) {
        console.error(err);
        toast.error((err as Error).message || 'Failed to update leave');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ─── INSERT NEW RECORD (Original Logic) ───
    if (isDuplicateDate) {
      if (existingEarlyLeavesOnDate.length > 0) {
        toast.error(`An Early Leave has already been submitted for ${formatDate(date)}. No further leaves can be added for this day.`);
      } else if (existingFullLeavesOnDate.length > 0) {
        toast.error(`A Full Leave has already been submitted for ${formatDate(date)}.`);
      } else if (existingLateJoinsOnDate.length > 0) {
        toast.error(`A Late Join has already been submitted for ${formatDate(date)}.`);
      } else {
        toast.error('Duplicated leave detected, please confirm the leave date again.');
      }
      setSubmitting(false);
      return;
    }

    if (!isFullLeave && leaveHour === '00:00') {
      toast.error(`${leaveType} requests cannot be submitted with 00:00 hours. Please adjust your Sign-in and Sign-out times.`);
      setSubmitting(false);
      return;
    }

    if (!isFullLeave && validationError) {
      toast.error(validationError);
      setSubmitting(false);
      return;
    }

    // Check if user is adding an additional Short Leave on a date that already has Short Leave(s)
    if (leaveType === 'Short Leave' && existingShortLeavesOnDate.length > 0) {
      setShowMultipleShortLeaveModal(true);
      setSubmitting(false);
      return;
    }

    await executeInsert();
  };

  const executeInsert = async () => {
    if (!targetProfile) return;
    setSubmitting(true);
    const datesWithAdjustment = isFullLeave
      ? [
          { date, adjustment: adjustmentCategory !== 'None' },
          ...bulkDates.map((d, idx) => ({ date: d, adjustment: bulkAdjustments[idx] || false }))
        ].filter(item => item.date)
      : [{ date, adjustment: false }];

    const allDates = datesWithAdjustment.map(item => item.date);

    if (allDates.length === 0) {
      toast.error('Please select at least one date!');
      setSubmitting(false);
      return;
    }

    // Prepare records list to insert
    const insertData: Partial<ChutiRecord>[] = [];
    const bypassSupervisor =
      addedBySupervisor ||
      isAdminRole(profile) ||
      targetProfile.needs_supervisor_approval === false ||
      !targetProfile.supervisor_ids ||
      targetProfile.supervisor_ids.length === 0;
    let finalStatus = 'pending_supervisor';
    if (profile && isAdminRole(profile)) {
      if (targetProfile.id === profile.id) {
        finalStatus = 'approved_by_supervisor';
      } else {
        finalStatus = 'approved';
      }
    } else if (bypassSupervisor) {
      finalStatus = 'approved_by_supervisor';
    }

    let finalAdjustment = false;
    let finalAdjustedHour: string | null = null;
    let finalAdjustShortLeave = false;

    const availableShortLeaveMins = parseHHMMToMinutes(stats.shortHours);
    const leaveMins = parseHHMMToMinutes(`${leaveHour}:00`);

    if (leaveType === 'Full Leave') {
      finalAdjustment = adjustmentCategory !== 'None';
      finalAdjustedHour = null;
      finalAdjustShortLeave = false;
    } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType)) {
      finalAdjustment = adjustment;
      finalAdjustedHour = null;
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

    if (!canSubmitAdjustment) {
      finalAdjustment = false;
      finalAdjustedHour = null;
      finalAdjustShortLeave = false;
    }

    const bulkId = allDates.length > 1 ? generateUUID() : null;

    datesWithAdjustment.forEach(item => {
      let commentWithCategory = comment.trim();
      if (leaveType === 'Full Leave') {
        commentWithCategory = (canSubmitAdjustment && item.adjustment && adjustmentCategory !== 'None')
          ? `Adjusted: ${adjustmentCategory} | ${comment.trim()}`
          : comment.trim();
      } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && finalAdjustment) {
        commentWithCategory = `Adjusted: ${adjustmentCategory} | ${comment.trim()}`;
      } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && finalAdjustedHour) {
        commentWithCategory = `Partially Adjusted with Overtime (${finalAdjustedHour.substring(0, 5)}) | ${comment.trim()}`;
      } else if (leaveType === 'Overtime' && finalAdjustment) {
        commentWithCategory = `Adjusted with Short Leave | ${comment.trim()}`;
      } else if (leaveType === 'Overtime' && finalAdjustedHour) {
        commentWithCategory = `Partially Adjusted with Short Leave (${finalAdjustedHour.substring(0, 5)}) | ${comment.trim()}`;
      }

      // Jummah Prayer Adjustment comment update for insert
      if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && isFriday(item.date) && adjustJummah) {
        const jummahMsg = '20 Min Adjusted with Jummah Prayer';
        if (!commentWithCategory) {
          commentWithCategory = jummahMsg;
        } else if (!commentWithCategory.includes(jummahMsg)) {
          commentWithCategory = `${commentWithCategory} | ${jummahMsg}`;
        }
      }

      // Break time counts as short leave — record the marker so it round-trips on edit.
      if (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && breakEligible && breakEnabled) {
        commentWithCategory = applyBreakComment(commentWithCategory, breakMinutes, true);
      }

      // Prepend admin/supervisor signature
      if (profile && isAdminRole(profile) && targetProfile.id !== profile.id) {
        const adminUsername = isSuperadmin(profile) ? 'Admin' : (profile?.username || 'Admin');
        const updatedCommentPrefix = `${adminUsername} Approved`;
        commentWithCategory = commentWithCategory
          ? `${updatedCommentPrefix} | ${commentWithCategory}`
          : updatedCommentPrefix;
      } else if (profile?.role === 'supervisor' && targetProfile.id !== profile.id) {
        const supervisorUsername = profile?.username || 'Supervisor';
        const updatedCommentPrefix = `${supervisorUsername} Added`;
        commentWithCategory = commentWithCategory
          ? `${updatedCommentPrefix} | ${commentWithCategory}`
          : updatedCommentPrefix;
      }

      let adminEditRequest: AdminEditRequest | null = null;
      if (profile && isAdminRole(profile) && targetProfile.id !== profile.id) {
        adminEditRequest = {
          notifications: [
            {
              id: generateUUID(),
              type: 'approved',
              timestamp: new Date().toISOString(),
              title: 'Leave Added by Admin ✅',
              body: `Admin has added a ${leaveType} for you on ${formatDate(item.date)}.`
            }
          ]
        };
      } else if (!bypassSupervisor && targetProfile?.supervisor_ids && targetProfile.supervisor_ids.length > 0) {
        adminEditRequest = { supervisor_ids: targetProfile.supervisor_ids };
      }

      insertData.push({
        user_id: targetProfile.id,
        date: item.date,
        leave_type: leaveType,
        sign_in_time: leaveType === 'Full Leave' ? null : `${signInTime}:00`,
        sign_out_time: leaveType === 'Full Leave' ? null : `${signOutTime}:00`,
        leave_hour: leaveType === 'Full Leave' ? null : `${leaveHour}:00`,
        comment: commentWithCategory || null,
        status: finalStatus,
        adjustment: canSubmitAdjustment ? (leaveType === 'Full Leave' ? item.adjustment : finalAdjustment) : false,
        adjusted_hour: canSubmitAdjustment ? finalAdjustedHour : null,
        adjust_short_leave: canSubmitAdjustment ? finalAdjustShortLeave : false,
        bulk_id: bulkId,
        reserve_holiday: canSubmitAdjustment ? (['Short Leave', 'Early Leave', 'Late Join'].includes(leaveType) && finalAdjustment ? adjustmentCategory : (leaveType === 'Full Leave' && item.adjustment && adjustmentCategory !== 'None' ? adjustmentCategory : null)) : null,
        reserve_adjustment_status: 'none',
        admin_edit_request: adminEditRequest
      });
    });

    try {
      let data: ChutiRecord[] | null = null;
      const isAddingOnBehalf = profile && targetProfile && targetProfile.id !== profile.id;
      const isPrivilegedRole = profile?.role === 'supervisor' || isAdminRole(profile);

      // 1. Try direct Supabase insertion first (works on both Web and Desktop App directly)
      const { data: directData, error: directError } = await supabase
        .from('chuti')
        .insert(insertData)
        .select();

      if (!directError && directData) {
        data = directData;
      } else if (isAddingOnBehalf && isPrivilegedRole) {
        // 2. If direct insert failed (e.g. due to RLS restriction), fall back to server API route
        await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session || !session.access_token) {
          throw new Error('Your session has expired or is invalid. Please sign out and sign back in.');
        }

        try {
          const response = await fetch(getApiUrl('/api/supervisor/add-leave'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ insertData }),
          });

          if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || 'Server failed to add leave');
          }

           const resJson = await response.json();
          data = resJson.data;
        } catch (fetchErr: unknown) {
          console.error('API route fetch error:', fetchErr);
          const errorMsg = (fetchErr as Error).message || '';
          if (errorMsg && errorMsg !== 'Failed to fetch' && errorMsg !== 'Load failed') {
            throw new Error(errorMsg);
          }
          if (directError) {
            throw new Error(directError.message || 'Permission denied: Unable to add leave for this user.');
          }
          const msg = (fetchErr as Error).message || '';
          if (msg.includes('Failed to fetch') || msg.includes('Load failed')) {
            throw new Error('Network connection issue. Please verify your internet or try again.');
          }
          throw fetchErr;
        }
      } else if (directError) {
        throw directError;
      }

      toast.success(allDates.length > 1 ? `Successfully added ${allDates.length} bulk leaves!` : 'Leave added successfully!');

      // Send notifications to supervisors if pending approval (normal user request)
      const targetSupervisors = targetProfile.supervisor_ids || [];
      if (finalStatus === 'pending_supervisor' && targetSupervisors.length > 0 && data && data.length > 0) {
        const notifInsert = targetSupervisors.map(supId => ({
          user_id: supId,
          title: `New Leave Request`,
          description: `${targetProfile.full_name || targetProfile.username} submitted a ${leaveType} request for ${formatDate(date)}.`,
          type: 'supervisor_approval',
          target_chuti_id: data[0].id,
          status: 'unread'
        }));
        try {
          await supabase.from('notifications').insert(notifInsert);
        } catch (notifErr) {
          console.error('Failed to insert fallback notifications:', notifErr);
        }
      }

      onSuccess(data || undefined);

      // Reset form
      setDate('');
      setComment('');
      setBulkDates([]);
      setBulkAdjustments([]);
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error).message || 'Failed to add leave');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Main Add Leave entry form grid layout */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl shadow-2xl rounded-2xl p-6 lg:p-7 flex flex-col gap-6 animate-fade-in border border-theme-border-muted/80">
        <div>
          <h3 className="text-base font-bold text-theme-text-primary flex items-center gap-2 tracking-tight">
            <Calendar className="h-4.5 w-4.5 text-blue-400" />
            {editingRecord ? 'Edit Leave Entry' : 'New Leave Entry Form'}
          </h3>
          <p className="text-xs text-theme-text-muted mt-1 font-sans">
            {editingRecord
              ? 'Update the details of the selected leave entry.'
              : 'Record a new full day leave, short leave, or overtime entry directly into the system.'
            }
          </p>
        </div>

        {/* Supervisor on-behalf banner */}
        {addedBySupervisor && targetProfile && (
          <div className="p-3 bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs rounded-lg flex items-start gap-2">
            <User className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Submitting on behalf of:</p>
              <p className="text-[11px] text-blue-200 mt-0.5 font-bold">
                {targetProfile.full_name || targetProfile.username} ({targetProfile.role})
              </p>
            </div>
          </div>
        )}

        {/* Warning Banner */}
        {isFullLeaveQuotaExceeded && (
          <div className="p-3 bg-purple-955/50 border border-purple-900/50 text-purple-300 text-xs rounded-lg flex items-start gap-2 animate-pulse">
            <AlertTriangle className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-theme-text-primary">Leave Quota Limit Exceeded!</span>
              <span className="text-[11px] block mt-0.5 text-theme-text-secondary">
                Your annual full leave limit is {targetProfile?.max_full_leaves ?? 15} days, but you have already taken {stats.fullLeaves} days.
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4 font-sans text-xs">
            <AddLeaveFormFields
              date={date}
              setDate={setDate}
              leaveType={leaveType}
              setLeaveType={setLeaveType}
              adjustmentCategory={adjustmentCategory}
              setAdjustmentCategory={setAdjustmentCategory}
              setAdjustment={setAdjustment}
              adjustShortLeave={adjustShortLeave}
              setAdjustShortLeave={setAdjustShortLeave}
              signInTime={signInTime}
              setSignInTime={setSignInTime}
              signOutTime={signOutTime}
              setSignOutTime={setSignOutTime}
              leaveHour={leaveHour}
              setLeaveHour={setLeaveHour}
              comment={comment}
              setComment={setComment}
              bulkDates={bulkDates}
              bulkAdjustments={bulkAdjustments}
              handleAddBulkDate={handleAddBulkDate}
              handleUpdateBulkDate={handleUpdateBulkDate}
              handleUpdateBulkAdjustment={handleUpdateBulkAdjustment}
              handleRemoveBulkDate={handleRemoveBulkDate}
              allowOvertime={targetProfile?.allow_overtime || false}
              adjustJummah={adjustJummah}
              setAdjustJummah={setAdjustJummah}
              jummahEnabled={jummahFeatureOn}
              leaveAdjustmentsEnabled={leaveAdjustmentsOn}
              bulkLeaveEnabled={bulkLeaveOn}
              reserveClaimingEnabled={reserveClaimingOn}
              breakEligible={breakEligible}
              breakEnabled={breakEnabled}
              setBreakEnabled={setBreakEnabled}
              breakMinutes={breakMinutes}
              setBreakMinutes={setBreakMinutes}
              adjustment={adjustment}
              availableOvertimeMins={parseHHMMToMinutes(stats.overtimeHours)}
              availableShortLeaveMins={parseHHMMToMinutes(stats.shortHours)}
              records={staffRecords}
              govtHolidayRemaining={govtHolidayRemaining}
              eidFitrRemaining={eidFitrRemaining}
              eidAdhaRemaining={eidAdhaRemaining}
              eligibleOfficeLeave={isOfficeLeaveEligible}
              officeLeaveRemaining={officeLeaveRemaining}
              workingHours={targetProfile?.working_hours || 9.5}
              globalSettings={globalSettings}
              onDateErrorChange={(id, hasError) => {
                setDateErrors(prev => {
                  if (prev[id] === hasError) return prev;
                  return { ...prev, [id]: hasError };
                });
              }}
            />

            {needsReapproval && (
              <div className="space-y-1 pt-2 border-t border-theme-border-input/50">
                <label className="block text-theme-text-muted font-semibold">Reason for Editing (Required)</label>
                <textarea
                  required
                  rows={2}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Enter why this approved leave is being modified..."
                  className="w-full p-2.5 bg-theme-page-bg border border-theme-border-input rounded-xl text-theme-text-primary text-xs placeholder-theme-text-muted/60 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-theme-border-input/70">
              <button
                type="submit"
                disabled={submitting || !leaveType || leaveType === 'Select' || (!isFullLeave && leaveHour === '00:00') || !!validationError || isDuplicateDate || hasDateError}
                className="w-full sm:w-auto min-w-36 flex items-center justify-center py-2.5 px-6 border border-transparent rounded-xl shadow-lg shadow-blue-600/20 text-xs font-bold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-theme-card-container cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all gap-2"
              >
                {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {submitting
                  ? (editingRecord ? 'Saving...' : 'Submitting...')
                  : (editingRecord ? 'Save Changes' : 'Submit')}
              </button>
            </div>
          </form>

          {/* Right Column: Leave Summary Stats */}
          <div className="lg:col-span-1">
            <LeaveUsageSummary
              selectedYear={selectedYear}
              officeLeaveRemaining={officeLeaveRemaining}
              officeLeaveTotal={officeLeaveTotal}
              govtHolidayRemaining={govtHolidayRemaining}
              govtHolidayTotal={govtHolidayTotal}
              eidFitrRemaining={eidFitrRemaining}
              eidFitrTotal={eidFitrTotal}
              eidAdhaRemaining={eidAdhaRemaining}
              eidAdhaTotal={eidAdhaTotal}
              fullLeaves={stats.fullLeaves}
              shortHours={stats.shortHours}
              overtimeHours={stats.overtimeHours}
              allowOvertime={targetProfile?.allow_overtime}
              eligibleOfficeLeave={isOfficeLeaveEligible}
              eligibleGovtHoliday={isGovtHolidayEligible}
              halfYearlyStats={halfYearlyStats}
              officeDeduction={officeDeduction}
              govtDeduction={govtDeduction}
              workingHours={targetProfile?.working_hours || 9.5}
              eidFitrDeduction={eidFitrDeduction}
              eidAdhaDeduction={eidAdhaDeduction}
            />
          </div>
        </div>
      </div>

      {/* Multiple Short Leaves Confirmation Warning Modal */}
      {showMultipleShortLeaveModal && isMounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-page-bg/80 backdrop-blur-md p-4">
          <div className="bg-theme-card-bg border border-theme-border-input shadow-2xl rounded-2xl w-full max-w-md p-6 relative overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-amber-900/10 blur-[80px] pointer-events-none" />

            <div className="flex justify-between items-center border-b border-theme-border-input/80 pb-3 mb-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-400" /> Existing Short Leave Warning
              </h3>
              <button
                type="button"
                onClick={() => setShowMultipleShortLeaveModal(false)}
                className="text-theme-text-muted hover:text-theme-text-primary text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-theme-text-secondary mb-3 leading-relaxed">
              You already have <strong>{existingShortLeavesOnDate.length}</strong> existing short leave record(s) on <strong>{formatDate(date)}</strong>:
            </p>

            <div className="bg-theme-page-bg/60 border border-theme-border-muted rounded-xl p-3 mb-3 divide-y divide-theme-border-muted/60 text-xs">
              {existingShortLeavesOnDate.map((r, idx) => (
                <div key={r.id || idx} className="py-1.5 first:pt-0 last:pb-0 flex justify-between items-center">
                  <span className="text-theme-text-muted font-mono">
                    {r.sign_in_time ? formatTimeToAMPM(r.sign_in_time.substring(0, 5)) : '--:--'} - {r.sign_out_time ? formatTimeToAMPM(r.sign_out_time.substring(0, 5)) : '--:--'}
                  </span>
                  <span className="font-bold text-amber-400">{r.leave_hour} hrs</span>
                </div>
              ))}
              <div className="pt-2 flex justify-between items-center font-bold text-theme-text-primary">
                <span>Total Recorded Short Leave:</span>
                <span className="text-amber-400">{formatDuration(existingShortLeaveMinutes)} hrs</span>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 text-xs text-blue-300">
              <p className="font-semibold mb-1">New Short Leave to Add:</p>
              <div className="flex justify-between items-center">
                <span>{formatTimeToAMPM(signInTime)} - {formatTimeToAMPM(signOutTime)}</span>
                <span className="font-bold text-blue-400">{leaveHour} hrs</span>
              </div>
            </div>

            <p className="text-xs text-theme-text-muted mb-5 font-medium">
              Are you sure you want to proceed and add this additional short leave for this day?
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMultipleShortLeaveModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-theme-border-input hover:bg-theme-card-bg/40 text-theme-text-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowMultipleShortLeaveModal(false);
                  await executeInsert();
                }}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-md"
              >
                Yes, Add Short Leave
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
