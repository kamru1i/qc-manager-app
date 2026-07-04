'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Plus, Loader, User, Calendar } from 'lucide-react';
import { Profile, ChutiRecordWithProfile, GovtHolidayResponse, LeaveSettlement } from '@/types';
import { ChutiRecord, generateUUID } from '@/utils/offlineSync';
import { supabase } from '@/utils/supabase';
import {
  calculateStats,
  GlobalSettings,
  calculateHalfYearlyOfficeLeave,
  checkIfHolidayOrWeekend,
  getLeaveValidationError,
  calculateLeaveOrOvertime,
  formatDate,
  getSettlementSplits,
  formatDuration
} from '@/utils/dashboardHelpers';
import { useGovtHolidayStats, useHalfYearlyStats } from '@/hooks/useLeaveQuotaStats';
import { sendPushNotification } from '@/utils/webPushHelper';
import { getApiUrl } from '@/utils/apiUrlHelper';
import { toast } from 'react-hot-toast';
import { AddLeaveFormFields } from './AddLeaveFormFields';
import { LeaveUsageSummary } from './LeaveUsageSummary';
import { UserStats } from './UserStats';
import { SkeletonLoader } from './SkeletonLoader';

interface AddLeaveProps {
  profile: Profile | null;
  profilesList: Profile[];
  records: ChutiRecord[];
  globalSettings: GlobalSettings;
  leaveSettlements?: LeaveSettlement[];
  onSuccess: () => void;
  onConvertShortLeaveToFullLeave: (userId: string, workingHours: number, shortMins: number) => void;
  holidayResponses: GovtHolidayResponse[];
  initialFetchDone: boolean;
  /** When set, supervisor is adding leave on behalf of this user */
  targetUser?: Profile | null;
  /** When true, bypasses supervisor approval — leave goes straight to admin queue */
  addedBySupervisor?: boolean;
}

