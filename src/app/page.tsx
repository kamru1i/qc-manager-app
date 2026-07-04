"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { Profile } from "@/types";
import { Loader2 } from "lucide-react";
import LoginPage from "@/app/login/page";
import { lazy, Suspense, useMemo } from "react";
import { UnifiedSidebar } from "@/components/UnifiedSidebar";
import { Navbar } from "@/components/Navbar";
import { calculateTopPerformerBadges } from "@/utils/leaderboardHelper";
import { Toaster } from 'react-hot-toast';
import { useGlobalNotifications } from "@/hooks/useGlobalNotifications";
import { UserNotificationsModal } from "@/components/modals/UserNotificationsModal";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { SkeletonLoader as QuotesSkeletonLoader } from "@/components/QuotesSkeletonLoader";


const ChutiDashboard = lazy(() => import("@/app/chuti/page"));
const QuotesDashboard = lazy(() => import("@/app/quotes/page"));
const UserManagementDashboard = lazy(() =>
  import("@/components/UserManagementDashboard").then((m) => ({
    default: m.UserManagementDashboard,
  })),
);
const TodoPanel = lazy(() =>
  import("@/components/TodoPanel").then((m) => ({ default: m.TodoPanel })),
);
const AnalyticsPanel = lazy(() =>
  import("@/components/AnalyticsPanel").then((m) => ({
    default: m.AnalyticsPanel,
  })),
);
const AuditLogsPanel = lazy(() =>
  import("@/components/AuditLogsPanel").then((m) => ({
    default: m.AuditLogsPanel,
  })),
);
const UserKpiPerformancePanel = lazy(() =>
  import("@/components/user-management/UserKpiPerformancePanel").then((m) => ({
    default: m.UserKpiPerformancePanel,
  })),
);

function getInitialState() {
  if (typeof window === "undefined") {
    return { sessionUser: null, profile: null, initialTab: null };
  }
  try {
    let authUser: any = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          authUser = parsed?.user || parsed?.currentSession?.user;
          break;
        }
      }
    }
    if (!authUser) return { sessionUser: null, profile: null, initialTab: null };

    const cacheKey = `cached_profile_${authUser.id}`;
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      const cachedProfile = JSON.parse(cachedStr);
      const hasChuti = !!cachedProfile.has_chuti_access;
      const hasQuotes = !!cachedProfile.has_quotes_access;
      const showTodo =
        cachedProfile.username?.toUpperCase() === "KAMRUL" ||
        cachedProfile.full_name === "Kamrul Islam";
      
      let lastActive = localStorage.getItem("last_active_dashboard") as any;
      if (lastActive === "chuti" && !hasChuti) lastActive = null;
      if (lastActive === "quotes" && !hasQuotes) lastActive = null;
      if (lastActive === "kpi" && !hasQuotes) lastActive = null;
      if (
        lastActive === "user_management" &&
        !(cachedProfile.role === "admin" || cachedProfile.role === "supervisor")
      )
        lastActive = null;
      if (lastActive === "todo" && !showTodo) lastActive = null;

      if (!lastActive) {
        lastActive = hasChuti ? "chuti" : "quotes";
      }
      return { sessionUser: authUser, profile: cachedProfile, initialTab: lastActive };
    }
    return { sessionUser: authUser, profile: null, initialTab: null };
  } catch (e) {
    console.error("Error loading initial synchronous state:", e);
    return { sessionUser: null, profile: null, initialTab: null };
  }
}

