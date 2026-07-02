import React, { useEffect, useCallback } from 'react';
import { X, Loader2, UserPlus, Clipboard, Plus, Check } from 'lucide-react';
import { CategoryCheckboxList } from '../CategoryCheckboxList';

interface AddUserModalProps {
  newCodename: string;
  setNewCodename: (val: string) => void;
  newFullName: string;
  setNewFullName: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
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
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  newCodename,
  setNewCodename,
  newFullName,
  setNewFullName,
  newPassword,
  setNewPassword,
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
  onCopyPassword
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
            <label className="block text-[11px] font-semibold text-slate-355 mb-1">Password</label>
            <input
              type="text"
              required
              placeholder="Default Password: 1234"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              <option value="user">User (Staff)</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Leave / Quotes Workspace Toggles */}
          <div className="border-t border-slate-800/80 pt-3">
            <label className="block text-[11px] font-semibold text-slate-355 mb-2">Workspace Access</label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={hasChutiAccess}
                    onChange={(e) => setHasChutiAccess(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                    hasChutiAccess
                      ? 'bg-orange-600 border-orange-500 text-white font-bold'
                      : 'border-slate-700 bg-slate-900 text-transparent'
                  }`}>
                    {hasChutiAccess && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
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
                  <div className={`h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0 ${
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
