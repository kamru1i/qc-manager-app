import React from "react";
import {
  LogOut,
  Sun,
  Moon,
  Download,
  Clock,
  Coffee,
  Bell,
  RefreshCw,
  Menu,
} from "lucide-react";
import { Profile } from "@/types";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/utils/envHelper";

import { isTabVisibleForRole } from "@/utils/permissionService";
import { getGlobalSettingsFromProfile } from "@/utils/dashboardHelpers";
import { UserDisplayName } from "@/components/common/UserDisplayName";
import { LiveClock } from "@/components/common/LiveClock";
import { BadgeInfo } from "@/utils/leaderboardHelper";
import { useAttendance } from "@/contexts/AttendanceContext";
import { formatDurationSeconds } from "@/utils/attendanceHelpers";

interface NavbarProps {
  profile: Profile | null;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  onLogout: () => void;
  badges?: Record<string, BadgeInfo>;
  onNotificationClick?: () => void;
  notificationCount?: number;
  offlineCount?: number;
  onManualSync?: () => void;
  onMenuToggle?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  theme,
  onThemeToggle,
  onLogout,
  badges,
  onNotificationClick,
  notificationCount = 0,
  offlineCount = 0,
  onManualSync,
  onMenuToggle,
}) => {
  const { myDailyRecord, myStatus, myWorkingSeconds, myActiveBreakSeconds } = useAttendance();

  const formatWorkingHours = (hours: number | string) => {
    const h = parseFloat(String(hours));
    if (isNaN(h)) return "9 hours 30 mins";
    const wholeHours = Math.floor(h);
    const fraction = h - wholeHours;
    if (fraction === 0.5) {
      return `${wholeHours} hours 30 mins`;
    }
    if (fraction === 0) {
      return `${wholeHours} hours`;
    }
    return `${h} hours`;
  };

  const router = useRouter();
  const [isNative, setIsNative] = React.useState(false);

  React.useEffect(() => {
    setIsNative(isNativeApp());
  }, []);

  const showBd = React.useMemo(
    () => isTabVisibleForRole(profile, "bd_clock", getGlobalSettingsFromProfile(profile)),
    [profile]
  );
  const showUk = React.useMemo(
    () => isTabVisibleForRole(profile, "uk_clock", getGlobalSettingsFromProfile(profile)),
    [profile]
  );

  return (
    <header
      className="shrink-0 bg-theme-card-bg/60 backdrop-blur-md border-b border-theme-border-input/60 px-4 py-3 sm:px-6 lg:px-8 z-30"
    >
      <div className="w-full flex justify-between items-center">
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              aria-label="Open navigation menu"
              className="md:hidden p-2 rounded-lg border border-theme-border-input/80 bg-theme-page-bg/40 text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-active transition-all cursor-pointer mr-1"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-theme-text-primary flex items-center gap-2">
              <span className="flex items-center">
                Welcome,&nbsp;
                {profile && (
                  <UserDisplayName
                    profile={profile}
                    badge={badges ? badges[profile.id] : null}
                    tooltipPosition="bottom"
                  />
                )}
              </span>
            </h1>
            <p className="text-xs text-theme-text-muted mt-0.5">
              Quotes, Sales & Chuti Management Dashboard
            </p>
            {profile && (
              <div className="hidden md:flex flex-wrap gap-2 mt-2">
                <div className="bg-theme-card-bg/60 border border-theme-border-input/80 rounded-lg px-2.5 py-1 text-[11px] text-theme-text-secondary flex items-center gap-1.5 shadow-sm">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  <span>
                    Working Hours:{" "}
                    <strong className="text-theme-text-primary">
                      {formatWorkingHours(profile.working_hours || 9.5)}
                    </strong>
                  </span>
                </div>
                <div className="bg-theme-card-bg/60 border border-theme-border-input/80 rounded-lg px-2.5 py-1 text-[11px] text-theme-text-secondary flex items-center gap-1.5 shadow-sm">
                  <Coffee className="h-3.5 w-3.5 text-purple-400" />
                  <span>
                    Break Time:{" "}
                    <strong className="text-theme-text-primary">
                      {profile.break_time || 0} Mins
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 flex-wrap">
          {/* Offline Sync Area */}
          {offlineCount > 0 && onManualSync && (
            <button
              onClick={onManualSync}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 text-xs font-semibold cursor-pointer shadow-lg shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all border border-purple-700 shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Sync ({offlineCount})
            </button>
          )}

          {/* Attendance Live Timer (Borderless, left of LiveClock with vertical divider) */}
          {profile && (myStatus === 'WORKING' || myStatus === 'SNACK_BREAK' || myStatus === 'PRAYER_BREAK') && (
            <>
              <div className="flex flex-col items-end justify-center select-none font-mono">
                {myStatus === 'WORKING' && (
                  <div className="flex flex-col items-end leading-none">
                    <div className="flex items-center gap-1 text-[9px] tracking-widest font-extrabold text-emerald-400 uppercase mb-0.5">
                      <Clock className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                      <span>WORKING</span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold font-mono tracking-tight text-emerald-300">
                      {formatDurationSeconds(myWorkingSeconds)}
                    </div>
                  </div>
                )}
                {myStatus === 'SNACK_BREAK' && (
                  <div className="flex flex-col items-end leading-none">
                    <div className="flex items-center gap-1 text-[9px] tracking-widest font-extrabold text-amber-400 uppercase mb-0.5">
                      <Coffee className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                      <span>BREAK</span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold font-mono tracking-tight text-amber-300">
                      {formatDurationSeconds(myActiveBreakSeconds)}
                    </div>
                  </div>
                )}
                {myStatus === 'PRAYER_BREAK' && (
                  <div className="flex flex-col items-end leading-none">
                    <div className="flex items-center gap-1 text-[9px] tracking-widest font-extrabold text-sky-400 uppercase mb-0.5">
                      <Sun className="w-2.5 h-2.5 text-sky-400 animate-pulse" />
                      <span>PRAYER BREAK</span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold font-mono tracking-tight text-sky-300">
                      {formatDurationSeconds(myActiveBreakSeconds)}
                    </div>
                  </div>
                )}
              </div>
              <div className="h-6 w-px bg-theme-border-input/80 hidden sm:block shrink-0" />
            </>
          )}

          {/* Live Clocks (Superadmin-controlled via Access Control & Feature Flags) */}
          <LiveClock showBd={showBd} showUk={showUk} />

          {/* Theme Toggle */}
          <button
            onClick={onThemeToggle}
            className="p-2 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center shrink-0"
            title={
              theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
            }
          >
            {theme === "dark" ? (
              <Sun className="h-4.5 w-4.5 text-purple-500" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-indigo-400" />
            )}
          </button>

          {/* Notification Bell */}
          {profile && onNotificationClick && (
            <button
              onClick={onNotificationClick}
              className="relative p-2 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center shrink-0"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {notificationCount > 0 && (
                <span className="absolute top-[-4px] right-[-4px] flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 animate-pulse">
                  <span className="text-[9px] font-sans font-bold text-white leading-none">
                    {notificationCount}
                  </span>
                </span>
              )}
            </button>
          )}

          {/* Download App Trigger (Only for Web Browser) */}
          {!isNative && (
            <button
              onClick={() => router.push("/downloads")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
              title="Download App Versions"
            >
              <Download className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </div>
    </header>
  );
};
