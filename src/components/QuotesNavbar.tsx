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
  Apple
} from 'lucide-react';
import { Profile } from '@/types';
import { downloadLatestRelease, DownloadPlatform } from '@/utils/downloadHelper';

import { VerifiedBadge } from './VerifiedBadge';
import { BadgeInfo } from '@/utils/leaderboardHelper';

interface NavbarProps {
  profile: Profile | null;
  isOnline: boolean;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onLogout: () => void;
  badges?: Record<string, BadgeInfo>;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  isOnline,
  theme,
  onThemeToggle,
  onLogout,
  badges,
}) => {
  const [isTauri, setIsTauri] = React.useState(true);
  const [downloadLoading, setDownloadLoading] = React.useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = React.useState(false);
  const [showNameTooltip, setShowNameTooltip] = React.useState(false);
  const nameHoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const isTauriEnv = typeof window !== 'undefined' && (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
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

  const handleNameMouseEnter = () => {
    nameHoverTimeoutRef.current = setTimeout(() => {
      setShowNameTooltip(true);
    }, 2000); // 2 seconds delay
  };

  const handleNameMouseLeave = () => {
    if (nameHoverTimeoutRef.current) {
      clearTimeout(nameHoverTimeoutRef.current);
      nameHoverTimeoutRef.current = null;
    }
    setShowNameTooltip(false);
  };

  React.useEffect(() => {
    return () => {
      if (nameHoverTimeoutRef.current) {
        clearTimeout(nameHoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <header className="bg-slate-900/40 backdrop-blur-md border-b border-slate-800/50 px-4 py-4 sm:px-6 lg:px-8 z-30">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/15 rounded-xl border border-blue-500/20 text-blue-400">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="flex items-center">
                Welcome,&nbsp;
                <span 
                  onMouseEnter={handleNameMouseEnter}
                  onMouseLeave={handleNameMouseLeave}
                  className="relative group inline-flex items-center select-none"
                >
                  <span className="cursor-help pb-0.5 inline-flex items-center">
                    {profile?.full_name || 'User'}
                  </span>
                  
                  {/* Custom Hover Tooltip for Codename & Role */}
                  {showNameTooltip && (
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 flex flex-col gap-1 z-50 w-40 p-2.5 text-[11px] leading-relaxed text-slate-350 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md animate-fade-in pointer-events-auto">
                      <div className="font-semibold text-white">
                        Codename: <span className="text-blue-400 font-mono select-all ml-1">{profile?.username ? profile.username.toUpperCase() : ''}</span>
                      </div>
                      <div className="border-t border-slate-850 my-0.5"></div>
                      <div className="text-slate-400 flex items-center gap-1.5">
                        <span>Role:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                          profile?.role === 'admin'
                            ? 'bg-purple-950/60 border-purple-800 text-purple-300' 
                            : 'bg-blue-950/60 border-blue-800 text-blue-300'
                        }`}>
                          {profile?.role === 'admin' ? 'Admin' : 'Staff'}
                        </span>
                      </div>
                    </span>
                  )}
                </span>
                {/* Real/Mock Verified Badge - placed outside name wrapper for independent hover states */}
                {profile && badges && badges[profile.id] && (
                  <VerifiedBadge badge={badges[profile.id]} position="bottom" />
                )}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Quotes & Sales Tracking Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Online/Offline Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
            isOnline 
              ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-400' 
              : 'bg-amber-950/50 border-amber-800/80 text-amber-400'
          }`}>
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4" /> Online
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" /> Offline
              </>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onThemeToggle}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4.5 w-4.5 text-amber-500" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-indigo-400" />
            )}
          </button>

          {/* Download App Dropdown (Only for Web Browser) */}
          {!isTauri && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDownloadDropdown(!showDownloadDropdown);
                }}
                disabled={downloadLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                title="Download Desktop App"
              >
                <Download className={`h-4 w-4 ${downloadLoading ? 'animate-bounce' : ''}`} />
                <span>Get App</span>
              </button>

              {showDownloadDropdown && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2 z-[999] animate-in fade-in slide-in-from-top-2 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-2.5 py-1.5 border-b border-slate-900/10 mb-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Download Platform</p>
                  </div>
                  <button
                    onClick={(e) => handleDownload('windows', e)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-900 text-slate-200 hover:text-white rounded-lg text-xs font-medium text-left transition-colors cursor-pointer"
                  >
                    <Monitor className="h-4 w-4 text-blue-400" />
                    Windows (.exe)
                  </button>
                  <button
                    onClick={(e) => handleDownload('macos-silicon', e)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-900 text-slate-200 hover:text-white rounded-lg text-xs font-medium text-left transition-colors cursor-pointer"
                  >
                    <Apple className="h-4 w-4 text-indigo-400" />
                    macOS (Apple Silicon)
                  </button>
                  <button
                    onClick={(e) => handleDownload('macos-intel', e)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-900 text-slate-200 hover:text-white rounded-lg text-xs font-medium text-left transition-colors cursor-pointer"
                  >
                    <Apple className="h-4 w-4 text-slate-400" />
                    macOS (Intel)
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-350 hover:text-white rounded-lg text-xs font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </div>
    </header>
  );
};
