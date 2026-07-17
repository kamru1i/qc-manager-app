import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import { useProfiles } from '@/contexts/ProfilesContext';
import { Profile } from '@/types';
import { BadgeInfo } from '@/utils/leaderboardHelper';
import { fetchSubmittedAtRange, buildAvailableDates } from '@/utils/availableDatesHelper';

export interface LeaderboardUser {
  user_id: string;
  username: string;
  full_name: string | null;
  role: 'admin' | 'supervisor' | 'user';
  job_role: string | null;
  branch: string | null;
  badge: BadgeInfo | null;
  quotes_count: number;
  requotes_count: number;
  reviews_count: number;
  sales_count: number;
  total_submitted: number;
  todays_count: number;
  months_count: number;
  overall_score: number;
  earliest_achievement_timestamp: string | null;
  rank: number;
}

const REALTIME_THROTTLE_MS = 2000;

const monthsList = [
  { value: '01', name: 'January' },
  { value: '02', name: 'February' },
  { value: '03', name: 'March' },
  { value: '04', name: 'April' },
  { value: '05', name: 'May' },
  { value: '06', name: 'June' },
  { value: '07', name: 'July' },
  { value: '08', name: 'August' },
  { value: '09', name: 'September' },
  { value: '10', name: 'October' },
  { value: '11', name: 'November' },
  { value: '12', name: 'December' },
];

export const useLeaderboardData = (currentProfile: Profile | null) => {
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'monthly' | 'yearly'>('monthly');
  
  // Default strictly to current month and current year
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));

  const [rawLeaderboardData, setRawLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Available dates dynamically loaded from db
  const [availableDates, setAvailableDates] = useState<{ year: string; month: string }[]>([]);

  const isFetchingRef = useRef(false);

  // Shared profiles list — used to detect which fields actually changed on
  // realtime profile UPDATEs (payload.old only carries the primary key under
  // default REPLICA IDENTITY). Falls back to an empty list on standalone
  // routes without a ProfilesProvider (treated as "changed" — fail open).
  const { profilesList } = useProfiles();
  const profilesListRef = useRef<Profile[]>([]);
  useEffect(() => {
    profilesListRef.current = profilesList;
  }, [profilesList]);

  const fetchLeaderboard = useCallback(async (isSilent = false) => {
    if (!currentProfile) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (!isSilent) setLoading(true);

    try {
      const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local format
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      const { data, error: rpcError } = await supabase.rpc('get_leaderboard_data', {
        p_year: selectedYear,
        p_month: selectedMonth,
        p_period: leaderboardPeriod,
        p_today: todayStr,
        p_tz: timeZone,
      });

      if (rpcError) throw rpcError;

      const mappedData: LeaderboardUser[] = (data || []).map((row: any) => ({
        user_id: row.user_id,
        username: row.username,
        full_name: row.full_name,
        role: row.role === 'admin' || row.role === 'supervisor' ? row.role : 'user',
        job_role: row.job_role,
        branch: row.branch,
        badge: row.badge && typeof row.badge === 'object' ? (row.badge as BadgeInfo) : null,
        quotes_count: row.quotes_count ?? 0,
        requotes_count: row.requotes_count ?? 0,
        reviews_count: row.reviews_count ?? 0,
        sales_count: row.sales_count ?? 0,
        total_submitted: row.total_submitted ?? 0,
        todays_count: row.todays_count ?? 0,
        months_count: row.months_count ?? 0,
        overall_score: row.overall_score ?? 0,
        earliest_achievement_timestamp: row.earliest_achievement_timestamp,
        rank: row.rank,
      }));

      setRawLeaderboardData(mappedData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching leaderboard data:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [selectedYear, selectedMonth, leaderboardPeriod, currentProfile]);

  // Fetch unique month/year dates that contain submitted records
  const fetchAvailableDates = useCallback(async () => {
    try {
      const { earliestDate, latestDate } = await fetchSubmittedAtRange();
      setAvailableDates(buildAvailableDates(earliestDate, latestDate));
    } catch (err) {
      console.error('Error fetching available dates for leaderboard:', err);
    }
  }, []);

  // Fetch initial leaderboard and available dates
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    fetchAvailableDates();
  }, [fetchAvailableDates]);

  // Realtime: silent refetch on records/profiles changes, throttled
  const lastRealtimeUpdateRef = useRef(0);
  const pendingRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRealtimeUpdate = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastRealtimeUpdateRef.current;
    if (elapsed < REALTIME_THROTTLE_MS) {
      if (!pendingRefetchRef.current) {
        pendingRefetchRef.current = setTimeout(() => {
          pendingRefetchRef.current = null;
          lastRealtimeUpdateRef.current = Date.now();
          fetchLeaderboard(true);
          fetchAvailableDates();
        }, REALTIME_THROTTLE_MS - elapsed);
      }
      return;
    }
    lastRealtimeUpdateRef.current = now;
    fetchLeaderboard(true);
    fetchAvailableDates();
  }, [fetchLeaderboard, fetchAvailableDates]);

  useEffect(() => {
    return () => {
      if (pendingRefetchRef.current) clearTimeout(pendingRefetchRef.current);
    };
  }, []);

  const handleProfileRealtimeUpdate = useCallback((payload: RealtimePayload) => {
    if (payload.eventType === 'UPDATE') {
      // payload.old only contains the primary key (default REPLICA IDENTITY) —
      // compare against the cached previous row from the shared profiles list.
      const newRow = payload.new as Partial<Profile>;
      const prevRow = profilesListRef.current.find(p => p.id === newRow.id);

      const criticalFields: (keyof Profile)[] = ['username', 'full_name', 'role', 'has_quotes_access'];
      const hasCriticalChange = !prevRow ||
        criticalFields.some(field => prevRow[field] !== newRow[field]);
      if (!hasCriticalChange) return;
    }
    handleRealtimeUpdate();
  }, [handleRealtimeUpdate]);

  useRealtimeHandler('records', handleRealtimeUpdate);
  useRealtimeHandler('profiles', handleProfileRealtimeUpdate);

  // Derived filter options based on availableDates
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    availableDates.forEach(d => years.add(d.year));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [availableDates]);

  const availableMonthsForSelectedYear = useMemo(() => {
    const months = availableDates
      .filter(d => d.year === selectedYear)
      .map(d => d.month);
    const filteredList = monthsList.filter(m => months.includes(m.value));
    return filteredList.length > 0 ? filteredList : monthsList;
  }, [availableDates, selectedYear]);

  // Filtered list
  const leaderboardData = useMemo(() => {
    let list = rawLeaderboardData;

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        user =>
          user.username.toLowerCase().includes(q) ||
          (user.full_name && user.full_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [rawLeaderboardData, searchQuery]);

  return {
    leaderboardData,
    rawLeaderboardData,
    loading,
    error,
    fetchLeaderboard,
    leaderboardPeriod,
    setLeaderboardPeriod,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    searchQuery,
    setSearchQuery,
    availableYears,
    availableMonthsForSelectedYear,
  };
};
