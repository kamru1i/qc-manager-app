import React from 'react';
import {
  User,
  Calendar,
  ArrowLeft,
  AlertTriangle,
  Edit,
  Trash2,
  Settings,
  RotateCcw,
  Download
} from 'lucide-react';
import { Profile, ChutiRecordWithProfile, GovtHolidayResponse, LeaveSettlement } from '@/types';
import { AdminSettlementsPanel } from './AdminSettlementsPanel';
import { ChutiRecord } from '@/utils/offlineSync';
import { LeavesRecordsTable } from './LeavesRecordsTable';
import { StaffMasterTable } from './StaffMasterTable';
import {
  formatDate,
  formatTimeToAMPM,
  getCleanComment,
  formatWorkingHours,
  GlobalSettings,
  parseIntervalToMinutes,
  formatDuration,
  parseHolidayItem,
  getSettlementSplits
} from '@/utils/dashboardHelpers';
import { useGovtHolidayStats, useHalfYearlyStats } from '@/hooks/useLeaveQuotaStats';
import { AdminOfficeLeaveSettingsModal } from './modals/AdminOfficeLeaveSettingsModal';
import { AdminEidLeaveSettingsModal } from './modals/AdminEidLeaveSettingsModal';
import { AdminGovtHolidaysSettingsModal } from './modals/AdminGovtHolidaysSettingsModal';
import { StatCard } from './StatCard';
import { UserStats } from './UserStats';
import { DateInput } from './DateInput';
import { SkeletonLoader } from './SkeletonLoader';

