import React from "react";
import { Check } from "lucide-react";
import { Toggle } from "@/components/common/Toggle";
import { CategoryCheckboxList } from "@/components/quotes-tracker/CategoryCheckboxList";
import { Profile } from "@/types";
import { formatTimeToAMPM } from "@/utils/dashboardHelpers";
import { supabase } from "@/utils/supabase";
import { canAccessProfileSection } from "@/utils/permissionService";
import { KPI_ASSESSMENT_COLUMNS } from "@/utils/dbColumns";

interface StaffSettingsFormProps {
  isNewUser: boolean;
  codename?: string;
  setCodename?: (val: string) => void;

  fullName: string;
  setFullName: (val: string) => void;

  role: "admin" | "supervisor" | "user";
  setRole: (val: "admin" | "supervisor" | "user") => void;

  hasChutiAccess: boolean;
  setHasChutiAccess: (val: boolean) => void;

  needsApproval: boolean;
  setNeedsApproval: (val: boolean) => void;

  supervisors: Profile[];
  supervisorIds: string[];
  setSupervisorIds: (ids: string[]) => void;

  eligibleOfficeLeave: boolean;
  setEligibleOfficeLeave: (val: boolean) => void;

  eligibleGovtHoliday: boolean;
  setEligibleGovtHoliday: (val: boolean) => void;

  allowOvertime: boolean;
  setAllowOvertime: (val: boolean) => void;

  allowReserve: boolean;
  setAllowReserve: (val: boolean) => void;

  hasQuotesAccess: boolean;
  setHasQuotesAccess: (val: boolean) => void;

  allowedTypes: string[];
  setAllowedTypes:
    | React.Dispatch<React.SetStateAction<string[]>>
    | ((val: string[]) => void);

  canManageRules: boolean;
  setCanManageRules: (val: boolean) => void;

  isAdmin: boolean; // whether current viewing user has admin access to modify these fields
  isSupervisor?: boolean;

  jobRole?: string;
  setJobRole?: (val: string) => void;
  workingHours?: string;
  setWorkingHours?: (val: string) => void;
  breakTime?: string;
  setBreakTime?: (val: string) => void;
  signInTime?: string;
  setSignInTime?: (val: string) => void;
  signOutTime?: string;
  setSignOutTime?: (val: string) => void;
  kpiSkills?: string[];
  setKpiSkills?: (val: string[]) => void;
  kpiDeptIndicators?: string[];
  setKpiDeptIndicators?: (val: string[]) => void;
  performsDataEntry?: boolean;
  setPerformsDataEntry?: (val: boolean) => void;
  department?: string;
  setDepartment?: (val: string) => void;
  performsOtherDeptTasks?: boolean;
  setPerformsOtherDeptTasks?: (val: boolean) => void;
  otherDepartment?: string;
  setOtherDepartment?: (val: string) => void;
  kpiOtherDeptIndicators?: string[];
  setKpiOtherDeptIndicators?: (val: string[]) => void;
  viewingStaff?: Profile | null;
  onViewKpiReport?: (periodKey: string) => void;
  currentUser?: Profile | null;
  delegatedLeaveSupervisorId?: string | null;
  setDelegatedLeaveSupervisorId?: (val: string | null) => void;
  delegatedKpiSupervisorId?: string | null;
  setDelegatedKpiSupervisorId?: (val: string | null) => void;
}

