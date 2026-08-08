import React from "react";
import { createPortal } from "react-dom";
import { SaleStatusModal } from "@/components/quotes-tracker/modals/SaleStatusModal";
import { EditRecordModal } from "@/components/quotes-tracker/modals/EditRecordModal";
import { ConfirmModal } from "@/components/common/modals/ConfirmModal";
import { CustomEntryModal } from "@/components/quotes-tracker/modals/CustomEntryModal";
import { QuickImportView } from "@/components/quotes-tracker/QuickImportView";
import { FileType } from "@/types";
import { getSanitizerWords } from "@/utils/dashboardHelpers";

export interface QuotesModalsGroupProps {
  showSaleModal: boolean;
  setShowSaleModal: (val: boolean) => void;
  saleFormDetails: any;
  setSaleFormDetails: (val: any) => void;
  customSaleDetails: any;
  setCustomSaleDetails: (val: any) => void;
  handleConfirmSaleStatus: (status: "SOLD" | "UNSOLD") => Promise<void>;
  
  editingRecord: any;
  setEditingRecord: (val: any) => void;
  editFileName: string;
  setEditFileName: (val: string) => void;
  editBranchName: string;
  setEditBranchName: (val: string) => void;
  editCodename: string;
  setEditCodename: (val: string) => void;
  editFileType: FileType;
  setEditFileType: (val: FileType) => void;
  editCanChangeSubmittedAt: boolean;
  editSubmittedDate: string;
  setEditSubmittedDate: (val: string) => void;
  editSubmittedTime: string;
  setEditSubmittedTime: (val: string) => void;
  editSaleStatus: "SOLD" | "UNSOLD";
  setEditSaleStatus: (val: "SOLD" | "UNSOLD") => void;
  handleSaveEdit: () => Promise<void>;
  
  deletingRecordId: string | null;
  setDeletingRecordId: (val: string | null) => void;
  deleteRecord: (id: string) => Promise<boolean>;
  
  bulkDeletingRecordIds: string[] | null;
  setBulkDeletingRecordIds: (val: string[] | null) => void;
  isBulkDeletingInProgress: boolean;
  setIsBulkDeletingInProgress: (val: boolean) => void;
  deleteRecords: (ids: string[]) => Promise<boolean>;
  
  isCustomEntryModalOpen: boolean;
  setIsCustomEntryModalOpen: (val: boolean) => void;
  handleAdminCustomEntrySubmit: (fName: string, bName: string, fType: FileType, userId: string, submittedAtDate: string) => Promise<boolean>;
  
  isBulkModalOpen: boolean;
  setIsBulkModalOpen: (val: boolean) => void;
  allMasterBranches: string[];
  
  allowedCategories: string[];
  profilesList: any[];
  profile: any;
  globalSettings: any;
  submitting: boolean;
  isAdmin: boolean;
  adminViewMode: "all" | "mine";
  ownCodename: string;
  addRecord: (fileName: string, branchName: string, codename: string, fileType: FileType, userId?: string, submittedAt?: string, options?: any) => Promise<boolean>;
  showToast: (type: "success" | "error", message: string) => void;
  fetchRecords: () => Promise<void>;
}