interface AdminDashboardViewProps {
  profilesList: Profile[];
  viewingStaffId: string | null;
  setViewingStaffId: (id: string | null) => void;
  staffProfile: Profile | null;
  individualRecords: ChutiRecordWithProfile[];
  unfilteredStaffRecords: ChutiRecordWithProfile[];
  staffStats: {
    shortHours: string;
    overtimeHours: string;
    fullLeaves: number;
    totalHours: string;
    govtHolidaysTaken?: number;
    eidFitrTaken?: number;
    eidAdhaTaken?: number;
  };
  filterType: string;
  setFilterType: (val: string) => void;
  filterStartDate: string;
  setFilterStartDate: (val: string) => void;
  filterEndDate: string;
  setFilterEndDate: (val: string) => void;
  onResetFilters: () => void;
  onExportIndividualExcel: (filtered: ChutiRecord[], searchTerm: string) => void;
  onExportIndividualPDF: (filtered: ChutiRecord[], searchTerm: string) => void;
  onToggleAdjustment: (r: ChutiRecord) => void;
  onEditClick: (r: ChutiRecord) => void;
  onDeleteClick: (r: ChutiRecord) => void;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  availableYears: string[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  getUserSummaryStats: (id: string) => {
    full: number;
    short: string;
    overtime: string;
  };
  onChangePasswordClick: (userId: string, username: string) => void;
  onEditProfileClick: (staff: Profile) => void;
  onDeleteUserClick: (staff: Profile) => void;
  onAddStaffClick: () => void;
  onExportSummaryExcel: () => void;
  onExportSummaryPDF: () => void;
  onAddLeaveClick: () => void;
  globalSettings: GlobalSettings;
  onSaveGlobalSettings: (settings: GlobalSettings, options?: { silent?: boolean }) => Promise<boolean>;
  onConvertShortLeaveToFullLeave: (userId: string, workingHours: number, shortMins: number) => void;
  holidayResponses: GovtHolidayResponse[];
  onExportHolidayResponsesExcel: (responses: GovtHolidayResponse[]) => void;
  onExportHolidayResponsesPDF: (responses: GovtHolidayResponse[]) => void;
  onUpdateHolidayResponse?: (targetUserId: string, holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => Promise<boolean>;
  leaveSettlements: LeaveSettlement[];
  onSaveLeaveSettlementsBulk: (settlementsList: any[]) => Promise<boolean>;
  onDeleteSettlement: (id: string) => Promise<boolean>;
  adminRecords: ChutiRecordWithProfile[];
  currentUserProfile: Profile | null;
  initialFetchDone: boolean;
  activeTab?: 'staff_master' | 'govt_responses' | 'settlement';
  setActiveTab?: (tab: 'staff_master' | 'govt_responses' | 'settlement') => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  profilesList,
  viewingStaffId,
  setViewingStaffId,
  staffProfile,
  individualRecords,
  unfilteredStaffRecords,
  staffStats,
  filterType,
  setFilterType,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  onResetFilters,
  onExportIndividualExcel,
  onExportIndividualPDF,
  onToggleAdjustment,
  onEditClick,
  onDeleteClick,
  selectedYear,
  setSelectedYear,
  availableYears,
  searchQuery,
  setSearchQuery,
  getUserSummaryStats,
  onChangePasswordClick,
  onEditProfileClick,
  onDeleteUserClick,
  onAddStaffClick,
  onExportSummaryExcel,
  onExportSummaryPDF,
  onAddLeaveClick,
  globalSettings,
  onSaveGlobalSettings,
  onConvertShortLeaveToFullLeave,
  holidayResponses,
  onExportHolidayResponsesExcel,
  onExportHolidayResponsesPDF,
  onUpdateHolidayResponse,
  leaveSettlements,
  onSaveLeaveSettlementsBulk,
  onDeleteSettlement,
  adminRecords,
  currentUserProfile,
  initialFetchDone,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
}) => {

  // Local settings modals visibility
  const [showOfficeModal, setShowOfficeModal] = React.useState(false);
  const [showEidModal, setShowEidModal] = React.useState(false);
  const [showGovtModal, setShowGovtModal] = React.useState(false);
  
  const [localActiveTab, setLocalActiveTab] = React.useState<'staff_master' | 'govt_responses' | 'settlement'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('adminActiveTab');
      if (saved === 'staff_master' || saved === 'govt_responses' || saved === 'settlement') {
        return saved;
      }
    }
    return 'staff_master';
  });

  const activeTab = propActiveTab || localActiveTab;
  const setActiveTab = propSetActiveTab || setLocalActiveTab;

  React.useEffect(() => {
    sessionStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  // Holiday search filters state
  const [holidaySearchQuery, setHolidaySearchQuery] = React.useState('');
  const [holidaySearchDate, setHolidaySearchDate] = React.useState('');

  // Eligibility & Deduction for viewed staff
  const viewingProfile = profilesList.find((p) => p.id === viewingStaffId);
  const isOfficeLeaveEligible = staffProfile?.eligible_office_leave !== false;
  const isGovtHolidayEligible = staffProfile?.eligible_govt_holiday !== false;

  // Previous year carried balances
  const prevYear = (Number(selectedYear) - 1).toString();
  const carriedOffice = leaveSettlements
    .filter((s) => s.user_id === staffProfile?.id && s.year === prevYear && s.leave_category === 'Office Leave')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedGovt = leaveSettlements
    .filter((s) => s.user_id === staffProfile?.id && s.year === prevYear && s.leave_category === 'Govt Holiday')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedEidFitr = leaveSettlements
    .filter((s) => s.user_id === staffProfile?.id && s.year === prevYear && s.leave_category === 'Eid-ul-Fitr')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedEidAdha = leaveSettlements
    .filter((s) => s.user_id === staffProfile?.id && s.year === prevYear && s.leave_category === 'Eid-ul-Adha')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  // Staff deduction is deleted from DB settings, default is 0
  const staffOfficeQuota = isOfficeLeaveEligible
    ? (globalSettings.office_leave_h1 + globalSettings.office_leave_h2) + carriedOffice + (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr + (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha
    : (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr + (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha;


  const approvedIndividualRecs = React.useMemo(() => {
    return unfilteredStaffRecords.filter(r => r.status === 'approved' && r.date && (selectedYear === 'all' || r.date.substring(0, 4) === selectedYear));
  }, [unfilteredStaffRecords, selectedYear]);

  const staffOfficeTaken = React.useMemo(() => {
    if (isOfficeLeaveEligible) {
      return approvedIndividualRecs.filter(r => r.adjustment && (r.comment?.includes("Office Leave") || false)).length;
    } else {
      return 0;
    }
  }, [approvedIndividualRecs, isOfficeLeaveEligible]);

  // Government Holiday calculations using shared hook
  const { respondedHolidays, govtHolidayStats } = useGovtHolidayStats(
    staffProfile?.id,
    holidayResponses,
    globalSettings,
    isGovtHolidayEligible,
    staffStats.govtHolidaysTaken || 0
  );

  // Current Year settled amounts (processed or responded) to prevent double counting
  const activeGovtSettled = leaveSettlements
    .filter(s => s.user_id === staffProfile?.id && s.year === selectedYear && s.leave_category === 'Govt Holiday' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const activeEidFitrSettled = leaveSettlements
    .filter(s => s.user_id === staffProfile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Fitr' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const activeEidAdhaSettled = leaveSettlements
    .filter(s => s.user_id === staffProfile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Adha' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const adjustedGovtHolidayStats = {
    ...govtHolidayStats,
    total: govtHolidayStats.total + carriedGovt,
    remaining: Math.max(0, govtHolidayStats.reserved + carriedGovt - govtHolidayStats.taken - activeGovtSettled)
  };

  // Half-yearly split calculations using shared hook
  const { halfYearlyStats } = useHalfYearlyStats(
    unfilteredStaffRecords,
    isOfficeLeaveEligible ? globalSettings.office_leave_h1 : 0,
    isOfficeLeaveEligible ? globalSettings.office_leave_h2 : 0,
    selectedYear,
    leaveSettlements,
    staffProfile?.id,
    staffProfile?.working_hours || 9.5
  );

  // Short to Full Leave Conversion Adjustments for viewed staff
  const convertedDays = staffProfile?.converted_short_leaves_days ?? 0;
  const convertedHours = staffProfile?.converted_short_leaves_hours ?? 0;

  // Total full-day leaves taken: adjusted office + unadjusted full + converted days
  const totalTaken = staffOfficeTaken
    + (staffStats.fullLeaves ?? 0)
    + convertedDays;

  const totalAllowed = staffOfficeQuota;

  const officeLeaveStats = {
    total: totalAllowed,
    taken: totalTaken,
    remaining: totalAllowed - totalTaken,
  };

  const totalShortMins = parseIntervalToMinutes(staffStats.shortHours);
  const netShortMins = Math.max(0, totalShortMins - convertedHours * 60);
  const displayShortHours = formatDuration(netShortMins);

  const displayFullLeaves = staffStats.fullLeaves + convertedDays;

  const workingHours = staffProfile?.working_hours ?? 9.5;
  const hasConvertibleHours = netShortMins >= workingHours * 60;

  const handleConvertToFullLeave = () => {
    if (!staffProfile) return;
    const maxDays = Math.floor(netShortMins / (workingHours * 60));
    const hoursText = (maxDays * workingHours).toFixed(1);

    if (confirm(`Do you want to convert ${hoursText} hours of short leave into ${maxDays} days of full leave?\n(This will be subtracted from the staff's short leave balance and added to their full leave)`)) {
      onConvertShortLeaveToFullLeave(staffProfile.id, workingHours, netShortMins);
    }
  };

  // Filtered responses for Govt Holiday Response table report
  const filteredResponses = React.useMemo(() => {
    const activeHolidayDates = new Set((globalSettings.govt_holidays || []).map(h => parseHolidayItem(h).date));
    return holidayResponses.filter(r => {
      if (!activeHolidayDates.has(r.holiday_date)) return false;

      const matchesDate = holidaySearchDate ? r.holiday_date === holidaySearchDate : true;

      const searchLower = holidaySearchQuery.toLowerCase().trim();
      if (!searchLower) return matchesDate;

      const employeeName = r.profiles?.full_name || '';
      const employeeCode = r.profiles?.username || '';
      const holidayName = r.holiday_name || '';

      const matchesQuery =
        employeeName.toLowerCase().includes(searchLower) ||
        employeeCode.toLowerCase().includes(searchLower) ||
        holidayName.toLowerCase().includes(searchLower);

      return matchesDate && matchesQuery;
    });
  }, [holidayResponses, holidaySearchDate, holidaySearchQuery, globalSettings.govt_holidays]);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Cards */}
      {!viewingStaffId && (
        <div className="flex flex-wrap justify-center gap-4 w-full animate-fade-in">

          {/* Card 2: Office Allocated Leave */}
          <StatCard
            icon={Calendar}
            iconBgClass="bg-orange-500/10"
            iconColorClass="text-orange-400"
            iconBorderClass="border-orange-500/20"
            title="Allocated Office Leave"
            value={`${globalSettings.office_leave_h1 + globalSettings.office_leave_h2} days`}
            action={
              <button
                onClick={() => setShowOfficeModal(true)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-700"
                title="Leave Quota Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            }
            className="w-full max-w-xs"
            loading={!initialFetchDone}
          />

          {/* Card 3: Eid Leave */}
          <StatCard
            icon={Calendar}
            iconBgClass="bg-orange-500/10"
            iconColorClass="text-orange-400"
            iconBorderClass="border-orange-500/20"
            title="Eid Leave"
            value={`${(globalSettings.eid_fitr_leave ?? 0) + (globalSettings.eid_adha_leave ?? 0)} days`}
            action={
              <button
                onClick={() => setShowEidModal(true)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-700"
                title="Eid Leave Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            }
            className="w-full max-w-xs"
            loading={!initialFetchDone}
          />

          {/* Card 4: Govt Holiday */}
          <StatCard
            icon={Calendar}
            iconBgClass="bg-teal-500/10"
            iconColorClass="text-teal-400"
            iconBorderClass="border-teal-500/20"
            title="Govt Holiday"
            value={`${globalSettings.govt_holidays?.length ?? 0} days`}
            action={
              <button
                onClick={() => setShowGovtModal(true)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-700"
                title="Govt Holiday Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            }
            className="w-full max-w-xs"
            loading={!initialFetchDone}
          />
        </div>
      )}

      {viewingStaffId ? (
        <div className="flex flex-col gap-6">
          {!staffProfile ? (
            <div className="flex flex-col gap-6 w-full">
              <SkeletonLoader variant="profile-header" />
              <SkeletonLoader variant="stats" cards={4} />
              <SkeletonLoader variant="leaves-table" rows={5} />
            </div>
          ) : (
            <>
              {/* Individual Profile Top Box */}
              <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-2xl rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setViewingStaffId(null)}
                    className="p-2.5 bg-slate-855 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 transition-all cursor-pointer"
                    title="Go Back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      {staffProfile?.full_name || 'Staff User'}{staffProfile?.username ? ` (${staffProfile.username.toUpperCase()})` : ''}
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${staffProfile?.role === 'admin'
                        ? 'bg-orange-955/60 border-orange-800 text-orange-300'
                        : staffProfile?.role === 'supervisor'
                          ? 'bg-amber-955/60 border-amber-805 text-amber-300'
                          : 'bg-orange-955/60 border-orange-805 text-orange-300'
                        }`}>
                        {staffProfile?.job_role || (staffProfile?.role === 'admin' ? 'Admin' : (staffProfile?.role === 'supervisor' ? 'Supervisor' : 'Staff'))}
                      </span>
                    </h2>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400">
                      <div>Working Hours: <strong className="text-white">{formatWorkingHours(staffProfile?.working_hours || 9.5)}</strong></div>
                      <div>Break Time: <strong className="text-white">{staffProfile?.break_time || 0} mins</strong></div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onChangePasswordClick(staffProfile?.id || '', staffProfile?.username || '')}
                    className="px-3.5 py-2 bg-slate-855 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Change Password
                  </button>
                  <button
                    onClick={() => staffProfile && onEditProfileClick(staffProfile)}
                    className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-md shadow-orange-950/10 border border-orange-700 flex items-center gap-1.5"
                  >
                    <Edit className="h-3.5 w-3.5" /> Edit Profile
                  </button>
                  {staffProfile?.role !== 'admin' && (
                    <button
                      onClick={() => staffProfile && onDeleteUserClick(staffProfile)}
                      className="px-3.5 py-2 bg-red-600/90 hover:bg-red-700 border border-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete User
                    </button>
                  )}
                </div>
              </div>

              {/* Stats for the viewed staff */}
              <UserStats
                stats={{
                  shortHours: displayShortHours,
                  fullLeaves: displayFullLeaves,
                  overtimeHours: staffStats.overtimeHours
                }}
                workingHours={workingHours}
                officeLeaveStats={officeLeaveStats}
                govtHolidayStats={adjustedGovtHolidayStats}
                allowOvertime={staffProfile?.allow_overtime}
                respondedHolidays={respondedHolidays}
                convertedDays={convertedDays}
                convertedHours={convertedHours}
                onConvertToFullLeave={handleConvertToFullLeave}
                hasConvertibleHours={hasConvertibleHours}
                eligibleOfficeLeave={staffProfile?.eligible_office_leave !== false}
                eligibleGovtHoliday={staffProfile?.eligible_govt_holiday !== false}
                halfYearlyStats={halfYearlyStats}
                isAdmin={true}
                userId={viewingStaffId || undefined}
                onUpdateHolidayResponse={onUpdateHolidayResponse}
                eidFitrRemaining={Math.max(0, (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr - (staffStats.eidFitrTaken ?? 0) - activeEidFitrSettled)}
                eidFitrTotal={(globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr}
                eidAdhaRemaining={Math.max(0, (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha - (staffStats.eidAdhaTaken ?? 0) - activeEidAdhaSettled)}
                eidAdhaTotal={(globalSettings.eid_adha_leave ?? 0) + carriedEidAdha}
                initialFetchDone={initialFetchDone}
              />

              {/* Filtering Panel for viewed staff */}
              <LeavesRecordsTable
                records={individualRecords}
                allowOvertime={staffProfile?.allow_overtime}
                filterType={filterType}
                setFilterType={setFilterType}
                filterStartDate={filterStartDate}
                setFilterStartDate={setFilterStartDate}
                filterEndDate={filterEndDate}
                setFilterEndDate={setFilterEndDate}
                onResetFilters={onResetFilters}
                onExportExcel={onExportIndividualExcel}
                onExportPDF={onExportIndividualPDF}
                onToggleAdjustment={onToggleAdjustment}
                onEditClick={onEditClick}
                onDeleteClick={onDeleteClick}
                onAddLeaveClick={onAddLeaveClick}
                formatDate={formatDate}
                formatTimeToAMPM={formatTimeToAMPM}
                getCleanComment={getCleanComment}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                availableYears={availableYears}
                title="Leave Records"
                emptyMessage="No leave records found for this staff member."
                initialFetchDone={initialFetchDone}
              />
            </>
          )}
        </div>
      ) : (
        /* ================= STAFF MASTER DATABASE SUMMARY TABLE ================= */
        <div className="flex flex-col gap-6">


          {activeTab === 'staff_master' ? (
            /* ================= STAFF MASTER DATABASE SUMMARY TABLE ================= */
            <StaffMasterTable
              profilesList={profilesList}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              getUserSummaryStats={getUserSummaryStats}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              availableYears={availableYears}
              onAddStaffClick={onAddStaffClick}
              onExportExcel={onExportSummaryExcel}
              onExportPDF={onExportSummaryPDF}
              onViewDetails={setViewingStaffId}
              initialFetchDone={initialFetchDone}
            />
          ) : activeTab === 'govt_responses' ? (
            /* ================= GOVT HOLIDAY RESPONSES TABLE REPORT ================= */
            <div className="bg-slate-900/40 backdrop-blur-xl  shadow-2xl rounded-2xl p-6 flex flex-col gap-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-teal-400" />
                    Govt Holiday Response Report
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Staff preferences and responses for government holidays (Paid vs Reserve)
                  </p>
                </div>

                {/* Export buttons */}
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => onExportHolidayResponsesExcel(filteredResponses)}
                    disabled={filteredResponses.length === 0}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-500 hover:bg-emerald-600/10 dark:hover:bg-emerald-500/10 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 transition-all shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" /> Excel
                  </button>
                  <button
                    onClick={() => onExportHolidayResponsesPDF(filteredResponses)}
                    disabled={filteredResponses.length === 0}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 hover:bg-red-600/10 dark:hover:bg-red-500/10 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 transition-all shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              </div>

              {/* Search Filters */}
              <div className="flex flex-col sm:flex-row gap-3 w-full bg-slate-905/40 p-3 rounded-xl border border-slate-850">
                <div className="flex-1 relative">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Search by holiday name or Name (codename)</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search name or codename..."
                      value={holidaySearchQuery}
                      onChange={(e) => setHolidaySearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-xs text-white focus:outline-none focus:border-teal-500/50 transition-all placeholder-slate-500"
                    />
                    {holidaySearchQuery && (
                      <button
                        onClick={() => setHolidaySearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-355 transition-colors cursor-pointer text-sm font-semibold"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Filter by holiday date</label>
                  <DateInput
                    value={holidaySearchDate}
                    onChange={(val) => setHolidaySearchDate(val)}
                    className="bg-slate-900 border border-slate-800"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setHolidaySearchQuery('');
                      setHolidaySearchDate('');
                    }}
                    className="flex items-center justify-center h-[32px] w-[32px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg cursor-pointer transition-all"
                    title="Reset"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Table Container */}
              {!initialFetchDone ? (
                <SkeletonLoader variant="responses-table" rows={5} />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-955/20">
                  <table className="min-w-full divide-y divide-slate-900 text-left text-xs text-slate-300">
                    <thead className="bg-slate-955/60 text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Holiday Date</th>
                        <th className="px-4 py-3">Holiday Name</th>
                        <th className="px-4 py-3">Name (Codename)</th>
                        <th className="px-4 py-3">Preference/Response</th>
                        <th className="px-4 py-3 text-right">Response Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 bg-slate-900/10">
                      {filteredResponses.length > 0 ? (
                        filteredResponses.map((resp) => {
                          const fullName = resp.profiles?.full_name || 'Staff';
                          const codeName = resp.profiles?.username ? resp.profiles.username.toUpperCase() : 'N/A';

                          return (
                            <tr key={resp.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-200">
                                {formatDate(resp.holiday_date)}
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {resp.holiday_name}
                              </td>
                              <td className="px-4 py-3 font-medium text-teal-400">
                                {fullName} ({codeName})
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${resp.response === 'paid'
                                  ? 'bg-emerald-955/60 border-emerald-800 text-emerald-300'
                                  : 'bg-teal-955/60 border-teal-800 text-teal-300'
                                  }`}>
                                  {resp.response === 'paid' ? 'Get Paid' : 'Reserve'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-slate-500">
                                {resp.created_at ? new Date(resp.created_at).toLocaleString('en-US', { hour12: true }) : '-'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            No holiday response records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ================= Staff Leave SETTLEMENTS TAB ================= */
            <AdminSettlementsPanel
              profilesList={profilesList}
              selectedYear={selectedYear}
              records={adminRecords}
              globalSettings={globalSettings}
              onSaveGlobalSettings={onSaveGlobalSettings}
              leaveSettlements={leaveSettlements}
              holidayResponses={holidayResponses}
              onSaveSettlementsBulk={onSaveLeaveSettlementsBulk}
              onDeleteSettlement={onDeleteSettlement}
              currentUserProfile={currentUserProfile}
              initialFetchDone={initialFetchDone}
            />
          )}
        </div>
      )}

      {/* Admin Settings Modals */}
      <AdminOfficeLeaveSettingsModal
        showModal={showOfficeModal}
        setShowModal={setShowOfficeModal}
        globalSettings={globalSettings}
        onSave={onSaveGlobalSettings}
      />
      <AdminEidLeaveSettingsModal
        showModal={showEidModal}
        setShowModal={setShowEidModal}
        globalSettings={globalSettings}
        onSave={onSaveGlobalSettings}
      />
      <AdminGovtHolidaysSettingsModal
        showModal={showGovtModal}
        setShowModal={setShowGovtModal}
        globalSettings={globalSettings}
        onSave={onSaveGlobalSettings}
      />
    </div>
  );
};
