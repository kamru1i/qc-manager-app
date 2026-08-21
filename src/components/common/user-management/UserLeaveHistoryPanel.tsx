'use client';

import React from 'react';
import { Profile, GovtHolidayResponse, LeaveSettlement } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { UserDashboardView } from '@/components/leave-tracker/UserDashboardView';
import { Loader2 } from 'lucide-react';
import {
  calculateStats,
  GlobalSettings,
  formatDuration,
  parseIntervalToMinutes,
  applyLeaveFilters
} from '@/utils/dashboardHelpers';

interface UserLeaveHistoryPanelProps {
  viewingStaff: Profile;
  viewingStaffRecords: ChutiRecord[];
  viewingStaffSettlements: LeaveSettlement[];
  viewingStaffHolidayResponses: GovtHolidayResponse[];
  globalSettings: GlobalSettings;
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
  onAdminUpdateHolidayResponse?: (targetUserId: string, holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => Promise<boolean>;
  isAdmin?: boolean;
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
  hideDelete = false,
  showAddLeave = true,
  onAdminUpdateHolidayResponse,
  isAdmin = true,
}) => {
  // Staff Stats and Quota calculations for the Leave History sub-tab
  const staffStatsData = React.useMemo(() => {
    const yearlyRecords = viewingStaffRecords.filter(r => selectedYear === 'all' || (r.date && r.date.substring(0, 4) === selectedYear));
    return calculateStats(yearlyRecords, viewingStaff.working_hours || 9.5);
  }, [viewingStaff, viewingStaffRecords, selectedYear]);

  // Filtered records for Leave History list
  const filteredStaffRecords = React.useMemo(() => {
    return applyLeaveFilters(
      viewingStaffRecords,
      selectedYear,
      leaveFilterType,
      leaveFilterStartDate,
      leaveFilterEndDate,
      leaveSearchQuery
    );
  }, [viewingStaffRecords, selectedYear, leaveFilterType, leaveFilterStartDate, leaveFilterEndDate, leaveSearchQuery]);

  if (loadingLeaveData && viewingStaffRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-theme-card-bg/10 border border-theme-border-muted/50 rounded-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-2 text-xs text-theme-text-muted font-medium">Loading leave quotas & records...</p>
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
    <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted shadow-2xl rounded-2xl p-6">
      <UserDashboardView
        profile={viewingStaff}
        userStats={dashboardStats}
        globalSettings={globalSettings}
        holidayResponses={viewingStaffHolidayResponses}
        filteredUserRecords={filteredStaffRecords}
        userRecords={viewingStaffRecords}
        title={`${viewingStaff.username || viewingStaff.full_name}'s Leave Records`}
        emptyMessage={`No leave records found for ${viewingStaff.username || viewingStaff.full_name}.`}
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

        initialFetchDone={true}
        leaveSettlements={viewingStaffSettlements}
        onSaveLeaveSettlementsBulk={async () => true}
        hideDelete={hideDelete}
        showAddLeave={showAddLeave}
        isAdmin={isAdmin}
        canToggleAdjustment={isAdmin ?? true}
        onAdminUpdateHolidayResponse={onAdminUpdateHolidayResponse}
      />
    </div>
  );
};
