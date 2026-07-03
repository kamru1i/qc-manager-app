'use client';

import React, { useState } from 'react';
import { RotateCcw, CheckCircle2, AlertCircle, Send, BellOff, Edit3, HelpCircle, DollarSign, FolderPlus, ArrowRightLeft, Trash2, Download, X, RefreshCw } from 'lucide-react';
import { Profile, LeaveSettlement, GovtHolidayResponse } from '@/types';
import { sendPushNotification } from '@/utils/webPushHelper';
import { ChutiRecord } from '@/utils/offlineSync';
import { GlobalSettings, calculateStats, calculateHalfYearlyOfficeLeave, getSettlementSplits, getSettlementLabel, formatDaysAndHours } from '@/utils/dashboardHelpers';
import { AdminSettleUserModal } from './modals/AdminSettleUserModal';
import { toast } from 'react-hot-toast';
import { Modal } from './Modal';
import { CustomSelect } from './CustomSelect';
import { exportHelper } from '@/utils/exportHelper';
import { SkeletonLoader } from './SkeletonLoader';

interface AdminSettlementsPanelProps {
  profilesList: Profile[];
  selectedYear: string;
  records: ChutiRecord[];
  globalSettings: GlobalSettings;
  onSaveGlobalSettings: (settings: GlobalSettings, options?: { silent?: boolean }) => Promise<boolean>;
  leaveSettlements: LeaveSettlement[];
  holidayResponses: GovtHolidayResponse[];
  onSaveSettlementsBulk: (settlementsList: any[]) => Promise<boolean>;
  onDeleteSettlement: (id: string) => Promise<boolean>;
  currentUserProfile: Profile | null;
  initialFetchDone?: boolean;
}

export const calculateRemainingDaysForCategoryPeriod = (
  staff: Profile,
  period: 'H1' | 'H2' | 'Instant',
  category: 'Office Leave' | 'Govt Holiday' | 'Eid-ul-Fitr' | 'Eid-ul-Adha',
  selectedYear: string,
  records: ChutiRecord[],
  globalSettings: GlobalSettings,
  leaveSettlements: LeaveSettlement[],
  holidayResponses: GovtHolidayResponse[]
): number => {
  const staffRecords = records.filter(
    (r) => r.user_id === staff.id && r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear
  );
  const stats = calculateStats(staffRecords);
  const prevYear = (Number(selectedYear) - 1).toString();

  if (category === 'Office Leave') {
    const staffUserRecords = records.filter(r => r.user_id === staff.id);
    const halfYearlyStats = calculateHalfYearlyOfficeLeave(
      staffUserRecords,
      globalSettings.office_leave_h1,
      globalSettings.office_leave_h2,
      selectedYear,
      leaveSettlements,
      staff.id,
      period,
      staff.working_hours || 9.5
    );
    return period === 'H1' ? halfYearlyStats.h1Remaining : halfYearlyStats.h2Remaining;
  }

  if (category === 'Govt Holiday') {
    const carriedGovt = leaveSettlements
      .filter((s) => s.user_id === staff.id && s.year === prevYear && s.leave_category === 'Govt Holiday')
      .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

    const userGovtResponses = holidayResponses.filter(
      (r) => r.user_id === staff.id && r.response === 'reserve' && r.holiday_date.substring(0, 4) === selectedYear
    );
    const isGovtHolidayEligible = staff.eligible_govt_holiday !== false;
    return isGovtHolidayEligible
      ? Math.max(0, userGovtResponses.length + carriedGovt - (stats.govtHolidaysTaken ?? 0))
      : 0;
  }

  if (category === 'Eid-ul-Fitr') {
    const carriedEidFitr = leaveSettlements
      .filter((s) => s.user_id === staff.id && s.year === prevYear && s.leave_category === 'Eid-ul-Fitr')
      .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

    const eidFitrTotal = (globalSettings.eid_fitr_leave ?? 0) + carriedEidFitr;
    return Math.max(0, eidFitrTotal - (stats.eidFitrTaken ?? 0));
  }

  if (category === 'Eid-ul-Adha') {
    const carriedEidAdha = leaveSettlements
      .filter((s) => s.user_id === staff.id && s.year === prevYear && s.leave_category === 'Eid-ul-Adha')
      .reduce((acc, s) => acc + getSettlementSplits(s).carry_forward, 0);

    const eidAdhaTotal = (globalSettings.eid_adha_leave ?? 0) + carriedEidAdha;
    return Math.max(0, eidAdhaTotal - (stats.eidAdhaTaken ?? 0));
  }

  return 0;
};

