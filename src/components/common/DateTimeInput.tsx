import React, { useRef } from "react";
import { Calendar } from "lucide-react";

interface DateTimeInputProps {
  value: string; // "YYYY-MM-DDTHH:mm" or ISO string
  onChange: (val: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * Converts a "YYYY-MM-DDTHH:mm" string or ISO timestamp into "DD-MM-YYYY, HH:MM AM/PM"
 */
function formatToCustomDisplay(val: string): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, "0");

    return `${day}-${month}-${year}, ${strHours}:${minutes} ${ampm}`;
  } catch {
    return "";
  }
}

export const DateTimeInput: React.FC<DateTimeInputProps> = ({
  value,
  onChange,
  required = false,
  disabled = false,
  className = "",
  placeholder = "DD-MM-YYYY, HH:MM AM/PM",
}) => {
  const pickerRef = useRef<HTMLInputElement>(null);

  const displayValue = formatToCustomDisplay(value);

  const handleOpenPicker = () => {
    if (disabled) return;
    try {
      if (pickerRef.current) {
        if (typeof pickerRef.current.showPicker === "function") {
          pickerRef.current.showPicker();
        } else {
          pickerRef.current.focus();
          pickerRef.current.click();
        }
      }
    } catch (err) {
      console.error("Failed to open date picker:", err);
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Display Input Field (Strict DD-MM-YYYY, HH:MM AM/PM) */}
      <input
        type="text"
        readOnly
        required={required}
        disabled={disabled}
        value={displayValue}
        onClick={handleOpenPicker}
        placeholder={placeholder}
        className="w-full h-9 px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:border-blue-500/50 cursor-pointer font-mono select-none"
      />

      {/* Hidden Native Picker Input */}
      <input
        type="datetime-local"
        ref={pickerRef}
        value={value ? value.substring(0, 16) : ""}
        disabled={disabled}
        onChange={handleNativeChange}
        className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
      />
    </div>
  );
};
