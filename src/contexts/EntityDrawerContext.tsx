'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { EntityDrawerRequest } from '@/types/entityDrawer';
import { useAppEvent } from './AppEventBusContext';
import { recordRecentItem, RecentItemInput } from '@/services/recentItemsService';

interface EntityDrawerContextType {
  isOpen: boolean;
  activeRequest: EntityDrawerRequest | null;
  openEntityDrawer: (request: EntityDrawerRequest) => void;
  closeEntityDrawer: () => void;
}

function mapDrawerRequestToRecentItem(request: EntityDrawerRequest): RecentItemInput | null {
  if (!request || !request.type) return null;

  switch (request.type) {
    case 'user': {
      const codename = request.username || request.profile?.codename || request.profile?.username;
      const fullName = request.profile?.full_name;
      const title = codename || fullName || 'User Profile';
      const subtitle = fullName && codename ? `${fullName} • Staff` : 'Staff Member';
      return {
        id: `user:${request.userId || codename || 'unknown'}`,
        type: 'user',
        title,
        subtitle,
        badge: 'Staff',
        metadata: {
          userId: request.userId || request.profile?.id,
          username: codename,
          codename: codename,
        },
      };
    }

    case 'quotation': {
      const fileName = request.fileName || request.record?.file_name;
      if (!fileName && !request.recordId) return null;
      const title = fileName || 'Quotation';
      const branch = request.record?.branch_name;
      const date = request.record?.submitted_at ? request.record.submitted_at.split('T')[0] : undefined;
      const subtitle = branch ? `${branch}${date ? ` • ${date}` : ''}` : 'Quotation Record';
      return {
        id: `quotation:${fileName || request.recordId}`,
        type: 'quotation',
        title,
        subtitle,
        badge: 'Quote',
        metadata: {
          fileName,
          recordId: request.recordId || request.record?.id,
          codename: request.codename || request.record?.codename,
        },
      };
    }

    case 'mistake': {
      const mistake = request.mistake;
      const fileName = mistake?.filename;
      const id = request.mistakeId || mistake?.id || fileName;
      if (!id) return null;
      return {
        id: `mistake:${id}`,
        type: 'mistake',
        title: fileName ? `Mistake — ${fileName}` : 'Mistake Record',
        subtitle: mistake?.codename ? `${mistake.codename} • ${mistake.branch || ''}` : 'Mistake Record',
        badge: 'Mistake',
        metadata: {
          mistakeId: request.mistakeId || mistake?.id,
          fileName,
        },
      };
    }

    case 'leave': {
      const leave = request.leaveRecord;
      const id = request.leaveId || leave?.id;
      if (!id) return null;
      const staffName = leave?.username || 'Staff';
      return {
        id: `leave:${id}`,
        type: 'leave',
        title: `Leave — ${staffName}`,
        subtitle: `${leave?.leave_type || 'Leave'} • ${leave?.date || ''}`,
        badge: 'Leave',
        metadata: {
          leaveId: id,
          leaveUserId: leave?.user_id,
        },
      };
    }

    default:
      return null;
  }
}

const EntityDrawerContext = createContext<EntityDrawerContextType | undefined>(undefined);

export function EntityDrawerProvider({
  sessionUser,
  children,
}: {
  sessionUser?: { id: string } | null;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<EntityDrawerRequest | null>(null);

  const openEntityDrawer = useCallback(
    (request: EntityDrawerRequest) => {
      setActiveRequest(request);
      setIsOpen(true);

      // Record intentional entity access in user-scoped recent history
      const recentInput = mapDrawerRequestToRecentItem(request);
      if (recentInput) {
        recordRecentItem(sessionUser?.id, recentInput);
      }
    },
    [sessionUser?.id]
  );

  const closeEntityDrawer = useCallback(() => {
    setIsOpen(false);
    // Keep activeRequest momentarily for exit animation transition
    setTimeout(() => {
      setActiveRequest(null);
    }, 250);
  }, []);

  // Listen to AppEventBus events
  useAppEvent('open-entity-drawer', (request: EntityDrawerRequest) => {
    if (request && request.type) {
      openEntityDrawer(request);
    }
  });

  useAppEvent('record-recent-item', (input: RecentItemInput) => {
    if (input && input.id) {
      recordRecentItem(sessionUser?.id, input);
    }
  });

  useAppEvent('close-entity-drawer', () => {
    closeEntityDrawer();
  });

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeEntityDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeEntityDrawer]);

  return (
    <EntityDrawerContext.Provider
      value={{
        isOpen,
        activeRequest,
        openEntityDrawer,
        closeEntityDrawer,
      }}
    >
      {children}
    </EntityDrawerContext.Provider>
  );
}

export function useEntityDrawer() {
  const context = useContext(EntityDrawerContext);
  if (!context) {
    throw new Error('useEntityDrawer must be used within an EntityDrawerProvider');
  }
  return context;
}
