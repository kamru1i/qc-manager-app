'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Keyboard, X, Shield, Sparkles, CornerDownLeft } from 'lucide-react';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';

export function KeyboardShortcutsModal() {
  const { isShortcutsHelpOpen, closeShortcutsHelp, openSearch, isMac } = useGlobalSearch();

  if (!isShortcutsHelpOpen) return null;

  const cmdKey = isMac ? '⌘' : 'Ctrl';

  interface ShortcutItem {
    keys: string[];
    description: string;
    badge?: string;
  }

  interface ShortcutSection {
    title: string;
    items: ShortcutItem[];
  }

  const shortcutSections: ShortcutSection[] = [
    {
      title: 'Global Navigation',
      items: [
        {
          keys: [cmdKey, 'K'],
          description: 'Open Universal Search / Spotlight',
        },
        {
          keys: ['Esc'],
          description: 'Close active modal, dropdown, or search palette',
        },
        {
          keys: ['?'],
          description: 'Open this Keyboard Shortcuts help modal (when not typing in inputs)',
        },
      ],
    },
    {
      title: 'Safe Form Actions',
      items: [
        {
          keys: [cmdKey, 'Enter'],
          description: 'Quick-submit active supported forms (Quotation Entry, Apply Leave, Add/Edit Mistake)',
          badge: 'Safe Submit',
        },
      ],
    },
    {
      title: 'Spotlight Search Navigation',
      items: [
        {
          keys: ['↑', '↓'],
          description: 'Navigate up and down through search results',
        },
        {
          keys: ['Enter'],
          description: 'Select result and navigate immediately to target page/filter',
        },
        {
          keys: ['Esc'],
          description: 'Exit search palette',
        },
      ],
    },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeShortcutsHelp();
      }}
    >
      <div className="w-full max-w-lg bg-theme-card-bg border border-theme-border-input/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 text-theme-text-primary">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme-border-input/60 bg-theme-card-bg/95">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-theme-text-primary">Keyboard Shortcuts</h2>
              <p className="text-xs text-theme-text-muted">Boost productivity with quick access keys</p>
            </div>
          </div>
          <button
            onClick={closeShortcutsHelp}
            className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-page-bg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {shortcutSections.map((section) => (
            <div key={section.title} className="space-y-2.5">
              <h3 className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-theme-border-input/40 bg-theme-page-bg/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-theme-text-secondary">{item.description}</span>
                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-1 min-w-[24px] text-center font-mono text-xs font-semibold text-theme-text-primary bg-theme-card-bg border border-theme-border-input rounded-md shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Safety & Integrity Notice */}
          <div className="p-3.5 rounded-xl border border-theme-border-input/50 bg-theme-page-bg/30 flex items-start gap-3">
            <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-theme-text-muted leading-relaxed">
              <strong className="text-theme-text-primary">Safety note:</strong> Shortcuts never override browser system keys (such as Refresh or Tab closing). Safe form submission validates inputs before sending and never bypasses destructive confirmation modals.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-theme-border-input/60 bg-theme-page-bg/40 text-xs">
          <button
            onClick={() => {
              closeShortcutsHelp();
              openSearch();
            }}
            className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-medium transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Universal Search ({cmdKey}+K)</span>
          </button>
          <button
            onClick={closeShortcutsHelp}
            className="px-3 py-1.5 rounded-lg border border-theme-border-input text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-card-bg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
