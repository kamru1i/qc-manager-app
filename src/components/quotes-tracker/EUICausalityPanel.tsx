"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  PlusCircle,
  CloudLightning,
  Loader2,
  Edit2,
  X
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/utils/supabase";
import { Profile } from "@/types";

interface TitleItem {
  id: string;
  text: string;
}

interface AdditionalDriver {
  id: number;
  titles: TitleItem[];
}

export interface EUICausalityPanelProps {
  profile: Profile | null;
  isOnline: boolean;
}

/**
 * IDs that are NOT counted in the sequential numbered list.
 * eui-ph, eui-occupation, eui-industry → top un-numbered header fields
 * eui-parking-day, eui-parking-night   → sub-items under "Vehicle Parking"
 */
const UNNUMBERED_IDS = new Set([
  "eui-ph",
  "eui-occupation",
  "eui-industry",
  "eui-parking-day",
  "eui-parking-night"
]);

/**
 * Exact EUI Causality default format as specified:
 *
 * PH –
 * Occupation –
 * Industry –
 * 1.  Homeowner yes/no -
 * 2.  Access to other cars -
 * 3.  How many cars in the household -
 * 4.  Marital Status -
 * 5.  UK resident date –
 * 6.  License obtained date -
 * 7.  Quote Email --
 * 8.  Phone number -
 * 9.  Raw quote reference -
 * 10. NCD -
 * 11. Registered keeper and Owner -
 * 12. Vehicle purchase date -
 * 13. Usage of vehicle -
 * 14. Annual mileage -
 * 15. Vehicle Price -
 * 16. Vehicle Parking
 *          Day:
 *          Night:
 * 17. Children -
 * 18. Type of Cover -
 */
const DEFAULT_MAIN_TITLES: TitleItem[] = [
  { id: "eui-ph",           text: "PH –" },
  { id: "eui-occupation",   text: "Occupation –" },
  { id: "eui-industry",     text: "Industry –" },
  { id: "eui-homeowner",    text: "Homeowner yes/no -" },
  { id: "eui-access",       text: "Access to other cars -" },
  { id: "eui-household",    text: "How many cars in the household -" },
  { id: "eui-marital",      text: "Marital Status -" },
  { id: "eui-uk-resident",  text: "UK resident date –" },
  { id: "eui-license",      text: "License obtained date -" },
  { id: "eui-email",        text: "Quote Email --" },
  { id: "eui-phone",        text: "Phone number -" },
  { id: "eui-raw-quote",    text: "Raw quote reference -" },
  { id: "eui-ncd",          text: "NCD -" },
  { id: "eui-keeper-owner", text: "Registered keeper and Owner -" },
  { id: "eui-purchase-date",text: "Vehicle purchase date -" },
  { id: "eui-usage",        text: "Usage of vehicle -" },
  { id: "eui-mileage",      text: "Annual mileage -" },
  { id: "eui-price",        text: "Vehicle Price -" },
  { id: "eui-parking",      text: "Vehicle Parking" },
  { id: "eui-parking-day",  text: "         Day:" },
  { id: "eui-parking-night",text: "         Night:" },
  { id: "eui-children",     text: "Children -" },
  { id: "eui-cover-type",   text: "Type of Cover -" }
];

/**
 * Default driver block format:
 *
 * PH Relationship with the Add Driver 01 -
 * Add. Driver 01: –
 * Occupation –
 * Industry –
 * Access to other cars:
 * Marital Status:
 * UK resident date:
 * License obtained date:
 */
const getDriverDefaultTitles = (id: number): TitleItem[] => {
  const p = String(id).padStart(2, "0");
  return [
    { id: `drv-${id}-rel`,        text: `PH Relationship with the Add Driver ${p} -` },
    { id: `drv-${id}-name`,       text: `Add. Driver ${p}: –` },
    { id: `drv-${id}-occ`,        text: "Occupation –" },
    { id: `drv-${id}-ind`,        text: "Industry –" },
    { id: `drv-${id}-access`,     text: "Access to other cars:" },
    { id: `drv-${id}-marital`,    text: "Marital Status:" },
    { id: `drv-${id}-uk-resident`,text: "UK resident date:" },
    { id: `drv-${id}-license`,    text: "License obtained date:" }
  ];
};

/** Build the sequential numbered list for preview / copy */
const buildFormattedLines = (mainTitles: TitleItem[]): string[] => {
  const lines: string[] = [];
  let counter = 1;
  mainTitles.forEach((t) => {
    if (UNNUMBERED_IDS.has(t.id)) {
      lines.push(t.text);
      return;
    }
    const cleanText = t.text.replace(/^\d+\.\s*/, "");
    lines.push(`${counter}. ${cleanText}`);
    counter++;
  });
  return lines;
};

