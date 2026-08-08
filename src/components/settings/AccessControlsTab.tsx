
import React, { memo } from 'react';
import { Shield, Save, Eye, RefreshCw } from 'lucide-react';
import { MENU_TABS, CONFIGURABLE_ROLES, getDefaultRoleVisibility } from '@/utils/menuTabsRegistry';
import { FEATURE_FLAGS } from '@/utils/featureFlagsRegistry';
import { TempAccessEntry } from '@/utils/dashboardHelpers';
import { DateTimeInput } from '@/components/common/DateTimeInput';


function formatCustomDateTime(dateInput: string | Date): string {
  if (!dateInput) return 'Invalid Date';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Invalid Date';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const strHours = String(hours).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} (${strHours}:${mins} ${ampm})`;
}

interface AccessControlsTabProps {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  roleVisibility: Record<string, Record<string, boolean>>;
  activeRoleVisKey: string | null;
  handleToggleRoleVisibility: (role: string, tabKey: string, newValue: boolean) => void;
  supervisorAccessOverrides: Record<string, Record<string, boolean>>;
  selectedSupervisorId: string;
  setSelectedSupervisorId: (val: string) => void;
  handleToggleSupervisorOverride: (supervisorId: string, tabKey: string, currentValue: boolean) => void;
  profilesList: any[];
  tempAccess: TempAccessEntry[];
  tempForm: any;
  setTempForm: (val: any) => void;
  handleAddTempAccess: () => void;
  handleRemoveTempAccess: (entry: TempAccessEntry) => void;
  tempSubmitting: boolean;
  currentTimestamp: number;
  handleSaveTempAccess: (nextEntries?: any) => void;
  hasChanges: boolean;
  submitting: boolean;
}

