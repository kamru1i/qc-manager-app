import React from 'react';
import {
  LogOut,
  User,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Download,
  Monitor,
  Apple,
  Clock,
  Coffee,
  Bell,
  RefreshCw
} from 'lucide-react';
import { Profile } from '@/types';
import { downloadLatestRelease, DownloadPlatform } from '@/utils/downloadHelper';

import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { BadgeInfo } from '@/utils/leaderboardHelper';

interface NavbarProps {
  profile: Profile | null;
  isOnline: boolean;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onLogout: () => void;
  badges?: Record<string, BadgeInfo>;
  onNotificationClick?: () => void;
  notificationCount?: number;
  offlineCount?: number;
  onManualSync?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  isOnline,
  theme,
  onThemeToggle,
  onLogout,
  badges,
  onNotificationClick,
  notificationCount = 0,
  offlineCount = 0,
  onManualSync,
}) => {
  const [isRealtimeConnected, setIsRealtimeConnected] = React.useState(true);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        setIsRealtimeConnected(detail === 'connected');
      };
      window.addEventListener('realtime-connection-status', handler);
      return () => {
        window.removeEventListener('realtime-connection-status', handler);
      };
    }
  }, []);
  const formatWorkingHours = (hours: number | string) => {
    const h = parseFloat(String(hours));
    if (isNaN(h)) return '9 hours 30 mins';
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

  const [isTauri, setIsTauri] = React.useState(false);
  const [downloadLoading, setDownloadLoading] = React.useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = React.useState(false);
  const [showNameTooltip, setShowNameTooltip] = React.useState(false);
  const nameHoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const isTauriEnv = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || (window as any).__TAURI__ !== undefined);
    setIsTauri(isTauriEnv);
  }, []);

  // Close dropdown on click outside
  React.useEffect(() => {
    if (!showDownloadDropdown) return;
    const handleOutsideClick = () => setShowDownloadDropdown(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showDownloadDropdown]);

  const handleDownload = async (platform: DownloadPlatform, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing immediately
    setDownloadLoading(true);
    try {
      await downloadLatestRelease(platform);
    } finally {
      setDownloadLoading(false);
      setShowDownloadDropdown(false);
    }
  };

  return (
    <header className="bg-theme-card-bg/40 backdrop-blur-md border-b border-theme-border-input/50 px-4 py-4 sm:px-6 lg:px-8 z-30">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
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
            <p className="text-xs text-theme-text-muted mt-0.5">Quotes, Sales & Chuti Management Dashboard</p>
            {profile && (
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="bg-theme-card-bg/60 border border-theme-border-input/80 rounded-lg px-2.5 py-1 text-[11px] text-theme-text-secondary flex items-center gap-1.5 shadow-sm">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  <span>Working Hours: <strong className="text-theme-text-primary">{formatWorkingHours(profile.working_hours || 9.5)}</strong></span>
                </div>
                <div className="bg-theme-card-bg/60 border border-theme-border-input/80 rounded-lg px-2.5 py-1 text-[11px] text-theme-text-secondary flex items-center gap-1.5 shadow-sm">
                  <Coffee className="h-3.5 w-3.5 text-purple-400" />
                  <span>Break Time: <strong className="text-theme-text-primary">{profile.break_time || 0} Mins</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Online/Offline Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
            !isOnline
              ? 'bg-purple-950/50 border-purple-800/80 text-purple-400'
              : !isRealtimeConnected
                ? 'bg-amber-950/50 border-amber-800/80 text-amber-400 animate-pulse'
                : 'bg-emerald-950/50 border-emerald-800/80 text-emerald-400'
          }`}>
            {!isOnline ? (
              <>
                <WifiOff className="h-4 w-4" /> Offline
              </>
            ) : !isRealtimeConnected ? (
              <>
                <Wifi className="h-4 w-4 text-amber-400" /> Connecting Live...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4" /> Online
              </>
            )}
          </div>

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
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
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

          {/* Download App Dropdown (Only for Web Browser) */}
          {!isTauri && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDownloadDropdown(!showDownloadDropdown);
                }}
                disabled={downloadLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                title="Download Desktop App"
              >
                <Download className={`h-4 w-4 ${downloadLoading ? 'animate-bounce' : ''}`} />
                <span>Get App</span>
              </button>

              {showDownloadDropdown && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-theme-card-container border border-theme-border-input rounded-xl shadow-2xl p-2 z-999 animate-in fade-in slide-in-from-top-2 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2.5 py-1.5 border-b border-theme-card-bg/10 mb-1">
                    <p className="text-[10px] text-theme-text-muted uppercase tracking-wider font-semibold">Download Platform</p>
                  </div>
                  <button
                    onClick={(e) => handleDownload('windows', e)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-theme-card-bg text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-medium text-left transition-colors cursor-pointer"
                  >
                    <Monitor className="h-4 w-4 text-blue-400" />
                    Windows (.exe)
                  </button>
                  <button
                    onClick={(e) => handleDownload('macos-silicon', e)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-theme-card-bg text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-medium text-left transition-colors cursor-pointer"
                  >
                    <Apple className="h-4 w-4 text-indigo-400" />
                    macOS (Apple Silicon)
                  </button>
                  <button
                    onClick={(e) => handleDownload('macos-intel', e)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-theme-card-bg text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-medium text-left transition-colors cursor-pointer"
                  >
                    <Apple className="h-4 w-4 text-theme-text-muted" />
                    macOS (Intel)
                  </button>
                </div>
              )}
            </div>
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
