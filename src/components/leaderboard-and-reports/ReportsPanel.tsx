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

  // Load all records from IndexedDB cache asynchronously to get complete annual stats
  const [allRecords, setAllRecords] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const loadAllCachedRecords = async () => {
      if (isFirstLoad.current) {
        setIsLoading(true);
      }
      try {
        const cached = await getCacheData<RecordItem>('records_cache');
        setAllRecords(cached);
      } catch (err) {
        console.error('Failed to load cached records for reports:', err);
      } finally {
        setIsLoading(false);
        isFirstLoad.current = false;
      }
    };
    loadAllCachedRecords();
  }, [records]);

  // Determine which records to pass to the dashboard view
  const dashboardRecords = React.useMemo(() => {
    if (activeReportTab === 'mine' && profile) {
      return allRecords.filter((r) => r.user_id === profile.id);
    }
    return allRecords;
  }, [activeReportTab, profile, allRecords]);

  if (recordsLoading || isLoading) {
    return <LeaderboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Back button + Tab bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Leaderboard
            </button>
          )}
        </div>

        {/* Admin/Supervisor tab toggle */}
        {isAdmin && (
          <div className="flex items-center bg-slate-950/60 border border-slate-800 p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveReportTab('mine')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeReportTab === 'mine'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              My Report
            </button>
            <button
              onClick={() => setActiveReportTab('all')}
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
