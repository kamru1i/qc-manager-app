"use client";

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Profile, ChutiRecordWithProfile } from "@/types";
import { ChutiRecord } from "@/utils/offlineSync";
import { exportHelper } from "@/utils/exportHelper";
import { LeavesRecordsTable } from "@/components/leave-tracker/LeavesRecordsTable";
import { DateInput } from "@/components/common/DateInput";
import { TeamLeaveRecordsSkeleton } from "@/components/common/skeleton/TeamLeaveRecordsSkeleton";
import {
  Calendar,
  RefreshCw,
  ArrowLeft,
  Check,
  Edit,
  Trash2,
} from "lucide-react";
import {
  formatDate,
  formatTimeToAMPM,
  getCleanComment,
} from "@/utils/dashboardHelpers";
import { Modal } from "@/components/common/Modal";
import { supabase } from "@/utils/supabase";
import toast from "react-hot-toast";

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
    if (profile.role === "admin") {
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

  // Group the dailyRecords by supervisor
  const groupedDailyRecords = useMemo(() => {
    // If the user is a supervisor (or not an admin), we group into own team + delegated teams
    if (profile.role !== "admin") {
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
      const ownRecords = dailyRecords.filter((r) =>
        ownTeamUserIds.includes(r.user_id),
      );
      const supervisorName = profile.username || "Supervisor";
      groups.push({
        title: `${supervisorName.toUpperCase()} Team Leave Records`,
        records: ownRecords,
        hideFilterPanel: false,
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
        const teamRecords = dailyRecords.filter((r) =>
          teamUserIds.includes(r.user_id),
        );

        groups.push({
          title: `${(sup.username || "Supervisor").toUpperCase()} Team Leave Records`,
          records: teamRecords,
          hideFilterPanel: true,
        });
      });

      // Adjust filter panel visibility
      groups.forEach((g, index) => {
        g.hideFilterPanel = index > 0;
      });

      return groups;
    }

    // Admin logic: group by supervisor, and gather unassigned records
    // Get all supervisors: users with role 'supervisor' or 'admin'
    const supervisors = profilesList.filter(
      (p) => p.role === "supervisor" || p.role === "admin",
    );

    const groups: {
      title: string;
      records: ChutiRecord[];
      hideFilterPanel: boolean;
    }[] = [];

    // Track which records are assigned to any supervisor's team
    const assignedRecordIds = new Set<string>();

    // Sort supervisors by username/codename to keep consistent ordering
    const sortedSupervisors = [...supervisors].sort((a, b) =>
      (a.username || "").localeCompare(b.username || ""),
    );

    // Populate groups for each supervisor who has leaves in their team on this day
    sortedSupervisors.forEach((sup) => {
      const teamRecords = dailyRecords.filter((r) => {
        const staff = profilesList.find((p) => p.id === r.user_id);
        return (staff?.supervisor_ids?.includes(sup.id)) || r.user_id === sup.id;
      });

      if (teamRecords.length > 0) {
        teamRecords.forEach((r) => assignedRecordIds.add(r.id));
        const supName = (sup.username || "Supervisor").toUpperCase();
        groups.push({
          title: `${supName} Team Leave Records`,
          records: teamRecords,
          hideFilterPanel: false, // Will adjust below
        });
      }
    });

    // Gather records that don't belong to any active supervisor
    const unassignedRecords = dailyRecords.filter(
      (r) => !assignedRecordIds.has(r.id),
    );
    if (unassignedRecords.length > 0) {
      groups.push({
        title: `Direct Staff Leave Records`,
        records: unassignedRecords,
        hideFilterPanel: false,
      });
    }

    // Set hideFilterPanel = true for all tables except the first one
    groups.forEach((g, index) => {
      g.hideFilterPanel = index > 0;
    });

    return groups;
  }, [profile, dailyRecords, profilesList]);

  const displayGroups = useMemo(() => {
    if (groupedDailyRecords.length > 0) {
      return groupedDailyRecords;
    }
    const supervisorName = profile.username || "Supervisor";
    const cleanName = supervisorName.toUpperCase();
    return [
      {
        title:
          profile.role === "admin"
            ? "Team daily leave records"
            : `${cleanName} Team Leave Records`,
        records: [],
        hideFilterPanel: false,
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
    let targetRecords = filtered;
    if (profile.role === "admin") {
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

    exportHelper.exportDailyLeavesExcel(
      targetRecords,
      selectedDate,
      profilesList,
      profile,
      () => {},
      (msg) => alert(msg),
    );
  };

  const handleExportPDF = (filtered: ChutiRecord[], searchTerm: string) => {
    let targetRecords = filtered;
    if (profile.role === "admin") {
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
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-800/80 text-slate-300 rounded-xl hover:text-white transition-all cursor-pointer shrink-0"
              title="Go Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl shrink-0 mt-0.5">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Daily Leave Records Report 📅
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                View full leaves and short leaves scheduled for today or any
                other day.
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector Control Group */}
        <div className="flex items-center gap-3 w-full md:w-auto self-stretch md:self-auto border-t border-slate-850/80 md:border-t-0 pt-3 md:pt-0">
          <div className="flex-1 md:flex-none flex flex-col min-w-[170px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
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
              className="flex items-center gap-1.5 py-2 px-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
              title="Reset to today's date"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Today
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
                  className="flex items-center gap-1.5 py-2 px-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  Allow Access
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Daily Leaves Tables Grouped by Supervisor */}
      {displayGroups.map((group) => (
        <LeavesRecordsTable
          key={group.title}
          records={group.records}
          allowOvertime={false}
          filterType={filterType}
          setFilterType={setFilterType}
          filterStartDate={filterStartDate}
          setFilterStartDate={setFilterStartDate}
          filterEndDate={filterEndDate}
          setFilterEndDate={setFilterEndDate}
          onResetFilters={handleResetFilters}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          onToggleAdjustment={() => {}}
          onDeleteClick={() => {}}
          formatDate={formatDate}
          formatTimeToAMPM={formatTimeToAMPM}
          getCleanComment={getCleanComment}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          availableYears={[selectedYear]}
          onAddLeaveClick={() => {}}
          title={group.title}
          emptyMessage="No leave records found for the selected date."
          showPendingBadge={true}
          initialFetchDone={initialFetchDone}
          hideDelete={true}
          showAddLeave={false}
          showNameColumn={true}
          hideAdjustmentAndOvertime={true}
          hideYearSelect={true}
          profilesList={profilesList}
          hideFilterPanel={group.hideFilterPanel}
        />
      ))}

      {/* Delegate Access Modal */}
      <Modal
        isOpen={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        title="Delegate Team Access"
        icon={<Calendar className="h-5 w-5 text-blue-500" />}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 font-sans text-xs">
          <p className="text-slate-400 leading-relaxed">
            If you are going on leave, you can temporarily allow another
            supervisor to view and approve your team's leave records.
          </p>

          <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-950/40 max-h-[220px] overflow-y-auto">
            {(() => {
              const otherSupervisors = profilesList.filter(
                (p) => p.role === "supervisor" && p.id !== profile.id,
              );
              if (otherSupervisors.length === 0) {
                return (
                  <div className="p-4 text-center text-slate-500">
                    No other supervisors found in the system.
                  </div>
                );
              }
              return otherSupervisors.map((sup) => (
                <div
                  key={sup.id}
                  onClick={() => setSelectedSupervisorId(sup.id)}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-900/50 cursor-pointer transition-all"
                >
                  <span className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
                    {sup.username} {sup.full_name ? `(${sup.full_name})` : ""}
                  </span>

                  {/* Styled Circle Checkbox */}
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedSupervisorId === sup.id
                        ? "border-blue-500 bg-blue-600"
                        : "border-slate-700 bg-transparent hover:border-slate-500"
                    }`}
                  >
                    {selectedSupervisorId === sup.id && (
                      <Check className="h-3 w-3 text-white stroke-[3px]" />
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
            <button
              onClick={() => setShowAccessModal(false)}
              className="py-2 px-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer font-bold"
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
              className="fixed z-120 w-40 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl py-1.5 font-sans text-xs"
            >
              <button
                onClick={() => {
                  setContextMenuPos(null);
                  setShowAccessModal(true);
                }}
                className="w-full text-left px-3 py-2 text-slate-350 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer flex items-center gap-2 font-medium"
              >
                <Edit className="h-3.5 w-3.5 text-slate-405" />
                Edit Access
              </button>
              <button
                onClick={() => {
                  setContextMenuPos(null);
                  handleRemoveAccess();
                }}
                className="w-full text-left px-3 py-2 text-red-400 hover:bg-slate-900 hover:text-red-350 transition-colors cursor-pointer flex items-center gap-2 font-medium"
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
