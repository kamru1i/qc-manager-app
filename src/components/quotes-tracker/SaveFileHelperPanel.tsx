"use client";

import React from "react";
import { Save, ArrowLeft, Check, X, Edit3, Trash2 } from "lucide-react";
import { RecordItem, SavedDocument } from "@/types";
import { ConfirmModal } from "@/components/common/modals/ConfirmModal";
import { isTauriApp } from "@/utils/apiUrlHelper";

interface SaveFileHelperPanelProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  baseDirectory: string | null;
  handleChooseDirectory: () => void;
  todayUserRecords: RecordItem[];
  savedRecordIds: string[];
  selectedRecordIdForSave: string | null;
  setSelectedRecordIdForSave: (id: string | null) => void;
  savedFilePath: string | null;
  handleUpdateWord: () => void;
  handleCancelEdit: () => void;
  handleSaveAsWord: () => void;
  savedDocuments: SavedDocument[];
  handleEditDocument: (doc: SavedDocument) => void;
  handleDeleteDocument: (docId: string, recordId: string) => void;
  setShowSaveFileHelper: (val: boolean) => void;
  permissionModal: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  };
  setPermissionModal: React.Dispatch<React.SetStateAction<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>>;
}

export const SaveFileHelperPanel: React.FC<SaveFileHelperPanelProps> = ({
  editorRef,
  baseDirectory,
  handleChooseDirectory,
  todayUserRecords,
  savedRecordIds,
  selectedRecordIdForSave,
  setSelectedRecordIdForSave,
  savedFilePath,
  handleUpdateWord,
  handleCancelEdit,
  handleSaveAsWord,
  savedDocuments,
  handleEditDocument,
  handleDeleteDocument,
  setShowSaveFileHelper,
  permissionModal,
  setPermissionModal,
}) => {
  const [isEditorEmpty, setIsEditorEmpty] = React.useState(true);

  React.useEffect(() => {
    const handleInput = () => {
      if (editorRef.current) {
        const text = editorRef.current.innerText || "";
        const html = editorRef.current.innerHTML || "";
        const cleanHtml = html.replace(/<br\s*\/?>/gi, "").trim();
        setIsEditorEmpty(text.trim() === "" && cleanHtml === "");
      }
    };

    const editorEl = editorRef.current;
    if (editorEl) {
      editorEl.addEventListener("input", handleInput);
      
      const observer = new MutationObserver(handleInput);
      observer.observe(editorEl, { childList: true, characterData: true, subtree: true });

      handleInput();

      return () => {
        editorEl.removeEventListener("input", handleInput);
        observer.disconnect();
      };
    }
  }, [editorRef]);

  return (
    <div className="bg-theme-page-bg/20 border border-theme-border-muted rounded-2xl p-5 space-y-6 animate-fade-in text-theme-text-primary">
      <div className="flex justify-between items-center border-b border-theme-border-muted/80 pb-4">
        <div>
          <h4 className="text-md font-bold text-theme-text-primary flex items-center gap-2">
            <Save className="h-4.5 w-4.5 text-blue-500" />
            Save Outlook File Helper
          </h4>
          <p className="text-[11px] text-theme-text-muted mt-0.5">
            Paste rich-text (tables/colored lists) from Outlook, choose a daily list record for the file name, and save to disk.
          </p>
        </div>
        <button
          onClick={() => setShowSaveFileHelper(false)}
          className="flex items-center justify-center p-2 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer"
          title="Back to Table"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left and Middle Columns (2/3 width on large screens): Rich Editor and Controls */}
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider block">
              Paste Outlook Content Below (Tables, Colors & Layouts will be preserved):
            </label>
            <div className="relative">
              <div
                contentEditable
                ref={editorRef}
                className="w-full min-h-[300px] max-h-[500px] overflow-auto p-4 bg-theme-card-bg/50 border border-theme-border-input rounded-xl text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-sans shadow-inner leading-relaxed outlook-rich-editor"
                style={{ outline: "none" }}
              />
              <style dangerouslySetInnerHTML={{__html: `
                .outlook-rich-editor {
                  overflow: auto !important;
                }
                .outlook-rich-editor table {
                  min-width: max-content !important;
                  width: auto !important;
                  display: table !important;
                }
                .outlook-rich-editor th, .outlook-rich-editor td {
                  white-space: nowrap !important;
                  padding: 6px 10px !important;
                }
              `}} />
              {/* Visual Instructions */}
              <div className="absolute bottom-2.5 right-3 text-[10px] text-theme-text-muted bg-theme-card-container/80 px-2 py-1 rounded border border-theme-border-input/60 pointer-events-none">
                Supports Tables, Colors, & Styles
              </div>
            </div>
          </div>

          {/* Directory Selection Display */}
          {isTauriApp() ? (
            <div className="bg-theme-card-bg/40 border border-theme-border-muted rounded-xl p-3 flex items-center justify-between text-xs gap-3">
              <div className="space-y-0.5 truncate">
                <span className="text-[10px] text-theme-text-muted font-bold uppercase tracking-wider block">Today's Save Directory:</span>
                {baseDirectory ? (
                  <span className="font-mono text-blue-400 break-all select-all font-semibold" title={baseDirectory}>{baseDirectory}</span>
                ) : (
                  <span className="text-purple-400 italic">No save directory chosen for today yet. (Will prompt on Save)</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleChooseDirectory}
                className="px-2.5 py-1.5 bg-theme-border-input hover:bg-theme-border-active text-theme-text-primary rounded-lg font-semibold text-[10px] cursor-pointer transition-all border border-theme-border-active hover:border-theme-border-active shrink-0"
              >
                {baseDirectory ? "Change Folder" : "Choose Folder"}
              </button>
            </div>
          ) : (
            <div className="bg-theme-card-bg/20 border border-theme-border-muted/40 rounded-xl p-3 text-xs text-theme-text-muted flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse"></span>
              <span>Web Browser Mode: Files will save directly via the browser's native Save dialog (zero folder permission warnings).</span>
            </div>
          )}

          {/* Filename Records Checklist */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider block">
              Choose Record for Filename (Filename Branch Filetype.docx):
            </label>
            <div className="bg-theme-card-bg/40 border border-theme-border-muted rounded-xl p-3 max-h-52 overflow-y-auto space-y-1.5">
              {todayUserRecords.filter(r => !savedRecordIds.includes(r.id)).length > 0 ? (
                todayUserRecords
                  .filter(r => !savedRecordIds.includes(r.id))
                  .map((r) => {
                    const cleanName = r.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, "");
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRecordIdForSave(r.id)}
                        className={`flex items-center gap-3 p-2 rounded-lg border transition-all cursor-pointer ${
                          selectedRecordIdForSave === r.id
                            ? "border-blue-500/40 bg-blue-500/5 text-white"
                            : "border-transparent bg-theme-page-bg/30 text-theme-text-secondary hover:bg-theme-page-bg/60"
                        }`}
                      >
                        <button
                          type="button"
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                            selectedRecordIdForSave === r.id
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-theme-border-active text-transparent"
                          }`}
                        >
                          <Check className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-xs font-mono">
                          {cleanName} <span className="text-theme-text-muted font-sans">({r.branch_name} &bull; {r.file_type})</span>
                        </span>
                      </div>
                    );
                  })
              ) : (
                <div className="text-theme-text-muted italic text-xs text-center py-4">
                  No new unsaved entries today (all saved or empty)
                </div>
              )}
            </div>
          </div>

          {/* Save Action Row */}
          <div className="flex items-center gap-3 pt-2">
            {savedFilePath ? (
              <>
                <button
                  disabled={isEditorEmpty}
                  onClick={handleUpdateWord}
                  className={`flex items-center gap-1.5 font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all ${
                    isEditorEmpty
                      ? "bg-theme-border-input text-theme-text-muted border border-theme-border-active cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white cursor-pointer"
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save / Update File</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 bg-theme-border-input hover:bg-theme-border-active text-theme-text-secondary font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer border border-theme-border-active"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel / New File</span>
                </button>
              </>
            ) : (
              <button
                disabled={isEditorEmpty || !selectedRecordIdForSave}
                onClick={handleSaveAsWord}
                className={`flex items-center gap-1.5 font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all ${
                  isEditorEmpty || !selectedRecordIdForSave
                    ? "bg-theme-border-input text-theme-text-muted border border-theme-border-active cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white cursor-pointer"
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save As</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column (1/3 width on large screens): Saved Files History List */}
        <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-theme-border-muted pt-5 lg:pt-0 lg:pl-6">
          <div>
            <h5 className="text-xs font-bold text-theme-text-secondary uppercase tracking-wider">
              Saved Documents History
            </h5>
            <p className="text-[10px] text-theme-text-muted mt-0.5">
              Manage and edit previously saved files in this session.
            </p>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {savedDocuments.length > 0 ? (
              savedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-3 bg-theme-card-bg/60 border rounded-xl space-y-2 transition-all ${
                    savedFilePath === doc.filePath
                      ? "border-blue-500/40 bg-theme-card-bg"
                      : "border-theme-border-input/80 hover:border-theme-border-input"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-theme-text-primary truncate" title={doc.filename}>
                      {doc.filename}
                    </div>
                    <div className="text-[9px] text-theme-text-muted truncate" title={doc.filePath}>
                      {doc.filePath}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditDocument(doc)}
                      className="px-2 py-1 bg-theme-border-input hover:bg-theme-border-active text-blue-400 hover:text-blue-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-all border border-theme-border-active"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.recordId)}
                      className="px-2 py-1 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-all border border-rose-950/30 ml-auto"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-theme-text-muted/80 italic text-xs text-center py-8">
                No files saved yet in history.
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={permissionModal.isOpen}
        onClose={() => setPermissionModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={permissionModal.onConfirm}
        title={permissionModal.title}
        message={permissionModal.message}
        confirmText={permissionModal.confirmText}
        cancelText="No"
        isDanger={false}
      />
    </div>
  );
};
