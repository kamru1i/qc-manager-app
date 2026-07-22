import React, { useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { StaffSettingsForm } from "@/components/leave-tracker/StaffSettingsForm";
import { Profile } from "@/types";
import toast from "react-hot-toast";

interface CreateUserPanelProps {
  isAdmin: boolean;
  profiles: Profile[];
  submitting: boolean;
  onCancel: () => void;
  onCreateUser: (params: any) => Promise<string | null>;
  onSuccess: () => void;
}

export const CreateUserPanel: React.FC<CreateUserPanelProps> = ({
  isAdmin,
  profiles,
  submitting,
  onCancel,
  onCreateUser,
  onSuccess,
}) => {
  const [newCodename, setNewCodename] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<
    "admin" | "supervisor" | "user" | "superadmin"
  >("user");
  const [hasChutiAccess, setHasChutiAccess] = useState(true);
  const [hasQuotesAccess, setHasQuotesAccess] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);
  const [canManageRules, setCanManageRules] = useState(false);
  const [newNeedsApproval, setNewNeedsApproval] = useState(false);
  const [newSupervisorIds, setNewSupervisorIds] = useState<string[]>([]);
  const [newEligibleGovtHoliday, setNewEligibleGovtHoliday] = useState(false);
  const [newEligibleOfficeLeave, setNewEligibleOfficeLeave] = useState(false);
  const [newAllowOvertime, setNewAllowOvertime] = useState(false);
  const [newAllowReserve, setNewAllowReserve] = useState(false);
  const [newJobRole, setNewJobRole] = useState("");
  const [newWorkingHours, setNewWorkingHours] = useState("9.5");
  const [newBreakTime, setNewBreakTime] = useState("0");
  const [newSignInTime, setNewSignInTime] = useState("");
  const [newSignOutTime, setNewSignOutTime] = useState("");

  // KPI & Performance states
  const [newKpiSkills, setNewKpiSkills] = useState<string[]>([]);
  const [newKpiDeptIndicators, setNewKpiDeptIndicators] = useState<string[]>([]);
  const [newKpiOtherDeptIndicators, setNewKpiOtherDeptIndicators] = useState<string[]>([]);
  const [newPerformsDataEntry, setNewPerformsDataEntry] = useState(true);
  const [newDepartment, setNewDepartment] = useState("Data Entry");
  const [newPerformsOtherDeptTasks, setNewPerformsOtherDeptTasks] = useState(false);
  const [newOtherDepartment, setNewOtherDepartment] = useState("IT");

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodename.trim() || newCodename.trim().length < 3) {
      toast.error("Codename must be at least 3 characters long.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newCodename.trim())) {
      toast.error("Codename can only contain letters, numbers, - and _.");
      return;
    }
    if (hasQuotesAccess && allowedTypes.length === 0) {
      toast.error("Please select at least one permitted file type for Quotes.");
      return;
    }
    if (!hasChutiAccess && !hasQuotesAccess) {
      toast.error(
        "Please select at least one workspace access (Leave or Quotes Tracker).",
      );
      return;
    }

    const success = await onCreateUser({
      codename: newCodename.trim(),
      role: newRole,
      fullName: newFullName,
      allowedTypes: hasQuotesAccess ? allowedTypes : [],
      canManageRules,
      hasChutiAccess,
      hasQuotesAccess,
      password: "1234",
      needsApproval: newNeedsApproval,
      supervisorIds: newNeedsApproval ? newSupervisorIds : [],
      eligibleGovtHoliday: newEligibleGovtHoliday,
      eligibleOfficeLeave: newEligibleOfficeLeave,
      allowOvertime: newAllowOvertime,
      allowReserve: newAllowReserve,
      jobRole: newJobRole,
      workingHours: parseFloat(newWorkingHours) || 9.5,
      breakTime: parseInt(newBreakTime) || 0,
      signInTime: newSignInTime,
      signOutTime: newSignOutTime,
      kpiSkills: newKpiSkills,
      kpiDeptIndicators: newKpiDeptIndicators,
      kpiOtherDeptIndicators: newKpiOtherDeptIndicators,
      performsDataEntry: newPerformsDataEntry,
      department: newDepartment,
      performsOtherDeptTasks: newPerformsOtherDeptTasks,
      otherDepartment: newOtherDepartment,
    });

    if (success) {
      onSuccess();
    }
  };

  return (
    <>
      <StaffSettingsForm
        isNewUser={true}
        codename={newCodename}
        setCodename={setNewCodename}
        fullName={newFullName}
        setFullName={setNewFullName}
        role={newRole}
        setRole={setNewRole}
        hasChutiAccess={hasChutiAccess}
        setHasChutiAccess={setHasChutiAccess}
        needsApproval={newNeedsApproval}
        setNeedsApproval={setNewNeedsApproval}
        supervisors={profiles.filter((p) => p.role === "supervisor")}
        supervisorIds={newSupervisorIds}
        setSupervisorIds={setNewSupervisorIds}
        eligibleOfficeLeave={newEligibleOfficeLeave}
        setEligibleOfficeLeave={setNewEligibleOfficeLeave}
        eligibleGovtHoliday={newEligibleGovtHoliday}
        setEligibleGovtHoliday={setNewEligibleGovtHoliday}
        allowOvertime={newAllowOvertime}
        setAllowOvertime={setNewAllowOvertime}
        allowReserve={newAllowReserve}
        setAllowReserve={setNewAllowReserve}
        hasQuotesAccess={hasQuotesAccess}
        setHasQuotesAccess={setHasQuotesAccess}
        allowedTypes={allowedTypes}
        setAllowedTypes={setAllowedTypes}
        canManageRules={canManageRules}
        setCanManageRules={setCanManageRules}
        isAdmin={isAdmin}
        jobRole={newJobRole}
        setJobRole={setNewJobRole}
        workingHours={newWorkingHours}
        setWorkingHours={setNewWorkingHours}
        breakTime={newBreakTime}
        setBreakTime={setNewBreakTime}
        signInTime={newSignInTime}
        setSignInTime={setNewSignInTime}
        signOutTime={newSignOutTime}
        setSignOutTime={setNewSignOutTime}
        kpiSkills={newKpiSkills}
        setKpiSkills={setNewKpiSkills}
        kpiDeptIndicators={newKpiDeptIndicators}
        setKpiDeptIndicators={setNewKpiDeptIndicators}
        kpiOtherDeptIndicators={newKpiOtherDeptIndicators}
        setKpiOtherDeptIndicators={setNewKpiOtherDeptIndicators}
        performsDataEntry={newPerformsDataEntry}
        setPerformsDataEntry={setNewPerformsDataEntry}
        department={newDepartment}
        setDepartment={setNewDepartment}
        performsOtherDeptTasks={newPerformsOtherDeptTasks}
        setPerformsOtherDeptTasks={setNewPerformsOtherDeptTasks}
        otherDepartment={newOtherDepartment}
        setOtherDepartment={setNewOtherDepartment}
      />
      <div className="bg-theme-card-bg/20 border border-theme-border-muted/60 p-5 rounded-2xl flex flex-wrap justify-between items-center gap-4 mt-6">
        <div className="flex flex-wrap gap-2.5 font-sans">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-theme-border-muted hover:bg-theme-border-active border border-theme-border-active text-theme-text-secondary rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5"
          >
            <X className="h-3.5 w-3.5 text-red-400" /> Cancel
          </button>
        </div>
        <div className="font-sans">
          <button
            type="button"
            disabled={submitting}
            onClick={handleCreateUser}
            className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-blue-950/20 border border-blue-700/30 flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {submitting ? "Creating..." : "Create User"}
          </button>
        </div>
      </div>
    </>
  );
};
