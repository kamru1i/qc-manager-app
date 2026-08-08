import { useState } from "react";
import { useDateFilter } from "./useDateFilter";

export function useQuotesPageFilters(
  setSelectedYear: (val: string) => void,
  setSelectedMonth: (val: string) => void
) {
  // Monthly Table Search Query
  const [searchQuery, setSearchQuery] = useState("");

  // Today's Table Search Query
  const [todaySearchQuery, setTodaySearchQuery] = useState("");

  // Branch Selection Filters
  const [selectedBranch, setSelectedBranch] = useState("");
  const [todaySelectedBranch, setTodaySelectedBranch] = useState("");
  const [todayAdminViewMode, setTodayAdminViewMode] = useState<"all" | "mine">("mine");

  // Monthly Table Date filter state
  const dateFilter = useDateFilter({
    onYearChange: setSelectedYear,
    onMonthChange: setSelectedMonth,
  });

  // Sale Summary Independent Filters State
  const [saleSearchQuery, setSaleSearchQuery] = useState("");
  const [saleSelectedBranch, setSaleSelectedBranch] = useState("");
  const [saleSelectedYear, setSaleSelectedYear] = useState<string>(
    () => new Date().getFullYear().toString(),
  );
  const [saleSelectedMonth, setSaleSelectedMonth] = useState<string>(
    () => String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const saleDateFilter = useDateFilter({
    onYearChange: setSaleSelectedYear,
    onMonthChange: setSaleSelectedMonth,
  });
  const [saleAdminViewMode, setSaleAdminViewMode] = useState<"all" | "mine">("mine");

  const handleClearTodayFilters = () => {
    setTodaySearchQuery("");
    setTodaySelectedBranch("");
  };

  return {
    searchQuery,
    setSearchQuery,
    todaySearchQuery,
    setTodaySearchQuery,
    selectedBranch,
    setSelectedBranch,
    todaySelectedBranch,
    setTodaySelectedBranch,
    todayAdminViewMode,
    setTodayAdminViewMode,
    dateFilter,
    saleSearchQuery,
    setSaleSearchQuery,
    saleSelectedBranch,
    setSaleSelectedBranch,
    saleSelectedYear,
    setSaleSelectedYear,
    saleSelectedMonth,
    setSaleSelectedMonth,
    saleDateFilter,
    saleAdminViewMode,
    setSaleAdminViewMode,
    handleClearTodayFilters,
  };
}
