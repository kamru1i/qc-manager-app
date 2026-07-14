"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Bell,
  User,
} from "lucide-react";
import { Profile, ChutiRecordWithProfile, BulkRepresentative } from "@/types";
import { formatDate, formatTimeToAMPM } from "@/utils/dashboardHelpers";
import { CustomSelect } from "@/components/common/CustomSelect";

interface LeaveApprovalPanelProps {
  role: "admin" | "supervisor";
  profilesList: Profile[];
  reviewingIds: Set<string>;
  approvedIds: Set<string>;
  approvingIds: Set<string>;

  // Leave Request Handlers (used for both admin and supervisor)
  groupedChutiRequests: BulkRepresentative[];
  handleApproveChutiRequest: (id: string, approve: boolean) => void;

  // Admin-only Props & Handlers
  pendingReserveRequests?: ChutiRecordWithProfile[];
  handleApproveReserveAdjustment?: (
    record: ChutiRecordWithProfile,
    approve: boolean,
  ) => void;
  pendingProfileRequests?: Profile[];
  handleApproveProfileChangeRequest?: (id: string, approve: boolean) => void;
  pendingPasswordResetRequests?: Profile[];
  handleApprovePasswordResetRequest?: (id: string, approve: boolean) => void;
  adminHolidayNotifications?: any[];
}

