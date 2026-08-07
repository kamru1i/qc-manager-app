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

  const handleOpenAdd = () => {
    setEditingMistake(null);
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (item: QuotationMistake) => {
    setEditingMistake(item);
    setIsAddEditOpen(true);
  };

  const handleOpenDelete = (item: QuotationMistake) => {
    setMistakeToDelete(item);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!mistakeToDelete) return;
    const ok = await deleteMistake(mistakeToDelete);
    if (ok) {
      setShowDeleteModal(false);
      setMistakeToDelete(null);
    }
  };

  const handleSaveModal = async (payload: {
    date: string;
    filename: string;
    branch: string;
    user_id: string;
    codename: string;
    mistake_details: string;
    penalty: string;
  }) => {
    if (editingMistake) {
      return await updateMistake(editingMistake.id, payload);
    } else {
      return await addMistake(payload);
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
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer transition-all duration-200 h-9 shrink-0 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Mistake
            </button>
          )}
        </div>
      </div>

      {/* Table & Data Container */}
      <div className="bg-theme-card-bg/60 border border-theme-border-input/60 rounded-2xl overflow-hidden shadow-sm">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-theme-page-bg/70 border-b border-theme-border-input/60 text-[11px] font-bold text-theme-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[110px]">Date</th>
                  <th className="py-3 px-4 min-w-[160px]">Filename</th>
                  <th className="py-3 px-4 min-w-[100px]">Branch</th>
                  <th className="py-3 px-4 min-w-[130px]">Codename</th>
                  <th className="py-3 px-4 min-w-[240px]">Details</th>
                  <th className="py-3 px-4 min-w-[200px]">Penalty</th>
                  {canWrite && <th className="py-3 px-4 text-right min-w-[100px]">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border-input/40 text-xs">
                {mistakes.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-theme-page-bg/40 transition-colors duration-150 group"
                  >
                    {/* Date */}
                    <td className="py-3 px-4 font-semibold text-theme-text-primary whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        {formatDateDDMMYYYY(item.date)}
                      </div>
                    </td>

                    {/* Filename */}
                    <td className="py-3 px-4 font-medium text-theme-text-primary max-w-[220px] truncate" title={item.filename}>
                      <div className="flex items-center gap-1.5">
                        <FileCode className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span className="truncate">{item.filename}</span>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.branch}
                      </span>
                    </td>

                    {/* Codename */}
                    <td className="py-3 px-4 font-semibold text-theme-text-primary whitespace-nowrap">
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
                    <td className="py-3 px-4 text-theme-text-muted leading-relaxed max-w-[300px]">
                      <p className="line-clamp-2" title={item.mistake_details}>
                        {item.mistake_details}
                      </p>
                    </td>

                    {/* Penalty */}
                    <td className="py-3 px-4 font-medium text-rose-400 max-w-[250px]">
                      <div className="flex items-start gap-1.5">
                        <Gavel className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <p className="line-clamp-2" title={item.penalty}>
                          {item.penalty}
                        </p>
                      </div>
                    </td>

                    {/* Actions (Only visible for permitted roles) */}
                    {canWrite && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-theme-text-muted hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all duration-150 cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(item)}
                            className="p-1.5 text-theme-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-150 cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        setShowDeleteModal={setShowDeleteModal}
        recordToDelete={mistakeToDelete as any}
        setRecordToDelete={setMistakeToDelete as any}
        deletingRecord={isSubmitting}
        handleConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
}
