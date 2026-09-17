'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  Loader2,
  Compass,
  User,
  Building2,
  FileText,
  AlertTriangle,
  Calendar,
  CheckSquare,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Command,
  CornerDownLeft,
  Key,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { useAppEventBus } from '@/contexts/AppEventBusContext';
import { useProfiles } from '@/contexts/ProfilesContext';
import { useEntityDrawer } from '@/contexts/EntityDrawerContext';
import { Profile } from '@/types';
import {
  SearchCategory,
  SearchResultItem,
  SearchResultGroup,
  searchLocalEntities,
  searchRemoteEntities,
  groupSearchResults,
  APP_NAVIGATION_TARGETS,
} from '@/services/globalSearchService';
import { isAdminRole, isSuperadmin } from '@/utils/permissionService';

interface GlobalSearchModalProps {
  sessionUser: { id: string } | null;
  profile: Profile | null;
  onNavigateTab: (tab: any, subtab?: any) => void;
}

import {
  getRecentItems,
  recordRecentItem,
  removeRecentItem,
  clearRecentItems,
  isRecentItemAuthorized,
  RecentItem,
} from '@/services/recentItemsService';

const CATEGORY_TABS: { id: SearchCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'users', label: 'Staff' },
  { id: 'quotations', label: 'Quotes' },
  { id: 'mistakes', label: 'Mistakes' },
  { id: 'leave', label: 'Leave' },
  { id: 'rules', label: 'Rules' },
  { id: 'branches', label: 'Branches' },
  { id: 'login_codes', label: 'Login Codes' },
  { id: 'todos', label: 'Todos' },
  { id: 'navigation', label: 'Pages' },
];

