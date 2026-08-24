'use client';

import React, { useRef } from 'react';
import { formatTimeToAMPM } from '@/utils/quotesDashboardHelpers';
import { usePreferredTimeFormat, formatTimeForDisplay } from '@/utils/timeFormatHelpers';

interface TimeInputProps {
  value: string; // Canonical "HH:mm" e.g. "13:00" or "10:30"
  onChange: (val: string) => void;
  label?: string;
  showAmPmBadge?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  label,
  showAmPmBadge = true,
  required = false,
  disabled = false,
  className = '',
  placeholder,
}) => {
  const timePickerRef = useRef<HTMLInputElement>(null);
  const { is24Hour } = usePreferredTimeFormat();

  const handleOpenPicker = () => {
    if (disabled) return;
    try {
      if (timePickerRef.current) {
        if (typeof timePickerRef.current.showPicker === 'function') {
          timePickerRef.current.showPicker();
        } else {
          timePickerRef.current.focus();
          timePickerRef.current.click();
        }
      }
    } catch {
      timePickerRef.current?.focus();
    }
  };

  // Header display badge above the field: ALWAYS in standard AM/PM format (e.g. 02:00 PM)
  const headerBadgeTime = value ? formatTimeToAMPM(value) : '';

  // Input field display text: locale-aware (24h "14:00" vs 12h "02:00 PM")
  const displayTime = value ? formatTimeForDisplay(value, is24Hour) : '';
  const defaultPlaceholder = is24Hour ? 'HH:mm' : 'hh:mm AM/PM';
  const effectivePlaceholder = placeholder || defaultPlaceholder;

  return (
    <div className="w-full font-sans">
      {(label || (showAmPmBadge && value)) && (
        <div className="flex justify-between items-center mb-1">
          {label ? (
            <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
              {label}
            </label>
          ) : (
            <span />
          )}
          {showAmPmBadge && value ? (
            <span className="text-[10px] font-bold text-blue-450 tracking-wider font-mono">
              {headerBadgeTime}
            </span>
          ) : null}
        </div>
      )}
      <div className="relative inline-block w-full">
        {/* Display text field (Locale-aware: 12h AM/PM or 24h HH:mm) with cursor-pointer */}
        <input
          type="text"
          readOnly
          required={required}
          disabled={disabled}
          value={displayTime}
          onClick={handleOpenPicker}
          placeholder={effectivePlaceholder}
          className={`block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        />

        {/* Hidden Native Time Input with canonical HH:mm value */}
        <input
          type="time"
          ref={timePickerRef}
          value={value ? value.substring(0, 5) : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0 [&::-webkit-calendar-picker-indicator]:hidden"
          tabIndex={-1}
        />
      </div>
    </div>
  );
};
