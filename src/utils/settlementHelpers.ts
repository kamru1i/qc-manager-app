import { ChutiRecord } from '@/utils/offlineSync';
import { generateUUID } from '@/utils/idbStoreFactory';
import { LeaveSettlement } from '@/types';
import { formatDaysAndHours, parseIntervalToMinutes } from './leaveCalculations';

export interface HalfYearlyOfficeLeaveStats {
  h1Base: number;
  h1Total: number;
  h1Taken: number;
  h1Remaining: number;
  carryForward: number;
  h2Base: number;
  h2Total: number;
  h2Taken: number;
  h2Remaining: number;
  currentHalf: 1 | 2;
  isMergedMode?: boolean;
}

export const getSettlementSplits = (s: LeaveSettlement) => {
  const carry_forward = s.carry_forward_days ?? (s.action_type === 'carry_forward' ? s.remaining_days : 0);
  const payment = s.payment_days ?? (s.action_type === 'payment' ? s.remaining_days : 0);
  const adjust_leave = s.adjust_leave_days ?? (s.action_type === 'adjust_leave' ? s.remaining_days : 0);
  const totalDeducted = carry_forward + payment + adjust_leave;
  return { carry_forward, payment, adjust_leave, deducted_from_allowance: totalDeducted };
};

export const getCarriedBalances = (userId: string | undefined, selectedYear: string, leaveSettlements: LeaveSettlement[]) => {
  const prevYear = (Number(selectedYear) - 1).toString();
  const getCarriedForCategory = (category: string) => 
    leaveSettlements
      .filter((s) => s.user_id === userId && s.year === prevYear && s.leave_category === category)
      .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  return {
    carriedOffice: getCarriedForCategory('Office Leave'),
    carriedGovt: getCarriedForCategory('Govt Holiday'),
    carriedEidFitr: getCarriedForCategory('Eid-ul-Fitr'),
    carriedEidAdha: getCarriedForCategory('Eid-ul-Adha'),
  };
};

export const getActiveSettlements = (userId: string | undefined, selectedYear: string, leaveSettlements: LeaveSettlement[]) => {
  const getActiveForCategory = (category: string) =>
    leaveSettlements
      .filter(s => s.user_id === userId && s.year === selectedYear && s.leave_category === category && (s.status === 'processed' || s.status === 'responded'))
      .reduce((acc, s) => acc + getSettlementSplits(s).deducted_from_allowance, 0);

  return {
    activeOfficeSettled: getActiveForCategory('Office Leave'),
    activeGovtSettled: getActiveForCategory('Govt Holiday'),
    activeEidFitrSettled: getActiveForCategory('Eid-ul-Fitr'),
    activeEidAdhaSettled: getActiveForCategory('Eid-ul-Adha'),
  };
};

export const getSettlementLabel = (s: LeaveSettlement, workingHours: number = 9.5): string => {
  if (s.remaining_days < 0) {
    if (s.action_type === 'payment') {
      return 'Salary Deduction';
    }
    if (s.action_type === 'carry_forward') {
      return s.period === 'H1' ? 'Adjust with H2 Office Leave' : "Adjust with Next Year's H1";
    }
    if (s.action_type === 'adjust_leave') {
      return 'Adjust with Holiday/Eid Reserve';
    }
    return 'Salary Deduction';
  }
  if (s.action_type === 'split') {
    const parts: string[] = [];
    const splits = getSettlementSplits(s);
    if (splits.carry_forward > 0) parts.push(`${formatDaysAndHours(splits.carry_forward, workingHours)} Carry Forward`);
    if (splits.payment > 0) parts.push(`${formatDaysAndHours(splits.payment, workingHours)} Cash Out`);
    if (splits.adjust_leave > 0) parts.push(`${formatDaysAndHours(splits.adjust_leave, workingHours)} Adjust`);
    return parts.length > 0 ? parts.join(', ') : 'Split';
  }
  return s.action_type === 'carry_forward' ? 'Carry Forward' : s.action_type === 'payment' ? 'Cash Out' : 'Adjust Leaves';
};

