'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  X,
  Layers,
  Calendar,
  Users,
  Award,
} from 'lucide-react';
import {
  Profile,
  ChutiRecordWithProfile,
  BulkRepresentative,
  UserCreationRequest,
} from '@/types';
import {
  formatDate,
  formatTimeToAMPM,
  getLeaveDisplayComment,
} from '@/utils/dashboardHelpers';
import { resolveAssignedSupervisor } from '@/utils/profileHelpers';
import { supabase } from '@/utils/supabase';
import { useAppEventBus } from '@/contexts/AppEventBusContext';
import { ActionableItemCard } from '@/components/common/action-panel/ActionableItemCard';
import {
  ActionableCategory,
  ActionableItem,
  ActionableDetailItem,
  ActionableType,
} from '@/types/actionableWorkflows';
import {
  resolveActionableProfileDestination,
  executeActionableProfileNavigation,
} from '@/utils/actionableWorkflowHelpers';

interface LeaveApprovalPanelProps {
  role: 'admin' | 'supervisor';
  onCloseModal?: () => void;
  profilesList: Profile[];
  reviewingIds: Set<string>;
  approvedIds: Set<string>;
  approvingIds: Set<string>;

  // Leave Request Handlers
  groupedChutiRequests: BulkRepresentative[];
  handleApproveChutiRequest: (id: string, approve: boolean, allBulkIds?: string[]) => void;

  // Admin-only Props & Handlers
  pendingReserveRequests?: ChutiRecordWithProfile[];
  handleApproveReserveAdjustment?: (
    record: ChutiRecordWithProfile,
    approve: boolean
  ) => void;
  pendingProfileRequests?: Profile[];
  handleApproveProfileChangeRequest?: (id: string, approve: boolean) => void;
  pendingPasswordResetRequests?: Profile[];
  handleApprovePasswordResetRequest?: (id: string, approve: boolean) => void;
  adminHolidayNotifications?: any[];
  pendingRemovalRequests?: any[];
  handleApproveLeaveRemoval?: (record: any, approve: boolean) => void;

  // User Creation Workflow Props & Handlers
  pendingUserCreationRequests?: UserCreationRequest[];
  handleApproveUserCreationRequest?: (req: UserCreationRequest) => void;
  handleReviewUserCreationRequest?: (req: UserCreationRequest, notes: string) => void;
  onOpenUserCreationReview?: (req: UserCreationRequest) => void;
}