export function AddLeave({
  profile,
  profilesList = [],
  records = [],
  globalSettings,
  leaveSettlements = [],
  onSuccess,
  onConvertShortLeaveToFullLeave,
  holidayResponses = [],
  initialFetchDone = true,
  targetUser = null,
  addedBySupervisor = false,
}: AddLeaveProps) {
  // If supervisor is adding on behalf of a user, use that user as the target
  const targetProfile = targetUser ?? profile;

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
  const [submitting, setSubmitting] = useState(false);

  // Initialize today's date and default times
  useEffect(() => {
    if (targetProfile) {
      const today = new Date();
      const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      setDate(localDate);

      setSignInTime(targetProfile.default_sign_in || '13:00');
      setSignOutTime(targetProfile.default_sign_out || '22:30');
      setLeaveType('Short Leave');
      setAdjustment(false);
      setAdjustmentCategory('None');
      setAdjustShortLeave(false);
      setComment('');
      setBulkDates([]);
      setBulkAdjustments([]);
      setSelectedSupervisors([]);
    }
  }, [targetProfile]);

  // Recalculate leave hour when inputs change
  useEffect(() => {
    if (!targetProfile) return;
    const shiftStart = targetProfile.default_sign_in || '13:00';
    const shiftEnd = targetProfile.default_sign_out || '22:30';
    const workingHours = targetProfile.working_hours ?? 9.5;
    const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
    const calc = calculateLeaveOrOvertime(leaveType, signInTime, signOutTime, shiftStart, shiftEnd, workingHours, isHoliday);
    setLeaveHour(calc);
  }, [signInTime, signOutTime, leaveType, date, targetProfile, globalSettings]);

  // Filter records belonging to the target staff member
  const staffRecords = React.useMemo(() => {
    if (!targetProfile) return [];
    return records.filter(r => r.user_id === targetProfile.id);
  }, [records, targetProfile]);

  // Real-time balance calculations
  const selectedYear = date ? date.substring(0, 4) : new Date().getFullYear().toString();
  const approvedRecords = staffRecords.filter(r => r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear);
  const stats = calculateStats(approvedRecords, targetProfile?.working_hours || 9.5);
  const supervisors = (profilesList || []).filter(p => p.role === 'supervisor');

  const parseHHMMToMinutes = (str: string) => {
    if (!str) return 0;
    const parts = str.replace('-', '').split(':').map(Number);
    if (parts.length >= 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

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
  const { respondedHolidays, govtHolidayStats } = useGovtHolidayStats(
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
  const convertedHours = targetProfile?.converted_short_leaves_hours ?? 0;

  const officeLeaveTaken = (stats.officeLeavesTaken ?? 0)
    + (stats.fullLeaves ?? 0)
    + convertedDays;

  const officeLeaveRemaining = officeLeaveTotal - officeLeaveTaken;

  const officeLeaveStatsObj = {
    total: officeLeaveTotal,
    taken: officeLeaveTaken,
    remaining: officeLeaveRemaining
  };

  const eidFitrTotal = (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr;
  const eidFitrRemaining = Math.max(0, eidFitrTotal - (stats.eidFitrTaken ?? 0) - activeEidFitrSettled);

  const eidAdhaTotal = (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha;
  const eidAdhaRemaining = Math.max(0, eidAdhaTotal - (stats.eidAdhaTaken ?? 0) - activeEidAdhaSettled);

  const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
  const validationError = getLeaveValidationError(leaveType, signInTime, signOutTime, targetProfile?.working_hours || 9.5, isHoliday);

  const isDuplicateDate = React.useMemo(() => {
    if (!date) return false;
    const hasMainDuplicate = staffRecords.some(r => r.date === date);
    if (hasMainDuplicate) return true;
    
    if (leaveType === 'Full Leave' && bulkDates.length > 0) {
      return bulkDates.some(bd => bd && staffRecords.some(r => r.date === bd));
    }
    return false;
  }, [date, leaveType, bulkDates, staffRecords]);

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
  } else if (leaveType === 'Short Leave') {
    const mins = parseHHMMToMinutes(leaveHour);
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

  const totalShortMins = parseHHMMToMinutes(stats.shortHours);
  const netShortMins = Math.max(0, totalShortMins - convertedHours * 60);
  const displayShortHours = formatDuration(netShortMins);
  const displayFullLeaves = stats.fullLeaves + convertedDays;
  const workingHours = targetProfile?.working_hours ?? 9.5;
  const hasConvertibleHours = netShortMins >= workingHours * 60;

  const handleConvertToFullLeave = () => {
    if (!targetProfile) return;
    const maxDays = Math.floor(netShortMins / (workingHours * 60));
    const hoursText = (maxDays * workingHours).toFixed(1);

    if (confirm(`Do you want to convert ${hoursText} hours of short leave to ${maxDays} days of full leave?\n(This will deduct from your short leave balance and add to your full leave)`)) {
      onConvertShortLeaveToFullLeave(targetProfile.id, workingHours, netShortMins);
    }
  };

  const isFullLeave = leaveType === 'Full Leave';

  const handleAddBulkDate = () => {
    if (bulkDates.length + 1 >= 10) {
      toast.error('You can enter up to 10 days of leaves at once!');
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

    if (isDuplicateDate) {
      toast.error('duplicated leave detected, please confirm the leave date again.');
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

    // Prepare records list to insert
    const insertData: any[] = [];
    const bypassSupervisor = addedBySupervisor || profile?.role === 'admin' || targetProfile.needs_supervisor_approval === false;
    let finalStatus = 'pending_supervisor';
    if (profile?.role === 'admin') {
      finalStatus = 'approved';
    } else if (addedBySupervisor || targetProfile.needs_supervisor_approval === false) {
      finalStatus = 'approved_by_supervisor';
    }

    let finalAdjustment = false;
    let finalAdjustedHour: string | null = null;
    let finalAdjustShortLeave = false;

    const availableOvertimeMins = parseHHMMToMinutes(stats.overtimeHours);
    const availableShortLeaveMins = parseHHMMToMinutes(stats.shortHours);
    const leaveMins = parseHHMMToMinutes(`${leaveHour}:00`);

    if (leaveType === 'Full Leave') {
      finalAdjustment = adjustmentCategory !== 'None';
      finalAdjustedHour = null;
      finalAdjustShortLeave = false;
    } else if (leaveType === 'Short Leave') {
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

    const bulkId = allDates.length > 1 ? generateUUID() : null;

    datesWithAdjustment.forEach(item => {
      let commentWithCategory = comment.trim();
      if (profile?.role === 'admin') {
        const adminUsername = profile?.username || 'Admin';
        const updatedCommentPrefix = `${adminUsername} Approved`;
        commentWithCategory = commentWithCategory 
          ? `${updatedCommentPrefix} | ${commentWithCategory}` 
          : updatedCommentPrefix;
      } else if (leaveType === 'Full Leave') {
        commentWithCategory = (item.adjustment && adjustmentCategory !== 'None')
          ? `Adjusted: ${adjustmentCategory} | ${comment.trim()}`
          : comment.trim();
      } else if (leaveType === 'Short Leave' && finalAdjustment) {
        commentWithCategory = `Adjusted: ${adjustmentCategory} | ${comment.trim()}`;
      } else if (leaveType === 'Short Leave' && finalAdjustedHour) {
        commentWithCategory = `Partially Adjusted with Overtime (${finalAdjustedHour.substring(0, 5)}) | ${comment.trim()}`;
      } else if (leaveType === 'Overtime' && finalAdjustment) {
        commentWithCategory = `Adjusted with Short Leave | ${comment.trim()}`;
      } else if (leaveType === 'Overtime' && finalAdjustedHour) {
        commentWithCategory = `Partially Adjusted with Short Leave (${finalAdjustedHour.substring(0, 5)}) | ${comment.trim()}`;
      }

      let adminEditRequest: any = null;
      if (profile?.role === 'admin') {
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
        adjustment: leaveType === 'Full Leave' ? item.adjustment : finalAdjustment,
        adjusted_hour: finalAdjustedHour,
        adjust_short_leave: finalAdjustShortLeave,
        bulk_id: bulkId,
        reserve_holiday: leaveType === 'Short Leave' && finalAdjustment ? adjustmentCategory : (leaveType === 'Full Leave' && item.adjustment && adjustmentCategory !== 'None' ? adjustmentCategory : null),
        reserve_adjustment_status: 'none',
        admin_edit_request: adminEditRequest
      });
    });

    try {
      let data: any = null;
      const isAddingOnBehalf = profile && targetProfile && targetProfile.id !== profile.id;
      const isPrivilegedRole = profile?.role === 'supervisor' || profile?.role === 'admin';

      if (isAddingOnBehalf && isPrivilegedRole) {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(getApiUrl('/api/supervisor/add-leave'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({ insertData }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || 'Server failed to add leave');
        }

        const resJson = await response.json();
        data = resJson.data;
      } else {
        const { data: directData, error: directError } = await supabase
          .from('chuti')
          .insert(insertData)
          .select();

        if (directError) throw directError;
        data = directData;
      }

      toast.success(allDates.length > 1 ? `Successfully added ${allDates.length} bulk leaves!` : 'Leave added successfully!');
      
      // Notify Admin(s) if added by Supervisor
      if (profile?.role === 'supervisor') {
        const adminIds = profilesList.filter(p => p.role === 'admin').map(p => p.id);
        if (adminIds.length > 0) {
          sendPushNotification({
            userIds: adminIds,
            title: 'New Leave Request (Approved by Supervisor)',
            body: `Supervisor ${profile.full_name || profile.username} approved a ${leaveType} for ${targetProfile.full_name || targetProfile.username} on ${formatDate(date)}.`
          }).catch(err => console.error('Error sending push:', err));
        }
      }

      // Notify User if added directly by Admin
      if (profile?.role === 'admin') {
        sendPushNotification({
          userIds: [targetProfile.id],
          title: 'Leave Added by Admin ✅',
          body: `Admin has added a ${leaveType} for you on ${formatDate(date)}.`
        }).catch(err => console.error('Error sending push:', err));
      }

      // Send notifications to supervisors if pending approval (normal user request)
      if (finalStatus === 'pending_supervisor' && selectedSupervisors.length > 0 && data && data.length > 0) {
        const notifInsert = selectedSupervisors.map(supId => ({
          user_id: supId,
          title: `New Leave Request`,
          description: `${targetProfile.full_name} submitted a ${leaveType} request for ${formatDate(date)}.`,
          type: 'supervisor_approval',
          target_chuti_id: data[0].id,
          status: 'unread'
        }));
        try {
          await supabase.from('notifications').insert(notifInsert);
        } catch (notifErr) {
          console.error('Failed to insert fallback notifications:', notifErr);
        }

        // Send web pushes
        sendPushNotification({
          userIds: selectedSupervisors,
          title: 'New Leave Request',
          body: `${targetProfile.full_name} submitted a ${leaveType} request for ${formatDate(date)}.`
        }).catch(err => console.error('Error sending push:', err));
      }

      onSuccess();

      // Reset form
      setDate('');
      setComment('');
      setBulkDates([]);
      setBulkAdjustments([]);
      setSelectedSupervisors([]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to add leave');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 2. Main Add Leave entry form grid layout */}
      <div className="bg-slate-900/40 backdrop-blur-xl shadow-2xl rounded-2xl p-6 flex flex-col gap-6 animate-fade-in border border-slate-850">
        <div>
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Calendar className="h-4.5 w-4.5 text-blue-400" />
            New Leave Entry Form
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Record a new full day leave, short leave, or overtime entry directly into the system.
          </p>
        </div>

        {/* Supervisor on-behalf banner */}
        {addedBySupervisor && targetProfile && (
          <div className="p-3 bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs rounded-lg flex items-start gap-2">
            <User className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-slate-200">Adding leave on behalf of a user</span>
              <span className="text-[11px] block mt-0.5 text-slate-400">
                This leave will be submitted for <span className="text-white font-semibold">{targetProfile.full_name || targetProfile.username}</span> ({targetProfile.username?.toUpperCase()}) and sent directly to admin for approval.
              </span>
            </div>
          </div>
        )}

        {/* Warning Banner */}
        {isFullLeaveQuotaExceeded && (
          <div className="p-3 bg-purple-955/50 border border-purple-900/50 text-purple-300 text-xs rounded-lg flex items-start gap-2 animate-pulse">
            <AlertTriangle className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-slate-200">Leave Quota Limit Exceeded!</span>
              <span className="text-[11px] block mt-0.5 text-slate-300">
                Your annual full leave limit is {targetProfile?.max_full_leaves ?? 15} days, but you have already taken {stats.fullLeaves} days.
              </span>
            </div>
          </div>
        )}

        {submitting && !initialFetchDone ? (
          <SkeletonLoader variant="chuti-form" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <form onSubmit={handleSubmit} className="md:col-span-2 space-y-4 font-sans text-xs">
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
              />

              {/* Supervisor Selector — hidden when supervisor is adding on behalf */}
              {!addedBySupervisor && profile?.role !== 'admin' && targetProfile?.needs_supervisor_approval !== false && supervisors.length > 0 && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Select Supervisors for Approval</label>
                  <div className="flex flex-wrap gap-2">
                    {supervisors.map(sup => {
                      const isSelected = selectedSupervisors.includes(sup.id);
                      return (
                        <button
                          key={sup.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSupervisors(prev => prev.filter(id => id !== sup.id));
                            } else {
                              setSelectedSupervisors(prev => [...prev, sup.id]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {sup.full_name} ({sup.username?.toUpperCase()})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={submitting || !!validationError || isDuplicateDate || (!addedBySupervisor && profile?.role !== 'admin' && targetProfile?.needs_supervisor_approval !== false && selectedSupervisors.length === 0)}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-500 hover:to-purple-400 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Submitting Leave...' : 'Submit Leave Entry'}
                </button>
              </div>
            </form>

            {/* Right Column: Leave Summary Stats */}
            <div className="md:col-span-1">
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
        )}
      </div>
    </div>
  );
}
