import React, { useState, useEffect, useRef } from 'react';
import { RecordItem, Profile } from '@/types';
import { LeaderboardSkeleton } from '@/components/common/skeleton/LeaderboardSkeleton';
import { ReportsDashboardView } from './ReportsDashboardView';
import { getCacheData } from '@/utils/quotesOfflineSync';
import { ArrowLeft } from 'lucide-react';

interface ReportsPanelProps {
  records: RecordItem[];
  profilesList: Profile[];
  profile: Profile | null;
  recordsLoading?: boolean;
  onBack?: () => void;
}

export const ReportsPanel: React.FC<ReportsPanelProps> = ({
  records,
  profilesList,
  profile,
  recordsLoading = false,
  onBack,
}) => {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor';

  // Active report tab: "mine" for normal users, "mine" | "all" for admin
  const [activeReportTab, setActiveReportTab] = useState<'mine' | 'all'>('mine');

  // Load saved tab choice on client mount to prevent Next.js hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("quotes_reports_active_tab");
    if (saved === 'mine' || saved === 'all') {
      setActiveReportTab(saved);
    }
  }, []);

  const handleSetActiveReportTab = (tab: 'mine' | 'all') => {
    setActiveReportTab(tab);
    localStorage.setItem("quotes_reports_active_tab", tab);
  };

  // Load all records from IndexedDB cache asynchronously to get complete annual stats
  const [allRecords, setAllRecords] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const loadAllCachedRecords = async () => {
      if (isFirstLoad) {
        setIsLoading(true);
      }
      try {
        const cached = await getCacheData<RecordItem>('records_cache');
        setAllRecords(cached);
      } catch (err) {
        console.error('Failed to load cached records for reports:', err);
      } finally {
        setIsLoading(false);
        setIsFirstLoad(false);
      }
    };
    loadAllCachedRecords();
  }, [records]);

  if (isLoading && isFirstLoad) {
    return <LeaderboardSkeleton />;
  }

  // Determine records based on tab (normal users only get their records)
  const dashboardRecords = isAdmin && activeReportTab === 'all' ? allRecords : records;

  return (
    <div className="space-y-6">
      {/* Header and Toggles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-white cursor-pointer transition-all"
              title="Back to Leaderboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="space-y-0.5">
            <h2 className="text-xl font-bold text-white tracking-wide">
              {isAdmin && activeReportTab === 'all' ? 'All Report' : 'My Report'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAdmin && activeReportTab === 'all'
                ? 'Overview of company-wide quotes submission activity.'
                : 'Your personal quotes submission performance metrics.'}
            </p>
          </div>
        </div>

        {/* Admin/Supervisor tab toggle */}
        {isAdmin && (
          <div className="flex items-center bg-slate-950/60 border border-slate-800 p-1 rounded-xl gap-1">
            <button
              onClick={() => handleSetActiveReportTab('mine')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeReportTab === 'mine'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              My Report
            </button>
            <button
              onClick={() => handleSetActiveReportTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeReportTab === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Report
            </button>
          </div>
        )}
      </div>

      {/* Report content */}
      <ReportsDashboardView
        records={dashboardRecords}
        profilesList={profilesList}
        profile={profile}
      />
    </div>
  );
};
