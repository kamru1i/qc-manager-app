import React, { useState, useRef, useEffect } from "react";
import { Profile } from "@/types";
import { BadgeInfo } from "@/utils/leaderboardHelper";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";

interface UserDisplayNameProps {
  profile: Profile;
  badge?: BadgeInfo | null;
  nameClassName?: string;
  tooltipPosition?: 'top' | 'bottom';
  showBadge?: boolean;
}

export const UserDisplayName: React.FC<UserDisplayNameProps> = ({
  profile,
  badge,
  nameClassName = "",
  tooltipPosition = "bottom",
  showBadge = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 2000); // 2 seconds delay
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <span className="inline-flex items-center align-middle">
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative group inline-flex items-center select-none cursor-help pb-0.5 ${nameClassName}`}
      >
        <span>{profile.full_name || 'User'}</span>

        {/* Custom Hover Tooltip for Codename & Role Info */}
        {showTooltip && (
          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 flex flex-col gap-1 z-50 w-44 p-2.5 text-[11px] leading-relaxed text-theme-text-secondary bg-theme-page-bg/95 border border-theme-border-input rounded-xl shadow-2xl backdrop-blur-md animate-fade-in pointer-events-auto normal-case font-normal text-left">
            <div className="font-semibold text-theme-text-primary flex items-center flex-wrap gap-1">
              <span>Codename:</span>
              <span className="text-blue-400 font-mono select-all">{profile.username ? profile.username.toUpperCase() : ''}</span>
              {profile.role && (
                <span className="text-[10px] text-theme-text-muted font-normal">
                  ({profile.role === 'admin' ? 'Admin' : profile.role === 'supervisor' ? 'Supervisor' : 'Staff'})
                </span>
              )}
            </div>
            {profile.job_role && (
              <>
                <div className="border-t border-theme-border-muted my-0.5"></div>
                <div className="text-theme-text-muted">
                  Job Role: <span className="text-theme-text-primary font-semibold ml-1">{profile.job_role}</span>
                </div>
              </>
            )}
          </span>
        )}
      </span>

      {/* Verified Badge next to the name with exact space styling */}
      {showBadge && badge && (
        <VerifiedBadge badge={badge} position={tooltipPosition} />
      )}
    </span>
  );
};
