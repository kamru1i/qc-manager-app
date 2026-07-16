import React, { useState, useRef, useEffect } from "react";
import { Profile, RecordItem } from "@/types";
import { BadgeInfo } from "@/utils/leaderboardHelper";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";

// Global cache for all-time ranks mapping: profileId -> rank number
let rankCache: Record<string, number> = {};
const rankCacheListeners = new Set<() => void>();

export const updateGlobalRankCache = (records: RecordItem[], profiles: Profile[]) => {
  const counts: Record<string, number> = {};
  profiles.forEach((p) => {
    counts[p.id] = 0;
  });
  records.forEach((r) => {
    if (r.user_id && counts[r.user_id] !== undefined) {
      counts[r.user_id]++;
    }
  });

  // Sort descending by count, then alphabetically by username
  const sorted = [...profiles]
    .map((p) => ({
      id: p.id,
      count: counts[p.id] || 0,
      username: p.username.toUpperCase(),
    }))
    .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username));

  const newCache: Record<string, number> = {};
  sorted.forEach((item, index) => {
    newCache[item.id] = index + 1;
  });

  rankCache = newCache;
  rankCacheListeners.forEach((listener) => listener());
};

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
}

export const UserDisplayName: React.FC<UserDisplayNameProps> = ({
  profile,
  badge,
  nameClassName = "",
  tooltipPosition = "bottom",
  showBadge = true,
  showRank = true,
  rank: rankProp,
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
  // 1. Explicitly passed rankProp
  // 2. Globally computed rank from rankCache
  // 3. Fallback to rank inside the badge settings
  const displayRank = rankProp !== undefined ? rankProp : (rank !== null ? rank : (badge ? badge.rank : null));

  return (
    <span className="inline-flex items-center align-middle whitespace-nowrap">
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative group inline-flex items-center select-none cursor-help pb-0.5 ${nameClassName}`}
      >
        <span>{profile.full_name || 'User'}</span>

        {/* Custom Hover Tooltip for Codename & Role Info */}
        {showTooltip && (
          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 flex flex-col gap-1 z-50 w-44 p-2.5 text-[11px] leading-relaxed text-theme-text-secondary bg-theme-page-bg/95 border border-theme-border-input rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto normal-case font-normal text-left">
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

      {/* Verified Badge next to the name with tight spacing */}
      {showBadge && badge && (
        <span className="ml-1 inline-flex items-center align-middle">
          <VerifiedBadge badge={badge} position={tooltipPosition} />
        </span>
      )}

      {/* Dynamic rank label rendered immediately after name/badge */}
      {showRank && displayRank !== null && (
        <span className="text-[10px] text-theme-text-muted font-extrabold ml-1 select-none align-middle">
          #{String(displayRank).padStart(2, '0')}
        </span>
      )}
    </span>
  );
};
