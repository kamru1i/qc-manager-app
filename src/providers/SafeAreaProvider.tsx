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

    const measureInsets = () => {
      if (typeof window === "undefined") return;

      // Create a temporary hidden DOM element to measure env() values
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
      const top = parseInt(computedStyle.height) || 0;

      div.style.height = "env(safe-area-inset-bottom, 0px)";
      const bottom = parseInt(computedStyle.height) || 0;

      document.body.removeChild(div);

      setInsets({
        top,
        bottom,
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
