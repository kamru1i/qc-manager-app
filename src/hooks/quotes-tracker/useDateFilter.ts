import { useState, useEffect, useRef, useCallback } from "react";
import { formatDate } from "@/utils/quotesDashboardHelpers";

interface UseDateFilterOptions {
  onYearChange?: (year: string) => void;
  onMonthChange?: (month: string) => void;
}

export function useDateFilter({
  onYearChange,
  onMonthChange,
}: UseDateFilterOptions = {}) {
  const [selectedDate, setSelectedDate] = useState("");
  const [dateInputVal, setDateInputVal] = useState("");
  const specificDateRef = useRef<HTMLInputElement>(null);

  // Sync text input (DD-MM-YYYY) with selectedDate (YYYY-MM-DD)
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        setDateInputVal(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setDateInputVal(formatDate(selectedDate));
      }
    } else {
      setDateInputVal("");
    }
  }, [selectedDate]);

  // DD-MM-YYYY text input parsing logic
  const handleDateInputChange = useCallback(
    (val: string) => {
      const clean = val.replace(/\D/g, "");
      let formatted = "";
      if (clean.length > 0) {
        formatted += clean.substring(0, 2);
      }
      if (clean.length > 2) {
        formatted += "-" + clean.substring(2, 4);
      }
      if (clean.length > 4) {
        formatted += "-" + clean.substring(4, 8);
      }

      setDateInputVal(formatted);

      if (formatted.length === 10) {
        const parts = formatted.split("-");
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        if (
          day >= 1 &&
          day <= 31 &&
          month >= 1 &&
          month <= 12 &&
          year >= 1900 &&
          year <= 2100
        ) {
          const dateObj = new Date(year, month - 1, day);
          if (
            dateObj.getFullYear() === year &&
            dateObj.getMonth() === month - 1 &&
            dateObj.getDate() === day
          ) {
            const yyyy = String(year);
            const mm = String(month).padStart(2, "0");
            const dd = String(day).padStart(2, "0");
            const dateValue = `${yyyy}-${mm}-${dd}`;
            setSelectedDate(dateValue);
            onYearChange?.(yyyy);
            onMonthChange?.(mm);
            return;
          }
        }
      }
      setSelectedDate("");
    },
    [onYearChange, onMonthChange],
  );

  // Native date picker change handler (receives YYYY-MM-DD)
  const handleDateFilterChange = useCallback(
    (dateStr: string) => {
      setSelectedDate(dateStr);
      if (dateStr) {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          onYearChange?.(parts[0]);
          onMonthChange?.(parts[1]);
        }
      }
    },
    [onYearChange, onMonthChange],
  );

  // Opens the hidden native date picker
  const handleOpenSpecificDatePicker = useCallback(() => {
    if (specificDateRef.current) {
      try {
        specificDateRef.current.showPicker();
      } catch {
        specificDateRef.current.click();
      }
    }
  }, []);

  // Resets the date and text input
  const clearDate = useCallback(() => {
    setSelectedDate("");
    setDateInputVal("");
  }, []);

  return {
    selectedDate,
    setSelectedDate,
    dateInputVal,
    setDateInputVal,
    specificDateRef,
    handleDateInputChange,
    handleDateFilterChange,
    handleOpenSpecificDatePicker,
    clearDate,
  };
}

export default useDateFilter;
