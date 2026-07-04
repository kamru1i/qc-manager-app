import React from 'react';
import { TableSkeleton } from './skeleton/TableSkeleton';
import { StatsSkeleton } from './skeleton/StatsSkeleton';
import { ListSkeleton } from './skeleton/ListSkeleton';
import { ProfileHeaderSkeleton } from './skeleton/ProfileHeaderSkeleton';
import { LeavesTableSkeleton } from './skeleton/LeavesTableSkeleton';
import { UserManagementSkeleton } from './skeleton/UserManagementSkeleton';
import { ResponsesTableSkeleton } from './skeleton/ResponsesTableSkeleton';
import { SettlementsTableSkeleton } from './skeleton/SettlementsTableSkeleton';
import { ChutiFormSkeleton } from './skeleton/ChutiFormSkeleton';
import { LeaveHistorySkeleton } from './skeleton/LeaveHistorySkeleton';
import { LeaveSettingsSkeleton } from './skeleton/LeaveSettingsSkeleton';
import { TodoSkeleton } from './skeleton/TodoSkeleton';
import { AnalyticsSkeleton } from './skeleton/AnalyticsSkeleton';
import { AuditLogsSkeleton } from './skeleton/AuditLogsSkeleton';

interface SkeletonLoaderProps {
  variant?: 'table' | 'stats' | 'list' | 'profile-header' | 'leaves-table' | 'staff-table' | 'responses-table' | 'settlements-table' | 'chuti-form' | 'leave-history' | 'leave-settings' | 'todo' | 'analytics' | 'audit-logs';
  rows?: number;
  cards?: number;
  className?: string;
  allowOvertime?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'table',
  rows = 5,
  cards = 4,
  className = '',
  allowOvertime = false,
}) => {
  switch (variant) {
    case 'stats':
      return <StatsSkeleton cards={cards} className={className} />;
    case 'list':
      return <ListSkeleton rows={rows} className={className} />;
    case 'profile-header':
      return <ProfileHeaderSkeleton className={className} />;
    case 'leaves-table':
      return <LeavesTableSkeleton rows={rows} allowOvertime={allowOvertime} className={className} />;
    case 'staff-table':
      return <UserManagementSkeleton rows={rows} className={className} />;
    case 'responses-table':
      return <ResponsesTableSkeleton rows={rows} className={className} />;
    case 'settlements-table':
      return <SettlementsTableSkeleton className={className} />;
    case 'chuti-form':
      return <ChutiFormSkeleton className={className} />;
    case 'leave-history':
      return <LeaveHistorySkeleton allowOvertime={allowOvertime} className={className} />;
    case 'leave-settings':
      return <LeaveSettingsSkeleton className={className} />;
    case 'todo':
      return <TodoSkeleton className={className} />;
    case 'analytics':
      return <AnalyticsSkeleton className={className} />;
    case 'audit-logs':
      return <AuditLogsSkeleton className={className} />;
    case 'table':
    default:
      return <TableSkeleton rows={rows} className={className} />;
  }
};
