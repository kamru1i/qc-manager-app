import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Calendar, History, Info, Edit, RefreshCw, AlertTriangle } from 'lucide-react';
import { StatCard } from './StatCard';
import { formatDate, HalfYearlyOfficeLeaveStats, formatDaysAndHours } from '@/utils/dashboardHelpers';

interface UserStatsProps {
  stats: {
    shortHours: string | number;
    fullLeaves: string | number;
    overtimeHours: string | number;
  };
  officeLeaveStats?: {
    total: number;
    taken: number;
    remaining: number;
  };
  govtHolidayStats?: {
    total: number;
    taken: number;
    reserved: number;
    paid: number;
    remaining: number;
  };
  allowOvertime?: boolean;
  respondedHolidays?: { date: string; name: string; response: string }[];
  eligibleOfficeLeave?: boolean;
  eligibleGovtHoliday?: boolean;
  halfYearlyStats?: HalfYearlyOfficeLeaveStats;

  // Conversion props
  convertedDays?: number;
  convertedHours?: number;
  onConvertToFullLeave?: () => void;
  hasConvertibleHours?: boolean;

  // Admin Response Update props
  isAdmin?: boolean;
  userId?: string;
  onUpdateHolidayResponse?: (targetUserId: string, holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => Promise<boolean>;

  // Eid Holiday props
  eidFitrRemaining?: number;
  eidFitrTotal?: number;
  eidAdhaRemaining?: number;
  eidAdhaTotal?: number;
  initialFetchDone?: boolean;
  workingHours?: number;
}

const renderTwoLineLeave = (daysVal: number, workingHours: number, showSign: boolean = false, customColorClass?: string) => {
  const isNeg = daysVal < 0;
  const absDays = Math.abs(daysVal);
  const totalMins = Math.round(absDays * workingHours * 60);
  const minutesPerDay = Math.round(workingHours * 60);
  
  const d = Math.floor(totalMins / minutesPerDay);
  const remainingMins = totalMins % minutesPerDay;
  const h = Math.floor(remainingMins / 60);
  const m = remainingMins % 60;

  const sign = isNeg ? '- ' : (showSign ? '+ ' : '');
  const padMin = m.toString().padStart(2, '0');
  
  const line1 = `${sign}${d} Days`;
  const line2 = `${sign}${h}:${padMin} Hrs`;

  const colorClass = customColorClass || (isNeg ? 'text-rose-400' : 'text-slate-200');

  return (
    <div className="flex flex-col items-center text-center mt-1">
      <span className={`${colorClass} font-bold font-mono text-[11px] block`}>{line1}</span>
      <span className="text-slate-500 font-medium font-mono text-[10px] block mt-0.5">{line2}</span>
    </div>
  );
};

export const UserStats: React.FC<UserStatsProps> = ({
  stats,
  officeLeaveStats,
  govtHolidayStats,
  allowOvertime,
  respondedHolidays = [],
  eligibleOfficeLeave = true,
  eligibleGovtHoliday = true,
  halfYearlyStats,
  convertedDays = 0,
  convertedHours = 0,
  onConvertToFullLeave,
  hasConvertibleHours = false,
  isAdmin = false,
  userId,
  onUpdateHolidayResponse,
  eidFitrRemaining = 0,
  eidFitrTotal = 0,
  eidAdhaRemaining = 0,
  eidAdhaTotal = 0,
  initialFetchDone = true,
  workingHours = 9.5,
}) => {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showOfficeDetailsModal, setShowOfficeDetailsModal] = useState(false);
  const [updatingHolidayDate, setUpdatingHolidayDate] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Edit preference modal states
  const [showEditPrefModal, setShowEditPrefModal] = useState(false);
  const [editPrefHoliday, setEditPrefHoliday] = useState<{ date: string; name: string; response: string } | null>(null);
  const [selectedPref, setSelectedPref] = useState<'reserve' | 'paid'>('reserve');

  const handleEditHolidayResponse = async (holidayDate: string, holidayName: string, currentResponse: string) => {
    if (!userId || !onUpdateHolidayResponse) return;
    setEditPrefHoliday({ date: holidayDate, name: holidayName, response: currentResponse });
    setSelectedPref(currentResponse as 'reserve' | 'paid');
    setShowEditPrefModal(true);
  };