export const AdminSettlementsPanel: React.FC<AdminSettlementsPanelProps> = ({
  profilesList,
  selectedYear,
  records,
  globalSettings,
  onSaveGlobalSettings,
  leaveSettlements,
  holidayResponses,
  onSaveSettlementsBulk,
  onDeleteSettlement,
  currentUserProfile,
  initialFetchDone = true,
}) => {
  const [activeSettleStaff, setActiveSettleStaff] = useState<Profile | null>(null);
  const [activeSettleRecord, setActiveSettleRecord] = useState<LeaveSettlement | null>(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementToDelete, setSettlementToDelete] = useState<string | null>(null);

  // Filters for Category and Period
  const [selectedPeriod, setSelectedPeriod] = useState<'H1' | 'H2' | 'Instant'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('settlementSelectedPeriod');
      if (saved === 'H1' || saved === 'H2' || saved === 'Instant') {
        return saved;
      }
    }
    const currentMonth = new Date().getMonth(); // 0-indexed: 0 = Jan, 5 = Jun, 6 = Jul
    return currentMonth >= 6 ? 'H2' : 'H1';
  });
  const [selectedCategory, setSelectedCategory] = useState<'Office Leave' | 'Govt Holiday' | 'Eid-ul-Fitr' | 'Eid-ul-Adha'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('settlementSelectedCategory');
      if (saved === 'Office Leave' || saved === 'Govt Holiday' || saved === 'Eid-ul-Fitr' || saved === 'Eid-ul-Adha') {
        return saved as any;
      }
    }
    return 'Office Leave';
  });

  React.useEffect(() => {
    sessionStorage.setItem('settlementSelectedPeriod', selectedPeriod);
  }, [selectedPeriod]);

  React.useEffect(() => {
    sessionStorage.setItem('settlementSelectedCategory', selectedCategory);
  }, [selectedCategory]);

  const [initiatingId, setInitiatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Include all active profiles including admins and supervisors
  const staffProfiles = profilesList;

  const isBroadcastActive = globalSettings.settlement_active_year === selectedYear &&
    globalSettings.settlement_active_period === selectedPeriod &&
    globalSettings.settlement_active_category === selectedCategory;

  const isAnyBroadcastActive = !!globalSettings.settlement_active_year;

  const handleToggleBroadcast = async () => {
    if (!isBroadcastActive && !hasEligibleStaffForBroadcast) {
      toast.error("No staff with unused leaves or outstanding deficits found for this period and category!");
      return;
    }

    const nextSettings = {
      ...globalSettings,
      settlement_active_year: isBroadcastActive ? null : selectedYear,
      settlement_active_period: isBroadcastActive ? null : selectedPeriod,
      settlement_active_category: isBroadcastActive ? null : selectedCategory,
    };
    const success = await onSaveGlobalSettings(nextSettings, { silent: true });
    if (success) {
      const periodLabel = selectedPeriod === 'H1' ? 'January-June (H1)' : selectedPeriod === 'H2' ? 'July-December (H2)' : 'Instant';
      toast.success(
        isBroadcastActive
          ? `Settlement broadcast deactivated for ${selectedYear}!`
          : `Settlement broadcast activated: ${selectedCategory} (${periodLabel}) for ${selectedYear}! Relevant staff will see notification banners.`
      );

      if (!isBroadcastActive) {
        // Send Web Push notification to all eligible staff (non-zero balance and not processed yet)
        const targetStaff = staffProfiles.filter((staff) => {
          const remaining = getRemainingDaysForCategoryPeriod(staff, selectedPeriod, selectedCategory);
          const settlement = leaveSettlements.find(
            (s) =>
              s.user_id === staff.id &&
              s.year === selectedYear &&
              s.period === selectedPeriod &&
              s.leave_category === selectedCategory
          );
          const isProcessed = settlement?.status === 'processed';
          return Math.abs(remaining) > 0.01 && !isProcessed;
        });

        if (targetStaff.length > 0) {
          try {
            const userIds = targetStaff.map(s => s.id);
            await sendPushNotification({
              userIds,
              title: 'Leave Settlement Preference Required 📣',
              body: `Admin activated preference review for ${selectedCategory} (${periodLabel}) of ${selectedYear}. Please submit your choices.`,
              url: '/'
            });
          } catch (err) {
            console.error('Error sending push notification to users:', err);
          }
        }
      }
    }
  };

  const getRemainingDaysForCategoryPeriod = React.useCallback((
    staff: Profile,
    period: 'H1' | 'H2' | 'Instant',
    category: 'Office Leave' | 'Govt Holiday' | 'Eid-ul-Fitr' | 'Eid-ul-Adha'
  ): number => {
    return calculateRemainingDaysForCategoryPeriod(
      staff,
      period,
      category,
      selectedYear,
      records,
      globalSettings,
      leaveSettlements,
      holidayResponses
    );
  }, [selectedYear, records, globalSettings, leaveSettlements, holidayResponses]);

  const hasEligibleStaffForBroadcast = React.useMemo(() => {
    return staffProfiles.some((staff) => {
      const remaining = getRemainingDaysForCategoryPeriod(staff, selectedPeriod, selectedCategory);
      const settlement = leaveSettlements.find(
        (s) =>
          s.user_id === staff.id &&
          s.year === selectedYear &&
          s.period === selectedPeriod &&
          s.leave_category === selectedCategory
      );
      const isProcessed = settlement?.status === 'processed';
      return Math.abs(remaining) > 0.01 && !isProcessed;
    });
  }, [staffProfiles, selectedPeriod, selectedCategory, selectedYear, leaveSettlements, records, globalSettings, holidayResponses]);

  const filteredStaff = React.useMemo(() => {
    return staffProfiles.filter((staff) => {
      const remaining = getRemainingDaysForCategoryPeriod(staff, selectedPeriod, selectedCategory);
      const settlement = leaveSettlements.find(
        (s) =>
          s.user_id === staff.id &&
          s.year === selectedYear &&
          s.period === selectedPeriod &&
          s.leave_category === selectedCategory
      );

      const matchesSearch =
        staff.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (staff.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());

      const showEvenIfZero = searchQuery.trim() !== '';
      return (Math.abs(remaining) > 0 || !!settlement || showEvenIfZero) && matchesSearch;
    });
  }, [staffProfiles, selectedPeriod, selectedCategory, selectedYear, leaveSettlements, searchQuery, records, globalSettings, holidayResponses]);

  const getSettlementsExportData = () => {
    return filteredStaff.map(staff => {
      const remaining = getRemainingDaysForCategoryPeriod(staff, selectedPeriod, selectedCategory);
      const settlement = leaveSettlements.find(
        (s) =>
          s.user_id === staff.id &&
          s.year === selectedYear &&
          s.period === selectedPeriod &&
          s.leave_category === selectedCategory
      );

      let actionLabel = 'Not chosen yet';
      if (settlement && settlement.status !== 'initiated') {
        actionLabel = getSettlementLabel(settlement, staff.working_hours || 9.5);
      }

      return {
        staffName: staff.full_name || staff.username,
        username: staff.username,
        category: selectedCategory,
        period: selectedPeriod,
        year: selectedYear,
        remainingDays: remaining,
        actionLabel,
        status: settlement ? settlement.status : 'not initiated',
      };
    });
  };

  const handleExportExcel = () => {
    const data = getSettlementsExportData();
    const periodLabel = selectedPeriod === 'H1' ? 'January-June (H1)' : selectedPeriod === 'H2' ? 'July-December (H2)' : 'Instant Review';
    exportHelper.exportSettlementsExcel(
      data,
      selectedYear,
      periodLabel,
      selectedCategory,
      () => toast.success('Settlement data exported to Excel!'),
      (msg) => toast.error(msg)
    );
  };

  const handleExportPDF = () => {
    const data = getSettlementsExportData();
    const periodLabel = selectedPeriod === 'H1' ? 'January-June (H1)' : selectedPeriod === 'H2' ? 'July-December (H2)' : 'Instant Review';
    exportHelper.exportSettlementsPDF(
      data,
      selectedYear,
      periodLabel,
      selectedCategory,
      () => toast.success('Settlement data exported to PDF!'),
      (msg) => toast.error(msg)
    );
  };

  const handleInitiatePreferenceRequest = async (staff: Profile, remaining: number) => {
    setInitiatingId(staff.id);
    const newRecord = {
      user_id: staff.id,
      year: selectedYear,
      period: selectedPeriod,
      leave_category: selectedCategory,
      remaining_days: remaining,
      action_type: 'carry_forward' as const, // Default preference action
      status: 'initiated' as const,
      action_by: currentUserProfile?.id || undefined,
    };

    const success = await onSaveSettlementsBulk([newRecord]);
    setInitiatingId(null);
    if (success) {
      toast.success(`Preference review request initiated for ${staff.full_name || staff.username}!`);
    }
  };

  const handleRemoveSettlement = (id: string) => {
    setSettlementToDelete(id);
  };

  const periodOptions = [
    { value: 'H1', label: 'January-June (H1)' },
    { value: 'H2', label: 'July-December (H2)' },
    { value: 'Instant', label: 'Instant Review' }
  ];

  const categoryOptions = React.useMemo(() => {
    return selectedPeriod === 'Instant'
      ? [
        { value: 'Govt Holiday', label: 'Govt Holiday' },
        { value: 'Eid-ul-Fitr', label: 'Eid-ul-Fitr' },
        { value: 'Eid-ul-Adha', label: 'Eid-ul-Adha' },
      ]
      : [
        { value: 'Office Leave', label: 'Office Leave' },
      ];
  }, [selectedPeriod]);

  return (
    <div className="bg-slate-900/40 border border-slate-900 shadow-2xl rounded-2xl overflow-hidden flex flex-col animate-fade-in font-sans text-xs">
      {/* Top Controller Header */}
      <div className="px-6 py-5 border-b border-slate-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-955/20">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-blue-500" />
            Unified Leave Review & Settlements ({selectedYear})
          </h3>
          <p className="text-slate-400 text-[11px] mt-1">
            Initiate preference requests and process cash outs, leave adjustments, or carry forwards.
          </p>
        </div>

        {/* Export Excel and PDF Buttons */}
        <div className="flex gap-2.5 shrink-0">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-500 hover:bg-emerald-600/10 dark:hover:bg-emerald-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 hover:bg-red-600/10 dark:hover:bg-red-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>      {/* Select Period, Category, Search, and Broadcast row */}
      <div className="px-6 py-4 bg-slate-955/20 border-b border-slate-850/60 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4 items-center flex-1">
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Review Period</span>
            <CustomSelect
              value={selectedPeriod}
              onChange={(val) => {
                const periodVal = val as 'H1' | 'H2' | 'Instant';
                setSelectedPeriod(periodVal);
                if (periodVal === 'Instant') {
                  if (selectedCategory === 'Office Leave') {
                    setSelectedCategory('Govt Holiday');
                  }
                } else {
                  if (selectedCategory !== 'Office Leave') {
                    setSelectedCategory('Office Leave');
                  }
                }
              }}
              options={periodOptions}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Leave Category</span>
            <CustomSelect
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val as any)}
              options={categoryOptions}
              className="w-full"
            />
          </div>

          {/* Search Box */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Staff</span>
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search name or codename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-955/80 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 w-full transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-350 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Broadcast Trigger Button + Active Status */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 self-start md:self-end">
          <div className="flex flex-wrap gap-2.5 justify-end">
            <button
              onClick={handleToggleBroadcast}
              disabled={!isBroadcastActive && !hasEligibleStaffForBroadcast}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 ${isBroadcastActive
                  ? 'bg-purple-600/10 border border-purple-500/30 text-purple-400 hover:bg-purple-600/20'
                  : !hasEligibleStaffForBroadcast
                    ? 'bg-slate-800/40 border border-slate-700/60 text-slate-500 cursor-not-allowed opacity-50'
                    : 'bg-indigo-600 border border-indigo-500 text-white hover:bg-indigo-500'
                }`}
            >
              {isBroadcastActive ? (
                <>
                  <BellOff className="h-4 w-4" />
                  <span>Deactivate Broadcast</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 animate-bounce" />
                  <span>Broadcast: {selectedCategory} ({selectedPeriod})</span>
                </>
              )}
            </button>
          </div>
          {/* Show active broadcast info if different from current dropdown */}
          {isAnyBroadcastActive && !isBroadcastActive && (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-950/20 border border-emerald-900/40 rounded-lg text-[9px] text-emerald-400 font-semibold max-w-[280px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate">Active: {globalSettings.settlement_active_category} ({globalSettings.settlement_active_period})</span>
              <button
                onClick={async () => {
                  const success = await onSaveGlobalSettings({
                    ...globalSettings,
                    settlement_active_year: null,
                    settlement_active_period: null,
                    settlement_active_category: null,
                  }, { silent: true });
                  if (success) toast.success('Settlement broadcast deactivated!');
                }}
                className="ml-1 text-purple-400 hover:text-purple-300 underline cursor-pointer shrink-0"
              >
                Deactivate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      {!initialFetchDone ? (
        <SkeletonLoader variant="settlements-table" rows={5} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-955/60">
              <tr>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Staff member</th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unused Balance</th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">User Preference</th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-900/10">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500 font-medium bg-slate-900/5">
                    All matching profiles settled or no unused leaves available.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const remaining = getRemainingDaysForCategoryPeriod(staff, selectedPeriod, selectedCategory);

                  // Find matching settlement record
                  const settlement = leaveSettlements.find(
                    (s) =>
                      s.user_id === staff.id &&
                      s.year === selectedYear &&
                      s.period === selectedPeriod &&
                      s.leave_category === selectedCategory
                  );

                  return (
                    <tr key={staff.id} className="hover:bg-slate-900/30 transition-all">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-white text-sm">{staff.full_name || '-'}</div>
                        <div className="text-[10px] text-slate-455 font-mono mt-0.5 uppercase tracking-wide">
                          {staff.username} • {staff.job_role || (staff.role === 'supervisor' ? 'Supervisor' : 'Staff')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const totalMins = Math.round(remaining * (staff.working_hours || 9.5) * 60);
                          const isNegative = totalMins < 0;
                          const absMins = Math.abs(totalMins);
                          
                          const minutesPerDay = Math.round((staff.working_hours || 9.5) * 60);
                          const wholeDays = Math.floor(absMins / minutesPerDay);
                          const remainingMins = absMins % minutesPerDay;
                          const hours = Math.floor(remainingMins / 60);
                          const mins = remainingMins % 60;
                          
                          const sign = isNegative ? '-' : '';
                          const dayStr = `${sign}${wholeDays} Day${wholeDays !== 1 ? 's' : ''}`;
                          const timeStr = `${sign}${hours}:${mins.toString().padStart(2, '0')} Hrs`;
                          
                          const dayColor = isNegative ? 'text-red-500 font-extrabold' : 'text-blue-400';
                          
                          return (
                            <div className="flex flex-col font-mono select-none">
                              <span className={`text-sm font-bold ${dayColor}`}>
                                {dayStr}
                              </span>
                              {(hours > 0 || mins > 0) && (
                                <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">
                                  {timeStr}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="px-6 py-4">
                        {!settlement || settlement.status === 'initiated' ? (
                          <span className="text-slate-500 italic text-[11px]">Not chosen yet</span>
                        ) : settlement.action_type === 'split' ? (
                          <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                            {(settlement.carry_forward_days && settlement.carry_forward_days > 0) ? (
                              <span className="px-1.5 py-0.5 rounded border text-[9px] font-semibold flex items-center gap-1 bg-indigo-955/20 border-indigo-900/60 text-indigo-400">
                                <FolderPlus className="h-2.5 w-2.5" /> {settlement.carry_forward_days}d Carry Forward
                              </span>
                            ) : null}
                            {(settlement.payment_days && settlement.payment_days > 0) ? (
                              <span className="px-1.5 py-0.5 rounded border text-[9px] font-semibold flex items-center gap-1 bg-emerald-950/20 border-emerald-900/60 text-emerald-400">
                                <DollarSign className="h-2.5 w-2.5" /> {settlement.payment_days}d Cash Out
                              </span>
                            ) : null}
                            {(settlement.adjust_leave_days && settlement.adjust_leave_days > 0) ? (
                              <span className="px-1.5 py-0.5 rounded border text-[9px] font-semibold flex items-center gap-1 bg-purple-955/20 border-purple-900/60 text-purple-400">
                                <ArrowRightLeft className="h-2.5 w-2.5" /> {settlement.adjust_leave_days}d Adjust
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded border text-[10px] font-semibold flex items-center gap-1.5 w-fit ${settlement.remaining_days < 0
                                ? settlement.action_type === 'carry_forward'
                                  ? 'bg-indigo-955/20 border-indigo-900/60 text-indigo-400'
                                  : settlement.action_type === 'adjust_leave'
                                    ? 'bg-teal-955/20 border-teal-900/60 text-teal-400'
                                    : 'bg-rose-955/20 border-rose-900/60 text-rose-400'
                                : settlement.action_type === 'carry_forward'
                                  ? 'bg-indigo-955/20 border-indigo-900/60 text-indigo-400'
                                  : settlement.action_type === 'payment'
                                    ? 'bg-teal-955/20 border-teal-900/60 text-teal-400'
                                    : 'bg-purple-955/20 border-purple-900/60 text-purple-400'
                              }`}
                          >
                            {settlement.remaining_days < 0 ? (
                              settlement.action_type === 'carry_forward' ? (
                                <>
                                  <FolderPlus className="h-3 w-3" />{' '}
                                  {settlement.period === 'H1'
                                    ? 'Adjust with H2 Office Leave'
                                    : "Adjust with Next Year's H1"}
                                </>
                              ) : settlement.action_type === 'adjust_leave' ? (
                                <>
                                  <ArrowRightLeft className="h-3 w-3" /> Adjust with Holiday/Eid Reserve
                                </>
                              ) : (
                                <>
                                  <DollarSign className="h-3 w-3" /> Salary Deduction
                                </>
                              )
                            ) : settlement.action_type === 'carry_forward' ? (
                              <>
                                <FolderPlus className="h-3 w-3" /> Carry Forward
                              </>
                            ) : settlement.action_type === 'payment' ? (
                              <>
                                <DollarSign className="h-3 w-3" /> Cash Payment
                              </>
                            ) : (
                              <>
                                <ArrowRightLeft className="h-3 w-3" /> Adjust Leaves
                              </>
                            )}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {!settlement ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded font-semibold text-[10px] ${remaining < 0
                              ? 'bg-rose-955/25 border-rose-900/40 text-rose-455'
                              : 'bg-slate-955 border border-slate-800 text-slate-500'
                            }`}>
                            {remaining < 0 ? 'Outstanding Unpaid' : 'Not Initiated'}
                          </span>
                        ) : settlement.status === 'initiated' ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded font-semibold text-[10px] animate-pulse ${remaining < 0
                              ? 'bg-rose-955/25 border-rose-900/40 text-rose-455'
                              : 'bg-purple-955/25 border-purple-900/40 text-purple-400'
                            }`}>
                            <AlertCircle className="h-3 w-3" /> Preference Pending
                          </span>
                        ) : settlement.status === 'responded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-955/25 border border-indigo-900/40 text-indigo-400 rounded font-semibold text-[10px]">
                            <HelpCircle className="h-3 w-3" /> Preference Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 rounded font-semibold text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> Processed
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end items-center gap-2">
                        {!settlement ? (
                          <>
                            {Math.abs(remaining) > 0.01 && (
                              <button
                                type="button"
                                disabled={initiatingId === staff.id}
                                onClick={() => handleInitiatePreferenceRequest(staff, remaining)}
                                title="Ask for Preference"
                                className="p-2 bg-indigo-650/15 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl border border-indigo-500/20 disabled:bg-slate-900/40 disabled:border-slate-855 disabled:text-slate-600 transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={initiatingId === staff.id}
                              onClick={() => {
                                const mockSettlement: LeaveSettlement = {
                                  id: undefined as any,
                                  user_id: staff.id,
                                  year: selectedYear,
                                  period: selectedPeriod,
                                  leave_category: selectedCategory,
                                  remaining_days: remaining,
                                  action_type: 'carry_forward',
                                  status: 'initiated',
                                  processed_by: null,
                                  processed_at: null,
                                  action_by: staff.id,
                                  created_at: new Date().toISOString()
                                };
                                setActiveSettleStaff(staff);
                                setActiveSettleRecord(mockSettlement);
                                setShowSettleModal(true);
                              }}
                              title={remaining < 0 ? "Settle Unpaid/Deduction" : "Direct Settle"}
                              className={`p-2 rounded-xl border transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center ${remaining < 0
                                  ? 'bg-rose-655/15 hover:bg-rose-600 text-rose-400 hover:text-white border-rose-500/20'
                                  : 'bg-blue-655/15 hover:bg-blue-655 text-blue-400 hover:text-white border-blue-500/20'
                                }`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {settlement.status === 'processed' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSettleStaff(staff);
                                  setActiveSettleRecord({
                                    ...settlement,
                                    remaining_days: remaining
                                  });
                                  setShowSettleModal(true);
                                }}
                                title="Re-process"
                                className="p-2 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/50 transition-all cursor-pointer flex items-center justify-center"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSettleStaff(staff);
                                  setActiveSettleRecord({
                                    ...settlement,
                                    remaining_days: remaining
                                  });
                                  setShowSettleModal(true);
                                }}
                                title="Settle Leaves"
                                className="p-2 bg-blue-655/15 hover:bg-blue-655 text-blue-400 hover:text-white rounded-xl border border-blue-500/20 transition-all cursor-pointer flex items-center justify-center"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveSettlement(settlement.id)}
                              title="Remove Settlement"
                              className="p-2 bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Settle User Modal */}
      {showSettleModal && activeSettleStaff && activeSettleRecord && (
        <AdminSettleUserModal
          showModal={showSettleModal}
          setShowModal={setShowSettleModal}
          staff={activeSettleStaff}
          settlement={activeSettleRecord}
          onSaveSettlementsBulk={onSaveSettlementsBulk}
          currentUserProfile={currentUserProfile}
          globalSettings={globalSettings}
          records={records}
          leaveSettlements={leaveSettlements}
          holidayResponses={holidayResponses}
        />
      )}

      {settlementToDelete !== null && (
        <Modal
          isOpen={settlementToDelete !== null}
          onClose={() => setSettlementToDelete(null)}
          title="Confirm Removal"
          icon={<AlertCircle className="h-5 w-5 text-rose-500 animate-pulse" />}
          maxWidthClass="max-w-md"
          glowClass="bg-rose-900/10"
        >
          <div className="space-y-4 font-sans text-xs text-slate-350">
            <p className="text-slate-200 leading-relaxed text-left">
              Are you sure you want to remove this settlement record? This will revert the user's status back to <span className="font-semibold text-slate-400">Not Initiated</span>.
            </p>
            <div className="flex gap-3 pt-4 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setSettlementToDelete(null)}
                className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-900 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = settlementToDelete;
                  setSettlementToDelete(null);
                  await onDeleteSettlement(id);
                }}
                className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer transition-all"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
