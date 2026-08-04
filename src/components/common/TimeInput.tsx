'use client';

import React, { useRef } from 'react';
import { formatTimeToAMPM } from '@/utils/quotesDashboardHelpers';

interface TimeInputProps {
  value: string; // "HH:mm" e.g. "13:00" or "10:30"
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
  placeholder = 'Select Time',
}) => {
  const timePickerRef = useRef<HTMLInputElement>(null);

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
      // Ignore silent picker failures
    }
  };

  const displayTime = value ? formatTimeToAMPM(value) : '';

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
              {displayTime}
            </span>
          ) : null}
        </div>
      )}
      <div className="relative inline-block w-full">
        {/* Display text field (Strict 12-hour AM/PM e.g. 01:00 PM) with cursor-pointer & no clock icon */}
        <input
          type="text"
          readOnly
          required={required}
          disabled={disabled}
          value={displayTime}
          onClick={handleOpenPicker}
          placeholder={placeholder}
          className={`block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        />

        {/* Hidden Native Time Input */}
        <input
          type="time"
          ref={timePickerRef}
          value={value || ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0 [&::-webkit-calendar-picker-indicator]:hidden"
          tabIndex={-1}
        />
      </div>
    </div>
  );
};
