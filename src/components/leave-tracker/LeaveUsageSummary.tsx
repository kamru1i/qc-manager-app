import React from 'react';
import { HalfYearlyOfficeLeaveStats, formatDaysAndHours } from '@/utils/dashboardHelpers';

interface LeaveUsageSummaryProps {
  selectedYear: string;
  officeLeaveRemaining: number;
  officeLeaveTotal: number;
  govtHolidayRemaining: number;
  govtHolidayTotal: number;
  eidFitrRemaining: number;
  eidFitrTotal: number;
  eidAdhaRemaining: number;
  eidAdhaTotal: number;
  fullLeaves: number;
  shortHours: string;
  overtimeHours: string;
  allowOvertime?: boolean;
  eligibleOfficeLeave?: boolean;
  eligibleGovtHoliday?: boolean;
  halfYearlyStats?: HalfYearlyOfficeLeaveStats;
  officeDeduction?: number;
  govtDeduction?: number;
  eidFitrDeduction?: number;
  eidAdhaDeduction?: number;
  workingHours?: number;
}

export const LeaveUsageSummary: React.FC<LeaveUsageSummaryProps> = ({
  selectedYear,
  officeLeaveRemaining,
  govtHolidayRemaining,
  govtHolidayTotal,
  eidFitrRemaining,
  eidAdhaRemaining,
  fullLeaves,
  shortHours,
  overtimeHours,
  allowOvertime = false,
  halfYearlyStats,
  officeDeduction = 0,
  govtDeduction = 0,
  eidFitrDeduction = 0,
  eidAdhaDeduction = 0,
  workingHours = 9.5,
}) => {
  let officeRemainingVal = officeLeaveRemaining;
  let officeSubtext = '';

  if (halfYearlyStats) {
    if (halfYearlyStats.isMergedMode) {
      officeRemainingVal = halfYearlyStats.h1Remaining;
      const h1Carryover = halfYearlyStats.h1Total - halfYearlyStats.h1Base;
      const hasH1Carryover = h1Carryover > 0;
      officeSubtext = hasH1Carryover
        ? `Full Year Allowance: ${formatDaysAndHours(halfYearlyStats.h1Base, workingHours)} + ${formatDaysAndHours(h1Carryover, workingHours)} carryover`
        : `Full Year Allowance: ${formatDaysAndHours(halfYearlyStats.h1Total, workingHours)}`;
    } else {
      const isH1 = halfYearlyStats.currentHalf === 1;
      officeRemainingVal = isH1
        ? halfYearlyStats.h1Remaining
        : halfYearlyStats.h2Remaining;
      const h1Carryover = halfYearlyStats.h1Total - halfYearlyStats.h1Base;
      const hasH1Carryover = h1Carryover > 0;
      const hasH2Carryover = halfYearlyStats.carryForward > 0;

      officeSubtext = isH1
        ? (hasH1Carryover
            ? `H1 (Jan-Jun) Allowance: ${formatDaysAndHours(halfYearlyStats.h1Base, workingHours)} + ${formatDaysAndHours(h1Carryover, workingHours)} carryover`
            : `H1 (Jan-Jun) Allowance: ${formatDaysAndHours(halfYearlyStats.h1Total, workingHours)}`)
        : (hasH2Carryover
            ? `H2 (Jul-Dec) Allowance: ${formatDaysAndHours(halfYearlyStats.h2Base, workingHours)} + ${formatDaysAndHours(halfYearlyStats.carryForward, workingHours)} carryover`
            : `H2 (Jul-Dec) Allowance: ${formatDaysAndHours(halfYearlyStats.h2Total, workingHours)}`);
    }
  }

  const finalOfficeRemaining = officeRemainingVal - officeDeduction;

  const finalGovtRemaining = govtHolidayRemaining - govtDeduction;
  const isGovtChanged = govtDeduction > 0;

  const finalEidFitrRemaining = eidFitrRemaining - eidFitrDeduction;
  const isEidFitrChanged = eidFitrDeduction > 0;

  const finalEidAdhaRemaining = eidAdhaRemaining - eidAdhaDeduction;
  const isEidAdhaChanged = eidAdhaDeduction > 0;

  const renderRemainingNode = (remaining: number, deduction: number = 0) => {
    const formatParts = (val: number) => {
      const totalMins = Math.round(val * workingHours * 60);
      const isNegative = totalMins < 0;
      const absMins = Math.abs(totalMins);
      const minutesPerDay = Math.round(workingHours * 60);
      const wholeDays = Math.floor(absMins / minutesPerDay);
      const remainingMins = absMins % minutesPerDay;
      const hours = Math.floor(remainingMins / 60);
      const mins = remainingMins % 60;

      const dayStr = `${wholeDays} day${wholeDays !== 1 ? 's' : ''}`;
      const hrPart = hours > 0 ? `${String(hours).padStart(2, '0')} hr${hours > 1 ? 's' : ''}` : '';
      const minPart = mins > 0 ? `${String(mins).padStart(2, '0')} min${mins > 1 ? 's' : ''}` : '';
      const timeParts = [hrPart, minPart].filter(Boolean).join(' ');

      return { isNegative, dayStr, timeParts };
    };

    const rem = formatParts(remaining);

    if (deduction > 0) {
      const ded = formatParts(deduction);
      return (
        <div className="flex flex-col select-none animate-pulse">
          <span className="text-blue-400 text-xs font-bold font-mono">
            Remaining: {rem.isNegative ? '-' : ''}{rem.dayStr} (-{ded.isNegative ? '-' : ''}{ded.dayStr})
          </span>
          {(rem.timeParts || ded.timeParts) && (
            <span className="text-[10px] font-medium text-theme-text-muted mt-0.5 block tracking-wide font-sans">
              {rem.timeParts || '00 hrs'} (-{ded.timeParts || '00 hrs'})
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col select-none">
        <span className="text-theme-text-primary text-xs font-bold font-mono">
          Remaining: {rem.isNegative ? '-' : ''}{rem.dayStr}
        </span>
        {rem.timeParts && (
          <span className="text-[10px] font-medium text-theme-text-muted mt-0.5 block tracking-wide font-sans">
            {rem.timeParts}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-theme-page-bg/40 border border-theme-border-input/80 rounded-xl p-4 flex flex-col gap-4 font-sans text-xs shrink-0 self-start md:mt-0 mt-4 w-full">
      <h4 className="font-bold text-theme-text-primary border-b border-theme-border-muted pb-2 mb-1 text-[11px] uppercase tracking-wider">
        Leave Usage Summary ({selectedYear})
      </h4>

      <div className="space-y-3">
        {/* Office Leave Balance */}
        <div className="bg-theme-card-bg/30 p-2.5 rounded-lg border border-theme-border-muted">
          <span className="text-blue-400 block text-[9px] uppercase font-semibold">Allocated Office Leave</span>
          <div className="flex justify-between items-start mt-1">
            {renderRemainingNode(finalOfficeRemaining, officeDeduction)}
          </div>
          {officeSubtext && <span className="text-[9px] text-theme-text-muted block mt-1">{officeSubtext}</span>}
          {finalOfficeRemaining < 0 && (
            <div className="text-[9px] text-red-400 font-semibold font-sans mt-1.5 pt-1 border-t border-theme-border-muted/50 animate-pulse">
              ⚠️ Limit exceeded. Extra hours will be adjusted with salary.
            </div>
          )}
        </div>

        {/* Govt Holiday Balance */}
        {govtHolidayTotal > 0 && (
          <div className="bg-theme-card-bg/30 p-2.5 rounded-lg border border-theme-border-muted">
            <span className="text-teal-400 block text-[9px] uppercase font-semibold">Govt Holiday</span>
            <div className="flex justify-between items-center mt-1">
              {isGovtChanged ? (
                <span className="text-teal-400 text-xs font-bold font-mono animate-pulse">
                  Remaining: {finalGovtRemaining} days (-{govtDeduction})
                </span>
              ) : (
                <span className="text-theme-text-primary text-xs font-bold font-mono">
                  Remaining: {govtHolidayRemaining} days
                </span>
              )}
            </div>
          </div>
        )}

        {/* Eid-ul-Fitr Balance */}
        {eidFitrRemaining > 0 && (
          <div className="bg-theme-card-bg/30 p-2.5 rounded-lg border border-theme-border-muted">
            <span className="text-purple-400 block text-[9px] uppercase font-semibold">Eid-ul-Fitr Leave</span>
            <div className="flex justify-between items-center mt-1">
              {isEidFitrChanged ? (
                <span className="text-purple-400 text-xs font-bold font-mono animate-pulse">
                  Remaining: {finalEidFitrRemaining} days (-{eidFitrDeduction})
                </span>
              ) : (
                <span className="text-theme-text-primary text-xs font-bold font-mono">
                  Remaining: {eidFitrRemaining} days
                </span>
              )}
            </div>
          </div>
        )}

        {/* Eid-ul-Adha Balance */}
        {eidAdhaRemaining > 0 && (
          <div className="bg-theme-card-bg/30 p-2.5 rounded-lg border border-theme-border-muted">
            <span className="text-purple-400 block text-[9px] uppercase font-semibold">Eid-ul-Adha Leave</span>
            <div className="flex justify-between items-center mt-1">
              {isEidAdhaChanged ? (
                <span className="text-purple-400 text-xs font-bold font-mono animate-pulse">
                  Remaining: {finalEidAdhaRemaining} days (-{eidAdhaDeduction})
                </span>
              ) : (
                <span className="text-theme-text-primary text-xs font-bold font-mono">
                  Remaining: {eidAdhaRemaining} days
                </span>
              )}
            </div>
          </div>
        )}

        {/* Full Leave Stat */}
        {fullLeaves > 0 && (
          <div className="flex justify-between items-center bg-theme-card-bg/30 p-2.5 rounded-lg border border-theme-border-muted">
            <div>
              <span className="text-theme-text-muted block text-[9px] uppercase font-semibold">Full Leave Taken</span>
              <span className="text-theme-text-primary text-xs font-bold font-mono">{fullLeaves} days</span>
            </div>
          </div>
        )}

        {/* Short Leave Stat */}
        {shortHours && shortHours !== '00:00' && shortHours !== '-00:00' && (
          <div className="flex justify-between items-center bg-theme-card-bg/30 p-2.5 rounded-lg border border-theme-border-muted">
            <div>
              <span className="text-theme-text-muted block text-[9px] uppercase font-semibold">Short Leave Taken</span>
              <span className="text-theme-text-primary text-xs font-bold font-mono">{shortHours} hrs</span>
            </div>
          </div>
        )}

        {/* Overtime Stat */}
        {allowOvertime && overtimeHours && overtimeHours !== '00:00' && overtimeHours !== '-00:00' && (
          <div className="flex justify-between items-center bg-theme-card-bg/30 p-2.5 rounded-lg border border-theme-border-muted">
            <div>
              <span className="text-theme-text-muted block text-[9px] uppercase font-semibold">Total Overtime</span>
              <span className="text-theme-text-primary text-xs font-bold font-mono">{overtimeHours} hrs</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
