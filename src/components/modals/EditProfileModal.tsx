import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, KeyRound, Check } from 'lucide-react';
import { CategoryCheckboxList } from '../CategoryCheckboxList';
import { Profile } from '@/types';

interface EditProfileModalProps {
  username: string;
  fullName: string;
  setFullName: (val: string) => void;
  role: 'admin' | 'user' | 'supervisor';
  setRole: (val: 'admin' | 'user' | 'supervisor') => void;
  hasChutiAccess: boolean;
  setHasChutiAccess: (val: boolean) => void;
  hasQuotesAccess: boolean;
  setHasQuotesAccess: (val: boolean) => void;
  allowedTypes: string[];
  setAllowedTypes: React.Dispatch<React.SetStateAction<string[]>>;
  canManageRules: boolean;
  setCanManageRules: (val: boolean) => void;
  submitting: boolean;
  onClose: () => void;
  onSave: (newPassword?: string) => Promise<void>;
  editorRole: 'admin' | 'supervisor';

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
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  username,
  fullName,
  setFullName,
  role,
  setRole,
  hasChutiAccess,
  setHasChutiAccess,
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
  setAllowReserve
}) => {
  const [resetPassword, setResetPassword] = useState(false);

  // Close on Escape key press
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  // Auto check Quote Rules management for Admin role
  useEffect(() => {
    if (role === 'admin' && !canManageRules) {
      setCanManageRules(true);
    }
  }, [role, canManageRules, setCanManageRules]);

  const isPasswordValid = true;

  const handleUpdate = () => {
    if (resetPassword) {
      onSave('1234');
    } else {
      onSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-modal-backdrop">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto animate-modal-content">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-455 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">
          {editorRole === 'supervisor' ? 'Configure Permissions' : 'Edit Profile'}
        </h3>
        <p className="text-xs text-slate-455 mb-5">
          User: <strong className="text-white">{username.toUpperCase()}</strong>
        </p>

        <div className="space-y-4">
          {editorRole === 'admin' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-355 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Kamrul Islam"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-355 mb-1">Account Role</label>
                <select
                  value={role}
                  onChange={(e) => {
                    const val = e.target.value as 'admin' | 'user' | 'supervisor';
                    setRole(val);
                    if (val === 'admin') {
                      setCanManageRules(true);
                    }
                  }}
                  className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="user">User</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Leave / Quotes Workspace Toggles */}
              <div className="border-t border-slate-800/80 pt-3">
                <label className="block text-[11px] font-semibold text-slate-355 mb-2">Workspace Access</label>
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
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-300 transition-colors">
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
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        hasQuotesAccess
                          ? 'bg-blue-600 border-blue-500 text-white font-bold'
                          : 'border-slate-700 bg-slate-900 text-transparent'
                      }`}>
                        {hasQuotesAccess && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                      Quotes Tracker
                    </span>
                  </label>
                </div>
              </div>
            </>
          ) : null}

          {/* Leave Tracker Permissions (always editable for admin) */}
          {editorRole === 'admin' && (
            <div className="border-t border-slate-800/80 pt-3 space-y-3">
              <label className="block text-[11px] font-semibold text-slate-355">
                Leave Tracker Permissions
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {/* Supervisor Approval */}
                <label className="flex items-start gap-2.5 cursor-pointer group select-none">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={needsSupervisorApproval}
                      onChange={(e) => setNeedsSupervisorApproval(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      needsSupervisorApproval
                        ? 'bg-blue-600 border-blue-500 text-white font-bold'
                        : 'border-slate-700 bg-slate-900 text-transparent'
                    }`}>
                      {needsSupervisorApproval && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                      Supervisor Approval Required?
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Requires supervisor approval for leaves
                    </span>
                  </div>
                </label>

                {/* Supervisors Multiselect */}
                {needsSupervisorApproval && supervisors.length > 0 && (
                  <div className="space-y-2 bg-slate-955/40 p-2.5 rounded-lg border border-slate-800/80 ml-6.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-semibold text-slate-400">Select Supervisors</span>
                      <span className="text-slate-500 font-mono">
                        {supervisorIds.length > 0 ? `${supervisorIds.length} Selected` : 'All Selected'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                      <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer transition-all select-none text-[10px] ${
                        supervisorIds.length === 0 
                          ? 'border-blue-600 bg-blue-955/20 text-blue-400 font-semibold' 
                          : 'border-slate-800 bg-slate-900 text-slate-405'
                      }`}>
                        <input
                          type="checkbox"
                          checked={supervisorIds.length === 0}
                          onChange={() => setSupervisorIds([])}
                          className="cursor-pointer shrink-0 scale-75"
                        />
                        <span>All</span>
                      </label>
                      {supervisors.map(sup => {
                        const isChecked = supervisorIds.includes(sup.id);
                        return (
                          <label 
                            key={sup.id} 
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer transition-all select-none text-[10px] ${
                              isChecked 
                                ? 'border-blue-600 bg-blue-955/20 text-blue-400 font-semibold' 
                                : 'border-slate-800 bg-slate-900 text-slate-405'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSupervisorIds(supervisorIds.filter(id => id !== sup.id));
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
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      eligibleOfficeLeave
                        ? 'bg-blue-600 border-blue-500 text-white font-bold'
                        : 'border-slate-700 bg-slate-900 text-transparent'
                    }`}>
                      {eligibleOfficeLeave && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                      Office Leave Eligible?
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
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
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      eligibleGovtHoliday
                        ? 'bg-blue-600 border-blue-500 text-white font-bold'
                        : 'border-slate-700 bg-slate-900 text-transparent'
                      }`}>
                      {eligibleGovtHoliday && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                      Govt Holiday Eligible?
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
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
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      allowOvertime
                        ? 'bg-blue-600 border-blue-500 text-white font-bold'
                        : 'border-slate-700 bg-slate-900 text-transparent'
                    }`}>
                      {allowOvertime && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                      Overtime Category?
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
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
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      allowReserve
                        ? 'bg-blue-600 border-blue-500 text-white font-bold'
                        : 'border-slate-700 bg-slate-900 text-transparent'
                    }`}>
                      {allowReserve && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                      Reserve Govt Holiday?
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Option to reserve government holidays
                    </span>
                  </div>
                </label>
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

              {editorRole === 'admin' && (
                <div className="border-t border-slate-800/80 pt-3">
                  <label className={`flex items-center gap-2.5 cursor-pointer group select-none ${role === 'admin' ? 'opacity-70 pointer-events-none' : ''}`}>
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={canManageRules}
                        disabled={role === 'admin'}
                        onChange={(e) => setCanManageRules(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        (canManageRules || role === 'admin')
                          ? 'bg-blue-600 border-blue-500 text-white font-bold'
                          : 'border-slate-700 bg-slate-900 text-transparent'
                      }`}>
                        {(canManageRules || role === 'admin') && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                      Can Manage Quote Rules? {role === 'admin' && <span className="text-[10px] text-slate-500 font-normal italic ml-1">(Always Allowed for Admin)</span>}
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-455 mt-1 ml-6.5">
                    Allows the user to add, edit, or delete compliance rules and view archive history.
                  </p>
                </div>
              )}
            </>
          )}

          {editorRole === 'admin' && (
            <div className="border-t border-slate-800/80 pt-3">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={resetPassword}
                    onChange={(e) => setResetPassword(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                    resetPassword
                      ? 'bg-blue-600 border-blue-500 text-white font-bold'
                      : 'border-slate-700 bg-slate-900 text-transparent'
                  }`}>
                    {resetPassword && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors flex items-center gap-1.5">
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
              className="flex-1 py-2 bg-slate-955 border border-slate-800 hover:bg-slate-800/80 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !isPasswordValid}
              onClick={handleUpdate}
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {submitting ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : 'Update'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
