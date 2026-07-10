'use client';

import React from 'react';
import { Profile, GovtHolidayResponse, LeaveSettlement } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { UserDashboardView } from '@/components/leave-tracker/UserDashboardView';
import { Loader2 } from 'lucide-react';
import {
  calculateStats,
  GlobalSettings,
  getSettlementSplits,
  formatDuration,
  parseIntervalToMinutes,
  formatDate,
  formatTimeToAMPM,
  getCleanComment
} from '@/utils/dashboardHelpers';
import { useGovtHolidayStats, useHalfYearlyStats } from '@/hooks/leave-tracker/useLeaveQuotaStats';

interface UserLeaveHistoryPanelProps {
  viewingStaff: Profile;
  viewingStaffRecords: ChutiRecord[];
  viewingStaffSettlements: LeaveSettlement[];
  viewingStaffHolidayResponses: GovtHolidayResponse[];
  globalSettings: GlobalSettings | null;
  loadingLeaveData: boolean;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  availableYears: string[];
  leaveFilterType: string;
  setLeaveFilterType: (val: string) => void;
  leaveFilterStartDate: string;
  setLeaveFilterStartDate: (val: string) => void;
  leaveFilterEndDate: string;
  setLeaveFilterEndDate: (val: string) => void;
  leaveSearchQuery: string;
  setLeaveSearchQuery: (val: string) => void;
  onToggleAdjustment: (r: ChutiRecord) => void;
  onDeleteRecord: (r: ChutiRecord) => void;
  /** Called when supervisor clicks Add Leave for this user */
  onAddLeaveClick?: () => void;
  onEditClick?: (r: ChutiRecord) => void;
  /** Whether the viewer is a supervisor (shows Add Leave button) */
  isSupervisor?: boolean;
  /** When true, hides delete controls */
  hideDelete?: boolean;
  /** When false, hides Add Leave button */
  showAddLeave?: boolean;
}

