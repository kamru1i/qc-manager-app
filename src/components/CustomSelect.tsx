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
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
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

  // Synchronize highlighted index when the dropdown is opened
  useEffect(() => {
    if (isOpen) {
      const activeIdx = options.findIndex((o) => o.value === value);
      setHighlightedIndex(activeIdx >= 0 ? activeIdx : 0);
    }
  }, [isOpen, options, value]);

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
        className="w-full flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed text-left min-h-[32px] select-none"
      >
        <span className="truncate">{activeOption ? activeOption.label : value}</span>
        <svg
          className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute left-0 mt-1 w-full min-w-[150px] bg-slate-955 border border-slate-800 rounded-lg shadow-2xl z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-64 overflow-y-auto custom-scrollbar"
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
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-355 hover:text-white'
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

