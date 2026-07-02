'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Plus, Loader } from 'lucide-react';
import { Profile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { calculateStats, GlobalSettings, calculateHalfYearlyOfficeLeave, checkIfHolidayOrWeekend, getLeaveValidationError } from '@/utils/dashboardHelpers';
import { supabase } from '@/utils/supabase';
import { LeaveUsageSummary } from '@/components/LeaveUsageSummary';
import { AddLeaveFormFields } from '../AddLeaveFormFields';

import { Modal } from '../Modal';

interface AddLeaveModalProps {
  showAddLeaveModal: boolean;
  setShowAddLeaveModal: (val: boolean) => void;
  date: string;
  setDate: (val: string) => void;
  leaveType: string;
  setLeaveType: (val: string) => void;
  adjustment: boolean;
  setAdjustment: (val: boolean) => void;
  adjustmentCategory: string;
  setAdjustmentCategory: (val: string) => void;
  adjustShortLeave: boolean;
  setAdjustShortLeave: (val: boolean) => void;
  signInTime: string;
  setSignInTime: (val: string) => void;
  signOutTime: string;
  setSignOutTime: (val: string) => void;
  leaveHour: string;
  setLeaveHour: (val: string) => void;
  comment: string;
  setComment: (val: string) => void;
  bulkDates: string[];
  bulkAdjustments: boolean[];
  handleAddBulkDate: () => void;
  handleUpdateBulkDate: (index: number, val: string) => void;
  handleUpdateBulkAdjustment: (index: number, val: boolean) => void;
  handleRemoveBulkDate: (index: number) => void;
  profile: Profile | null;
  submitting: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  records: ChutiRecord[];
  profilesList?: Profile[];
  selectedSupervisors: string[];
  setSelectedSupervisors: React.Dispatch<React.SetStateAction<string[]>>;
  globalSettings: GlobalSettings;
  leaveSettlements?: any[];
}

export function AddLeaveModal({
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
  bulkDates,
  bulkAdjustments,
  handleAddBulkDate,
  handleUpdateBulkDate,
  handleUpdateBulkAdjustment,
  handleRemoveBulkDate,
  profile,
  submitting,
  handleSubmit,
  records,
  profilesList = [],
  selectedSupervisors = [],
  setSelectedSupervisors = () => {},
  globalSettings,
  leaveSettlements = [],
}: AddLeaveModalProps) {
  const [userResponses, setUserResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);

  // Fetch responses when profile changes
  useEffect(() => {
    if (showAddLeaveModal && profile) {
      setLoadingResponses(true);
      const fetchUserResponses = async () => {
        const { data } = await supabase
          .from('govt_holiday_responses')
          .select('*')
          .eq('user_id', profile.id);
        if (data) {
          setUserResponses(data);
        }
        setLoadingResponses(false);
      };
      fetchUserResponses();
    } else {
      setUserResponses([]);
      setLoadingResponses(false);
    }
  }, [showAddLeaveModal, profile]);

  // Real-time balance calculations
  const selectedYear = date ? date.substring(0, 4) : new Date().getFullYear().toString();
  const approvedRecords = records.filter(r => r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear);
  const stats = calculateStats(approvedRecords, profile?.working_hours || 9.5);
  const supervisors = (profilesList || []).filter(p => p.role === 'supervisor');

  const parseHHMMToMinutes = (str: string) => {
    if (!str) return 0;
    const parts = str.replace('-', '').split(':').map(Number);
    if (parts.length >= 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  const isOfficeLeaveEligible = profile?.eligible_office_leave !== false;
  const officeLeaveTotalBase = isOfficeLeaveEligible ? (globalSettings.office_leave_h1 + globalSettings.office_leave_h2) : 0;

  const reservedCount = userResponses.filter((r: any) => r.response === 'reserve').length;
  const govtHolidayTotal = reservedCount;
  const govtHolidayRemaining = Math.max(0, reservedCount - (stats.govtHolidaysTaken ?? 0));

  const convertedDays = profile?.converted_short_leaves_days ?? 0;

  const totalAllowed = officeLeaveTotalBase;
  const totalTaken = (stats.officeLeavesTaken ?? 0)
    + (stats.fullLeaves ?? 0)
    + convertedDays;

  const officeLeaveTotal = totalAllowed;
  const officeLeaveRemaining = totalAllowed - totalTaken; // Can go negative

  const eidFitrTotal = globalSettings.eid_fitr_leave ?? 0;
  const eidFitrRemaining = Math.max(0, eidFitrTotal - (stats.eidFitrTaken ?? 0));

  const eidAdhaTotal = globalSettings.eid_adha_leave ?? 0;
  const eidAdhaRemaining = Math.max(0, eidAdhaTotal - (stats.eidAdhaTaken ?? 0));

  const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
  const validationError = getLeaveValidationError(leaveType, signInTime, signOutTime, profile?.working_hours || 9.5, isHoliday);

  const isDuplicateDate = React.useMemo(() => {
    if (!date) return false;
    const hasMainDuplicate = records.some(r => r.date === date);
    if (hasMainDuplicate) return true;
    
    if (leaveType === 'Full Leave' && bulkDates.length > 0) {
      return bulkDates.some(bd => bd && records.some(r => r.date === bd));
    }
    return false;
  }, [date, leaveType, bulkDates, records]);

  // Real-time deduction preview logic based on modal state
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
    const dayEquivalent = mins / ((profile?.working_hours || 9.5) * 60);
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

  const halfYearlyStats = React.useMemo(() => {
    return calculateHalfYearlyOfficeLeave(
      records,
      globalSettings.office_leave_h1,
      globalSettings.office_leave_h2,
      selectedYear,
      leaveSettlements,
      profile?.id,
      undefined,
      profile?.working_hours || 9.5
    );
  }, [records, globalSettings.office_leave_h1, globalSettings.office_leave_h2, selectedYear, profile, leaveSettlements]);

  return (
    <Modal
      isOpen={showAddLeaveModal}
      onClose={() => setShowAddLeaveModal(false)}
      title="New Leave Entry"
      icon={<Plus className="h-5 w-5 text-orange-500" />}
      maxWidthClass="max-w-4xl"
    >
      {/* Warning Banner */}
      {isFullLeaveQuotaExceeded && (
        <div className="p-3 bg-amber-955/50 border border-amber-900/50 text-amber-300 text-xs rounded-lg mb-4 flex items-start gap-2 animate-pulse">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-slate-200">Leave Quota Limit Exceeded!</span>
            <span className="text-[11px] block mt-0.5 text-slate-300">
              Your annual full leave limit is {profile?.max_full_leaves ?? 15} days, but you have already taken {stats.fullLeaves} days.
            </span>
          </div>
        </div>
      )}

      {loadingResponses ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader className="h-8 w-8 animate-spin text-orange-500" />
          <p className="mt-2 text-xs text-slate-400 font-medium font-sans">Loading leave data and holidays...</p>
        </div>
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
              allowOvertime={profile?.allow_overtime || false}
              adjustment={adjustment}
              availableOvertimeMins={parseHHMMToMinutes(stats.overtimeHours)}
              availableShortLeaveMins={parseHHMMToMinutes(stats.shortHours)}
              records={records}
              govtHolidayRemaining={govtHolidayRemaining}
              eidFitrRemaining={eidFitrRemaining}
              eidAdhaRemaining={eidAdhaRemaining}
              eligibleOfficeLeave={isOfficeLeaveEligible}
              officeLeaveRemaining={officeLeaveRemaining}
              workingHours={profile?.working_hours || 9.5}
              globalSettings={globalSettings}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddLeaveModal(false)}
                className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-355 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !!validationError || isDuplicateDate}
                className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {submitting ? 'Submitting...' : 'Submit Leave'}
              </button>
            </div>
          </form>

          {/* Right Column: Balance & Limit display */}
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
            allowOvertime={profile?.allow_overtime}
            eligibleOfficeLeave={profile?.eligible_office_leave !== false}
            eligibleGovtHoliday={profile?.eligible_govt_holiday !== false}
            halfYearlyStats={halfYearlyStats}
            officeDeduction={officeDeduction}
            govtDeduction={govtDeduction}
            workingHours={profile?.working_hours || 9.5}
            eidFitrDeduction={eidFitrDeduction}
            eidAdhaDeduction={eidAdhaDeduction}
          />
        </div>
      )}
    </Modal>
  );
}
