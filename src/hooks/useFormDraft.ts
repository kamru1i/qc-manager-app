'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DraftFormType,
  StoredDraft,
  getDraft,
  saveDraft,
  clearDraft,
  isDraftMeaningful,
  getDraftStorageKey,
} from '@/services/draftService';

export interface UseFormDraftOptions<T> {
  formType: DraftFormType;
  userId: string | undefined;
  formData: T;
  onRestore: (data: T) => void;
  onDiscard?: () => void;
  isMeaningful?: (data: T) => boolean;
  debounceMs?: number;
  enabled?: boolean;
}

export function useFormDraft<T>({
  formType,
  userId,
  formData,
  onRestore,
  onDiscard,
  isMeaningful: customIsMeaningful,
  debounceMs = 600,
  enabled = true,
}: UseFormDraftOptions<T>) {
  const [storedDraft, setStoredDraft] = useState<StoredDraft<T> | null>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const wasEnabledRef = useRef(false);
  const isActivelyRestoringRef = useRef(false);

  const checkMeaningful = useCallback(
    (data: T): boolean => {
      if (customIsMeaningful) {
        return customIsMeaningful(data);
      }
      return isDraftMeaningful(formType, data);
    },
    [customIsMeaningful, formType],
  );

  // Check for existing draft on mount or when enabled transitions from false to true
  useEffect(() => {
    if (!enabled) {
      wasEnabledRef.current = false;
      return;
    }

    if (!wasEnabledRef.current) {
      wasEnabledRef.current = true;
      const draft = getDraft<T>(userId, formType);
      if (draft && checkMeaningful(draft.data)) {
        setStoredDraft(draft);
        setIsDraftModalOpen(true);
      }
    }
  }, [enabled, userId, formType, checkMeaningful]);

  // Debounced auto-save when formData changes
  useEffect(() => {
    if (!enabled || !wasEnabledRef.current || isDraftModalOpen || isActivelyRestoringRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (checkMeaningful(formData)) {
        saveDraft(userId, formType, formData);
      } else {
        clearDraft(userId, formType);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [formData, enabled, isDraftModalOpen, debounceMs, userId, formType, checkMeaningful]);

  // Multi-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = getDraftStorageKey(userId, formType);

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key !== storageKey) return;

      // If another tab cleared the draft (e.g. successful submit), clear locally
      if (!e.newValue) {
        setStoredDraft(null);
        setIsDraftModalOpen(false);
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [userId, formType]);

  const handleContinueDraft = useCallback(() => {
    if (!storedDraft) {
      setIsDraftModalOpen(false);
      return;
    }
    isActivelyRestoringRef.current = true;
    try {
      onRestore(storedDraft.data);
    } finally {
      setIsDraftModalOpen(false);
      // Allow the state setters to flush before re-enabling auto-save
      setTimeout(() => {
        isActivelyRestoringRef.current = false;
      }, 100);
    }
  }, [storedDraft, onRestore]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft(userId, formType);
    setStoredDraft(null);
    setIsDraftModalOpen(false);
    onDiscard?.();
  }, [userId, formType, onDiscard]);

  const handleDismissModal = useCallback(() => {
    setIsDraftModalOpen(false);
  }, []);

  const clearDraftOnSuccess = useCallback(() => {
    clearDraft(userId, formType);
    setStoredDraft(null);
    setIsDraftModalOpen(false);
  }, [userId, formType]);

  return {
    isDraftModalOpen,
    storedDraft,
    handleContinueDraft,
    handleDiscardDraft,
    handleDismissModal,
    clearDraftOnSuccess,
  };
}
