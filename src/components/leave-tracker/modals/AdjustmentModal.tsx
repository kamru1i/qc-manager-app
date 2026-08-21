'use client';

import { useState, useEffect } from 'react';
import { SlidersHorizontal, RefreshCw, AlertCircle } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';
import { calculateStats, GlobalSettings, parseIntervalToMinutes, formatDuration } from '@/utils/dashboardHelpers';

import { Modal } from '@/components/common/Modal';
import { Profile } from '@/types';

interface AdjustmentModalProps {
  showAdjustmentModal: boolean;
  setShowAdjustmentModal: (val: boolean) => void;
  adjustmentRecord: ChutiRecord | null;
  setAdjustmentRecord: (val: ChutiRecord | null) => void;
  adjustmentType: 'full' | 'partial';
  setAdjustmentType: (val: 'full' | 'partial') => void;
  partialAdjustmentTime: string;
  setPartialAdjustmentTime: (val: string) => void;
  setAdjustShortLeaveOption?: (val: boolean) => void;
  handleSaveAdjustment: (adjustSL?: boolean, category?: string) => void;
  records: ChutiRecord[];
  holidayResponses: any[];
  globalSettings: GlobalSettings;
  submitting?: boolean;
  targetProfile?: Profile | null;
  isAdmin?: boolean;
}

