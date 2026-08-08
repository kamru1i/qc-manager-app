import React, { Suspense } from "react";
import { Search, X, RefreshCw, FileSpreadsheet } from "lucide-react";
import { SkeletonLoader } from "@/components/quotes-tracker/QuotesSkeletonLoader";
import { CustomSelect } from "@/components/common/CustomSelect";
import { AdminViewToggle } from "@/components/leave-tracker/AdminViewToggle";
import { RecordsTable } from "@/components/quotes-tracker/RecordsTable";

export interface SaleSummaryTabProps {
  saleSearchQuery: string;
  setSaleSearchQuery: (val: string) => void;
  saleSelectedBranch: string;
  setSaleSelectedBranch: (val: string) => void;
  uniqueBranches: string[];
  saleSelectedYear: string;
  setSaleSelectedYear: (val: string) => void;
  saleSelectedDate: string;
  setSaleSelectedDate: (val: string) => void;
  dynamicYears: string[];
  saleSelectedMonth: string;
  setSaleSelectedMonth: (val: string) => void;
  dynamicMonths: { val: string; name: string }[];
  saleDateInputVal: string;
  setSaleDateInputVal: (val: string) => void;
  handleSaleDateInputChange: (val: string) => void;
  handleOpenSpecificSaleDatePicker: () => void;
  specificSaleDateRef: React.RefObject<HTMLInputElement | null>;
  handleSaleDateFilterChange: (val: string) => void;
  handleExportSaleSummaryExcel: () => void;
  isAdmin: boolean;
  saleAdminViewMode: "all" | "mine";
  setSaleAdminViewMode: (mode: "all" | "mine") => void;
  saleSummaryStats: { total: number; soldFormatted: string; unsoldFormatted: string };
  recordsLoading: boolean;
  saleSummaryRecords: any[];
  handleOpenEditRecord: (record: any, isMonthly: boolean) => void;
  setDeletingRecordId: (id: string | null) => void;
  sessionUser: any;
  setBulkDeletingRecordIds: (ids: string[] | null) => void;
  handleSaveInline: (id: string, updates: any) => Promise<boolean>;
  handleBulkSaveInline: (updates: any) => Promise<boolean>;
  allowedCategories: string[];
  submitting: boolean;
}

