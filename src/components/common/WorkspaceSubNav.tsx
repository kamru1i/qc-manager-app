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
  Home,
  ScrollText,
  Save,
  FileText,
  FileSpreadsheet,
  BookOpen,
  Key,
  CheckSquare,
  Trophy,
  ShieldCheck,
  TrendingUp,
  User,
  UserPlus,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Profile } from "@/types";
import { isSuperadmin, isTabVisibleForRole, isAdminRole } from "@/utils/permissionService";
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

  const tabHidden = (key: string): boolean => {
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
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    iconColor?: string;
    active: boolean;
    onClick: () => void;
  }

  const subTabs: SubTabItem[] = [];

  if (activeTab === "chuti" && onChutiTabChange) {
    subTabs.push({
      id: "add_leave",
      label: "Add Leave",
      icon: Plus,
      iconColor: "text-blue-400",
      active: activeChutiTab === "add_leave",
      onClick: () => onChutiTabChange("add_leave"),
    });

    if (!tabHidden("leave_history")) {
      subTabs.push({
        id: "leave_history",
        label: "Leave History",
        icon: History,
        iconColor: "text-amber-400",
        active: activeChutiTab === "leave_history",
        onClick: () => onChutiTabChange("leave_history"),
      });
    }

    if (!tabHidden("team_leaves")) {
      subTabs.push({
        id: "team_leaves",
        label: "Team Leave Records",
        icon: Users,
        iconColor: "text-purple-400",
        active: activeChutiTab === "team_leaves",
        onClick: () => onChutiTabChange("team_leaves"),
      });
    }



    if (!tabHidden("settlement")) {
      subTabs.push({
        id: "settlement",
        label: "Review & Settlements",
        icon: RotateCcw,
        iconColor: "text-rose-400",
        active: activeChutiTab === "settlement",
        onClick: () => onChutiTabChange("settlement"),
      });
    }

    if (!tabHidden("leave_settings")) {
      subTabs.push({
        id: "leave_settings",
        label: "Leave Settings",
        icon: Settings,
        iconColor: "text-indigo-400",
        active: activeChutiTab === "leave_settings",
        onClick: () => onChutiTabChange("leave_settings"),
      });
    }
  } else if (activeTab === "quotes" && onQuotesTabChange) {
    subTabs.push({
      id: "entry",
      label: "Daily Entry",
      icon: Clock,
      iconColor: "text-sky-400",
      active: activeQuotesTab === "entry",
      onClick: () => onQuotesTabChange("entry"),
    });

    if (!tabHidden("copy_helper")) {
      subTabs.push({
        id: "copy_helper",
        label: "Copy Helper",
        icon: ScrollText,
        iconColor: "text-amber-400",
        active: activeQuotesTab === "copy_helper",
        onClick: () => onQuotesTabChange("copy_helper"),
      });
    }

    if (isSuperAdmin && !tabHidden("save_file")) {
      subTabs.push({
        id: "save_file",
        label: "Save File",
        icon: Save,
        iconColor: "text-teal-400",
        active: activeQuotesTab === "save_file",
        onClick: () => onQuotesTabChange("save_file"),
      });
    }

    if (!tabHidden("quick_import")) {
      subTabs.push({
        id: "quick_import",
        label: "Quick Import",
        icon: Sparkles,
        iconColor: "text-amber-300",
        active: activeQuotesTab === "quick_import",
        onClick: () => onQuotesTabChange("quick_import"),
      });
    }

    if (!tabHidden("monthly")) {
      subTabs.push({
        id: "monthly",
        label: "Monthly Summary",
        icon: FileText,
        iconColor: "text-cyan-400",
        active: activeQuotesTab === "monthly",
        onClick: () => onQuotesTabChange("monthly"),
      });
    }

    if (!tabHidden("sale_summary")) {
      subTabs.push({
        id: "sale_summary",
        label: "Sale Summary",
        icon: TrendingUp,
        iconColor: "text-emerald-400",
        active: activeQuotesTab === "sale_summary",
        onClick: () => onQuotesTabChange("sale_summary"),
      });
    }

    if (!tabHidden("mistakes")) {
      subTabs.push({
        id: "mistakes",
        label: "Mistakes",
        icon: AlertTriangle,
        iconColor: "text-rose-400",
        active: activeQuotesTab === "mistakes",
        onClick: () => onQuotesTabChange("mistakes"),
      });
    }

    if (!tabHidden("rules")) {
      subTabs.push({
        id: "rules",
        label: "Quote Rules",
        icon: BookOpen,
        iconColor: "text-blue-400",
        active: activeQuotesTab === "rules",
        onClick: () => onQuotesTabChange("rules"),
      });
    }

    if (!tabHidden("login_codes")) {
      subTabs.push({
        id: "login_codes",
        label: "Login Codes",
        icon: Key,
        iconColor: "text-purple-400",
        active: activeQuotesTab === "login_codes",
        onClick: () => onQuotesTabChange("login_codes"),
      });
    }
  } else if (activeTab === "user_management") {
    subTabs.push({
      id: "directory",
      label: "Staff Directory",
      icon: Users,
      iconColor: "text-purple-400",
      active: !isCreatingNewUser,
      onClick: () => onCreatingNewUserChange?.(false),
    });
    if (isSuperAdmin || profile.role === "admin") {
      subTabs.push({
        id: "add_user",
        label: "Add New Staff",
        icon: UserPlus,
        iconColor: "text-emerald-400",
        active: isCreatingNewUser,
        onClick: () => onCreatingNewUserChange?.(true),
      });
    }
  } else if (activeTab === "todo") {
    subTabs.push({
      id: "my_todos",
      label: "My Tasks & Todos",
      icon: CheckSquare,
      iconColor: "text-emerald-400",
      active: true,
      onClick: () => {},
    });
  } else if (
    activeTab === "kpi" ||
    activeTab === "leaderboard" ||
    activeTab === "reports" ||
    activeTab === "my_report" ||
    activeTab === "all_report"
  ) {
    subTabs.push({
      id: "leaderboard",
      label: "Leaderboard",
      icon: Trophy,
      iconColor: "text-amber-400",
      active: activeTab === "leaderboard",
      onClick: () => onQuotesTabChange?.("leaderboard" as any),
    });
    subTabs.push({
      id: "kpi",
      label: "KPI Report",
      icon: TrendingUp,
      iconColor: "text-emerald-400",
      active: activeTab === "kpi" || activeTab === "reports",
      onClick: () => onQuotesTabChange?.("kpi" as any),
    });
    subTabs.push({
      id: "my_report",
      label: "My Report",
      icon: FileText,
      iconColor: "text-sky-400",
      active: activeTab === "my_report",
      onClick: () => onQuotesTabChange?.("my_report" as any),
    });
    if (isAdminRole(profile) || profile?.role === "supervisor") {
      subTabs.push({
        id: "all_report",
        label: "All Report",
        icon: FileSpreadsheet,
        iconColor: "text-purple-400",
        active: activeTab === "all_report",
        onClick: () => onQuotesTabChange?.("all_report" as any),
      });
    }
  }

