'use client';

import React, { useState, useRef, useEffect } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Synchronize highlighted index & detect vertical placement when the dropdown is opened
  useEffect(() => {
    if (isOpen) {
      const activeIdx = options.findIndex((o) => o.value === value);
      setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0);

      if (dropUp) {
        setOpenUpward(true);
        return;
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelowViewport = window.innerHeight - rect.bottom;
        
        let spaceBelowContainer = spaceBelowViewport;
        const scrollParent = containerRef.current.closest('.overflow-y-auto, .overflow-auto, .overflow-hidden');
        if (scrollParent) {
          const parentRect = scrollParent.getBoundingClientRect();
          spaceBelowContainer = parentRect.bottom - rect.bottom;
        }

        const effectiveSpaceBelow = Math.min(spaceBelowViewport, spaceBelowContainer);
        setOpenUpward(effectiveSpaceBelow < 220);
      }
    }
  }, [isOpen, options, value, dropUp]);

  const activeOption = options.find((o) => o.value === value) || options[0];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
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
        // Let Tab naturally cycle focus but close dropdown
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block font-sans ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
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

      {isOpen && (
        <div 
          className={`absolute left-0 w-full min-w-[150px] bg-theme-page-bg border border-theme-border-input rounded-lg shadow-2xl z-[100] py-1 max-h-64 overflow-y-auto custom-scrollbar ${
            openUpward
              ? 'bottom-full mb-1 animate-in fade-in slide-in-from-bottom-1 duration-150'
              : 'top-full mt-1 animate-in fade-in slide-in-from-top-1 duration-150'
          }`}
          style={{ overscrollBehavior: 'contain' }}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isHighlighted = idx === highlightedIndex;
 
            return (
              <button
                key={option.value}
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
      )}
    </div>
  );
};

