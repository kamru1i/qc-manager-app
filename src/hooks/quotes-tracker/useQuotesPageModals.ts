import { useState, useEffect } from "react";
import { FileType } from "@/types";

export function useQuotesPageModals(activeTab: string) {
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isCustomEntryModalOpen, setIsCustomEntryModalOpen] = useState(false);

  // Viewing Reports state
  const [viewingReports, setViewingReports] = useState(false);

  const updateViewingReports = (val: boolean) => {
    setViewingReports(val);
    localStorage.setItem("quotes_viewing_reports", String(val));
  };

  useEffect(() => {
    const saved = localStorage.getItem("quotes_viewing_reports") === "true";
    if (saved) {
      setViewingReports(true);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "leaderboard") {
      updateViewingReports(false);
    }
  }, [activeTab]);

  // Sale Modal state
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleFormDetails, setSaleFormDetails] = useState<{
    fileName: string;
    branchName: string;
    codename: string;
    fileType: FileType;
  } | null>(null);
  
  const [customSaleDetails, setCustomSaleDetails] = useState<{
    fileName: string;
    branchName: string;
    codename: string;
    fileType: FileType;
    userId: string;
    submittedAtDate: string;
  } | null>(null);

  // Deletion modals state
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [bulkDeletingRecordIds, setBulkDeletingRecordIds] = useState<string[] | null>(null);
  const [isBulkDeletingInProgress, setIsBulkDeletingInProgress] = useState(false);

  return {
    isBulkModalOpen,
    setIsBulkModalOpen,
    isCustomEntryModalOpen,
    setIsCustomEntryModalOpen,
    viewingReports,
    updateViewingReports,
    showSaleModal,
    setShowSaleModal,
    saleFormDetails,
    setSaleFormDetails,
    customSaleDetails,
    setCustomSaleDetails,
    deletingRecordId,
    setDeletingRecordId,
    bulkDeletingRecordIds,
    setBulkDeletingRecordIds,
    isBulkDeletingInProgress,
    setIsBulkDeletingInProgress,
  };
}
