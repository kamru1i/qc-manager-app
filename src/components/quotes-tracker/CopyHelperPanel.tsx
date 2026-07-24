"use client";

import React from "react";
import { ScrollText, ArrowLeft, Copy, Check } from "lucide-react";
import { RecordItem, Profile } from "@/types";
import { AdminSalesSummary } from "@/utils/adminSalesSummary";

import { isFeatureEnabled } from "@/utils/permissionService";

// ─── Reusable card chrome ────────────────────────────────────────────

interface CopyHelperCardProps {
  title: string;
  subtitle?: string;
  copied?: boolean;
  onCopy?: () => void;
  className?: string;
  children: React.ReactNode;
}

/** Shared box layout: title, optional copy button, consistent styling. */
const CopyHelperCard: React.FC<CopyHelperCardProps> = ({
  title,
  subtitle,
  copied,
  onCopy,
  className = "",
  children,
}) => (
  <div className={`bg-theme-card-bg/50 border border-theme-border-input/80 rounded-xl p-4.5 relative group ${className}`}>
    {onCopy && (
      <button
        onClick={onCopy}
        className={`absolute right-3 top-3 p-1.5 border rounded-lg transition-all cursor-pointer shadow-md ${
          copied
            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-300"
            : "bg-theme-page-bg hover:bg-theme-border-input border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
        }`}
        title="Copy to Clipboard"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    )}
    <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">
      {title}
      {subtitle && (
        <span className="block text-[10px] font-semibold text-theme-text-muted opacity-65 normal-case tracking-normal mt-0.5">
          {subtitle}
        </span>
      )}
    </h5>
    {children}
  </div>
);

// ─── Reusable Sales Summary body (user + admin variants) ─────────────

interface SalesSummaryBodyProps {
  soldDate: string;
  /** Total row value; shown above Sold/Unsold when provided. */
  totalAttempt?: number;
  soldCount: number;
  unsoldCount: number;
  /** Header label; defaults to the user report title. */
  reportLabel?: string;
  /** Label for the total row (user: "Total Attempt", admin: "Total Sale Attempt"). */
  totalLabel?: string;
}

/** Stats rows shared by the user and admin Sales Summary boxes. */
const SalesSummaryBody: React.FC<SalesSummaryBodyProps> = ({
  soldDate,
  totalAttempt,
  soldCount,
  unsoldCount,
  reportLabel = "Sales Report",
  totalLabel = "Total Attempt",
}) => (
  <div className="space-y-2.5 text-xs">
    <div className="flex items-center justify-between border-b border-theme-border-muted pb-2">
      <span className="text-theme-text-primary font-bold">{reportLabel} | Date: {soldDate}</span>
    </div>
    {totalAttempt !== undefined && (
      <div className="flex items-center justify-between">
        <span className="text-theme-text-muted font-medium">{totalLabel}:</span>
        <span className="text-theme-text-primary font-semibold">{totalAttempt} Sale</span>
      </div>
    )}
    <div className="flex items-center justify-between">
      <span className="text-emerald-400 font-medium">Sold:</span>
      <span className="text-emerald-300 font-semibold">{soldCount} Sale</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-rose-450 font-medium">Unsold:</span>
      <span className="text-rose-350 font-semibold">{unsoldCount} Sale</span>
    </div>
  </div>
);

// ─── Panel ───────────────────────────────────────────────────────────

