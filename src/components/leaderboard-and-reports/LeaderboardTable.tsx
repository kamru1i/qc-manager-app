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
import { CustomSelect } from "@/components/common/CustomSelect";
import { supabase } from "@/utils/supabase";
import { isAdminRole, isFeatureEnabled } from '@/utils/permissionService';
import { getGlobalSettingsFromProfile } from '@/utils/dashboardHelpers';

interface LeaderboardTableProps {
  profile: Profile | null;
  onViewFullReport?: () => void;
  onBack?: () => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  profile,
  onViewFullReport,
  onBack,
}) => {
  const {
    leaderboardData,
    loading,
    error,
    leaderboardPeriod,
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
  } = useLeaderboardData(profile);

  const isAdmin = isAdminRole(profile);
  const gs = getGlobalSettingsFromProfile(profile);
  const yearlyEnabled = isFeatureEnabled('yearly_leaderboard', gs, profile);
  const csvEnabled = isFeatureEnabled('csv_export', gs, profile);

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

    if (profile?.id) {
      try {
        supabase.from('audit_logs').insert({
          actor_id: profile.id,
          actor_codename: profile.username || 'SYSTEM',
          action_type: 'EXPORT_CSV',
          target_id: null,
          details: `Exported Leaderboard data for ${periodLabel} (${leaderboardData.length} entries) to CSV/Excel`,
        }).then(({ error }) => {
          if (error) console.error('Failed to log Leaderboard export:', error);
        });
      } catch (err) {
        console.error('Failed to log export:', err);
      }
    }
  };

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-950/30 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Leaderboard Table Card */}
      <div className="bg-slate-950/40 border border-slate-850/60 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
        <div className="p-5 border-b border-slate-850/30 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/20">
          {/* Left: Title, Staff Count & Export Excel */}
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-500" />
              Leaderboard (
              {leaderboardPeriod === "monthly"
                ? "Monthly"
                : `Yearly ${selectedYear}`}
              )
              {isArchivedYear && (
                <span className="inline-flex items-center gap-1 normal-case tracking-normal bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[10px] font-bold rounded-lg px-2 py-0.5">
                  Archived
                </span>
              )}
            </h3>
            <span className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1">
              Total:{" "}
              <strong className="text-theme-text-primary font-semibold">
                {leaderboardData.length}
              </strong>
            </span>
            {isAdmin && csvEnabled && (
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg px-2.5 py-1 transition-all cursor-pointer"
                title="Export leaderboard to Excel (CSV)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </button>
            )}
          </div>

          {/* Right: Search box, Monthly/Yearly toggle, Month/Year dropdown, View Report btn */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end shrink-0 relative z-30">
            {/* Search Input */}
            <div className="w-full sm:w-auto min-w-[200px] flex-1 sm:flex-none">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  placeholder="Search by name or codename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800/60 hover:border-slate-700/60 text-theme-text-primary placeholder-slate-500 text-xs rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Monthly / Yearly period toggle (feature-flagged) */}
            {yearlyEnabled && (
              <div className="flex bg-slate-950/85 p-1 rounded-xl border border-slate-800/80 text-xs shrink-0">
                <button
                  onClick={() => changePeriod("monthly")}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    leaderboardPeriod === "monthly"
                      ? "bg-blue-600/15 border border-blue-500/20 text-blue-400"
                      : "text-slate-400 hover:text-theme-text-primary border border-transparent"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => changePeriod("yearly")}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    leaderboardPeriod === "yearly"
                      ? "bg-blue-600/15 border border-blue-500/20 text-blue-400"
                      : "text-slate-400 hover:text-theme-text-primary border border-transparent"
                  }`}
                >
                  Yearly
                </button>
              </div>
            )}

            {/* Monthly view: month dropdown. Yearly view: year dropdown */}
            {leaderboardPeriod === "monthly" ? (
              <CustomSelect
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={availableMonthsForSelectedYear.map((m) => ({
                  value: m.value,
                  label: m.name,
                }))}
                buttonClassName="w-28 bg-slate-950/85 border border-slate-800/80 hover:border-slate-700 text-theme-text-primary text-base md:text-xs rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 transition-all flex items-center justify-between gap-2 text-left font-bold"
                className="w-28"
              />
            ) : (
              <CustomSelect
                value={selectedYear}
                onChange={setSelectedYear}
                options={availableYears.map((y) => ({ value: y, label: y }))}
                buttonClassName="w-28 bg-slate-950/85 border border-slate-800/80 hover:border-slate-700 text-theme-text-primary text-base md:text-xs rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 transition-all flex items-center justify-between gap-2 text-left font-bold"
                className="w-28"
              />
            )}

            {/* View Report Button */}
            {onViewFullReport && (
              <button
                onClick={onViewFullReport}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl px-3.5 py-2 transition-all shadow-md shadow-blue-900/20 cursor-pointer shrink-0"
              >
                View Report
                <ChevronRight className="h-3.5 w-3.5" />
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
