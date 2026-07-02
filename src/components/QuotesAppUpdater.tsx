'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, ArrowUpCircle, X } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';

export default function AppUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [readyToRestart, setReadyToRestart] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updateRef, setUpdateRef] = useState<Update | null>(null);

  // Global keyboard shortcut listener for Cmd+R (macOS) and Ctrl+R (Windows/Linux) reload
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleKeyDown = (e: KeyboardEvent) => {
        const isR = e.key.toLowerCase() === 'r';
        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
        
        if (isCmdOrCtrl && isR) {
          e.preventDefault();
          window.location.reload();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  useEffect(() => {
    // Only run this check inside the Tauri desktop environment
    const isTauri = typeof window !== 'undefined' && (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
    if (!isTauri) return;

    const checkUpdates = async () => {
      try {
        // Dynamically import to avoid server-side build issues in Next.js
        const { check } = await import('@tauri-apps/plugin-updater');
        
        const update = await check();
        if (update?.available) {
          setUpdateRef(update);
          setNewVersion(update.version);
          setUpdateAvailable(true);
          setDownloading(true);

          // Download update package in the background (do NOT install yet)
          await update.download();
          
          setDownloading(false);
          setReadyToRestart(true);
        }
      } catch (err) {
        console.error('Tauri Auto-Updater Error:', err);
        setDownloading(false);
      }
    };

    // Run initial check on app load
    checkUpdates();

    // Check for updates every 1 hour
    const interval = setInterval(checkUpdates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRelaunch = async () => {
    try {
      if (updateRef) {
        // Install the downloaded update package
        await updateRef.install();
      }

      
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
      if (isTauri) {
        // Invoke our custom delayed relaunch command to prevent WebView2 directory conflicts on Windows
        const { invoke } = (window as any).__TAURI__.core;
        await invoke('custom_relaunch');
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to install and relaunch app:', err);
      setError('Relaunch and install failed. Please close and reopen the app manually.');
    }
  };

  if (dismissed) return null;

  // Render a subtle update notification banner at the bottom-right corner of the screen
  if (updateAvailable || error) {
    return (
      <div className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5 duration-300 text-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">App Update Available</h4>
              <p className="text-xs text-slate-400">
                {downloading && `Downloading Version ${newVersion}...`}
                {readyToRestart && `Version ${newVersion} is ready to install.`}
                {error && 'Updater error encountered.'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setDismissed(true)} 
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {readyToRestart && (
          <button
            onClick={handleRelaunch}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs py-2 px-3 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Restart to Update
          </button>
        )}

        {error && (
          <div className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-1.5 rounded-lg border border-rose-500/20">
            {error}
          </div>
        )}
      </div>
    );
  }

  return null;
}
