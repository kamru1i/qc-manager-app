"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  HardDrive,
  Calendar,
  Cpu,
  Shield,
  Info,
} from "lucide-react";
import { useDeviceInfo } from "@/hooks/common/useDeviceInfo";
import { DownloadInfo } from "@/config/downloads";

export default function DownloadsPage() {
  const router = useRouter();
  const { downloads, loading } = useDeviceInfo();

  // Go back handler
  const handleBack = () => {
    router.back();
  };

  // Keyboard navigation listener (Backspace to go back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.getAttribute("contenteditable") === "true");

      if (e.key === "Backspace" && !isInput) {
        e.preventDefault();
        router.back();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

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
              <span className="truncate">
                Size: {info.fileSize || "Pending"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-theme-text-muted/70" />
              <span className="truncate">Date: {info.releaseDate}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2">
              <Cpu className="w-3.5 h-3.5 shrink-0 text-theme-text-muted/70" />
              <span className="truncate" title={info.minOsVersion}>
                OS: {info.minOsVersion}
              </span>
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
            {info.url.endsWith(".apk") ||
            info.url.endsWith(".exe") ||
            info.url.endsWith(".dmg") ||
            info.url.endsWith(".deb")
              ? "Download File"
              : "View Guide"}
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Header Container */}
      <header className="border-b border-theme-border-input bg-theme-card-container/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          {/* Back Icon Button */}
          <button
            onClick={handleBack}
            className="p-2 text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-border-input rounded-xl transition-all cursor-pointer border border-theme-border-input bg-theme-card-bg/50 flex items-center justify-center shadow-sm"
            aria-label="Navigate back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-lg font-bold text-theme-text-primary">
              All Available Releases
            </h1>
            <p className="text-xs text-theme-text-muted mt-0.5">
              Select and install the QC Manager build configured for your
              environment
            </p>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <div className="space-y-6 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-24 bg-theme-card-container/20 rounded-xl border border-theme-border-input"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Windows Category */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                Windows Installer
              </h3>
              <div className="flex flex-col gap-3">
                {renderBuildRow(
                  downloads.windows.x64,
                  "64-bit (x64) Recommended",
                )}
                {renderBuildRow(downloads.windows.arm64, "ARM64 Setup")}
              </div>
            </div>

            {/* macOS Category */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                macOS Installer
              </h3>
              <div className="flex flex-col gap-3">
                {renderBuildRow(
                  downloads.macos.appleSilicon,
                  "Apple Silicon (M1/M2/M3/M4/M5 & newer)",
                )}
                {renderBuildRow(downloads.macos.intel, "Intel Processor Mac")}
                {renderBuildRow(
                  downloads.macos.universal,
                  "Universal Binary (Intel & Apple Silicon M-Series)",
                )}
              </div>
            </div>

            {/* Linux Category */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                Linux Installer
              </h3>
              <div className="flex flex-col gap-3">
                {renderBuildRow(downloads.linux.deb, "Debian Package (.deb)")}
                {renderBuildRow(
                  downloads.linux.appimage,
                  "AppImage Executable (.AppImage)",
                )}
                {renderBuildRow(downloads.linux.rpm, "RPM Package (.rpm)")}
              </div>
            </div>

            {/* Mobile Category */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                Mobile Installer
              </h3>
              <div className="flex flex-col gap-3">
                {renderBuildRow(downloads.android.apk, "Android APK Installer")}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer Container */}
      <footer className="border-t border-theme-border-input bg-theme-card-container/10 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-2 text-xs text-theme-text-muted justify-center text-center">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Need web access instead? Use the client interface directly.
          </span>
        </div>
      </footer>
    </div>
  );
}