export const SaleSummaryTab = React.memo(
  ({
    saleSearchQuery,
    setSaleSearchQuery,
    saleSelectedBranch,
    setSaleSelectedBranch,
    uniqueBranches,
    saleSelectedYear,
    setSaleSelectedYear,
    saleSelectedDate,
    setSaleSelectedDate,
    dynamicYears,
    saleSelectedMonth,
    setSaleSelectedMonth,
    dynamicMonths,
    saleDateInputVal,
    setSaleDateInputVal,
    handleSaleDateInputChange,
    handleOpenSpecificSaleDatePicker,
    specificSaleDateRef,
    handleSaleDateFilterChange,
    handleExportSaleSummaryExcel,
    isAdmin,
    saleAdminViewMode,
    setSaleAdminViewMode,
    saleSummaryStats,
    recordsLoading,
    saleSummaryRecords,
    handleOpenEditRecord,
    setDeletingRecordId,
    sessionUser,
    setBulkDeletingRecordIds,
    handleSaveInline,
    handleBulkSaveInline,
    allowedCategories,
    submitting,
  }: SaleSummaryTabProps) => {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="bg-theme-page-bg/40 p-3.5 rounded-2xl border border-theme-border-muted flex flex-wrap lg:flex-nowrap items-end gap-2 w-full">
            <div className="w-full sm:w-36 md:w-40 lg:w-44 shrink-0">
              <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search name..."
                  value={saleSearchQuery}
                  onChange={(e) => setSaleSearchQuery(e.target.value)}
                  className="block w-full pl-7 pr-6 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-9"
                />
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-theme-text-muted" />
                {saleSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSaleSearchQuery("")}
                    className="absolute right-1.5 top-2 flex items-center justify-center p-0.5 hover:bg-theme-border-input rounded-full text-theme-text-muted hover:text-theme-text-primary transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="w-full sm:w-28 lg:w-32 shrink-0">
              <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                Branch
              </label>
              <CustomSelect
                value={saleSelectedBranch}
                onChange={setSaleSelectedBranch}
                options={[
                  { value: "", label: "All Branches" },
                  ...uniqueBranches.map((b) => ({ value: b, label: b })),
                ]}
                buttonClassName="w-full px-2 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-9 flex items-center justify-between gap-1 text-left font-semibold select-none"
                className="w-full"
              />
            </div>

            <div className="w-full sm:w-16 lg:w-20 shrink-0">
              <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                Year
              </label>
              <CustomSelect
                value={saleSelectedYear}
                disabled={!!saleSelectedDate}
                onChange={(val) => {
                  setSaleSelectedYear(val);
                  setSaleSelectedDate(""); 
                }}
                options={dynamicYears.map((year) => ({
                  value: year,
                  label: year,
                }))}
                buttonClassName="w-full px-2 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-theme-card-bg/30 h-9 flex items-center justify-between gap-1 text-left font-semibold select-none"
                className="w-full"
              />
            </div>

            <div className="w-full sm:w-20 lg:w-24 shrink-0">
              <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                Month
              </label>
              <CustomSelect
                value={saleSelectedMonth}
                disabled={!!saleSelectedDate}
                onChange={(val) => {
                  setSaleSelectedMonth(val);
                  setSaleSelectedDate(""); 
                }}
                options={dynamicMonths.map((m) => ({
                  value: m.val,
                  label: m.name,
                }))}
                buttonClassName="w-full px-2 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-theme-card-bg/30 h-9 flex items-center justify-between gap-1 text-left font-semibold select-none"
                className="w-full"
              />
            </div>

            <div className="w-full sm:w-28 lg:w-32 shrink-0">
              <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                Specific Date
              </label>
              <div className="flex gap-1 items-center">
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder="DD-MM-YYYY"
                    value={saleDateInputVal}
                    onChange={(e) => handleSaleDateInputChange(e.target.value)}
                    onClick={handleOpenSpecificSaleDatePicker}
                    maxLength={10}
                    className="block w-full px-2 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-blue-500 h-9 cursor-pointer"
                  />
                  <input
                    type="date"
                    ref={specificSaleDateRef}
                    value={saleSelectedDate}
                    onChange={(e) => handleSaleDateFilterChange(e.target.value)}
                    className="absolute w-px h-px opacity-0 pointer-events-none select-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSaleSearchQuery("");
                    setSaleSelectedBranch("");
                    setSaleSelectedYear(new Date().getFullYear().toString());
                    setSaleSelectedMonth(
                      String(new Date().getMonth() + 1).padStart(2, "0"),
                    );
                    setSaleSelectedDate("");
                    setSaleDateInputVal("");
                  }}
                  className="p-1.5 bg-theme-card-bg border border-theme-border-input hover:border-theme-border-active hover:text-theme-text-primary text-theme-text-muted rounded-lg transition-all duration-200 flex items-center justify-center shrink-0 w-8 h-9 cursor-pointer"
                  title="Reset all filters"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <button
                onClick={handleExportSaleSummaryExcel}
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer shadow-md h-9"
                title="Export to Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Excel</span>
              </button>

              {isAdmin && (
                <AdminViewToggle
                  viewMode={saleAdminViewMode}
                  onChange={setSaleAdminViewMode}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <div className="bg-theme-card-bg border border-theme-border-input rounded-xl px-4 py-2 text-xs text-theme-text-secondary shadow-sm flex items-center gap-2 min-h-9">
            Total Sales: <strong className="text-theme-text-primary text-sm">{saleSummaryStats.total}</strong>
          </div>
          <div className="bg-theme-card-bg border border-theme-border-input rounded-xl px-4 py-2 text-xs text-theme-text-secondary shadow-sm flex items-center gap-2 min-h-9">
            Sold: <strong className="text-emerald-400 text-sm">{saleSummaryStats.soldFormatted}</strong>
          </div>
          <div className="bg-theme-card-bg border border-theme-border-input rounded-xl px-4 py-2 text-xs text-theme-text-secondary shadow-sm flex items-center gap-2 min-h-9">
            Unsold: <strong className="text-red-400 text-sm">{saleSummaryStats.unsoldFormatted}</strong>
          </div>
        </div>

        <Suspense fallback={<SkeletonLoader type="table" />}>
          <RecordsTable
            records={saleSummaryRecords}
            emptyMessage="No sale records found matching the filters."
            showDate={true}
            isSaleSummaryView={true}
            onEdit={(record) => handleOpenEditRecord(record, true)}
            onDelete={setDeletingRecordId}
            isLoading={recordsLoading}
            currentUserId={sessionUser?.id}
            isAdmin={isAdmin}
            onBulkDelete={setBulkDeletingRecordIds}
            onSaveInline={handleSaveInline}
            onBulkSaveInline={handleBulkSaveInline}
            allowedCategories={allowedCategories}
            submitting={submitting}
          />
        </Suspense>
      </div>
    );
  }
);
