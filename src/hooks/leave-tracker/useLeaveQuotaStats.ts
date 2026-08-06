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
  const activeHolidays = useMemo(() => {
    return (globalSettings.govt_holidays || []).map(h => parseHolidayItem(h));
  }, [globalSettings.govt_holidays]);

  const userResponses = useMemo(() => {
    if (!userId) return [];
    return holidayResponses.filter(r => r.user_id === userId);
  }, [holidayResponses, userId]);

  const respondedHolidays = useMemo(() => {
    if (!isGovtHolidayEligible) return [];
    return activeHolidays.map(h => {
      const resp = userResponses.find(r => r.holiday_date === h.date);
      return {
        date: h.date,
        name: h.name,
        response: resp?.response === 'paid' ? 'paid' : 'reserve',
      };
    });
  }, [activeHolidays, userResponses, isGovtHolidayEligible]);

  const paidCount = useMemo(
    () => respondedHolidays.filter(r => r.response === 'paid').length,
    [respondedHolidays]
  );

  const reservedCount = useMemo(
    () => respondedHolidays.filter(r => r.response === 'reserve').length,
    [respondedHolidays]
  );

  const govtHolidayTotal = isGovtHolidayEligible
    ? activeHolidays.length
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