/** Build a map of id → display number for edit form labels */
const buildNumberedMap = (mainTitles: TitleItem[]): Record<string, number> => {
  const map: Record<string, number> = {};
  let counter = 1;
  mainTitles.forEach((t) => {
    if (UNNUMBERED_IDS.has(t.id)) return;
    map[t.id] = counter++;
  });
  return map;
};

export const EUICausalityPanel: React.FC<EUICausalityPanelProps> = ({ profile, isOnline }) => {
  const [mainTitles, setMainTitles] = useState<TitleItem[]>(DEFAULT_MAIN_TITLES);
  const [drivers, setDrivers] = useState<AdditionalDriver[]>([]);
  const [copied, setCopied] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbSaving, setDbSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [previewContextMenu, setPreviewContextMenu] = useState<{ x: number; y: number } | null>(null);

  const canManageTemplate = profile?.role === "admin" || profile?.role === "supervisor";
  const previewContextMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchTemplateFromDB = async () => {
    setDbLoading(true);
    // Always clear the old v1 keys so stale data never leaks through
    localStorage.removeItem("quotes_eui_causality_template_draft");
    try {
      const { data, error } = await supabase
        .from("login_codes")
        .select("*")
        .eq("login_id", "__eui_causality_template_v2__")
        .maybeSingle();
      if (error) throw error;
      if (data && data.code) {
        const parsed = JSON.parse(data.code);
        if (parsed.mainTitles && Array.isArray(parsed.mainTitles) && parsed.mainTitles.length > 0) {
          setMainTitles(parsed.mainTitles);
        }
        // drivers are session-only — not saved to cloud
      } else {
        // No v2 DB record — try localStorage v2 draft
        const savedDraft = localStorage.getItem("quotes_eui_causality_template_draft_v2");
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.mainTitles && Array.isArray(parsed.mainTitles) && parsed.mainTitles.length > 0) {
            setMainTitles(parsed.mainTitles);
          }
        }
        // else: just keep DEFAULT_MAIN_TITLES (already set by useState)
      }
    } catch {
      // On error fall back to localStorage v2 draft or default
      const savedDraft = localStorage.getItem("quotes_eui_causality_template_draft_v2");
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.mainTitles && Array.isArray(parsed.mainTitles) && parsed.mainTitles.length > 0) {
            setMainTitles(parsed.mainTitles);
          }
        } catch {}
      }
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => { fetchTemplateFromDB(); }, []);

  // Persist template edits to localStorage v2 draft (drivers are NOT persisted — session only)
  useEffect(() => {
    if (!dbLoading) {
      localStorage.setItem("quotes_eui_causality_template_draft_v2", JSON.stringify({ mainTitles }));
    }
  }, [mainTitles, dbLoading]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (previewContextMenuRef.current && !previewContextMenuRef.current.contains(e.target as Node)) {
        setPreviewContextMenu(null);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // ─── Template (field text) editing — admin/supervisor only ───────────────
  const handleMainTitleChange = (id: string, newText: string) =>
    setMainTitles((prev) => prev.map((t) => (t.id === id ? { ...t, text: newText } : t)));

  const handleDriverTitleChange = (driverId: number, id: string, newText: string) =>
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId ? { ...d, titles: d.titles.map((t) => (t.id === id ? { ...t, text: newText } : t)) } : d
      )
    );

  const addTitleBelow = (targetId: string, driverId?: number) => {
    const newTitle: TitleItem = { id: `custom-${Date.now()}`, text: "Custom Field Name –" };
    if (driverId === undefined) {
      setMainTitles((prev) => {
        const idx = prev.findIndex((t) => t.id === targetId);
        if (idx === -1) return prev;
        const next = [...prev];
        next.splice(idx + 1, 0, newTitle);
        return next;
      });
    } else {
      setDrivers((prev) =>
        prev.map((d) => {
          if (d.id !== driverId) return d;
          const idx = d.titles.findIndex((t) => t.id === targetId);
          if (idx === -1) return d;
          const next = [...d.titles];
          next.splice(idx + 1, 0, newTitle);
          return { ...d, titles: next };
        })
      );
    }
  };

  const deleteTitle = (targetId: string, driverId?: number) => {
    if (driverId === undefined) {
      setMainTitles((prev) => prev.filter((t) => t.id !== targetId));
    } else {
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, titles: d.titles.filter((t) => t.id !== targetId) } : d))
      );
    }
  };

  // ─── Driver section management — available to ALL users ──────────────────
  const handleAddDriver = () => {
    if (drivers.length >= 5) { toast.error("You can add up to 5 additional drivers only."); return; }
    const nextId = drivers.length + 1;
    setDrivers((prev) => [...prev, { id: nextId, titles: getDriverDefaultTitles(nextId) }]);
  };

  const handleRemoveDriver = (id: number) => {
    setDrivers((prev) =>
      prev.filter((d) => d.id !== id).map((d, index) => {
        const newId = index + 1;
        const updatedTitles = d.titles.map((t) => {
          let text = t.text;
          const oldP = String(d.id).padStart(2, "0");
          const newP = String(newId).padStart(2, "0");
          if (text.includes(`Driver ${oldP}`)) text = text.replace(`Driver ${oldP}`, `Driver ${newP}`);
          if (text.includes(`Add ${oldP}`)) text = text.replace(`Add ${oldP}`, `Add ${newP}`);
          return { ...t, text };
        });
        return { id: newId, titles: updatedTitles };
      })
    );
  };

  // ─── Misc ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (!confirm("Are you sure you want to reset the EUI template to its default layout?")) return;
    setMainTitles(DEFAULT_MAIN_TITLES);
    localStorage.removeItem("quotes_eui_causality_template_draft");
    toast.success("EUI template reset to defaults.");
  };

  const getCopyFormattedText = (): string => {
    let result = "";
    buildFormattedLines(mainTitles).forEach((line) => { result += `${line}\n`; });
    drivers.forEach((d) => { result += "\n"; d.titles.forEach((t) => { result += `${t.text}\n`; }); });
    return result;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(getCopyFormattedText());
      setCopied(true);
      toast.success("Template layout copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Failed to copy template."); }
  };

  const handleSaveToDB = async () => {
    if (!isOnline) { toast.error("You are offline. Cannot save template."); return; }
    setDbSaving(true);
    try {
      const { error } = await supabase.from("login_codes").upsert({
        login_id: "__eui_causality_template_v2__",
        code: JSON.stringify({ mainTitles }), // Only save template fields, not session drivers
        name: "EUI Causality Template",
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      toast.success("EUI template saved to cloud!");
      setIsEditMode(false);
    } catch (err: any) {
      toast.error("Failed to save: " + (err.message || String(err)));
    } finally {
      setDbSaving(false);
    }
  };

  const handleCancelEdit = () => { fetchTemplateFromDB(); setIsEditMode(false); };

  const handlePreviewContextMenu = (e: React.MouseEvent) => {
    if (!canManageTemplate) return;
    e.preventDefault();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPreviewContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const formattedLines = buildFormattedLines(mainTitles);
  const numberedMap = buildNumberedMap(mainTitles);

  if (dbLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
        <p className="mt-2 text-xs font-semibold text-slate-400">Loading EUI template...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" ref={containerRef}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">EUI Causality Format</h4>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <button onClick={handleSaveToDB} disabled={dbSaving}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50">
                {dbSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</> : <><CloudLightning className="h-3.5 w-3.5" />Save to Cloud</>}
              </button>
              <button onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer">
                <X className="h-3.5 w-3.5" />Cancel
              </button>
            </>
          ) : (
            <>
              {canManageTemplate && (
                <button onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer">
                  <Edit2 className="h-3.5 w-3.5 text-indigo-400" />Edit Template
                </button>
              )}
              <button onClick={handleCopyText}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-md ${copied ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400" : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-white"}`}>
                {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy Template</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Edit Mode: two-column editor + preview ─────────────────────── */}
      {isEditMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Editor column */}
          <div className="lg:col-span-7 space-y-5 animate-fade-in animate-duration-250">
            <div className="flex justify-end">
              <button onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-850 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white transition-all cursor-pointer font-semibold">
                <RotateCcw className="h-3 w-3" />Reset Defaults
              </button>
            </div>

            {/* Main titles editor */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Main Applicant Format</h5>
              <div className="space-y-2">
                {mainTitles.map((title) => {
                  const isUnnum = UNNUMBERED_IDS.has(title.id);
                  const numLabel = !isUnnum && numberedMap[title.id] !== undefined ? `${numberedMap[title.id]}.` : "";
                  return (
                    <div key={title.id} className="flex items-center gap-2 group">
                      {numLabel && (
                        <span className="text-[10px] font-mono text-slate-500 min-w-[22px] text-right font-bold select-none">{numLabel}</span>
                      )}
                      <input type="text" value={title.text}
                        onChange={(e) => handleMainTitleChange(title.id, e.target.value)}
                        placeholder="Field title..."
                        className="flex-1 px-3 py-1.5 bg-slate-955 border border-slate-850 hover:border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition-all font-semibold" />
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => addTitleBelow(title.id)}
                          className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-indigo-400 text-slate-400 transition-all cursor-pointer" title="Add below">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteTitle(title.id)}
                          className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-red-500 hover:text-red-400 text-slate-400 transition-all cursor-pointer" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Driver editors (field-text editing, only in edit mode) */}
            {drivers.map((driver) => (
              <div key={driver.id} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-slate-850/60 pb-2 border-dashed">
                  <h5 className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                    Additional Driver {String(driver.id).padStart(2, "0")} Format
                  </h5>
                  <button type="button" onClick={() => handleRemoveDriver(driver.id)}
                    className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-400 font-semibold bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md transition-all cursor-pointer">
                    <Trash2 className="h-3 w-3" />Remove
                  </button>
                </div>
                <div className="space-y-2">
                  {driver.titles.map((title) => (
                    <div key={title.id} className="flex items-center gap-2 group">
                      <input type="text" value={title.text}
                        onChange={(e) => handleDriverTitleChange(driver.id, title.id, e.target.value)}
                        placeholder="Driver field title..."
                        className="flex-1 px-3 py-1.5 bg-slate-955 border border-slate-850 hover:border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs transition-all font-semibold" />
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => addTitleBelow(title.id, driver.id)}
                          className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-teal-500 hover:text-teal-400 text-slate-400 transition-all cursor-pointer" title="Add below">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteTitle(title.id, driver.id)}
                          className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-red-500 hover:text-red-400 text-slate-400 transition-all cursor-pointer" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Add Driver — also in edit mode */}
            {drivers.length < 5 && (
              <button onClick={handleAddDriver}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-slate-800 hover:border-indigo-500/40 rounded-xl bg-transparent hover:bg-slate-900/20 text-slate-400 hover:text-indigo-400 transition-all font-semibold text-xs cursor-pointer">
                <PlusCircle className="h-4 w-4" />
                Add Driver {String(drivers.length + 1).padStart(2, "0")}
              </button>
            )}
          </div>

          {/* Live preview column */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex justify-between items-center">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Preview</h5>
              <span className="text-[10px] text-slate-500 italic font-semibold">Updates instantly</span>
            </div>
            <div className="w-full rounded-2xl bg-slate-950 border border-slate-900 shadow-inner px-5 py-4 font-mono text-xs text-slate-300 leading-relaxed break-all whitespace-pre-wrap select-all">
              {formattedLines.map((line, idx) => <div key={idx}>{line}</div>)}
              {drivers.map((d) => (
                <div key={d.id} className="mt-4">{d.titles.map((t) => <div key={t.id}>{t.text}</div>)}</div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── View Mode: full-width preview + driver management ─────────── */
        <div className="space-y-4">
          {/* Full-width preview */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Template Format</h5>
              <span className="text-[10px] text-slate-500 italic font-semibold">Ready to copy to clipboard</span>
            </div>
            <div
              onContextMenu={handlePreviewContextMenu}
              className="w-full rounded-2xl bg-slate-950 border border-slate-900 shadow-inner px-5 py-4 font-mono text-xs text-slate-300 leading-relaxed break-all relative whitespace-pre-wrap select-all">
              {formattedLines.map((line, idx) => <div key={idx}>{line}</div>)}
              {drivers.map((d) => (
                <div key={d.id} className="mt-4">{d.titles.map((t) => <div key={t.id}>{t.text}</div>)}</div>
              ))}
              {/* Context menu (admin/supervisor only) */}
              {previewContextMenu && (
                <div ref={previewContextMenuRef}
                  style={{ top: `${previewContextMenu.y}px`, left: `${previewContextMenu.x}px` }}
                  className="absolute z-30 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 min-w-[120px] overflow-hidden">
                  <button type="button" onClick={() => { handleCopyText(); setPreviewContextMenu(null); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5" />Copy Layout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Driver management — ALWAYS visible to all users in view mode */}
          <div className="space-y-2">
            {/* Existing drivers with remove button */}
            {drivers.map((d) => (
              <div key={d.id}
                className="flex items-center justify-between px-4 py-2.5 bg-slate-900/40 border border-slate-800/60 rounded-xl">
                <span className="text-xs font-bold text-teal-400">
                  Additional Driver {String(d.id).padStart(2, "0")}
                </span>
                <button type="button" onClick={() => handleRemoveDriver(d.id)}
                  className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-400 font-semibold bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md transition-all cursor-pointer">
                  <Trash2 className="h-3 w-3" />Remove
                </button>
              </div>
            ))}
            {/* Add Driver button — always visible */}
            {drivers.length < 5 && (
              <button onClick={handleAddDriver}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-800 hover:border-indigo-500/40 rounded-xl bg-transparent hover:bg-slate-900/20 text-slate-400 hover:text-indigo-400 transition-all font-semibold text-xs cursor-pointer">
                <PlusCircle className="h-4 w-4" />
                Add Driver {String(drivers.length + 1).padStart(2, "0")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
