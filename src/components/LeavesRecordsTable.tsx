import React from 'react';
import { Edit, Trash2, Search, Plus } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';
import { FilterPanel } from './FilterPanel';
import { StatusBadge } from './StatusBadge';
import { CustomSelect } from './CustomSelect';

import { SkeletonLoader } from './SkeletonLoader';

interface LeavesRecordsTableProps {
  records: ChutiRecord[];
  allowOvertime?: boolean;
  filterType: string;
  setFilterType: (val: string) => void;
  filterStartDate: string;
  setFilterStartDate: (val: string) => void;
  filterEndDate: string;
  setFilterEndDate: (val: string) => void;
  onResetFilters: () => void;
  onExportExcel: (filtered: ChutiRecord[], searchTerm: string) => void;
  onExportPDF: (filtered: ChutiRecord[], searchTerm: string) => void;
  onToggleAdjustment: (r: ChutiRecord) => void;
  onDeleteClick: (r: ChutiRecord) => void;
  onEditClick?: (r: ChutiRecord) => void;
  onRevisionClick?: (r: ChutiRecord) => void;
  formatDate: (d: string) => string;
  formatTimeToAMPM: (t: string | null) => string;
  getCleanComment: (c: string | null | undefined) => string;
  selectedYear: string;
  setSelectedYear: (val: string) => void;
  availableYears: string[];
  onAddLeaveClick: () => void;
  title: string;
  emptyMessage: string;
  showPendingBadge?: boolean;
  initialFetchDone?: boolean;
}

export const LeavesRecordsTable: React.FC<LeavesRecordsTableProps> = ({
  records,
  allowOvertime,
  filterType,
  setFilterType,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  onResetFilters,
  onExportExcel,
  onExportPDF,
  onToggleAdjustment,
  onDeleteClick,
  onEditClick,
  onRevisionClick,
  formatDate,
  formatTimeToAMPM,
  getCleanComment,
  selectedYear,
  setSelectedYear,
  availableYears,
  onAddLeaveClick,
  title,
  emptyMessage,
  showPendingBadge = false,
  initialFetchDone = true,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const yearOptions = [
    { value: 'all', label: 'All' },
    ...availableYears.map((y) => ({ value: y, label: y })),
  ];

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const commentMatch = (r.comment || '').toLowerCase().includes(term);
      const typeMatch = (r.leave_type || '').toLowerCase().includes(term);
      return commentMatch || typeMatch;
    });
  }, [records, searchTerm]);

  const handleReset = () => {
    setSearchTerm('');
    onResetFilters();
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Filtering Panel */}
      <FilterPanel
        filterType={filterType}
        setFilterType={setFilterType}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        selectedYear={selectedYear}
        allowOvertime={allowOvertime}
        onExportExcel={() => onExportExcel(filteredRecords, searchTerm)}
        onExportPDF={() => onExportPDF(filteredRecords, searchTerm)}
        onResetFilters={handleReset}
      />

      {/* Records Table */}
      <div className="bg-slate-900/40 border border-slate-900 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800/80 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex flex-col">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <span className="text-xs text-slate-400 mt-0.5">Total: {filteredRecords.length} {filteredRecords.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          
          {/* Quick Search */}
          <div className="relative w-full lg:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 dark:text-slate-500">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search by comment or leave type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-10 py-1.5 bg-white border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs transition-all dark:bg-slate-955/80 dark:border-slate-800 dark:text-white dark:placeholder-slate-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer text-sm font-semibold"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Add Leave & Year Select */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onAddLeaveClick}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-orange-600 text-orange-600 dark:border-orange-500 dark:text-orange-500 hover:bg-orange-600/10 dark:hover:bg-orange-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Add Leave
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
              <SkeletonLoader variant="leaves-table" rows={5} allowOvertime={allowOvertime} />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {emptyMessage}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-955/60">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Adjustment</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Sign In/Out</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Leave Hours</th>
                  {allowOvertime && <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Overtime</th>}
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Comment</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-900/20">
                {filteredRecords.map((r) => {
                  const isTemp = typeof r.id === 'string' && r.id.startsWith('temp-');
                  return (
                    <tr key={r.id} className="hover:bg-slate-900/30 transition-all">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white flex items-center justify-center gap-2">
                        {formatDate(r.date)}
                        {showPendingBadge && isTemp && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-955/80 border border-amber-800 text-amber-400 animate-pulse">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-355 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                          r.leave_type === 'Full Leave' 
                            ? 'bg-red-955/50 border border-red-800 text-red-300' 
                            : r.leave_type === 'Overtime'
                            ? 'bg-emerald-955/50 border border-emerald-800 text-emerald-300'
                            : 'bg-orange-955/50 border border-orange-800 text-orange-300'
                        }`}>
                          {r.leave_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-355 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleAdjustment(r)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              (r.adjustment || r.adjusted_hour || r.reserve_adjustment_status === 'pending') ? 'bg-orange-600' : 'bg-slate-800'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                (r.adjustment || r.adjusted_hour || r.reserve_adjustment_status === 'pending') ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="text-xs font-semibold">
                            {r.reserve_adjustment_status === 'pending' ? (
                              <span className="text-amber-400 animate-pulse font-semibold">Pending</span>
                            ) : r.adjustment ? (
                              <span className="text-orange-400">Yes</span>
                            ) : r.adjusted_hour ? (
                              <span className="text-cyan-400 font-mono">Partial ({r.adjusted_hour.toString().split('.')[0].substring(0, 5)})</span>
                            ) : r.reserve_adjustment_status === 'rejected' ? (
                              <span className="text-slate-500">No (Rejected)</span>
                            ) : (
                              <span className="text-slate-500">No</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-355 font-mono text-center">
                        {r.leave_type === 'Full Leave' ? '-' : `${formatTimeToAMPM(r.sign_in_time)} / ${formatTimeToAMPM(r.sign_out_time)}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono font-bold text-center">
                        {r.leave_type === 'Full Leave' || r.leave_type === 'Overtime' ? '-' : (r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '-')}
                      </td>
                      {allowOvertime && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono font-bold text-center">
                          {r.leave_type === 'Overtime' ? (r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '-') : '-'}
                        </td>
                      )}
                      {/* Comment Column */}
                      <td className="px-6 py-4 text-sm text-slate-400 max-w-[150px] truncate text-center" title={getCleanComment(r.comment)}>
                        {getCleanComment(r.comment) || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center gap-1.5">
                          {r.status === 'needs_review' && onRevisionClick && (
                            <button
                              onClick={() => onRevisionClick(r)}
                              className="text-amber-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-amber-500/10 cursor-pointer transition-all animate-pulse"
                              title="Needs Review (Revision)"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {onEditClick && (
                            <button
                              onClick={() => onEditClick(r)}
                              className="text-orange-400 hover:text-orange-300 p-1.5 rounded-lg hover:bg-orange-500/10 cursor-pointer transition-all"
                              title="Admin Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteClick(r)}
                            className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer transition-all"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <div className="flex flex-col gap-1 items-center">
                          <StatusBadge record={r} />
                          {r.is_edited && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-955/40 border border-orange-800 text-orange-400">
                              (Edited)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
