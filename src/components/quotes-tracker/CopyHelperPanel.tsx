"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ScrollText, ArrowLeft, Copy, Check, Pencil, Globe } from "lucide-react";
import { RecordItem, Profile } from "@/types";
import { AdminSalesSummary, getTodaySalesRecords, calculateAdminSalesSummary } from "@/utils/adminSalesSummary";
import { isFeatureEnabled } from "@/utils/permissionService";
import { DEFAULT_VPN_LIST } from "@/utils/dashboardHelpers";
import { Modal } from "@/components/common/Modal";

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

// ─── Reusable Editable Date Header Component ─────────────────────────────

interface EditableDateHeaderProps {
  prefix: string;
  suffix?: string;
  soldDate: string;
  setSoldDate: (val: string) => void;
}

const EditableDateHeader: React.FC<EditableDateHeaderProps> = ({
  prefix,
  suffix,
  soldDate,
  setSoldDate,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // Convert DD/MM/YYYY string to YYYY-MM-DD for native date input
  const isoDate = useMemo(() => {
    const parts = soldDate.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return '';
  }, [soldDate]);

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [year, month, day] = val.split('-');
      setSoldDate(`${day}/${month}/${year}`);
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5 group/date select-none">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <span className="text-theme-text-primary font-bold text-xs">{prefix} | Date:</span>
          <input
            type="date"
            value={isoDate}
            onChange={handleDateInputChange}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="px-2 py-0.5 bg-theme-page-bg border border-blue-500 rounded-md text-xs text-theme-text-primary focus:outline-none cursor-pointer font-sans"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setIsEditing(true)}>
          <span className="text-theme-text-primary font-bold text-xs">
            {prefix} | Date: {soldDate} {suffix || ''}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="opacity-0 group-hover/date:opacity-100 p-0.5 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0"
            title="Change report date"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Reusable Sales Summary body (user + admin variants) ─────────────

interface SalesSummaryBodyProps {
  soldDate: string;
  setSoldDate: (val: string) => void;
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
  setSoldDate,
  totalAttempt,
  soldCount,
  unsoldCount,
  reportLabel = "Sales Report",
  totalLabel = "Total Attempt",
}) => (
  <div className="space-y-2.5 text-xs font-sans">
    <div className="flex items-center justify-between border-b border-theme-border-muted pb-2">
      <EditableDateHeader
        prefix={reportLabel}
        soldDate={soldDate}
        setSoldDate={setSoldDate}
      />
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
  adminSalesSummary: AdminSalesSummary;
  records?: RecordItem[];
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
  records,
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
  const [editingSessionField, setEditingSessionField] = useState<'spokeTo' | 'soldDate' | 'pcUsed' | null>(null);

  const getInitialDdMmYyyy = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const [box4Date, setBox4Date] = useState<string>(soldDate || getInitialDdMmYyyy());
  const [box5Date, setBox5Date] = useState<string>(soldDate || getInitialDdMmYyyy());
  const [box6Date, setBox6Date] = useState<string>(soldDate || getInitialDdMmYyyy());

  const effectiveCodename = codenameInput || profile?.username || "";
  const allMonthRecords = useMemo(() => records || todayUserRecords || [], [records, todayUserRecords]);

  const parseDdMmYyyyToTargetStr = useCallback((dStr: string) => {
    if (!dStr) return new Date().toDateString();
    const parts = dStr.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.toDateString();
    }
    const fallback = new Date(dStr);
    return isNaN(fallback.getTime()) ? new Date().toDateString() : fallback.toDateString();
  }, []);

  const box4TargetDate = useMemo(() => parseDdMmYyyyToTargetStr(box4Date), [box4Date, parseDdMmYyyyToTargetStr]);
  const box4UserRecords = useMemo(() => {
    return allMonthRecords.filter((r) => {
      const matchesDate = new Date(r.submitted_at).toDateString() === box4TargetDate;
      const matchesUser = r.codename.toUpperCase() === effectiveCodename.toUpperCase();
      return matchesDate && matchesUser;
    });
  }, [allMonthRecords, effectiveCodename, box4TargetDate]);

  const box4Sales = useMemo(() => box4UserRecords.filter((r) => r.file_type === "Sale"), [box4UserRecords]);
  const box4SoldCount = useMemo(() => box4Sales.filter((r) => r.file_name.endsWith(" [SOLD]")).length, [box4Sales]);
  const box4UnoldCount = useMemo(() => box4Sales.filter((r) => r.file_name.endsWith(" [UNSOLD]")).length, [box4Sales]);
  const box4TotalAttempt = useMemo(() => box4Sales.length, [box4Sales]);

  const box5TargetDate = useMemo(() => parseDdMmYyyyToTargetStr(box5Date), [box5Date, parseDdMmYyyyToTargetStr]);
  const box5UserRecords = useMemo(() => {
    return allMonthRecords.filter((r) => {
      const matchesDate = new Date(r.submitted_at).toDateString() === box5TargetDate;
      const matchesUser = r.codename.toUpperCase() === effectiveCodename.toUpperCase();
      return matchesDate && matchesUser;
    });
  }, [allMonthRecords, effectiveCodename, box5TargetDate]);

  const box5AllSales = useMemo(() => {
    return box5UserRecords.length > 0 && box5UserRecords.every((r) => r.file_type === "Sale");
  }, [box5UserRecords]);

  const box5HasSubmissions = useMemo(() => box5UserRecords.length > 0, [box5UserRecords]);

  const box6TargetDate = useMemo(() => parseDdMmYyyyToTargetStr(box6Date), [box6Date, parseDdMmYyyyToTargetStr]);
  const box6AdminSummary = useMemo<AdminSalesSummary>(() => {
    const saleRecords = getTodaySalesRecords(allMonthRecords, box6TargetDate);
    return calculateAdminSalesSummary(saleRecords);
  }, [allMonthRecords, box6TargetDate]);

  const [ipAddress, setIpAddress] = useState<string>("Detecting...");
  const [vpnName, setVpnName] = useState<string>("None");
  const [isVpnConnected, setIsVpnConnected] = useState<boolean>(false);
  const [editingNetworkField, setEditingNetworkField] = useState<'vpnName' | 'ipAddress' | null>(null);
  const [isDetectingIp, setIsDetectingIp] = useState<boolean>(true);
  const [showCustomVpnModal, setShowCustomVpnModal] = useState<boolean>(false);
  const [customVpnInput, setCustomVpnInput] = useState<string>("");

  const availableVpns = useMemo(() => {
    return profile?.global_settings?.vpn_list || DEFAULT_VPN_LIST;
  }, [profile]);

  const [quickText1, setQuickText1] = useState<string>("Online selling process done & updated.");
  const [quickText2, setQuickText2] = useState<string>("Saved & Updated.");
  const [editingQuickText1, setEditingQuickText1] = useState<boolean>(false);
  const [editingQuickText2, setEditingQuickText2] = useState<boolean>(false);

  const [localCopiedStates, setLocalCopiedStates] = useState<Record<string, boolean>>({});

  const handleCopyBox4Summary = async () => {
    const text = `*Sales Report | Date: ${box4Date}*\n*Total Attempt:* ${box4TotalAttempt} Sale\n*Sold:* ${box4SoldCount} Sale\n*Unsold:* ${box4UnoldCount} Sale`;
    try {
      await navigator.clipboard.writeText(text);
      setLocalCopiedStates((prev) => ({ ...prev, box2: true }));
      setTimeout(() => setLocalCopiedStates((prev) => ({ ...prev, box2: false })), 2000);
    } catch {
      copyBox2();
    }
  };

  const handleCopyBox5DetailedReport = async () => {
    const title = box5AllSales && box5HasSubmissions
      ? `*Sales Report | Date: ${box5Date}*`
      : `*Files Report | Date: ${box5Date}*`;
    const subtitle = box5AllSales && box5HasSubmissions
      ? `*Total Sale:* ${box5UserRecords.length} Sale`
      : `*Total Files:* ${box5UserRecords.length} File`;
    const separator = `-----------------------`;
    const lines = box5UserRecords.map((r) => {
      const cleanName = r.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, "");
      return `${cleanName} ${r.branch_name} ${r.file_type}`;
    });
    const text = `${title}\n${subtitle}\n${separator}\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setLocalCopiedStates((prev) => ({ ...prev, box4: true }));
      setTimeout(() => setLocalCopiedStates((prev) => ({ ...prev, box4: false })), 2000);
    } catch {
      copyBox4();
    }
  };

  const handleCopyBox6AdminSummary = async () => {
    const { totalSold, totalUnsold, totalAttempts } = box6AdminSummary;
    const text = `*Sales Report | Date: ${box6Date}*\n*Total Sale Attempt:* ${totalAttempts} Sale\n*Sold:* ${totalSold} Sale\n*Unsold:* ${totalUnsold} Sale`;
    try {
      await navigator.clipboard.writeText(text);
      setLocalCopiedStates((prev) => ({ ...prev, boxAdmin: true }));
      setTimeout(() => setLocalCopiedStates((prev) => ({ ...prev, boxAdmin: false })), 2000);
    } catch {
      copyAdminSummary();
    }
  };

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
            if (isMounted) {
              const isProxyOrVpn = !!(geoData?.security?.vpn || geoData?.security?.proxy || geoData?.security?.tor);
              const isp = geoData?.connection?.isp || "";
              const matched = availableVpns.find((v: string) => isp.toLowerCase().includes(v.toLowerCase()));
              if (isProxyOrVpn || matched) {
                setIsVpnConnected(true);
                setVpnName(matched || isp || "VPN Active");
              } else {
                setIsVpnConnected(false);
                setVpnName("None");
              }
            }
          } catch {
            if (isMounted) {
              setIsVpnConnected(false);
              setVpnName("None");
            }
          }
        }
      } catch {
        if (isMounted) setIpAddress("Unavailable");
      } finally {
        if (isMounted) setIsDetectingIp(false);
      }
    };
    detectNetwork();
    return () => { isMounted = false; };
  }, [availableVpns]);

  const copyNetworkBox = async () => {
    const text = `VPN Connected: ${vpnName}\nIP Address: ${ipAddress}`;
    try {
      await navigator.clipboard.writeText(text);
      setLocalCopiedStates((prev) => ({ ...prev, boxNetwork: true }));
      setTimeout(() => setLocalCopiedStates((prev) => ({ ...prev, boxNetwork: false })), 2000);
    } catch {}
  };

  const handleCopyQuickText1 = async () => {
    try {
      await navigator.clipboard.writeText(quickText1);
      setLocalCopiedStates((prev) => ({ ...prev, text1: true }));
      setTimeout(() => setLocalCopiedStates((prev) => ({ ...prev, text1: false })), 2000);
    } catch { copyText1(); }
  };

  const handleCopyQuickText2 = async () => {
    try {
      await navigator.clipboard.writeText(quickText2);
      setLocalCopiedStates((prev) => ({ ...prev, text2: true }));
      setTimeout(() => setLocalCopiedStates((prev) => ({ ...prev, text2: false })), 2000);
    } catch { copyText2(); }
  };

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
          <div className="flex items-center justify-between">
            <span className="text-theme-text-muted font-medium">Helped By:</span>
            <span className="text-theme-text-primary font-bold">{codenameInput || profile?.username || "N/A"}</span>
          </div>
          <div className="flex items-center justify-between group/field py-0.5">
            <span className="text-theme-text-muted font-medium">Spoke to:</span>
            {editingSessionField === "spokeTo" ? (
              <input type="text" value={spokeTo} onChange={(e) => setSpokeTo(e.target.value)} onBlur={() => setEditingSessionField(null)} onKeyDown={(e) => e.key === "Enter" && setEditingSessionField(null)} autoFocus className="w-32 px-2 py-1 bg-theme-page-bg border border-blue-500 rounded-lg text-theme-text-primary text-right text-xs focus:outline-none" />
            ) : (
              <div className="flex items-center gap-1.5 justify-end">
                <button type="button" onClick={() => setEditingSessionField("spokeTo")} className="opacity-0 group-hover/field:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0" title="Edit Spoke To"><Pencil className="h-3 w-3" /></button>
                <span className="text-theme-text-primary font-bold text-right">{spokeTo || "Online"}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between group/field py-0.5">
            <span className="text-theme-text-muted font-medium">Sold Date:</span>
            {editingSessionField === "soldDate" ? (
              <input type="date" value={(() => { const parts = soldDate.split('/'); return parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : ''; })()} onChange={(e) => { const val = e.target.value; if (val) { const [year, month, day] = val.split('-'); setSoldDate(`${day}/${month}/${year}`); } setEditingSessionField(null); }} onBlur={() => setEditingSessionField(null)} autoFocus className="w-32 px-2 py-1 bg-theme-page-bg border border-blue-500 rounded-lg text-theme-text-primary text-right text-xs focus:outline-none cursor-pointer" />
            ) : (
              <div className="flex items-center gap-1.5 justify-end">
                <button type="button" onClick={() => setEditingSessionField("soldDate")} className="opacity-0 group-hover/field:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0" title="Edit Sold Date"><Pencil className="h-3 w-3" /></button>
                <span className="text-theme-text-primary font-bold text-right">{soldDate}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between group/field py-0.5">
            <span className="text-theme-text-muted font-medium">PC Used:</span>
            {editingSessionField === "pcUsed" ? (
              <input type="text" value={pcUsed} onChange={(e) => handlePcUsedChange(e.target.value)} onBlur={() => setEditingSessionField(null)} onKeyDown={(e) => e.key === "Enter" && setEditingSessionField(null)} autoFocus className="w-32 px-2 py-1 bg-theme-page-bg border border-blue-500 rounded-lg text-theme-text-primary text-right text-xs focus:outline-none" />
            ) : (
              <div className="flex items-center gap-1.5 justify-end">
                <button type="button" onClick={() => setEditingSessionField("pcUsed")} className="opacity-0 group-hover/field:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0" title="Edit PC Used"><Pencil className="h-3 w-3" /></button>
                <span className="text-theme-text-primary font-bold text-right">{pcUsed}</span>
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
      render: () => (
        <div className="space-y-2.5 text-xs font-sans">
          <div className="flex items-center justify-between group/field py-0.5">
            <span className="text-theme-text-muted font-medium">VPN Name:</span>
            {editingNetworkField === "vpnName" ? (
              <select value={vpnName} onChange={(e) => { const val = e.target.value; if (val === "__custom__") { setCustomVpnInput(""); setShowCustomVpnModal(true); } else { setVpnName(val); setIsVpnConnected(val !== "None"); setEditingNetworkField(null); } }} onBlur={() => setEditingNetworkField(null)} autoFocus className="w-36 px-2 py-1 bg-theme-page-bg border border-blue-500 rounded-lg text-theme-text-primary text-right text-xs focus:outline-none cursor-pointer">
                <option value="None">None (Disconnected)</option>
                {availableVpns.map((v: string) => <option key={v} value={v}>{v}</option>)}
                <option value="__custom__">+ Custom VPN Name...</option>
              </select>
            ) : (
              <div className="flex items-center gap-1.5 justify-end">
                <button type="button" onClick={() => setEditingNetworkField("vpnName")} className="opacity-0 group-hover/field:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0" title="Edit VPN Name"><Pencil className="h-3 w-3" /></button>
                <span className={isVpnConnected ? "text-emerald-400 font-bold text-right" : "text-theme-text-secondary font-semibold text-right"}>{vpnName}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between group/field py-0.5">
            <span className="text-theme-text-muted font-medium">IP Address:</span>
            {editingNetworkField === "ipAddress" ? (
              <input type="text" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} onBlur={() => setEditingNetworkField(null)} onKeyDown={(e) => e.key === "Enter" && setEditingNetworkField(null)} autoFocus className="w-36 px-2 py-1 bg-theme-page-bg border border-blue-500 rounded-lg text-theme-text-primary text-right font-mono text-xs focus:outline-none" />
            ) : (
              <div className="flex items-center gap-1.5 justify-end">
                <button type="button" onClick={() => setEditingNetworkField("ipAddress")} className="opacity-0 group-hover/field:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0" title="Edit IP Address"><Pencil className="h-3 w-3" /></button>
                <span className="text-theme-text-primary font-bold font-mono text-right">{ipAddress} {isDetectingIp && "(detecting...)"}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-theme-border-muted/50">
            <span className="text-theme-text-muted">Status:</span>
            {isVpnConnected ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> VPN Connected</span>
            ) : (
              <span className="text-theme-text-muted font-semibold flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> VPN Off (Disconnected)</span>
            )}
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
          <div className="flex items-center justify-between p-2 bg-theme-page-bg border border-theme-border-muted rounded-lg group/item">
            {editingQuickText1 ? (
              <input type="text" value={quickText1} onChange={(e) => setQuickText1(e.target.value)} onBlur={() => setEditingQuickText1(false)} onKeyDown={(e) => e.key === "Enter" && setEditingQuickText1(false)} autoFocus className="flex-1 bg-theme-card-bg border border-blue-500 rounded px-2 py-1 text-xs text-theme-text-primary focus:outline-none mr-2" />
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                <span className="text-xs text-theme-text-primary truncate">{quickText1}</span>
                <button type="button" onClick={() => setEditingQuickText1(true)} className="opacity-0 group-hover/item:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0" title="Edit text"><Pencil className="h-3 w-3" /></button>
              </div>
            )}
            <button type="button" onClick={handleCopyQuickText1} className={`p-1 border rounded-md transition-all cursor-pointer shrink-0 ${localCopiedStates["text1"] || copiedStates["text1"] ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-350" : "bg-theme-card-bg border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"}`} title="Copy text">{localCopiedStates["text1"] || copiedStates["text1"] ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}</button>
          </div>
          <div className="flex items-center justify-between p-2 bg-theme-page-bg border border-theme-border-muted rounded-lg group/item">
            {editingQuickText2 ? (
              <input type="text" value={quickText2} onChange={(e) => setQuickText2(e.target.value)} onBlur={() => setEditingQuickText2(false)} onKeyDown={(e) => e.key === "Enter" && setEditingQuickText2(false)} autoFocus className="flex-1 bg-theme-card-bg border border-blue-500 rounded px-2 py-1 text-xs text-theme-text-primary focus:outline-none mr-2" />
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                <span className="text-xs text-theme-text-primary truncate">{quickText2}</span>
                <button type="button" onClick={() => setEditingQuickText2(true)} className="opacity-0 group-hover/item:opacity-100 p-1 text-theme-text-muted hover:text-blue-400 rounded transition-all cursor-pointer shrink-0" title="Edit text"><Pencil className="h-3 w-3" /></button>
              </div>
            )}
            <button type="button" onClick={handleCopyQuickText2} className={`p-1 border rounded-md transition-all cursor-pointer shrink-0 ${localCopiedStates["text2"] || copiedStates["text2"] ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-350" : "bg-theme-card-bg border-theme-border-input text-theme-text-muted hover:text-theme-text-primary"}`} title="Copy text">{localCopiedStates["text2"] || copiedStates["text2"] ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}</button>
          </div>
        </div>
      ),
    },
    {
      key: "sales_summary",
      title: "Sales Summary",
      visible: hasSalePermission,
      copied: localCopiedStates["box2"] || copiedStates["box2"],
      onCopy: handleCopyBox4Summary,
      render: () => (
        <SalesSummaryBody
          soldDate={box4Date}
          setSoldDate={setBox4Date}
          totalAttempt={box4TotalAttempt}
          soldCount={box4SoldCount}
          unsoldCount={box4UnoldCount}
        />
      ),
    },
    {
      key: "detailed_report",
      title: "Detailed Report",
      visible: true,
      copied: localCopiedStates["box4"] || copiedStates["box4"],
      onCopy: handleCopyBox5DetailedReport,
      render: () => (
        <div className="space-y-2.5 text-xs max-h-48 overflow-y-auto pr-1 font-sans">
          <div className="flex flex-col border-b border-theme-border-muted pb-2">
            <EditableDateHeader
              prefix={box5AllSales && box5HasSubmissions ? "Sales Report" : "Files Report"}
              soldDate={box5Date}
              setSoldDate={setBox5Date}
            />
            <span className="text-theme-text-muted text-[10px] mt-0.5 font-semibold">
              {box5AllSales && box5HasSubmissions
                ? `Total Sale: ${box5UserRecords.length} Sale`
                : `Total Files: ${box5UserRecords.length} File`}
            </span>
          </div>
          <div className="border-t border-theme-border-input/40 my-1 pt-1.5 space-y-1">
            {box5UserRecords.length > 0 ? (
              box5UserRecords.map((r, i) => {
                const cleanName = r.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, "");
                return (
                  <div key={r.id || i} className="text-theme-text-secondary font-mono text-[11px] py-0.5">
                    {cleanName} {r.branch_name} {r.file_type}
                  </div>
                );
              })
            ) : (
              <div className="text-theme-text-muted italic text-[11px]">No entries for this date</div>
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
      copied: localCopiedStates["boxAdmin"] || copiedStates["boxAdmin"],
      onCopy: handleCopyBox6AdminSummary,
      render: () => (
        <SalesSummaryBody
          soldDate={box6Date}
          setSoldDate={setBox6Date}
          totalLabel="Total Sale Attempt"
          totalAttempt={box6AdminSummary.totalAttempts}
          soldCount={box6AdminSummary.totalSold}
          unsoldCount={box6AdminSummary.totalUnsold}
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

      {/* Custom VPN Name Modal */}
      <Modal
        isOpen={showCustomVpnModal}
        onClose={() => {
          setShowCustomVpnModal(false);
          setEditingNetworkField(null);
        }}
        title="Add Custom VPN Name"
        icon={<Globe className="h-5 w-5 text-blue-400" />}
      >
        <div className="space-y-4 pt-1 font-sans">
          <p className="text-xs text-theme-text-muted">
            Enter the name of the custom VPN provider to use for this session.
          </p>

          <div>
            <label className="block text-xs font-semibold text-theme-text-muted mb-1 uppercase tracking-wider">
              VPN Provider Name
            </label>
            <input
              type="text"
              value={customVpnInput}
              onChange={(e) => setCustomVpnInput(e.target.value)}
              placeholder="e.g. ProtonVPN, Windscribe"
              autoFocus
              className="w-full bg-theme-page-bg border border-theme-border-input rounded-xl px-3.5 py-2.5 text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:border-blue-500 font-sans"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (customVpnInput.trim()) {
                    setVpnName(customVpnInput.trim());
                    setIsVpnConnected(true);
                    setShowCustomVpnModal(false);
                    setEditingNetworkField(null);
                  }
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-theme-border-muted">
            <button
              type="button"
              onClick={() => {
                setShowCustomVpnModal(false);
                setEditingNetworkField(null);
              }}
              className="px-4 py-2 border border-theme-border-input bg-theme-card-bg hover:bg-theme-border-input text-theme-text-secondary rounded-xl text-xs font-semibold transition-all cursor-pointer font-sans"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!customVpnInput.trim()}
              onClick={() => {
                if (customVpnInput.trim()) {
                  setVpnName(customVpnInput.trim());
                  setIsVpnConnected(true);
                  setShowCustomVpnModal(false);
                  setEditingNetworkField(null);
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer font-sans shadow-md"
            >
              Set VPN Name
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
