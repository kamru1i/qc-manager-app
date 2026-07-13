'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, RotateCcw, ShieldAlert, DollarSign, FolderPlus, ArrowRightLeft, Check } from 'lucide-react';
import { Profile, LeaveSettlement, GovtHolidayResponse } from '@/types';
import { Modal } from '@/components/common/Modal';

import { GlobalSettings, getOutstandingOfficeLeave, calculateStats, formatDaysAndHours } from '@/utils/dashboardHelpers';
import { ChutiRecord } from '@/utils/offlineSync';

interface AdminSettleUserModalProps {
  showModal: boolean;
  setShowModal: (val: boolean) => void;
  staff: Profile | null;
  settlement: LeaveSettlement | null;
  onSaveSettlementsBulk: (settlementsList: unknown[]) => Promise<boolean>;
  currentUserProfile: Profile | null;
  globalSettings: GlobalSettings;
  records: ChutiRecord[];
  leaveSettlements: LeaveSettlement[];
  holidayResponses: GovtHolidayResponse[];
}

export function AdminSettleUserModal({
  showModal,
  setShowModal,
  staff,
  settlement,
  onSaveSettlementsBulk,
  currentUserProfile,
  globalSettings,
  records,
  leaveSettlements,
  holidayResponses,
}: AdminSettleUserModalProps) {
  const [submitting, setSubmitting] = useState(false);

  // Initialize splits directly on mount (flicker-free)
  const [carryForwardDays, setCarryForwardDays] = useState<number>(() => {
    if (!settlement) return 0;
    return settlement.carry_forward_days ?? (settlement.action_type === 'carry_forward' ? settlement.remaining_days : 0);
  });
  const [paymentDays, setPaymentDays] = useState<number>(() => {
    if (!settlement) return 0;
    return settlement.payment_days ?? (settlement.action_type === 'payment' ? settlement.remaining_days : 0);
  });
  const [adjustLeaveDays, setAdjustLeaveDays] = useState<number>(() => {
    if (!settlement) return 0;
    return settlement.adjust_leave_days ?? (settlement.action_type === 'adjust_leave' ? settlement.remaining_days : 0);
  });

  const [isManualOverride, setIsManualOverride] = useState(false);
  const [manualCarryDays, setManualCarryDays] = useState<number>(() => {
    if (!settlement) return 0;
    return settlement.carry_forward_days ?? 0;
  });

  const [carryForwardDirection, setCarryForwardDirection] = useState<'h1_to_h2' | 'h2_to_next_h1'>(() => {
    if (!settlement) return 'h1_to_h2';
    return settlement.period === 'H2' ? 'h2_to_next_h1' : 'h1_to_h2';
  });

  const [negativeResolutionType, setNegativeResolutionType] = useState<'salary_deduction' | 'adjust_h2' | 'adjust_next_h1' | 'adjust_reserve'>(() => {
    if (!settlement || settlement.remaining_days >= 0) return 'salary_deduction';
    if (settlement.action_type === 'carry_forward') {
      return settlement.period === 'H1' ? 'adjust_h2' : 'adjust_next_h1';
    }
    if (settlement.action_type === 'adjust_leave') {
      return 'adjust_reserve';
    }
    if (settlement.action_type === 'payment') {
      return 'salary_deduction';
    }
    return settlement.period === 'H1' ? 'adjust_h2' : (settlement.period === 'H2' ? 'adjust_next_h1' : 'salary_deduction');
  });
  const [selectedReserveCategory, setSelectedReserveCategory] = useState<string>(() => {
    if (!settlement || !staff || settlement.action_type !== 'adjust_leave') return '';
    const reserveSettlements = leaveSettlements.filter(
      s => s.user_id === staff.id && s.year === settlement.year && s.period === 'Instant' && s.status === 'processed'
    );
    const usedReserve = reserveSettlements.find(s => (s.carry_forward_days ?? 0) < s.remaining_days);
    return usedReserve ? usedReserve.leave_category : '';
  });

  useEffect(() => {
    if (settlement && settlement.remaining_days < 0) {
      if (settlement.action_type === 'carry_forward') {
        setNegativeResolutionType(settlement.period === 'H1' ? 'adjust_h2' : 'adjust_next_h1');
      } else if (settlement.action_type === 'adjust_leave') {
        setNegativeResolutionType('adjust_reserve');
        const reserveSettlements = leaveSettlements.filter(
          s => s.user_id === staff?.id && s.year === settlement.year && s.period === 'Instant' && s.status === 'processed'
        );
        const usedReserve = reserveSettlements.find(s => (s.carry_forward_days ?? 0) < s.remaining_days);
        setSelectedReserveCategory(usedReserve ? usedReserve.leave_category : '');
      } else if (settlement.action_type === 'payment') {
        setNegativeResolutionType('salary_deduction');
      } else {
        setNegativeResolutionType(settlement.period === 'H1' ? 'adjust_h2' : (settlement.period === 'H2' ? 'adjust_next_h1' : 'salary_deduction'));
      }
    }
  }, [settlement, staff?.id, leaveSettlements]);

  const isBroadcastActive = settlement
    ? globalSettings.settlement_active_year === settlement.year &&
      globalSettings.settlement_active_period === settlement.period &&
      globalSettings.settlement_active_category === settlement.leave_category
    : false;

  const total = settlement ? Math.round(settlement.remaining_days * 100) / 100 : 0;
  const workingHours = staff?.working_hours || 9.5;

  const getDaysHoursMins = (daysVal: number) => {
    const totalMins = Math.round(daysVal * workingHours * 60);
    const minutesPerDay = Math.round(workingHours * 60);
    const d = Math.floor(totalMins / minutesPerDay);
    const remainingMins = totalMins % minutesPerDay;
    const h = Math.floor(remainingMins / 60);
    const m = remainingMins % 60;
    return { d, h, m };
  };

  const isNegative = total < 0;

  const totalOutstandingOffice = React.useMemo(() => {
    if (!staff?.id || !settlement) return 0;
    return getOutstandingOfficeLeave(
      records,
      globalSettings.office_leave_h1,
      globalSettings.office_leave_h2,
      settlement.year,
      leaveSettlements,
      staff.id,
      staff?.working_hours || 9.5
    );
  }, [records, globalSettings.office_leave_h1, globalSettings.office_leave_h2, settlement, leaveSettlements, staff]);

  // Calculate remaining reserve/holiday balances for other categories
  const reserveOptions = React.useMemo(() => {
    if (!staff || !settlement) return [];
    const prevYear = (Number(settlement.year) - 1).toString();
    const staffRecords = records.filter(r => r.user_id === staff.id && r.status === 'approved' && r.date && r.date.substring(0, 4) === settlement.year);
    const stats = calculateStats(staffRecords, workingHours);
    const getSettlementSplitsLocal = (s: LeaveSettlement) => {
      const carry_forward = s.carry_forward_days ?? (s.action_type === 'carry_forward' ? s.remaining_days : 0);
      const payment = s.payment_days ?? (s.action_type === 'payment' ? s.remaining_days : 0);
      const adjust_leave = s.adjust_leave_days ?? (s.action_type === 'adjust_leave' ? s.remaining_days : 0);
      return { carry_forward, payment, adjust_leave };
    };

    // Govt Holiday remaining
    const carriedGovt = leaveSettlements
      .filter((s) => s.user_id === staff.id && s.year === prevYear && s.leave_category === 'Govt Holiday')
      .reduce((acc, s) => acc + getSettlementSplitsLocal(s).carry_forward, 0);
    const userGovtResponses = holidayResponses.filter(
      (r: GovtHolidayResponse) => r.user_id === staff.id && r.response === 'reserve' && r.holiday_date.substring(0, 4) === settlement.year
    );
    const isGovtHolidayEligible = staff.eligible_govt_holiday !== false;
    const govtHolidayRemaining = isGovtHolidayEligible
      ? Math.max(0, userGovtResponses.length + carriedGovt - (stats.govtHolidaysTaken ?? 0))
      : 0;

    // Eid-ul-Fitr remaining
    const carriedEidFitr = leaveSettlements
      .filter((s) => s.user_id === staff.id && s.year === prevYear && s.leave_category === 'Eid-ul-Fitr')
      .reduce((acc, s) => acc + getSettlementSplitsLocal(s).carry_forward, 0);
    const eidFitrRemaining = Math.max(0, (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr - (stats.eidFitrTaken ?? 0));

    // Eid-ul-Adha remaining
    const carriedEidAdha = leaveSettlements
      .filter((s) => s.user_id === staff.id && s.year === prevYear && s.leave_category === 'Eid-ul-Adha')
      .reduce((acc, s) => acc + getSettlementSplitsLocal(s).carry_forward, 0);
    const eidAdhaRemaining = Math.max(0, (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha - (stats.eidAdhaTaken ?? 0));

    return [
      { value: 'Govt Holiday', label: `Govt Holiday (${govtHolidayRemaining} days available)`, balance: govtHolidayRemaining },
      { value: 'Eid-ul-Fitr', label: `Eid-ul-Fitr (${eidFitrRemaining} days available)`, balance: eidFitrRemaining },
      { value: 'Eid-ul-Adha', label: `Eid-ul-Adha (${eidAdhaRemaining} days available)`, balance: eidAdhaRemaining },
    ].filter(opt => opt.balance >= Math.abs(total));
  }, [staff, settlement, records, leaveSettlements, holidayResponses, globalSettings, total, workingHours]);

  const allocated = carryForwardDays + paymentDays + adjustLeaveDays;
  const isAllocatedCorrectly = isNegative
    ? true
    : isManualOverride
    ? (manualCarryDays >= 0)
    : (total === 0 || (total > 0 && Math.abs(allocated - total) < 0.01));

  const handleQuickAllocate = (action: 'carry_forward' | 'payment' | 'adjust_leave') => {
    const finalVal = Math.round(total * 100) / 100;
    if (action === 'carry_forward') {
      setCarryForwardDays(finalVal);
      setPaymentDays(0);
      setAdjustLeaveDays(0);
    } else if (action === 'payment') {
      setCarryForwardDays(0);
      setPaymentDays(finalVal);
      setAdjustLeaveDays(0);
    } else if (action === 'adjust_leave') {
      setCarryForwardDays(0);
      setPaymentDays(0);
      setAdjustLeaveDays(Math.min(finalVal, totalOutstandingOffice));
    }
  };

  const handleConfirm = async () => {
    if (!staff || !settlement) return;
    if (!isNegative && !isAllocatedCorrectly) return;
    setSubmitting(true);

    const updateRecords: Partial<ChutiRecord>[] = [];

    if (isNegative) {
      let cfDays = 0;
      let payDays = 0;
      let adjDays = 0;
      let actType: 'carry_forward' | 'payment' | 'adjust_leave' = 'payment';

      if (negativeResolutionType === 'salary_deduction') {
        payDays = total;
        actType = 'payment';
      } else if (negativeResolutionType === 'adjust_h2' || negativeResolutionType === 'adjust_next_h1') {
        cfDays = total;
        actType = 'carry_forward';
      } else if (negativeResolutionType === 'adjust_reserve') {
        adjDays = total;
        actType = 'adjust_leave';

        // Also upsert a second record to deduct the balance from the reserve category
        const selectedOpt = reserveOptions.find(o => o.value === selectedReserveCategory);
        if (selectedOpt) {
          const originalBalance = selectedOpt.balance;
          const deductedBalance = Math.max(0, originalBalance - Math.abs(total));

          const existingReserveSettlement = leaveSettlements.find(
            (s) =>
              s.user_id === staff.id &&
              s.year === settlement.year &&
              s.period === 'Instant' &&
              s.leave_category === selectedReserveCategory
          );

          const reserveRecord = {
            ...(existingReserveSettlement ? { id: existingReserveSettlement.id } : {}),
            user_id: staff.id,
            year: settlement.year,
            period: 'Instant' as const,
            leave_category: selectedReserveCategory,
            remaining_days: originalBalance,
            status: 'processed' as const,
            processed_by: currentUserProfile?.id || null,
            action_by: currentUserProfile?.id || null,
            carry_forward_days: deductedBalance,
            payment_days: 0,
            adjust_leave_days: 0,
            action_type: 'carry_forward' as const,
          };
          updateRecords.push(reserveRecord);
        }
      }

      const mainRecord = {
        id: settlement.id,
        user_id: settlement.user_id,
        year: settlement.year,
        period: settlement.period,
        leave_category: settlement.leave_category,
        remaining_days: total,
        status: 'processed' as const,
        processed_by: currentUserProfile?.id || null,
        action_by: currentUserProfile?.id || null,
        carry_forward_days: cfDays,
        payment_days: payDays,
        adjust_leave_days: adjDays,
        action_type: actType,
      };
      updateRecords.unshift(mainRecord);
    } else {
      if (isManualOverride) {
        const targetPeriod = carryForwardDirection === 'h1_to_h2' ? 'H1' : 'H2';
        const updateRecord = {
          ...(targetPeriod === settlement.period ? { id: settlement.id } : {}),
          user_id: settlement.user_id,
          year: settlement.year,
          period: targetPeriod,
          leave_category: settlement.leave_category,
          remaining_days: manualCarryDays,
          status: 'processed' as const,
          processed_by: currentUserProfile?.id || null,
          action_by: currentUserProfile?.id || null,
          carry_forward_days: manualCarryDays,
          payment_days: 0,
          adjust_leave_days: 0,
          action_type: 'carry_forward' as const,
        };
        updateRecords.push(updateRecord);
      } else {
        const updateRecord = {
          id: settlement.id,
          user_id: settlement.user_id,
          year: settlement.year,
          period: settlement.period,
          leave_category: settlement.leave_category,
          remaining_days: total,
          status: 'processed' as const,
          processed_by: currentUserProfile?.id || null,
          action_by: currentUserProfile?.id || null,
          carry_forward_days: carryForwardDays,
          payment_days: paymentDays,
          adjust_leave_days: adjustLeaveDays,
        };
        updateRecords.push(updateRecord);
      }
    }

    const success = await onSaveSettlementsBulk(updateRecords);
    setSubmitting(false);
    if (success) {
      setShowModal(false);

    }
  };



  if (!settlement) return null;

  // Detect if there's a delta/change from stored remaining days (due to live settings update)
  const storedTotal = (settlement.carry_forward_days ?? 0) + (settlement.payment_days ?? 0) + (settlement.adjust_leave_days ?? 0) || (settlement.action_type ? settlement.remaining_days : 0);
  const showDeltaWarning = settlement.status === 'processed' && Math.abs(storedTotal - total) > 0.01;  return (
    <Modal
      isOpen={showModal && staff !== null}
      onClose={() => setShowModal(false)}
      title={isNegative ? `Process Salary Deduction — ${staff?.full_name || staff?.username}` : `Process Settlement — ${staff?.full_name || staff?.username}`}
      icon={<RotateCcw className="h-5 w-5 text-blue-500" />}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-5 font-sans text-xs text-theme-text-secondary">
        <div className="p-3.5 bg-theme-card-container/40 border border-theme-border-muted rounded-xl space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-theme-text-muted uppercase font-bold tracking-wider">Leave Category</span>
              <h4 className="text-sm font-bold text-theme-text-primary mt-0.5">{settlement.leave_category}</h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-theme-text-muted uppercase font-bold tracking-wider">
                {isNegative ? 'Outstanding Balance' : 'Unused Balance'}
              </span>
              <span className={`text-base font-bold font-mono block mt-0.5 ${isNegative ? 'text-rose-500 font-extrabold' : 'text-blue-400'}`}>
                {isNegative ? `${Math.abs(total)} days` : `${total} days`}
              </span>
            </div>
          </div>
          <div className="flex gap-4 pt-1.5 border-t border-theme-card-bg text-[10px] text-theme-text-muted">
            <span>Year: <strong className="text-theme-text-secondary">{settlement.year}</strong></span>
            <span>Period: <strong className="text-theme-text-secondary">{settlement.period === 'H1' ? 'January-June (H1)' : settlement.period === 'H2' ? 'July-December (H2)' : settlement.period}</strong></span>
            <span>User Choice: <strong className="text-theme-text-secondary capitalize">
              {settlement.status === 'initiated' ? 'Pending Response' : (isNegative ? 'Salary Deduction' : settlement.action_type.replace('_', ' '))}
            </strong></span>
          </div>
        </div>

        {settlement.status === 'initiated' && !isNegative && (
          <div className="p-3 bg-purple-955/15 border border-purple-900/40 rounded-xl flex items-start gap-2 text-purple-300">
            <ShieldAlert className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-[10.5px] leading-relaxed">
              {isBroadcastActive
                ? 'Staff has not submitted their preference yet. Settle manually or wait for their response.'
                : 'Staff has not submitted their preference yet. Settle manually or send broadcast message for their preference.'}
            </p>
          </div>
        )}

        {showDeltaWarning && !isNegative && (
          <div className="p-3 bg-indigo-955/15 border border-indigo-900/40 rounded-xl flex items-start gap-2 text-indigo-300">
            <ShieldAlert className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[10.5px] leading-relaxed">
              Unused balance is updated from {storedTotal} to {total} days (+{total - storedTotal} day(s) unsettled due to quota/record updates). Please re-allocate the total balance.
            </p>
          </div>
        )}
              {/* Dynamic Splits Section */}
        {isNegative ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-theme-page-bg/60 border border-theme-border-muted rounded-xl space-y-3">
              <span className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-2">
                Deficit Resolution Options
              </span>
              <div className="flex flex-col gap-2.5">
                {/* Salary Deduction Option */}
                <button
                  type="button"
                  onClick={() => setNegativeResolutionType('salary_deduction')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    negativeResolutionType === 'salary_deduction'
                      ? 'bg-rose-955/20 border-rose-500/80 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                      : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-theme-text-primary block">Salary Deduction</span>
                    <span className="text-[10px] text-theme-text-muted block mt-0.5">
                      Deduct {Math.abs(total)} day(s) from salary.
                    </span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    negativeResolutionType === 'salary_deduction' ? 'border-rose-500' : 'border-theme-border-input'
                  }`}>
                    {negativeResolutionType === 'salary_deduction' && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                  </div>
                </button>

                {/* Adjust with H2 Option (only for H1 period) */}
                {settlement.period === 'H1' && (
                  <button
                    type="button"
                    onClick={() => setNegativeResolutionType('adjust_h2')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      negativeResolutionType === 'adjust_h2'
                        ? 'bg-purple-955/20 border-purple-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">Adjust with H2 Office Leave</span>
                      <span className="text-[10px] text-theme-text-muted block mt-0.5">
                        Deduct from H2 quota ({globalSettings.office_leave_h2} ➔ {globalSettings.office_leave_h2 - Math.abs(total)} days remaining).
                      </span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      negativeResolutionType === 'adjust_h2' ? 'border-purple-500' : 'border-theme-border-input'
                    }`}>
                      {negativeResolutionType === 'adjust_h2' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                    </div>
                  </button>
                )}

                {/* Adjust with Next Year's H1 Option (only for H2 period) */}
                {settlement.period === 'H2' && (
                  <button
                    type="button"
                    onClick={() => setNegativeResolutionType('adjust_next_h1')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      negativeResolutionType === 'adjust_next_h1'
                        ? 'bg-purple-955/20 border-purple-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">Adjust with Next Year's H1</span>
                      <span className="text-[10px] text-theme-text-muted block mt-0.5">
                        Deduct from next year's H1 Office Leave quota.
                      </span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      negativeResolutionType === 'adjust_next_h1' ? 'border-purple-500' : 'border-theme-border-input'
                    }`}>
                      {negativeResolutionType === 'adjust_next_h1' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                    </div>
                  </button>
                )}

                {/* Adjust with Holiday/Eid Reserve Option (only if options exist) */}
                {reserveOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setNegativeResolutionType('adjust_reserve');
                      if (!selectedReserveCategory && reserveOptions.length > 0) {
                        setSelectedReserveCategory(reserveOptions[0].value);
                      }
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      negativeResolutionType === 'adjust_reserve'
                        ? 'bg-teal-955/20 border-teal-500/80 shadow-[0_0_12px_rgba(20,184,166,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">Adjust with Unused Holiday/Eid Reserve</span>
                      <span className="text-[10px] text-theme-text-muted block mt-0.5">
                        Deduct from an available holiday or Eid reserve balance.
                      </span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      negativeResolutionType === 'adjust_reserve' ? 'border-teal-500' : 'border-theme-border-input'
                    }`}>
                      {negativeResolutionType === 'adjust_reserve' && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                    </div>
                  </button>
                )}
              </div>

              {/* Reserve Dropdown */}
              {negativeResolutionType === 'adjust_reserve' && reserveOptions.length > 0 && (
                <div className="mt-3.5 p-3 bg-theme-card-bg/50 border border-theme-border-muted rounded-xl space-y-2">
                  <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                    Select Reserve Category
                  </label>
                  <select
                    value={selectedReserveCategory}
                    onChange={(e) => setSelectedReserveCategory(e.target.value)}
                    className="w-full bg-theme-page-bg border border-theme-border-input rounded-lg px-3 py-2 text-xs text-theme-text-primary focus:outline-none focus:border-teal-500"
                  >
                    {reserveOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-theme-page-bg text-theme-text-primary">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-3.5 bg-theme-page-bg/20 border border-theme-border-muted rounded-xl flex justify-between items-center text-xs">
              <span className="text-theme-text-muted">Total Adjustment/Deduction Days</span>
              <span className={`font-mono font-bold text-sm ${
                negativeResolutionType === 'salary_deduction' ? 'text-rose-400' :
                negativeResolutionType === 'adjust_reserve' ? 'text-teal-400' : 'text-purple-450'
              }`}>
                {Math.abs(total)} days
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Manual Override Custom Circular Toggle */}
            <div
              onClick={() => {
                const newVal = !isManualOverride;
                setIsManualOverride(newVal);
                if (newVal) {
                  setManualCarryDays(settlement.carry_forward_days || 0);
                }
              }}
              className="flex items-center gap-2.5 p-3 bg-theme-page-bg/50 border border-theme-border-muted rounded-xl cursor-pointer hover:bg-theme-card-bg/40 transition-all select-none"
            >
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                isManualOverride
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-theme-border-active bg-theme-card-container'
              }`}>
                {isManualOverride && (
                  <Check className="h-2.5 w-2.5 text-blue-500 stroke-[3.5]" />
                )}
              </div>
              <span className="text-[11px] font-bold text-theme-text-secondary cursor-pointer select-none">
                Manual Carry Forward Override (Onboarding / Mid-year start)
              </span>
            </div>

            {isManualOverride ? (
              <div className="p-4 rounded-xl border bg-theme-card-bg/20 border-theme-border-muted/80 space-y-3">
                <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider block">Carry Forward Direction</span>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCarryForwardDirection('h1_to_h2')}
                    className={`flex-1 flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      carryForwardDirection === 'h1_to_h2'
                        ? 'bg-indigo-950/20 border-indigo-500/80 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">H1 ➔ H2</span>
                      <span className="text-[10px] text-theme-text-muted block mt-0.5">Carry current year's H1 to H2</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      carryForwardDirection === 'h1_to_h2' ? 'border-indigo-500' : 'border-theme-border-input'
                    }`}>
                      {carryForwardDirection === 'h1_to_h2' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCarryForwardDirection('h2_to_next_h1')}
                    className={`flex-1 flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      carryForwardDirection === 'h2_to_next_h1'
                        ? 'bg-indigo-950/20 border-indigo-500/80 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">H2 ➔ Next Year H1</span>
                      <span className="text-[10px] text-theme-text-muted block mt-0.5">Carry current year's H2 to next year's H1</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      carryForwardDirection === 'h2_to_next_h1' ? 'border-indigo-500' : 'border-theme-border-input'
                    }`}>
                      {carryForwardDirection === 'h2_to_next_h1' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                    </div>
                  </button>
                </div>

                <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider block">Manual Carry Forward Days, Hours & Minutes</span>
                <div className="flex items-center gap-3">
                  {(() => {
                    const { d: mcfD, h: mcfH, m: mcfM } = getDaysHoursMins(manualCarryDays);
                    return (
                      <div className="flex items-center gap-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg px-2 py-1.5 focus-within:border-indigo-500 transition-all flex-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={mcfD || ''}
                          onChange={(e) => {
                            const newD = parseInt(e.target.value) || 0;
                            setManualCarryDays(newD + (mcfH + mcfM / 60) / workingHours);
                          }}
                          placeholder="0"
                          className="w-12 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                        />
                        <span className="text-[10px] text-theme-text-muted font-bold">d</span>
                        <div className="w-px h-3 bg-theme-border-input mx-1" />
                        <input
                          type="number"
                          min={0}
                          max={Math.floor(workingHours)}
                          step={1}
                          value={mcfH || ''}
                          onChange={(e) => {
                            const newH = parseInt(e.target.value) || 0;
                            setManualCarryDays(mcfD + (newH + mcfM / 60) / workingHours);
                          }}
                          placeholder="0"
                          className="w-10 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                        />
                        <span className="text-[10px] text-theme-text-muted font-bold">h</span>
                        <div className="w-px h-3 bg-theme-border-input mx-1" />
                        <input
                          type="number"
                          min={0}
                          max={59}
                          step={1}
                          value={mcfM || ''}
                          onChange={(e) => {
                            const newM = parseInt(e.target.value) || 0;
                            setManualCarryDays(mcfD + (mcfH + newM / 60) / workingHours);
                          }}
                          placeholder="0"
                          className="w-10 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                        />
                        <span className="text-[10px] text-theme-text-muted font-bold">m</span>
                      </div>
                    );
                  })()}
                </div>
                {manualCarryDays < 0 && (
                  <p className="text-[10px] text-rose-455 font-semibold">
                    ⚠ Carry forward value cannot be negative.
                  </p>
                )}
                <p className="text-[10px] text-theme-text-muted leading-relaxed">
                  Specify the exact number of unused leaves to carry forward for this user. The system will bypass calculations and directly use this value.
                </p>
              </div>
            ) : total > 0 ? (
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
                  Custom Splits Allocation
                </label>

                <div className="grid grid-cols-1 gap-2.5">
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-theme-card-bg/30 border-theme-border-muted/80 focus-within:border-indigo-500/60 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-400/30 text-indigo-400">
                        <FolderPlus className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-theme-text-primary block">Carry Forward / Reserve</span>
                        <span className="text-[10px] text-theme-text-muted block mt-0.5">Carry forward to the next period's active quota.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const { d: cfD, h: cfH, m: cfM } = getDaysHoursMins(carryForwardDays);
                        return (
                          <div className="flex items-center gap-1 bg-theme-page-bg border border-theme-border-input rounded-lg px-1.5 py-1 focus-within:border-indigo-500 transition-all">
                            <input
                              type="number"
                              min={0}
                              max={Math.floor(total)}
                              step={1}
                              value={cfD}
                              onChange={(e) => {
                                const newD = parseInt(e.target.value) || 0;
                                setCarryForwardDays(newD + (cfH + cfM / 60) / workingHours);
                              }}
                              className="w-8 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                              placeholder="0"
                            />
                            <span className="text-[9px] text-theme-text-muted font-bold">d</span>
                            <div className="w-px h-3 bg-theme-border-input mx-0.5" />
                            <input
                              type="number"
                              min={0}
                              max={Math.floor(workingHours)}
                              step={1}
                              value={cfH}
                              onChange={(e) => {
                                const newH = parseInt(e.target.value) || 0;
                                setCarryForwardDays(cfD + (newH + cfM / 60) / workingHours);
                              }}
                              className="w-7 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                              placeholder="0"
                            />
                            <span className="text-[9px] text-theme-text-muted font-bold">h</span>
                            <div className="w-px h-3 bg-theme-border-input mx-0.5" />
                            <input
                              type="number"
                              min={0}
                              max={59}
                              step={1}
                              value={cfM}
                              onChange={(e) => {
                                const newM = parseInt(e.target.value) || 0;
                                setCarryForwardDays(cfD + (cfH + newM / 60) / workingHours);
                              }}
                              className="w-8 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                              placeholder="0"
                            />
                            <span className="text-[9px] text-theme-text-muted font-bold">m</span>
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => handleQuickAllocate('carry_forward')}
                        className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        All
                      </button>
                    </div>
                  </div>

                  {/* Cash Payment Option */}
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-theme-card-bg/30 border-theme-border-muted/80 focus-within:border-emerald-500/60 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-455">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-theme-text-primary block">Cash Payment (Payout)</span>
                        <span className="text-[10px] text-theme-text-muted block mt-0.5">Pay direct cash equivalent. Deducts from active quota.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const { d: payD, h: payH, m: payM } = getDaysHoursMins(paymentDays);
                        return (
                          <div className="flex items-center gap-1 bg-theme-page-bg border border-theme-border-input rounded-lg px-1.5 py-1 focus-within:border-emerald-500 transition-all">
                            <input
                              type="number"
                              min={0}
                              max={Math.floor(total)}
                              step={1}
                              value={payD}
                              onChange={(e) => {
                                const newD = parseInt(e.target.value) || 0;
                                setPaymentDays(newD + (payH + payM / 60) / workingHours);
                              }}
                              className="w-8 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                              placeholder="0"
                            />
                            <span className="text-[9px] text-theme-text-muted font-bold">d</span>
                            <div className="w-px h-3 bg-theme-border-input mx-0.5" />
                            <input
                              type="number"
                              min={0}
                              max={Math.floor(workingHours)}
                              step={1}
                              value={payH}
                              onChange={(e) => {
                                const newH = parseInt(e.target.value) || 0;
                                setPaymentDays(payD + (newH + payM / 60) / workingHours);
                              }}
                              className="w-7 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                              placeholder="0"
                            />
                            <span className="text-[9px] text-theme-text-muted font-bold">h</span>
                            <div className="w-px h-3 bg-theme-border-input mx-0.5" />
                            <input
                              type="number"
                              min={0}
                              max={59}
                              step={1}
                              value={payM}
                              onChange={(e) => {
                                const newM = parseInt(e.target.value) || 0;
                                setPaymentDays(payD + (payH + newM / 60) / workingHours);
                              }}
                              className="w-8 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                              placeholder="0"
                            />
                            <span className="text-[9px] text-theme-text-muted font-bold">m</span>
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => handleQuickAllocate('payment')}
                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-455 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        All
                      </button>
                    </div>
                  </div>

                  {/* Adjust Leaves Option */}
                  {totalOutstandingOffice > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-theme-card-bg/30 border-theme-border-muted/80 focus-within:border-purple-500/60 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-400/30 text-purple-400">
                          <ArrowRightLeft className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-theme-text-primary block">Adjust Leaves</span>
                          <span className="text-[10px] text-theme-text-muted block mt-0.5">Adjust against outstanding Office Leave ({totalOutstandingOffice} days).</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(() => {
                          const { d: adjD, h: adjH, m: adjM } = getDaysHoursMins(adjustLeaveDays);
                          return (
                            <div className="flex items-center gap-1 bg-theme-page-bg border border-theme-border-muted rounded-lg px-1.5 py-1 focus-within:border-purple-500 transition-all">
                              <input
                                type="number"
                                min={0}
                                max={Math.floor(Math.min(total, totalOutstandingOffice))}
                                step={1}
                                value={adjD}
                                onChange={(e) => {
                                  const newD = parseInt(e.target.value) || 0;
                                  setAdjustLeaveDays(newD + (adjH + adjM / 60) / workingHours);
                                }}
                                className="w-8 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                                placeholder="0"
                              />
                              <span className="text-[9px] text-theme-text-muted font-bold">d</span>
                              <div className="w-px h-3 bg-theme-border-input mx-0.5" />
                              <input
                                type="number"
                                min={0}
                                max={Math.floor(workingHours)}
                                step={1}
                                value={adjH}
                                onChange={(e) => {
                                  const newH = parseInt(e.target.value) || 0;
                                  setAdjustLeaveDays(adjD + (newH + adjM / 60) / workingHours);
                                }}
                                className="w-7 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                                placeholder="0"
                              />
                              <span className="text-[9px] text-theme-text-muted font-bold">h</span>
                              <div className="w-px h-3 bg-theme-border-input mx-0.5" />
                              <input
                                type="number"
                                min={0}
                                max={59}
                                step={1}
                                value={adjM}
                                onChange={(e) => {
                                  const newM = parseInt(e.target.value) || 0;
                                  setAdjustLeaveDays(adjD + (adjH + newM / 60) / workingHours);
                                }}
                                className="w-8 bg-transparent text-right text-xs font-mono font-bold text-theme-text-primary focus:outline-none"
                                placeholder="0"
                              />
                              <span className="text-[9px] text-theme-text-muted font-bold">m</span>
                            </div>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => handleQuickAllocate('adjust_leave')}
                          className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-455 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          All
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Visual Allocation Summary & Segment Bar */}
        {!isNegative && !isManualOverride && total > 0 && (
          <div className="p-3.5 bg-theme-page-bg border border-theme-border-muted rounded-xl space-y-2.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
              <span>Allocation Summary</span>
              <span className={isAllocatedCorrectly ? "text-emerald-400" : "text-rose-400 animate-pulse"}>
                {formatDaysAndHours(allocated, workingHours)} / {formatDaysAndHours(total, workingHours)} Allocated
              </span>
            </div>

            <div className="h-2 w-full bg-theme-card-container/80 rounded-full overflow-hidden flex border border-theme-card-bg">
              {total > 0 ? (
                <>
                  <div style={{ width: `${(carryForwardDays / total) * 100}%` }} className="bg-indigo-500 h-full transition-all duration-300" />
                  <div style={{ width: `${(paymentDays / total) * 100}%` }} className="bg-emerald-500 h-full transition-all duration-300" />
                  <div style={{ width: `${(adjustLeaveDays / total) * 100}%` }} className="bg-purple-500 h-full transition-all duration-300" />
                </>
              ) : null}
            </div>

            {isAllocatedCorrectly ? (
              <div className="text-[10.5px] text-emerald-400 font-semibold flex items-center gap-1 justify-center bg-emerald-500/5 py-1 rounded-lg border border-emerald-500/10">
                ✓ Unused leave balance is fully allocated.
              </div>
            ) : (
              <div className="text-[10.5px] text-rose-455 font-semibold flex items-center gap-1 justify-center bg-rose-500/5 py-1 rounded-lg border border-rose-500/10">
                ⚠ Allocated sum ({formatDaysAndHours(allocated, workingHours)}) must exactly match unused balance ({formatDaysAndHours(total, workingHours)}).
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-theme-border-muted">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-primary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !isAllocatedCorrectly}
            className="flex-1 py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Processing...' : 'Finalize & Process'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
