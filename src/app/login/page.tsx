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
} from "lucide-react";
import { getApiUrl } from "@/utils/apiUrlHelper";
import { Modal } from "@/components/common/Modal";
import SmartDownloadButton from "@/components/common/SmartDownloadButton";
import { isNativeApp } from "@/utils/envHelper";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    setIsNative(isNativeApp());
  }, []);

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

    const endpoint = getApiUrl("/api/forgot-password");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim() }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        setForgotSuccess(true);
        setForgotUsername("");
      } else {
        const errData = await res.json().catch(() => ({}));
        const status = res.status;
        const message = errData.error || "Failed to submit password reset request";
        
        console.error("[ForgotPassword] Request failed:", {
          endpoint,
          status,
          message
        });

        if (status === 429) {
          setForgotError("Too many requests. Please wait a minute.");
        } else if (status === 500) {
          setForgotError("Database unavailable.");
        } else {
          setForgotError(message);
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      const isTimeout = error.name === "AbortError";
      const message = isTimeout ? "Network timeout" : "Network error submitting request";
      
      console.error("[ForgotPassword] Unexpected exception:", {
        endpoint,
        message,
        error: error.message || error
      });
      
      setForgotError(message);
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
        if (sessionError) {
          if (typeof window !== "undefined") {
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith("sb-")) {
                localStorage.removeItem(key);
              }
            }
          }
          try {
            // Local: only clear this device's stale session
            await supabase.auth.signOut({ scope: "local" });
          } catch (e) {
            console.warn("Failed to clear stale auth session:", e);
          }
          throw sessionError;
        }

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
            let startAge = sessionStart
              ? now - parseInt(sessionStart, 10)
              : 0;
            let accessAge = lastAccess ? now - parseInt(lastAccess, 10) : 0;

            // Protection against backwards clock skew (reset startage/accessage instead of logout)
            if (startAge < 0) {
              localStorage.setItem(`session_start_time_${userId}`, now.toString());
              startAge = 0;
            }
            if (accessAge < 0) {
              localStorage.setItem(`last_access_time_${userId}`, now.toString());
              accessAge = 0;
            }

            if (startAge > oneWeekMs || accessAge > oneWeekMs) {
              localStorage.removeItem(`session_start_time_${userId}`);
              localStorage.removeItem(`last_access_time_${userId}`);
              try {
                // Local: this device's session expired — don't touch other devices
                await supabase.auth.signOut({ scope: "local" });
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
        if (typeof window !== "undefined") {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("sb-")) {
              localStorage.removeItem(key);
            }
          }
        }
        try {
          // Local: only clear this device's stale session
          await supabase.auth.signOut({ scope: "local" });
        } catch (e) {
          console.warn("Failed to clear stale auth session:", e);
        }
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Try resolving username/codename to registered email securely (passing password)
    let loginEmail = email.trim();
    if (!loginEmail.includes("@")) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

      let resolvedEmail = null;
      try {
        const res = await fetch(getApiUrl("/api/resolve-email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: loginEmail, password }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          resolvedEmail = data.email;
        } else if (res.status === 401) {
          setError("Invalid username or password.");
          setLoading(false);
          return;
        }
      } catch {
        clearTimeout(timeoutId);
      }

      if (resolvedEmail) {
        loginEmail = resolvedEmail;
      } else {
        // Fallback list of suffixes (different user roles were created under different local domains)
        const suffixes = ["@admin.local", "@office.local", "@user.local", "@admin.chuti", "@supervisor.chuti", "@user.chuti"];
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
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-theme-page-bg relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white bg-clip-text bg-linear-to-r from-blue-400 to-purple-450">
          QC Manager App
        </h2>
        <p className="mt-2 text-center text-sm text-theme-text-muted font-medium">
          Sign in to submit quotation files and track leaves
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-theme-card-bg/50 backdrop-blur-xl border border-theme-border-input/80 py-8 px-4 shadow-2xl rounded-2xl sm:px-10">
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
                className="block text-sm font-semibold text-theme-text-secondary uppercase tracking-wider"
              >
                Codename
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-theme-text-muted" aria-hidden="true" />
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
                  className="block w-full pl-10 pr-3 py-2.5 bg-theme-card-container/80 border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all font-sans"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-theme-text-secondary uppercase tracking-wider"
              >
                Password
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-theme-text-muted" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 bg-theme-page-bg/85 border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-theme-text-muted hover:text-theme-text-secondary transition-colors focus:outline-none"
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
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader className="animate-spin h-5 w-5 text-theme-text-primary" />{" "}
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
        {!isNative && (
          <div className="mt-6">
            <div className="bg-theme-card-bg/30 backdrop-blur-xl border border-theme-border-input/50 p-6 shadow-xl rounded-2xl flex flex-col items-center text-center">
              <p className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider">
                Submit Quotation Files and Leaves Faster with
              </p>
              <h3 className="text-sm font-bold text-theme-text-primary mt-1 mb-4">
                QC Manager Native Applications
              </h3>
              <SmartDownloadButton />
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
              <h4 className="text-sm font-bold text-theme-text-primary">
                Reset Request Sent!
              </h4>
              <p className="text-xs text-theme-text-muted leading-relaxed">
                Your password reset request has been sent to the admin. Once
                approved, your password will be reset to the default{" "}
                <strong className="text-theme-text-primary">1234</strong>.
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
              <p className="text-xs text-theme-text-muted leading-relaxed mb-2">
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
                <label className="block text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
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
                  className="mt-1.5 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all font-mono"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 py-2 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-card-container hover:bg-theme-card-bg cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 flex justify-center py-2 border border-transparent rounded-lg shadow-md text-xs font-bold text-white bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all items-center gap-1.5"
                >
                  {forgotLoading && (
                    <Loader className="animate-spin h-3.5 w-3.5 text-theme-text-primary" />
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
