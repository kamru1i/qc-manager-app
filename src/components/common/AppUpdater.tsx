"use client";

import React, { useEffect, useState, useRef } from "react";
import { ArrowUpCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/utils/supabase";

/**
 * Modern, Production-Grade Auto Updater for Tauri v2 & Capacitor Mobile OTA (self-hosted updates)
 *
 * Key features:
 * 1. Uses downloadAndInstall() for atomic binary package extraction & update on macOS & Windows.
 * 2. Real-time download progress tracking (0-100%).
 * 3. Uses Tauri v2 process relaunch plugin to automatically restart the app upon update completion.
 * 4. Non-intrusive UI widget in bottom-right with dismiss controls.
 * 5. Periodic update check (startup + every 15 minutes).
 */
export default function AppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const isCheckingRef = useRef(false);
  const downloadedUpdateRef = useRef<any>(null);

  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" &&
      ((window as any).__TAURI_INTERNALS__ !== undefined ||
        window.location.protocol === "tauri:");

    const isMobile =
      typeof window !== "undefined" &&
      ((window as any).Capacitor !== undefined ||
        window.location.protocol === "capacitor:");

    if (isTauri) {
      if (process.env.NODE_ENV === "development") return;

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
                      Math.round((downloaded / contentLength) * 100),
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
          console.warn("[AppUpdater] Update check failed:", err);
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

    if (isMobile) {
      if (process.env.NODE_ENV === "development") return;

      const checkMobileUpdates = async () => {
        if (isCheckingRef.current) return;
        isCheckingRef.current = true;

        try {
          const { data, error: queryError } = await supabase
            .from("mobile_app_versions")
            .select("version, zip_url, required")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (queryError) throw queryError;

          if (data && data.version) {
            const { VERSION } = await import("@/config/downloads");
            const currentAppVersion = VERSION;

            if (data.version !== currentAppVersion) {
              console.log(`[AppUpdater] New mobile OTA version ${data.version} available (current: ${currentAppVersion}). Downloading...`);
              setNewVersion(data.version);
              setUpdateAvailable(true);
              setDownloading(true);
              setDownloadProgress(35);

              const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

              // Download the update zip bundle
              const update = await CapacitorUpdater.download({
                url: data.zip_url,
                version: data.version,
              });

              setDownloadProgress(85);
              setReadyToRestart(true);

              // Apply the update (reloads the webview instantly)
              console.log(`[AppUpdater] Applying mobile OTA update ${data.version}...`);
              await CapacitorUpdater.set(update);
              console.log(`[AppUpdater] Mobile OTA update ${data.version} applied successfully!`);
            }
          }
        } catch (err: any) {
          console.warn("[AppUpdater] Mobile check failed:", err);
        } finally {
          isCheckingRef.current = false;
        }
      };

      const initialTimer = setTimeout(() => checkMobileUpdates(), 5000);
      const intervalTimer = setInterval(() => checkMobileUpdates(), 15 * 60 * 1000);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(intervalTimer);
      };
    }
  }, []);

  const handleRestartNow = async () => {
    try {
      if (Capacitor.isNativePlatform() || (window as any).Capacitor !== undefined) {
        const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
        if (downloadedUpdateRef.current) {
          await CapacitorUpdater.set(downloadedUpdateRef.current);
        } else {
          // Fallback trigger
          await CapacitorUpdater.set({ id: newVersion });
        }
        return;
      }

      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err: any) {
      console.error("[AppUpdater] Relaunch failed:", err);
      setError(
        "Failed to restart automatically. Please close and reopen the app.",
      );
    }
  };

  if (!updateAvailable || error) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:w-80 z-9999 bg-theme-card-bg/95 backdrop-blur-xl border border-theme-border-input rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-theme-text-primary font-sans animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl shrink-0 border border-blue-500/20">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-theme-text-primary uppercase tracking-wider">
              System Update
            </h4>
            <p className="text-xs text-theme-text-muted mt-0.5 leading-snug font-medium">
              {downloading &&
                `Downloading & installing v${newVersion}... (${downloadProgress}%)`}
              {readyToRestart &&
                `v${newVersion} installed! Restarting application...`}
            </p>
          </div>
        </div>
      </div>

      {downloading && (
        <div className="w-full bg-theme-border-input/80 h-2 rounded-full overflow-hidden p-0.5 border border-theme-border-active/50">
          <div
            className="bg-linear-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}
