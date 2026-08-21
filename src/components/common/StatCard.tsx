import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  variant?: 'large' | 'small';
  icon: LucideIcon;
  iconBgClass?: string;
  iconColorClass?: string;
  iconBorderClass?: string;
  title: string;
  value: React.ReactNode;
  subtitle?: string | number;
  action?: React.ReactNode;
  bottomAction?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  variant = 'large',
  icon: Icon,
  iconBgClass = '',
  iconColorClass = '',
  iconBorderClass = '',
  title,
  value,
  subtitle,
  action,
  bottomAction,
  className = '',
  loading = false,
}) => {
  if (variant === 'small') {
    return (
      <div className={`flex-1 min-w-[150px] max-w-[280px] bg-theme-card-bg/20 border border-theme-border-input/70 rounded-xl p-3 flex items-center gap-2.5 ${className}`}>
        <Icon className={`h-4 w-4 shrink-0 ${iconColorClass}`} />
        <div className="flex-1 min-w-0">
          <span className="block text-[11px] text-theme-text-muted truncate">{title}</span>
          {loading ? (
            <div className="h-5 w-16 bg-theme-border-input/80 rounded animate-pulse mt-1" />
          ) : (
            <span className="block text-base font-bold text-theme-text-primary font-mono truncate">{value}</span>
          )}
        </div>
      </div>
    );
  }

  // Large Variant (Compact, Single-Line Friendly)
  return (
    <div className={`flex-1 min-w-[170px] sm:min-w-[185px] bg-theme-card-bg/40 border border-theme-border-input/70 hover:border-theme-border-active/60 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between gap-2 shadow-xs transition-all ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={`p-2 rounded-lg border shrink-0 ${iconBgClass} ${iconColorClass} ${iconBorderClass}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[11px] text-theme-text-muted font-medium truncate" title={title}>
              {title}
            </span>
            {loading ? (
              <div className="space-y-1 mt-1 w-full">
                <div className="h-5 w-20 bg-theme-border-input/80 rounded animate-pulse" />
                {subtitle && <div className="h-3 w-28 bg-theme-border-muted rounded animate-pulse" />}
              </div>
            ) : (
              <>
                <div className="text-lg sm:text-xl font-bold text-theme-text-primary mt-0.5 tracking-tight font-mono whitespace-nowrap">
                  {value}
                </div>
                {subtitle && (
                  <span className="block text-[10px] text-theme-text-muted mt-0.5 leading-tight truncate" title={String(subtitle)}>
                    {subtitle}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Top Right Action Button (e.g. Info or History Icon) */}
        {action && <div className="shrink-0 self-start">{action}</div>}
      </div>

      {/* Bottom Action Button (e.g. Add to Full Leave Button) */}
      {bottomAction && (
        <div className="w-full pt-0.5">
          {bottomAction}
        </div>
      )}
    </div>
  );
};