  const handleSavePref = async () => {
    if (!userId || !onUpdateHolidayResponse || !editPrefHoliday) return;

    // If selected preference is the same as current, close immediately without any changes
    if (selectedPref === editPrefHoliday.response) {
      setShowEditPrefModal(false);
      setEditPrefHoliday(null);
      return;
    }

    setUpdatingHolidayDate(editPrefHoliday.date);
    try {
      await onUpdateHolidayResponse(userId, editPrefHoliday.date, editPrefHoliday.name, selectedPref);
    } catch (err) {
      console.error('Failed to update holiday response:', err);
    } finally {
      setUpdatingHolidayDate(null);
      setShowEditPrefModal(false);
      setEditPrefHoliday(null);
    }
  };

  // ESC key handler for inline modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHistoryModal) setShowHistoryModal(false);
        if (showOfficeDetailsModal) setShowOfficeDetailsModal(false);
        if (showEditPrefModal) {
          setShowEditPrefModal(false);
          setEditPrefHoliday(null);
        }
      }
    };
    if (showHistoryModal || showOfficeDetailsModal || showEditPrefModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHistoryModal, showOfficeDetailsModal, showEditPrefModal]);

  // Office leave display determinations based on half-yearly split
  const showOfficeCard = !!officeLeaveStats;
  const showGovtCard = eligibleGovtHoliday !== false && govtHolidayStats;

  const h1Carryover = halfYearlyStats ? halfYearlyStats.h1Total - halfYearlyStats.h1Base : 0;
  const hasH1Carryover = h1Carryover > 0;
  const hasH2Carryover = halfYearlyStats ? halfYearlyStats.carryForward > 0 : false;

  const formatDaysAndHoursNode = (daysVal: number, workingHours: number = 9.5) => {
    const totalMins = Math.round(daysVal * workingHours * 60);
    const isNegative = totalMins < 0;
    const absMins = Math.abs(totalMins);
    
    const minutesPerDay = Math.round(workingHours * 60);
    const wholeDays = Math.floor(absMins / minutesPerDay);
    const remainingMins = absMins % minutesPerDay;
    const hours = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;
    
    const dayStr = `${wholeDays} Day${wholeDays !== 1 ? 's' : ''}`;
    
    const hrPart = hours > 0 ? `${String(hours).padStart(2, '0')} hr${hours > 1 ? 's' : ''}` : '';
    const minPart = mins > 0 ? `${String(mins).padStart(2, '0')} min${mins > 1 ? 's' : ''}` : '';
    const timeParts = [hrPart, minPart].filter(Boolean).join(' ');
    
    return (
      <div className="flex flex-col select-none">
        <span className="text-2xl font-bold text-white leading-tight">
          {isNegative ? '-' : ''}{dayStr}
        </span>
        {timeParts && (
          <span className="text-sm font-semibold font-mono text-slate-300 mt-0.5 block">
            {timeParts}
          </span>
        )}
      </div>
    );
  };

  let officeRemainingDisplay: React.ReactNode = officeLeaveStats ? formatDaysAndHoursNode(officeLeaveStats.remaining, workingHours) : '0 Days';
  let officeSubtitle = officeLeaveStats ? `Total Allocated: ${formatDaysAndHours(officeLeaveStats.total, workingHours)} (Taken: ${formatDaysAndHours(officeLeaveStats.taken, workingHours)})` : '';

  if (halfYearlyStats) {
    const isH1 = halfYearlyStats.currentHalf === 1;
    officeRemainingDisplay = isH1
      ? formatDaysAndHoursNode(halfYearlyStats.h1Remaining, workingHours)
      : formatDaysAndHoursNode(halfYearlyStats.h2Remaining, workingHours);

    officeSubtitle = isH1
      ? (hasH1Carryover
          ? `H1 (Jan-Jun) Allocated: ${formatDaysAndHours(halfYearlyStats.h1Base, workingHours)} + ${formatDaysAndHours(h1Carryover, workingHours)} Carryover | Taken: ${formatDaysAndHours(halfYearlyStats.h1Taken, workingHours)}`
          : `H1 (Jan-Jun) Allocated: ${formatDaysAndHours(halfYearlyStats.h1Total, workingHours)} | Taken: ${formatDaysAndHours(halfYearlyStats.h1Taken, workingHours)}`)
      : (hasH2Carryover
          ? `H2 (Jul-Dec) Allocated: ${formatDaysAndHours(halfYearlyStats.h2Base, workingHours)} + ${formatDaysAndHours(halfYearlyStats.carryForward, workingHours)} Carryover | Taken: ${formatDaysAndHours(halfYearlyStats.h2Taken, workingHours)}`
          : `H2 (Jul-Dec) Allocated: ${formatDaysAndHours(halfYearlyStats.h2Total, workingHours)} | Taken: ${formatDaysAndHours(halfYearlyStats.h2Taken, workingHours)}`);
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Line 1: Primary Leaves (Allocated Office, Govt Holidays, and Eid Holidays) */}
      <div className="flex flex-wrap justify-center gap-4 w-full">
        {/* Office Leave */}
        {showOfficeCard && officeLeaveStats && (
          <StatCard
            icon={Calendar}
            iconBgClass="bg-blue-500/10"
            iconColorClass="text-blue-400"
            iconBorderClass="border-blue-500/20"
            title={halfYearlyStats ? `Allocated Office Leave (H${halfYearlyStats.currentHalf})` : "Allocated Office Leave"}
            value={officeRemainingDisplay}
            subtitle={officeSubtitle}
            action={halfYearlyStats ? (
              <button
                type="button"
                onClick={() => setShowOfficeDetailsModal(true)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-lg cursor-pointer transition-all shadow-sm flex items-center justify-center shrink-0"
                title="Half-Yearly Leave Account"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            ) : undefined}
            loading={!initialFetchDone}
          />
        )}

        {/* Govt Holiday */}
        {showGovtCard && govtHolidayStats && (
          <StatCard
            icon={Calendar}
            iconBgClass="bg-teal-500/10"
            iconColorClass="text-teal-400"
            iconBorderClass="border-teal-500/20"
            title="Govt Holiday (Reserve)"
            value={`${govtHolidayStats.remaining} days`}
            subtitle={`Total Govt Holiday: ${govtHolidayStats.total} days | Paid: ${govtHolidayStats.paid} days | Reserve: ${govtHolidayStats.reserved} days | Taken: ${govtHolidayStats.taken} days`}
            action={respondedHolidays && respondedHolidays.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 rounded-lg cursor-pointer transition-all shadow-sm flex items-center justify-center shrink-0"
                title="Govt Holiday Response History"
              >
                <History className="h-3.5 w-3.5" />
              </button>
            ) : undefined}
            loading={!initialFetchDone}
          />
        )}

        {/* Eid-ul-Fitr */}
        {eidFitrRemaining > 0 && (
          <StatCard
            icon={Calendar}
            iconBgClass="bg-purple-500/10"
            iconColorClass="text-purple-400"
            iconBorderClass="border-purple-500/20"
            title="Eid-ul-Fitr Holiday (Remaining)"
            value={`${eidFitrRemaining} days`}
            subtitle={`Total Eid-ul-Fitr Holiday: ${eidFitrTotal} days`}
            loading={!initialFetchDone}
          />
        )}

        {/* Eid-ul-Adha */}
        {eidAdhaRemaining > 0 && (
          <StatCard
            icon={Calendar}
            iconBgClass="bg-purple-500/10"
            iconColorClass="text-purple-400"
            iconBorderClass="border-purple-500/20"
            title="Eid-ul-Adha Holiday (Remaining)"
            value={`${eidAdhaRemaining} days`}
            subtitle={`Total Eid-ul-Adha Holiday: ${eidAdhaTotal} days`}
            loading={!initialFetchDone}
          />
        )}
      </div>

      {/* Line 2: Totals/Tracker (Short Leave, Full Leave, Overtime) */}
      <div className="flex flex-wrap justify-center gap-4 w-full">
        {/* Short Leave */}
        <StatCard
          icon={Clock}
          iconBgClass="bg-blue-500/10"
          iconColorClass="text-blue-400"
          iconBorderClass="border-blue-500/20"
          title="Total Short Leave"
          value={`${stats.shortHours} hrs`}
          subtitle={convertedHours > 0 ? `Converted: ${convertedHours} hrs` : undefined}
          action={onConvertToFullLeave && hasConvertibleHours ? (
            <button
              type="button"
              onClick={onConvertToFullLeave}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-550 text-white rounded text-[10px] font-bold cursor-pointer transition-all border border-blue-700 shadow-sm flex items-center justify-center shrink-0"
              title="Convert to Full Leave"
            >
              Add to Full Leave
            </button>
          ) : undefined}
          loading={!initialFetchDone}
        />

        {/* Full Leave */}
        <StatCard
          icon={Calendar}
          iconBgClass="bg-blue-500/10"
          iconColorClass="text-blue-400"
          iconBorderClass="border-blue-500/20"
          title="Total Full Leave"
          value={`${stats.fullLeaves} days`}
          subtitle={convertedDays > 0 ? `Added from Short Leave: +${convertedDays} days` : undefined}
          loading={!initialFetchDone}
        />

        {/* Overtime */}
        {allowOvertime && (
          <StatCard
            icon={Clock}
            iconBgClass="bg-emerald-500/10"
            iconColorClass="text-emerald-400"
            iconBorderClass="border-emerald-500/20"
            title="Overtime"
            value={`${stats.overtimeHours} hrs`}
            loading={!initialFetchDone}
          />
        )}
      </div>

      {/* Govt Holiday History Modal */}
      {showHistoryModal && isMounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl w-full max-w-md p-6 relative overflow-hidden font-sans">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-teal-900/10 blur-[80px] pointer-events-none" />

            <div className="flex justify-between items-center border-b border-slate-800/80 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="h-4 w-4 text-teal-400" /> Govt Holiday Response History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-450 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-1">
              {respondedHolidays && respondedHolidays.length > 0 ? (
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-955/40">
                  <table className="w-full text-xs text-slate-355">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-slate-850 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
                        <th className="py-2 px-3 text-left">Date</th>
                        <th className="py-2 px-3 text-left">Holiday Name</th>
                        <th className="py-2 px-3 text-right">Response</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {respondedHolidays.map((h, i) => (
                        <tr key={i} className="hover:bg-slate-900/20 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-teal-400">{formatDate(h.date)}</td>
                          <td className="py-2.5 px-3 text-slate-200">{h.name}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${h.response === 'reserve'
                                ? 'bg-teal-955/60 border border-teal-900 text-teal-400'
                                : 'bg-emerald-955/60 border border-emerald-900 text-emerald-400'
                                }`}>
                                {h.response === 'reserve' ? 'Reserve' : 'Paid'}
                              </span>
                              {isAdmin && onUpdateHolidayResponse && userId && (
                                <button
                                  type="button"
                                  disabled={updatingHolidayDate === h.date}
                                  onClick={() => handleEditHolidayResponse(h.date, h.name, h.response)}
                                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
                                  title="Change Response Preference"
                                >
                                  {updatingHolidayDate === h.date ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Edit className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-6 text-xs text-slate-500 font-medium">
                  No govt holiday response records.
                </p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Half-Yearly Office Leave Details Modal */}
      {showOfficeDetailsModal && halfYearlyStats && isMounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl w-full max-w-md p-6 relative overflow-hidden font-sans">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[80px] pointer-events-none" />

            <div className="flex justify-between items-center border-b border-slate-800/80 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-400" /> Half-Yearly Office Leave Details
              </h3>
              <button
                onClick={() => setShowOfficeDetailsModal(false)}
                className="text-slate-450 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* H1 Section */}
              <div className="bg-slate-955/40 border border-slate-850 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-blue-400 mb-2 border-b border-slate-800 pb-1.5 uppercase tracking-wider">
                  H1 (January - June)
                </h4>
                <div className={`grid ${hasH1Carryover ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-center text-xs`}>
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[64px]">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                      {hasH1Carryover ? 'Base' : 'Allocated'}
                    </span>
                    {renderTwoLineLeave(hasH1Carryover ? halfYearlyStats.h1Base : halfYearlyStats.h1Total, workingHours)}
                  </div>
                  {hasH1Carryover && (
                    <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[64px]">
                      <span className="text-slate-500 block text-[9px] uppercase font-semibold">Carryover</span>
                      {renderTwoLineLeave(h1Carryover, workingHours, true)}
                    </div>
                  )}
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[64px]">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Taken</span>
                    {renderTwoLineLeave(halfYearlyStats.h1Taken, workingHours)}
                  </div>
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[64px]">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Remaining</span>
                    {renderTwoLineLeave(
                      halfYearlyStats.h1Remaining,
                      workingHours,
                      false,
                      halfYearlyStats.h1Remaining < 0 ? 'text-rose-455' : 'text-emerald-400'
                    )}
                  </div>
                </div>
                {halfYearlyStats.h1Remaining < 0 && (
                  <p className="text-[10px] text-red-400 mt-2">
                    ⚠️ Extra leave was taken in the 1st half, which may be deducted from salary.
                  </p>
                )}
              </div>

              {/* H2 Section */}
              <div className="bg-slate-955/40 border border-slate-850 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-blue-400 mb-2 border-b border-slate-800 pb-1.5 uppercase tracking-wider">
                  H2 (July - December)
                </h4>
                <div className={`grid ${hasH2Carryover ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-center text-xs`}>
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[64px]">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                      {hasH2Carryover ? 'Base' : 'Allocated'}
                    </span>
                    {renderTwoLineLeave(hasH2Carryover ? halfYearlyStats.h2Base : halfYearlyStats.h2Total, workingHours)}
                  </div>
                  {hasH2Carryover && (
                    <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[64px]">
                      <span className="text-slate-500 block text-[9px] uppercase font-semibold">Carryover</span>
                      {renderTwoLineLeave(halfYearlyStats.carryForward, workingHours, true)}
                    </div>
                  )}
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[64px]">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Taken</span>
                    {renderTwoLineLeave(halfYearlyStats.h2Taken, workingHours)}
                  </div>
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[64px]">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Remaining</span>
                    {renderTwoLineLeave(
                      halfYearlyStats.h2Remaining,
                      workingHours,
                      false,
                      halfYearlyStats.h2Remaining < 0 ? 'text-rose-455' : 'text-emerald-400'
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex justify-end">
              <button
                type="button"
                onClick={() => setShowOfficeDetailsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Holiday Preference Modal */}
      {showEditPrefModal && editPrefHoliday && isMounted && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-955/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl w-full max-w-md p-6 relative overflow-hidden font-sans">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-teal-900/10 blur-[80px] pointer-events-none" />

            <div className="flex justify-between items-center border-b border-slate-800/80 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit className="h-4 w-4 text-teal-400" /> Update Holiday Preference
              </h3>
              <button
                onClick={() => {
                  setShowEditPrefModal(false);
                  setEditPrefHoliday(null);
                }}
                className="text-slate-450 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Holiday Info */}
              <div className="bg-slate-955/60 border border-slate-850 p-4 rounded-xl space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white">{editPrefHoliday.name}</h4>
                    <span className="text-[11px] font-mono text-teal-400 font-bold">{formatDate(editPrefHoliday.date)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${editPrefHoliday.response === 'reserve'
                    ? 'bg-teal-955/60 border border-teal-900 text-teal-400'
                    : 'bg-emerald-955/60 border border-emerald-900 text-emerald-400'
                    }`}>
                    Current: {editPrefHoliday.response === 'reserve' ? 'Reserve' : 'Paid'}
                  </span>
                </div>
              </div>

              {/* Selection cards */}
              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Select New Preference</label>
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Reserve Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPref('reserve')}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-all ${selectedPref === 'reserve'
                      ? 'bg-teal-955/20 border-teal-500/80 shadow-[0_0_12px_rgba(20,184,166,0.15)]'
                      : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                      }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedPref === 'reserve' ? 'border-teal-400' : 'border-slate-600'
                      }`}>
                      {selectedPref === 'reserve' && <div className="w-2 h-2 rounded-full bg-teal-400 animate-scale-up" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Reserve Holiday</span>
                      <span className="text-[10px] text-slate-400 leading-normal block mt-0.5">
                        Employee can adjust any future leave against this holiday.
                      </span>
                    </div>
                  </button>

                  {/* Paid Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPref('paid')}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-all ${selectedPref === 'paid'
                      ? 'bg-emerald-955/20 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                      }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedPref === 'paid' ? 'border-emerald-400' : 'border-slate-600'
                      }`}>
                      {selectedPref === 'paid' && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-scale-up" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Get Paid (Payment)</span>
                      <span className="text-[10px] text-slate-400 leading-normal block mt-0.5">
                        Holiday is paid with salary. The adjustment will be removed and cannot be used for leave.
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Warning box if changing from Reserve to Paid */}
              {editPrefHoliday.response === 'reserve' && selectedPref === 'paid' && (
                <div className="bg-purple-955/20 border border-purple-900/50 p-3.5 rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-1 duration-200">
                  <AlertTriangle className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                  <div className="text-[10.5px] text-purple-300 leading-relaxed font-medium">
                    <span className="font-bold text-purple-400 block mb-0.5">⚠️ Warning: Unadjusting Leaves</span>
                    Changing to 'Get Paid' will set any leaves previously adjusted against this holiday to 'No Adjustment'. These leaves will now count as standard Full Leave days instead.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowEditPrefModal(false);
                  setEditPrefHoliday(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingHolidayDate === editPrefHoliday.date}
                onClick={handleSavePref}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-550 hover:to-emerald-550 text-white rounded-lg text-xs font-bold shadow-md shadow-teal-950/20 hover:shadow-teal-900/30 cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {updatingHolidayDate === editPrefHoliday.date ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Preference'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
