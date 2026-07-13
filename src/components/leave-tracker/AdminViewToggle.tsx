import React from "react";

interface AdminViewToggleProps {
  viewMode: "all" | "mine";
  onChange: (mode: "all" | "mine") => void;
}

export const AdminViewToggle: React.FC<AdminViewToggleProps> = ({
  viewMode,
  onChange,
}) => {
  return (
    <div className="flex bg-theme-page-bg border border-theme-border-input p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto shrink-0">
      <button
        onClick={() => onChange("mine")}
        className={`px-3 py-1 rounded-md transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
          viewMode === "mine"
            ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-950/10"
            : "text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-card-bg/30"
        }`}
      >
        My Data
      </button>
      <button
        onClick={() => onChange("all")}
        className={`px-3 py-1 rounded-md transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
          viewMode === "all"
            ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-950/10"
            : "text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-card-bg/30"
        }`}
      >
        All Data
      </button>
    </div>
  );
};
