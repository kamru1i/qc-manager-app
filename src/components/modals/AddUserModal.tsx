import React, { useEffect, useCallback } from 'react';
import { X, Loader2, UserPlus, Clipboard, Plus, Check } from 'lucide-react';
import { CategoryCheckboxList } from '../CategoryCheckboxList';
import { Profile } from '@/types';

interface AddUserModalProps {
  newCodename: string;
  setNewCodename: (val: string) => void;
  newFullName: string;
  setNewFullName: (val: string) => void;
  newRole: 'admin' | 'supervisor' | 'user';
  setNewRole: (val: 'admin' | 'supervisor' | 'user') => void;
  hasChutiAccess: boolean;
  setHasChutiAccess: (val: boolean) => void;
  hasQuotesAccess: boolean;
  setHasQuotesAccess: (val: boolean) => void;
  allowedTypes: string[];
  setAllowedTypes: React.Dispatch<React.SetStateAction<string[]>>;
  canManageRules: boolean;
  setCanManageRules: (val: boolean) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  generatedPassword: string | null;
  onClose: () => void;
  onCopyPassword: () => void;

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

export const AddUserModal: React.FC<AddUserModalProps> = ({
  newCodename,
  setNewCodename,
  newFullName,
  setNewFullName,
  newRole,
  setNewRole,
  hasChutiAccess,
  setHasChutiAccess,
  hasQuotesAccess,
  setHasQuotesAccess,
  allowedTypes,
  setAllowedTypes,
  canManageRules,
  setCanManageRules,
  submitting,
  onSubmit,
  generatedPassword,
  onClose,
  onCopyPassword,

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
    if (newRole === 'admin' && !canManageRules) {
      setCanManageRules(true);
    }
  }, [newRole, canManageRules, setCanManageRules]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-455 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-1.5">
          <UserPlus className="h-5 w-5 text-blue-500" />
          Add New User
        </h3>
        <p className="text-xs text-slate-455 mb-5">
          Create a new staff account and configure their workspace permissions.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-355 mb-1">Codename</label>
            <input
              type="text"
              required
              placeholder="e.g. KI1024"
              value={newCodename}
              onChange={(e) => setNewCodename(e.target.value.toUpperCase())}
              className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-355 mb-1">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Kamrul Islam"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-355 mb-1">Account Role</label>
            <select
              value={newRole}
              onChange={(e) => {
                const val = e.target.value as 'user' | 'supervisor' | 'admin';
                setNewRole(val);
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
                  <div className="h-4 w-4 rounded-full flex items-center justify-center border border-orange-500 bg-orange-600 text-white font-bold transition-all shrink-0">
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

          {/* Leave Tracker Permissions */}
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
                      ? 'bg-orange-600 border-orange-500 text-white font-bold'
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

              {/* Supervisors Multiselect (if approval is enabled) */}
              {needsSupervisorApproval && supervisors.length > 0 && (
                <div className="space-y-2 bg-slate-955/40 p-2.5 rounded-lg border border-slate-800/80 ml-6.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-semibold text-slate-400">Select Supervisors</span>
                    <span className="text-slate-500 font-mono">
                      {supervisorIds.length > 0 ? `${supervisorIds.length} Selected` : 'All Selected'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                    <label className={`flex items-center gap-1.5 px-2 py-0.5 rounded border cursor-pointer transition-all select-none text-[10px] ${
                      supervisorIds.length === 0 
                        ? 'border-orange-600 bg-orange-955/20 text-orange-400 font-semibold' 
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}>
                      <input
                        type="checkbox"
                        checked={supervisorIds.length === 0}
                        onChange={() => setSupervisorIds([])}
                        className="sr-only"
                      />
                      <span>All</span>
                    </label>
                    {supervisors.map(sup => {
                      const isChecked = supervisorIds.includes(sup.id);
                      return (
                        <label 
                          key={sup.id} 
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border cursor-pointer transition-all select-none text-[10px] ${
                            isChecked 
                              ? 'border-orange-600 bg-orange-955/20 text-orange-400 font-semibold' 
                              : 'border-slate-800 bg-slate-900 text-slate-400'
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
                            className="sr-only"
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
                      ? 'bg-orange-600 border-orange-500 text-white font-bold'
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
                      ? 'bg-orange-600 border-orange-500 text-white font-bold'
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
                      ? 'bg-orange-600 border-orange-500 text-white font-bold'
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
                      ? 'bg-orange-600 border-orange-500 text-white font-bold'
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

          {hasQuotesAccess && (
            <>
              {/* Reusable categories checklist grid */}
              <CategoryCheckboxList
                allowedTypes={allowedTypes}
                onChange={setAllowedTypes}
              />

              {/* Quote Rules Permission Toggle */}
              <div className="border-t border-slate-800/80 pt-3">
                <label className={`flex items-center gap-2.5 cursor-pointer group select-none ${newRole === 'admin' ? 'opacity-70 pointer-events-none' : ''}`}>
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={canManageRules}
                      disabled={newRole === 'admin'}
                      onChange={(e) => setCanManageRules(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      (canManageRules || newRole === 'admin')
                        ? 'bg-blue-600 border-blue-500 text-white font-bold'
                        : 'border-slate-700 bg-slate-900 text-transparent'
                    }`}>
                      {(canManageRules || newRole === 'admin') && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Can Manage Quote Rules? {newRole === 'admin' && <span className="text-[10px] text-slate-500 font-normal italic ml-1">(Always Allowed for Admin)</span>}
                  </span>
                </label>
                <p className="text-[10px] text-slate-455 mt-1 ml-6.5">
                  Allows the user to add, edit, or delete compliance rules and view archive history.
                </p>
              </div>
            </>
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
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin h-3.5 w-3.5" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> Create User
                </>
              )}
            </button>
          </div>
        </form>

        {/* Temporary Password Display Box */}
        {generatedPassword && (
          <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-xl space-y-2.5 text-xs animate-fade-in mt-4">
            <p className="text-emerald-355 font-semibold">Account created successfully!</p>
            <div className="bg-slate-955 p-2.5 rounded-lg border border-slate-850 font-mono text-center flex items-center justify-between text-white">
              <span>
                Password: <strong>{generatedPassword}</strong>
              </span>
              <button
                onClick={onCopyPassword}
                className="p-1 hover:bg-slate-855 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy"
              >
                <Clipboard className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-450 leading-relaxed text-center">
              * Please copy this password. The user will be required to customize their password on their first login.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
