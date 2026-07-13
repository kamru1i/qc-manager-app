import React from "react";
import { FileText, MapPin, UserCheck, Plus, Loader2, X } from "lucide-react";
import { FileType } from "@/types";
import { CategorySelector } from "@/components/quotes-tracker/CategorySelector";
import { BranchSelector } from "@/components/common/BranchSelector";
import { cleanFileName } from "@/utils/quotesDashboardHelpers";

interface DailyEntryFormProps {
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
  onSubmit: (e: React.FormEvent) => void;
  isAdmin?: boolean;
}

export const DailyEntryForm: React.FC<DailyEntryFormProps> = ({
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
  onSubmit,
  isAdmin = false,
}) => {
  // Reused CategorySelector component handles isRequoteActive, handleRequoteClick, handleReviewClick, etc.

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-theme-page-bg/40 p-5 rounded-2xl border border-theme-border-muted"
    >
      {/* Left side inputs */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="flex text-xs font-semibold text-theme-text-secondary items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-500" /> File Name
            </label>
            {fileName && (
              <button
                type="button"
                onClick={() => setFileName("")}
                className="flex items-center gap-1 text-[10px] text-theme-text-muted hover:text-rose-400 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          <input
            type="text"
            required
            placeholder="e.g. Williams James"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onBlur={(e) => setFileName(cleanFileName(e.target.value))}
            className="block w-full px-3.5 py-2.5 bg-theme-page-bg border border-theme-border-input rounded-xl text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="flex text-xs font-semibold text-theme-text-secondary items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-500" /> Branch Name
            </label>
            {branchName && (
              <button
                type="button"
                onClick={() => setBranchName("")}
                className="flex items-center gap-1 text-[10px] text-theme-text-muted hover:text-rose-400 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          <BranchSelector value={branchName} onChange={setBranchName} />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="flex text-xs font-semibold text-theme-text-secondary items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-blue-500" /> Codename{" "}
              {!isAdmin && (
                <span className="text-[10px] text-theme-text-muted font-normal">
                  (Locked)
                </span>
              )}
            </label>
            {isAdmin && codenameInput && (
              <button
                type="button"
                onClick={() => setCodenameInput("")}
                className="flex items-center gap-1 text-[10px] text-theme-text-muted hover:text-rose-400 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          <input
            type="text"
            required
            disabled={!isAdmin}
            placeholder="e.g. KI1024"
            value={codenameInput}
            onChange={(e) => setCodenameInput(e.target.value.toUpperCase())}
            className="block w-full px-3.5 py-2.5 bg-theme-page-bg border border-theme-border-input rounded-xl text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-theme-card-bg/30"
          />
        </div>
      </div>

      {/* Right side file type selection */}
      <div className="space-y-4 flex flex-col justify-between">
        <div>
          <label className="block text-xs font-semibold text-theme-text-secondary mb-2.5">
            Select File Type
          </label>

          <CategorySelector
            selectedType={fileType}
            setSelectedType={setFileType}
            allowedCategories={allowedCategories}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-1/2 self-end mt-4 flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer disabled:opacity-50 shadow-md shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-theme-card-container"
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 text-theme-text-primary" />{" "}
              Submitting...
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" /> Submit
            </>
          )}
        </button>
      </div>
    </form>
  );
};
