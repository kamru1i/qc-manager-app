import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Edit, Trash2, Search, Plus, Download } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';
import { Profile } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CustomSelect } from '@/components/common/CustomSelect';
import { ConfirmModal } from '@/components/common/modals/ConfirmModal';
import { sortChutiRecordsDescending } from '@/utils/dashboardHelpers';

import { SkeletonLoader } from '@/components/common/SkeletonLoader';

interface LeavesRecordsTableProps {
  records: ChutiRecord[];
  allowOvertime?: boolean;
  filterType: string;
  setFilterType: (val: string) => void;
  filterStartDate?: string;
  setFilterStartDate?: (val: string) => void;
  filterEndDate?: string;
  setFilterEndDate?: (val: string) => void;
  onResetFilters?: () => void;
  onExportExcel: (filtered: ChutiRecord[], searchTerm: string) => void;
  onExportPDF?: (filtered: ChutiRecord[], searchTerm: string) => void;
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
  /** When true, hides delete button and checkbox column (supervisor view) */
  hideDelete?: boolean;
  /** When false, hides Add Leave button (normal user view) */
  showAddLeave?: boolean;
  /** Optional row-level guards used when only unapproved requests are mutable. */
  canDeleteRecord?: (record: ChutiRecord) => boolean;
  canEditRecord?: (record: ChutiRecord) => boolean;
  showNameColumn?: boolean;
  hideAdjustmentAndOvertime?: boolean;
  hideYearSelect?: boolean;
  profilesList?: Profile[];
  hideFilterPanel?: boolean;
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
  hideDelete = false,
  showAddLeave = true,
  canDeleteRecord,
  canEditRecord,
  showNameColumn = false,
  hideAdjustmentAndOvertime = false,
  hideYearSelect = false,
  profilesList = [],
  hideFilterPanel = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isMounted, setIsMounted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    record: ChutiRecord;
  } | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('');
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState('');
  const [onConfirmDeleteAction, setOnConfirmDeleteAction] = useState<() => void>(() => () => {});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Exit selection mode when all items are deselected
  useEffect(() => {
    if (selectedIds.length === 0) {
      setIsSelectionMode(false);
    }
  }, [selectedIds]);

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

  const getRecordMonth = useCallback((dateStr?: string | null) => {
    if (!dateStr) return '';
    const parts = dateStr.split(/[\/-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return parts[1].padStart(2, '0');
      } else if (parts[2].length === 4) {
        return parts[1].padStart(2, '0');
      }
    }
    return dateStr.length >= 7 ? dateStr.substring(5, 7) : '';
  }, []);

  const currentYear = useMemo(() => new Date().getFullYear().toString(), []);

  const yearOptions = useMemo(() => {
    const yearSet = new Set<string>([currentYear, ...(availableYears || [])]);
    records.forEach((r) => {
      if (r.date) {
        const y = r.date.substring(0, 4);
        if (y && y.length === 4 && !isNaN(Number(y))) {
          yearSet.add(y);
        }
      }
    });
    const sorted = Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
    return [
      ...sorted.map((y) => ({ value: y, label: y })),
      { value: 'all', label: 'ALL' },
    ];
  }, [availableYears, currentYear, records]);

  const monthNames: { [key: string]: string } = useMemo(() => ({
    '01': 'January',
    '02': 'February',
    '03': 'March',
    '04': 'April',
    '05': 'May',
    '06': 'June',
    '07': 'July',
    '08': 'August',
    '09': 'September',
    '10': 'October',
    '11': 'November',
    '12': 'December',
  }), []);

  const monthOptions = useMemo(() => {
    const monthCounts: { [key: string]: number } = {};
    records.forEach((r) => {
      if (r.date) {
        if (selectedYear !== 'all' && r.date.substring(0, 4) !== selectedYear) {
          return;
        }
        const m = getRecordMonth(r.date);
        if (m) {
          monthCounts[m] = (monthCounts[m] || 0) + 1;
        }
      }
    });

    const options = [{ value: 'all', label: 'ALL' }];
    Object.keys(monthNames).sort().forEach((mKey) => {
      const count = monthCounts[mKey] || 0;
      if (count > 0) {
        options.push({
          value: mKey,
          label: `${monthNames[mKey]} (${count})`,
        });
      }
    });
    return options;
  }, [records, selectedYear, getRecordMonth, monthNames]);

  // Reset selectedMonth to 'all' if selectedYear is 'all' or selected month has no records
  useEffect(() => {
    if (selectedYear === 'all') {
      setSelectedMonth('all');
    } else if (selectedMonth !== 'all' && !monthOptions.some(o => o.value === selectedMonth)) {
      setSelectedMonth('all');
    }
  }, [selectedYear, monthOptions, selectedMonth]);

  const leaveTypeOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    { value: 'Short Leave', label: 'Short Leave' },
    { value: 'Full Leave', label: 'Full Leave' },
    ...(allowOvertime ? [{ value: 'Overtime', label: 'Overtime' }] : []),
  ], [allowOvertime]);

  const filteredRecords = React.useMemo(() => {
    const filtered = records.filter((r) => {
      if (filterType && filterType !== 'all') {
        if (r.leave_type !== filterType) return false;
      }
      if (selectedYear !== 'all' && selectedMonth && selectedMonth !== 'all') {
        const rMonth = getRecordMonth(r.date);
        if (rMonth !== selectedMonth) return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const commentMatch = (r.comment || '').toLowerCase().includes(term);
      const typeMatch = (r.leave_type || '').toLowerCase().includes(term);
      return commentMatch || typeMatch;
    });
    return sortChutiRecordsDescending(filtered);
  }, [records, filterType, selectedYear, selectedMonth, searchTerm, getRecordMonth]);

  const deletableRecords = useMemo(
    () => filteredRecords.filter((record) => !canDeleteRecord || canDeleteRecord(record)),
    [filteredRecords, canDeleteRecord]
  );

  const isRecordDeletable = useCallback(
    (record: ChutiRecord) => !hideDelete && (!canDeleteRecord || canDeleteRecord(record)),
    [hideDelete, canDeleteRecord]
  );

  const showActionColumn = isSelectionMode && !hideDelete;

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
    if (selectedIds.length === deletableRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deletableRecords.map((r) => r.id || '').filter(Boolean));
    }
  };

  const handleRowClick = (record: ChutiRecord) => {
    if (!isRecordDeletable(record)) return;
    if (isSelectionMode && record.id) {
      const rid = record.id;
      setSelectedIds((prev) =>
        prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]
      );
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent, record: ChutiRecord) => {
    e.preventDefault();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const menuWidth = 144; // w-36 = 144px
    const menuHeight = 135; // estimated height for 3 menu items with padding

    let x = clientX;
    let y = clientY;

    if (typeof window !== "undefined") {
      x = clientX + menuWidth > window.innerWidth
        ? clientX - menuWidth
        : clientX;
      y = clientY + menuHeight > window.innerHeight
        ? clientY - menuHeight
        : clientY;
    }

    // Ensure menu doesn't go off the top/left of the page
    x = Math.max(10, x);
    y = Math.max(10, y);

    setContextMenu({
      x,
      y,
      record,
    });
  };

  const handleContextSelect = (record: ChutiRecord) => {
    if (!record.id || !isRecordDeletable(record)) return;
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
    if (!isRecordDeletable(record)) return;
    setContextMenu(null);
    setDeleteConfirmTitle("Delete Leave Entry");
    setDeleteConfirmMessage("Are you sure you want to permanently delete this leave entry? This action cannot be undone.");
    setOnConfirmDeleteAction(() => () => {
      onDeleteClick(record);
      setDeleteConfirmOpen(false);
    });
    setDeleteConfirmOpen(true);
  };

  const handleBulkDelete = useCallback(() => {
    setDeleteConfirmTitle("Delete Selected Leaves");
    setDeleteConfirmMessage(`Are you sure you want to delete ${selectedIds.length} selected records? This action cannot be undone.`);
    setOnConfirmDeleteAction(() => async () => {
      const idsToDelete = selectedIds.filter((id) => {
        const record = records.find((item) => item.id === id);
        return record ? isRecordDeletable(record) : false;
      });
      setSelectedIds([]);
      setIsSelectionMode(false);
      setDeleteConfirmOpen(false);
      
      for (const id of idsToDelete) {
        const record = records.find(r => r.id === id);
        if (record) {
          await onDeleteClick(record);
        }
      }
    });
    setDeleteConfirmOpen(true);
  }, [selectedIds, records, onDeleteClick, isRecordDeletable]);

  // Keyboard handlers: Escape to exit/clear selection, Delete to bulk delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setIsSelectionMode(false);
      } else if (e.key === 'Delete') {
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.getAttribute('contenteditable') === 'true'
        );
        if (!isTyping && selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedIds, handleBulkDelete]);

  const handleReset = () => {
    setSearchTerm('');
    onResetFilters?.();
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Records Table */}
      <div className="bg-theme-card-bg/40 border border-theme-card-bg shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-theme-border-input/80 flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Title & Entry Count + Add Leave Button */}
          <div className="flex flex-col shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-theme-text-primary">{title}</h3>
              {showAddLeave && (
                <button
                  onClick={onAddLeaveClick}
                  className="flex items-center gap-1.5 py-1 px-2.5 bg-transparent border border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500 hover:bg-blue-600/10 dark:hover:bg-blue-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Leave
                </button>
              )}
            </div>
            <span className="text-xs text-theme-text-muted mt-0.5">
              Total: {filteredRecords.length} {filteredRecords.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {/* Controls: Leave Type Filter + Search Box + Excel Export + Year Selector + Month Selector */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">

            {/* Leave Type Dropdown (Left of Search Box) */}
            <CustomSelect
              value={filterType}
              onChange={setFilterType}
              options={leaveTypeOptions}
              className="min-w-[130px]"
            />

            {/* Quick Search Box */}
            <div className="relative flex-1 sm:w-64 max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-text-muted">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Search by comment or leave type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-theme-border-input rounded-lg text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all dark:bg-theme-page-bg/80 dark:border-theme-border-input dark:text-theme-text-primary dark:placeholder-theme-text-muted/50"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-theme-text-muted hover:text-theme-text-secondary transition-colors cursor-pointer text-xs font-semibold"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Excel Export Button (Right of Search Box) */}
            <button
              onClick={() => onExportExcel(filteredRecords, searchTerm)}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-transparent border border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-500 hover:bg-emerald-600/10 dark:hover:bg-emerald-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm shrink-0"
              title="Excel Export"
              type="button"
            >
              <Download className="h-3.5 w-3.5" /> Excel
            </button>

            {/* Year Selector */}
            {!hideYearSelect && (
              <CustomSelect
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
                className="min-w-[85px]"
              />
            )}

            {/* Month Selector (Active when an individual year is selected and has month data) */}
            {selectedYear !== 'all' && monthOptions.length > 1 && (
              <CustomSelect
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthOptions}
                className="min-w-[125px]"
              />
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {!initialFetchDone ? (
            <div className="p-6">
              <SkeletonLoader variant="leaves-table" rows={5} allowOvertime={allowOvertime} showNameColumn={showNameColumn} />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-theme-text-muted text-sm">
              {emptyMessage}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-theme-border-input text-left text-sm">
              <thead className="bg-theme-page-bg/60">
                <tr>
                  {showNameColumn ? (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                        Codename
                      </th>
                    </>
                  ) : (
                    <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                      Date
                    </th>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Type</th>
                  {!hideAdjustmentAndOvertime && (
                    <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Adjustment</th>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Sign In/Out</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Leave Hours</th>
                  {allowOvertime && !hideAdjustmentAndOvertime && (
                    <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Overtime</th>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Comment</th>
                  <th
                    className="p-0 text-center overflow-hidden border-0"
                    style={cellStyle}
                  >
                    <div
                      className="flex items-center justify-center gap-2 overflow-hidden mx-auto"
                      style={getInnerStyle("8px", "8px")}
                    >
                      {!hideDelete && (
                        <button
                          type="button"
                          onClick={handleBulkDelete}
                          className={`p-1 text-red-500 hover:text-red-400 hover:bg-theme-border-input/80 rounded cursor-pointer flex items-center justify-center shrink-0 transition-all duration-300 transform ${
                            selectedIds.length > 0
                              ? "scale-100 opacity-100 w-6"
                              : "scale-0 opacity-0 w-0"
                          }`}
                          title={`Delete ${selectedIds.length} selected records`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500 stroke-[2.5] shrink-0" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSelectAllToggle}
                        className={`rounded-full border border-theme-border-active bg-theme-page-bg cursor-pointer h-4 w-4 flex items-center justify-center transition-all duration-300 transform shrink-0 ${
                          deletableRecords.length > 0 && deletableRecords.every((r) => selectedIds.includes(r.id || ''))
                            ? 'bg-blue-500 border-blue-500'
                            : ''
                        } ${
                          isSelectionMode
                            ? "scale-100 opacity-100"
                            : "scale-0 opacity-0"
                        }`}
                      >
                        {deletableRecords.length > 0 && deletableRecords.every((r) => selectedIds.includes(r.id || '')) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                        )}
                      </button>
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border-muted bg-theme-card-bg/20">
                {filteredRecords.map((r) => {
                  const isTemp = typeof r.id === 'string' && r.id.startsWith('temp-');
                  return (
                    <tr
                      key={r.id}
                      onContextMenu={(e) => {
                        if (showNameColumn) return;
                        handleRowContextMenu(e, r);
                      }}
                      onClick={() => {
                        if (showNameColumn) return;
                        handleRowClick(r);
                      }}
                      className={`hover:bg-theme-card-bg/30 transition-all ${
                        isSelectionMode && !showNameColumn ? "cursor-pointer select-none" : ""
                      }`}
                    >
                      {showNameColumn ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-theme-text-primary flex items-center justify-start gap-2">
                            {(() => {
                              const staffProfile = profilesList?.find(p => p.id === r.user_id);
                              return staffProfile?.full_name || staffProfile?.username || r.username || r.user_id;
                            })()}
                            {showPendingBadge && isTemp && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-955/80 border border-purple-800 text-purple-400 animate-pulse">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary text-center font-mono">
                            {(() => {
                              const staffProfile = profilesList?.find(p => p.id === r.user_id);
                              return staffProfile?.username || r.username || '-';
                            })()}
                          </td>
                        </>
                      ) : (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-theme-text-primary flex items-center justify-center gap-2">
                          {formatDate(r.date)}
                          {showPendingBadge && isTemp && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-955/80 border border-purple-800 text-purple-400 animate-pulse">
                              Pending
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                          r.leave_type === 'Full Leave' 
                            ? 'bg-red-955/50 border border-red-800 text-red-300' 
                            : r.leave_type === 'Overtime'
                            ? 'bg-emerald-955/50 border border-emerald-800 text-emerald-300'
                            : 'bg-blue-955/50 border border-blue-800 text-blue-300'
                        }`}>
                          {(r.adjustment || r.adjusted_hour) && (r.comment?.includes('Govt Holiday') || r.reserve_holiday === 'Govt Holiday') ? 'Adjusted Leave' : r.leave_type}
                        </span>
                      </td>
                      {!hideAdjustmentAndOvertime && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                if (isSelectionMode) return;
                                e.stopPropagation();
                                onToggleAdjustment(r);
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                (r.adjustment || r.adjusted_hour || r.reserve_adjustment_status === 'pending') ? 'bg-blue-600' : 'bg-theme-border-input'
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
                                <span className="text-theme-text-muted">No (Rejected)</span>
                              ) : (
                                <span className="text-theme-text-muted">No</span>
                              )}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary font-mono text-center">
                        {r.leave_type === 'Full Leave' ? '-' : `${formatTimeToAMPM(r.sign_in_time)} / ${formatTimeToAMPM(r.sign_out_time)}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary font-mono font-bold text-center">
                        {r.leave_type === 'Full Leave' || r.leave_type === 'Overtime' ? '-' : (r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '-')}
                      </td>
                      {allowOvertime && !hideAdjustmentAndOvertime && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary font-mono font-bold text-center">
                          {r.leave_type === 'Overtime' ? (r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '-') : '-'}
                        </td>
                      )}
                      {/* Comment Column */}
                      <td className="px-6 py-4 text-sm text-theme-text-muted max-w-[150px] truncate text-center" title={getCleanComment(r.comment)}>
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
                          <button
                            type="button"
                            disabled={!isRecordDeletable(r)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!r.id || !isRecordDeletable(r)) return;
                              const rid = r.id;
                              setSelectedIds((prev) =>
                                prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]
                              );
                            }}
                            className={`rounded-full border border-theme-border-active bg-theme-page-bg h-4 w-4 flex items-center justify-center transition-all duration-300 transform shrink-0 ${
                              selectedIds.includes(r.id || '') ? 'bg-blue-500 border-blue-500' : ''
                            } ${
                              isSelectionMode
                                ? "scale-100 opacity-100"
                                : "scale-0 opacity-0"
                            } ${isRecordDeletable(r) ? 'cursor-pointer' : 'cursor-not-allowed opacity-30'}`}
                          >
                            {selectedIds.includes(r.id || '') && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            )}
                          </button>
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
            className="fixed z-50 backdrop-blur-lg bg-theme-card-bg/95 border border-theme-border-input rounded-xl shadow-2xl p-1 w-36 select-none animate-fadeIn"
          >
            {isRecordDeletable(contextMenu.record) && (
              selectedIds.includes(contextMenu.record.id || '') ? (
                <button
                  type="button"
                  onClick={() => handleContextDeselect(contextMenu.record)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-input rounded-lg transition-all cursor-pointer flex items-center gap-2"
                >
                  <div className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
                  Deselect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleContextSelect(contextMenu.record)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-input rounded-lg transition-all cursor-pointer flex items-center gap-2"
                >
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Select
                </button>
              )
            )}
            {onEditClick && (!canEditRecord || canEditRecord(contextMenu.record)) && (
              <button
                type="button"
                onClick={() => handleContextEdit(contextMenu.record)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-input rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <Edit className="h-3.5 w-3.5 text-theme-text-muted" />
                Edit
              </button>
            )}
            {isRecordDeletable(contextMenu.record) && (
              <button
                type="button"
                onClick={() => handleContextDelete(contextMenu.record)}
                className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-955/20 rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500 stroke-2" />
                Delete
              </button>
            )}
          </div>,
          document.body
        )}
      {deleteConfirmOpen && (
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={onConfirmDeleteAction}
          title={deleteConfirmTitle}
          message={deleteConfirmMessage}
          confirmText="Delete"
          cancelText="Cancel"
          isDanger={true}
        />
      )}
    </div>
  );
};
