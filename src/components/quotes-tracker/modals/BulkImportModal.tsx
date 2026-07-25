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
} from "@/utils/bulkQuoteParser";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allowedBranches: string[];
  allowedTypes: string[];
  sanitizerWords: string[];
  codename: string;
  onSubmitRecord: (recordData: {
    file_name: string;
    branch_name: string;
    codename: string;
    file_type: string;
  }) => Promise<boolean>;
  onCompleteSuccess: (count: number) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
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

  if (!isOpen) return null;

  const branchesList =
    allowedBranches.length > 0 ? allowedBranches : DEFAULT_BRANCHES;
  const defaultBranch = branchesList[0] || "PrideCompare";
  const fileTypesList =
    allowedTypes.length > 0 ? allowedTypes : ALL_10_FILE_TYPES;

  // Handle parsing text from textarea
  const handleParseText = () => {
    if (!rawText.trim()) return;
    const parsed = parseBulkQuoteLines(rawText, sanitizerWords, branchesList);
    setItems((prev) => [...prev, ...parsed]);
    setRawText("");
  };

  // Handle File Picker (system files selection)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: ParsedQuoteItem[] = [];
    Array.from(files).forEach((file) => {
      const parsed = parseQuoteLine(file.name, sanitizerWords, branchesList);
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
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
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
      branch_name: defaultBranch,
      file_type: "Quote",
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
        const ok = await onSubmitRecord({
          file_name: item.file_name.trim(),
          branch_name: item.branch_name,
          codename: codename || "ANON",
          file_type: item.file_type,
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
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-theme-card-bg border border-theme-border-input rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border-input/80 bg-theme-page-bg/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-theme-text-primary">
                Quick Import
              </h3>
              <p className="text-xs text-theme-text-muted">
                Paste raw lines or pick files from your computer to auto-detect
                branches & filetypes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-border-input/50 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Row: Textarea + File Picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-theme-text-secondary flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-400" />
                Paste Raw File Details or Select System Files
              </label>

              {/* System File Picker Button */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Select Files
                </button>
              </div>
            </div>

            {/* Multiline Raw Input */}
            <textarea
              rows={4}
              value={rawText}
              disabled={isSubmitting}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Paste multiple lines here. Example:\nAli Gull BI Requote\nBenjamin Harris-price Swan drive\nJalal Udin Ahmadzai BC requote\nMuhammad Akif Jacaria Abdulgani Sort\nRaminder SINGH ADI`}
              className="block w-full p-3 bg-theme-page-bg border border-theme-border-input rounded-xl text-theme-text-primary placeholder-theme-text-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono transition-all disabled:opacity-50"
            />

            <div className="flex justify-end gap-2">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Clear Queue
                </button>
              )}
              <button
                type="button"
                onClick={handleParseText}
                disabled={!rawText.trim() || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Parse Text Lines
              </button>
            </div>
          </div>

          {/* Extracted Review Queue List */}
          <div className="space-y-3 border-t border-theme-border-input/80 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-theme-text-primary">
                  Ready for Import ({items.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={handleAddManualRow}
                disabled={isSubmitting}
                className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Row
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-theme-border-input/60 rounded-xl text-theme-text-muted text-xs">
                No items in queue. Paste text lines above or click{" "}
                <strong>Select Files</strong>.
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl border transition-all duration-300 ${
                      item.status === "submitting"
                        ? "bg-blue-500/10 border-blue-500/50 shadow-lg scale-[1.01]"
                        : item.status === "error"
                          ? "bg-red-500/10 border-red-500/40"
                          : "bg-theme-page-bg/60 border-theme-border-input/70 hover:border-theme-border-input"
                    }`}
                  >
                    <span className="text-[11px] font-bold text-theme-text-muted w-6 shrink-0 text-center">
                      #{idx + 1}
                    </span>

                    {/* File Name Field */}
                    <div className="flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={item.file_name}
                        disabled={isSubmitting}
                        onChange={(e) =>
                          handleItemChange(item.id, "file_name", e.target.value)
                        }
                        placeholder="File / Client Name"
                        className="w-full px-3 py-1.5 bg-theme-card-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Branch Dropdown */}
                    <div className="w-full sm:w-[150px] shrink-0">
                      <select
                        value={item.branch_name}
                        disabled={isSubmitting}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "branch_name",
                            e.target.value,
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-theme-card-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {branchesList.map((b: string) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* File Type Dropdown */}
                    <div className="w-full sm:w-[150px] shrink-0">
                      <select
                        value={item.file_type}
                        disabled={isSubmitting}
                        onChange={(e) =>
                          handleItemChange(item.id, "file_type", e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 bg-theme-card-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {fileTypesList.map((t: string) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status / Actions */}
                    <div className="flex items-center justify-end gap-2 shrink-0">
                      {item.status === "submitting" && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      )}
                      {item.status === "error" && (
                        <span className="text-[10px] text-red-400 font-bold">
                          Failed
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isSubmitting}
                        className="p-1 text-theme-text-muted hover:text-red-400 transition-colors disabled:opacity-30"
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
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
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-theme-text-secondary hover:bg-theme-border-input/50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
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
                  Submit All ({items.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
