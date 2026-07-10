"use client";

import { useEffect, useState, useRef, useCallback, lazy, Suspense, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { Profile } from "@/types";
import { Loader2 } from "lucide-react";
import LoginPage from "@/app/login/page";
import { UnifiedSidebar } from "@/components/common/UnifiedSidebar";
import { Navbar } from "@/components/common/Navbar";
import { Toaster, toast } from 'react-hot-toast';
import { useGlobalNotifications } from "@/hooks/leave-tracker/useGlobalNotifications";
import { UserNotificationsModal } from "@/components/common/modals/UserNotificationsModal";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import { SkeletonLoader as QuotesSkeletonLoader } from "@/components/quotes-tracker/QuotesSkeletonLoader";
import { subscribeUserToPush } from "@/utils/webPushHelper";
import { useDesktopNotifications } from "@/hooks/common/useDesktopNotifications";
import { checkInactivity, registerAndCheckSession, updateSessionLastActiveInDb } from "@/utils/sessionHelper";

import { UserKpiPerformancePanel } from "@/components/common/user-management/UserKpiPerformancePanel";
const ChutiDashboard = lazy(() => import("@/app/chuti/page"));
const QuotesDashboard = lazy(() => import("@/app/quotes/page"));
const UserManagementDashboard = lazy(() =>
  import("@/components/common/UserManagementDashboard").then((m) => ({
    default: m.UserManagementDashboard,
  })),
);
const TodoPanel = lazy(() =>
  import("@/components/common/TodoPanel").then((m) => ({ default: m.TodoPanel })),
);
const ProfileSettings = lazy(() =>
  import("@/components/common/ProfileSettings").then((m) => ({ default: m.ProfileSettings }))
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

// Cache the initial state so we don't parse localStorage JSON 5 times during mount
const _cachedInitialState = typeof window !== "undefined" ? getInitialState() : null;

export default function AppPortal() {
  const [mounted, setMounted] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(() => _cachedInitialState?.sessionUser ?? null);
  const [profile, setProfile] = useState<Profile | null>(() => _cachedInitialState?.profile ?? null);
  const [loading, setLoading] = useState(() => !_cachedInitialState?.sessionUser || !_cachedInitialState?.profile);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "chuti"
    | "quotes"
    | "user_management"
    | "todo"
    | "analytics"
    | "audit_logs"
    | "kpi"
    | "profile_settings"
    | null
  >(() => (_cachedInitialState?.initialTab as any) ?? "chuti");
  const fetchingRef = useRef<string | null>(null);
  const sessionUserRef = useRef<any>(null);
  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);
  // Always-current ref for activeTab — used inside async callbacks to avoid stale closures
  const activeTabRef = useRef<string>(activeTab);
  const [previousTab, setPreviousTab] = useState<string>("chuti");
  const prevTabRef = useRef<string>("chuti");

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeQuotesTab, setActiveQuotesTab] = useState<
    "entry" | "monthly" | "analytics" | "audit_logs" | "rules" | "ip_checker" | "login_codes" | "asitis_causality" | "eui_causality" | "copy_helper" | "save_file"
  >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("quotes_sales_active_tab");
      if (
        saved === "entry" ||
        saved === "monthly" ||
        saved === "analytics" ||
        saved === "audit_logs" ||
        saved === "rules" ||
        saved === "ip_checker" ||
        saved === "login_codes" ||
        saved === "asitis_causality" ||
        saved === "eui_causality" ||
        saved === "copy_helper" ||
        saved === "save_file"
      ) {
        return saved as
          | "entry"
          | "monthly"
          | "analytics"
          | "audit_logs"
          | "rules"
          | "ip_checker"
          | "login_codes"
          | "asitis_causality"
          | "eui_causality"
          | "copy_helper"
          | "save_file";
      }
    }
    return "entry";
  });

  const [activeChutiTab, setActiveChutiTab] = useState<
    "add_leave" | "leave_history" | "govt_responses" | "settlement" | "leave_settings" | "team_leaves"
  >(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("adminActiveTab");
      if (
        saved === "add_leave" ||
        saved === "leave_history" ||
        saved === "govt_responses" ||
        saved === "settlement" ||
        saved === "leave_settings" ||
        saved === "team_leaves"
      ) {
        return saved as "add_leave" | "leave_history" | "govt_responses" | "settlement" | "leave_settings" | "team_leaves";
      }
    }
    return "add_leave";
  });

  const handleQuotesTabChange = (
    tab: "entry" | "monthly" | "analytics" | "audit_logs" | "rules" | "ip_checker" | "login_codes" | "asitis_causality" | "eui_causality" | "copy_helper" | "save_file",
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
    tab: "add_leave" | "leave_history" | "govt_responses" | "settlement" | "leave_settings" | "team_leaves",
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
  const [profilesList, setProfilesList] = useState<Profile[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const onlineHandler = () => setIsOnline(true);
      const offlineHandler = () => setIsOnline(false);
      window.addEventListener("online", onlineHandler);
      window.addEventListener("offline", offlineHandler);

      // Handle Cmd+R, Ctrl+R, F5 reload in Tauri and browser
      const handleReloadShortcut = (e: KeyboardEvent) => {
        if (
          (e.key === "r" && (e.metaKey || e.ctrlKey)) ||
          e.key === "F5"
        ) {
          e.preventDefault();
          window.location.reload();
        }
      };
      window.addEventListener("keydown", handleReloadShortcut);

      return () => {
        window.removeEventListener("online", onlineHandler);
        window.removeEventListener("offline", offlineHandler);
        window.removeEventListener("keydown", handleReloadShortcut);
      };
    }
  }, []);

  useEffect(() => {
    if (!sessionUser) return;

    const fetchProfiles = async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (data && !error) {
        const mappedData = data.map((p: any) => ({
          ...p,
          password_reset_status: p.password_reset_status || p.global_settings?.password_reset_status || 'none'
        }));
        setProfilesList(mappedData);
      }
    };

    const deferTimer = setTimeout(() => {
      fetchProfiles();
    }, 3000);

    // Call the database function to calculate and sync badges once on mount/login
    const triggerBadgeSync = async () => {
      try {
        const { error } = await supabase.rpc("sync_top_performer_badges");
        if (error) {
          console.error("Failed to sync top performer badges from DB:", error.message);
        } else {
          // Re-fetch profiles after sync to get the latest updated badge settings
          fetchProfiles();
        }
      } catch (err) {
        console.error("Error triggering top performer badges sync:", err);
      }
    };

    triggerBadgeSync();

    return () => {
      clearTimeout(deferTimer);
    };
  }, [sessionUser]);

  const [topPerformerBadges, setTopPerformerBadges] = useState<Record<string, any>>({});

  // Synchronize display badges directly from profilesList (database values) for all roles
  useEffect(() => {
    const loadedBadges: Record<string, any> = {};
    profilesList.forEach((p) => {
      if (p.global_settings?.top_performer_badge) {
        loadedBadges[p.id] = p.global_settings.top_performer_badge;
      }
    });
    setTopPerformerBadges(loadedBadges);
  }, [profilesList]);

  const [chutiOfflineCount, setChutiOfflineCount] = useState(0);

  const {
    unreadCount: globalUnreadCount,
    notificationsList: globalNotificationsList,
    showNotificationsModal,
    setShowNotificationsModal,
    handleSaveHolidayResponse,
    handleDismissNotification,
    handleDismissAllNotifications,
    approvalsCount: globalApprovalsCount,
  } = useGlobalNotifications(sessionUser, profile, profilesList);

  // Global Tauri Desktop Notification Listener (active on all tabs)
  useDesktopNotifications(profile?.id);

  // Background Web Push auto-subscription on load for browser users
  useEffect(() => {
    if (sessionUser && profile) {
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      if (isTauri) return;

      const autoSubscribe = async () => {
        try {
          const permission = Notification.permission;
          if (permission === 'granted' || permission === 'default') {
            const success = await subscribeUserToPush(sessionUser.id);
            if (success) {
              localStorage.setItem('push_subscribed_pref_' + sessionUser.id, 'true');
            }
          }
        } catch (err) {
          console.error('Failed to auto-subscribe user to push notifications:', err);
        }
      };

      const timer = setTimeout(autoSubscribe, 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionUser, profile]);

  useEffect(() => {
    const handleOfflineCountChange = (e: Event) => {
      setChutiOfflineCount((e as CustomEvent).detail || 0);
    };
    const handleOpenUserNotif = () => {
      setShowNotificationsModal(true);
    };
    window.addEventListener(
      "chuti-offline-count-change",
      handleOfflineCountChange,
    );
    window.addEventListener(
      "open-user-notifications-modal",
      handleOpenUserNotif,
    );
    return () => {
      window.removeEventListener(
        "chuti-offline-count-change",
        handleOfflineCountChange,
      );
      window.removeEventListener(
        "open-user-notifications-modal",
        handleOpenUserNotif,
      );
    };
  }, [setShowNotificationsModal]);

  useEffect(() => {
    if (activeTab !== "chuti" || (activeChutiTab !== "leave_history" && activeChutiTab !== "govt_responses" && activeChutiTab !== "settlement" && activeChutiTab !== "team_leaves")) return;

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
    if (activeTab !== "kpi" && activeTab !== null) {
      prevTabRef.current = activeTab;
      setPreviousTab(activeTab);
    }
  }, [activeTab]);

  // Backspace key event listener when in KPI tab to go back
  useEffect(() => {
    if (activeTab !== "kpi") return;

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
        setActiveTab(previousTab as any);
        localStorage.setItem("last_active_dashboard", previousTab);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, previousTab]);

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
        const errMsg = profileError.message || '';
        if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('jwt') || profileError.status === 401) {
          addLog("Auth token invalid or expired. Performing force logout...");
          localStorage.removeItem(cacheKey);
          await supabase.auth.signOut();
          return;
        }
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

      const userProfile = {
        ...profileData,
        password_reset_status: profileData.password_reset_status || profileData.global_settings?.password_reset_status || 'none'
      } as Profile;

      // Perform inactivity and concurrent session checks
      const isLoggedOut = await checkInactivity(userId);
      if (isLoggedOut) return;

      const isValidSession = await registerAndCheckSession(userId, userProfile, setProfile);
      if (!isValidSession) return;

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
        | "kpi"
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
        if (session) {
          setSessionUser(session.user);
          sessionUserRef.current = session.user;
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        addLog('onAuthStateChange: TOKEN_REFRESHED event received. Updating token only.');
        if (session) {
          setSessionUser(session.user);
          sessionUserRef.current = session.user;
        }
        return;
      }

      if (session) {
        const currentUserId = sessionUserRef.current?.id;
        if (currentUserId === session.user.id) {
          addLog("onAuthStateChange: Same user session already active. Skipping profile fetch.");
          setSessionUser(session.user);
          sessionUserRef.current = session.user;
          return;
        }

        setSessionUser(session.user);
        sessionUserRef.current = session.user;
        await loadUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        addLog("onAuthStateChange SIGNED_OUT, clearing profile and setting loading to false");
        setSessionUser(null);
        sessionUserRef.current = null;
        setProfile(null);
        setActiveTab(null);
        setLoading(false);
      } else {
        addLog(`onAuthStateChange transient event ${event} without session, skipping unmount`);
        if (loading) {
          setLoading(false);
        }
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
        | "analytics"
        | "profile_settings";
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

  useEffect(() => {
    const handleProfileUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setProfile(customEvent.detail);
      }
    };
    window.addEventListener("profile-updated", handleProfileUpdated);
    return () =>
      window.removeEventListener("profile-updated", handleProfileUpdated);
  }, []);

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
          <h1 className="text-2xl font-bold bg-linear-to-r from-purple-400 via-blue-400 to-purple-300 bg-clip-text text-transparent">
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
          <h1 className="text-2xl font-bold bg-linear-to-r from-purple-400 via-blue-400 to-purple-300 bg-clip-text text-transparent">
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
        onProfileSettingsClick={() => {
          setActiveTab("profile_settings");
          localStorage.setItem("last_active_dashboard", "profile_settings");
        }}
        onNotificationClick={() => {
          if (profile?.role === 'admin') {
            const mode = sessionStorage.getItem('adminNotificationMode') || 'user';
            if (mode === 'admin') {
              window.dispatchEvent(new CustomEvent('open-admin-approvals-modal'));
            } else {
              setShowNotificationsModal(true);
            }
          } else if (profile?.role === 'supervisor') {
            const mode = sessionStorage.getItem('supervisorNotificationMode') || 'user';
            if (mode === 'supervisor') {
              window.dispatchEvent(new CustomEvent('open-supervisor-approvals-modal'));
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
        notificationCount={globalUnreadCount}
        offlineCount={activeTab === 'chuti' ? chutiOfflineCount : 0}
      />

      {/* Portal Target for Modals */}
      <div id="root-modals-portal" className="relative z-50" />

      {/* Global Unified Notifications Modal */}
      {sessionUser && profile && (
        <UserNotificationsModal
          showUserNotificationsModal={showNotificationsModal}
          setShowUserNotificationsModal={setShowNotificationsModal}
          userNotificationsList={globalNotificationsList}
          profile={profile}
          onSaveHolidayResponse={handleSaveHolidayResponse}
          onDismiss={handleDismissNotification}
          onDismissAll={handleDismissAllNotifications}
          approvalsCount={globalApprovalsCount}
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
          onSwitchToSupervisorPanel={() => {
            sessionStorage.setItem('supervisorNotificationMode', 'supervisor');
            setShowNotificationsModal(false);
            window.dispatchEvent(new CustomEvent('open-supervisor-approvals-modal'));
          }}
        />
      )}

      {/* Main container with Sidebar and Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full z-10 flex-1 flex flex-col md:flex-row items-start">
        <div
          className={`shrink-0 ${
            (activeTab === "user_management" && isUserManagementFullView) || 
            (activeTab === "chuti" && (activeChutiTab === "leave_history" || activeChutiTab === "govt_responses" || activeChutiTab === "settlement" || activeChutiTab === "team_leaves")) ||
            (activeTab === "kpi")
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
                            : activeTab === "profile_settings"
                              ? "profile_settings"
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
                    activeChutiTab === "team_leaves" ? "leaves-table" :
                    "leaves-table"
                  } />
                ) : activeTab === "quotes" ? (
                  <QuotesSkeletonLoader type={
                    activeQuotesTab === "entry" ? "form" : 
                    activeQuotesTab === "asitis_causality" ? "asitis_causality" :
                    activeQuotesTab === "eui_causality" ? "asitis_causality" :
                    activeQuotesTab === "monthly" ? "table" : 
                    activeQuotesTab === "rules" ? "rules" : 
                    activeQuotesTab === "analytics" ? "analytics" : 
                    activeQuotesTab === "audit_logs" ? "audit-logs" : 
                    activeQuotesTab === "ip_checker" ? "ip_checker" :
                    activeQuotesTab === "login_codes" ? "login_codes" :
                    activeQuotesTab === "copy_helper" ? "copy_helper" :
                    activeQuotesTab === "save_file" ? "save_file" :
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
                ) : activeTab === "kpi" ? (
                  null
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
            {/* ChutiDashboard: always mounted to keep global event listeners (like open-profile-settings) and approval modals active on all tabs */}
            {profile && (
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
              <UserKpiPerformancePanel 
                viewingStaff={profile} 
                onBack={() => {
                  setActiveTab(previousTab as any);
                  localStorage.setItem("last_active_dashboard", previousTab);
                }}
              />
            )}
            {activeTab === "profile_settings" && profile && (
              <ProfileSettings
                profile={profile}
                setProfile={setProfile}
                sessionUser={sessionUser}
                onBack={() => {
                  setActiveTab(previousTab as any);
                  localStorage.setItem("last_active_dashboard", previousTab);
                }}
              />
            )}
          </Suspense>
        </section>
      </main>
    </div>
  );
}