export const StaffSettingsForm: React.FC<StaffSettingsFormProps> = ({
  isNewUser,
  codename = "",
  setCodename,
  fullName,
  setFullName,
  role,
  setRole,
  hasChutiAccess,
  setHasChutiAccess,
  needsApproval,
  setNeedsApproval,
  supervisors,
  supervisorIds,
  setSupervisorIds,
  eligibleOfficeLeave,
  setEligibleOfficeLeave,
  eligibleGovtHoliday,
  setEligibleGovtHoliday,
  allowOvertime,
  setAllowOvertime,
  allowReserve,
  setAllowReserve,
  hasQuotesAccess,
  setHasQuotesAccess,
  allowedTypes,
  setAllowedTypes,
  canManageRules,
  setCanManageRules,
  isAdmin,
  isSupervisor = false,
  jobRole = "",
  setJobRole,
  workingHours = "9.5",
  setWorkingHours,
  breakTime = "0",
  setBreakTime,
  signInTime = "",
  setSignInTime,
  signOutTime = "",
  setSignOutTime,
  kpiSkills = [],
  setKpiSkills,
  kpiDeptIndicators = [],
  setKpiDeptIndicators,
  setPerformsDataEntry,
  department = "Data Entry",
  setDepartment,
  performsOtherDeptTasks = false,
  setPerformsOtherDeptTasks,
  otherDepartment = "IT",
  setOtherDepartment,
  kpiOtherDeptIndicators = [],
  setKpiOtherDeptIndicators,
  viewingStaff = null,
  onViewKpiReport,
  currentUser,
  delegatedLeaveSupervisorId,
  setDelegatedLeaveSupervisorId,
  delegatedKpiSupervisorId,
  setDelegatedKpiSupervisorId,
}) => {
  const showLeaveSettings = isNewUser ? (isAdmin || isSupervisor) : canAccessProfileSection(currentUser || null, viewingStaff, 'leave_settings');
  const showQuotesSettings = isNewUser ? (isAdmin || isSupervisor) : canAccessProfileSection(currentUser || null, viewingStaff, 'quotes_settings');
  const showKpiSettings = isNewUser ? (isAdmin || isSupervisor) : (canAccessProfileSection(currentUser || null, viewingStaff, 'kpi_settings') && !!setKpiSkills);
  const [newSkillText, setNewSkillText] = React.useState("");
  const [newDeptIndicatorText, setNewDeptIndicatorText] = React.useState("");
  const [newOtherDeptIndicatorText, setNewOtherDeptIndicatorText] = React.useState("");

  const [previousEvaluations, setPreviousEvaluations] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!viewingStaff) return;
    const fetchPrevious = async () => {
      try {
        const { data } = await supabase
          .from('kpi_assessments')
          .select(KPI_ASSESSMENT_COLUMNS)
          .eq('user_id', viewingStaff.id)
          .order('updated_at', { ascending: false });
        if (data) {
          setPreviousEvaluations(data);
        }
      } catch (err) {
        console.error('Error fetching previous assessments in settings:', err);
      }
    };
    fetchPrevious();
  }, [viewingStaff]);

  const formatDateToDMY = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
      const parts = dateStr.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };
  const allDepts = ["Data Entry", "IT", "Accounts", "HR", "Other"];
  const otherDeptOptions = allDepts.filter((d) => d !== department);

  return (
    <div className="space-y-6">
      {/* Profile Details Fields */}
      <div className="bg-theme-card-bg/40 border border-theme-border-muted p-5 rounded-2xl shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {setCodename && (
            <div>
              <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">
                Codename
              </label>
              <input
                type="text"
                required
                placeholder="e.g. KI1024"
                value={codename}
                onChange={(e) => setCodename(e.target.value.toUpperCase())}
                disabled={!isAdmin}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70 text-xs focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">
              Full Name
            </label>
            {isAdmin ? (
              <input
                type="text"
                placeholder="e.g. Kamrul Islam"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70 text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-theme-page-bg/30 border border-theme-border-muted/40 rounded-lg text-theme-text-secondary text-xs font-semibold">
                {fullName || "—"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">
              Account Role
            </label>
            {isAdmin ? (
              <select
                value={role}
                onChange={(e) => {
                  const val = e.target.value as "admin" | "user" | "supervisor";
                  setRole(val);
                  if (val === "admin") {
                    setCanManageRules(true);
                  }
                }}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="user">User</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-theme-page-bg/30 border border-theme-border-muted/40 rounded-lg text-theme-text-secondary text-xs font-semibold capitalize">
                {role || "—"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">
              Job Role
            </label>
            {isAdmin ? (
              <input
                type="text"
                placeholder="e.g. IT Officer"
                value={jobRole}
                onChange={(e) => setJobRole?.(e.target.value)}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70 text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-theme-page-bg/30 border border-theme-border-muted/40 rounded-lg text-theme-text-secondary text-xs font-semibold">
                {jobRole || "—"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">
              Working Hours
            </label>
            {isAdmin ? (
              <select
                value={workingHours}
                onChange={(e) => setWorkingHours?.(e.target.value)}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="7.5">7 Hours 30 Mins</option>
                <option value="8.0">8 Hours</option>
                <option value="8.5">8 Hours 30 Mins</option>
                <option value="9.0">9 Hours</option>
                <option value="9.5">9 Hours 30 Mins</option>
                <option value="10.0">10 Hours</option>
              </select>
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-theme-page-bg/30 border border-theme-border-muted/40 rounded-lg text-theme-text-secondary text-xs font-semibold">
                {workingHours ? `${workingHours} hrs` : "—"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">
              Break (Minutes)
            </label>
            {isAdmin || isSupervisor ? (
              <input
                type="number"
                min="0"
                value={breakTime}
                onChange={(e) => setBreakTime?.(e.target.value)}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-theme-page-bg/30 border border-theme-border-muted/40 rounded-lg text-theme-text-secondary text-xs font-semibold">
                {breakTime !== undefined ? `${breakTime} mins` : "—"}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider">
                Sign-In
              </label>
              {signInTime && (
                <span className="text-[10px] font-bold text-blue-450 tracking-wider">
                  {formatTimeToAMPM(signInTime)}
                </span>
              )}
            </div>
            {isAdmin || isSupervisor ? (
              <input
                type="time"
                value={signInTime}
                onChange={(e) => setSignInTime?.(e.target.value)}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-theme-page-bg/30 border border-theme-border-muted/40 rounded-lg text-theme-text-secondary text-xs font-semibold">
                {signInTime ? formatTimeToAMPM(signInTime) : "—"}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider">
                Sign-Out Time
              </label>
              {signOutTime && (
                <span className="text-[10px] font-bold text-blue-450 tracking-wider">
                  {formatTimeToAMPM(signOutTime)}
                </span>
              )}
            </div>
            {isAdmin || isSupervisor ? (
              <input
                type="time"
                value={signOutTime}
                onChange={(e) => setSignOutTime?.(e.target.value)}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-theme-page-bg/30 border border-theme-border-muted/40 rounded-lg text-theme-text-secondary text-xs font-semibold">
                {signOutTime ? formatTimeToAMPM(signOutTime) : "—"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workspace Access & Permissions Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Tracker Access Card */}
        {showLeaveSettings && (
          <div className="bg-theme-card-bg/40 border border-theme-border-muted p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-theme-border-input/60 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${hasChutiAccess ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-theme-border-muted"}`}
                />
                <h3 className="text-sm font-bold text-theme-text-primary">
                  Leave Tracker Workspace
                </h3>
              </div>
              {isAdmin && (
                <Toggle
                  checked={hasChutiAccess}
                  onChange={setHasChutiAccess}
                  label="Access"
                />
              )}
            </div>

          {hasChutiAccess && (
            <div className="space-y-4 text-xs text-theme-text-secondary animate-fade-in">
              {/* Supervisor Approval Required */}
              <label
                className={`flex items-start gap-2.5 select-none ${isAdmin ? "cursor-pointer group" : "opacity-80 pointer-events-none"}`}
              >
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={needsApproval}
                    disabled={!isAdmin}
                    onChange={(e) => setNeedsApproval(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      needsApproval
                        ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                        : "border-theme-border-active bg-theme-page-bg text-transparent"
                    }`}
                  >
                    {needsApproval && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors block">
                    Supervisor Approval Required?
                  </span>
                  <span className="text-[10px] text-theme-text-muted block leading-tight">
                    Requires approval from a supervisor for any leave
                    submissions.
                  </span>
                </div>
              </label>

              {/* Conditional Supervisor Multi-Select Checkboxes */}
              {needsApproval && (
                <div className="pl-6.5 space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-semibold text-theme-text-muted">
                      Select Supervisors
                    </label>
                    <span className="text-[9px] font-semibold text-theme-text-muted bg-theme-card-container/60 border border-theme-border-muted px-2 py-0.5 rounded-full">
                      {supervisorIds.length} Selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3 bg-theme-card-container/60 border border-theme-border-muted rounded-xl max-h-40 overflow-y-auto">
                    {supervisors.length === 0 ? (
                      <span className="text-[10px] text-theme-text-muted italic">
                        No supervisor accounts found.
                      </span>
                    ) : (
                      <>
                        <label
                          className={`flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all select-none ${
                            isAdmin
                              ? "cursor-pointer"
                              : "opacity-85 pointer-events-none"
                          } ${
                            supervisorIds.length === supervisors.length
                              ? "bg-blue-950/40 border-blue-700/60 text-blue-400"
                              : "bg-theme-card-bg border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={
                              supervisorIds.length === supervisors.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSupervisorIds(supervisors.map((s) => s.id));
                              } else {
                                setSupervisorIds([]);
                              }
                            }}
                            className="hidden"
                          />
                          <div
                            className={`h-3 w-3 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                              supervisorIds.length === supervisors.length
                                ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text"
                                : "border-theme-border-active bg-transparent text-transparent"
                            }`}
                          >
                            {supervisorIds.length === supervisors.length && (
                              <Check className="h-2 w-2 stroke-3" />
                            )}
                          </div>
                          <span className="ml-1.5">All</span>
                        </label>

                        {supervisors.map((sup) => {
                          const isSelected = supervisorIds.includes(sup.id);
                          return (
                            <label
                              key={sup.id}
                              className={`flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all select-none ${
                                isAdmin
                                  ? "cursor-pointer"
                                  : "opacity-85 pointer-events-none"
                              } ${
                                isSelected
                                  ? "bg-blue-950/40 border-blue-700/60 text-blue-400"
                                  : "bg-theme-card-bg border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={!isAdmin}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSupervisorIds([
                                      ...supervisorIds,
                                      sup.id,
                                    ]);
                                  } else {
                                    setSupervisorIds(
                                      supervisorIds.filter(
                                        (id) => id !== sup.id,
                                      ),
                                    );
                                  }
                                }}
                                className="hidden"
                              />
                              <div
                                className={`h-3 w-3 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                                  isSelected
                                    ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text"
                                    : "border-theme-border-active bg-transparent text-transparent"
                                }`}
                              >
                                {isSelected && (
                                  <Check className="h-2 w-2 stroke-3" />
                                )}
                              </div>
                              <span className="ml-1.5">
                                {sup.username.trim().toUpperCase()}
                              </span>
                            </label>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Office Leave Eligible */}
              <label
                className={`flex items-start gap-2.5 select-none ${isAdmin ? "cursor-pointer group" : "opacity-80 pointer-events-none"}`}
              >
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={eligibleOfficeLeave}
                    disabled={!isAdmin}
                    onChange={(e) => setEligibleOfficeLeave(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      eligibleOfficeLeave
                        ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                        : "border-theme-border-active bg-theme-page-bg text-transparent"
                    }`}
                  >
                    {eligibleOfficeLeave && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors block">
                    Office Leave Eligible?
                  </span>
                  <span className="text-[10px] text-theme-text-muted block leading-tight">
                    Eligible for annual office leaves & Eid holidays.
                  </span>
                </div>
              </label>

              {/* Govt Holiday Eligible */}
              <label
                className={`flex items-start gap-2.5 select-none ${isAdmin ? "cursor-pointer group" : "opacity-80 pointer-events-none"}`}
              >
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={eligibleGovtHoliday}
                    disabled={!isAdmin}
                    onChange={(e) => setEligibleGovtHoliday(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      eligibleGovtHoliday
                        ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                        : "border-theme-border-active bg-theme-page-bg text-transparent"
                    }`}
                  >
                    {eligibleGovtHoliday && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors block">
                    Govt Holiday Eligible?
                  </span>
                  <span className="text-[10px] text-theme-text-muted block leading-tight">
                    Eligible for government list holidays.
                  </span>
                </div>
              </label>

              {/* Overtime Category */}
              <label
                className={`flex items-start gap-2.5 select-none ${isAdmin ? "cursor-pointer group" : "opacity-80 pointer-events-none"}`}
              >
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={allowOvertime}
                    disabled={!isAdmin}
                    onChange={(e) => setAllowOvertime(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      allowOvertime
                        ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                        : "border-theme-border-active bg-theme-page-bg text-transparent"
                    }`}
                  >
                    {allowOvertime && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors block">
                    Overtime Category?
                  </span>
                  <span className="text-[10px] text-theme-text-muted block leading-tight">
                    Allows overtime submission category.
                  </span>
                </div>
              </label>

              {/* Reserve Govt Holiday */}
              <label
                className={`flex items-start gap-2.5 select-none ${isAdmin ? "cursor-pointer group" : "opacity-80 pointer-events-none"}`}
              >
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={allowReserve}
                    disabled={!isAdmin}
                    onChange={(e) => setAllowReserve(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      allowReserve
                        ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                        : "border-theme-border-active bg-theme-page-bg text-transparent"
                    }`}
                  >
                    {allowReserve && <Check className="h-2.5 w-2.5 stroke-3" />}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors block">
                    Reserve Govt Holiday?
                  </span>
                  <span className="text-[10px] text-theme-text-muted block leading-tight">
                    Provides option to reserve government list holidays.
                  </span>
                </div>
              </label>
            </div>
          )}
          {!hasChutiAccess && (
            <p className="text-xs text-theme-text-muted italic py-4 text-center">
              This user does not have access to the Leave Tracker workspace.
            </p>
          )}

          {/* Leave History delegation select box */}
          {delegatedLeaveSupervisorId !== undefined && setDelegatedLeaveSupervisorId && (
            <div className="mt-4 pt-4 border-t border-theme-border-input/40">
              <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5">
                Delegate Leave History To
              </label>
              <select
                value={delegatedLeaveSupervisorId || ""}
                onChange={(e) => setDelegatedLeaveSupervisorId(e.target.value || null)}
                disabled={!(isAdmin || (currentUser && viewingStaff?.supervisor_ids?.includes(currentUser.id)))}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 cursor-pointer disabled:opacity-50"
              >
                <option value="">No Delegation</option>
                {supervisors
                  .filter((s) => s.role === "supervisor" && s.id !== viewingStaff?.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.username}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
        )}

        {/* Quotes Manager Access Card */}
        {showQuotesSettings && (
          <div className="bg-theme-card-bg/40 border border-theme-border-muted p-5 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-theme-border-input/60 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${hasQuotesAccess ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-theme-border-muted"}`}
                />
                <h3 className="text-sm font-bold text-theme-text-primary">
                  Quotes Manager Workspace
                </h3>
              </div>
              {(isAdmin || isSupervisor) && (
                <Toggle
                  checked={hasQuotesAccess}
                  onChange={setHasQuotesAccess}
                  label="Access"
                />
              )}
            </div>

            {hasQuotesAccess ? (
              <div className="space-y-4 animate-fade-in">
                {/* Category Checklist */}
                <CategoryCheckboxList
                  allowedTypes={allowedTypes}
                  onChange={setAllowedTypes}
                  disabled={!isAdmin && !isSupervisor}
                />

                {/* Can Manage Quote Rules (Only Admin edits) */}
                <div className="border-t border-theme-border-muted/70 pt-3">
                  <label
                    className={`flex items-center gap-2.5 select-none ${
                      isAdmin && role !== "admin"
                        ? "cursor-pointer group"
                        : "opacity-70 pointer-events-none"
                    }`}
                  >
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={canManageRules || role === "admin"}
                        disabled={!isAdmin || role === "admin"}
                        onChange={(e) => setCanManageRules(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                          canManageRules || role === "admin"
                            ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                            : "border-theme-border-active bg-theme-page-bg text-transparent"
                        }`}
                      >
                        {(canManageRules || role === "admin") && (
                          <Check className="h-2.5 w-2.5 stroke-3" />
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors">
                      Can Manage Quote Rules?{" "}
                      {role === "admin" && (
                        <span className="text-[10px] text-theme-text-muted font-normal italic ml-1">
                          (Always Allowed for Admin)
                        </span>
                      )}
                    </span>
                  </label>
                  <p className="text-[10px] text-theme-text-muted mt-1 ml-6.5">
                    Allows user to add, edit, or delete compliance rules and view
                    history.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-theme-text-muted italic py-4 text-center">
                This user does not have access to the Quotes Manager workspace.
              </p>
            )}
          </div>
        )}
      </div>

      {/* KPI Settings Panel */}
      {showKpiSettings && (
          <div className="bg-theme-card-bg/40 border border-theme-border-muted p-5 rounded-2xl shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-theme-border-input/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                <h3 className="text-sm font-bold text-theme-text-primary">
                  KPI & Performance Settings
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {/* Department Dropdown */}
              <div>
                <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={department}
                  disabled={!isAdmin && !isSupervisor}
                  onChange={(e) => {
                    const dept = e.target.value;
                    if (setDepartment) setDepartment(dept);
                    if (setPerformsOtherDeptTasks) setPerformsOtherDeptTasks(false);
                    if (setOtherDepartment) {
                      const allDepts = ["Data Entry", "IT", "Accounts", "HR", "Other"];
                      const newOthers = allDepts.filter(d => d !== dept);
                      setOtherDepartment(newOthers[0]);
                    }

                    if (dept === "Data Entry") {
                      if (setPerformsDataEntry) setPerformsDataEntry(true);
                      if (setKpiDeptIndicators) setKpiDeptIndicators([]);
                    } else {
                      if (setPerformsDataEntry) setPerformsDataEntry(false);
                      if (setKpiDeptIndicators) {
                        if (dept === "IT") {
                          setKpiDeptIndicators([
                            "Server Maintenance & Security",
                            "Technical Support & Troubleshooting",
                            "Software & System Updates",
                            "Database & Backup Management"
                          ]);
                        } else if (dept === "Accounts") {
                          setKpiDeptIndicators([
                            "Financial Reporting & Billing",
                            "Expense & Invoice Processing",
                            "Audit Compliance & Accounts Reconciliation"
                          ]);
                        } else if (dept === "HR") {
                          setKpiDeptIndicators([
                            "Employee Recruitment & Onboarding",
                            "Payroll Processing",
                            "Leave & Attendance Tracking",
                            "Policy Enforcement & Conflict Resolution"
                          ]);
                        } else {
                          setKpiDeptIndicators(["Task Efficiency", "Team Collaboration"]);
                        }
                      }
                    }
                  }}
                  className="w-full bg-theme-card-container/80 border border-theme-border-input rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-hidden focus:border-blue-500 transition-colors disabled:opacity-55"
                >
                  <option value="Data Entry" className="bg-theme-card-container">Data Entry</option>
                  <option value="IT" className="bg-theme-card-container">IT</option>
                  <option value="Accounts" className="bg-theme-card-container">Accounts</option>
                  <option value="HR" className="bg-theme-card-container">HR</option>
                  <option value="Other" className="bg-theme-card-container">Other</option>
                </select>
              </div>
            </div>

            {/* 1. Custom Main Department Indicators */}
            {setKpiDeptIndicators && (
              <div className="border-t border-theme-border-muted/60 pt-4 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-theme-text-primary mb-1">
                    Department Specific KPIs ({department})
                  </h4>
                  <p className="text-[10px] text-theme-text-muted">
                    Add specific KPI tasks that this user is evaluated on for their role in the {department} department.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDeptIndicatorText}
                    onChange={(e) => setNewDeptIndicatorText(e.target.value)}
                    placeholder="e.g. Server Maintenance, Tech Support"
                    disabled={!isAdmin && !isSupervisor}
                    className="flex-1 bg-theme-card-container/80 border border-theme-border-input rounded-xl px-3 py-2 text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-hidden focus:border-blue-500 transition-colors disabled:opacity-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = newDeptIndicatorText.trim();
                        if (val && !kpiDeptIndicators.includes(val)) {
                          setKpiDeptIndicators([...kpiDeptIndicators, val]);
                          setNewDeptIndicatorText("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={(!isAdmin && !isSupervisor) || !newDeptIndicatorText.trim()}
                    onClick={() => {
                      const val = newDeptIndicatorText.trim();
                      if (val && !kpiDeptIndicators.includes(val)) {
                        setKpiDeptIndicators([...kpiDeptIndicators, val]);
                        setNewDeptIndicatorText("");
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-theme-border-muted border border-blue-700/30 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {kpiDeptIndicators.length === 0 ? (
                    <span className="text-[11px] text-theme-text-muted italic">No department specific KPIs added.</span>
                  ) : (
                    kpiDeptIndicators.map((indicator) => (
                      <div
                        key={indicator}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/20 border border-blue-900/30 text-blue-300 rounded-lg text-xs font-medium"
                      >
                        <span>{indicator}</span>
                        {(isAdmin || isSupervisor) && (
                          <button
                            type="button"
                            onClick={() => {
                              setKpiDeptIndicators(kpiDeptIndicators.filter((s) => s !== indicator));
                            }}
                            className="text-blue-500 hover:text-red-400 font-bold transition-colors cursor-pointer text-[10px]"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 2. Secondary Department Checkbox & Dropdown */}
            {setPerformsOtherDeptTasks && (
              <div className="border-t border-theme-border-muted/60 pt-4 space-y-4">
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group py-2">
                    <input
                      type="checkbox"
                      checked={performsOtherDeptTasks}
                      disabled={!isAdmin && !isSupervisor}
                      onChange={(e) => {
                        const checked = e.target.checked;

                        // If unchecking, and they had Data Entry enabled, ask for confirmation
                        if (!checked && department !== "Data Entry" && otherDepartment === "Data Entry") {
                          const confirmHide = window.confirm("Disabling Data Entry will hide quotations and file type rows from their KPI sheet. Proceed?");
                          if (!confirmHide) return;
                        }

                        if (setPerformsOtherDeptTasks) setPerformsOtherDeptTasks(checked);

                        if (checked) {
                          const defaultOther = otherDeptOptions[0];
                          if (setOtherDepartment) setOtherDepartment(defaultOther);

                          if (department !== "Data Entry" && defaultOther === "Data Entry") {
                            if (setPerformsDataEntry) setPerformsDataEntry(true);
                          } else {
                            if (setPerformsDataEntry) setPerformsDataEntry(false);
                          }

                          // Pre-populate default indicators for secondary department
                          if (setKpiOtherDeptIndicators) {
                            if (defaultOther === "IT") {
                              setKpiOtherDeptIndicators([
                                "Server Maintenance & Security",
                                "Technical Support & Troubleshooting",
                                "Software & System Updates",
                                "Database & Backup Management"
                              ]);
                            } else if (defaultOther === "Accounts") {
                              setKpiOtherDeptIndicators([
                                "Financial Reporting & Billing",
                                "Expense & Invoice Processing",
                                "Audit Compliance & Accounts Reconciliation"
                              ]);
                            } else if (defaultOther === "HR") {
                              setKpiOtherDeptIndicators([
                                "Employee Recruitment & Onboarding",
                                "Payroll Processing",
                                "Leave & Attendance Tracking",
                                "Policy Enforcement & Conflict Resolution"
                              ]);
                            } else {
                              setKpiOtherDeptIndicators(defaultOther === "Data Entry" ? [] : ["Task Efficiency", "Team Collaboration"]);
                            }
                          }
                        } else {
                          if (setPerformsDataEntry) setPerformsDataEntry(false);
                          if (setKpiOtherDeptIndicators) setKpiOtherDeptIndicators([]);
                        }
                      }}
                      className="sr-only"
                    />
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        performsOtherDeptTasks
                          ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                          : "border-theme-border-active bg-theme-page-bg text-transparent"
                      }`}
                    >
                      {performsOtherDeptTasks && <Check className="h-3.5 w-3.5 stroke-3" />}
                    </div>
                    <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors">
                      Does this user also manage tasks for another department?
                    </span>
                  </label>
                </div>

                {performsOtherDeptTasks && setOtherDepartment && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5">
                        Select Other Department
                      </label>
                      <select
                        value={otherDepartment}
                        disabled={!isAdmin && !isSupervisor}
                        onChange={(e) => {
                          const dept = e.target.value;

                          if (department !== "Data Entry" && otherDepartment === "Data Entry" && dept !== "Data Entry") {
                            const confirmHide = window.confirm("Disabling Data Entry will hide quotations and file type rows from their KPI sheet. Proceed?");
                            if (!confirmHide) return;
                          }

                          if (setOtherDepartment) setOtherDepartment(dept);

                          if (department !== "Data Entry" && dept === "Data Entry") {
                            if (setPerformsDataEntry) setPerformsDataEntry(true);
                          } else {
                            if (setPerformsDataEntry) setPerformsDataEntry(false);
                          }

                          // Pre-populate default indicators for secondary department
                          if (setKpiOtherDeptIndicators) {
                            if (dept === "IT") {
                              setKpiOtherDeptIndicators([
                                "Server Maintenance & Security",
                                "Technical Support & Troubleshooting",
                                "Software & System Updates",
                                "Database & Backup Management"
                              ]);
                            } else if (dept === "Accounts") {
                              setKpiOtherDeptIndicators([
                                "Financial Reporting & Billing",
                                "Expense & Invoice Processing",
                                "Audit Compliance & Accounts Reconciliation"
                              ]);
                            } else if (dept === "HR") {
                              setKpiOtherDeptIndicators([
                                "Employee Recruitment & Onboarding",
                                "Payroll Processing",
                                "Leave & Attendance Tracking",
                                "Policy Enforcement & Conflict Resolution"
                              ]);
                            } else {
                              setKpiOtherDeptIndicators(dept === "Data Entry" ? [] : ["Task Efficiency", "Team Collaboration"]);
                            }
                          }
                        }}
                        className="w-full bg-theme-card-container/80 border border-theme-border-input rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-hidden focus:border-blue-500 transition-colors disabled:opacity-55"
                      >
                        {otherDeptOptions.map((opt) => (
                          <option key={opt} value={opt} className="bg-theme-card-container">
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Other Department Indicators */}
                    {setKpiOtherDeptIndicators && (
                      <div className="border-t border-theme-border-muted/40 pt-4 space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-theme-text-primary mb-1">
                            Department Specific KPIs ({otherDepartment})
                          </h4>
                          <p className="text-[10px] text-theme-text-muted">
                            Add specific KPI tasks that this user is evaluated on for their role in the {otherDepartment} department.
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newOtherDeptIndicatorText}
                            onChange={(e) => setNewOtherDeptIndicatorText(e.target.value)}
                            placeholder="e.g. Server Maintenance, Tech Support"
                            disabled={!isAdmin && !isSupervisor}
                            className="flex-1 bg-theme-card-container/80 border border-theme-border-input rounded-xl px-3 py-2 text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-hidden focus:border-blue-500 transition-colors disabled:opacity-50"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = newOtherDeptIndicatorText.trim();
                                if (val && !kpiOtherDeptIndicators.includes(val)) {
                                  setKpiOtherDeptIndicators([...kpiOtherDeptIndicators, val]);
                                  setNewOtherDeptIndicatorText("");
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            disabled={(!isAdmin && !isSupervisor) || !newOtherDeptIndicatorText.trim()}
                            onClick={() => {
                              const val = newOtherDeptIndicatorText.trim();
                              if (val && !kpiOtherDeptIndicators.includes(val)) {
                                setKpiOtherDeptIndicators([...kpiOtherDeptIndicators, val]);
                                setNewOtherDeptIndicatorText("");
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-theme-border-muted border border-blue-700/30 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                          >
                            Add
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {kpiOtherDeptIndicators.length === 0 ? (
                            <span className="text-[11px] text-theme-text-muted italic">No department specific KPIs added.</span>
                          ) : (
                            kpiOtherDeptIndicators.map((indicator) => (
                              <div
                                key={indicator}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/20 border border-blue-900/30 text-blue-300 rounded-lg text-xs font-medium"
                              >
                                <span>{indicator}</span>
                                {(isAdmin || isSupervisor) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setKpiOtherDeptIndicators(kpiOtherDeptIndicators.filter((s) => s !== indicator));
                                    }}
                                    className="text-blue-500 hover:text-red-400 font-bold transition-colors cursor-pointer text-[10px]"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* KPI Self-Development Skills */}
            <div className="border-t border-theme-border-muted/60 pt-4 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-theme-text-primary mb-1">
                  Self-Development Initiative Skills
                </h4>
                <p className="text-[10px] text-theme-text-muted">
                  Manage skills or training initiatives this employee is working on (e.g. Spoken English, Graphic Design).
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSkillText}
                  onChange={(e) => setNewSkillText(e.target.value)}
                  placeholder="e.g. Video Editing, Digital Marketing, SEO"
                  disabled={!isAdmin && !isSupervisor}
                  className="flex-1 bg-theme-card-container/80 border border-theme-border-input rounded-xl px-3 py-2 text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-hidden focus:border-blue-500 transition-colors disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = newSkillText.trim();
                      if (val && !kpiSkills.includes(val)) {
                        if (setKpiSkills) setKpiSkills([...kpiSkills, val]);
                        setNewSkillText("");
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={(!isAdmin && !isSupervisor) || !newSkillText.trim()}
                  onClick={() => {
                    const val = newSkillText.trim();
                    if (val && !kpiSkills.includes(val)) {
                      if (setKpiSkills) setKpiSkills([...kpiSkills, val]);
                      setNewSkillText("");
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-theme-border-muted border border-blue-700/30 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {kpiSkills.length === 0 ? (
                  <span className="text-[11px] text-theme-text-muted italic">No skills added yet.</span>
                ) : (
                  kpiSkills.map((skill) => (
                    <div
                      key={skill}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/20 border border-blue-900/30 text-blue-300 rounded-lg text-xs font-medium"
                    >
                      <span>{skill}</span>
                      {(isAdmin || isSupervisor) && (
                        <button
                          type="button"
                          onClick={() => {
                             if (setKpiSkills) setKpiSkills(kpiSkills.filter((s) => s !== skill));
                           }}
                          className="text-blue-500 hover:text-red-400 font-bold transition-colors cursor-pointer text-[10px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Previous KPI Evaluations Section */}
            {viewingStaff && previousEvaluations.length > 0 && (
              <div className="border-t border-theme-border-input/80 pt-5 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-theme-text-primary mb-1">
                    Previous KPI Evaluation Reports
                  </h4>
                  <p className="text-[10px] text-theme-text-muted">
                    Review or re-evaluate previously completed performance reports for this employee.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-theme-border-input/80 shadow-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-theme-page-bg/60 border-b border-theme-border-input text-[10px] uppercase tracking-wider text-theme-text-muted">
                        <th className="py-2.5 px-3 font-semibold">Period</th>
                        <th className="py-2.5 px-3 font-semibold">Date Range</th>
                        <th className="py-2.5 px-3 font-semibold">Appraiser</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previousEvaluations.map((evalItem) => {
                        const isCustom = !/^\d{4}-\d{2}$/.test(evalItem.month_year);
                        const label = evalItem.kpis?.customPeriodLabel || evalItem.month_year;

                        let dateRange = '—';
                        if (isCustom && evalItem.kpis?.customPeriodFrom && evalItem.kpis?.customPeriodTo) {
                          dateRange = `${formatDateToDMY(evalItem.kpis.customPeriodFrom)} to ${formatDateToDMY(evalItem.kpis.customPeriodTo)}`;
                        } else if (!isCustom) {
                          const parts = evalItem.month_year.split('-');
                          const y = parts[0];
                          const m = parseInt(parts[1]) - 1;
                          const lastDay = new Date(Number(y), m + 1, 0).getDate();
                          dateRange = `01-${String(m + 1).padStart(2, '0')}-${y} to ${String(lastDay).padStart(2, '0')}-${String(m + 1).padStart(2, '0')}-${y}`;
                        }

                        const isCompleted = evalItem.appraiser_signed || evalItem.appraisee_signed;

                        return (
                          <tr key={evalItem.id} className="border-b border-theme-border-muted hover:bg-theme-card-bg/20 text-theme-text-secondary">
                            <td className="py-2 px-3 font-semibold text-theme-text-primary">{label}</td>
                            <td className="py-2 px-3 text-[11px] font-mono">{dateRange}</td>
                            <td className="py-2 px-3">{evalItem.appraiser_name || '—'}</td>
                            <td className="py-2 px-3 text-center">
                              {isCompleted ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950/30 border border-emerald-900/35 text-emerald-400">
                                  Signed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-955/20 border border-amber-900/30 text-amber-400">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onViewKpiReport) onViewKpiReport(evalItem.month_year);
                                }}
                                className="px-2 py-1 bg-blue-950/30 border border-blue-900/40 hover:bg-blue-900/20 text-blue-400 hover:text-blue-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Re-evaluate
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* KPI delegation select box */}
            {delegatedKpiSupervisorId !== undefined && setDelegatedKpiSupervisorId && (
              <div className="mt-4 pt-4 border-t border-theme-border-input/40">
                <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5">
                  Delegate KPI & Performance To
                </label>
                <select
                  value={delegatedKpiSupervisorId || ""}
                  onChange={(e) => setDelegatedKpiSupervisorId(e.target.value || null)}
                  disabled={!(isAdmin || (currentUser && viewingStaff?.supervisor_ids?.includes(currentUser.id)))}
                  className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 cursor-pointer disabled:opacity-50"
                >
                  <option value="">No Delegation</option>
                  {supervisors
                    .filter((s) => s.role === "supervisor" && s.id !== viewingStaff?.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.username}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        )}
    </div>
  );
};