export const UserLeaveHistoryPanel: React.FC<UserLeaveHistoryPanelProps> = ({
  viewingStaff,
  viewingStaffRecords,
  viewingStaffSettlements,
  viewingStaffHolidayResponses,
  globalSettings,
  loadingLeaveData,
  selectedYear,
  setSelectedYear,
  availableYears,
  leaveFilterType,
  setLeaveFilterType,
  leaveFilterStartDate,
  setLeaveFilterStartDate,
  leaveFilterEndDate,
  setLeaveFilterEndDate,
  leaveSearchQuery,
  setLeaveSearchQuery,
  onToggleAdjustment,
  onDeleteRecord,
  onAddLeaveClick,
  onEditClick,
  isSupervisor = false,
  hideDelete = false,
  showAddLeave = true,
}) => {
  // Staff Stats and Quota calculations for the Leave History sub-tab
  const staffStatsData = React.useMemo(() => {
    const yearlyRecords = viewingStaffRecords.filter(r => selectedYear === 'all' || (r.date && r.date.substring(0, 4) === selectedYear));
    const baseStats = calculateStats(yearlyRecords, viewingStaff.working_hours || 9.5);
    const totalShortMins = parseIntervalToMinutes(baseStats.shortHours);
    const netShortMins = Math.max(0, totalShortMins - (viewingStaff.converted_short_leaves_hours ?? 0) * 60);
    const displayShortHours = formatDuration(netShortMins);
    const displayFullLeaves = baseStats.fullLeaves + (viewingStaff.converted_short_leaves_days ?? 0);
    return {
      ...baseStats,
      shortHours: displayShortHours,
      fullLeaves: displayFullLeaves
    };
  }, [viewingStaff, viewingStaffRecords, selectedYear]);

  // Hook-based Government Holiday stats for staff
  const isOfficeLeaveEligible = viewingStaff.eligible_office_leave !== false;
  const isGovtHolidayEligible = viewingStaff.eligible_govt_holiday !== false;

  const prevYear = (Number(selectedYear) - 1).toString();
  const carriedOffice = viewingStaffSettlements
    .filter((s) => s.year === prevYear && s.leave_category === 'Office Leave')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);
  const carriedFitr = viewingStaffSettlements
    .filter((s) => s.year === prevYear && s.leave_category === 'Eid-ul-Fitr')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);
  const carriedAdha = viewingStaffSettlements
    .filter((s) => s.year === prevYear && s.leave_category === 'Eid-ul-Adha')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const officeLeaveTotalBase = isOfficeLeaveEligible ? ((globalSettings?.office_leave_h1 ?? 7) + (globalSettings?.office_leave_h2 ?? 7)) : 0;
  const officeLeaveTotal = isOfficeLeaveEligible
    ? officeLeaveTotalBase + carriedOffice + (globalSettings?.eid_fitr_leave ?? 3) + carriedFitr + (globalSettings?.eid_adha_leave ?? 3) + carriedAdha
    : (globalSettings?.eid_fitr_leave ?? 3) + carriedFitr + (globalSettings?.eid_adha_leave ?? 3) + carriedAdha;

  const officeLeaveStatsObj = {
    total: officeLeaveTotal,
    taken: staffStatsData ? staffStatsData.fullLeaves : 0,
    remaining: officeLeaveTotal - (staffStatsData ? staffStatsData.fullLeaves : 0)
  };

  const { respondedHolidays, govtHolidayStats } = useGovtHolidayStats(
    viewingStaff.id,
    viewingStaffHolidayResponses,
    globalSettings || ({ govt_holidays: [], office_leave_h1: 7, office_leave_h2: 7, eid_fitr_leave: 3, eid_adha_leave: 3 } as GlobalSettings),
    isGovtHolidayEligible,
    staffStatsData?.govtHolidaysTaken || 0
  );

  const activeGovtSettled = viewingStaffSettlements
    .filter(s => s.year === selectedYear && s.leave_category === 'Govt Holiday' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);
  const carriedGovt = viewingStaffSettlements
    .filter((s) => s.year === prevYear && s.leave_category === 'Govt Holiday')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const adjustedGovtHolidayStats = {
    ...govtHolidayStats,
    total: govtHolidayStats.total + carriedGovt,
    remaining: Math.max(0, govtHolidayStats.reserved + carriedGovt - govtHolidayStats.taken - activeGovtSettled)
  };

  const { halfYearlyStats } = useHalfYearlyStats(
    viewingStaffRecords,
    isOfficeLeaveEligible ? (globalSettings?.office_leave_h1 ?? 7) : 0,
    isOfficeLeaveEligible ? (globalSettings?.office_leave_h2 ?? 7) : 0,
    selectedYear,
    viewingStaffSettlements,
    viewingStaff.id,
    viewingStaff.working_hours || 9.5
  );

  const activeEidFitrSettled = viewingStaffSettlements
    .filter(s => s.year === selectedYear && s.leave_category === 'Eid-ul-Fitr' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);
  const eidFitrTotal = (globalSettings?.eid_fitr_leave ?? 3) + carriedFitr;
  const eidFitrRemaining = Math.max(0, eidFitrTotal - (staffStatsData?.eidFitrTaken ?? 0) - activeEidFitrSettled);

  const activeEidAdhaSettled = viewingStaffSettlements
    .filter(s => s.year === selectedYear && s.leave_category === 'Eid-ul-Adha' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);
  const eidAdhaTotal = (globalSettings?.eid_adha_leave ?? 3) + carriedAdha;
  const eidAdhaRemaining = Math.max(0, eidAdhaTotal - (staffStatsData?.eidAdhaTaken ?? 0) - activeEidAdhaSettled);

  // Filtered records for Leave History list
  const filteredStaffRecords = React.useMemo(() => {
    return viewingStaffRecords.filter(r => {
      const isApproved = r.status === 'approved';
      if (isApproved && selectedYear !== 'all' && r.date && r.date.substring(0, 4) !== selectedYear) return false;
      if (leaveFilterType !== 'all') {
        if (leaveFilterType === 'adjustment' && !r.adjustment) return false;
        if (leaveFilterType !== 'adjustment' && r.leave_type !== leaveFilterType) return false;
      }
      if (leaveFilterStartDate && r.date && r.date < leaveFilterStartDate) return false;
      if (leaveFilterEndDate && r.date && r.date > leaveFilterEndDate) return false;
      if (leaveSearchQuery.trim()) {
        const q = leaveSearchQuery.toLowerCase().trim();
        const commentMatch = (r.comment || '').toLowerCase().includes(q);
        const typeMatch = (r.leave_type || '').toLowerCase().includes(q);
        if (!commentMatch && !typeMatch) return false;
      }
      return true;
    });
  }, [viewingStaffRecords, selectedYear, leaveFilterType, leaveFilterStartDate, leaveFilterEndDate, leaveSearchQuery]);

  if ((loadingLeaveData && viewingStaffRecords.length === 0) || !globalSettings) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-slate-900/10 border border-slate-850/50 rounded-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-2 text-xs text-slate-400 font-medium">Loading leave quotas & records...</p>
      </div>
    );
  }

  // Supply stats to UserDashboardView exactly matching UserDashboardViewProps
  const dashboardStats = {
    shortHours: staffStatsData?.shortHours || '0.0 hrs',
    overtimeHours: staffStatsData?.overtimeHours || '0.0 hrs',
    fullLeaves: staffStatsData?.fullLeaves || 0,
    totalHours: staffStatsData?.totalHours || '0.0 hrs',
    officeLeavesTaken: staffStatsData?.officeLeavesTaken || 0,
    eidFitrTaken: staffStatsData?.eidFitrTaken || 0,
    eidAdhaTaken: staffStatsData?.eidAdhaTaken || 0,
    govtHolidaysTaken: staffStatsData?.govtHolidaysTaken || 0,
  };

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-2xl rounded-2xl p-6">
      <UserDashboardView
        profile={viewingStaff}
        userStats={dashboardStats}
        globalSettings={globalSettings}
        filteredUserRecords={filteredStaffRecords}
        userRecords={viewingStaffRecords}
        title={`${viewingStaff.full_name}'s Leave Records`}
        emptyMessage={`No leave records found for ${viewingStaff.full_name}.`}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
        filterType={leaveFilterType}
        setFilterType={setLeaveFilterType}
        filterStartDate={leaveFilterStartDate}
        setFilterStartDate={setLeaveFilterStartDate}
        filterEndDate={leaveFilterEndDate}
        setFilterEndDate={setLeaveFilterEndDate}
        onResetFilters={() => {
          setLeaveFilterType('all');
          setLeaveFilterStartDate('');
          setLeaveFilterEndDate('');
          setLeaveSearchQuery('');
        }}
        onExportExcel={() => {}}
        onExportPDF={() => {}}
        onAddLeaveClick={onAddLeaveClick ?? (() => {})}
        onToggleAdjustment={onToggleAdjustment}
        onDeleteClick={onDeleteRecord}
        onEditClick={onEditClick}
        onRevisionClick={() => {}}
        onConvertShortLeaveToFullLeave={() => {}}
        holidayResponses={viewingStaffHolidayResponses}
        onSaveHolidayResponse={async () => true}
        initialFetchDone={true}
        leaveSettlements={viewingStaffSettlements}
        onSaveLeaveSettlementsBulk={async () => true}
        hideDelete={hideDelete}
        showAddLeave={showAddLeave}
      />
    </div>
  );
};
