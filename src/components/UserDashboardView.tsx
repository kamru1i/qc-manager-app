import React from 'react';
import { UserStats } from './UserStats';
import { LeavesRecordsTable } from './LeavesRecordsTable';
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
import { useGovtHolidayStats, useHalfYearlyStats } from '@/hooks/useLeaveQuotaStats';
import { Calendar, RotateCcw, RefreshCw, ArrowLeft } from 'lucide-react';
import { UserSettleModal } from './modals/UserSettleModal';

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

  const [submittingDates, setSubmittingDates] = React.useState<string[]>([]);

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {onBackClick && (
        <button
          onClick={onBackClick}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer w-fit p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 rounded-xl shadow-md"
        >
          <ArrowLeft className="h-4 w-4 text-blue-400" /> Back to Add Leave
        </button>
      )}
      {/* Staff Leave Leave Settlement Alert Banner */}
      {showSettlementBanner && (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-indigo-900/40 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl shrink-0 mt-0.5">
              <RotateCcw className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {initiatedSettlements.length > 0
                  ? 'Leave Preferences Requested by Admin 📅'
                  : respondedSettlements.length > 0
                    ? 'Submitted Leave Preferences (Review Mode) 📅'
                    : `Leave Settlement Review Active (${selectedYear}) 📅`}
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {initiatedSettlements.length > 0 || respondedSettlements.length > 0 ? (
                  <>
                    {initiatedSettlements.length > 0
                      ? 'Admin has requested your preferences for: '
                      : 'You have submitted your preferences for (pending admin process): '}
                    <span className="font-semibold text-slate-200">{
                      [...initiatedSettlements, ...respondedSettlements].map(s => {
                        const periodLabel = s.period === 'Instant' ? 'Instant' : s.period;
                        const choiceLabel = getSettlementLabel(s, workingHours);
                        return `${s.leave_category} (${periodLabel}) [${choiceLabel}]`;
                      }).join(', ')
                    }</span>. You can edit your choice before they are processed by clicking below.
                  </>
                ) : (
                  <>
                    Leave settlement review is active for <span className="font-semibold text-slate-200">{broadcastCategory} ({broadcastPeriod === 'H1' ? 'January-June (H1)' : broadcastPeriod === 'H2' ? 'July-December (H2)' : 'Instant'})</span> — {selectedYear}.{' '}
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

      {/* Pending Govt Holiday Response Alert Banner */}
      {initialFetchDone && profile && profile.eligible_govt_holiday !== false && profile.allow_reserve !== false && pendingHolidays.length > 0 && (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-purple-900/40 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-xl shrink-0 mt-0.5">
              <Calendar className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Government Holiday Preferences Pending 🔔</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Please select what you would like to do for the following government holidays. You can either get paid or reserve the leave:
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {pendingHolidays.map((holiday, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 gap-1.5 font-sans">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                    {holiday.name} ({formatDate(holiday.date)})
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto shrink-0 border-t border-slate-850/80 md:border-t-0 pt-3 md:pt-0">
            {pendingHolidays.map((holiday) => {
              const isSubmitting = submittingDates.includes(holiday.date);
              return (
                <div key={holiday.date} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-955/60 border border-slate-850 rounded-xl md:w-80 font-sans">
                  <div className="text-[11px] font-semibold text-slate-300">
                    {holiday.name}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={async () => {
                        setSubmittingDates(prev => [...prev, holiday.date]);
                        await onSaveHolidayResponse(holiday.date, holiday.name, 'paid');
                        setSubmittingDates(prev => prev.filter(d => d !== holiday.date));
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-555 text-white border border-emerald-700 shadow-sm transition-all cursor-pointer disabled:opacity-50 font-sans flex items-center justify-center min-w-[65px] h-7"
                    >
                      {isSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Get Paid'}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={async () => {
                        setSubmittingDates(prev => [...prev, holiday.date]);
                        await onSaveHolidayResponse(holiday.date, holiday.name, 'reserve');
                        setSubmittingDates(prev => prev.filter(d => d !== holiday.date));
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-teal-600 hover:bg-teal-555 text-white border border-teal-700 shadow-sm transition-all cursor-pointer disabled:opacity-50 font-sans flex items-center justify-center min-w-[65px] h-7"
                    >
                      {isSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Reserve'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
        onRevisionClick={onRevisionClick}
        formatDate={formatDate}
        formatTimeToAMPM={formatTimeToAMPM}
        getCleanComment={getCleanComment}
        title="My Annual Leave Records"
        emptyMessage="No leave records found. Submit a new entry."
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
