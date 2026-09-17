import { useState, useCallback } from "react";
import { useDateFilter } from "./useDateFilter";
import { getNavigationContext, saveNavigationContext } from "@/services";

export function useQuotesPageFilters(
  setSelectedYear: (val: string) => void,
  setSelectedMonth: (val: string) => void,
  saleYearOptions?: {
    saleSelectedYear?: string;
    setSaleSelectedYear?: (val: string) => void;
    saleSelectedMonth?: string;
    setSaleSelectedMonth?: (val: string) => void;
  },
  userId?: string
) {
  const initialNav = typeof window !== "undefined" && userId ? getNavigationContext(userId) : null;

  // Monthly Table Search Query
  const [searchQuery, setSearchQueryState] = useState(() => initialNav?.quotesFilters?.monthly?.search || "");
  const setSearchQuery = useCallback((queryOrFn: string | ((prev: string) => string)) => {
    setSearchQueryState(prev => {
      const next = typeof queryOrFn === 'function' ? queryOrFn(prev) : queryOrFn;
      if (userId) {
        saveNavigationContext(userId, {
          quotesFilters: {
            monthly: { search: next }
          }
        });
      }
      return next;
    });
  }, [userId]);

  // Today's Table Search Query
  const [todaySearchQuery, setTodaySearchQuery] = useState("");

  // Branch Selection Filters
  const [selectedBranch, setSelectedBranchState] = useState(() => initialNav?.quotesFilters?.monthly?.branch || "");
  const setSelectedBranch = useCallback((branchOrFn: string | ((prev: string) => string)) => {
    setSelectedBranchState(prev => {
      const next = typeof branchOrFn === 'function' ? branchOrFn(prev) : branchOrFn;
      if (userId) {
        saveNavigationContext(userId, {
          quotesFilters: {
            monthly: { branch: next }
          }
        });
      }
      return next;
    });
  }, [userId]);

  const [todaySelectedBranch, setTodaySelectedBranch] = useState("");
  const [todayAdminViewMode, setTodayAdminViewMode] = useState<"all" | "mine">("mine");

  // Monthly Table Date filter state
  const dateFilter = useDateFilter({
    onYearChange: setSelectedYear,
    onMonthChange: setSelectedMonth,
  });

  // Sale Summary Independent Filters State
  const [saleSearchQuery, setSaleSearchQueryState] = useState(() => initialNav?.quotesFilters?.saleSummary?.search || "");
  const setSaleSearchQuery = useCallback((queryOrFn: string | ((prev: string) => string)) => {
    setSaleSearchQueryState(prev => {
      const next = typeof queryOrFn === 'function' ? queryOrFn(prev) : queryOrFn;
      if (userId) {
        saveNavigationContext(userId, {
          quotesFilters: {
            saleSummary: { search: next }
          }
        });
      }
      return next;
    });
  }, [userId]);

  const [saleSelectedBranch, setSaleSelectedBranchState] = useState(() => initialNav?.quotesFilters?.saleSummary?.branch || "");
  const setSaleSelectedBranch = useCallback((branchOrFn: string | ((prev: string) => string)) => {
    setSaleSelectedBranchState(prev => {
      const next = typeof branchOrFn === 'function' ? branchOrFn(prev) : branchOrFn;
      if (userId) {
        saveNavigationContext(userId, {
          quotesFilters: {
            saleSummary: { branch: next }
          }
        });
      }
      return next;
    });
  }, [userId]);

  const [internalSaleSelectedYear, setInternalSaleSelectedYear] = useState<string>(
    () => new Date().getFullYear().toString(),
  );
  const [internalSaleSelectedMonth, setInternalSaleSelectedMonth] = useState<string>(
    () => String(new Date().getMonth() + 1).padStart(2, "0"),
  );

  const saleSelectedYear = saleYearOptions?.saleSelectedYear ?? internalSaleSelectedYear;
  const setSaleSelectedYear = saleYearOptions?.setSaleSelectedYear ?? setInternalSaleSelectedYear;
  const saleSelectedMonth = saleYearOptions?.saleSelectedMonth ?? internalSaleSelectedMonth;
  const setSaleSelectedMonth = saleYearOptions?.setSaleSelectedMonth ?? setInternalSaleSelectedMonth;

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
