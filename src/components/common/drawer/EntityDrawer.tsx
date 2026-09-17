'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowLeft,
  User,
  FileSpreadsheet,
  AlertTriangle,
  Calendar,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useEntityDrawer } from '@/contexts/EntityDrawerContext';
import { useProfiles } from '@/contexts/ProfilesContext';
import { entityDrawerService } from '@/services/entityDrawerService';
import { Profile } from '@/types';
import {
  EntityDrawerRequest,
  UserEntityDetails,
  QuotationEntityDetails,
  MistakeEntityDetails,
  LeaveEntityDetails,
} from '@/types/entityDrawer';
import { EntityDrawerSkeleton } from './EntityDrawerSkeleton';
import { UserEntityContent } from './UserEntityContent';
import { QuotationEntityContent } from './QuotationEntityContent';
import { MistakeEntityContent } from './MistakeEntityContent';
import { LeaveEntityContent } from './LeaveEntityContent';
import { useAppEventBus } from '@/contexts/AppEventBusContext';

interface EntityDrawerProps {
  viewerProfile: Profile | null;
  onNavigateTab?: (tab: string, subtab?: string) => void;
}

export const EntityDrawer: React.FC<EntityDrawerProps> = ({
  viewerProfile,
  onNavigateTab,
}) => {
  const { isOpen, activeRequest, closeEntityDrawer } = useEntityDrawer();
  const { profilesList } = useProfiles();
  const { emit } = useAppEventBus();

  // Navigation history stack within drawer (e.g. Quote -> User -> Back)
  const [history, setHistory] = useState<EntityDrawerRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<EntityDrawerRequest | null>(null);

  // Loaded entity data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userDetails, setUserDetails] = useState<UserEntityDetails | null>(null);
  const [quotationDetails, setQuotationDetails] = useState<QuotationEntityDetails | null>(null);
  const [mistakeDetails, setMistakeDetails] = useState<MistakeEntityDetails | null>(null);
  const [leaveDetails, setLeaveDetails] = useState<LeaveEntityDetails | null>(null);

  // Sync with activeRequest from context
  useEffect(() => {
    if (isOpen && activeRequest) {
      setCurrentRequest(activeRequest);
      setHistory([]);
    } else if (!isOpen) {
      setHistory([]);
      setCurrentRequest(null);
    }
  }, [isOpen, activeRequest]);

  // Load data for currentRequest
  useEffect(() => {
    if (!isOpen || !currentRequest) return;

    let isSubscribed = true;
    setLoading(true);
    setError(null);

    const loadData = async () => {
      try {
        if (currentRequest.type === 'user') {
          const res = await entityDrawerService.fetchUserDetails(
            {
              userId: currentRequest.userId,
              username: currentRequest.username,
              profile: currentRequest.profile,
            },
            profilesList
          );
          if (isSubscribed) {
            if (res) setUserDetails(res);
            else setError('User profile could not be found.');
          }
        } else if (currentRequest.type === 'quotation') {
          const res = await entityDrawerService.fetchQuotationDetails(
            {
              recordId: currentRequest.recordId,
              record: currentRequest.record,
              fileName: currentRequest.fileName,
              codename: currentRequest.codename,
            },
            profilesList
          );
          if (isSubscribed) {
            if (res) setQuotationDetails(res);
            else setError('Quotation record could not be found.');
          }
        } else if (currentRequest.type === 'mistake') {
          const res = await entityDrawerService.fetchMistakeDetails(
            {
              mistakeId: currentRequest.mistakeId,
              mistake: currentRequest.mistake,
            },
            profilesList
          );
          if (isSubscribed) {
            if (res) setMistakeDetails(res);
            else setError('Mistake record could not be found.');
          }
        } else if (currentRequest.type === 'leave') {
          const res = await entityDrawerService.fetchLeaveDetails(
            {
              leaveId: currentRequest.leaveId,
              leaveRecord: currentRequest.leaveRecord,
            },
            profilesList
          );
          if (isSubscribed) {
            if (res) setLeaveDetails(res);
            else setError('Leave record could not be found.');
          }
        }
      } catch (err: any) {
        if (isSubscribed) {
          console.error('[EntityDrawer] Error loading entity:', err);
          setError(err?.message || 'Failed to load entity data.');
        }
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    loadData();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, currentRequest, profilesList]);

  // Handle drilling down into another entity (push to history)
  const handleOpenChildDrawer = useCallback((nextReq: EntityDrawerRequest) => {
    if (currentRequest) {
      setHistory((prev) => [...prev, currentRequest]);
    }
    setCurrentRequest(nextReq);
  }, [currentRequest]);

  // Handle back button
  const handleBack = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((prevStack) => prevStack.slice(0, -1));
    setCurrentRequest(prev);
  }, [history]);

  // Handle deep navigation to application pages
  const handleNavigateAction = useCallback(
    (action: {
      tab: string;
      subtab?: string;
      search?: string;
      userId?: string;
    }) => {
      closeEntityDrawer();

      // If user profile navigation
      if (action.userId && (action.tab === 'user_management' || action.subtab === 'profile' || action.subtab === 'leave')) {
        emit('open-user-profile', {
          userId: action.userId,
          subtab: action.subtab === 'leave' ? 'leave_history' : 'profile',
        });
        if (onNavigateTab) {
          onNavigateTab('user_management', action.subtab);
        }
        return;
      }

      // If quotation search navigation
      if (action.tab === 'quotes') {
        if (action.search) {
          emit('filter-quotations-search', { search: action.search });
        }
        emit('quotes-tab-change', { tab: action.subtab || 'entry' });
        if (onNavigateTab) {
          onNavigateTab('quotes', action.subtab || 'entry');
        }
        return;
      }

      // If leave tracker navigation
      if (action.tab === 'chuti') {
        emit('chuti-tab-change', { tab: action.subtab || 'dashboard' });
        if (onNavigateTab) {
          onNavigateTab('chuti', action.subtab);
        }
        return;
      }

      // General fallback
      if (onNavigateTab) {
        onNavigateTab(action.tab, action.subtab);
      }
    },
    [closeEntityDrawer, emit, onNavigateTab]
  );

  // Return null if not mounted or not open
  if (!isOpen) return null;

  const getEntityIconAndTitle = () => {
    switch (currentRequest?.type) {
      case 'user':
        return {
          icon: <User className="w-4 h-4 text-blue-400" />,
          label: 'User Overview',
        };
      case 'quotation':
        return {
          icon: <FileSpreadsheet className="w-4 h-4 text-purple-400" />,
          label: 'Quotation Context',
        };
      case 'mistake':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
          label: 'Mistake Inspection',
        };
      case 'leave':
        return {
          icon: <Calendar className="w-4 h-4 text-sky-400" />,
          label: 'Leave Overview',
        };
      default:
        return {
          icon: <Layers className="w-4 h-4 text-theme-text-muted" />,
          label: 'Entity Inspector',
        };
    }
  };

  const { icon, label } = getEntityIconAndTitle();

  const drawerContent = (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={closeEntityDrawer}
      />

      {/* Responsive Drawer Sheet */}
      <div
        className="relative z-50 w-full sm:w-[480px] md:w-[520px] lg:w-[560px] h-[90vh] sm:h-full max-h-screen bg-theme-page-bg/95 sm:bg-theme-card-bg border-t sm:border-t-0 sm:border-l border-theme-border-input/80 rounded-t-3xl sm:rounded-none shadow-2xl backdrop-blur-xl flex flex-col transition-all duration-300 animate-in slide-in-from-bottom sm:slide-in-from-right overflow-hidden self-end sm:self-stretch"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Grab Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-theme-border-input/80" />
        </div>

        {/* Drawer Header */}
        <div className="px-5 py-3.5 border-b border-theme-border-input/80 flex items-center justify-between bg-theme-card-bg/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-theme-border-input/60 text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer mr-0.5"
                title="Back to previous entity"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-7 h-7 rounded-lg bg-theme-page-bg border border-theme-border-input flex items-center justify-center shrink-0">
              {icon}
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-theme-text-primary truncate">
              {label}
            </span>
          </div>

          <button
            type="button"
            onClick={closeEntityDrawer}
            className="p-1.5 rounded-xl hover:bg-theme-border-input/60 text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer"
            title="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
          {loading ? (
            <EntityDrawerSkeleton />
          ) : error ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-theme-text-primary">{error}</p>
              <button
                type="button"
                onClick={closeEntityDrawer}
                className="px-4 py-1.5 bg-theme-card-bg border border-theme-border-input hover:border-theme-border-active rounded-xl text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          ) : currentRequest?.type === 'user' && userDetails ? (
            <UserEntityContent
              details={userDetails}
              viewerProfile={viewerProfile}
              onClose={closeEntityDrawer}
              onNavigateAction={handleNavigateAction}
              onOpenChildDrawer={handleOpenChildDrawer}
            />
          ) : currentRequest?.type === 'quotation' && quotationDetails ? (
            <QuotationEntityContent
              details={quotationDetails}
              viewerProfile={viewerProfile}
              onClose={closeEntityDrawer}
              onNavigateAction={handleNavigateAction}
              onOpenChildDrawer={handleOpenChildDrawer}
            />
          ) : currentRequest?.type === 'mistake' && mistakeDetails ? (
            <MistakeEntityContent
              details={mistakeDetails}
              viewerProfile={viewerProfile}
              onClose={closeEntityDrawer}
              onNavigateAction={handleNavigateAction}
              onOpenChildDrawer={handleOpenChildDrawer}
            />
          ) : currentRequest?.type === 'leave' && leaveDetails ? (
            <LeaveEntityContent
              details={leaveDetails}
              viewerProfile={viewerProfile}
              onClose={closeEntityDrawer}
              onNavigateAction={handleNavigateAction}
              onOpenChildDrawer={handleOpenChildDrawer}
            />
          ) : null}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(drawerContent, document.body)
    : null;
};
