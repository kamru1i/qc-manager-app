import React, { useState, useEffect } from "react";

interface LiveClockProps {
  showBd?: boolean;
  showUk?: boolean;
}

function getTimeComponents(timeZone: string, use24Hour: boolean = false) {
  try {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: !use24Hour,
    });

    const parts = formatter.formatToParts(d);
    const partMap: Record<string, string> = {};
    parts.forEach((p) => {
      partMap[p.type] = p.value;
    });

    const dateStr = `${partMap.day}-${partMap.month}-${partMap.year}`;
    let timeStr = `${partMap.hour}:${partMap.minute}:${partMap.second}`;
    if (!use24Hour && partMap.dayPeriod) {
      timeStr += ` ${partMap.dayPeriod.toUpperCase()}`;
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
      if (showBd) {
        setBdClock(getTimeComponents("Asia/Dhaka", false));
      }
      if (showUk) {
        setUkClock(getTimeComponents("Europe/London", true));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [showBd, showUk]);

  if (!showBd && !showUk) return null;

  return (
    <div className="hidden sm:flex flex-col justify-center gap-0.5 text-[11px] font-mono select-none">
      {/* BD Time Row (Clean & Minimal) */}
      {showBd && bdClock && bdClock.timeStr && (
        <div className="flex items-center gap-1.5 text-theme-text-primary">
          <span className="text-sm leading-none shrink-0" role="img" aria-label="Bangladesh Flag">
            🇧🇩
          </span>
          <span className="font-bold text-theme-text-primary">BD:</span>
          <span className="font-medium text-theme-text-secondary">{bdClock.dateStr}</span>
          <span className="text-theme-text-muted/60">•</span>
          <span className="font-bold text-theme-text-primary tracking-tight">{bdClock.timeStr}</span>
        </div>
      )}

      {/* UK Time Row (Clean & Minimal) */}
      {showUk && ukClock && ukClock.timeStr && (
        <div className="flex items-center gap-1.5 text-theme-text-primary">
          <span className="text-sm leading-none shrink-0" role="img" aria-label="United Kingdom Flag">
            🇬🇧
          </span>
          <span className="font-bold text-theme-text-primary">UK:</span>
          <span className="font-medium text-theme-text-secondary">{ukClock.dateStr}</span>
          <span className="text-theme-text-muted/60">•</span>
          <span className="font-bold text-theme-text-primary tracking-tight">{ukClock.timeStr}</span>
        </div>
      )}
    </div>
  );
};
