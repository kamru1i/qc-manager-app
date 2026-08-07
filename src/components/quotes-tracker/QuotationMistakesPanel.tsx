'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  X,
  RotateCcw,
  Edit2,
  Trash2,
  Calendar,
  FileCode,
  Building2,
  User,
  FileText,
  Gavel,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Inbox,
  RefreshCw,
  CheckSquare,
} from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, QuotationMistake } from '@/types';
import { useQuotationMistakes } from '@/hooks/quotes-tracker/useQuotationMistakes';
import { AddEditMistakeModal } from './modals/AddEditMistakeModal';
import { DeleteConfirmModal } from '@/components/common/modals/DeleteConfirmModal';
import { DateInput } from '@/components/common/DateInput';
import { CustomSelect } from '@/components/common/CustomSelect';
import { DEFAULT_BRANCHES } from '@/utils/bulkQuoteParser';

interface QuotationMistakesPanelProps {
  sessionUser: SupabaseUser | null;
  profile: Profile | null;
  globalSettings?: any;
  profilesList?: Profile[];
}

const formatDateDDMMYYYY = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

export function QuotationMistakesPanel({
  sessionUser,
  profile,
  globalSettings,
  profilesList = [],
}: QuotationMistakesPanelProps) {
  const {
    mistakes,
    allFilteredCount,
    totalCount,
    isLoading,
    isSubmitting,
    canWrite,
    canRead,
    isUserRole,

    // Filters
    searchQuery,
    setSearchQuery,
    selectedBranch,
    setSelectedBranch,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectedDate,
    setSelectedDate,
    isFilterActive,
    resetFilters,

    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,

    // Operations
    addMistake,
    updateMistake,
    deleteMistake,
    bulkDeleteMistakes,
  } = useQuotationMistakes({
    sessionUser,
    profile,
    globalSettings,
    profilesList,
  });

  // Modal States
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingMistake, setEditingMistake] = useState<QuotationMistake | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [mistakeToDelete, setMistakeToDelete] = useState<QuotationMistake | null>(null);
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState<boolean>(false);

  // Context Menu & Selection
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    record: QuotationMistake;
  } | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Branch options
  const branchOptions = useMemo(() => {
    return [
      { value: '', label: 'All Branches' },
      ...DEFAULT_BRANCHES.map((b) => ({ value: b, label: b })),
    ];
  }, []);

  // Year options
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [{ value: '', label: 'All Years' }];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push({ value: String(y), label: String(y) });
    }
    return years;
  }, []);

  // Month options
  const monthOptions = useMemo(
    () => [
      { value: '', label: 'All Months' },
      { value: '01', label: 'January' },
      { value: '02', label: 'February' },
      { value: '03', label: 'March' },
      { value: '04', label: 'April' },
      { value: '05', label: 'May' },
      { value: '06', label: 'June' },
      { value: '07', label: 'July' },
      { value: '08', label: 'August' },
      { value: '09', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ],
    []
  );

  const showActionColumn = isSelectionMode;

  const cellStyle = useMemo(
    () => ({
      width: showActionColumn ? "80px" : "0px",
      minWidth: showActionColumn ? "80px" : "0px",
      maxWidth: showActionColumn ? "80px" : "0px",
      opacity: showActionColumn ? 1 : 0,
      transition:
        "width 300ms ease-out, min-width 300ms ease-out, max-width 300ms ease-out, opacity 300ms ease-out",
    }),
    [showActionColumn]
  );

  const getInnerStyle = (paddingX: string, paddingY: string) => ({
    padding: showActionColumn ? `${paddingY} ${paddingX}` : "0px",
    opacity: showActionColumn ? 1 : 0,
    transition: "padding 300ms ease-out, opacity 300ms ease-out",
  });

  const handleOpenEdit = (item: QuotationMistake) => {
    setEditingMistake(item);
    setIsAddEditOpen(true);
    setContextMenu(null);
  };

  const handleOpenDelete = (item: QuotationMistake) => {
    setMistakeToDelete(item);
    setShowDeleteModal(true);
    setContextMenu(null);
  };

  const handleSaveModal = async (payload: any) => {
    let success = false;
    if (editingMistake) {
      success = await updateMistake(editingMistake.id, payload);
    } else {
      success = await addMistake(payload);
    }
    if (success) {
      setIsAddEditOpen(false);
      setEditingMistake(null);
    }
    return success;
  };

  const handleConfirmDelete = async () => {
    if (isBulkDeleteMode) {
      const success = await bulkDeleteMistakes(selectedIds);
      if (success) {
        setShowDeleteModal(false);
        setIsBulkDeleteMode(false);
        setSelectedIds([]);
        setIsSelectionMode(false);
      }
    } else if (mistakeToDelete) {
      const success = await deleteMistake(mistakeToDelete);
      if (success) {
        setShowDeleteModal(false);
        setMistakeToDelete(null);
        setSelectedIds(prev => prev.filter(id => id !== mistakeToDelete.id));
      }
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleteMode(true);
    setShowDeleteModal(true);
  };

  // Context Menu Handlers
  const handleRowContextMenu = (e: React.MouseEvent, record: QuotationMistake) => {
    if (!canWrite) return;
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

  const handleContextSelect = (record: QuotationMistake) => {
    setIsSelectionMode(true);
    setSelectedIds((prev) => {
      if (prev.includes(record.id)) return prev;
      return [...prev, record.id];
    });
    setContextMenu(null);
  };

  const handleContextDeselect = (record: QuotationMistake) => {
    setSelectedIds((prev) => prev.filter((id) => id !== record.id));
    setContextMenu(null);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    if (selectedIds.length === mistakes.length) {
      setSelectedIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedIds(mistakes.map((r) => r.id));
      setIsSelectionMode(true);
    }
  };

  // Dismiss context menu on outside click
  React.useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Keyboard escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIds([]);
        setIsSelectionMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleRowClick = (e: React.MouseEvent, record: QuotationMistake) => {
    if (isSelectionMode && canWrite) {
      const target = e.target as HTMLElement;
      if (target.closest("button")) {
        return;
      }
      toggleSelection(record.id);
    }
  };

  // If user has no read permission for module
  if (!canRead && !isLoading) {
    return (
      <div className="p-8 text-center bg-theme-card-bg/40 border border-theme-border-input/60 rounded-2xl max-w-lg mx-auto my-12 shadow-lg">
        <div className="inline-flex p-3 bg-red-900/10 border border-red-500/20 text-red-400 rounded-2xl mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-base font-bold text-theme-text-primary mb-2">Access Restricted</h3>
        <p className="text-xs text-theme-text-muted leading-relaxed">
          You do not have permission to view the Quotation Mistakes module. Please contact your Super Admin to enable access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar with Add Mistake Button */}
      <div className="bg-theme-card-bg/60 border border-theme-border-input/60 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end flex-1 w-full">
            {/* 1. Search (Filename, Codename) */}
            <div>
              <label className="block text-[11px] font-bold text-theme-text-muted mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-8 pr-8 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-xl text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs h-9"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-theme-text-muted" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 flex items-center justify-center p-0.5 hover:bg-theme-border-input rounded-full text-theme-text-muted hover:text-theme-text-primary transition-all duration-200 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Branch Filter */}
            <div>
              <label className="block text-[11px] font-bold text-theme-text-muted mb-1">Branch</label>
              <CustomSelect
                value={selectedBranch}
                onChange={setSelectedBranch}
                options={branchOptions}
              />
            </div>

            {/* 3. Year Filter */}
            <div>
              <label className="block text-[11px] font-bold text-theme-text-muted mb-1">Year</label>
              <CustomSelect
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
              />
            </div>

            {/* 4. Month Filter */}
            <div>
              <label className="block text-[11px] font-bold text-theme-text-muted mb-1">Month</label>
              <CustomSelect
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthOptions}
              />
            </div>

            {/* 5. Specific Date & Reset Button */}
            <div>
              <label className="block text-[11px] font-bold text-theme-text-muted mb-1">Specific Date</label>
              <div className="flex items-center gap-2">
                <DateInput
                  value={selectedDate}
                  onChange={setSelectedDate}
                  placeholder="DD-MM-YYYY"
                />
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="p-2 border border-theme-border-input/80 rounded-xl bg-theme-page-bg hover:bg-theme-card-bg text-theme-text-muted hover:text-rose-400 hover:scale-105 active:scale-95 cursor-pointer transition-all duration-200 shrink-0 h-9 w-9 flex items-center justify-center"
                    title="Reset all filters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Add Mistake Button (Only for Write Permitted Admin / Supervisor / Superadmin) */}
          {canWrite && (
            <button
              type="button"
              onClick={() => { setEditingMistake(null); setIsAddEditOpen(true); }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer transition-all duration-200 h-9 shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Mistake
            </button>
          )}
        </div>
      </div>

      {/* Table & Data Container */}
      <div className="overflow-x-auto rounded-xl border border-theme-border-input bg-theme-card-bg/20">
        {isLoading ? (
          <div className="py-16 text-center text-theme-text-muted flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-rose-500" />
            <p className="text-xs font-semibold">Loading quotation mistakes...</p>
          </div>
        ) : mistakes.length === 0 ? (
          <div className="py-16 text-center text-theme-text-muted flex flex-col items-center justify-center gap-3">
            <div className="p-3 bg-theme-page-bg border border-theme-border-input/50 rounded-2xl">
              <Inbox className="h-8 w-8 text-theme-text-muted/60" />
            </div>
            <p className="text-xs font-semibold text-theme-text-primary">No quotation mistakes found.</p>
            <p className="text-[11px] text-theme-text-muted">
              {isFilterActive
                ? 'Try resetting your search or date filters.'
                : 'No mistake records have been logged yet.'}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-theme-border-input text-left text-sm">
            <thead className="bg-theme-card-bg/50 text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">
              <tr>
                <th className="px-4 py-2 w-28">Date</th>
                <th className="px-4 py-2 w-48">Filename</th>
                <th className="px-4 py-2 w-28">Branch</th>
                <th className="px-4 py-2 w-36">Codename</th>
                <th className="px-4 py-2">Details</th>
                <th className="px-4 py-2 w-48">Penalty</th>
                
                {/* Action Column Header */}
                <th
                  className="p-0 text-center overflow-hidden border-0"
                  style={cellStyle}
                >
                  <div
                    className="flex justify-center items-center overflow-hidden"
                    style={getInnerStyle("16px", "16px")}
                  >
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={handleBulkDelete}
                        className={`p-1.5 rounded-lg transition-all duration-300 ${
                          selectedIds.length > 0
                            ? "text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer opacity-100"
                            : "text-theme-border-input opacity-30 cursor-not-allowed"
                        }`}
                        disabled={selectedIds.length === 0 || isSubmitting}
                        title="Delete Selected"
                      >
                        <Trash2 className="h-4 w-4 stroke-[2.5]" />
                      </button>
                      
                      <button
                        onClick={toggleAllSelection}
                        className={`rounded-full border border-theme-border-active bg-theme-page-bg cursor-pointer h-4 w-4 flex items-center justify-center transition-all duration-300 transform shrink-0 ${
                          mistakes.length > 0 && mistakes.every((r) => selectedIds.includes(r.id))
                            ? "bg-blue-500 border-blue-500"
                            : ""
                        } ${
                          isSelectionMode
                            ? "scale-100 opacity-100"
                            : "scale-0 opacity-0"
                        }`}
                      >
                        {mistakes.length > 0 && mistakes.every((r) => selectedIds.includes(r.id)) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-muted text-theme-text-secondary">
              {mistakes.map((item) => (
                <tr
                  key={item.id}
                  onContextMenu={(e) => handleRowContextMenu(e, item)}
                  onClick={(e) => handleRowClick(e, item)}
                  className={`hover:bg-theme-card-bg/60 transition-colors duration-150 group select-none ${
                    selectedIds.includes(item.id) ? "bg-theme-card-bg/80" : ""
                  } ${isSelectionMode && canWrite ? "cursor-pointer" : ""}`}
                >
                  {/* Date */}
                  <td className="py-2.5 px-4 font-semibold text-theme-text-primary whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      {formatDateDDMMYYYY(item.date)}
                    </div>
                  </td>

                  {/* Filename */}
                  <td className="py-2.5 px-4 text-theme-text-primary font-medium max-w-[200px] truncate" title={item.filename}>
                    <div className="flex items-center gap-1.5">
                      <FileCode className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                      {item.filename}
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {item.branch}
                    </span>
                  </td>

                  {/* Codename */}
                  <td className="py-2.5 px-4 font-semibold text-theme-text-primary whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      {(() => {
                        const profileMatch = profilesList.find((p) => p.id === item.user_id);
                        return profileMatch
                          ? profileMatch.codename || profileMatch.username
                          : item.codename;
                      })()}
                    </div>
                  </td>

                  {/* Details */}
                  <td className="py-2.5 px-4 text-theme-text-muted leading-relaxed max-w-[300px]">
                    <p className="line-clamp-2" title={item.mistake_details}>
                      {item.mistake_details}
                    </p>
                  </td>

                  {/* Penalty */}
                  <td className="py-2.5 px-4 font-medium text-rose-400 max-w-[250px]">
                    <div className="flex items-start gap-1.5">
                      <Gavel className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <p className="line-clamp-2" title={item.penalty}>
                        {item.penalty}
                      </p>
                    </div>
                  </td>

                  {/* Sliding Action Column */}
                  <td
                    className="p-0 text-center overflow-hidden border-0"
                    style={cellStyle}
                  >
                    <div
                      className="flex justify-center items-center overflow-hidden"
                      style={getInnerStyle("24px", "12px")}
                    >
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(item.id);
                        }}
                        className={`rounded-full border border-theme-border-active bg-theme-page-bg cursor-pointer h-4 w-4 flex items-center justify-center transition-all duration-300 transform shrink-0 disabled:opacity-20 disabled:cursor-not-allowed ${
                          selectedIds.includes(item.id) ? 'bg-blue-500 border-blue-500' : ''
                        } ${
                          isSelectionMode
                            ? "scale-100 opacity-100"
                            : "scale-0 opacity-0"
                        }`}
                      >
                        {selectedIds.includes(item.id) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Footer / Pagination */}
        {!isLoading && totalCount > 0 && (
          <div className="px-4 py-3 bg-theme-page-bg/50 border-t border-theme-border-input/60 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-theme-text-muted">
            <div>
              Showing <span className="font-semibold text-theme-text-primary">{mistakes.length}</span> of{' '}
              <span className="font-semibold text-theme-text-primary">{allFilteredCount}</span> filtered records
              {totalCount !== allFilteredCount && ` (from ${totalCount} total)`}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="p-1.5 border border-theme-border-input rounded-lg hover:bg-theme-card-bg text-theme-text-muted disabled:opacity-40 cursor-pointer transition-all duration-150"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-bold text-theme-text-primary px-1">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="p-1.5 border border-theme-border-input rounded-lg hover:bg-theme-card-bg text-theme-text-muted disabled:opacity-40 cursor-pointer transition-all duration-150"
                  title="Next Page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      <AddEditMistakeModal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        onSave={handleSaveModal}
        editingMistake={editingMistake}
        profilesList={profilesList}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={(val) => {
          setShowDeleteModal(val);
          if (!val) {
            setIsBulkDeleteMode(false);
            setMistakeToDelete(null);
          }
        }}
        deletingRecord={isSubmitting}
        handleConfirmDelete={handleConfirmDelete}
        bulkCount={isBulkDeleteMode ? selectedIds.length : undefined}
      />

      {/* Context Menu */}
      {contextMenu &&
        typeof window !== "undefined" &&
        require("react-dom").createPortal(
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 backdrop-blur-lg bg-theme-card-bg/95 border border-theme-border-input rounded-xl shadow-2xl p-1 w-36 select-none animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedIds.includes(contextMenu.record.id) ? (
              <button
                onClick={() => handleContextDeselect(contextMenu.record)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-input rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
                Deselect
              </button>
            ) : (
              <button
                onClick={() => handleContextSelect(contextMenu.record)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-input rounded-lg transition-all cursor-pointer flex items-center gap-2"
              >
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Select
              </button>
            )}

            <button
              onClick={() => handleOpenEdit(contextMenu.record)}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-input rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Edit2 className="h-3.5 w-3.5 text-theme-text-muted" />
              Edit
            </button>
            <button
              onClick={() => handleOpenDelete(contextMenu.record)}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-955/20 rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500 stroke-2" />
              Delete
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
