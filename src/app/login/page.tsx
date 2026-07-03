"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase";
import {
  Lock,
  Mail,
  AlertCircle,
  Loader,
  Eye,
  EyeOff,
  Monitor,
  Apple,
} from "lucide-react";
import { getApiUrl, isTauriApp } from "@/utils/apiUrlHelper";
import { useAppReleaseLinks } from "@/hooks/useAppReleaseLinks";
import { Modal } from "@/components/Modal";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const links = useAppReleaseLinks();
  const isDesktop = isTauriApp();

  // Forgot password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) {
      setForgotError("Please enter your username (codename)");
      return;
    }

    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess(false);

    try {
      const res = await fetch(getApiUrl("/api/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });

      if (res.ok) {
        setForgotSuccess(true);
        setForgotUsername("");
      } else {
        const errData = await res.json().catch(() => ({}));
        setForgotError(
          errData.error || "Failed to submit password reset request",
        );
      }
    } catch {
      setForgotError("Network error submitting request");
    } finally {
      setForgotLoading(false);
    }
  };

  // Load theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Redirect to root / if on explicit /login path (as login is unified at root /)
  useEffect(() => {
    if (pathname === "/login") {
      router.replace("/");
    }
  }, [pathname, router]);

  // Redirect if already logged in
  useEffect(() => {
    const checkUser = async () => {
      try {
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(
            () => reject(new Error("Supabase session fetch timed out")),
            4000,
          ),
        );
        const { data, error: sessionError } = await Promise.race([
          getSessionPromise,
          timeoutPromise,
        ]);
        if (sessionError) throw sessionError;

        const session = data?.session;

        if (session) {
          const userId = session.user.id;
          const now = Date.now();
          const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
          const sessionStart = localStorage.getItem(
            `session_start_time_${userId}`,
          );
          const lastAccess = localStorage.getItem(`last_access_time_${userId}`);

          if (sessionStart || lastAccess) {
            const startAge = sessionStart
              ? now - parseInt(sessionStart, 10)
              : 0;
            const accessAge = lastAccess ? now - parseInt(lastAccess, 10) : 0;

            if (startAge > oneWeekMs || accessAge > oneWeekMs) {
              localStorage.removeItem(`session_start_time_${userId}`);
              localStorage.removeItem(`last_access_time_${userId}`);
              try {
                await supabase.auth.signOut();
              } catch (e) {
                console.error("Error signing out expired session:", e);
              }
              return;
            }
          }
          router.push("/");
        }
      } catch (err) {
        console.error("Error during checkUser session check:", err);
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Try resolving username/codename to registered email first
    let loginEmail = email.trim();
    if (!loginEmail.includes("@")) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds timeout

      let resolvedEmail = null;
      try {
        const res = await fetch(getApiUrl("/api/resolve-email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: loginEmail }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          resolvedEmail = data.email;
        }
      } catch {
        clearTimeout(timeoutId);
      }

      if (resolvedEmail) {
        loginEmail = resolvedEmail;
      } else {
        // Fallback list of suffixes (different user roles were created under different local domains)
        const suffixes = ["@admin.local", "@office.local", "@user.local"];
        const baseName = loginEmail.toLowerCase().trim();

        let authSuccess = false;
        let lastAuthError: any = null;

        for (const suffix of suffixes) {
          try {
            const { data, error: authError } =
              await supabase.auth.signInWithPassword({
                email: baseName + suffix,
                password: password,
              });
            if (!authError && data.session) {
              const userId = data.session.user.id;
              localStorage.setItem(
                `session_start_time_${userId}`,
                Date.now().toString(),
              );
              localStorage.setItem(
                `last_access_time_${userId}`,
                Date.now().toString(),
              );
              router.push("/");
              router.refresh();
              authSuccess = true;
              break;
            } else {
              lastAuthError = authError;
            }
          } catch (e) {
            lastAuthError = e;
          }
        }

        if (authSuccess) {
          return;
        } else {
          setError(
            lastAuthError?.message === "Invalid login credentials"
              ? "Invalid codename or password..."
              : lastAuthError?.message || "Failed to login.",
          );
          setLoading(false);
          return;
        }
      }
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: loginEmail,
          password: password,
        },
      );

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Invalid codename or password..."
            : authError.message,
        );
        setLoading(false);
        return;
      }

      if (data.session) {
        const userId = data.session.user.id;
        localStorage.setItem(
          `session_start_time_${userId}`,
          Date.now().toString(),
        );
        localStorage.setItem(
          `last_access_time_${userId}`,
          Date.now().toString(),
        );
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An error occurred during login. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-955 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-gradient-to-r from-blue-400 to-purple-450">
          QC Manager App
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400 font-medium">
          Sign in to submit quotation files and track leaves
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 py-8 px-4 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-lg bg-red-955/50 border border-red-800/50 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm text-red-200 font-medium">{error}</div>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-350 uppercase tracking-wider"
              >
                Codename
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  placeholder="e.g., KI1024"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val.includes("@") ? val : val.toUpperCase());
                  }}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-350 uppercase tracking-wider"
              >
                Password
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-955/85 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotSuccess(false);
                  setForgotError("");
                  setForgotUsername("");
                }}
                className="text-xs font-semibold text-blue-500 hover:text-blue-450 transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader className="animate-spin h-5 w-5 text-white" />{" "}
                    Loading...
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Desktop App Download Area */}
        {!isDesktop && (
          <div className="mt-6">
            <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/50 p-6 shadow-xl rounded-2xl text-center">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Submit Quotation Files and Leaves Faster with
              </p>
              <h3 className="text-sm font-bold text-slate-200 mt-1">
                QC Desktop Application
              </h3>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <a
                  href={links.windows}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-sky-500/30 hover:bg-slate-900/80 transition-all group cursor-pointer"
                >
                  <Monitor className="h-5 w-5 text-sky-400 group-hover:scale-110 transition-all duration-200" />
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 mt-1.5">
                    Windows
                  </span>
                </a>
                <a
                  href={links.macSilicon}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-violet-500/30 hover:bg-slate-900/80 transition-all group cursor-pointer"
                >
                  <Apple className="h-5 w-5 text-violet-400 group-hover:scale-110 transition-all duration-200" />
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 mt-1.5">
                    Mac (Silicon)
                  </span>
                </a>
                <a
                  href={links.macIntel}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/50 hover:bg-slate-900/80 transition-all group cursor-pointer"
                >
                  <Apple className="h-5 w-5 text-slate-400 group-hover:scale-110 transition-all duration-200" />
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 mt-1.5">
                    Mac (Intel)
                  </span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Forgot Password"
        icon={<Lock className="h-5 w-5 text-blue-500" />}
        maxWidthClass="max-w-md"
        glowClass="bg-blue-900/10"
      >
        <div className="font-sans">
          {forgotSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex p-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-450 rounded-2xl">
                <svg
                  className="h-6 w-6 text-emerald-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-white">
                Reset Request Sent!
              </h4>
              <p className="text-xs text-slate-405 leading-relaxed">
                Your password reset request has been sent to the admin. Once
                approved, your password will be reset to the default{" "}
                <strong className="text-white">123456</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all border border-blue-700"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed mb-2">
                Enter your codename below. A request will be sent to the admin
                to allow a password reset.
              </p>

              {forgotError && (
                <div className="rounded-lg bg-red-955/50 border border-red-800/50 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-200 font-medium">
                    {forgotError}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-350 uppercase tracking-wider">
                  Codename (Username)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., KI1024"
                  value={forgotUsername}
                  onChange={(e) =>
                    setForgotUsername(e.target.value.toUpperCase())
                  }
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all font-mono"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 py-2 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-300 bg-slate-950 hover:bg-slate-900 cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 flex justify-center py-2 border border-transparent rounded-lg shadow-md text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all items-center gap-1.5"
                >
                  {forgotLoading && (
                    <Loader className="animate-spin h-3.5 w-3.5 text-white" />
                  )}
                  {forgotLoading ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
}
