'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { Loader2 } from 'lucide-react';

export default function AppPortal() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuthAndAccess() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          router.replace('/login');
          return;
        }

        const userId = session.user.id;

        // Fetch user profile from the database
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError || !profileData) {
          console.error('Failed to fetch profile:', profileError);
          setErrorMsg('Profile settings not found. Please contact administrator.');
          return;
        }

        const profile = profileData as Profile;
        const hasChuti = !!profile.has_chuti_access;
        const hasQuotes = !!profile.has_quotes_access;

        if (!hasChuti && !hasQuotes) {
          setErrorMsg('You do not have access to any workspace. Please contact your manager.');
          return;
        }

        // Logic for redirecting based on access
        if (hasChuti && hasQuotes) {
          const lastActive = localStorage.getItem('last_active_dashboard');
          if (lastActive === 'quotes') {
            router.replace('/quotes');
          } else {
            router.replace('/chuti');
          }
        } else if (hasChuti) {
          router.replace('/chuti');
        } else {
          router.replace('/quotes');
        }
      } catch (err) {
        console.error('Workspace routing error:', err);
        setErrorMsg('Something went wrong while loading your workspace.');
      }
    }

    checkAuthAndAccess();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-radial from-slate-900 via-slate-950 to-black text-white p-4">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-700"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center">
          {errorMsg ? (
            <div className="space-y-4">
              <div className="h-16 w-16 bg-red-950/40 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner animate-bounce">
                ⚠️
              </div>
              <h2 className="text-xl font-semibold text-slate-100">Access Restricted</h2>
              <p className="text-sm text-slate-400 leading-relaxed px-2">{errorMsg}</p>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.replace('/login');
                }}
                className="mt-6 px-6 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-medium rounded-xl transition-all shadow-lg shadow-red-600/20 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Spinner */}
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
