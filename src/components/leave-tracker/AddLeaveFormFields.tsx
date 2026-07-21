"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { DateInput } from "@/components/common/DateInput";
import { ChutiRecord } from "@/utils/offlineSync";
import {
  formatDate,
  formatTimeToAMPM,
  checkIfHolidayOrWeekend,
  getLeaveValidationError,
  isFriday,
} from "@/utils/dashboardHelpers";
import { CustomSelect } from "@/components/common/CustomSelect";

interface AddLeaveFormFieldsProps {
  date: string;
  setDate: (val: string) => void;
  leaveType: string;
  setLeaveType: (val: string) => void;
  adjustmentCategory: string;
  setAdjustmentCategory: (val: string) => void;
  setAdjustment: (val: boolean) => void;
  adjustShortLeave: boolean;
  setAdjustShortLeave: (val: boolean) => void;
  signInTime: string;
  setSignInTime: (val: string) => void;
  signOutTime: string;
  setSignOutTime: (val: string) => void;
  leaveHour: string;
  setLeaveHour: (val: string) => void;
  comment: string;
  setComment: (val: string) => void;
  bulkDates: string[];
  bulkAdjustments: boolean[];
  handleAddBulkDate: () => void;
  handleUpdateBulkDate: (index: number, val: string) => void;
  handleUpdateBulkAdjustment: (index: number, val: boolean) => void;
  handleRemoveBulkDate: (index: number) => void;
  allowOvertime: boolean;
  children?: React.ReactNode; // Slots for supervisor selection or other content
  adjustment?: boolean;
  availableOvertimeMins?: number;
  availableShortLeaveMins?: number;
  records?: ChutiRecord[];
  govtHolidayRemaining?: number;
  eidFitrRemaining?: number;
  eidAdhaRemaining?: number;
  eligibleOfficeLeave?: boolean;
  officeLeaveRemaining?: number;
  workingHours?: number;
  isAdmin?: boolean;
  globalSettings?: any;
  adjustJummah?: boolean;
  setAdjustJummah?: (val: boolean) => void;
  breakEligible?: boolean;
  breakEnabled?: boolean;
  setBreakEnabled?: (val: boolean) => void;
  breakMinutes?: number;
  setBreakMinutes?: (val: number) => void;
  onDateErrorChange?: (id: string, hasError: boolean) => void;
}

