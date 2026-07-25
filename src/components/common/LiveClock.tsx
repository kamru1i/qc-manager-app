import React, { useState, useEffect } from "react";

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

export const LiveClock: React.FC = () => {
  const [bdClock, setBdClock] = useState<{ dateStr: string; timeStr: string } | null>(null);
  const [ukClock, setUkClock] = useState<{ dateStr: string; timeStr: string } | null>(null);

  useEffect(() => {
    const updateTime = () => {
      // BD: Local AM/PM time (12-hour)
      setBdClock(getTimeComponents("Asia/Dhaka", false));
      // UK: International 24-hour time
      setUkClock(getTimeComponents("Europe/London", true));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!bdClock || !ukClock || !bdClock.timeStr) return null;

  return (
    <div className="hidden sm:flex flex-col justify-center gap-1 text-[11px] font-mono select-none">
      {/* BD Time Row */}
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-950/20 text-theme-text-primary shadow-xs hover:border-emerald-500/50 transition-all">
        <span className="text-sm leading-none shrink-0" role="img" aria-label="Bangladesh Flag">
          🇧🇩
        </span>
        <span className="font-extrabold text-emerald-400">BD:</span>
        <span className="font-medium text-theme-text-secondary">{bdClock.dateStr}</span>
        <span className="text-theme-text-muted/60">•</span>
        <span className="font-bold text-emerald-300 tracking-tight">{bdClock.timeStr}</span>
      </div>

      {/* UK Time Row */}
      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-blue-500/30 bg-blue-950/20 text-theme-text-primary shadow-xs hover:border-blue-500/50 transition-all">
        <span className="text-sm leading-none shrink-0" role="img" aria-label="United Kingdom Flag">
          🇬🇧
        </span>
        <span className="font-extrabold text-blue-400">UK:</span>
        <span className="font-medium text-theme-text-secondary">{ukClock.dateStr}</span>
        <span className="text-theme-text-muted/60">•</span>
        <span className="font-bold text-blue-300 tracking-tight">{ukClock.timeStr}</span>
      </div>
    </div>
  );
};