export function GlobalSearchModal({ sessionUser, profile, onNavigateTab }: GlobalSearchModalProps) {
  const { isSearchOpen, closeSearch, openShortcutsHelp } = useGlobalSearch();
  const { emit } = useAppEventBus();
  const { profilesList } = useProfiles();
  const { openEntityDrawer } = useEntityDrawer();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory | 'all'>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Focus input & reload recent items when opened
  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
      setActiveCategory('all');
      setSelectedIndex(0);
      setRecentItems(getRecentItems(sessionUser?.id, profile, sessionUser));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchOpen, sessionUser, profile]);

  // Execute Search: Local (Immediate) + Remote (Debounced)
  useEffect(() => {
    if (!isSearchOpen) return;

    const trimmed = query.trim();

    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!trimmed) {
      setResults([]);
      setIsSearchingRemote(false);
      setSelectedIndex(0);
      return;
    }

    // 1. Immediate local search
    const localMatches = searchLocalEntities({
      query: trimmed,
      profile,
      profilesList,
    });
    setResults(localMatches);
    setSelectedIndex(0);

    // 2. Debounced remote search
    setIsSearchingRemote(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const debounceTimer = setTimeout(async () => {
      try {
        const remoteMatches = await searchRemoteEntities({
          query: trimmed,
          sessionUser,
          profile,
          profilesList,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setResults(() => {
            const currentLocal = searchLocalEntities({
              query: trimmed,
              profile,
              profilesList,
            });
            return [...currentLocal, ...remoteMatches];
          });
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingRemote(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query, isSearchOpen, profile, profilesList, sessionUser]);

  // Grouped results for 'all' tab
  const groupedResults = useMemo(() => {
    return groupSearchResults(results, query);
  }, [results, query]);

  // Linear flattened list of items currently visible for keyboard navigation
  const visibleItems = useMemo(() => {
    if (query.trim() === '') {
      return recentItems.map((r) => ({
        id: r.id,
        category: (r.type === 'rule' ? 'rules' : r.type) as SearchCategory,
        title: r.title,
        subtitle: r.subtitle,
        badge: r.badge,
        metadata: r.metadata as any,
      }));
    }
    if (activeCategory === 'all') {
      return groupedResults.flatMap((g) => g.items);
    }
    return results
      .filter((item) => item.category === activeCategory)
      .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  }, [query, recentItems, activeCategory, groupedResults, results]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: results.length };
    results.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [results]);

  // Ensure selectedIndex is within bounds
  useEffect(() => {
    if (selectedIndex >= visibleItems.length) {
      setSelectedIndex(Math.max(0, visibleItems.length - 1));
    }
  }, [visibleItems.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle removing a single recent item
  const handleRemoveRecent = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation();
      const updated = removeRecentItem(sessionUser?.id, itemId);
      setRecentItems(updated);
    },
    [sessionUser?.id]
  );

  // Handle clearing all recent items
  const handleClearRecents = useCallback(() => {
    clearRecentItems(sessionUser?.id);
    setRecentItems([]);
  }, [sessionUser?.id]);

  // Deep navigation for Recent items with authorization check
  const handleSelectRecentItem = useCallback(
    (item: RecentItem) => {
      // Re-verify current permission before navigation
      if (!isRecentItemAuthorized(item, profile, sessionUser)) {
        toast.error('You do not have permission to access this item.');
        return;
      }

      // Bump to the top of recents
      const updated = recordRecentItem(sessionUser?.id, {
        id: item.id,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        badge: item.badge,
        metadata: item.metadata,
      });
      setRecentItems(updated);
      closeSearch();

      switch (item.type) {
        case 'user': {
          openEntityDrawer({
            type: 'user',
            userId: item.metadata.userId,
            username: item.metadata.codename || item.metadata.username,
          });
          break;
        }

        case 'quotation': {
          openEntityDrawer({
            type: 'quotation',
            fileName: item.metadata.fileName,
            recordId: item.metadata.recordId,
          });
          break;
        }

        case 'mistake': {
          openEntityDrawer({
            type: 'mistake',
            mistakeId: item.metadata.mistakeId,
          });
          break;
        }

        case 'leave': {
          openEntityDrawer({
            type: 'leave',
            leaveId: item.metadata.leaveId,
          });
          break;
        }

        case 'branch': {
          const branch = item.metadata.branch || item.title;
          onNavigateTab('quotes', 'monthly');
          setTimeout(() => {
            emit('filter-quotations-branch', { branch });
          }, 50);
          break;
        }

        case 'rule': {
          onNavigateTab('quotes', 'rules');
          setTimeout(() => {
            emit('select-quote-rule', {
              ruleId: item.metadata.ruleId,
              search: item.metadata.search || item.title,
            });
          }, 50);
          break;
        }

        case 'login_codes': {
          onNavigateTab('quotes', 'login_codes');
          setTimeout(() => {
            emit('filter-login-codes', { search: item.metadata.search || item.title });
          }, 50);
          break;
        }

        case 'todos': {
          onNavigateTab('todo');
          break;
        }

        case 'navigation': {
          if (item.metadata.tab) {
            onNavigateTab(item.metadata.tab, item.metadata.subtab);
          }
          break;
        }

        default:
          break;
      }
    },
    [closeSearch, onNavigateTab, openEntityDrawer, emit, profile, sessionUser]
  );

  // Deep navigation action handler for search results
  const handleSelectItem = useCallback(
    (item: SearchResultItem) => {
      closeSearch();

      switch (item.category) {
        case 'navigation': {
          const { tab, subtab } = item.metadata || {};
          recordRecentItem(sessionUser?.id, {
            id: `nav:${tab}/${subtab || ''}`,
            type: 'navigation',
            title: item.title,
            subtitle: item.subtitle,
            badge: 'Page',
            metadata: { tab, subtab },
          });
          if (tab) {
            onNavigateTab(tab, subtab);
          }
          break;
        }

        case 'users': {
          const targetUserId = item.metadata?.userId || item.metadata?.user?.id;
          const codename = item.metadata?.user?.username || item.metadata?.user?.codename || item.title;
          recordRecentItem(sessionUser?.id, {
            id: `user:${targetUserId || codename}`,
            type: 'user',
            title: codename,
            subtitle: item.subtitle || 'Staff Member',
            badge: 'Staff',
            metadata: { userId: targetUserId, username: codename, codename },
          });
          openEntityDrawer({
            type: 'user',
            userId: targetUserId,
            username: codename,
          });
          break;
        }

        case 'branches': {
          const branchName = item.metadata?.branch || item.title;
          recordRecentItem(sessionUser?.id, {
            id: `branch:${branchName}`,
            type: 'branch',
            title: branchName,
            subtitle: 'Branch Quotations',
            badge: 'Branch',
            metadata: { branch: branchName },
          });
          onNavigateTab('quotes', 'monthly');
          setTimeout(() => {
            emit('filter-quotations-branch', { branch: branchName });
          }, 50);
          break;
        }

        case 'quotations': {
          const quotation = item.metadata?.quotation;
          const fileName = quotation?.file_name || item.title;
          recordRecentItem(sessionUser?.id, {
            id: `quotation:${fileName}`,
            type: 'quotation',
            title: fileName,
            subtitle: item.subtitle || 'Quotation Record',
            badge: 'Quote',
            metadata: { fileName, recordId: quotation?.id },
          });
          openEntityDrawer({
            type: 'quotation',
            fileName,
            record: quotation,
          });
          break;
        }

        case 'mistakes': {
          const mistake = item.metadata?.mistake;
          const mistakeId = mistake?.id || item.id;
          recordRecentItem(sessionUser?.id, {
            id: `mistake:${mistakeId}`,
            type: 'mistake',
            title: item.title,
            subtitle: item.subtitle || 'Mistake Record',
            badge: 'Mistake',
            metadata: { mistakeId, fileName: mistake?.file_name },
          });
          openEntityDrawer({
            type: 'mistake',
            mistake: mistake,
          });
          break;
        }

        case 'leave': {
          const leave = item.metadata?.leave;
          const leaveId = leave?.id || item.id;
          recordRecentItem(sessionUser?.id, {
            id: `leave:${leaveId}`,
            type: 'leave',
            title: item.title,
            subtitle: item.subtitle || 'Leave Record',
            badge: 'Leave',
            metadata: { leaveId, leaveUserId: leave?.user_id },
          });
          openEntityDrawer({
            type: 'leave',
            leaveRecord: leave,
          });
          break;
        }

        case 'rules': {
          const rule = item.metadata?.rule;
          const ruleId = rule?.id || item.id;
          recordRecentItem(sessionUser?.id, {
            id: `rule:${ruleId}`,
            type: 'rule',
            title: item.title,
            subtitle: item.subtitle || 'Quote Rule',
            badge: 'Rule',
            metadata: { ruleId, search: rule?.title || rule?.company_name || item.title },
          });
          onNavigateTab('quotes', 'rules');
          setTimeout(() => {
            emit('select-quote-rule', {
              ruleId: rule?.id,
              search: rule?.title || rule?.company_name || item.title,
            });
          }, 50);
          break;
        }

        case 'login_codes': {
          const lc = item.metadata?.loginCode;
          const codeId = lc?.id || item.id;
          recordRecentItem(sessionUser?.id, {
            id: `login_code:${codeId}`,
            type: 'login_codes',
            title: item.title,
            subtitle: item.subtitle || 'Supplier Login Code',
            badge: 'Login Code',
            metadata: { search: lc?.login_id || item.title },
          });
          if (lc?.code) {
            try {
              navigator.clipboard.writeText(lc.code);
              toast.success(`Copied code: ${lc.code} (${lc.login_id})`);
            } catch {}
          }
          onNavigateTab('quotes', 'login_codes');
          setTimeout(() => {
            emit('filter-login-codes', { search: lc?.login_id || item.title });
          }, 50);
          break;
        }

        case 'todos': {
          recordRecentItem(sessionUser?.id, {
            id: `todo:${item.id}`,
            type: 'todos',
            title: item.title,
            subtitle: item.subtitle || 'Personal Todo',
            badge: 'Todo',
            metadata: { tab: 'todo' },
          });
          onNavigateTab('todo');
          break;
        }

        default:
          break;
      }
    },
    [closeSearch, onNavigateTab, openEntityDrawer, emit, sessionUser?.id]
  );

  // Key navigation inside search modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < visibleItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : visibleItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim() === '') {
        if (recentItems[selectedIndex]) {
          handleSelectRecentItem(recentItems[selectedIndex]);
        }
      } else if (visibleItems[selectedIndex]) {
        handleSelectItem(visibleItems[selectedIndex]);
      }
    }
  };

  const getCategoryIcon = (category: SearchCategory) => {
    switch (category) {
      case 'navigation':
        return <Compass className="w-4 h-4 text-sky-400" />;
      case 'users':
        return <User className="w-4 h-4 text-emerald-400" />;
      case 'branches':
        return <Building2 className="w-4 h-4 text-amber-400" />;
      case 'quotations':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'mistakes':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'leave':
        return <Calendar className="w-4 h-4 text-indigo-400" />;
      case 'todos':
        return <CheckSquare className="w-4 h-4 text-teal-400" />;
      case 'rules':
        return <ShieldCheck className="w-4 h-4 text-purple-400" />;
      case 'login_codes':
        return <Key className="w-4 h-4 text-amber-400" />;
      default:
        return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  if (!isSearchOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Universal Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSearch();
      }}
    >
      <div
        className="w-full max-w-2xl bg-theme-card-bg border border-theme-border-input/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-150 text-theme-text-primary"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-theme-border-input/60 gap-3 relative bg-theme-card-bg/95">
          <Search className="w-5 h-5 text-theme-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search users, quotes, leave, mistakes..."
            className="w-full bg-transparent text-sm sm:text-base text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none"
          />
          {isSearchingRemote && (
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
          )}
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-page-bg transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={closeSearch}
            className="hidden sm:inline-flex items-center px-2 py-0.5 rounded border border-theme-border-input/80 text-[11px] font-mono text-theme-text-muted bg-theme-page-bg/60"
            title="Close"
          >
            ESC
          </button>
        </div>

        {/* Category Tabs (visible when results exist) */}
        {results.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-theme-border-input/40 bg-theme-page-bg/40 overflow-x-auto scrollbar-none">
            {CATEGORY_TABS.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              if (cat.id !== 'all' && count === 0) return null;
              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-card-bg border border-theme-border-input/40'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1 rounded-full ${
                      isActive ? 'bg-purple-700 text-white' : 'bg-theme-card-bg text-theme-text-muted'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Results List or Quick Suggestions */}
        <div ref={listRef} className="overflow-y-auto flex-1 p-2 space-y-1 divide-y divide-theme-border-input/20">
          {query.trim() === '' ? (
            /* Empty State: Recent Items & Quick Suggestions */
            <div className="p-4 space-y-4">
              {recentItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-theme-text-muted uppercase tracking-wider px-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Recent</span>
                    </div>
                    <button
                      onClick={handleClearRecents}
                      className="text-[11px] text-theme-text-muted hover:text-rose-400 normal-case font-normal transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentItems.map((item, rIdx) => {
                      const isSelected = rIdx === selectedIndex;
                      return (
                        <div
                          key={`recent-${item.id}`}
                          data-index={rIdx}
                          onClick={() => handleSelectRecentItem(item)}
                          onMouseEnter={() => setSelectedIndex(rIdx)}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer group transition-all ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'hover:bg-theme-page-bg/80 text-theme-text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div
                              className={`p-1.5 rounded-lg shrink-0 ${
                                isSelected
                                  ? 'bg-purple-700 text-white'
                                  : 'bg-theme-page-bg border border-theme-border-input/60 text-theme-text-muted'
                              }`}
                            >
                              {getCategoryIcon((item.type === 'rule' ? 'rules' : item.type) as SearchCategory)}
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-xs font-medium truncate flex items-center gap-1.5">
                                <span className={isSelected ? 'text-white' : 'text-theme-text-primary'}>
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span
                                    className={`text-[9px] uppercase px-1 py-0.2 rounded font-semibold ${
                                      isSelected
                                        ? 'bg-purple-800 text-purple-100'
                                        : 'bg-theme-page-bg text-theme-text-muted border border-theme-border-input/40'
                                    }`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              {item.subtitle && (
                                <div
                                  className={`text-[11px] truncate ${
                                    isSelected ? 'text-purple-200' : 'text-theme-text-muted'
                                  }`}
                                >
                                  {item.subtitle}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => handleRemoveRecent(e, item.id)}
                              title="Remove from recents"
                              className={`p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 ${
                                isSelected
                                  ? 'text-purple-200 hover:text-white hover:bg-purple-700'
                                  : 'text-theme-text-muted hover:text-rose-400 hover:bg-theme-page-bg'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <ArrowRight
                              className={`w-3.5 h-3.5 ${
                                isSelected ? 'text-white' : 'text-theme-text-muted opacity-0 group-hover:opacity-100'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Quick Navigation</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {APP_NAVIGATION_TARGETS.slice(0, 6).map((target) => (
                  <button
                    key={`${target.tab}-${target.subtab}`}
                    onClick={() => {
                      closeSearch();
                      onNavigateTab(target.tab, target.subtab);
                    }}
                    className="flex items-start gap-3 p-2.5 rounded-xl border border-theme-border-input/50 bg-theme-page-bg/40 hover:bg-theme-card-bg hover:border-purple-500/50 transition-all text-left group"
                  >
                    <div className="p-2 rounded-lg bg-theme-card-bg border border-theme-border-input/60 group-hover:border-purple-400/60 text-purple-400 shrink-0">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-medium text-theme-text-primary group-hover:text-purple-400 transition-colors truncate">
                        {target.label}
                      </div>
                      <div className="text-[11px] text-theme-text-muted truncate">
                        {target.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <div className="text-[11px] text-theme-text-muted flex items-center justify-between border-t border-theme-border-input/40 pt-3">
                  <span>Press <kbd className="px-1 py-0.5 rounded border border-theme-border-input font-mono text-[10px] bg-theme-page-bg">?</kbd> anytime outside inputs for keyboard shortcuts</span>
                  <button
                    onClick={() => {
                      closeSearch();
                      openShortcutsHelp();
                    }}
                    className="text-purple-400 hover:underline cursor-pointer"
                  >
                    View All Shortcuts
                  </button>
                </div>
              </div>
            </div>
          ) : visibleItems.length > 0 ? (
            /* Results List */
            activeCategory === 'all' ? (
              <div className="space-y-4 py-1">
                {groupedResults.map((group) => (
                  <div key={group.category} className="space-y-1">
                    {/* Category Header */}
                    <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-theme-text-muted uppercase tracking-wider flex items-center justify-between border-b border-theme-border-input/30">
                      <div className="flex items-center gap-1.5">
                        {getCategoryIcon(group.category)}
                        <span>{group.label}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-theme-page-bg text-theme-text-muted border border-theme-border-input/40">
                        {group.items.length}
                      </span>
                    </div>

                    {/* Category Items */}
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const linearIdx = visibleItems.findIndex((vi) => vi.id === item.id);
                        const isSelected = linearIdx === selectedIndex;
                        return (
                          <div
                            key={item.id}
                            data-index={linearIdx}
                            onClick={() => handleSelectItem(item)}
                            onMouseEnter={() => setSelectedIndex(linearIdx)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'hover:bg-theme-page-bg/80 text-theme-text-primary'
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div
                                className={`p-2 rounded-lg shrink-0 ${
                                  isSelected
                                    ? 'bg-purple-700 text-white'
                                    : 'bg-theme-page-bg border border-theme-border-input/60 text-theme-text-muted'
                                }`}
                              >
                                {getCategoryIcon(item.category)}
                              </div>
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium truncate flex items-center gap-2">
                                  <span>{item.title}</span>
                                  {item.badge && (
                                    <span
                                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md ${
                                        isSelected
                                          ? 'bg-purple-800 text-white'
                                          : 'bg-theme-page-bg/80 text-theme-text-muted border border-theme-border-input/40'
                                      }`}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                {item.subtitle && (
                                  <div
                                    className={`text-xs truncate ${
                                      isSelected ? 'text-purple-200' : 'text-theme-text-muted'
                                    }`}
                                  >
                                    {item.subtitle}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pl-2 shrink-0">
                              {isSelected && (
                                <CornerDownLeft className="w-4 h-4 text-purple-200 animate-pulse" />
                              )}
                              <ArrowRight
                                className={`w-3.5 h-3.5 ${
                                  isSelected
                                    ? 'text-white'
                                    : 'text-theme-text-muted opacity-0 group-hover:opacity-100'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-0.5 py-1">
                {visibleItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      data-index={idx}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'hover:bg-theme-page-bg/80 text-theme-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected
                              ? 'bg-purple-700 text-white'
                              : 'bg-theme-page-bg border border-theme-border-input/60 text-theme-text-muted'
                          }`}
                        >
                          {getCategoryIcon(item.category)}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.badge && (
                              <span
                                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md ${
                                  isSelected
                                    ? 'bg-purple-800 text-white'
                                    : 'bg-theme-page-bg/80 text-theme-text-muted border border-theme-border-input/40'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <div
                              className={`text-xs truncate ${
                                isSelected ? 'text-purple-200' : 'text-theme-text-muted'
                              }`}
                            >
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-2 shrink-0">
                        {isSelected && (
                          <CornerDownLeft className="w-4 h-4 text-purple-200 animate-pulse" />
                        )}
                        <ArrowRight
                          className={`w-3.5 h-3.5 ${
                            isSelected
                              ? 'text-white'
                              : 'text-theme-text-muted opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : !isSearchingRemote ? (
            /* No Results */
            <div className="py-12 text-center text-theme-text-muted space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-40 text-theme-text-muted" />
              <p className="text-sm font-medium">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-theme-text-muted">
                Try searching for staff names, quotation files, branches, or module names.
              </p>
            </div>
          ) : (
            /* Loading State */
            <div className="py-12 text-center text-theme-text-muted space-y-2">
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-purple-400" />
              <p className="text-xs">Thinking...</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-theme-border-input/60 bg-theme-page-bg/50 text-[11px] text-theme-text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded bg-theme-card-bg border border-theme-border-input font-mono">↑</kbd>
              <kbd className="px-1 rounded bg-theme-card-bg border border-theme-border-input font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 rounded bg-theme-card-bg border border-theme-border-input font-mono">↵</kbd>
              <span>to select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 rounded bg-theme-card-bg border border-theme-border-input font-mono">esc</kbd>
              <span>to exit</span>
            </span>
          </div>
          <button
            onClick={() => {
              closeSearch();
              openShortcutsHelp();
            }}
            className="hover:text-theme-text-primary transition-colors cursor-pointer"
          >
            Press <kbd className="px-1 rounded bg-theme-card-bg border border-theme-border-input font-mono">?</kbd> for help
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
