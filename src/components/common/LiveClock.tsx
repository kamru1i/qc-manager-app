import React, { useState, useEffect } from "react";

interface LiveClockProps {
  showBd?: boolean;
  showUk?: boolean;
}

const BdFlagIcon: React.FC<{ className?: string }> = ({ className = "w-4.5 h-3" }) => (
  <svg
    className={`${className} rounded-xs overflow-hidden shrink-0 border border-white/20 shadow-xs inline-block align-middle`}
    viewBox="0 0 20 12"
    width="18"
    height="12"
    aria-label="Bangladesh Flag"
  >
    <rect width="20" height="12" fill="#006A4E" />
    <circle cx="9" cy="6" r="4" fill="#F42A41" />
  </svg>
);

const UkFlagIcon: React.FC<{ className?: string }> = ({ className = "w-4.5 h-3" }) => (
  <svg
    className={`${className} rounded-xs overflow-hidden shrink-0 border border-white/20 shadow-xs inline-block align-middle`}
    viewBox="0 0 60 30"
    width="18"
    height="12"
    aria-label="United Kingdom Flag"
  >
    <rect width="60" height="30" fill="#012169" />
    <path d="M0 0L60 30M60 0L0 30" stroke="#FFFFFF" strokeWidth="6" />
    <path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2" />
    <path d="M30 0V30M0 15H60" stroke="#FFFFFF" strokeWidth="10" />
    <path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth="6" />
  </svg>
);

// Reusable cached DateTimeFormat instances to avoid garbage collection and CPU overhead
const bdFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const ukFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatClockParts(formatter: Intl.DateTimeFormat, use24Hour: boolean = false) {
  try {
    const d = new Date();
    const parts = formatter.formatToParts(d);
    let day = "";
    let month = "";
    let year = "";
    let hour = "";
    let minute = "";
    let second = "";
    let dayPeriod = "";

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.type === "day") day = p.value;
      else if (p.type === "month") month = p.value;
      else if (p.type === "year") year = p.value;
      else if (p.type === "hour") hour = p.value;
      else if (p.type === "minute") minute = p.value;
      else if (p.type === "second") second = p.value;
      else if (p.type === "dayPeriod") dayPeriod = p.value;
    }

    const dateStr = `${day}-${month}-${year}`;
    let timeStr = `${hour}:${minute}:${second}`;
    if (!use24Hour && dayPeriod) {
      timeStr += ` ${dayPeriod.toUpperCase()}`;
    }

    return { dateStr, timeStr };
  } catch {
    return { dateStr: "", timeStr: "" };
  }
}

export const LiveClock: React.FC<LiveClockProps> = ({
  showBd = true,
  showUk = true,
}) => {
  const [bdClock, setBdClock] = useState<{ dateStr: string; timeStr: string } | null>(null);
  const [ukClock, setUkClock] = useState<{ dateStr: string; timeStr: string } | null>(null);

  useEffect(() => {
    const updateTime = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (showBd) {
        setBdClock(formatClockParts(bdFormatter, false));
      }
      if (showUk) {
        setUkClock(formatClockParts(ukFormatter, true));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateTime();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [showBd, showUk]);

  if (!showBd && !showUk) return null;

  return (
    <div className="hidden sm:flex flex-col justify-center gap-0.5 text-[11px] font-mono select-none">
      {/* BD Time Row */}
      {showBd && bdClock && bdClock.timeStr && (
        <div className="flex items-center gap-1.5 text-theme-text-primary">
          <BdFlagIcon />
          <span className="font-bold text-theme-text-primary">BD:</span>
          <span className="font-medium text-theme-text-secondary">{bdClock.dateStr}</span>
          <span className="text-theme-text-muted/60">•</span>
          <span className="font-bold text-theme-text-primary tracking-tight">{bdClock.timeStr}</span>
        </div>
      )}

      {/* UK Time Row */}
      {showUk && ukClock && ukClock.timeStr && (
        <div className="flex items-center gap-1.5 text-theme-text-primary">
          <UkFlagIcon />
          <span className="font-bold text-theme-text-primary">UK:</span>
          <span className="font-medium text-theme-text-secondary">{ukClock.dateStr}</span>
          <span className="text-theme-text-muted/60">•</span>
          <span className="font-bold text-theme-text-primary tracking-tight">{ukClock.timeStr}</span>
        </div>
      )}
    </div>
  );
};
