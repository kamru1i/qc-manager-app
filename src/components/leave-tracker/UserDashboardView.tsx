import React from 'react';
import { UserStats } from '@/components/leave-tracker/UserStats';
import { LeavesRecordsTable } from '@/components/leave-tracker/LeavesRecordsTable';
import { ChutiRecord } from '@/utils/offlineSync';
import { Profile, GovtHolidayResponse, LeaveSettlement } from '@/types';
import {
  formatDate,
  formatTimeToAMPM,
  getCleanComment,
  GlobalSettings,
  parseIntervalToMinutes,
  formatDuration,
  parseHolidayItem,
  getSettlementSplits,
  getSettlementLabel
} from '@/utils/dashboardHelpers';
import { useGovtHolidayStats, useHalfYearlyStats } from '@/hooks/leave-tracker/useLeaveQuotaStats';
import {  RotateCcw, ArrowLeft } from 'lucide-react';
import { UserSettleModal } from '@/components/leave-tracker/modals/UserSettleModal';

interface UserDashboardViewProps {
  profile: Profile | null;
  userStats: {
    shortHours: string;
    overtimeHours: string;
    fullLeaves: number;
    totalHours: string;
    officeLeavesTaken?: number;
    eidFitrTaken?: number;
    eidAdhaTaken?: number;
    govtHolidaysTaken?: number;
  };
  globalSettings: GlobalSettings;
  filteredUserRecords: ChutiRecord[];
  userRecords: ChutiRecord[];
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  availableYears: string[];
  filterType: string;
  setFilterType: (val: string) => void;
  filterStartDate: string;
  setFilterStartDate: (val: string) => void;
  filterEndDate: string;
  setFilterEndDate: (val: string) => void;
  onResetFilters: () => void;
  onExportExcel: (filtered: ChutiRecord[], searchTerm: string) => void;
  onExportPDF: (filtered: ChutiRecord[], searchTerm: string) => void;
  onAddLeaveClick: () => void;
  onToggleAdjustment: (r: ChutiRecord) => void;
  onDeleteClick: (r: ChutiRecord) => void;
  onEditClick?: (r: ChutiRecord) => void;
  onRevisionClick: (r: ChutiRecord) => void;
  onConvertShortLeaveToFullLeave: (userId: string, workingHours: number, shortMins: number) => void;
  holidayResponses: GovtHolidayResponse[];
  onSaveHolidayResponse: (holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => Promise<boolean>;
  initialFetchDone: boolean;
  leaveSettlements: LeaveSettlement[];
  onSaveLeaveSettlementsBulk: (settlementsList: any[]) => Promise<boolean>;
  onBackClick?: () => void;
  /** When true, hides delete controls (supervisor view) */
  hideDelete?: boolean;
  /** When false, hides Add Leave button (normal user view) */
  showAddLeave?: boolean;
  title?: string;
  emptyMessage?: string;
}

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({
  profile,
  userStats,
  globalSettings,
  filteredUserRecords,
  userRecords,
  selectedYear,
  setSelectedYear,
  availableYears,
  filterType,
  setFilterType,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  onResetFilters,
  onExportExcel,
  onExportPDF,
  onAddLeaveClick,
  onToggleAdjustment,
  onDeleteClick,
  onEditClick,
  onRevisionClick,
  onConvertShortLeaveToFullLeave,
  holidayResponses,
  onSaveHolidayResponse,
  initialFetchDone,
  leaveSettlements,
  onSaveLeaveSettlementsBulk,
  onBackClick,
  hideDelete = false,
  showAddLeave = true,
  title = "My Annual Leave Records",
  emptyMessage = "No leave records found. Submit a new entry.",
}) => {
  // Eligibility & Deduction
  const isOfficeLeaveEligible = profile?.eligible_office_leave !== false;
  const isGovtHolidayEligible = profile?.eligible_govt_holiday !== false;

  // Previous year carried balances
  const prevYear = (Number(selectedYear) - 1).toString();
  const carriedOffice = leaveSettlements
    .filter((s) => s.user_id === profile?.id && s.year === prevYear && s.leave_category === 'Office Leave')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedGovt = leaveSettlements
    .filter((s) => s.user_id === profile?.id && s.year === prevYear && s.leave_category === 'Govt Holiday')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedEidFitr = leaveSettlements
    .filter((s) => s.user_id === profile?.id && s.year === prevYear && s.leave_category === 'Eid-ul-Fitr')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedEidAdha = leaveSettlements
    .filter((s) => s.user_id === profile?.id && s.year === prevYear && s.leave_category === 'Eid-ul-Adha')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  // Government Holiday calculations using shared hook
  const { respondedHolidays, govtHolidayStats } = useGovtHolidayStats(
    profile?.id,
    holidayResponses,
    globalSettings,
    isGovtHolidayEligible,
    userStats.govtHolidaysTaken || 0
  );

  // Current Year settled amounts (processed or responded) to prevent double counting
  const activeGovtSettled = leaveSettlements
    .filter(s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Govt Holiday' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const activeEidFitrSettled = leaveSettlements
    .filter(s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Fitr' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const activeEidAdhaSettled = leaveSettlements
    .filter(s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Adha' && (s.status === 'processed' || s.status === 'responded'))
    .reduce((acc, s) => acc + s.remaining_days, 0);

  const adjustedGovtHolidayStats = {
    ...govtHolidayStats,
    total: govtHolidayStats.total + carriedGovt,
    remaining: Math.max(0, govtHolidayStats.reserved + carriedGovt - govtHolidayStats.taken - activeGovtSettled)
  };

  const officeLeaveTotal = isOfficeLeaveEligible
    ? (globalSettings.office_leave_h1 + globalSettings.office_leave_h2) + carriedOffice + (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr + (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha
    : (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr + (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha;

  // Half-yearly split calculations using shared hook
  const { halfYearlyStats } = useHalfYearlyStats(
    userRecords,
    isOfficeLeaveEligible ? globalSettings.office_leave_h1 : 0,
    isOfficeLeaveEligible ? globalSettings.office_leave_h2 : 0,
    selectedYear,
    leaveSettlements,
    profile?.id,
    profile?.working_hours || 9.5
  );

  // Short to Full Leave Conversion Adjustments
  const convertedDays = profile?.converted_short_leaves_days ?? 0;

  // Total full-day leaves taken: unadjusted full + adjusted office + converted days
  const officeLeaveTaken = (userStats.officeLeavesTaken ?? 0)
    + (userStats.fullLeaves ?? 0)
    + convertedDays;

  const totalAllowed = officeLeaveTotal;

  const officeLeaveStats = {
    total: totalAllowed,
    taken: officeLeaveTaken,
    remaining: totalAllowed - officeLeaveTaken,
  };

  // Determine if leave settlement preference banner should show
  const userYearSettlements = leaveSettlements.filter(
    s => s.user_id === profile?.id && s.year === selectedYear
  );
  const hasAnySettlement = userYearSettlements.length > 0;

  const initiatedSettlements = userYearSettlements.filter(
    s => s.status === 'initiated'
  );
  const respondedSettlements = userYearSettlements.filter(
    s => s.status === 'responded'
  );

  const currentHalfPeriod: 'H1' | 'H2' = halfYearlyStats.currentHalf === 1 ? 'H1' : 'H2';

  const activeGovtSettledForPeriod = leaveSettlements.some(
    s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Govt Holiday' && s.period === currentHalfPeriod && (s.status === 'processed' || s.status === 'responded')
  );
  const govtRemaining = isGovtHolidayEligible && !activeGovtSettledForPeriod
    ? adjustedGovtHolidayStats.remaining
    : 0;

  const activeEidFitrSettledForPeriod = leaveSettlements.some(
    s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Fitr' && (s.status === 'processed' || s.status === 'responded')
  );
  const eidFitrRemaining = !activeEidFitrSettledForPeriod
    ? Math.max(0, (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr - (userStats.eidFitrTaken ?? 0))
    : 0;

  const activeEidAdhaSettledForPeriod = leaveSettlements.some(
    s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Adha' && (s.status === 'processed' || s.status === 'responded')
  );
  const eidAdhaRemaining = !activeEidAdhaSettledForPeriod
    ? Math.max(0, (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha - (userStats.eidAdhaTaken ?? 0))
    : 0;

  // Determine broadcast-specific remaining balance
  const broadcastPeriod = globalSettings.settlement_active_period;
  const broadcastCategory = globalSettings.settlement_active_category;

  const broadcastRemaining = React.useMemo(() => {
    if (!broadcastPeriod || !broadcastCategory || globalSettings.settlement_active_year !== selectedYear) return 0;

    if (broadcastCategory === 'Office Leave') {
      if (broadcastPeriod === 'H1') return halfYearlyStats.h1Remaining;
      if (broadcastPeriod === 'H2') return halfYearlyStats.h2Remaining;
      return officeLeaveStats.remaining;
    }
    if (broadcastCategory === 'Govt Holiday') return govtRemaining;
    if (broadcastCategory === 'Eid-ul-Fitr') return eidFitrRemaining;
    if (broadcastCategory === 'Eid-ul-Adha') return eidAdhaRemaining;
    return 0;
  }, [broadcastPeriod, broadcastCategory, globalSettings.settlement_active_year, selectedYear, halfYearlyStats, officeLeaveStats.remaining, govtRemaining, eidFitrRemaining, eidAdhaRemaining]);

  const isGeneralBroadcastActive = !hasAnySettlement &&
    globalSettings.settlement_active_year === selectedYear &&
    !!broadcastPeriod && !!broadcastCategory &&
    Math.abs(broadcastRemaining) > 0.01;

  const showSettlementBanner = initiatedSettlements.length > 0 || isGeneralBroadcastActive;

  const [showUserSettleModal, setShowUserSettleModal] = React.useState(false);

  // Identify government holidays that the user has not responded to yet
  const pendingHolidays = React.useMemo(() => {
    return (globalSettings.govt_holidays || [])
      .map(h => parseHolidayItem(h))
      .filter(h => {
        const responded = holidayResponses.some(r => r.user_id === profile?.id && r.holiday_date === h.date);
        return !responded;
      });
  }, [globalSettings.govt_holidays, holidayResponses, profile?.id]);

  // Auto-approve as 'paid' if allow_reserve is false, initial fetch is done, and there are pending holidays
  React.useEffect(() => {
    if (initialFetchDone && profile && profile.eligible_govt_holiday !== false && profile.allow_reserve === false && pendingHolidays.length > 0) {
      pendingHolidays.forEach((holiday) => {
        onSaveHolidayResponse(holiday.date, holiday.name, 'paid');
      });
    }
  }, [initialFetchDone, profile, pendingHolidays, onSaveHolidayResponse]);

  // Short to Full Leave Conversion Adjustments
  const convertedHours = profile?.converted_short_leaves_hours ?? 0;

  const totalShortMins = parseIntervalToMinutes(userStats.shortHours);
  const netShortMins = Math.max(0, totalShortMins - convertedHours * 60);
  const displayShortHours = formatDuration(netShortMins);

  const displayFullLeaves = userStats.fullLeaves + convertedDays;

  const workingHours = profile?.working_hours ?? 9.5;
  const hasConvertibleHours = netShortMins >= workingHours * 60;

  const handleConvertToFullLeave = () => {
    if (!profile) return;
    const maxDays = Math.floor(netShortMins / (workingHours * 60));
    const hoursText = (maxDays * workingHours).toFixed(1);

    if (confirm(`Do you want to convert ${hoursText} hours of short leave to ${maxDays} days of full leave?\n(This will deduct from your short leave balance and add to your full leave)`)) {
      onConvertShortLeaveToFullLeave(profile.id, workingHours, netShortMins);
    }
  };


  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {onBackClick && (
        <button
          onClick={onBackClick}
          className="flex items-center gap-2 text-xs font-semibold text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer w-fit p-2 bg-theme-card-container/60 hover:bg-theme-card-bg border border-theme-border-input rounded-xl shadow-md"
        >
          <ArrowLeft className="h-4 w-4 text-blue-400" />
        </button>
      )}
      {/* Staff Leave Leave Settlement Alert Banner */}
      {showSettlementBanner && (
        <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-indigo-900/40 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl shrink-0 mt-0.5">
              <RotateCcw className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-theme-text-primary">
                {initiatedSettlements.length > 0
                  ? 'Leave Preferences Requested by Admin 📅'
                  : respondedSettlements.length > 0
                    ? 'Submitted Leave Preferences (Review Mode) 📅'
                    : `Leave Settlement Review Active (${selectedYear}) 📅`}
              </h4>
              <p className="text-xs text-theme-text-muted mt-1 leading-relaxed">
                {initiatedSettlements.length > 0 || respondedSettlements.length > 0 ? (
                  <>
                    {initiatedSettlements.length > 0
                      ? 'Admin has requested your preferences for: '
                      : 'You have submitted your preferences for (pending admin process): '}
                    <span className="font-semibold text-theme-text-primary">{
                      [...initiatedSettlements, ...respondedSettlements].map(s => {
                        const periodLabel = s.period === 'Instant' ? 'Instant' : s.period;
                        const choiceLabel = getSettlementLabel(s, workingHours);
                        return `${s.leave_category} (${periodLabel}) [${choiceLabel}]`;
                      }).join(', ')
                    }</span>. You can edit your choice before they are processed by clicking below.
                  </>
                ) : (
                  <>
                    Leave settlement review is active for <span className="font-semibold text-theme-text-primary">{broadcastCategory} ({broadcastPeriod === 'H1' ? 'January-June (H1)' : broadcastPeriod === 'H2' ? 'July-December (H2)' : 'Instant'})</span> — {selectedYear}.{' '}
                    {broadcastRemaining < 0 ? (
                      <>
                        You have an outstanding deficit of <span className="font-semibold text-rose-455 font-mono">{Math.abs(broadcastRemaining)} days</span>. Please select how to resolve it.
                      </>
                    ) : (
                      <>
                        You have <span className="font-semibold text-blue-455 font-mono">{broadcastRemaining} days</span> remaining. Please submit your settlement preferences.
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUserSettleModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow transition-all cursor-pointer text-xs shrink-0 self-start sm:self-center"
          >
            {initiatedSettlements.length > 0 ? 'Select Preferences' : respondedSettlements.length > 0 ? 'Edit Preferences' : 'Select Preferences'}
          </button>
        </div>
      )}

      <UserStats
        stats={{
          ...userStats,
          shortHours: displayShortHours,
          fullLeaves: displayFullLeaves
        }}
        workingHours={workingHours}
        officeLeaveStats={officeLeaveStats}
        govtHolidayStats={adjustedGovtHolidayStats}
        allowOvertime={profile?.allow_overtime}
        respondedHolidays={respondedHolidays}
        convertedDays={convertedDays}
        convertedHours={convertedHours}
        onConvertToFullLeave={handleConvertToFullLeave}
        hasConvertibleHours={hasConvertibleHours}
        eligibleOfficeLeave={profile?.eligible_office_leave !== false}
        eligibleGovtHoliday={profile?.eligible_govt_holiday !== false}
        halfYearlyStats={halfYearlyStats}
        eidFitrRemaining={Math.max(0, (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr - (userStats.eidFitrTaken ?? 0) - activeEidFitrSettled)}
        eidFitrTotal={(globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr}
        eidAdhaRemaining={Math.max(0, (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha - (userStats.eidAdhaTaken ?? 0) - activeEidAdhaSettled)}
        eidAdhaTotal={(globalSettings.eid_adha_leave ?? 0) + carriedEidAdha}
        initialFetchDone={initialFetchDone}
      />

      <LeavesRecordsTable
        records={filteredUserRecords}
        allowOvertime={profile?.allow_overtime}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        onResetFilters={onResetFilters}
        onExportExcel={onExportExcel}
        onExportPDF={onExportPDF}
        onAddLeaveClick={onAddLeaveClick}
        onToggleAdjustment={onToggleAdjustment}
        onDeleteClick={onDeleteClick}
        onEditClick={onEditClick}
        onRevisionClick={onRevisionClick}
        formatDate={formatDate}
        formatTimeToAMPM={formatTimeToAMPM}
        getCleanComment={getCleanComment}
        title={title}
        emptyMessage={emptyMessage}
        showPendingBadge={true}
        initialFetchDone={initialFetchDone}
        hideDelete={hideDelete}
        showAddLeave={showAddLeave}
      />

      {showUserSettleModal && (
        <UserSettleModal
          showModal={showUserSettleModal}
          setShowModal={setShowUserSettleModal}
          profile={profile}
          selectedYear={selectedYear}
          records={userRecords}
          globalSettings={globalSettings}
          settlements={leaveSettlements}
          holidayResponses={holidayResponses}
          onSaveSettlementsBulk={onSaveLeaveSettlementsBulk}
        />
      )}
    </div>
  );
};
