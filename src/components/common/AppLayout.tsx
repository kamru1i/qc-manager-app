"use client";

import React from "react";
import { SafeAreaProvider } from "@/providers/SafeAreaProvider";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <SafeAreaProvider>
      <div className="h-screen max-h-screen w-full flex flex-col bg-theme-page-bg relative overflow-hidden text-white selection:bg-purple-650 selection:text-white pb-safe">
        {children}
      </div>
    </SafeAreaProvider>
  );
};
