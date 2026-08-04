'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  className?: string;
  disabled?: boolean;
  buttonClassName?: string;
  dropUp?: boolean;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
  disabled = false,
  buttonClassName,
  dropUp,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [portalStyles, setPortalStyles] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchQueryRef = useRef<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelowViewport = window.innerHeight - rect.bottom;
    const spaceAboveViewport = rect.top;

    const isUp = dropUp || (spaceBelowViewport < 200 && spaceAboveViewport > spaceBelowViewport);
    setOpenUpward(isUp);

    const style: React.CSSProperties = {
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${Math.max(rect.width, 140)}px`,
      zIndex: 999999,
    };

    if (isUp) {
      style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
      style.top = `${rect.bottom + 6}px`;
    }

    setPortalStyles(style);
  }, [dropUp]);

  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Find matching option index (with float fallback for numeric strings like "6" vs "6.0")
  const getActiveOptionIndex = useCallback((opts: Option[], val: string) => {
    let idx = opts.findIndex((o) => o.value === val);
    if (idx >= 0) return idx;
    const numVal = parseFloat(val);
    if (!isNaN(numVal)) {
      idx = opts.findIndex((o) => parseFloat(o.value) === numVal);
    }
    return idx;
  }, []);

  useEffect(() => {
    if (isOpen) {
      const activeIdx = getActiveOptionIndex(options, value);
      setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0);
    }
  }, [isOpen, options, value, getActiveOptionIndex]);

  // Auto-scroll highlighted item inside dropdown container WITHOUT triggering window/page scroll
  useEffect(() => {
    if (isOpen && dropdownRef.current && itemRefs.current[highlightedIndex]) {
      const container = dropdownRef.current;
      const item = itemRefs.current[highlightedIndex];
      if (container && item) {
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;

        if (itemTop < containerTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          container.scrollTop = itemBottom - container.clientHeight;
        }
      }
    }
  }, [isOpen, highlightedIndex]);

  const activeOptionIdx = getActiveOptionIndex(options, value);
  const activeOption = activeOptionIdx >= 0 ? options[activeOptionIdx] : options[0];

  const handleTypeAhead = useCallback((char: string, isMenuOpen: boolean) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchQueryRef.current += char.toLowerCase();
    const query = searchQueryRef.current;

    searchTimeoutRef.current = setTimeout(() => {
      searchQueryRef.current = '';
    }, 1000);

    // Find first matching option starting with query
    const matchIdx = options.findIndex((opt) =>
      opt.label.toLowerCase().startsWith(query) || opt.value.toLowerCase().startsWith(query)
    );

    if (matchIdx !== -1) {
      if (isMenuOpen) {
        setHighlightedIndex(matchIdx);
      } else {
        onChange(options[matchIdx].value);
      }
    }
  }, [options, onChange]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    // Handle single character printable keys for type-ahead jump/filter
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key === ' ' && !searchQueryRef.current) {
        // Allow space to open or toggle when not typing query
      } else {
        e.preventDefault();
        handleTypeAhead(e.key, isOpen);
        return;
      }
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        updatePosition();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (options[highlightedIndex]) {
          onChange(options[highlightedIndex].value);
        }
        setIsOpen(false);
        break;
      case 'Escape':
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const dropdownContent = isOpen && mounted && typeof document !== 'undefined' ? (
    <div
      ref={dropdownRef}
      style={{ ...portalStyles, overscrollBehavior: 'contain' }}
      className={`bg-theme-card-bg border border-theme-border-input rounded-xl shadow-2xl py-1 max-h-64 overflow-y-auto custom-scrollbar ${
        openUpward
          ? 'animate-in fade-in slide-in-from-bottom-1 duration-150'
          : 'animate-in fade-in slide-in-from-top-1 duration-150'
      }`}
    >
      {options.map((option, idx) => {
        const isSelected = idx === activeOptionIdx;
        const isHighlighted = idx === highlightedIndex;

        return (
          <button
            key={option.value}
            ref={(el) => {
              itemRefs.current[idx] = el;
            }}
            type="button"
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
            onMouseEnter={() => setHighlightedIndex(idx)}
            className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer select-none ${
              isSelected
                ? 'bg-indigo-650/15 text-indigo-400'
                : isHighlighted
                ? 'bg-theme-border-input text-theme-text-inverse'
                : 'text-theme-text-secondary hover:text-theme-text-inverse'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block font-sans ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={buttonClassName || "w-full flex items-center justify-between gap-2 bg-theme-card-bg border border-theme-border-input text-theme-text-primary rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed text-left min-h-[32px] select-none"}
      >
        <span className="truncate">{activeOption ? activeOption.label : value}</span>
        <svg
          className={`h-3.5 w-3.5 text-theme-text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
};
