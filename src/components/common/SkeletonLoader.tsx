import React from 'react';
import { TableSkeleton } from '@/components/common/skeleton/TableSkeleton';
import { StatsSkeleton } from '@/components/common/skeleton/StatsSkeleton';
import { ListSkeleton } from '@/components/common/skeleton/ListSkeleton';
import { ProfileHeaderSkeleton } from '@/components/common/skeleton/ProfileHeaderSkeleton';
import { LeavesTableSkeleton } from '@/components/common/skeleton/LeavesTableSkeleton';
import { UserManagementSkeleton } from '@/components/common/skeleton/UserManagementSkeleton';
import { ResponsesTableSkeleton } from '@/components/common/skeleton/ResponsesTableSkeleton';
import { SettlementsTableSkeleton } from '@/components/common/skeleton/SettlementsTableSkeleton';
import { ChutiFormSkeleton } from '@/components/common/skeleton/ChutiFormSkeleton';
import { LeaveHistorySkeleton } from '@/components/common/skeleton/LeaveHistorySkeleton';
import { LeaveSettingsSkeleton } from '@/components/common/skeleton/LeaveSettingsSkeleton';
import { TodoSkeleton } from '@/components/common/skeleton/TodoSkeleton';
import { LeaderboardSkeleton } from '@/components/common/skeleton/LeaderboardSkeleton';
import { AuditLogsSkeleton } from '@/components/common/skeleton/AuditLogsSkeleton';
import { TeamLeaveRecordsSkeleton } from '@/components/common/skeleton/TeamLeaveRecordsSkeleton';
import { ProfileSettingsSkeleton } from '@/components/common/skeleton/ProfileSettingsSkeleton';
import { KpiSkeleton } from '@/components/common/skeleton/KpiSkeleton';
import { CopyHelperSkeleton } from '@/components/common/skeleton/CopyHelperSkeleton';

interface SkeletonLoaderProps {
  variant?: 'table' | 'stats' | 'list' | 'profile-header' | 'leaves-table' | 'staff-table' | 'responses-table' | 'settlements-table' | 'chuti-form' | 'leave-history' | 'leave-settings' | 'todo' | 'leaderboard' | 'audit-logs' | 'team-leaves-report' | 'profile-settings' | 'kpi' | 'copy-helper' | 'save-file';
  type?: string;
  rows?: number;
  cards?: number;
  className?: string;
  allowOvertime?: boolean;
  showNameColumn?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant,
  type,
  rows = 5,
  cards = 4,
  className = '',
  allowOvertime = false,
  showNameColumn = false,
}) => {
  const activeVariant = type || variant || 'table';

  switch (activeVariant) {
    case 'copy-helper':
    case 'copy_helper':
      return <CopyHelperSkeleton className={className} />;
    case 'stats':
      return <StatsSkeleton cards={cards} className={className} />;
    case 'list':
      return <ListSkeleton rows={rows} className={className} />;
    case 'profile-header':
      return <ProfileHeaderSkeleton className={className} />;
    case 'leaves-table':
      return <LeavesTableSkeleton rows={rows} allowOvertime={allowOvertime} showNameColumn={showNameColumn} className={className} />;
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
    case 'leaderboard':
      return <LeaderboardSkeleton className={className} />;
    case 'audit-logs':
      return <AuditLogsSkeleton className={className} />;
    case 'team-leaves-report':
      return <TeamLeaveRecordsSkeleton />;
    case 'profile-settings':
      return <ProfileSettingsSkeleton className={className} />;
    case 'kpi':
      return <KpiSkeleton className={className} />;
    case 'table':
    default:
      return <TableSkeleton rows={rows} className={className} />;
  }
};
