"use client";

import React from "react";
import { UserPlus, Search, X, Shield, Edit, Trash2 } from "lucide-react";
import { Profile } from "@/types";
import { VerifiedBadge } from "./VerifiedBadge";
import { BadgeInfo } from "@/utils/leaderboardHelper";

interface UserManagementPanelProps {
  filteredProfiles: Profile[];
  initialFetchDone: boolean;
  userSearchQuery: string;
  setUserSearchQuery: (val: string) => void;
  setEditingProfile: (p: Profile | null) => void;
  setEditUserFullName: (val: string) => void;
  setEditUserRole: (val: "user" | "admin" | "supervisor") => void;
  setEditUserAllowedTypes: (val: string[]) => void;
  setEditUserCanManageRules: (val: boolean) => void;
  setDeletingUserAccount: (val: { id: string; username: string } | null) => void;
  setGeneratedPassword: (val: string | null) => void;
  setIsAddUserModalOpen: (val: boolean) => void;
  sessionUser: { id: string } | null;
  badges?: Record<string, BadgeInfo>;
}

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({
  filteredProfiles,
  initialFetchDone,
  userSearchQuery,
  setUserSearchQuery,
  setEditingProfile,
  setEditUserFullName,
  setEditUserRole,
  setEditUserAllowedTypes,
  setEditUserCanManageRules,
  setDeletingUserAccount,
  setGeneratedPassword,
  setIsAddUserModalOpen,
  sessionUser,
  badges,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            User Accounts & File Permissions Management
          </h2>
          <p className="text-xs text-slate-455 mt-1">
            Create new staff accounts and select which file types they are permitted to submit.
          </p>
        </div>
        <button
          onClick={() => {
            setGeneratedPassword(null);
            setIsAddUserModalOpen(true);
          }}
          className="sm:self-end flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl shadow-lg text-xs font-semibold text-white bg-linear-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-blue-950/20 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shrink-0 cursor-pointer"
        >
          <UserPlus className="h-4 w-4" /> Add User
        </button>
      </div>

      {/* Search Bar for Users */}
      <div className="bg-slate-955/45 p-4 rounded-2xl border border-slate-850 flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search users by name, codename, or role (e.g. admin or user)..."
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            className="block w-full pl-8 pr-8 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-9"
          />
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-555" />
          {userSearchQuery && (
            <button
              type="button"
              onClick={() => setUserSearchQuery("")}
              className="absolute right-2.5 top-2.5 flex items-center justify-center p-0.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Full Width Users List Table */}
      <div className="bg-slate-955/20 backdrop-blur-md p-5 rounded-2xl border border-slate-850 space-y-4 overflow-x-auto">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-blue-500" />
          Registered Users List ({filteredProfiles.length})
        </h3>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-955 border-b border-slate-850 text-slate-400 font-semibold uppercase">
              <th className="px-4 py-3">Codename</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Categories</th>
              <th className="px-4 py-3">Rules Perm</th>
              <th className="px-4 py-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 text-slate-355">
            {!initialFetchDone ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="hover:bg-slate-900/10 border-b border-slate-850/40">
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-16 bg-slate-800 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-5 w-14 bg-slate-800/80 rounded-full animate-pulse" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="h-4 w-48 bg-slate-800 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <div className="h-7 w-12 bg-slate-800/80 rounded-lg animate-pulse" />
                      <div className="h-7 w-12 bg-slate-800/80 rounded-lg animate-pulse" />
                    </div>
                  </td>
                </tr>
              ))
            ) : filteredProfiles.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-550"
                >
                  No registered users found.
                </td>
              </tr>
            ) : (
              filteredProfiles.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-slate-900/30 transition-all"
                >
                  <td className="px-4 py-2.5 font-bold text-white">
                    {u.username.toUpperCase()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1">
                      <span>{u.full_name || "-"}</span>
                      {badges && badges[u.id] && (
                        <VerifiedBadge badge={badges[u.id]} />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        u.role === "admin"
                          ? "bg-purple-955/50 border-purple-900/60 text-purple-450"
                          : "bg-blue-955/50 border-blue-900/60 text-blue-450"
                      }`}
                    >
                      {u.role === "admin" ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(u.allowed_types || []).map((t) => (
                        <span
                          key={t}
                          className="bg-slate-900 border border-slate-800 text-slate-400 text-[9px] px-1.5 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.role === "admin" ? (
                      <span className="text-[10px] text-slate-500 italic">Always (Admin)</span>
                    ) : u.can_manage_rules ? (
                      <span className="text-[10px] font-bold text-emerald-450 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/60">
                        Allowed
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Not Allowed</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2.5 items-center">
                      <button
                        onClick={() => {
                          setEditingProfile(u);
                          setEditUserFullName(u.full_name || "");
                          setEditUserRole(u.role);
                          setEditUserAllowedTypes(
                            u.allowed_types || [],
                          );
                          setEditUserCanManageRules(u.role === 'admin' ? true : !!u.can_manage_rules);
                        }}
                        className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-all duration-200 hover:scale-125 cursor-pointer"
                        title="Edit Profile"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      {u.id !== sessionUser?.id && (
                        <button
                          onClick={() => {
                            setDeletingUserAccount({
                              id: u.id,
                              username: u.username,
                            });
                          }}
                          className="p-1.5 bg-slate-900 hover:bg-red-955/20 border border-slate-800 text-red-500 hover:text-red-455 rounded-lg transition-all duration-200 hover:scale-125 cursor-pointer"
                          title="Delete Account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
