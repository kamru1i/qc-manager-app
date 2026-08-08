'use client';

import { useState, useCallback } from 'react';
import { FileType, RecordItem } from '@/types';
import { validator } from '@/utils/quotesValidator';

interface UseEditRecordModalOptions {
  records: RecordItem[];
  updateRecord: (
    id: string,
    fileName: string,
    branchName: string,
    codename: string,
    fileType: FileType,
    submittedAt?: string,
  ) => Promise<boolean>;
  bulkUpdateRecords: (
    updatesMap: Record<string, Partial<RecordItem>>,
  ) => Promise<boolean>;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export function useEditRecordModal({
  records,
  updateRecord,
  bulkUpdateRecords,
  showToast,
}: UseEditRecordModalOptions) {
  // ── State ──────────────────────────────────────────────────────────
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [editBranchName, setEditBranchName] = useState("");
  const [editCodename, setEditCodename] = useState("");
  const [editFileType, setEditFileType] = useState<FileType>("Quote");
  const [editSaleStatus, setEditSaleStatus] = useState<"SOLD" | "UNSOLD">(
    "SOLD",
  );
  const [editSubmittedDate, setEditSubmittedDate] = useState("");
  const [editSubmittedTime, setEditSubmittedTime] = useState("");
  const [editCanChangeSubmittedAt, setEditCanChangeSubmittedAt] =
    useState(false);

  // ── Handlers ───────────────────────────────────────────────────────

  const handleOpenEditRecord = useCallback(
    (record: RecordItem, canChangeSubmittedAt = false) => {
      const submittedAt = new Date(record.submitted_at);

      setEditingRecord(record);
      const cleanName = record.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, "");
      setEditFileName(cleanName);
      setEditBranchName(record.branch_name);
      setEditCodename(record.codename);
      setEditFileType(record.file_type);
      setEditCanChangeSubmittedAt(canChangeSubmittedAt);

      if (record.file_name.endsWith(" [SOLD]")) {
        setEditSaleStatus("SOLD");
      } else {
        setEditSaleStatus("UNSOLD");
      }

      if (!isNaN(submittedAt.getTime())) {
        setEditSubmittedDate(
          `${String(submittedAt.getDate()).padStart(2, "0")}-${String(
            submittedAt.getMonth() + 1,
          ).padStart(2, "0")}-${submittedAt.getFullYear()}`,
        );
        const hour24 = submittedAt.getHours();
        const hour12 = hour24 % 12 || 12;
        const meridiem = hour24 >= 12 ? "PM" : "AM";
        setEditSubmittedTime(
          `${String(hour12).padStart(2, "0")}:${String(
            submittedAt.getMinutes(),
          ).padStart(2, "0")} ${meridiem}`,
        );
      } else {
        setEditSubmittedDate("");
        setEditSubmittedTime("");
      }
    },
    [],
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingRecord) return;

    const validation = validator.validateRecordForm({
      file_name: editFileName,
      branch_name: editBranchName,
      codename: editCodename,
      file_type: editFileType,
    });

    if (!validation.isValid) {
      showToast("error", validation.errors[0]);
      return;
    }

    let editedSubmittedAt: string | undefined;

    if (editCanChangeSubmittedAt) {
      const [dayText, monthText, yearText] = editSubmittedDate.split("-");
      const day = Number(dayText);
      const month = Number(monthText);
      const year = Number(yearText);
      const parsedDate = new Date(year, month - 1, day);

      if (
        !dayText ||
        !monthText ||
        !yearText ||
        dayText.length !== 2 ||
        monthText.length !== 2 ||
        yearText.length !== 4 ||
        isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
      ) {
        showToast("error", "Please enter the date as DD-MM-YYYY.");
        return;
      }

      const timeMatch = editSubmittedTime
        .trim()
        .match(/^(0[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i);

      if (!timeMatch) {
        showToast("error", "Please enter the time as 09:21 PM/AM.");
        return;
      }

      let hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      const meridiem = timeMatch[3].toUpperCase();

      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      parsedDate.setHours(hours, minutes, 0, 0);
      editedSubmittedAt = parsedDate.toISOString();
    }

    const finalFileName =
      editFileType === "Sale"
        ? `${editFileName} [${editSaleStatus}]`
        : editFileName;
    const success = await updateRecord(
      editingRecord.id,
      finalFileName,
      editBranchName,
      editCodename,
      editFileType,
      editedSubmittedAt,
    );

    if (success) {
      setEditingRecord(null);
    }
  }, [
    editingRecord,
    editFileName,
    editBranchName,
    editCodename,
    editFileType,
    editSaleStatus,
    editCanChangeSubmittedAt,
    editSubmittedDate,
    editSubmittedTime,
    updateRecord,
    showToast,
  ]);

  const handleSaveInline = useCallback(
    async (id: string, updates: Partial<RecordItem>): Promise<boolean> => {
      if (updates.file_name !== undefined && !updates.file_name.trim()) {
        showToast("error", "File name cannot be empty.");
        return false;
      }
      if (updates.branch_name !== undefined && !updates.branch_name.trim()) {
        showToast("error", "Branch name cannot be empty.");
        return false;
      }
      if (updates.codename !== undefined && !updates.codename.trim()) {
        showToast("error", "Codename cannot be empty.");
        return false;
      }

      const originalRecord = records.find((r) => r.id === id);
      if (!originalRecord) return false;

      const finalFileName =
        updates.file_name !== undefined
          ? updates.file_name
          : originalRecord.file_name;
      const finalBranchName =
        updates.branch_name !== undefined
          ? updates.branch_name
          : originalRecord.branch_name;
      const finalCodename =
        updates.codename !== undefined
          ? updates.codename
          : originalRecord.codename;
      const finalFileType =
        updates.file_type !== undefined
          ? updates.file_type
          : originalRecord.file_type;
      const finalSubmittedAt =
        updates.submitted_at !== undefined
          ? updates.submitted_at
          : originalRecord.submitted_at;

      const success = await updateRecord(
        id,
        finalFileName,
        finalBranchName,
        finalCodename,
        finalFileType,
        finalSubmittedAt,
      );

      return success;
    },
    [records, updateRecord, showToast],
  );

  const handleBulkSaveInline = useCallback(
    async (
      updatesMap: Record<string, Partial<RecordItem>>,
    ): Promise<boolean> => {
      for (const id of Object.keys(updatesMap)) {
        const updates = updatesMap[id];
        if (updates.file_name !== undefined && !updates.file_name.trim()) {
          showToast("error", "File name cannot be empty.");
          return false;
        }
        if (updates.branch_name !== undefined && !updates.branch_name.trim()) {
          showToast("error", "Branch name cannot be empty.");
          return false;
        }
        if (updates.codename !== undefined && !updates.codename.trim()) {
          showToast("error", "Codename cannot be empty.");
          return false;
        }
      }

      const success = await bulkUpdateRecords(updatesMap);
      return success;
    },
    [bulkUpdateRecords, showToast],
  );

  return {
    // State
    editingRecord,
    editFileName,
    editBranchName,
    editCodename,
    editFileType,
    editSaleStatus,
    editSubmittedDate,
    editSubmittedTime,
    editCanChangeSubmittedAt,

    // Setters
    setEditingRecord,
    setEditFileName,
    setEditBranchName,
    setEditCodename,
    setEditFileType,
    setEditSaleStatus,
    setEditSubmittedDate,
    setEditSubmittedTime,
    setEditCanChangeSubmittedAt,

    // Handlers
    handleOpenEditRecord,
    handleSaveEdit,
    handleSaveInline,
    handleBulkSaveInline,
  };
}
