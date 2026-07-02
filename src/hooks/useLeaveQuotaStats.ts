import { useMemo } from 'react';
import { GlobalSettings, parseHolidayItem, calculateHalfYearlyOfficeLeave, HalfYearlyOfficeLeaveStats } from '@/utils/dashboardHelpers';
import { GovtHolidayResponse, LeaveSettlement } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';

interface GovtHolidayStats {
  total: number;
  taken: number;
  reserved: number;
  paid: number;
  remaining: number;
}

interface RespondedHoliday {
  date: string;
  name: string;
  response: string;
}

interface UseGovtHolidayStatsResult {
  userResponses: GovtHolidayResponse[];
  paidCount: number;
  reservedCount: number;
  respondedHolidays: RespondedHoliday[];
  govtHolidayStats: GovtHolidayStats;
}

/**
 * Shared hook for computing government holiday response statistics.
 * Used by both UserDashboardView and AdminDashboardView.
 */
export function useGovtHolidayStats(
  userId: string | undefined,
  holidayResponses: GovtHolidayResponse[],
  globalSettings: GlobalSettings,
  isGovtHolidayEligible: boolean,
  reserveLeavesTaken: number
): UseGovtHolidayStatsResult {
  const userResponses = useMemo(() => {
    const activeHolidayDates = new Set(
      (globalSettings.govt_holidays || []).map(h => parseHolidayItem(h).date)
    );
    return holidayResponses.filter(
      r => r.user_id === userId && activeHolidayDates.has(r.holiday_date)
    );
  }, [holidayResponses, userId, globalSettings.govt_holidays]);

  const paidCount = useMemo(
    () => userResponses.filter(r => r.response === 'paid').length,
    [userResponses]
  );

  const reservedCount = useMemo(
    () => userResponses.filter(r => r.response === 'reserve').length,
    [userResponses]
  );

  const respondedHolidays = useMemo(
    () => userResponses.map(r => ({
      date: r.holiday_date,
      name: r.holiday_name,
      response: r.response,
    })),
    [userResponses]
  );

  const govtHolidayTotal = isGovtHolidayEligible
    ? (globalSettings.govt_holidays?.length ?? 0)
    : 0;

  const govtHolidayStats: GovtHolidayStats = useMemo(() => ({
    total: govtHolidayTotal,
    taken: reserveLeavesTaken,
    reserved: reservedCount,
    paid: paidCount,
    remaining: Math.max(0, reservedCount - reserveLeavesTaken),
  }), [govtHolidayTotal, reserveLeavesTaken, reservedCount, paidCount]);

  return {
    userResponses,
    paidCount,
    reservedCount,
    respondedHolidays,
    govtHolidayStats,
  };
}

interface UseHalfYearlyStatsResult {
  halfYearlyStats: HalfYearlyOfficeLeaveStats;
}

/**
 * Shared hook for computing half-yearly office leave split calculations.
 * Used by both UserDashboardView and AdminDashboardView.
 */
export function useHalfYearlyStats(
  records: ChutiRecord[],
  officeLeaveH1: number,
  officeLeaveH2: number,
  selectedYear: string,
  leaveSettlements?: LeaveSettlement[],
  userId?: string,
  workingHours: number = 9.5
): UseHalfYearlyStatsResult {
  const halfYearlyStats = useMemo(
    () => calculateHalfYearlyOfficeLeave(records, officeLeaveH1, officeLeaveH2, selectedYear, leaveSettlements, userId, undefined, workingHours),
    [records, officeLeaveH1, officeLeaveH2, selectedYear, leaveSettlements, userId, workingHours]
  );

  return { halfYearlyStats };
}
