"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { useQuotesDashboardData } from "@/hooks/quotes-tracker/useQuotesDashboardData";
import { useSaveFileHelper } from "@/hooks/quotes-tracker/useSaveFileHelper";
import { useCopyHelper } from "@/hooks/quotes-tracker/useCopyHelper";
import { useCopyHelperPermissions } from "@/hooks/quotes-tracker/useCopyHelperPermissions";
import { useAdminSalesSummary } from "@/hooks/quotes-tracker/useAdminSalesSummary";
import { useEditRecordModal } from "@/hooks/quotes-tracker/useEditRecordModal";
import { useOnboarding } from "@/hooks/quotes-tracker/useOnboarding";
import { useDateFilter } from "@/hooks/quotes-tracker/useDateFilter";
import { useQuotesPageFilters } from "@/hooks/quotes-tracker/useQuotesPageFilters";
import { useQuotesPageModals } from "@/hooks/quotes-tracker/useQuotesPageModals";
import { useQuotesPageHandlers } from "@/hooks/quotes-tracker/useQuotesPageHandlers";
import { DailyEntryTab } from "@/components/quotes-tracker/tabs/DailyEntryTab";
import { MonthlyTab } from "@/components/quotes-tracker/tabs/MonthlyTab";
import { SaleSummaryTab } from "@/components/quotes-tracker/tabs/SaleSummaryTab";
import { QuotesModalsGroup } from "@/components/quotes-tracker/tabs/QuotesModalsGroup";
import { StatsGrid } from "@/components/common/StatsGrid";
import { DailyEntryForm } from "@/components/leave-tracker/DailyEntryForm";
import dynamic from "next/dynamic";

// AUDIT FIX M5: Lazy-load heavy modals to reduce initial bundle size
const EditRecordModal = dynamic(
  () => import("@/components/quotes-tracker/modals/EditRecordModal").then((m) => m.EditRecordModal),
  { ssr: false }
);
const ConfirmModal = dynamic(
  () => import("@/components/common/modals/ConfirmModal").then((m) => m.ConfirmModal),
  { ssr: false }
);
const CustomEntryModal = dynamic(
  () => import("@/components/quotes-tracker/modals/CustomEntryModal").then((m) => m.CustomEntryModal),
  { ssr: false }
);
const SaleStatusModal = dynamic(
  () => import("@/components/quotes-tracker/modals/SaleStatusModal").then((m) => m.SaleStatusModal),
  { ssr: false }
);
import { AdminViewToggle } from "@/components/leave-tracker/AdminViewToggle";
import { SkeletonLoader } from "@/components/quotes-tracker/QuotesSkeletonLoader";
import { LeaderboardTable } from "@/components/leaderboard-and-reports/LeaderboardTable";
import { ReportsPanel } from "@/components/leaderboard-and-reports/ReportsPanel";

import {
  isSuperadmin,
  isAdminRole,
  isTabVisibleForRole,
} from "@/utils/permissionService";
import {
  getGlobalSettingsFromProfile,
  getSanitizerWords,
} from "@/utils/dashboardHelpers";
import { QuoteRulesPanel } from "@/components/quotes-tracker/QuoteRulesPanel";
import { CopyHelperPanel } from "@/components/quotes-tracker/CopyHelperPanel";
import { SaveFileHelperPanel } from "@/components/quotes-tracker/SaveFileHelperPanel";
import { CustomSelect } from "@/components/common/CustomSelect";
import { LoginCodesPanel } from "@/components/quotes-tracker/LoginCodesPanel";
import { QuickImportView } from "@/components/quotes-tracker/QuickImportView";
import { DEFAULT_BRANCHES, normalizeBranchName } from "@/utils/bulkQuoteParser";
import { CausalityPanel } from "@/components/quotes-tracker/CausalityPanel";
import { QuotationMistakesPanel } from "@/components/quotes-tracker/QuotationMistakesPanel";
import { validator } from "@/utils/quotesValidator";
import {
  calculateSummaryStats,
  formatDate,
  exportToCSV,
  buildCleanFileName,
} from "@/utils/quotesDashboardHelpers";
import { FileType, RecordItem } from "@/types";
import {
  Loader2,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Info,
  UserCheck,
  X,
  Plus,
  RefreshCw,
  Search,
  FileSpreadsheet,
} from "lucide-react";

const ALL_10_FILE_TYPES = [
  "Quote",
  "Requote",
  "Requote Van",
  "Requote Bike",
  "Review",
  "Individual Review",
  "Other Site",
  "Van",
  "Bike",
  "Sale",
];

interface DashboardProps {
  activeTab:
    | "entry"
    | "monthly"
    | "sale_summary"
    | "leaderboard"
    | "my_report"
    | "all_report"
    | "reports"
    | "rules"
    | "login_codes"
    | "causality"
    | "copy_helper"
    | "save_file"
    | "quick_import"
    | "mistakes";
  onTabChange: (
    tab:
      | "entry"
      | "monthly"
      | "sale_summary"
      | "leaderboard"
      | "my_report"
      | "all_report"
      | "reports"
      | "rules"
      | "login_codes"
      | "causality"
      | "copy_helper"
      | "save_file"
      | "quick_import"
      | "mistakes",
  ) => void;
  onBackToSidebarTab?: () => void;
}

