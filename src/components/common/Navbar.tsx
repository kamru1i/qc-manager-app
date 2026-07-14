import React from "react";
import {
  LogOut,
  Sun,
  Moon,
  Download,
  Monitor,
  Apple,
  Clock,
  Coffee,
  Bell,
  RefreshCw,
  Menu,
} from "lucide-react";
import { Profile } from "@/types";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/utils/envHelper";

import { UserDisplayName } from "@/components/common/UserDisplayName";
import { BadgeInfo } from "@/utils/leaderboardHelper";

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

  return (
    <header className="bg-theme-card-bg/40 backdrop-blur-md border-b border-theme-border-input/50 px-4 py-4 sm:px-6 lg:px-8 z-30">
      <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
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
