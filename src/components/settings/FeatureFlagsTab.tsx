
import React, { memo } from 'react';
import { Settings } from 'lucide-react';
import { FEATURE_FLAGS, getDefaultFeatureFlagState, FLAG_TO_TAB_KEY } from '@/utils/featureFlagsRegistry';
import { CONFIGURABLE_ROLES, getDefaultRoleVisibility } from '@/utils/menuTabsRegistry';

interface FeatureFlagsTabProps {
  featureFlags: Record<string, boolean>;
  effectiveAdminDelegatedFlags: Record<string, boolean>;
  roleVisibility: Record<string, Record<string, boolean>>;
  activeFlagKey: string | null;
  isSuperAdmin: boolean;
  handleToggleFeatureFlag: (flagKey: string, newValue: boolean) => void;
  handleToggleAdminDelegation: (flagKey: string, newValue: boolean) => void;
}

export const FeatureFlagsTab = memo(function FeatureFlagsTab({
  featureFlags,
  effectiveAdminDelegatedFlags,
  roleVisibility,
  activeFlagKey,
  isSuperAdmin,
  handleToggleFeatureFlag,
  handleToggleAdminDelegation
}: FeatureFlagsTabProps) {
  return (
        <div className="space-y-6 w-full">
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-border-input/40 pb-2">
              <div>
                <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <Settings className="h-4 w-4 text-blue-400" />
                  Global Feature Flags
                </h3>
                <p className="text-[11px] text-theme-text-muted mt-2">
                  {isSuperAdmin
                    ? 'Turn app features on or off globally. You can also grant Admins permission to manage specific operational flags.'
                    : 'Turn operational features on or off globally for all users. Superadmin has granted you access to manage these flags.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {FEATURE_FLAGS.filter((flag) => isSuperAdmin || effectiveAdminDelegatedFlags[flag.key] === true).map((flag) => {
                const configured = featureFlags[flag.key];
                const isGlobalEnabled = typeof configured === 'boolean'
                  ? configured
                  : getDefaultFeatureFlagState(flag.key);

                const tabKey = FLAG_TO_TAB_KEY[flag.key];
                let rolesOnCount = 3;
                let hasRoleMapping = false;

                if (tabKey) {
                  hasRoleMapping = true;
                  const activeRoles = CONFIGURABLE_ROLES.filter((role) => {
                    const cfg = roleVisibility[role]?.[tabKey];
                    return typeof cfg === 'boolean' ? cfg : getDefaultRoleVisibility(role, tabKey);
                  });
                  rolesOnCount = activeRoles.length;
                }

                const isFullyOn = isGlobalEnabled && (!hasRoleMapping || rolesOnCount === 3);
                const isPartialOn = isGlobalEnabled && hasRoleMapping && rolesOnCount > 0 && rolesOnCount < 3;
                
                const isPending = activeFlagKey === flag.key;
                const isDelegated = !!effectiveAdminDelegatedFlags[flag.key];
                const isDelegatePending = activeFlagKey === `delegate:${flag.key}`;

                return (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-theme-border-input/60 bg-theme-page-bg/40 hover:bg-theme-page-bg/60 transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block text-xs font-semibold text-theme-text-primary">
                          {flag.label}
                        </span>
                        {isPartialOn && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Partial ({rolesOnCount}/3 Roles)
                          </span>
                        )}
                        {isSuperAdmin && isDelegated && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Admin Allowed
                          </span>
                        )}
                      </div>
                      <span className="block text-[10px] text-theme-text-muted mt-0.5">
                        {flag.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSuperAdmin && (
                        <button
                          type="button"
                          disabled={isDelegatePending}
                          onClick={() => handleToggleAdminDelegation(flag.key, !isDelegated)}
                          title={
                            isDelegated
                              ? 'Delegated to Admins — Click to restrict to Superadmin only'
                              : 'Superadmin Only — Click to allow Admins to manage this feature flag'
                          }
                          className={`px-2.5 h-7 rounded-lg border text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center ${
                            isDelegated
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30'
                              : 'bg-theme-border-muted/50 border-theme-border-active/60 text-theme-text-muted hover:bg-theme-border-active/80'
                          } ${isDelegatePending ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
                        >
                          {isDelegated ? 'Admin Allowed' : 'Superadmin Only'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleFeatureFlag(flag.key, !isFullyOn)}
                        title={
                          isFullyOn
                            ? 'Fully Enabled — Click to disable globally for all roles'
                            : isPartialOn
                            ? `Partially Enabled (${rolesOnCount}/3 roles) — Click to disable globally`
                            : 'Disabled — Click to enable for all roles'
                        }
                        className={`min-w-[75px] px-2.5 h-7 rounded-lg border text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1 ${
                          isFullyOn
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                            : isPartialOn
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                            : 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                        } ${isPending ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
                      >
                        {isFullyOn ? 'On' : isPartialOn ? 'Partial On' : 'Off'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {!isSuperAdmin && FEATURE_FLAGS.filter((flag) => effectiveAdminDelegatedFlags[flag.key] === true).length === 0 && (
                <div className="p-6 text-center text-xs text-theme-text-muted italic bg-theme-page-bg/30 rounded-xl border border-theme-border-input/40">
                  No operational feature flags have been delegated to Admins by Superadmin yet.
                </div>
              )}
            </div>
          </div>
        </div>
  );
});