export function LeaveApprovalPanel({
  role,
  profilesList,
  reviewingIds,
  approvedIds,
  approvingIds,
  groupedChutiRequests,
  handleApproveChutiRequest,
  pendingReserveRequests = [],
  handleApproveReserveAdjustment = () => {},
  pendingProfileRequests = [],
  handleApproveProfileChangeRequest = () => {},
  pendingPasswordResetRequests = [],
  handleApprovePasswordResetRequest = () => {},
  adminHolidayNotifications = [],
}: LeaveApprovalPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationTypeFilter, setNotificationTypeFilter] = useState("all");

  const notificationTypeOptions = useMemo(() => {
    if (role === "supervisor") {
      return [
        { value: "all", label: "All Categories" },
        { value: "Short Leave", label: "Short Leave" },
        { value: "Full Leave", label: "Full Leave" },
        { value: "Overtime", label: "Overtime" },
      ];
    }
    return [
      { value: "all", label: "All Types" },
      { value: "leave_request", label: "Leave Requests (All)" },
      { value: "short_leave", label: "Short Leave Requests" },
      { value: "full_leave", label: "Full Leave Requests" },
      { value: "overtime", label: "Overtime Requests" },
      { value: "holiday_response", label: "Govt Holiday Responses" },
      { value: "reserve_adjustment", label: "Reserve & Adjustments" },
      { value: "profile_change", label: "Profile Changes" },
      { value: "password_reset", label: "Password Resets" },
    ];
  }, [role]);

  // Reset filters when component is hidden/shown or reset
  useEffect(() => {
    setSearchQuery("");
    setNotificationTypeFilter("all");
  }, [role]);

  const filteredChutiRequests = useMemo(() => {
    return groupedChutiRequests.filter((r) => {
      const user = profilesList.find((p) => p.id === r.user_id);
      const name = (user?.full_name || "").toLowerCase();
      const username = (user?.username || "").toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !query || name.includes(query) || username.includes(query);

      let matchesType = true;
      if (role === "supervisor") {
        matchesType =
          notificationTypeFilter === "all" ||
          r.leave_type === notificationTypeFilter;
      } else {
        if (notificationTypeFilter === "short_leave") {
          matchesType = r.leave_type === "Short Leave";
        } else if (notificationTypeFilter === "full_leave") {
          matchesType = r.leave_type === "Full Leave";
        } else if (notificationTypeFilter === "overtime") {
          matchesType = r.leave_type === "Overtime";
        }
      }

      return matchesSearch && matchesType;
    });
  }, [
    groupedChutiRequests,
    profilesList,
    searchQuery,
    notificationTypeFilter,
    role,
  ]);

  const filteredReserveRequests = useMemo(() => {
    if (role === "supervisor") return [];
    return pendingReserveRequests.filter((r) => {
      const user = profilesList.find((p) => p.id === r.user_id);
      const name = (user?.full_name || "").toLowerCase();
      const username = (user?.username || "").toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !query || name.includes(query) || username.includes(query);

      let matchesType = true;
      if (notificationTypeFilter === "short_leave") {
        matchesType = r.leave_type === "Short Leave";
      } else if (notificationTypeFilter === "full_leave") {
        matchesType = r.leave_type === "Full Leave";
      } else if (notificationTypeFilter === "overtime") {
        matchesType = r.leave_type === "Overtime";
      }

      return matchesSearch && matchesType;
    });
  }, [
    pendingReserveRequests,
    profilesList,
    searchQuery,
    notificationTypeFilter,
    role,
  ]);

  const filteredProfileRequests = useMemo(() => {
    if (role === "supervisor") return [];
    return pendingProfileRequests.filter((p: Profile) => {
      const name = (p.full_name || "").toLowerCase();
      const username = (p.username || "").toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      return !query || name.includes(query) || username.includes(query);
    });
  }, [pendingProfileRequests, searchQuery, role]);

  const filteredPasswordResetRequests = useMemo(() => {
    if (role === "supervisor") return [];
    return pendingPasswordResetRequests.filter((p: Profile) => {
      const name = (p.full_name || "").toLowerCase();
      const username = (p.username || "").toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      return !query || name.includes(query) || username.includes(query);
    });
  }, [pendingPasswordResetRequests, searchQuery, role]);

  const filteredHolidayNotifications = useMemo(() => {
    if (role === "supervisor") return [];
    const notifications = adminHolidayNotifications || [];
    const query = searchQuery.toLowerCase().trim();
    if (!query) return notifications;
    return notifications.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.body.toLowerCase().includes(query),
    );
  }, [adminHolidayNotifications, searchQuery, role]);

  // Combine and sort all notifications
  const combinedNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      type:
        | "leave_request"
        | "holiday_response"
        | "reserve_adjustment"
        | "profile_change"
        | "password_reset";
      timestamp: string;
      data: any;
    }> = [];

    // 1. Leave Requests
    if (
      role === "supervisor" ||
      notificationTypeFilter === "all" ||
      notificationTypeFilter === "leave_request" ||
      notificationTypeFilter === "short_leave" ||
      notificationTypeFilter === "full_leave" ||
      notificationTypeFilter === "overtime"
    ) {
      filteredChutiRequests.forEach((r) => {
        list.push({
          id: `leave_${r.id}`,
          type: "leave_request",
          timestamp: r.created_at || r.date || "",
          data: r,
        });
      });
    }

    if (role === "admin") {
      // 2. Govt Holiday Responses
      if (
        notificationTypeFilter === "all" ||
        notificationTypeFilter === "holiday_response"
      ) {
        filteredHolidayNotifications.forEach((n) => {
          list.push({
            id: `holiday_${n.id}`,
            type: "holiday_response",
            timestamp: n.timestamp || "",
            data: n,
          });
        });
      }

      // 3. Reserve, Overtime & Adjustment Requests
      if (
        notificationTypeFilter === "all" ||
        notificationTypeFilter === "reserve_adjustment" ||
        notificationTypeFilter === "short_leave" ||
        notificationTypeFilter === "full_leave" ||
        notificationTypeFilter === "overtime"
      ) {
        filteredReserveRequests.forEach((r) => {
          list.push({
            id: `reserve_${r.id}`,
            type: "reserve_adjustment",
            timestamp: r.created_at || r.date || "",
            data: r,
          });
        });
      }

      // 4. Profile Change Requests
      if (
        notificationTypeFilter === "all" ||
        notificationTypeFilter === "profile_change"
      ) {
        filteredProfileRequests.forEach((p) => {
          list.push({
            id: `profile_${p.id}`,
            type: "profile_change",
            timestamp: (p as any).created_at || "",
            data: p,
          });
        });
      }

      // 5. Password Reset Requests
      if (
        notificationTypeFilter === "all" ||
        notificationTypeFilter === "password_reset"
      ) {
        filteredPasswordResetRequests.forEach((p) => {
          list.push({
            id: `pwreset_${p.id}`,
            type: "password_reset",
            timestamp: (p as any).created_at || "",
            data: p,
          });
        });
      }
    }

    // Sort descending (newest first)
    return list.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });
  }, [
    filteredChutiRequests,
    filteredHolidayNotifications,
    filteredReserveRequests,
    filteredProfileRequests,
    filteredPasswordResetRequests,
    notificationTypeFilter,
    role,
  ]);

  const renderNotificationItem = (item: (typeof combinedNotifications)[0]) => {
    switch (item.type) {
      case "leave_request": {
        const r = item.data;
        const user = profilesList.find((p) => p.id === r.user_id);
        const tagLabel =
          role === "supervisor" ? "Verification Request" : "Leave Request";
        return (
          <div
            key={item.id}
            className="bg-theme-page-bg/60 border border-theme-border-muted rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
            <div className="space-y-1 text-xs text-theme-text-secondary pl-2 font-sans">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-bold text-theme-text-primary text-sm">
                  {user?.full_name || "No Name"}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 bg-theme-card-bg border border-theme-border-input rounded text-theme-text-muted font-mono">
                  @{(user?.username || "").toUpperCase()}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-900/60 text-blue-400 font-bold tracking-wide uppercase">
                  {tagLabel}
                </span>
                {item.timestamp && (
                  <span className="text-[9px] text-theme-text-muted font-mono">
                    {new Date(item.timestamp).toLocaleString("en-US", {
                      hour12: true,
                    })}
                  </span>
                )}
              </div>
              <p>
                <span className="text-theme-text-muted font-medium">Date:</span>{" "}
                <span className="font-semibold text-theme-text-primary">
                  {r.is_bulk ? r.formatted_bulk_dates : formatDate(r.date)}
                </span>
              </p>
              <p>
                <span className="text-theme-text-muted font-medium">
                  Leave Type:
                </span>{" "}
                <span className="font-bold text-blue-400">{r.leave_type}</span>
              </p>
              {r.leave_type !== "Full Leave" && (
                <p>
                  <span className="text-theme-text-muted font-medium">
                    Time & Hours:
                  </span>{" "}
                  <span className="font-mono text-theme-text-secondary">
                    {formatTimeToAMPM(r.sign_in_time)} -{" "}
                    {formatTimeToAMPM(r.sign_out_time)} (
                    {r.leave_hour ? r.leave_hour.substring(0, 5) : "-"} hrs)
                  </span>
                </p>
              )}
              <p>
                <span className="text-theme-text-muted font-medium">
                  Adjustment:
                </span>{" "}
                <span
                  className={`font-semibold ${r.adjustment ? "text-blue-400 font-bold" : r.adjusted_hour ? "text-cyan-400 font-bold" : "text-theme-text-muted"}`}
                >
                  {r.adjustment
                    ? "Yes"
                    : r.adjusted_hour
                      ? `Partial (${r.adjusted_hour.toString().split(".")[0].substring(0, 5)} hrs)`
                      : "No"}
                </span>
              </p>
              {r.leave_type === "Overtime" && (
                <p>
                  <span className="text-theme-text-muted font-medium">
                    Short Leave Adj:
                  </span>{" "}
                  <span
                    className={`font-semibold ${r.adjust_short_leave ? "text-blue-400 font-bold" : "text-theme-text-muted"}`}
                  >
                    {r.adjust_short_leave ? "Yes" : "No"}
                  </span>
                </p>
              )}
              <p>
                <span className="text-theme-text-muted font-medium">
                  Reason/Comment:
                </span>{" "}
                <span className="italic text-theme-text-secondary font-medium">
                  {r.comment || "-"}
                </span>
              </p>
            </div>

            <div className="flex md:flex-col justify-end items-end gap-2 shrink-0 font-sans pl-2">
              <button
                onClick={() => handleApproveChutiRequest(r.id, false)}
                disabled={reviewingIds.has(r.id) || approvedIds.has(r.id)}
                className="px-3 py-1.5 border border-purple-500/30 hover:border-purple-500 bg-purple-955/20 hover:bg-purple-955/50 text-purple-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {reviewingIds.has(r.id) && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                )}
                {reviewingIds.has(r.id)
                  ? "Sending revision..."
                  : "Needs Review"}
              </button>
              <button
                onClick={() => handleApproveChutiRequest(r.id, true)}
                disabled={approvingIds.has(r.id) || approvedIds.has(r.id)}
                className="px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500 bg-emerald-900/20 hover:bg-emerald-900/50 text-emerald-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-80 flex items-center gap-1.5"
              >
                {approvingIds.has(r.id) && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                )}
                {approvedIds.has(r.id) && (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {approvedIds.has(r.id)
                  ? role === "supervisor"
                    ? "Verified"
                    : "Approved"
                  : approvingIds.has(r.id)
                    ? role === "supervisor"
                      ? "Verifying..."
                      : "Approving..."
                    : role === "supervisor"
                      ? "Verify"
                      : "Approve"}
              </button>
            </div>
          </div>
        );
      }
      case "holiday_response": {
        const n = item.data;
        return (
          <div
            key={item.id}
            className="bg-theme-page-bg/60 border border-theme-border-muted rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500" />
            <div className="space-y-1 text-xs text-theme-text-secondary font-medium pl-2 font-sans">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-bold text-theme-text-primary text-[13px]">
                  {n.title}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-950/60 border border-teal-900/60 text-teal-400 font-bold tracking-wide uppercase">
                  Holiday Response
                </span>
                {n.timestamp && (
                  <span className="text-[9px] text-theme-text-muted font-mono">
                    {new Date(n.timestamp).toLocaleString("en-US", {
                      hour12: true,
                    })}
                  </span>
                )}
              </div>
              <p className="text-theme-text-secondary font-normal leading-relaxed">
                {n.body}
              </p>
            </div>
          </div>
        );
      }
      case "reserve_adjustment": {
        const r = item.data;
        const user = profilesList.find((p) => p.id === r.user_id);
        const isAdjustmentRequest = r.reserve_adjustment_status === "pending";
        return (
          <div
            key={item.id}
            className="bg-theme-page-bg/60 border border-theme-border-muted rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
            <div className="space-y-1 text-xs text-theme-text-secondary font-medium pl-2 font-sans">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-bold text-theme-text-primary text-sm">
                  {user?.full_name || "No Name"}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 bg-theme-card-bg border border-theme-border-input rounded text-theme-text-muted font-mono font-bold">
                  @{(user?.username || "").toUpperCase()}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-900/60 text-emerald-400 font-bold tracking-wide uppercase">
                  Reserve & Adjustment
                </span>
                {item.timestamp && (
                  <span className="text-[9px] text-theme-text-muted font-mono">
                    {new Date(item.timestamp).toLocaleString("en-US", {
                      hour12: true,
                    })}
                  </span>
                )}
              </div>
              <p>
                <span className="text-theme-text-muted font-medium">Date:</span>{" "}
                <span className="font-semibold text-theme-text-primary">
                  {formatDate(r.date)}
                </span>
              </p>
              <p>
                <span className="text-theme-text-muted font-medium">
                  Leave Type:
                </span>{" "}
                <span className="font-bold text-emerald-500">
                  {r.leave_type}
                </span>
              </p>
              {(r.leave_type === "Overtime" ||
                r.leave_type === "Short Leave") && (
                <p>
                  <span className="text-theme-text-muted font-medium">
                    Time & Hours:
                  </span>{" "}
                  <span className="font-mono text-theme-text-secondary">
                    {formatTimeToAMPM(r.sign_in_time)} -{" "}
                    {formatTimeToAMPM(r.sign_out_time)} (
                    {r.leave_hour ? r.leave_hour.substring(0, 5) : "-"} hrs)
                  </span>
                </p>
              )}
              <p>
                <span className="text-theme-text-muted font-medium">
                  Adjustment:
                </span>{" "}
                <span
                  className={`font-semibold ${r.adjustment || isAdjustmentRequest ? "text-blue-400 font-bold" : "text-theme-text-muted"}`}
                >
                  {r.adjustment || isAdjustmentRequest ? "Yes" : "No"}
                </span>
              </p>
              {r.leave_type === "Overtime" && (
                <p>
                  <span className="text-theme-text-muted font-medium">
                    Short Leave Adj:
                  </span>{" "}
                  <span
                    className={`font-semibold ${r.adjust_short_leave ? "text-blue-400 font-bold" : "text-theme-text-muted"}`}
                  >
                    {r.adjust_short_leave ? "Yes" : "No"}
                  </span>
                </p>
              )}
              {isAdjustmentRequest && r.admin_edit_request && (
                <div className="mt-1.5 p-2 bg-blue-955/40 border border-blue-900/40 rounded-lg text-blue-300 text-xs flex flex-col gap-0.5 font-sans">
                  <div>
                    <span className="font-bold text-theme-text-primary">
                      Requested Adjustment:
                    </span>{" "}
                    {r.admin_edit_request.adjusted_hour ? (
                      <span className="font-semibold text-cyan-400">
                        Partial Adjustment (
                        {r.admin_edit_request.adjusted_hour.substring(0, 5)}{" "}
                        hrs)
                      </span>
                    ) : r.admin_edit_request.adjustment === false ? (
                      <span className="font-semibold text-rose-400 font-bold">
                        Cancel Adjustment
                      </span>
                    ) : (
                      <span className="font-semibold text-blue-400">
                        Full Adjustment
                      </span>
                    )}
                    {r.admin_edit_request.adjust_short_leave && (
                      <span className="text-emerald-400">
                        {" "}
                        (From Short Leave)
                      </span>
                    )}
                  </div>
                </div>
              )}
              <p>
                <span className="text-theme-text-muted font-medium">
                  Reason/Comment:
                </span>{" "}
                <span className="italic text-theme-text-secondary font-medium">
                  {r.comment || "-"}
                </span>
              </p>
            </div>

            <div className="flex md:flex-col justify-end items-end gap-2 shrink-0 font-sans pl-2">
              {isAdjustmentRequest ? (
                <>
                  <button
                    onClick={() => handleApproveReserveAdjustment(r, false)}
                    disabled={approvingIds.has(r.id) || approvedIds.has(r.id)}
                    className="px-3 py-1.5 border border-red-500/30 hover:border-red-500 bg-red-955/20 hover:bg-red-955/50 text-red-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveReserveAdjustment(r, true)}
                    disabled={approvingIds.has(r.id) || approvedIds.has(r.id)}
                    className="px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500 bg-emerald-900/20 hover:bg-emerald-900/50 text-emerald-450 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-80 flex items-center gap-1.5"
                  >
                    {approvingIds.has(r.id) && (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {approvedIds.has(r.id) && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    {approvedIds.has(r.id)
                      ? "Approved"
                      : approvingIds.has(r.id)
                        ? "Approving..."
                        : "Approve"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleApproveChutiRequest(r.id, false)}
                    disabled={reviewingIds.has(r.id) || approvedIds.has(r.id)}
                    className="px-3 py-1.5 border border-purple-500/30 hover:border-purple-500 bg-purple-955/20 hover:bg-purple-955/50 text-purple-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {reviewingIds.has(r.id) && (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {reviewingIds.has(r.id)
                      ? "Sending revision..."
                      : "Needs Review"}
                  </button>
                  <button
                    onClick={() => handleApproveChutiRequest(r.id, true)}
                    disabled={approvingIds.has(r.id) || approvedIds.has(r.id)}
                    className="px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500 bg-emerald-900/20 hover:bg-emerald-900/50 text-emerald-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-80 flex items-center gap-1.5"
                  >
                    {approvingIds.has(r.id) && (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {approvedIds.has(r.id) && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    {approvedIds.has(r.id)
                      ? "Approved"
                      : approvingIds.has(r.id)
                        ? "Approving..."
                        : "Approve"}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      }
      case "profile_change": {
        const p = item.data;
        return (
          <div
            key={item.id}
            className="bg-theme-page-bg/60 border border-theme-border-muted rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-500" />
            <div className="flex justify-between items-start pl-2 font-sans">
              <div>
                <h4 className="text-xs font-bold text-theme-text-primary flex flex-wrap items-center gap-2">
                  <span>{p.full_name || "No Name"}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-theme-card-bg border border-theme-border-input rounded text-theme-text-muted font-mono">
                    @{(p.username || "").toUpperCase()}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-900/60 text-cyan-400 font-bold tracking-wide uppercase">
                    Profile Edit
                  </span>
                  {item.timestamp && (
                    <span className="text-[9px] text-theme-text-muted font-mono">
                      {new Date(item.timestamp).toLocaleString("en-US", {
                        hour12: true,
                      })}
                    </span>
                  )}
                </h4>
                <p className="text-[10px] text-theme-text-muted mt-0.5 font-medium font-sans">
                  Role: {p.job_role || "-"}
                </p>
              </div>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-955 border border-purple-800 text-purple-400">
                Pending
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] pl-2 font-sans">
              <div className="bg-theme-card-bg/40 p-2.5 rounded-lg border border-theme-border-muted">
                <span className="block font-bold text-theme-text-muted mb-1.5 border-b border-theme-border-input pb-1 font-semibold">
                  Current Information
                </span>
                <div className="space-y-1 text-theme-text-secondary font-medium">
                  <p>
                    <span className="text-theme-text-muted font-sans">
                      Name:
                    </span>{" "}
                    {p.full_name || "-"}
                  </p>
                  <p>
                    <span className="text-theme-text-muted font-sans">
                      Job Role:
                    </span>{" "}
                    {p.job_role || "-"}
                  </p>
                  <p>
                    <span className="text-theme-text-muted font-sans">
                      Working Hours:
                    </span>{" "}
                    {p.working_hours} hrs
                  </p>
                  <p>
                    <span className="text-theme-text-muted font-sans">
                      Break Time:
                    </span>{" "}
                    {p.break_time} mins
                  </p>
                  <p>
                    <span className="text-theme-text-muted font-sans">
                      Sign-In:
                    </span>{" "}
                    {formatTimeToAMPM(p.default_sign_in || null) || "-"}
                  </p>
                  <p>
                    <span className="text-theme-text-muted font-sans">
                      Sign-Out:
                    </span>{" "}
                    {formatTimeToAMPM(p.default_sign_out || null) || "-"}
                  </p>
                </div>
              </div>

              <div className="bg-blue-955/20 p-2.5 rounded-lg border border-blue-900/30">
                <span className="block font-bold text-blue-400 mb-1.5 border-b border-blue-900/30 pb-1 font-semibold">
                  Requested New Information
                </span>
                <div className="space-y-1 text-theme-text-primary font-medium">
                  <p
                    className={
                      p.requested_full_name &&
                      p.requested_full_name !== p.full_name
                        ? "text-blue-300 font-bold"
                        : ""
                    }
                  >
                    <span className="text-theme-text-muted font-sans">
                      Name:
                    </span>{" "}
                    {p.requested_full_name || p.full_name || "-"}
                  </p>
                  <p
                    className={
                      p.requested_job_role &&
                      p.requested_job_role !== p.job_role
                        ? "text-blue-300 font-bold"
                        : ""
                    }
                  >
                    <span className="text-theme-text-muted font-sans">
                      Job Role:
                    </span>{" "}
                    {p.requested_job_role || p.job_role || "-"}
                  </p>
                  <p
                    className={
                      p.requested_working_hours &&
                      p.requested_working_hours !== p.working_hours
                        ? "text-blue-300 font-bold"
                        : ""
                    }
                  >
                    <span className="text-theme-text-muted font-sans">
                      Working Hours:
                    </span>{" "}
                    {p.requested_working_hours || p.working_hours} hrs
                  </p>
                  <p
                    className={
                      p.requested_break_time &&
                      p.requested_break_time !== p.break_time
                        ? "text-blue-300 font-bold"
                        : ""
                    }
                  >
                    <span className="text-theme-text-muted font-sans">
                      Break Time:
                    </span>{" "}
                    {p.requested_break_time || p.break_time} mins
                  </p>
                  <p
                    className={
                      p.requested_default_sign_in &&
                      p.requested_default_sign_in !== p.default_sign_in
                        ? "text-blue-300 font-bold"
                        : ""
                    }
                  >
                    <span className="text-theme-text-muted font-sans">
                      Sign-In:
                    </span>{" "}
                    {formatTimeToAMPM(
                      p.requested_default_sign_in || p.default_sign_in || null,
                    ) || "-"}
                  </p>
                  <p
                    className={
                      p.requested_default_sign_out &&
                      p.requested_default_sign_out !== p.default_sign_out
                        ? "text-blue-300 font-bold"
                        : ""
                    }
                  >
                    <span className="text-theme-text-muted font-sans">
                      Sign-Out:
                    </span>{" "}
                    {formatTimeToAMPM(
                      p.requested_default_sign_out ||
                        p.default_sign_out ||
                        null,
                    ) || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 font-sans pl-2">
              <button
                onClick={() => handleApproveProfileChangeRequest(p.id, false)}
                disabled={approvingIds.has(p.id) || approvedIds.has(p.id)}
                className="px-3 py-1.5 border border-red-500/30 hover:border-red-500 bg-red-955/20 hover:bg-red-955/50 text-red-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
              <button
                onClick={() => handleApproveProfileChangeRequest(p.id, true)}
                disabled={approvingIds.has(p.id) || approvedIds.has(p.id)}
                className="px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500 bg-emerald-900/20 hover:bg-emerald-900/50 text-emerald-450 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-80 flex items-center gap-1.5"
              >
                {approvingIds.has(p.id) && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                )}
                {approvedIds.has(p.id) && (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {approvedIds.has(p.id)
                  ? "Approved"
                  : approvingIds.has(p.id)
                    ? "Approving..."
                    : "Approve"}
              </button>
            </div>
          </div>
        );
      }
      case "password_reset": {
        const p = item.data;
        return (
          <div
            key={item.id}
            className="bg-theme-page-bg/60 border border-theme-border-muted rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
            <div className="space-y-1 pl-2 font-sans">
              <div className="flex items-center gap-2">
                <span className="font-bold text-theme-text-primary text-sm">
                  {p.full_name || "No Name"}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 bg-theme-card-bg border border-theme-border-input rounded text-theme-text-muted font-mono">
                  @{(p.username || "").toUpperCase()}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-955/60 border border-red-900/60 text-red-400 font-bold tracking-wide uppercase">
                  Password Reset
                </span>
                {item.timestamp && (
                  <span className="text-[9px] text-theme-text-muted font-mono">
                    {new Date(item.timestamp).toLocaleString("en-US", {
                      hour12: true,
                    })}
                  </span>
                )}
              </div>
              <p className="text-xs text-theme-text-muted mt-1 font-sans">
                Requesting password reset to default:{" "}
                <span className="font-mono text-blue-400 font-bold bg-theme-card-bg px-1 py-0.2 rounded border border-theme-border-input">
                  1234
                </span>
              </p>
            </div>

            <div className="flex gap-2 font-sans shrink-0 pl-2">
              <button
                onClick={() => handleApprovePasswordResetRequest(p.id, false)}
                disabled={approvingIds.has(p.id) || approvedIds.has(p.id)}
                className="px-3 py-1.5 border border-red-500/30 hover:border-red-500 bg-red-955/20 hover:bg-red-955/50 text-red-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Deny
              </button>
              <button
                onClick={() => handleApprovePasswordResetRequest(p.id, true)}
                disabled={approvingIds.has(p.id) || approvedIds.has(p.id)}
                className="px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500 bg-emerald-900/20 hover:bg-emerald-900/50 text-emerald-455 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-80 flex items-center gap-1.5"
              >
                {approvingIds.has(p.id) && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                )}
                {approvedIds.has(p.id) && (
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {approvedIds.has(p.id)
                  ? "Allowed"
                  : approvingIds.has(p.id)
                    ? "Allowing..."
                    : "Allow"}
              </button>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const totalLabel =
    role === "supervisor" ? "Pending Verifications" : "Notifications";

  return (
    <div className="space-y-6 pr-1 font-sans">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-theme-page-bg/20 border border-theme-border-input/60 relative">
        <div className="relative">
          <label className="block text-xs font-semibold text-theme-text-muted mb-1.5 uppercase tracking-wider font-bold">
            SEARCH STAFF (NAME OR CODENAME)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-text-muted">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search by Name or codename (@username)."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-10 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-theme-text-muted hover:text-theme-text-secondary transition-colors cursor-pointer text-sm font-semibold"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-theme-text-muted mb-1.5 uppercase tracking-wider font-bold">
              {role === "supervisor"
                ? "Filter Category"
                : "Filter Notification Type"}
            </label>
            <CustomSelect
              value={notificationTypeFilter}
              onChange={setNotificationTypeFilter}
              options={notificationTypeOptions}
              className="w-full"
            />
          </div>
          {(searchQuery || notificationTypeFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setNotificationTypeFilter("all");
              }}
              className="p-2 bg-theme-border-input hover:bg-theme-border-active text-theme-text-secondary border border-theme-border-input rounded-lg cursor-pointer transition-all shrink-0 flex items-center justify-center h-[32px] w-[32px]"
              title="Reset Filter"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-theme-border-input pb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>{" "}
          {totalLabel} (Total: {combinedNotifications.length})
        </h4>
        {combinedNotifications.length === 0 ? (
          <div className="text-center py-10 bg-theme-page-bg/40 border border-theme-border-muted rounded-xl text-theme-text-muted text-xs font-medium font-sans">
            No matching items found.
          </div>
        ) : (
          <div className="space-y-4 font-sans max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
            {combinedNotifications.map(renderNotificationItem)}
          </div>
        )}
      </div>
    </div>
  );
}
