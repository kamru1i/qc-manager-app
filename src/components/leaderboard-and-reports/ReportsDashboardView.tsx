import React, { useState, useMemo } from 'react';
import { Calendar, TrendingUp } from 'lucide-react';
import { RecordItem, Profile } from '@/types';
import { ReportSummaryCards } from './ReportSummaryCards';
import { SubmissionVolumeChart } from './SubmissionVolumeChart';
import { BranchContributionChart } from './BranchContributionChart';
import { FileCategoryChart } from './FileCategoryChart';
import { OperationalInsights } from './OperationalInsights';
import { CustomSelect } from '@/components/common/CustomSelect';
import {
  monthsList,
  computeTypeStats,
  ALL_12_CATEGORIES,
  getScopeLabel,
} from './reportHelpers';

interface ReportsDashboardViewProps {
  records: RecordItem[];
  profilesList: Profile[];
  profile: Profile | null;
}

export const ReportsDashboardView: React.FC<ReportsDashboardViewProps> = ({
  records,
  profilesList,
  profile,
}) => {
  // Available years from records
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    records.forEach((r) => {
      if (r.submitted_at) {
        const year = new Date(r.submitted_at).getFullYear().toString();
        if (year && !isNaN(parseInt(year, 10))) {
          yearsSet.add(year);
        }
      }
    });
    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear().toString());
    }
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const [selectedYear, setSelectedYear] = useState<string>(
    () => availableYears[0] || new Date().getFullYear().toString()
  );

  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [metricsTimeScope, setMetricsTimeScope] = useState<'yearly' | 'monthly'>('monthly');

  // Available months containing submissions in the selected year
  const availableMonthsForSelectedYear = useMemo(() => {
    const monthsSet = new Set<string>();
    records.forEach((r) => {
      if (r.submitted_at) {
        const d = new Date(r.submitted_at);
        const y = d.getFullYear().toString();
        if (y === selectedYear) {
          const m = String(d.getMonth() + 1).padStart(2, '0');
          monthsSet.add(m);
        }
      }
    });

    // Always include current calendar month if it's the current year
    const now = new Date();
    if (selectedYear === now.getFullYear().toString()) {
      monthsSet.add(String(now.getMonth() + 1).padStart(2, '0'));
    }

    const filteredList = monthsList.filter((m) => monthsSet.has(m.value));
    return filteredList.length > 0 ? filteredList : monthsList;
  }, [records, selectedYear]);

  // Sync selectedYear if availableYears updates
  React.useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // Sync selectedMonth if availableMonthsForSelectedYear updates
  React.useEffect(() => {
    const monthValues = availableMonthsForSelectedYear.map((m) => m.value);
    if (monthValues.length > 0 && !monthValues.includes(selectedMonth)) {
      setSelectedMonth(monthValues[0]);
    }
  }, [availableMonthsForSelectedYear, selectedMonth]);

  // Filter records by selected year
  const systemYearRecords = useMemo(() => {
    return records.filter((r) => {
      if (!r.submitted_at) return false;
      const date = new Date(r.submitted_at);
      return date.getFullYear().toString() === selectedYear;
    });
  }, [records, selectedYear]);

  // Filter by year + month scope
  const systemMetricsFilteredRecords = useMemo(() => {
    if (metricsTimeScope === 'yearly') {
      return systemYearRecords;
    }
    return systemYearRecords.filter((r) => {
      if (!r.submitted_at) return false;
      const date = new Date(r.submitted_at);
      const mStr = String(date.getMonth() + 1).padStart(2, '0');
      return mStr === selectedMonth;
    });
  }, [systemYearRecords, metricsTimeScope, selectedMonth]);

  // Previous period records for growth comparison
  const previousSystemPeriodFilteredRecords = useMemo(() => {
    const currentYearNum = parseInt(selectedYear, 10);
    if (metricsTimeScope === 'yearly') {
      const prevYear = (currentYearNum - 1).toString();
      return records.filter((r) => {
        if (!r.submitted_at) return false;
        return new Date(r.submitted_at).getFullYear().toString() === prevYear;
      });
    }
    const currentMonthNum = parseInt(selectedMonth, 10);
    let prevYear = currentYearNum;
    let prevMonthNum = currentMonthNum - 1;
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYear = currentYearNum - 1;
    }
    const prevYearStr = prevYear.toString();
    const prevMonthStr = String(prevMonthNum).padStart(2, '0');
    return records.filter((r) => {
      if (!r.submitted_at) return false;
      const date = new Date(r.submitted_at);
      const mStr = String(date.getMonth() + 1).padStart(2, '0');
      return date.getFullYear().toString() === prevYearStr && mStr === prevMonthStr;
    });
  }, [records, selectedYear, selectedMonth, metricsTimeScope]);

  // Compute stats
  const stats = useMemo(() => computeTypeStats(systemMetricsFilteredRecords), [systemMetricsFilteredRecords]);
  const previousStats = useMemo(() => computeTypeStats(previousSystemPeriodFilteredRecords), [previousSystemPeriodFilteredRecords]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_12_CATEGORIES.forEach((cat) => { counts[cat] = 0; });
    systemMetricsFilteredRecords.forEach((r) => {
      if (r.file_type && counts[r.file_type] !== undefined) {
        counts[r.file_type]++;
      }
    });
    const total = Object.values(counts).reduce((acc, curr) => acc + curr, 0);
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [systemMetricsFilteredRecords]);

  const dominantActivity = useMemo(() => {
    if (categoryBreakdown.length === 0 || categoryBreakdown.every((c) => c.count === 0)) {
      return { name: 'None', count: 0, percentage: 0 };
    }
    return categoryBreakdown[0];
  }, [categoryBreakdown]);

  // Branch data
  const branchData = useMemo(() => {
    const branches: Record<string, number> = {};
    systemMetricsFilteredRecords.forEach((r) => {
      if (r.branch_name) {
        const bName = r.branch_name.toUpperCase().trim();
        branches[bName] = (branches[bName] || 0) + 1;
      }
    });
    const totalInScope = systemMetricsFilteredRecords.length;
    return Object.entries(branches)
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalInScope > 0 ? parseFloat(((count / totalInScope) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [systemMetricsFilteredRecords]);

  // Monthly data for bar chart
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: monthsList[i].name.substring(0, 3),
      fullName: monthsList[i].name,
      quotes: 0,
      requotes: 0,
      reviews: 0,
      sales: 0,
      total: 0,
    }));
    systemYearRecords.forEach((r) => {
      if (!r.submitted_at) return;
      const date = new Date(r.submitted_at);
      const monthIdx = date.getMonth();
      if (monthIdx >= 0 && monthIdx < 12) {
        months[monthIdx].total++;
        const type = r.file_type || '';
        if (type === 'Quote') months[monthIdx].quotes++;
        else if (type === 'Requote') months[monthIdx].requotes++;
        else if (type.toLowerCase().includes('review')) months[monthIdx].reviews++;
        else if (type === 'Sale') months[monthIdx].sales++;
      }
    });
    return months;
  }, [systemYearRecords]);

  const maxMonthlyVal = useMemo(() => {
    let max = 10;
    monthlyData.forEach((m) => {
      const val = Math.max(m.quotes, m.requotes, m.reviews, m.sales);
      if (val > max) max = val;
    });
    return Math.ceil(max / 5) * 5;
  }, [monthlyData]);

  // Days count for operational insights
  const scopedDaysCount = useMemo(() => {
    if (metricsTimeScope === 'yearly') {
      const year = parseInt(selectedYear, 10);
      const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return isLeap(year) ? 366 : 365;
    }
    return new Date(parseInt(selectedYear, 10), parseInt(selectedMonth, 10), 0).getDate();
  }, [selectedYear, selectedMonth, metricsTimeScope]);

  const scopeLabel = getScopeLabel(metricsTimeScope, selectedYear, selectedMonth);

  return (
    <div className="space-y-6">
      {/* Filter Header (Remove backdrop-blur-md to fix Safari native select dropdown popup glitch) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/80 p-4 border border-slate-800/60 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Performance Reports
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Detailed volumes, charts, and branch contributions in real-time.
          </p>
        </div>

        <div className="flex flex-col items-center sm:flex-row sm:items-center gap-3 w-full lg:w-auto shrink-0">
          <div className="flex items-center bg-slate-950/60 border border-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setMetricsTimeScope('yearly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                metricsTimeScope === 'yearly' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white font-medium'
              }`}
            >
              Yearly
            </button>
            <button
              onClick={() => setMetricsTimeScope('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                metricsTimeScope === 'monthly' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white font-medium'
              }`}
            >
              Monthly
            </button>
          </div>

          <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl min-w-[100px]">
              <CustomSelect
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={availableMonthsForSelectedYear.map((m) => ({
                  value: m.value,
                  label: m.name,
                }))}
                buttonClassName="bg-transparent border-none text-slate-300 hover:text-white text-base md:text-xs outline-none focus:outline-none focus:ring-0 cursor-pointer font-semibold flex items-center justify-between gap-1 w-full select-none text-left p-0"
                className="w-full"
              />
            </div>
            <div className="flex-1 sm:flex-none flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl min-w-[80px]">
              <CustomSelect
                value={selectedYear}
                onChange={setSelectedYear}
                options={availableYears.map((year) => ({
                  value: year,
                  label: year,
                }))}
                buttonClassName="bg-transparent border-none text-slate-300 hover:text-white text-base md:text-xs outline-none focus:outline-none focus:ring-0 cursor-pointer font-semibold flex items-center justify-between gap-1 w-full select-none text-left p-0"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <ReportSummaryCards
        stats={stats}
        previousStats={previousStats}
        scopeLabel={scopeLabel}
        comparisonLabel={metricsTimeScope === 'yearly' ? 'year' : 'month'}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SubmissionVolumeChart
          monthlyData={monthlyData}
          maxMonthlyVal={maxMonthlyVal}
          selectedYear={selectedYear}
        />
        <BranchContributionChart
          branchData={branchData}
          scopeLabel={scopeLabel}
        />
      </div>

      {/* Category Breakdown & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FileCategoryChart
          categoryBreakdown={categoryBreakdown}
          scopeLabel={scopeLabel}
        />
        <OperationalInsights
          totalRecords={systemMetricsFilteredRecords.length}
          scopedDaysCount={scopedDaysCount}
          dominantActivity={dominantActivity}
          stats={stats}
        />
      </div>
    </div>
  );
};