export const AccessControlsTab = memo(function AccessControlsTab({
  isSuperAdmin,
  isAdmin,
  roleVisibility,
  activeRoleVisKey,
  handleToggleRoleVisibility,
  supervisorAccessOverrides,
  selectedSupervisorId,
  setSelectedSupervisorId,
  handleToggleSupervisorOverride,
  profilesList,
  tempAccess,
  tempForm,
  setTempForm,
  handleAddTempAccess,
  handleRemoveTempAccess,
  tempSubmitting,
  currentTimestamp,
  handleSaveTempAccess,
  hasChanges,
  submitting
}: AccessControlsTabProps) {
  const supervisors = profilesList.filter((p) => p.role === 'supervisor');
  const visibleTabsForRoleConfig = MENU_TABS.filter((t) => !['settings'].includes(t.key));

  return (
    <div className="space-y-6 w-full font-sans">
          {isSuperAdmin && (
            <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-theme-border-input/40">
                <Shield className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider">
                    Global Tab Access (Per-Role Configuration)
                  </h3>
                  <p className="text-[11px] text-theme-text-muted mt-0.5">
                    Configure which functional tabs are accessible to each role globally. Overrides default visibility.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto pb-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-theme-border-input/40">
                      <th className="py-2.5 px-3 font-semibold text-theme-text-muted uppercase tracking-wider">Tab / Feature</th>
                      {CONFIGURABLE_ROLES.map((role) => (
                        <th key={role} className="py-2.5 px-3 font-semibold text-theme-text-muted capitalize tracking-wider text-center border-l border-theme-border-input/40 w-[120px]">
                          {role}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border-input/30">
                    {visibleTabsForRoleConfig.map((tab) => (
                      <tr key={tab.key} className="hover:bg-theme-page-bg/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-theme-text-secondary flex flex-col gap-0.5">
                          <span className="flex items-center gap-2">
                            {tab.label}
                          </span>
                        </td>
                        {CONFIGURABLE_ROLES.map((role) => {
                          const customVal = roleVisibility[role]?.[tab.key];
                          const isActive = typeof customVal === 'boolean' ? customVal : getDefaultRoleVisibility(role, tab.key);
                          const pendingKey = `${role}-${tab.key}`;
                          const isPending = activeRoleVisKey === pendingKey;

                          return (
                            <td key={role} className="py-2.5 px-3 text-center border-l border-theme-border-input/40 align-middle">
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleToggleRoleVisibility(role, tab.key, !isActive)}
                                title={isActive ? 'Enabled — Click to Disable' : 'Disabled — Click to Enable'}
                                className={`w-[60px] mx-auto py-1.5 rounded-[10px] text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center ${
                                  isActive
                                    ? 'bg-blue-600 border border-blue-500 text-white shadow-sm hover:bg-blue-500'
                                    : 'bg-theme-border-muted/50 border border-theme-border-input/60 text-theme-text-muted hover:bg-theme-border-input/80'
                                } ${isPending ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
                              >
                                {isActive ? 'On' : 'Off'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-border-input/40 pb-3">
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider">
                      Supervisor Access Overrides
                    </h3>
                    <p className="text-[11px] text-theme-text-muted mt-0.5">
                      Grant specific supervisors access to tabs that are normally restricted.
                    </p>
                  </div>
                </div>
                
                <div className="w-full sm:w-auto">
                  <select
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    className="w-full sm:w-64 h-9 px-3 bg-theme-page-bg/80 border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-primary focus:outline-none focus:border-amber-500/50 shadow-sm transition-all"
                  >
                    <option value="">-- Select a Supervisor --</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name ? `${s.full_name} (${s.codename || s.username})` : (s.codename || s.username)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedSupervisorId ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {visibleTabsForRoleConfig.map((tab) => {
                    const isGloballyAllowed = (() => {
                      const customVal = roleVisibility['supervisor']?.[tab.key];
                      if (typeof customVal === 'boolean') return customVal;
                      return getDefaultRoleVisibility('supervisor', tab.key);
                    })();
                    
                    if (isGloballyAllowed) return null;

                    const hasOverride = !!supervisorAccessOverrides[selectedSupervisorId]?.[tab.key];

                    return (
                      <label 
                        key={tab.key}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          hasOverride 
                            ? 'bg-amber-500/10 border-amber-500/30' 
                            : 'bg-theme-page-bg/40 border-theme-border-input/60 hover:border-theme-border-input'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${hasOverride ? 'text-amber-400' : 'text-theme-text-secondary'}`}>
                            {tab.label}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={hasOverride}
                          onChange={() => handleToggleSupervisorOverride(selectedSupervisorId, tab.key, hasOverride)}
                          className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500/30"
                        />
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-[11px] text-theme-text-muted italic bg-theme-page-bg/20 rounded-xl border border-dashed border-theme-border-input/40">
                  Select a supervisor from the dropdown to manage their access overrides.
                </div>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-theme-border-input/40">
                <RefreshCw className="h-5 w-5 text-fuchsia-400" />
                <div>
                  <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider">
                    Temporary Access Manager
                  </h3>
                  <p className="text-[11px] text-theme-text-muted mt-0.5">
                    Schedule temporary tab or feature-flag grants/revocations for a role or specific user. Evaluated strictly at runtime.
                  </p>
                </div>
              </div>

              <div className="bg-theme-page-bg/30 p-4 rounded-xl border border-theme-border-input/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-10 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Target Type</label>
                    <select
                      value={tempForm.target_type}
                      onChange={(e) => setTempForm((f: any) => ({ ...f, target_type: e.target.value as 'role' | 'user' }))}
                      className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-primary capitalize focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="role">Target Role</option>
                      <option value="user">Target User</option>
                    </select>
                  </div>

                  {tempForm.target_type === 'role' ? (
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Select Role</label>
                      <select
                        value={tempForm.role}
                        onChange={(e) => setTempForm((f: any) => ({ ...f, role: e.target.value }))}
                        className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary capitalize focus:outline-none focus:border-blue-500/50"
                      >
                        {CONFIGURABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Select User (Codename)</label>
                      <select
                        value={tempForm.user_id}
                        onChange={(e) => {
                          const targetId = e.target.value;
                          const u = profilesList.find((p) => p.id === targetId);
                          setTempForm((f: any) => ({
                            ...f,
                            user_id: targetId,
                            user_codename: u ? (u.codename || u.full_name || u.username) : '',
                            role: u?.role || 'user',
                          }));
                        }}
                        className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:border-blue-500/50"
                      >
                        <option value="">-- Choose User --</option>
                        {profilesList.map((p) => {
                          const codename = p.codename || p.username || 'User';
                          const label = p.full_name ? `${codename} (${p.full_name})` : codename;
                          return (
                            <option key={p.id} value={p.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  <div className="sm:col-span-3">
                    <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Tab / Feature</label>
                    <select
                      value={tempForm.tabKey}
                      onChange={(e) => setTempForm((f: any) => ({ ...f, tabKey: e.target.value }))}
                      className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:border-blue-500/50"
                    >
                      <optgroup label="Navigation Tabs">
                        {MENU_TABS.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Feature Flags & Operational Tools">
                        {FEATURE_FLAGS.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Action</label>
                    <select
                      value={tempForm.action}
                      onChange={(e) => setTempForm((f: any) => ({ ...f, action: e.target.value as 'grant' | 'revoke' }))}
                      className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary capitalize focus:outline-none focus:border-blue-500/50 font-semibold"
                    >
                      <option value="revoke">Revoke (Turn OFF / Block)</option>
                      <option value="grant">Grant (Turn ON / Access)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Until Expiration Date & Time</label>
                    <DateTimeInput
                      value={tempForm.expires_at}
                      onChange={(val) => setTempForm((f: any) => ({ ...f, expires_at: val }))}
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Comment / Reason (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Audit requirement, temp project access"
                      value={tempForm.comment || ""}
                      onChange={(e) => setTempForm((f: any) => ({ ...f, comment: e.target.value }))}
                      className="w-full h-9 px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary placeholder-theme-text-muted/50 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddTempAccess}
                      disabled={tempSubmitting}
                      className="w-full h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 transition-all shadow-md"
                    >
                      Add Rule
                    </button>
                  </div>
                </div>
              </div>

              {tempAccess.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {tempAccess.map((entry, i) => {
                    const expired = new Date(entry.expires_at).getTime() <= currentTimestamp;
                    const tabLabel = MENU_TABS.find((t) => t.key === entry.tabKey)?.label
                      || FEATURE_FLAGS.find((f) => f.key === entry.tabKey)?.label
                      || entry.tabKey;
                    return (
                      <div
                        key={`${entry.role}-${entry.tabKey}-${entry.expires_at}-${i}`}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border text-[11px] ${
                          expired
                            ? 'border-theme-border-muted/50 bg-theme-page-bg/20 text-theme-text-muted/60'
                            : 'border-theme-border-input/60 bg-theme-page-bg/40 text-theme-text-secondary'
                        }`}
                      >
                        <span>
                          <strong className="capitalize">{entry.action}</strong> “{tabLabel}” for{' '}
                          {entry.target_type === 'user' ? (
                            <span>
                              user <strong className="text-blue-400 font-bold">{entry.user_codename || 'User'}</strong>
                            </span>
                          ) : (
                            <span>
                              role <strong className="capitalize">{entry.role}</strong>
                            </span>
                          )}{' '}
                          until {formatCustomDateTime(entry.expires_at)}
                          {entry.comment && (
                            <span className="ml-2 font-medium text-amber-300">
                              — "{entry.comment}"
                            </span>
                          )}
                          {expired && <span className="ml-2 italic text-red-400">(expired)</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTempAccess(entry)}
                          disabled={tempSubmitting}
                          className="text-theme-text-muted hover:text-rose-400 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-theme-text-muted/70 italic">No temporary overrides active.</p>
              )}

              <div className="pt-4 border-t border-theme-border-input/40 flex justify-end">
                <button
                  type="button"
                  disabled={tempSubmitting}
                  onClick={handleSaveTempAccess}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 font-sans shadow-md"
                >
                  {tempSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Rules to Server
                </button>
              </div>
            </div>
          )}
    </div>
  );
});
