"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
  Layers,
  Plus,
  FolderOpen,
} from "lucide-react";
import {
  parseQuoteLine,
  parseBulkQuoteLines,
  ParsedQuoteItem,
  ALL_10_FILE_TYPES,
  DEFAULT_BRANCHES,
  normalizeBranchName,
  getTodayYYYYMMDD,
} from "@/utils/bulkQuoteParser";
import { CustomSelect } from "@/components/common/CustomSelect";

export const formatYYYYMMDDToDDMMYYYY = (isoDate?: string): string => {
  const dateStr = isoDate || getTodayYYYYMMDD();
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

export interface QuickImportViewProps {
  isOpen?: boolean;
  isInline?: boolean;
  onClose?: () => void;
  allowedBranches: string[];
  allowedTypes: string[];
  sanitizerWords: string[];
  codename: string;
  onSubmitRecord: (recordData: {
    file_name: string;
    branch_name: string;
    codename: string;
    file_type: string;
    entry_date?: string;
  }) => Promise<boolean>;
  onCompleteSuccess: (count: number) => void;
}

export const QuickImportView: React.FC<QuickImportViewProps> = ({
  isOpen = true,
  isInline = false,
  onClose = () => {},
  allowedBranches,
  allowedTypes,
  sanitizerWords,
  codename,
  onSubmitRecord,
  onCompleteSuccess,
}) => {
  const [rawText, setRawText] = useState("");
  const [items, setItems] = useState<ParsedQuoteItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [totalToSubmit, setTotalToSubmit] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Master branches list: merge DEFAULT_BRANCHES with allowedBranches and normalize to deduplicate unspaced variants
  const branchesList = React.useMemo(
    () => Array.from(
      new Set([
        ...DEFAULT_BRANCHES.map(normalizeBranchName),
        ...(allowedBranches || []).map(normalizeBranchName),
      ])
    ).filter(Boolean),
    [allowedBranches],
  );

  // File Types list: restrict strictly to allowedTypes permissions for this user (falls back to ALL_10_FILE_TYPES if empty)
  const typesList = React.useMemo(
    () => allowedTypes && allowedTypes.length > 0 ? allowedTypes : ALL_10_FILE_TYPES,
    [allowedTypes],
  );

  const branchSelectOptions = React.useMemo(
    () => branchesList.map((b) => ({ value: b, label: b })),
    [branchesList]
  );

  const typeSelectOptions = React.useMemo(
    () => typesList.map((t) => ({ value: t, label: t })),
    [typesList]
  );

  const saleStatusOptions = React.useMemo(
    () => [
      { value: "UNSOLD", label: "UNSOLD" },
      { value: "SOLD", label: "SOLD" },
    ],
    []
  );

  if (!isOpen && !isInline) return null;

  // Handle parsing text from textarea
  const handleParseText = () => {
    if (!rawText.trim()) return;
    const parsed = parseBulkQuoteLines(rawText, sanitizerWords, branchesList);
    const sanitizedParsed = parsed.map((item) => ({
      ...item,
      file_type: typesList.includes(item.file_type)
        ? item.file_type
        : typesList[0] || item.file_type,
    }));
    setItems((prev) => [...prev, ...sanitizedParsed]);
    setRawText("");
  };

  // Handle File Picker (system files selection)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: ParsedQuoteItem[] = [];
    Array.from(files).forEach((file) => {
      const parsed = parseQuoteLine(file.name, sanitizerWords, branchesList);
      if (!typesList.includes(parsed.file_type)) {
        parsed.file_type = typesList[0] || parsed.file_type;
      }
      newItems.push(parsed);
    });

    setItems((prev) => [...prev, ...newItems]);
    // Reset file input value so same files can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Item field editing
  const handleItemChange = (
    id: string,
    field: keyof ParsedQuoteItem,
    value: any,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "file_type" && value === "Sale" && !updated.sale_status) {
          updated.sale_status = "UNSOLD";
        }
        return updated;
      }),
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setItems([]);
    setRawText("");
  };

  const handleAddManualRow = () => {
    const newItem: ParsedQuoteItem = {
      id: Math.random().toString(36).substring(2, 11),
      file_name: "",
      branch_name: branchesList[0] || "PrideCompare",
      file_type: typesList[0] || "Quote",
      entry_date: new Date().toISOString().split("T")[0],
      raw_line: "",
      status: "pending",
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Sequential Async Submission Queue
  const handleSubmitAll = async () => {
    if (items.length === 0 || isSubmitting) return;

    // Filter valid non-empty items
    const validItems = items.filter((i) => i.file_name.trim() !== "");
    if (validItems.length === 0) return;

    setIsSubmitting(true);
    setTotalToSubmit(validItems.length);

    let successCount = 0;

    // Loop through items sequentially 1-by-1
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      setCurrentIndex(i + 1);

      // Mark current item status
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "submitting" } : it,
        ),
      );

      try {
        let finalFileName = item.file_name.trim();
        if (item.file_type === "Sale") {
          const saleStatus = item.sale_status || "UNSOLD";
          if (
            !finalFileName.endsWith(" [SOLD]") &&
            !finalFileName.endsWith(" [UNSOLD]")
          ) {
            finalFileName = `${finalFileName} [${saleStatus}]`;
          }
        }

        const ok = await onSubmitRecord({
          file_name: finalFileName,
          branch_name: item.branch_name,
          codename: codename || "ANON",
          file_type: item.file_type,
          entry_date: item.entry_date || new Date().toISOString().split("T")[0],
        });

        if (ok) {
          successCount++;
          // Remove submitted item with smooth state update
          setItems((prev) => prev.filter((it) => it.id !== item.id));
        } else {
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: "error", error_message: "Submission failed" }
                : it,
            ),
          );
        }
      } catch (err: any) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "error",
                  error_message: err.message || "Failed",
                }
              : it,
          ),
        );
      }
    }

    setIsSubmitting(false);
    setCurrentIndex(null);

    if (successCount > 0) {
      onCompleteSuccess(successCount);
      if (!isInline) {
        onClose();
      }
    }
  };

  const content = (
    <div
      className={`bg-theme-card-bg/40 border border-theme-border-input rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden ${
        isInline ? "" : "max-w-4xl max-h-[90vh]"
      }`}
    >
      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Action Row: Textarea + File Picker */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
            <div className="flex-1 space-y-1.5">
              <label className="block text-xs font-bold text-theme-text-muted uppercase tracking-wider">
                Paste File Details
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Paste lines like:\nJohn Smith PrideCompare Quote\nDavid Miller EliteCare Sale`}
                rows={5}
                className="w-full p-3 bg-theme-page-bg border border-theme-border-input rounded-xl text-xs text-theme-text-primary placeholder-theme-text-muted/50 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 transition-all font-mono"
              />
            </div>
            <div className="flex flex-row sm:flex-col gap-2 shrink-0 pt-0 sm:pt-6">
              <button
                type="button"
                onClick={handleParseText}
                disabled={!rawText.trim()}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md"
              >
                <Plus className="h-4 w-4" />
                Parse Text
              </button>

              {/* System File Picker Button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="quick-import-file-picker"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                <FolderOpen className="h-4 w-4" />
                Select Files
              </button>
            </div>
          </div>
        </div>

        {/* Parsed Items List / Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-bold text-theme-text-primary uppercase tracking-wider">
                Parsed Import Queue ({items.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddManualRow}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-theme-border-input/40 hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary text-xs font-semibold transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Blank Row
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Queue
                </button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="py-12 px-4 border border-dashed border-theme-border-input/80 rounded-2xl bg-theme-page-bg/30 text-center space-y-2">
              <Upload className="h-8 w-8 text-theme-text-muted/50 mx-auto" />
              <p className="text-xs text-theme-text-muted font-medium">
                No items in queue yet. Paste text lines above or click "Pick Files" to import.
              </p>
            </div>
          ) : (
            <div className="border border-theme-border-input/80 rounded-xl bg-theme-page-bg/40 min-h-[220px] max-h-[350px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-theme-card-container/80 sticky top-0 z-10 border-b border-theme-border-input/80 text-[10px] uppercase tracking-wider text-theme-text-muted font-bold">
                  <tr>
                    <th className="py-2.5 px-3 w-36">Date</th>
                    <th className="py-2.5 px-3">File Name</th>
                    <th className="py-2.5 px-3 w-40">Branch Name</th>
                    <th className="py-2.5 px-3 w-32">File Type</th>
                    <th className="py-2.5 px-3 w-28">Sale Status</th>
                    <th className="py-2.5 px-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border-input/40">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-theme-card-bg/60 transition-colors ${
                        item.status === "submitting"
                          ? "bg-blue-500/10"
                          : item.status === "error"
                          ? "bg-red-500/10"
                          : ""
                      }`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap w-36">
                        {item.status === "submitting" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 font-bold">
                            <Loader2 className="h-3 w-3 animate-spin" /> Inserting...
                          </span>
                        ) : item.status === "error" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-bold" title={item.error_message}>
                            Failed
                          </span>
                        ) : (
                          <div className="relative w-full">
                            <input
                              type="text"
                              readOnly
                              value={formatYYYYMMDDToDDMMYYYY(
                                item.entry_date || getTodayYYYYMMDD()
                              )}
                              onClick={(e) => {
                                const hiddenInput = e.currentTarget
                                  .nextElementSibling as HTMLInputElement;
                                try {
                                  hiddenInput?.showPicker();
                                } catch {
                                  hiddenInput?.focus();
                                }
                              }}
                              disabled={isSubmitting}
                              className="block w-full px-2.5 py-1 bg-theme-page-bg/80 border border-theme-border-input/70 rounded-lg text-xs font-semibold text-theme-text-primary text-center cursor-pointer hover:border-blue-500 transition-all select-none focus:outline-none"
                              placeholder="DD-MM-YYYY"
                            />
                            <input
                              type="date"
                              value={item.entry_date || getTodayYYYYMMDD()}
                              onChange={(e) =>
                                handleItemChange(
                                  item.id,
                                  "entry_date",
                                  e.target.value
                                )
                              }
                              className="absolute w-px h-px opacity-0 pointer-events-none select-none"
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.file_name}
                          onChange={(e) =>
                            handleItemChange(item.id, "file_name", e.target.value)
                          }
                          placeholder="File name..."
                          disabled={isSubmitting}
                          className="w-full bg-theme-page-bg/80 border border-theme-border-input/70 rounded-lg px-2.5 py-1 text-xs text-theme-text-primary focus:outline-none focus:border-blue-500 transition-all font-medium"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <CustomSelect
                          value={item.branch_name}
                          onChange={(val) =>
                            handleItemChange(item.id, "branch_name", val)
                          }
                          options={branchSelectOptions}
                          disabled={isSubmitting}
                          className="w-full"
                          buttonClassName="w-full flex items-center justify-between gap-1.5 bg-theme-page-bg/80 border border-theme-border-input/70 text-theme-text-primary rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer min-h-[30px] select-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <CustomSelect
                          value={item.file_type}
                          onChange={(val) =>
                            handleItemChange(item.id, "file_type", val)
                          }
                          options={typeSelectOptions}
                          disabled={isSubmitting}
                          className="w-full"
                          buttonClassName="w-full flex items-center justify-between gap-1.5 bg-theme-page-bg/80 border border-theme-border-input/70 text-theme-text-primary rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer min-h-[30px] select-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        {item.file_type === "Sale" ? (
                          <CustomSelect
                            value={item.sale_status || "UNSOLD"}
                            onChange={(val) =>
                              handleItemChange(item.id, "sale_status", val)
                            }
                            options={saleStatusOptions}
                            disabled={isSubmitting}
                            className="w-full"
                            buttonClassName={`w-full flex items-center justify-between gap-1.5 bg-theme-page-bg/80 border rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none cursor-pointer min-h-[30px] select-none ${
                              item.sale_status === "SOLD"
                                ? "border-emerald-500/50 text-emerald-400 focus:border-emerald-400"
                                : "border-red-500/50 text-red-400 focus:border-red-400"
                            }`}
                          />
                        ) : (
                          <span className="text-theme-text-muted/40 text-[10px] font-mono">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isSubmitting}
                          className="p-1 text-theme-text-muted hover:text-red-400 rounded transition-colors disabled:opacity-50 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-theme-border-input/80 bg-theme-page-bg/40">
        <div className="text-xs text-theme-text-muted">
          {isSubmitting ? (
            <span className="text-blue-400 font-bold flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Submitting item {currentIndex} of {totalToSubmit}...
            </span>
          ) : (
            <span>{items.length} items ready for database insertion</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isInline ? (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={isSubmitting || items.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-text-secondary hover:bg-theme-border-input/50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Clear Queue
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-text-secondary hover:bg-theme-border-input/50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmitAll}
            disabled={items.length === 0 || isSubmitting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-lg cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Queue...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Submit ({items.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (isInline) {
    return <div className="w-full animate-fade-in font-sans">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      {content}
    </div>
  );
};

// Also export as default and named QuickImportView
export default QuickImportView;
