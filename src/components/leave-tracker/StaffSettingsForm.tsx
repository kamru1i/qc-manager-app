import React from "react";
import { Check } from "lucide-react";
import { Toggle } from "@/components/common/Toggle";
import { CategoryCheckboxList } from "@/components/quotes-tracker/CategoryCheckboxList";
import { Profile } from "@/types";
import { formatTimeToAMPM } from "@/utils/dashboardHelpers";

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
  performsDataEntry = true,
  setPerformsDataEntry,
  department = "Data Entry",
  setDepartment,
}) => {
  const [newSkillText, setNewSkillText] = React.useState("");
  const [newDeptIndicatorText, setNewDeptIndicatorText] = React.useState("");

  return (
    <div className="space-y-6">
      {/* Profile Details Fields */}
      <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {setCodename && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Codename
              </label>
              <input
                type="text"
                required
                placeholder="e.g. KI1024"
                value={codename}
                onChange={(e) => setCodename(e.target.value.toUpperCase())}
                disabled={!isAdmin}
                className="block w-full h-[36px] px-3 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700 text-xs focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Full Name
            </label>
            {isAdmin ? (
              <input
                type="text"
                placeholder="e.g. Kamrul Islam"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full h-[36px] px-3 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700 text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-slate-955/30 border border-slate-850/40 rounded-lg text-slate-300 text-xs font-semibold">
                {fullName || "—"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
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
                className="block w-full h-[36px] px-3 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="user">User</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-slate-955/30 border border-slate-850/40 rounded-lg text-slate-300 text-xs font-semibold capitalize">
                {role || "—"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Job Role
            </label>
            {isAdmin ? (
              <input
                type="text"
                placeholder="e.g. IT Officer"
                value={jobRole}
                onChange={(e) => setJobRole?.(e.target.value)}
                className="block w-full h-[36px] px-3 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700 text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-slate-955/30 border border-slate-850/40 rounded-lg text-slate-300 text-xs font-semibold">
                {jobRole || "—"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Working Hours
            </label>
            {isAdmin ? (
              <select
                value={workingHours}
                onChange={(e) => setWorkingHours?.(e.target.value)}
                className="block w-full h-[36px] px-3 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="7.5">7 Hours 30 Mins</option>
                <option value="8.0">8 Hours</option>
                <option value="8.5">8 Hours 30 Mins</option>
                <option value="9.0">9 Hours</option>
                <option value="9.5">9 Hours 30 Mins</option>
                <option value="10.0">10 Hours</option>
              </select>
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-slate-955/30 border border-slate-850/40 rounded-lg text-slate-300 text-xs font-semibold">
                {workingHours ? `${workingHours} hrs` : "—"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Break (Minutes)
            </label>
            {isAdmin || isSupervisor ? (
              <input
                type="number"
                min="0"
                value={breakTime}
                onChange={(e) => setBreakTime?.(e.target.value)}
                className="block w-full h-[36px] px-3 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-slate-955/30 border border-slate-850/40 rounded-lg text-slate-300 text-xs font-semibold">
                {breakTime !== undefined ? `${breakTime} mins` : "—"}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Sign-In Time
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
                className="block w-full h-[36px] px-3 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-slate-955/30 border border-slate-850/40 rounded-lg text-slate-300 text-xs font-semibold">
                {signInTime ? formatTimeToAMPM(signInTime) : "—"}
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
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
                className="block w-full h-[36px] px-3 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <div className="h-[36px] flex items-center px-3 bg-slate-955/30 border border-slate-850/40 rounded-lg text-slate-300 text-xs font-semibold">
                {signOutTime ? formatTimeToAMPM(signOutTime) : "—"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workspace Access & Permissions Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave Tracker Access Card */}
        <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${hasChutiAccess ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-slate-600"}`}
              />
              <h3 className="text-sm font-bold text-white">
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
            <div className="space-y-4 text-xs text-slate-350 animate-fade-in">
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
                        ? "bg-blue-600 border-blue-500 text-white font-bold"
                        : "border-slate-700 bg-slate-955 text-transparent"
                    }`}
                  >
                    {needsApproval && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                    Supervisor Approval Required?
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    Requires approval from a supervisor for any leave
                    submissions.
                  </span>
                </div>
              </label>

              {/* Conditional Supervisor Multi-Select Checkboxes */}
              {needsApproval && (
                <div className="pl-6.5 space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-semibold text-slate-450">
                      Select Supervisors
                    </label>
                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-950/60 border border-slate-850 px-2 py-0.5 rounded-full">
                      {supervisorIds.length} Selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-950/60 border border-slate-850 rounded-xl max-h-40 overflow-y-auto">
                    {supervisors.length === 0 ? (
                      <span className="text-[10px] text-slate-500 italic">
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
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
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
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "border-slate-700 bg-transparent text-transparent"
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
                                  ? "bg-blue-950/40 border-blue-750/70 text-blue-400"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
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
                                    ? "bg-blue-600 border-blue-500 text-white"
                                    : "border-slate-700 bg-transparent text-transparent"
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
                        ? "bg-blue-600 border-blue-500 text-white font-bold"
                        : "border-slate-700 bg-slate-955 text-transparent"
                    }`}
                  >
                    {eligibleOfficeLeave && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                    Office Leave Eligible?
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-tight">
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
                        ? "bg-blue-600 border-blue-500 text-white font-bold"
                        : "border-slate-700 bg-slate-955 text-transparent"
                    }`}
                  >
                    {eligibleGovtHoliday && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                    Govt Holiday Eligible?
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-tight">
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
                        ? "bg-blue-600 border-blue-500 text-white font-bold"
                        : "border-slate-700 bg-slate-955 text-transparent"
                    }`}
                  >
                    {allowOvertime && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                    Overtime Category?
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-tight">
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
                        ? "bg-blue-600 border-blue-500 text-white font-bold"
                        : "border-slate-700 bg-slate-955 text-transparent"
                    }`}
                  >
                    {allowReserve && <Check className="h-2.5 w-2.5 stroke-3" />}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                    Reserve Govt Holiday?
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    Provides option to reserve government list holidays.
                  </span>
                </div>
              </label>
            </div>
          )}
          {!hasChutiAccess && (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              This user does not have access to the Leave Tracker workspace.
            </p>
          )}
        </div>

        {/* Quotes Manager Access Card */}
        <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${hasQuotesAccess ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-slate-600"}`}
              />
              <h3 className="text-sm font-bold text-white">
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
              <div className="border-t border-slate-850/70 pt-3">
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
                          ? "bg-blue-600 border-blue-500 text-white font-bold"
                          : "border-slate-700 bg-slate-955 text-transparent"
                      }`}
                    >
                      {(canManageRules || role === "admin") && (
                        <Check className="h-2.5 w-2.5 stroke-3" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Can Manage Quote Rules?{" "}
                    {role === "admin" && (
                      <span className="text-[10px] text-slate-500 font-normal italic ml-1">
                        (Always Allowed for Admin)
                      </span>
                    )}
                  </span>
                </label>
                <p className="text-[10px] text-slate-500 mt-1 ml-6.5">
                  Allows user to add, edit, or delete compliance rules and view
                  history.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              This user does not have access to the Quotes Manager workspace.
            </p>
          )}
        </div>

        {/* KPI Settings Panel */}
        {setKpiSkills && (
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                <h3 className="text-sm font-bold text-white">
                  KPI & Performance Settings
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {/* Department Dropdown */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={department}
                  disabled={!isAdmin && !isSupervisor}
                  onChange={(e) => {
                    const dept = e.target.value;
                    if (setDepartment) setDepartment(dept);
                  }}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500 transition-colors disabled:opacity-55"
                >
                  <option value="Data Entry" className="bg-slate-950">Data Entry</option>
                  <option value="IT" className="bg-slate-950">IT</option>
                  <option value="Accounts" className="bg-slate-950">Accounts</option>
                  <option value="HR" className="bg-slate-950">HR</option>
                  <option value="Other" className="bg-slate-950">Other</option>
                </select>
              </div>

              {/* Perform Data Entry Tasks checkbox */}
              {department !== "Data Entry" && setPerformsDataEntry && (
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group py-2">
                    <input
                      type="checkbox"
                      checked={performsDataEntry}
                      disabled={!isAdmin && !isSupervisor}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (!checked) {
                          const confirmHide = window.confirm("Disabling Data Entry will hide quotations and file type rows from their KPI sheet. Proceed?");
                          if (!confirmHide) return;
                        }
                        setPerformsDataEntry(checked);
                      }}
                      className="sr-only"
                    />
                    <div
                      className={`h-5 w-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                        performsDataEntry
                          ? "bg-blue-600 border-blue-500 text-white font-bold"
                          : "border-slate-700 bg-slate-955 text-transparent"
                      }`}
                    >
                      {performsDataEntry && <Check className="h-3.5 w-3.5 stroke-3" />}
                    </div>
                    <span className="text-xs font-semibold text-slate-350 group-hover:text-white transition-colors">
                      Does this user also perform Data Entry tasks?
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Custom Department Indicators */}
            {department !== "Data Entry" && setKpiDeptIndicators && (
              <div className="border-t border-slate-850/60 pt-4 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-white mb-1">
                    Department Specific KPIs ({department})
                  </h4>
                  <p className="text-[10px] text-slate-500">
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
                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 transition-colors disabled:opacity-50"
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
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-850 border border-blue-700/30 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {kpiDeptIndicators.length === 0 ? (
                    <span className="text-[11px] text-slate-500 italic">No department specific KPIs added.</span>
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

            {/* KPI Self-Development Skills */}
            <div className="border-t border-slate-850/60 pt-4 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-white mb-1">
                  Self-Development Initiative Skills
                </h4>
                <p className="text-[10px] text-slate-500">
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
                  className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-hidden focus:border-blue-500 transition-colors disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = newSkillText.trim();
                      if (val && !kpiSkills.includes(val)) {
                        setKpiSkills([...kpiSkills, val]);
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
                      setKpiSkills([...kpiSkills, val]);
                      setNewSkillText("");
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-850 border border-blue-700/30 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {kpiSkills.length === 0 ? (
                  <span className="text-[11px] text-slate-500 italic">No skills added yet.</span>
                ) : (
                  kpiSkills.map((skill) => (
                    <div
                      key={skill}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-850/80 border border-slate-750 text-slate-350 rounded-lg text-xs font-medium"
                    >
                      <span>{skill}</span>
                      {(isAdmin || isSupervisor) && (
                        <button
                          type="button"
                          onClick={() => {
                            setKpiSkills(kpiSkills.filter((s) => s !== skill));
                          }}
                          className="text-slate-500 hover:text-red-400 font-bold transition-colors cursor-pointer text-[10px]"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
