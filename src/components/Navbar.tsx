import React, { useState, useRef, useEffect } from 'react';
import {
  LogOut,
  Clock,
  Coffee,
  Wifi,
  WifiOff,
  RefreshCw,
  Sun,
  Moon,
  Bell,
  Menu,
  Download,
  Monitor,
  Apple
} from 'lucide-react';
import { Profile } from '@/types';
import { formatWorkingHours } from '@/utils/dashboardHelpers';
import { useAppReleaseLinks } from '@/hooks/useAppReleaseLinks';
import { isTauriApp } from '@/utils/apiUrlHelper';

interface NavbarProps {

  profile: Profile | null;
  isOnline: boolean;
  offlineCount: number;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onManualSync: () => void;
  onLogout: () => void;
  onProfileSettingsClick: () => void;
  onNotificationClick: () => void;
  unreadUserNotificationsCount: number;
  groupedSupervisorRequestsCount: number;
  groupedChutiRequestsCount: number;
  pendingReserveRequestsCount: number;
  pendingProfileRequestsCount: number;
  adminActiveTab: 'user' | 'admin';
  adminHolidayNotificationsCount?: number;
  pendingPasswordResetRequestsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  isOnline,
  offlineCount,
  theme,
  onThemeToggle,
  onManualSync,
  onLogout,
  onProfileSettingsClick,
  onNotificationClick,
  unreadUserNotificationsCount,
  groupedSupervisorRequestsCount,
  groupedChutiRequestsCount,
  pendingReserveRequestsCount,
  pendingProfileRequestsCount,
  adminActiveTab,
  adminHolidayNotificationsCount,
  pendingPasswordResetRequestsCount = 0,
}) => {
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const links = useAppReleaseLinks();
  const isDesktop = isTauriApp();


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDownloadDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-slate-900/40 backdrop-blur-md border-b border-slate-900 px-4 py-4 sm:px-6 lg:px-8 z-40">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onProfileSettingsClick}
            className="p-2.5 bg-orange-600/15 rounded-xl border border-orange-500/20 text-orange-400 hover:bg-orange-600/25 transition-all cursor-pointer"
            title="Profile Settings"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Welcome, {profile?.full_name || 'User'} ({profile?.username ? profile.username.toUpperCase() : ''})
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${profile?.role === 'admin'
                ? 'bg-orange-955/60 border-orange-800 text-orange-300'
                : profile?.role === 'supervisor'
                  ? 'bg-amber-955/60 border-amber-800 text-amber-300'
                  : 'bg-orange-955/60 border-orange-800 text-orange-300'
                }`}>
                {profile?.job_role || (profile?.role === 'admin' ? 'Admin' : (profile?.role === 'supervisor' ? 'Supervisor' : 'Staff'))}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Role-based Office Leave Tracker</p>
            {profile && (profile.role !== 'admin' || adminActiveTab === 'user') && (
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Clock className="h-3.5 w-3.5 text-orange-400" />
                  <span>Working Hours: <strong className="text-white">{formatWorkingHours(profile.working_hours || 9.5)}</strong></span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 flex items-center gap-1.5 shadow-sm">
                  <Coffee className="h-3.5 w-3.5 text-amber-400" />
                  <span>Break Time: <strong className="text-white">{profile.break_time || 0} Mins</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Online/Offline Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${isOnline
            ? 'bg-emerald-955/50 border-emerald-800/80 text-emerald-400'
            : 'bg-amber-955/50 border-amber-800/80 text-amber-400'
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

          {/* Offline Sync Area */}
          {offlineCount > 0 && (
            <button
              onClick={onManualSync}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-500 text-xs font-semibold cursor-pointer shadow-lg shadow-amber-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all border border-amber-700"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Sync ({offlineCount})
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={onThemeToggle}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-355 hover:text-white rounded-lg cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4.5 w-4.5 text-amber-500" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-orange-400" />
            )}
          </button>

          {/* Notification Bell */}
          {profile && (
            <button
              onClick={onNotificationClick}
              className="relative p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-355 hover:text-white rounded-lg cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all"
              title="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {profile.role === 'supervisor' && (groupedSupervisorRequestsCount + unreadUserNotificationsCount) > 0 && (
                <span className="absolute top-[-4px] right-[-4px] flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                  {groupedSupervisorRequestsCount + unreadUserNotificationsCount}
                </span>
              )}
              {profile.role === 'admin' && adminActiveTab === 'admin' && (groupedChutiRequestsCount + pendingReserveRequestsCount + pendingProfileRequestsCount + pendingPasswordResetRequestsCount + (adminHolidayNotificationsCount || 0)) > 0 && (
                <span className="absolute top-[-4px] right-[-4px] flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                  {groupedChutiRequestsCount + pendingReserveRequestsCount + pendingProfileRequestsCount + pendingPasswordResetRequestsCount + (adminHolidayNotificationsCount || 0)}
                </span>
              )}
              {((profile.role === 'user') || (profile.role === 'admin' && adminActiveTab === 'user')) && unreadUserNotificationsCount > 0 && (
                <span className="absolute top-[-4px] right-[-4px] flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                  {unreadUserNotificationsCount}
                </span>
              )}
            </button>
          )}

          {/* Get App Dropdown */}
          {!isDesktop && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-300 rounded-lg text-xs font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Download className="h-4 w-4" /> Get App
              </button>

              {showDownloadDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-950 border border-slate-800/80 shadow-2xl p-2.5 z-[100] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-900 mb-1.5">
                    Download Platform
                  </div>
                  <div className="flex flex-col gap-1">
                    <a
                      href={links.windows}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowDownloadDropdown(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 transition-all group cursor-pointer"
                    >
                      <Monitor className="h-4 w-4 text-sky-400 group-hover:scale-110 transition-all duration-200" />
                      <span>Windows (.exe)</span>
                    </a>
                    <a
                      href={links.macSilicon}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowDownloadDropdown(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 transition-all group cursor-pointer"
                    >
                      <Apple className="h-4 w-4 text-violet-400 group-hover:scale-110 transition-all duration-200" />
                      <span>macOS (Apple Silicon)</span>
                    </a>
                    <a
                      href={links.macIntel}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowDownloadDropdown(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-900 transition-all group cursor-pointer"
                    >
                      <Apple className="h-4 w-4 text-slate-400 group-hover:scale-110 transition-all duration-200" />
                      <span>macOS (Intel)</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </div>
    </header>
  );
};
