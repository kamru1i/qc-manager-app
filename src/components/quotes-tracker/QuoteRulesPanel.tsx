"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabase";
import { Profile, ComplianceRule } from "@/types";

import { INSURANCE_DATABASE } from "@/utils/initialRulesData";
import { COMPLIANCE_RULE_COLUMNS } from "@/utils/dbColumns";
import {
  Search,
  X,
  ChevronDown,
  Copy,
  PlusCircle,
  Trash2,
  Edit,
  ShieldAlert,
  BookOpen,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";

interface QuoteRulesPanelProps {
  profile: Profile | null;
  sessionUser: any;
  isOnline: boolean;
  showToast: (type: "success" | "error", text: string) => void;
}

// ─── ACCORDION SECTION COMPONENT ───────────────────────────────────
interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  accent: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  icon,
  accent,
  count,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-theme-border-muted bg-theme-card-bg/20 overflow-hidden transition-all duration-300 hover:border-theme-border-input/80">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-theme-border-muted/20 transition-colors duration-200"
      >
        <span className={`shrink-0 ${accent}`}>{icon}</span>
        <h3 className="text-sm font-semibold tracking-wide text-theme-text-primary flex-1 text-left">
          {title}
        </h3>
        {count !== undefined && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-theme-border-input/80 text-theme-text-muted border border-theme-border-active">
            {count}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-theme-text-muted transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`transition-all duration-300 ease-out ${isOpen ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
};

let seedingInProgress = false;

const COMPANY_KEYWORDS_MAP: Record<string, string[]> = {
  acorn: ["acorn", "motorcade", "protect", "iresure", "middlesure"],
  marshmallow: ["marshmallow", "move", "go box"],
  esure: ["esure", "flex", "sheilas", "wheels"],
  eui: ["eui", "admiral", "elephant", "diamond", "ford", "bellbox"],
  tesco: ["tesco"],
  hastings: ["hastings", "youdrive"],
  "1st central": ["1st central", "first central"],
  "go girl": ["go girl", "insure2drive", "gogirl"],
  "quote me happy": [
    "quote me happy",
    "quotemehappy",
    "aviva",
    "general accident",
  ],
  axa: ["axa", "swiftcover", "moja"],
  sainsbury: ["sainsbury", "sainsburys"],
  sheffield: ["sheffield", "swan drive", "swandrive"],
};

const getMentionedCompanies = (text: string): string[] => {
  const lowercaseText = text.toLowerCase();
  const mentioned: string[] = [];
  Object.entries(COMPANY_KEYWORDS_MAP).forEach(([companyKey, keywords]) => {
    const hasKeyword = keywords.some((keyword) =>
      lowercaseText.includes(keyword),
    );
    if (hasKeyword) {
      mentioned.push(companyKey);
    }
  });
  return mentioned;
};

const getCompanyKey = (name: string): string | null => {
  const lowercaseName = name.toLowerCase();
  for (const [companyKey, keywords] of Object.entries(COMPANY_KEYWORDS_MAP)) {
    if (keywords.some((keyword) => lowercaseName.includes(keyword))) {
      return companyKey;
    }
  }
  return null;
};

const isRuleRelevant = (
  ruleContent: string,
  selectedName: string | null,
): boolean => {
  if (!selectedName) return true; // Show all if no company selected

  const mentioned = getMentionedCompanies(ruleContent);
  if (mentioned.length === 0) return true; // General rule

  const selectedKey = getCompanyKey(selectedName);
  if (!selectedKey) return true; // Fallback if selected company not mapped

  return mentioned.includes(selectedKey);
};

export const QuoteRulesPanel: React.FC<QuoteRulesPanelProps> = ({
  profile,
  sessionUser,
  isOnline,
  showToast,
}) => {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Authorization check
  const canEdit = useMemo(() => {
    return profile?.role === "admin" || !!profile?.can_manage_rules;
  }, [profile]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rule: ComplianceRule;
  } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<ComplianceRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<ComplianceRule | null>(null);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Close all open modals on Escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isAddModalOpen) setIsAddModalOpen(false);
        if (isEditModalOpen) setIsEditModalOpen(false);
        if (ruleToDelete) setRuleToDelete(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isAddModalOpen, isEditModalOpen, ruleToDelete]);

  // Form States for Add/Edit
  const [formCategory, setFormCategory] = useState<
    "announcement" | "fine" | "universal" | "company"
  >("company");
  const [formSubCategory, setFormSubCategory] = useState<any>("common_rules");
  const [formCompanyName, setFormCompanyName] = useState("");
  const [formCompanyTagsInput, setFormCompanyTagsInput] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formExtraInfo, setFormExtraInfo] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Fetch rules from Supabase
  const fetchRules = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data, error } = await supabase
          .from("compliance_rules")
          .select(COMPLIANCE_RULE_COLUMNS)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true });

        if (error) throw error;

        const uniqueRulesMap = new Map();
        const duplicateIdsToDelete: string[] = [];

        (data || []).forEach((r: any) => {
          const key = `${r.category}_${r.sub_category}_${r.company_name || ""}_${r.title || ""}_${r.content}`;
          if (!uniqueRulesMap.has(key)) {
            uniqueRulesMap.set(key, r);
          } else {
            duplicateIdsToDelete.push(r.id);
          }
        });

        setRules(Array.from(uniqueRulesMap.values()));

        // Background cleanup of duplicate rules for admins
        if (
          duplicateIdsToDelete.length > 0 &&
          profile?.role === "admin" &&
          isOnline
        ) {
          supabase
            .from("compliance_rules")
            .delete()
            .in("id", duplicateIdsToDelete)
            .then(({ error: deleteError }) => {
              if (!deleteError) {
                // Deduplication succeeded silently
              } else {
                console.error(
                  "Deduplication: Failed to delete duplicate database rules:",
                  deleteError,
                );
              }
            });
        }
      } catch (err) {
        console.error("Error fetching compliance rules:", err);
        showToast("error", "Failed to load rules.");
      } finally {
        setLoading(false);
      }
    },
    [showToast, profile, isOnline],
  );

  // Trigger rules query on mount
  useEffect(() => {
    setMounted(true);
    fetchRules();
  }, [fetchRules]);

  // Close context menu and dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const seedRules = async () => {
    if (seedingInProgress) return;
    seedingInProgress = true;
    setLoading(true);
    try {
      // Double check if rules exist in database before insertion
      const { count } = await supabase
        .from("compliance_rules")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false);
      if (count && count > 0) {
        seedingInProgress = false;
        return;
      }

      const rowsToInsert: any[] = [];

      // 1. Global Announcements
      rowsToInsert.push({
        category: "announcement",
        sub_category: "nby_rule",
        content: INSURANCE_DATABASE.global_announcements.nby_rule,
      });
      rowsToInsert.push({
        category: "announcement",
        sub_category: "general_pricing",
        content: INSURANCE_DATABASE.global_announcements.general_pricing,
      });

      // 2. Admin Fines
      INSURANCE_DATABASE.admin_fines.forEach((fine) => {
        rowsToInsert.push({
          category: "fine",
          sub_category: "common_rules",
          title: fine.title,
          content: fine.detail,
          extra_info: fine.amount,
        });
      });

      // 3. Universal Rules
      INSURANCE_DATABASE.universal_rules.employment.forEach((rule) => {
        rowsToInsert.push({
          category: "universal",
          sub_category: "employment",
          content: rule,
        });
      });
      INSURANCE_DATABASE.universal_rules.driver_and_usage.forEach((rule) => {
        rowsToInsert.push({
          category: "universal",
          sub_category: "driver_and_usage",
          content: rule,
        });
      });
      INSURANCE_DATABASE.universal_rules.license_and_residency.forEach(
        (rule) => {
          rowsToInsert.push({
            category: "universal",
            sub_category: "license_and_residency",
            content: rule,
          });
        },
      );
      INSURANCE_DATABASE.universal_rules.file_processing.forEach((rule) => {
        rowsToInsert.push({
          category: "universal",
          sub_category: "file_processing",
          content: rule,
        });
      });

      // 4. Company Rules
      INSURANCE_DATABASE.companies.forEach((company) => {
        company.branch_priority.forEach((rule) => {
          rowsToInsert.push({
            category: "company",
            sub_category: "branch_priority",
            company_name: company.name,
            company_tags: company.tags,
            content: rule,
          });
        });
        company.doc_extensions.forEach((rule) => {
          rowsToInsert.push({
            category: "company",
            sub_category: "doc_extensions",
            company_name: company.name,
            company_tags: company.tags,
            content: rule,
          });
        });
        company.common_rules.forEach((rule) => {
          rowsToInsert.push({
            category: "company",
            sub_category: "common_rules",
            company_name: company.name,
            company_tags: company.tags,
            content: rule,
          });
        });
      });

      const { error } = await supabase
        .from("compliance_rules")
        .insert(rowsToInsert);
      if (error) throw error;

      // Log seeding activity
      await supabase.from("audit_logs").insert({
        actor_id: sessionUser?.id,
        actor_codename: profile?.username || "SYSTEM",
        action_type: "SEED_RULES",
        target_id: null,
        details: "Initialized compliance rules database with 83 default rules",
      });

      showToast("success", "Quote rules database initialized successfully!");
      fetchRules();
    } catch (err) {
      console.error("Failed to seed rules database:", err);
      showToast(
        "error",
        "Seeding failed: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      seedingInProgress = false;
      setLoading(false);
    }
  };

  // Seeding check: If rules table is empty, seed with INSURANCE_DATABASE rules
  useEffect(() => {
    if (!loading && rules.length === 0 && canEdit && isOnline) {
      // Prompt seeding
      const checkAndSeed = async () => {
        const { count, error } = await supabase
          .from("compliance_rules")
          .select("*", { count: "exact", head: true })
          .eq("is_deleted", false);

        if (!error && count === 0) {
          seedRules();
        }
      };
      checkAndSeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules.length, loading, canEdit, isOnline]);

  // Group rules into structured variables
  const globalAnnouncements = useMemo(() => {
    return {
      nby_rule: rules.find(
        (r) => r.category === "announcement" && r.sub_category === "nby_rule",
      ),
      general_pricing: rules.find(
        (r) =>
          r.category === "announcement" && r.sub_category === "general_pricing",
      ),
    };
  }, [rules]);

  const adminFines = useMemo(() => {
    const fines = rules.filter((r) => r.category === "fine");
    if (!selectedCompanyName) return fines;
    return fines.filter(
      (r) =>
        isRuleRelevant(r.content || "", selectedCompanyName) ||
        isRuleRelevant(r.title || "", selectedCompanyName),
    );
  }, [rules, selectedCompanyName]);

  const universalRules = useMemo(() => {
    const filterFn = (r: ComplianceRule) => {
      if (!selectedCompanyName) return true;
      return (
        isRuleRelevant(r.content || "", selectedCompanyName) ||
        isRuleRelevant(r.title || "", selectedCompanyName)
      );
    };

    return {
      employment: rules
        .filter(
          (r) => r.category === "universal" && r.sub_category === "employment",
        )
        .filter(filterFn),
      driver_and_usage: rules
        .filter(
          (r) =>
            r.category === "universal" && r.sub_category === "driver_and_usage",
        )
        .filter(filterFn),
      license_and_residency: rules
        .filter(
          (r) =>
            r.category === "universal" &&
            r.sub_category === "license_and_residency",
        )
        .filter(filterFn),
      file_processing: rules
        .filter(
          (r) =>
            r.category === "universal" && r.sub_category === "file_processing",
        )
        .filter(filterFn),
    };
  }, [rules, selectedCompanyName]);

  // Unique list of companies derived from the database rules
  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, { name: string; tags: string[] }>();
    rules.forEach((r) => {
      if (r.category === "company" && r.company_name) {
        if (!map.has(r.company_name)) {
          map.set(r.company_name, {
            name: r.company_name,
            tags: r.company_tags || [],
          });
        }
      }
    });
    return Array.from(map.values());
  }, [rules]);

  // Active Company Filtered details
  const selectedCompanyRules = useMemo(() => {
    if (!selectedCompanyName) return null;
    const cmpRules = rules.filter(
      (r) => r.category === "company" && r.company_name === selectedCompanyName,
    );
    return {
      name: selectedCompanyName,
      tags: cmpRules[0]?.company_tags || [],
      branch_priority: cmpRules.filter(
        (r) => r.sub_category === "branch_priority",
      ),
      doc_extensions: cmpRules.filter(
        (r) => r.sub_category === "doc_extensions",
      ),
      common_rules: cmpRules.filter((r) => r.sub_category === "common_rules"),
    };
  }, [rules, selectedCompanyName]);

  // Search Filter suggestions
  const suggestions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return uniqueCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [searchQuery, uniqueCompanies]);

  const showDropdown =
    searchFocused && searchQuery.trim().length > 0 && suggestions.length > 0;

  // Copy helper
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast("success", "Copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast("error", "Failed to copy.");
    }
  };

  // Add rule submit
  const handleAddRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      showToast("error", "Requires an active internet connection.");
      return;
    }
    if (!formContent.trim()) {
      showToast("error", "Content cannot be empty.");
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        category: formCategory,
        sub_category: formSubCategory,
        content: formContent.trim(),
        updated_by: sessionUser?.id,
      };

      if (formCategory === "company") {
        if (!formCompanyName.trim()) {
          showToast("error", "Company name is required.");
          return;
        }
        payload.company_name = formCompanyName.trim();
        payload.company_tags = formCompanyTagsInput
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
      } else if (formCategory === "fine") {
        if (!formTitle.trim()) {
          showToast("error", "Fine title is required.");
          return;
        }
        payload.title = formTitle.trim();
        payload.extra_info = formExtraInfo.trim();
      } else if (formCategory === "announcement") {
        // Validation check
        if (
          formSubCategory !== "nby_rule" &&
          formSubCategory !== "general_pricing"
        ) {
          showToast("error", "Invalid announcement type.");
          return;
        }
      }

      const { data, error } = await supabase
        .from("compliance_rules")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Log activity
      await supabase.from("audit_logs").insert({
        actor_id: sessionUser?.id,
        actor_codename: profile?.username || "SYSTEM",
        action_type: "ADD_RULE",
        target_id: data.id,
        details: `Added new rule in category '${formCategory}' -> '${formSubCategory}'`,
      });



      showToast("success", "Rule added successfully!");
      setIsAddModalOpen(false);
      resetForm();
      await fetchRules(true);
    } catch (err) {
      console.error("Failed to add rule:", err);
      showToast("error", "Error adding rule.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit rule submit
  const handleEditRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleToEdit || !isOnline) return;
    if (!formContent.trim()) {
      showToast("error", "Content cannot be empty.");
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        content: formContent.trim(),
        updated_by: sessionUser?.id,
      };

      if (ruleToEdit.category === "company") {
        payload.company_name = formCompanyName.trim();
        payload.company_tags = formCompanyTagsInput
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
      } else if (ruleToEdit.category === "fine") {
        payload.title = formTitle.trim();
        payload.extra_info = formExtraInfo.trim();
      }

      const { error } = await supabase
        .from("compliance_rules")
        .update(payload)
        .eq("id", ruleToEdit.id);

      if (error) throw error;

      // Log activity
      const previousDetails = [
        `Category: ${ruleToEdit.category}`,
        `Sub-Category: ${ruleToEdit.sub_category}`,
        ruleToEdit.title ? `Title: ${ruleToEdit.title}` : "",
        ruleToEdit.company_name
          ? `Company Name: ${ruleToEdit.company_name}`
          : "",
        ruleToEdit.company_tags && ruleToEdit.company_tags.length > 0
          ? `Company Tags: ${ruleToEdit.company_tags.join(", ")}`
          : "",
        ruleToEdit.content ? `Content: ${ruleToEdit.content}` : "",
        ruleToEdit.extra_info ? `Extra Info: ${ruleToEdit.extra_info}` : "",
      ]
        .filter(Boolean)
        .join("\n- ");

      await supabase.from("audit_logs").insert({
        actor_id: sessionUser?.id,
        actor_codename: profile?.username || "SYSTEM",
        action_type: "UPDATE_RULE",
        target_id: ruleToEdit.id,
        details: `Updated compliance rule.

Previous Version:
- ${previousDetails}

Action by: ${profile?.full_name || "System"} (${profile?.username || "system"})`,
      });



      showToast("success", "Rule updated successfully!");
      setIsEditModalOpen(false);
      setRuleToEdit(null);
      resetForm();
      await fetchRules(true);
    } catch (err) {
      console.error("Failed to edit rule:", err);
      showToast("error", "Error updating rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormCategory("company");
    setFormSubCategory("common_rules");
    setFormCompanyName("");
    setFormCompanyTagsInput("");
    setFormTitle("");
    setFormContent("");
    setFormExtraInfo("");
  };

  const handleOpenAddModal = (
    cat: "announcement" | "fine" | "universal" | "company",
    sub: string = "common_rules",
  ) => {
    resetForm();
    setFormCategory(cat);
    setFormSubCategory(sub as any);
    if (cat === "company" && selectedCompanyName) {
      setFormCompanyName(selectedCompanyName);
      const tags = selectedCompanyRules?.tags || [];
      setFormCompanyTagsInput(tags.join(", "));
    }
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (rule: ComplianceRule) => {
    setRuleToEdit(rule);
    setFormCategory(rule.category);
    setFormSubCategory(rule.sub_category);
    setFormCompanyName(rule.company_name || "");
    setFormCompanyTagsInput((rule.company_tags || []).join(", "));
    setFormTitle(rule.title || "");
    setFormContent(rule.content);
    setFormExtraInfo(rule.extra_info || "");
    setIsEditModalOpen(true);
    setContextMenu(null);
  };

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent, rule: ComplianceRule) => {
    if (!canEdit) return; // Only show menu if authorized
    e.preventDefault();

    // Clamp position to keep context menu within viewport bounds
    const menuWidth = 144; // w-36 = 9rem = 144px
    const menuHeight = 80; // approximate height of 2 menu items
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

    setContextMenu({ x, y, rule });
  };

  return (
    <div
      className="space-y-6 relative"
      style={{
        fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', 'Inter', sans-serif",
      }}
    >
      {/* ─── HEADER PANEL ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-theme-text-primary flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Compliance & Quote Rules Portal
          </h2>
          <p className="text-xs text-theme-text-muted mt-1">
            Search branch rules, universal policies, announcements, and fines.
          </p>
        </div>

        {/* Global Action Panel */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          {canEdit && (
            <button
              onClick={() => handleOpenAddModal("company")}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-semibold text-white bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-theme-card-container"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Add Rule
            </button>
          )}
        </div>
      </div>

      {/* ─── SEARCH SYSTEM ─── */}
      <div className="w-full max-w-2xl mx-auto relative z-30">
        <div className="relative flex items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search insurance company by name or tag (e.g. acorn, marshmallow)..."
              className="w-full bg-theme-card-bg/40 backdrop-blur-md border border-theme-border-muted focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 rounded-l-xl py-2.5 pl-10 pr-4 text-sm placeholder-theme-text-muted/60 transition-all duration-300 shadow-md outline-none"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-24 top-1/2 -translate-y-1/2 p-0.5 hover:bg-theme-border-input rounded-full text-theme-text-muted hover:text-theme-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => {
              if (suggestions.length > 0) {
                setSelectedCompanyName(suggestions[0].name);
                setSearchQuery("");
              }
            }}
            className="shrink-0 px-5 py-2.5 bg-blue-600/10 border border-l-0 border-theme-border-muted hover:bg-blue-600/20 hover:border-blue-500/30 rounded-r-xl text-blue-400 text-sm font-semibold transition-all duration-200"
          >
            Search
          </button>
        </div>

        {/* Suggestion Dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute w-full bg-theme-card-bg border border-theme-border-input rounded-xl mt-1.5 overflow-hidden shadow-2xl z-50 animate-fade-in"
          >
            <div className="py-1 max-h-56 overflow-y-auto">
              {suggestions.map((company) => (
                <button
                  key={company.name}
                  onClick={() => {
                    setSelectedCompanyName(company.name);
                    setSearchQuery("");
                    setSearchFocused(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-theme-border-input/60 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-semibold text-theme-text-primary">
                      {company.name}
                    </p>
                    <p className="text-[10px] text-theme-text-muted mt-0.5">
                      {company.tags.map((t) => `#${t}`).join("  ")}
                    </p>
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-theme-text-muted/65 group-hover:text-blue-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick search tags */}
        {!selectedCompanyName && !searchQuery && (
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <span className="text-[10px] text-theme-text-muted uppercase tracking-wider">
              Quick Select:
            </span>
            {[
              "Acorn",
              "EUI",
              "Marshmallow",
              "Tesco",
              "Hastings",
              "1st Central",
            ].map((nameKey) => {
              const matchedCompany = uniqueCompanies.find((c) =>
                c.name.toLowerCase().includes(nameKey.toLowerCase()),
              );
              return (
                <button
                  key={nameKey}
                  onClick={() => {
                    if (matchedCompany) {
                      setSelectedCompanyName(matchedCompany.name);
                    } else {
                      setSelectedCompanyName(nameKey);
                    }
                  }}
                  className="text-[11px] text-theme-text-muted hover:text-blue-400 bg-theme-card-bg/60 hover:bg-theme-border-muted border border-theme-border-muted px-2.5 py-1 rounded-lg transition-all duration-200"
                >
                  {nameKey}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── MAIN CONTENT VIEW ─── */}
      {loading ? (
        <div className="space-y-6 animate-pulse">
          {/* Skeletons for Announcements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Critical Rule Skeleton */}
            <div className="rounded-2xl border border-theme-border-input bg-theme-card-bg/10 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-theme-border-input" />
                <div className="w-32 h-4 bg-theme-border-input rounded" />
              </div>
              <div className="space-y-2">
                <div className="w-full h-3 bg-theme-border-muted rounded" />
                <div className="w-5/6 h-3 bg-theme-border-muted rounded" />
                <div className="w-4/5 h-3 bg-theme-border-muted rounded" />
              </div>
            </div>

            {/* General Rule Skeleton */}
            <div className="rounded-2xl border border-theme-border-input bg-theme-card-bg/10 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-theme-border-input" />
                <div className="w-36 h-4 bg-theme-border-input rounded" />
              </div>
              <div className="space-y-2">
                <div className="w-full h-3 bg-theme-border-muted rounded" />
                <div className="w-11/12 h-3 bg-theme-border-muted rounded" />
                <div className="w-3/4 h-3 bg-theme-border-muted rounded" />
              </div>
            </div>
          </div>

          {/* Skeletons for Fines & Penalties */}
          <div className="rounded-2xl border border-theme-border-input bg-theme-card-bg/10 p-5 space-y-4">
            <div className="w-40 h-4 bg-theme-border-input rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fine Item 1 */}
              <div className="p-4 bg-theme-card-bg/20 border border-theme-border-muted/60 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="w-24 h-3.5 bg-theme-border-input rounded" />
                  <div className="w-16 h-4 bg-theme-border-input rounded-full" />
                </div>
                <div className="w-full h-3 bg-theme-border-muted rounded" />
                <div className="w-5/6 h-3 bg-theme-border-muted rounded" />
              </div>

              {/* Fine Item 2 */}
              <div className="p-4 bg-theme-card-bg/20 border border-theme-border-muted/60 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="w-28 h-3.5 bg-theme-border-input rounded" />
                  <div className="w-14 h-4 bg-theme-border-input rounded-full" />
                </div>
                <div className="w-full h-3 bg-theme-border-muted rounded" />
                <div className="w-2/3 h-3 bg-theme-border-muted rounded" />
              </div>
            </div>
          </div>

          {/* Skeletons for Accordion Sections */}
          <div className="space-y-4">
            {/* Accordion 1 */}
            <div className="rounded-2xl border border-theme-border-input bg-theme-card-bg/10 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-theme-border-input rounded" />
                <div className="w-48 h-4 bg-theme-border-input rounded" />
              </div>
              <div className="w-8 h-4 bg-theme-border-input rounded-full" />
            </div>

            {/* Accordion 2 */}
            <div className="rounded-2xl border border-theme-border-input bg-theme-card-bg/10 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-theme-border-input rounded" />
                <div className="w-64 h-4 bg-theme-border-input rounded" />
              </div>
              <div className="w-8 h-4 bg-theme-border-input rounded-full" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  COMPANY SPECIFIC RULES DISPLAY                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {selectedCompanyName && (
            <div className="bg-theme-card-bg/40 border border-blue-900/10 p-5 rounded-2xl space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-theme-border-muted pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-blue-400">
                      {selectedCompanyName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-theme-text-primary leading-tight">
                      {selectedCompanyName}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(selectedCompanyRules?.tags || []).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-[9px] px-2 py-0.5 rounded bg-theme-border-muted text-blue-400 border border-theme-border-input"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCompanyName(null)}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary text-xs font-medium transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Rules
                </button>
              </div>

              {/* Company rules body */}
              <div className="space-y-4">
                {/* Branch priority */}
                {(selectedCompanyRules?.branch_priority.length || 0) > 0 && (
                  <AccordionSection
                    title="Branch Priority Rules"
                    icon={<AlertCircle className="w-4 h-4" />}
                    accent="text-purple-400"
                    count={selectedCompanyRules?.branch_priority.length}
                    defaultOpen={true}
                  >
                    <div className="space-y-1">
                      {selectedCompanyRules?.branch_priority.map((rule) => (
                        <RuleItem
                          key={rule.id}
                          rule={rule}
                          onCopy={handleCopy}
                          copiedId={copiedId}
                          onContextMenu={handleContextMenu}
                        />
                      ))}
                    </div>
                  </AccordionSection>
                )}

                {/* Common guidelines */}
                {(selectedCompanyRules?.common_rules.length || 0) > 0 && (
                  <AccordionSection
                    title="Common Guidelines"
                    icon={<BookOpen className="w-4 h-4" />}
                    accent="text-blue-400"
                    count={selectedCompanyRules?.common_rules.length}
                    defaultOpen={true}
                  >
                    <div className="space-y-1">
                      {selectedCompanyRules?.common_rules.map((rule) => (
                        <RuleItem
                          key={rule.id}
                          rule={rule}
                          onCopy={handleCopy}
                          copiedId={copiedId}
                          onContextMenu={handleContextMenu}
                        />
                      ))}
                    </div>
                  </AccordionSection>
                )}

                {/* DOC extensions */}
                {(selectedCompanyRules?.doc_extensions.length || 0) > 0 && (
                  <div className="rounded-2xl border border-purple-500/20 bg-purple-500/2 p-4.5 space-y-3">
                    <h4 className="text-xs font-bold text-purple-400 tracking-wider uppercase">
                      DOC — Driving Other Cars
                    </h4>
                    <div className="space-y-1">
                      {selectedCompanyRules?.doc_extensions.map((rule) => (
                        <RuleItem
                          key={rule.id}
                          rule={rule}
                          onCopy={handleCopy}
                          copiedId={copiedId}
                          onContextMenu={handleContextMenu}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/*  GLOBAL RULES & SECTIONS                                    */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1 h-px bg-theme-border-muted" />
              <span className="text-[10px] font-semibold text-theme-text-muted uppercase tracking-widest shrink-0">
                Universal Guidelines
              </span>
              <div className="flex-1 h-px bg-theme-border-muted" />
            </div>

            {/* NBY Rule */}
            {globalAnnouncements.nby_rule && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/2 p-5 space-y-3 animate-fade-in relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚨</span>
                    <h4 className="text-sm font-bold text-red-300 tracking-wide">
                      CRITICAL — NBY Rule
                    </h4>
                  </div>
                </div>
                <div
                  className="flex items-start gap-2.5 bg-red-500/1 border border-red-500/5 rounded-xl p-3"
                  onContextMenu={(e) =>
                    handleContextMenu(e, globalAnnouncements.nby_rule!)
                  }
                >
                  <p className="text-xs leading-relaxed text-theme-text-secondary/90 flex-1">
                    {globalAnnouncements.nby_rule.content}
                  </p>
                  <CopyButton
                    text={globalAnnouncements.nby_rule.content}
                    id={globalAnnouncements.nby_rule.id}
                    onCopy={handleCopy}
                    copiedId={copiedId}
                  />
                </div>
              </div>
            )}

            {/* General Pricing */}
            {globalAnnouncements.general_pricing && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/2 p-5 space-y-3 animate-fade-in relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💡</span>
                    <h4 className="text-sm font-bold text-blue-300 tracking-wide">
                      General Pricing Rule
                    </h4>
                  </div>
                </div>
                <div
                  className="flex items-start gap-2.5 bg-blue-500/1 border border-blue-500/5 rounded-xl p-3"
                  onContextMenu={(e) =>
                    handleContextMenu(e, globalAnnouncements.general_pricing!)
                  }
                >
                  <p className="text-xs leading-relaxed text-theme-text-secondary/90 flex-1">
                    {globalAnnouncements.general_pricing.content}
                  </p>
                  <CopyButton
                    text={globalAnnouncements.general_pricing.content}
                    id={globalAnnouncements.general_pricing.id}
                    onCopy={handleCopy}
                    copiedId={copiedId}
                  />
                </div>
              </div>
            )}

            {/* Admin Fines */}
            {adminFines.length > 0 && (
              <div className="rounded-2xl border border-purple-500/15 bg-purple-500/2 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-purple-300 tracking-wider uppercase flex items-center gap-2">
                    <ShieldAlert className="h-4.5 w-4.5 text-purple-500" />
                    Admin Fines & Penalties
                  </h3>
                  {canEdit && (
                    <button
                      onClick={() => handleOpenAddModal("fine")}
                      className="p-1 text-theme-text-muted hover:text-theme-text-primary"
                    >
                      <PlusCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminFines.map((fine, idx) => (
                    <div
                      key={fine.id}
                      className="group relative flex items-start gap-3 p-3.5 bg-theme-card-bg/30 border border-theme-border-muted rounded-xl hover:bg-theme-border-muted/30 transition-all duration-200"
                      onContextMenu={(e) => handleContextMenu(e, fine)}
                    >
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-purple-500/10 flex items-center justify-center text-[10px] font-bold text-purple-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-[12.5px] font-semibold text-purple-300/90 truncate">
                            {fine.title}
                          </h4>
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 whitespace-nowrap">
                            {fine.extra_info}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] text-theme-text-muted leading-relaxed">
                          {fine.content}
                        </p>
                      </div>

                      {/* Copy Button */}
                      <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                        <CopyButton
                          text={fine.content}
                          id={fine.id}
                          onCopy={handleCopy}
                          copiedId={copiedId}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Employment Status */}
            {universalRules.employment.length > 0 && (
              <AccordionSection
                title="Universal Employment Status Rules"
                icon={<BookOpen className="w-4.5 h-4.5" />}
                accent="text-emerald-400"
                count={universalRules.employment.length}
              >
                <div className="space-y-1">
                  {universalRules.employment.map((rule) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Driver & Car Usage */}
            {universalRules.driver_and_usage.length > 0 && (
              <AccordionSection
                title="Universal Driver & Car Usage Rules"
                icon={<BookOpen className="w-4.5 h-4.5" />}
                accent="text-blue-400"
                count={universalRules.driver_and_usage.length}
              >
                <div className="space-y-1">
                  {universalRules.driver_and_usage.map((rule) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* License & Residency */}
            {universalRules.license_and_residency.length > 0 && (
              <AccordionSection
                title="Universal License & Residency Rules"
                icon={<BookOpen className="w-4.5 h-4.5" />}
                accent="text-violet-400"
                count={universalRules.license_and_residency.length}
              >
                <div className="space-y-1">
                  {universalRules.license_and_residency.map((rule) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* File Processing */}
            {universalRules.file_processing.length > 0 && (
              <AccordionSection
                title="Universal File Processing & Team Policies"
                icon={<BookOpen className="w-4.5 h-4.5" />}
                accent="text-rose-400"
                count={universalRules.file_processing.length}
              >
                <div className="space-y-1">
                  {universalRules.file_processing.map((rule) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      onCopy={handleCopy}
                      copiedId={copiedId}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              </AccordionSection>
            )}
          </div>
        </div>
      )}

      {/* ─── FLOATING CONTEXT MENU ─── */}
      {mounted &&
        contextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="fixed bg-theme-card-bg border border-theme-border-input rounded-lg shadow-2xl py-1 w-36 z-50 text-xs animate-fade-in"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => handleOpenEditModal(contextMenu.rule)}
              className="w-full text-left px-3.5 py-2 hover:bg-theme-border-input text-theme-text-primary hover:text-theme-text-primary flex items-center gap-2 cursor-pointer"
            >
              <Edit className="h-3.5 w-3.5 text-blue-500" />
              Edit Rule
            </button>
            <button
              onClick={() => {
                setRuleToDelete(contextMenu.rule);
                setContextMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-theme-border-input text-red-400 hover:text-red-300 flex items-center gap-2 cursor-pointer border-t border-theme-border-input"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Rule
            </button>
          </div>,
          document.body,
        )}

      {/* ─── ADD RULE MODAL ─── */}
      {mounted &&
        isAddModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-fade-in">
            <div className="bg-theme-card-bg border border-theme-border-input p-6 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute right-4 top-4 text-theme-text-muted hover:text-theme-text-primary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-md font-bold text-theme-text-primary mb-4 flex items-center gap-1.5">
                <PlusCircle className="h-4.5 w-4.5 text-blue-500" /> Add New
                Rule
              </h3>
              <form
                onSubmit={handleAddRuleSubmit}
                className="space-y-4 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e: any) => {
                        setFormCategory(e.target.value);
                        if (e.target.value === "announcement") {
                          setFormSubCategory("nby_rule");
                        } else if (e.target.value === "universal") {
                          setFormSubCategory("employment");
                        } else if (e.target.value === "fine") {
                          setFormSubCategory("common_rules");
                        } else {
                          setFormSubCategory("common_rules");
                        }
                      }}
                      className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary cursor-pointer"
                    >
                      <option value="company">Company Specific</option>
                      <option value="universal">Universal Rule</option>
                      <option value="fine">Admin Fine</option>
                      <option value="announcement">Announcement</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                      Sub Category
                    </label>
                    {formCategory === "company" ? (
                      <select
                        value={formSubCategory}
                        onChange={(e) =>
                          setFormSubCategory(e.target.value as any)
                        }
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary cursor-pointer"
                      >
                        <option value="common_rules">Common Rule</option>
                        <option value="branch_priority">Branch Priority</option>
                        <option value="doc_extensions">
                          DOC Driving Other Cars
                        </option>
                      </select>
                    ) : formCategory === "universal" ? (
                      <select
                        value={formSubCategory}
                        onChange={(e) =>
                          setFormSubCategory(e.target.value as any)
                        }
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary cursor-pointer"
                      >
                        <option value="employment">Employment</option>
                        <option value="driver_and_usage">
                          Driver & Car Usage
                        </option>
                        <option value="license_and_residency">
                          License & Residency
                        </option>
                        <option value="file_processing">
                          File Processing & Policies
                        </option>
                      </select>
                    ) : formCategory === "announcement" ? (
                      <select
                        value={formSubCategory}
                        onChange={(e) =>
                          setFormSubCategory(e.target.value as any)
                        }
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary cursor-pointer"
                      >
                        <option value="nby_rule">NBY Rule</option>
                        <option value="general_pricing">General Pricing</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled
                        value="Common Rules"
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-muted opacity-60"
                      />
                    )}
                  </div>
                </div>

                {formCategory === "company" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Marshmallow"
                        value={formCompanyName}
                        onChange={(e) => setFormCompanyName(e.target.value)}
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                        Tags (Comma-separated)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. marshmallow, move, go"
                        value={formCompanyTagsInput}
                        onChange={(e) =>
                          setFormCompanyTagsInput(e.target.value)
                        }
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70"
                      />
                    </div>
                  </div>
                )}

                {formCategory === "fine" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                        Fine Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ভুল আপডেট"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                        Penalty Amount
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ৫০০ টাকা জরিমানা"
                        value={formExtraInfo}
                        onChange={(e) => setFormExtraInfo(e.target.value)}
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                    Rule Detail (Bengali or English)
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Type the rule instruction..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/70 resize-y"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-2 bg-theme-page-bg border border-theme-border-input hover:bg-theme-border-input/80 text-theme-text-secondary hover:text-theme-text-primary rounded-lg font-semibold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* ─── EDIT RULE MODAL ─── */}
      {mounted &&
        isEditModalOpen &&
        ruleToEdit &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-fade-in">
            <div className="bg-theme-card-bg border border-theme-border-input p-6 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="absolute right-4 top-4 text-theme-text-muted hover:text-theme-text-primary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-md font-bold text-theme-text-primary mb-4 flex items-center gap-1.5">
                <Edit className="h-4.5 w-4.5 text-blue-500" /> Edit Rule
              </h3>
              <form
                onSubmit={handleEditRuleSubmit}
                className="space-y-4 text-xs"
              >
                <div className="grid grid-cols-2 gap-3 opacity-60">
                  <div>
                    <label className="block text-[11px] font-semibold text-theme-text-muted mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      disabled
                      value={ruleToEdit.category.toUpperCase()}
                      className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-muted"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-theme-text-muted mb-1">
                      Sub Category
                    </label>
                    <input
                      type="text"
                      disabled
                      value={ruleToEdit.sub_category.toUpperCase()}
                      className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-muted"
                    />
                  </div>
                </div>

                {ruleToEdit.category === "company" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Marshmallow"
                        value={formCompanyName}
                        onChange={(e) => setFormCompanyName(e.target.value)}
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                        Tags (Comma-separated)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. marshmallow, move, go"
                        value={formCompanyTagsInput}
                        onChange={(e) =>
                          setFormCompanyTagsInput(e.target.value)
                        }
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary"
                      />
                    </div>
                  </div>
                )}

                {ruleToEdit.category === "fine" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                        Fine Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ভুল আপডেট"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                        Penalty Amount
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ৫০০ টাকা জরিমানা"
                        value={formExtraInfo}
                        onChange={(e) => setFormExtraInfo(e.target.value)}
                        className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-theme-text-secondary mb-1">
                    Rule Detail (Bengali or English)
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary resize-y"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-2 bg-theme-page-bg border border-theme-border-input hover:bg-theme-border-input/80 text-theme-text-secondary hover:text-theme-text-primary rounded-lg font-semibold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white rounded-xl font-semibold transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* ─── DELETE RULE MODAL ─── */}
      {mounted &&
        ruleToDelete &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-fade-in">
            <div className="bg-theme-card-bg border border-theme-border-input p-6 rounded-2xl w-full max-w-sm shadow-2xl relative text-center">
              <button
                onClick={() => setRuleToDelete(null)}
                className="absolute right-4 top-4 text-theme-text-muted hover:text-theme-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-theme-text-primary mb-2">
                Delete Rule?
              </h3>
              <p className="text-xs text-theme-text-muted mb-6 leading-relaxed">
                Are you sure you want to delete this compliance rule? This
                action will be logged in the system audit logs.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={submitting}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete All
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent !important;
          background-color: transparent !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.15) !important;
          border-radius: 9999px;
          transition: background 0.2s ease;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3) !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.45) !important;
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `,
        }}
      />
    </div>
  );
};

// ─── HELPER RULE ITEM COMPONENT ────────────────────────────────────
interface RuleItemProps {
  rule: ComplianceRule;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  onContextMenu: (e: React.MouseEvent, rule: ComplianceRule) => void;
}

const RuleItem: React.FC<RuleItemProps> = React.memo(
  ({ rule, onCopy, copiedId, onContextMenu }) => {
    return (
      <div
        className="group relative flex items-start gap-2.5 py-2.5 px-3 rounded-xl hover:bg-theme-border-muted/20 transition-all duration-200 border border-transparent hover:border-theme-border-muted/50"
        onContextMenu={(e) => onContextMenu(e, rule)}
      >
        <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-blue-500/50" />
        <p className="text-[12.5px] leading-[1.7] text-theme-text-secondary/90 flex-1">
          {rule.content}
        </p>

        {/* Copy Button */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <CopyButton
            text={rule.content}
            id={rule.id}
            onCopy={onCopy}
            copiedId={copiedId}
          />
        </div>
      </div>
    );
  },
);
RuleItem.displayName = "RuleItem";

// ─── HELPER COPY BUTTON COMPONENT ───────────────────────────────────
interface CopyButtonProps {
  text: string;
  id: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}

const CopyButton: React.FC<CopyButtonProps> = React.memo(
  ({ text, id, copiedId, onCopy }) => {
    const isCopied = copiedId === id;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopy(text, id);
        }}
        className={`shrink-0 p-1 rounded transition-all duration-300 cursor-pointer ${
          isCopied
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 scale-100"
            : "bg-theme-border-input/40 text-theme-text-muted hover:text-theme-text-secondary hover:bg-theme-border-active/50 opacity-0 group-hover:opacity-100 border border-transparent"
        }`}
        title={isCopied ? "Copied!" : "Copy to Clipboard"}
      >
        {isCopied ? (
          <Check className="w-3 h-3" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    );
  },
);
CopyButton.displayName = "CopyButton";
