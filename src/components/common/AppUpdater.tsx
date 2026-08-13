"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowUpCircle, Download, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/utils/supabase";
import { VERSION, MANIFEST_URL, REPO } from "@/config/downloads";

function isNewerVersion(candidate: string, current: string): boolean {
  if (!candidate || !current) return false;
  const a = candidate.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export default function AppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" &&
      ((window as any).__TAURI_INTERNALS__ !== undefined ||
        window.location.protocol === "tauri:");

    const isCapacitorNative =
      typeof window !== "undefined" &&
      (Capacitor.isNativePlatform() ||
        window.location.protocol === "capacitor:");

    setIsMobile(isCapacitorNative);

    // BROWSER / WEB / LOCALHOST FIX:
    // Do not run binary auto-updater popups inside standard web browsers or localhost.
    if (!isTauri && !isCapacitorNative) {
      return;
    }

    setIsNativeApp(true);

    // --- 1. TAURI DESKTOP AUTO-UPDATER (macOS & Windows) ---
    if (isTauri) {
      if (process.env.NODE_ENV === "development" && !(window as any).__TAURI_INTERNALS__) return;

      const checkForUpdates = async () => {
        if (isCheckingRef.current) return;
        isCheckingRef.current = true;

        try {
          const { check } = await import("@tauri-apps/plugin-updater");
          const update = await check({
            headers: {
              "cache-control": "no-cache",
              pragma: "no-cache",
              expires: "0",
            },
          });

          if (update && update.available) {
            setNewVersion(update.version);
            setUpdateAvailable(true);
            setDownloading(true);
            setDownloadProgress(0);
            setError(null);

            let downloaded = 0;
            let contentLength = 0;

            await update.downloadAndInstall((event) => {
              switch (event.event) {
                case "Started":
                  contentLength = event.data.contentLength ?? 0;
                  downloaded = 0;
                  setDownloadProgress(0);
                  break;
                case "Progress":
                  downloaded += event.data.chunkLength;
                  if (contentLength > 0) {
                    const pct = Math.min(
                      99,
                      Math.round((downloaded / contentLength) * 100)
                    );
                    setDownloadProgress(pct);
                  } else {
                    setDownloadProgress(50);
                  }
                  break;
                case "Finished":
                  setDownloadProgress(100);
                  break;
              }
            });

            setDownloading(false);
            setReadyToRestart(true);

            try {
              const { relaunch } = await import("@tauri-apps/plugin-process");
              await relaunch();
            } catch (relaunchErr) {
              console.error("[AppUpdater] Auto relaunch failed:", relaunchErr);
            }
          }
        } catch (err: any) {
          console.warn("[AppUpdater] Tauri update check failed:", err);
          setDownloading(false);
        } finally {
          isCheckingRef.current = false;
        }
      };

      const initialTimer = setTimeout(() => checkForUpdates(), 3000);
      const intervalTimer = setInterval(() => checkForUpdates(), 15 * 60 * 1000);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(intervalTimer);
      };
    }

    // --- 2. CAPACITOR MOBILE AUTO-UPDATER (Android & Mobile) ---
    if (isCapacitorNative) {
      const checkMobileUpdates = async () => {
        if (isCheckingRef.current) return;
        isCheckingRef.current = true;

        try {
          let latestVer = "";
          let apkTargetUrl = "";

          // Source A: Try GitHub API (CORS-friendly for web browsers & mobile)
          try {
            const ghRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: "no-store" });
            if (ghRes.ok) {
              const ghData = await ghRes.json();
              if (ghData && ghData.tag_name) {
                latestVer = ghData.tag_name.replace(/^v/, "");
              }
            }
          } catch (ghErr) {
            console.warn("[AppUpdater] Could not fetch GitHub release API:", ghErr);
          }

          // Source B: Try fetching latest.json manifest (for native apps)
          if (!latestVer) {
            try {
              const manifestRes = await fetch(MANIFEST_URL, { cache: "no-store" });
              if (manifestRes.ok) {
                const manifestData = await manifestRes.json();
                if (manifestData && manifestData.version) {
                  latestVer = manifestData.version;
                }
              }
            } catch {
              // Ignore manifest fetch error in web browser fallback
            }
          }

          // Source C: Supabase mobile_app_versions fallback
          if (!latestVer) {
            try {
              const { data: supaData } = await supabase
                .from("mobile_app_versions")
                .select("version, zip_url")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (supaData && supaData.version) {
                latestVer = supaData.version;
              }
            } catch (supaErr) {
              console.warn("[AppUpdater] Could not fetch Supabase versions:", supaErr);
            }
          }

          if (latestVer && isNewerVersion(latestVer, VERSION)) {
            apkTargetUrl = `https://github.com/${REPO}/releases/download/v${latestVer}/QC.Manager_${latestVer}.apk`;
            setNewVersion(latestVer);
            setDownloadUrl(apkTargetUrl);
            setUpdateAvailable(true);
          }
        } catch (err: any) {
          console.warn("[AppUpdater] Mobile check error:", err);
        } finally {
          isCheckingRef.current = false;
        }
      };

      const initialTimer = setTimeout(() => checkMobileUpdates(), 3000);
      const intervalTimer = setInterval(() => checkMobileUpdates(), 15 * 60 * 1000);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(intervalTimer);
      };
    }
  }, []);

  const handleMobileDownloadAndInstall = async () => {
    if (!newVersion || downloading) return;
    setDownloading(true);
    setDownloadProgress(5);
    setError(null);

    const apkUrl = downloadUrl || `https://github.com/${REPO}/releases/download/v${newVersion}/QC.Manager_${newVersion}.apk`;

    let progressListener: { remove: () => Promise<void> } | null = null;
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { FileOpener } = await import("@capacitor-community/file-opener");

      progressListener = await Filesystem.addListener("progress", (progress) => {
        if (progress.contentLength > 0) {
          const pct = Math.min(
            99,
            Math.round((progress.bytes / progress.contentLength) * 100)
          );
          setDownloadProgress(pct);
        }
      });

      const fileName = `QC.Manager_${newVersion}.apk`;
      const downloadResult = await Filesystem.downloadFile({
        url: apkUrl,
        path: fileName,
        directory: Directory.Cache,
        progress: true,
      });

      setDownloadProgress(100);
      setReadyToRestart(true);

      const nativeUri = downloadResult.path;
      if (!nativeUri) {
        throw new Error("Downloaded file path is undefined");
      }

      await FileOpener.open({
        filePath: nativeUri,
        contentType: "application/vnd.android.package-archive",
      });
      setDownloading(false);
    } catch (dlErr: any) {
      console.warn("[AppUpdater] Native APK download/installer failed, falling back to browser:", dlErr);
      setDownloading(false);
      // Fallback: Open direct download URL in browser/system application
      try {
        if (typeof window !== "undefined") {
          window.open(apkUrl, "_system");
        }
      } catch (openErr) {
        setError("Failed to open update installer.");
      }
    } finally {
      if (progressListener) {
        await progressListener.remove().catch(() => {});
      }
    }
  };

  if (!isNativeApp || !updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:w-84 z-99999 bg-theme-card-bg/95 backdrop-blur-xl border border-theme-border-input rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-theme-text-primary font-sans animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl shrink-0 border border-blue-500/20">
            <ArrowUpCircle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-theme-text-primary uppercase tracking-wider">
              System Update Available
            </h4>
            <p className="text-xs text-theme-text-muted mt-0.5 leading-snug font-medium">
              {downloading
                ? `Downloading v${newVersion}... (${downloadProgress}%)`
                : readyToRestart
                ? isMobile
                  ? `v${newVersion} downloaded! Launching installer...`
                  : `v${newVersion} installed! Restarting application...`
                : `Version v${newVersion} is ready to install.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-theme-text-muted hover:text-theme-text-primary p-1 transition-colors cursor-pointer rounded-lg"
          title="Dismiss update notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {downloading && (
        <div className="w-full bg-theme-border-input/80 h-2 rounded-full overflow-hidden p-0.5 border border-theme-border-active/50">
          <div
            className="bg-linear-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      )}

      {isMobile && !downloading && !readyToRestart && (
        <button
          type="button"
          onClick={handleMobileDownloadAndInstall}
          className="w-full py-2 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Download className="h-4 w-4" /> Download & Install v{newVersion}
        </button>
      )}
    </div>
  );
}
