'use client';

import React from 'react';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Edit,
  ExternalLink,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { ActionableItem, ActionableActionButton } from '@/types/actionableWorkflows';

interface ActionableItemCardProps {
  item: ActionableItem;
}

export const ActionableItemCard: React.FC<ActionableItemCardProps> = ({ item }) => {
  const renderIcon = (icon?: ActionableActionButton['icon'], loading?: boolean) => {
    if (loading) {
      return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    }
    switch (icon) {
      case 'check':
        return <CheckCircle className="h-3.5 w-3.5" />;
      case 'x':
        return <XCircle className="h-3.5 w-3.5" />;
      case 'edit':
        return <Edit className="h-3.5 w-3.5" />;
      case 'external':
        return <ExternalLink className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const getButtonClasses = (btn: ActionableActionButton) => {
    const base =
      'px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 min-w-[84px]';

    switch (btn.variant) {
      case 'primary':
        return `${base} bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-sm`;
      case 'danger':
        return `${base} bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 shadow-sm`;
      case 'warning':
        return `${base} bg-amber-600 hover:bg-amber-500 text-white border border-amber-600 shadow-sm`;
      case 'secondary':
      default:
        return `${base} bg-theme-border-muted border border-theme-border-active hover:bg-theme-border-active text-theme-text-secondary hover:text-theme-text-primary`;
    }
  };

  const getNoteBoxClasses = (type?: 'info' | 'warning' | 'danger') => {
    switch (type) {
      case 'danger':
        return 'bg-rose-955/40 border-rose-900/50 text-rose-300';
      case 'warning':
        return 'bg-amber-955/40 border-amber-900/50 text-amber-300';
      case 'info':
      default:
        return 'bg-blue-955/40 border-blue-900/50 text-blue-300';
    }
  };

  return (
    <div className="bg-theme-page-bg/60 border border-theme-border-muted hover:border-theme-border-active/60 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 relative overflow-hidden transition-all shadow-sm">
      {/* Visual Accent Stripe */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${item.accentColorClass}`} />

      {/* Main Content Area */}
      <div className="space-y-1.5 text-xs text-theme-text-secondary font-medium pl-2 font-sans flex-1">
        {/* Header Badges & User Context */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-bold text-theme-text-primary text-sm">
            {item.requester.name}
          </span>

          {item.requester.username && (
            <span className="text-[10px] px-1.5 py-0.2 bg-theme-card-bg border border-theme-border-input rounded text-theme-text-muted font-mono font-bold">
              @{item.requester.username.toUpperCase()}
            </span>
          )}

          {item.targetUser && item.targetUser.name !== item.requester.name && (
            <span className="text-[10px] px-1.5 py-0.2 bg-purple-955/40 border border-purple-900/40 rounded text-purple-300 font-medium">
              Target: <span className="font-bold text-purple-200">{item.targetUser.name}</span>
            </span>
          )}

          <span
            className={`text-[9px] px-1.5 py-0.5 rounded border font-bold tracking-wide uppercase ${item.typeBadge.colorClass}`}
          >
            {item.typeBadge.label}
          </span>

          {item.status === 'needs_review' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-955/70 border border-amber-800 text-amber-300 font-bold tracking-wide uppercase flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              Needs Review
            </span>
          )}

          {item.timestamp && (
            <span className="text-[10px] text-theme-text-muted font-mono ml-auto md:ml-0">
              {new Date(item.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          )}
        </div>

        {/* Structured Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 py-1">
          {item.details.map((detail, idx) => {
            let valueClass = 'font-semibold text-theme-text-primary';
            if (detail.highlight === 'accent') {
              valueClass = 'font-bold text-theme-accent-primary';
            } else if (detail.highlight === 'danger') {
              valueClass = 'font-bold text-rose-400';
            } else if (detail.highlight === 'warning') {
              valueClass = 'font-bold text-amber-400';
            } else if (detail.highlight === 'mono') {
              valueClass = 'font-mono text-theme-text-secondary';
            }

            return (
              <div key={idx} className="flex items-baseline gap-1.5 text-xs">
                <span className="text-theme-text-muted shrink-0">{detail.label}:</span>
                <span className={valueClass}>{detail.value}</span>
              </div>
            );
          })}
        </div>

        {/* Informational Notes Box (e.g., review notes, removal reasons) */}
        {item.notes && (
          <div
            className={`mt-2 p-2.5 border rounded-lg text-xs flex flex-col gap-1 ${getNoteBoxClasses(
              item.notes.type
            )}`}
          >
            <div className="flex items-center gap-1 font-bold">
              {item.notes.type === 'danger' ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Info className="h-3 w-3" />
              )}
              <span>{item.notes.title}:</span>
            </div>
            <p className="text-theme-text-primary leading-relaxed whitespace-pre-line pl-4">
              {item.notes.content}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons Column / Bar */}
      <div className="flex flex-wrap md:flex-col justify-end items-end gap-2 shrink-0 font-sans pl-2 pt-2 md:pt-0 border-t md:border-t-0 border-theme-border-muted">
        {item.deepLink && (
          <button
            type="button"
            onClick={item.deepLink.onClick}
            className="px-2.5 py-1 text-[11px] font-medium text-theme-text-muted hover:text-theme-text-primary bg-theme-card-bg border border-theme-border-input hover:border-theme-border-active rounded-md transition-all flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="h-3 w-3" />
            {item.deepLink.label}
          </button>
        )}

        {item.actions.map((btn) => (
          <button
            key={btn.actionKey}
            type="button"
            disabled={btn.disabled || btn.loading}
            onClick={btn.onClick}
            className={getButtonClasses(btn)}
          >
            {renderIcon(btn.icon, btn.loading)}
            <span>{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
