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
  id: number; // 1 to 5
  titles: TitleItem[];
}

interface AsitisCausalityPanelProps {
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

export const AsitisCausalityPanel: React.FC<AsitisCausalityPanelProps> = ({
  profile,
  isOnline
}) => {
  const [mainTitles, setMainTitles] = useState<TitleItem[]>(DEFAULT_MAIN_TITLES);
  const [drivers, setDrivers] = useState<AdditionalDriver[]>([]);
  const [copied, setCopied] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbSaving, setDbSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Context Menu Position relative to the parent container
  const [previewContextMenu, setPreviewContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const canManageTemplate = profile?.role === "admin" || profile?.role === "supervisor";
  const previewContextMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load from Supabase DB on mount
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
        if (parsed.drivers) setDrivers(parsed.drivers);
      } else {
        const savedDraft = localStorage.getItem("quotes_asitis_causality_template_draft");
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.mainTitles) setMainTitles(parsed.mainTitles);
          if (parsed.drivers) setDrivers(parsed.drivers);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch template, using local draft:", err);
      const savedDraft = localStorage.getItem("quotes_asitis_causality_template_draft");
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.mainTitles) setMainTitles(parsed.mainTitles);
          if (parsed.drivers) setDrivers(parsed.drivers);
        } catch {}
      }
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplateFromDB();
  }, []);

  // Save drafts locally
  useEffect(() => {
    if (!dbLoading) {
      localStorage.setItem(
        "quotes_asitis_causality_template_draft",
        JSON.stringify({ mainTitles, drivers })
      );
    }
  }, [mainTitles, drivers, dbLoading]);

  // Click outside listener for context menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (previewContextMenuRef.current && !previewContextMenuRef.current.contains(e.target as Node)) {
        setPreviewContextMenu(null);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Handles Title edits
  const handleMainTitleChange = (id: string, newText: string) => {
    setMainTitles((prev) => prev.map((t) => (t.id === id ? { ...t, text: newText } : t)));
  };

  const handleDriverTitleChange = (driverId: number, id: string, newText: string) => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              titles: d.titles.map((t) => (t.id === id ? { ...t, text: newText } : t))
            }
          : d
      )
    );
  };

  const addTitleBelow = (targetId: string, driverId?: number) => {
    const newTitle: TitleItem = {
      id: `custom-${Date.now()}`,
      text: "Custom Field Name –"
    };

    if (driverId === undefined) {
      setMainTitles((prev) => {
        const index = prev.findIndex((t) => t.id === targetId);
        if (index === -1) return prev;
        const next = [...prev];
        next.splice(index + 1, 0, newTitle);
        return next;
      });
    } else {
      setDrivers((prev) =>
        prev.map((d) => {
          if (d.id !== driverId) return d;
          const index = d.titles.findIndex((t) => t.id === targetId);
          if (index === -1) return d;
          const nextTitles = [...d.titles];
          nextTitles.splice(index + 1, 0, newTitle);
          return { ...d, titles: nextTitles };
        })
      );
    }
  };

  const deleteTitle = (targetId: string, driverId?: number) => {
    if (driverId === undefined) {
      setMainTitles((prev) => prev.filter((t) => t.id !== targetId));
    } else {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId
            ? { ...d, titles: d.titles.filter((t) => t.id !== targetId) }
            : d
        )
      );
    }
  };

  const handleAddDriver = () => {
    if (drivers.length >= 5) {
      toast.error("You can add up to 5 additional drivers only.");
      return;
    }
    const nextId = drivers.length + 1;
    setDrivers((prev) => [
      ...prev,
      { id: nextId, titles: getDriverDefaultTitles(nextId) }
    ]);
  };

  const handleRemoveDriver = (id: number) => {
    setDrivers((prev) =>
      prev
        .filter((d) => d.id !== id)
        .map((d, index) => {
          const newId = index + 1;
          const updatedTitles = d.titles.map((t) => {
            let text = t.text;
            const oldPadded = String(d.id).padStart(2, "0");
            const newPadded = String(newId).padStart(2, "0");

            if (text.includes(`Driver ${oldPadded}`)) {
              text = text.replace(`Driver ${oldPadded}`, `Driver ${newPadded}`);
            }
            if (text.includes(`Add ${oldPadded}`)) {
              text = text.replace(`Add ${oldPadded}`, `Add ${newPadded}`);
            }
            return { ...t, text };
          });
          return { id: newId, titles: updatedTitles };
        })
    );
  };

  const handleReset = () => {
    if (!confirm("Are you sure you want to reset the template format to its default layout?")) return;
    setMainTitles(DEFAULT_MAIN_TITLES);
    setDrivers([]);
    localStorage.removeItem("quotes_asitis_causality_template_draft");
    toast.success("Template reset to defaults.");
  };

  const getCopyFormattedText = (): string => {
    let result = "";
    mainTitles.forEach((t) => {
      result += `${t.text}\n`;
    });
    drivers.forEach((d) => {
      result += "\n";
      d.titles.forEach((t) => {
        result += `${t.text}\n`;
      });
    });
    return result;
  };

  const handleCopyText = async () => {
    const text = getCopyFormattedText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Template layout copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy template.");
    }
  };

  const handleSaveToDB = async () => {
    if (!isOnline) {
      toast.error("You are offline. Cannot save template to cloud database.");
      return;
    }
    setDbSaving(true);
    const payload = {
      login_id: "__asitis_causality_template__",
      code: JSON.stringify({ mainTitles, drivers }),
      name: "Asitis Causality Template",
      updated_at: new Date().toISOString()
    };
    try {
      const { error } = await supabase.from("login_codes").upsert(payload);
      if (error) throw error;
      toast.success("Template format saved to cloud database!");
      setIsEditMode(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save template: " + (err.message || String(err)));
    } finally {
      setDbSaving(false);
    }
  };

  // Triggers context menu positioned relative to the parent relative container
  const handlePreviewContextMenu = (e: React.MouseEvent) => {
    if (!canManageTemplate) return;
    e.preventDefault();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPreviewContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleCancelEdit = () => {
    fetchTemplateFromDB();
    setIsEditMode(false);
  };

  if (dbLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-60 gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="text-xs">Loading causality template from database...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-slate-955/20 border border-slate-850 rounded-2xl p-5 space-y-6 animate-fade-in relative min-h-[70vh]"
    >
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-850/60 pb-4 border-dashed">
        <div>
          <h4 className="text-md font-bold text-white flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-indigo-500" />
            Asitis Causality Format Template Editor
          </h4>
          <p className="text-[11px] text-slate-450 mt-0.5">
            {isEditMode 
              ? "Editing Mode: Modify titles and click 'Save to Cloud' to update the global template."
              : "Standard Mode: Copy the template format below. Right-click the preview area to enter edit mode."
            }
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {isEditMode ? (
            <>
              <button
                onClick={handleSaveToDB}
                disabled={dbSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-indigo-600/30 bg-indigo-650 hover:bg-indigo-600 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
              >
                {dbSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CloudLightning className="h-3.5 w-3.5" />
                    Save to Cloud
                  </>
                )}
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          ) : (
            <>
              {canManageTemplate && (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5 text-indigo-400" />
                  Edit Template
                </button>
              )}
              <button
                onClick={handleCopyText}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-md ${
                  copied
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                    : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-white"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Template
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main layouts editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Stack: Only shows when isEditMode is true */}
        {isEditMode && (
          <div className="lg:col-span-7 space-y-6 animate-fade-in">
            {/* Reset to Default inside Edit mode */}
            <div className="flex justify-end">
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-850 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-white transition-all cursor-pointer font-semibold"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Defaults
              </button>
            </div>

            {/* Main Titles stack */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Main Applicant Format</h5>

              <div className="space-y-2">
                {mainTitles.map((title) => (
                  <div key={title.id} className="flex items-center gap-2 group">
                    <input
                      type="text"
                      value={title.text}
                      onChange={(e) => handleMainTitleChange(title.id, e.target.value)}
                      placeholder="Field title..."
                      className="flex-1 px-3 py-1.5 bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs transition-all font-semibold"
                    />
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => addTitleBelow(title.id)}
                        className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-indigo-400 text-slate-400 transition-all cursor-pointer"
                        title="Add field below"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTitle(title.id)}
                        className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-red-500 hover:text-red-400 text-slate-400 transition-all cursor-pointer"
                        title="Delete field"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Driver Blocks */}
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4 animate-fade-in"
              >
                <div className="flex justify-between items-center border-b border-slate-850/60 pb-2 border-dashed">
                  <h5 className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                    Additional Driver {String(driver.id).padStart(2, "0")} Format
                  </h5>
                  <button
                    type="button"
                    onClick={() => handleRemoveDriver(driver.id)}
                    className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-400 font-semibold bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>

                <div className="space-y-2">
                  {driver.titles.map((title) => (
                    <div key={title.id} className="flex items-center gap-2 group">
                      <input
                        type="text"
                        value={title.text}
                        onChange={(e) => handleDriverTitleChange(driver.id, title.id, e.target.value)}
                        placeholder="Driver field title..."
                        className="flex-1 px-3 py-1.5 bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-xs transition-all font-semibold"
                    />

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => addTitleBelow(title.id, driver.id)}
                          className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-teal-500 hover:text-teal-400 text-slate-400 transition-all cursor-pointer"
                          title="Add field below"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTitle(title.id, driver.id)}
                          className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-red-500 hover:text-red-400 text-slate-400 transition-all cursor-pointer"
                          title="Delete field"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Add Driver Button */}
            {drivers.length < 5 && (
              <button
                onClick={handleAddDriver}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-slate-800 hover:border-indigo-500/40 rounded-xl bg-transparent hover:bg-slate-900/20 text-slate-400 hover:text-indigo-400 transition-all font-semibold text-xs cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                Add Adi {String(drivers.length + 1).padStart(2, "0")}
              </button>
            )}
          </div>
        )}

        {/* Live preview: 5 cols in Edit Mode, Full 12 cols in Standard Mode */}
        <div className={`space-y-3 transition-all duration-300 ${isEditMode ? "lg:col-span-5" : "lg:col-span-12"}`}>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isEditMode ? "Live Preview" : "Template Format"}
            </h5>
            
            {/* Header controls for Standard Mode */}
            {!isEditMode && (
              <div className="flex items-center gap-2 flex-wrap">
                {drivers.length < 5 && (
                  <button
                    onClick={handleAddDriver}
                    className="px-2.5 py-1 rounded border border-slate-800 hover:border-indigo-500/40 bg-transparent hover:bg-slate-900/40 text-[10px] font-bold text-slate-400 hover:text-indigo-400 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="h-3 w-3" />
                    Add Adi {String(drivers.length + 1).padStart(2, "0")}
                  </button>
                )}
                {drivers.length > 0 && (
                  <button
                    onClick={() => handleRemoveDriver(drivers.length)}
                    className="px-2.5 py-1 rounded border border-red-950/40 bg-transparent hover:bg-red-950/20 text-[10px] font-bold text-red-500 hover:text-red-400 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove Adi {String(drivers.length).padStart(2, "0")}
                  </button>
                )}
                {canManageTemplate && (
                  <span className="text-[10px] text-slate-500 italic ml-1 select-none">
                    * Right-click the preview area to Edit Template
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div
            onContextMenu={handlePreviewContextMenu}
            className="bg-slate-955 border border-slate-850 rounded-xl p-6 text-xs font-mono text-slate-300 min-h-[60vh] h-auto overflow-y-auto custom-scrollbar select-text whitespace-pre-wrap leading-relaxed shadow-inner cursor-context-menu"
          >
            {getCopyFormattedText()}
          </div>
        </div>
      </div>

      {/* Context Menu for Preview Box (positioned absolutely relative to containerRef) */}
      {previewContextMenu && (
        <div
          ref={previewContextMenuRef}
          className="absolute bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1.5 w-40 z-50 animate-fade-in"
          style={{ top: previewContextMenu.y, left: previewContextMenu.x }}
        >
          <button
            onClick={() => {
              setIsEditMode(true);
              setPreviewContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-xs text-slate-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5 text-indigo-400" />
            Edit Template
          </button>
          <button
            onClick={() => {
              handleCopyText();
              setPreviewContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-xs text-slate-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5 text-slate-400" />
            Copy Template
          </button>
        </div>
      )}
    </div>
  );
};