interface CopyHelperPanelProps {
  profile: Profile | null;
  /** Whether the user has the "Sale" file type permission (controls box visibility). */
  hasSalePermission: boolean;
  codenameInput: string;
  spokeTo: string;
  setSpokeTo: (val: string) => void;
  soldDate: string;
  setSoldDate: (val: string) => void;
  pcUsed: string;
  handlePcUsedChange: (val: string) => void;
  reportNotes: string;
  handleNotesChange: (val: string) => void;
  totalAttempt: number;
  soldCount: number;
  unsoldCount: number;
  allSales: boolean;
  hasSubmissions: boolean;
  todayUserRecords: RecordItem[];
  /** Deduplicated all-users report for today (Box 5). */
  adminSalesSummary: AdminSalesSummary;
  copyBox1: () => void;
  copyBox2: () => void;
  copyBox4: () => void;
  copyAdminSummary: () => void;
  copyText1: () => void;
  copyText2: () => void;
  copyNotes: () => void;
  copiedStates: Record<string, boolean>;
  setShowReportHelper: (val: boolean) => void;
}

export const CopyHelperPanel: React.FC<CopyHelperPanelProps> = ({
  profile,
  hasSalePermission,
  codenameInput,
  spokeTo,
  setSpokeTo,
  soldDate,
  setSoldDate,
  pcUsed,
  handlePcUsedChange,
  reportNotes,
  handleNotesChange,
  totalAttempt,
  soldCount,
  unsoldCount,
  allSales,
  hasSubmissions,
  todayUserRecords,
  adminSalesSummary,
  copyBox1,
  copyBox2,
  copyBox4,
  copyAdminSummary,
  copyText1,
  copyText2,
  copyNotes,
  copiedStates,
  setShowReportHelper,
}) => {
  // ── Box definitions in display order; numbering is computed from the
  //    visible subset so it stays sequential when boxes are hidden. ──
  const boxes: {
    key: string;
    title: string;
    subtitle?: string;
    visible: boolean;
    copied?: boolean;
    onCopy?: () => void;
    render: () => React.ReactNode;
  }[] = [
    {
      key: "session_info",
      title: "Session Info",
      visible: hasSalePermission,
      copied: copiedStates["box1"],
      onCopy: copyBox1,
      render: () => (
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-theme-text-muted font-medium">Helped By:</span>
            <span className="text-theme-text-primary font-bold">{codenameInput || profile?.username || "N/A"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-theme-text-muted font-medium">Spoke to:</span>
            <input
              type="text"
              value={spokeTo}
              onChange={(e) => setSpokeTo(e.target.value)}
              className="w-32 px-2.5 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-right placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-theme-text-muted font-medium">Sold Date:</span>
            <input
              type="text"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
              className="w-32 px-2.5 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-right placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-theme-text-muted font-medium">PC Used:</span>
            <input
              type="text"
              value={pcUsed}
              onChange={(e) => handlePcUsedChange(e.target.value)}
              className="w-32 px-2.5 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-right placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>
        </div>
      ),
    },
    {
      key: "sales_summary",
      title: "Sales Summary",
      visible: hasSalePermission,
      copied: copiedStates["box2"],
      onCopy: copyBox2,
      render: () => (
        <SalesSummaryBody
          soldDate={soldDate}
          totalAttempt={totalAttempt}
          soldCount={soldCount}
          unsoldCount={unsoldCount}
        />
      ),
    },
    {
      key: "quick_copy",
      title: "Quick Copy Actions",
      visible: hasSalePermission,
      render: () => (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-theme-page-bg border border-theme-border-muted rounded-lg group">
            <span className="text-xs text-theme-text-primary">Online selling process done & updated.</span>
            <button
              onClick={copyText1}
              className={`p-1 border rounded-md transition-all cursor-pointer ${
                copiedStates["text1"]
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-350"
                  : "bg-theme-card-bg border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="Copy text"
            >
              {copiedStates["text1"] ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between p-2 bg-theme-page-bg border border-theme-border-muted rounded-lg group">
            <span className="text-xs text-theme-text-primary">Saved & Updated.</span>
            <button
              onClick={copyText2}
              className={`p-1 border rounded-md transition-all cursor-pointer ${
                copiedStates["text2"]
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-350"
                  : "bg-theme-card-bg border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="Copy text"
            >
              {copiedStates["text2"] ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "detailed_report",
      title: "Detailed Report",
      visible: true, // universal — available to everyone
      copied: copiedStates["box4"],
      onCopy: copyBox4,
      render: () => (
        <div className="space-y-2.5 text-xs max-h-48 overflow-y-auto pr-1">
          <div className="flex flex-col border-b border-theme-border-muted pb-2">
            <span className="text-theme-text-primary font-bold">
              {allSales && hasSubmissions ? "Sales Report" : "Files Report"} | Date: {soldDate}
            </span>
            <span className="text-theme-text-muted text-[10px] mt-0.5 font-semibold">
              {allSales && hasSubmissions
                ? `Total Sale: ${todayUserRecords.length} Sale`
                : `Total Files: ${todayUserRecords.length} File`}
            </span>
          </div>
          <div className="border-t border-theme-border-input/40 my-1 pt-1.5 space-y-1">
            {todayUserRecords.length > 0 ? (
              todayUserRecords.map((r, i) => {
                const cleanName = r.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, "");
                return (
                  <div key={r.id || i} className="text-theme-text-secondary font-mono text-[11px] py-0.5">
                    {cleanName} {r.branch_name} {r.file_type}
                  </div>
                );
              })
            ) : (
              <div className="text-theme-text-muted italic text-[11px]">No entries today</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "admin_sales_summary",
      title: "Sales Summary",
      subtitle: "(Sales Report for Admin)",
      visible: hasSalePermission && isFeatureEnabled('copy_helper_admin_summary', profile?.global_settings, profile),
      copied: copiedStates["boxAdmin"],
      onCopy: copyAdminSummary,
      render: () => (
        <SalesSummaryBody
          soldDate={soldDate}
          totalLabel="Total Sale Attempt"
          totalAttempt={adminSalesSummary.totalAttempts}
          soldCount={adminSalesSummary.totalSold}
          unsoldCount={adminSalesSummary.totalUnsold}
        />
      ),
    },
  ];

  const visibleBoxes = boxes.filter((b) => b.visible);

  return (
    <div className="bg-theme-page-bg/20 border border-theme-border-muted rounded-2xl p-5 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-md font-bold text-theme-text-primary flex items-center gap-2">
            <ScrollText className="h-4.5 w-4.5 text-blue-500" />
            Sales & Files Copy Helper Dashboard
          </h4>
          <p className="text-[11px] text-theme-text-muted mt-0.5">
            Copy pre-formatted logs for Slack, WhatsApp, or reports.
          </p>
        </div>
        <button
          onClick={() => setShowReportHelper(false)}
          className="flex items-center justify-center p-2 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer"
          title="Back to Table"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleBoxes.map((box, index) => (
          <CopyHelperCard
            key={box.key}
            title={`Box ${index + 1}: ${box.title}`}
            subtitle={box.subtitle}
            copied={box.copied}
            onCopy={box.onCopy}
            className={box.key === "quick_copy" ? "flex flex-col justify-between" : ""}
          >
            {box.render()}
          </CopyHelperCard>
        ))}
      </div>
      {/* Comment/Important Notes Box */}
      <div className="bg-theme-card-bg/40 border border-theme-border-muted rounded-xl p-4 space-y-2.5">
        <div className="flex justify-between items-center">
          <h5 className="text-xs font-bold text-rose-500 uppercase tracking-wider">Important Notes</h5>
          <button
            onClick={copyNotes}
            className={`p-1 border rounded-md transition-all cursor-pointer ${
              copiedStates['notes']
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-300"
                : "bg-theme-page-bg hover:bg-theme-border-input border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
            }`}
            title="Copy Notes"
          >
            {copiedStates['notes'] ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
        <textarea
          value={reportNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          className="w-full h-20 bg-theme-page-bg border border-theme-border-input rounded-lg text-rose-400 placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-rose-500/30 text-xs p-3 font-semibold resize-none"
        />
      </div>
    </div>
  );
};
