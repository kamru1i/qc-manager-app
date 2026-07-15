import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";

interface NoInternetOverlayProps {
  isChecking: boolean;
  onRetry: () => void;
}

export const NoInternetOverlay: React.FC<NoInternetOverlayProps> = ({
  isChecking,
  onRetry,
}) => {
  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/65 backdrop-blur-md transition-opacity duration-300">
      <div className="bg-theme-card-bg border border-theme-border-input/60 rounded-2xl max-w-md w-full mx-4 p-8 text-center shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-300">

        {/* Glow decoration */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Icon & Animation wrapper */}
        <div className="flex justify-center mb-6 relative">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 animate-pulse">
            <WifiOff className="w-10 h-10 stroke-[2.5]" />
          </div>
          {isChecking && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Text Details */}
        <h2 className="text-2xl font-bold text-theme-text-primary mb-3">
          No Internet Connection
        </h2>
        <p className="text-theme-text-secondary text-sm leading-relaxed mb-8 max-w-sm mx-auto">
          Please check your internet connection. The application will automatically reconnect when internet is restored.
        </p>

        {/* Retry Button */}
        <button
          onClick={onRetry}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
          {isChecking ? "Checking Connection..." : "Retry Now"}
        </button>

        {/* Tiny Status Indicator */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-theme-text-secondary/80">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>Currently Offline</span>
        </div>
      </div>
    </div>
  );
};
