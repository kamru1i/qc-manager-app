"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Modal } from "@/components/common/Modal";
import { Profile } from "@/types";
import { useProfiles } from "@/contexts/ProfilesContext";
import { todoAccessService } from "@/services";
import {
  Users,
  Search,
  Check,
  X,
  Shield,
  Loader2,
  UserCheck,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { isSuperadmin } from "@/utils/permissionService";
import { useAppEventBus } from "@/contexts/AppEventBusContext";

interface TodoAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile | null;
}

export const TodoAccessModal: React.FC<TodoAccessModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { profilesList, refreshProfiles } = useProfiles();
  const { emit } = useAppEventBus();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "granted">("all");
  
  // Set of user IDs selected in modal
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  // Initial set of user IDs to detect changes
  const [initialUserIds, setInitialUserIds] = useState<string[]>([]);

  // Load existing todo access list from Supabase
  const loadAccessList = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const { data, error } = await todoAccessService.getTodoAccessList();
      if (error) throw error;
      const ids = (data || []).map((record) => record.user_id);
      setSelectedUserIds(ids);
      setInitialUserIds(ids);
    } catch (err: unknown) {
      console.error("Failed to load todo access list:", err);
      toast.error("Failed to load current Todo view access permissions.");
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setActiveFilter("all");
      loadAccessList();
    }
  }, [isOpen, loadAccessList]);

  // Registered non-superadmin users available for selection
  const eligibleUsers = useMemo(() => {
    return profilesList.filter((p) => !isSuperadmin(p));
  }, [profilesList]);

  // Filtered users matching search and tab filter
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return eligibleUsers.filter((p) => {
      // Filter by granted tab if active
      if (activeFilter === "granted" && !selectedUserIds.includes(p.id)) {
        return false;
      }

      if (!query) return true;

      const codenameMatch = (p.codename || p.username || "").toLowerCase().includes(query);
      const fullNameMatch = (p.full_name || "").toLowerCase().includes(query);
      const roleMatch = (p.role || "").toLowerCase().includes(query);
      const jobRoleMatch = (p.job_role || "").toLowerCase().includes(query);

      return codenameMatch || fullNameMatch || roleMatch || jobRoleMatch;
    });
  }, [eligibleUsers, searchQuery, activeFilter, selectedUserIds]);

  // Toggle user selection
  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Remove a specific user from selected
  const handleRemoveUser = (userId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  // Select all visible filtered users
  const handleSelectAllFiltered = () => {
    const visibleIds = filteredUsers.map((u) => u.id);
    setSelectedUserIds((prev) => {
      const combined = new Set([...prev, ...visibleIds]);
      return Array.from(combined);
    });
  };

  // Deselect all visible filtered users
  const handleDeselectAllFiltered = () => {
    const visibleIds = new Set(filteredUsers.map((u) => u.id));
    setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  // Check if changes have been made
  const hasChanges = useMemo(() => {
    if (selectedUserIds.length !== initialUserIds.length) return true;
    const initialSet = new Set(initialUserIds);
    return selectedUserIds.some((id) => !initialSet.has(id));
  }, [selectedUserIds, initialUserIds]);

  // Save changes to Supabase
  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const { error, grantedCount, revokedCount } = await todoAccessService.saveTodoAccess(
        selectedUserIds,
        currentUser.id
      );

      if (error) throw error;

      // Force refresh shared profiles cache so permissions update fleet-wide
      await refreshProfiles({ force: true });
      emit("profile-access-updated", { table: "todo_access", userIds: selectedUserIds });

      let msg = "Todo view access updated successfully.";
      if (grantedCount && grantedCount > 0 && revokedCount && revokedCount > 0) {
        msg = `Granted access to ${grantedCount} user(s), revoked from ${revokedCount} user(s).`;
      } else if (grantedCount && grantedCount > 0) {
        msg = `Granted Todo view access to ${grantedCount} user(s).`;
      } else if (revokedCount && revokedCount > 0) {
        msg = `Revoked Todo view access from ${revokedCount} user(s).`;
      }

      toast.success(msg);
      onClose();
    } catch (err: unknown) {
      console.error("Failed to save todo access:", err);
      toast.error((err as Error)?.message || "Failed to update Todo view access.");
    } finally {
      setSaving(false);
    }
  };

  const selectedProfiles = useMemo(() => {
    const selectedSet = new Set(selectedUserIds);
    return eligibleUsers.filter((p) => selectedSet.has(p.id));
  }, [eligibleUsers, selectedUserIds]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Todo View Access Management"
      maxWidthClass="max-w-xl"
      glowClass="bg-indigo-900/15"
      icon={<Users className="w-5 h-5 text-indigo-400" />}
    >
      <div className="space-y-4">
        {/* Modal Description & Scope Notice */}
        <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200/90 leading-relaxed flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-indigo-300">View-Only Permission: </span>
            Granted users can open the Todo workspace and view the <strong className="text-white">Daily List</strong> and <strong className="text-white">All Logs</strong> in read-only mode. They cannot add, edit, or delete tasks.
          </div>
        </div>

        {/* Selected Users Pill Chips (if any) */}
        {selectedProfiles.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-theme-text-muted">
              <span className="font-semibold uppercase tracking-wider text-indigo-400">
                Authorized Users ({selectedProfiles.length})
              </span>
              <button
                type="button"
                onClick={() => setSelectedUserIds([])}
                className="text-rose-400 hover:text-rose-300 transition-colors text-[11px] cursor-pointer hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-theme-card-container/40 border border-theme-border-input/60 rounded-xl custom-scrollbar">
              {selectedProfiles.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium group transition-all"
                >
                  <span className="font-mono font-bold text-[11px] text-indigo-200">
                    {(user.codename || user.username || "").toUpperCase()}
                  </span>
                  {user.full_name && (
                    <span className="text-theme-text-muted max-w-[100px] truncate text-[11px]">
                      {user.full_name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveUser(user.id, e)}
                    className="text-indigo-400/70 hover:text-rose-400 transition-colors cursor-pointer p-0.5 rounded hover:bg-rose-500/20"
                    title="Remove access"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search Bar & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by codename, name, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-theme-card-bg/60 border border-theme-border-input hover:border-theme-border-active focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-theme-text-primary placeholder:text-theme-text-muted/60 transition-all outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text-primary p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex bg-theme-card-container/60 p-1 rounded-xl border border-theme-border-input text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              All ({eligibleUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("granted")}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                activeFilter === "granted"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              Granted ({selectedUserIds.length})
            </button>
          </div>
        </div>

        {/* Quick Batch Actions for Filtered Results */}
        {filteredUsers.length > 0 && (
          <div className="flex items-center justify-between px-1 text-[11px] text-theme-text-muted">
            <span>
              Showing {filteredUsers.length} registered user{filteredUsers.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer hover:underline"
              >
                Select Filtered
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                className="text-theme-text-muted hover:text-theme-text-primary font-medium cursor-pointer hover:underline"
              >
                Deselect Filtered
              </button>
            </div>
          </div>
        )}

        {/* User Selection List */}
        <div className="border border-theme-border-input/70 rounded-xl bg-theme-card-bg/40 divide-y divide-theme-border-input/40 max-h-64 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2 text-theme-text-muted text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Loading registered users & permissions...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-theme-text-muted text-xs space-y-1">
              <UserCheck className="w-8 h-8 mx-auto text-theme-text-muted/60" />
              <p className="font-semibold text-theme-text-secondary">No registered users found</p>
              <p className="text-[11px] text-theme-text-muted">
                {searchQuery ? "Try a different search term" : "No users match the active filter"}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedUserIds.includes(user.id);
              const codenameDisplay = (user.codename || user.username || "").toUpperCase();

              return (
                <div
                  key={user.id}
                  onClick={() => handleToggleUser(user.id)}
                  className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors select-none ${
                    isSelected
                      ? "bg-indigo-950/25 hover:bg-indigo-950/35"
                      : "hover:bg-theme-card-container/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "border-theme-border-active bg-theme-card-container/50 hover:border-indigo-400"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    {/* User Meta */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-theme-text-primary">
                          {codenameDisplay}
                        </span>
                        {user.full_name && (
                          <span className="text-xs text-theme-text-secondary truncate">
                            — {user.full_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-theme-text-muted">
                        <span className="capitalize">{user.job_role || user.role}</span>
                        {user.username && user.username !== user.codename && (
                          <>
                            <span>•</span>
                            <span className="text-theme-text-muted/70">@{user.username}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        user.role === "admin"
                          ? "bg-red-950/40 border-red-800/50 text-red-400"
                          : user.role === "supervisor"
                          ? "bg-purple-950/40 border-purple-800/50 text-purple-400"
                          : "bg-theme-card-container/60 border-theme-border-input text-theme-text-muted"
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5 shrink-0" />
                      <span className="capitalize">{user.role}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-theme-border-input/60">
          <div className="text-[11px] text-theme-text-muted">
            {hasChanges ? (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                ● Unsaved permission changes
              </span>
            ) : (
              <span>Permissions up to date</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-theme-card-bg border border-theme-border-input hover:border-theme-border-active text-theme-text-secondary hover:text-theme-text-primary rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Access...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Access ({selectedUserIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
