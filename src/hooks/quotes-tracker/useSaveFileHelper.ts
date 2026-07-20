'use client';

import { useState, useRef } from 'react';
import { RecordItem, SavedDocument } from '@/types';
import { isTauriApp } from '@/utils/apiUrlHelper';
import { Capacitor } from '@capacitor/core';

interface UseSaveFileHelperOptions {
  showToast: (type: 'success' | 'error', text: string) => void;
}

// ── Once-per-day save directory persistence ─────────────────────────
// Single source of truth for "today's save directory", shared by BOTH the
// manual "Choose Folder" flow and the "Save As" flow. Reading localStorage at
// call time (instead of React state captured in a closure) is what guarantees
// a directory picked moments ago is visible to the code that runs next —
// React state reads inside stale closures caused the old double-prompt bug.
const DIR_KEY = 'quotes_sales_base_save_dir';
const DIR_DATE_KEY = 'quotes_sales_base_save_dir_date';

const clearExpiredDirectory = () => {
  if (typeof window === 'undefined') return;
  const savedDate = localStorage.getItem(DIR_DATE_KEY);
  if (savedDate && savedDate !== new Date().toDateString()) {
    localStorage.removeItem(DIR_KEY);
    localStorage.removeItem(DIR_DATE_KEY);
  }
};

const getTodayDirectory = (): string | null => {
  if (typeof window === 'undefined') return null;
  clearExpiredDirectory();
  return localStorage.getItem(DIR_KEY) || null;
};

const setTodayDirectory = (path: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DIR_KEY, path);
  localStorage.setItem(DIR_DATE_KEY, new Date().toDateString());
};

