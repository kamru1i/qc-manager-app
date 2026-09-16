'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SearchCategory } from '@/services/globalSearchService';

interface GlobalSearchContextType {
  isSearchOpen: boolean;
  openSearch: (initialCategory?: SearchCategory) => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  selectedInitialCategory?: SearchCategory;
  isShortcutsHelpOpen: boolean;
  openShortcutsHelp: () => void;
  closeShortcutsHelp: () => void;
  toggleShortcutsHelp: () => void;
  isMac: boolean;
}

const GlobalSearchContext = createContext<GlobalSearchContextType | undefined>(undefined);

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedInitialCategory, setSelectedInitialCategory] = useState<SearchCategory | undefined>();
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const platform = navigator.userAgent || navigator.platform || '';
      setIsMac(/Mac|iPod|iPhone|iPad/.test(platform));
    }
  }, []);

  const openSearch = useCallback((initialCategory?: SearchCategory) => {
    setSelectedInitialCategory(initialCategory);
    setIsShortcutsHelpOpen(false);
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSelectedInitialCategory(undefined);
  }, []);

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      if (prev) {
        setSelectedInitialCategory(undefined);
        return false;
      }
      setIsShortcutsHelpOpen(false);
      return true;
    });
  }, []);

  const openShortcutsHelp = useCallback(() => {
    setIsSearchOpen(false);
    setIsShortcutsHelpOpen(true);
  }, []);

  const closeShortcutsHelp = useCallback(() => {
    setIsShortcutsHelpOpen(false);
  }, []);

  const toggleShortcutsHelp = useCallback(() => {
    setIsShortcutsHelpOpen((prev) => {
      if (prev) return false;
      setIsSearchOpen(false);
      return true;
    });
  }, []);

  // Centralized keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // 1. Cmd/Ctrl + K: Toggle Spotlight Search
      if (isCmdOrCtrl && key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        toggleSearch();
        return;
      }

      // 2. Escape: Close search or shortcuts help
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          e.preventDefault();
          closeSearch();
          return;
        }
        if (isShortcutsHelpOpen) {
          e.preventDefault();
          closeShortcutsHelp();
          return;
        }
      }

      // 3. ?: Open Keyboard Shortcuts modal (Only when outside input, textarea, or contentEditable)
      if (e.key === '?' && !e.shiftKey === false) { // '?' requires shift on most keyboards, e.key is '?'
        const target = document.activeElement as HTMLElement | null;
        const isInput =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable);

        if (!isInput && !isSearchOpen && !isShortcutsHelpOpen) {
          e.preventDefault();
          openShortcutsHelp();
          return;
        }
      }

      // 4. Cmd/Ctrl + Enter: Safe context-aware form submission
      if (isCmdOrCtrl && e.key === 'Enter') {
        const target = document.activeElement as HTMLElement | null;
        if (target) {
          const formContainer = target.closest('[data-shortcut-form]') as HTMLElement | null;
          if (formContainer) {
            // Dispatch shortcut-submit to the container
            const customEvent = new CustomEvent('shortcut-submit', {
              bubbles: true,
              cancelable: true,
            });
            formContainer.dispatchEvent(customEvent);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isSearchOpen, isShortcutsHelpOpen, toggleSearch, closeSearch, openShortcutsHelp, closeShortcutsHelp]);

  return (
    <GlobalSearchContext.Provider
      value={{
        isSearchOpen,
        openSearch,
        closeSearch,
        toggleSearch,
        selectedInitialCategory,
        isShortcutsHelpOpen,
        openShortcutsHelp,
        closeShortcutsHelp,
        toggleShortcutsHelp,
        isMac,
      }}
    >
      {children}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  const context = useContext(GlobalSearchContext);
  if (!context) {
    throw new Error('useGlobalSearch must be used within a GlobalSearchProvider');
  }
  return context;
}
