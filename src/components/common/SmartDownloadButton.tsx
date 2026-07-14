"use client";

import React, { useState } from "react";
import { Download, Monitor, Smartphone, LayoutGrid } from "lucide-react";
import { useDeviceInfo } from "@/hooks/common/useDeviceInfo";
import MoreDownloadsModal from "./MoreDownloadsModal";

interface SmartDownloadButtonProps {
  className?: string;
}

export default function SmartDownloadButton({ className = "" }: SmartDownloadButtonProps) {
  const { deviceInfo, recommendation, loading, downloads } = useDeviceInfo();
  const [modalOpen, setModalOpen] = useState(false);

  const getButtonIcon = () => {
    if (loading) return <Download className="w-4 h-4 animate-bounce" />;
    
    if (deviceInfo.os === "Android") {
      return <Smartphone className="w-4 h-4 shrink-0 text-blue-400 group-hover:scale-110 transition-transform" />;
    }
    return <Monitor className="w-4 h-4 shrink-0 text-blue-400 group-hover:scale-110 transition-transform" />;
  };

  const getButtonText = () => {
    if (loading) return "Detecting your device...";
    if (!recommendation) return "Download for Your Device";

    const osLabel = recommendation.platform;
    const archLabel = recommendation.architecture.includes("Universal")
      ? "" 
      : ` (${recommendation.architecture})`;

    if (osLabel === "Android") {
      return "Download Android APK";
    }
    
    return `Download for ${osLabel}${archLabel}`;
  };

  const handleMainClick = (e: React.MouseEvent) => {
    if (!recommendation) {
      e.preventDefault();
      setModalOpen(true);
      return;
    }

    if (recommendation.url.startsWith("http")) {
      // Safe redirect / open download
      window.open(recommendation.url, "_blank");
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 font-sans ${className}`}>
      {/* Primary Download Button */}
      <button
        onClick={handleMainClick}
        disabled={loading}
        className="group relative flex-1 sm:flex-initial inline-flex items-center gap-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-semibold text-xs py-3 px-5 rounded-xl shadow-lg hover:shadow-xl hover:shadow-blue-500/10 transition-all cursor-pointer select-none text-left"
        aria-label={getButtonText()}
      >
        <div className="p-1.5 bg-white/10 rounded-lg shrink-0">
          {getButtonIcon()}
        </div>
        <div className="flex flex-col min-w-0 pr-1">
          <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider leading-none">
            Recommended Installer
          </span>
          <span className="text-xs font-extrabold text-white mt-1 truncate leading-tight">
            {getButtonText()}
          </span>
          {!loading && recommendation && (
            <span className="text-[9px] text-white/70 mt-0.5 leading-none font-medium">
              v{recommendation.version} • {recommendation.fileSize}
            </span>
          )}
        </div>
      </button>

      {/* Secondary More Downloads Button */}
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center justify-center gap-2 border border-theme-border-input hover:border-theme-border-active bg-theme-card-bg/40 hover:bg-theme-card-bg/90 hover:text-theme-text-primary text-theme-text-muted font-bold text-xs py-3 px-5 rounded-xl shadow-xs transition-all cursor-pointer select-none whitespace-nowrap"
        aria-haspopup="dialog"
        aria-expanded={modalOpen}
      >
        <LayoutGrid className="w-4 h-4 shrink-0 text-theme-text-muted/80" />
        <span>More Downloads</span>
      </button>

      {/* Complete Downloads Modal */}
      <MoreDownloadsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} downloads={downloads} />
    </div>
  );
}