export const useSaveFileHelper = ({ showToast }: UseSaveFileHelperOptions) => {
  // ── State ──────────────────────────────────────────────────────────
  const [savedRecordIds, setSavedRecordIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const savedDate = localStorage.getItem("quotes_sales_saved_docs_date");
      const todayDate = new Date().toDateString();
      if (savedDate !== todayDate) {
        // New day — clear yesterday's saved document tracking data
        localStorage.removeItem("quotes_sales_saved_record_ids");
        localStorage.removeItem("quotes_sales_saved_documents");
        localStorage.setItem("quotes_sales_saved_docs_date", todayDate);
        return [];
      }
      const saved = localStorage.getItem("quotes_sales_saved_record_ids");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>(() => {
    if (typeof window !== "undefined") {
      const savedDate = localStorage.getItem("quotes_sales_saved_docs_date");
      const todayDate = new Date().toDateString();
      if (savedDate !== todayDate) {
        return [];
      }
      const saved = localStorage.getItem("quotes_sales_saved_documents");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [selectedRecordIdForSave, setSelectedRecordIdForSave] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileHandlesRef = useRef<Record<string, any>>({});
  const baseDirectoryHandleRef = useRef<any>(null);
  const [baseDirectory, setBaseDirectory] = useState<string | null>(() => getTodayDirectory());

  const [permissionModal, setPermissionModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    onConfirm: () => {},
  });

  // ── Helpers ────────────────────────────────────────────────────────
  const wrapHtmlForDocx = (contentHtml: string) => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.15;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
  }
  table, th, td {
    border: 1px solid #a0aec0;
  }
  th, td {
    padding: 8px;
    text-align: left;
  }
</style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;
  };

  const fallbackDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Handlers ───────────────────────────────────────────────────────
  const handleChooseDirectory = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        showToast("success", "Using system share sheet for files saving");
        return "Capacitor_Cache";
      }

      const isTauri = isTauriApp();

      if (isTauri) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selectedDir = await open({
          directory: true,
          multiple: false,
          title: "Select Save Directory"
        }) as string | null;

        if (!selectedDir) {
          return null; // User cancelled
        }

        setBaseDirectory(selectedDir);
        setTodayDirectory(selectedDir);
        showToast("success", `Save directory set to: ${selectedDir}`);
        return selectedDir;
      } else {
        if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
          const handle = await (window as any).showDirectoryPicker();
          baseDirectoryHandleRef.current = handle;

          const label = `Local_Directory/${handle.name}`;
          setBaseDirectory(label);
          setTodayDirectory(label);
          showToast("success", `Save directory set to: ${handle.name}`);
          return label;
        } else {
          showToast("error", "Directory picking is not supported by this browser. Files will download normally.");
          return null;
        }
      }
    } catch (err) {
      const errMsg = String(err);
      if (!errMsg.includes("AbortError") && !errMsg.includes("cancelled")) {
        showToast("error", `Failed to select directory: ${errMsg}`);
      }
      return null;
    }
  };

  const handleSaveAsWord = async (todayUserRecords: RecordItem[]) => {
    if (!selectedRecordIdForSave) {
      showToast("error", "Please select a record (circle checkbox) to generate the file name.");
      return;
    }
    const record = todayUserRecords.find(r => r.id === selectedRecordIdForSave);
    if (!record) {
      showToast("error", "Selected record not found.");
      return;
    }

    const editorHtml = editorRef.current?.innerHTML || "";
    if (!editorHtml || editorHtml.trim() === "" || editorHtml === "<br>") {
      showToast("error", "Please paste some content into the input field first.");
      return;
    }

    // 1. Get or choose base directory — read from today's persisted value at
    // call time (NOT the baseDirectory state, which can be a stale closure
    // when this runs from the permission modal's onConfirm).
    let currentBaseDir = getTodayDirectory();
    const isTauri = isTauriApp();

    if (isTauri) {
      if (!currentBaseDir) {
        currentBaseDir = await handleChooseDirectory();
        if (!currentBaseDir) return; // Cancelled
      }
    } else {
      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        if (!baseDirectoryHandleRef.current) {
          currentBaseDir = await handleChooseDirectory();
          if (!currentBaseDir) return; // Cancelled
        }
      }
    }

    // 2. Determine subfolder (Sold/Unsold for Sales, None for others)
    let subFolder: string | null = null;
    if (record.file_type === "Sale") {
      if (record.file_name.endsWith(" [SOLD]")) {
        subFolder = "Sold";
      } else if (record.file_name.endsWith(" [UNSOLD]")) {
        subFolder = "Unsold";
      } else {
        subFolder = "Sold"; // Default
      }
    }

    const cleanName = record.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, "");
    const generatedFileName = `${cleanName} ${record.branch_name} ${record.file_type}.docx`;

    try {
      const wrappedHtml = wrapHtmlForDocx(editorHtml);
      // Lazy-load the docx converter — only needed when actually saving,
      // keeps it out of the initial /quotes bundle (same pattern as the
      // Capacitor plugins below).
      const { asBlob } = await import('html-docx-ts');
      const docxBlob = (await asBlob(wrappedHtml)) as Blob;
      let savedPath = "";

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        // Convert Blob to Base64
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Clean = base64String.split(',')[1];
            resolve(base64Clean);
          };
          reader.readAsDataURL(docxBlob);
        });

        // Write to native cache directory
        const writeResult = await Filesystem.writeFile({
          path: generatedFileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        savedPath = writeResult.uri;

        // Open native sharing sheet so user can copy/save/send
        await Share.share({
          title: 'Save Word Document',
          text: `Save or share ${generatedFileName}`,
          url: writeResult.uri,
          dialogTitle: 'Save Word Document',
        });
      } else if (isTauri) {
        const arrayBuffer = await docxBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const { join } = await import('@tauri-apps/api/path');
        const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');

        let targetDir = currentBaseDir || "";
        if (subFolder) {
          targetDir = await join(currentBaseDir || "", subFolder);
          await mkdir(targetDir, { recursive: true });
        }
        const finalPath = await join(targetDir, generatedFileName);
        await writeFile(finalPath, bytes);
        savedPath = finalPath;
      } else {
        // Web Fallback: Use showSaveFilePicker directly for clean file saving without folder permission warnings
        if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: generatedFileName,
              types: [{
                description: 'Word Document (.docx)',
                accept: {
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                }
              }]
            });
            const writable = await handle.createWritable();
            await writable.write(docxBlob);
            await writable.close();
            
            savedPath = `Local_File/${handle.name}`;
            fileHandlesRef.current[savedPath] = handle;
          } catch (writeErr: any) {
            if (writeErr.name === "AbortError") {
              throw new Error("Save cancelled");
            }
            console.error("Failed to save via save file picker:", writeErr);
            fallbackDownload(docxBlob, generatedFileName);
            savedPath = `Web_Downloads/${generatedFileName}`;
          }
        } else {
          fallbackDownload(docxBlob, generatedFileName);
          savedPath = `Web_Downloads/${generatedFileName}`;
        }
      }

      showToast("success", `File saved successfully!`);

      const newDocId = crypto.randomUUID();
      const newDoc = {
        id: newDocId,
        filename: generatedFileName,
        filePath: savedPath,
        htmlContent: editorHtml,
        recordId: record.id,
        savedAt: new Date().toISOString(),
      };

      const updatedDocs = [newDoc, ...savedDocuments];
      setSavedDocuments(updatedDocs);
      localStorage.setItem("quotes_sales_saved_documents", JSON.stringify(updatedDocs));

      const updatedRecordIds = [...savedRecordIds, record.id];
      setSavedRecordIds(updatedRecordIds);
      localStorage.setItem("quotes_sales_saved_record_ids", JSON.stringify(updatedRecordIds));

      setSavedFilePath(savedPath);
    } catch (err) {
      const errMsg = String(err);
      if (errMsg !== "Save cancelled") {
        showToast("error", `Failed to save file: ${errMsg}`);
      }
    }
  };

  const handleUpdateWord = async () => {
    if (!savedFilePath) {
      showToast("error", "No active file path. Please click 'Save As' first.");
      return;
    }

    const editorHtml = editorRef.current?.innerHTML || "";
    if (!editorHtml || editorHtml.trim() === "" || editorHtml === "<br>") {
      showToast("error", "Editor content is empty.");
      return;
    }

    try {
      const isTauri = isTauriApp();
      const wrappedHtml = wrapHtmlForDocx(editorHtml);
      // Lazy-load the docx converter (see note in the other save path)
      const { asBlob } = await import('html-docx-ts');
      const docxBlob = (await asBlob(wrappedHtml)) as Blob;

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Clean = base64String.split(',')[1];
            resolve(base64Clean);
          };
          reader.readAsDataURL(docxBlob);
        });

        const filename = savedFilePath.split("/").pop() || "document.docx";

        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: 'Update Word Document',
          text: `Update or share ${filename}`,
          url: writeResult.uri,
          dialogTitle: 'Update Word Document',
        });
        showToast("success", `File updated successfully!`);
      } else if (isTauri) {
        const arrayBuffer = await docxBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const { writeFile } = await import('@tauri-apps/plugin-fs');

        if (savedFilePath) {
          await writeFile(savedFilePath, bytes);
        }
        showToast("success", `File updated successfully!`);
      } else {
        // Web Fallback: Check if file handle exists to overwrite
        const cachedHandle = fileHandlesRef.current[savedFilePath];
        if (cachedHandle) {
          try {
            const writable = await cachedHandle.createWritable();
            await writable.write(docxBlob);
            await writable.close();
            showToast("success", `File updated successfully!`);
          } catch (writeErr) {
            console.error("Failed to write to file handle:", writeErr);
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: savedFilePath.split("/").pop() || "document.docx",
              types: [{
                description: 'Word Document (.docx)',
                accept: {
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                }
              }]
            });
            const writable = await handle.createWritable();
            await writable.write(docxBlob);
            await writable.close();
            
            fileHandlesRef.current[savedFilePath] = handle;
            showToast("success", `File updated successfully!`);
          }
        } else {
          const filename = savedFilePath.split("/").pop() || "document.docx";
          fallbackDownload(docxBlob, filename);
          showToast("success", `Updated file downloaded as ${filename}`);
        }
      }

      const updatedDocs = savedDocuments.map(doc => {
        if (doc.filePath === savedFilePath) {
          return { ...doc, htmlContent: editorHtml };
        }
        return doc;
      });
      setSavedDocuments(updatedDocs);
      localStorage.setItem("quotes_sales_saved_documents", JSON.stringify(updatedDocs));
    } catch (err) {
      showToast("error", `Failed to update file: ${err}`);
    }
  };

  const handleEditDocument = (doc: SavedDocument) => {
    setSavedFilePath(doc.filePath);
    setSelectedRecordIdForSave(doc.recordId);
    if (editorRef.current) {
      editorRef.current.innerHTML = doc.htmlContent;
      // Defensively fire input event so MutationObserver / input listeners reliably
      // update the isEditorEmpty state inside SaveFileHelperPanel
      editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
    showToast("success", `Loaded "${doc.filename}" for editing.`);
  };

  const handleCancelEdit = () => {
    setSavedFilePath(null);
    setSelectedRecordIdForSave(null);
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
      // Defensively fire input event so isEditorEmpty resets to true
      editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const handleDeleteDocument = (docId: string, recordId: string) => {
    const updatedDocs = savedDocuments.filter(d => d.id !== docId);
    setSavedDocuments(updatedDocs);
    localStorage.setItem("quotes_sales_saved_documents", JSON.stringify(updatedDocs));

    const updatedRecordIds = savedRecordIds.filter(id => id !== recordId);
    setSavedRecordIds(updatedRecordIds);
    localStorage.setItem("quotes_sales_saved_record_ids", JSON.stringify(updatedRecordIds));

    if (selectedRecordIdForSave === recordId) {
      setSavedFilePath(null);
      setSelectedRecordIdForSave(null);
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
        editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    showToast("success", "Document removed from tracker list.");
  };

  const triggerChooseDirectoryWithPermission = () => {
    setPermissionModal({
      isOpen: true,
      title: "Folder Access Permission Required",
      message: "This application needs folder access permission to save generated Word documents directly to your local computer. Would you like to select a directory now?",
      confirmText: "Yes, Choose Folder",
      onConfirm: async () => {
        setPermissionModal(prev => ({ ...prev, isOpen: false }));
        await handleChooseDirectory();
      }
    });
  };

  const triggerSaveWithPermission = async (todayUserRecords: RecordItem[]) => {
    if (!selectedRecordIdForSave) {
      showToast("error", "Please select a record (circle checkbox) to generate the file name.");
      return;
    }
    const record = todayUserRecords.find(r => r.id === selectedRecordIdForSave);
    if (!record) {
      showToast("error", "Selected record not found.");
      return;
    }

    const editorHtml = editorRef.current?.innerHTML || "";
    if (!editorHtml || editorHtml.trim() === "" || editorHtml === "<br>") {
      showToast("error", "Please paste some content into the input field first.");
      return;
    }

    const isTauri = isTauriApp();

    // Check if we need to select folder first (only required for Tauri native
    // saving). Read the persisted once-per-day value, not React state: state
    // can lag right after a manual folder pick, which caused a redundant
    // second prompt on the same day.
    const needsFolderSelection = isTauri ? !getTodayDirectory() : false;

    if (needsFolderSelection) {
      setPermissionModal({
        isOpen: true,
        title: "Folder Access Required",
        message: `Please authorize a save directory on your computer to save "${record.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, "")}". Would you like to choose a folder now?`,
        confirmText: "Select Folder",
        onConfirm: async () => {
          setPermissionModal(prev => ({ ...prev, isOpen: false }));
          const chosenDir = await handleChooseDirectory();
          if (chosenDir) {
            // Add slight timeout to let modal close smoothly before execution
            setTimeout(() => {
              handleSaveAsWord(todayUserRecords);
            }, 250);
          }
        }
      });
    } else {
      await handleSaveAsWord(todayUserRecords);
    }
  };

  return {
    // State
    savedRecordIds,
    savedDocuments,
    savedFilePath,
    selectedRecordIdForSave,
    setSelectedRecordIdForSave,
    editorRef,
    baseDirectory,
    permissionModal,
    setPermissionModal,
    // Handlers
    handleChooseDirectory,
    handleSaveAsWord,
    handleUpdateWord,
    handleEditDocument,
    handleCancelEdit,
    handleDeleteDocument,
    triggerChooseDirectoryWithPermission,
    triggerSaveWithPermission,
  };
};
