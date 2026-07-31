"use client";

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Profile, ChutiRecordWithProfile } from "@/types";
import { ChutiRecord } from "@/utils/offlineSync";
import { exportHelper } from "@/utils/exportHelper";
import { LeavesRecordsTable } from "@/components/leave-tracker/LeavesRecordsTable";
import { DateInput } from "@/components/common/DateInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TeamLeaveRecordsSkeleton } from "@/components/common/skeleton/TeamLeaveRecordsSkeleton";
import {
  Calendar,
  RefreshCw,
  ArrowLeft,
  Check,
  Edit,
  Trash2,
  Download,
  Search,
  Users,
} from "lucide-react";
import {
  formatDate,
  formatTimeToAMPM,
  getCleanComment,
} from "@/utils/dashboardHelpers";
import { Modal } from "@/components/common/Modal";
import { supabase } from "@/utils/supabase";
import toast from "react-hot-toast";
import { isAdminRole } from '@/utils/permissionService';

interface TeamLeaveRecordsProps {
  profile: Profile;
  profilesList: Profile[];
  adminRecords: ChutiRecordWithProfile[];
  initialFetchDone: boolean;
  onBack?: () => void;
  setProfile?: React.Dispatch<React.SetStateAction<Profile | null>>;
  setProfilesList?: React.Dispatch<React.SetStateAction<Profile[]>>;
}

