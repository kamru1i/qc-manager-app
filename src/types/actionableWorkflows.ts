import React from 'react';

export type ActionableCategory = 'all' | 'leave' | 'user_management' | 'other';

export type ActionableType =
  | 'leave_request'
  | 'reserve_adjustment'
  | 'leave_removal'
  | 'user_creation'
  | 'profile_change'
  | 'password_reset'
  | 'holiday_response'
  | 'settlement_response';

export type ActionableStatus = 'pending' | 'needs_review' | 'processing' | 'done';

export interface ActionableActionButton {
  label: string;
  actionKey: string;
  variant: 'primary' | 'danger' | 'warning' | 'secondary';
  icon?: 'check' | 'x' | 'refresh' | 'edit' | 'external';
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void | Promise<void>;
}

export interface ActionableDetailItem {
  label: string;
  value: React.ReactNode;
  highlight?: 'default' | 'accent' | 'danger' | 'warning' | 'mono';
}

export interface ActionableItem {
  id: string;
  category: 'leave' | 'user_management' | 'other';
  type: ActionableType;
  title: string;
  typeBadge: {
    label: string;
    colorClass: string;
  };
  accentColorClass: string;
  requester: {
    id?: string;
    name: string;
    username?: string;
    avatarUrl?: string | null;
    role?: string;
  };
  targetUser?: {
    id?: string;
    name: string;
    username?: string;
    role?: string;
  };
  timestamp?: string;
  status: ActionableStatus;
  details: ActionableDetailItem[];
  notes?: {
    title: string;
    content: string;
    type?: 'info' | 'warning' | 'danger';
  };
  actions: ActionableActionButton[];
  deepLink?: {
    label: string;
    onClick: () => void;
  };
  rawItem?: any;
}
