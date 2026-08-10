import { exportIndividualExcel, exportSummaryExcel, exportHolidayResponsesExcel, exportSettlementsExcel, exportDailyLeavesExcel } from './excelExporters';
import { exportIndividualPDF, exportSummaryPDF, exportHolidayResponsesPDF, exportSettlementsPDF, exportDailyLeavesPDF } from './pdfExporters';

export const exportHelper = {
  exportIndividualExcel,
  exportSummaryExcel,
  exportIndividualPDF,
  exportSummaryPDF,
  exportHolidayResponsesExcel,
  exportHolidayResponsesPDF,
  exportSettlementsExcel,
  exportSettlementsPDF,
  exportDailyLeavesExcel,
  exportDailyLeavesPDF
};
