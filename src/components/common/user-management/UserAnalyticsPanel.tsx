import React, { useState, useEffect } from 'react';
import { RecordItem, Profile } from '@/types';
import { supabase } from '@/utils/supabase';
import { getCacheData } from '@/utils/quotesOfflineSync';
import { ReportsDashboardView } from '@/components/leaderboard-and-reports/ReportsDashboardView';
import { LeaderboardSkeleton } from '@/components/common/skeleton/LeaderboardSkeleton';

interface UserAnalyticsPanelProps {
  viewingStaff: Profile;
  profilesList: Profile[];
}

export const UserAnalyticsPanel: React.FC<UserAnalyticsPanelProps> = ({
  viewingStaff,
  profilesList,
}) => {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    
    const loadRecords = async () => {
      setLoading(true);
      // 1. Try to load from IndexedDB cache first for instant feedback
      try {
        const cached = await getCacheData<RecordItem>('records_cache');
        if (cached && cached.length > 0 && active) {
          const userCached = cached.filter(r => r.user_id === viewingStaff.id);
          setRecords(userCached);
        }
      } catch (err) {
        console.error('Failed to load cached records for user analytics:', err);
      }

      // 2. Fetch the latest and complete records from Supabase to ensure accuracy
      try {
        const { data, error } = await supabase
          .from('records')
          // Column-limited to the RecordItem fields the analytics view consumes
          // (avoids shipping the user's full row payloads on every profile view)
          .select('id, user_id, file_name, branch_name, codename, file_type, submitted_at, created_at')
          .eq('user_id', viewingStaff.id);

        if (error) throw error;

        if (active) {
          setRecords(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch user quotes records from Supabase:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadRecords();

    return () => {
      active = false;
    };
  }, [viewingStaff.id]);

  if (loading) {
    return (
      <div className="py-12">
        <LeaderboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-theme-card-bg/20 border border-theme-border-muted rounded-2xl p-5 backdrop-blur-md shadow-lg">
        <h3 className="text-base font-bold text-theme-text-primary tracking-wide">
          Quotes Submission Analytics
        </h3>
        <p className="text-xs text-theme-text-muted mt-1">
          Detailed performance metrics, category breakdown, and trends for {viewingStaff.full_name}.
        </p>
      </div>

      <ReportsDashboardView
        records={records}
        profilesList={profilesList}
        profile={viewingStaff}
      />
    </div>
  );
};