export const TeamLeaveRecords: React.FC<TeamLeaveRecordsProps> = ({
  profile,
  profilesList,
  adminRecords,
  initialFetchDone,
  onBack,
  setProfile,
  setProfilesList,
}) => {
  // Initialize to local today's date in 'YYYY-MM-DD' Swedish format
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  // Dummy table control states (required by LeavesRecordsTable prop signature)
  const [filterType, setFilterType] = useState("All");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear().toString(),
  );

  // Delegate / Access control states
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState(
    profile.delegated_supervisor_id || "",
  );
  const [submittingAccess, setSubmittingAccess] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Filter profiles list to identify team member user IDs
  const teamUserIds = useMemo(() => {
    if (isAdminRole(profile)) {
      return null; // Admin sees everyone
    }
    // Supervisor sees members under their team, plus members of teams that delegated to them
    const delegatedFromSupervisorIds = profilesList
      .filter((p) => p.delegated_supervisor_id === profile.id)
      .map((p) => p.id);

    const memberIds = profilesList
      .filter(
        (p) =>
          (p.supervisor_ids && p.supervisor_ids.includes(profile.id)) ||
          (p.supervisor_ids &&
            p.supervisor_ids.some((id) =>
              delegatedFromSupervisorIds.includes(id),
            )),
      )
      .map((p) => p.id);

    return [...memberIds, profile.id];
  }, [profile, profilesList]);

  // Filter chuti records for the selected date and correct team membership
  const dailyRecords = useMemo(() => {
    return adminRecords.filter((r) => {
      // 1. Must match selected date
      if (r.date !== selectedDate) return false;

      // 2. Filter by supervisor's team if not admin
      if (teamUserIds !== null) {
        return teamUserIds.includes(r.user_id);
      }

      return true;
    });
  }, [adminRecords, selectedDate, teamUserIds]);

  // Filter dailyRecords by leave_type and search term
  const filteredDailyRecords = useMemo(() => {
    return dailyRecords.filter((r) => {
      const rType = (r.leave_type || "").toLowerCase();
      const isShort =
        rType.includes("short") ||
        (Boolean(r.sign_in_time) && Boolean(r.sign_out_time));
      const isOvertime = rType.includes("overtime");
      const isFull = !isShort && !isOvertime;

      // 1. Leave type filter
      if (filterType && filterType !== "All" && filterType !== "all") {
        const selected = filterType.toLowerCase();
        if (selected === "short leave" || selected === "short") {
          if (!isShort) return false;
        } else if (selected === "full leave" || selected === "full") {
          if (!isFull) return false;
        } else if (selected === "overtime") {
          if (!isOvertime) return false;
        }
      }

      // 2. Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const staffProfile = profilesList.find((p) => p.id === r.user_id);
        const fullName = (
          staffProfile?.full_name ||
          staffProfile?.username ||
          r.username ||
          ""
        ).toLowerCase();
        const codename = (
          staffProfile?.username ||
          r.username ||
          ""
        ).toLowerCase();
        const comment = getCleanComment(r.comment).toLowerCase();
        const typeLabel = isOvertime ? "overtime" : isShort ? "short leave" : "full leave";

        const matches =
          fullName.includes(query) ||
          codename.includes(query) ||
          comment.includes(query) ||
          typeLabel.includes(query) ||
          rType.includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [dailyRecords, filterType, searchTerm, profilesList]);

  // Group the filteredDailyRecords by supervisor
  const groupedDailyRecords = useMemo(() => {
    // If the user is a supervisor (or not an admin), we group into own team + delegated teams
    if (!isAdminRole(profile)) {
      const groups = [];

      // 1. Supervisor's own team records (including the supervisor themselves)
      const ownTeamUserIds = [
        ...profilesList
          .filter(
            (p) => p.supervisor_ids && p.supervisor_ids.includes(profile.id),
          )
          .map((p) => p.id),
        profile.id,
      ];
      const ownRecords = filteredDailyRecords.filter((r) =>
        ownTeamUserIds.includes(r.user_id),
      );
      const supervisorName = profile.username || "Supervisor";
      groups.push({
        title: `${supervisorName.toUpperCase()} Team Leave Records`,
        records: ownRecords,
      });

      // 2. Delegated teams records
      const delegatingSups = profilesList.filter(
        (p) =>
          p.role === "supervisor" && p.delegated_supervisor_id === profile.id,
      );

      // Sort delegating supervisors to keep consistent ordering
      const sortedDelegating = [...delegatingSups].sort((a, b) =>
        (a.username || "").localeCompare(b.username || ""),
      );

      sortedDelegating.forEach((sup) => {
        const teamUserIds = profilesList
          .filter((p) => p.supervisor_ids && p.supervisor_ids.includes(sup.id))
          .map((p) => p.id);
        const teamRecords = filteredDailyRecords.filter((r) =>
          teamUserIds.includes(r.user_id),
        );

        groups.push({
          title: `${(sup.username || "Supervisor").toUpperCase()} Team Leave Records`,
          records: teamRecords,
        });
      });

      return groups;
    }

    // Admin logic: group by supervisor, and gather unassigned records
    const supervisors = profilesList.filter(
      (p) => p.role === "supervisor" || p.role === "admin",
    );

    const groups: {
      title: string;
      records: ChutiRecord[];
    }[] = [];

    const assignedRecordIds = new Set<string>();

    const sortedSupervisors = [...supervisors].sort((a, b) =>
      (a.username || "").localeCompare(b.username || ""),
    );

    sortedSupervisors.forEach((sup) => {
      const teamRecords = filteredDailyRecords.filter((r) => {
        const staff = profilesList.find((p) => p.id === r.user_id);
        return (staff?.supervisor_ids?.includes(sup.id)) || r.user_id === sup.id;
      });

      if (teamRecords.length > 0) {
        teamRecords.forEach((r) => assignedRecordIds.add(r.id));
        const supName = (sup.username || "Supervisor").toUpperCase();
        groups.push({
          title: `${supName} Team Leave Records`,
          records: teamRecords,
        });
      }
    });

    const unassignedRecords = filteredDailyRecords.filter(
      (r) => !assignedRecordIds.has(r.id),
    );
    if (unassignedRecords.length > 0) {
      groups.push({
        title: `Direct Staff Leave Records`,
        records: unassignedRecords,
      });
    }

    return groups;
  }, [profile, filteredDailyRecords, profilesList]);

  const displayGroups = useMemo(() => {
    if (groupedDailyRecords.length > 0) {
      return groupedDailyRecords;
    }
    const supervisorName = profile.username || "Supervisor";
    const cleanName = supervisorName.toUpperCase();
    return [
      {
        title:
          isAdminRole(profile)
            ? "Team daily leave records"
            : `${cleanName} Team Leave Records`,
        records: [],
      },
    ];
  }, [groupedDailyRecords, profile]);

  if (!initialFetchDone) {
    return <TeamLeaveRecordsSkeleton />;
  }

  const handleSaveAccess = async () => {
    if (!setProfile || !setProfilesList) return;
    if (!selectedSupervisorId) {
      toast.error("Please select a supervisor first.");
      return;
    }
    setSubmittingAccess(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ delegated_supervisor_id: selectedSupervisorId })
        .eq("id", profile.id);

      if (error) throw error;

      // Update local profile state
      setProfile((prev) =>
        prev
          ? { ...prev, delegated_supervisor_id: selectedSupervisorId }
          : null,
      );

      // Update local profilesList state
      setProfilesList((prev) =>
        prev.map((p) =>
          p.id === profile.id
            ? { ...p, delegated_supervisor_id: selectedSupervisorId }
            : p,
        ),
      );

      toast.success("Access delegated successfully!");
      setShowAccessModal(false);
    } catch (err) {
      console.error("Error saving access:", err);
      toast.error("Failed to delegate access.");
    } finally {
      setSubmittingAccess(false);
    }
  };

  const handleRemoveAccess = async () => {
    if (!setProfile || !setProfilesList) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ delegated_supervisor_id: null })
        .eq("id", profile.id);

      if (error) throw error;

      // Update local profile state
      setProfile((prev) =>
        prev ? { ...prev, delegated_supervisor_id: null } : null,
      );

      // Update local profilesList state
      setProfilesList((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, delegated_supervisor_id: null } : p,
        ),
      );

      toast.success("Access removed successfully!");
    } catch (err) {
      console.error("Error removing access:", err);
      toast.error("Failed to remove access.");
    }
  };

  const handleAccessContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleResetToToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${year}-${month}-${day}`);
    handleResetFilters();
  };

  const handleResetFilters = () => {
    setFilterType("All");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  const handleExportExcel = (filtered: ChutiRecord[], searchTerm: string) => {
    exportHelper.exportDailyLeavesExcel(
      filteredDailyRecords,
      selectedDate,
      profilesList,
      profile,
      () => {},
      (msg) => alert(msg),
    );
  };

  const handleExportPDF = (filtered: ChutiRecord[], searchTerm: string) => {
    let targetRecords = filtered;
    if (isAdminRole(profile)) {
      // Export all daily records matching categories and date filters
      targetRecords = dailyRecords.filter((r) => {
        if (filterType !== "All" && r.leave_type !== filterType) return false;
        if (filterStartDate && new Date(r.date) < new Date(filterStartDate))
          return false;
        if (filterEndDate && new Date(r.date) > new Date(filterEndDate))
          return false;
        return true;
      });
    } else {
      // Export all accessible records (own team + delegated teams) matching search
      targetRecords = searchTerm.trim()
        ? dailyRecords.filter((r) => {
            const staffProfile = profilesList.find((p) => p.id === r.user_id);
            const fullName =
              staffProfile?.full_name ||
              staffProfile?.username ||
              r.username ||
              "";
            const codename = staffProfile?.username || r.username || "";
            return (
              fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              codename.toLowerCase().includes(searchTerm.toLowerCase()) ||
              getCleanComment(r.comment)
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
            );
          })
        : dailyRecords;
    }

    exportHelper.exportDailyLeavesPDF(
      targetRecords,
      selectedDate,
      profilesList,
      profile,
      () => {},
      (msg) => alert(msg),
    );
  };

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl shrink-0 mt-0.5">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-theme-text-primary">
                Daily Leave Records Report 📅
              </h4>
              <p className="text-xs text-theme-text-muted mt-1 leading-relaxed">
                View full leaves and short leaves scheduled for today or any
                other day.
              </p>
            </div>
          </div>
        </div>

        {/* Date, Leave Type Filter, Search, and Excel Export Control Group */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto self-stretch md:self-auto border-t border-theme-border-muted/80 md:border-t-0 pt-3 md:pt-0">
          {/* Quick Search Bar */}
          <div className="flex flex-col min-w-[200px] flex-1 sm:flex-none">
            <label className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">
              Search Records
            </label>
            <div className="relative w-full">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-theme-text-muted" />
              <input
                type="text"
                placeholder="Search by comment or leave type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-theme-card-container border border-theme-border-input text-theme-text-primary placeholder:text-theme-text-muted/60 text-xs rounded-xl focus:outline-none focus:border-blue-500 font-sans"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2 text-xs text-theme-text-muted hover:text-theme-text-primary transition-colors cursor-pointer font-bold"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Leave Type Filter Dropdown */}
          <div className="flex flex-col min-w-[140px]">
            <label className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">
              Leave Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-theme-card-container border border-theme-border-input text-theme-text-primary text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer font-sans"
            >
              <option value="all">All Categories</option>
              <option value="full">Full Leave</option>
              <option value="short">Short Leave</option>
            </select>
          </div>

          <div className="flex-1 md:flex-none flex flex-col min-w-[170px]">
            <label className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">
              Select Date
            </label>
            <DateInput
              value={selectedDate}
              onChange={setSelectedDate}
              className="rounded-xl!"
            />
          </div>

          <div className="flex flex-col justify-end self-end">
            <button
              onClick={handleResetToToday}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-theme-card-container hover:bg-theme-card-bg border border-theme-border-input rounded-xl text-xs font-bold text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer shadow-sm"
              title="Reset to today's date"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Today
            </button>
          </div>

          {/* Excel Export Button (No PDF) */}
          <div className="flex flex-col justify-end self-end">
            <button
              onClick={() => handleExportExcel(dailyRecords, searchTerm)}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/80 text-emerald-400 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Export Excel Report"
            >
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
          </div>

          {profile.role === "supervisor" && (
            <div className="flex flex-col justify-end self-end">
              {profile.delegated_supervisor_id ? (
                (() => {
                  const delegatedSup = profilesList.find(
                    (p) => p.id === profile.delegated_supervisor_id,
                  );
                  const codename = delegatedSup
                    ? delegatedSup.username.toUpperCase()
                    : "NONE";
                  return (
                    <button
                      onContextMenu={handleAccessContextMenu}
                      onClick={() => setShowAccessModal(true)}
                      className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-950/40 hover:bg-emerald-900/30 border border-emerald-800/80 text-emerald-400 hover:text-emerald-350 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                      title="Right-click for options"
                    >
                      Access: {codename}
                    </button>
                  );
                })()
              ) : (
                <button
                  onClick={() => {
                    setSelectedSupervisorId("");
                    setShowAccessModal(true);
                  }}
                  className="flex items-center gap-1.5 py-2 px-3.5 bg-theme-card-container hover:bg-theme-card-bg border border-theme-border-input rounded-xl text-xs font-bold text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer shadow-sm"
                >
                  Allow Access
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Daily Leaves Single Unified Table */}
      <div className="bg-theme-card-bg/40 border border-theme-border-input/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-theme-card-container/90 border-b border-theme-border-input/80 text-[11px] uppercase tracking-wider text-theme-text-muted font-bold">
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4 text-center">Codename</th>
                <th className="py-3.5 px-4 text-center">Type</th>
                <th className="py-3.5 px-4 text-center">Sign In/Out</th>
                <th className="py-3.5 px-4 text-center">Leave Hours</th>
                <th className="py-3.5 px-4 text-center">Comment</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-input/40">
              {displayGroups.length === 0 || displayGroups.every((g) => g.records.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-theme-text-muted text-sm font-medium">
                    No leave records found for the selected date.
                  </td>
                </tr>
              ) : (
                displayGroups.map((group) => (
                  <React.Fragment key={group.title}>
                    {/* Supervisor Team Sub-Header Row */}
                    <tr className="bg-theme-card-container/80 border-y border-theme-border-input/60">
                      <td colSpan={6} className="py-2.5 px-4 font-bold text-xs text-blue-400">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          {group.title}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-normal text-[11px] text-theme-text-muted">
                        Total: {group.records.length} {group.records.length === 1 ? "entry" : "entries"}
                      </td>
                    </tr>

                    {/* Group Leave Record Rows */}
                    {group.records.map((r) => {
                      const staffProfile = profilesList.find((p) => p.id === r.user_id);
                      const fullName = staffProfile?.full_name || staffProfile?.username || r.username || "Staff User";
                      const codename = (staffProfile?.username || r.username || "—").toUpperCase();

                      const rType = (r.leave_type || "").toLowerCase();
                      const isShort =
                        rType.includes("short") ||
                        (Boolean(r.sign_in_time) && Boolean(r.sign_out_time));
                      const isOvertime = rType.includes("overtime");

                      return (
                        <tr key={r.id} className="hover:bg-theme-card-bg/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-theme-text-primary">
                            {fullName}
                          </td>
                          <td className="py-3 px-4 font-mono text-theme-text-secondary text-xs text-center">
                            {codename}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                              isOvertime
                                ? "bg-emerald-955/50 border border-emerald-800 text-emerald-300"
                                : isShort
                                ? "bg-blue-955/50 border border-blue-800 text-blue-300"
                                : "bg-red-955/50 border border-red-800 text-red-300"
                            }`}>
                              {isOvertime ? "Overtime" : isShort ? "Short Leave" : "Full Leave"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-theme-text-secondary text-center">
                            {r.sign_in_time && r.sign_out_time ? `${formatTimeToAMPM(r.sign_in_time)} / ${formatTimeToAMPM(r.sign_out_time)}` : "—"}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-theme-text-primary font-bold text-center">
                            {r.leave_hour ? r.leave_hour : "—"}
                          </td>
                          <td className="py-3 px-4 text-theme-text-secondary text-xs max-w-xs truncate text-center" title={getCleanComment(r.comment)}>
                            {getCleanComment(r.comment) || "—"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center items-center">
                              <StatusBadge record={r} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delegate Access Modal */}
      <Modal
        isOpen={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        title="Delegate Team Access"
        icon={<Calendar className="h-5 w-5 text-blue-500" />}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 font-sans text-xs">
          <p className="text-theme-text-muted leading-relaxed">
            If you are going on leave, you can temporarily allow another
            supervisor to view and approve your team's leave records.
          </p>

          <div className="border border-theme-border-input rounded-xl overflow-hidden divide-y divide-theme-border-input bg-theme-card-container/40 max-h-[220px] overflow-y-auto">
            {(() => {
              const otherSupervisors = profilesList.filter(
                (p) => p.role === "supervisor" && p.id !== profile.id,
              );
              if (otherSupervisors.length === 0) {
                return (
                  <div className="p-4 text-center text-theme-text-muted">
                    No other supervisors found in the system.
                  </div>
                );
              }
              return otherSupervisors.map((sup) => (
                <div
                  key={sup.id}
                  onClick={() => setSelectedSupervisorId(sup.id)}
                  className="flex items-center justify-between p-3.5 hover:bg-theme-card-bg/50 cursor-pointer transition-all"
                >
                  <span className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide">
                    {sup.username} {sup.full_name ? `(${sup.full_name})` : ""}
                  </span>

                  {/* Styled Circle Checkbox */}
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedSupervisorId === sup.id
                        ? "border-blue-500 bg-blue-600"
                        : "border-theme-border-active bg-transparent hover:border-theme-border-active"
                    }`}
                  >
                    {selectedSupervisorId === sup.id && (
                      <Check className="h-3 w-3 text-theme-text-primary stroke-[3px]" />
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-theme-border-input/80">
            <button
              onClick={() => setShowAccessModal(false)}
              className="py-2 px-4 bg-theme-card-bg hover:bg-theme-border-muted border border-theme-border-input rounded-xl text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAccess}
              disabled={submittingAccess || !selectedSupervisorId}
              className="py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all cursor-pointer font-bold"
            >
              {submittingAccess ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Right-click & Left-click Context Menu (Rendered using React Portal for precise mouse positioning) */}
      {contextMenuPos &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-110 cursor-default"
              onClick={() => setContextMenuPos(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuPos(null);
              }}
            />
            <div
              style={{ top: contextMenuPos.y + 5, left: contextMenuPos.x }}
              className="fixed z-120 w-40 bg-theme-card-container border border-theme-border-input rounded-lg shadow-2xl py-1.5 font-sans text-xs"
            >
              <button
                onClick={() => {
                  setContextMenuPos(null);
                  setShowAccessModal(true);
                }}
                className="w-full text-left px-3 py-2 text-theme-text-secondary hover:bg-theme-card-bg hover:text-theme-text-primary transition-colors cursor-pointer flex items-center gap-2 font-medium"
              >
                <Edit className="h-3.5 w-3.5 text-theme-text-muted" />
                Edit Access
              </button>
              <button
                onClick={() => {
                  setContextMenuPos(null);
                  handleRemoveAccess();
                }}
                className="w-full text-left px-3 py-2 text-red-400 hover:bg-theme-card-bg hover:text-red-350 transition-colors cursor-pointer flex items-center gap-2 font-medium"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-405" />
                Remove Access
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
};
