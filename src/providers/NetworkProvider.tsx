"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { NoInternetOverlay } from "@/components/common/NoInternetOverlay";
import { supabase } from "@/utils/supabase";

interface NetworkContextType {
  isOnline: boolean;
  isChecking: boolean;
  checkConnectivity: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isChecking: false,
  checkConnectivity: async () => true,
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return true;

    // 1. Primary browser connectivity check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      setIsChecking(false);
      return false;
    }

    setIsChecking(true);

    // Determine platform
    const isNative =
      (window as any).__TAURI_INTERNALS__ !== undefined ||
      window.location.protocol === "tauri:" ||
      window.location.protocol === "capacitor:" ||
      window.location.hostname === "tauri.localhost";

    const pingUrl = isNative 
      ? "https://chuti.bnfcorporate.com/favicon.ico" 
      : "/favicon.ico";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Perform a lightweight GET ping
      const res = await fetch(`${pingUrl}?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok || res.type === "opaque" || res.status === 200 || res.status === 304) {
        setIsOnline(true);
        setIsChecking(false);
        return true;
      }

      // If server returned another status, check navigator.onLine as source of truth
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      setIsOnline(online);
      setIsChecking(false);
      return online;
    } catch {
      // If ping failed (e.g. adblocker, local webview asset route, or temporary timeout),
      // defer to navigator.onLine so users are not falsely locked out with "No Internet Connection"
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      setIsOnline(online);
      setIsChecking(false);
      return online;
    }
  }, []);

  // Sync state on mount and register listeners
  useEffect(() => {
    setMounted(true);
    
    // Initial check
    checkConnectivity();

    const handleOnline = () => {
      // Re-verify connection to make sure it's not a false online event
      checkConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic check every 45 seconds — the online/offline listeners above catch
    // most transitions instantly; this interval is just a safety net, and on Tauri
    // each tick is a network HEAD ping (egress), so keep it infrequent.
    const intervalId = setInterval(() => {
      checkConnectivity();
    }, 45000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(intervalId);
    };
  }, [checkConnectivity]);

  // Handle Supabase Realtime reconnection on network recovery
  useEffect(() => {
    if (isOnline && mounted) {
      // Explicitly tell Supabase to reconnect its realtime channels
      const channels = supabase.getChannels();
      if (channels.length > 0) {
        supabase.realtime.connect();
      }
    }
  }, [isOnline, mounted]);

  const contextValue = useMemo(
    () => ({ isOnline, isChecking, checkConnectivity }),
    [isOnline, isChecking, checkConnectivity]
  );

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
      {mounted && !isOnline && (
        <NoInternetOverlay
          isChecking={isChecking}
          onRetry={checkConnectivity}
        />
      )}
    </NetworkContext.Provider>
  );
};
