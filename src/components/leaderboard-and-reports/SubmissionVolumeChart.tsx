import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

interface MonthlyDataPoint {
  name: string;
  fullName: string;
  quotes: number;
  requotes: number;
  reviews: number;
  sales: number;
  total: number;
}

interface SubmissionVolumeChartProps {
  monthlyData: MonthlyDataPoint[];
  maxMonthlyVal: number;
  selectedYear: string;
}

export const SubmissionVolumeChart: React.FC<SubmissionVolumeChartProps> = ({
  monthlyData,
  maxMonthlyVal,
  selectedYear,
}) => {
  const [hoveredBar, setHoveredBar] = useState<{
    x: number;
    y: number;
    month: string;
    label: string;
    value: number;
    color: string;
  } | null>(null);

  return (
    <div className="lg:col-span-2 bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-5 rounded-2xl shadow-xl relative min-h-96">
      <h4 className="text-sm font-bold text-theme-text-primary mb-6 flex items-center gap-2">
        <Calendar className="h-4.5 w-4.5 text-blue-400" />
        Monthly Submission Volumes ({selectedYear})
      </h4>

      <div className="w-full h-64 relative">
        <svg
          viewBox="0 0 800 300"
          className="w-full h-full"
          onMouseLeave={() => setHoveredBar(null)}
        >
          <defs>
            <linearGradient id="quoteGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="requoteGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#7e22ce" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="reviewGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#be185d" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {Array.from({ length: 5 }).map((_, idx) => {
            const y = 30 + idx * 50;
            const gridVal = Math.round(maxMonthlyVal - (idx * maxMonthlyVal) / 4);
            return (
              <g key={idx}>
                <line x1="50" y1={y} x2="780" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                <text x="40" y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontWeight="600">
                  {gridVal}
                </text>
              </g>
            );
          })}

          {monthlyData.map((data, idx) => {
            const monthWidth = (780 - 50) / 12;
            const xStart = 50 + idx * monthWidth;
            const chartHeight = 200;
            const qHeight = maxMonthlyVal > 0 ? (data.quotes / maxMonthlyVal) * chartHeight : 0;
            const rHeight = maxMonthlyVal > 0 ? (data.requotes / maxMonthlyVal) * chartHeight : 0;
            const revHeight = maxMonthlyVal > 0 ? (data.reviews / maxMonthlyVal) * chartHeight : 0;
            const sHeight = maxMonthlyVal > 0 ? (data.sales / maxMonthlyVal) * chartHeight : 0;

            const barWidth = 8;
            const gap = 2;
            const xCenter = xStart + monthWidth / 2;

            const qX = xCenter - 2 * barWidth - 1.5 * gap;
            const rX = xCenter - barWidth - 0.5 * gap;
            const revX = xCenter + 0.5 * gap;
            const sX = xCenter + barWidth + 1.5 * gap;
            const baseLineY = 230;

            const handleMouseEnter = (e: React.MouseEvent<SVGRectElement>, label: string, value: number, color: string) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const container = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
              if (rect && container) {
                setHoveredBar({
                  x: rect.left - container.left + barWidth / 2,
                  y: rect.top - container.top - 40,
                  month: data.fullName,
                  label,
                  value,
                  color,
                });
              }
            };

            return (
              <g key={idx}>
                <text x={xStart + monthWidth / 2} y="255" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="600">
                  {data.name}
                </text>
                {data.quotes > 0 && (
                  <rect x={qX} y={baseLineY - qHeight} width={barWidth} height={qHeight} fill="url(#quoteGrad)" rx="2" ry="2"
                    className="cursor-pointer transition-all duration-250 hover:brightness-125"
                    onMouseEnter={(e) => handleMouseEnter(e, 'Quotes', data.quotes, '#3b82f6')} />
                )}
                {data.requotes > 0 && (
                  <rect x={rX} y={baseLineY - rHeight} width={barWidth} height={rHeight} fill="url(#requoteGrad)" rx="2" ry="2"
                    className="cursor-pointer transition-all duration-250 hover:brightness-125"
                    onMouseEnter={(e) => handleMouseEnter(e, 'Requotes', data.requotes, '#a855f7')} />
                )}
                {data.reviews > 0 && (
                  <rect x={revX} y={baseLineY - revHeight} width={barWidth} height={revHeight} fill="url(#reviewGrad)" rx="2" ry="2"
                    className="cursor-pointer transition-all duration-250 hover:brightness-125"
                    onMouseEnter={(e) => handleMouseEnter(e, 'Reviews', data.reviews, '#ec4899')} />
                )}
                {data.sales > 0 && (
                  <rect x={sX} y={baseLineY - sHeight} width={barWidth} height={sHeight} fill="url(#saleGrad)" rx="2" ry="2"
                    className="cursor-pointer transition-all duration-250 hover:brightness-125"
                    onMouseEnter={(e) => handleMouseEnter(e, 'Sales', data.sales, '#10b981')} />
                )}
              </g>
            );
          })}

          <line x1="50" y1="230" x2="780" y2="230" stroke="#475569" strokeWidth="1" opacity="0.5" />
        </svg>

        {hoveredBar && (
          <div
            className="absolute bg-theme-card-bg border border-theme-border-input rounded-xl px-3 py-2 text-[11px] text-theme-text-primary shadow-2xl pointer-events-none z-45 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
            style={{ left: `${hoveredBar.x}px`, top: `${hoveredBar.y}px`, transform: 'translateX(-50%)' }}
          >
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{hoveredBar.month}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredBar.color }}></span>
              <span className="font-semibold">{hoveredBar.label}:</span>
              <span className="font-extrabold" style={{ color: hoveredBar.color }}>{hoveredBar.value} files</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center items-center gap-6 mt-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[#3b82f6] border border-[#1d4ed8]/50"></span>
          <span className="text-slate-400 font-medium">Quotes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[#a855f7] border border-[#7e22ce]/50"></span>
          <span className="text-slate-400 font-medium">Requotes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[#ec4899] border border-[#be185d]/50"></span>
          <span className="text-slate-400 font-medium">Reviews</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[#10b981] border border-[#047857]/50"></span>
          <span className="text-slate-400 font-medium">Sales</span>
        </div>
      </div>
    </div>
  );
};
