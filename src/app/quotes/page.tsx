"use client";

import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { useQuotesDashboardData } from "@/hooks/quotes-tracker/useQuotesDashboardData";
import { useSaveFileHelper } from "@/hooks/quotes-tracker/useSaveFileHelper";
import { useCopyHelper } from "@/hooks/quotes-tracker/useCopyHelper";

import { StatsGrid } from "@/components/common/StatsGrid";
import { RecordsTable } from "@/components/quotes-tracker/RecordsTable";
import { DailyEntryForm } from "@/components/leave-tracker/DailyEntryForm";
import { EditRecordModal } from "@/components/quotes-tracker/modals/EditRecordModal";
import { ConfirmModal } from "@/components/common/modals/ConfirmModal";
import { CustomEntryModal } from "@/components/quotes-tracker/modals/CustomEntryModal";
import { SaleStatusModal } from "@/components/quotes-tracker/modals/SaleStatusModal";
import { AdminViewToggle } from "@/components/leave-tracker/AdminViewToggle";
import { SkeletonLoader } from "@/components/quotes-tracker/QuotesSkeletonLoader";
import { AnalyticsPanel } from "@/components/leave-tracker/AnalyticsPanel";
import { AuditLogsPanel } from "@/components/common/AuditLogsPanel";
import { QuoteRulesPanel } from "@/components/quotes-tracker/QuoteRulesPanel";
import { CopyHelperPanel } from "@/components/quotes-tracker/CopyHelperPanel";
import { SaveFileHelperPanel } from "@/components/quotes-tracker/SaveFileHelperPanel";
import { IPChecker } from "@/components/leave-tracker/IPChecker";
import { LoginCodesPanel } from "@/components/quotes-tracker/LoginCodesPanel";
import { CausalityPanel } from "@/components/quotes-tracker/CausalityPanel";
import { validator } from "@/utils/quotesValidator";
import {
  calculateSummaryStats,
  formatDate,
  exportToCSV,
  cleanFileName,
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
  ScrollText,
  Save,
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
  activeTab: "entry" | "monthly" | "analytics" | "audit_logs" | "rules" | "ip_checker" | "login_codes" | "causality" | "copy_helper" | "save_file";
  onTabChange: (tab: "entry" | "monthly" | "analytics" | "audit_logs" | "rules" | "ip_checker" | "login_codes" | "causality" | "copy_helper" | "save_file") => void;
}