export const QuotesModalsGroup = React.memo((props: QuotesModalsGroupProps) => {
  if (typeof window === "undefined") return null;
  
  const portalRoot = document.getElementById("root-modals-portal");
  if (!portalRoot) return null;

  return createPortal(
    <>
      <SaleStatusModal
        isOpen={props.showSaleModal}
        fileName={
          props.customSaleDetails?.fileName || props.saleFormDetails?.fileName || ""
        }
        onConfirm={props.handleConfirmSaleStatus}
        onClose={() => {
          props.setShowSaleModal(false);
          props.setSaleFormDetails(null);
          props.setCustomSaleDetails(null);
        }}
      />

      {props.editingRecord && (
        <EditRecordModal
          editFileName={props.editFileName}
          setEditFileName={props.setEditFileName}
          editBranchName={props.editBranchName}
          setEditBranchName={props.setEditBranchName}
          editCodename={props.editCodename}
          setEditCodename={props.setEditCodename}
          editFileType={props.editFileType}
          setEditFileType={props.setEditFileType}
          canEditSubmittedAt={props.editCanChangeSubmittedAt}
          editSubmittedDate={props.editSubmittedDate}
          setEditSubmittedDate={props.setEditSubmittedDate}
          editSubmittedTime={props.editSubmittedTime}
          setEditSubmittedTime={props.setEditSubmittedTime}
          allowedCategories={props.allowedCategories}
          onClose={() => props.setEditingRecord(null)}
          onSave={props.handleSaveEdit}
          editSaleStatus={props.editSaleStatus}
          setEditSaleStatus={props.setEditSaleStatus}
          submitting={props.submitting}
        />
      )}

      <ConfirmModal
        isOpen={!!props.deletingRecordId}
        onClose={() => props.setDeletingRecordId(null)}
        onConfirm={() => {
          if (props.deletingRecordId) {
            props.deleteRecord(props.deletingRecordId);
            props.setDeletingRecordId(null);
          }
        }}
        title="Delete File Record"
        message="Are you sure you want to permanently delete this file record? This action cannot be undone."
        confirmText="Delete Record"
        cancelText="Cancel"
        isDanger={true}
      />

      <ConfirmModal
        isOpen={!!props.bulkDeletingRecordIds}
        onClose={() => props.setBulkDeletingRecordIds(null)}
        onConfirm={async () => {
          if (props.bulkDeletingRecordIds) {
            const idsToDelete = [...props.bulkDeletingRecordIds];
            props.setBulkDeletingRecordIds(null);
            props.setIsBulkDeletingInProgress(true);
            try {
              await props.deleteRecords(idsToDelete);
            } catch (err) {
              console.error("Bulk delete failed:", err);
            } finally {
              props.setIsBulkDeletingInProgress(false);
            }
          }
        }}
        title="Delete Selected Records"
        message={`Are you sure you want to permanently delete the ${props.bulkDeletingRecordIds?.length} selected file records? This action cannot be undone.`}
        confirmText="Delete Records"
        cancelText="Cancel"
        isDanger={true}
      />

      <CustomEntryModal
        isOpen={props.isCustomEntryModalOpen}
        onClose={() => props.setIsCustomEntryModalOpen(false)}
        profilesList={props.profilesList}
        currentUserProfile={props.profile}
        submitting={props.submitting}
        adminMode={
          props.isAdmin && props.adminViewMode === "all"
        }
        onSubmit={props.handleAdminCustomEntrySubmit}
      />

      <QuickImportView
        isOpen={props.isBulkModalOpen}
        onClose={() => props.setIsBulkModalOpen(false)}
        allowedBranches={props.allMasterBranches}
        allowedTypes={props.allowedCategories}
        sanitizerWords={getSanitizerWords(props.globalSettings)}
        codename={props.ownCodename || props.profile?.username || ""}
        onSubmitRecord={async (data) => {
          const customSubmittedAt = data.entry_date
            ? new Date(`${data.entry_date}T12:00:00`).toISOString()
            : undefined;
          return await props.addRecord(
            data.file_name,
            data.branch_name,
            data.codename,
            data.file_type as FileType,
            undefined,
            customSubmittedAt,
            { skipToast: true, skipFetch: true },
          );
        }}
        onCompleteSuccess={(count) => {
          props.showToast(
            "success",
            `Successfully submitted ${count} Files!`,
          );
          props.fetchRecords();
        }}
      />

      {props.isBulkDeletingInProgress && (
        <div className="fixed inset-0 bg-theme-page-bg/70 backdrop-blur-xs z-9999 flex flex-col items-center justify-center select-none">
          <div className="flex flex-col items-center p-6 bg-theme-card-bg border border-theme-border-input rounded-2xl shadow-2xl animate-fade-in max-w-sm w-full mx-4 text-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-theme-border-input border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <h4 className="text-sm font-bold text-theme-text-primary mt-4 uppercase tracking-wider">
              Deleting Records...
            </h4>
            <p className="text-xs text-theme-text-muted mt-2">
              Please wait while the selected entries are being
              permanently removed from the database.
            </p>
            <p className="text-[10px] text-theme-text-muted mt-4 italic">
              You can reload the page if it hangs.
            </p>
          </div>
        </div>
      )}
    </>,
    portalRoot
  );
});
