import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Trash2, Search, Plus, Loader2 } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    record: ChutiRecord;
  } | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Dismiss context menu on click outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Press Escape to exit Selection Mode and clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setIsSelectionMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const showActionColumn = isSelectionMode;

  const cellStyle = useMemo(
    () => ({
      width: showActionColumn ? '72px' : '0px',
      minWidth: showActionColumn ? '72px' : '0px',
      maxWidth: showActionColumn ? '72px' : '0px',
      opacity: showActionColumn ? 1 : 0,
      transition:
        'width 300ms ease-out, min-width 300ms ease-out, max-width 300ms ease-out, opacity 300ms ease-out',
    }),
    [showActionColumn]
  );

  const getInnerStyle = (paddingTop: string, paddingBottom: string) => {
    return {
      width: showActionColumn ? '72px' : '0px',
      minWidth: showActionColumn ? '72px' : '0px',
      maxWidth: showActionColumn ? '72px' : '0px',
      paddingLeft: showActionColumn ? '12px' : '0px',
      paddingRight: showActionColumn ? '16px' : '0px',
      paddingTop: showActionColumn ? paddingTop : '0px',
      paddingBottom: showActionColumn ? paddingBottom : '0px',
      transition:
        'width 300ms ease-out, min-width 300ms ease-out, max-width 300ms ease-out, opacity 300ms ease-out, padding 300ms ease-out',
    };
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map((r) => r.id || ''));
    }
  };

  const handleRowClick = (record: ChutiRecord) => {
    if (isSelectionMode && record.id) {
      const rid = record.id;
      setSelectedIds((prev) =>
        prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]
      );
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent, record: ChutiRecord) => {
    e.preventDefault();
    const menuWidth = 144;
    const menuHeight = 120;
    const x =
      e.clientX + menuWidth > window.innerWidth
        ? e.clientX - menuWidth
        : e.clientX;
    const y =
      e.clientY + menuHeight > window.innerHeight
        ? e.clientY - menuHeight
        : e.clientY;

    setContextMenu({
      x,
      y,
      record,
    });
  };

  const handleContextSelect = (record: ChutiRecord) => {
    if (!record.id) return;
    const rid = record.id;
    setIsSelectionMode(true);
    setSelectedIds((prev) => {
      if (prev.includes(rid)) return prev;
      return [...prev, rid];
    });
    setContextMenu(null);
  };

  const handleContextDeselect = (record: ChutiRecord) => {
    if (!record.id) return;
    const rid = record.id;
    setSelectedIds((prev) => prev.filter((id) => id !== rid));
    setContextMenu(null);
  };

  const handleContextEdit = (record: ChutiRecord) => {
    setContextMenu(null);
    if (onEditClick) {
      onEditClick(record);
    }
  };

  const handleContextDelete = (record: ChutiRecord) => {
    setContextMenu(null);
    onDeleteClick(record);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected records?`)) {
      const idsToDelete = [...selectedIds];
      setSelectedIds([]);
      setIsSelectionMode(false);
      
      for (const id of idsToDelete) {
        const record = records.find(r => r.id === id);
        if (record) {
          await onDeleteClick(record);
        }
      }
    }
  };

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
              className="w-full pl-9 pr-10 py-1.5 bg-white border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all dark:bg-slate-955/80 dark:border-slate-800 dark:text-white dark:placeholder-slate-500"
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
              className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500 hover:bg-blue-600/10 dark:hover:bg-blue-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
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
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-955/60">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Adjustment</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Sign In/Out</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Leave Hours</th>
                  {allowOvertime && <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Overtime</th>}
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Comment</th>
                  <th
                    className="p-0 text-center overflow-hidden border-0"
                    style={cellStyle}
                  >
                    <div
                      className="flex items-center justify-center gap-2 overflow-hidden mx-auto"
                      style={getInnerStyle("8px", "8px")}
                    >
                      <button
                        type="button"
                        onClick={handleBulkDelete}
                        className={`p-1 text-red-500 hover:text-red-400 hover:bg-slate-800/80 rounded cursor-pointer flex items-center justify-center shrink-0 transition-all duration-300 transform ${
                          selectedIds.length > 0
                            ? "scale-100 opacity-100 w-6"
                            : "scale-0 opacity-0 w-0"
                        }`}
                        title={`Delete ${selectedIds.length} selected records`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500 stroke-[2.5] shrink-0" />
                      </button>
                      <input
                        type="checkbox"
                        checked={
                          filteredRecords.length > 0 &&
                          filteredRecords.every((r) =>
                            selectedIds.includes(r.id || '')
                          )
                        }
                        onChange={handleSelectAllToggle}
                        className={`rounded-full border border-slate-700 bg-slate-955 text-blue-500 focus:ring-blue-500/30 cursor-pointer h-4 w-4 appearance-none checked:bg-blue-500 checked:border-blue-500 flex items-center justify-center checked:after:content-[''] checked:after:w-1.5 checked:after:h-1.5 checked:after:rounded-full checked:after:bg-white transition-all duration-300 transform shrink-0 ${
                          isSelectionMode
                            ? "scale-100 opacity-100"
                            : "scale-0 opacity-0"
                        }`}
                      />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-900/20">
                {filteredRecords.map((r) => {
                  const isTemp = typeof r.id === 'string' && r.id.startsWith('temp-');
                  return (
                    <tr
                      key={r.id}
                      onContextMenu={(e) => handleRowContextMenu(e, r)}
                      onClick={() => handleRowClick(r)}
                      className={`hover:bg-slate-900/30 transition-all ${
                        isSelectionMode ? "cursor-pointer select-none" : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white flex items-center justify-center gap-2">
                        {formatDate(r.date)}
                        {showPendingBadge && isTemp && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-955/80 border border-purple-800 text-purple-400 animate-pulse">
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
                            : 'bg-blue-955/50 border border-blue-800 text-blue-300'
                        }`}>
                          {r.leave_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-355 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              if (isSelectionMode) return;
                              e.stopPropagation();
                              onToggleAdjustment(r);
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              (r.adjustment || r.adjusted_hour || r.reserve_adjustment_status === 'pending') ? 'bg-blue-600' : 'bg-slate-800'
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
                              <span className="text-purple-400 animate-pulse font-semibold">Pending</span>
                            ) : r.adjustment ? (
                              <span className="text-blue-400">Yes</span>
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
                      {/* Animated selection checkbox column in place of Action */}
                      <td
                        className="p-0 text-center overflow-hidden border-0"
                        style={cellStyle}
                      >
                        <div
                          className="flex justify-center items-center overflow-hidden mx-auto"
                          style={getInnerStyle("12px", "12px")}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(r.id || '')}
                            onChange={() => {
                              if (!r.id) return;
                              const rid = r.id;
                              setSelectedIds((prev) =>
                                prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]
                              );
                            }}
                            className={`rounded-full border border-slate-700 bg-slate-955 text-blue-500 focus:ring-blue-500/30 cursor-pointer h-4 w-4 appearance-none checked:bg-blue-500 checked:border-blue-500 flex items-center justify-center checked:after:content-[''] checked:after:w-1.5 checked:after:h-1.5 checked:after:rounded-full checked:after:bg-white transition-all duration-300 transform shrink-0 ${
                              isSelectionMode
                                ? "scale-100 opacity-100"
                                : "scale-0 opacity-0"
                            }`}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <div className="flex flex-col gap-1 items-center">
                          <StatusBadge record={r} />
                          {r.is_edited && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-955/40 border border-blue-800 text-blue-400">
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

      {/* Premium Glassmorphic Context Menu */}
      {contextMenu &&
        isMounted &&
        createPortal(
          <div
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            className="fixed z-50 backdrop-blur-lg bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl p-1 w-36 select-none animate-fadeIn"
          >
            {selectedIds.includes(contextMenu.record.id || '') ? (
              <button
                type="button"
                onClick={() => handleContextDeselect(contextMenu.record)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-355 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
                Deselect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleContextSelect(contextMenu.record)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-355 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Select
              </button>
            )}
            {onEditClick && (
              <button
                type="button"
                onClick={() => handleContextEdit(contextMenu.record)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-355 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <Edit className="h-3.5 w-3.5 text-slate-500" />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => handleContextDelete(contextMenu.record)}
              className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-955/20 rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500 stroke-[2]" />
              Delete
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
