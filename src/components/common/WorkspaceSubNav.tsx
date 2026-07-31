"use client";

import React from "react";
import {
  Plus,
  History,
  Users,
  Calendar,
  RotateCcw,
  Settings,
  Clock,
  ScrollText,
  Save,
  FileText,
  BookOpen,
  Key,
  CheckSquare,
  Trophy,
  ShieldCheck,
  TrendingUp,
  User,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { Profile } from "@/types";
import { isSuperadmin, isTabVisibleForRole } from "@/utils/permissionService";
import { useProfiles } from "@/contexts/ProfilesContext";

interface WorkspaceSubNavProps {
  activeTab: string | null;
  activeChutiTab?: string;
  onChutiTabChange?: (tab: any) => void;
  activeQuotesTab?: string;
  onQuotesTabChange?: (tab: any) => void;
  profile: Profile | null;
  isCreatingNewUser?: boolean;
  onCreatingNewUserChange?: (creating: boolean) => void;
}

export const WorkspaceSubNav: React.FC<WorkspaceSubNavProps> = ({
  activeTab,
  activeChutiTab = "add_leave",
  onChutiTabChange,
  activeQuotesTab = "entry",
  onQuotesTabChange,
  profile,
  isCreatingNewUser = false,
  onCreatingNewUserChange,
}) => {
  const { profilesList } = useProfiles();

  if (!profile) return null;

  const isSuperAdmin = isSuperadmin(profile);
  const userHiddenTabs = profile.global_settings?.hidden_tabs || [];

  const tabHidden = (key: string): boolean => {
    if (userHiddenTabs.includes(key)) return true;
    if (isSuperAdmin) return false;
    return !isTabVisibleForRole(
      profile,
      key,
      profile.global_settings,
      profilesList
    );
  };

  interface SubTabItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    onClick: () => void;
  }

  const subTabs: SubTabItem[] = [];

  if (activeTab === "chuti" && onChutiTabChange) {
    subTabs.push({
      id: "add_leave",
      label: "Add Leave",
      icon: Plus,
      active: activeChutiTab === "add_leave",
      onClick: () => onChutiTabChange("add_leave"),
    });

    if (!tabHidden("leave_history")) {
      subTabs.push({
        id: "leave_history",
        label: "Leave History",
        icon: History,
        active: activeChutiTab === "leave_history",
        onClick: () => onChutiTabChange("leave_history"),
      });
    }

    if (!tabHidden("team_leaves")) {
      subTabs.push({
        id: "team_leaves",
        label: "Team Leave Records",
        icon: Users,
        active: activeChutiTab === "team_leaves",
        onClick: () => onChutiTabChange("team_leaves"),
      });
    }

    if (!tabHidden("govt_responses")) {
      subTabs.push({
        id: "govt_responses",
        label: "Govt Holiday Response",
        icon: Calendar,
        active: activeChutiTab === "govt_responses",
        onClick: () => onChutiTabChange("govt_responses"),
      });
    }

    if (!tabHidden("settlement")) {
      subTabs.push({
        id: "settlement",
        label: "Review & Settlements",
        icon: RotateCcw,
        active: activeChutiTab === "settlement",
        onClick: () => onChutiTabChange("settlement"),
      });
    }

    if (!tabHidden("leave_settings")) {
      subTabs.push({
        id: "leave_settings",
        label: "Leave Settings",
        icon: Settings,
        active: activeChutiTab === "leave_settings",
        onClick: () => onChutiTabChange("leave_settings"),
      });
    }
  } else if (activeTab === "quotes" && onQuotesTabChange) {
    subTabs.push({
      id: "entry",
      label: "Daily Entry",
      icon: Clock,
      active: activeQuotesTab === "entry",
      onClick: () => onQuotesTabChange("entry"),
    });

    if (!tabHidden("copy_helper")) {
      subTabs.push({
        id: "copy_helper",
        label: "Copy Helper",
        icon: ScrollText,
        active: activeQuotesTab === "copy_helper",
        onClick: () => onQuotesTabChange("copy_helper"),
      });
    }

    if (isSuperAdmin && !tabHidden("save_file")) {
      subTabs.push({
        id: "save_file",
        label: "Save File",
        icon: Save,
        active: activeQuotesTab === "save_file",
        onClick: () => onQuotesTabChange("save_file"),
      });
    }

    if (!tabHidden("monthly")) {
      subTabs.push({
        id: "monthly",
        label: "Monthly List",
        icon: FileText,
        active: activeQuotesTab === "monthly",
        onClick: () => onQuotesTabChange("monthly"),
      });
    }

    if (!tabHidden("rules")) {
      subTabs.push({
        id: "rules",
        label: "Quote Rules",
        icon: BookOpen,
        active: activeQuotesTab === "rules",
        onClick: () => onQuotesTabChange("rules"),
      });
    }

    if (!tabHidden("login_codes")) {
      subTabs.push({
        id: "login_codes",
        label: "Login Codes",
        icon: Key,
        active: activeQuotesTab === "login_codes",
        onClick: () => onQuotesTabChange("login_codes"),
      });
    }

    if (!tabHidden("quick_import")) {
      subTabs.push({
        id: "quick_import",
        label: "Quick Import",
        icon: Sparkles,
        active: activeQuotesTab === "quick_import",
        onClick: () => onQuotesTabChange("quick_import"),
      });
    }
  } else if (activeTab === "user_management") {
    subTabs.push({
      id: "directory",
      label: "Staff Directory",
      icon: Users,
      active: !isCreatingNewUser,
      onClick: () => onCreatingNewUserChange?.(false),
    });
    if (isSuperAdmin || profile.role === "admin") {
      subTabs.push({
        id: "add_user",
        label: "Add New Staff",
        icon: UserPlus,
        active: isCreatingNewUser,
        onClick: () => onCreatingNewUserChange?.(true),
      });
    }
  } else if (activeTab === "todo") {
    subTabs.push({
      id: "my_todos",
      label: "My Tasks & Todos",
      icon: CheckSquare,
      active: true,
      onClick: () => {},
    });
  } else if (activeTab === "leaderboard") {
    subTabs.push({
      id: "monthly",
      label: "Leaderboard Rankings",
      icon: Trophy,
      active: true,
      onClick: () => {},
    });
  } else if (activeTab === "audit_logs") {
    subTabs.push({
      id: "activity",
      label: "System Audit Logs",
      icon: ShieldCheck,
      active: true,
      onClick: () => {},
    });
  } else if (activeTab === "kpi") {
    subTabs.push({
      id: "performance",
      label: "KPI & Performance",
      icon: TrendingUp,
      active: true,
      onClick: () => {},
    });
  } else if (activeTab === "profile_settings") {
    subTabs.push({
      id: "profile",
      label: "Profile Settings",
      icon: User,
      active: true,
      onClick: () => {},
    });
  }

  if (subTabs.length === 0) return null;

  return (
    <nav
      aria-label="Workspace Sub-navigation"
      className="flex items-center gap-2 border-b border-theme-border-input/50 pb-3 mb-6 overflow-x-auto scrollbar-thin whitespace-nowrap shrink-0 select-none"
    >
      {subTabs.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={t.onClick}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              t.active
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/35 shadow-sm shadow-blue-500/10"
                : "text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-input/40 border border-transparent"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