export function AdjustmentModal({
  showAdjustmentModal,
  setShowAdjustmentModal,
  adjustmentRecord,
  setAdjustmentRecord,
  adjustmentType,
  setAdjustmentType,
  partialAdjustmentTime,
  setPartialAdjustmentTime,
  handleSaveAdjustment,
  records = [],
  holidayResponses = [],
  globalSettings,
  submitting = false,
  targetProfile,
  isAdmin = false,
}: AdjustmentModalProps) {
  const [selectedCategory, setSelectedCategory] = useState('None');

  // Reset selected category and adjustment state when opening the modal
  useEffect(() => {
    if (showAdjustmentModal) {
      setSelectedCategory('None');
      setAdjustmentType('full');
      setPartialAdjustmentTime('');
    }
  }, [showAdjustmentModal, adjustmentRecord, setAdjustmentType, setPartialAdjustmentTime]);

  const selectedYear = adjustmentRecord?.date ? adjustmentRecord.date.substring(0, 4) : new Date().getFullYear().toString();
  const approvedRecords = records.filter(r => r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear);
  const stats = calculateStats(approvedRecords, targetProfile?.working_hours || 9.5);

  // If reserve is disabled on profile and not admin, govt holiday remaining is 0
  const isReserveAllowed = isAdmin || (targetProfile ? targetProfile.allow_reserve !== false : true);

  const reservedCount = isReserveAllowed
    ? holidayResponses.filter((r: any) => r.user_id === adjustmentRecord?.user_id && r.response === 'reserve').length
    : 0;
  const govtHolidayRemaining = Math.max(0, reservedCount - (stats.govtHolidaysTaken ?? 0));

  const eidFitrTotal = globalSettings?.eid_fitr_leave ?? 0;
  const eidFitrRemaining = Math.max(0, eidFitrTotal - (stats.eidFitrTaken ?? 0));

  const eidAdhaTotal = globalSettings?.eid_adha_leave ?? 0;
  const eidAdhaRemaining = Math.max(0, eidAdhaTotal - (stats.eidAdhaTaken ?? 0));

  const availableShortMins = parseIntervalToMinutes(stats.shortHours);
  const availableOvertimeMins = parseIntervalToMinutes(stats.overtimeHours);

  // For Overtime adjustment calculations
  const otMins = adjustmentRecord && adjustmentRecord.leave_type === 'Overtime'
    ? parseIntervalToMinutes(adjustmentRecord.leave_hour)
    : 0;
  const otDeductSLMins = Math.min(otMins, availableShortMins);
  const otRemainingSLMins = Math.max(0, availableShortMins - otMins);
  const otRemainingOTMins = Math.max(0, otMins - availableShortMins);

  // For Short Leave adjustment calculations
  const slMins = adjustmentRecord && adjustmentRecord.leave_type === 'Short Leave'
    ? parseIntervalToMinutes(adjustmentRecord.leave_hour)
    : 0;

  const parsedPartialTime = parseIntervalToMinutes(partialAdjustmentTime);
  const activeAdjustMins = adjustmentType === 'full'
    ? (selectedCategory === 'Overtime' ? Math.min(slMins, availableOvertimeMins) : slMins)
    : Math.min(parsedPartialTime, slMins);

  return (
    <Modal
      isOpen={showAdjustmentModal && adjustmentRecord !== null}
      onClose={() => {
        setShowAdjustmentModal(false);
        setAdjustmentRecord(null);
      }}
      title="Confirm Leave Adjustment"
      icon={<SlidersHorizontal className="h-5 w-5 text-blue-500" />}
      glowClass="bg-blue-900/10"
      maxWidthClass="max-w-md"
    >
      {adjustmentRecord && (
        <>
          {/* ========================================================================= */}
          {/* 1. OVERTIME ADJUSTMENT VIEW                                              */}
          {/* ========================================================================= */}
          {adjustmentRecord.leave_type === 'Overtime' ? (
            <div className="space-y-4 font-sans text-xs">
              <p className="text-xs text-theme-text-muted">
                Adjust this Overtime record against the staff member&apos;s available Short Leave balance.
              </p>

              {availableShortMins <= 0 ? (
                <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl text-amber-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>No Accumulated Short Leave</span>
                  </div>
                  <p className="text-[11px] text-theme-text-muted">
                    This employee currently has <strong className="text-theme-text-primary">00:00</strong> accumulated short leave hours. There are no short leaves available to deduct.
                  </p>
                </div>
              ) : (
                <div className="bg-theme-page-bg/60 border border-theme-border-muted p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-theme-border-muted text-xs">
                    <span className="text-theme-text-muted">Overtime Duration:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {adjustmentRecord.leave_hour ? adjustmentRecord.leave_hour.toString().split('.')[0].substring(0, 5) : formatDuration(otMins)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-theme-border-muted text-xs">
                    <span className="text-theme-text-muted">Current Total Short Leave:</span>
                    <span className="font-mono font-bold text-teal-400">{formatDuration(availableShortMins)}</span>
                  </div>

                  <div className="pt-1 space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Short Leave to Deduct:</span>
                      <span className="font-mono">-{formatDuration(otDeductSLMins)}</span>
                    </div>
                    <div className="flex justify-between text-theme-text-secondary">
                      <span>Remaining Short Leave:</span>
                      <span className="font-mono font-bold text-teal-300">{formatDuration(otRemainingSLMins)}</span>
                    </div>
                    <div className="flex justify-between text-theme-text-secondary">
                      <span>Remaining Overtime:</span>
                      <span className="font-mono font-bold text-amber-300">{formatDuration(otRemainingOTMins)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-theme-border-input/80">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentRecord(null);
                  }}
                  className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                {availableShortMins > 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveAdjustment(true)}
                    className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer transition-all disabled:opacity-50  items-center gap-1.5"
                  >
                    {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    {submitting ? 'Processing...' : 'Confirm'}
                  </button>
                )}
              </div>
            </div>
          ) : adjustmentRecord.leave_type === 'Short Leave' ? (
            /* ========================================================================= */
            /* 2. SHORT LEAVE ADJUSTMENT VIEW                                           */
            /* ========================================================================= */
            <div className="space-y-4 font-sans text-xs">
              <p className="text-xs text-theme-text-muted">Select an adjustment method for this Short Leave:</p>

              {/* Adjustment Method Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Overtime Adjustment Option */}
                {availableOvertimeMins > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('Overtime')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedCategory === 'Overtime' || selectedCategory === 'None'
                        ? 'bg-amber-950/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">Adjust with Overtime</span>
                      <span className="text-[10px] text-amber-400 font-mono">Available: {formatDuration(availableOvertimeMins)}</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedCategory === 'Overtime' || selectedCategory === 'None' ? 'border-amber-500' : 'border-theme-border-input'
                    }`}>
                      {(selectedCategory === 'Overtime' || selectedCategory === 'None') && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('None')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedCategory === 'None'
                        ? 'bg-blue-950/20 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">General Adjustment</span>
                      <span className="text-[10px] text-theme-text-muted">Full/Partial</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedCategory === 'None' ? 'border-blue-500' : 'border-theme-border-input'
                    }`}>
                      {selectedCategory === 'None' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                  </button>
                )}

                {/* Govt Holiday Option */}
                {govtHolidayRemaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('Govt Holiday')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedCategory === 'Govt Holiday'
                        ? 'bg-teal-955/20 border-teal-500/80 shadow-[0_0_12px_rgba(20,184,166,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">Govt Holiday</span>
                      <span className="text-[10px] text-teal-400 font-mono">{govtHolidayRemaining} days left</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedCategory === 'Govt Holiday' ? 'border-teal-500' : 'border-theme-border-input'
                    }`}>
                      {selectedCategory === 'Govt Holiday' && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                    </div>
                  </button>
                )}

                {/* Eid-ul-Fitr Option */}
                {eidFitrRemaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('Eid-ul-Fitr')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedCategory === 'Eid-ul-Fitr'
                        ? 'bg-purple-955/20 border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">Eid-ul-Fitr</span>
                      <span className="text-[10px] text-purple-400 font-mono">{eidFitrRemaining} days left</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedCategory === 'Eid-ul-Fitr' ? 'border-purple-500' : 'border-theme-border-input'
                    }`}>
                      {selectedCategory === 'Eid-ul-Fitr' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                    </div>
                  </button>
                )}

                {/* Eid-ul-Adha Option */}
                {eidAdhaRemaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('Eid-ul-Adha')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedCategory === 'Eid-ul-Adha'
                        ? 'bg-purple-955/20 border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-theme-text-primary block">Eid-ul-Adha</span>
                      <span className="text-[10px] text-purple-400 font-mono">{eidAdhaRemaining} days left</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedCategory === 'Eid-ul-Adha' ? 'border-purple-500' : 'border-theme-border-input'
                    }`}>
                      {selectedCategory === 'Eid-ul-Adha' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                    </div>
                  </button>
                )}

                {/* Deduct Salary Option */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('Salary')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedCategory === 'Salary'
                        ? 'bg-amber-955/30 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-amber-400 block">Deduct Salary</span>
                      <span className="text-[10px] text-theme-text-muted">Salary deduction</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedCategory === 'Salary' ? 'border-amber-500' : 'border-theme-border-input'
                    }`}>
                      {selectedCategory === 'Salary' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                    </div>
                  </button>
                )}
              </div>

              {/* Duration configuration for Overtime or General adjustment */}
              {(selectedCategory === 'Overtime' || selectedCategory === 'None') && (
                <div className="bg-theme-page-bg/60 border border-theme-border-muted p-3.5 rounded-xl space-y-3">
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-2 p-2.5 bg-theme-card-bg/60 border border-theme-border-input rounded-lg cursor-pointer hover:border-theme-border-active transition-all">
                      <input
                        type="radio"
                        name="adjustmentType"
                        checked={adjustmentType === 'full'}
                        onChange={() => setAdjustmentType('full')}
                        className="text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-xs text-theme-text-primary font-medium">
                        Full Duration ({adjustmentRecord.leave_hour ? adjustmentRecord.leave_hour.toString().split('.')[0].substring(0, 5) : formatDuration(slMins)})
                      </span>
                    </label>
                    <label className="flex-1 flex items-center gap-2 p-2.5 bg-theme-card-bg/60 border border-theme-border-input rounded-lg cursor-pointer hover:border-theme-border-active transition-all">
                      <input
                        type="radio"
                        name="adjustmentType"
                        checked={adjustmentType === 'partial'}
                        onChange={() => setAdjustmentType('partial')}
                        className="text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-xs text-theme-text-primary font-medium">Partial Duration</span>
                    </label>
                  </div>

                  {adjustmentType === 'partial' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">
                        Adjustment Duration (HH:MM)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 01:00"
                        value={partialAdjustmentTime}
                        onChange={(e) => setPartialAdjustmentTime(e.target.value)}
                        className="w-full px-3 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  )}

                  {availableOvertimeMins > 0 && activeAdjustMins > 0 && (
                    <div className="pt-2 border-t border-theme-border-muted/80 space-y-1 text-[11px]">
                      <div className="flex justify-between text-emerald-400">
                        <span>Overtime Deducted:</span>
                        <span className="font-mono font-semibold">-{formatDuration(Math.min(activeAdjustMins, availableOvertimeMins))}</span>
                      </div>
                      <div className="flex justify-between text-theme-text-secondary">
                        <span>Remaining Overtime:</span>
                        <span className="font-mono font-semibold text-amber-300">
                          {formatDuration(Math.max(0, availableOvertimeMins - activeAdjustMins))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-theme-border-input/80">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentRecord(null);
                  }}
                  className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveAdjustment(undefined, selectedCategory === 'Overtime' ? 'None' : selectedCategory)}
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Adjusting...' : selectedCategory === 'Salary' ? 'Confirm Salary Deduction' : 'Confirm Adjustment'}
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 3. FULL LEAVE ADJUSTMENT VIEW                                            */
            /* ========================================================================= */
            <div className="space-y-4 font-sans text-xs">
              {/* Remaining Leave Summary */}
              <div className="bg-theme-page-bg/60 border border-theme-border-muted p-3.5 rounded-xl space-y-2">
                <span className="block text-[11px] font-semibold text-theme-text-muted uppercase tracking-wider">
                  Available Reserve Holidays ({selectedYear})
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium">
                  <div className="bg-theme-card-bg/50 p-2 rounded-lg border border-theme-border-muted">
                    <span className="text-theme-text-muted block text-[9px] uppercase font-bold">Govt Holiday</span>
                    <span className="text-teal-400 font-bold font-mono">{govtHolidayRemaining} days</span>
                  </div>
                  <div className="bg-theme-card-bg/50 p-2 rounded-lg border border-theme-border-muted">
                    <span className="text-theme-text-muted block text-[9px] uppercase font-bold">Eid-ul-Fitr</span>
                    <span className="text-purple-400 font-bold font-mono">{eidFitrRemaining} days</span>
                  </div>
                  <div className="bg-theme-card-bg/50 p-2 rounded-lg border border-theme-border-muted">
                    <span className="text-theme-text-muted block text-[9px] uppercase font-bold">Eid-ul-Adha</span>
                    <span className="text-purple-400 font-bold font-mono">{eidAdhaRemaining} days</span>
                  </div>
                </div>
              </div>

              {/* Selection Category options */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-theme-text-muted uppercase tracking-wider">
                  Select Adjustment Option
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* General Adjustment Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('None')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedCategory === 'None'
                        ? 'bg-blue-950/20 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                        : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                    }`}
                  >
                    <span className="text-xs font-bold text-theme-text-primary">General Adjustment</span>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedCategory === 'None' ? 'border-blue-500' : 'border-theme-border-input'
                    }`}>
                      {selectedCategory === 'None' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                  </button>

                  {/* Govt Holiday Option */}
                  {govtHolidayRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('Govt Holiday')}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedCategory === 'Govt Holiday'
                          ? 'bg-teal-955/20 border-teal-500/80 shadow-[0_0_12px_rgba(20,184,166,0.15)]'
                          : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-theme-text-primary block">Govt Holiday</span>
                        <span className="text-[10px] text-teal-400 font-mono">{govtHolidayRemaining} days left</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedCategory === 'Govt Holiday' ? 'border-teal-500' : 'border-theme-border-input'
                      }`}>
                        {selectedCategory === 'Govt Holiday' && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                      </div>
                    </button>
                  )}

                  {/* Eid-ul-Fitr Option */}
                  {eidFitrRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('Eid-ul-Fitr')}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedCategory === 'Eid-ul-Fitr'
                          ? 'bg-purple-955/20 border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                          : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-theme-text-primary block">Eid-ul-Fitr</span>
                        <span className="text-[10px] text-purple-400 font-mono">{eidFitrRemaining} days left</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedCategory === 'Eid-ul-Fitr' ? 'border-purple-500' : 'border-theme-border-input'
                      }`}>
                        {selectedCategory === 'Eid-ul-Fitr' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                      </div>
                    </button>
                  )}

                  {/* Eid-ul-Adha Option */}
                  {eidAdhaRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('Eid-ul-Adha')}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedCategory === 'Eid-ul-Adha'
                          ? 'bg-purple-955/20 border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                          : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-theme-text-primary block">Eid-ul-Adha</span>
                        <span className="text-[10px] text-purple-400 font-mono">{eidAdhaRemaining} days left</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedCategory === 'Eid-ul-Adha' ? 'border-purple-500' : 'border-theme-border-input'
                      }`}>
                        {selectedCategory === 'Eid-ul-Adha' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                      </div>
                    </button>
                  )}

                  {/* Deduct Salary Option */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('Salary')}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedCategory === 'Salary'
                          ? 'bg-amber-955/30 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-amber-400">Deduct Salary</span>
                        <span className="text-[10px] text-theme-text-muted">Salary deduction</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedCategory === 'Salary' ? 'border-amber-500' : 'border-theme-border-input'
                      }`}>
                        {selectedCategory === 'Salary' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                      </div>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-theme-border-input/80">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentRecord(null);
                  }}
                  className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveAdjustment(undefined, selectedCategory)}
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Adjusting...' : selectedCategory === 'Salary' ? 'Confirm Salary Deduction' : 'Confirm Adjustment'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
