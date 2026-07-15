"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { supabase } from "@/utils/supabase";
import { Profile } from "@/types";
import { mapProfilePasswordResetStatus } from "@/utils/profileHelpers";
import { canAccessModule } from "@/utils/permissionService";
import {
  Loader2,
  Clock,
  Coffee,
  Sun,
  Moon,
  Bell,
  Download,
  LogOut,
  Monitor,
  Apple,
  RefreshCw,
} from "lucide-react";
import SmartDownloadButton from "@/components/common/SmartDownloadButton";
import { isNativeApp } from "@/utils/envHelper";
import LoginPage from "@/app/login/page";
import { UnifiedSidebar } from "@/components/common/UnifiedSidebar";
import { Navbar } from "@/components/common/Navbar";
import { AppLayout } from "@/components/common/AppLayout";
import { SafeAreaTop } from "@/components/common/SafeAreaTop";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Toaster } from "react-hot-toast";
import { useGlobalNotifications } from "@/hooks/leave-tracker/useGlobalNotifications";
import { UserNotificationsModal } from "@/components/common/modals/UserNotificationsModal";
import { MandatoryGovtHolidayModal } from "@/components/common/modals/MandatoryGovtHolidayModal";
import { SkeletonLoader } from "@/components/common/SkeletonLoader";
import { SkeletonLoader as QuotesSkeletonLoader } from "@/components/quotes-tracker/QuotesSkeletonLoader";
import {
  checkInactivity,
  registerAndCheckSession,
} from "@/utils/sessionHelper";
import {
  RealtimeProvider,
  useRealtimeHandler,
} from "@/contexts/RealtimeContext";

import { UserKpiPerformancePanel } from "@/components/common/user-management/UserKpiPerformancePanel";
import ChutiDashboard from "@/app/chuti/page";
import QuotesDashboard from "@/app/quotes/page";
import { UserManagementDashboard } from "@/components/common/UserManagementDashboard";
import { TodoPanel } from "@/components/common/TodoPanel";
import { ProfileSettings } from "@/components/common/ProfileSettings";

function getInitialState() {
  if (typeof window === "undefined") {
    return { sessionUser: null, profile: null, initialTab: null };
  }
  try {
    let authUser: any = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          authUser = parsed?.user || parsed?.currentSession?.user;
          break;
        }
      }
    }
    if (!authUser)
      return { sessionUser: null, profile: null, initialTab: null };

    const cacheKey = `cached_profile_${authUser.id}`;
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      const cachedProfile = JSON.parse(cachedStr);

      let lastActive = localStorage.getItem("last_active_dashboard") as any;
      if (lastActive && !canAccessModule(cachedProfile, null, lastActive)) {
        lastActive = null;
      }
      if (!lastActive) {
        lastActive = canAccessModule(cachedProfile, null, "leave")
          ? "chuti"
          : "quotes";
      }
      return {
        sessionUser: authUser,
        profile: cachedProfile,
        initialTab: lastActive,
      };
    }
    return { sessionUser: authUser, profile: null, initialTab: null };
  } catch (e) {
    console.error("Error loading initial synchronous state:", e);
    return { sessionUser: null, profile: null, initialTab: null };
  }
}

// Cache the initial state so we don't parse localStorage JSON 5 times during mount
const _cachedInitialState =
  typeof window !== "undefined" ? getInitialState() : null;

