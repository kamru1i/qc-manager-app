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
  onIconClick?: () => void;
  iconTooltip?: string;
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
  onIconClick,
  iconTooltip,
  className = '',
  loading = false,
}) => {
  if (variant === 'small') {
    return (
      <div className={`flex-1 min-w-[140px] max-w-[280px] bg-theme-card-bg/20 border border-theme-border-input/70 rounded-xl p-2.5 flex items-center gap-2 ${className}`}>
        <Icon className={`h-4 w-4 shrink-0 ${iconColorClass}`} />
        <div className="flex-1 min-w-0">
          <span className="block text-[11px] text-theme-text-muted truncate">{title}</span>
          {loading ? (
            <div className="h-4.5 w-16 bg-theme-border-input/80 rounded animate-pulse mt-1" />
          ) : (
            <span className="block text-base font-bold text-theme-text-primary font-mono truncate">{value}</span>
          )}
        </div>
      </div>
    );
  }

  // Large Variant (Compact, Single-Line Friendly)
  return (
    <div className={`flex-1 min-w-[140px] sm:min-w-[150px] lg:min-w-0 bg-theme-card-bg/40 border border-theme-border-input/70 hover:border-theme-border-active/60 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 shadow-xs transition-all ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`p-2 rounded-lg border shrink-0 transition-all ${iconBgClass} ${iconColorClass} ${iconBorderClass} ${
              onIconClick
                ? 'cursor-pointer hover:scale-105 hover:brightness-125 hover:shadow-xs active:scale-95'
                : ''
            }`}
            onClick={onIconClick}
            title={iconTooltip || (onIconClick ? 'Click to view details' : undefined)}
            role={onIconClick ? 'button' : undefined}
            tabIndex={onIconClick ? 0 : undefined}
            onKeyDown={
              onIconClick
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onIconClick();
                    }
                  }
                : undefined
            }
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-[11px] text-theme-text-muted font-bold truncate" title={title}>
              {title}
            </span>
            {loading ? (
              <div className="space-y-1 mt-1 w-full">
                <div className="h-4.5 w-16 bg-theme-border-input/80 rounded animate-pulse" />
                {subtitle && <div className="h-2.5 w-20 bg-theme-border-muted rounded animate-pulse" />}
              </div>
            ) : (
              <>
                <div className="text-base sm:text-lg font-bold text-theme-text-primary mt-0.5 tracking-tight font-mono whitespace-nowrap truncate">
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

        {/* Top Right Action Button if any */}
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