const getSubTabColors = (id: string): { class: string; hex: string } => {
  switch (id) {
    case "add_leave":
      return { class: "text-sky-400", hex: "#38bdf8" };
    case "leave_history":
      return { class: "text-amber-400", hex: "#fbbf24" };
    case "team_leaves":
      return { class: "text-purple-400", hex: "#c084fc" };
    case "govt_responses":
      return { class: "text-emerald-400", hex: "#34d399" };
    case "settlement":
      return { class: "text-rose-400", hex: "#fb7185" };
    case "leave_settings":
      return { class: "text-indigo-400", hex: "#818cf8" };

    case "entry":
      return { class: "text-sky-400", hex: "#38bdf8" };
    case "copy_helper":
      return { class: "text-amber-400", hex: "#fbbf24" };
    case "save_file":
      return { class: "text-teal-400", hex: "#2dd4bf" };
    case "monthly":
      return { class: "text-cyan-400", hex: "#22d3ee" };
    case "rules":
      return { class: "text-blue-400", hex: "#60a5fa" };
    case "login_codes":
      return { class: "text-purple-400", hex: "#c084fc" };
    case "quick_import":
      return { class: "text-amber-300", hex: "#fcd34d" };

    case "directory":
      return { class: "text-purple-400", hex: "#c084fc" };
    case "add_user":
      return { class: "text-emerald-400", hex: "#34d399" };

    case "my_todos":
      return { class: "text-sky-400", hex: "#38bdf8" };

    case "leaderboard":
      return { class: "text-amber-400", hex: "#fbbf24" };
    case "kpi":
      return { class: "text-emerald-400", hex: "#34d399" };
    case "my_report":
      return { class: "text-sky-400", hex: "#38bdf8" };
    case "all_report":
      return { class: "text-purple-400", hex: "#c084fc" };

    case "activity":
      return { class: "text-orange-400", hex: "#fb923c" };

    default:
      return { class: "text-sky-400", hex: "#38bdf8" };
  }
};

  if (subTabs.length === 0) return null;

  return (
    <nav
      aria-label="Workspace Sub-navigation"
      className="flex items-center gap-2 border-b border-theme-border-input/50 pb-3 mb-6 overflow-x-auto scrollbar-thin whitespace-nowrap shrink-0 select-none"
    >
      {subTabs.map((t) => {
        const Icon = t.icon;
        const colors = getSubTabColors(t.id);
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
            <Icon className={`h-4 w-4 shrink-0 ${colors.class}`} style={{ color: colors.hex }} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