export default function Dashboard({
  activeTab,
  onTabChange,
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
        targetTab === "analytics" ||
        targetTab === "audit_logs" ||
        targetTab === "rules" ||
        targetTab === "ip_checker" ||
        targetTab === "login_codes" ||
        targetTab === "causality" ||
        targetTab === "copy_helper" ||
        targetTab === "save_file"
      ) {
        onTabChange(targetTab);
      }
    };
    window.addEventListener("quotes-tab-change", handleTabChange);
    return () => window.removeEventListener("quotes-tab-change", handleTabChange);
  }, [onTabChange]);

  const specificDateRef = useRef<HTMLInputElement>(null);
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
    auditLogs,
    auditLogsLoading,
    fetchAuditLogs,
    logActivity,
  } = dashboardData;

  const isSuperAdmin = profile?.codename?.toUpperCase() === 'KAMRUL' || profile?.full_name === 'Kamrul Islam';



  // Fetch audit logs when activeTab becomes 'audit_logs'
  useEffect(() => {
    if (activeTab === "audit_logs" && (profile?.role === "admin" || profile?.role === "supervisor")) {
      fetchAuditLogs();
    }
  }, [activeTab, profile, fetchAuditLogs]);

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





  // Monthly Table Search Query
  const [searchQuery, setSearchQuery] = useState("");

  // Today's Table Search Query
  const [todaySearchQuery, setTodaySearchQuery] = useState("");

  // Branch Selection Filters
  const [selectedBranch, setSelectedBranch] = useState("");
  const [todaySelectedBranch, setTodaySelectedBranch] = useState("");



  // Monthly Table Date filter state
  const [selectedDate, setSelectedDate] = useState("");
  const [dateInputVal, setDateInputVal] = useState("");

  // Sync text input with selectedDate
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

  const handleDateInputChange = (val: string) => {
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
          setSelectedYear(yyyy);
          setSelectedMonth(mm);
          return;
        }
      }
    }
    setSelectedDate("");
  };

  // Admin Backdated Entry Modal State
  const [isCustomEntryModalOpen, setIsCustomEntryModalOpen] = useState(false);



  // Edit Record Modal State
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [editBranchName, setEditBranchName] = useState("");
  const [editCodename, setEditCodename] = useState("");
  const [editFileType, setEditFileType] = useState<FileType>("Quote");
  const [editSaleStatus, setEditSaleStatus] = useState<"SOLD" | "UNSOLD">("SOLD");
  const [editSubmittedDate, setEditSubmittedDate] = useState("");
  const [editSubmittedTime, setEditSubmittedTime] = useState("");
  const [editCanChangeSubmittedAt, setEditCanChangeSubmittedAt] =
    useState(false);

  // Copy Helper States
  const [showReportHelper, setShowReportHelper] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("quotes_sales_show_report_helper") === "true";
    }
    return false;
  });

  // Save File States
  const [showSaveFileHelper, setShowSaveFileHelper] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("quotes_sales_show_save_file_helper") === "true";
    }
    return false;
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("quotes_sales_show_report_helper", String(showReportHelper));
    }
  }, [showReportHelper]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("quotes_sales_show_save_file_helper", String(showSaveFileHelper));
    }
  }, [showSaveFileHelper]);

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleFormDetails, setSaleFormDetails] = useState<{
    fileName: string;
    branchName: string;
    codename: string;
    fileType: FileType;
  } | null>(null);



  const todayUserRecords = useMemo(() => {
    const effectiveCodename = codenameInput || profile?.username || "";
    return records.filter((r) => {
      const isToday = new Date(r.submitted_at).toDateString() === new Date().toDateString();
      const matchesUser = r.codename.toUpperCase() === effectiveCodename.toUpperCase();
      return isToday && matchesUser;
    });
  }, [records, codenameInput, profile?.username]);

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

  // ── Copy Helper Hook ───────────────────────────────────────────────
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
    copyText1,
    copyText2,
    copyNotes,
  } = useCopyHelper({ showToast, todayUserRecords, profile, codenameInput });



  // Record deletion state for confirmation modal
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  // Bulk record deletion state for confirmation modal
  const [bulkDeletingRecordIds, setBulkDeletingRecordIds] = useState<string[] | null>(null);
  const [isBulkDeletingInProgress, setIsBulkDeletingInProgress] = useState(false);

  // Force Change Password / Onboarding Customization Modal State
  const [ownFullName, setOwnFullName] = useState(
    () => profile?.full_name || "",
  );
  const [ownCodename, setOwnCodename] = useState(() => profile?.username || "");
  const [ownPassword, setOwnPassword] = useState("");
  const [ownConfirmPassword, setOwnConfirmPassword] = useState("");
  const [showOwnPass, setShowOwnPass] = useState(false);
  const [showOwnConfirmPass, setShowOwnConfirmPass] = useState(false);

  // Real-time password feedback (6 to 12 characters, matching check)
  const passwordFeedback = useMemo(() => {
    if (!ownPassword) return null;
    if (ownPassword.length < 6 || ownPassword.length > 12) {
      return {
        text: "Password must be 6 to 12 characters long",
        isError: true,
      };
    }
    if (!ownConfirmPassword) {
      return { text: "Please confirm password", isError: true };
    }
    if (ownPassword !== ownConfirmPassword) {
      return { text: "Passwords do not match", isError: true };
    }
    return { text: "Passwords match", isError: false };
  }, [ownPassword, ownConfirmPassword]);

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
    const monthsForYear = availableDates
      .filter((d) => d.year === selectedYear)
      .map((d) => d.month);
    const uniqueMonths = Array.from(new Set(monthsForYear)).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10),
    );
    return uniqueMonths.map((m) => ({
      val: m,
      name: allMonthsMap[m] || m,
    }));
  }, [availableDates, selectedYear]);

  // Adjust selected month when selected year changes and month is no longer valid
  useEffect(() => {
    const isValid = dynamicMonths.some((m) => m.val === selectedMonth);
    if (!isValid && dynamicMonths.length > 0) {
      setSelectedMonth(dynamicMonths[dynamicMonths.length - 1].val);
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

  // Unique branches extracted dynamically from all records
  const uniqueBranches = useMemo(() => {
    const branches = new Set<string>();
    records.forEach((r) => {
      if (r.branch_name) {
        branches.add(r.branch_name.toUpperCase().trim());
      }
    });
    return Array.from(branches).sort();
  }, [records]);

  // Filtered records for Monthly Tab
  const monthlyFilteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Admin filter mode
      if (
        (profile?.role === "admin" || profile?.role === "supervisor") &&
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
        if (r.branch_name.toUpperCase().trim() !== selectedBranch.toUpperCase().trim()) {
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
  }, [records, adminViewMode, selectedDate, searchQuery, selectedBranch, profile, sessionUser]);

  // Today's entries (submitted on the current local day)
  const todayRecords = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local format
    return records.filter((r) => {
      // Admin filter mode
      if (
        (profile?.role === "admin" || profile?.role === "supervisor") &&
        adminViewMode === "mine" &&
        r.user_id !== sessionUser?.id
      ) {
        return false;
      }
      const recordDate = new Date(r.submitted_at).toLocaleDateString("en-CA");
      return recordDate === todayStr;
    });
  }, [records, adminViewMode, profile, sessionUser]);

  // Filtered entries for Today's list table
  const todayFilteredRecords = useMemo(() => {
    return todayRecords.filter((r) => {
      // Branch Dropdown filter
      if (todaySelectedBranch) {
        if (r.branch_name.toUpperCase().trim() !== todaySelectedBranch.toUpperCase().trim()) {
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
      const activeTabOtherSiteTotal = todayRecords.filter(r => {
        if (todaySelectedBranch) {
          return r.branch_name.toUpperCase().trim() === todaySelectedBranch.toUpperCase().trim();
        }
        return true;
      }).filter(r => r.file_type === 'Other Site').length;
      return {
        ...stats,
        datasetOtherSiteTotal: activeTabOtherSiteTotal
      };
    }
    return stats;
  }, [todayFilteredRecords, todaySearchQuery, todayRecords, todaySelectedBranch]);

  // Statistics calculation for monthly entries (filtered by search query)
  const monthlyStats = useMemo(() => {
    const stats = calculateSummaryStats(monthlyFilteredRecords);
    if (searchQuery) {
      const activeTabOtherSiteTotal = records.filter((r) => {
        if (
          (profile?.role === "admin" || profile?.role === "supervisor") &&
          adminViewMode === "mine" &&
          r.user_id !== sessionUser?.id
        ) {
          return false;
        }
        if (selectedDate) {
          const recordDate = new Date(r.submitted_at).toLocaleDateString("en-CA");
          if (recordDate !== selectedDate) {
            return false;
          }
        }
        if (selectedBranch) {
          if (r.branch_name.toUpperCase().trim() !== selectedBranch.toUpperCase().trim()) {
            return false;
          }
        }
        return true;
      }).filter(r => r.file_type === 'Other Site').length;

      return {
        ...stats,
        datasetOtherSiteTotal: activeTabOtherSiteTotal
      };
    }
    return stats;
  }, [monthlyFilteredRecords, searchQuery, records, adminViewMode, selectedDate, selectedBranch, profile, sessionUser]);

  // Export handlers
  const handleExportTodayExcel = () => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    exportToCSV(todayFilteredRecords, `Today_Logs_${todayStr}`);
    logActivity(
      "EXPORT_EXCEL",
      null,
      `Exported today's records (Count: ${todayFilteredRecords.length}) to Excel`
    );
  };

  const handleExportMonthlyExcel = () => {
    const monthName = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toLocaleString('en-US', { month: 'long' });
    exportToCSV(monthlyFilteredRecords, `Monthly_Logs_${monthName}_${selectedYear}`);
    logActivity(
      "EXPORT_EXCEL",
      null,
      `Exported monthly records for ${monthName} ${selectedYear} (Count: ${monthlyFilteredRecords.length}) to Excel`
    );
  };

  // Open native picker for specific date
  const handleOpenSpecificDatePicker = () => {
    if (specificDateRef.current) {
      try {
        specificDateRef.current.showPicker();
      } catch {
        specificDateRef.current.click();
      }
    }
  };

  // Specific Date filter change handler
  const handleDateFilterChange = (dateValue: string) => {
    setSelectedDate(dateValue);
    if (dateValue) {
      const [year, month] = dateValue.split("-");
      if (year && month) {
        setSelectedYear(year);
        setSelectedMonth(month);
      }
    }
  };

  // Submit Admin Backdated / Custom Date Entry from Modal
  const handleAdminCustomEntrySubmit = async (
    fileName: string,
    branchName: string,
    fileType: FileType,
    userId: string,
    submittedAtDate: string,
  ): Promise<boolean> => {
    if (!userId) {
      showToast("error", "Please select a user.");
      return false;
    }
    if (!submittedAtDate) {
      showToast("error", "Please select a submission date.");
      return false;
    }

    // For non-admin mode, use currentUserProfile; for admin/supervisor mode, look up in profilesList
    const targetProfile =
      (profile?.role === "admin" || profile?.role === "supervisor")
        ? profilesList.find((p) => p.id === userId)
        : userId === profile?.id
          ? profile
          : null;

    if (!targetProfile) {
      showToast("error", "Selected user not found.");
      return false;
    }

    const formValidation = validator.validateRecordForm({
      file_name: fileName,
      branch_name: branchName,
      codename: targetProfile.username,
      file_type: fileType,
    });

    if (!formValidation.isValid) {
      showToast("error", formValidation.errors[0]);
      return false;
    }

    const now = new Date();
    const timePart = now.toTimeString().split(" ")[0]; // HH:MM:SS
    const customSubmittedAt = new Date(
      `${submittedAtDate}T${timePart}`,
    ).toISOString();

    const success = await addRecord(
      fileName,
      branchName,
      targetProfile.username,
      fileType,
      userId,
      customSubmittedAt,
    );

    return success;
  };

  const handleClearTodayFilters = () => {
    setTodaySearchQuery("");
    setTodaySelectedBranch("");
  };

  const submitNewEntry = async (
    fName: string,
    bName: string,
    cName: string,
    fType: FileType,
  ) => {
    if (submitting) return;
    const success = await addRecord(fName, bName, cName, fType);
    if (success) {
      setFileName("");
      setBranchName("");
      // Keep codename, but reset type to default first allowed type
      if (profile?.allowed_types && profile.allowed_types.length > 0) {
        setFileType(profile.allowed_types[0] as FileType);
      } else {
        setFileType("Quote");
      }
    }
  };

  const handleConfirmSaleStatus = async (status: "SOLD" | "UNSOLD") => {
    if (!saleFormDetails || submitting) return;
    const finalFileName = `${saleFormDetails.fileName} [${status}]`;
    setShowSaleModal(false);
    await submitNewEntry(
      finalFileName,
      saleFormDetails.branchName,
      saleFormDetails.codename,
      saleFormDetails.fileType,
    );
    setSaleFormDetails(null);
  };

  // Submit Daily Entry
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleanedFileName = cleanFileName(fileName);
    setFileName(cleanedFileName);

    const formValidation = validator.validateRecordForm({
      file_name: cleanedFileName,
      branch_name: branchName,
      codename: codenameInput,
      file_type: fileType,
    });

    if (!formValidation.isValid) {
      showToast("error", formValidation.errors[0]);
      return;
    }

    if (fileType === "Sale") {
      setSaleFormDetails({
        fileName: cleanedFileName,
        branchName,
        codename: codenameInput,
        fileType,
      });
      setShowSaleModal(true);
    } else {
      await submitNewEntry(cleanedFileName, branchName, codenameInput, fileType);
    }
  };

  // Save Record Edits
  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    const validation = validator.validateRecordForm({
      file_name: editFileName,
      branch_name: editBranchName,
      codename: editCodename,
      file_type: editFileType,
    });

    if (!validation.isValid) {
      showToast("error", validation.errors[0]);
      return;
    }

    let editedSubmittedAt: string | undefined;

    if (editCanChangeSubmittedAt) {
      const [dayText, monthText, yearText] = editSubmittedDate.split("-");
      const day = Number(dayText);
      const month = Number(monthText);
      const year = Number(yearText);
      const parsedDate = new Date(year, month - 1, day);

      if (
        !dayText ||
        !monthText ||
        !yearText ||
        dayText.length !== 2 ||
        monthText.length !== 2 ||
        yearText.length !== 4 ||
        isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
      ) {
        showToast("error", "Please enter the date as DD-MM-YYYY.");
        return;
      }

      const timeMatch = editSubmittedTime
        .trim()
        .match(/^(0[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i);

      if (!timeMatch) {
        showToast("error", "Please enter the time as 09:21 PM/AM.");
        return;
      }

      let hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      const meridiem = timeMatch[3].toUpperCase();

      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      parsedDate.setHours(hours, minutes, 0, 0);
      editedSubmittedAt = parsedDate.toISOString();
    }

    const finalFileName = editFileType === "Sale" ? `${editFileName} [${editSaleStatus}]` : editFileName;
    const success = await updateRecord(
      editingRecord.id,
      finalFileName,
      editBranchName,
      editCodename,
      editFileType,
      editedSubmittedAt,
    );

    if (success) {
      setEditingRecord(null);
    }
  };

  const handleSaveInline = async (id: string, updates: Partial<RecordItem>): Promise<boolean> => {
    if (updates.file_name !== undefined && !updates.file_name.trim()) {
      showToast("error", "File name cannot be empty.");
      return false;
    }
    if (updates.branch_name !== undefined && !updates.branch_name.trim()) {
      showToast("error", "Branch name cannot be empty.");
      return false;
    }
    if (updates.codename !== undefined && !updates.codename.trim()) {
      showToast("error", "Codename cannot be empty.");
      return false;
    }

    const originalRecord = records.find(r => r.id === id);
    if (!originalRecord) return false;

    const finalFileName = updates.file_name !== undefined ? updates.file_name : originalRecord.file_name;
    const finalBranchName = updates.branch_name !== undefined ? updates.branch_name : originalRecord.branch_name;
    const finalCodename = updates.codename !== undefined ? updates.codename : originalRecord.codename;
    const finalFileType = updates.file_type !== undefined ? updates.file_type : originalRecord.file_type;
    const finalSubmittedAt = updates.submitted_at !== undefined ? updates.submitted_at : originalRecord.submitted_at;

    const success = await updateRecord(
      id,
      finalFileName,
      finalBranchName,
      finalCodename,
      finalFileType,
      finalSubmittedAt
    );

    return success;
  };

  const handleBulkSaveInline = async (updatesMap: Record<string, Partial<RecordItem>>): Promise<boolean> => {
    for (const id of Object.keys(updatesMap)) {
      const updates = updatesMap[id];
      if (updates.file_name !== undefined && !updates.file_name.trim()) {
        showToast("error", "File name cannot be empty.");
        return false;
      }
      if (updates.branch_name !== undefined && !updates.branch_name.trim()) {
        showToast("error", "Branch name cannot be empty.");
        return false;
      }
      if (updates.codename !== undefined && !updates.codename.trim()) {
        showToast("error", "Codename cannot be empty.");
        return false;
      }
    }

    const success = await bulkUpdateRecords(updatesMap);
    return success;
  };

  const handleOpenEditRecord = (
    record: RecordItem,
    canChangeSubmittedAt = false,
  ) => {
    const submittedAt = new Date(record.submitted_at);

    setEditingRecord(record);
    const cleanName = record.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, '');
    setEditFileName(cleanName);
    setEditBranchName(record.branch_name);
    setEditCodename(record.codename);
    setEditFileType(record.file_type);
    setEditCanChangeSubmittedAt(canChangeSubmittedAt);

    if (record.file_name.endsWith(" [UNSOLD]")) {
      setEditSaleStatus("UNSOLD");
    } else {
      setEditSaleStatus("SOLD");
    }

    if (!isNaN(submittedAt.getTime())) {
      setEditSubmittedDate(
        `${String(submittedAt.getDate()).padStart(2, "0")}-${String(
          submittedAt.getMonth() + 1,
        ).padStart(2, "0")}-${submittedAt.getFullYear()}`,
      );
      const hour24 = submittedAt.getHours();
      const hour12 = hour24 % 12 || 12;
      const meridiem = hour24 >= 12 ? "PM" : "AM";
      setEditSubmittedTime(
        `${String(hour12).padStart(2, "0")}:${String(
          submittedAt.getMinutes(),
        ).padStart(2, "0")} ${meridiem}`,
      );
    } else {
      setEditSubmittedDate("");
      setEditSubmittedTime("");
    }
  };



  // Admin reset password handled inline inside EditProfileModal

  // Logged-in user complete first-time setup (Customizes username, full name, password)
  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ownFullName.trim()) {
      showToast("error", "Please enter your full name.");
      return;
    }
    if (!ownCodename.trim() || ownCodename.trim().length < 3) {
      showToast("error", "Codename must be at least 3 characters long.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(ownCodename.trim())) {
      showToast(
        "error",
        "Codename can only contain English letters, numbers, - and _.",
      );
      return;
    }

    const validation = validator.validateOnboardingPassword(ownPassword);
    if (!validation.isValid) {
      showToast("error", validation.errors[0]);
      return;
    }
    if (ownPassword !== ownConfirmPassword) {
      showToast("error", "Password confirmation does not match.");
      return;
    }

    const success = await completeFirstTimeSetup(
      ownCodename,
      ownFullName,
      ownPassword,
    );
    if (success) {
      setOwnPassword("");
      setOwnConfirmPassword("");
    }
  };

  // Loading Screen
  if (loading) {
    let loaderType: "form" | "table" | "analytics" | "audit-logs" | "rules" | "ip_checker" | "login_codes" | "causality" | "generic" = "generic";
    if (activeTab === "entry") loaderType = "form";
    else if (activeTab === "causality") loaderType = "causality";
    else if (activeTab === "monthly") loaderType = "table";
    else if (activeTab === "analytics") loaderType = "analytics";
    else if (activeTab === "audit_logs") loaderType = "audit-logs";
    else if (activeTab === "rules") loaderType = "rules";
    else if (activeTab === "ip_checker") loaderType = "ip_checker";
    else if (activeTab === "login_codes") loaderType = "login_codes";

    return (
      <div className="w-full">
        <SkeletonLoader type={loaderType} />
      </div>
    );
  }

  // Force Password Change & Onboarding custom setup
  if (profile && profile.has_changed_password === false) {
    return (
      <div className="flex-1 min-h-screen flex flex-col justify-center items-center bg-slate-955 px-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-8 shadow-2xl rounded-2xl z-10 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white bg-clip-text bg-linear-to-r from-blue-400 to-violet-400">
              Profile Settings & Password Change
            </h2>
            <p className="text-xs text-slate-450 mt-1">
              This is your first login. Please verify your details and set a new
              password.
            </p>
          </div>

          <form onSubmit={handleFirstTimeSetup} className="space-y-4">
            <div>
              <label className="flex text-xs font-semibold text-slate-350 mb-1 items-center gap-1">
                <Info className="h-3 w-3 text-blue-500" /> Your Full Name
                {profile?.full_name && profile.full_name.trim() !== "" && (
                  <span className="text-[10px] text-slate-500 font-normal">
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
                className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-900/30"
              />
            </div>

            <div>
              <label className="flex text-xs font-semibold text-slate-355 mb-1 items-center gap-1">
                <UserCheck className="h-3 w-3 text-blue-500" /> Your Codename
                {profile?.username && profile.username.trim() !== "" && (
                  <span className="text-[10px] text-slate-500 font-normal">
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
                className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-900/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-350 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showOwnPass ? "text" : "password"}
                  required
                  placeholder="6 to 12 character password"
                  value={ownPassword}
                  onChange={(e) => setOwnPassword(e.target.value)}
                  className="block w-full px-3 pr-10 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnPass(!showOwnPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
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
              <label className="block text-xs font-semibold text-slate-355 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showOwnConfirmPass ? "text" : "password"}
                  required
                  placeholder="Re-enter new password"
                  value={ownConfirmPassword}
                  onChange={(e) => setOwnConfirmPassword(e.target.value)}
                  className="block w-full px-3 pr-10 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnConfirmPass(!showOwnConfirmPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
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
                className="flex-1 py-2.5 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Logout
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-semibold text-white bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 disabled:opacity-50 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950"
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

  return (
    <>
          {/* TAB 1: DAILY ENTRY */}
          {activeTab === "entry" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">New File Entry</h2>
                <p className="text-xs text-slate-450 mt-1">
                  Fill out the form below to submit file data.
                </p>
              </div>

              {/* Data Entry Form Component */}
              <Suspense fallback={<SkeletonLoader type="form" />}>
                <DailyEntryForm
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
                  onSubmit={handleAddEntry}
                  isAdmin={false}
                />
              </Suspense>

              {/* Today's Data Title and Summary Stats */}
              <div className="border-t border-slate-800/80 pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-md font-bold text-white flex items-center gap-2">
                      <Clock className="h-4.5 w-4.5 text-blue-500" />
                      Today's File Entry List
                    </h3>
                    <p className="text-[11px] text-slate-455 mt-0.5">
                      Date:{" "}
                      {new Date().toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                    <button
                      onClick={handleExportTodayExcel}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer shadow-md"
                      title="Export to Excel"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Excel</span>
                    </button>

                    {(profile?.role === "admin" || profile?.role === "supervisor") && (
                      <AdminViewToggle
                        viewMode={adminViewMode}
                        onChange={handleAdminViewModeChange}
                      />
                    )}
                  </div>
                </div>

                <>
                    {/* Search Filters for Today's Table - BEFORE Stats */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Search name, codename..."
                          value={todaySearchQuery}
                          onChange={(e) => setTodaySearchQuery(e.target.value)}
                          className="block w-full pl-8 pr-8 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-8"
                        />
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-555" />
                        {todaySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setTodaySearchQuery("")}
                            className="absolute right-2.5 top-1.5 flex items-center justify-center p-0.5 hover:bg-slate-800 rounded-full text-slate-405 hover:text-white transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer"
                            title="Clear search"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <select
                        value={todaySelectedBranch}
                        onChange={(e) => setTodaySelectedBranch(e.target.value)}
                        className="block w-full sm:w-44 px-3 py-1 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-8"
                      >
                        <option value="">All Branches</option>
                        {uniqueBranches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>

                      {(todaySearchQuery || todaySelectedBranch) && (
                        <button
                          type="button"
                          onClick={handleClearTodayFilters}
                          className="px-3 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white font-semibold rounded-lg transition-all h-8 cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Stat pills summary Component */}
                    <Suspense fallback={<SkeletonLoader type="stats" />}>
                      <StatsGrid stats={todayStats} isLoading={recordsLoading} />
                    </Suspense>

                    {/* Today's Records Table Component */}
                    <Suspense fallback={<SkeletonLoader type="table" />}>
                      <RecordsTable
                        records={todayFilteredRecords}
                        emptyMessage="No file entries for today matching the filters."
                        showDate={false}
                        onEdit={(record) => handleOpenEditRecord(record, false)}
                        onDelete={setDeletingRecordId}
                        isLoading={recordsLoading}
                        currentUserId={sessionUser?.id}
                        isAdmin={profile?.role === "admin" || profile?.role === "supervisor"}
                        onBulkDelete={setBulkDeletingRecordIds}
                        onSaveInline={handleSaveInline}
                        onBulkSaveInline={handleBulkSaveInline}
                        allowedCategories={allowedCategories}
                        submitting={submitting}
                      />
                    </Suspense>
                  </>
              </div>
            </div>
          )}

          {/* TAB 2: MONTHLY LIST */}
          {activeTab === "monthly" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Monthly Quotes & Sales Logs
                  </h2>
                  <p className="text-xs text-slate-450 mt-1">
                    Filter and view data for all months and years.
                  </p>
                </div>

                {/* View toggle & Custom Entry Controls */}
                <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                  <button
                    onClick={handleExportMonthlyExcel}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer shadow-md"
                    title="Export to Excel"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Excel</span>
                  </button>

                  <button
                    onClick={() => setIsCustomEntryModalOpen(true)}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg shadow-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Custom Entry</span>
                  </button>
                  {(profile?.role === "admin" || profile?.role === "supervisor") && (
                    <AdminViewToggle
                      viewMode={adminViewMode}
                      onChange={handleAdminViewModeChange}
                    />
                  )}
                </div>
              </div>

              {/* Date selection row & Filters */}
              <div className="space-y-4">
                <div className="bg-slate-955/40 p-4 rounded-2xl border border-slate-850 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end w-full">
                  {/* 1. Search Box */}
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-350 mb-1">
                      Search
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search name, codename..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-8 pr-8 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-9"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-555" />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-2.5 flex items-center justify-center p-0.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer"
                          title="Clear search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. Branch Selector */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-350 mb-1">
                      Branch
                    </label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-9"
                    >
                      <option value="">All Branches</option>
                      {uniqueBranches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Year Selection */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-350 mb-1">
                      Year
                    </label>
                    <select
                      value={selectedYear}
                      disabled={!!selectedDate}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        setSelectedDate(""); // Reset specific date filter
                      }}
                      className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/30 h-9"
                    >
                      {dynamicYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Month Selection */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-355 mb-1">
                      Month
                    </label>
                    <select
                      value={selectedMonth}
                      disabled={!!selectedDate}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setSelectedDate(""); // Reset specific date filter
                      }}
                      className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-900/30 h-9"
                    >
                      {dynamicMonths.map((m) => (
                        <option key={m.val} value={m.val}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Specific Date Input */}
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-350 mb-1">
                      Specific Date
                    </label>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="DD-MM-YYYY"
                        value={dateInputVal}
                        onChange={(e) => handleDateInputChange(e.target.value)}
                        maxLength={10}
                        className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 h-9"
                      />
                      <input
                        type="date"
                        ref={specificDateRef}
                        value={selectedDate}
                        onChange={(e) => handleDateFilterChange(e.target.value)}
                        className="absolute w-px h-px opacity-0 pointer-events-none select-none"
                      />
                      <button
                        type="button"
                        onClick={handleOpenSpecificDatePicker}
                        className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-400 rounded-lg transition-all duration-200 flex items-center justify-center shrink-0 w-9 h-9 cursor-pointer"
                        title="Open Calendar"
                      >
                        <Calendar className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSelectedBranch("");
                          setSelectedYear(new Date().getFullYear().toString());
                          setSelectedMonth(String(new Date().getMonth() + 1).padStart(2, '0'));
                          setSelectedDate("");
                          setDateInputVal("");
                        }}
                        className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-400 rounded-lg transition-all duration-200 flex items-center justify-center shrink-0 w-9 h-9 cursor-pointer"
                        title="Reset all filters"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Stats summary grid */}
              <Suspense fallback={<SkeletonLoader type="stats" />}>
                <StatsGrid stats={monthlyStats} isLoading={recordsLoading} />
              </Suspense>

              {/* Monthly Table Component */}
              <Suspense fallback={<SkeletonLoader type="table" />}>
                <RecordsTable
                  records={monthlyFilteredRecords}
                  emptyMessage="No file records found matching the filters."
                  showDate={true}
                  onEdit={(record) => handleOpenEditRecord(record, true)}
                  onDelete={setDeletingRecordId}
                  isLoading={recordsLoading}
                  currentUserId={sessionUser?.id}
                  isAdmin={profile?.role === "admin" || profile?.role === "supervisor"}
                  onBulkDelete={setBulkDeletingRecordIds}
                  onSaveInline={handleSaveInline}
                  onBulkSaveInline={handleBulkSaveInline}
                  allowedCategories={allowedCategories}
                  submitting={submitting}
                />
              </Suspense>
            </div>
          )}

          {/* TAB 4: PERFORMANCE ANALYTICS */}
          {activeTab === "analytics" && (profile?.role === "admin" || profile?.role === "supervisor") && (
            <Suspense fallback={<SkeletonLoader type="analytics" />}>
              <AnalyticsPanel
                records={records}
                profilesList={profilesList}
                profile={profile}
              />
            </Suspense>
          )}

          {/* TAB 5: SYSTEM AUDIT LOGS */}
          {activeTab === "audit_logs" && (profile?.role === "admin" || profile?.role === "supervisor") && (
            <Suspense fallback={<SkeletonLoader type="audit-logs" />}>
              <AuditLogsPanel
                logs={auditLogs}
                isLoading={auditLogsLoading}
                onRefresh={fetchAuditLogs}
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

          {/* TAB 7: IP CHECKER */}
          {activeTab === "ip_checker" && (
            <IPChecker showToast={showToast} />
          )}

          {/* TAB 8: LOGIN CODES */}
          {activeTab === "login_codes" && (
            <LoginCodesPanel
              canEdit={profile?.role === 'admin' || profile?.role === 'supervisor'}
              isOnline={isOnline}
              showToast={showToast}
            />
          )}

          {/* TAB 9: CAUSALITY (Asitis + EUI combined) */}
          {activeTab === "causality" && (
            <CausalityPanel
              profile={profile}
              isOnline={isOnline}
            />
          )}

          {/* TAB 11: COPY HELPER (Superadmin only) */}
          {activeTab === "copy_helper" && isSuperAdmin && (
            <Suspense fallback={<SkeletonLoader type="copy-helper" />}>
              <CopyHelperPanel
                profile={profile}
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
                copyBox1={copyBox1}
                copyBox2={copyBox2}
                copyBox4={copyBox4}
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


      {mounted && typeof window !== "undefined" && document.getElementById("root-modals-portal") ? (
        createPortal(
          <>
            {/* MODAL 0: SOLD/UNSOLD CHOICE */}
            <SaleStatusModal
              isOpen={showSaleModal}
              fileName={saleFormDetails?.fileName || ""}
              onConfirm={handleConfirmSaleStatus}
              onClose={() => setShowSaleModal(false)}
            />

            {/* MODAL 1: EDIT RECORD */}
            {editingRecord && (
              <EditRecordModal
                editFileName={editFileName}
                setEditFileName={setEditFileName}
                editBranchName={editBranchName}
                setEditBranchName={setEditBranchName}
                editCodename={editCodename}
                setEditCodename={setEditCodename}
                editFileType={editFileType}
                setEditFileType={setEditFileType}
                canEditSubmittedAt={editCanChangeSubmittedAt}
                editSubmittedDate={editSubmittedDate}
                setEditSubmittedDate={setEditSubmittedDate}
                editSubmittedTime={editSubmittedTime}
                setEditSubmittedTime={setEditSubmittedTime}
                allowedCategories={allowedCategories}
                onClose={() => setEditingRecord(null)}
                onSave={handleSaveEdit}
                editSaleStatus={editSaleStatus}
                setEditSaleStatus={setEditSaleStatus}
                submitting={submitting}
              />
            )}



            {/* MODAL 6: DELETE RECORD CONFIRMATION */}
            <ConfirmModal
              isOpen={!!deletingRecordId}
              onClose={() => setDeletingRecordId(null)}
              onConfirm={() => {
                if (deletingRecordId) {
                  deleteRecord(deletingRecordId);
                  setDeletingRecordId(null);
                }
              }}
              title="Delete File Record"
              message="Are you sure you want to permanently delete this file record? This action cannot be undone."
              confirmText="Delete Record"
              cancelText="Cancel"
              isDanger={true}
            />

            {/* MODAL 6b: BULK DELETE RECORD CONFIRMATION */}
            <ConfirmModal
              isOpen={!!bulkDeletingRecordIds}
              onClose={() => setBulkDeletingRecordIds(null)}
              onConfirm={async () => {
                if (bulkDeletingRecordIds) {
                  const idsToDelete = [...bulkDeletingRecordIds];
                  setBulkDeletingRecordIds(null);
                  setIsBulkDeletingInProgress(true);
                  try {
                    await deleteRecords(idsToDelete);
                  } catch (err) {
                    console.error("Bulk delete failed:", err);
                  } finally {
                    setIsBulkDeletingInProgress(false);
                  }
                }
              }}
              title="Delete Selected Records"
              message={`Are you sure you want to permanently delete the ${bulkDeletingRecordIds?.length} selected file records? This action cannot be undone.`}
              confirmText="Delete Records"
              cancelText="Cancel"
              isDanger={true}
            />

            {/* MODAL 7: CUSTOM DATE ENTRY */}
            <CustomEntryModal
              isOpen={isCustomEntryModalOpen}
              onClose={() => setIsCustomEntryModalOpen(false)}
              profilesList={profilesList}
              currentUserProfile={profile}
              submitting={submitting}
              adminMode={(profile?.role === "admin" || profile?.role === "supervisor") && adminViewMode === "all"}
              onSubmit={handleAdminCustomEntrySubmit}
            />

            {/* BULK DELETING OVERLAY */}
            {isBulkDeletingInProgress && (
              <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-xs z-9999 flex flex-col items-center justify-center select-none">
                <div className="flex flex-col items-center p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl animate-fade-in max-w-sm w-full mx-4 text-center">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-4 uppercase tracking-wider">Deleting Records...</h4>
                  <p className="text-xs text-slate-400 mt-2">
                    Please wait while the selected entries are being permanently removed from the database.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-4 italic">
                    You can reload the page if it hangs.
                  </p>
                </div>
              </div>
            )}
          </>,
          document.getElementById("root-modals-portal")!
        )
      ) : null}
    </>
  );
}
