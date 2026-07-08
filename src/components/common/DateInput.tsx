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
}) => {
  const [inputValue, setInputValue] = useState('');
  const datePickerRef = useRef<HTMLInputElement>(null);

  // Sync displayed input value when YYYY-MM-DD value changes from parent
  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setInputValue(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setInputValue(value);
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    
    // strip everything except digits
    val = val.replace(/[^0-9]/g, '');
    
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
    
    // Trigger onChange only when we have a full valid date
    if (val.length === 8) {
      const day = val.substring(0, 2);
      const month = val.substring(2, 4);
      const year = val.substring(4, 8);
      
      const ymd = `${year}-${month}-${day}`;
      
      // Basic check if date parse is valid (e.g. not 31-02-2026)
      const parsed = Date.parse(ymd);
      if (!isNaN(parsed)) {
        // Also check if day/month match (to avoid Date.parse converting invalid days implicitly)
        const dateObj = new Date(ymd);
        if (
          dateObj.getFullYear() === parseInt(year, 10) &&
          dateObj.getMonth() + 1 === parseInt(month, 10) &&
          dateObj.getDate() === parseInt(day, 10)
        ) {
          onChange(ymd);
        }
      }
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
    }
  };

  return (
    <div className="flex gap-2 w-full relative">
      <input
        type="text"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={inputValue}
        onChange={handleTextChange}
        className={`block w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-wider placeholder-slate-600 ${className}`}
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
              console.log('Native picker failed:', err);
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
              console.log('Button click picker failed:', err);
            }
          }}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-lg cursor-pointer transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Open calendar"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
