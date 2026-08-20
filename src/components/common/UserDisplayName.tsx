import React, { useState, useRef, useEffect } from "react";
import { Profile } from "@/types";
import { BadgeInfo } from "@/utils/leaderboardHelper";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { isAdminRole } from '@/utils/permissionService';

// Global cache for all-time ranks mapping: profileId -> rank number.
// Single source of truth: fed exclusively by the get_leaderboard_data RPC
// (updateGlobalRankCacheDirect in app/page.tsx) so the navbar always matches
// the Leaderboard page. Do NOT add local recomputations — regular users only
// have their own records loaded (egress-scoped), which yields bogus ranks.
let rankCache: Record<string, number> = {};
const rankCacheListeners = new Set<() => void>();

export const updateGlobalRankCacheDirect = (ranks: Record<string, number>) => {
  rankCache = ranks;
  rankCacheListeners.forEach((listener) => listener());
};

interface UserDisplayNameProps {
  profile: Profile;
  badge?: BadgeInfo | null;
  nameClassName?: string;
  tooltipPosition?: 'top' | 'bottom';
  showBadge?: boolean;
  showRank?: boolean;
  rank?: number | null;
  disableBadgeTooltip?: boolean;
}

export const UserDisplayName: React.FC<UserDisplayNameProps> = ({
  profile,
  badge,
  nameClassName = "",
  tooltipPosition = "bottom",
  showBadge = true,
  showRank = true,
  rank: rankProp,
  disableBadgeTooltip = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
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
    const handleUpdate = () => {
      setRank(rankCache[profile.id] || null);
    };
    handleUpdate();
    rankCacheListeners.add(handleUpdate);
    return () => {
      rankCacheListeners.delete(handleUpdate);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [profile.id]);

  // Determine which rank to display:
  // 1. Explicitly passed rankProp (e.g. LeaderboardRow passes the RPC rank)
  // 2. Globally cached rank from the same RPC (fed by app/page.tsx)
  // No badge.rank fallback: the top-performer badge stores LAST month's rank,
  // which briefly showed e.g. "#1" for a badged user whose current rank is #21.
  // Until the RPC responds, the rank label simply stays hidden.
  const displayRank = rankProp !== undefined ? rankProp : rank;

  const tooltipPositionClass = tooltipPosition === 'top'
    ? 'bottom-full mb-2.5'
    : 'top-full mt-2.5';

  return (
    <span className={`inline-flex items-center align-middle whitespace-normal ${nameClassName}`}>
      {/* Name with Tooltip Trigger wrapper */}
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative group inline-block align-middle select-none cursor-help pb-0.5"
      >
        <span className="align-middle">{profile.full_name || 'User'}</span>

        {/* Custom Hover Tooltip for Codename & Role Info */}
        {showTooltip && (
          <span className={`absolute left-1/2 -translate-x-1/2 ${tooltipPositionClass} flex flex-col gap-1 z-50 w-44 p-2.5 text-[11px] leading-relaxed text-theme-text-secondary bg-theme-page-bg/95 border border-theme-border-input rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto normal-case font-normal text-left`}>
            <div className="font-semibold text-theme-text-primary flex items-center flex-wrap gap-1">
              <span>Codename:</span>
              <span className="text-blue-400 font-mono select-all">{profile.username ? profile.username.toUpperCase() : ''}</span>
              {profile.role && (
                <span className="text-[10px] text-theme-text-muted font-normal">
                  ({isAdminRole(profile) ? 'Admin' : profile.role === 'supervisor' ? 'Supervisor' : 'Staff'})
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

      {/* Verified Badge next to the name with tight spacing - OUTSIDE the name hover trigger */}
      {showBadge && badge && (
        <span className="ml-1 inline-block align-middle shrink-0">
          <VerifiedBadge badge={badge} position={tooltipPosition} disableTooltip={disableBadgeTooltip} />
        </span>
      )}

      {/* Dynamic rank label rendered immediately after name/badge - OUTSIDE the name hover trigger */}
      {showRank && displayRank !== null && (
        <span className="text-[10px] text-theme-text-muted font-extrabold ml-1 inline-block align-middle shrink-0 select-none">
          #{String(displayRank).padStart(2, '0')}
        </span>
      )}
    </span>
  );
};
