'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { Loader2 } from 'lucide-react';
import LoginPage from '@/app/login/page';
import { lazy, Suspense } from 'react';
import { UnifiedSidebar } from '@/components/UnifiedSidebar';

const ChutiDashboard = lazy(() => import('@/app/chuti/page'));
const QuotesDashboard = lazy(() => import('@/app/quotes/page'));
const UserManagementDashboard = lazy(() => import('@/components/UserManagementDashboard').then(m => ({ default: m.UserManagementDashboard })));

export default function AppPortal() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chuti' | 'quotes' | 'user_management' | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const fetchingRef = useRef<string | null>(null);

  const [activeQuotesTab, setActiveQuotesTab] = useState<'entry' | 'monthly' | 'analytics' | 'audit_logs' | 'rules' | 'todo'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quotes_sales_active_tab');
      if (saved === 'entry' || saved === 'monthly' || saved === 'analytics' || saved === 'audit_logs' || saved === 'rules' || saved === 'todo') {
        return saved as 'entry' | 'monthly' | 'analytics' | 'audit_logs' | 'rules' | 'todo';
      }
    }
    return 'entry';
  });

  const [activeChutiTab, setActiveChutiTab] = useState<'staff_master' | 'govt_responses' | 'settlement'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('adminActiveTab');
      if (saved === 'staff_master' || saved === 'govt_responses' || saved === 'settlement') {
        return saved as 'staff_master' | 'govt_responses' | 'settlement';
      }
    }
    return 'staff_master';
  });

  const handleQuotesTabChange = (tab: 'entry' | 'monthly' | 'analytics' | 'audit_logs' | 'rules' | 'todo') => {
    setActiveQuotesTab(tab);
    localStorage.setItem('quotes_sales_active_tab', tab);
  };

  const handleChutiTabChange = (tab: 'staff_master' | 'govt_responses' | 'settlement') => {
    setActiveChutiTab(tab);
    sessionStorage.setItem('adminActiveTab', tab);
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleThemeToggle = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  };

  const addLog = (msg: string) => {
    console.log(`[AppPortal] ${msg}`);
    setLogLines(prev => [...prev, msg]);
  };

  useEffect(() => {
    addLog('AppPortal: Mounted');
    let active = true;

    // Listen for auth state changes to dynamically switch rendering between Login and App Dashboard
    // onAuthStateChange fires automatically on subscribe with the current session (if any).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      addLog(`onAuthStateChange event: ${event} (hasSession: ${!!session})`);
      if (!active) return;

      if (session) {
        setSessionUser(session.user);
        await loadUserProfile(session.user.id);
      } else {
        addLog('onAuthStateChange no session, setting loading to false');
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
  }, []);

  async function loadUserProfile(userId: string) {
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
      
      let lastActive = localStorage.getItem('last_active_dashboard') as 'chuti' | 'quotes' | 'user_management' | null;
      if (lastActive === 'chuti' && !hasChuti) lastActive = null;
      if (lastActive === 'quotes' && !hasQuotes) lastActive = null;
      if (lastActive === 'user_management' && !(cachedProfile.role === 'admin' || cachedProfile.role === 'supervisor')) lastActive = null;

      if (!lastActive) {
        lastActive = hasChuti ? 'chuti' : 'quotes';
        localStorage.setItem('last_active_dashboard', lastActive);
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
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database query timed out')), 5000)
      );

      addLog('Background query to profiles table started...');
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Promise.race might return the result of the fetchPromise directly
      const { data: profileData, error: profileError } = result as { data: any; error: any };
      addLog(`Background query completed (hasProfileData: ${!!profileData})`);

      if (profileError) {
        addLog(`Query error: ${profileError.message}`);
        if (!cachedProfile) {
          setErrorMsg('Profile settings not found. Please contact administrator.');
          setLoading(false);
        }
        return;
      }

      if (!profileData) {
        addLog('No profile record returned');
        if (!cachedProfile) {
          setErrorMsg('Profile settings not found. Please contact administrator.');
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
        setErrorMsg('You do not have access to any workspace. Please contact your manager.');
        setLoading(false);
        return;
      }

      // Choose active workspace tab
      let lastActive = localStorage.getItem('last_active_dashboard') as 'chuti' | 'quotes' | 'user_management' | null;
      if (lastActive === 'chuti' && !hasChuti) lastActive = null;
      if (lastActive === 'quotes' && !hasQuotes) lastActive = null;
      if (lastActive === 'user_management' && !(userProfile.role === 'admin' || userProfile.role === 'supervisor')) lastActive = null;

      if (!lastActive) {
        lastActive = hasChuti ? 'chuti' : 'quotes';
        localStorage.setItem('last_active_dashboard', lastActive);
      }

      setActiveTab(lastActive);
      setErrorMsg(null);
      setLoading(false);
    } catch (err: any) {
      addLog(`Background fetch error: ${err?.message || err}`);
      if (!cachedProfile) {
        setErrorMsg('Error loading profile settings.');
        setLoading(false);
      }
    } finally {
      if (fetchingRef.current === userId) {
        fetchingRef.current = null;
      }
    }
  }

  // Listen for custom workspace-change event dispatched by sidebar
  useEffect(() => {
    const handleWorkspaceChange = (e: Event) => {
      const targetWorkspace = (e as CustomEvent).detail as 'chuti' | 'quotes' | 'user_management';
      addLog(`custom workspace-change event detected: ${targetWorkspace}`);
      
      // Safety check: ensure user has access before switching
      if (profile) {
        if (targetWorkspace === 'chuti' && !profile.has_chuti_access) return;
        if (targetWorkspace === 'quotes' && !profile.has_quotes_access) return;
        if (targetWorkspace === 'user_management' && !(profile.role === 'admin' || profile.role === 'supervisor')) return;
      }
      
      setActiveTab(targetWorkspace);
    };

    window.addEventListener('workspace-change', handleWorkspaceChange);
    return () => window.removeEventListener('workspace-change', handleWorkspaceChange);
  }, [profile]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-white p-4">
        {/* Background ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-700"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center">
            <div className="space-y-6 w-full">
              <div className="relative flex items-center justify-center">
                <div className="h-20 w-20 border-2 border-purple-500/20 rounded-full absolute"></div>
                <Loader2 className="h-12 w-12 text-purple-400 animate-spin" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
                  QC Manager
                </h1>
                <p className="text-sm text-slate-400 tracking-wide animate-pulse">
                  Configuring your workspaces...
                </p>
              </div>
              
              {/* Dynamic logs display */}
              <div className="text-[10px] text-slate-400 font-mono text-left max-h-48 overflow-y-auto mt-4 space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-850/80 w-full select-text">
                <div className="text-slate-500 font-bold border-b border-slate-800/50 pb-1 mb-1 uppercase tracking-wider">System Logs</div>
                {logLines.map((line, i) => (
                  <div key={i} className="break-all">{`> ${line}`}</div>
                ))}
              </div>
            </div>
          </div>
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
              <h2 className="text-xl font-semibold text-slate-100">Access Restricted</h2>
              <p className="text-sm text-slate-400 leading-relaxed px-2">{errorMsg}</p>
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
    console.log('[AppPortal] Rendering LoginPage');
    return <LoginPage />;
  }

  // Authenticated -> Render single layout shell wrapping active workspace component
  return (
    <div className="flex-1 min-h-screen flex flex-col bg-slate-955 relative overflow-hidden pb-12 text-white selection:bg-purple-650 selection:text-white">
      {/* Glow background blobs */}
      <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

      {/* Portal Target for Navbar */}
      <div id="root-navbar-portal" className="w-full relative z-30" />

      {/* Portal Target for Modals */}
      <div id="root-modals-portal" className="relative z-50" />

      {/* Main container with Sidebar and Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full z-10 flex-1 flex flex-col md:flex-row gap-6 items-start">
        <UnifiedSidebar
          activeSection={activeTab === 'user_management' ? 'user_management' : activeTab === 'quotes' ? 'quotes' : 'chuti'}
          profile={profile}
          activeQuotesTab={activeQuotesTab}
          onQuotesTabChange={handleQuotesTabChange}
          activeChutiTab={activeChutiTab}
          onChutiTabChange={handleChutiTabChange}
          isSidebarCollapsed={isSidebarCollapsed}
          onSidebarToggle={handleSidebarToggle}
        />

        <section className="flex-1 min-w-0 w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl min-h-125">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-400">Loading workspace...</p>
            </div>
          }>
            {activeTab === 'quotes' && (
              <QuotesDashboard
                activeTab={activeQuotesTab}
                onTabChange={handleQuotesTabChange}
              />
            )}
            {activeTab === 'chuti' && (
              <ChutiDashboard
                activeChutiTab={activeChutiTab}
                onChutiTabChange={handleChutiTabChange}
              />
            )}
            {activeTab === 'user_management' && (
              <UserManagementDashboard
                sessionUser={sessionUser}
                profile={profile}
                onLogout={handleLogout}
                theme={theme}
                onThemeToggle={handleThemeToggle}
                isSidebarCollapsed={isSidebarCollapsed}
                onSidebarToggle={handleSidebarToggle}
              />
            )}
          </Suspense>
        </section>
      </main>
    </div>
  );
}
