'use client';

import React, { useState, useMemo } from 'react';
import { Profile, ChutiRecordWithProfile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { exportHelper } from '@/utils/exportHelper';
import { LeavesRecordsTable } from './LeavesRecordsTable';
import { Calendar, RefreshCw, ArrowLeft } from 'lucide-react';
import { formatDate, formatTimeToAMPM, getCleanComment } from '@/utils/dashboardHelpers';

interface TeamLeaveRecordsProps {
  profile: Profile;
  profilesList: Profile[];
  adminRecords: ChutiRecordWithProfile[];
  initialFetchDone: boolean;
  onBack?: () => void;
}

export const TeamLeaveRecords: React.FC<TeamLeaveRecordsProps> = ({
  profile,
  profilesList,
  adminRecords,
  initialFetchDone,
  onBack,
}) => {
  // Initialize to local today's date in 'YYYY-MM-DD' Swedish format
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Dummy table control states (required by LeavesRecordsTable prop signature)
  const [filterType, setFilterType] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());

  // Filter profiles list to identify team member user IDs
  const teamUserIds = useMemo(() => {
    if (profile.role === 'admin') {
      return null; // Admin sees everyone
    }
    // Supervisor sees members under their team
    return profilesList
      .filter((p) => p.supervisor_ids && p.supervisor_ids.includes(profile.id))
      .map((p) => p.id);
  }, [profile, profilesList]);

  // Filter chuti records for the selected date and correct team membership
  const dailyRecords = useMemo(() => {
    return adminRecords.filter((r) => {
      // 1. Must match selected date
      if (r.date !== selectedDate) return false;

      // 2. Filter by supervisor's team if not admin
      if (teamUserIds !== null) {
        return teamUserIds.includes(r.user_id);
      }

      return true;
    });
  }, [adminRecords, selectedDate, teamUserIds]);

  const handleResetToToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const handleExportExcel = (filtered: ChutiRecord[], searchTerm: string) => {
    const targetRecords = searchTerm.trim() 
      ? filtered.filter(r => {
          const staffProfile = profilesList.find(p => p.id === r.user_id);
          const fullName = staffProfile?.full_name || staffProfile?.username || r.username || '';
          const codename = staffProfile?.username || r.username || '';
          return fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 codename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 getCleanComment(r.comment).toLowerCase().includes(searchTerm.toLowerCase());
        })
      : filtered;

    exportHelper.exportDailyLeavesExcel(
      targetRecords,
      selectedDate,
      profilesList,
      profile,
      () => {},
      (msg) => alert(msg)
    );
  };

  const handleExportPDF = (filtered: ChutiRecord[], searchTerm: string) => {
    const targetRecords = searchTerm.trim() 
      ? filtered.filter(r => {
          const staffProfile = profilesList.find(p => p.id === r.user_id);
          const fullName = staffProfile?.full_name || staffProfile?.username || r.username || '';
          const codename = staffProfile?.username || r.username || '';
          return fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 codename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 getCleanComment(r.comment).toLowerCase().includes(searchTerm.toLowerCase());
        })
      : filtered;

    exportHelper.exportDailyLeavesPDF(
      targetRecords,
      selectedDate,
      profilesList,
      profile,
      () => {},
      (msg) => alert(msg)
    );
  };

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-800/80 text-slate-300 rounded-xl hover:text-white transition-all cursor-pointer shrink-0"
              title="Go Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl shrink-0 mt-0.5">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Daily Leave Records Report 📅</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                View full leaves and short leaves scheduled for today or any other day.
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector Control Group */}
        <div className="flex items-center gap-3 w-full md:w-auto self-stretch md:self-auto border-t border-slate-850/80 md:border-t-0 pt-3 md:pt-0">
          <div className="flex-1 md:flex-none flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col justify-end self-end">
            <button
              onClick={handleResetToToday}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
              title="Reset to today's date"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Today
            </button>
          </div>
        </div>
      </div>

      {/* Daily Leaves Table */}
      <LeavesRecordsTable
        records={dailyRecords}
        allowOvertime={false}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        onResetFilters={() => {}}
        onExportExcel={handleExportExcel}
        onExportPDF={handleExportPDF}
        onToggleAdjustment={() => {}}
        onDeleteClick={() => {}}
        formatDate={formatDate}
        formatTimeToAMPM={formatTimeToAMPM}
        getCleanComment={getCleanComment}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={[selectedYear]}
        onAddLeaveClick={() => {}}
        title="Team daily leave records"
        emptyMessage="No leave records found for the selected date."
        showPendingBadge={true}
        initialFetchDone={initialFetchDone}
        hideDelete={true}
        showAddLeave={false}
        showNameColumn={true}
        hideAdjustmentAndOvertime={true}
        hideYearSelect={true}
        profilesList={profilesList}
      />
    </div>
  );
};
