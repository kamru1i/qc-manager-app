"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { Profile } from "@/types";
import { canAccessModule, isAdminRole } from "@/utils/permissionService";
import {
  FileText,
  Loader2,
  AlertTriangle,
  Printer,
  Save,
  Calendar,
  FileSpreadsheet,
  Target,
} from "lucide-react";
import toast from "react-hot-toast";
import { Capacitor } from "@capacitor/core";
import { isTauriApp } from "@/utils/apiUrlHelper";
import { Modal } from "@/components/common/Modal";
import { KpiSkeleton } from "@/components/common/skeleton/KpiSkeleton";
import { PROFILE_COLUMNS, KPI_ASSESSMENT_COLUMNS } from "@/utils/dbColumns";
import { useProfiles } from "@/contexts/ProfilesContext";

interface UserKpiPerformancePanelProps {
  viewingStaff: Profile;
  onBack?: () => void;
  preSelectedPeriodKey?: string;
  setPreSelectedPeriodKey?: (val: string) => void;
}

const CORE_FILE_TYPES = [
  { key: "Quote", label: "Quote" },
  { key: "Review", label: "Review" },
  { key: "Individual Review", label: "Individual Review" },
  { key: "Requote", label: "Requote" },
  { key: "Requote Van", label: "Requote Van" },
  { key: "Requote Bike", label: "Requote Bike" },
  { key: "Van", label: "Van" },
  { key: "Bike", label: "Bike" },
  { key: "Other Site", label: "Other Site" },
  { key: "Sale", label: "Sale" },
];

export const UserKpiPerformancePanel: React.FC<
  UserKpiPerformancePanelProps
