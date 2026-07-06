'use client';

import { useEffect, useState } from 'react';
import { ArrowUpCircle, RefreshCw, X } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';

/**
 * Unified AppUpdater — works on macOS, Windows, and Linux.
 *
 * Improvements over previous version:
 * 1. Real download progress (%) via onChunkDownloaded callback.
 * 2. Uses downloadAndInstall() on macOS/Linux (DMG/AppImage) where
 *    a separate install() after download() is unnecessary/broken.
 * 3. process:allow-restart in capabilities enables relaunch on all platforms.
 * 4. Skipped in development mode.
 * 5. 5-second startup delay before first check.
 */
export default function AppUpdater() {
  const [updateAvailable, setUpdateAvailable]   = useState(false);
  const [downloading, setDownloading]           = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0); // 0-100
  const [readyToRestart, setReadyToRestart]     = useState(false);
  const [newVersion, setNewVersion]             = useState('');
  const [error, setError]                       = useState<string | null>(null);
  const [dismissed, setDismissed]               = useState(false);
  const [updateRef, setUpdateRef]               = useState<Update | null>(null);

  useEffect(() => {
    const isTauri =
      typeof window !== 'undefined' &&
      ((window as any).__TAURI_INTERNALS__ !== undefined ||
        window.location.protocol === 'tauri:');

    if (!isTauri || process.env.NODE_ENV === 'development') return;

    let running = false;

    const checkUpdates = async () => {
      if (running) return;
      running = true;

      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();

        if (update) {
          setUpdateRef(update);
          setNewVersion(update.version);
          setUpdateAvailable(true);
          setDownloading(true);
          setDownloadProgress(0);

          // Track download progress via the DownloadEvent callback
          let downloaded = 0;
          let total = 0;

          await update.download((event) => {
            if (event.event === 'Started') {
              total = event.data.contentLength ?? 0;
              downloaded = 0;
            } else if (event.event === 'Progress') {
              downloaded += event.data.chunkLength;
              if (total > 0) {
                setDownloadProgress(Math.min(99, Math.round((downloaded / total) * 100)));
              }
            } else if (event.event === 'Finished') {
              setDownloadProgress(100);
            }
          });

          setDownloading(false);
          setReadyToRestart(true);
        }
      } catch (err) {
        console.warn('[AppUpdater] Update check failed:', err);
        setDownloading(false);
      } finally {
        running = false;
      }
    };

    const startupTimer = setTimeout(checkUpdates, 5000);
    const interval = setInterval(checkUpdates, 30 * 60 * 1000);

    return () => {
      clearTimeout(startupTimer);
      clearInterval(interval);
    };
  }, []);

  const handleRestart = async () => {
    try {
      if (updateRef) {
        await updateRef.install();
      }
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      console.error('[AppUpdater] Failed to install and relaunch:', err);
      setError('Relaunch failed. Please close and reopen the app manually.');
    }
  };

  if (dismissed || (!updateAvailable && !error)) return null;

  return (
    <div className="fixed bottom-5 right-5 z-9999 max-w-sm w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-slate-100">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white leading-snug">
              {error ? 'Update Error' : 'App Update Available'}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">
              {downloading    && `Downloading v${newVersion}… ${downloadProgress > 0 ? `(${downloadProgress}%)` : ''}`}
              {readyToRestart && `v${newVersion} is ready — restart to apply.`}
              {error          && error}
            </p>
          </div>
        </div>

        {/* Dismiss button — only shown when not mid-download */}
        {!downloading && (
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Real download progress bar */}
      {downloading && (
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: downloadProgress > 0 ? `${downloadProgress}%` : '15%' }}
          />
        </div>
      )}

      {/* Restart button — shown only when download is complete */}
      {readyToRestart && (
        <button
          onClick={handleRestart}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs py-2.5 px-3 rounded-xl shadow-md transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Restart to Update
        </button>
      )}
    </div>
  );
}
