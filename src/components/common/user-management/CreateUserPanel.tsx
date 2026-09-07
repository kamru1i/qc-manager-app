import React, { useState, useEffect } from "react";
import { Loader2, Check, X, AlertTriangle, Send } from "lucide-react";
import { StaffSettingsForm } from "@/components/leave-tracker/StaffSettingsForm";
import { Profile, UserCreationRequest, UserCreationSubmittedData } from "@/types";
import { toast } from "sonner";

interface CreateUserPanelProps {
  isAdmin: boolean;
  currentUser?: Profile | null;
  profiles: Profile[];
  submitting: boolean;
  onCancel: () => void;
  onCreateUser: (params: any) => Promise<string | null>;
  onSuccess: () => void;
  editingRequest?: UserCreationRequest | null;
  onSubmitRequest?: (params: UserCreationSubmittedData) => Promise<string | null>;
  onResubmitRequest?: (
    requestId: string,
    params: UserCreationSubmittedData,
    expectedVersion: number
  ) => Promise<boolean>;
}

export const CreateUserPanel: React.FC<CreateUserPanelProps> = ({
  isAdmin,
  currentUser,
  profiles,
  submitting,
  onCancel,
  onCreateUser,
  onSuccess,
  editingRequest,
  onSubmitRequest,
  onResubmitRequest,
}) => {
  const isSupervisor = currentUser?.role === "supervisor";

  const [newCodename, setNewCodename] = useState(
    editingRequest?.submitted_data?.codename || ""
  );
  const [newFullName, setNewFullName] = useState(
    editingRequest?.submitted_data?.fullName ||
      editingRequest?.submitted_data?.full_name ||
      ""
  );
  const [newRole, setNewRole] = useState<
    "admin" | "supervisor" | "user" | "superadmin"
  >(
    (editingRequest?.submitted_data?.role as any) ||
      (isSupervisor ? "user" : "user")
  );
  const [hasChutiAccess, setHasChutiAccess] = useState(
    editingRequest?.submitted_data?.hasChutiAccess ??
      editingRequest?.submitted_data?.has_chuti_access ??
      true
  );
  const [hasQuotesAccess, setHasQuotesAccess] = useState(
    editingRequest?.submitted_data?.hasQuotesAccess ??
      editingRequest?.submitted_data?.has_quotes_access ??
      (isSupervisor ? true : false)
  );
  const [allowedTypes, setAllowedTypes] = useState<string[]>(
    editingRequest?.submitted_data?.allowedTypes ||
      editingRequest?.submitted_data?.allowed_types ||
      []
  );
  const [canManageRules, setCanManageRules] = useState(
    editingRequest?.submitted_data?.canManageRules ??
      editingRequest?.submitted_data?.can_manage_rules ??
      false
  );
  const [newNeedsApproval, setNewNeedsApproval] = useState(
    editingRequest?.submitted_data?.needsApproval ??
      editingRequest?.submitted_data?.needs_supervisor_approval ??
      (isSupervisor ? true : false)
  );
  const [newSupervisorIds, setNewSupervisorIds] = useState<string[]>(
    editingRequest?.submitted_data?.supervisorIds ||
      editingRequest?.submitted_data?.supervisor_ids ||
      (isSupervisor && currentUser?.id ? [currentUser.id] : [])
  );
  const [newEligibleGovtHoliday, setNewEligibleGovtHoliday] = useState(
    editingRequest?.submitted_data?.eligibleGovtHoliday ??
      editingRequest?.submitted_data?.eligible_govt_holiday ??
      false
  );
  const [newEligibleOfficeLeave, setNewEligibleOfficeLeave] = useState(
    editingRequest?.submitted_data?.eligibleOfficeLeave ??
      editingRequest?.submitted_data?.eligible_office_leave ??
      false
  );
  const [newAllowOvertime, setNewAllowOvertime] = useState(
    editingRequest?.submitted_data?.allowOvertime ??
      editingRequest?.submitted_data?.allow_overtime ??
      false
  );
  const [newAllowReserve, setNewAllowReserve] = useState(
    editingRequest?.submitted_data?.allowReserve ??
      editingRequest?.submitted_data?.allow_reserve ??
      false
  );
  const [newJobRole, setNewJobRole] = useState(
    editingRequest?.submitted_data?.jobRole ||
      editingRequest?.submitted_data?.job_role ||
      ""
  );
  const [newWorkingHours, setNewWorkingHours] = useState(
    String(
      editingRequest?.submitted_data?.workingHours ||
        editingRequest?.submitted_data?.working_hours ||
        "9.5"
    )
  );
  const [newBreakTime, setNewBreakTime] = useState(
    String(
      editingRequest?.submitted_data?.breakTime ||
        editingRequest?.submitted_data?.break_time ||
        "0"
    )
  );
  const [newSignInTime, setNewSignInTime] = useState(
    editingRequest?.submitted_data?.signInTime ||
      editingRequest?.submitted_data?.default_sign_in ||
      ""
  );
  const [newSignOutTime, setNewSignOutTime] = useState(
    editingRequest?.submitted_data?.signOutTime ||
      editingRequest?.submitted_data?.default_sign_out ||
      ""
  );

  // KPI & Performance states
  const [newKpiSkills, setNewKpiSkills] = useState<string[]>(
    editingRequest?.submitted_data?.kpiSkills ||
      editingRequest?.submitted_data?.kpi_skills ||
      []
  );
  const [newKpiDeptIndicators, setNewKpiDeptIndicators] = useState<string[]>(
    editingRequest?.submitted_data?.kpiDeptIndicators ||
      editingRequest?.submitted_data?.kpi_dept_indicators ||
      []
  );
  const [newKpiOtherDeptIndicators, setNewKpiOtherDeptIndicators] = useState<string[]>(
    editingRequest?.submitted_data?.kpiOtherDeptIndicators ||
      editingRequest?.submitted_data?.kpi_other_dept_indicators ||
      []
  );
  const [newPerformsDataEntry, setNewPerformsDataEntry] = useState(
    editingRequest?.submitted_data?.performsDataEntry ??
      editingRequest?.submitted_data?.performs_data_entry ??
      true
  );
  const [newDepartment, setNewDepartment] = useState(
    editingRequest?.submitted_data?.department || "Data Entry"
  );
  const [newPerformsOtherDeptTasks, setNewPerformsOtherDeptTasks] = useState(
    editingRequest?.submitted_data?.performsOtherDeptTasks ??
      editingRequest?.submitted_data?.performs_other_dept_tasks ??
      false
  );
  const [newOtherDepartment, setNewOtherDepartment] = useState(
    editingRequest?.submitted_data?.otherDepartment ||
      editingRequest?.submitted_data?.other_department ||
      "IT"
  );

  // When supervisor assigns themselves or another supervisor, ensure leave workspace is auto-on
  useEffect(() => {
    if (isSupervisor && newSupervisorIds.length > 0) {
      setHasChutiAccess(true);
      setNewNeedsApproval(true);
    }
  }, [isSupervisor, newSupervisorIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCodename = newCodename.trim().toUpperCase();

    if (!cleanCodename || cleanCodename.length < 3) {
      toast.error("Codename must be at least 3 characters long.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanCodename)) {
      toast.error("Codename can only contain letters, numbers, - and _.");
      return;
    }
    if (hasQuotesAccess && allowedTypes.length === 0) {
      toast.error("Please select at least one permitted file type for Quotes.");
      return;
    }
    if (
      newRole !== "admin" &&
      newRole !== "superadmin" &&
      !hasChutiAccess &&
      !hasQuotesAccess
    ) {
      toast.error(
        "Please select at least one workspace access (Leave or Quotes Tracker)."
      );
      return;
    }

    if (isSupervisor && !hasQuotesAccess) {
      toast.error("Quotes Manager Workspace is required for supervisor creation.");
      return;
    }

    const payload: UserCreationSubmittedData = {
      codename: cleanCodename,
      role: isSupervisor ? "user" : newRole as 'user',
      fullName: newFullName.trim(),
      full_name: newFullName.trim(),
      allowedTypes: hasQuotesAccess ? allowedTypes : [],
      allowed_types: hasQuotesAccess ? allowedTypes : [],
      canManageRules: isSupervisor ? false : canManageRules,
      can_manage_rules: isSupervisor ? false : canManageRules,
      hasChutiAccess: isSupervisor ? true : hasChutiAccess,
      has_chuti_access: isSupervisor ? true : hasChutiAccess,
      hasQuotesAccess: true,
      has_quotes_access: true,
      password: "1234",
      needsApproval: newNeedsApproval,
      needs_supervisor_approval: newNeedsApproval,
      supervisorIds: newNeedsApproval ? newSupervisorIds : [],
      supervisor_ids: newNeedsApproval ? newSupervisorIds : [],
      eligibleGovtHoliday: newEligibleGovtHoliday,
      eligible_govt_holiday: newEligibleGovtHoliday,
      eligibleOfficeLeave: newEligibleOfficeLeave,
      eligible_office_leave: newEligibleOfficeLeave,
      allowOvertime: newAllowOvertime,
      allow_overtime: newAllowOvertime,
      allowReserve: newAllowReserve,
      allow_reserve: newAllowReserve,
      jobRole: newJobRole,
      job_role: newJobRole,
      workingHours: parseFloat(newWorkingHours) || 9.5,
      working_hours: parseFloat(newWorkingHours) || 9.5,
      breakTime: parseInt(newBreakTime) || 0,
      break_time: parseInt(newBreakTime) || 0,
      signInTime: newSignInTime,
      default_sign_in: newSignInTime,
      signOutTime: newSignOutTime,
      default_sign_out: newSignOutTime,
      kpiSkills: newKpiSkills,
      kpi_skills: newKpiSkills,
      kpiDeptIndicators: newKpiDeptIndicators,
      kpi_dept_indicators: newKpiDeptIndicators,
      kpiOtherDeptIndicators: newKpiOtherDeptIndicators,
      kpi_other_dept_indicators: newKpiOtherDeptIndicators,
      performsDataEntry: newPerformsDataEntry,
      performs_data_entry: newPerformsDataEntry,
      department: newDepartment,
      performsOtherDeptTasks: newPerformsOtherDeptTasks,
      performs_other_dept_tasks: newPerformsOtherDeptTasks,
      otherDepartment: newOtherDepartment,
      other_department: newOtherDepartment,
    };

    // Path 1: Resubmitting request under review
    if (editingRequest && onResubmitRequest) {
      const ok = await onResubmitRequest(
        editingRequest.id,
        payload,
        editingRequest.version
      );
      if (ok) {
        onSuccess();
      }
      return;
    }

    // Path 2: Supervisor creating new request for admin approval
    if (isSupervisor && onSubmitRequest) {
      const requestId = await onSubmitRequest(payload);
      if (requestId) {
        onSuccess();
      }
      return;
    }

    // Path 3: Admin direct user creation
    const res = await onCreateUser(payload);
    if (res) {
      onSuccess();
    }
  };

  return (
    <>
      {/* Admin Review Notes Banner when editing a request returned for review */}
      {editingRequest?.review_notes && (
        <div className="bg-purple-950/40 border border-purple-700/60 p-5 rounded-2xl mb-6 space-y-2 animate-in fade-in duration-150 font-sans">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
            <AlertTriangle className="h-4 w-4 text-purple-400 shrink-0" />
            <span>Admin Review Notes — Changes Requested</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-700/60 text-purple-200">
              Revision #{editingRequest.version}
            </span>
          </div>
          <p className="text-xs text-theme-text-primary bg-theme-page-bg/80 p-3.5 rounded-xl border border-purple-900/50 leading-relaxed font-sans">
            {editingRequest.review_notes}
          </p>
        </div>
      )}

      <StaffSettingsForm
        isNewUser={true}
        isSupervisor={isSupervisor}
        currentUser={currentUser}
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
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-blue-950/20 border border-blue-700/30 flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingRequest ? (
              <Send className="h-4 w-4" />
            ) : isSupervisor ? (
              <Send className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {submitting
              ? "Submitting..."
              : editingRequest
              ? "Resubmit / Update Request"
              : isSupervisor
              ? "Submit for Approval"
              : "Create User"}
          </button>
        </div>
      </div>
    </>
  );
};
