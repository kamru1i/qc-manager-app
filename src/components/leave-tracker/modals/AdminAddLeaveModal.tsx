"use client";

import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Calendar, AlertTriangle, Loader } from "lucide-react";
import { Profile, LeaveSettlement, GovtHolidayResponse } from "@/types";
import { AddLeaveFormFields } from "@/components/leave-tracker/AddLeaveFormFields";
import { supabase } from "@/utils/supabase";
import {
  calculateLeaveOrOvertime,
  calculateStats,
  GlobalSettings,
  calculateHalfYearlyOfficeLeave,
  checkIfHolidayOrWeekend,
  getLeaveValidationError,
  isFriday,
  adjustShortLeaveForJummah
} from "@/utils/dashboardHelpers";
import { ChutiRecord, generateUUID } from "@/utils/offlineSync";

import { toast } from "react-hot-toast";
import { LeaveUsageSummary } from "@/components/leave-tracker/LeaveUsageSummary";

import { Modal } from "@/components/common/Modal";
import { GOVT_HOLIDAY_RESPONSE_COLUMNS } from "@/utils/dbColumns";

interface AdminAddLeaveModalProps {
  showModal: boolean;
  setShowModal: (val: boolean) => void;
  staffProfile: Profile | null;
  onSuccess: () => void;
  records: ChutiRecord[];
  globalSettings: GlobalSettings;
  leaveSettlements?: LeaveSettlement[];
}

