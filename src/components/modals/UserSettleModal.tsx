'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, RotateCcw, Sparkles, CheckCircle2, DollarSign, ArrowRightLeft, FolderPlus, ShieldAlert } from 'lucide-react';
import { Profile, LeaveSettlement, GovtHolidayResponse } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { GlobalSettings, calculateStats, calculateHalfYearlyOfficeLeave, getSettlementSplits, getOutstandingOfficeLeave, formatDaysAndHours } from '@/utils/dashboardHelpers';
import { Modal } from '../Modal';
import { supabase } from '@/utils/supabase';
import { sendPushNotification } from '@/utils/webPushHelper';

interface UserSettleModalProps {
  showModal: boolean;
  setShowModal: (val: boolean) => void;
  profile: Profile | null;
  selectedYear: string;
  records: ChutiRecord[];
  globalSettings: GlobalSettings;
  settlements: LeaveSettlement[];
  holidayResponses: GovtHolidayResponse[];
  onSaveSettlementsBulk: (settlementsList: any[]) => Promise<boolean>;
}

export function UserSettleModal({
  showModal,
  setShowModal,
  profile,
  selectedYear,
  records,
  globalSettings,
  settlements,
  holidayResponses,
  onSaveSettlementsBulk,
}: UserSettleModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [splits, setSplits] = useState<Record<string, { carryForward: number; payment: number; adjustLeave: number }>>({});

  // 1. Filter active (initiated or responded but not processed) settlements for the current user
  const activeSettlements = React.useMemo(() => settlements.filter(
    (s) => s.user_id === profile?.id && s.year === selectedYear && (s.status === 'initiated' || s.status === 'responded')
  ), [settlements, profile?.id, selectedYear]);

  // 2. Calculate remaining balances for general broadcast mode
  const userRecords = React.useMemo(() => records.filter(
    (r) => r.user_id === profile?.id && r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear
  ), [records, profile?.id, selectedYear]);
  const stats = React.useMemo(() => calculateStats(userRecords), [userRecords]);

  const prevYear = (Number(selectedYear) - 1).toString();

  const carriedGovt = settlements
    .filter((s) => s.user_id === profile?.id && s.year === prevYear && s.leave_category === 'Govt Holiday')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedEidFitr = settlements
    .filter((s) => s.user_id === profile?.id && s.year === prevYear && s.leave_category === 'Eid-ul-Fitr')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const carriedEidAdha = settlements
    .filter((s) => s.user_id === profile?.id && s.year === prevYear && s.leave_category === 'Eid-ul-Adha')
    .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

  const isGovtHolidayEligible = profile?.eligible_govt_holiday !== false;
  const halfYearlyStats = React.useMemo(() => calculateHalfYearlyOfficeLeave(
    records,
    globalSettings.office_leave_h1,
    globalSettings.office_leave_h2,
    selectedYear,
    settlements,
    profile?.id,
    undefined,
    profile?.working_hours || 9.5
  ), [records, globalSettings.office_leave_h1, globalSettings.office_leave_h2, selectedYear, settlements, profile?.id, profile?.working_hours]);

  const totalOutstandingOffice = React.useMemo(() => {
    if (!profile?.id) return 0;
    return getOutstandingOfficeLeave(
      records,
      globalSettings.office_leave_h1,
      globalSettings.office_leave_h2,
      selectedYear,
      settlements,
      profile.id,
      profile.working_hours || 9.5
    );
  }, [records, globalSettings.office_leave_h1, globalSettings.office_leave_h2, selectedYear, settlements, profile]);

  const currentHalfPeriod: 'H1' | 'H2' = halfYearlyStats.currentHalf === 1 ? 'H1' : 'H2';
  const officeRemaining = halfYearlyStats.currentHalf === 1 ? halfYearlyStats.h1Remaining : halfYearlyStats.h2Remaining;

  const activeGovtSettledForPeriod = settlements.some(
    s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Govt Holiday' && s.period === currentHalfPeriod && (s.status === 'processed' || s.status === 'responded')
  );
  const userGovtResponses = holidayResponses.filter(
    (r) => r.user_id === profile?.id && r.response === 'reserve' && r.holiday_date.substring(0, 4) === selectedYear
  );
  const govtRemaining = isGovtHolidayEligible && !activeGovtSettledForPeriod
    ? Math.max(0, userGovtResponses.length + carriedGovt - (stats.govtHolidaysTaken ?? 0))
    : 0;

  const activeEidFitrSettledForPeriod = settlements.some(
    s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Fitr' && (s.status === 'processed' || s.status === 'responded')
  );
  const eidFitrTotal = (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr;
  const eidFitrRemaining = !activeEidFitrSettledForPeriod
    ? Math.max(0, eidFitrTotal - (stats.eidFitrTaken ?? 0))
    : 0;

  const activeEidAdhaSettledForPeriod = settlements.some(
    s => s.user_id === profile?.id && s.year === selectedYear && s.leave_category === 'Eid-ul-Adha' && (s.status === 'processed' || s.status === 'responded')
  );
  const eidAdhaTotal = (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha;
  const eidAdhaRemaining = !activeEidAdhaSettledForPeriod
    ? Math.max(0, eidAdhaTotal - (stats.eidAdhaTaken ?? 0))
    : 0;

  // Construct display items list combining individual requests & general broadcast fallback
  const displayItems = React.useMemo(() => {
    if (activeSettlements.length > 0) {
      return activeSettlements.map(s => ({
        id: s.id,
        leave_category: s.leave_category,
        period: s.period,
        year: s.year,
        remaining_days: s.remaining_days,
        isCustom: false,
      }));
    }

    // General broadcast: show only the specific category+period admin broadcasted
    const broadcastPeriod = globalSettings.settlement_active_period;
    const broadcastCategory = globalSettings.settlement_active_category;

    if (globalSettings.settlement_active_year === selectedYear && broadcastPeriod && broadcastCategory) {
      let remaining = 0;
      if (broadcastCategory === 'Office Leave') {
        if (broadcastPeriod === 'H1') remaining = halfYearlyStats.h1Remaining;
        else if (broadcastPeriod === 'H2') remaining = halfYearlyStats.h2Remaining;
        else remaining = officeRemaining;
      } else if (broadcastCategory === 'Govt Holiday') {
        remaining = govtRemaining;
      } else if (broadcastCategory === 'Eid-ul-Fitr') {
        remaining = eidFitrRemaining;
      } else if (broadcastCategory === 'Eid-ul-Adha') {
        remaining = eidAdhaRemaining;
      }

      if (Math.abs(remaining) > 0.01) {
        return [{
          id: `mock-${broadcastCategory.toLowerCase().replace(/\s+/g, '-')}`,
          leave_category: broadcastCategory,
          period: broadcastPeriod,
          year: selectedYear,
          remaining_days: remaining,
          isCustom: true,
        }];
      }
    }

    return [];
  }, [activeSettlements, globalSettings.settlement_active_year, globalSettings.settlement_active_period, globalSettings.settlement_active_category, selectedYear, halfYearlyStats, officeRemaining, govtRemaining, eidFitrRemaining, eidAdhaRemaining]);

  // Initialize preference selections
  useEffect(() => {
    if (showModal && profile) {
      const initialSplits: Record<string, { carryForward: number; payment: number; adjustLeave: number }> = {};
      displayItems.forEach((item) => {
        if (!item.isCustom) {
          const matched = activeSettlements.find(s => s.id === item.id);
          if (matched) {
            const hasSetSplits = (matched.carry_forward_days ?? 0) !== 0 || (matched.payment_days ?? 0) !== 0 || (matched.adjust_leave_days ?? 0) !== 0;
            if (hasSetSplits) {
              initialSplits[item.id] = {
                carryForward: matched.carry_forward_days ?? 0,
                payment: matched.payment_days ?? 0,
                adjustLeave: matched.adjust_leave_days ?? 0,
              };
            } else if (item.remaining_days < 0) {
              // Default to salary deduction for negative balance
              initialSplits[item.id] = { carryForward: 0, payment: item.remaining_days, adjustLeave: 0 };
            } else {
              initialSplits[item.id] = { carryForward: item.remaining_days, payment: 0, adjustLeave: 0 };
            }
          } else {
            initialSplits[item.id] = { 
              carryForward: item.remaining_days < 0 ? 0 : item.remaining_days, 
              payment: item.remaining_days < 0 ? item.remaining_days : 0, 
              adjustLeave: 0 
            };
          }
        } else {
          initialSplits[item.id] = { 
            carryForward: item.remaining_days < 0 ? 0 : item.remaining_days, 
            payment: item.remaining_days < 0 ? item.remaining_days : 0, 
            adjustLeave: 0 
          };
        }
      });
      setSplits((prev) => {
        const isIdentical = Object.keys(initialSplits).length === Object.keys(prev).length &&
          Object.keys(initialSplits).every((key) => {
            const a = initialSplits[key];
            const b = prev[key];
            return b && a.carryForward === b.carryForward && a.payment === b.payment && a.adjustLeave === b.adjustLeave;
          });
        return isIdentical ? prev : initialSplits;
      });
    } else if (!showModal) {
      setSplits({});
    }
  }, [showModal, profile, displayItems, activeSettlements]);

  const workingHours = profile?.working_hours || 9.5;

  const getDaysHoursMins = (daysVal: number) => {
    const totalMins = Math.round(daysVal * workingHours * 60);
    const minutesPerDay = Math.round(workingHours * 60);
    const d = Math.floor(totalMins / minutesPerDay);
    const remainingMins = totalMins % minutesPerDay;
    const h = Math.floor(remainingMins / 60);
    const m = remainingMins % 60;
    return { d, h, m };
  };

  const handleSplitChange = (itemId: string, field: 'carryForward' | 'payment' | 'adjustLeave', value: number) => {
    setSplits((prev) => {
      const current = prev[itemId] || { carryForward: 0, payment: 0, adjustLeave: 0 };
      let finalVal = Math.max(0, Math.round(value * 100) / 100);
      if (field === 'adjustLeave') {
        finalVal = Math.min(finalVal, totalOutstandingOffice);
      }
      return {
        ...prev,
        [itemId]: {
          ...current,
          [field]: finalVal,
        },
      };
    });
  };

  const handleNegativeSelect = (itemId: string, option: 'payment' | 'carry_forward', totalVal: number) => {
    const finalVal = Math.round(totalVal * 100) / 100;
    setSplits((prev) => ({
      ...prev,
      [itemId]: {
        carryForward: option === 'carry_forward' ? finalVal : 0,
        payment: option === 'payment' ? finalVal : 0,
        adjustLeave: 0,
      },
    }));
  };

  const handleQuickAllocate = (itemId: string, action: 'carryForward' | 'payment' | 'adjustLeave', total: number) => {
    const finalVal = Math.round(total * 100) / 100;
    const finalAdjustVal = action === 'adjustLeave' ? Math.min(finalVal, totalOutstandingOffice) : finalVal;
    setSplits((prev) => ({
      ...prev,
      [itemId]: {
        carryForward: action === 'carryForward' ? finalVal : 0,
        payment: action === 'payment' ? finalVal : 0,
        adjustLeave: action === 'adjustLeave' ? finalAdjustVal : 0,
      },
    }));
  };

  const isAllAllocatedCorrectly = displayItems.every((item) => {
    const itemSplits = splits[item.id] || { carryForward: 0, payment: 0, adjustLeave: 0 };
    const allocated = itemSplits.carryForward + itemSplits.payment + itemSplits.adjustLeave;
    return Math.abs(allocated - item.remaining_days) < 0.01;
  });

  const handleSave = async () => {
    if (!profile || !isAllAllocatedCorrectly) return;
    setSubmitting(true);

    const settlementsList = displayItems.map((item) => {
      const itemSplits = splits[item.id] || { carryForward: 0, payment: 0, adjustLeave: 0 };
      
      // Determine action type
      let actionType: 'carry_forward' | 'payment' | 'adjust_leave' | 'split' = 'carry_forward';
      const activeCount = [
        Math.abs(itemSplits.carryForward) > 0.01,
        Math.abs(itemSplits.payment) > 0.01,
        Math.abs(itemSplits.adjustLeave) > 0.01
      ].filter(Boolean).length;

      if (activeCount > 1) {
        actionType = 'split';
      } else if (Math.abs(itemSplits.carryForward) > 0.01) {
        actionType = 'carry_forward';
      } else if (Math.abs(itemSplits.payment) > 0.01) {
        actionType = 'payment';
      } else if (Math.abs(itemSplits.adjustLeave) > 0.01) {
        actionType = 'adjust_leave';
      }

      return {
        ...(!item.isCustom ? { id: item.id } : {}),
        user_id: profile.id,
        year: item.year,
        period: item.period,
        leave_category: item.leave_category,
        remaining_days: item.remaining_days,
        action_type: actionType,
        status: 'responded' as const,
        action_by: profile.id,
        carry_forward_days: itemSplits.carryForward,
        payment_days: itemSplits.payment,
        adjust_leave_days: itemSplits.adjustLeave,
      };
    });

    const success = await onSaveSettlementsBulk(settlementsList);
    setSubmitting(false);
    if (success) {
      setShowModal(false);

    }
  };

  return (
    <Modal
      isOpen={showModal && profile !== null}
      onClose={() => setShowModal(false)}
      title="Submit Leave Preference"
      icon={<RotateCcw className="h-5 w-5 text-orange-500" />}
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-6 font-sans text-xs text-slate-300">
        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-850 scrollbar-track-transparent">
          <div className="p-4 bg-indigo-950/20 border border-indigo-900/40 text-indigo-300 rounded-xl leading-relaxed">
            <p className="font-bold flex items-center gap-1.5 text-slate-100 text-sm">
              <Sparkles className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
              Action Required: Settle Unused Leaves
            </p>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {activeSettlements.some(s => s.status === 'initiated')
                ? 'The administrator has initiated a preference review for your unused leave balances. Please submit your choice for each item below.'
                : 'A general leave review session is active. Please submit your preferred actions for your unused leave balances below.'}
            </p>
          </div>

          {displayItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="font-semibold text-slate-300">All Settled!</p>
              <p className="text-[11px] text-slate-500 font-medium">You have no remaining leave balances to settle.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {displayItems.map((item) => {
                const itemSplits = splits[item.id] || { carryForward: 0, payment: 0, adjustLeave: 0 };
                const allocated = itemSplits.carryForward + itemSplits.payment + itemSplits.adjustLeave;
                const isCorrect = Math.abs(allocated - item.remaining_days) < 0.01;

                return (
                  <div key={item.id} className="p-4 bg-slate-955/40 border border-slate-850/80 rounded-2xl space-y-4">
                    {/* Category Header */}
                    <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-wide">
                          {item.leave_category === 'Office Leave' ? 'Allocated Office Leave' : item.leave_category}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-455 mt-0.5">
                          <span className="bg-indigo-650/15 text-indigo-400 border border-indigo-900/45 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Period: {item.period === 'H1' ? 'January-June (H1)' : item.period === 'H2' ? 'July-December (H2)' : item.period}
                          </span>
                          <span>•</span>
                          <span>Year: {item.year}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                          {item.remaining_days < 0 ? 'Outstanding Deficit' : 'Unused Balance'}
                        </span>
                        <span className={`text-lg font-bold font-mono ${item.remaining_days < 0 ? 'text-rose-500' : 'text-orange-400'}`}>
                          {formatDaysAndHours(Math.abs(item.remaining_days), workingHours)}
                        </span>
                      </div>
                    </div>

                    {item.remaining_days < 0 ? (
                      /* Deficit Options for User */
                      <div className="space-y-3">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Deficit Resolution Options
                        </span>
                        <div className="flex flex-col gap-2.5">
                          {/* Salary Deduction */}
                          <button
                            type="button"
                            onClick={() => handleNegativeSelect(item.id, 'payment', item.remaining_days)}
                            className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                              Math.abs(itemSplits.payment) > 0.01
                                ? 'bg-rose-955/20 border-rose-500/80 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                                : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                            }`}
                          >
                            <div>
                              <span className="text-xs font-bold text-white block">Salary Deduction</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Deduct {formatDaysAndHours(Math.abs(item.remaining_days), workingHours)} from salary.
                              </span>
                            </div>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                              Math.abs(itemSplits.payment) > 0.01 ? 'border-rose-500' : 'border-slate-600'
                            }`}>
                              {Math.abs(itemSplits.payment) > 0.01 && <div className="w-2 h-2 rounded-full bg-rose-500" />}
                            </div>
                          </button>

                          {/* Adjust H2 Office Leave (H1 only) */}
                          {item.period === 'H1' && (
                            <button
                              type="button"
                              onClick={() => handleNegativeSelect(item.id, 'carry_forward', item.remaining_days)}
                              className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                                Math.abs(itemSplits.carryForward) > 0.01
                                  ? 'bg-amber-955/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                  : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                              }`}
                            >
                              <div>
                                <span className="text-xs font-bold text-white block">Adjust with H2 Office Leave</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Deduct from H2 quota ({formatDaysAndHours(globalSettings.office_leave_h2, workingHours)} ➔ {formatDaysAndHours(globalSettings.office_leave_h2 - Math.abs(item.remaining_days), workingHours)} remaining).
                                </span>
                              </div>
                              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                Math.abs(itemSplits.carryForward) > 0.01 ? 'border-amber-500' : 'border-slate-600'
                              }`}>
                                {Math.abs(itemSplits.carryForward) > 0.01 && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                              </div>
                            </button>
                          )}

                          {/* Adjust Next Year's H1 Office Leave (H2 only) */}
                          {item.period === 'H2' && (
                            <button
                              type="button"
                              onClick={() => handleNegativeSelect(item.id, 'carry_forward', item.remaining_days)}
                              className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                                Math.abs(itemSplits.carryForward) > 0.01
                                  ? 'bg-amber-955/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                  : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                              }`}
                            >
                              <div>
                                <span className="text-xs font-bold text-white block">Adjust with Next Year's H1</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Deduct from next year's H1 Office Leave quota.
                                </span>
                              </div>
                              <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                Math.abs(itemSplits.carryForward) > 0.01 ? 'border-amber-500' : 'border-slate-600'
                              }`}>
                                {Math.abs(itemSplits.carryForward) > 0.01 && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Split Allocation Fields */
                      <div className="space-y-2.5">
                        {/* Carry Forward Option */}
                        <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-900/30 border-slate-850/80 focus-within:border-indigo-500/60 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-400/30 text-indigo-400">
                              <FolderPlus className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-100 block">Reserve / Carry Forward</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Carry forward to the next period's active quota.</span>
                            </div>
                          </div>
                          {(() => {
                            const { d: cfD, h: cfH, m: cfM } = getDaysHoursMins(itemSplits.carryForward);
                            return (
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1 bg-slate-955 border border-slate-800 rounded-lg px-1.5 py-1 focus-within:border-indigo-500 transition-all">
                                  <input
                                    type="number"
                                    min={0}
                                    max={Math.floor(item.remaining_days)}
                                    step={1}
                                    value={cfD}
                                    onChange={(e) => {
                                      const newD = parseInt(e.target.value) || 0;
                                      handleSplitChange(item.id, 'carryForward', newD + (cfH + cfM / 60) / workingHours);
                                    }}
                                    className="w-8 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                    placeholder="0"
                                  />
                                  <span className="text-[9px] text-slate-500 font-bold">d</span>
                                  <div className="w-[1px] h-3 bg-slate-800 mx-0.5" />
                                  <input
                                    type="number"
                                    min={0}
                                    max={Math.floor(workingHours)}
                                    step={1}
                                    value={cfH}
                                    onChange={(e) => {
                                      const newH = parseInt(e.target.value) || 0;
                                      handleSplitChange(item.id, 'carryForward', cfD + (newH + cfM / 60) / workingHours);
                                    }}
                                    className="w-7 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                    placeholder="0"
                                  />
                                  <span className="text-[9px] text-slate-500 font-bold">h</span>
                                  <div className="w-[1px] h-3 bg-slate-800 mx-0.5" />
                                  <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    step={1}
                                    value={cfM}
                                    onChange={(e) => {
                                      const newM = parseInt(e.target.value) || 0;
                                      handleSplitChange(item.id, 'carryForward', cfD + (cfH + newM / 60) / workingHours);
                                    }}
                                    className="w-8 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                    placeholder="0"
                                  />
                                  <span className="text-[9px] text-slate-500 font-bold">m</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAllocate(item.id, 'carryForward', item.remaining_days)}
                                  className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  All
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Cash Out Option */}
                        <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-900/30 border-slate-850/80 focus-within:border-emerald-500/60 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-400">
                              <DollarSign className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-100 block">Get Cash Payment (Cash Out)</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Receive direct monetary payout.</span>
                            </div>
                          </div>
                          {(() => {
                            const { d: payD, h: payH, m: payM } = getDaysHoursMins(itemSplits.payment);
                            return (
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1 bg-slate-955 border border-slate-800 rounded-lg px-1.5 py-1 focus-within:border-emerald-500 transition-all">
                                  <input
                                    type="number"
                                    min={0}
                                    max={Math.floor(item.remaining_days)}
                                    step={1}
                                    value={payD}
                                    onChange={(e) => {
                                      const newD = parseInt(e.target.value) || 0;
                                      handleSplitChange(item.id, 'payment', newD + (payH + payM / 60) / workingHours);
                                    }}
                                    className="w-8 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                    placeholder="0"
                                  />
                                  <span className="text-[9px] text-slate-500 font-bold">d</span>
                                  <div className="w-[1px] h-3 bg-slate-800 mx-0.5" />
                                  <input
                                    type="number"
                                    min={0}
                                    max={Math.floor(workingHours)}
                                    step={1}
                                    value={payH}
                                    onChange={(e) => {
                                      const newH = parseInt(e.target.value) || 0;
                                      handleSplitChange(item.id, 'payment', payD + (newH + payM / 60) / workingHours);
                                    }}
                                    className="w-7 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                    placeholder="0"
                                  />
                                  <span className="text-[9px] text-slate-500 font-bold">h</span>
                                  <div className="w-[1px] h-3 bg-slate-800 mx-0.5" />
                                  <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    step={1}
                                    value={payM}
                                    onChange={(e) => {
                                      const newM = parseInt(e.target.value) || 0;
                                      handleSplitChange(item.id, 'payment', payD + (payH + newM / 60) / workingHours);
                                    }}
                                    className="w-8 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                    placeholder="0"
                                  />
                                  <span className="text-[9px] text-slate-500 font-bold">m</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAllocate(item.id, 'payment', item.remaining_days)}
                                  className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  All
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Adjust Option */}
                        {totalOutstandingOffice > 0 && (
                          <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-900/30 border-slate-850/80 focus-within:border-amber-500/60 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-450">
                                <ArrowRightLeft className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-100 block">Adjust with Unpaid or Other Leaves</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">Adjust against outstanding Office Leave ({totalOutstandingOffice} days).</span>
                              </div>
                            </div>
                            {(() => {
                              const { d: adjD, h: adjH, m: adjM } = getDaysHoursMins(itemSplits.adjustLeave);
                              return (
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center gap-1 bg-slate-955 border border-slate-850 rounded-lg px-1.5 py-1 focus-within:border-amber-500 transition-all">
                                    <input
                                      type="number"
                                      min={0}
                                      max={Math.floor(Math.min(item.remaining_days, totalOutstandingOffice))}
                                      step={1}
                                      value={adjD}
                                      onChange={(e) => {
                                        const newD = parseInt(e.target.value) || 0;
                                        handleSplitChange(item.id, 'adjustLeave', newD + (adjH + adjM / 60) / workingHours);
                                      }}
                                      className="w-8 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                      placeholder="0"
                                    />
                                    <span className="text-[9px] text-slate-500 font-bold">d</span>
                                    <div className="w-[1px] h-3 bg-slate-800 mx-0.5" />
                                    <input
                                      type="number"
                                      min={0}
                                      max={Math.floor(workingHours)}
                                      step={1}
                                      value={adjH}
                                      onChange={(e) => {
                                        const newH = parseInt(e.target.value) || 0;
                                        handleSplitChange(item.id, 'adjustLeave', adjD + (newH + adjM / 60) / workingHours);
                                      }}
                                      className="w-7 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                      placeholder="0"
                                    />
                                    <span className="text-[9px] text-slate-500 font-bold">h</span>
                                    <div className="w-[1px] h-3 bg-slate-800 mx-0.5" />
                                    <input
                                      type="number"
                                      min={0}
                                      max={59}
                                      step={1}
                                      value={adjM}
                                      onChange={(e) => {
                                        const newM = parseInt(e.target.value) || 0;
                                        handleSplitChange(item.id, 'adjustLeave', adjD + (adjH + newM / 60) / workingHours);
                                      }}
                                      className="w-8 bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                                      placeholder="0"
                                    />
                                    <span className="text-[9px] text-slate-500 font-bold">m</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickAllocate(item.id, 'adjustLeave', item.remaining_days)}
                                    className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-455 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    All
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Progress Bar & Validation Status for item */}
                    {item.remaining_days > 0 && (
                      <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-455 uppercase tracking-wide">
                          <span>Allocation Progress</span>
                          <span className={isCorrect ? "text-emerald-400" : "text-rose-400 animate-pulse"}>
                            {allocated} / {item.remaining_days} days allocated
                          </span>
                        </div>

                        <div className="h-1.5 w-full bg-slate-950/80 rounded-full overflow-hidden flex border border-slate-900">
                          {item.remaining_days > 0 ? (
                            <>
                              <div style={{ width: `${(itemSplits.carryForward / item.remaining_days) * 100}%` }} className="bg-indigo-500 h-full transition-all duration-300" />
                              <div style={{ width: `${(itemSplits.payment / item.remaining_days) * 100}%` }} className="bg-emerald-500 h-full transition-all duration-300" />
                              <div style={{ width: `${(itemSplits.adjustLeave / item.remaining_days) * 100}%` }} className="bg-amber-500 h-full transition-all duration-300" />
                            </>
                          ) : null}
                        </div>

                        {!isCorrect && (
                          <div className="text-[10px] text-rose-455 font-semibold flex items-center justify-center gap-1 mt-1 bg-rose-500/5 py-0.5 rounded border border-rose-500/10">
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                            Sum of allocations ({allocated}d) must match unused balance ({item.remaining_days}d).
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-slate-850">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-900 cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || displayItems.length === 0 || !isAllAllocatedCorrectly}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Submitting...' : 'Submit Preferences'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
