'use client';

import { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal, RefreshCw, AlertCircle, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';
import { calculateStats, GlobalSettings, parseIntervalToMinutes, formatDuration } from '@/utils/dashboardHelpers';
import { formatDate } from '@/utils/quotesDashboardHelpers';
import { CustomSelect } from '@/components/common/CustomSelect';
import { Modal } from '@/components/common/Modal';
import { Profile } from '@/types';
import { toast } from 'sonner';

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
  handleSaveAdjustment: (
    adjustSL?: boolean,
    category?: string,
    specificHoliday?: { date: string; name: string } | null,
    salaryInfo?: { month: string; year: string } | null,
    generalDetails?: string | null
  ) => void;
  records: ChutiRecord[];
  holidayResponses: any[];
  globalSettings: GlobalSettings;
  submitting?: boolean;
  targetProfile?: Profile | null;
  isAdmin?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  const [selectedHolidayDate, setSelectedHolidayDate] = useState<string>('');
  const [selectedHolidayName, setSelectedHolidayName] = useState<string>('');
  const [generalAdjustmentReason, setGeneralAdjustmentReason] = useState<string>('');
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState<string>(() =>
    new Date().toLocaleString('en-US', { month: 'long' })
  );
  const [selectedSalaryYear, setSelectedSalaryYear] = useState<string>(() =>
    new Date().getFullYear().toString()
  );

  // Reset selected category and adjustment state when opening the modal
  useEffect(() => {
    if (showAdjustmentModal) {
      setSelectedCategory('None');
      setAdjustmentType('full');
      setPartialAdjustmentTime('');
      setSelectedHolidayDate('');
      setSelectedHolidayName('');
      setGeneralAdjustmentReason('');
      setSelectedSalaryMonth(new Date().toLocaleString('en-US', { month: 'long' }));
      setSelectedSalaryYear(new Date().getFullYear().toString());
    }
  }, [showAdjustmentModal, adjustmentRecord, setAdjustmentType, setPartialAdjustmentTime]);

  const selectedYear = adjustmentRecord?.date ? adjustmentRecord.date.substring(0, 4) : new Date().getFullYear().toString();
  const approvedRecords = useMemo(() => {
    return records.filter(r => r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear);
  }, [records, selectedYear]);
  const stats = useMemo(() => {
    return calculateStats(approvedRecords, targetProfile?.working_hours || 9.5);
  }, [approvedRecords, targetProfile?.working_hours]);

  // If reserve is disabled on profile and not admin, govt holiday remaining is 0
  const isReserveAllowed = isAdmin || (targetProfile ? targetProfile.allow_reserve !== false : true);

  const reservedCount = isReserveAllowed
    ? holidayResponses.filter((r: any) => r.user_id === adjustmentRecord?.user_id && r.response === 'reserve').length
    : 0;
  const govtHolidayRemaining = Math.max(0, reservedCount - (stats.govtHolidaysTaken ?? 0));

  // Find all reserved holiday responses for this user
  const userReserveResponses = useMemo(() => {
    if (!adjustmentRecord) return [];
    return (holidayResponses || []).filter(
      (hr: any) => hr.user_id === adjustmentRecord.user_id && hr.response === 'reserve'
    );
  }, [holidayResponses, adjustmentRecord]);

  // Find holidays that have already been consumed in approved leaves
  const consumedHolidayKeys = useMemo(() => {
    const consumed = new Set<string>();
    approvedRecords.forEach((r) => {
      if (r.id !== adjustmentRecord?.id && r.adjustment && r.reserve_holiday) {
        if (typeof r.reserve_holiday === 'string' && r.reserve_holiday.includes('—')) {
          consumed.add(r.reserve_holiday.trim());
        }
      }
    });
    return consumed;
  }, [approvedRecords, adjustmentRecord]);

  // Available reserve holidays
  const availableReserveHolidays = useMemo(() => {
    const list: Array<{ date: string; name: string }> = [];
    userReserveResponses.forEach((hr: any) => {
      const key = `${hr.holiday_date} — ${hr.holiday_name}`;
      if (!consumedHolidayKeys.has(key)) {
        list.push({
          date: hr.holiday_date,
          name: hr.holiday_name,
        });
      }
    });
    return list;
  }, [userReserveResponses, consumedHolidayKeys]);

  // Auto-select first available holiday if only one exists
  useEffect(() => {
    if (selectedCategory === 'Govt Holiday' && availableReserveHolidays.length > 0 && !selectedHolidayDate) {
      setSelectedHolidayDate(availableReserveHolidays[0].date);
      setSelectedHolidayName(availableReserveHolidays[0].name);
    }
  }, [selectedCategory, availableReserveHolidays, selectedHolidayDate]);

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

  // For Partial Leave (Short Leave, Early Leave, Late Join) adjustment calculations
  const isPartialLeave = adjustmentRecord && ['Short Leave', 'Early Leave', 'Late Join'].includes(adjustmentRecord.leave_type);
  const slMins = isPartialLeave
    ? parseIntervalToMinutes(adjustmentRecord.leave_hour)
    : 0;

  const parsedPartialTime = parseIntervalToMinutes(partialAdjustmentTime);
  const activeAdjustMins = adjustmentType === 'full'
    ? (selectedCategory === 'Overtime' ? Math.min(slMins, availableOvertimeMins) : slMins)
    : Math.min(parsedPartialTime, slMins);

  const monthOptions = useMemo(() => MONTH_NAMES.map(m => ({ value: m, label: m })), []);
  const yearOptions = useMemo(() => [
    { value: '2024', label: '2024' },
    { value: '2025', label: '2025' },
    { value: '2026', label: '2026' },
    { value: '2027', label: '2027' },
  ], []);

  const handleConfirm = () => {
    if (selectedCategory === 'Govt Holiday') {
      if (!selectedHolidayDate) {
        toast.error('Please select a Government Holiday.');
        return;
      }
      handleSaveAdjustment(
        undefined,
        'Govt Holiday',
        { date: selectedHolidayDate, name: selectedHolidayName },
        null,
        null
      );
    } else if (selectedCategory === 'Salary') {
      if (!selectedSalaryMonth) {
        toast.error('Please select a Salary Month.');
        return;
      }
      handleSaveAdjustment(
        undefined,
        'Salary',
        null,
        { month: selectedSalaryMonth, year: selectedSalaryYear },
        null
      );
    } else if (selectedCategory === 'None' && adjustmentRecord?.leave_type === 'Full Leave') {
      if (!generalAdjustmentReason.trim()) {
        toast.error('Please enter adjustment details / reason.');
        return;
      }
      handleSaveAdjustment(
        undefined,
        'General Adjustment',
        null,
        null,
        generalAdjustmentReason.trim()
      );
    } else {
      handleSaveAdjustment(undefined, selectedCategory);
    }
  };

  const isConfirmDisabled =
    submitting ||
    (selectedCategory === 'Govt Holiday' && !selectedHolidayDate) ||
    (selectedCategory === 'Salary' && !selectedSalaryMonth) ||
    (adjustmentRecord?.leave_type === 'Full Leave' && selectedCategory === 'None' && !generalAdjustmentReason.trim());

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
                    <span className="font-mono font-bold text-red-400">
                      {stats.shortHours}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-theme-border-muted text-xs">
                    <span className="text-theme-text-muted">Deduct from Short Leave:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      -{formatDuration(otDeductSLMins)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 text-xs">
                    <span className="text-theme-text-primary font-semibold">Remaining Short Leave:</span>
                    <span className="font-mono font-bold text-theme-text-primary">
                      {formatDuration(otRemainingSLMins)}
                    </span>
                  </div>
                  {otRemainingOTMins > 0 && (
                    <div className="flex justify-between items-center pt-1 text-xs">
                      <span className="text-amber-400 font-semibold">Remaining Excess Overtime:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatDuration(otRemainingOTMins)}
                      </span>
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
                  disabled={submitting || availableShortMins <= 0}
                  onClick={() => handleSaveAdjustment(true)}
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Applying...' : 'Confirm Deduction'}
                </button>
              </div>
            </div>
          ) : isPartialLeave ? (
            /* ========================================================================= */
            /* 2. PARTIAL LEAVE (SHORT LEAVE / EARLY LEAVE / LATE JOIN) ADJUSTMENT VIEW  */
            /* ========================================================================= */
            <div className="space-y-4 font-sans text-xs">
              <p className="text-xs text-theme-text-muted">
                Choose how you want to adjust this <strong className="text-theme-text-primary">{adjustmentRecord.leave_type}</strong> ({adjustmentRecord.leave_hour ? adjustmentRecord.leave_hour.toString().split('.')[0].substring(0, 5) : '00:00'} hrs).
              </p>

              {/* Leave Quota and Balance Summary Bar */}
              <div className="bg-theme-page-bg/40 border border-theme-border-muted p-3 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">
                  Available Balances for Deduction
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-theme-card-bg/50 p-2 rounded-lg border border-theme-border-muted">
                    <span className="text-theme-text-muted block text-[9px] uppercase font-bold">Overtime</span>
                    <span className="text-amber-400 font-bold font-mono">{stats.overtimeHours}</span>
                  </div>
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
                  {/* Overtime Deduction Option */}
                  {availableOvertimeMins > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('Overtime')}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        selectedCategory === 'Overtime'
                          ? 'bg-amber-955/30 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          : 'bg-theme-page-bg/20 border-theme-border-muted hover:bg-theme-border-muted/40 hover:border-theme-border-input'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-amber-400 block">Overtime</span>
                        <span className="text-[10px] text-theme-text-muted">{stats.overtimeHours} available</span>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedCategory === 'Overtime' ? 'border-amber-500' : 'border-theme-border-input'
                      }`}>
                        {selectedCategory === 'Overtime' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                      </div>
                    </button>
                  )}

                  {/* General / Partial Option */}
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
                      <span className="text-xs font-bold text-theme-text-primary block">General / Partial</span>
                      <span className="text-[10px] text-theme-text-muted">Custom time deduction</span>
                    </div>
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
              </div>

              {/* Govt Holiday Specific Selection */}
              {selectedCategory === 'Govt Holiday' && (
                <div className="space-y-2 p-3 bg-teal-955/20 border border-teal-500/40 rounded-xl">
                  <label className="block text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
                    Select Government Holiday Reserve
                  </label>
                  {availableReserveHolidays.length === 0 ? (
                    <div className="text-[11px] text-amber-400 py-1">
                      No unconsumed Government Holiday reserves found for this user.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {availableReserveHolidays.map((h) => {
                        const isSelected = selectedHolidayDate === h.date;
                        return (
                          <button
                            key={h.date}
                            type="button"
                            onClick={() => {
                              setSelectedHolidayDate(h.date);
                              setSelectedHolidayName(h.name);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-teal-600/30 border-teal-400 text-theme-text-primary'
                                : 'bg-theme-page-bg/40 border-theme-border-muted hover:border-teal-500/50 text-theme-text-secondary'
                            }`}
                          >
                            <span className="text-xs font-bold">
                              {formatDate(h.date)} — {h.name}
                            </span>
                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-teal-400 bg-teal-500' : 'border-theme-border-input'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Salary Month Selection */}
              {selectedCategory === 'Salary' && (
                <div className="space-y-2 p-3 bg-amber-955/20 border border-amber-500/40 rounded-xl">
                  <label className="block text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                    Select Salary Month & Year
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <CustomSelect
                      value={selectedSalaryMonth}
                      onChange={setSelectedSalaryMonth}
                      options={monthOptions}
                      className="w-full"
                    />
                    <CustomSelect
                      value={selectedSalaryYear}
                      onChange={setSelectedSalaryYear}
                      options={yearOptions}
                      className="w-full"
                    />
                  </div>
                  <p className="text-[11px] text-theme-text-muted mt-1">
                    Leave will be adjusted with <strong className="text-amber-400">{selectedSalaryMonth} {selectedSalaryYear}</strong> salary deduction.
                  </p>
                </div>
              )}

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
                      <span className="text-xs font-semibold text-theme-text-primary">Full Adjustment</span>
                    </label>
                    <label className="flex-1 flex items-center gap-2 p-2.5 bg-theme-card-bg/60 border border-theme-border-input rounded-lg cursor-pointer hover:border-theme-border-active transition-all">
                      <input
                        type="radio"
                        name="adjustmentType"
                        checked={adjustmentType === 'partial'}
                        onChange={() => setAdjustmentType('partial')}
                        className="text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-theme-text-primary">Partial Adjustment</span>
                    </label>
                  </div>

                  {adjustmentType === 'partial' && (
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[11px] font-semibold text-theme-text-muted">
                        Adjustment Time (HH:MM)
                      </label>
                      <input
                        type="text"
                        value={partialAdjustmentTime}
                        onChange={(e) => setPartialAdjustmentTime(e.target.value)}
                        placeholder="e.g. 01:30"
                        className="w-full px-3 py-2 bg-theme-page-bg/80 border border-theme-border-input rounded-lg text-xs font-mono font-bold text-theme-text-primary focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  {selectedCategory === 'Overtime' && (
                    <div className="pt-2 border-t border-theme-border-muted/60 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-theme-text-muted">Leave Duration:</span>
                        <span className="font-mono font-bold text-theme-text-primary">{formatDuration(slMins)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-theme-text-muted">Deduct from Overtime:</span>
                        <span className="font-mono font-bold text-amber-400">-{formatDuration(activeAdjustMins)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-semibold pt-1">
                        <span className="text-theme-text-primary">Remaining Overtime:</span>
                        <span className="font-mono font-bold text-theme-text-primary">
                          {formatDuration(Math.max(0, availableOvertimeMins - activeAdjustMins))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Review summary box */}
              {(selectedCategory === 'Govt Holiday' && selectedHolidayDate) || (selectedCategory === 'Salary' && selectedSalaryMonth) ? (
                <div className="p-3 bg-theme-page-bg/80 border border-theme-border-muted rounded-xl text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider">Adjustment Review</div>
                  <div className="flex justify-between text-theme-text-secondary">
                    <span>Leave Date:</span>
                    <span className="font-semibold text-theme-text-primary">{formatDate(adjustmentRecord.date)}</span>
                  </div>
                  <div className="flex justify-between text-theme-text-secondary">
                    <span>Adjust With:</span>
                    <span className="font-bold text-blue-400">
                      {selectedCategory === 'Govt Holiday' ? `Govt Holiday (${formatDate(selectedHolidayDate)} — ${selectedHolidayName})` : `${selectedSalaryMonth} ${selectedSalaryYear} Salary`}
                    </span>
                  </div>
                </div>
              ) : null}

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
                  disabled={isConfirmDisabled}
                  onClick={handleConfirm}
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Applying...' : selectedCategory === 'Salary' ? 'Confirm Salary Deduction' : 'Confirm Adjustment'}
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 3. FULL LEAVE ADJUSTMENT VIEW                                            */
            /* ========================================================================= */
            <div className="space-y-4 font-sans text-xs">
              <p className="text-xs text-theme-text-muted">
                Adjust this <strong className="text-theme-text-primary">Full Leave</strong> record for date <strong className="text-theme-text-primary">{formatDate(adjustmentRecord.date)}</strong> against an eligible leave quota or salary deduction.
              </p>

              {/* Leave Quota and Balance Summary Bar */}
              <div className="bg-theme-page-bg/40 border border-theme-border-muted p-3 rounded-xl space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">
                  Available Balances for Deduction
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
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

              {/* General Adjustment Details Input */}
              {selectedCategory === 'None' && (
                <div className="space-y-2 p-3.5 bg-blue-955/20 border border-blue-500/40 rounded-xl">
                  <label className="block text-[11px] font-semibold text-blue-300 uppercase tracking-wider">
                    Adjustment Details / Reason <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={generalAdjustmentReason}
                    onChange={(e) => setGeneralAdjustmentReason(e.target.value)}
                    placeholder="e.g. Adjusted against Govt Holiday, Date 15-08-2026 ..."
                    className="w-full p-2.5 bg-theme-page-bg/80 border border-theme-border-input rounded-xl text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none font-sans"
                    required
                  />
                  <p className="text-[11px] text-theme-text-muted">
                    This adjustment reason will be recorded in the full leave adjustment history.
                  </p>
                </div>
              )}

              {/* Govt Holiday Specific Selection */}
              {selectedCategory === 'Govt Holiday' && (
                <div className="space-y-2 p-3 bg-teal-955/20 border border-teal-500/40 rounded-xl">
                  <label className="block text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
                    Select Government Holiday Reserve
                  </label>
                  {availableReserveHolidays.length === 0 ? (
                    <div className="text-[11px] text-amber-400 py-1">
                      No unconsumed Government Holiday reserves found for this user.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {availableReserveHolidays.map((h) => {
                        const isSelected = selectedHolidayDate === h.date;
                        return (
                          <button
                            key={h.date}
                            type="button"
                            onClick={() => {
                              setSelectedHolidayDate(h.date);
                              setSelectedHolidayName(h.name);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-teal-600/30 border-teal-400 text-theme-text-primary'
                                : 'bg-theme-page-bg/40 border-theme-border-muted hover:border-teal-500/50 text-theme-text-secondary'
                            }`}
                          >
                            <span className="text-xs font-bold">
                              {formatDate(h.date)} — {h.name}
                            </span>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-teal-400 bg-teal-500' : 'border-theme-border-input'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Salary Month Selection */}
              {selectedCategory === 'Salary' && (
                <div className="space-y-2 p-3 bg-amber-955/20 border border-amber-500/40 rounded-xl">
                  <label className="block text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                    Select Salary Month & Year
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <CustomSelect
                      value={selectedSalaryMonth}
                      onChange={setSelectedSalaryMonth}
                      options={monthOptions}
                      className="w-full"
                    />
                    <CustomSelect
                      value={selectedSalaryYear}
                      onChange={setSelectedSalaryYear}
                      options={yearOptions}
                      className="w-full"
                    />
                  </div>
                  <p className="text-[11px] text-theme-text-muted mt-1">
                    Leave will be adjusted with <strong className="text-amber-400">{selectedSalaryMonth} {selectedSalaryYear}</strong> salary deduction.
                  </p>
                </div>
              )}

              {/* Review summary box */}
              {(selectedCategory === 'Govt Holiday' && selectedHolidayDate) || (selectedCategory === 'Salary' && selectedSalaryMonth) || (selectedCategory === 'None' && generalAdjustmentReason.trim()) ? (
                <div className="p-3 bg-theme-page-bg/80 border border-theme-border-muted rounded-xl text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold text-theme-text-muted tracking-wider">Adjustment Review</div>
                  <div className="flex justify-between text-theme-text-secondary">
                    <span>Leave Date:</span>
                    <span className="font-semibold text-theme-text-primary">{formatDate(adjustmentRecord.date)}</span>
                  </div>
                  <div className="flex justify-between text-theme-text-secondary">
                    <span>Adjust With:</span>
                    <span className="font-bold text-blue-400">
                      {selectedCategory === 'Govt Holiday'
                        ? `Govt Holiday (${formatDate(selectedHolidayDate)} — ${selectedHolidayName})`
                        : selectedCategory === 'Salary'
                        ? `${selectedSalaryMonth} ${selectedSalaryYear} Salary`
                        : `General Adjustment (${generalAdjustmentReason.trim()})`}
                    </span>
                  </div>
                </div>
              ) : null}

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
                  disabled={isConfirmDisabled}
                  onClick={handleConfirm}
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