export default function AppPortal() {
  const [mounted, setMounted] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(
    () => _cachedInitialState?.sessionUser ?? null,
  );
  const [profile, setProfile] = useState<Profile | null>(
    () => _cachedInitialState?.profile ?? null,
  );
  const [loading, setLoading] = useState(
    () => !_cachedInitialState?.sessionUser || !_cachedInitialState?.profile,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProfileFresh, setIsProfileFresh] = useState(false);
  const fetchingRef = useRef<string | null>(null);
  const sessionUserRef = useRef<any>(null);

  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      addLog(`[SWR] Restored cache. Hiding spinner.`);
      setErrorMsg(null);
      setLoading(false);
    }

    // Fetch fresh profile in the background
    fetchingRef.current = userId;
    try {
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

      const { data: profileData, error: profileError } = result as {
        data: any;
        error: any;
      };
      addLog(`Background query completed (hasProfileData: ${!!profileData})`);

      if (profileError) {
        addLog(`Query error: ${profileError.message}`);
        const errMsg = profileError.message || "";
        if (
          errMsg.toLowerCase().includes("token") ||
          errMsg.toLowerCase().includes("jwt") ||
          profileError.status === 401
        ) {
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

      const userProfile = mapProfilePasswordResetStatus(profileData) as Profile;

      const isLoggedOut = await checkInactivity(userId);
      if (isLoggedOut) return;

      const isValidSession = await registerAndCheckSession(
        userId,
        userProfile,
        setProfile,
      );
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

      setErrorMsg(null);
      setLoading(false);
    } catch (err: any) {
      addLog(`Background fetch error: ${err?.message || err}`);
      if (!cachedProfile) {
        setErrorMsg("Error loading profile settings.");
        setLoading(false);
      }
    } finally {
      setIsProfileFresh(true);
      if (fetchingRef.current === userId) {
        fetchingRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    addLog("AppPortal: Mounted");
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`onAuthStateChange event: ${event} (hasSession: ${!!session})`);
      if (!active) return;

      if (event === "USER_UPDATED") {
        addLog(
          "onAuthStateChange: USER_UPDATED skipped (password change, no reload needed)",
        );
        if (session) {
          setSessionUser(session.user);
          sessionUserRef.current = session.user;
        }
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        addLog(
          "onAuthStateChange: TOKEN_REFRESHED event received. Updating token only.",
        );
        if (session) {
          setSessionUser(session.user);
          sessionUserRef.current = session.user;
        }
        return;
      }

      if (session) {
        const currentUserId = sessionUserRef.current?.id;
        if (currentUserId === session.user.id) {
          addLog(
            "onAuthStateChange: Same user session already active. Skipping profile fetch.",
          );
          setSessionUser(session.user);
          sessionUserRef.current = session.user;
          return;
        }

        setSessionUser(session.user);
        sessionUserRef.current = session.user;
        await loadUserProfile(session.user.id);
      } else if (event === "SIGNED_OUT") {
        addLog(
          "onAuthStateChange SIGNED_OUT, clearing profile and setting loading to false",
        );
        setSessionUser(null);
        sessionUserRef.current = null;
        setProfile(null);
        setIsProfileFresh(false);
        setLoading(false);
      } else {
        addLog(
          `onAuthStateChange transient event ${event} without session, skipping unmount`,
        );
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

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  if (!mounted) {
    return <div className="min-h-screen bg-theme-page-bg" />;
  }

  if (loading && !sessionUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-radial from-theme-card-bg via-theme-card-container to-black text-theme-text-primary p-4">
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
          <p className="text-sm text-theme-text-muted tracking-wide animate-pulse">
            Configuring your workspaces...
          </p>
        </div>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-radial from-theme-card-bg via-theme-card-container to-black text-theme-text-primary p-4">
        <div className="w-full max-w-md relative z-10">
          <div className="bg-theme-card-bg/60 backdrop-blur-xl border border-theme-border-input/80 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center">
            <div className="space-y-4">
              <div className="h-16 w-16 bg-red-950/40 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner animate-bounce">
                ⚠️
              </div>
              <h2 className="text-xl font-semibold text-theme-text-primary">
                Access Restricted
              </h2>
              <p className="text-sm text-theme-text-muted leading-relaxed px-2">
                {errorMsg}
              </p>
              <button
                onClick={handleLogout}
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

  if (!sessionUser) {
    return <LoginPage />;
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-radial from-theme-card-bg via-theme-card-container to-black text-theme-text-primary p-4">
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
          <p className="text-sm text-theme-text-muted tracking-wide animate-pulse">
            Configuring your workspaces...
          </p>
        </div>
      </main>
    );
  }

  return (
    <RealtimeProvider sessionUser={sessionUser} profile={profile}>
      <AppPortalInner
        sessionUser={sessionUser}
        profile={profile}
        setProfile={setProfile}
        handleLogout={handleLogout}
        isProfileFresh={isProfileFresh}
      />
    </RealtimeProvider>
  );
}

function AppPortalInner({
  sessionUser,
  profile,
  setProfile,
  handleLogout,
  isProfileFresh,
}: {
  sessionUser: any;
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  handleLogout: () => Promise<void>;
  isProfileFresh: boolean;
}) {
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
  >(() => {
    if (typeof window !== "undefined") {
      const cached = _cachedInitialState?.initialTab;
      if (cached) return cached as any;
    }
    return "chuti";
  });

  const activeTabRef = useRef<string>(activeTab || "chuti");
  const [previousTab, setPreviousTab] = useState<string>("chuti");
  const prevTabRef = useRef<string>("chuti");

  useEffect(() => {
    activeTabRef.current = activeTab || "chuti";
  }, [activeTab]);

  const [activeQuotesTab, setActiveQuotesTab] = useState<
    | "entry"
    | "monthly"
    | "analytics"
    | "audit_logs"
    | "rules"
    | "ip_checker"
    | "login_codes"
    | "causality"
    | "copy_helper"
    | "save_file"
  >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("quotes_sales_active_tab");
      if (
        saved === "asitis_causality" ||
        saved === "eui_causality" ||
        saved === "causality"
      ) {
        return "causality";
      }
      if (
        saved === "entry" ||
        saved === "monthly" ||
        saved === "analytics" ||
        saved === "audit_logs" ||
        saved === "rules" ||
        saved === "ip_checker" ||
        saved === "login_codes" ||
        saved === "copy_helper" ||
        saved === "save_file"
      ) {
        return saved;
      }
    }
    return "entry";
  });

  const [activeChutiTab, setActiveChutiTab] = useState<
    | "add_leave"
    | "leave_history"
    | "govt_responses"
    | "settlement"
    | "leave_settings"
    | "team_leaves"
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
        return saved as any;
      }
    }
    return "add_leave";
  });

  const handleQuotesTabChange = (
    tab:
      | "entry"
      | "monthly"
      | "analytics"
      | "audit_logs"
      | "rules"
      | "ip_checker"
      | "login_codes"
      | "causality"
      | "copy_helper"
      | "save_file",
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
    tab:
      | "add_leave"
      | "leave_history"
      | "govt_responses"
      | "settlement"
      | "leave_settings"
      | "team_leaves",
  ) => {
    setActiveChutiTab(tab);
    sessionStorage.setItem("adminActiveTab", tab);
  };

  const [isUserManagementFullView, setIsUserManagementFullView] =
    useState(false);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  // Swipe to Refresh gesture for native app
  useEffect(() => {
    if (!isNativeApp()) return;

    let startY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshing) {
        startY = e.touches[0].pageY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      const currentY = e.touches[0].pageY;
      const diff = currentY - startY;

      if (diff > 0) {
        // Apply resistance
        const dist = Math.min(100, diff * 0.4);
        setPullDistance(dist);
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling) return;
      isPulling = false;

      if (pullDistance >= 60) {
        setIsRefreshing(true);
        setPullDistance(50);
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  // Capacitor Back Button exit app confirmation dialog
  useEffect(() => {
    if (!isNativeApp()) return;

    let backListenerPromise: any = null;

    import("@capacitor/app").then(({ App }) => {
      backListenerPromise = App.addListener("backButton", () => {
        if (isMobileDrawerOpen) {
          setIsMobileDrawerOpen(false);
        } else {
          setIsExitModalOpen(true);
        }
      });
    });

    return () => {
      if (backListenerPromise) {
        backListenerPromise.then((l: any) => l.remove());
      }
    };
  }, [isMobileDrawerOpen]);

  const handleExitApp = async () => {
    try {
      const { App } = await import("@capacitor/app");
      await App.exitApp();
    } catch (e) {
      console.error("Failed to exit app:", e);
      setIsExitModalOpen(false);
    }
  };

  useEffect(() => {
    setIsNative(isNativeApp());
  }, []);

  const formatWorkingHours = (hours: number | string) => {
    const h = parseFloat(String(hours));
    if (isNaN(h)) return "9 hours 30 mins";
    const wholeHours = Math.floor(h);
    const fraction = h - wholeHours;
    if (fraction === 0.5) {
      return `${wholeHours} hours 30 mins`;
    }
    return `${wholeHours} hours`;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === "r" && (e.metaKey || e.ctrlKey)) || e.key === "F5") {
          e.preventDefault();
          window.location.reload();
        } else if (e.key === "Escape") {
          setIsMobileDrawerOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, []);

  useEffect(() => {
    if (!sessionUser) return;

    let deferTimer: NodeJS.Timeout | null = null;

    const fetchProfiles = async () => {
      if (deferTimer) {
        clearTimeout(deferTimer);
        deferTimer = null;
      }
      const { data, error } = await supabase.from("profiles").select("*");
      if (data && !error) {
        const mappedData = data.map((p: any) =>
          mapProfilePasswordResetStatus(p),
        );
        setProfilesList(mappedData);
      }
    };

    deferTimer = setTimeout(() => {
      fetchProfiles();
    }, 3000);

    const triggerBadgeSync = async () => {
      try {
        const { error } = await supabase.rpc("sync_top_performer_badges");
        if (error) {
          console.error(
            "Failed to sync top performer badges from DB:",
            error.message,
          );
          fetchProfiles();
        } else {
          fetchProfiles();
        }
      } catch (err) {
        console.error("Error triggering top performer badges sync:", err);
        fetchProfiles();
      }
    };

    triggerBadgeSync();

    return () => {
      if (deferTimer) {
        clearTimeout(deferTimer);
      }
    };
  }, [sessionUser]);

  const [topPerformerBadges, setTopPerformerBadges] = useState<
    Record<string, any>
  >({});

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

  const [sharedChutiData, setSharedChutiData] = useState<{
    userRecords: any[];
    holidayResponses: any[];
    initialFetchDone: boolean;
  }>({
    userRecords: [],
    holidayResponses: [],
    initialFetchDone: false,
  });

  const handleChutiDataReady = useCallback(
    (data: {
      userRecords: any[];
      holidayResponses: any[];
      initialFetchDone?: boolean;
    }) => {
      setSharedChutiData({
        userRecords: data.userRecords,
        holidayResponses: data.holidayResponses,
        initialFetchDone: !!data.initialFetchDone,
      });
    },
    [],
  );

  const {
    unreadCount: globalUnreadCount,
    notificationsList: globalNotificationsList,
    showNotificationsModal,
    setShowNotificationsModal,
    handleSaveHolidayResponse,
    handleDismissNotification,
    handleDismissAllNotifications,
    approvalsCount: globalApprovalsCount,
    pendingHolidays,
    isInitialNotifFetchDone,
  } = useGlobalNotifications(
    sessionUser,
    profile,
    profilesList,
    sharedChutiData.userRecords,
    sharedChutiData.holidayResponses,
    sharedChutiData.initialFetchDone,
    isProfileFresh,
  );

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
    if (
      activeTab !== "chuti" ||
      (activeChutiTab !== "leave_history" &&
        activeChutiTab !== "govt_responses" &&
        activeChutiTab !== "settlement" &&
        activeChutiTab !== "team_leaves")
    )
      return;

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
        handleChutiTabChange("add_leave");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, activeChutiTab]);

  useEffect(() => {
    if (activeTab && activeTab !== "kpi" && activeTab !== "profile_settings") {
      setPreviousTab(activeTab);
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "kpi") return;

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

      if (isNativeApp()) {
        try {
          StatusBar.setOverlaysWebView({ overlay: false });
          StatusBar.setBackgroundColor({
            color: theme === "dark" ? "#0f172a" : "#ffffff",
          });
          StatusBar.setStyle({
            style: theme === "dark" ? Style.Dark : Style.Light,
          });
        } catch (e) {
          console.error("Capacitor StatusBar dynamic theme sync failed:", e);
        }
      }
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

  useEffect(() => {
    const handleWorkspaceChange = (e: Event) => {
      const targetWorkspace = (e as CustomEvent).detail as any;

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("viewingStaffFromUserManagement");
        sessionStorage.removeItem("viewingStaffId");
        window.dispatchEvent(
          new CustomEvent("trigger-viewing-staff", { detail: null }),
        );
      }

      if (profile) {
        const checkModule =
          targetWorkspace === "chuti" ? "leave" : targetWorkspace;
        if (!canAccessModule(profile, null, checkModule)) return;
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
  }, [setProfile]);

  // Register realtime handler inside AppPortalInner under RealtimeProvider
  useRealtimeHandler(
    "profiles",
    useCallback(
      (payload) => {
        if (payload.eventType === "UPDATE") {
          if (payload.new.id === sessionUser.id) {
            const updatedProfile = mapProfilePasswordResetStatus(
              payload.new,
            ) as unknown as Profile;
            setProfile(updatedProfile);
            localStorage.setItem(
              `cached_profile_${sessionUser.id}`,
              JSON.stringify(updatedProfile),
            );
          }
          setProfilesList((prev) =>
            prev.map((p) =>
              p.id === payload.new.id
                ? (mapProfilePasswordResetStatus(
                    payload.new,
                  ) as unknown as Profile)
                : p,
            ),
          );
        }
      },
      [sessionUser.id, setProfile, setProfilesList],
    ),
  );

  const sidebarActiveSection =
    typeof window !== "undefined" &&
    sessionStorage.getItem("viewingStaffFromUserManagement") === "true"
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
                    : "chuti";

  return (
    <AppLayout>
      <Toaster
        position="top-right"
        reverseOrder={false}
        containerStyle={{ zIndex: 99999 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0f172a",
            color: "#f1f5f9",
            border: "1px solid #1e293b",
            borderRadius: "12px",
            fontSize: "13px",
            padding: "12px 16px",
            boxShadow:
              "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "#0f172a" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#0f172a" },
          },
        }}
      />
      {/* Glow background blobs */}
      <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Shared Unified Navbar */}
      <Navbar
        profile={profile}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onLogout={handleLogout}
        badges={topPerformerBadges}
        onMenuToggle={() => setIsMobileDrawerOpen(true)}
        onNotificationClick={() => {
          if (profile?.role === "admin") {
            const mode =
              sessionStorage.getItem("adminNotificationMode") || "user";
            if (mode === "admin") {
              window.dispatchEvent(
                new CustomEvent("open-admin-approvals-modal"),
              );
            } else {
              setShowNotificationsModal(true);
            }
          } else if (profile?.role === "supervisor") {
            const mode =
              sessionStorage.getItem("supervisorNotificationMode") || "user";
            if (mode === "supervisor") {
              window.dispatchEvent(
                new CustomEvent("open-supervisor-approvals-modal"),
              );
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
        offlineCount={activeTab === "chuti" ? chutiOfflineCount : 0}
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
            window.dispatchEvent(
              new CustomEvent("open-revision-modal", { detail: record }),
            );
          }}
          onApproveChutiRequest={(id, approve) => {
            window.dispatchEvent(
              new CustomEvent("approve-chuti-request", {
                detail: { id, approve },
              }),
            );
          }}
          onApproveReserveAdjustment={(record, approve) => {
            window.dispatchEvent(
              new CustomEvent("approve-reserve-adjustment", {
                detail: { record, approve },
              }),
            );
          }}
          onApproveProfileChangeRequest={(id, approve) => {
            window.dispatchEvent(
              new CustomEvent("approve-profile-change", {
                detail: { id, approve },
              }),
            );
          }}
          onApprovePasswordResetRequest={(id, approve) => {
            window.dispatchEvent(
              new CustomEvent("approve-password-reset", {
                detail: { id, approve },
              }),
            );
          }}
          onSupervisorApproveChuti={(id, approve) => {
            window.dispatchEvent(
              new CustomEvent("supervisor-approve-chuti", {
                detail: { id, approve },
              }),
            );
          }}
          onSwitchToAdminPanel={() => {
            sessionStorage.setItem("adminNotificationMode", "admin");
            setShowNotificationsModal(false);
            window.dispatchEvent(new CustomEvent("open-admin-approvals-modal"));
          }}
          onSwitchToSupervisorPanel={() => {
            sessionStorage.setItem("supervisorNotificationMode", "supervisor");
            setShowNotificationsModal(false);
            window.dispatchEvent(
              new CustomEvent("open-supervisor-approvals-modal"),
            );
          }}
        />
      )}

      {/* Mobile Sidebar Navigation Drawer Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isMobileDrawerOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileDrawerOpen(false)}
      />

      {/* Mobile Sidebar Navigation Drawer Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-theme-page-bg border-r border-theme-border-input/50 px-4 pb-4 pt-3 shadow-2xl transition-transform duration-300 ease-out flex flex-col md:hidden ${
          isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SafeAreaTop />
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-theme-border-input/30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-wider text-theme-text-primary">
              QC Manager
            </span>
            {/* Quick Toggle Actions next to Title */}
            <div className="flex items-center gap-1.5">
              {/* Theme Toggle Icon Only */}
              <button
                onClick={handleThemeToggle}
                type="button"
                className="p-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg transition-all flex items-center justify-center cursor-pointer"
                title={
                  theme === "dark"
                    ? "Switch to Light Mode"
                    : "Switch to Dark Mode"
                }
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-purple-500" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-400" />
                )}
              </button>

              {/* Notification Bell Icon Only */}
              {profile && (
                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    if (profile.role === "admin") {
                      const mode =
                        sessionStorage.getItem("adminNotificationMode") ||
                        "user";
                      if (mode === "admin") {
                        window.dispatchEvent(
                          new CustomEvent("open-admin-approvals-modal"),
                        );
                      } else {
                        setShowNotificationsModal(true);
                      }
                    } else if (profile.role === "supervisor") {
                      const mode =
                        sessionStorage.getItem("supervisorNotificationMode") ||
                        "user";
                      if (mode === "supervisor") {
                        window.dispatchEvent(
                          new CustomEvent("open-supervisor-approvals-modal"),
                        );
                      } else {
                        setShowNotificationsModal(true);
                      }
                    } else {
                      setShowNotificationsModal(true);
                    }
                  }}
                  type="button"
                  className="relative p-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg transition-all flex items-center justify-center cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4 text-theme-text-secondary" />
                  {globalUnreadCount > 0 && (
                    <span className="absolute top-[-3px] right-[-3px] flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-red-500 animate-pulse">
                      <span className="text-[8px] font-sans font-bold text-white leading-none">
                        {globalUnreadCount}
                      </span>
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-label="Close menu"
            className="p-1.5 rounded-lg border border-theme-border-input/80 bg-theme-card-bg text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-border-active transition-all cursor-pointer"
          >
            <span className="text-lg font-bold leading-none">&times;</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col justify-between">
          <div className="flex-1">
            <UnifiedSidebar
              activeSection={sidebarActiveSection}
              profile={profile}
              activeQuotesTab={activeQuotesTab}
              onQuotesTabChange={handleQuotesTabChange}
              activeChutiTab={activeChutiTab}
              onChutiTabChange={handleChutiTabChange}
              isSidebarCollapsed={false}
              onSidebarToggle={() => {}}
              hideCollapseButton={true}
              onNavItemClick={() => setIsMobileDrawerOpen(false)}
            />
          </div>

          {/* Quick Actions & Settings Section */}
          <div className="border-t border-theme-border-input/30 pt-4 mt-6 flex flex-col gap-3.5 shrink-0">
            {profile && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-theme-card-bg/60 border border-theme-border-input/80 rounded-xl p-2.5 text-left shadow-sm flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-theme-text-muted flex items-center gap-1">
                    <Clock className="h-3 w-3 text-blue-400" /> Hours
                  </span>
                  <strong className="text-xs text-theme-text-primary">
                    {formatWorkingHours(profile.working_hours || 9.5)}
                  </strong>
                </div>
                <div className="bg-theme-card-bg/60 border border-theme-border-input/80 rounded-xl p-2.5 text-left shadow-sm flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-theme-text-muted flex items-center gap-1">
                    <Coffee className="h-3 w-3 text-purple-400" /> Break
                  </span>
                  <strong className="text-xs text-theme-text-primary">
                    {profile.break_time || 0} Mins
                  </strong>
                </div>
              </div>
            )}

            {/* Offline Sync Option inside Drawer */}
            {chutiOfflineCount > 0 && (
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("trigger-manual-sync"));
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl cursor-pointer transition-all shadow-lg shadow-purple-900/20 border border-purple-700"
              >
                <span className="text-xs font-semibold">Offline Items</span>
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs font-bold">{chutiOfflineCount}</span>
                </div>
              </button>
            )}

            {/* Download Desktop App (Only for Web Browser) */}
            {!isNative && (
              <div className="w-full flex justify-center py-2">
                <SmartDownloadButton />
              </div>
            )}

            {/* Logout button */}
            <button
              onClick={() => {
                setIsMobileDrawerOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-red-950/20 border border-red-900/50 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded-xl cursor-pointer transition-all"
            >
              <span className="text-xs font-semibold">Logout</span>
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main container with Sidebar and Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full z-10 flex-1 flex flex-col md:flex-row items-start">
        <div
          className={`shrink-0 hidden md:block ${
            (activeTab === "user_management" && isUserManagementFullView) ||
            (activeTab === "chuti" &&
              (activeChutiTab === "leave_history" ||
                activeChutiTab === "govt_responses" ||
                activeChutiTab === "settlement" ||
                activeChutiTab === "team_leaves")) ||
            activeTab === "kpi"
              ? "md:w-0 md:h-0 md:opacity-0 md:pointer-events-none md:overflow-hidden md:mb-0 md:mr-0"
              : "md:w-auto md:opacity-100 md:mb-0 md:mr-6"
          }`}
        >
          <UnifiedSidebar
            activeSection={sidebarActiveSection}
            profile={profile}
            activeQuotesTab={activeQuotesTab}
            onQuotesTabChange={handleQuotesTabChange}
            activeChutiTab={activeChutiTab}
            onChutiTabChange={handleChutiTabChange}
            isSidebarCollapsed={isSidebarCollapsed}
            onSidebarToggle={handleSidebarToggle}
          />
        </div>

        <section className="flex-1 min-w-0 w-full bg-theme-card-bg/50 backdrop-blur-xl border border-theme-border-input/80 rounded-2xl p-6 shadow-xl min-h-125">
          <Suspense
            fallback={
              <div className="w-full">
                {activeTab === "chuti" ? (
                  activeChutiTab === "leave_history" ? null : (
                    <SkeletonLoader
                      variant={
                        activeChutiTab === "add_leave"
                          ? "chuti-form"
                          : activeChutiTab === "govt_responses"
                            ? "responses-table"
                            : activeChutiTab === "settlement"
                              ? "settlements-table"
                              : activeChutiTab === "leave_settings"
                                ? "leave-settings"
                                : activeChutiTab === "team_leaves"
                                  ? "leaves-table"
                                  : "leaves-table"
                      }
                    />
                  )
                ) : activeTab === "quotes" ? (
                  <QuotesSkeletonLoader
                    type={
                      activeQuotesTab === "entry"
                        ? "form"
                        : activeQuotesTab === "causality"
                          ? "causality"
                          : activeQuotesTab === "monthly"
                            ? "table"
                            : activeQuotesTab === "rules"
                              ? "rules"
                              : activeQuotesTab === "analytics"
                                ? "analytics"
                                : activeQuotesTab === "audit_logs"
                                  ? "audit-logs"
                                  : activeQuotesTab === "ip_checker"
                                    ? "ip_checker"
                                    : activeQuotesTab === "login_codes"
                                      ? "login_codes"
                                      : activeQuotesTab === "copy_helper"
                                        ? "copy_helper"
                                        : activeQuotesTab === "save_file"
                                          ? "save_file"
                                          : "generic"
                    }
                  />
                ) : activeTab === "user_management" ? (
                  <SkeletonLoader variant="staff-table" rows={8} />
                ) : activeTab === "todo" ? (
                  <SkeletonLoader variant="todo" />
                ) : activeTab === "analytics" ? (
                  <SkeletonLoader variant="analytics" />
                ) : activeTab === "audit_logs" ? (
                  <SkeletonLoader variant="audit-logs" />
                ) : activeTab === "kpi" ? (
                  <SkeletonLoader variant="kpi" />
                ) : activeTab === "profile_settings" ? (
                  <SkeletonLoader variant="profile-settings" />
                ) : (
                  <SkeletonLoader variant="table" />
                )}
              </div>
            }
          >
            {/* QuotesDashboard: always mounted to prevent duplicate query fetches on tab switches */}
            <div
              className={
                activeTab !== "quotes" &&
                activeTab !== "analytics" &&
                activeTab !== "audit_logs"
                  ? "hidden"
                  : undefined
              }
            >
              <QuotesDashboard
                activeTab={
                  activeTab === "quotes" ? activeQuotesTab : (activeTab as any)
                }
                onTabChange={handleQuotesTabChange}
              />
            </div>
            {/* ChutiDashboard: always mounted to keep global event listeners (like open-profile-settings) and approval modals active on all tabs */}
            <div className={activeTab !== "chuti" ? "hidden" : undefined}>
              <ChutiDashboard
                activeChutiTab={activeChutiTab}
                onChutiTabChange={handleChutiTabChange}
                onDataReady={handleChutiDataReady}
              />
            </div>
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
            {activeTab === "todo" && <TodoPanel profile={profile} />}
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
      {sessionUser &&
        profile &&
        isProfileFresh &&
        isInitialNotifFetchDone &&
        profile.eligible_govt_holiday !== false &&
        profile.allow_reserve !== false &&
        pendingHolidays &&
        pendingHolidays.length > 0 && (
          <MandatoryGovtHolidayModal
            isOpen={true}
            holiday={pendingHolidays[0]}
            onSaveHolidayResponse={handleSaveHolidayResponse}
          />
        )}

      {/* Pull to Refresh Spinner Overlay */}
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-9999 flex justify-center pointer-events-none transition-all duration-75"
          style={{ transform: `translateY(${pullDistance}px)` }}
        >
          <div className="bg-theme-card-bg border border-theme-border-input p-2.5 rounded-full shadow-2xl flex items-center justify-center">
            <RefreshCw
              className={`w-4 h-4 text-blue-500 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </div>
        </div>
      )}

      {/* Exit App Confirmation Modal */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-theme-card-bg border border-theme-border-input/70 rounded-2xl max-w-sm w-full mx-4 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-theme-text-primary">
              Exit Application
            </h3>
            <p className="text-xs text-theme-text-muted mt-2 leading-relaxed">
              Are you sure you want to exit the QC Manager application?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsExitModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-theme-border-input hover:bg-theme-border-active text-theme-text-primary text-xs font-semibold rounded-xl transition-all cursor-pointer border border-theme-border-input"
              >
                Cancel
              </button>
              <button
                onClick={handleExitApp}
                className="flex-1 py-2.5 px-4 bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-lg shadow-orange-500/20"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
