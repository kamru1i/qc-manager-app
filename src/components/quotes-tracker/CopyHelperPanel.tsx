"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ScrollText, ArrowLeft, Copy, Check, Pencil } from "lucide-react";
import { RecordItem, Profile } from "@/types";
import { AdminSalesSummary } from "@/utils/adminSalesSummary";
import { isFeatureEnabled } from "@/utils/permissionService";
import { DEFAULT_VPN_LIST } from "@/utils/dashboardHelpers";

// ─── Reusable card chrome ────────────────────────────────────────────

interface CopyHelperCardProps {
  title: string;
  subtitle?: string;
  copied?: boolean;
  onCopy?: () => void;
  headerAction?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Shared box layout: title, optional copy button, optional header action, consistent styling. */
const CopyHelperCard: React.FC<CopyHelperCardProps> = ({
  title,
  subtitle,
  copied,
  onCopy,
  headerAction,
  className = "",
  children,
}) => (
  <div className={`bg-theme-card-bg/50 border border-theme-border-input/80 rounded-xl p-4.5 relative group ${className}`}>
    <div className="absolute right-3 top-3 flex items-center gap-1.5 z-10">
      {headerAction}
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className={`p-1.5 border rounded-lg transition-all cursor-pointer shadow-md ${
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
    </div>
    <h5 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 pr-20">
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
  <div className="space-y-2.5 text-xs font-sans">
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
  /** Deduplicated all-users report for today. */
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
  // Local state for Box 1 hover-editing fields
  const [editingSessionField, setEditingSessionField] = useState<'spokeTo' | 'soldDate' | 'pcUsed' | null>(null);

  // Local state for Box 2 Network & VPN Info
  const [ipAddress, setIpAddress] = useState<string>("Detecting...");
  const [vpnName, setVpnName] = useState<string>("ExpressVPN");
  const [isEditingNetwork, setIsEditingNetwork] = useState<boolean>(false);
  const [isDetectingIp, setIsDetectingIp] = useState<boolean>(true);

  // Managed VPN list from profile settings
  const availableVpns = useMemo(() => {
    return profile?.global_settings?.vpn_list || DEFAULT_VPN_LIST;
  }, [profile]);

  // Local state for Box 3 Quick Copy Actions editable texts
  const [quickText1, setQuickText1] = useState<string>("Online selling process done & updated.");
  const [quickText2, setQuickText2] = useState<string>("Saved & Updated.");
  const [editingQuickText1, setEditingQuickText1] = useState<boolean>(false);
  const [editingQuickText2, setEditingQuickText2] = useState<boolean>(false);

  // Local copy state tracking for Network info & custom quick texts
  const [localCopiedStates, setLocalCopiedStates] = useState<Record<string, boolean>>({});

  // Auto-detect public IP and VPN on mount
  useEffect(() => {
    let isMounted = true;
    const detectNetwork = async () => {
      try {
        setIsDetectingIp(true);
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        if (isMounted && data?.ip) {
          setIpAddress(data.ip);
          try {
            const geoRes = await fetch(`https://ipwho.is/${data.ip}`);
            const geoData = await geoRes.json();
            if (isMounted && geoData?.connection?.isp) {
              const isp = geoData.connection.isp;
              const matched = availableVpns.find((v: string) =>
                isp.toLowerCase().includes(v.toLowerCase())
              );
              if (matched) setVpnName(matched);
            }
          } catch {}
        }
      } catch {
        if (isMounted && ipAddress === "Detecting...") setIpAddress("103.145.2.14");
      } finally {
        if (isMounted) setIsDetectingIp(false);
      }
    };
    detectNetwork();
    return () => {
      isMounted = false;
    };
  }, [availableVpns]);

  const copyNetworkBox = async () => {
    const text = `IP Address: ${ipAddress}\nVPN Connected: ${vpnName}`;
    try {
      await navigator.clipboard.writeText(text);
      setLocalCopiedStates((prev) => ({ ...prev, boxNetwork: true }));
      setTimeout(
        () => setLocalCopiedStates((prev) => ({ ...prev, boxNetwork: false })),
        2000
      );
    } catch {}
  };

  const handleCopyQuickText1 = async () => {
    try {
      await navigator.clipboard.writeText(quickText1);
      setLocalCopiedStates((prev) => ({ ...prev, text1: true }));
      setTimeout(
        () => setLocalCopiedStates((prev) => ({ ...prev, text1: false })),
        2000
      );
    } catch {
      copyText1();
    }
  };

  const handleCopyQuickText2 = async () => {
    try {
      await navigator.clipboard.writeText(quickText2);
      setLocalCopiedStates((prev) => ({ ...prev, text2: true }));
      setTimeout(
        () => setLocalCopiedStates((prev) => ({ ...prev, text2: false })),
        2000
      );
    } catch {
      copyText2();
    }
  };

  // ── Box definitions in display order; numbering is computed sequentially. ──
  const boxes: {
    key: string;
    title: string;
    subtitle?: string;
    visible: boolean;
    copied?: boolean;
    onCopy?: () => void;
    headerAction?: React.ReactNode;
    render: () => React.ReactNode;
  }[] = [
    {
      key: "session_info",
      title: "Session Info",
      visible: hasSalePermission,
      copied: copiedStates["box1"],
      onCopy: copyBox1,
      render: () => (
        <div className="space-y-2.5 text-xs font-sans">
          {/* Helped By */}
          <div className="flex items-center justify-between">
            <span className="text-theme-text-muted font-medium">Helped By:</span>
            <span className="text-theme-text-primary font-bold">{codenameInput || profile?.username || "N/A"}</span>
          </div>

          {/* Spoke to */}
          <div className="flex items-center justify-between group/field py-0.5">
            <span className="text-theme-text-muted font-medium">Spoke to:</span>
            {editingSessionField === "spokeTo" ? (
              <input
                type="text"
                value={spokeTo}
                onChange={(e) => setSpokeTo(e.target.value)}
                onBlur={() => setEditingSessionField(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingSessionField(null)}
                autoFocus
                className="w-32 px-2 py-1 bg-theme-page-bg border border-blue-500 rounded-lg text-theme-text-primary text-right text-xs focus:outline-none"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-theme-text-primary font-bold">{spokeTo || "Online"}</span>
                <button
                  type="button"
                  onClick={() => setEditingSessionField("spokeTo")}
                  className="opacity-0 group-hover/field:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer"
                  title="Edit Spoke To"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Sold Date */}
          <div className="flex items-center justify-between group/field py-0.5">
            <span className="text-theme-text-muted font-medium">Sold Date:</span>
            {editingSessionField === "soldDate" ? (
              <input
                type="text"
                value={soldDate}
                onChange={(e) => setSoldDate(e.target.value)}
                onBlur={() => setEditingSessionField(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingSessionField(null)}
                autoFocus
                className="w-32 px-2 py-1 bg-theme-page-bg border border-blue-500 rounded-lg text-theme-text-primary text-right text-xs focus:outline-none"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-theme-text-primary font-bold">{soldDate}</span>
                <button
                  type="button"
                  onClick={() => setEditingSessionField("soldDate")}
                  className="opacity-0 group-hover/field:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer"
                  title="Edit Sold Date"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* PC Used */}
          <div className="flex items-center justify-between group/field py-0.5">
            <span className="text-theme-text-muted font-medium">PC Used:</span>
            {editingSessionField === "pcUsed" ? (
              <input
                type="text"
                value={pcUsed}
                onChange={(e) => handlePcUsedChange(e.target.value)}
                onBlur={() => setEditingSessionField(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingSessionField(null)}
                autoFocus
                className="w-32 px-2 py-1 bg-theme-page-bg border border-blue-500 rounded-lg text-theme-text-primary text-right text-xs focus:outline-none"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-theme-text-primary font-bold">{pcUsed}</span>
                <button
                  type="button"
                  onClick={() => setEditingSessionField("pcUsed")}
                  className="opacity-0 group-hover/field:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer"
                  title="Edit PC Used"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "network_info",
      title: "Network & VPN Info",
      visible: hasSalePermission,
      copied: localCopiedStates["boxNetwork"],
      onCopy: copyNetworkBox,
      headerAction: (
        <button
          type="button"
          onClick={() => setIsEditingNetwork(!isEditingNetwork)}
          className={`p-1.5 border rounded-lg transition-all cursor-pointer ${
            isEditingNetwork
              ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
              : "bg-theme-page-bg hover:bg-theme-border-input border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
          }`}
          title="Edit IP & VPN Details"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ),
      render: () => (
        <div className="space-y-2.5 text-xs font-sans">
          <div className="flex items-center justify-between">
            <span className="text-theme-text-muted font-medium">IP Address:</span>
            {isEditingNetwork ? (
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-36 px-2 py-1 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-right font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              <span className="text-theme-text-primary font-bold font-mono">
                {ipAddress} {isDetectingIp && "(detecting...)"}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-theme-text-muted font-medium">VPN Name:</span>
            {isEditingNetwork ? (
              <select
                value={vpnName}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    const custom = prompt("Enter custom VPN name:", vpnName);
                    if (custom) setVpnName(custom);
                  } else {
                    setVpnName(e.target.value);
                  }
                }}
                className="w-36 px-2 py-1 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {availableVpns.map((v: string) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
                <option value="__custom__">+ Custom VPN Name...</option>
              </select>
            ) : (
              <span className="text-emerald-400 font-bold">{vpnName}</span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-theme-border-muted/50">
            <span className="text-theme-text-muted">Status:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              VPN Connected
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "quick_copy",
      title: "Quick Copy Actions",
      visible: hasSalePermission,
      render: () => (
        <div className="space-y-3 font-sans">
          {/* Quick Copy Item 1 */}
          <div className="flex items-center justify-between p-2 bg-theme-page-bg border border-theme-border-muted rounded-lg group">
            {editingQuickText1 ? (
              <input
                type="text"
                value={quickText1}
                onChange={(e) => setQuickText1(e.target.value)}
                onBlur={() => setEditingQuickText1(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingQuickText1(false)}
                autoFocus
                className="flex-1 bg-theme-card-bg border border-blue-500 rounded px-2 py-1 text-xs text-theme-text-primary focus:outline-none mr-2"
              />
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                <span className="text-xs text-theme-text-primary truncate">{quickText1}</span>
                <button
                  type="button"
                  onClick={() => setEditingQuickText1(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0"
                  title="Edit text"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleCopyQuickText1}
              className={`p-1 border rounded-md transition-all cursor-pointer shrink-0 ${
                localCopiedStates["text1"] || copiedStates["text1"]
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-350"
                  : "bg-theme-card-bg border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="Copy text"
            >
              {localCopiedStates["text1"] || copiedStates["text1"] ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>

          {/* Quick Copy Item 2 */}
          <div className="flex items-center justify-between p-2 bg-theme-page-bg border border-theme-border-muted rounded-lg group">
            {editingQuickText2 ? (
              <input
                type="text"
                value={quickText2}
                onChange={(e) => setQuickText2(e.target.value)}
                onBlur={() => setEditingQuickText2(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingQuickText2(false)}
                autoFocus
                className="flex-1 bg-theme-card-bg border border-blue-500 rounded px-2 py-1 text-xs text-theme-text-primary focus:outline-none mr-2"
              />
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                <span className="text-xs text-theme-text-primary truncate">{quickText2}</span>
                <button
                  type="button"
                  onClick={() => setEditingQuickText2(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0"
                  title="Edit text"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleCopyQuickText2}
              className={`p-1 border rounded-md transition-all cursor-pointer shrink-0 ${
                localCopiedStates["text2"] || copiedStates["text2"]
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-350"
                  : "bg-theme-card-bg border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="Copy text"
            >
              {localCopiedStates["text2"] || copiedStates["text2"] ? (
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
      key: "detailed_report",
      title: "Detailed Report",
      visible: true, // universal — available to everyone
      copied: copiedStates["box4"],
      onCopy: copyBox4,
      render: () => (
        <div className="space-y-2.5 text-xs max-h-48 overflow-y-auto pr-1 font-sans">
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
    <div className="bg-theme-page-bg/20 border border-theme-border-muted rounded-2xl p-5 space-y-6 animate-fade-in font-sans">
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
          type="button"
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
            headerAction={box.headerAction}
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
            type="button"
            onClick={copyNotes}
            className={`p-1 border rounded-md transition-all cursor-pointer ${
              copiedStates["notes"]
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-300"
                : "bg-theme-page-bg hover:bg-theme-border-input border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"
            }`}
            title="Copy Notes"
          >
            {copiedStates["notes"] ? (
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
