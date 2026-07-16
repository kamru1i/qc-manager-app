import React, { useRef, useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  required?: boolean;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  onErrorChange?: (hasError: boolean) => void;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  required = false,
  min,
  max,
  disabled = false,
  className = '',
  placeholder = 'DD-MM-YYYY',
  onErrorChange,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);

  const onErrorChangeRef = useRef(onErrorChange);
  useEffect(() => {
    onErrorChangeRef.current = onErrorChange;
  }, [onErrorChange]);

  // Notify parent component of validation error changes
  useEffect(() => {
    const callback = onErrorChangeRef.current;
    if (callback) {
      callback(!!errorMsg);
    }
    return () => {
      if (callback) {
        callback(false);
      }
    };
  }, [errorMsg]);

  // Sync displayed input value when YYYY-MM-DD value changes from parent
  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setInputValue(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setInputValue(value);
      }
      setErrorMsg(null);
    } else {
      setInputValue('');
      setErrorMsg(null);
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // strip everything except digits
    val = val.replace(/[^0-9]/g, '');
    
    // If a single year is forced, restrict the year digits
    let allowedYear: string | null = null;
    if (min && max) {
      const minYear = min.split('-')[0];
      const maxYear = max.split('-')[0];
      if (minYear === maxYear) {
        allowedYear = minYear;
      }
    }
    
    if (allowedYear && val.length > 4) {
      const yearPart = val.substring(4);
      const expectedPart = allowedYear.substring(0, yearPart.length);
      val = val.substring(0, 4) + expectedPart;
    }
    
    if (val.length > 8) val = val.substring(0, 8);
    
    // Reconstruct DD-MM-YYYY format
    let formatted = '';
    if (val.length > 0) {
      formatted += val.substring(0, 2);
    }
    if (val.length > 2) {
      formatted += '-' + val.substring(2, 4);
    }
    if (val.length > 4) {
      formatted += '-' + val.substring(4, 8);
    }
    
    setInputValue(formatted);

    // Live validation
    let currentError: string | null = null;
    if (val.length >= 2) {
      const day = parseInt(val.substring(0, 2), 10);
      if (day < 1 || day > 31) {
        currentError = "Invalid day! Must be 01 - 31.";
      }
    }
    if (!currentError && val.length >= 4) {
      const month = parseInt(val.substring(2, 4), 10);
      if (month < 1 || month > 12) {
        currentError = "Invalid month! Must be 01 - 12.";
      }
    }
    if (!currentError && val.length === 8) {
      const dayStr = val.substring(0, 2);
      const monthStr = val.substring(2, 4);
      const yearStr = val.substring(4, 8);
      const ymd = `${yearStr}-${monthStr}-${dayStr}`;
      
      const parsed = Date.parse(ymd);
      if (isNaN(parsed)) {
        currentError = "Invalid calendar date!";
      } else {
        const dateObj = new Date(ymd);
        if (
          dateObj.getFullYear() !== parseInt(yearStr, 10) ||
          dateObj.getMonth() + 1 !== parseInt(monthStr, 10) ||
          dateObj.getDate() !== parseInt(dayStr, 10)
        ) {
          currentError = "Invalid calendar date!";
        } else if (min && ymd < min) {
          currentError = `Date must be after ${min.split('-').reverse().join('-')}`;
        } else if (max && ymd > max) {
          currentError = `Date must be before ${max.split('-').reverse().join('-')}`;
        }
      }
    }

    setErrorMsg(currentError);
    
    // Trigger onChange only when we have a full valid date
    if (val.length === 8 && !currentError) {
      const day = val.substring(0, 2);
      const month = val.substring(2, 4);
      const year = val.substring(4, 8);
      const ymd = `${year}-${month}-${day}`;
      onChange(ymd);
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // YYYY-MM-DD
    if (val) {
      onChange(val);
      const parts = val.split('-');
      if (parts.length === 3) {
        setInputValue(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      setErrorMsg(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex gap-2 w-full relative">
        <input
          type="text"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleTextChange}
          className={`block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-wider placeholder-theme-text-muted ${className}`}
        />
        <div className="relative shrink-0 flex items-center justify-center">
          {/* Hidden native picker covering the calendar button */}
          <input
            type="date"
            ref={datePickerRef}
            disabled={disabled}
            min={min}
            max={max}
            value={value || ''}
            onChange={handleNativeChange}
            onClick={(e) => {
              e.stopPropagation();
              try {
                (e.target as HTMLInputElement).showPicker?.();
              } catch (err) {
                // Ignore silent picker failures
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              try {
                datePickerRef.current?.showPicker?.();
              } catch (err) {
                // Ignore silent picker failures
              }
            }}
            className="p-2 bg-theme-card-bg hover:bg-theme-border-input text-theme-text-secondary border border-theme-border-active rounded-lg cursor-pointer transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            title="Open calendar"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>
      {errorMsg && (
        <span className="text-[10px] text-red-500 font-semibold select-none leading-none animate-fade-in pl-1">
          ⚠️ {errorMsg}
        </span>
      )}
    </div>
  );
};