export function LeaveApprovalPanel({
  role,
  onCloseModal,
  profilesList,
  reviewingIds,
  approvedIds,
  approvingIds,
  groupedChutiRequests,
  handleApproveChutiRequest,
  pendingReserveRequests = [],
  handleApproveReserveAdjustment = () => {},
  pendingProfileRequests = [],
  handleApproveProfileChangeRequest = () => {},
  pendingPasswordResetRequests = [],
  handleApprovePasswordResetRequest = () => {},
  adminHolidayNotifications = [],
  pendingRemovalRequests = [],
  handleApproveLeaveRemoval = () => {},
  pendingUserCreationRequests = [],
  handleApproveUserCreationRequest = () => {},
  handleReviewUserCreationRequest = () => {},
  onOpenUserCreationReview,
}: LeaveApprovalPanelProps) {
  const { emit } = useAppEventBus();

  const [selectedCategory, setSelectedCategory] = useState<ActionableCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [localApprovingIds, setLocalApprovingIds] = useState<Set<string>>(new Set());
  const [reviewRequestPrompt, setReviewRequestPrompt] = useState<UserCreationRequest | null>(null);
  const [reviewPromptNotes, setReviewPromptNotes] = useState('');

  // Reset filter when role changes
  useEffect(() => {
    setSelectedCategory('all');
    setSearchQuery('');
  }, [role]);

  const handleDeepLinkProfile = useCallback(
    (userId?: string, itemType?: ActionableType, itemCategory?: ActionableCategory) => {
      if (!userId) return;
      const destinationTab = resolveActionableProfileDestination(itemType, itemCategory);
      executeActionableProfileNavigation({
        userId,
        destinationTab,
        emit,
        onCloseModal,
      });
    },
    [emit, onCloseModal]
  );

  const handleApproveResponse = async (nId: string, itemType: string) => {
    setLocalApprovingIds((prev) => new Set(prev).add(nId));
    try {
      if (itemType === 'admin_holiday_response') {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('dismissed_notifications')
            .insert({
              user_id: user.id,
              notification_id: nId,
            });
          if (error && error.code !== '23505') throw error;
        }
      } else if (itemType === 'admin_settlement_response') {
        const settlementId = nId.replace('admin-settlement-resp-', '');
        const { error } = await supabase
          .from('leave_settlements')
          .update({ status: 'processed' })
          .eq('id', settlementId);
        if (error) throw error;
      }
    } catch (err) {
      console.error('Failed to approve response:', err);
    } finally {
      setLocalApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(nId);
        return next;
      });
    }
  };

  // Convert raw data sources into standard ActionableItem objects
  const actionableItems = useMemo<ActionableItem[]>(() => {
    const list: ActionableItem[] = [];

    // 1. Leave Requests (Admin & Supervisor)
    groupedChutiRequests.forEach((r) => {
      const user = profilesList.find((p) => p.id === r.user_id);
      const isReviewing = reviewingIds.has(r.id);
      const isApproving = approvingIds.has(r.id);
      const isApproved = approvedIds.has(r.id);

      let accentColor = 'bg-purple-500';
      let typeBadgeColor = 'bg-purple-955/60 border-purple-900/60 text-purple-400';
      if (r.leave_type === 'Overtime') {
        accentColor = 'bg-emerald-500';
        typeBadgeColor = 'bg-emerald-955/60 border-emerald-900/60 text-emerald-400';
      } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(r.leave_type)) {
        accentColor = 'bg-blue-500';
        typeBadgeColor = 'bg-blue-955/60 border-blue-900/60 text-blue-400';
      }

      const details: ActionableDetailItem[] = [
        {
          label: 'Date',
          value: r.is_bulk && r.formatted_bulk_dates ? r.formatted_bulk_dates : formatDate(r.date),
        },
        {
          label: 'Leave Type',
          value: r.leave_type,
          highlight: 'accent',
        },
      ];

      if (r.leave_type !== 'Full Leave' && r.leave_hour) {
        details.push({
          label: 'Duration',
          value: `${r.leave_hour.substring(0, 5)} hrs`,
          highlight: 'mono',
        });
      }

      if (r.sign_in_time && r.sign_out_time) {
        details.push({
          label: 'Timing',
          value: `${formatTimeToAMPM(r.sign_in_time)} - ${formatTimeToAMPM(r.sign_out_time)}`,
          highlight: 'mono',
        });
      }

      if (r.adjustment) {
        details.push({
          label: 'Adjustment',
          value: r.adjustment,
          highlight: 'warning',
        });
      }

      const commentText = getLeaveDisplayComment(r);
      if (commentText) {
        details.push({
          label: 'Reason',
          value: commentText,
        });
      }

      if (r.reserve_holiday) {
        details.push({
          label: 'Reserve For',
          value: r.reserve_holiday,
          highlight: 'accent',
        });
      }

      const approveLabel = isApproved
        ? role === 'supervisor'
          ? 'Verified'
          : 'Approved'
        : role === 'supervisor'
        ? 'Verify'
        : 'Approve';

      list.push({
        id: `leave_${r.id}`,
        category: 'leave',
        type: 'leave_request',
        title: `${r.leave_type} Request`,
        typeBadge: {
          label: r.leave_type,
          colorClass: typeBadgeColor,
        },
        accentColorClass: accentColor,
        requester: {
          id: user?.id,
          name: user?.full_name || 'No Name',
          username: user?.username,
          role: user?.role,
        },
        timestamp: r.created_at || r.date,
        status: isReviewing ? 'needs_review' : isApproved ? 'done' : 'pending',
        details,
        actions: [
          {
            label: isReviewing ? 'Sending revision...' : 'Needs Review',
            actionKey: 'needs_review',
            variant: 'warning',
            icon: 'edit',
            disabled: isReviewing || isApproved,
            loading: isReviewing,
            onClick: () => handleApproveChutiRequest(r.id, false, r.all_bulk_ids),
          },
          {
            label: approveLabel,
            actionKey: 'approve',
            variant: 'primary',
            icon: 'check',
            disabled: isApproving || isApproved,
            loading: isApproving,
            onClick: () => handleApproveChutiRequest(r.id, true, r.all_bulk_ids),
          },
        ],
        deepLink: user?.id
          ? {
              label: 'View Profile',
              onClick: () => handleDeepLinkProfile(user.id, 'leave_request', 'leave'),
            }
          : undefined,
        rawItem: r,
      });
    });

    // 2. Reserve & Adjustment Requests (Admin only)
    if (role === 'admin') {
      pendingReserveRequests.forEach((r) => {
        const user = profilesList.find((p) => p.id === r.user_id);
        const isAdjustmentRequest = r.reserve_adjustment_status === 'pending';
        const isApproving = approvingIds.has(r.id);

        const details: ActionableDetailItem[] = [
          {
            label: 'Date',
            value: formatDate(r.date),
          },
          {
            label: 'Leave Type',
            value: r.leave_type,
            highlight: 'accent',
          },
        ];

        if (r.leave_type !== 'Full Leave' && r.leave_hour) {
          details.push({
            label: 'Duration',
            value: `${r.leave_hour.substring(0, 5)} hrs`,
            highlight: 'mono',
          });
        }

        if (r.adjustment) {
          details.push({
            label: 'Adjustment',
            value: r.adjustment,
            highlight: 'warning',
          });
        }

        if (r.comment) {
          details.push({
            label: 'Comment',
            value: r.comment,
          });
        }

        list.push({
          id: `reserve_${r.id}`,
          category: 'leave',
          type: 'reserve_adjustment',
          title: isAdjustmentRequest ? 'Adjustment Request' : 'Overtime Reserve',
          typeBadge: {
            label: isAdjustmentRequest ? 'Adjustment Request' : 'Overtime Reserve',
            colorClass: 'bg-emerald-955/60 border-emerald-900/60 text-emerald-400',
          },
          accentColorClass: 'bg-emerald-500',
          requester: {
            id: user?.id,
            name: user?.full_name || 'No Name',
            username: user?.username,
          },
          timestamp: r.created_at || r.date,
          status: 'pending',
          details,
          actions: [
            {
              label: 'Reject',
              actionKey: 'reject',
              variant: 'danger',
              icon: 'x',
              disabled: isApproving,
              onClick: () => handleApproveReserveAdjustment(r, false),
            },
            {
              label: 'Approve',
              actionKey: 'approve',
              variant: 'primary',
              icon: 'check',
              disabled: isApproving,
              loading: isApproving,
              onClick: () => handleApproveReserveAdjustment(r, true),
            },
          ],
          deepLink: user?.id
            ? {
                label: 'View Profile',
                onClick: () => handleDeepLinkProfile(user.id, 'reserve_adjustment', 'leave'),
              }
            : undefined,
          rawItem: r,
        });
      });

      // 3. Leave Removal Requests (Admin only)
      pendingRemovalRequests.forEach((req) => {
        const r = req.chuti || req;
        const user = profilesList.find((p) => p.id === (req.requester_id || r.user_id));
        const removalReason =
          req.reason ||
          (r.admin_edit_request as Record<string, unknown>)?.delete_reason;
        const isApproving = approvingIds.has(r.id);

        const details: ActionableDetailItem[] = [
          {
            label: 'Date',
            value: formatDate(r.date),
          },
          {
            label: 'Leave Type',
            value: r.leave_type,
            highlight: 'danger',
          },
        ];

        if (r.leave_type !== 'Full Leave' && r.leave_hour) {
          details.push({
            label: 'Duration',
            value: `${r.leave_hour.substring(0, 5)} hrs`,
            highlight: 'mono',
          });
        }

        if (r.comment) {
          details.push({
            label: 'Original Comment',
            value: r.comment,
          });
        }

        list.push({
          id: `removal_${r.id}`,
          category: 'leave',
          type: 'leave_removal',
          title: 'Leave Removal Request',
          typeBadge: {
            label: 'Removal Request',
            colorClass: 'bg-rose-955/60 border-rose-900/60 text-rose-400',
          },
          accentColorClass: 'bg-rose-500',
          requester: {
            id: user?.id,
            name: user?.full_name || 'No Name',
            username: user?.username,
          },
          timestamp: r.created_at || r.date,
          status: 'pending',
          details,
          notes: removalReason
            ? {
                title: 'Removal Reason',
                content: String(removalReason),
                type: 'danger',
              }
            : undefined,
          actions: [
            {
              label: 'Reject Removal',
              actionKey: 'reject_removal',
              variant: 'secondary',
              icon: 'x',
              disabled: isApproving,
              onClick: () => handleApproveLeaveRemoval(r, false),
            },
            {
              label: 'Approve Removal',
              actionKey: 'approve_removal',
              variant: 'danger',
              icon: 'check',
              disabled: isApproving,
              loading: isApproving,
              onClick: () => handleApproveLeaveRemoval(r, true),
            },
          ],
          deepLink: user?.id
            ? {
                label: 'View Profile',
                onClick: () => handleDeepLinkProfile(user.id, 'leave_removal', 'leave'),
              }
            : undefined,
          rawItem: req,
        });
      });

      // 4. Profile Change Requests (Admin only)
      pendingProfileRequests.forEach((p) => {
        const details: ActionableDetailItem[] = [];

        if (p.requested_full_name && p.requested_full_name !== p.full_name) {
          details.push({
            label: 'Full Name',
            value: `${p.full_name || '—'} → ${p.requested_full_name}`,
            highlight: 'accent',
          });
        }
        if (p.requested_job_role && p.requested_job_role !== p.job_role) {
          details.push({
            label: 'Job Role',
            value: `${p.job_role || '—'} → ${p.requested_job_role}`,
            highlight: 'accent',
          });
        }
        if (p.requested_working_hours != null && p.requested_working_hours !== p.working_hours) {
          details.push({
            label: 'Working Hours',
            value: `${p.working_hours ?? '—'} hrs → ${p.requested_working_hours} hrs`,
            highlight: 'mono',
          });
        }
        if (p.requested_break_time != null && p.requested_break_time !== p.break_time) {
          details.push({
            label: 'Break Time',
            value: `${p.break_time ?? '—'} mins → ${p.requested_break_time} mins`,
            highlight: 'mono',
          });
        }
        if (p.requested_default_sign_in && p.requested_default_sign_in !== p.default_sign_in) {
          details.push({
            label: 'Sign-In',
            value: `${formatTimeToAMPM(p.default_sign_in) || '—'} → ${formatTimeToAMPM(p.requested_default_sign_in) || '—'}`,
            highlight: 'mono',
          });
        }
        if (p.requested_default_sign_out && p.requested_default_sign_out !== p.default_sign_out) {
          details.push({
            label: 'Sign-Out',
            value: `${formatTimeToAMPM(p.default_sign_out) || '—'} → ${formatTimeToAMPM(p.requested_default_sign_out) || '—'}`,
            highlight: 'mono',
          });
        }

        list.push({
          id: `profile_${p.id}`,
          category: 'user_management',
          type: 'profile_change',
          title: 'Profile Change Request',
          typeBadge: {
            label: 'Profile Change',
            colorClass: 'bg-amber-955/60 border-amber-900/60 text-amber-400',
          },
          accentColorClass: 'bg-amber-500',
          requester: {
            id: p.id,
            name: p.full_name || 'Staff Member',
            username: p.username,
          },
          timestamp: p.created_at,
          status: 'pending',
          details,
          actions: [
            {
              label: 'Reject',
              actionKey: 'reject',
              variant: 'danger',
              icon: 'x',
              onClick: () => handleApproveProfileChangeRequest(p.id, false),
            },
            {
              label: 'Approve',
              actionKey: 'approve',
              variant: 'primary',
              icon: 'check',
              onClick: () => handleApproveProfileChangeRequest(p.id, true),
            },
          ],
          deepLink: {
            label: 'View Profile',
            onClick: () => handleDeepLinkProfile(p.id, 'profile_change', 'user_management'),
          },
          rawItem: p,
        });
      });

      // 5. Password Reset Requests (Admin only)
      pendingPasswordResetRequests.forEach((p) => {
        const details: ActionableDetailItem[] = [
          {
            label: 'Username',
            value: `@${p.username}`,
            highlight: 'mono',
          },
          {
            label: 'Request',
            value: 'Reset password to default: 1234',
            highlight: 'accent',
          },
        ];

        list.push({
          id: `pwd_${p.id}`,
          category: 'user_management',
          type: 'password_reset',
          title: 'Password Reset Request',
          typeBadge: {
            label: 'Password Reset',
            colorClass: 'bg-orange-955/60 border-orange-900/60 text-orange-400',
          },
          accentColorClass: 'bg-orange-500',
          requester: {
            id: p.id,
            name: p.full_name || 'Staff Member',
            username: p.username,
          },
          timestamp: p.created_at,
          status: 'pending',
          details,
          actions: [
            {
              label: 'Reject',
              actionKey: 'reject',
              variant: 'danger',
              icon: 'x',
              onClick: () => handleApprovePasswordResetRequest(p.id, false),
            },
            {
              label: 'Approve',
              actionKey: 'approve',
              variant: 'primary',
              icon: 'check',
              onClick: () => handleApprovePasswordResetRequest(p.id, true),
            },
          ],
          deepLink: {
            label: 'View Profile',
            onClick: () => handleDeepLinkProfile(p.id, 'password_reset', 'user_management'),
          },
          rawItem: p,
        });
      });

      // 6. Holiday & Settlement Responses (Admin only)
      adminHolidayNotifications.forEach((n) => {
        const isApproving = localApprovingIds.has(n.id);
        const details: ActionableDetailItem[] = [
          {
            label: 'Notification',
            value: n.body || n.text || n.title,
          },
        ];

        list.push({
          id: `response_${n.id}`,
          category: 'other',
          type:
            n.type === 'admin_settlement_response'
              ? 'settlement_response'
              : 'holiday_response',
          title: n.title || 'Response Notification',
          typeBadge: {
            label:
              n.type === 'admin_settlement_response'
                ? 'Settlement Choice'
                : 'Holiday Response',
            colorClass: 'bg-teal-955/60 border-teal-900/60 text-teal-400',
          },
          accentColorClass: 'bg-teal-500',
          requester: {
            name: 'System / User Notification',
          },
          timestamp: n.timestamp,
          status: 'pending',
          details,
          actions: [
            {
              label: isApproving ? 'Approving...' : 'Approve',
              actionKey: 'approve',
              variant: 'secondary',
              icon: 'check',
              disabled: isApproving,
              loading: isApproving,
              onClick: () => handleApproveResponse(n.id, n.type),
            },
          ],
          rawItem: n,
        });
      });
    }

    // 7. User Creation Requests (Admin approval & Supervisor revision)
    pendingUserCreationRequests.forEach((req) => {
      // Admins see requests awaiting approval; supervisors see requests needing revision
      if (role === 'admin' && req.status !== 'pending_admin_approval') return;
      if (role === 'supervisor' && req.status !== 'needs_review') return;

      const supData = resolveAssignedSupervisor(req, profilesList);
      const isApproving = localApprovingIds.has(req.id);

      const details: ActionableDetailItem[] = [
        {
          label: 'Requested Name',
          value: req.data?.full_name || '—',
          highlight: 'accent',
        },
        {
          label: 'Username / Codename',
          value: `@${req.data?.codename || '—'}`,
          highlight: 'mono',
        },
        {
          label: 'Role',
          value: req.data?.role || '—',
        },
        {
          label: 'Department',
          value: req.data?.department || req.data?.other_department || '—',
        },
      ];

      if (req.data?.working_hours || req.data?.workingHours) {
        details.push({
          label: 'Working Hours',
          value: `${req.data.working_hours || req.data.workingHours} hrs`,
          highlight: 'mono',
        });
      }

      if (req.data?.default_sign_in || req.data?.signInTime) {
        const inTime = formatTimeToAMPM(req.data.default_sign_in || req.data.signInTime);
        const outTime = formatTimeToAMPM(req.data.default_sign_out || req.data.signOutTime);
        details.push({
          label: 'Timing',
          value: `${inTime || '—'} - ${outTime || '—'}`,
          highlight: 'mono',
        });
      }

      if (supData.fullName) {
        details.push({
          label: 'Assigned Supervisor',
          value: `${supData.fullName} (@${supData.codename})`,
        });
      } else if (req.submitted_by_name) {
        details.push({
          label: 'Requested By',
          value: req.submitted_by_name,
        });
      }

      const actions: ActionableItem['actions'] = [];

      if (role === 'supervisor') {
        actions.push({
          label: 'Review & Update',
          actionKey: 'review_and_update',
          variant: 'warning',
          icon: 'edit',
          onClick: () => {
            if (onOpenUserCreationReview) {
              onOpenUserCreationReview(req);
            } else {
              onCloseModal?.();
              emit('close-approval-modals');
              emit('workspace-change', 'user_management');
              emit('settings-subtab-change', { subtab: 'user_management' });
              setTimeout(() => {
                emit('open-user-creation-review', req);
              }, 60);
            }
          },
        });
      } else {
        actions.push({
          label: 'Send for Review',
          actionKey: 'needs_review',
          variant: 'warning',
          icon: 'edit',
          disabled: isApproving,
          onClick: () => {
            setReviewRequestPrompt(req);
            setReviewPromptNotes('');
          },
        });
        actions.push({
          label: isApproving ? 'Approving...' : 'Approve Account',
          actionKey: 'approve_account',
          variant: 'primary',
          icon: 'check',
          disabled: isApproving,
          loading: isApproving,
          onClick: () => handleApproveUserCreationRequest(req),
        });
      }

      list.push({
        id: `user_req_${req.id}`,
        category: 'user_management',
        type: 'user_creation',
        title: 'User Account Request',
        typeBadge: {
          label: 'Account Request',
          colorClass: 'bg-blue-955/60 border-blue-900/60 text-blue-400',
        },
        accentColorClass: 'bg-blue-500',
        requester: {
          name: req.submitted_by_name || 'Supervisor',
          role: req.requester_role || 'Supervisor',
        },
        targetUser: {
          name: req.data?.full_name || req.data?.codename || 'New User',
          username: req.data?.codename,
          role: req.data?.role,
        },
        timestamp: req.updated_at || req.created_at,
        status: req.status === 'needs_review' ? 'needs_review' : 'pending',
        details,
        notes:
          req.status === 'needs_review' && req.admin_review_notes
            ? {
                title: 'Admin Review Notes',
                content: req.admin_review_notes,
                type: 'warning',
              }
            : undefined,
        actions,
        rawItem: req,
      });
    });

    // Sort by timestamp descending
    return list.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [
    groupedChutiRequests,
    profilesList,
    reviewingIds,
    approvingIds,
    approvedIds,
    role,
    handleApproveChutiRequest,
    pendingReserveRequests,
    handleApproveReserveAdjustment,
    pendingRemovalRequests,
    handleApproveLeaveRemoval,
    pendingProfileRequests,
    handleApproveProfileChangeRequest,
    pendingPasswordResetRequests,
    handleApprovePasswordResetRequest,
    adminHolidayNotifications,
    localApprovingIds,
    pendingUserCreationRequests,
    handleApproveUserCreationRequest,
    onOpenUserCreationReview,
    emit,
    handleDeepLinkProfile,
  ]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    let leave = 0;
    let userManagement = 0;
    let other = 0;

    actionableItems.forEach((item) => {
      if (item.category === 'leave') leave++;
      else if (item.category === 'user_management') userManagement++;
      else if (item.category === 'other') other++;
    });

    return {
      all: actionableItems.length,
      leave,
      user_management: userManagement,
      other,
    };
  }, [actionableItems]);

  // Filter items by category and search query
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return actionableItems.filter((item) => {
      // 1. Category Filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // 2. Search Query Filter
      if (!q) return true;

      const requesterName = item.requester.name.toLowerCase();
      const requesterUsername = (item.requester.username || '').toLowerCase();
      const targetName = (item.targetUser?.name || '').toLowerCase();
      const targetUsername = (item.targetUser?.username || '').toLowerCase();
      const title = item.title.toLowerCase();
      const badge = item.typeBadge.label.toLowerCase();
      const notes = (item.notes?.content || '').toLowerCase();

      if (
        requesterName.includes(q) ||
        requesterUsername.includes(q) ||
        targetName.includes(q) ||
        targetUsername.includes(q) ||
        title.includes(q) ||
        badge.includes(q) ||
        notes.includes(q)
      ) {
        return true;
      }

      // Check details
      return item.details.some(
        (d) =>
          d.label.toLowerCase().includes(q) ||
          (typeof d.value === 'string' && d.value.toLowerCase().includes(q))
      );
    });
  }, [actionableItems, selectedCategory, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Category Tabs & Search Bar */}
      <div className="space-y-3 bg-theme-page-bg/40 border border-theme-border-muted rounded-xl p-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-border-input/50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedCategory === 'all'
                  ? 'bg-purple-700/80 text-white'
                  : 'bg-theme-border-input text-theme-text-secondary'
              }`}
            >
              {categoryCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('leave')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
              selectedCategory === 'leave'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-border-input/50'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Leave & Adjustments</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedCategory === 'leave'
                  ? 'bg-purple-700/80 text-white'
                  : 'bg-theme-border-input text-theme-text-secondary'
              }`}
            >
              {categoryCounts.leave}
            </span>
          </button>

          {(role === 'admin' || categoryCounts.user_management > 0) && (
            <button
              type="button"
              onClick={() => setSelectedCategory('user_management')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                selectedCategory === 'user_management'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-border-input/50'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>User Management</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedCategory === 'user_management'
                    ? 'bg-purple-700/80 text-white'
                    : 'bg-theme-border-input text-theme-text-secondary'
                }`}
              >
                {categoryCounts.user_management}
              </span>
            </button>
          )}

          {role === 'admin' && categoryCounts.other > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('other')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                selectedCategory === 'other'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-border-input/50'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              <span>Settlement & Holidays</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedCategory === 'other'
                    ? 'bg-purple-700/80 text-white'
                    : 'bg-theme-border-input text-theme-text-secondary'
                }`}
              >
                {categoryCounts.other}
              </span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-theme-text-muted" />
          <input
            type="text"
            placeholder="Search by staff name, codename, leave type, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-theme-card-bg/80 border border-theme-border-input rounded-xl text-xs text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:border-purple-500/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 text-theme-text-muted hover:text-theme-text-primary rounded cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Actionable Items List */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>
              {role === 'supervisor' ? 'Supervisor Actionable Workflows' : 'Admin Action Center'}
            </span>
            <span className="text-theme-text-secondary">({filteredItems.length})</span>
          </h4>

          {(searchQuery || selectedCategory !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Reset Filter
            </button>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-theme-page-bg/40 border border-theme-border-muted rounded-xl text-theme-text-muted text-xs font-medium font-sans">
            No matching actionable items found.
          </div>
        ) : (
          <div className="space-y-3 font-sans max-h-[52vh] overflow-y-auto pr-1 custom-scrollbar">
            {filteredItems.map((item) => (
              <ActionableItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Admin: Send Account Request Back for Review Modal */}
      {reviewRequestPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-theme-card-bg border border-theme-border-input rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans">
            <h3 className="text-sm font-bold text-theme-text-primary">
              Send Account Request Back for Review
            </h3>
            <p className="text-xs text-theme-text-muted leading-relaxed">
              Provide feedback or specify required changes for Supervisor{' '}
              <strong className="text-theme-text-primary">
                {reviewRequestPrompt.submitted_by_name || 'the supervisor'}
              </strong>
              . They will see this in their Action Panel and can update the request.
            </p>
            <div>
              <label className="block text-xs font-semibold text-theme-text-secondary mb-1.5">
                Review Notes / Instructions *
              </label>
              <textarea
                value={reviewPromptNotes}
                onChange={(e) => setReviewPromptNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Please verify shift timings or correct the assigned branch..."
                className="w-full p-2.5 text-xs bg-theme-page-bg border border-theme-border-input rounded-xl text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReviewRequestPrompt(null);
                  setReviewPromptNotes('');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary bg-theme-border-input/50 hover:bg-theme-border-input rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reviewPromptNotes.trim()}
                onClick={() => {
                  handleReviewUserCreationRequest(
                    reviewRequestPrompt,
                    reviewPromptNotes.trim()
                  );
                  setReviewRequestPrompt(null);
                  setReviewPromptNotes('');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
