"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { isNativeApp } from "@/utils/envHelper";

interface SafeAreaInsets {
  top: number;
  bottom: number;
  isNative: boolean;
}

const SafeAreaContext = createContext<SafeAreaInsets>({
  top: 0,
  bottom: 0,
  isNative: false,
});

export const useSafeArea = () => useContext(SafeAreaContext);

export const SafeAreaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    isNative: false,
  });

  useEffect(() => {
    const checkNative = isNativeApp();

    const measureInsets = async () => {
      if (typeof window === "undefined") return;

      let overlaps = true;

      // 1. Create a temporary hidden DOM element to measure env() values
      const div = document.createElement("div");
      div.style.position = "fixed";
      div.style.top = "0";
      div.style.left = "0";
      div.style.width = "0";
      div.style.height = "env(safe-area-inset-top, 0px)";
      div.style.visibility = "hidden";
      div.style.pointerEvents = "none";
      document.body.appendChild(div);

      const computedStyle = window.getComputedStyle(div);
      const measuredTop = parseInt(computedStyle.height) || 0;

      div.style.height = "env(safe-area-inset-bottom, 0px)";
      const measuredBottom = parseInt(computedStyle.height) || 0;

      document.body.removeChild(div);

      // 2. If running natively, inspect if the status bar actually overlaps the webview viewport
      if (checkNative) {
        try {
          const { StatusBar } = await import("@capacitor/status-bar");
          const info = await StatusBar.getInfo();
          overlaps = info.overlays;
        } catch (e) {
          console.warn("[SafeAreaProvider] Failed to read StatusBar overlay status:", e);
        }
      }

      setInsets({
        top: overlaps ? measuredTop : 0,
        bottom: measuredBottom,
        isNative: checkNative,
      });
    };

    // Run initial measurement
    measureInsets();

    // Re-measure on resize or orientation change
    window.addEventListener("resize", measureInsets);
    window.addEventListener("orientationchange", measureInsets);

    return () => {
      window.removeEventListener("resize", measureInsets);
      window.removeEventListener("orientationchange", measureInsets);
    };
  }, []);

  return (
    <SafeAreaContext.Provider value={insets}>
      {children}
    </SafeAreaContext.Provider>
  );
};
