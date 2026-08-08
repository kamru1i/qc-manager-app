import { FileType } from "@/types";
import { exportToCSV } from "@/utils/quotesDashboardHelpers";
import { validator } from "@/utils/quotesValidator";
import { isAdminRole } from "@/utils/permissionService";

interface HandlersProps {
  todayFilteredRecords: any[];
  monthlyFilteredRecords: any[];
  saleSummaryRecords: any[];
  selectedYear: string;
  selectedMonth: string;
  logActivity: (action: string, target: any, details: string) => void;
  showToast: (type: "success" | "error", message: string) => void;
  addRecord: (fileName: string, branchName: string, codename: string, fileType: FileType, userId?: string, submittedAt?: string) => Promise<boolean>;
  profile: any;
  profilesList: any[];
  submitting: boolean;
  cleanFileName: (name: string) => string;
  fileName: string;
  setFileName: (val: string) => void;
  branchName: string;
  setBranchName: (val: string) => void;
  codenameInput: string;
  fileType: FileType;
  setFileType: (val: FileType) => void;
  saleFormDetails: any;
  setSaleFormDetails: (val: any) => void;
  customSaleDetails: any;
  setCustomSaleDetails: (val: any) => void;
  setShowSaleModal: (val: boolean) => void;
}

export function useQuotesPageHandlers({
  todayFilteredRecords,
  monthlyFilteredRecords,
  saleSummaryRecords,
  selectedYear,
  selectedMonth,
  logActivity,
  showToast,
  addRecord,
  profile,
  profilesList,
  submitting,
  cleanFileName,
  fileName,
  setFileName,
  branchName,
  setBranchName,
  codenameInput,
  fileType,
  setFileType,
  saleFormDetails,
  setSaleFormDetails,
  customSaleDetails,
  setCustomSaleDetails,
  setShowSaleModal,
}: HandlersProps) {
  const handleExportTodayExcel = () => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    exportToCSV(todayFilteredRecords, `Today_Logs_${todayStr}`);
    logActivity(
      "EXPORT_EXCEL",
      null,
      `Exported today's records (Count: ${todayFilteredRecords.length}) to Excel`,
    );
  };

  const handleExportMonthlyExcel = () => {
    const monthName = new Date(
      parseInt(selectedYear),
      parseInt(selectedMonth) - 1,
      1,
    ).toLocaleString("en-US", { month: "long" });
    exportToCSV(
      monthlyFilteredRecords,
      `Monthly_Logs_${monthName}_${selectedYear}`,
    );
    logActivity(
      "EXPORT_EXCEL",
      null,
      `Exported monthly records for ${monthName} ${selectedYear} (Count: ${monthlyFilteredRecords.length}) to Excel`,
    );
  };

  const handleExportSaleSummaryExcel = () => {
    const monthName = new Date(
      parseInt(selectedYear),
      parseInt(selectedMonth) - 1,
      1,
    ).toLocaleString("en-US", { month: "long" });
    exportToCSV(
      saleSummaryRecords,
      `Sale_Summary_${monthName}_${selectedYear}`,
    );
    logActivity(
      "EXPORT_EXCEL",
      null,
      `Exported sale summary records for ${monthName} ${selectedYear} (Count: ${saleSummaryRecords.length}) to Excel`,
    );
  };

  const handleAdminCustomEntrySubmit = async (
    fName: string,
    bName: string,
    fType: FileType,
    userId: string,
    submittedAtDate: string,
  ): Promise<boolean> => {
    if (!userId) {
      showToast("error", "Please select a user.");
      return false;
    }
    if (!submittedAtDate) {
      showToast("error", "Please select a submission date.");
      return false;
    }

    const targetProfile =
      isAdminRole(profile) || profile?.role === "supervisor"
        ? profilesList.find((p) => p.id === userId)
        : userId === profile?.id
          ? profile
          : null;

    if (!targetProfile) {
      showToast("error", "Selected user not found.");
      return false;
    }

    const formValidation = validator.validateRecordForm({
      file_name: fName,
      branch_name: bName,
      codename: targetProfile.username,
      file_type: fType,
    });

    if (!formValidation.isValid) {
      showToast("error", formValidation.errors[0]);
      return false;
    }

    if (fType === "Sale") {
      setCustomSaleDetails({
        fileName: fName,
        branchName: bName,
        codename: targetProfile.username,
        fileType: fType,
        userId,
        submittedAtDate,
      });
      setShowSaleModal(true);
      return true;
    }

    const now = new Date();
    const timePart = now.toTimeString().split(" ")[0]; // HH:MM:SS
    const customSubmittedAt = new Date(
      `${submittedAtDate}T${timePart}`,
    ).toISOString();

    const success = await addRecord(
      fName,
      bName,
      targetProfile.username,
      fType,
      userId,
      customSubmittedAt,
    );

    return success;
  };

  const submitNewEntry = async (
    fName: string,
    bName: string,
    cName: string,
    fType: FileType,
  ) => {
    if (submitting) return;
    const success = await addRecord(fName, bName, cName, fType);
    if (success) {
      setFileName("");
      setBranchName("");
      if (profile?.allowed_types && profile.allowed_types.length > 0) {
        setFileType(profile.allowed_types[0] as FileType);
      } else {
        setFileType("Quote");
      }
    }
  };

  const handleConfirmSaleStatus = async (status: "SOLD" | "UNSOLD") => {
    if (submitting) return;

    if (customSaleDetails) {
      const finalFileName = `${customSaleDetails.fileName} [${status}]`;
      setShowSaleModal(false);

      const now = new Date();
      const timePart = now.toTimeString().split(" ")[0]; // HH:MM:SS
      const customSubmittedAt = new Date(
        `${customSaleDetails.submittedAtDate}T${timePart}`,
      ).toISOString();

      await addRecord(
        finalFileName,
        customSaleDetails.branchName,
        customSaleDetails.codename,
        customSaleDetails.fileType,
        customSaleDetails.userId,
        customSubmittedAt,
      );
      setCustomSaleDetails(null);
      return;
    }

    if (saleFormDetails) {
      const finalFileName = `${saleFormDetails.fileName} [${status}]`;
      setShowSaleModal(false);
      await submitNewEntry(
        finalFileName,
        saleFormDetails.branchName,
        saleFormDetails.codename,
        saleFormDetails.fileType,
      );
      setSaleFormDetails(null);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleanedFileName = cleanFileName(fileName);
    setFileName(cleanedFileName);

    const formValidation = validator.validateRecordForm({
      file_name: cleanedFileName,
      branch_name: branchName,
      codename: codenameInput,
      file_type: fileType,
    });

    if (!formValidation.isValid) {
      showToast("error", formValidation.errors[0]);
      return;
    }

    if (fileType === "Sale") {
      setSaleFormDetails({
        fileName: cleanedFileName,
        branchName,
        codename: codenameInput,
        fileType,
      });
      setShowSaleModal(true);
    } else {
      await submitNewEntry(
        cleanedFileName,
        branchName,
        codenameInput,
        fileType,
      );
    }
  };

  return {
    handleExportTodayExcel,
    handleExportMonthlyExcel,
    handleExportSaleSummaryExcel,
    handleAdminCustomEntrySubmit,
    submitNewEntry,
    handleConfirmSaleStatus,
    handleAddEntry,
  };
}
