'use client';

import { useState, useRef } from 'react';
import { RecordItem, SavedDocument } from '@/types';
import { isTauriApp } from '@/utils/apiUrlHelper';

interface UseSaveFileHelperOptions {
  showToast: (type: 'success' | 'error', text: string) => void;
}

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
  const [baseDirectory, setBaseDirectory] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const savedDate = localStorage.getItem("quotes_sales_base_save_dir_date");
      const todayDate = new Date().toDateString();
      if (savedDate === todayDate) {
        return localStorage.getItem("quotes_sales_base_save_dir") || null;
      }
    }
    return null;
  });

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

  const fallbackDownload = (htmlContent: string, fileName: string) => {
    const blob = new Blob([htmlContent], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
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
      const isTauri = isTauriApp();
      const todayDate = new Date().toDateString();

      if (isTauri) {
        const { invoke } = (window as any).__TAURI__.core;
        const selectedDir = await invoke("pick_directory") as string;
        setBaseDirectory(selectedDir);
        localStorage.setItem("quotes_sales_base_save_dir", selectedDir);
        localStorage.setItem("quotes_sales_base_save_dir_date", todayDate);
        showToast("success", `Save directory set to: ${selectedDir}`);
        return selectedDir;
      } else {
        if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
          const handle = await (window as any).showDirectoryPicker();
          baseDirectoryHandleRef.current = handle;
          
          const label = `Local_Directory/${handle.name}`;
          setBaseDirectory(label);
          localStorage.setItem("quotes_sales_base_save_dir", label);
          localStorage.setItem("quotes_sales_base_save_dir_date", todayDate);
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

    // 1. Get or choose base directory
    let currentBaseDir = baseDirectory;
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
      let savedPath = "";

      if (isTauri) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(wrappedHtml);
        const { invoke } = (window as any).__TAURI__.core;

        savedPath = await invoke("save_file_to_dir", {
          baseDir: currentBaseDir,
          subFolder,
          fileName: generatedFileName,
          content: Array.from(bytes),
        }) as string;
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
            await writable.write(wrappedHtml);
            await writable.close();
            
            savedPath = `Local_File/${handle.name}`;
            fileHandlesRef.current[savedPath] = handle;
          } catch (writeErr: any) {
            if (writeErr.name === "AbortError") {
              throw new Error("Save cancelled");
            }
            console.error("Failed to save via save file picker:", writeErr);
            fallbackDownload(wrappedHtml, generatedFileName);
            savedPath = `Web_Downloads/${generatedFileName}`;
          }
        } else {
          fallbackDownload(wrappedHtml, generatedFileName);
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

      if (isTauri) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(wrappedHtml);
        const { invoke } = (window as any).__TAURI__.core;

        await invoke("overwrite_file", {
          filePath: savedFilePath,
          content: Array.from(bytes),
        });
        showToast("success", `File updated successfully!`);
      } else {
        // Web Fallback: Check if file handle exists to overwrite
        const cachedHandle = fileHandlesRef.current[savedFilePath];
        if (cachedHandle) {
          try {
            const writable = await cachedHandle.createWritable();
            await writable.write(wrappedHtml);
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
            await writable.write(wrappedHtml);
            await writable.close();
            
            fileHandlesRef.current[savedFilePath] = handle;
            showToast("success", `File updated successfully!`);
          }
        } else {
          const filename = savedFilePath.split("/").pop() || "document.docx";
          fallbackDownload(wrappedHtml, filename);
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
    
    // Check if we need to select folder first (only required for Tauri native saving)
    const needsFolderSelection = isTauri ? !baseDirectory : false;

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
