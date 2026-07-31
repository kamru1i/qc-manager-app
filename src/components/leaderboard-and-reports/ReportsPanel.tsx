import React, { useState, useEffect } from 'react';
import { RecordItem, Profile } from '@/types';
import { LeaderboardSkeleton } from '@/components/common/skeleton/LeaderboardSkeleton';
import { ReportsDashboardView } from './ReportsDashboardView';
import { getCacheData } from '@/utils/quotesOfflineSync';
import { isAdminRole } from '@/utils/permissionService';

interface ReportsPanelProps {
  records: RecordItem[];
  profilesList: Profile[];
  profile: Profile | null;
  initialReportTab?: 'mine' | 'all';
  onBack?: () => void;
}

export const ReportsPanel: React.FC<ReportsPanelProps> = ({
  records,
  profilesList,
  profile,
  initialReportTab = 'mine',
}) => {
  const isAdmin = isAdminRole(profile) || profile?.role === 'supervisor';

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
  // Filter allRecords by logged-in user profile.id for "My Report" to get complete historical data.
  const dashboardRecords = isAdmin && initialReportTab === 'all'
    ? allRecords
    : allRecords.filter((r) => r.user_id === profile?.id);

  return (
    <div className="space-y-6">
      <ReportsDashboardView
        records={dashboardRecords}
        profilesList={profilesList}
        profile={profile}
      />
    </div>
  );
};