export const AddLeaveFormFields: React.FC<AddLeaveFormFieldsProps> = ({
  date,
  setDate,
  leaveType,
  setLeaveType,
  adjustmentCategory,
  setAdjustmentCategory,
  setAdjustment,
  adjustShortLeave,
  setAdjustShortLeave,
  signInTime,
  setSignInTime,
  signOutTime,
  setSignOutTime,
  leaveHour,
  setLeaveHour,
  comment,
  setComment,
  bulkDates,
  handleAddBulkDate,
  handleUpdateBulkDate,
  handleUpdateBulkAdjustment,
  handleRemoveBulkDate,
  allowOvertime,
  children,
  adjustment = false,
  availableShortLeaveMins = 0,
  records = [],
  govtHolidayRemaining = 0,
  eidFitrRemaining = 0,
  eidAdhaRemaining = 0,
  workingHours = 9.5,
  isAdmin = false,
  globalSettings,
  onDateErrorChange,
  adjustJummah = false,
  setAdjustJummah,
  breakEligible = false,
  breakEnabled = false,
  setBreakEnabled,
  breakMinutes = 20,
  setBreakMinutes,
}) => {
  const isHoliday = globalSettings
    ? checkIfHolidayOrWeekend(date, globalSettings)
    : false;
  const validationError = getLeaveValidationError(
    leaveType,
    signInTime,
    signOutTime,
    workingHours,
    isHoliday,
  );

  const isFullLeave = leaveType === "Full Leave";
  const hasAnyFullLeaveToggle =
    isAdmin ||
    govtHolidayRemaining > 0 ||
    eidFitrRemaining > 0 ||
    eidAdhaRemaining > 0;

  const leaveTypeOptions = [
    { value: "Short Leave", label: "Short Leave" },
    { value: "Full Leave", label: "Full Leave" },
    ...(allowOvertime ? [{ value: "Overtime", label: "Overtime" }] : []),
  ];

  const [showBulkAdjPrompt, setShowBulkAdjPrompt] = React.useState(false);
  const [pendingCategory, setPendingCategory] = React.useState("");
  const [customDaysInput, setCustomDaysInput] = React.useState("");

  React.useEffect(() => {
    if (!showBulkAdjPrompt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBulkAdjPrompt(false);
        setPendingCategory("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showBulkAdjPrompt]);

  const handleToggleCategory = (cat: string) => {
    if (cat === "None") {
      if (adjustment && adjustmentCategory === "None") {
        setAdjustment(false);
        bulkDates.forEach((_, idx) => handleUpdateBulkAdjustment(idx, false));
        if (comment.trim() === "Adjustment") {
          setComment("");
        }
      } else {
        if (bulkDates.length > 0) {
          setPendingCategory("None");
          setCustomDaysInput(String(bulkDates.length + 1));
          setShowBulkAdjPrompt(true);
        } else {
          setAdjustmentCategory("None");
          setAdjustment(true);
          if (
            !comment ||
            comment.trim() === "" ||
            [
              "Office Leave",
              "Govt Holiday",
              "Eid-ul-Fitr",
              "Eid-ul-Adha",
              "Adjustment",
            ].includes(comment.trim())
          ) {
            setComment("Adjustment");
          }
        }
      }
      return;
    }

    if (adjustmentCategory === cat && adjustment) {
      setAdjustmentCategory("None");
      setAdjustment(false);
      bulkDates.forEach((_, idx) => handleUpdateBulkAdjustment(idx, false));
      if (comment.trim() === cat) {
        setComment("");
      }
    } else {
      if (bulkDates.length > 0) {
        setPendingCategory(cat);
        setCustomDaysInput(String(bulkDates.length + 1));
        setShowBulkAdjPrompt(true);
      } else {
        setAdjustmentCategory(cat);
        setAdjustment(true);
        if (
          !comment ||
          comment.trim() === "" ||
          [
            "Office Leave",
            "Govt Holiday",
            "Eid-ul-Fitr",
            "Eid-ul-Adha",
            "Overtime",
            "Adjustment",
          ].includes(comment.trim())
        ) {
          setComment(cat);
        }
      }
    }
  };

  const handleConfirmBulkAdj = (k: number) => {
    setAdjustmentCategory(pendingCategory);
    setAdjustment(k >= 1);
    bulkDates.forEach((_, idx) => {
      handleUpdateBulkAdjustment(idx, idx < k - 1);
    });
    if (
      !comment ||
      comment.trim() === "" ||
      [
        "Office Leave",
        "Govt Holiday",
        "Eid-ul-Fitr",
        "Eid-ul-Adha",
        "Overtime",
        "Adjustment",
      ].includes(comment.trim())
    ) {
      setComment(pendingCategory === "None" ? "Adjustment" : pendingCategory);
    }
    setShowBulkAdjPrompt(false);
    setPendingCategory("");
  };

  const parseHHMMToMins = (str: string): number => {
    if (!str) return 0;
    const parts = str.replace("-", "").split(":").map(Number);
    if (parts.length >= 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  const formatMinsToHHMM = (totalMins: number): string => {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  const leaveMins = parseHHMMToMins(leaveHour);

  // Overtime Adjustment details helper message
  let overtimeAdjMsg = "";
  if (leaveType === "Overtime" && availableShortLeaveMins > 0) {
    const adjustedMins = Math.min(leaveMins, availableShortLeaveMins);
    const adjustedStr = formatMinsToHHMM(adjustedMins);
    const remainingMins = Math.max(0, leaveMins - availableShortLeaveMins);
    const remainingStr = formatMinsToHHMM(remainingMins);

    if (adjustShortLeave) {
      overtimeAdjMsg = `✅ ${adjustedStr} hour adjusted, ${remainingStr} hour will be counted as overtime.`;
    } else {
      overtimeAdjMsg = `ℹ️ adjust with ${adjustedStr} hours`;
    }
  }

  const duplicateRecord = date ? records.find((r) => r.date === date) : null;

  const currentYear = new Date().getFullYear();
  const minDate = `${currentYear}-01-01`;
  const maxDate = `${currentYear}-12-31`;

  return (
    <div className="space-y-4">
      {/* Date & Leave Type stacked vertically (each occupying a single line) */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
            Date
          </label>
          <div className="flex gap-2 items-center mt-1">
            <DateInput
              required
              value={date}
              onChange={setDate}
              min={minDate}
              max={maxDate}
              onErrorChange={(hasError) =>
                onDateErrorChange?.("primary", hasError)
              }
              className="bg-theme-page-bg text-xs py-2"
            />
            {isFullLeave && (
              <button
                type="button"
                onClick={handleAddBulkDate}
                className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0 border border-blue-700 shadow-md"
                title="Add more dates"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          {duplicateRecord && (
            <p className="text-red-500 font-semibold text-[10px] mt-1.5 leading-snug">
              ⚠️ Duplicate! {formatDate(date)} is already added as{" "}
              {duplicateRecord.leave_type === "Full Leave"
                ? "Full Leave"
                : duplicateRecord.leave_type === "Short Leave"
                  ? "Short Leave"
                  : "Overtime"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
            Leave Type
          </label>
          <CustomSelect
            value={leaveType}
            onChange={setLeaveType}
            options={leaveTypeOptions}
            className="w-full mt-1"
          />
        </div>
      </div>

      {/* Bulk Dates Input List */}
      {isFullLeave && bulkDates.length > 0 && (
        <div className="space-y-2.5 p-3 bg-theme-page-bg/40 rounded-lg border border-theme-border-muted/80 max-h-48 overflow-y-auto">
          <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
            Additional Leave Dates ({bulkDates.length}{" "}
            {bulkDates.length === 1 ? "day" : "days"})
          </label>
          <div className="grid grid-cols-1 gap-2">
            {bulkDates.map((bulkDate, index) => {
              const bulkDup = bulkDate
                ? records.find((r) => r.date === bulkDate)
                : null;
              return (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex gap-2 items-center">
                    <span className="text-[10px] text-theme-text-muted font-mono w-4">
                      {index + 2}.
                    </span>
                    <div className="flex-1">
                      <DateInput
                        required
                        value={bulkDate}
                        onChange={(val) => handleUpdateBulkDate(index, val)}
                        min={minDate}
                        max={maxDate}
                        onErrorChange={(hasError) =>
                          onDateErrorChange?.(`bulk-${index}`, hasError)
                        }
                        className="bg-theme-page-bg py-1.5 text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveBulkDate(index)}
                      className="p-1.5 bg-red-955/60 hover:bg-red-900 border border-red-900/50 text-red-400 rounded-lg transition-all flex items-center justify-center cursor-pointer shrink-0"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {bulkDup && (
                    <p className="text-red-500 font-semibold text-[9px] pl-6 leading-snug">
                      ⚠️ Duplicate! {formatDate(bulkDate)} is already added as{" "}
                      {bulkDup.leave_type === "Full Leave"
                        ? "Full Leave"
                        : bulkDup.leave_type === "Short Leave"
                          ? "Short Leave"
                          : "Overtime"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjustment Category & Overtime/Reserve Switch */}
      <div className="grid grid-cols-1 gap-4">
        {/* Render Adjustment Category Toggles only for Full Leave */}
        {leaveType === "Full Leave" && hasAnyFullLeaveToggle && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1">
              Leave Adjustment
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* General Adjustment Toggle - Render only if isAdmin === true */}
              {isAdmin && (
                <div className="flex items-center justify-between p-3 bg-theme-page-bg/60 rounded-lg border border-theme-border-input/80">
                  <div>
                    <span className="block text-xs font-semibold text-theme-text-primary font-sans">
                      Adjustment (Salary/Other)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCategory("None")}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      adjustment && adjustmentCategory === "None"
                        ? "bg-blue-600"
                        : "bg-theme-border-input"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        adjustment && adjustmentCategory === "None"
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Govt Holiday Toggle - Render only if govtHolidayRemaining > 0 */}
              {govtHolidayRemaining > 0 && (
                <div className="flex items-center justify-between p-3 bg-theme-page-bg/60 rounded-lg border border-theme-border-input/80">
                  <div>
                    <span className="block text-xs font-semibold text-theme-text-primary font-sans">
                      Govt Holiday
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCategory("Govt Holiday")}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      adjustmentCategory === "Govt Holiday"
                        ? "bg-teal-600"
                        : "bg-theme-border-input"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        adjustmentCategory === "Govt Holiday"
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Eid-ul-Fitr Toggle - Render only if eidFitrRemaining > 0 */}
              {eidFitrRemaining > 0 && (
                <div className="flex items-center justify-between p-3 bg-theme-page-bg/60 rounded-lg border border-theme-border-input/80">
                  <div>
                    <span className="block text-xs font-semibold text-theme-text-primary font-sans">
                      Eid-ul-Fitr
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCategory("Eid-ul-Fitr")}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      adjustmentCategory === "Eid-ul-Fitr"
                        ? "bg-purple-600"
                        : "bg-theme-border-input"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        adjustmentCategory === "Eid-ul-Fitr"
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Eid-ul-Adha Toggle - Render only if eidAdhaRemaining > 0 */}
              {eidAdhaRemaining > 0 && (
                <div className="flex items-center justify-between p-3 bg-theme-page-bg/60 rounded-lg border border-theme-border-input/80">
                  <div>
                    <span className="block text-xs font-semibold text-theme-text-primary font-sans">
                      Eid-ul-Adha
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleCategory("Eid-ul-Adha")}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      adjustmentCategory === "Eid-ul-Adha"
                        ? "bg-purple-600"
                        : "bg-theme-border-input"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        adjustmentCategory === "Eid-ul-Adha"
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Short Leave Adjustment toggles */}
        {leaveType === "Short Leave" &&
          (govtHolidayRemaining > 0 ||
            eidFitrRemaining > 0 ||
            eidAdhaRemaining > 0) && (
            <div className="space-y-3 bg-theme-page-bg/40 p-3.5 rounded-xl border border-theme-border-muted">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-theme-text-primary font-sans">
                    Adjust with Reserve Holiday?
                  </span>
                  <span className="block text-[10px] text-theme-text-muted mt-0.5">
                    Adjust this short leave from reserve holiday balance instead
                    of office leave
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newAdj = !adjustment;
                    setAdjustment(newAdj);
                    if (newAdj) {
                      if (govtHolidayRemaining > 0)
                        setAdjustmentCategory("Govt Holiday");
                      else if (eidFitrRemaining > 0)
                        setAdjustmentCategory("Eid-ul-Fitr");
                      else if (eidAdhaRemaining > 0)
                        setAdjustmentCategory("Eid-ul-Adha");
                    } else {
                      setAdjustmentCategory("Office Leave");
                    }
                  }}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    adjustment ? "bg-blue-600" : "bg-theme-border-input"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      adjustment ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {adjustment && (
                <div className="space-y-2 pt-2.5 border-t border-theme-border-muted/50">
                  <span className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
                    Select Reserve Category
                  </span>
                  <div className="flex flex-col gap-2">
                    {govtHolidayRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setAdjustmentCategory("Govt Holiday")}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                          adjustmentCategory === "Govt Holiday"
                            ? "bg-teal-950/30 border-teal-500/50 text-teal-400 font-semibold"
                            : "bg-theme-card-bg/40 border-theme-border-input text-theme-text-secondary hover:bg-theme-card-bg"
                        }`}
                      >
                        <span className="text-xs font-sans">Govt Holiday</span>
                        <span className="text-[10px] font-mono opacity-80">
                          Remaining: {govtHolidayRemaining} days
                        </span>
                      </button>
                    )}
                    {eidFitrRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setAdjustmentCategory("Eid-ul-Fitr")}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                          adjustmentCategory === "Eid-ul-Fitr"
                            ? "bg-purple-955/30 border-purple-500/50 text-purple-450 font-semibold"
                            : "bg-theme-card-bg/40 border-theme-border-input text-theme-text-secondary hover:bg-theme-card-bg"
                        }`}
                      >
                        <span className="text-xs font-sans">Eid-ul-Fitr</span>
                        <span className="text-[10px] font-mono opacity-80">
                          Remaining: {eidFitrRemaining} days
                        </span>
                      </button>
                    )}
                    {eidAdhaRemaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setAdjustmentCategory("Eid-ul-Adha")}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                          adjustmentCategory === "Eid-ul-Adha"
                            ? "bg-purple-950/30 border-purple-500/50 text-purple-450 font-semibold"
                            : "bg-theme-card-bg/40 border-theme-border-input text-theme-text-secondary hover:bg-theme-card-bg"
                        }`}
                      >
                        <span className="text-xs font-sans">Eid-ul-Adha</span>
                        <span className="text-[10px] font-mono opacity-80">
                          Remaining: {eidAdhaRemaining} days
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Overtime Adjustment toggle with Short Leave (Conditional) */}
        {leaveType === "Overtime" && availableShortLeaveMins > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-theme-page-bg/60 rounded-lg border border-theme-border-input/80">
              <div>
                <span className="block text-xs font-semibold text-theme-text-primary font-sans">
                  Adjust with Short Leave?
                </span>
                <span className="block text-[10px] text-theme-text-muted">
                  If yes, it will be adjusted from short leave balance
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAdjustShortLeave(!adjustShortLeave)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  adjustShortLeave ? "bg-emerald-600" : "bg-theme-border-input"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    adjustShortLeave ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {overtimeAdjMsg && (
              <div
                className={`text-[11px] font-semibold px-1 font-sans ${adjustShortLeave ? "text-emerald-400" : "text-theme-text-muted"}`}
              >
                {overtimeAdjMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sign In & Sign Out Times & Leave Hour (Conditional) */}
      {!isFullLeave && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                  Sign-in
                </label>
                {signInTime && (
                  <span className="text-[10px] font-bold text-blue-450 tracking-wider">
                    {formatTimeToAMPM(signInTime)}
                  </span>
                )}
              </div>
              <input
                type="time"
                required
                value={signInTime}
                onChange={(e) => setSignInTime(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                  Sign-out
                </label>
                {signOutTime && (
                  <span className="text-[10px] font-bold text-blue-450 tracking-wider">
                    {formatTimeToAMPM(signOutTime)}
                  </span>
                )}
              </div>
              <input
                type="time"
                required
                value={signOutTime}
                onChange={(e) => setSignOutTime(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Jummah Prayer Adjustment Toggle (Short Leave, Fridays only) */}
          {leaveType === "Short Leave" && isFriday(date) && (
            <div className="flex items-center justify-between p-3 bg-theme-page-bg/60 rounded-lg border border-theme-border-input/80">
              <div>
                <span className="block text-xs font-semibold text-theme-text-primary font-sans">
                  Adjust with Jummah Prayer?
                </span>
                <span className="block text-[10px] text-theme-text-muted mt-0.5">
                  Deduct 20 minutes from the calculated short leave duration
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAdjustJummah && setAdjustJummah(!adjustJummah)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  adjustJummah ? "bg-indigo-600" : "bg-theme-border-input"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    adjustJummah ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Break Time (Short Leave only, when signed in more than 1 hour late).
              Break counts as short leave, so it is added to the calculated hours. */}
          {leaveType === "Short Leave" && breakEligible && (
            <div className="space-y-2 bg-theme-page-bg/40 p-3.5 rounded-xl border border-theme-border-muted">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-theme-text-primary font-sans">
                    Add break time?
                  </span>
                  <span className="block text-[10px] text-theme-text-muted mt-0.5">
                    Signed in over an hour late — break time (01–40 min) is added
                    to the short leave.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBreakEnabled && setBreakEnabled(!breakEnabled)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    breakEnabled ? "bg-amber-600" : "bg-theme-border-input"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      breakEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {breakEnabled && (
                <div className="flex items-center gap-3 pt-2.5 border-t border-theme-border-muted/50">
                  <label className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider shrink-0">
                    Break
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    step={1}
                    value={breakMinutes}
                    onChange={(e) => {
                      if (!setBreakMinutes) return;
                      const raw = parseInt(e.target.value, 10);
                      if (isNaN(raw)) {
                        setBreakMinutes(1);
                        return;
                      }
                      setBreakMinutes(Math.min(40, Math.max(1, raw)));
                    }}
                    className="w-20 px-2.5 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <span className="text-[10px] text-theme-text-muted">
                    mins (max 40)
                  </span>
                  <span className="ml-auto font-mono text-amber-400 text-xs font-bold">
                    +{formatMinsToHHMM(Math.min(40, Math.max(0, breakMinutes || 0)))}
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
              {leaveType === "Overtime"
                ? "Calculated Overtime Hours"
                : "Calculated Leave Hours"}
            </label>
            <input
              type="text"
              required
              value={leaveHour}
              onChange={(e) => setLeaveHour(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-blue-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {validationError && (
              <div className="mt-1 text-xs text-rose-500 font-semibold font-sans">
                ⚠️ {validationError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Children slots e.g. Supervisor selection fields */}
      {children}

      {/* Comment Box */}
      <div>
        <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
          Comment
        </label>
        <textarea
          rows={2}
          placeholder="Write a brief description..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Bulk Adjustment Prompt Modal */}
      {showBulkAdjPrompt && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBulkAdjPrompt(false);
              setPendingCategory("");
            }
          }}
          className="fixed inset-0 z-100 flex items-center justify-center bg-theme-page-bg/80 backdrop-blur-md p-4"
        >
          <div className="bg-theme-card-bg border border-theme-border-input shadow-2xl rounded-2xl w-full max-w-sm p-6 relative overflow-hidden font-sans">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[80px] pointer-events-none" />

            <h4 className="text-sm font-bold text-theme-text-primary mb-2 flex items-center gap-2">
              Configure Leave Adjustment
            </h4>
            <p className="text-xs text-theme-text-muted mb-4 leading-relaxed">
              You are applying for a total of {bulkDates.length + 1} days of
              leave. Out of these, how many days should be adjusted as{" "}
              <strong>
                {pendingCategory === "None" ? "Adjustment" : pendingCategory}
              </strong>
              ?
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleConfirmBulkAdj(bulkDates.length + 1)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all border border-blue-700 shadow-md"
              >
                Adjust all days ({bulkDates.length + 1} days)
              </button>

              <div className="relative flex items-center gap-2 pt-2 border-t border-theme-border-input/80">
                <input
                  type="number"
                  min={1}
                  max={bulkDates.length + 1}
                  step={1}
                  placeholder="Enter number of days"
                  value={customDaysInput}
                  onChange={(e) => setCustomDaysInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseInt(customDaysInput, 10);
                    if (
                      !isNaN(val) &&
                      val >= 1 &&
                      val <= bulkDates.length + 1
                    ) {
                      handleConfirmBulkAdj(val);
                    }
                  }}
                  className="px-4 py-2 bg-theme-border-input hover:bg-theme-border-active border border-theme-border-active text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-theme-border-muted flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowBulkAdjPrompt(false);
                  setPendingCategory("");
                }}
                className="text-xs text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