export function AdminAddLeaveModal({
  showModal,
  setShowModal,
  staffProfile,
  onSuccess,
  records,
  globalSettings,
  leaveSettlements = [],
}: AdminAddLeaveModalProps) {
  const [date, setDate] = useState("");
  const [leaveType, setLeaveType] = useState("Short Leave");
  const [adjustment, setAdjustment] = useState(false);
  const [adjustmentCategory, setAdjustmentCategory] = useState("None");
  const [adjustShortLeave, setAdjustShortLeave] = useState(false);
  const [signInTime, setSignInTime] = useState("13:00");
  const [signOutTime, setSignOutTime] = useState("22:30");
  const [leaveHour, setLeaveHour] = useState("00:00");
  const [comment, setComment] = useState("");
  const [adjustJummah, setAdjustJummah] = useState(() => new Date().getDay() === 5);
  const [bulkDates, setBulkDates] = useState<string[]>([]);
  const [bulkAdjustments, setBulkAdjustments] = useState<boolean[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [userResponses, setUserResponses] = useState<GovtHolidayResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);

  // Fetch responses when staffProfile changes
  useEffect(() => {
    if (showModal && staffProfile) {
      setLoadingResponses(true);
      const fetchUserResponses = async () => {
        const { data } = await supabase
          .from("govt_holiday_responses")
          .select(GOVT_HOLIDAY_RESPONSE_COLUMNS)
          .eq("user_id", staffProfile.id);
        if (data) {
          setUserResponses(data);
        }
        setLoadingResponses(false);
      };
      fetchUserResponses();
    } else {
      setUserResponses([]);
      setLoadingResponses(false);
    }
  }, [showModal, staffProfile]);

  const prevShowModalRef = useRef(false);

  // Initialize today's date and default times when modal is opened
  useEffect(() => {
    const wasOpen = prevShowModalRef.current;
    prevShowModalRef.current = showModal;

    if (showModal && !wasOpen && staffProfile) {
      const today = new Date();
      const localDate =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");
      setDate(localDate);

      setSignInTime(staffProfile.default_sign_in || "13:00");
      setSignOutTime(staffProfile.default_sign_out || "22:30");
      setLeaveType("Short Leave");
      setAdjustment(false);
      setAdjustmentCategory("None");
      setAdjustShortLeave(false);
      setComment("");
      setBulkDates([]);
      setBulkAdjustments([]);
    }
  }, [showModal, staffProfile]);

  // Sync adjustJummah with date changes
  useEffect(() => {
    if (leaveType === 'Short Leave' && date) {
      setAdjustJummah(isFriday(date));
    }
  }, [date, leaveType]);

  // Recalculate leave hour when inputs change
  useEffect(() => {
    if (!staffProfile) return;
    const shiftStart = staffProfile.default_sign_in || "13:00";
    const shiftEnd = staffProfile.default_sign_out || "22:30";
    const workingHours = staffProfile.working_hours ?? 9.5;
    const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
    const calc = calculateLeaveOrOvertime(
      leaveType,
      signInTime,
      signOutTime,
      shiftStart,
      shiftEnd,
      workingHours,
      isHoliday,
    );
    const finalCalc = (leaveType === 'Short Leave' && isFriday(date))
      ? adjustShortLeaveForJummah(calc, adjustJummah)
      : calc;
    setLeaveHour(finalCalc);
  }, [signInTime, signOutTime, leaveType, date, staffProfile, globalSettings, adjustJummah]);

  // Real-time balance calculations
  const selectedYear = date
    ? date.substring(0, 4)
    : new Date().getFullYear().toString();
  const approvedRecords = records.filter(
    (r) =>
      r.status === "approved" &&
      r.date &&
      r.date.substring(0, 4) === selectedYear,
  );
  const stats = calculateStats(
    approvedRecords,
    staffProfile?.working_hours || 9.5,
  );

  const parseHHMMToMinutes = (str: string) => {
    if (!str) return 0;
    const parts = str.replace("-", "").split(":").map(Number);
    if (parts.length >= 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  const isOfficeLeaveEligible = staffProfile?.eligible_office_leave !== false;
  const officeLeaveTotalBase = isOfficeLeaveEligible
    ? globalSettings.office_leave_h1 + globalSettings.office_leave_h2
    : 0;

  const reservedCount = userResponses.filter(
    (r: GovtHolidayResponse) => r.response === "reserve",
  ).length;
  const govtHolidayTotal = reservedCount;
  const govtHolidayRemaining = Math.max(
    0,
    reservedCount - (stats.govtHolidaysTaken ?? 0),
  );

  const convertedDays = staffProfile?.converted_short_leaves_days ?? 0;

  const totalAllowed = officeLeaveTotalBase;
  const totalTaken =
    (stats.officeLeavesTaken ?? 0) + (stats.fullLeaves ?? 0) + convertedDays;

  const officeLeaveTotal = totalAllowed;
  const officeLeaveRemaining = totalAllowed - totalTaken; // Can go negative

  const eidFitrTotal = globalSettings.eid_fitr_leave ?? 0;
  const eidFitrRemaining = Math.max(
    0,
    eidFitrTotal - (stats.eidFitrTaken ?? 0),
  );

  const eidAdhaTotal = globalSettings.eid_adha_leave ?? 0;
  const eidAdhaRemaining = Math.max(
    0,
    eidAdhaTotal - (stats.eidAdhaTaken ?? 0),
  );

  const isHoliday = checkIfHolidayOrWeekend(date, globalSettings);
  const validationError = getLeaveValidationError(
    leaveType,
    signInTime,
    signOutTime,
    staffProfile?.working_hours || 9.5,
    isHoliday,
  );

  // Real-time deduction preview logic based on modal state
  let officeDeduction = 0;
  let govtDeduction = 0;
  let eidFitrDeduction = 0;
  let eidAdhaDeduction = 0;

  if (leaveType === "Full Leave") {
    const totalDays = 1 + bulkDates.length;
    const adjustedDays =
      (adjustment ? 1 : 0) +
      bulkAdjustments.slice(0, bulkDates.length).filter(Boolean).length;
    const unadjustedDays = totalDays - adjustedDays;

    officeDeduction = unadjustedDays;

    if (adjustmentCategory === "Govt Holiday") {
      govtDeduction = adjustedDays;
    } else if (adjustmentCategory === "Eid-ul-Fitr") {
      eidFitrDeduction = adjustedDays;
    } else if (adjustmentCategory === "Eid-ul-Adha") {
      eidAdhaDeduction = adjustedDays;
    }
  } else if (leaveType === "Short Leave") {
    const mins = parseHHMMToMinutes(leaveHour);
    const dayEquivalent = mins / ((staffProfile?.working_hours || 9.5) * 60);
    if (!adjustment || adjustmentCategory === "Office Leave") {
      officeDeduction = dayEquivalent;
    } else if (adjustment) {
      if (adjustmentCategory === "Govt Holiday") {
        govtDeduction = dayEquivalent;
      } else if (adjustmentCategory === "Eid-ul-Fitr") {
        eidFitrDeduction = dayEquivalent;
      } else if (adjustmentCategory === "Eid-ul-Adha") {
        eidAdhaDeduction = dayEquivalent;
      }
    }
  }

  const isDuplicateDate = React.useMemo(() => {
    if (!date) return false;
    const hasMainDuplicate = records.some((r) => r.date === date);
    if (hasMainDuplicate) return true;

    if (leaveType === "Full Leave" && bulkDates.length > 0) {
      return bulkDates.some((bd) => bd && records.some((r) => r.date === bd));
    }
    return false;
  }, [date, leaveType, bulkDates, records]);

  const isFullLeaveQuotaExceeded = false;

  const halfYearlyStats = React.useMemo(() => {
    return calculateHalfYearlyOfficeLeave(
      records,
      globalSettings.office_leave_h1,
      globalSettings.office_leave_h2,
      selectedYear,
      leaveSettlements,
      staffProfile?.id,
      undefined,
      staffProfile?.working_hours || 9.5,
    );
  }, [
    records,
    globalSettings.office_leave_h1,
    globalSettings.office_leave_h2,
    selectedYear,
    staffProfile,
    leaveSettlements,
  ]);

  const isFullLeave = leaveType === "Full Leave";

  const handleAddBulkDate = () => {
    if (bulkDates.length + 1 >= 10) {
      toast.error("You can enter up to 10 days of leaves at once!");
      return;
    }
    setBulkDates((prev) => [...prev, ""]);
    setBulkAdjustments((prev) => [...prev, false]);
  };

  const handleUpdateBulkDate = (index: number, val: string) => {
    if (
      val === date ||
      bulkDates.some((d, idx) => idx !== index && d === val)
    ) {
      toast.error("This date has already been selected!");
      return;
    }
    setBulkDates((prev) => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  const handleUpdateBulkAdjustment = (index: number, val: boolean) => {
    setBulkAdjustments((prev) =>
      prev.map((adj, idx) => (idx === index ? val : adj)),
    );
  };

  const handleRemoveBulkDate = (index: number) => {
    setBulkDates((prev) => prev.filter((_, idx) => idx !== index));
    setBulkAdjustments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffProfile) return;
    setSubmitting(true);

    const datesWithAdjustment = isFullLeave
      ? [
          { date, adjustment: adjustmentCategory !== "None" },
          ...bulkDates.map((d, idx) => ({
            date: d,
            adjustment: bulkAdjustments[idx] || false,
          })),
        ].filter((item) => item.date)
      : [{ date, adjustment: false }];

    const allDates = datesWithAdjustment.map((item) => item.date);

    if (allDates.length === 0) {
      toast.error("Please select at least one date!");
      setSubmitting(false);
      return;
    }

    const hasDuplicateDate = allDates.some((d) =>
      records.some((r) => r.date === d),
    );
    if (hasDuplicateDate) {
      toast.error(
        "duplicated leave detected, please confirm the leave date again.",
      );
      setSubmitting(false);
      return;
    }

    if (!isFullLeave && leaveHour === "00:00") {
      toast.error(
        `${leaveType} requests cannot be submitted with 00:00 hours. Please adjust Sign-in and Sign-out times.`,
      );
      setSubmitting(false);
      return;
    }

    try {
      // Direct Admin bulk insertion (bypasses regular user submission logic)
      const adjustedArr = datesWithAdjustment.map((item) => item.adjustment);

      let finalComment = comment.trim();
      if (leaveType === 'Short Leave' && isFriday(date) && adjustJummah) {
        const jummahMsg = '20 Min Adjusted with Jummah Prayer';
        if (!finalComment) {
          finalComment = jummahMsg;
        } else if (!finalComment.includes(jummahMsg)) {
          finalComment = `${finalComment} | ${jummahMsg}`;
        }
      }

      const { error: bulkInsertError } = await supabase.rpc(
        "admin_insert_chuti_records_bulk",
        {
          p_user_id: staffProfile.id,
          p_dates: allDates,
          p_leave_type: leaveType,
          p_adjustments: adjustedArr,
          p_adjust_short_leave: adjustShortLeave,
          p_sign_in_time: leaveType === "Full Leave" ? null : signInTime,
          p_sign_out_time: leaveType === "Full Leave" ? null : signOutTime,
          p_leave_hour: leaveType === "Full Leave" ? null : leaveHour,
          p_comment: finalComment || null,
          p_reserve_holiday:
            leaveType === "Short Leave"
              ? adjustment
                ? adjustmentCategory
                : null
              : adjustmentCategory !== "None"
                ? adjustmentCategory
                : null,
          p_bulk_id: generateUUID(),
        },
      );

      if (bulkInsertError) throw bulkInsertError;



      toast.success("Leave successfully added for the user!");
      onSuccess();
      setShowModal(false);
    } catch (err) {
      toast.error(
        (err as Error).message ||
          "An error occurred while submitting the leave.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={showModal && staffProfile !== null}
      onClose={() => setShowModal(false)}
      title={`Add Leave (${staffProfile ? staffProfile.full_name || staffProfile.username : ""})`}
      icon={<Calendar className="h-5 w-5 text-blue-500" />}
      maxWidthClass="max-w-4xl"
    >
      {staffProfile && (
        <>
          {/* Warning Banner */}
          {isFullLeaveQuotaExceeded && (
            <div className="p-3 bg-purple-955/50 border border-purple-900/50 text-purple-300 text-xs rounded-lg mb-4 flex items-start gap-2 animate-pulse">
              <AlertTriangle className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-theme-text-primary">
                  Leave Quota Limit Exceeded!
                </span>
                <span className="text-[11px] block mt-0.5 text-theme-text-secondary">
                  Staff's annual full leave limit is{" "}
                  {staffProfile?.max_full_leaves ?? 15} days, but they have
                  already taken {stats.fullLeaves} days.
                </span>
              </div>
            </div>
          )}

          {loadingResponses ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader className="h-8 w-8 animate-spin text-blue-500" />
              <p className="mt-2 text-xs text-theme-text-muted font-medium font-sans">
                Loading leave data and holidays...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              <form
                onSubmit={handleSubmit}
                className="md:col-span-2 space-y-4 font-sans text-xs"
              >
                <AddLeaveFormFields
                  date={date}
                  setDate={setDate}
                  leaveType={leaveType}
                  setLeaveType={setLeaveType}
                  adjustmentCategory={adjustmentCategory}
                  setAdjustmentCategory={setAdjustmentCategory}
                  setAdjustment={setAdjustment}
                  adjustShortLeave={adjustShortLeave}
                  setAdjustShortLeave={setAdjustShortLeave}
                  signInTime={signInTime}
                  setSignInTime={setSignInTime}
                  signOutTime={signOutTime}
                  setSignOutTime={setSignOutTime}
                  leaveHour={leaveHour}
                  setLeaveHour={setLeaveHour}
                  comment={comment}
                  setComment={setComment}
                  bulkDates={bulkDates}
                  bulkAdjustments={bulkAdjustments}
                  handleAddBulkDate={handleAddBulkDate}
                  handleUpdateBulkDate={handleUpdateBulkDate}
                  handleUpdateBulkAdjustment={handleUpdateBulkAdjustment}
                  handleRemoveBulkDate={handleRemoveBulkDate}
                  allowOvertime={staffProfile.allow_overtime || false}
                  adjustJummah={adjustJummah}
                  setAdjustJummah={setAdjustJummah}
                  adjustment={adjustment}
                  availableOvertimeMins={parseHHMMToMinutes(
                    stats.overtimeHours,
                  )}
                  availableShortLeaveMins={parseHHMMToMinutes(stats.shortHours)}
                  records={records}
                  govtHolidayRemaining={govtHolidayRemaining}
                  eidFitrRemaining={eidFitrRemaining}
                  eidAdhaRemaining={eidAdhaRemaining}
                  eligibleOfficeLeave={isOfficeLeaveEligible}
                  officeLeaveRemaining={officeLeaveRemaining}
                  workingHours={staffProfile?.working_hours || 9.5}
                  isAdmin={true}
                  globalSettings={globalSettings}
                />

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-theme-border-input">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submitting || !!validationError || isDuplicateDate
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-semibold text-white bg-linear-to-r from-blue-600 to-purple-500 hover:from-blue-500 hover:to-purple-400 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-theme-card-container cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting && (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {submitting ? "Adding..." : "Add Leave"}
                  </button>
                </div>
              </form>

              {/* Right Column: Balance & Limit display */}
              <LeaveUsageSummary
                selectedYear={selectedYear}
                officeLeaveRemaining={officeLeaveRemaining}
                officeLeaveTotal={officeLeaveTotal}
                govtHolidayRemaining={govtHolidayRemaining}
                govtHolidayTotal={govtHolidayTotal}
                eidFitrRemaining={eidFitrRemaining}
                eidFitrTotal={eidFitrTotal}
                eidAdhaRemaining={eidAdhaRemaining}
                eidAdhaTotal={eidAdhaTotal}
                fullLeaves={stats.fullLeaves}
                shortHours={stats.shortHours}
                overtimeHours={stats.overtimeHours}
                allowOvertime={staffProfile?.allow_overtime}
                eligibleOfficeLeave={
                  staffProfile?.eligible_office_leave !== false
                }
                eligibleGovtHoliday={
                  staffProfile?.eligible_govt_holiday !== false
                }
                halfYearlyStats={halfYearlyStats}
                officeDeduction={officeDeduction}
                govtDeduction={govtDeduction}
                eidFitrDeduction={eidFitrDeduction}
                eidAdhaDeduction={eidAdhaDeduction}
                workingHours={staffProfile?.working_hours || 9.5}
              />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
