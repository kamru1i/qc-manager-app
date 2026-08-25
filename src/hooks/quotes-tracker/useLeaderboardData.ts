import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { recordsService } from '@/services';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import { useProfiles } from '@/contexts/ProfilesContext';
import { Profile } from '@/types';
import { BadgeInfo } from '@/utils/leaderboardHelper';
import { fetchSubmittedMonths } from '@/utils/availableDatesHelper';

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

let _leaderboardCache: {
  key: string;
  data: LeaderboardUser[];
} | null = null;

const REALTIME_THROTTLE_MS = 5000;

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
  
  const currentYearStr = new Date().getFullYear().toString();
  
  // Default strictly to current month and current year
  const [selectedYear, setSelectedYear] = useState(() => currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));

  const getCacheKey = useCallback(() => {
    return `${leaderboardPeriod}_${selectedYear}_${leaderboardPeriod === 'monthly' ? selectedMonth : 'all'}`;
  }, [leaderboardPeriod, selectedYear, selectedMonth]);

  const [rawLeaderboardData, setRawLeaderboardData] = useState<LeaderboardUser[]>(() => {
    const key = `${leaderboardPeriod}_${currentYearStr}_${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return _leaderboardCache?.key === key ? _leaderboardCache.data : [];
  });
  
  const [loading, setLoading] = useState(() => {
    const key = `${leaderboardPeriod}_${currentYearStr}_${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return _leaderboardCache?.key !== key;
  });
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Available dates dynamically loaded from db
  const [availableDates, setAvailableDates] = useState<{ year: string; month: string }[]>([]);

  // Years that live only in leaderboard_archive (their raw records were pruned
  // after 2 years). Selecting one of these in Yearly mode reads the snapshot
  // table instead of the live RPC.
  const [archiveYears, setArchiveYears] = useState<string[]>([]);

  const isArchivedYear =
    leaderboardPeriod === 'yearly' &&
    selectedYear !== currentYearStr &&
    archiveYears.includes(selectedYear);

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

      const { data, error: rpcError } = await recordsService.getLeaderboardData({
        p_year: selectedYear,
        p_month: selectedMonth,
        p_period: 'monthly',
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
      _leaderboardCache = {
        key: getCacheKey(),
        data: mappedData,
      };
      setError(null);
    } catch (err: any) {
      console.error('Error fetching leaderboard data:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [selectedYear, selectedMonth, currentProfile?.id]);

  // Fetch unique month/year dates that contain submitted records
  const fetchAvailableDates = useCallback(async () => {
    try {
      const dates = await fetchSubmittedMonths();
      setAvailableDates(dates);
    } catch (err) {
      console.error('Error fetching available dates for leaderboard:', err);
    }
  }, []);

  // Fetch the set of years that exist in the archive snapshot table (small,
  // ~staff-count rows per year). Runs once on mount + on realtime bursts.
  const fetchArchiveYears = useCallback(async () => {
    try {
      const { data, error: archErr } = await recordsService.getLeaderboardArchive();
      if (archErr) throw archErr;
      const years = Array.from(
        new Set((data || []).map((r: { year: number }) => String(r.year)))
      );
      setArchiveYears(years);
    } catch (err) {
      console.error('Error fetching leaderboard archive years:', err);
    }
  }, []);

  // Load a pruned year's leaderboard from the archive snapshot table. Ranks
  // are already frozen at prune time; today's/monthly counts don't exist for
  // archived years, so they surface as 0 (yearly total is the ranking basis).
  const fetchArchivedYearData = useCallback(async (year: string, isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const { data, error: archErr } = await recordsService.getLeaderboardArchive(Number(year));
      if (archErr) throw archErr;

      const mappedData: LeaderboardUser[] = (data || []).map((row: any) => ({
        user_id: row.user_id ?? row.username,
        username: row.username,
        full_name: row.full_name,
        role: 'user',
        job_role: row.job_role,
        branch: row.branch,
        badge: null,
        quotes_count: row.quotes_count ?? 0,
        requotes_count: row.requotes_count ?? 0,
        reviews_count: row.reviews_count ?? 0,
        sales_count: row.sales_count ?? 0,
        total_submitted: row.total_submitted ?? 0,
        todays_count: 0,
        months_count: 0,
        overall_score: row.total_submitted ?? 0,
        earliest_achievement_timestamp: null,
        rank: row.rank,
      }));

      setRawLeaderboardData(mappedData);
      _leaderboardCache = {
        key: getCacheKey(),
        data: mappedData,
      };
      setError(null);
    } catch (err: any) {
      console.error('Error fetching archived leaderboard data:', err);
      setError(err.message || 'Failed to load archived leaderboard');
    } finally {
      setLoading(false);
    }
  }, [getCacheKey]);

  // Load leaderboard: archived years read the snapshot table, everything else
  // hits the live RPC. Re-runs when the year/period selection changes.
  useEffect(() => {
    const isCached = _leaderboardCache?.key === getCacheKey();
    if (isArchivedYear) {
      fetchArchivedYearData(selectedYear, isCached);
    } else {
      fetchLeaderboard(isCached);
    }
  }, [isArchivedYear, selectedYear, fetchArchivedYearData, fetchLeaderboard, getCacheKey]);

  useEffect(() => {
    fetchAvailableDates();
    fetchArchiveYears();
  }, [fetchAvailableDates, fetchArchiveYears]);

  // Realtime: silent refetch on records/profiles changes, throttled
  const lastRealtimeUpdateRef = useRef(0);
  const pendingRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Archived years are immutable snapshots — records/profiles realtime events
  // must never trigger a refetch (or overwrite) while one is displayed.
  const isArchivedYearRef = useRef(isArchivedYear);
  useEffect(() => {
    isArchivedYearRef.current = isArchivedYear;
  }, [isArchivedYear]);

  const handleRealtimeUpdate = useCallback(() => {
    if (isArchivedYearRef.current) return;
    const now = Date.now();
    const elapsed = now - lastRealtimeUpdateRef.current;
    if (elapsed < REALTIME_THROTTLE_MS) {
      if (!pendingRefetchRef.current) {
        pendingRefetchRef.current = setTimeout(() => {
          pendingRefetchRef.current = null;
          if (isArchivedYearRef.current) return;
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

  // Derived filter options based on availableDates + archived years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    availableDates.forEach(d => years.add(d.year));
    archiveYears.forEach(y => years.add(y));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [availableDates, archiveYears]);

  const availableMonthsForSelectedYear = useMemo(() => {
    const months = availableDates
      .filter((d) => d.year === selectedYear)
      .map((d) => d.month);

    const now = new Date();
    const currentYearStr = now.getFullYear().toString();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");

    const monthsSet = new Set<string>(months);
    if (selectedYear === currentYearStr) {
      monthsSet.add(currentMonthStr);
    }

    const filteredList = monthsList.filter((m) => monthsSet.has(m.value));
    return filteredList.length > 0
      ? filteredList
      : monthsList.filter((m) => m.value === currentMonthStr);
  }, [availableDates, selectedYear]);

  // Adjust selectedMonth: default to current month if available
  useEffect(() => {
    const monthValues = availableMonthsForSelectedYear.map((m) => m.value);
    const nowMonthStr = String(new Date().getMonth() + 1).padStart(2, "0");
    if (monthValues.includes(nowMonthStr)) {
      setSelectedMonth((prev) => (monthValues.includes(prev) ? prev : nowMonthStr));
    } else if (monthValues.length > 0 && !monthValues.includes(selectedMonth)) {
      setSelectedMonth(monthValues[monthValues.length - 1]);
    }
  }, [availableMonthsForSelectedYear, selectedMonth]);

  // Period-adjusted ranking. Monthly = server order (RPC dense rank on
  // months_count). Yearly = re-ranked client-side by overall_score (the
  // selected year's total submissions, already in the same RPC payload) —
  // top yearly submitter first, dense ranks, no extra fetch needed.
  const periodRankedData = useMemo(() => {
    if (leaderboardPeriod === 'monthly') return rawLeaderboardData;

    const sorted = [...rawLeaderboardData].sort(
      (a, b) =>
        b.overall_score - a.overall_score || a.username.localeCompare(b.username)
    );
    let rank = 0;
    let prevScore: number | null = null;
    return sorted.map(user => {
      if (user.overall_score !== prevScore) {
        rank += 1;
        prevScore = user.overall_score;
      }
      return { ...user, rank };
    });
  }, [rawLeaderboardData, leaderboardPeriod]);

  // Filtered list
  const leaderboardData = useMemo(() => {
    let list = periodRankedData;

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        user =>
          user.username.toLowerCase().includes(q) ||
          (user.full_name && user.full_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [periodRankedData, searchQuery]);

  // Switch Monthly/Yearly. Monthly view is always the current year (its month
  // dropdown drives the period), so leaving Yearly snaps the year back to
  // current — otherwise a previously-selected archived year would make the
  // monthly RPC query an empty/pruned year.
  const changePeriod = useCallback((period: 'monthly' | 'yearly') => {
    setLeaderboardPeriod(period);
    if (period === 'monthly') {
      setSelectedYear(currentYearStr);
    }
  }, [currentYearStr]);

  return {
    leaderboardData,
    rawLeaderboardData,
    loading,
    error,
    fetchLeaderboard,
    leaderboardPeriod,
    setLeaderboardPeriod,
    changePeriod,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    searchQuery,
    setSearchQuery,
    availableYears,
    availableMonthsForSelectedYear,
    isArchivedYear,
  };
};
