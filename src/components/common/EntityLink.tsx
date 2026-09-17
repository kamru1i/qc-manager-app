'use client';

import React from 'react';
import { Layers, User, FileCode, Calendar, Building2 } from 'lucide-react';
import { useAppEventBus } from '@/contexts/AppEventBusContext';
import { Profile, QuotationMistake, RecordItem } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';

export type EntityLinkType = 'user' | 'quotation' | 'mistake' | 'leave' | 'branch';

export interface EntityLinkProps {
  type: EntityLinkType;
  // User identifier
  userId?: string;
  username?: string;
  profile?: Profile | null;
  displayName?: string;

  // Quotation identifier
  fileName?: string;
  record?: RecordItem;
  recordId?: string;

  // Mistake identifier
  mistake?: QuotationMistake;
  mistakeId?: string;

  // Leave identifier
  leaveRecord?: ChutiRecord;
  leaveId?: string;

  // Branch identifier
  branchName?: string;

  // Visual & Presentation
  children?: React.ReactNode;
  label?: string;
  className?: string;
  iconClassName?: string;
  showIcon?: boolean;
  variant?: 'text' | 'chip' | 'badge' | 'inspect-button' | 'custom';

  // Behavior
  title?: string;
  disabled?: boolean;
  stopPropagation?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

export const EntityLink: React.FC<EntityLinkProps> = ({
  type,
  userId,
  username,
  profile,
  displayName,
  fileName,
  record,
  recordId,
  mistake,
  mistakeId,
  leaveRecord,
  leaveId,
  branchName,
  children,
  label,
  className = '',
  iconClassName = 'w-3.5 h-3.5',
  showIcon = false,
  variant = 'text',
  title,
  disabled = false,
  stopPropagation = true,
  onClick,
  onDoubleClick,
}) => {
  const { emit } = useAppEventBus();

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    if (disabled) return;

    if (onClick) {
      onClick(e);
      return;
    }

    switch (type) {
      case 'user':
        emit('open-entity-drawer', {
          type: 'user',
          userId: userId || profile?.id,
          username: username || profile?.username || profile?.codename || undefined,
          profile: profile || undefined,
        });
        break;

      case 'quotation':
        emit('open-entity-drawer', {
          type: 'quotation',
          fileName: fileName || record?.file_name,
          record: record,
          recordId: recordId || record?.id,
        });
        break;

      case 'mistake':
        emit('open-entity-drawer', {
          type: 'mistake',
          mistake: mistake,
          mistakeId: mistakeId || mistake?.id,
        });
        break;

      case 'leave':
        emit('open-entity-drawer', {
          type: 'leave',
          leaveRecord: leaveRecord,
          leaveId: leaveId || leaveRecord?.id,
        });
        break;

      case 'branch': {
        const targetBranch = branchName || label || (typeof children === 'string' ? children : '');
        if (targetBranch) {
          emit('filter-quotations-branch', { branch: targetBranch });
          emit('quotes-tab-change', { tab: 'monthly' });
        }
        break;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      handleClick(e as unknown as React.MouseEvent);
    }
  };

  const defaultTitle =
    title ||
    (type === 'user'
      ? `Inspect user ${displayName || username || 'overview'}`
      : type === 'quotation'
      ? `Inspect quotation ${fileName || 'details'}`
      : type === 'mistake'
      ? 'Inspect mistake details'
      : type === 'leave'
      ? 'Inspect leave details'
      : type === 'branch'
      ? `Filter quotations by branch ${branchName || ''}`
      : undefined);

  // 1. Inspect Button Variant (for table rows, hover quick-inspect)
  if (variant === 'inspect-button') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={handleKeyDown}
        className={`inline-flex items-center justify-center p-1 rounded-md text-theme-text-muted hover:text-cyan-400 hover:bg-cyan-500/10 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer ${
          disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
        } ${className}`}
        title={defaultTitle}
        aria-label={defaultTitle}
      >
        {children || <Layers className={iconClassName} />}
      </button>
    );
  }

  // 2. Chip Variant (monospace code chip, e.g. for codename or filename)
  if (variant === 'chip') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={handleKeyDown}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs font-semibold bg-theme-page-bg/60 hover:bg-cyan-500/10 text-theme-text-secondary hover:text-cyan-400 border border-theme-border-input/60 hover:border-cyan-500/30 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
          disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
        } ${className}`}
        title={defaultTitle}
        aria-label={defaultTitle}
      >
        {showIcon && type === 'user' && <User className={iconClassName} />}
        {showIcon && type === 'quotation' && <FileCode className={iconClassName} />}
        {showIcon && type === 'branch' && <Building2 className={iconClassName} />}
        <span>{children || label || username || fileName || branchName}</span>
      </button>
    );
  }

  // 3. Badge Variant (pill badge, e.g. for branch or leave type)
  if (variant === 'badge') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={handleKeyDown}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 hover:brightness-110 active:scale-95 ${
          disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
        } ${className}`}
        title={defaultTitle}
        aria-label={defaultTitle}
      >
        {showIcon && type === 'branch' && <Building2 className={iconClassName} />}
        {showIcon && type === 'leave' && <Calendar className={iconClassName} />}
        {children || label || branchName}
      </button>
    );
  }

  // 4. Custom Wrapper Variant
  if (variant === 'custom') {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={handleKeyDown}
        className={`inline-flex items-center text-left transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
          disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
        } ${className}`}
        title={defaultTitle}
        aria-label={defaultTitle}
      >
        {children}
      </button>
    );
  }

  // 5. Default Text Variant
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      className={`inline-flex items-center gap-1 font-medium hover:text-cyan-400 hover:underline transition-colors text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded-xs ${
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
      } ${className}`}
      title={defaultTitle}
      aria-label={defaultTitle}
    >
      {showIcon && type === 'user' && <User className={iconClassName} />}
      {showIcon && type === 'quotation' && <FileCode className={iconClassName} />}
      {showIcon && type === 'mistake' && <Layers className={iconClassName} />}
      {showIcon && type === 'leave' && <Calendar className={iconClassName} />}
      {showIcon && type === 'branch' && <Building2 className={iconClassName} />}
      <span>{children || label || displayName || username || fileName || branchName}</span>
    </button>
  );
};
