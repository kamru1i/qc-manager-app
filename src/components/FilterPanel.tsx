import React from 'react';
import { SlidersHorizontal, Download, RefreshCw } from 'lucide-react';
import { DateInput } from './DateInput';
import { CustomSelect } from './CustomSelect';

interface FilterPanelProps {
  filterType: string;
  setFilterType: (val: string) => void;
  filterStartDate: string;
  setFilterStartDate: (val: string) => void;
  filterEndDate: string;
  setFilterEndDate: (val: string) => void;
  selectedYear: string;
  allowOvertime?: boolean;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onResetFilters: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filterType,
  setFilterType,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  selectedYear,
  allowOvertime,
  onExportExcel,
  onExportPDF,
  onResetFilters,
}) => {
  const leaveTypeOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'Short Leave', label: 'Short Leave' },
    { value: 'Full Leave', label: 'Full Leave' },
    ...(allowOvertime ? [{ value: 'Overtime', label: 'Overtime' }] : []),
  ];

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-900 shadow-2xl rounded-2xl p-6">
      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800/80 pb-3 mb-4">
        <SlidersHorizontal className="h-4 w-4 text-orange-500" /> Staff Leave Filter Panel
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Filter Leave Type */}
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Leave Type</label>
          <CustomSelect
            value={filterType}
            onChange={setFilterType}
            options={leaveTypeOptions}
            className="w-full mt-1"
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Start Date</label>
          <div className="mt-1">
            <DateInput
              min={selectedYear === 'all' ? undefined : `${selectedYear}-01-01`}
              max={selectedYear === 'all' ? undefined : `${selectedYear}-12-31`}
              value={filterStartDate}
              onChange={setFilterStartDate}
              className="bg-slate-955"
            />
          </div>
        </div>

        {/* End Date */}
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">End Date</label>
          <div className="mt-1">
            <DateInput
              min={selectedYear === 'all' ? undefined : `${selectedYear}-01-01`}
              max={selectedYear === 'all' ? undefined : `${selectedYear}-12-31`}
              value={filterEndDate}
              onChange={setFilterEndDate}
              className="bg-slate-955"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-end gap-2">
          <button
            onClick={onExportExcel}
            className="flex-1 flex justify-center items-center gap-1.5 py-2 px-2.5 bg-transparent border border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-500 hover:bg-emerald-600/10 dark:hover:bg-emerald-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
            title="Excel Export"
            type="button"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={onExportPDF}
            className="flex-1 flex justify-center items-center gap-1.5 py-2 px-2.5 bg-transparent border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 hover:bg-red-600/10 dark:hover:bg-red-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
            title="PDF Export"
            type="button"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
          <button
            onClick={onResetFilters}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs cursor-pointer transition-all"
            title="Filters Reset"
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
