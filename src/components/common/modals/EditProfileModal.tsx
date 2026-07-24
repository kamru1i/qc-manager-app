import React, { useState, useEffect, useCallback } from "react";
import { X, Loader2, KeyRound, Check } from "lucide-react";
import { CategoryCheckboxList } from "@/components/quotes-tracker/CategoryCheckboxList";
import { Profile } from "@/types";
import { FEATURE_FLAGS } from "@/utils/featureFlagsRegistry";

interface EditProfileModalProps {
  username: string;
  fullName: string;
  setFullName: (val: string) => void;
  role: "admin" | "user" | "supervisor";
  setRole: (val: "admin" | "user" | "supervisor") => void;
  hasQuotesAccess: boolean;
  setHasQuotesAccess: (val: boolean) => void;
  allowedTypes: string[];
  setAllowedTypes: React.Dispatch<React.SetStateAction<string[]>>;
  canManageRules: boolean;
  setCanManageRules: (val: boolean) => void;
  submitting: boolean;
  onClose: () => void;
  onSave: (newPassword?: string) => Promise<void>;
  editorRole: "admin" | "supervisor";

  // Leave Tracker Permissions Settings
  supervisors: Profile[];
  needsSupervisorApproval: boolean;
  setNeedsSupervisorApproval: (val: boolean) => void;
  supervisorIds: string[];
  setSupervisorIds: (ids: string[]) => void;
  eligibleGovtHoliday: boolean;
  setEligibleGovtHoliday: (val: boolean) => void;
  eligibleOfficeLeave: boolean;
  setEligibleOfficeLeave: (val: boolean) => void;
  allowOvertime: boolean;
  setAllowOvertime: (val: boolean) => void;
  allowReserve: boolean;
  setAllowReserve: (val: boolean) => void;

  // Feature flag overrides
  userFeatureFlags?: Record<string, boolean>;
  setUserFeatureFlags?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  adminDelegatedFlags?: Record<string, boolean>;
  isSuperAdmin?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  username,
  fullName,
  setFullName,
  role,
  setRole,
  hasQuotesAccess,
  setHasQuotesAccess,
  allowedTypes,
  setAllowedTypes,
  canManageRules,
  setCanManageRules,
  submitting,
  onClose,
  onSave,
  editorRole,

