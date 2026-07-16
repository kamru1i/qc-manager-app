"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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

    // 1. Check navigator.onLine first
    if (!navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    setIsChecking(true);

    // Determine ping target
    const isTauri =
      (window as any).__TAURI_INTERNALS__ !== undefined ||
      window.location.protocol === "tauri:" ||
      window.location.hostname === "tauri.localhost";

    // Use Supabase URL for Tauri builds; otherwise use origin favicon
    const pingUrl = isTauri
      ? (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://google.com")
      : "/favicon.ico";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Perform a HEAD request using no-cors to avoid CORS blocks
      await fetch(`${pingUrl}?t=${Date.now()}`, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setIsOnline(true);
      setIsChecking(false);
      return true;
    } catch (err) {
      setIsOnline(false);
      setIsChecking(false);
      return false;
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

    // Periodic check every 12 seconds
    const intervalId = setInterval(() => {
      checkConnectivity();
    }, 12000);

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

  return (
    <NetworkContext.Provider value={{ isOnline, isChecking, checkConnectivity }}>
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
