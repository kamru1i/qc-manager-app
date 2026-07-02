import React from 'react';
import { User, Plus, Download, Search } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { SkeletonLoader } from './SkeletonLoader';

export interface Profile {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'user';
  username_changes?: number;
  username_request_status?: 'none' | 'pending' | 'approved';
  full_name?: string | null;
  working_hours?: number;
  break_time?: number;
  is_setup_completed?: boolean;
  job_role?: string | null;
  requested_full_name?: string | null;
  requested_working_hours?: number | null;
  requested_break_time?: number | null;
  requested_job_role?: string | null;
  profile_change_status?: 'none' | 'pending' | 'approved' | 'rejected';
  default_sign_in?: string | null;
  default_sign_out?: string | null;
  requested_default_sign_in?: string | null;
  requested_default_sign_out?: string | null;
  needs_supervisor_approval?: boolean;
  allow_reserve?: boolean;
  allow_overtime?: boolean;
  has_edited_profile?: boolean;
  has_changed_password?: boolean;
}

interface StaffMasterTableProps {
  profilesList: Profile[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  getUserSummaryStats: (id: string) => { full: number; short: string; overtime: string };
  selectedYear: string;
  setSelectedYear: (val: string) => void;
  availableYears: string[];
  onAddStaffClick: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onViewDetails: (id: string) => void;
  initialFetchDone?: boolean;
}

export const StaffMasterTable: React.FC<StaffMasterTableProps> = ({
  profilesList,
  searchQuery,
  setSearchQuery,
  getUserSummaryStats,
  selectedYear,
  setSelectedYear,
  availableYears,
  onAddStaffClick,
  onExportExcel,
  onExportPDF,
  onViewDetails,
  initialFetchDone = true,
}) => {
  const yearOptions = [
    { value: 'all', label: 'All' },
    ...availableYears.map((y) => ({ value: y, label: y })),
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-900 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <User className="h-5 w-5 text-orange-500" /> Staff Leave Master Database
        </h3>

        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-slate-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search by name or codename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-10 py-1.5 bg-white border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs transition-all dark:bg-slate-955/80 dark:border-slate-800 dark:text-white dark:placeholder-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer text-sm font-semibold"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Master Export Summary buttons */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <button
            onClick={onAddStaffClick}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-orange-600 text-orange-600 dark:border-orange-500 dark:text-orange-500 hover:bg-orange-600/10 dark:hover:bg-orange-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Add Staff
          </button>
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-500 hover:bg-emerald-600/10 dark:hover:bg-emerald-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={onExportPDF}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 hover:bg-red-600/10 dark:hover:bg-red-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
          <CustomSelect
            value={selectedYear}
            onChange={setSelectedYear}
            options={yearOptions}
            className="min-w-[80px]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        {!initialFetchDone ? (
          <div className="p-6">
            <SkeletonLoader variant="staff-table" rows={5} />
          </div>
        ) : profilesList.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No staff profiles found.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-955/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Codename</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Leave</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Short Leave</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Overtime</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-900/20">
              {profilesList
                .filter(p =>
                  (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((p) => {
                  const stats = getUserSummaryStats(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-900/30 transition-all">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">
                        {p.full_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-355 font-mono text-center">
                        {p.username ? p.username.toUpperCase() : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-355 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-slate-900 border-slate-800 text-slate-300">
                          {p.job_role || (p.role === 'admin' ? 'Admin' : (p.role === 'supervisor' ? 'Supervisor' : 'Staff'))}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-bold font-mono text-center">
                        {stats.full} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-bold font-mono text-center">
                        {stats.short} hrs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-bold font-mono text-center">
                        {p.allow_overtime ? `${stats.overtime} hrs` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => onViewDetails(p.id)}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold cursor-pointer border border-orange-700 transition-all"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
