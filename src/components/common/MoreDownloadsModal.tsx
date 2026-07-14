"use client";

import React, { useEffect, useRef } from "react";
import { X, Info, Shield, Calendar, HardDrive, Cpu, HelpCircle } from "lucide-react";
import { DOWNLOADS, DownloadInfo } from "@/config/downloads";

interface MoreDownloadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloads: typeof DOWNLOADS;
}

export default function MoreDownloadsModal({ isOpen, onClose, downloads }: MoreDownloadsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus inside modal for accessibility
  useEffect(() => {
    if (!isOpen) return;
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex="0"]'
    );
    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Set initial focus to close button
    firstElement.focus();

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleFocusTrap);
    return () => window.removeEventListener("keydown", handleFocusTrap);
  }, [isOpen]);

  if (!isOpen) return null;

  const renderBuildRow = (info: DownloadInfo, label: string) => {
    return (
      <div 
        key={info.architecture} 
        className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-theme-border-input hover:border-theme-border-active bg-theme-card-container/30 hover:bg-theme-card-container/50 transition-all duration-300 shadow-xs"
      >
        {/* Left Side: Name and Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-theme-text-primary group-hover:text-blue-400 transition-colors">
              {info.platform} {label}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/10">
              v{info.version}
            </span>
            {info.ota && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/10">
                OTA: {info.ota}
              </span>
            )}
            {info.autoUpdate && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/10">
                Auto-Update
              </span>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-1 gap-x-4 mt-2 text-[11px] text-theme-text-muted">
            <div className="flex items-center gap-1.5 min-w-0">
              <HardDrive className="w-3.5 h-3.5 shrink-0 text-theme-text-muted/70" />
              <span className="truncate">Size: {info.fileSize}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-theme-text-muted/70" />
              <span className="truncate">Date: {info.releaseDate}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2">
              <Cpu className="w-3.5 h-3.5 shrink-0 text-theme-text-muted/70" />
              <span className="truncate" title={info.minOsVersion}>OS: {info.minOsVersion}</span>
            </div>
          </div>

          {/* Release Notes */}
          {info.releaseNotes && (
            <p className="text-[11px] text-theme-text-muted mt-2 border-t border-theme-border-input/40 pt-2 leading-relaxed max-w-2xl italic">
              {info.releaseNotes}
            </p>
          )}

          {/* SHA256 */}
          {info.sha256 && (
            <div className="flex items-center gap-1 mt-1.5 text-[9px] text-theme-text-muted font-mono bg-theme-card-bg/50 px-2 py-0.5 rounded border border-theme-border-input/40 w-fit max-w-full">
              <Shield className="w-2.5 h-2.5 shrink-0 text-theme-text-muted/60" />
              <span className="truncate">SHA256: {info.sha256}</span>
            </div>
          )}
        </div>

        {/* Right Side: Action Button */}
        <div className="shrink-0 flex items-center md:justify-end">
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          >
            {info.url.endsWith(".apk") || info.url.endsWith(".exe") || info.url.endsWith(".dmg") || info.url.endsWith(".deb") 
              ? "Download File" 
              : "View Guide"}
          </a>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-3xl max-h-[85vh] bg-theme-card-bg/95 border border-theme-border-input rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border-input bg-theme-card-container/10">
          <div>
            <h2 id="modal-title" className="text-base font-bold text-theme-text-primary">
              All Available Releases
            </h2>
            <p className="text-xs text-theme-text-muted mt-0.5">
              Select and install the QC Manager build configured for your environment
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-border-input rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 max-h-[60vh] custom-scrollbar">
          {/* Windows Category */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              Windows Installer
            </h3>
            <div className="flex flex-col gap-3">
              {renderBuildRow(downloads.windows.x64, "64-bit (x64) Recommended")}
              {renderBuildRow(downloads.windows.arm64, "ARM64 Setup")}
            </div>
          </div>

          {/* macOS Category */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              macOS Installer
            </h3>
            <div className="flex flex-col gap-3">
              {renderBuildRow(downloads.macos.appleSilicon, "Apple Silicon (M1/M2/M3/M4)")}
              {renderBuildRow(downloads.macos.intel, "Intel Processor Mac")}
              {renderBuildRow(downloads.macos.universal, "Universal Binary (Intel & Apple Silicon)")}
            </div>
          </div>

          {/* Linux Category */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              Linux Installer
            </h3>
            <div className="flex flex-col gap-3">
              {renderBuildRow(downloads.linux.deb, "Debian Package (.deb)")}
              {renderBuildRow(downloads.linux.appimage, "AppImage Executable (.AppImage)")}
              {renderBuildRow(downloads.linux.rpm, "RPM Package (.rpm)")}
            </div>
          </div>

          {/* Mobile Category */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              Mobile Releases (Internal Testing)
            </h3>
            <div className="flex flex-col gap-3">
              {renderBuildRow(downloads.android.apk, "Android APK Installer")}
              {renderBuildRow(downloads.ios.internal, "iOS Deployment Guide")}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-theme-border-input bg-theme-card-container/10 flex items-center justify-between flex-wrap gap-2 text-[10px] text-theme-text-muted">
          <div className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Need web access instead? Use the client interface directly.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-theme-border-input hover:bg-theme-border-active hover:text-theme-text-primary rounded-lg transition-colors cursor-pointer text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
