import React, { useState, useRef, useEffect } from "react";
import { BadgeInfo } from "@/utils/leaderboardHelper";

interface VerifiedBadgeProps {
  badge: BadgeInfo;
  position?: 'top' | 'bottom';
  forceBlue?: boolean;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ badge, position = 'top', forceBlue = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isBlue = badge.badgeType === "blue" || forceBlue;
  const colorClass = isBlue
    ? "text-[#3b82f6] hover:text-[#60a5fa]"
    : "text-slate-400 hover:text-slate-300";

  const tooltipPositionClass = position === 'bottom'
    ? 'top-full mt-2'
    : 'bottom-full mb-2';

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
    <span 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative group inline-flex items-center align-middle ml-0.5 cursor-help select-none shrink-0"
    >
      {/* Premium Verified Icon */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`h-4 w-4 ${colorClass} transition-transform duration-200 group-hover:scale-110`}
      >
        <path d="M23 12l-2.44-2.79.18-3.69-3.61-.82-1.89-3.2L12 2.96 8.76 1.5 6.87 4.7 3.26 5.52l.18 3.69L1 12l2.44 2.79-.18 3.69 3.61.82 1.89 3.2L12 21.04l3.24 1.46 1.89-3.2 3.61-.82-.18-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z" />
      </svg>

      {/* Tooltip Popup */}
      {showTooltip && (
        <span className={`absolute left-1/2 -translate-x-1/2 ${tooltipPositionClass} z-50 w-56 p-2 text-[10px] leading-relaxed text-slate-350 bg-slate-950/95 border border-slate-800 rounded-lg shadow-2xl backdrop-blur-md animate-fade-in`}>
          <div className="font-bold text-white mb-0.5 flex items-center gap-1">
            <span className={isBlue ? "text-[#3b82f6]" : "text-slate-400"}>✓</span>
            {isBlue ? "Verified Top 3 Performer" : "Verified Top 5 Performer"}
          </div>
          <div className="text-[9px] text-slate-500">for {badge.monthName}</div>
          <div className="border-t border-slate-800 my-1"></div>
          <div>
            🏆 Streak:{" "}
            <span className="text-white font-semibold">
              {badge.consecutiveMonths} month(s)
            </span>{" "}
            in Top 5
          </div>
          <div>
            📅 Annual Wins:{" "}
            <span className="text-white font-semibold">
              {badge.yearlyTopPerformances} times
            </span>{" "}
            in {new Date().getFullYear()}
          </div>
        </span>
      )}
    </span>
  );
};