> = ({
  viewingStaff,
  onBack,
  preSelectedPeriodKey = "",
  setPreSelectedPeriodKey,
}) => {
  // Session User Info
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // External Evaluator Mode state
  const [evaluatorModeProfile, setEvaluatorModeProfile] =
    useState<Profile | null>(null);
  const targetStaff = evaluatorModeProfile || viewingStaff;

  const [showViewKpiModal, setShowViewKpiModal] = useState(false);
  const [appraiseeSearchText, setAppraiseeSearchText] = useState("");
  const [assignedAppraisees, setAssignedAppraisees] = useState<any[]>([]);
  const [searchingAppraisee, setSearchingAppraisee] = useState(false);
  const [hasAssignedAppraisees, setHasAssignedAppraisees] = useState(false);

  // Date Selection
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const [activePeriodKey, setActivePeriodKey] = useState<string>("");
  const [dbCustomPeriodFrom, setDbCustomPeriodFrom] = useState<string>("");
  const [dbCustomPeriodTo, setDbCustomPeriodTo] = useState<string>("");
  const [dbCustomPeriodLabel, setDbCustomPeriodLabel] = useState<string>("");

  const [customPeriodModalOpen, setCustomPeriodModalOpen] = useState(false);
  const [newCustomPeriodLabel, setNewCustomPeriodLabel] = useState("");
  const [newCustomPeriodFrom, setNewCustomPeriodFrom] = useState("");
  const [newCustomPeriodTo, setNewCustomPeriodTo] = useState("");

  const [savedPeriods, setSavedPeriods] = useState<any[]>([]);

  useEffect(() => {
    const fetchSavedPeriods = async () => {
      try {
        const { data } = await supabase
          .from("kpi_assessments")
          .select("month_year, kpis, appraiser_signed, appraisee_signed")
          .eq("user_id", targetStaff.id);
        if (data) {
          setSavedPeriods(data);
        }
      } catch (err) {
        console.error("Error fetching saved periods:", err);
      }
    };
    fetchSavedPeriods();
  }, [targetStaff.id]);

  const periodOptions = useMemo(() => {
    const options: { key: string; label: string; isCustom: boolean }[] = [];
    const currentYear = new Date().getFullYear();
    const monthsNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    for (let y = currentYear; y >= currentYear - 1; y--) {
      for (let m = 11; m >= 0; m--) {
        const key = `${y}-${String(m + 1).padStart(2, "0")}`;
        options.push({
          key,
          label: `${monthsNames[m]} ${y}`,
          isCustom: false,
        });
      }
    }

    savedPeriods.forEach((p) => {
      const isStandardPattern = /^\d{4}-\d{2}$/.test(p.month_year);
      if (!isStandardPattern) {
        const customLabel = p.kpis?.customPeriodLabel || p.month_year;
        if (!options.some((opt) => opt.key === p.month_year)) {
          options.push({
            key: p.month_year,
            label: customLabel,
            isCustom: true,
          });
        }
      }
    });

    return options;
  }, [savedPeriods]);

  useEffect(() => {
    if (preSelectedPeriodKey) {
      setActivePeriodKey(preSelectedPeriodKey);
      const isStandardPattern = /^\d{4}-\d{2}$/.test(preSelectedPeriodKey);
      if (isStandardPattern) {
        const parts = preSelectedPeriodKey.split("-");
        setSelectedYear(Number(parts[0]));
        setSelectedMonth(Number(parts[1]) - 1);
        setActivePeriodKey("");
      }
      if (setPreSelectedPeriodKey) setPreSelectedPeriodKey("");
    }
  }, [preSelectedPeriodKey, setPreSelectedPeriodKey]);

  // Header inputs
  const [empId, setEmpId] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [department, setDepartment] = useState("Data Entry");
  const [appraiserName, setAppraiserName] = useState("");
  const [reviewerName, setReviewerName] = useState("");

  // Table row data maps
  const [weightages, setWeightages] = useState<Record<string, number>>({});
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [supervisorScores, setSupervisorScores] = useState<
    Record<string, number>
  >({});
  const [comments, setComments] = useState<Record<string, string>>({});

  // Signatures
  const [appraiseeSigned, setAppraiseeSigned] = useState(false);
  const [appraiseeSignDate, setAppraiseeSignDate] = useState("");
  const [appraiserSigned, setAppraiserSigned] = useState(false);
  const [appraiserSignDate, setAppraiserSignDate] = useState("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbState, setDbState] = useState<"synced" | "local" | "checking">(
    "checking",
  );
  const [, setIsDirty] = useState(false);

  // Autocomplete suggestions for Appraiser
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Production stats count
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [totalSubmissions, setTotalSubmissions] = useState(0);

  // Month list
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Shared profiles list (ProfilesProvider) — replaces this panel's former
  // own-profile fetch and full-table appraiser-autocomplete fetch on mount.
  const { profilesList } = useProfiles();

  // Check current session — resolve own profile from the shared list
  useEffect(() => {
    const fetchSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const own = profilesList.find((p) => p.id === session.user.id);
        if (own) setCurrentUser(own);
      }
    };
    fetchSession();
  }, [profilesList]);

  // Active users for appraiser autocomplete — derived from the shared list
  const appUsers = useMemo(
    () =>
      profilesList
        .map((p) => ({
          id: p.id,
          full_name: p.full_name || "",
          username: p.username || "",
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [profilesList],
  );

  const isSupervisorOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (evaluatorModeProfile) return true;
    if (isAdminRole(currentUser)) return true;

    // For supervisor, they can edit if they are a direct supervisor OR the manually designated appraiser
    if (currentUser.role === "supervisor") {
      if (targetStaff.id === currentUser.id) return true; // Supervisor has full access to their own sheet
      const supervisorIds = targetStaff.supervisor_ids || [];
      const isDirectSupervisor = supervisorIds.includes(currentUser.id);

      const name = (currentUser.full_name || "").trim().toLowerCase();
      const uname = (currentUser.username || "").trim().toLowerCase();
      const appraiser = (appraiserName || "").trim().toLowerCase();
      const isDesignated =
        appraiser && (name === appraiser || uname === appraiser);

      return isDirectSupervisor || isDesignated;
    }

    return false;
  }, [
    currentUser,
    evaluatorModeProfile,
    targetStaff.id,
    targetStaff.supervisor_ids,
    appraiserName,
  ]);

  // Is current viewer the appraisee (the user themselves)?
  const isAppraisee = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.id === targetStaff.id;
  }, [currentUser, targetStaff]);

  // Can the viewer modify appraisee details?
  const canEditAppraiseeFields = useMemo(() => {
    return isAppraisee || isSupervisorOrAdmin;
  }, [isAppraisee, isSupervisorOrAdmin]);

  // Is the current viewer the designated appraiser or an admin?
  const isDesignatedAppraiser = useMemo(() => {
    if (!currentUser) return false;
    if (isAdminRole(currentUser)) return true;
    const name = (currentUser.full_name || "").trim().toLowerCase();
    const uname = (currentUser.username || "").trim().toLowerCase();
    const appraiser = (appraiserName || "").trim().toLowerCase();
    if (!appraiser) return false;
    return name === appraiser || uname === appraiser;
  }, [currentUser, appraiserName]);

  const hasSupervisors = useMemo(() => {
    return targetStaff.supervisor_ids && targetStaff.supervisor_ids.length > 0;
  }, [targetStaff.supervisor_ids]);

  const filteredSuggestions = useMemo(() => {
    const query = (appraiserName || "").trim().toLowerCase();
    if (!query) return [];
    return appUsers.filter((u) => {
      const name = (u.full_name || "").toLowerCase();
      const uname = (u.username || "").toLowerCase();
      return name.includes(query) || uname.includes(query);
    });
  }, [appraiserName, appUsers]);

  // Month key for lookup (e.g. "2026-07")
  const monthYearKey = useMemo(() => {
    if (activePeriodKey) {
      return activePeriodKey;
    }
    return `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  }, [activePeriodKey, selectedMonth, selectedYear]);

  const formatDateToDMY = (dateStr: string) => {
    if (!dateStr) return "";
    if (dateStr.includes("-") && dateStr.split("-")[0].length === 4) {
      const parts = dateStr.split("-");
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  // Format dates for display
  const evaluationPeriod = useMemo(() => {
    const isCustom = !/^\d{4}-\d{2}$/.test(monthYearKey);
    if (isCustom && dbCustomPeriodFrom && dbCustomPeriodTo) {
      return {
        from: formatDateToDMY(dbCustomPeriodFrom),
        to: formatDateToDMY(dbCustomPeriodTo),
      };
    }
    const startStr = `01-${String(selectedMonth + 1).padStart(2, "0")}-${selectedYear}`;
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const endStr = `${String(lastDay).padStart(2, "0")}-${String(selectedMonth + 1).padStart(2, "0")}-${selectedYear}`;
    return { from: startStr, to: endStr };
  }, [
    monthYearKey,
    dbCustomPeriodFrom,
    dbCustomPeriodTo,
    selectedMonth,
    selectedYear,
  ]);

  const globalSettingsStr = JSON.stringify(targetStaff.global_settings || {});
  const performsDataEntry =
    targetStaff.global_settings?.performs_data_entry !== false;
  const performsOtherDeptTasks =
    !!targetStaff.global_settings?.performs_other_dept_tasks;
  const otherDepartment = targetStaff.global_settings?.other_department || "IT";
  const kpiDeptIndicators = useMemo(() => {
    return targetStaff.global_settings?.kpi_dept_indicators || [];
  }, [globalSettingsStr]);
  const kpiOtherDeptIndicators = useMemo(() => {
    return targetStaff.global_settings?.kpi_other_dept_indicators || [];
  }, [globalSettingsStr]);

  const allowedTypesStr = JSON.stringify(targetStaff.allowed_types || []);
  const supervisorIdsStr = JSON.stringify(targetStaff.supervisor_ids || []);

  // Filter allowed file types for this user
  const activeFileTypes = useMemo(() => {
    if (!targetStaff.has_quotes_access) return [];
    try {
      const parsed = JSON.parse(allowedTypesStr);
      if (!Array.isArray(parsed) || parsed.length === 0) return [];
      return CORE_FILE_TYPES.filter((t) => parsed.includes(t.key));
    } catch {
      return [];
    }
  }, [allowedTypesStr, targetStaff.has_quotes_access]);

  // 1. Fetch default supervisor name if empty (only when targetStaff or supervisors list changes)
  useEffect(() => {
    let active = true;
    const fetchSupervisorName = async () => {
      if (targetStaff.supervisor_ids && targetStaff.supervisor_ids.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .in("id", targetStaff.supervisor_ids)
          .limit(1);
        if (data && data.length > 0 && active && !appraiserName) {
          setAppraiserName(data[0].full_name || "");
        }
      }
    };
    fetchSupervisorName();
    return () => {
      active = false;
    };
  }, [targetStaff.id, supervisorIdsStr]);

  // 2. Fetch record counts for the selected month/custom period
  useEffect(() => {
    let active = true;
    const fetchProductionCounts = async () => {
      let startDate: Date;
      let endDate: Date;

      const isCustom = !/^\d{4}-\d{2}$/.test(monthYearKey);
      if (isCustom && dbCustomPeriodFrom && dbCustomPeriodTo) {
        startDate = new Date(dbCustomPeriodFrom);
        endDate = new Date(dbCustomPeriodTo);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
      }

      const { data: recordData } = await supabase
        .from("records")
        .select("file_type")
        .eq("user_id", targetStaff.id)
        .gte("submitted_at", startDate.toISOString())
        .lte("submitted_at", endDate.toISOString());

      if (recordData && active) {
        const counts: Record<string, number> = {};
        let total = 0;
        recordData.forEach((r: any) => {
          counts[r.file_type] = (counts[r.file_type] || 0) + 1;
          total++;
        });
        setTypeCounts(counts);
        setTotalSubmissions(total);
      }
    };

    fetchProductionCounts();
    return () => {
      active = false;
    };
  }, [
    targetStaff.id,
    selectedMonth,
    selectedYear,
    monthYearKey,
    dbCustomPeriodFrom,
    dbCustomPeriodTo,
  ]);

  // Default Weightages
  const defaultWeightages = useMemo(() => {
    const finalWeightages: Record<string, number> = {};
    const otherDeptKpisCount = performsOtherDeptTasks
      ? kpiOtherDeptIndicators.length
      : 0;

    if (performsDataEntry) {
      const defaults: Record<string, number> = {
        Quote: 20,
        Review: 10,
        "Individual Review": 10,
        Requote: 20,
        Bike: 5,
        Van: 5,
        Sale: 20,
        mistakes: 0,
        monthly_reports: 5,
        self_development: 5,
      };

      const deptKpisCount = kpiDeptIndicators.length;
      const deptWeightageTotal = deptKpisCount > 0 ? 10 : 0; // Allocate 10% total for custom dept KPIs if present
      const otherDeptWeightageTotal = otherDeptKpisCount > 0 ? 10 : 0; // Allocate 10% total for secondary dept KPIs if present

      const otherSum = 5 + 5 + deptWeightageTotal + otherDeptWeightageTotal; // monthly_reports (5) + self_development (5) + dept KPIs (10) + other dept KPIs (10)
      const coreTargetSum = 100 - otherSum;

      const activeKeys = activeFileTypes.map((t) => t.key);
      const activeCoreWeightageSum = activeKeys.reduce(
        (acc, k) => acc + (defaults[k] || 0),
        0,
      );

      if (activeCoreWeightageSum > 0) {
        activeFileTypes.forEach((t) => {
          finalWeightages[t.key] = Math.round(
            ((defaults[t.key] || 0) / activeCoreWeightageSum) * coreTargetSum,
          );
        });
      } else if (activeFileTypes.length > 0) {
        const share = Math.floor(coreTargetSum / activeFileTypes.length);
        activeFileTypes.forEach((t) => {
          finalWeightages[t.key] = share;
        });
      }

      finalWeightages["mistakes"] = 0;
      finalWeightages["monthly_reports"] = 5;
      finalWeightages["self_development"] = 5;

      if (deptKpisCount > 0) {
        const deptShare = Math.floor(deptWeightageTotal / deptKpisCount);
        kpiDeptIndicators.forEach((indicator: string, idx: number) => {
          if (idx === deptKpisCount - 1) {
            finalWeightages[`dept_${indicator}`] =
              deptWeightageTotal - deptShare * (deptKpisCount - 1);
          } else {
            finalWeightages[`dept_${indicator}`] = deptShare;
          }
        });
      }

      if (otherDeptKpisCount > 0) {
        const otherDeptShare = Math.floor(
          otherDeptWeightageTotal / otherDeptKpisCount,
        );
        kpiOtherDeptIndicators.forEach((indicator: string, idx: number) => {
          if (idx === otherDeptKpisCount - 1) {
            finalWeightages[`other_dept_${indicator}`] =
              otherDeptWeightageTotal -
              otherDeptShare * (otherDeptKpisCount - 1);
          } else {
            finalWeightages[`other_dept_${indicator}`] = otherDeptShare;
          }
        });
      }
    } else {
      // If performsDataEntry is false, we only evaluate custom indicators and self development (10% self_development)
      finalWeightages["self_development"] = 10;
      const deptKpisCount = kpiDeptIndicators.length;
      const totalCustomCount = deptKpisCount + otherDeptKpisCount;

      if (totalCustomCount > 0) {
        const share = Math.floor(90 / totalCustomCount);
        // Distribute to main indicators
        kpiDeptIndicators.forEach((indicator: string) => {
          finalWeightages[`dept_${indicator}`] = share;
        });
        // Distribute to secondary indicators
        kpiOtherDeptIndicators.forEach((indicator: string) => {
          finalWeightages[`other_dept_${indicator}`] = share;
        });
        // Adjust last indicator to make total exactly 90
        const totalAllocated = share * totalCustomCount;
        const remainder = 90 - totalAllocated;
        if (remainder > 0) {
          if (otherDeptKpisCount > 0) {
            finalWeightages[
              `other_dept_${kpiOtherDeptIndicators[otherDeptKpisCount - 1]}`
            ] += remainder;
          } else {
            finalWeightages[`dept_${kpiDeptIndicators[deptKpisCount - 1]}`] +=
              remainder;
          }
        }
      } else {
        finalWeightages["self_development"] = 100;
      }
    }

    return finalWeightages;
  }, [
    activeFileTypes,
    allowedTypesStr,
    performsDataEntry,
    globalSettingsStr,
    performsOtherDeptTasks,
    kpiDeptIndicators,
    kpiOtherDeptIndicators,
  ]);

  // Core Section Max for Self-Scores scaling
  const coreSelfMax = useMemo(() => {
    const reportSelf = selfScores["monthly_reports"] ?? 0;
    const devSelf = selfScores["self_development"] ?? 0;
    const deptSelfSum = kpiDeptIndicators.reduce(
      (acc: number, ind: string) => acc + (selfScores[`dept_${ind}`] || 0),
      0,
    );
    const otherDeptSelfSum = performsOtherDeptTasks
      ? kpiOtherDeptIndicators.reduce(
          (acc: number, ind: string) =>
            acc + (selfScores[`other_dept_${ind}`] || 0),
          0,
        )
      : 0;
    return 100 - reportSelf - devSelf - deptSelfSum - otherDeptSelfSum;
  }, [
    selfScores,
    kpiDeptIndicators,
    kpiOtherDeptIndicators,
    performsOtherDeptTasks,
  ]);

  // Compute Auto Self-Scores for Serial 1 File Types
  const computedSelfScores = useMemo(() => {
    const scores: Record<string, number> = {};

    if (totalSubmissions === 0) {
      activeFileTypes.forEach((t) => {
        scores[t.key] = 0;
      });
      return scores;
    }

    activeFileTypes.forEach((t) => {
      const count = typeCounts[t.key] || 0;
      scores[t.key] = Math.round((count / totalSubmissions) * coreSelfMax);
    });

    return scores;
  }, [activeFileTypes, typeCounts, totalSubmissions, coreSelfMax]);

  // Total sums
  const totals = useMemo(() => {
    let weightSum = 0;
    let selfSum = 0;
    let supervisorSum = 0;

    if (performsDataEntry) {
      // Serial 1 File Types
      activeFileTypes.forEach((t) => {
        weightSum += weightages[t.key] ?? defaultWeightages[t.key] ?? 0;
        selfSum += computedSelfScores[t.key] || 0;
        supervisorSum += supervisorScores[t.key] || 0;
      });

      // Mistakes row
      weightSum += weightages["mistakes"] ?? 0;
      selfSum += selfScores["mistakes"] ?? 0;
      supervisorSum += supervisorScores["mistakes"] ?? 0;

      // Monthly reports
      weightSum +=
        weightages["monthly_reports"] ??
        defaultWeightages["monthly_reports"] ??
        0;
      selfSum += selfScores["monthly_reports"] ?? 0;
      supervisorSum += supervisorScores["monthly_reports"] ?? 0;
    }

    // Department Specific tasks
    kpiDeptIndicators.forEach((ind: string) => {
      const key = `dept_${ind}`;
      weightSum += weightages[key] ?? defaultWeightages[key] ?? 0;
      selfSum += selfScores[key] ?? 0;
      supervisorSum += supervisorScores[key] ?? 0;
    });

    // Other Department Specific tasks
    if (performsOtherDeptTasks) {
      kpiOtherDeptIndicators.forEach((ind: string) => {
        const key = `other_dept_${ind}`;
        weightSum += weightages[key] ?? defaultWeightages[key] ?? 0;
        selfSum += selfScores[key] ?? 0;
        supervisorSum += supervisorScores[key] ?? 0;
      });
    }

    // Self Development
    weightSum +=
      weightages["self_development"] ??
      defaultWeightages["self_development"] ??
      0;
    selfSum += selfScores["self_development"] ?? 0;
    supervisorSum += supervisorScores["self_development"] ?? 0;

    return {
      weightage: weightSum,
      self: selfSum,
      supervisor: supervisorSum,
    };
  }, [
    performsDataEntry,
    activeFileTypes,
    kpiDeptIndicators,
    kpiOtherDeptIndicators,
    performsOtherDeptTasks,
    weightages,
    defaultWeightages,
    computedSelfScores,
    selfScores,
    supervisorScores,
  ]);

  // Fetch from Database
  const lastLoadedRef = React.useRef({ id: "", monthYear: "" });

  useEffect(() => {
    let active = true;
    const fetchAssessment = async () => {
      const isNewFetch =
        lastLoadedRef.current.id !== targetStaff.id ||
        lastLoadedRef.current.monthYear !== monthYearKey;
      if (isNewFetch) {
        setLoading(true);
        lastLoadedRef.current = { id: targetStaff.id, monthYear: monthYearKey };
      }
      try {
        const { data, error } = await supabase
          .from("kpi_assessments")
          .select(KPI_ASSESSMENT_COLUMNS)
          .eq("user_id", targetStaff.id)
          .eq("month_year", monthYearKey)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          if (active) {
            setEmpId(data.emp_id || "");
            setDateOfJoining(data.date_of_joining || "");
            setDepartment(data.department || "Data Entry");
            setAppraiserName(data.appraiser_name || "");
            setReviewerName(data.reviewer_name || "");

            // Unpack KPI values maps
            const savedKpi = data.kpis || {};
            setWeightages(savedKpi.weightages || {});
            setSelfScores(savedKpi.selfScores || {});
            setSupervisorScores(savedKpi.supervisorScores || {});
            setComments(savedKpi.comments || {});

            // Set custom period dates
            setDbCustomPeriodFrom(savedKpi.customPeriodFrom || "");
            setDbCustomPeriodTo(savedKpi.customPeriodTo || "");
            setDbCustomPeriodLabel(savedKpi.customPeriodLabel || "");

            setAppraiseeSigned(!!data.appraisee_signed);
            setAppraiseeSignDate(data.appraisee_sign_date || "");
            setAppraiserSigned(!!data.appraiser_signed);
            setAppraiserSignDate(data.appraiser_sign_date || "");
            setDbState("synced");
          }
        } else {
          // Initialize default state
          if (active) {
            setEmpId(targetStaff.global_settings?.emp_id || "");
            setDateOfJoining(
              targetStaff.global_settings?.date_of_joining || "",
            );
            setDepartment(
              targetStaff.global_settings?.department || "Data Entry",
            );
            setReviewerName("");
            setWeightages(defaultWeightages);
            setSelfScores({
              mistakes: 0,
              monthly_reports: 0,
              self_development: 0,
            });
            setSupervisorScores({});
            setComments({});
            setAppraiseeSigned(false);
            setAppraiseeSignDate("");
            setAppraiserSigned(false);
            setAppraiserSignDate("");

            const isCustom = !/^\d{4}-\d{2}$/.test(monthYearKey);
            if (!isCustom) {
              setDbCustomPeriodFrom("");
              setDbCustomPeriodTo("");
              setDbCustomPeriodLabel("");
            }
            setDbState("synced");
          }
        }
      } catch (err: any) {
        console.warn(
          "Supabase KPI table fetch error, falling back to localStorage:",
          err,
        );
        // Fallback to localStorage sandbox mock
        if (active) {
          setDbState("local");
          const localKey = `kpi_${targetStaff.id}_${monthYearKey}`;
          const localDataStr = localStorage.getItem(localKey);
          if (localDataStr) {
            try {
              const localData = JSON.parse(localDataStr);
              setEmpId(localData.emp_id || "");
              setDateOfJoining(localData.date_of_joining || "");
              setDepartment(localData.department || "Data Entry");
              setAppraiserName(localData.appraiser_name || "");
              setReviewerName(localData.reviewer_name || "");
              setWeightages(localData.kpis?.weightages || {});
              setSelfScores(localData.kpis?.selfScores || {});
              setSupervisorScores(localData.kpis?.supervisorScores || {});
              setComments(localData.kpis?.comments || {});

              setDbCustomPeriodFrom(localData.kpis?.customPeriodFrom || "");
              setDbCustomPeriodTo(localData.kpis?.customPeriodTo || "");
              setDbCustomPeriodLabel(localData.kpis?.customPeriodLabel || "");

              setAppraiseeSigned(!!localData.appraisee_signed);
              setAppraiseeSignDate(localData.appraisee_sign_date || "");
              setAppraiserSigned(!!localData.appraiser_signed);
              setAppraiserSignDate(localData.appraiser_sign_date || "");
            } catch {
              // ignore JSON error
            }
          } else {
            setEmpId("");
            setDateOfJoining("");
            setDepartment(
              targetStaff.global_settings?.department || "Data Entry",
            );
            setReviewerName("");
            setWeightages(defaultWeightages);
            setSelfScores({
              mistakes: 0,
              monthly_reports: 0,
              self_development: 0,
            });
            setSupervisorScores({});
            setComments({});
            setAppraiseeSigned(false);
            setAppraiseeSignDate("");
            setAppraiserSigned(false);
            setAppraiserSignDate("");

            setDbCustomPeriodFrom("");
            setDbCustomPeriodTo("");
            setDbCustomPeriodLabel("");
          }
        }
      } finally {
        if (active) {
          setLoading(false);
          setIsDirty(false);
        }
      }
    };

    fetchAssessment();
    return () => {
      active = false;
    };
  }, [targetStaff.id, monthYearKey]);

  // Automatically load assigned appraisees on month or currentUser changes
  useEffect(() => {
    let active = true;
    const loadAppraisees = async () => {
      if (!currentUser) return;
      setSearchingAppraisee(true);
      try {
        const { data: assessments, error } = await supabase
          .from("kpi_assessments")
          .select("user_id")
          .eq("month_year", monthYearKey)
          .or(
            `appraiser_name.ilike.%${currentUser.full_name || "NOTHING_HERE"}%,appraiser_name.ilike.%${currentUser.username || "NOTHING_HERE"}%`,
          );

        if (error) throw error;

        if (assessments && assessments.length > 0 && active) {
          const userIds = Array.from(
            new Set(assessments.map((a: any) => a.user_id)),
          );
          const { data: profilesData } = await supabase
            .from("profiles")
            .select(
              "id, username, full_name, role, allowed_types, global_settings",
            )
            .in("id", userIds);

          if (profilesData && active) {
            setAssignedAppraisees(profilesData);
            setHasAssignedAppraisees(profilesData.length > 0);
            return;
          }
        }
        if (active) {
          setAssignedAppraisees([]);
          setHasAssignedAppraisees(false);
        }
      } catch (err) {
        console.error("Failed to load appraisees:", err);
      } finally {
        if (active) {
          setSearchingAppraisee(false);
        }
      }
    };
    loadAppraisees();
    return () => {
      active = false;
    };
  }, [currentUser, monthYearKey]);

  const handleLoadAppraiseeByCodename = async (codename: string) => {
    const clean = codename.trim().toUpperCase();
    if (!clean) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("username", clean)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const hasAccess = canAccessModule(currentUser, data, "kpi");
        if (!hasAccess) {
          toast.error("You do not have permission to view this KPI sheet.");
          return;
        }

        setEvaluatorModeProfile(data);
        setShowViewKpiModal(false);
        toast.success(
          `Loaded KPI sheet for ${data.full_name || data.username} in Evaluator Mode.`,
        );
      } else {
        toast.error(`No user found with codename "${clean}"`);
      }
    } catch (err) {
      toast.error(
        "Failed to look up codename: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  // Save to Database / LocalStorage fallback
  const handleSave = async () => {
    if (totals.weightage !== 100) {
      toast.error(
        `Weightage mismatch! Total weightage must sum up to exactly 100%. Current sum: ${totals.weightage}%`,
      );
      return;
    }

    setSaving(true);
    const activeKeyIsCustom = !/^\d{4}-\d{2}$/.test(monthYearKey);
    const kpisPayload = {
      weightages,
      selfScores,
      supervisorScores,
      comments,
      customPeriodFrom: activeKeyIsCustom ? dbCustomPeriodFrom : null,
      customPeriodTo: activeKeyIsCustom ? dbCustomPeriodTo : null,
      customPeriodLabel: activeKeyIsCustom ? dbCustomPeriodLabel : null,
    };

    const updateObj = {
      user_id: targetStaff.id,
      month_year: monthYearKey,
      emp_id: empId,
      date_of_joining: dateOfJoining,
      department: department,
      appraiser_name: appraiserName,
      reviewer_name: reviewerName,
      kpis: kpisPayload,
      appraisee_signed: appraiseeSigned,
      appraisee_sign_date: appraiseeSignDate,
      appraiser_signed: appraiserSigned,
      appraiser_sign_date: appraiserSignDate,
      updated_at: new Date().toISOString(),
    };

    if (dbState === "synced") {
      try {
        const { error } = await supabase
          .from("kpi_assessments")
          .upsert(updateObj, { onConflict: "user_id,month_year" });

        if (error) throw error;

        // Also save emp_id and dateOfJoining to user's global settings in profile for future default use
        const existingGlobal = targetStaff.global_settings || {};
        if (
          existingGlobal.emp_id !== empId ||
          existingGlobal.date_of_joining !== dateOfJoining
        ) {
          await supabase
            .from("profiles")
            .update({
              global_settings: {
                ...existingGlobal,
                emp_id: empId,
                date_of_joining: dateOfJoining,
              },
            })
            .eq("id", targetStaff.id);
        }

        toast.success("Performance Assessment saved successfully!");
        setIsDirty(false);
      } catch (err: any) {
        console.error("Save to Database failed, saving to local storage:", err);
        toast.error("Cloud Sync failed. Saved locally inside localStorage.");
        setDbState("local");
        saveLocally();
      } finally {
        setSaving(false);
      }
    } else {
      saveLocally();
      setSaving(false);
    }
  };

  const saveLocally = () => {
    const localKey = `kpi_${targetStaff.id}_${monthYearKey}`;
    const activeKeyIsCustom = !/^\d{4}-\d{2}$/.test(monthYearKey);
    const payload = {
      emp_id: empId,
      date_of_joining: dateOfJoining,
      department: department,
      appraiser_name: appraiserName,
      reviewer_name: reviewerName,
      kpis: {
        weightages,
        selfScores,
        supervisorScores,
        comments,
        customPeriodFrom: activeKeyIsCustom ? dbCustomPeriodFrom : null,
        customPeriodTo: activeKeyIsCustom ? dbCustomPeriodTo : null,
        customPeriodLabel: activeKeyIsCustom ? dbCustomPeriodLabel : null,
      },
      appraisee_signed: appraiseeSigned,
      appraisee_sign_date: appraiseeSignDate,
      appraiser_signed: appraiserSigned,
      appraiser_sign_date: appraiserSignDate,
    };
    localStorage.setItem(localKey, JSON.stringify(payload));
    toast.success("Performance Assessment saved locally!");
    setIsDirty(false);
  };

  // Sign Checkbox Trigger Appraisee
  const handleAppraiseeSignChange = (checked: boolean) => {
    if (!canEditAppraiseeFields) return;
    setAppraiseeSigned(checked);
    if (checked) {
      const todayStr = new Date()
        .toLocaleDateString("en-GB")
        .replace(/\//g, "-");
      setAppraiseeSignDate(todayStr);
    } else {
      setAppraiseeSignDate("");
    }
    setIsDirty(true);
  };

  // Sign Checkbox Trigger Appraiser
  const handleAppraiserSignChange = (checked: boolean) => {
    if (!isSupervisorOrAdmin) return;
    setAppraiserSigned(checked);
    if (checked) {
      const todayStr = new Date()
        .toLocaleDateString("en-GB")
        .replace(/\//g, "-");
      setAppraiserSignDate(todayStr);
    } else {
      setAppraiserSignDate("");
    }
    setIsDirty(true);
  };

  // Printer view trigger
  const handlePrint = () => {
    window.print();
  };

  // Excel export trigger
  const handleExportExcel = async () => {
    const headers = [
      "Serial No",
      "Key Result Area",
      "Key Performance Indicator",
      "Measurable Criteria",
      "Target",
      "Weightage",
      "Self Score",
      "Supervisor Score",
      "Comments",
    ];

    const rows: string[][] = [
      [
        `Performance Assessment: ${selectedMonth + 1}-${selectedYear}`,
        `Employee Name: ${targetStaff.full_name || targetStaff.username}`,
        `Employee ID: ${empId}`,
        `Department: ${department}`,
        `Appraiser: ${appraiserName}`,
        `Reviewer: ${reviewerName}`,
        `Date of Joining: ${dateOfJoining}`,
      ],
      [], // blank line
      headers,
    ];

    let currentSrl = 1;

    // Serial 1: Data Entry
    if (performsDataEntry) {
      const dataSrl = currentSrl++;
      activeFileTypes.forEach((type) => {
        rows.push([
          String(dataSrl),
          "Data Entry",
          type.label,
          "Quality, Quantity & Timeliness",
          "100%",
          `${weightages[type.key] ?? defaultWeightages[type.key] ?? 0}%`,
          `${computedSelfScores[type.key] || 0}%`,
          `${supervisorScores[type.key] !== undefined ? supervisorScores[type.key] : 0}%`,
          comments[type.key] || "",
        ]);
      });

      // Mistakes row
      rows.push([
        String(dataSrl),
        "Data Entry",
        "Number of Mistakes",
        "Quality, Quantity & Timeliness",
        "0%",
        `${weightages["mistakes"] ?? 0}%`,
        `${selfScores["mistakes"] ?? 0}%`,
        `${supervisorScores["mistakes"] !== undefined ? supervisorScores["mistakes"] : 0}%`,
        comments["mistakes"] || "",
      ]);
    }

    // Serial 2: Custom Department indicators
    if (kpiDeptIndicators.length > 0) {
      const deptSrl = currentSrl++;
      kpiDeptIndicators.forEach((indicator: string) => {
        const key = `dept_${indicator}`;
        rows.push([
          String(deptSrl),
          department,
          indicator,
          "Quality, Quantity & Timeliness",
          "100%",
          `${weightages[key] ?? defaultWeightages[key] ?? 0}%`,
          `${selfScores[key] ?? 0}%`,
          `${supervisorScores[key] !== undefined ? supervisorScores[key] : 0}%`,
          comments[key] || "",
        ]);
      });
    }

    // Secondary Department indicators
    if (performsOtherDeptTasks && kpiOtherDeptIndicators.length > 0) {
      const otherDeptSrl = currentSrl++;
      kpiOtherDeptIndicators.forEach((indicator: string) => {
        const key = `other_dept_${indicator}`;
        rows.push([
          String(otherDeptSrl),
          otherDepartment,
          indicator,
          "Quality, Quantity & Timeliness",
          "100%",
          `${weightages[key] ?? defaultWeightages[key] ?? 0}%`,
          `${selfScores[key] ?? 0}%`,
          `${supervisorScores[key] !== undefined ? supervisorScores[key] : 0}%`,
          comments[key] || "",
        ]);
      });
    }

    // Serial 3: Monthly Reports
    if (performsDataEntry) {
      const reportSrl = currentSrl++;
      rows.push([
        String(reportSrl),
        "Monthly Data Entry Report",
        "Monthly Reports",
        "Quality, Quantity & Timeliness",
        "100%",
        `${weightages["monthly_reports"] ?? defaultWeightages["monthly_reports"] ?? 5}%`,
        `${selfScores["monthly_reports"] ?? 0}%`,
        `${supervisorScores["monthly_reports"] !== undefined ? supervisorScores["monthly_reports"] : 0}%`,
        comments["monthly_reports"] || "",
      ]);
    }

    // Serial 4: Self Development
    const selfDevSrl = currentSrl++;
    rows.push([
      String(selfDevSrl),
      "Self Development Initiative",
      kpiSkillsJoined,
      "Quality, Quantity & Timeliness",
      "100%",
      `${weightages["self_development"] ?? defaultWeightages["self_development"] ?? 5}%`,
      `${selfScores["self_development"] ?? 0}%`,
      `${supervisorScores["self_development"] !== undefined ? supervisorScores["self_development"] : 0}%`,
      comments["self_development"] || "",
    ]);

    // Total Row
    rows.push([]);
    rows.push([
      "Total",
      "",
      "",
      "",
      "",
      `${totals.weightage.toFixed(1)}%`,
      `${totals.self.toFixed(1)}%`,
      `${totals.supervisor.toFixed(1)}%`,
      "",
    ]);

    // Signatures
    rows.push([]);
    rows.push([
      `Appraisee Signed: ${appraiseeSigned ? "YES" : "NO"}`,
      `Appraisee Sign Date: ${appraiseeSignDate || "N/A"}`,
      "",
      `Appraiser Signed: ${appraiserSigned ? "YES" : "NO"}`,
      `Appraiser Sign Date: ${appraiserSignDate || "N/A"}`,
    ]);

    // Convert to Excel HTML table format
    const htmlRows = rows
      .map(
        (r) =>
          `<tr>${r.map((val) => `<td style="border: 1px solid #ddd; padding: 6px;">${val}</td>`).join("")}</tr>`,
      )
      .join("\n");

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>KPI Assessment</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body style="font-family: sans-serif;">
        <table style="border-collapse: collapse;">${htmlRows}</table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const fileName = `KPI_Assessment_${targetStaff.username || "user"}_${monthYearKey}.xls`;

    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");

        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Clean = base64String.split(",")[1];
            resolve(base64Clean);
          };
          reader.readAsDataURL(blob);
        });

        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: "Save Excel Document",
          text: `Save or share ${fileName}`,
          url: writeResult.uri,
          dialogTitle: "Save Excel Document",
        });
        toast.success("KPI sheet exported successfully!");
      } catch (err) {
        console.error("Failed to share Excel on mobile:", err);
        toast.error("Failed to export Excel document.");
      }
    } else if (isTauriApp()) {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");

        const selectedPath = await save({
          defaultPath: fileName,
          filters: [{ name: "Excel Spreadsheet", extensions: ["xls"] }],
        });

        if (selectedPath) {
          await writeFile(selectedPath, bytes);
          toast.success("KPI sheet saved successfully!");
        }
      } catch (err) {
        console.error("Failed to save Excel in Tauri:", err);
        toast.error("Failed to save file.");
      }
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("KPI sheet exported to Excel format!");
    }

    if (currentUser?.id) {
      try {
        await supabase.from('audit_logs').insert({
          actor_id: currentUser.id,
          actor_codename: currentUser.username || 'SYSTEM',
          action_type: 'EXPORT_EXCEL',
          target_id: targetStaff.id,
          details: `Exported KPI performance sheet for '${targetStaff.username}' (${fileName})`,
        });
      } catch (err) {
        console.error('Failed to log KPI export:', err);
      }
    }
  };

  // Weightage adjustment triggers
  const handleWeightageChange = (key: string, value: number) => {
    setWeightages((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  };

  // Self scores change (only for Serials 2 & 3 & mistakes)
  const handleSelfScoreChange = (key: string, value: number) => {
    setSelfScores((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  };

  // Supervisor scores change
  const handleSupervisorScoreChange = (key: string, value: number) => {
    setSupervisorScores((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  };

  // Comments change
  const handleCommentChange = (key: string, value: string) => {
    setComments((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  };

  // Joined KPI Skills string
  const skills = targetStaff.global_settings?.kpi_skills || [];
  const kpiSkillsJoined = skills.length > 0 ? skills.join(", ") : "";

  if (loading) {
    return <KpiSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-full font-sans print:bg-white print:text-black print:p-0 print:border-0 print:space-y-4">
      <style>{`
        /* Hide spin buttons for Chrome, Safari, Edge, Opera */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        /* Hide spin buttons for Firefox */
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      {/* 1. Header controls (Not printed) */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 bg-theme-card-bg/35 border border-theme-border-muted p-4 rounded-2xl shadow-lg print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 bg-theme-border-muted hover:bg-theme-border-active border border-theme-border-active text-theme-text-secondary hover:text-theme-text-primary rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              ←
            </button>
          )}
          <div className="flex items-center gap-3 w-full">
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-theme-text-primary">
                KPI Goal Sheet & Monthly Performance Assessment
              </h4>
              <p className="text-[11px] text-theme-text-muted">
                Evaluate, submit self-scores, and save/lock monthly assessments.
              </p>
            </div>
          </div>
        </div>

        {/* Date Month Selector */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {hasAssignedAppraisees && (
            <button
              type="button"
              onClick={() => {
                setShowViewKpiModal(true);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (evaluatorModeProfile) {
                  setEvaluatorModeProfile(null);
                  toast.success("Reset view to your own KPI sheet.");
                }
              }}
              className="px-3 py-2 bg-transparent hover:bg-theme-card-bg border border-theme-border-input text-theme-text-muted hover:text-theme-text-primary rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors group"
              title="Evaluate assigned employee sheets (Right click to reset)"
            >
              <Target className="h-3.5 w-3.5 text-theme-text-muted group-hover:text-theme-text-primary" />
              <span>View KPI</span>
            </button>
          )}

          <div className="flex bg-theme-card-container/80 border border-theme-border-input rounded-xl p-1 shrink-0 items-center gap-1">
            <select
              value={
                activePeriodKey ||
                `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`
              }
              onChange={(e) => {
                const val = e.target.value;
                const isStandardPattern = /^\d{4}-\d{2}$/.test(val);
                if (isStandardPattern) {
                  const parts = val.split("-");
                  setSelectedYear(Number(parts[0]));
                  setSelectedMonth(Number(parts[1]) - 1);
                  setActivePeriodKey("");
                } else {
                  setActivePeriodKey(val);
                }
              }}
              className="bg-transparent text-xs font-semibold text-theme-text-secondary px-2 py-1.5 focus:outline-hidden cursor-pointer max-w-[160px] truncate"
            >
              {periodOptions.map((opt) => (
                <option
                  key={opt.key}
                  value={opt.key}
                  className="bg-theme-page-bg text-theme-text-secondary"
                >
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Create Custom Period Button */}
            {(isAdminRole(currentUser) ||
              currentUser?.role === "supervisor") && (
              <button
                type="button"
                onClick={() => {
                  setNewCustomPeriodLabel("");
                  setNewCustomPeriodFrom("");
                  setNewCustomPeriodTo("");
                  setCustomPeriodModalOpen(true);
                }}
                className="p-1 hover:bg-theme-border-input rounded-lg text-theme-text-muted hover:text-theme-text-primary transition-colors cursor-pointer"
                title="Create Custom Period"
              >
                <Calendar className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2 bg-theme-border-muted hover:bg-theme-border-active border border-theme-border-active text-theme-text-secondary rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Print assessment sheet / Save as PDF"
          >
            <Printer className="h-4 w-4" /> PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="p-2 bg-emerald-950/20 hover:bg-emerald-900/20 border border-emerald-900/40 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors print:hidden"
            title="Export assessment sheet to Excel"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-950/20 border border-blue-700/30 transition-all disabled:opacity-50"
            title="Save assessment sheet"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
        </div>
      </div>

      {evaluatorModeProfile && (
        <div className="bg-blue-950/30 border border-blue-900/60 p-4 rounded-2xl text-xs text-blue-300 font-semibold flex justify-between items-center font-sans print:hidden animate-fade-in">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
            <span>
              Currently evaluating Appraisee:{" "}
              <strong className="text-theme-text-primary font-black">
                {evaluatorModeProfile.full_name} (
                {evaluatorModeProfile.username})
              </strong>
            </span>
          </span>
          <button
            type="button"
            onClick={() => setEvaluatorModeProfile(null)}
            className="px-3 py-1 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Exit Evaluator Mode
          </button>
        </div>
      )}

      {/* Database state notification warning (Not printed) */}
      {dbState === "local" && (
        <div className="bg-amber-950/15 border border-amber-900/40 p-4 rounded-2xl text-xs text-amber-300 font-sans print:hidden space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">
                Supabase Cloud Sync Offline (SQL Table Missing)
              </p>
              <p className="text-[11px] text-amber-400/90 mt-0.5">
                The spreadsheet has successfully fallen back to localStorage. To
                enable central cloud syncing across all accounts, please ask
                your Supabase Administrator to run the following SQL script
                inside the Supabase SQL editor:
              </p>
            </div>
          </div>
          <pre className="bg-theme-card-container/90 border border-theme-border-muted rounded-xl p-3 text-[10px] text-theme-text-muted font-mono overflow-x-auto select-all max-h-48 whitespace-pre">
            {`CREATE TABLE IF NOT EXISTS public.kpi_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  emp_id TEXT,
  date_of_joining TEXT,
  department TEXT DEFAULT 'Data Entry',
  appraiser_name TEXT,
  reviewer_name TEXT,
  kpis JSONB NOT NULL DEFAULT '[]'::jsonb,
  appraisee_signed BOOLEAN DEFAULT false,
  appraisee_sign_date TEXT,
  appraiser_signed BOOLEAN DEFAULT false,
  appraiser_sign_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, month_year)
);

ALTER TABLE public.kpi_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for all authenticated users"
ON public.kpi_assessments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert/update/delete for admin, supervisor, or self"
ON public.kpi_assessments FOR ALL TO authenticated
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor')
));`}
          </pre>
        </div>
      )}

      {/* Weightage Warning (Not printed) */}
      {totals.weightage !== 100 && (
        <div className="bg-red-950/20 border border-red-900/40 p-3.5 rounded-xl text-xs text-red-300 font-semibold flex flex-col sm:flex-row items-start sm:items-center gap-2.5 font-sans print:hidden animate-pulse">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span>
            Total Weightage must equal exactly 100%. Currently it is set to{" "}
            <strong className="underline text-theme-text-primary font-bold">
              {totals.weightage}%
            </strong>
            . Please adjust weightages below.
          </span>
        </div>
      )}

      {/* 2. MAIN SHEET CONTAINER */}
      <div className="bg-theme-card-container border border-theme-border-muted p-4 sm:p-6.5 rounded-2xl shadow-xl space-y-6 font-sans print:bg-white print:border-0 print:shadow-none print:p-0 print:text-black">
        {/* Banner Title */}
        <div className="text-center border-b border-theme-border-input pb-4 print:border-black">
          <h2 className="text-lg font-bold text-theme-text-primary tracking-wide uppercase print:text-black print:text-base">
            Performance Assessment : {selectedYear}
          </h2>
        </div>

        {/* 3. Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5 text-xs text-theme-text-secondary print:text-black print:grid-cols-2">
          {/* Appraisee Name */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-theme-card-bg pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-theme-text-muted shrink-0 print:text-black mb-1 sm:mb-0">
              Appraisee Name
            </span>
            <span className="font-medium text-theme-text-primary print:text-black">
              {targetStaff.full_name || targetStaff.username}
            </span>
          </div>

          {/* Department */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-theme-card-bg pb-2 print:border-neutral-200 group">
            <span className="w-32 font-semibold text-theme-text-muted shrink-0 print:text-black mb-1 sm:mb-0">
              Department
            </span>
            <span className="font-medium text-theme-text-primary print:text-black">
              {department}
            </span>
          </div>

          {/* Emp ID */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-theme-card-bg pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-theme-text-muted shrink-0 print:text-black mb-1 sm:mb-0">
              Emp ID
            </span>
            {canEditAppraiseeFields ? (
              <input
                type="text"
                placeholder="2008"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className="bg-theme-card-bg/60 border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-blue-500 w-full sm:w-36 transition-colors print:bg-transparent print:border-0 print:p-0 print:text-black"
              />
            ) : (
              <span className="font-medium text-theme-text-primary print:text-black">
                {empId || "—"}
              </span>
            )}
          </div>

          {/* Appraiser's Name */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-theme-card-bg pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-theme-text-muted shrink-0 print:text-black mb-1 sm:mb-0">
              Appraiser's Name
            </span>
            {(!hasSupervisors && isAdminRole(currentUser)) ||
            (currentUser?.role === "supervisor" &&
              targetStaff.id === currentUser.id) ? (
              <div className="relative w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Type to search Appraiser..."
                  value={appraiserName}
                  onChange={(e) => {
                    setAppraiserName(e.target.value);
                    setIsDirty(true);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 200)
                  }
                  className="bg-theme-card-bg border border-theme-border-input rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-hidden focus:border-blue-500 w-full sm:w-52 transition-colors print:hidden"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-theme-card-container border border-theme-border-input rounded-lg shadow-2xl z-50 divide-y divide-theme-border-input custom-scrollbar">
                    <style>{`
                      .custom-scrollbar::-webkit-scrollbar {
                        width: 5px;
                      }
                      .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                      }
                      .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.12);
                        border-radius: 9999px;
                      }
                      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(255, 255, 255, 0.25);
                      }
                    `}</style>
                    {filteredSuggestions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setAppraiserName(user.full_name || user.username);
                          setShowSuggestions(false);
                          setIsDirty(true);
                        }}
                        className="w-full text-left px-3 py-2 text-[11px] hover:bg-blue-600/15 text-theme-text-secondary hover:text-white transition-colors cursor-pointer flex justify-between items-center"
                      >
                        <span className="font-semibold">
                          {user.full_name || user.username}
                        </span>
                        <span className="text-[10px] text-theme-text-muted font-mono">
                          @{user.username}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Print mode text representation */}
                <span className="hidden print:inline font-medium text-black">
                  {appraiserName || "—"}
                </span>
              </div>
            ) : (
              <span className="font-medium text-theme-text-primary print:text-black">
                {appraiserName || "—"}
              </span>
            )}
          </div>

          {/* Designation */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-theme-card-bg pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-theme-text-muted shrink-0 print:text-black mb-1 sm:mb-0">
              Designation
            </span>
            <span className="font-medium text-theme-text-primary print:text-black">
              {targetStaff.job_role || "Executive"}
            </span>
          </div>

          {/* Reviewer's Name */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-theme-card-bg pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-theme-text-muted shrink-0 print:text-black mb-1 sm:mb-0">
              Reviewer's Name
            </span>
            {isSupervisorOrAdmin || isAppraisee ? (
              <input
                type="text"
                placeholder="Manager"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="bg-theme-card-bg/60 border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-blue-500 w-full sm:w-52 transition-colors print:bg-transparent print:border-0 print:p-0 print:text-black"
              />
            ) : (
              <span className="font-medium text-theme-text-primary print:text-black">
                {reviewerName || "—"}
              </span>
            )}
          </div>

          {/* Date of Joining */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-theme-card-bg pb-2 print:border-neutral-200">
            <span className="w-32 font-semibold text-theme-text-muted shrink-0 print:text-black mb-1 sm:mb-0">
              Date of Joining
            </span>
            {canEditAppraiseeFields ? (
              <input
                type="text"
                placeholder="13-Jul-20"
                value={dateOfJoining}
                onChange={(e) => setDateOfJoining(e.target.value)}
                className="bg-theme-card-bg/60 border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-blue-500 w-full sm:w-36 transition-colors print:bg-transparent print:border-0 print:p-0 print:text-black"
              />
            ) : (
              <span className="font-medium text-theme-text-primary print:text-black">
                {dateOfJoining || "—"}
              </span>
            )}
          </div>

          {/* Evaluation Period */}
          <div className="flex flex-col sm:flex-row sm:items-center border-b border-theme-card-bg pb-2 print:border-neutral-200 gap-1.5">
            <span className="w-32 font-semibold text-theme-text-muted shrink-0 print:text-black mb-1 sm:mb-0">
              Evaluation Period
            </span>
            <span className="font-medium text-theme-text-primary print:text-black">
              From: {evaluationPeriod.from} To: {evaluationPeriod.to}
            </span>

            {/* Settings/Edit Icon next to dates */}
            {(isAdminRole(currentUser) ||
              currentUser?.role === "supervisor") && (
              <button
                type="button"
                onClick={() => {
                  const isCustom = !/^\d{4}-\d{2}$/.test(monthYearKey);
                  if (isCustom) {
                    setNewCustomPeriodLabel(
                      dbCustomPeriodLabel || monthYearKey,
                    );
                    setNewCustomPeriodFrom(dbCustomPeriodFrom);
                    setNewCustomPeriodTo(dbCustomPeriodTo);
                  } else {
                    setNewCustomPeriodLabel(
                      `${months[selectedMonth]} ${selectedYear}`,
                    );
                    const startStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
                    const lastDay = new Date(
                      selectedYear,
                      selectedMonth + 1,
                      0,
                    ).getDate();
                    const endStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                    setNewCustomPeriodFrom(startStr);
                    setNewCustomPeriodTo(endStr);
                  }
                  setCustomPeriodModalOpen(true);
                }}
                className="p-1 hover:bg-theme-border-muted rounded-lg text-theme-text-muted hover:text-theme-text-primary transition-colors cursor-pointer print:hidden ml-1"
                title="Edit Evaluation Period Settings"
              >
                <Calendar className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* GOAL SHEET BANNER */}
        <div className="bg-theme-card-bg/60 text-center py-2 rounded-xl border border-theme-border-muted print:bg-neutral-100 print:text-black print:border-black print:border">
          <span className="text-xs font-bold uppercase tracking-wider text-theme-text-secondary print:text-black">
            GOAL SHEET
          </span>
        </div>

        {/* 4. PERFORMANCE TABLE */}
        <div className="overflow-x-auto rounded-xl border border-theme-border-input shadow-lg print:border-black print:border print:rounded-none">
          <table className="w-full text-left text-xs border-collapse min-w-[900px] print:text-black print:bg-white">
            <thead>
              <tr className="bg-theme-card-bg border-b border-theme-border-input text-[11px] uppercase tracking-wider text-theme-text-muted print:bg-neutral-100 print:text-black print:border-black">
                <th className="py-3 px-3 text-center border-r border-theme-border-input w-16 print:border-black">
                  Srl No.
                </th>
                <th className="py-3 px-4 border-r border-theme-border-input w-36 print:border-black">
                  Key Result Area
                </th>
                <th className="py-3 px-4 border-r border-theme-border-input w-48 print:border-black">
                  Key Performance Indicator
                </th>
                <th className="py-3 px-4 border-r border-theme-border-input w-48 print:border-black">
                  Measurable Criteria
                </th>
                <th className="py-3 px-3 text-center border-r border-theme-border-input w-20 print:border-black">
                  Target
                </th>
                <th className="py-3 px-3 text-center border-r border-theme-border-input w-24 print:border-black">
                  Weightage
                </th>
                <th className="py-3 px-3 text-center border-r border-theme-border-input w-20 print:border-black">
                  Self
                </th>
                <th className="py-3 px-3 text-center border-r border-theme-border-input w-24 print:border-black">
                  Supervisor
                </th>
                <th className="py-3 px-4 print:text-black">Comments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-muted print:divide-black">
              {(() => {
                let currentSrl = 1;
                const dataEntrySrl = performsDataEntry ? currentSrl++ : null;
                const deptKpiSrl =
                  kpiDeptIndicators.length > 0 ? currentSrl++ : null;
                const otherDeptKpiSrl =
                  performsOtherDeptTasks && kpiOtherDeptIndicators.length > 0
                    ? currentSrl++
                    : null;
                const reportSrl = performsDataEntry ? currentSrl++ : null;
                const selfDevSrl = currentSrl++;

                return (
                  <>
                    {/* SERIAL 1: Core Submissions Section (Data Entry) */}
                    {performsDataEntry && (
                      <>
                        {activeFileTypes.map((type, idx) => {
                          const isFirst = idx === 0;
                          const totalRows = activeFileTypes.length + 1; // including Mistakes row

                          return (
                            <tr
                              key={type.key}
                              className="hover:bg-theme-card-container/20 transition-colors"
                            >
                              {/* Rowspans */}
                              {isFirst && (
                                <>
                                  <td
                                    rowSpan={totalRows}
                                    className="py-4 px-3 text-center align-middle font-bold text-theme-text-secondary border-r border-theme-border-input bg-theme-page-bg/50 print:border-black print:bg-transparent print:text-black"
                                  >
                                    {dataEntrySrl}
                                  </td>
                                  <td
                                    rowSpan={totalRows}
                                    className="py-4 px-4 align-middle font-bold text-theme-text-secondary border-r border-theme-border-input bg-theme-page-bg/50 print:border-black print:bg-transparent print:text-black"
                                  >
                                    Data Entry
                                  </td>
                                </>
                              )}

                              {/* KPI Columns */}
                              <td className="py-2.5 px-4 border-r border-theme-border-muted font-medium text-theme-text-primary print:border-black print:text-black">
                                {type.label}
                              </td>
                              <td className="py-2.5 px-4 border-r border-theme-border-muted text-theme-text-muted print:border-black print:text-black">
                                Quality, Quantity & Timeliness
                              </td>
                              <td className="py-2.5 px-3 text-center border-r border-theme-border-muted font-semibold text-theme-text-muted print:border-black print:text-black">
                                100%
                              </td>

                              {/* Weightage */}
                              <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                                {isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={
                                        weightages[type.key] ??
                                        defaultWeightages[type.key] ??
                                        0
                                      }
                                      onChange={(e) =>
                                        handleWeightageChange(
                                          type.key,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                                    />
                                    <span className="text-[10px] text-theme-text-muted font-semibold">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-theme-text-secondary print:text-black">
                                    {weightages[type.key] ??
                                      defaultWeightages[type.key] ??
                                      0}
                                    %
                                  </span>
                                )}
                              </td>

                              {/* Self Score */}
                              <td className="py-2.5 px-3 text-center border-r border-theme-border-muted font-bold text-blue-400 bg-blue-955/5 print:border-black print:bg-transparent print:text-black">
                                {computedSelfScores[type.key] || 0}%
                              </td>

                              {/* Supervisor score */}
                              <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                                {isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={supervisorScores[type.key] ?? 0}
                                      onChange={(e) =>
                                        handleSupervisorScoreChange(
                                          type.key,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-emerald-500"
                                    />
                                    <span className="text-[10px] text-theme-text-muted font-semibold">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-theme-text-secondary print:text-black">
                                    {supervisorScores[type.key] !== undefined
                                      ? `${supervisorScores[type.key]}%`
                                      : "—"}
                                  </span>
                                )}
                              </td>

                              {/* Comments */}
                              <td className="py-2 px-3">
                                {isSupervisorOrAdmin ? (
                                  <input
                                    type="text"
                                    placeholder="Add feedback"
                                    value={comments[type.key] || ""}
                                    onChange={(e) =>
                                      handleCommentChange(
                                        type.key,
                                        e.target.value,
                                      )
                                    }
                                    className="w-full bg-theme-card-bg border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-theme-border-active"
                                  />
                                ) : (
                                  <span className="text-theme-text-muted italic text-[11px] print:text-black">
                                    {comments[type.key] || "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Number of Mistakes Row (Final Row of Serial 1 block) */}
                        <tr className="hover:bg-theme-card-container/20 transition-colors">
                          {activeFileTypes.length === 0 && (
                            <>
                              <td className="py-4 px-3 text-center align-middle font-bold text-theme-text-secondary border-r border-theme-border-input bg-theme-page-bg/50 print:border-black print:bg-transparent print:text-black">
                                {dataEntrySrl}
                              </td>
                              <td className="py-4 px-4 align-middle font-bold text-theme-text-secondary border-r border-theme-border-input bg-theme-page-bg/50 print:border-black print:bg-transparent print:text-black">
                                {department}
                              </td>
                            </>
                          )}
                          <td className="py-2.5 px-4 border-r border-theme-border-muted font-bold text-red-400 print:border-black">
                            Number of Mistakes
                          </td>
                          <td className="py-2.5 px-4 border-r border-theme-border-muted text-theme-text-muted print:border-black">
                            Quality, Quantity & Timeliness
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-theme-border-muted font-semibold text-theme-text-muted print:border-black">
                            0%
                          </td>

                          {/* Weightage */}
                          <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                            {isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={weightages["mistakes"] ?? 0}
                                  onChange={(e) =>
                                    handleWeightageChange(
                                      "mistakes",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                                />
                                <span className="text-[10px] text-theme-text-muted font-semibold">
                                  %
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-theme-text-secondary print:text-black">
                                {weightages["mistakes"] ?? 0}%
                              </span>
                            )}
                          </td>

                          {/* Self */}
                          <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                            {isAppraisee || isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={selfScores["mistakes"] ?? 0}
                                  onChange={(e) =>
                                    handleSelfScoreChange(
                                      "mistakes",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                                />
                                <span className="text-[10px] text-theme-text-muted font-semibold">
                                  %
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-theme-text-secondary print:text-black">
                                {selfScores["mistakes"] ?? 0}%
                              </span>
                            )}
                          </td>

                          {/* Supervisor */}
                          <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                            {isSupervisorOrAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={supervisorScores["mistakes"] ?? 0}
                                  onChange={(e) =>
                                    handleSupervisorScoreChange(
                                      "mistakes",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-emerald-500"
                                />
                                <span className="text-[10px] text-theme-text-muted font-semibold">
                                  %
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-theme-text-secondary print:text-black">
                                {supervisorScores["mistakes"] !== undefined
                                  ? `${supervisorScores["mistakes"]}%`
                                  : "—"}
                              </span>
                            )}
                          </td>

                          {/* Comments */}
                          <td className="py-2 px-3">
                            {isSupervisorOrAdmin ? (
                              <input
                                type="text"
                                placeholder="Add feedback"
                                value={comments["mistakes"] || ""}
                                onChange={(e) =>
                                  handleCommentChange(
                                    "mistakes",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-theme-card-bg border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-theme-border-active"
                              />
                            ) : (
                              <span className="text-theme-text-muted italic text-[11px] print:text-black">
                                {comments["mistakes"] || "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      </>
                    )}

                    {/* SERIAL 2: Custom Department Specific Indicators */}
                    {deptKpiSrl !== null &&
                      kpiDeptIndicators.map(
                        (indicator: string, idx: number) => {
                          const isFirst = idx === 0;
                          const key = `dept_${indicator}`;
                          const totalRows = kpiDeptIndicators.length;

                          return (
                            <tr
                              key={key}
                              className="hover:bg-theme-card-container/20 transition-colors"
                            >
                              {isFirst && (
                                <>
                                  <td
                                    rowSpan={totalRows}
                                    className="py-4 px-3 text-center align-middle font-bold text-theme-text-secondary border-r border-theme-border-input bg-theme-page-bg/50 print:border-black print:bg-transparent print:text-black"
                                  >
                                    {deptKpiSrl}
                                  </td>
                                  <td
                                    rowSpan={totalRows}
                                    className="py-4 px-4 align-middle font-bold text-theme-text-secondary border-r border-theme-border-input bg-theme-page-bg/50 print:border-black print:bg-transparent print:text-black"
                                  >
                                    {department}
                                  </td>
                                </>
                              )}

                              {/* KPI Columns */}
                              <td className="py-2.5 px-4 border-r border-theme-border-muted font-medium text-theme-text-primary print:border-black print:text-black">
                                {indicator}
                              </td>
                              <td className="py-2.5 px-4 border-r border-theme-border-muted text-theme-text-muted print:border-black print:text-black">
                                Quality, Quantity & Timeliness
                              </td>
                              <td className="py-2.5 px-3 text-center border-r border-theme-border-muted font-semibold text-theme-text-muted print:border-black print:text-black">
                                100%
                              </td>

                              {/* Weightage */}
                              <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                                {isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={
                                        weightages[key] ??
                                        defaultWeightages[key] ??
                                        0
                                      }
                                      onChange={(e) =>
                                        handleWeightageChange(
                                          key,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                                    />
                                    <span className="text-[10px] text-theme-text-muted font-semibold">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-theme-text-secondary print:text-black">
                                    {weightages[key] ??
                                      defaultWeightages[key] ??
                                      0}
                                    %
                                  </span>
                                )}
                              </td>

                              {/* Self */}
                              <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                                {isAppraisee || isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={selfScores[key] ?? 0}
                                      onChange={(e) =>
                                        handleSelfScoreChange(
                                          key,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                                    />
                                    <span className="text-[10px] text-theme-text-muted font-semibold">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold print:text-black">
                                    {selfScores[key] ?? 0}%
                                  </span>
                                )}
                              </td>

                              {/* Supervisor */}
                              <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                                {isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={supervisorScores[key] ?? 0}
                                      onChange={(e) =>
                                        handleSupervisorScoreChange(
                                          key,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-emerald-500"
                                    />
                                    <span className="text-[10px] text-theme-text-muted font-semibold">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold print:text-black">
                                    {supervisorScores[key] !== undefined
                                      ? `${supervisorScores[key]}%`
                                      : "—"}
                                  </span>
                                )}
                              </td>

                              {/* Comments */}
                              <td className="py-2 px-3">
                                {isSupervisorOrAdmin ? (
                                  <input
                                    type="text"
                                    placeholder="Add feedback"
                                    value={comments[key] || ""}
                                    onChange={(e) =>
                                      handleCommentChange(key, e.target.value)
                                    }
                                    className="w-full bg-theme-card-bg border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-theme-border-active"
                                  />
                                ) : (
                                  <span className="text-theme-text-muted italic text-[11px] print:text-black">
                                    {comments[key] || "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        },
                      )}

                    {/* SERIAL 3: Custom Other Department Specific Indicators */}
                    {otherDeptKpiSrl !== null &&
                      kpiOtherDeptIndicators.map(
                        (indicator: string, idx: number) => {
                          const isFirst = idx === 0;
                          const key = `other_dept_${indicator}`;
                          const totalRows = kpiOtherDeptIndicators.length;

                          return (
                            <tr
                              key={key}
                              className="hover:bg-theme-card-container/20 transition-colors"
                            >
                              {isFirst && (
                                <>
                                  <td
                                    rowSpan={totalRows}
                                    className="py-4 px-3 text-center align-middle font-bold text-theme-text-secondary border-r border-theme-border-input bg-theme-page-bg/50 print:border-black print:bg-transparent print:text-black"
                                  >
                                    {otherDeptKpiSrl}
                                  </td>
                                  <td
                                    rowSpan={totalRows}
                                    className="py-4 px-4 align-middle font-bold text-theme-text-secondary border-r border-theme-border-input bg-theme-page-bg/50 print:border-black print:bg-transparent print:text-black"
                                  >
                                    {otherDepartment}
                                  </td>
                                </>
                              )}

                              {/* KPI Columns */}
                              <td className="py-2.5 px-4 border-r border-theme-border-muted font-medium text-theme-text-primary print:border-black print:text-black">
                                {indicator}
                              </td>
                              <td className="py-2.5 px-4 border-r border-theme-border-muted text-theme-text-muted print:border-black print:text-black">
                                Quality, Quantity & Timeliness
                              </td>
                              <td className="py-2.5 px-3 text-center border-r border-theme-border-muted font-semibold text-theme-text-muted print:border-black print:text-black">
                                100%
                              </td>

                              {/* Weightage */}
                              <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                                {isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={
                                        weightages[key] ??
                                        defaultWeightages[key] ??
                                        0
                                      }
                                      onChange={(e) =>
                                        handleWeightageChange(
                                          key,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                                    />
                                    <span className="text-[10px] text-theme-text-muted font-semibold">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-theme-text-secondary print:text-black">
                                    {weightages[key] ??
                                      defaultWeightages[key] ??
                                      0}
                                    %
                                  </span>
                                )}
                              </td>

                              {/* Self */}
                              <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                                {isAppraisee || isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={selfScores[key] ?? 0}
                                      onChange={(e) =>
                                        handleSelfScoreChange(
                                          key,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                                    />
                                    <span className="text-[10px] text-theme-text-muted font-semibold">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold print:text-black">
                                    {selfScores[key] ?? 0}%
                                  </span>
                                )}
                              </td>

                              {/* Supervisor */}
                              <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                                {isSupervisorOrAdmin ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={supervisorScores[key] ?? 0}
                                      onChange={(e) =>
                                        handleSupervisorScoreChange(
                                          key,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-emerald-500"
                                    />
                                    <span className="text-[10px] text-theme-text-muted font-semibold">
                                      %
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold print:text-black">
                                    {supervisorScores[key] !== undefined
                                      ? `${supervisorScores[key]}%`
                                      : "—"}
                                  </span>
                                )}
                              </td>

                              {/* Comments */}
                              <td className="py-2 px-3">
                                {isSupervisorOrAdmin ? (
                                  <input
                                    type="text"
                                    placeholder="Add feedback"
                                    value={comments[key] || ""}
                                    onChange={(e) =>
                                      handleCommentChange(key, e.target.value)
                                    }
                                    className="w-full bg-theme-card-bg border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-theme-border-active"
                                  />
                                ) : (
                                  <span className="text-theme-text-muted italic text-[11px] print:text-black">
                                    {comments[key] || "—"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        },
                      )}

                    {/* SERIAL 3/2: Monthly Data Entry Report */}
                    {reportSrl !== null && (
                      <tr className="bg-emerald-950/15 border-t border-b border-theme-border-input text-emerald-400 hover:bg-emerald-950/20 transition-colors print:bg-neutral-50 print:text-black print:border-black">
                        <td className="py-3 px-3 text-center align-middle font-bold border-r border-theme-border-input print:border-black">
                          {reportSrl}
                        </td>
                        <td className="py-3 px-4 font-bold border-r border-theme-border-input print:border-black">
                          Monthly Data Entry Report
                        </td>
                        <td className="py-3 px-4 font-medium border-r border-theme-border-muted print:border-black">
                          Monthly Reports
                        </td>
                        <td className="py-3 px-4 text-theme-text-muted border-r border-theme-border-muted print:border-black print:text-black">
                          Quality, Quantity & Timeliness
                        </td>
                        <td className="py-3 px-3 text-center font-semibold border-r border-theme-border-muted print:border-black">
                          100%
                        </td>

                        {/* Weightage */}
                        <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                          {isSupervisorOrAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={
                                  weightages["monthly_reports"] ??
                                  defaultWeightages["monthly_reports"] ??
                                  5
                                }
                                onChange={(e) =>
                                  handleWeightageChange(
                                    "monthly_reports",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                              />
                              <span className="text-[10px] text-theme-text-muted font-semibold">
                                %
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold print:text-black">
                              {weightages["monthly_reports"] ??
                                defaultWeightages["monthly_reports"] ??
                                5}
                              %
                            </span>
                          )}
                        </td>

                        {/* Self */}
                        <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                          {isAppraisee || isSupervisorOrAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={selfScores["monthly_reports"] ?? 0}
                                onChange={(e) =>
                                  handleSelfScoreChange(
                                    "monthly_reports",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                              />
                              <span className="text-[10px] text-theme-text-muted font-semibold">
                                %
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold print:text-black">
                              {selfScores["monthly_reports"] ?? 0}%
                            </span>
                          )}
                        </td>

                        {/* Supervisor */}
                        <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                          {isSupervisorOrAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={supervisorScores["monthly_reports"] ?? 0}
                                onChange={(e) =>
                                  handleSupervisorScoreChange(
                                    "monthly_reports",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-emerald-500"
                              />
                              <span className="text-[10px] text-theme-text-muted font-semibold">
                                %
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold print:text-black">
                              {supervisorScores["monthly_reports"] !== undefined
                                ? `${supervisorScores["monthly_reports"]}%`
                                : "—"}
                            </span>
                          )}
                        </td>

                        {/* Comments */}
                        <td className="py-2 px-3">
                          {isSupervisorOrAdmin ? (
                            <input
                              type="text"
                              placeholder="Add feedback"
                              value={comments["monthly_reports"] || ""}
                              onChange={(e) =>
                                handleCommentChange(
                                  "monthly_reports",
                                  e.target.value,
                                )
                              }
                              className="w-full bg-theme-card-bg border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-theme-border-active"
                            />
                          ) : (
                            <span className="text-theme-text-muted italic text-[11px] print:text-black">
                              {comments["monthly_reports"] || "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    )}

                    {/* SERIAL 4/3/2/1: Self Development Initiative */}
                    <tr className="bg-emerald-950/15 text-emerald-400 hover:bg-emerald-950/20 transition-colors print:bg-neutral-50 print:text-black">
                      <td className="py-3 px-3 text-center align-middle font-bold border-r border-theme-border-input print:border-black">
                        {selfDevSrl}
                      </td>
                      <td className="py-3 px-4 font-bold border-r border-theme-border-input print:border-black">
                        Self Development Initiative
                      </td>
                      <td
                        className="py-3 px-4 font-medium border-r border-theme-border-muted print:border-black truncate max-w-xs"
                        title={kpiSkillsJoined}
                      >
                        {kpiSkillsJoined}
                      </td>
                      <td className="py-3 px-4 text-theme-text-muted border-r border-theme-border-muted print:border-black print:text-black">
                        Quality, Quantity & Timeliness
                      </td>
                      <td className="py-3 px-3 text-center font-semibold border-r border-theme-border-muted print:border-black">
                        100%
                      </td>

                      {/* Weightage */}
                      <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                        {isSupervisorOrAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={
                                weightages["self_development"] ??
                                defaultWeightages["self_development"] ??
                                5
                              }
                              onChange={(e) =>
                                handleWeightageChange(
                                  "self_development",
                                  Number(e.target.value),
                                )
                              }
                              className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                            />
                            <span className="text-[10px] text-theme-text-muted font-semibold">
                              %
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold print:text-black">
                            {weightages["self_development"] ??
                              defaultWeightages["self_development"] ??
                              5}
                            %
                          </span>
                        )}
                      </td>

                      {/* Self */}
                      <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                        {isAppraisee || isSupervisorOrAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={selfScores["self_development"] ?? 0}
                              onChange={(e) =>
                                handleSelfScoreChange(
                                  "self_development",
                                  Number(e.target.value),
                                )
                              }
                              className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-blue-500"
                            />
                            <span className="text-[10px] text-theme-text-muted font-semibold">
                              %
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold print:text-black">
                            {selfScores["self_development"] ?? 0}%
                          </span>
                        )}
                      </td>

                      {/* Supervisor */}
                      <td className="py-2 px-3 text-center border-r border-theme-border-muted print:border-black">
                        {isSupervisorOrAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={supervisorScores["self_development"] ?? 0}
                              onChange={(e) =>
                                handleSupervisorScoreChange(
                                  "self_development",
                                  Number(e.target.value),
                                )
                              }
                              className="w-14 bg-theme-card-bg border border-theme-border-input rounded-lg py-1 text-center font-bold text-theme-text-primary focus:outline-hidden focus:border-emerald-500"
                            />
                            <span className="text-[10px] text-theme-text-muted font-semibold">
                              %
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold print:text-black">
                            {supervisorScores["self_development"] !== undefined
                              ? `${supervisorScores["self_development"]}%`
                              : "—"}
                          </span>
                        )}
                      </td>

                      {/* Comments */}
                      <td className="py-2 px-3">
                        {isSupervisorOrAdmin ? (
                          <input
                            type="text"
                            placeholder="Add feedback"
                            value={comments["self_development"] || ""}
                            onChange={(e) =>
                              handleCommentChange(
                                "self_development",
                                e.target.value,
                              )
                            }
                            className="w-full bg-theme-card-bg border border-theme-border-muted rounded-lg px-2.5 py-1 text-xs text-theme-text-primary placeholder-theme-text-muted/70 focus:outline-hidden focus:border-theme-border-active"
                          />
                        ) : (
                          <span className="text-theme-text-muted italic text-[11px] print:text-black">
                            {comments["self_development"] || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  </>
                );
              })()}
              <tr className="bg-theme-card-bg/90 font-bold border-t-2 border-theme-border-input text-theme-text-primary print:bg-neutral-100 print:text-black print:border-black print:border-t">
                <td
                  colSpan={5}
                  className="py-3 px-4 text-right border-r border-theme-border-input uppercase tracking-wider print:border-black"
                >
                  Total Weightage (Max 100%)
                </td>
                <td className="py-3 px-3 text-center border-r border-theme-border-muted font-black text-blue-400 print:border-black print:text-black">
                  {totals.weightage.toFixed(1)}%
                </td>
                <td className="py-3 px-3 text-center border-r border-theme-border-muted font-black text-blue-400 print:border-black print:text-black">
                  {totals.self.toFixed(1)}%
                </td>
                <td className="py-3 px-3 text-center border-r border-theme-border-muted font-black text-emerald-400 print:border-black print:text-black">
                  {totals.supervisor.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-theme-text-muted font-normal italic text-[11px] print:text-black">
                  —
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footnote notes */}
        <div className="space-y-1.5 pt-4 text-[11px] text-theme-text-muted leading-relaxed border-t border-theme-card-bg print:border-black print:text-black">
          <p className="font-semibold text-theme-text-secondary print:text-black">
            My Manager has discussed with me the objective set for my
            performance evaluation & I agree on the same.
          </p>
          <p className="italic">
            Note: Measurable Criteria: Time, Cost, Value, Quality, Quantity
          </p>
        </div>

        {/* 5. SIGNATURES ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-theme-card-bg print:grid-cols-2 print:border-black">
          {/* Appraisee Signature */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 print:hidden">
              <input
                type="checkbox"
                id="appraisee-sign-chk"
                checked={appraiseeSigned}
                disabled={!canEditAppraiseeFields}
                onChange={(e) => handleAppraiseeSignChange(e.target.checked)}
                className="h-4.5 w-4.5 rounded-lg border-theme-border-input bg-theme-card-container text-blue-600 focus:ring-blue-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="appraisee-sign-chk"
                className="text-xs font-semibold text-theme-text-secondary cursor-pointer select-none"
              >
                Sign Assessment (Appraisee)
              </label>
            </div>

            <div className="border-t border-theme-border-input/80 pt-2 space-y-1 w-full sm:w-72 print:border-black print:border-t">
              <div className="text-xs font-mono font-bold text-theme-text-primary uppercase tracking-wide print:text-black min-h-[16px]">
                {appraiseeSigned
                  ? targetStaff.full_name || targetStaff.username
                  : ""}
              </div>
              <div className="text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider print:text-black">
                Appraisee Signature{" "}
                {appraiseeSigned &&
                  appraiseeSignDate &&
                  `| Date: ${appraiseeSignDate}`}
              </div>
            </div>
          </div>

          {/* Appraiser Signature */}
          <div className="space-y-4 flex flex-col md:items-end print:items-end">
            <div className="w-full sm:w-72 space-y-4">
              <div className="flex items-center gap-2.5 print:hidden">
                <input
                  type="checkbox"
                  id="appraiser-sign-chk"
                  checked={appraiserSigned}
                  disabled={!isDesignatedAppraiser}
                  onChange={(e) => handleAppraiserSignChange(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-lg border-theme-border-input bg-theme-card-container text-emerald-600 focus:ring-emerald-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <label
                  htmlFor="appraiser-sign-chk"
                  className="text-xs font-semibold text-theme-text-secondary cursor-pointer select-none"
                >
                  Sign Assessment (Appraiser)
                </label>
              </div>

              <div className="border-t border-theme-border-input/80 pt-2 space-y-1 w-full print:border-black print:border-t">
                <div className="text-xs font-mono font-bold text-theme-text-primary uppercase tracking-wide print:text-black min-h-[16px]">
                  {appraiserSigned ? appraiserName : ""}
                </div>
                <div className="text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider print:text-black">
                  Appraiser Signature{" "}
                  {appraiserSigned &&
                    appraiserSignDate &&
                    `| Date: ${appraiserSignDate}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* External Appraiser Portal Modal */}
      {showViewKpiModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-xs p-4 pt-[12vh] overflow-y-auto animate-fade-in print:hidden">
          <div className="bg-theme-card-container border border-theme-border-muted max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold text-theme-text-primary">
                  Evaluate Appraisee KPI
                </h4>
                <p className="text-[10px] text-theme-text-muted mt-0.5">
                  Select a user who has designated you as Appraiser, or search
                  by Codename.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowViewKpiModal(false)}
                className="text-theme-text-muted hover:text-theme-text-secondary font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Codename Search */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider">
                Search Appraisee by Codename
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. KI1024"
                  value={appraiseeSearchText}
                  onChange={(e) => setAppraiseeSearchText(e.target.value)}
                  className="flex-1 bg-theme-card-bg border border-theme-border-input rounded-xl px-3 py-2 text-xs text-theme-text-primary placeholder-theme-text-muted/70 uppercase focus:outline-hidden focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleLoadAppraiseeByCodename(appraiseeSearchText);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    handleLoadAppraiseeByCodename(appraiseeSearchText)
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Load Sheet
                </button>
              </div>
            </div>

            {/* Assigned list */}
            <div className="border-t border-theme-card-bg pt-3 space-y-2">
              <h5 className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wide">
                Assigned Appraisees ({monthYearKey})
              </h5>
              {searchingAppraisee ? (
                <div className="flex items-center justify-center py-4 text-theme-text-muted gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-xs">Searching database...</span>
                </div>
              ) : assignedAppraisees.length === 0 ? (
                <p className="text-xs text-theme-text-muted italic py-2">
                  No users have designated you as Appraiser in this month's KPI
                  sheets yet.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 divide-y divide-theme-border-input/60 pr-1">
                  {assignedAppraisees.map((appraisee) => (
                    <button
                      key={appraisee.id}
                      type="button"
                      onClick={() => {
                        setEvaluatorModeProfile(appraisee);
                        setShowViewKpiModal(false);
                        toast.success(
                          `Loaded KPI sheet for ${appraisee.full_name || appraisee.username} in Evaluator Mode.`,
                        );
                      }}
                      className="w-full text-left py-2 px-2.5 rounded-lg hover:bg-theme-card-bg/60 hover:text-theme-text-primary text-theme-text-secondary transition-colors flex justify-between items-center text-xs font-medium cursor-pointer"
                    >
                      <span>{appraisee.full_name || appraisee.username}</span>
                      <span className="text-[10px] font-mono text-theme-text-muted uppercase">
                        {appraisee.username}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-theme-card-bg">
              <button
                type="button"
                onClick={() => {
                  setEvaluatorModeProfile(null);
                  setShowViewKpiModal(false);
                  toast.success("Reset view to your own KPI sheet.");
                }}
                className="px-3 py-1.5 bg-theme-card-bg hover:bg-theme-border-input text-theme-text-muted hover:text-theme-text-primary rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset to Self
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Period Modal */}
      <Modal
        isOpen={customPeriodModalOpen}
        onClose={() => setCustomPeriodModalOpen(false)}
        title="Custom Evaluation Period"
        icon={<Calendar className="h-5 w-5 text-blue-500" />}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4 pt-2 font-sans">
          <div>
            <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
              Period Label / Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Q1 2026, 1st Half 2026"
              value={newCustomPeriodLabel}
              onChange={(e) => setNewCustomPeriodLabel(e.target.value)}
              className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70 text-xs focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
                From Date
              </label>
              <input
                type="date"
                required
                value={newCustomPeriodFrom}
                onChange={(e) => setNewCustomPeriodFrom(e.target.value)}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
                To Date
              </label>
              <input
                type="date"
                required
                value={newCustomPeriodTo}
                onChange={(e) => setNewCustomPeriodTo(e.target.value)}
                className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-theme-border-muted">
            <button
              type="button"
              onClick={() => setCustomPeriodModalOpen(false)}
              className="flex-1 py-2 px-3 bg-theme-page-bg border border-theme-border-input hover:bg-theme-border-input/80 text-theme-text-secondary hover:text-theme-text-primary rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                !newCustomPeriodLabel.trim() ||
                !newCustomPeriodFrom ||
                !newCustomPeriodTo
              }
              onClick={() => {
                const label = newCustomPeriodLabel.trim();
                setActivePeriodKey(label);
                setDbCustomPeriodFrom(newCustomPeriodFrom);
                setDbCustomPeriodTo(newCustomPeriodTo);
                setDbCustomPeriodLabel(label);

                // Add dynamically to local options if not already present
                if (!savedPeriods.some((p) => p.month_year === label)) {
                  setSavedPeriods((prev) => [
                    ...prev,
                    {
                      month_year: label,
                      kpis: {
                        customPeriodFrom: newCustomPeriodFrom,
                        customPeriodTo: newCustomPeriodTo,
                        customPeriodLabel: label,
                      },
                    },
                  ]);
                }

                setCustomPeriodModalOpen(false);
                setIsDirty(true);
              }}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
