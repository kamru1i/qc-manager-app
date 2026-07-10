"use client";

import React, { useState } from "react";
import { Profile } from "@/types";
import { AsitisCausalityPanel } from "./AsitisCausalityPanel";
import { EUICausalityPanel } from "./EUICausalityPanel";

interface CausalityPanelProps {
  profile: Profile | null;
  isOnline: boolean;
}

export const CausalityPanel: React.FC<CausalityPanelProps> = ({ profile, isOnline }) => {
  const [activeSubTab, setActiveSubTab] = useState<"asitis" | "eui">("asitis");

  return (
    <div className="space-y-5">
      {/* Tab switcher — centered at the top */}
      <div className="flex justify-center">
        <div className="flex bg-slate-955 p-1 rounded-xl border border-slate-850 shadow-inner">
          <button
            onClick={() => setActiveSubTab("asitis")}
            className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "asitis"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Asitis
          </button>
          <button
            onClick={() => setActiveSubTab("eui")}
            className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "eui"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            EUI
          </button>
        </div>
      </div>

      {/*
        Both panels are always mounted so each fetches its DB template exactly once.
        We use CSS visibility to show/hide instead of conditional rendering,
        which preserves state across tab switches without extra DB calls.
      */}
      <div className={activeSubTab === "asitis" ? "block" : "hidden"}>
        <AsitisCausalityPanel profile={profile} isOnline={isOnline} />
      </div>

      <div className={activeSubTab === "eui" ? "block" : "hidden"}>
        <EUICausalityPanel profile={profile} isOnline={isOnline} />
      </div>
    </div>
  );
};
