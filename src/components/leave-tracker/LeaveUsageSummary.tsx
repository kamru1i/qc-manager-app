import React from 'react';
import { HalfYearlyOfficeLeaveStats } from '@/utils/dashboardHelpers';

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
  eligibleGovtHoliday = true,
}) => {
  let officeRemainingVal = officeLeaveRemaining;

  if (halfYearlyStats) {
    if (halfYearlyStats.isMergedMode) {
      officeRemainingVal = halfYearlyStats.h1Remaining;
    } else {
      const isH1 = halfYearlyStats.currentHalf === 1;
      officeRemainingVal = isH1
        ? halfYearlyStats.h1Remaining
        : halfYearlyStats.h2Remaining;
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
          <span className="text-theme-text-primary text-sm font-bold font-mono">
            Remaining: {rem.isNegative ? '-' : ''}{rem.dayStr} <span className="text-xs text-rose-400 font-medium">(-{ded.isNegative ? '-' : ''}{ded.dayStr})</span>
          </span>
          {(rem.timeParts || ded.timeParts) && (
            <span className="text-[11px] font-medium text-theme-text-muted mt-1 block tracking-wide font-sans">
              {rem.timeParts || '00 hrs'} (-{ded.timeParts || '00 hrs'})
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col select-none">
        <span className="text-theme-text-primary text-sm font-bold font-mono">
          Remaining: {rem.isNegative ? '-' : ''}{rem.dayStr}
        </span>
        {rem.timeParts && (
          <span className="text-[11px] font-medium text-theme-text-muted mt-1 block tracking-wide font-sans">
            {rem.timeParts}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-theme-page-bg/50 border border-theme-border-input/80 rounded-2xl p-5 flex flex-col gap-3.5 font-sans text-xs shrink-0 self-start md:mt-0 mt-4 w-full shadow-lg backdrop-blur-md">
      <h4 className="font-bold text-theme-text-muted border-b border-theme-border-muted/70 pb-3 mb-1 text-[11px] uppercase tracking-wider">
        Leave Usage Summary ({selectedYear})
      </h4>

      <div className="space-y-3">
        {/* Office Leave Balance */}
        <div className="bg-theme-card-bg/40 hover:bg-theme-card-bg/60 p-3.5 rounded-xl border border-theme-border-input/70 transition-all">
          <span className="text-blue-400 block text-[10px] uppercase font-bold tracking-wider">Office Leave</span>
          <div className="mt-1.5">
            {renderRemainingNode(finalOfficeRemaining, officeDeduction)}
          </div>

          {finalOfficeRemaining < 0 && (
            <div className="text-[10px] text-red-400 font-semibold font-sans mt-2 pt-1.5 border-t border-theme-border-muted/50 animate-pulse">
              ⚠️ Limit exceeded. Extra hours will be adjusted with salary.
            </div>
          )}
        </div>

        {/* Govt Holiday Balance */}
        {eligibleGovtHoliday && govtHolidayTotal > 0 && (
          <div className="bg-theme-card-bg/40 hover:bg-theme-card-bg/60 p-3.5 rounded-xl border border-theme-border-input/70 transition-all">
            <span className="text-teal-400 block text-[10px] uppercase font-bold tracking-wider">Govt Holiday</span>
            <div className="mt-1.5">
              {isGovtChanged ? (
                <span className="text-teal-400 text-sm font-bold font-mono animate-pulse block">
                  Remaining: {finalGovtRemaining} days <span className="text-xs text-rose-400 font-medium">(-{govtDeduction})</span>
                </span>
              ) : (
                <span className="text-theme-text-primary text-sm font-bold font-mono block">
                  Remaining: {govtHolidayRemaining} days
                </span>
              )}
            </div>
          </div>
        )}

        {/* Eid-ul-Fitr Balance */}
        {eidFitrRemaining > 0 && (
          <div className="bg-theme-card-bg/40 hover:bg-theme-card-bg/60 p-3.5 rounded-xl border border-theme-border-input/70 transition-all">
            <span className="text-purple-400 block text-[10px] uppercase font-bold tracking-wider">Eid-ul-Fitr Leave</span>
            <div className="mt-1.5">
              {isEidFitrChanged ? (
                <span className="text-purple-400 text-sm font-bold font-mono animate-pulse block">
                  Remaining: {finalEidFitrRemaining} days <span className="text-xs text-rose-400 font-medium">(-{eidFitrDeduction})</span>
                </span>
              ) : (
                <span className="text-theme-text-primary text-sm font-bold font-mono block">
                  Remaining: {eidFitrRemaining} days
                </span>
              )}
            </div>
          </div>
        )}

        {/* Eid-ul-Adha Balance */}
        {eidAdhaRemaining > 0 && (
          <div className="bg-theme-card-bg/40 hover:bg-theme-card-bg/60 p-3.5 rounded-xl border border-theme-border-input/70 transition-all">
            <span className="text-purple-400 block text-[10px] uppercase font-bold tracking-wider">Eid-ul-Adha Leave</span>
            <div className="mt-1.5">
              {isEidAdhaChanged ? (
                <span className="text-purple-400 text-sm font-bold font-mono animate-pulse block">
                  Remaining: {finalEidAdhaRemaining} days <span className="text-xs text-rose-400 font-medium">(-{eidAdhaDeduction})</span>
                </span>
              ) : (
                <span className="text-theme-text-primary text-sm font-bold font-mono block">
                  Remaining: {eidAdhaRemaining} days
                </span>
              )}
            </div>
          </div>
        )}

        {/* Full Leave Stat */}
        {fullLeaves > 0 && (
          <div className="bg-theme-card-bg/40 hover:bg-theme-card-bg/60 p-3.5 rounded-xl border border-theme-border-input/70 transition-all">
            <span className="text-theme-text-muted block text-[10px] uppercase font-bold tracking-wider">Full Leave Taken</span>
            <span className="text-theme-text-primary text-sm font-bold font-mono mt-0.5 block">{fullLeaves} days</span>
          </div>
        )}

        {/* Short Leave Stat */}
        {shortHours && shortHours !== '00:00' && shortHours !== '-00:00' && (
          <div className="bg-theme-card-bg/40 hover:bg-theme-card-bg/60 p-3.5 rounded-xl border border-theme-border-input/70 transition-all">
            <span className="text-theme-text-muted block text-[10px] uppercase font-bold tracking-wider">Short Leave Taken</span>
            <span className="text-theme-text-primary text-sm font-bold font-mono mt-0.5 block">{shortHours} hrs</span>
          </div>
        )}

        {/* Overtime Stat */}
        {allowOvertime && overtimeHours && overtimeHours !== '00:00' && overtimeHours !== '-00:00' && (
          <div className="bg-theme-card-bg/40 hover:bg-theme-card-bg/60 p-3.5 rounded-xl border border-theme-border-input/70 transition-all">
            <span className="text-theme-text-muted block text-[10px] uppercase font-bold tracking-wider">Total Overtime</span>
            <span className="text-theme-text-primary text-sm font-bold font-mono mt-0.5 block">{overtimeHours} hrs</span>
          </div>
        )}
      </div>
    </div>
  );
};
