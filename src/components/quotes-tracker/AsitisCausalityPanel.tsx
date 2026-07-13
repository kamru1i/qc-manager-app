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
import { AsitisCausalitySkeleton } from "@/components/common/skeleton/AsitisCausalitySkeleton";

interface TitleItem {
  id: string;
  text: string;
}

interface AdditionalDriver {
  id: number;
  titles: TitleItem[];
}

export interface AsitisCausalityPanelProps {
  profile: Profile | null;
  isOnline: boolean;
}

const DEFAULT_MAIN_TITLES: TitleItem[] = [
  { id: "main-ph", text: "PH –" },
  { id: "main-occ", text: "Occupation –" },
  { id: "main-ind", text: "Industry –" },
  { id: "main-lic", text: "1. Licence obtained date :" },
  { id: "main-rel", text: "2. Relationship status :" },
  { id: "main-acc", text: "3. Access to other car :" },
  { id: "main-mil", text: "4. Mileage:" },
  { id: "main-res", text: "5. UK Residency:" },
  { id: "main-val", text: "6. Vehicle Value:" },
  { id: "main-use", text: "7. Use of Vehicle :" },
  { id: "main-pur", text: "8. Vehicle purchase date:" },
  { id: "main-own", text: "9. Homeowner:" },
  { id: "main-day", text: "10. Day:" },
  { id: "main-ngt", text: "11. Night:" },
  { id: "main-raw", text: "12. Raw quote reference:" },
  { id: "main-cnt", text: "13. How many cars in the household:" },
  { id: "main-chd", text: "14. Children:" },
  { id: "main-ncd", text: "15. NCD:" },
  { id: "main-row", text: "16. Registered Owner :" },
  { id: "main-rkp", text: "17. Registered Keeper:" }
];

const getDriverDefaultTitles = (id: number): TitleItem[] => {
  const paddedId = String(id).padStart(2, "0");
  return [
    { id: `drv-${id}-rel`, text: `PH Relationship with the Add Driver ${paddedId}:` },
    { id: `drv-${id}-name`, text: `Add ${paddedId}: –` },
    { id: `drv-${id}-occ`, text: "Occupation –" },
    { id: `drv-${id}-ind`, text: "Industry –" },
    { id: `drv-${id}-lic`, text: "Licence obtained date :" },
    { id: `drv-${id}-rel_status`, text: "Relationship status :" },
    { id: `drv-${id}-acc`, text: "Access to other car :" },
    { id: `drv-${id}-res`, text: "UK Residency:" }
  ];
};