export const calculateHalfYearlyOfficeLeave = (
  records: ChutiRecord[],
  officeLeaveH1: number,
  officeLeaveH2: number,
  selectedYear: string,
  leaveSettlements?: LeaveSettlement[],
  userId?: string,
  ignoreSettlementPeriod?: 'H1' | 'H2' | 'Instant' | 'all',
  workingHours: number = 9.5
): HalfYearlyOfficeLeaveStats => {
  // 1. Calculate carried over office leave from previous year
  let carriedOffice = 0;
  if (leaveSettlements && userId) {
    const prevYear = (Number(selectedYear) - 1).toString();
    carriedOffice = leaveSettlements
      .filter((s) => s.user_id === userId && s.year === prevYear && s.leave_category === 'Office Leave')
      .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);
  }

  const isMergedMode = officeLeaveH2 === 0;

  // 2. Base quotas: H1 uses admin-set h1 quota + any carried over from previous year.
  const h1Quota = officeLeaveH1 + carriedOffice;
  const h2Quota = officeLeaveH2;

  // Filter approved full-day/short-day records for the selected year and target user
  const approvedRecs = records.filter(r => 
    r.status === 'approved' && 
    r.date && 
    r.date.substring(0, 4) === selectedYear &&
    (!userId || r.user_id === userId)
  );

  let h1Taken = 0;
  let h2Taken = 0;

  approvedRecs.forEach(r => {
    const isFullLeave = r.leave_type === 'Full Leave';
    const isShortLeave = ['Short Leave', 'Early Leave', 'Late Join'].includes(r.leave_type);

    if (isFullLeave) {
      // Check if it should count against office leave: 
      // It should count only if it is NOT adjusted, OR if it is adjusted specifically as "Office Leave".
      const shouldCountAsOffice = !r.adjustment || (r.adjustment && (r.comment?.includes("Office Leave") || r.reserve_holiday === "Office Leave"));
      if (!shouldCountAsOffice) return;

      const month = parseInt(r.date.substring(5, 7), 10);
      if (isMergedMode || month <= 6) {
        h1Taken += 1;
      } else {
        h2Taken += 1;
      }
    } else if (isShortLeave) {
      // Short leave only counts against office leave if it is adjusted specifically as "Office Leave"
      const shouldCountAsOffice = !r.adjustment || (r.adjustment && (r.comment?.includes("Office Leave") || r.reserve_holiday === "Office Leave"));
      if (!shouldCountAsOffice) return;

      const mins = parseIntervalToMinutes(r.leave_hour);
      const dayEquivalent = mins / (workingHours * 60);

      const month = parseInt(r.date.substring(5, 7), 10);
      if (isMergedMode || month <= 6) {
        h1Taken += dayEquivalent;
      } else {
        h2Taken += dayEquivalent;
      }
    }
  });

  // Calculate H1 carry forward dynamically based on H1 settlement
  let carryForward = 0;
  if (leaveSettlements && userId) {
    const h1Settlements = leaveSettlements.filter(
      (s) => s.user_id === userId && s.year === selectedYear && s.period === 'H1' && s.leave_category === 'Office Leave'
    );
    if (h1Settlements.length > 0) {
      const activeSettlement = h1Settlements.find((s) => s.status === 'processed' || s.status === 'responded');
      if (activeSettlement) {
        carryForward = getSettlementSplits(activeSettlement).carry_forward;
      }
    }
  }

  const h1TotalAllocated = isMergedMode ? (h1Quota + carryForward) : h1Quota;
  let h1Remaining = h1TotalAllocated - h1Taken;
  if (leaveSettlements && userId && !isMergedMode) {
    const h1Settlements = leaveSettlements.filter(
      (s) => s.user_id === userId && s.year === selectedYear && s.period === 'H1' && s.leave_category === 'Office Leave'
    );
    if (h1Settlements.length > 0) {
      const activeSettlement = h1Settlements.find((s) => s.status === 'processed' || s.status === 'responded');
      if (activeSettlement && ignoreSettlementPeriod !== 'H1' && ignoreSettlementPeriod !== 'all') {
        h1Remaining = 0;
      }
    }
  }

  const h2Total = h2Quota + carryForward;
  let h2Remaining = h2Total - h2Taken;
  if (leaveSettlements && userId) {
    const h2Settlements = leaveSettlements.filter(
      (s) => s.user_id === userId && s.year === selectedYear && (s.period === 'H2' || (s.period as string) === 'Full Year') && s.leave_category === 'Office Leave'
    );
    if (h2Settlements.length > 0) {
      const activeSettlement = h2Settlements.find((s) => s.status === 'processed' || s.status === 'responded');
      if (activeSettlement && ignoreSettlementPeriod !== 'H2' && ignoreSettlementPeriod !== 'all') {
        h2Remaining = 0;
      }
    }
  }

  // Determine current active half
  const now = new Date();
  const currentYear = now.getFullYear().toString();
  let currentHalf: 1 | 2 = 1;
  if (selectedYear < currentYear) {
    currentHalf = 2;
  } else if (selectedYear > currentYear) {
    currentHalf = 1;
  } else {
    currentHalf = now.getMonth() >= 6 ? 2 : 1;
  }

  return {
    h1Base: officeLeaveH1,
    h1Total: h1TotalAllocated,
    h1Taken,
    h1Remaining,
    carryForward,
    h2Base: officeLeaveH2,
    h2Total,
    h2Taken,
    h2Remaining,
    currentHalf,
    isMergedMode,
  };
};

// Helper to safely extract existing notifications from a ChutiRecord's admin_edit_request
export const getExistingNotifications = (record: ChutiRecord): any[] => {
  if (record.admin_edit_request && typeof record.admin_edit_request === 'object' && 'notifications' in record.admin_edit_request) {
    return (record.admin_edit_request as { notifications?: any[] }).notifications || [];
  }
  return [];
};

// Factory to create a notification object with auto-generated id and timestamp
export const createNotification = (type: string, title: string, body: string) => ({
  id: generateUUID(),
  type,
  timestamp: new Date().toISOString(),
  title,
  body,
});

export const getOutstandingOfficeLeave = (
  records: ChutiRecord[],
  officeLeaveH1: number,
  officeLeaveH2: number,
  selectedYear: string,
  leaveSettlements: LeaveSettlement[],
  userId: string,
  workingHours: number = 9.5
): number => {
  const rawStats = calculateHalfYearlyOfficeLeave(
    records,
    officeLeaveH1,
    officeLeaveH2,
    selectedYear,
    leaveSettlements,
    userId,
    'all',
    workingHours
  );

  const h1Processed = leaveSettlements.some(
    (s) => s.user_id === userId && s.year === selectedYear && s.leave_category === 'Office Leave' && s.period === 'H1' && s.status === 'processed'
  );
  const h2Processed = leaveSettlements.some(
    (s) => s.user_id === userId && s.year === selectedYear && s.leave_category === 'Office Leave' && s.period === 'H2' && s.status === 'processed'
  );

  const h1Outstanding = !h1Processed && rawStats.h1Remaining < 0 ? -rawStats.h1Remaining : 0;
  const h2Outstanding = !h2Processed && rawStats.h2Remaining < 0 ? -rawStats.h2Remaining : 0;

  return h1Outstanding + h2Outstanding;
};

