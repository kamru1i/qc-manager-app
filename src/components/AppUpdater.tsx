'use client';

import { useEffect, useState } from 'react';

export default function AppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [updateObject, setUpdateObject] = useState<any>(null);

  useEffect(() => {
    // Only run on client side and if Tauri is present
    const isTauri = 
      typeof window !== 'undefined' && 
      ((window as any).__TAURI_INTERNALS__ !== undefined || 
       window.location.protocol === 'tauri:');

    if (!isTauri || process.env.NODE_ENV === 'development') return;

    let isCheckingOrDownloading = false;

    const runUpdater = async () => {
      if (isCheckingOrDownloading) {
        console.log('[Updater] Update check or download already in progress. Skipping.');
        return;
      }
      isCheckingOrDownloading = true;

      try {
        // Dynamically import Tauri modules to prevent SSR / build pre-render crashes
        const { check } = await import('@tauri-apps/plugin-updater');
        
        console.log('[Updater] Checking for updates...');
        const update = await check();
        
        if (update) {
          console.log(`[Updater] Found new update: ${update.version}`);
          setUpdateAvailable(true);
          setDownloading(true);
          setUpdateObject(update);

          console.log('[Updater] Downloading update in background...');
          await update.download();
          
          console.log('[Updater] Update downloaded. Ready to restart.');
          setDownloading(false);
          setReadyToRestart(true);
        } else {
          console.log('[Updater] App is up to date.');
          isCheckingOrDownloading = false;
        }
      } catch (err) {
        console.warn('[Updater] Update check skipped or offline:', err);
        setDownloading(false);
        isCheckingOrDownloading = false;
      }
    };

    // Delay checking slightly to let the main application load smoothly
    const timer = setTimeout(runUpdater, 5000);

    // Check for updates periodically every 30 minutes
    const interval = setInterval(runUpdater, 30 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const handleRestart = async () => {
    if (!updateObject) {
      console.error('[Updater] No update object available to install');
      return;
    }
    try {
      console.log('[Updater] Installing update...');
      await updateObject.install();
      console.log('[Updater] Relaunching app...');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      console.error('[Updater] Failed to restart app:', err);
    }
  };

  if (!readyToRestart && !downloading && !updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
      {downloading && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-950/85 border border-slate-800/80 px-4 py-3 shadow-2xl backdrop-blur-md text-xs font-medium text-slate-200 animate-pulse pointer-events-auto">
          <div className="flex relative h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </div>
          <span>Downloading update in background...</span>
        </div>
      )}
      {readyToRestart && (
        <div className="flex flex-col gap-3 rounded-xl bg-slate-950/90 border border-blue-500/40 p-4 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-lg max-w-sm pointer-events-auto transition-all duration-300 ease-out transform translate-y-0 opacity-100">
          <div className="flex items-start gap-3.5">
            <span className="text-2xl animate-bounce">✨</span>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-slate-100 tracking-wide">Update Ready to Install!</h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                The latest version of Chuti has been downloaded automatically. Restart now to apply the changes.
              </p>
            </div>
          </div>
          <button
            onClick={handleRestart}
            className="mt-1 w-full py-2 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-[0.98] text-xs font-bold text-white transition-all shadow-[0_4px_12px_rgba(234,88,13,0.25)] hover:shadow-[0_4px_16px_rgba(234,88,13,0.4)] cursor-pointer"
          >
            Restart to Update
          </button>
        </div>
      )}
    </div>
  );
}