  supervisors,
  needsSupervisorApproval,
  setNeedsSupervisorApproval,
  supervisorIds,
  setSupervisorIds,
  eligibleGovtHoliday,
  setEligibleGovtHoliday,
  eligibleOfficeLeave,
  setEligibleOfficeLeave,
  allowOvertime,
  setAllowOvertime,
  allowReserve,
  setAllowReserve,
  userFeatureFlags,
  setUserFeatureFlags,
  adminDelegatedFlags,
  isSuperAdmin,
}) => {
  const [resetPassword, setResetPassword] = useState(false);

  // Close on Escape key press
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  // Auto check Quote Rules management for Admin role
  useEffect(() => {
    if (role === "admin" && !canManageRules) {
      setCanManageRules(true);
    }
  }, [role, canManageRules, setCanManageRules]);

  const isPasswordValid = true;

  const handleUpdate = () => {
    if (resetPassword) {
      onSave("1234");
    } else {
      onSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-modal-backdrop">
      <div className="bg-theme-card-bg border border-theme-border-input p-6 rounded-2xl w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto animate-modal-content">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-theme-text-primary mb-1">
          {editorRole === "supervisor"
            ? "Configure Permissions"
            : "Edit Profile"}
        </h3>
        <p className="text-xs text-theme-text-muted mb-5">
          User: <strong className="text-theme-text-primary">{username.toUpperCase()}</strong>
        </p>

        <div className="space-y-4">
          {editorRole === "admin" ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kamrul Islam"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                  Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    const val = e.target.value as
                      | "admin"
                      | "user"
                      | "supervisor";
                    setRole(val);
                    if (val === "admin") {
                      setCanManageRules(true);
                    }
                  }}
                  className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="user">User</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Leave / Quotes Workspace Toggles */}
              <div className="border-t border-theme-border-input/80 pt-3">
                <label className="block text-[11px] font-semibold text-theme-text-secondary mb-2">
                  Workspace Access
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2.5 cursor-not-allowed group select-none opacity-80">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="sr-only"
                      />
                      <div className="h-4 w-4 rounded-full flex items-center justify-center border border-blue-500 bg-blue-600 text-white font-bold transition-all shrink-0">
                        <Check className="h-2.5 w-2.5 stroke-3" />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-theme-text-secondary transition-colors">
                      Leave Tracker
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={hasQuotesAccess}
                        onChange={(e) => setHasQuotesAccess(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                          hasQuotesAccess
                            ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                            : "border-theme-border-active bg-theme-card-bg text-transparent"
                        }`}
                      >
                        {hasQuotesAccess && (
                          <Check className="h-2.5 w-2.5 stroke-3" />
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors">
                      Quotes Tracker
                    </span>
                  </label>
                </div>
              </div>
            </>
          ) : null}

          {/* Leave Tracker Permissions (always editable for admin) */}
          {editorRole === "admin" && (
            <div className="border-t border-theme-border-input/80 pt-3 space-y-3">
              <label className="block text-[11px] font-semibold text-theme-text-secondary">
                Leave Tracker Permissions
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {/* Supervisor Approval */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={needsSupervisorApproval}
                      onChange={(e) =>
                        setNeedsSupervisorApproval(e.target.checked)
                      }
                      className="sr-only"
                    />
                    <div
                      className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        needsSupervisorApproval
                          ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                          : "border-theme-border-active bg-theme-card-bg text-transparent"
                      }`}
                    >
                      {needsSupervisorApproval && (
                        <Check className="h-2.5 w-2.5 stroke-3" />
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors block">
                      Supervisor Approval Required?
                    </span>
                    <span className="text-[10px] text-theme-text-muted block leading-tight">
                      Requires supervisor approval for leaves
                    </span>
                  </div>
                </label>

                {/* Supervisors Multiselect */}
                {needsSupervisorApproval && supervisors.length > 0 && (
                  <div className="space-y-2 bg-theme-page-bg/40 p-2.5 rounded-lg border border-theme-border-input/80 ml-6.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-semibold text-theme-text-muted">
                        Select Supervisors
                      </span>
                      <span className="text-theme-text-muted font-mono">
                        {supervisorIds.length > 0
                          ? `${supervisorIds.length} Selected`
                          : "All Selected"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                      <label
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer transition-all select-none text-[10px] ${
                          supervisorIds.length === 0
                            ? "border-blue-600 bg-blue-955/20 text-blue-400 font-semibold"
                            : "border-theme-border-input bg-theme-card-bg text-theme-text-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={supervisorIds.length === 0}
                          onChange={() => setSupervisorIds([])}
                          className="cursor-pointer shrink-0 scale-75"
                        />
                        <span>All</span>
                      </label>
                      {supervisors.map((sup) => {
                        const isChecked = supervisorIds.includes(sup.id);
                        return (
                          <label
                            key={sup.id}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer transition-all select-none text-[10px] ${
                              isChecked
                                ? "border-blue-600 bg-blue-955/20 text-blue-400 font-semibold"
                                : "border-theme-border-input bg-theme-card-bg text-theme-text-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSupervisorIds(
                                    supervisorIds.filter((id) => id !== sup.id),
                                  );
                                } else {
                                  setSupervisorIds([...supervisorIds, sup.id]);
                                }
                              }}
                              className="cursor-pointer shrink-0 scale-75"
                            />
                            <span>{sup.username}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Office Leave Eligible */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={eligibleOfficeLeave}
                      onChange={(e) => setEligibleOfficeLeave(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        eligibleOfficeLeave
                          ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                          : "border-theme-border-active bg-theme-card-bg text-transparent"
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
                      Eligible for annual office leaves & Eid holidays
                    </span>
                  </div>
                </label>

                {/* Govt Holiday Eligible */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={eligibleGovtHoliday}
                      onChange={(e) => setEligibleGovtHoliday(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        eligibleGovtHoliday
                          ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                          : "border-theme-border-active bg-theme-card-bg text-transparent"
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
                      Eligible for government list holidays
                    </span>
                  </div>
                </label>

                {/* Overtime Category */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={allowOvertime}
                      onChange={(e) => setAllowOvertime(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        allowOvertime
                          ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                          : "border-theme-border-active bg-theme-card-bg text-transparent"
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
                      Allows overtime leave category
                    </span>
                  </div>
                </label>

                {/* Reserve Govt Holiday */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={allowReserve}
                      onChange={(e) => setAllowReserve(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        allowReserve
                          ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                          : "border-theme-border-active bg-theme-card-bg text-transparent"
                      }`}
                    >
                      {allowReserve && (
                        <Check className="h-2.5 w-2.5 stroke-3" />
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors block">
                      Reserve Govt Holiday?
                    </span>
                    <span className="text-[10px] text-theme-text-muted block leading-tight">
                      Option to reserve government holidays
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* User Feature Flags Overrides */}
          {setUserFeatureFlags && (isSuperAdmin || Object.values(adminDelegatedFlags || {}).some(Boolean)) && (
            <div className="border-t border-theme-border-input/80 pt-3 space-y-2">
              <label className="block text-[11px] font-semibold text-theme-text-secondary">
                Per-User Feature Flag Overrides
              </label>
              <p className="text-[10px] text-theme-text-muted">
                Override operational feature flags specifically for this user.
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {FEATURE_FLAGS.filter(f => isSuperAdmin || adminDelegatedFlags?.[f.key] === true).map(flag => {
                  const val = userFeatureFlags?.[flag.key];
                  return (
                    <div key={flag.key} className="flex items-center justify-between p-2 rounded-lg bg-theme-page-bg/40 border border-theme-border-input/60 gap-2">
                      <span className="text-xs font-medium text-theme-text-secondary truncate" title={flag.description}>
                        {flag.label}
                      </span>
                      <select
                        value={typeof val === 'boolean' ? (val ? 'on' : 'off') : 'default'}
                        onChange={(e) => {
                          const nxt = { ...(userFeatureFlags || {}) };
                          if (e.target.value === 'default') {
                            delete nxt[flag.key];
                          } else {
                            nxt[flag.key] = e.target.value === 'on';
                          }
                          setUserFeatureFlags(nxt);
                        }}
                        className="text-[10px] font-semibold rounded bg-theme-card-bg border border-theme-border-input px-2 py-1 text-theme-text-primary shrink-0"
                      >
                        <option value="default">Default</option>
                        <option value="on">Enable (ON)</option>
                        <option value="off">Disable (OFF)</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasQuotesAccess && (
            <>
              {/* Reusable categories checklist grid */}
              <CategoryCheckboxList
                allowedTypes={allowedTypes}
                onChange={setAllowedTypes}
              />

              {editorRole === "admin" && (
                <div className="border-t border-theme-border-input/80 pt-3">
                  <label
                    className={`flex items-center gap-2.5 cursor-pointer group select-none ${role === "admin" ? "opacity-70 pointer-events-none" : ""}`}
                  >
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={canManageRules}
                        disabled={role === "admin"}
                        onChange={(e) => setCanManageRules(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                          canManageRules || role === "admin"
                            ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                            : "border-theme-border-active bg-theme-card-bg text-transparent"
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
                    Allows the user to add, edit, or delete compliance rules and
                    view archive history.
                  </p>
                </div>
              )}
            </>
          )}

          {editorRole === "admin" && (
            <div className="border-t border-theme-border-input/80 pt-3">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={resetPassword}
                    onChange={(e) => setResetPassword(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      resetPassword
                        ? "bg-theme-accent-bg border-theme-accent-border text-theme-accent-text font-bold"
                        : "border-theme-border-active bg-theme-card-bg text-transparent"
                    }`}
                  >
                    {resetPassword && (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold text-theme-text-secondary group-hover:text-theme-text-primary transition-colors flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-blue-500" />
                  Reset Password to 1234?
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-theme-page-bg border border-theme-border-input hover:bg-theme-border-input/80 text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !isPasswordValid}
              onClick={handleUpdate}
              className="flex-1 py-2.5 bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-theme-card-container"
            >
              {submitting ? (
                <Loader2 className="animate-spin h-3.5 w-3.5" />
              ) : (
                "Update"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
