import React, { Suspense } from "react";
import { Clock, Search, X, FileSpreadsheet } from "lucide-react";
import { DailyEntryForm } from "@/components/leave-tracker/DailyEntryForm";
import { SkeletonLoader } from "@/components/quotes-tracker/QuotesSkeletonLoader";
import { CustomSelect } from "@/components/common/CustomSelect";
import { AdminViewToggle } from "@/components/leave-tracker/AdminViewToggle";
import { StatsGrid } from "@/components/common/StatsGrid";
import { RecordsTable } from "@/components/quotes-tracker/RecordsTable";
import { FileType } from "@/types";

export interface DailyEntryTabProps {
  fileName: string;
  setFileName: (val: string) => void;
  branchName: string;
  setBranchName: (val: string) => void;
  codenameInput: string;
  setCodenameInput: (val: string) => void;
  fileType: FileType;
  setFileType: (val: FileType) => void;
  allowedCategories: string[];
  submitting: boolean;
  handleAddEntry: (e: React.FormEvent) => Promise<void>;
  cleanFileName: (name: string) => string;
  todaySearchQuery: string;
  setTodaySearchQuery: (val: string) => void;
  todaySelectedBranch: string;
  setTodaySelectedBranch: (val: string) => void;
  uniqueBranches: string[];
  handleClearTodayFilters: () => void;
  handleExportTodayExcel: () => void;
  isAdmin: boolean;
  todayAdminViewMode: "all" | "mine";
  setTodayAdminViewMode: (mode: "all" | "mine") => void;
  todayStats: any;
  recordsLoading: boolean;
  todayFilteredRecords: any[];
  handleOpenEditRecord: (record: any, isMonthly: boolean) => void;
  setDeletingRecordId: (id: string | null) => void;
  sessionUser: any;
  setBulkDeletingRecordIds: (ids: string[] | null) => void;
  handleSaveInline: (id: string, updates: any) => Promise<boolean>;
  handleBulkSaveInline: (updates: any) => Promise<boolean>;
}

export const DailyEntryTab = React.memo(
  ({
    fileName,
    setFileName,
    branchName,
    setBranchName,
    codenameInput,
    setCodenameInput,
    fileType,
    setFileType,
    allowedCategories,
    submitting,
    handleAddEntry,
    cleanFileName,
    todaySearchQuery,
    setTodaySearchQuery,
    todaySelectedBranch,
    setTodaySelectedBranch,
    uniqueBranches,
    handleClearTodayFilters,
    handleExportTodayExcel,
    isAdmin,
    todayAdminViewMode,
    setTodayAdminViewMode,
    todayStats,
    recordsLoading,
    todayFilteredRecords,
    handleOpenEditRecord,
    setDeletingRecordId,
    sessionUser,
    setBulkDeletingRecordIds,
    handleSaveInline,
    handleBulkSaveInline,
  }: DailyEntryTabProps) => {
    return (
      <div className="space-y-6">
        <Suspense fallback={<SkeletonLoader type="form" />}>
          <DailyEntryForm
            fileName={fileName}
            setFileName={setFileName}
            branchName={branchName}
            setBranchName={setBranchName}
            codenameInput={codenameInput}
            setCodenameInput={setCodenameInput}
            fileType={fileType}
            setFileType={setFileType}
            allowedCategories={allowedCategories}
            submitting={submitting}
            onSubmit={handleAddEntry}
            isAdmin={false}
            cleanFileName={cleanFileName}
          />
        </Suspense>

        <div className="border-t border-theme-border-input/80 pt-6 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div className="shrink-0">
              <h3 className="text-md font-bold text-theme-text-primary flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-blue-500" />
                Today's File Entry List
              </h3>
              <p className="text-[11px] text-theme-text-muted mt-0.5">
                Date:{" "}
                {new Date().toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 w-full lg:w-auto flex-1 lg:justify-end">
              <div className="relative flex-1 min-w-[200px] max-w-full lg:max-w-md">
                <input
                  type="text"
                  placeholder="Search name, codename..."
                  value={todaySearchQuery}
                  onChange={(e) => setTodaySearchQuery(e.target.value)}
                  className="block w-full pl-8 pr-8 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-8"
                />
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-theme-text-muted" />
                {todaySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTodaySearchQuery("")}
                    className="absolute right-2.5 top-1.5 flex items-center justify-center p-0.5 hover:bg-theme-border-input rounded-full text-theme-text-muted hover:text-theme-text-primary transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <CustomSelect
                value={todaySelectedBranch}
                onChange={setTodaySelectedBranch}
                options={[
                  { value: "", label: "All Branches" },
                  ...uniqueBranches.map((b) => ({ value: b, label: b })),
                ]}
                buttonClassName="w-full sm:w-40 px-3 py-1 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-8 flex items-center justify-between gap-2 text-left font-semibold select-none"
                className="w-full sm:w-40 shrink-0"
              />

              {(todaySearchQuery || todaySelectedBranch) && (
                <button
                  type="button"
                  onClick={handleClearTodayFilters}
                  className="px-3 py-1 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-[10px] text-theme-text-muted hover:text-theme-text-primary font-semibold rounded-lg transition-all h-8 cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}

              <button
                onClick={handleExportTodayExcel}
                className="flex items-center gap-1.5 py-1 px-3 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer shadow-md h-8 shrink-0"
                title="Export to Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Excel</span>
              </button>

              {isAdmin && (
                <AdminViewToggle
                  viewMode={todayAdminViewMode}
                  onChange={setTodayAdminViewMode}
                />
              )}
            </div>
          </div>

          <Suspense fallback={<SkeletonLoader type="stats" />}>
            <StatsGrid stats={todayStats} isLoading={recordsLoading} />
          </Suspense>

          <Suspense fallback={<SkeletonLoader type="table" />}>
            <RecordsTable
              records={todayFilteredRecords}
              emptyMessage="No file entries for today matching the filters."
              showDate={false}
              onEdit={(record) => handleOpenEditRecord(record, false)}
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
      </div>
    );
  }
);

DailyEntryTab.displayName = "DailyEntryTab";
