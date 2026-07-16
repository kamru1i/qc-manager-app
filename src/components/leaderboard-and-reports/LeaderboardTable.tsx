import React from "react";
import {
  Award,
  Search,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
} from "lucide-react";
import { Profile } from "@/types";
import { useLeaderboardData } from "@/hooks/quotes-tracker/useLeaderboardData";
import { LeaderboardRow } from "./LeaderboardRow";
import { LeaderboardSkeleton } from "@/components/common/skeleton/LeaderboardSkeleton";
import { downloadCSVRows } from "@/utils/quotesDashboardHelpers";

interface LeaderboardTableProps {
  profile: Profile | null;
  onViewFullReport?: () => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  profile,
  onViewFullReport,
}) => {
  const {
    leaderboardData,
    loading,
    error,
    leaderboardPeriod,
    selectedYear,
    selectedMonth,
    setSelectedMonth,
    searchQuery,
    setSearchQuery,
    availableMonthsForSelectedYear,
  } = useLeaderboardData(profile);

  const isAdmin = profile?.role === "admin";

  const handleExportExcel = () => {
    const periodLabel =
      leaderboardPeriod === "monthly"
        ? `${availableMonthsForSelectedYear.find((m) => m.value === selectedMonth)?.name || 'Month'}-${selectedYear}`
        : selectedYear;
    downloadCSVRows(
      [
        "Rank",
        "Name",
        "Codename",
        "Department",
        "Branch",
        "Quotes",
        "Requotes",
        "Reviews",
        "Sales",
        "Today",
        "Overall Score",
        "Total Submitted",
      ],
      leaderboardData.map((u) => [
        u.rank,
        u.full_name || u.username,
        u.username.toUpperCase(),
        u.job_role || "",
        u.branch || "",
        u.quotes_count,
        u.requotes_count,
        u.reviews_count,
        u.sales_count,
        u.todays_count,
        u.overall_score,
        u.total_submitted,
      ]),
      `Leaderboard_${periodLabel}`,
    );
  };

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls Card */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 backdrop-blur-md shadow-lg">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-500" />
              <h2 className="text-xl font-bold text-white tracking-wide">
                Performance Leaderboard
              </h2>
            </div>
            <p className="text-slate-400 text-xs">
              Live ranks and submission statistics, updated in real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            {/* Month Dropdown (Always visible, filtered by months containing submissions) */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 transition-all"
            >
              {availableMonthsForSelectedYear.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>

            {/* View Report Button */}
            {onViewFullReport && (
              <button
                onClick={onViewFullReport}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl px-3.5 py-2 transition-all shadow-md shadow-blue-900/20 cursor-pointer"
              >
                View Report
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Row - Search Input Only */}
      <div className="max-w-md">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </span>
          <input
            type="text"
            placeholder="Search by name or codename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/30 hover:bg-slate-900/50 border border-slate-800/80 hover:border-slate-700/80 text-white placeholder-slate-500 text-xs rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-950/30 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Leaderboard Table Card */}
      <div className="bg-slate-950/40 border border-slate-850/60 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="p-5 border-b border-slate-850/30 flex flex-wrap justify-between items-center gap-3 bg-slate-900/20">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-500" />
            Rankings ({leaderboardPeriod === "monthly" ? "Monthly" : "Yearly"})
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1">
              Total Staff:{" "}
              <strong className="text-white font-semibold">
                {leaderboardData.length}
              </strong>
            </span>
            {isAdmin && (
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg px-2.5 py-1 transition-all cursor-pointer"
                title="Export leaderboard to Excel (CSV)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export Excel
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850/30 bg-slate-900/10 text-xs font-semibold text-slate-400">
                <th className="p-4 pl-6 text-left w-[36%]">Employee Name</th>
                <th className="p-4 text-center w-[16%]">Current Rank</th>
                <th className="p-4 text-center w-[16%]">Today</th>
                <th className="p-4 text-center w-[16%]">Monthly</th>
                <th className="p-4 text-center w-[16%] pr-6">Yearly</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-12 text-center text-slate-500 text-xs"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-slate-600" />
                      <span>No staff found matching the current filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                leaderboardData.map((user) => (
                  <LeaderboardRow
                    key={user.user_id}
                    user={user}
                    isCurrentUser={user.user_id === profile?.id}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
