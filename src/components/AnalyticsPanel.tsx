import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RecordItem, Profile } from '@/types';
import { VerifiedBadge } from './VerifiedBadge';
import { calculateTopPerformerBadges } from '@/utils/leaderboardHelper';
import {
  FileText,
  TrendingUp,
  CheckCircle,
  Percent,
  Calendar,
  Award,
  MapPin,
  Clock,
  Eye
} from 'lucide-react';
import { getCacheData } from '@/utils/quotesOfflineSync';

interface AnalyticsPanelProps {
  records: RecordItem[];
  profilesList: Profile[];
  profile: Profile | null;
  recordsLoading?: boolean;
}

const GrowthBadge: React.FC<{ trend: 'up' | 'down' | 'neutral'; label: string }> = ({ trend, label }) => {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
        <TrendingUp className="h-3 w-3 shrink-0" />
        {label}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-450 dark:text-rose-400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0">
          <line x1="7" y1="7" x2="17" y2="17"></line>
          <polyline points="17 7 17 17 7 17"></polyline>
        </svg>
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 border border-slate-500/20 text-slate-400">
      <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0"></span>
      {label}
    </span>
  );
};

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

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  records,
  profilesList,
  recordsLoading = false,
}) => {
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
        console.error('Failed to load cached records for analytics:', err);
      } finally {
        setIsLoading(false);
        isFirstLoad.current = false;
      }
    };
    loadAllCachedRecords();
  }, [records]);

  // Get available years dynamically from all cached records
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    allRecords.forEach(r => {
      if (r.submitted_at) {
        const year = new Date(r.submitted_at).getFullYear().toString();
        if (year && !isNaN(parseInt(year, 10))) {
          yearsSet.add(year);
        }
      }
    });
    // Fallback to current year if no records exist
    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear().toString());
    }
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  // Selected Year for filtering
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return availableYears[0] || new Date().getFullYear().toString();
  });

  // Sync selectedYear if availableYears updates and the selectedYear is no longer present
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // Selected Month for staff line chart and monthly filters
  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Tooltip state for monthly bar chart
  const [hoveredBar, setHoveredBar] = useState<{
    x: number;
    y: number;
    month: string;
    label: string;
    value: number;
    color: string;
  } | null>(null);

  // Toggle States for Filters
  const [metricsTimeScope, setMetricsTimeScope] = useState<'yearly' | 'monthly'>('monthly');

  // Filter all system records by selected year
  const systemYearRecords = useMemo(() => {
    return allRecords.filter(r => {
      if (!r.submitted_at) return false;
      const date = new Date(r.submitted_at);
      return date.getFullYear().toString() === selectedYear;
    });
  }, [allRecords, selectedYear]);

  // Filter system records for current selected month/year scope
  const systemMetricsFilteredRecords = useMemo(() => {
    if (metricsTimeScope === 'yearly') {
      return systemYearRecords;
    } else {
      return systemYearRecords.filter(r => {
        if (!r.submitted_at) return false;
        const date = new Date(r.submitted_at);
        const mStr = String(date.getMonth() + 1).padStart(2, '0');
        return mStr === selectedMonth;
      });
    }
  }, [systemYearRecords, metricsTimeScope, selectedMonth]);

  // General Metrics (Quotes, Requotes, Reviews, Sales, Conversion rate)
  const stats = useMemo(() => {
    let quotes = 0;
    let requotes = 0;
    let reviews = 0;
    let sales = 0;

    systemMetricsFilteredRecords.forEach(r => {
      const type = r.file_type || '';
      if (type === 'Quote') {
        quotes++;
      } else if (type === 'Requote') {
        requotes++;
      } else if (type.toLowerCase().includes('review')) {
        reviews++;
      } else if (type === 'Sale') {
        sales++;
      }
    });

    const totalFiles = systemMetricsFilteredRecords.length;
    const conversionRate = totalFiles > 0 ? ((sales / totalFiles) * 100).toFixed(2) : '0.00';

    return {
      quotes,
      requotes,
      reviews,
      sales,
      conversionRate: parseFloat(conversionRate)
    };
  }, [systemMetricsFilteredRecords]);

  // Filter system records for the previous period (to calculate period-over-period growth)
  const previousSystemPeriodFilteredRecords = useMemo(() => {
    const currentYearNum = parseInt(selectedYear, 10);

    if (metricsTimeScope === 'yearly') {
      const prevYear = (currentYearNum - 1).toString();
      return allRecords.filter(r => {
        if (!r.submitted_at) return false;
        const date = new Date(r.submitted_at);
        return date.getFullYear().toString() === prevYear;
      });
    } else {
      const currentMonthNum = parseInt(selectedMonth, 10);
      let prevYear = currentYearNum;
      let prevMonthNum = currentMonthNum - 1;

      if (prevMonthNum === 0) {
        prevMonthNum = 12;
        prevYear = currentYearNum - 1;
      }

      const prevYearStr = prevYear.toString();
      const prevMonthStr = String(prevMonthNum).padStart(2, '0');

      return allRecords.filter(r => {
        if (!r.submitted_at) return false;
        const date = new Date(r.submitted_at);
        const mStr = String(date.getMonth() + 1).padStart(2, '0');
        return date.getFullYear().toString() === prevYearStr && mStr === prevMonthStr;
      });
    }
  }, [allRecords, selectedYear, selectedMonth, metricsTimeScope]);

  const previousStats = useMemo(() => {
    let quotes = 0;
    let requotes = 0;
    let reviews = 0;
    let sales = 0;

    previousSystemPeriodFilteredRecords.forEach(r => {
      const type = r.file_type || '';
      if (type === 'Quote') {
        quotes++;
      } else if (type === 'Requote') {
        requotes++;
      } else if (type.toLowerCase().includes('review')) {
        reviews++;
      } else if (type === 'Sale') {
        sales++;
      }
    });

    const prevTotalFiles = previousSystemPeriodFilteredRecords.length;
    const conversionRate = prevTotalFiles > 0 ? ((sales / prevTotalFiles) * 100).toFixed(2) : '0.00';

    return {
      quotes,
      requotes,
      reviews,
      sales,
      conversionRate: parseFloat(conversionRate)
    };
  }, [previousSystemPeriodFilteredRecords]);

  // Helpers for growth calculation
  const getGrowthStats = (current: number, previous: number) => {
    if (previous === 0) {
      if (current === 0) {
        return { trend: 'neutral' as const, label: '0.00%' };
      }
      return { trend: 'up' as const, label: '+100.00%' };
    }
    const finalChange = ((current - previous) / Math.abs(previous)) * 100;
    const trend = finalChange > 0 ? ('up' as const) : finalChange < 0 ? ('down' as const) : ('neutral' as const);
    const label = finalChange > 0 ? `+${finalChange.toFixed(2)}%` : finalChange < 0 ? `${finalChange.toFixed(2)}%` : '0.00%';
    return { trend, label };
  };

  const getRateGrowthStats = (current: number, previous: number) => {
    const diff = current - previous;
    const trend = diff > 0 ? ('up' as const) : diff < 0 ? ('down' as const) : ('neutral' as const);
    const label = diff > 0 ? `+${diff.toFixed(2)}%` : diff < 0 ? `${diff.toFixed(2)}%` : '0.00%';
    return { trend, label };
  };

  // Category Breakdown logic for all 12 categories
  const categoryBreakdown = useMemo(() => {
    const all12Categories = [
      'Quote', 'Requote', 'Requote Van', 'Requote Bike', 'Review',
      'Review Van', 'Review Bike', 'Individual Review', 'Other Site',
      'Van', 'Bike', 'Sale'
    ];

    const counts: Record<string, number> = {};
    all12Categories.forEach(cat => {
      counts[cat] = 0;
    });

    systemMetricsFilteredRecords.forEach(r => {
      if (r.file_type && counts[r.file_type] !== undefined) {
        counts[r.file_type]++;
      }
    });

    const total = Object.values(counts).reduce((acc, curr) => acc + curr, 0);

    const formatted = Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0
    }));

    // Sort descending by count, then by name
    return formatted.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [systemMetricsFilteredRecords]);

  const dominantActivity = useMemo(() => {
    if (categoryBreakdown.length === 0 || categoryBreakdown.every(c => c.count === 0)) {
      return { name: 'None', count: 0, percentage: 0 };
    }
    return categoryBreakdown[0];
  }, [categoryBreakdown]);

  const getCategoryColor = (name: string) => {
    switch (name) {
      case 'Quote':
        return 'from-blue-600 to-blue-400 border-blue-500/25 bg-blue-500';
      case 'Requote':
        return 'from-purple-600 to-purple-400 border-purple-500/25 bg-purple-500';
      case 'Requote Van':
        return 'from-indigo-600 to-indigo-400 border-indigo-500/25 bg-indigo-500';
      case 'Requote Bike':
        return 'from-violet-600 to-violet-400 border-violet-500/25 bg-violet-500';
      case 'Review':
        return 'from-pink-600 to-pink-400 border-pink-500/25 bg-pink-500';
      case 'Review Van':
        return 'from-rose-600 to-rose-450 border-rose-500/25 bg-rose-500';
      case 'Review Bike':
        return 'from-fuchsia-600 to-fuchsia-400 border-fuchsia-500/25 bg-fuchsia-500';
      case 'Individual Review':
        return 'from-amber-600 to-amber-400 border-amber-500/25 bg-amber-500';
      case 'Other Site':
        return 'from-orange-600 to-orange-400 border-orange-500/25 bg-orange-500';
      case 'Van':
        return 'from-teal-600 to-teal-400 border-teal-500/25 bg-teal-500';
      case 'Bike':
        return 'from-cyan-600 to-cyan-400 border-cyan-500/25 bg-cyan-500';
      case 'Sale':
        return 'from-emerald-600 to-emerald-400 border-emerald-500/25 bg-emerald-500';
      default:
        return 'from-slate-650 to-slate-450 border-slate-500/25 bg-slate-500';
    }
  };

  const scopedDaysCount = useMemo(() => {
    if (metricsTimeScope === 'yearly') {
      const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      return isLeap(parseInt(selectedYear, 10)) ? 366 : 365;
    } else {
      const yearNum = parseInt(selectedYear, 10);
      const monthNum = parseInt(selectedMonth, 10);
      return new Date(yearNum, monthNum, 0).getDate();
    }
  }, [selectedYear, selectedMonth, metricsTimeScope]);

  // Aggregate data by month for the selected year (Always yearly chart display)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: monthsList[i].name.substring(0, 3),
      fullName: monthsList[i].name,
      quotes: 0,
      requotes: 0,
      reviews: 0,
      sales: 0,
      total: 0
    }));

    systemYearRecords.forEach(r => {
      if (!r.submitted_at) return;
      const date = new Date(r.submitted_at);
      const monthIdx = date.getMonth();
      if (monthIdx >= 0 && monthIdx < 12) {
        months[monthIdx].total++;
        const type = r.file_type || '';
        if (type === 'Quote') {
          months[monthIdx].quotes++;
        } else if (type === 'Requote') {
          months[monthIdx].requotes++;
        } else if (type.toLowerCase().includes('review')) {
          months[monthIdx].reviews++;
        } else if (type === 'Sale') {
          months[monthIdx].sales++;
        }
      }
    });

    return months;
  }, [systemYearRecords]);

  // Calculate highest monthly value to scale the Y axis on bar chart
  const maxMonthlyVal = useMemo(() => {
    let max = 10; // minimum scale limit
    monthlyData.forEach(m => {
      const val = Math.max(m.quotes, m.requotes, m.reviews, m.sales);
      if (val > max) max = val;
    });
    // Round to next multiple of 5 for clean gridlines
    return Math.ceil(max / 5) * 5;
  }, [monthlyData]);

  // Branches Contribution data (Show top 5 only)
  const branchData = useMemo(() => {
    const branches: Record<string, number> = {};

    systemMetricsFilteredRecords.forEach(r => {
      if (r.branch_name) {
        const bName = r.branch_name.toUpperCase().trim();
        branches[bName] = (branches[bName] || 0) + 1;
      }
    });

    const sortedBranches = Object.entries(branches)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const totalInScope = systemMetricsFilteredRecords.length;

    const formatted = sortedBranches.map(b => ({
      ...b,
      percentage: totalInScope > 0 ? parseFloat(((b.count / totalInScope) * 100).toFixed(2)) : 0
    }));

    return formatted.slice(0, 5);
  }, [systemMetricsFilteredRecords]);

  // Leaderboard data (Show top 5 only)
  const leaderboardData = useMemo(() => {
    const usersCount: Record<string, { userId: string; name: string; codename: string; count: number }> = {};

    // Initialize profiles list
    profilesList.forEach(p => {
      usersCount[p.id] = {
        userId: p.id,
        name: p.full_name || p.username,
        codename: p.username.toUpperCase(),
        count: 0
      };
    });

    // Count records
    systemMetricsFilteredRecords.forEach(r => {
      if (r.user_id && usersCount[r.user_id]) {
        usersCount[r.user_id].count++;
      }
    });

    const sortedLeaderboard = Object.values(usersCount)
      .filter(u => u.count > 0)
      .sort((a, b) => b.count - a.count);

    return sortedLeaderboard.slice(0, 5);
  }, [systemMetricsFilteredRecords, profilesList]);

  // Compute top performer badges from records cache
  const topPerformerBadges = useMemo(() => {
    return calculateTopPerformerBadges(allRecords, profilesList);
  }, [allRecords, profilesList]);



  if (recordsLoading || isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Upper Filter Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/20 p-4 border border-slate-800/40 rounded-2xl backdrop-blur-md animate-pulse">
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-800 rounded-lg"></div>
            <div className="h-3.5 w-64 bg-slate-800/60 rounded-md"></div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="h-8 w-28 bg-slate-800 rounded-xl"></div>
            <div className="h-8 w-32 bg-slate-800 rounded-xl"></div>
            <div className="h-8 w-24 bg-slate-800 rounded-xl"></div>
          </div>
        </div>

        {/* Skeleton Grid: 4 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-955 border border-slate-850/40 p-5 rounded-2xl h-32 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="space-y-2 w-full">
                  <div className="h-3 w-16 bg-slate-800 rounded-md"></div>
                  <div className="h-7 w-20 bg-slate-800 rounded-lg"></div>
                </div>
                <div className="w-10 h-10 bg-slate-800 rounded-xl"></div>
              </div>
              <div className="h-3 w-32 bg-slate-800/60 rounded-md"></div>
            </div>
          ))}
        </div>

        {/* Skeleton Grid: Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          {/* Grouped Bar Chart Placeholder */}
          <div className="lg:col-span-2 bg-slate-955 border border-slate-850/40 p-5 rounded-2xl h-96 flex flex-col justify-between">
            <div className="h-4 w-40 bg-slate-800 rounded-md mb-6"></div>
            <div className="flex-1 flex items-end gap-3 h-52 w-full px-4">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-slate-800 rounded-t-lg" style={{ height: `${20 + (idx % 3) * 20}%` }}></div>
                  <div className="h-3 w-8 bg-slate-800/60 rounded-md"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Branch Contribution Placeholder */}
          <div className="bg-slate-955 border border-slate-850/40 p-5 rounded-2xl h-96 flex flex-col gap-4">
            <div className="h-4 w-32 bg-slate-800 rounded-md"></div>
            <div className="space-y-4 mt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3.5 w-16 bg-slate-800 rounded-md"></div>
                    <div className="h-3.5 w-24 bg-slate-800/80 rounded-md"></div>
                  </div>
                  <div className="h-2 w-full bg-slate-850 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skeleton Bottom Leaderboard Placeholder */}
        <div className="bg-slate-955 border border-slate-850/40 p-5 rounded-2xl h-80 flex flex-col gap-6 animate-pulse">
          <div className="h-4 w-48 bg-slate-800 rounded-md"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-slate-950/40 border border-slate-850/40 p-4 rounded-xl flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800"></div>
                <div className="h-3.5 w-16 bg-slate-800 rounded-md"></div>
                <div className="h-3 w-10 bg-slate-800/60 rounded-md"></div>
                <div className="w-full border-t border-slate-850/30 my-1"></div>
                <div className="h-5 w-8 bg-slate-800 rounded-md"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton Category Distribution Breakdown Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="lg:col-span-2 bg-slate-955 border border-slate-850/40 p-5 rounded-2xl h-96 flex flex-col gap-4">
            <div className="h-4 w-48 bg-slate-800 rounded-md"></div>
            <div className="h-3 w-64 bg-slate-800/60 rounded-md mb-2"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2 p-2 bg-slate-900/10 border border-slate-850/20 rounded-xl">
                  <div className="flex justify-between">
                    <div className="h-3.5 w-16 bg-slate-800 rounded-md"></div>
                    <div className="h-3.5 w-12 bg-slate-800/85 rounded-md"></div>
                  </div>
                  <div className="h-2 w-full bg-slate-850 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-955 border border-slate-850/40 p-5 rounded-2xl h-96 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="h-4 w-32 bg-slate-800 rounded-md"></div>
              <div className="space-y-3">
                <div className="bg-slate-900/30 border border-slate-850/30 p-4 rounded-xl h-16 w-full"></div>
                <div className="bg-slate-900/30 border border-slate-850/30 p-4 rounded-xl h-16 w-full"></div>
              </div>
            </div>
            <div className="border-t border-slate-850/30 pt-4 space-y-2">
              <div className="h-3 w-28 bg-slate-800 rounded-md"></div>
              <div className="h-3 w-full bg-slate-800/60 rounded-md"></div>
              <div className="h-3 w-4/5 bg-slate-800/60 rounded-md"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upper Filter & Headers */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/20 p-4 border border-slate-800/40 rounded-2xl backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Performance Analytics Panel
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">Visualize your quotes, requotes, sales records, and leaderboard trends.</p>
        </div>

        <div className="flex flex-row flex-nowrap items-center gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 w-full lg:w-auto custom-scrollbar">
          {/* Time Scope Toggle: Yearly vs Monthly */}
          <div className="flex items-center bg-slate-950/40 border border-slate-850 p-1 rounded-xl">
            <button
              onClick={() => setMetricsTimeScope('yearly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${metricsTimeScope === 'yearly'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white font-medium'
                }`}
            >
              Yearly
            </button>
            <button
              onClick={() => setMetricsTimeScope('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${metricsTimeScope === 'monthly'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white font-medium'
                }`}
            >
              Monthly
            </button>
          </div>

          {/* Month Selector (Always visible to everyone) */}
          <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-850 px-3 py-1.5 rounded-xl">
            <Calendar className="h-4 w-4 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs text-slate-350 outline-none border-none cursor-pointer focus:text-white font-semibold"
            >
              {monthsList.map(m => (
                <option key={m.value} value={m.value} className="bg-slate-950 text-slate-350">{m.name}</option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-850 px-3 py-1.5 rounded-xl">
            <Calendar className="h-4 w-4 text-slate-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs text-slate-350 outline-none border-none cursor-pointer focus:text-white font-semibold"
            >
              {availableYears.map(year => (
                <option key={year} value={year} className="bg-slate-950 text-slate-350">Year {year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid: Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Quotes */}
        <div className="relative overflow-hidden bg-slate-950/30 border border-slate-800/40 hover:border-[#3b82f6]/30 p-5 rounded-2xl shadow-xl transition-all duration-300 group hover:shadow-[#3b82f6]/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#3b82f6]/5 rounded-full blur-2xl group-hover:bg-[#3b82f6]/10 transition-all duration-300"></div>
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold text-slate-400">Total Quotes</p>
              <div className="space-y-1 mt-1.5">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-all">{stats.quotes}</h3>
                <div>
                  <GrowthBadge {...getGrowthStats(stats.quotes, previousStats.quotes)} />
                </div>
              </div>
            </div>
            <div className="p-2.5 bg-[#3b82f6]/15 border border-[#3b82f6]/20 text-[#3b82f6] rounded-xl shrink-0">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 font-medium flex justify-between items-center">
            <span>Quotes in {metricsTimeScope === 'yearly' ? selectedYear : `${monthsList.find(m => m.value === selectedMonth)?.name} ${selectedYear}`}</span>
            <span className="text-[9px] text-slate-450 opacity-80">vs. prev {metricsTimeScope === 'yearly' ? 'year' : 'month'}</span>
          </p>
        </div>

        {/* Card 2: Total Requotes */}
        <div className="relative overflow-hidden bg-slate-950/30 border border-slate-800/40 hover:border-[#a855f7]/30 p-5 rounded-2xl shadow-xl transition-all duration-300 group hover:shadow-[#a855f7]/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#a855f7]/5 rounded-full blur-2xl group-hover:bg-[#a855f7]/10 transition-all duration-300"></div>
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold text-slate-400">Total Requotes</p>
              <div className="space-y-1 mt-1.5">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-all">{stats.requotes}</h3>
                <div>
                  <GrowthBadge {...getGrowthStats(stats.requotes, previousStats.requotes)} />
                </div>
              </div>
            </div>
            <div className="p-2.5 bg-[#a855f7]/15 border border-[#a855f7]/20 text-[#a855f7] rounded-xl shrink-0">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 font-medium flex justify-between items-center">
            <span>Requotes in {metricsTimeScope === 'yearly' ? selectedYear : `${monthsList.find(m => m.value === selectedMonth)?.name} ${selectedYear}`}</span>
            <span className="text-[9px] text-slate-450 opacity-80">vs. prev {metricsTimeScope === 'yearly' ? 'year' : 'month'}</span>
          </p>
        </div>

        {/* Card 3: Total Reviews */}
        <div className="relative overflow-hidden bg-slate-950/30 border border-slate-800/40 hover:border-[#ec4899]/30 p-5 rounded-2xl shadow-xl transition-all duration-300 group hover:shadow-[#ec4899]/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#ec4899]/5 rounded-full blur-2xl group-hover:bg-[#ec4899]/10 transition-all duration-300"></div>
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold text-slate-400">Total Reviews</p>
              <div className="space-y-1 mt-1.5">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-all">{stats.reviews}</h3>
                <div>
                  <GrowthBadge {...getGrowthStats(stats.reviews, previousStats.reviews)} />
                </div>
              </div>
            </div>
            <div className="p-2.5 bg-[#ec4899]/15 border border-[#ec4899]/20 text-[#ec4899] rounded-xl shrink-0">
              <Eye className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 font-medium flex justify-between items-center">
            <span>Reviews in {metricsTimeScope === 'yearly' ? selectedYear : `${monthsList.find(m => m.value === selectedMonth)?.name} ${selectedYear}`}</span>
            <span className="text-[9px] text-slate-450 opacity-80">vs. prev {metricsTimeScope === 'yearly' ? 'year' : 'month'}</span>
          </p>
        </div>

        {/* Card 4: Total Sales */}
        <div className="relative overflow-hidden bg-slate-950/30 border border-slate-800/40 hover:border-[#10b981]/30 p-5 rounded-2xl shadow-xl transition-all duration-300 group hover:shadow-[#10b981]/5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#10b981]/5 rounded-full blur-2xl group-hover:bg-[#10b981]/10 transition-all duration-300"></div>
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold text-slate-400">Total Sales</p>
              <div className="space-y-1 mt-1.5">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-all">{stats.sales}</h3>
                <div>
                  <GrowthBadge {...getGrowthStats(stats.sales, previousStats.sales)} />
                </div>
              </div>
            </div>
            <div className="p-2.5 bg-[#10b981]/15 border border-[#10b981]/20 text-[#10b981] rounded-xl shrink-0">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 font-medium flex justify-between items-center">
            <span>Sales in {metricsTimeScope === 'yearly' ? selectedYear : `${monthsList.find(m => m.value === selectedMonth)?.name} ${selectedYear}`}</span>
            <span className="text-[9px] text-slate-450 opacity-80">vs. prev {metricsTimeScope === 'yearly' ? 'year' : 'month'}</span>
          </p>
        </div>

        {/* Card 5: Conversion Rate (Commented out) */}
        {/*
        <div className="relative overflow-hidden bg-slate-950/30 border border-slate-800/40 hover:border-amber-500/30 p-5 rounded-2xl shadow-xl transition-all duration-300 group hover:shadow-amber-950/10">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/5 rounded-full blur-2xl group-hover:bg-amber-600/10 transition-all duration-300"></div>
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold text-slate-400">Conversion Rate</p>
              <div className="space-y-1 mt-1.5">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-all">{stats.conversionRate.toFixed(2)}%</h3>
                <div>
                  <GrowthBadge {...getRateGrowthStats(stats.conversionRate, previousStats.conversionRate)} />
                </div>
              </div>
            </div>
            <div className="p-2.5 bg-amber-600/15 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 font-medium flex justify-between items-center">
            <span>Ratio in {metricsTimeScope === 'yearly' ? selectedYear : `${monthsList.find(m => m.value === selectedMonth)?.name} ${selectedYear}`}</span>
            <span className="text-[9px] text-slate-450 opacity-80">vs. prev {metricsTimeScope === 'yearly' ? 'year' : 'month'}</span>
          </p>
        </div>
        */}
      </div>

      {/* Grid: Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly submissions grouped bar chart (Occupies 2 columns on desktop) */}
        <div className="lg:col-span-2 bg-slate-950/30 border border-slate-800/40 p-5 rounded-2xl shadow-xl relative min-h-96">
          <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
            <Calendar className="h-4.5 w-4.5 text-blue-400" />
            Monthly Submission Volumes ({selectedYear})
          </h4>

          {/* Custom SVG Grouped Bar Chart */}
          <div className="w-full h-64 relative">
            <svg
              viewBox="0 0 800 300"
              className="w-full h-full"
              onMouseLeave={() => setHoveredBar(null)}
            >
              {/* Define Gradients for bars */}
              <defs>
                <linearGradient id="quoteGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="requoteGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#7e22ce" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="reviewGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#be185d" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#047857" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {Array.from({ length: 5 }).map((_, idx) => {
                const y = 30 + idx * 50;
                const gridVal = Math.round(maxMonthlyVal - (idx * maxMonthlyVal) / 4);
                return (
                  <g key={idx}>
                    <line
                      x1="50"
                      y1={y}
                      x2="780"
                      y2={y}
                      stroke="#334155"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      opacity="0.3"
                    />
                    <text
                      x="40"
                      y={y + 4}
                      fill="#94a3b8"
                      fontSize="10"
                      textAnchor="end"
                      fontWeight="600"
                    >
                      {gridVal}
                    </text>
                  </g>
                );
              })}

              {/* Render Bars for each month */}
              {monthlyData.map((data, idx) => {
                const monthWidth = (780 - 50) / 12;
                const xStart = 50 + idx * monthWidth;

                // Bar height scales
                const chartHeight = 200; // 230 - 30
                const qHeight = maxMonthlyVal > 0 ? (data.quotes / maxMonthlyVal) * chartHeight : 0;
                const rHeight = maxMonthlyVal > 0 ? (data.requotes / maxMonthlyVal) * chartHeight : 0;
                const revHeight = maxMonthlyVal > 0 ? (data.reviews / maxMonthlyVal) * chartHeight : 0;
                const sHeight = maxMonthlyVal > 0 ? (data.sales / maxMonthlyVal) * chartHeight : 0;

                const barWidth = 8;
                const gap = 2;
                const xCenter = xStart + monthWidth / 2;

                // X offsets inside the month group for 4 bars
                const qX = xCenter - 2 * barWidth - 1.5 * gap;
                const rX = xCenter - barWidth - 0.5 * gap;
                const revX = xCenter + 0.5 * gap;
                const sX = xCenter + barWidth + 1.5 * gap;

                const baseLineY = 230;

                return (
                  <g key={idx}>
                    {/* Month Label */}
                    <text
                      x={xStart + monthWidth / 2}
                      y="255"
                      fill="#94a3b8"
                      fontSize="10"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {data.name}
                    </text>

                    <>
                      {/* Quote Bar */}
                      {data.quotes > 0 && (
                        <rect
                          x={qX}
                          y={baseLineY - qHeight}
                          width={barWidth}
                          height={qHeight}
                          fill="url(#quoteGrad)"
                          rx="2"
                          ry="2"
                          className="cursor-pointer transition-all duration-250 hover:brightness-125"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const container = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                            if (rect && container) {
                              setHoveredBar({
                                x: rect.left - container.left + barWidth / 2,
                                y: rect.top - container.top - 40,
                                month: data.fullName,
                                label: 'Quotes',
                                value: data.quotes,
                                color: '#3b82f6'
                              });
                            }
                          }}
                        />
                      )}

                      {/* Requote Bar */}
                      {data.requotes > 0 && (
                        <rect
                          x={rX}
                          y={baseLineY - rHeight}
                          width={barWidth}
                          height={rHeight}
                          fill="url(#requoteGrad)"
                          rx="2"
                          ry="2"
                          className="cursor-pointer transition-all duration-250 hover:brightness-125"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const container = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                            if (rect && container) {
                              setHoveredBar({
                                x: rect.left - container.left + barWidth / 2,
                                y: rect.top - container.top - 40,
                                month: data.fullName,
                                label: 'Requotes',
                                value: data.requotes,
                                color: '#a855f7'
                              });
                            }
                          }}
                        />
                      )}

                      {/* Review Bar */}
                      {data.reviews > 0 && (
                        <rect
                          x={revX}
                          y={baseLineY - revHeight}
                          width={barWidth}
                          height={revHeight}
                          fill="url(#reviewGrad)"
                          rx="2"
                          ry="2"
                          className="cursor-pointer transition-all duration-250 hover:brightness-125"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const container = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                            if (rect && container) {
                              setHoveredBar({
                                x: rect.left - container.left + barWidth / 2,
                                y: rect.top - container.top - 40,
                                month: data.fullName,
                                label: 'Reviews',
                                value: data.reviews,
                                color: '#ec4899'
                              });
                            }
                          }}
                        />
                      )}

                      {/* Sale Bar */}
                      {data.sales > 0 && (
                        <rect
                          x={sX}
                          y={baseLineY - sHeight}
                          width={barWidth}
                          height={sHeight}
                          fill="url(#saleGrad)"
                          rx="2"
                          ry="2"
                          className="cursor-pointer transition-all duration-250 hover:brightness-125"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const container = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                            if (rect && container) {
                              setHoveredBar({
                                x: rect.left - container.left + barWidth / 2,
                                y: rect.top - container.top - 40,
                                month: data.fullName,
                                label: 'Sales',
                                value: data.sales,
                                color: '#10b981'
                              });
                            }
                          }}
                        />
                      )}
                    </>
                  </g>
                );
              })}

              {/* Bottom Solid axis line */}
              <line
                x1="50"
                y1="230"
                x2="780"
                y2="230"
                stroke="#475569"
                strokeWidth="1"
                opacity="0.5"
              />
            </svg>

            {/* Render HTML Hover Tooltip for monthly bar chart */}
            {hoveredBar && (
              <div
                className="absolute bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-white shadow-2xl pointer-events-none z-45 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
                style={{
                  left: `${hoveredBar.x}px`,
                  top: `${hoveredBar.y}px`,
                  transform: 'translateX(-50%)'
                }}
              >
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{hoveredBar.month}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredBar.color }}></span>
                  <span className="font-semibold">{hoveredBar.label}:</span>
                  <span className="font-extrabold" style={{ color: hoveredBar.color }}>{hoveredBar.value} files</span>
                </div>
              </div>
            )}
          </div>

          {/* Legends */}
          <div className="flex justify-center items-center gap-6 mt-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#3b82f6] border border-[#1d4ed8]/50"></span>
              <span className="text-slate-400 font-medium">Quotes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#a855f7] border border-[#7e22ce]/50"></span>
              <span className="text-slate-400 font-medium">Requotes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#ec4899] border border-[#be185d]/50"></span>
              <span className="text-slate-400 font-medium">Reviews</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#10b981] border border-[#047857]/50"></span>
              <span className="text-slate-400 font-medium">Sales</span>
            </div>
          </div>
        </div>

        {/* Right column: Branch distributions */}
        <div className="bg-slate-950/30 border border-slate-800/40 p-5 rounded-2xl shadow-xl flex flex-col h-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="h-4.5 w-4.5 text-emerald-400" />
              Branches Contribution ({metricsTimeScope === 'yearly' ? selectedYear : `${monthsList.find(m => m.value === selectedMonth)?.name.substring(0, 3)} ${selectedYear}`})
            </h4>
          </div>

          {branchData.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-slate-500 py-10">
              <MapPin className="h-10 w-10 text-slate-650 stroke-[1.5] mb-2" />
              <p className="text-xs">No branch records available.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {branchData.map((branch, idx) => {
                const colors = [
                  'bg-blue-500 from-blue-600 to-blue-400',
                  'bg-emerald-500 from-emerald-600 to-emerald-400',
                  'bg-purple-500 from-purple-600 to-purple-400',
                  'bg-amber-500 from-amber-600 to-amber-400',
                  'bg-rose-500 from-rose-600 to-rose-400',
                ];

                const colorClass = colors[idx % colors.length];

                return (
                  <div key={branch.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-350">{branch.name}</span>
                      <span className="font-extrabold text-white">{branch.count} entries ({branch.percentage}%)</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-900 border border-slate-850 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${branch.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Segment 3: Bottom Section (Leaderboard) */}
      <div className="bg-slate-950/30 border border-slate-800/40 p-5 rounded-2xl shadow-xl min-h-80">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="h-4.5 w-4.5 text-amber-400" />
              Staff Performance Leaderboard ({metricsTimeScope === 'yearly' ? selectedYear : `${monthsList.find(m => m.value === selectedMonth)?.name.substring(0, 3)} ${selectedYear}`})
            </h4>
          </div>

          {leaderboardData.length === 0 ? (
            <div className="flex flex-col justify-center items-center text-slate-500 py-12">
              <Award className="h-10 w-10 text-slate-650 stroke-[1.5] mb-2" />
              <p className="text-xs">No active staff records found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {leaderboardData.map((user, idx) => {
                  const medalColors = [
                    'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-amber-900/5',
                    'bg-slate-400/10 border-slate-400/30 text-slate-350 shadow-slate-900/5',
                    'bg-amber-700/10 border-amber-700/30 text-amber-700 shadow-amber-900/5',
                    'bg-slate-900 border-slate-800 text-slate-400',
                    'bg-slate-900 border-slate-800 text-slate-400',
                  ];

                  return (
                    <div
                      key={user.codename}
                      className="relative overflow-hidden bg-slate-950/50 border border-slate-850 hover:border-slate-800 p-4 rounded-xl flex flex-col justify-between items-center text-center shadow-lg transition-all duration-300 hover:scale-[1.02] group"
                    >
                      {/* Rank Medal */}
                      <span className={`w-8 h-8 rounded-full border text-xs font-extrabold flex items-center justify-center shadow-md ${idx < 5 ? medalColors[idx] : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                        {idx + 1}
                      </span>

                      <div className="mt-3.5 space-y-1">
                        <h5 className="text-xs font-extrabold text-white truncate max-w-full group-hover:text-blue-400 transition-colors flex items-center justify-center">
                          <span>{user.name}</span>
                          {topPerformerBadges[user.userId] && (
                            <VerifiedBadge badge={topPerformerBadges[user.userId]} />
                          )}
                        </h5>
                        <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{user.codename}</p>
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-slate-900/30 w-full">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Submissions</span>
                        <span className="text-lg font-extrabold text-blue-400 mt-1 block">{user.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Streak & Wins Highlights Box */}
              {leaderboardData.some(u => topPerformerBadges[u.userId]) && (
                <div className="mt-6 bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    🏆 Streak & Performance Highlights
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {leaderboardData
                      .filter(u => topPerformerBadges[u.userId])
                      .map(user => {
                        const badge = topPerformerBadges[user.userId];
                        return (
                          <div key={user.userId} className="bg-slate-950/45 border border-slate-850/50 p-3 rounded-lg flex flex-col justify-center space-y-1">
                            <div className="flex items-center justify-between text-xs border-b border-slate-900 pb-1.5 mb-1.5">
                              <span className="font-bold text-white truncate">{user.name}</span>
                              <span className="text-[9px] font-mono text-slate-500 uppercase">{user.codename}</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>Consecutive:</span>
                              <span className="text-blue-400 font-bold">{badge.consecutiveMonths} mo</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>Yearly Wins:</span>
                              <span className="text-amber-400 font-bold">{badge.yearlyTopPerformances}x</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Segment 4: Category Breakdown & Operational Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 columns: Category Distribution */}
        <div className="lg:col-span-2 bg-slate-955/30 border border-slate-800/40 p-5 rounded-2xl shadow-xl flex flex-col min-h-96">
          <h4 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-400 animate-pulse" />
            File Category Distribution Breakdown ({metricsTimeScope === 'yearly' ? selectedYear : `${monthsList.find(m => m.value === selectedMonth)?.name} ${selectedYear}`})
          </h4>

          <p className="text-xs text-slate-400 mb-4 font-medium">
            Detailed breakdown of all 12 custom file types submitted during the selected period.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {categoryBreakdown.map((cat) => {
              const bgGradientClass = getCategoryColor(cat.name);
              return (
                <div key={cat.name} className="space-y-1.5 p-2 bg-slate-900/10 border border-slate-850/30 rounded-xl hover:bg-slate-900/20 hover:border-slate-850 transition-all duration-200">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-350">{cat.name}</span>
                    <span className="font-extrabold text-white">{cat.count} <span className="text-[10px] text-slate-500 font-bold">({cat.percentage}%)</span></span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-955 rounded-full overflow-hidden border border-slate-850">
                    <div
                      className={`h-full bg-gradient-to-r ${bgGradientClass} rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${cat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 column: Operational Insights */}
        <div className="bg-slate-950/30 border border-slate-800/40 p-5 rounded-2xl shadow-xl flex flex-col justify-between min-h-96">
          <div>
            <h4 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
              Operational Insights
            </h4>

            <div className="space-y-4">
              {/* Stat item 1 */}
              <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Average Submissions / Day</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-white">{(systemMetricsFilteredRecords.length / scopedDaysCount).toFixed(1)}</span>
                  <span className="text-xs text-slate-400 font-semibold">entries / day</span>
                </div>
              </div>

              {/* Stat item 2 */}
              <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Dominant Submission Type</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-white truncate max-w-[65%]">{dominantActivity.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                    {dominantActivity.count} files
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/50">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Automated Executive Summary</span>
            <p className="text-xs text-slate-350 leading-relaxed font-medium">
              {systemMetricsFilteredRecords.length === 0 ? (
                "No submission activities recorded for this period. Start logging entries to view insights."
              ) : (
                `During this period, a total of ${systemMetricsFilteredRecords.length} records were processed. The system achieved a sales conversion rate of ${stats.conversionRate.toFixed(2)}% (${stats.sales} sales out of ${stats.quotes} quotes). ${dominantActivity.count > 0
                  ? `The primary driver of activity was ${dominantActivity.name}, contributing to ${dominantActivity.percentage.toFixed(2)}% of all operations.`
                  : ''
                }`
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
