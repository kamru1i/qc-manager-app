'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ArrowUpCircle, RefreshCw, X } from 'lucide-react';

/**
 * Modern, Production-Grade Auto Updater for Tauri v2 (macOS & Windows)
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
  const [newVersion, setNewVersion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    const isTauri =
      typeof window !== 'undefined' &&
      ((window as any).__TAURI_INTERNALS__ !== undefined ||
        window.location.protocol === 'tauri:');

    if (!isTauri || process.env.NODE_ENV === 'development') return;

    const checkForUpdates = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check({
          headers: {
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'expires': '0',
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

          // downloadAndInstall downloads and extracts update package on macOS & Windows
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength ?? 0;
                downloaded = 0;
                setDownloadProgress(0);
                break;
              case 'Progress':
                downloaded += event.data.chunkLength;
                if (contentLength > 0) {
                  const pct = Math.min(99, Math.round((downloaded / contentLength) * 100));
                  setDownloadProgress(pct);
                } else {
                  setDownloadProgress(50);
                }
                break;
              case 'Finished':
                setDownloadProgress(100);
                break;
            }
          });

          setDownloading(false);
          setReadyToRestart(true);

          // Automatically trigger relaunch after installation
          try {
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          } catch (relaunchErr) {
            console.error('[AppUpdater] Auto relaunch failed:', relaunchErr);
          }
        }
      } catch (err: any) {
        console.warn('[AppUpdater] Update check failed:', err);
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
  }, []);

  const handleRestartNow = async () => {
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err: any) {
      console.error('[AppUpdater] Relaunch failed:', err);
      setError('Failed to restart automatically. Please close and reopen the app.');
    }
  };

  if (dismissed || (!updateAvailable && !error)) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-slate-100 font-sans animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl shrink-0 border border-blue-500/20">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {error ? 'Update Failed' : 'App Update Available'}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug font-medium">
              {downloading && `Downloading & installing v${newVersion}... (${downloadProgress}%)`}
              {readyToRestart && `v${newVersion} installed! Restarting application...`}
              {error && error}
            </p>
          </div>
        </div>

        {!downloading && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {downloading && (
        <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      )}

      {readyToRestart && (
        <button
          onClick={handleRestartNow}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Restart Application Now
        </button>
      )}
    </div>
  );
}
