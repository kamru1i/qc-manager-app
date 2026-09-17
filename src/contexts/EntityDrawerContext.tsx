'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { EntityDrawerRequest } from '@/types/entityDrawer';
import { useAppEvent } from './AppEventBusContext';

interface EntityDrawerContextType {
  isOpen: boolean;
  activeRequest: EntityDrawerRequest | null;
  openEntityDrawer: (request: EntityDrawerRequest) => void;
  closeEntityDrawer: () => void;
}

const EntityDrawerContext = createContext<EntityDrawerContextType | undefined>(undefined);

export function EntityDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<EntityDrawerRequest | null>(null);

  const openEntityDrawer = useCallback((request: EntityDrawerRequest) => {
    setActiveRequest(request);
    setIsOpen(true);
  }, []);

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