export const AsitisCausalityPanel: React.FC<AsitisCausalityPanelProps> = ({ profile, isOnline }) => {
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
    try {
      const { data, error } = await supabase
        .from("login_codes")
        .select("*")
        .eq("login_id", "__asitis_causality_template__")
        .maybeSingle();
      if (error) throw error;
      if (data && data.code) {
        const parsed = JSON.parse(data.code);
        if (parsed.mainTitles) setMainTitles(parsed.mainTitles);
        // Drivers are session-level – load from draft, not from DB template
      } else {
        const savedDraft = localStorage.getItem("quotes_asitis_causality_template_draft");
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.mainTitles) setMainTitles(parsed.mainTitles);
        }
      }
    } catch {
      const savedDraft = localStorage.getItem("quotes_asitis_causality_template_draft");
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.mainTitles) setMainTitles(parsed.mainTitles);
        } catch {}
      }
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => { fetchTemplateFromDB(); }, []);

  useEffect(() => {
    if (!dbLoading) {
      localStorage.setItem("quotes_asitis_causality_template_draft", JSON.stringify({ mainTitles }));
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

  // ─── Template (field text) editing ───────────────────────────────────────
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

  // ─── Driver section management (available to all users) ──────────────────
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
          const oldPadded = String(d.id).padStart(2, "0");
          const newPadded = String(newId).padStart(2, "0");
          if (text.includes(`Driver ${oldPadded}`)) text = text.replace(`Driver ${oldPadded}`, `Driver ${newPadded}`);
          if (text.includes(`Add ${oldPadded}`)) text = text.replace(`Add ${oldPadded}`, `Add ${newPadded}`);
          return { ...t, text };
        });
        return { id: newId, titles: updatedTitles };
      })
    );
  };

  // ─── Misc handlers ────────────────────────────────────────────────────────
  const handleReset = () => {
    if (!confirm("Are you sure you want to reset the Asitis template to its default layout?")) return;
    setMainTitles(DEFAULT_MAIN_TITLES);
    localStorage.removeItem("quotes_asitis_causality_template_draft");
    toast.success("Asitis template reset to defaults.");
  };

  const getCopyFormattedText = (): string => {
    let result = "";
    mainTitles.forEach((t) => { result += `${t.text}\n`; });
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
        login_id: "__asitis_causality_template__",
        code: JSON.stringify({ mainTitles }),
        name: "Asitis Causality Template",
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      toast.success("Asitis template saved to cloud!");
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

  if (dbLoading) {
    return <AsitisCausalitySkeleton />;
  }

  return (
    <div className="space-y-5" ref={containerRef}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">Asitis Causality Format</h4>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <button onClick={handleSaveToDB} disabled={dbSaving}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50">
                {dbSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</> : <><CloudLightning className="h-3.5 w-3.5" />Save to Cloud</>}
              </button>
              <button onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-xs font-semibold text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer">
                <X className="h-3.5 w-3.5" />Cancel
              </button>
            </>
          ) : (
            <>
              {canManageTemplate && (
                <button onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer">
                  <Edit2 className="h-3.5 w-3.5 text-indigo-400" />Edit Template
                </button>
              )}
              <button onClick={handleCopyText}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-md ${copied ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400" : "bg-theme-card-bg hover:bg-theme-border-input border-theme-border-input text-theme-text-primary"}`}>
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
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-theme-card-bg border border-theme-border-muted hover:bg-theme-border-input text-[10px] text-theme-text-muted hover:text-theme-text-primary transition-all cursor-pointer font-semibold">
                <RotateCcw className="h-3 w-3" />Reset Defaults
              </button>
            </div>

            {/* Main titles editor */}
            <div className="bg-theme-card-bg/40 border border-theme-border-input/80 rounded-xl p-5 space-y-4">
              <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Main Applicant Format</h5>
              <div className="space-y-2">
                {mainTitles.map((title) => (
                  <div key={title.id} className="flex items-center gap-2 group">
                    <input type="text" value={title.text}
                      onChange={(e) => handleMainTitleChange(title.id, e.target.value)}
                      placeholder="Field title..."
                      className="flex-1 px-3 py-1.5 bg-theme-page-bg border border-theme-border-muted hover:border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition-all font-semibold" />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => addTitleBelow(title.id)}
                        className="p-1.5 rounded bg-theme-card-bg border border-theme-border-input hover:border-indigo-500 hover:text-indigo-400 text-theme-text-muted transition-all cursor-pointer" title="Add below">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteTitle(title.id)}
                        className="p-1.5 rounded bg-theme-card-bg border border-theme-border-input hover:border-red-500 hover:text-red-400 text-theme-text-muted transition-all cursor-pointer" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver editors (only in edit mode) */}
            {drivers.map((driver) => (
              <div key={driver.id} className="bg-theme-card-bg/40 border border-theme-border-input/80 rounded-xl p-5 space-y-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-theme-border-muted/60 pb-2 border-dashed">
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
                        className="flex-1 px-3 py-1.5 bg-theme-page-bg border border-theme-border-muted hover:border-theme-border-input rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs transition-all font-semibold" />
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => addTitleBelow(title.id, driver.id)}
                          className="p-1.5 rounded bg-theme-card-bg border border-theme-border-input hover:border-teal-500 hover:text-teal-400 text-theme-text-muted transition-all cursor-pointer" title="Add below">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteTitle(title.id, driver.id)}
                          className="p-1.5 rounded bg-theme-card-bg border border-theme-border-input hover:border-red-500 hover:text-red-400 text-theme-text-muted transition-all cursor-pointer" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Add Driver — visible in edit mode */}
            {drivers.length < 5 && (
              <button onClick={handleAddDriver}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-theme-border-input hover:border-indigo-500/40 rounded-xl bg-transparent hover:bg-theme-card-bg/20 text-theme-text-muted hover:text-indigo-400 transition-all font-semibold text-xs cursor-pointer">
                <PlusCircle className="h-4 w-4" />
                Add Driver {String(drivers.length + 1).padStart(2, "0")}
              </button>
            )}
          </div>

          {/* Live preview column */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex justify-between items-center">
              <h5 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Live Preview</h5>
              <span className="text-[10px] text-theme-text-muted italic font-semibold">Updates instantly as you edit</span>
            </div>
            <div
              onContextMenu={handlePreviewContextMenu}
              className="w-full rounded-2xl bg-theme-card-container border border-theme-card-bg shadow-inner px-5 py-4 font-mono text-xs text-theme-text-secondary leading-relaxed break-all relative whitespace-pre-wrap select-all">
              {mainTitles.map((t, idx) => <div key={idx}>{t.text}</div>)}
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
              <h5 className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">Template Format</h5>
              <span className="text-[10px] text-theme-text-muted italic font-semibold">Ready to copy to clipboard</span>
            </div>
            <div
              onContextMenu={handlePreviewContextMenu}
              className="w-full rounded-2xl bg-theme-card-container border border-theme-card-bg shadow-inner px-5 py-4 font-mono text-xs text-theme-text-secondary leading-relaxed break-all relative whitespace-pre-wrap select-all">
              {mainTitles.map((t, idx) => <div key={idx}>{t.text}</div>)}
              {drivers.map((d) => (
                <div key={d.id} className="mt-4">{d.titles.map((t) => <div key={t.id}>{t.text}</div>)}</div>
              ))}
              {/* Context menu (admin/supervisor only) */}
              {previewContextMenu && (
                <div ref={previewContextMenuRef}
                  style={{ top: `${previewContextMenu.y}px`, left: `${previewContextMenu.x}px` }}
                  className="absolute z-30 bg-theme-card-bg border border-theme-border-input rounded-xl shadow-2xl py-1 min-w-[120px] overflow-hidden">
                  <button type="button" onClick={() => { handleCopyText(); setPreviewContextMenu(null); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold text-theme-text-primary cursor-pointer flex items-center gap-1.5">
                    <Copy className="h-3.5 w-3.5" />Copy Layout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Driver management — ALWAYS visible in view mode */}
          <div className="space-y-2">
            {/* Existing driver blocks with remove */}
            {drivers.map((d) => (
              <div key={d.id}
                className="flex items-center justify-between px-4 py-2.5 bg-theme-card-bg/40 border border-theme-border-input/60 rounded-xl">
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
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-theme-border-input hover:border-indigo-500/40 rounded-xl bg-transparent hover:bg-theme-card-bg/20 text-theme-text-muted hover:text-indigo-400 transition-all font-semibold text-xs cursor-pointer">
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