export default function Dashboard({
  activeTab,
  onTabChange,
  onBackToSidebarTab,
}: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/quotes") {
      router.replace("/");
    }
  }, [pathname, router]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for custom quotes-tab-change event to update subtab navigation dynamically
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const targetTab = (e as CustomEvent).detail;
      if (
        targetTab === "entry" ||
        targetTab === "monthly" ||
        targetTab === "sale_summary" ||
        targetTab === "leaderboard" ||
        targetTab === "reports" ||
        targetTab === "rules" ||
        targetTab === "login_codes" ||
        targetTab === "causality" ||
        targetTab === "copy_helper" ||
        targetTab === "save_file"
      ) {
        onTabChange(targetTab);
      }
    };
    window.addEventListener("quotes-tab-change", handleTabChange);
    return () =>
      window.removeEventListener("quotes-tab-change", handleTabChange);
  }, [onTabChange]);

  const dashboardData = useQuotesDashboardData();
  const {
    sessionUser,
    profile,
    loading,
    recordsLoading,
    submitting,
    isOnline,
    showToast,
    records,
    profilesList,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    availableDates,
    addRecord,
    deleteRecord,
    deleteRecords,
    updateRecord,
    bulkUpdateRecords,
    completeFirstTimeSetup,
    handleLogout,

    fetchAuditLogs,
    logActivity,
    fetchRecords,
  } = dashboardData;

  const isSuperAdmin = isSuperadmin(profile);

  // Filename cleaner configured with the superadmin-managed extra word list
  // (from global settings). Falls back to default behavior when unset.
  const cleanFileName = useMemo(() => {
    const gs = getGlobalSettingsFromProfile(profile);
    return buildCleanFileName(getSanitizerWords(gs));
  }, [profile]);

  const globalSettings = useMemo(
    () => getGlobalSettingsFromProfile(profile),
    [profile],
  );

  // Access & Feature flag check: Quick Import modal (Superadmin-controlled via Access Matrix & Feature Flags).
  const quickImportEnabled = useMemo(
    () => isTabVisibleForRole(profile, "quick_import", globalSettings),
    [profile, globalSettings],
  );

  // Access & Feature flag check: Custom Entry modal (Superadmin-controlled via Access Matrix & Feature Flags).
  const customEntryEnabled = useMemo(
    () => isTabVisibleForRole(profile, "custom_entry", globalSettings),
    [profile, globalSettings],
  );



  // NOTE: the navbar rank cache is fed exclusively by the get_leaderboard_data
  // RPC in app/page.tsx (updateGlobalRankCacheDirect) — the previous local
  // recomputation here used month-scoped records (own-records-only for regular
  // users) and briefly overwrote the correct rank with a bogus one.

  const {
    isBulkModalOpen,
    setIsBulkModalOpen,
    isCustomEntryModalOpen,
    setIsCustomEntryModalOpen,
    viewingReports,
    updateViewingReports,
    showSaleModal,
    setShowSaleModal,
    saleFormDetails,
    setSaleFormDetails,
    customSaleDetails,
    setCustomSaleDetails,
    deletingRecordId,
    setDeletingRecordId,
    bulkDeletingRecordIds,
    setBulkDeletingRecordIds,
    isBulkDeletingInProgress,
    setIsBulkDeletingInProgress,
  } = useQuotesPageModals(activeTab);

  // Daily Entry Form State
  const [fileName, setFileName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [codenameInput, setCodenameInput] = useState(
    () => profile?.username || "",
  );
  const [fileType, setFileType] = useState<FileType>("Quote");

  // Admin View Toggle on Tables: 'all' or 'mine'
  const [adminViewMode, setAdminViewMode] = useState<"all" | "mine">("mine");

  // Load active admin view mode preference on mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem("quotes_sales_admin_view_mode");
    if (savedViewMode === "all" || savedViewMode === "mine") {
      setAdminViewMode(savedViewMode);
    }
  }, []);

  const handleAdminViewModeChange = (mode: "all" | "mine") => {
    setAdminViewMode(mode);
    localStorage.setItem("quotes_sales_admin_view_mode", mode);
  };

  // Backspace key navigation for Leaderboard and Reports dashboard views
  useEffect(() => {
    if (activeTab !== "leaderboard" && activeTab !== "reports") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toUpperCase();
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          activeEl.hasAttribute("contenteditable")
        ) {
          return;
        }
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        if (activeTab === "leaderboard" && viewingReports) {
          updateViewingReports(false);
        } else {
          // Go back to the last active tab where the sidebar was visible
          if (onBackToSidebarTab) {
            onBackToSidebarTab();
          } else {
            const lastQuotesTab =
              localStorage.getItem("quotes_sales_active_tab") || "entry";
            onTabChange(lastQuotesTab as any);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [activeTab, viewingReports, onTabChange, onBackToSidebarTab]);

  const {
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
  } = useQuotesPageFilters(setSelectedYear, setSelectedMonth);

  const {
    selectedDate,
    setSelectedDate,
    dateInputVal,
    setDateInputVal,
    specificDateRef,
    handleDateInputChange,
    handleDateFilterChange,
    handleOpenSpecificDatePicker,
  } = dateFilter;

  const saleSelectedDate = saleDateFilter.selectedDate;
  const setSaleSelectedDate = saleDateFilter.setSelectedDate;
  const saleDateInputVal = saleDateFilter.dateInputVal;
  const setSaleDateInputVal = saleDateFilter.setDateInputVal;
  const specificSaleDateRef = saleDateFilter.specificDateRef;
  const handleSaleDateInputChange = saleDateFilter.handleDateInputChange;
  const handleSaleDateFilterChange = saleDateFilter.handleDateFilterChange;
  const handleOpenSpecificSaleDatePicker = saleDateFilter.handleOpenSpecificDatePicker;


  // Edit Record Modal Hook
  const {
    editingRecord,
    editFileName,
    editBranchName,
    editCodename,
    editFileType,
    editSaleStatus,
    editSubmittedDate,
    editSubmittedTime,
    editCanChangeSubmittedAt,
    setEditingRecord,
    setEditFileName,
    setEditBranchName,
    setEditCodename,
    setEditFileType,
    setEditSaleStatus,
    setEditSubmittedDate,
    setEditSubmittedTime,
    handleOpenEditRecord,
    handleSaveEdit,
    handleSaveInline,
    handleBulkSaveInline,
  } = useEditRecordModal({
    records,
    updateRecord,
    bulkUpdateRecords,
    showToast,
  });

  // Copy Helper States
  const [showReportHelper, setShowReportHelper] = useState<boolean>(false);

  // Save File States
  const [showSaveFileHelper, setShowSaveFileHelper] = useState<boolean>(false);

  // AUDIT FIX M1: Read localStorage in useEffect to prevent SSR hydration mismatch
  useEffect(() => {
    if (localStorage.getItem("quotes_sales_show_report_helper") === "true") {
      setShowReportHelper(true);
    }
    if (localStorage.getItem("quotes_sales_show_save_file_helper") === "true") {
      setShowSaveFileHelper(true);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "quotes_sales_show_report_helper",
        String(showReportHelper),
      );
    }
  }, [showReportHelper]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "quotes_sales_show_save_file_helper",
        String(showSaveFileHelper),
      );
    }
  }, [showSaveFileHelper]);


  // ── Copy Helper Hook ───────────────────────────────────────────────
  // Box visibility is driven by the "Sale" file type permission
  // ── Copy Helper Hook ───────────────────────────────────────────────
  // Box visibility is driven by the "Sale" file type permission
  const { hasSalePermission } = useCopyHelperPermissions(profile);

  // Temporary placeholder for admin summary to initialize useCopyHelper
  const initialAdminSummary = { totalSold: 0, totalUnsold: 0, totalAttempts: 0 };

  const {
    spokeTo,
    setSpokeTo,
    soldDate,
    setSoldDate,
    pcUsed,
    reportNotes,
    copiedStates,
    totalAttempt,
    soldCount,
    unsoldCount,
    allSales,
    hasSubmissions,
    handlePcUsedChange,
    handleNotesChange,
    copyBox1,
    copyBox2,
    copyBox4,
    copyAdminSummary,
    copyText1,
    copyText2,
    copyNotes,
  } = useCopyHelper({
    showToast,
    todayUserRecords: [], // Handled by targetDateStr calculation below
    profile,
    codenameInput,
    adminSalesSummary: initialAdminSummary,
  });

  const targetDateStr = useMemo(() => {
    if (!soldDate) return new Date().toDateString();
    const parts = soldDate.split(/[\/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toDateString();
    }
    const fallback = new Date(soldDate);
    return isNaN(fallback.getTime()) ? new Date().toDateString() : fallback.toDateString();
  }, [soldDate]);

  const todayUserRecords = useMemo(() => {
    const effectiveCodename = codenameInput || profile?.username || "";
    return records.filter((r) => {
      const matchesDate =
        new Date(r.submitted_at).toDateString() === targetDateStr;
      const matchesUser =
        r.codename.toUpperCase() === effectiveCodename.toUpperCase();
      return matchesDate && matchesUser;
    });
  }, [records, codenameInput, profile?.username, targetDateStr]);

  // Deduplicated sales report (all users) for the selected report date
  const adminSalesSummary = useAdminSalesSummary({
    enabled: activeTab === "copy_helper" && hasSalePermission,
    records,
    targetDateStr,
  });

  // ── Save File Helper Hook ──────────────────────────────────────────
  const {
    savedRecordIds,
    savedDocuments,
    savedFilePath,
    selectedRecordIdForSave,
    setSelectedRecordIdForSave,
    editorRef,
    baseDirectory,
    permissionModal,
    setPermissionModal,
    triggerChooseDirectoryWithPermission: handleChooseDirectory,
    triggerSaveWithPermission: handleSaveAsWordRaw,
    handleUpdateWord,
    handleEditDocument,
    handleCancelEdit,
    handleDeleteDocument,
  } = useSaveFileHelper({ showToast });

  // Wrap handleSaveAsWord to pass todayUserRecords (component expects no-arg version)
  const handleSaveAsWord = () => handleSaveAsWordRaw(todayUserRecords);


  // Force Change Password / Onboarding Customization Modal Hook
  const {
    ownFullName,
    setOwnFullName,
    ownCodename,
    setOwnCodename,
    ownPassword,
    setOwnPassword,
    ownConfirmPassword,
    setOwnConfirmPassword,
    showOwnPass,
    setShowOwnPass,
    showOwnConfirmPass,
    setShowOwnConfirmPass,
    passwordFeedback,
    handleFirstTimeSetup,
  } = useOnboarding({
    profile,
    completeFirstTimeSetup,
    showToast,
  });

  // Local helper: Set codename inputs when profile loads
  useEffect(() => {
    if (profile) {
      if (!codenameInput) setCodenameInput(profile.username);
      if (!ownCodename) setOwnCodename(profile.username);
      if (!ownFullName) setOwnFullName(profile.full_name || "");

      // Auto adjust selected file type based on user permitted types
      if (profile.allowed_types && profile.allowed_types.length > 0) {
        if (!profile.allowed_types.includes(fileType)) {
          setFileType(profile.allowed_types[0] as FileType);
        }
      }
    }
  }, [profile, codenameInput, ownCodename, ownFullName, fileType]);

  // Dynamic Year and Month Options
  const dynamicYears = useMemo(() => {
    const yearsSet = new Set<string>();
    availableDates.forEach((d) => {
      yearsSet.add(d.year);
    });
    return Array.from(yearsSet).sort(
      (a, b) => parseInt(b, 10) - parseInt(a, 10),
    );
  }, [availableDates]);

  const dynamicMonths = useMemo(() => {
    const allMonthsMap: { [key: string]: string } = {
      "01": "January",
      "02": "February",
      "03": "March",
      "04": "April",
      "05": "May",
      "06": "June",
      "07": "July",
      "08": "August",
      "09": "September",
      "10": "October",
      "11": "November",
      "12": "December",
    };

    const now = new Date();
    const currentYearStr = now.getFullYear().toString();
    const currentMonthNum = now.getMonth() + 1;

    let minMonth = 12;
    let hasRecordsInYear = false;

    availableDates.forEach((d) => {
      if (d.year === selectedYear) {
        hasRecordsInYear = true;
        const m = parseInt(d.month, 10);
        if (m < minMonth) minMonth = m;
      }
    });

    const monthsSet = new Set<string>();

    if (selectedYear === currentYearStr) {
      // For current year (2026): start from June (month 6, when app started) up to current month
      const startMonth = hasRecordsInYear ? Math.min(minMonth, 6) : 6;
      const endMonth = Math.max(startMonth, currentMonthNum);
      for (let m = startMonth; m <= endMonth; m++) {
        monthsSet.add(String(m).padStart(2, "0"));
      }
    } else if (hasRecordsInYear) {
      for (let m = minMonth; m <= 12; m++) {
        monthsSet.add(String(m).padStart(2, "0"));
      }
    } else {
      monthsSet.add(String(currentMonthNum).padStart(2, "0"));
    }

    const allKeys = Array.from(monthsSet).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10),
    );
    return allKeys.map((m) => ({
      val: m,
      name: allMonthsMap[m] || m,
    }));
  }, [availableDates, selectedYear]);

  // Adjust selected month when selected year/dynamicMonths updates
  useEffect(() => {
    const monthValues = dynamicMonths.map((m) => m.val);
    const nowMonthStr = String(new Date().getMonth() + 1).padStart(2, "0");
    if (monthValues.includes(nowMonthStr)) {
      setSelectedMonth((prev) =>
        monthValues.includes(prev) ? prev : nowMonthStr,
      );
    } else if (monthValues.length > 0 && !monthValues.includes(selectedMonth)) {
      setSelectedMonth(monthValues[monthValues.length - 1]);
    }
  }, [dynamicMonths, selectedMonth, setSelectedMonth]);

  // Adjust selected year if it's no longer valid
  useEffect(() => {
    const isValid = dynamicYears.includes(selectedYear);
    if (!isValid && dynamicYears.length > 0) {
      const curYear = new Date().getFullYear().toString();
      if (dynamicYears.includes(curYear)) {
        setSelectedYear(curYear);
      } else {
        setSelectedYear(dynamicYears[0]);
      }
    }
  }, [dynamicYears, selectedYear, setSelectedYear]);

  // Unique branches extracted dynamically from all records and normalized
  const uniqueBranches = useMemo(() => {
    const branches = new Set<string>();
    records.forEach((r) => {
      if (r.branch_name) {
        branches.add(normalizeBranchName(r.branch_name));
      }
    });
    return Array.from(branches).sort();
  }, [records]);

  // Master branches list merging default system branches and existing dynamic branches
  const allMasterBranches = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_BRANCHES.map(normalizeBranchName),
          ...uniqueBranches,
        ]),
      ).filter(Boolean),
    [uniqueBranches],
  );

  // Filtered records for Monthly Tab
  const monthlyFilteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Admin filter mode
      if (
        (isAdminRole(profile) || profile?.role === "supervisor") &&
        adminViewMode === "mine" &&
        r.user_id !== sessionUser?.id
      ) {
        return false;
      }
      // Specific Date filter
      if (selectedDate) {
        const recordDate = new Date(r.submitted_at).toLocaleDateString("en-CA");
        if (recordDate !== selectedDate) {
          return false;
        }
      }
      // Branch Dropdown filter
      if (selectedBranch) {
        if (
          r.branch_name.toUpperCase().trim() !==
          selectedBranch.toUpperCase().trim()
        ) {
          return false;
        }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        // Check if search query matches a known file type exactly (case-insensitive)
        const matchedFileType = ALL_10_FILE_TYPES.find(
          (ft) => ft.toLowerCase() === q,
        );

        if (matchedFileType) {
          // If search is for a known file type, filter by that type only
          if (r.file_type !== matchedFileType) {
            return false;
          }
        } else {
          // Otherwise, search in filename and codename fields only (NOT branch_name)
          const matchFileName = r.file_name.toLowerCase().includes(q);
          const matchCodename = r.codename.toLowerCase().includes(q);
          if (!matchFileName && !matchCodename) {
            return false;
          }
        }
      }
      return true;
    });
  }, [
    records,
    adminViewMode,
    profile,
    sessionUser?.id,
    selectedDate,
    selectedBranch,
    searchQuery,
    uniqueBranches,
    selectedYear,
    selectedMonth,
  ]);

  // Filtered records for Sale Summary Tab (Strictly file_type === "Sale" and using independent Sale Summary filters)
  const saleSummaryRecords = useMemo(() => {
    return records.filter((r) => {
      // Must be Sale file type
      if (r.file_type !== "Sale") {
        return false;
      }
      // Admin filter mode
      if (
        (isAdminRole(profile) || profile?.role === "supervisor") &&
        saleAdminViewMode === "mine" &&
        r.user_id !== sessionUser?.id
      ) {
        return false;
      }
      // Specific Date filter
      if (saleSelectedDate) {
        const recordDate = new Date(r.submitted_at).toLocaleDateString("en-CA");
        if (recordDate !== saleSelectedDate) {
          return false;
        }
      } else {
        // Year & Month filter
        const recordYear = String(new Date(r.submitted_at).getFullYear());
        const recordMonth = String(new Date(r.submitted_at).getMonth() + 1).padStart(2, "0");
        if (recordYear !== saleSelectedYear || recordMonth !== saleSelectedMonth) {
          return false;
        }
      }
      // Branch Dropdown filter
      if (saleSelectedBranch) {
        if (
          r.branch_name.toUpperCase().trim() !==
          saleSelectedBranch.toUpperCase().trim()
        ) {
          return false;
        }
      }
      // Search Query filter
      if (saleSearchQuery) {
        const q = saleSearchQuery.toLowerCase().trim();
        const matchFileName = r.file_name.toLowerCase().includes(q);
        const matchCodename = r.codename.toLowerCase().includes(q);
        if (!matchFileName && !matchCodename) {
          return false;
        }
      }
      return true;
    });
  }, [
    records,
    saleAdminViewMode,
    profile,
    sessionUser?.id,
    saleSelectedDate,
    saleSelectedBranch,
    saleSearchQuery,
    saleSelectedYear,
    saleSelectedMonth,
  ]);



  // Sale Summary Stats (Total Sales, Sold Count & %, Unsold Count & %)
  const saleSummaryStats = useMemo(() => {
    const total = saleSummaryRecords.length;
    const sold = saleSummaryRecords.filter((r) => r.file_name.endsWith(" [SOLD]")).length;
    const unsold = saleSummaryRecords.filter((r) => !r.file_name.endsWith(" [SOLD]")).length;

    const formatStat = (count: number) => {
      const padded = String(count).padStart(2, "0");
      if (total === 0) return `${padded} (0%)`;
      const pct = ((count / total) * 100).toFixed(2);
      return `${padded} (${pct}%)`;
    };

    return {
      total,
      sold,
      soldFormatted: formatStat(sold),
      unsold,
      unsoldFormatted: formatStat(unsold),
    };
  }, [saleSummaryRecords]);

  // Today's entries (submitted on the current local day)
  const todayRecords = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local format
    return records.filter((r) => {
      // Admin filter mode
      if (
        (isAdminRole(profile) || profile?.role === "supervisor") &&
        todayAdminViewMode === "mine" &&
        r.user_id !== sessionUser?.id
      ) {
        return false;
      }
      const recordDate = new Date(r.submitted_at).toLocaleDateString("en-CA");
      return recordDate === todayStr;
    });
  }, [records, todayAdminViewMode, profile, sessionUser]);

  // Filtered entries for Today's list table
  const todayFilteredRecords = useMemo(() => {
    return todayRecords.filter((r) => {
      // Branch Dropdown filter
      if (todaySelectedBranch) {
        if (
          r.branch_name.toUpperCase().trim() !==
          todaySelectedBranch.toUpperCase().trim()
        ) {
          return false;
        }
      }
      if (todaySearchQuery) {
        const q = todaySearchQuery.toLowerCase().trim();
        // Check if search query matches a known file type exactly (case-insensitive)
        const matchedFileType = ALL_10_FILE_TYPES.find(
          (ft) => ft.toLowerCase() === q,
        );

        if (matchedFileType) {
          // If search is for a known file type, filter by that type only
          if (r.file_type !== matchedFileType) {
            return false;
          }
        } else {
          // Otherwise, search in filename and codename fields only (NOT branch_name)
          const matchFileName = r.file_name.toLowerCase().includes(q);
          const matchCodename = r.codename.toLowerCase().includes(q);
          if (!matchFileName && !matchCodename) {
            return false;
          }
        }
      }
      return true;
    });
  }, [todayRecords, todaySearchQuery, todaySelectedBranch]);

  // Statistics calculation for today's entries (filtered by search terms)
  const todayStats = useMemo(() => {
    const stats = calculateSummaryStats(todayFilteredRecords);
    if (todaySearchQuery) {
      const activeTabOtherSiteTotal = todayRecords
        .filter((r) => {
          if (todaySelectedBranch) {
            return (
              r.branch_name.toUpperCase().trim() ===
              todaySelectedBranch.toUpperCase().trim()
            );
          }
          return true;
        })
        .filter((r) => r.file_type === "Other Site").length;
      return {
        ...stats,
        datasetOtherSiteTotal: activeTabOtherSiteTotal,
      };
    }
    return stats;
  }, [
    todayFilteredRecords,
    todaySearchQuery,
    todayRecords,
    todaySelectedBranch,
  ]);

  // Statistics calculation for monthly entries (filtered by search query)
  const monthlyStats = useMemo(() => {
    const stats = calculateSummaryStats(monthlyFilteredRecords);
    if (searchQuery) {
      const activeTabOtherSiteTotal = records
        .filter((r) => {
          if (
            (isAdminRole(profile) || profile?.role === "supervisor") &&
            adminViewMode === "mine" &&
            r.user_id !== sessionUser?.id
          ) {
            return false;
          }
          if (selectedDate) {
            const recordDate = new Date(r.submitted_at).toLocaleDateString(
              "en-CA",
            );
            if (recordDate !== selectedDate) {
              return false;
            }
          }
          if (selectedBranch) {
            if (
              r.branch_name.toUpperCase().trim() !==
              selectedBranch.toUpperCase().trim()
            ) {
              return false;
            }
          }
          return true;
        })
        .filter((r) => r.file_type === "Other Site").length;

      return {
        ...stats,
        datasetOtherSiteTotal: activeTabOtherSiteTotal,
      };
    }
    return stats;
  }, [
    monthlyFilteredRecords,
    searchQuery,
    records,
    adminViewMode,
    selectedDate,
    selectedBranch,
    profile,
    sessionUser,
  ]);

  const {
    handleExportTodayExcel,
    handleExportMonthlyExcel,
    handleExportSaleSummaryExcel,
    handleAdminCustomEntrySubmit,
    submitNewEntry,
    handleConfirmSaleStatus,
    handleAddEntry,
  } = useQuotesPageHandlers({
    todayFilteredRecords,
    monthlyFilteredRecords,
    saleSummaryRecords,
    selectedYear,
    selectedMonth,
    logActivity,
    showToast,
    addRecord,
    profile,
    profilesList,
    submitting,
    cleanFileName,
    fileName,
    setFileName,
    branchName,
    setBranchName,
    codenameInput,
    fileType,
    setFileType,
    saleFormDetails,
    setSaleFormDetails,
    customSaleDetails,
    setCustomSaleDetails,
    setShowSaleModal,
  });

  // Admin reset password handled inline inside EditProfileModal


  // Loading Screen
  if (loading) {
    let loaderType:
      | "form"
      | "table"
      | "leaderboard"
      | "audit-logs"
      | "rules"
      | "login_codes"
      | "causality"
      | "copy_helper"
      | "save_file"
      | "generic" = "generic";
    if (activeTab === "entry") loaderType = "form";
    else if (activeTab === "causality") loaderType = "causality";
    else if (activeTab === "monthly") loaderType = "table";
    else if (activeTab === "leaderboard" || activeTab === "reports")
      loaderType = "leaderboard";

    else if (activeTab === "rules") loaderType = "rules";
    else if (activeTab === "login_codes") loaderType = "login_codes";
    else if (activeTab === "copy_helper") loaderType = "copy_helper";
    else if (activeTab === "save_file") loaderType = "save_file";
    else if (activeTab === "quick_import") loaderType = "form";

    return (
      <div className="w-full">
        <SkeletonLoader type={loaderType} />
      </div>
    );
  }

  // Force Password Change & Onboarding custom setup
  if (profile && profile.has_changed_password === false) {
    return (
      <div className="flex-1 min-h-screen flex flex-col justify-center items-center bg-theme-page-bg px-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full bg-theme-card-bg/50 backdrop-blur-xl border border-theme-border-input/80 p-8 shadow-2xl rounded-2xl z-10 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white bg-clip-text bg-linear-to-r from-blue-400 to-violet-400">
              Profile Settings & Password Change
            </h2>
            <p className="text-xs text-theme-text-muted mt-1">
              This is your first login. Please verify your details and set a new
              password.
            </p>
          </div>

          <form onSubmit={handleFirstTimeSetup} className="space-y-4">
            <div>
              <label className="flex text-xs font-semibold text-theme-text-secondary mb-1 items-center gap-1">
                <Info className="h-3 w-3 text-blue-500" /> Your Full Name
                {profile?.full_name && profile.full_name.trim() !== "" && (
                  <span className="text-[10px] text-theme-text-muted font-normal">
                    (Locked - Admin only)
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                disabled={
                  !!(profile?.full_name && profile.full_name.trim() !== "")
                }
                placeholder="e.g. Kamrul Islam"
                value={ownFullName}
                onChange={(e) => setOwnFullName(e.target.value)}
                className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-theme-card-bg/30"
              />
            </div>

            <div>
              <label className="flex text-xs font-semibold text-theme-text-secondary mb-1 items-center gap-1">
                <UserCheck className="h-3 w-3 text-blue-500" /> Your Codename
                {profile?.username && profile.username.trim() !== "" && (
                  <span className="text-[10px] text-theme-text-muted font-normal">
                    (Locked - Admin only)
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                disabled={
                  !!(profile?.username && profile.username.trim() !== "")
                }
                placeholder="e.g. KI1024"
                value={ownCodename}
                onChange={(e) => setOwnCodename(e.target.value.toUpperCase())}
                className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-theme-card-bg/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showOwnPass ? "text" : "password"}
                  required
                  placeholder="6 to 12 character password"
                  value={ownPassword}
                  onChange={(e) => setOwnPassword(e.target.value)}
                  className="block w-full px-3 pr-10 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnPass(!showOwnPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-theme-text-muted hover:text-theme-text-secondary transition-colors"
                >
                  {showOwnPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text-secondary mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showOwnConfirmPass ? "text" : "password"}
                  required
                  placeholder="Re-enter new password"
                  value={ownConfirmPassword}
                  onChange={(e) => setOwnConfirmPassword(e.target.value)}
                  className="block w-full px-3 pr-10 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnConfirmPass(!showOwnConfirmPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-theme-text-muted hover:text-theme-text-secondary transition-colors"
                >
                  {showOwnConfirmPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {passwordFeedback && (
                <p
                  className={`text-xs mt-1.5 font-medium ${passwordFeedback.isError ? "text-red-450" : "text-emerald-450"}`}
                >
                  {passwordFeedback.text}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2.5 border border-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Logout
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-semibold text-white bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 disabled:opacity-50 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-theme-card-container"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" /> Saving...
                  </>
                ) : (
                  "Save Information"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Filter allowed categories for the daily form
  const allowedCategories = profile?.allowed_types || ALL_10_FILE_TYPES;

  const isAdmin = isAdminRole(profile) || profile?.role === "supervisor";

  return (
    <>
      {/* TAB 1: DAILY ENTRY */}
      {activeTab === "entry" && (
        <DailyEntryTab
          fileName={fileName}
          setFileName={setFileName}
          branchName={branchName}
          setBranchName={setBranchName}
          codenameInput={codenameInput}
          setCodenameInput={setCodenameInput}
          fileType={fileType}
          setFileType={setFileType}
          allowedCategories={allowedCategories}
          submitting={submitting}
          handleAddEntry={handleAddEntry}
          cleanFileName={cleanFileName}
          todaySearchQuery={todaySearchQuery}
          setTodaySearchQuery={setTodaySearchQuery}
          todaySelectedBranch={todaySelectedBranch}
          setTodaySelectedBranch={setTodaySelectedBranch}
          uniqueBranches={uniqueBranches}
          handleClearTodayFilters={handleClearTodayFilters}
          handleExportTodayExcel={handleExportTodayExcel}
          isAdmin={isAdmin}
          todayAdminViewMode={todayAdminViewMode}
          setTodayAdminViewMode={setTodayAdminViewMode}
          todayStats={todayStats}
          recordsLoading={recordsLoading}
          todayFilteredRecords={todayFilteredRecords}
          handleOpenEditRecord={handleOpenEditRecord}
          setDeletingRecordId={setDeletingRecordId}
          sessionUser={sessionUser}
          setBulkDeletingRecordIds={setBulkDeletingRecordIds}
          handleSaveInline={handleSaveInline}
          handleBulkSaveInline={handleBulkSaveInline}
        />
      )}

      {/* TAB 2: MONTHLY LIST */}
      {activeTab === "monthly" && (
        <MonthlyTab
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          uniqueBranches={uniqueBranches}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          dynamicYears={dynamicYears}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          dynamicMonths={dynamicMonths}
          dateInputVal={dateInputVal}
          setDateInputVal={setDateInputVal}
          handleDateInputChange={handleDateInputChange}
          handleOpenSpecificDatePicker={handleOpenSpecificDatePicker}
          specificDateRef={specificDateRef}
          handleDateFilterChange={handleDateFilterChange}
          handleExportMonthlyExcel={handleExportMonthlyExcel}
          isAdmin={isAdmin}
          adminViewMode={adminViewMode}
          handleAdminViewModeChange={handleAdminViewModeChange}
          monthlyStats={monthlyStats}
          recordsLoading={recordsLoading}
          monthlyFilteredRecords={monthlyFilteredRecords}
          handleOpenEditRecord={handleOpenEditRecord}
          setDeletingRecordId={setDeletingRecordId}
          sessionUser={sessionUser}
          setBulkDeletingRecordIds={setBulkDeletingRecordIds}
          handleSaveInline={handleSaveInline}
          handleBulkSaveInline={handleBulkSaveInline}
          allowedCategories={allowedCategories}
          submitting={submitting}
        />
      )}

      {/* TAB 3: SALE SUMMARY */}
      {activeTab === "sale_summary" && (
        <SaleSummaryTab
          saleSearchQuery={saleSearchQuery}
          setSaleSearchQuery={setSaleSearchQuery}
          saleSelectedBranch={saleSelectedBranch}
          setSaleSelectedBranch={setSaleSelectedBranch}
          uniqueBranches={uniqueBranches}
          saleSelectedYear={saleSelectedYear}
          setSaleSelectedYear={setSaleSelectedYear}
          saleSelectedDate={saleSelectedDate}
          setSaleSelectedDate={setSaleSelectedDate}
          dynamicYears={dynamicYears}
          saleSelectedMonth={saleSelectedMonth}
          setSaleSelectedMonth={setSaleSelectedMonth}
          dynamicMonths={dynamicMonths}
          saleDateInputVal={saleDateInputVal}
          setSaleDateInputVal={setSaleDateInputVal}
          handleSaleDateInputChange={handleSaleDateInputChange}
          handleOpenSpecificSaleDatePicker={handleOpenSpecificSaleDatePicker}
          specificSaleDateRef={specificSaleDateRef}
          handleSaleDateFilterChange={handleSaleDateFilterChange}
          handleExportSaleSummaryExcel={handleExportSaleSummaryExcel}
          isAdmin={isAdmin}
          saleAdminViewMode={saleAdminViewMode}
          setSaleAdminViewMode={setSaleAdminViewMode}
          saleSummaryStats={saleSummaryStats}
          recordsLoading={recordsLoading}
          saleSummaryRecords={saleSummaryRecords}
          handleOpenEditRecord={handleOpenEditRecord}
          setDeletingRecordId={setDeletingRecordId}
          sessionUser={sessionUser}
          setBulkDeletingRecordIds={setBulkDeletingRecordIds}
          handleSaveInline={handleSaveInline}
          handleBulkSaveInline={handleBulkSaveInline}
          allowedCategories={allowedCategories}
          submitting={submitting}
        />
      )}

      {activeTab === "leaderboard" && (
        <Suspense fallback={<SkeletonLoader type="leaderboard" />}>
          <LeaderboardTable
            profile={profile}
            onBack={() => {
              if (onBackToSidebarTab) {
                onBackToSidebarTab();
              } else {
                const lastQuotesTab =
                  localStorage.getItem("quotes_sales_active_tab") || "entry";
                onTabChange(lastQuotesTab as any);
              }
            }}
          />
        </Suspense>
      )}

      {(activeTab === "my_report" || activeTab === "reports") && (
        <Suspense fallback={<SkeletonLoader type="leaderboard" />}>
          <ReportsPanel
            records={records}
            profilesList={profilesList}
            profile={profile}
            initialReportTab="mine"
          />
        </Suspense>
      )}

      {activeTab === "all_report" && (
        <Suspense fallback={<SkeletonLoader type="leaderboard" />}>
          <ReportsPanel
            records={records}
            profilesList={profilesList}
            profile={profile}
            initialReportTab="all"
          />
        </Suspense>
      )}



      {/* TAB 6: QUOTE RULES */}
      {activeTab === "rules" && (
        <Suspense fallback={<SkeletonLoader type="rules" />}>
          <QuoteRulesPanel
            profile={profile}
            sessionUser={sessionUser}
            isOnline={isOnline}
            showToast={showToast}
          />
        </Suspense>
      )}

      {/* TAB 8: LOGIN CODES */}
      {activeTab === "login_codes" && (
        <LoginCodesPanel
          canEdit={isAdminRole(profile) || profile?.role === "supervisor"}
          isOnline={isOnline}
          showToast={showToast}
        />
      )}

      {/* TAB 9: CAUSALITY (Asitis + EUI combined) */}
      {activeTab === "causality" && (
        <CausalityPanel profile={profile} isOnline={isOnline} />
      )}

      {/* TAB 11: COPY HELPER (all authenticated users; box visibility
              is driven by the "Sale" file type permission) */}
      {activeTab === "copy_helper" && (
        <Suspense fallback={<SkeletonLoader type="copy-helper" />}>
          <CopyHelperPanel
            profile={profile}
            hasSalePermission={hasSalePermission}
            codenameInput={codenameInput}
            spokeTo={spokeTo}
            setSpokeTo={setSpokeTo}
            soldDate={soldDate}
            setSoldDate={setSoldDate}
            pcUsed={pcUsed}
            handlePcUsedChange={handlePcUsedChange}
            reportNotes={reportNotes}
            handleNotesChange={handleNotesChange}
            totalAttempt={totalAttempt}
            soldCount={soldCount}
            unsoldCount={unsoldCount}
            allSales={allSales}
            hasSubmissions={hasSubmissions}
            todayUserRecords={todayUserRecords}
            adminSalesSummary={adminSalesSummary}
            records={records}
            copyBox1={copyBox1}
            copyBox2={copyBox2}
            copyBox4={copyBox4}
            copyAdminSummary={copyAdminSummary}
            copyText1={copyText1}
            copyText2={copyText2}
            copyNotes={copyNotes}
            copiedStates={copiedStates}
            setShowReportHelper={() => onTabChange("entry")}
          />
        </Suspense>
      )}

      {/* TAB 12: SAVE FILE (Superadmin only) */}
      {activeTab === "save_file" && isSuperAdmin && (
        <Suspense fallback={<SkeletonLoader type="save-file" />}>
          <SaveFileHelperPanel
            editorRef={editorRef}
            baseDirectory={baseDirectory}
            handleChooseDirectory={handleChooseDirectory}
            todayUserRecords={todayUserRecords}
            savedRecordIds={savedRecordIds}
            selectedRecordIdForSave={selectedRecordIdForSave}
            setSelectedRecordIdForSave={setSelectedRecordIdForSave}
            savedFilePath={savedFilePath}
            handleUpdateWord={handleUpdateWord}
            handleCancelEdit={handleCancelEdit}
            handleSaveAsWord={handleSaveAsWord}
            savedDocuments={savedDocuments}
            handleEditDocument={handleEditDocument}
            handleDeleteDocument={handleDeleteDocument}
            setShowSaveFileHelper={() => onTabChange("entry")}
            permissionModal={permissionModal}
            setPermissionModal={setPermissionModal}
          />
        </Suspense>
      )}

      {/* TAB 12b: QUOTATION MISTAKES */}
      {activeTab === "mistakes" && (
        <Suspense fallback={<SkeletonLoader type="table" />}>
          <QuotationMistakesPanel
            sessionUser={sessionUser}
            profile={profile}
            globalSettings={globalSettings}
            profilesList={profilesList}
          />
        </Suspense>
      )}

      {/* TAB 13: QUICK IMPORT (Full Page View) */}
      {activeTab === "quick_import" && (
        <QuickImportView
          isInline={true}
          allowedBranches={allMasterBranches}
          allowedTypes={allowedCategories}
          sanitizerWords={getSanitizerWords(globalSettings)}
          codename={ownCodename || profile?.username || ""}
          onSubmitRecord={async (data) => {
            const customSubmittedAt = data.entry_date
              ? new Date(`${data.entry_date}T12:00:00`).toISOString()
              : undefined;
            return await addRecord(
              data.file_name,
              data.branch_name,
              data.codename,
              data.file_type as FileType,
              undefined,
              customSubmittedAt,
              { skipToast: true, skipFetch: true },
            );
          }}
          onCompleteSuccess={(count) => {
            showToast(
              "success",
              `Successfully submitted ${count} Files!`,
            );
            fetchRecords();
          }}
        />
      )}

      <QuotesModalsGroup
        showSaleModal={showSaleModal}
        setShowSaleModal={setShowSaleModal}
        saleFormDetails={saleFormDetails}
        setSaleFormDetails={setSaleFormDetails}
        customSaleDetails={customSaleDetails}
        setCustomSaleDetails={setCustomSaleDetails}
        handleConfirmSaleStatus={handleConfirmSaleStatus}
        editingRecord={editingRecord}
        setEditingRecord={setEditingRecord}
        editFileName={editFileName}
        setEditFileName={setEditFileName}
        editBranchName={editBranchName}
        setEditBranchName={setEditBranchName}
        editCodename={editCodename}
        setEditCodename={setEditCodename}
        editFileType={editFileType}
        setEditFileType={setEditFileType}
        editCanChangeSubmittedAt={editCanChangeSubmittedAt}
        editSubmittedDate={editSubmittedDate}
        setEditSubmittedDate={setEditSubmittedDate}
        editSubmittedTime={editSubmittedTime}
        setEditSubmittedTime={setEditSubmittedTime}
        editSaleStatus={editSaleStatus}
        setEditSaleStatus={setEditSaleStatus}
        handleSaveEdit={handleSaveEdit}
        deletingRecordId={deletingRecordId}
        setDeletingRecordId={setDeletingRecordId}
        deleteRecord={deleteRecord}
        bulkDeletingRecordIds={bulkDeletingRecordIds}
        setBulkDeletingRecordIds={setBulkDeletingRecordIds}
        isBulkDeletingInProgress={isBulkDeletingInProgress}
        setIsBulkDeletingInProgress={setIsBulkDeletingInProgress}
        deleteRecords={deleteRecords}
        isCustomEntryModalOpen={isCustomEntryModalOpen}
        setIsCustomEntryModalOpen={setIsCustomEntryModalOpen}
        handleAdminCustomEntrySubmit={handleAdminCustomEntrySubmit}
        isBulkModalOpen={isBulkModalOpen}
        setIsBulkModalOpen={setIsBulkModalOpen}
        allMasterBranches={allMasterBranches}
        allowedCategories={allowedCategories}
        profilesList={profilesList}
        profile={profile}
        globalSettings={globalSettings}
        submitting={submitting}
        isAdmin={isAdmin}
        adminViewMode={adminViewMode}
        ownCodename={ownCodename as any}
        addRecord={addRecord}
        showToast={showToast}
        fetchRecords={fetchRecords}
      />
    </>
  );
}