export default function AppPortal() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(() => {
    if (typeof window !== "undefined") {
      return getInitialState().sessionUser;
    }
    return null;
  });
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window !== "undefined") {
      return getInitialState().profile;
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      const state = getInitialState();
      return !state.sessionUser || !state.profile;
    }
    return true;
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "chuti"
    | "quotes"
    | "user_management"
    | "todo"
    | "analytics"
    | "audit_logs"
    | "kpi"
    | null
  >(() => {
    if (typeof window !== "undefined") {
      const state = getInitialState();
      return state.initialTab as any;
    }
    return "chuti";
  });
  const [logLines, setLogLines] = useState<string[]>([]);
  const fetchingRef = useRef<string | null>(null);
  // Always-current ref for activeTab — used inside async callbacks to avoid stale closures
  const activeTabRef = useRef<string>(activeTab);

  useEffect(() => {
    setMounted(true);
    const state = getInitialState();
    if (state.sessionUser) {
      setSessionUser(state.sessionUser);
    }
    if (state.profile) {
      setProfile(state.profile);
      setLoading(false);
    }
    if (state.initialTab) {
      setActiveTab(state.initialTab);
      activeTabRef.current = state.initialTab;
    }
  }, []);

  const [activeQuotesTab, setActiveQuotesTab] = useState<
    "entry" | "monthly" | "analytics" | "audit_logs" | "rules"
  >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("quotes_sales_active_tab");
      if (
        saved === "entry" ||
        saved === "monthly" ||
        saved === "analytics" ||
        saved === "audit_logs" ||
        saved === "rules"
      ) {
        return saved as
          | "entry"
          | "monthly"
          | "analytics"
          | "audit_logs"
          | "rules";
      }
    }
    return "entry";
  });

  const [activeChutiTab, setActiveChutiTab] = useState<
    "add_leave" | "leave_history" | "govt_responses" | "settlement" | "leave_settings"
  >(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("adminActiveTab");
      if (
        saved === "add_leave" ||
        saved === "leave_history" ||
        saved === "govt_responses" ||
        saved === "settlement" ||
        saved === "leave_settings"
      ) {
        return saved as "add_leave" | "leave_history" | "govt_responses" | "settlement" | "leave_settings";
      }
    }
    return "add_leave";
  });

  const handleQuotesTabChange = (
    tab: "entry" | "monthly" | "analytics" | "audit_logs" | "rules",
  ) => {
    if (tab === "analytics" || tab === "audit_logs") {
      setActiveTab(tab);
      localStorage.setItem("last_active_dashboard", tab);
    } else {
      setActiveTab("quotes");
      localStorage.setItem("last_active_dashboard", "quotes");
      setActiveQuotesTab(tab);
      localStorage.setItem("quotes_sales_active_tab", tab);
    }
  };

  const handleChutiTabChange = (
    tab: "add_leave" | "leave_history" | "govt_responses" | "settlement" | "leave_settings",
  ) => {
    setActiveChutiTab(tab);
    sessionStorage.setItem("adminActiveTab", tab);
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  const [isOnline, setIsOnline] = useState(true);
  const [isUserManagementFullView, setIsUserManagementFullView] = useState(false);
  const [quotesRecords, setQuotesRecords] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const onlineHandler = () => setIsOnline(true);
      const offlineHandler = () => setIsOnline(false);
      window.addEventListener("online", onlineHandler);
      window.addEventListener("offline", offlineHandler);
      return () => {
        window.removeEventListener("online", onlineHandler);
        window.removeEventListener("offline", offlineHandler);
      };
    }
  }, []);

  useEffect(() => {
    if (!sessionUser) return;

    const fetchProfiles = async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (data && !error) {
        setProfilesList(data);
      }
    };

    const fetchRecords = async () => {
      let allRecords: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      // Filter to fetch records only from January 1st of the previous year to optimize performance
      const today = new Date();
      const prevYear = today.getFullYear() - 1;
      const filterDateStr = `${prevYear}-01-01T00:00:00Z`;

      try {
        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const { data, error } = await supabase
            .from("records")
            .select("user_id, submitted_at")
            .gte("submitted_at", filterDateStr)
            .range(from, to);

          if (error) throw error;
          if (data && data.length > 0) {
            allRecords = [...allRecords, ...data];
            if (data.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        }
        setQuotesRecords(allRecords);
      } catch (err: any) {
        console.error("Error fetching all records:", err?.message || err?.details || err);
      }
    };

    // Defer background data fetches — these are only needed for leaderboard
    // badges and user-management panels, not for the initial dashboard render.
    // Using a 3s delay lets the main UI show first, then load supplementary data.
    // Skip fetchRecords on user_management tab — records are only for badges,
    // not needed there, and the paginated loop exhausts the connection pool.
    const deferTimer = setTimeout(() => {
      fetchProfiles();
      if (activeTabRef.current !== 'user_management') {
        fetchRecords();
      }
    }, 3000);

    // Subscribe to supabase changes on records table to dynamically refresh badges
    const channel = supabase
      .channel("records_root_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "records" },
        () => {
          // Skip real-time record refresh when on user_management — not needed
          if (activeTabRef.current !== 'user_management') {
            fetchRecords();
          }
        },
      )
      .subscribe();

    return () => {
      clearTimeout(deferTimer);
      supabase.removeChannel(channel);
    };
  }, [sessionUser]);

  const [topPerformerBadges, setTopPerformerBadges] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_top_performer_badges');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          return {};
        }
      }
    }
    return {};
  });

  useEffect(() => {
    // We can compute badges even if records are empty initially, but once they load, it updates.
    // Also, if profilesList is loaded, we can instantly guarantee Kamrul gets his badge.
    const calculated = calculateTopPerformerBadges(quotesRecords, profilesList);

    // Only update and cache if we actually have computed data (to prevent resetting cache on fresh mount before load)
    if (quotesRecords.length > 0 || profilesList.length > 0) {
      setTopPerformerBadges(calculated);
      localStorage.setItem('cached_top_performer_badges', JSON.stringify(calculated));
    }
  }, [quotesRecords, profilesList]);

  const [chutiNotificationCount, setChutiNotificationCount] = useState(0);
  const [chutiOfflineCount, setChutiOfflineCount] = useState(0);

  // Own local state for the global notification modal — plain and direct, works across all tabs
  const [showNotificationsModal, setShowNotificationsModalRaw] = useState(false);

  const {
    unreadCount: globalUnreadCount,
    notificationsList: globalNotificationsList,
    handleSaveHolidayResponse,
  } = useGlobalNotifications(sessionUser, profile, profilesList);

  // Wrapper that also stores last-viewed time
  const setShowNotificationsModal = (val: boolean) => {
    setShowNotificationsModalRaw(val);
    if (val) {
      const now = new Date().toISOString();
      localStorage.setItem('last_viewed_notifications_time', now);
    }
  };

  const [chutiNotificationsList, setChutiNotificationsList] = useState<any[] | null>(null);

  useEffect(() => {
    const handleCountChange = (e: Event) => {
      setChutiNotificationCount((e as CustomEvent).detail || 0);
    };
    const handleOfflineCountChange = (e: Event) => {
      setChutiOfflineCount((e as CustomEvent).detail || 0);
    };
    const handleListSync = (e: Event) => {
      setChutiNotificationsList((e as CustomEvent).detail || []);
    };
    const handleOpenUserNotif = () => {
      setShowNotificationsModal(true);
    };
    window.addEventListener(
      "chuti-notification-count-change",
      handleCountChange,
    );
    window.addEventListener(
      "chuti-offline-count-change",
      handleOfflineCountChange,
    );
    window.addEventListener(
      "chuti-notification-list-sync",
      handleListSync,
    );
    window.addEventListener(
      "open-user-notifications-modal",
      handleOpenUserNotif,
    );
    return () => {
      window.removeEventListener(
        "chuti-notification-count-change",
        handleCountChange,
      );
      window.removeEventListener(
        "chuti-offline-count-change",
        handleOfflineCountChange,
      );
      window.removeEventListener(
        "chuti-notification-list-sync",
        handleListSync,
      );
      window.removeEventListener(
        "open-user-notifications-modal",
        handleOpenUserNotif,
      );
    };
  }, [setShowNotificationsModalRaw]);

  useEffect(() => {
    if (activeTab !== "chuti" || (activeChutiTab !== "leave_history" && activeChutiTab !== "govt_responses" && activeChutiTab !== "settlement")) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA" || activeEl.hasAttribute("contenteditable")) {
          return;
        }
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        handleChutiTabChange("add_leave");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, activeChutiTab]);

  // Keep activeTabRef in sync so async callbacks don't use stale closures
  useEffect(() => {
    activeTabRef.current = activeTab ?? '';
  }, [activeTab]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (theme === "light") {
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
      }
      window.dispatchEvent(new CustomEvent("theme-change", { detail: theme }));
    }
  }, [theme]);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleThemeToggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      return next;
    });
  };

  const addLog = (msg: string) => {
    console.log(`[AppPortal] ${msg}`);
    setLogLines((prev) => [...prev, msg]);
  };

  const loadUserProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current === userId) {
      addLog(`loadUserProfile duplicate call skipped for ${userId}`);
      return;
    }

    addLog(`loadUserProfile started for ${userId}`);

    // Try loading from localStorage cache first (Stale-While-Revalidate pattern)
    const cacheKey = `cached_profile_${userId}`;
    let cachedProfile: Profile | null = null;
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        cachedProfile = JSON.parse(cachedStr);
        addLog(`Restoring profile from localStorage cache...`);
      }
    } catch (e) {
      addLog(`Failed to parse cached profile: ${e}`);
    }

    // Apply cache immediately if found to hide loading spinner instantly
    if (cachedProfile) {
      setProfile(cachedProfile);
      const hasChuti = !!cachedProfile.has_chuti_access;
      const hasQuotes = !!cachedProfile.has_quotes_access;

      const showTodo =
        cachedProfile.username?.toUpperCase() === "KAMRUL" ||
        cachedProfile.full_name === "Kamrul Islam";
       let lastActive = localStorage.getItem("last_active_dashboard") as
        | "chuti"
        | "quotes"
        | "user_management"
        | "todo"
        | "kpi"
        | null;
      if (lastActive === "chuti" && !hasChuti) lastActive = null;
      if (lastActive === "quotes" && !hasQuotes) lastActive = null;
      if (lastActive === "kpi" && !hasQuotes) lastActive = null;
      if (
        lastActive === "user_management" &&
        !(cachedProfile.role === "admin" || cachedProfile.role === "supervisor")
      )
        lastActive = null;
      if (lastActive === "todo" && !showTodo) lastActive = null;

      if (!lastActive) {
        lastActive = hasChuti ? "chuti" : "quotes";
        localStorage.setItem("last_active_dashboard", lastActive);
      }

      addLog(`[SWR] Restored cache, activeTab: ${lastActive}. Hiding spinner.`);
      setActiveTab(lastActive);
      setErrorMsg(null);
      setLoading(false);
    }

    // Fetch fresh profile in the background
    fetchingRef.current = userId;
    try {
      // 5-second timeout safeguard for the database query
      const fetchPromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database query timed out")), 5000),
      );

      addLog("Background query to profiles table started...");
      const result = await Promise.race([fetchPromise, timeoutPromise]);

      // Promise.race might return the result of the fetchPromise directly
      const { data: profileData, error: profileError } = result as {
        data: any;
        error: any;
      };
      addLog(`Background query completed (hasProfileData: ${!!profileData})`);

      if (profileError) {
        addLog(`Query error: ${profileError.message}`);
        if (!cachedProfile) {
          setErrorMsg(
            "Profile settings not found. Please contact administrator.",
          );
          setLoading(false);
        }
        return;
      }

      if (!profileData) {
        addLog("No profile record returned");
        if (!cachedProfile) {
          setErrorMsg(
            "Profile settings not found. Please contact administrator.",
          );
          setLoading(false);
        }
        return;
      }

      const userProfile = profileData as Profile;

      // Update cache
      localStorage.setItem(cacheKey, JSON.stringify(userProfile));

      // Update state
      setProfile(userProfile);

      const hasChuti = !!userProfile.has_chuti_access;
      const hasQuotes = !!userProfile.has_quotes_access;

      if (!hasChuti && !hasQuotes) {
        setErrorMsg(
          "You do not have access to any workspace. Please contact your manager.",
        );
        setLoading(false);
        return;
      }

      // Choose active workspace tab
      const showTodo =
        userProfile.username?.toUpperCase() === "KAMRUL" ||
        userProfile.full_name === "Kamrul Islam";
      let lastActive = localStorage.getItem("last_active_dashboard") as
        | "chuti"
        | "quotes"
        | "user_management"
        | "todo"
        | null;
      if (lastActive === "chuti" && !hasChuti) lastActive = null;
      if (lastActive === "quotes" && !hasQuotes) lastActive = null;
      if (
        lastActive === "user_management" &&
        !(userProfile.role === "admin" || userProfile.role === "supervisor")
      )
        lastActive = null;
      if (lastActive === "todo" && !showTodo) lastActive = null;

      if (!lastActive) {
        lastActive = hasChuti ? "chuti" : "quotes";
        localStorage.setItem("last_active_dashboard", lastActive);
      }

      setActiveTab(lastActive);
      setErrorMsg(null);
      setLoading(false);
    } catch (err: any) {
      addLog(`Background fetch error: ${err?.message || err}`);
      if (!cachedProfile) {
        setErrorMsg("Error loading profile settings.");
        setLoading(false);
      }
    } finally {
      if (fetchingRef.current === userId) {
        fetchingRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    addLog("AppPortal: Mounted");
    let active = true;

    // Listen for auth state changes to dynamically switch rendering between Login and App Dashboard
    // onAuthStateChange fires automatically on subscribe with the current session (if any).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`onAuthStateChange event: ${event} (hasSession: ${!!session})`);
      if (!active) return;

      // Skip full reload on USER_UPDATED (e.g. password change via supabase.auth.updateUser).
      // The session remains valid — no re-fetch needed, and re-fetching can falsely trigger
      // the quotes RECOVERY system while the new auth token is being applied.
      if (event === 'USER_UPDATED') {
        addLog('onAuthStateChange: USER_UPDATED skipped (password change, no reload needed)');
        if (session) setSessionUser(session.user);
        return;
      }

      if (session) {
        setSessionUser(session.user);
        await loadUserProfile(session.user.id);
      } else {
        addLog("onAuthStateChange no session, setting loading to false");
        setSessionUser(null);
        setProfile(null);
        setActiveTab(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  // Listen for custom workspace-change event dispatched by sidebar
  useEffect(() => {
    const handleWorkspaceChange = (e: Event) => {
      const targetWorkspace = (e as CustomEvent).detail as
        | "chuti"
        | "quotes"
        | "user_management"
        | "todo"
        | "kpi"
        | "audit_logs"
        | "analytics";
      addLog(`custom workspace-change event detected: ${targetWorkspace}`);

      // Clear flag when navigating to any workspace from the sidebar
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('viewingStaffFromUserManagement');
        sessionStorage.removeItem('viewingStaffId');
        window.dispatchEvent(new CustomEvent('trigger-viewing-staff', { detail: null }));
      }

      // Safety check: ensure user has access before switching
      if (profile) {
        if (targetWorkspace === "chuti" && !profile.has_chuti_access) return;
        if (targetWorkspace === "quotes" && !profile.has_quotes_access) return;
        if (targetWorkspace === "kpi" && !profile.has_quotes_access) return;
        if (
          targetWorkspace === "user_management" &&
          !(profile.role === "admin" || profile.role === "supervisor")
        )
          return;
        if (
          targetWorkspace === "audit_logs" &&
          !(profile.role === "admin" || profile.role === "supervisor")
        )
          return;
        if (
          targetWorkspace === "analytics" &&
          !(profile.role === "admin" || profile.role === "supervisor")
        )
          return;
        if (targetWorkspace === "todo") {
          const showTodo =
            profile.username?.toUpperCase() === "KAMRUL" ||
            profile.full_name === "Kamrul Islam";
          if (!showTodo) return;
        }
      }

      setActiveTab(targetWorkspace);
    };

    window.addEventListener("workspace-change", handleWorkspaceChange);
    return () =>
      window.removeEventListener("workspace-change", handleWorkspaceChange);
  }, [profile]);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-955" />;
  }

  if (loading && !sessionUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-white p-4">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-700" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="h-20 w-20 border-2 border-purple-500/20 rounded-full absolute" />
            <Loader2 className="h-12 w-12 text-purple-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-purple-300 bg-clip-text text-transparent">
            QC Manager
          </h1>
          <p className="text-sm text-slate-400 tracking-wide animate-pulse">
            Configuring your workspaces...
          </p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-white p-4">
        <div className="w-full max-w-md relative z-10">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center">
            <div className="space-y-4">
              <div className="h-16 w-16 bg-red-950/40 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner animate-bounce">
                ⚠️
              </div>
              <h2 className="text-xl font-semibold text-slate-100">
                Access Restricted
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed px-2">
                {errorMsg}
              </p>
              <button
                onClick={async () => {
                  setErrorMsg(null);
                  setLoading(true);
                  await supabase.auth.signOut();
                }}
                className="mt-6 px-6 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-600/20 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Unauthenticated -> Render Login Page
  if (!sessionUser) {
    console.log("[AppPortal] Rendering LoginPage");
    return <LoginPage />;
  }

  // Session exists but Profile is loading -> Show splash screen
  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-white p-4">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-700" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="h-20 w-20 border-2 border-purple-500/20 rounded-full absolute" />
            <Loader2 className="h-12 w-12 text-purple-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-purple-300 bg-clip-text text-transparent">
            QC Manager
          </h1>
          <p className="text-sm text-slate-400 tracking-wide animate-pulse">
            Configuring your workspaces...
          </p>
        </div>
      </main>
    );
  }

  // Authenticated -> Render single layout shell wrapping active workspace component
  return (
    <div className="flex-1 min-h-screen flex flex-col bg-slate-955 relative overflow-hidden pb-12 text-white selection:bg-purple-650 selection:text-white">
      <Toaster
        position="top-right"
        reverseOrder={false}
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f172a',
            color: '#f1f5f9',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            fontSize: '13px',
            padding: '12px 16px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#0f172a' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0f172a' },
          },
        }}
      />
      {/* Glow background blobs */}
      <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Shared Unified Navbar */}
      <Navbar
        profile={profile}
        isOnline={isOnline}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onLogout={handleLogout}
        badges={topPerformerBadges}
        onProfileSettingsClick={() =>
          window.dispatchEvent(new CustomEvent("open-profile-settings"))
        }
        onNotificationClick={() => {
          if (profile?.role === 'admin') {
            const mode = sessionStorage.getItem('adminNotificationMode') || 'user';
            if (mode === 'admin') {
              window.dispatchEvent(new CustomEvent('open-admin-approvals-modal'));
            } else {
              setShowNotificationsModal(true);
            }
          } else {
            setShowNotificationsModal(true);
          }
        }}
        onManualSync={() =>
          window.dispatchEvent(new CustomEvent("trigger-manual-sync"))
        }
        notificationCount={activeTab === 'chuti' ? chutiNotificationCount : globalUnreadCount}
        offlineCount={activeTab === 'chuti' ? chutiOfflineCount : 0}
      />

      {/* Portal Target for Modals */}
      <div id="root-modals-portal" className="relative z-50" />

      {/* Global Unified Notifications Modal */}
      {sessionUser && profile && (
        <UserNotificationsModal
          showUserNotificationsModal={showNotificationsModal}
          setShowUserNotificationsModal={setShowNotificationsModal}
          userNotificationsList={activeTab === 'chuti' && chutiNotificationsList !== null ? chutiNotificationsList : globalNotificationsList}
          profile={profile}
          onSaveHolidayResponse={handleSaveHolidayResponse}
          onRevisionClick={(record) => {
            window.dispatchEvent(new CustomEvent('open-revision-modal', { detail: record }));
          }}
          onApproveChutiRequest={(id, approve) => {
            window.dispatchEvent(new CustomEvent('approve-chuti-request', { detail: { id, approve } }));
          }}
          onApproveReserveAdjustment={(record, approve) => {
            window.dispatchEvent(new CustomEvent('approve-reserve-adjustment', { detail: { record, approve } }));
          }}
          onApproveProfileChangeRequest={(id, approve) => {
            window.dispatchEvent(new CustomEvent('approve-profile-change', { detail: { id, approve } }));
          }}
          onApprovePasswordResetRequest={(id, approve) => {
            window.dispatchEvent(new CustomEvent('approve-password-reset', { detail: { id, approve } }));
          }}
          onSupervisorApproveChuti={(id, approve) => {
            window.dispatchEvent(new CustomEvent('supervisor-approve-chuti', { detail: { id, approve } }));
          }}
          onSwitchToAdminPanel={() => {
            sessionStorage.setItem('adminNotificationMode', 'admin');
            setShowNotificationsModal(false);
            window.dispatchEvent(new CustomEvent('open-admin-approvals-modal'));
          }}
        />
      )}

      {/* Main container with Sidebar and Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full z-10 flex-1 flex flex-col md:flex-row items-start">
        <div
          className={`shrink-0 ${
            (activeTab === "user_management" && isUserManagementFullView) || 
            (activeTab === "chuti" && (activeChutiTab === "leave_history" || activeChutiTab === "govt_responses" || activeChutiTab === "settlement"))
              ? "w-0 h-0 opacity-0 pointer-events-none overflow-hidden mb-0 md:mb-0 md:mr-0"
              : "w-full md:w-auto opacity-100 mb-6 md:mb-0 md:mr-6"
          }`}
        >
          <UnifiedSidebar
            activeSection={
              (typeof window !== "undefined" &&
              sessionStorage.getItem("viewingStaffFromUserManagement") === "true")
                ? "user_management"
                : activeTab === "user_management"
                  ? "user_management"
                  : activeTab === "todo"
                    ? "todo"
                    : activeTab === "analytics"
                      ? "analytics"
                      : activeTab === "audit_logs"
                        ? "audit_logs"
                        : activeTab === "quotes"
                          ? "quotes"
                          : activeTab === "kpi"
                            ? "kpi"
                            : "chuti"
            }
            profile={profile}
            activeQuotesTab={activeQuotesTab}
            onQuotesTabChange={handleQuotesTabChange}
            activeChutiTab={activeChutiTab}
            onChutiTabChange={handleChutiTabChange}
            isSidebarCollapsed={isSidebarCollapsed}
            onSidebarToggle={handleSidebarToggle}
          />
        </div>

        <section className="flex-1 min-w-0 w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl min-h-125">
          <Suspense
            fallback={
              <div className="w-full">
                {activeTab === "chuti" ? (
                  <SkeletonLoader variant={
                    activeChutiTab === "add_leave" ? "chuti-form" : 
                    activeChutiTab === "leave_history" ? "leave-history" : 
                    activeChutiTab === "govt_responses" ? "responses-table" : 
                    activeChutiTab === "settlement" ? "settlements-table" : 
                    activeChutiTab === "leave_settings" ? "leave-settings" : 
                    "leaves-table"
                  } />
                ) : activeTab === "quotes" ? (
                  <QuotesSkeletonLoader type={
                    activeQuotesTab === "entry" ? "form" : 
                    activeQuotesTab === "monthly" ? "table" : 
                    activeQuotesTab === "rules" ? "rules" : 
                    activeQuotesTab === "analytics" ? "analytics" : 
                    activeQuotesTab === "audit_logs" ? "audit-logs" : 
                    "generic"
                  } />
                ) : activeTab === "user_management" ? (
                  <SkeletonLoader variant="staff-table" rows={8} />
                ) : activeTab === "todo" ? (
                  <SkeletonLoader variant="todo" />
                ) : activeTab === "analytics" ? (
                  <SkeletonLoader variant="analytics" />
                ) : activeTab === "audit_logs" ? (
                  <SkeletonLoader variant="audit-logs" />
                ) : (
                  <SkeletonLoader variant="table" />
                )}
              </div>
            }
          >
            {(activeTab === "quotes" || activeTab === "analytics" || activeTab === "audit_logs") && (
              <QuotesDashboard
                activeTab={
                  activeTab === "quotes" ? activeQuotesTab : (activeTab as any)
                }
                onTabChange={handleQuotesTabChange}
              />
            )}
            {/* ChutiDashboard: always mounted for admin (needed for admin approval modal from any tab), else conditionally mounted */}
            {(activeTab === "chuti" || profile?.role === 'admin') && (
              <div className={activeTab !== 'chuti' ? 'hidden' : undefined}>
                <ChutiDashboard
                  activeChutiTab={activeChutiTab}
                  onChutiTabChange={handleChutiTabChange}
                />
              </div>
            )}
            {activeTab === "user_management" && (
              <UserManagementDashboard
                sessionUser={sessionUser}
                profile={profile}
                onLogout={handleLogout}
                theme={theme}
                onThemeToggle={handleThemeToggle}
                isSidebarCollapsed={isSidebarCollapsed}
                onSidebarToggle={handleSidebarToggle}
                topPerformerBadges={topPerformerBadges}
                onViewStateChange={setIsUserManagementFullView}
              />
            )}
            {activeTab === "todo" && (
              <TodoPanel profile={profile} />
            )}
            {activeTab === "kpi" && profile && (
              <UserKpiPerformancePanel viewingStaff={profile} />
            )}
          </Suspense>
        </section>
      </main>
    </div>
  );
}
