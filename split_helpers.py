import os
import re

base_dir = "/Users/bnfcorporate/Documents/Web Dev/qc-manager-app/src/utils"

with open(f"{base_dir}/dashboardHelpers.ts", "r") as f:
    dashboard_content = f.read()

# We'll extract blocks using regex or just by copying chunks.
# It's easier to just split by finding the index of known function definitions.

def extract_section(content, start_str, end_str=None):
    start_idx = content.find(start_str)
    if start_idx == -1:
        raise ValueError(f"Could not find '{start_str}'")
    if end_str:
        end_idx = content.find(end_str, start_idx)
        if end_idx == -1:
            raise ValueError(f"Could not find '{end_str}'")
        return content[start_idx:end_idx]
    else:
        return content[start_idx:]

# Let's write the split files explicitly.
global_settings = """import { SanitizerRule, resolveSanitizerRules, enabledSanitizerWords } from '@/utils/fileNameSanitizer';

""" + extract_section(dashboard_content, "export interface GlobalSettings {", "// Add the shared filter logic")

leave_calculations = """import { ChutiRecord } from '@/utils/offlineSync';
import { GlobalSettings } from './globalSettingsHelpers';

""" + extract_section(dashboard_content, "export const applyLeaveFilters =", "export interface HalfYearlyOfficeLeaveStats {") + \
"""
""" + extract_section(dashboard_content, "export const parseDateToMs = ", "")

settlement_helpers = """import { ChutiRecord, generateUUID } from '@/utils/offlineSync';
import { LeaveSettlement } from '@/types';
import { formatDaysAndHours, parseIntervalToMinutes } from './leaveCalculations';

""" + extract_section(dashboard_content, "export interface HalfYearlyOfficeLeaveStats {", "/**\n * Checks if today is Friday")

break_helpers = """import { parseTimeToMinutes, formatDuration } from './leaveCalculations';

""" + extract_section(dashboard_content, "/**\n * Checks if today is Friday", "export const parseDateToMs =")

with open(f"{base_dir}/globalSettingsHelpers.ts", "w") as f:
    f.write(global_settings)

with open(f"{base_dir}/leaveCalculations.ts", "w") as f:
    f.write(leave_calculations)

with open(f"{base_dir}/settlementHelpers.ts", "w") as f:
    f.write(settlement_helpers)

with open(f"{base_dir}/breakHelpers.ts", "w") as f:
    f.write(break_helpers)

with open(f"{base_dir}/dashboardHelpers.ts", "w") as f:
    f.write("""export * from './globalSettingsHelpers';
export * from './leaveCalculations';
export * from './settlementHelpers';
export * from './breakHelpers';
""")

# Export Helper Split
with open(f"{base_dir}/exportHelper.ts", "r") as f:
    export_content = f.read()

export_core = """import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, GovtHolidayResponse } from '../types';
import { ChutiRecord } from './offlineSync';
import { calculateStats } from './dashboardHelpers';
import { formatDate, escapeHtml } from './formatters';
import { isTauriApp } from './apiUrlHelper';
import { isAdminRole } from '@/utils/permissionService';

""" + extract_section(export_content, "// Helper to save file inside Tauri", "export const exportHelper = {")

excel_exporters = """import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, GovtHolidayResponse } from '../types';
import { ChutiRecord } from './offlineSync';
import { calculateStats, formatTimeToAMPM, getCleanComment, formatDate, escapeHtml } from './dashboardHelpers';
import { isTauriApp } from './apiUrlHelper';
import { saveTauriFile, buildTeamWiseTablesHtml } from './exportCore';

""" + extract_section(export_content, "exportIndividualExcel: (", "exportIndividualPDF: (") + \
extract_section(export_content, "exportHolidayResponsesExcel: (", "exportHolidayResponsesPDF: (") + \
extract_section(export_content, "exportSettlementsExcel: (", "exportSettlementsPDF: (") + \
extract_section(export_content, "exportDailyLeavesExcel: (", "exportDailyLeavesPDF: (")

excel_exporters = excel_exporters.replace("exportIndividualExcel: (", "export const exportIndividualExcel = (")
excel_exporters = excel_exporters.replace("exportSummaryExcel: (", "export const exportSummaryExcel = (")
excel_exporters = excel_exporters.replace("exportHolidayResponsesExcel: (", "export const exportHolidayResponsesExcel = (")
excel_exporters = excel_exporters.replace("exportSettlementsExcel: (", "export const exportSettlementsExcel = (")
excel_exporters = excel_exporters.replace("exportDailyLeavesExcel: (", "export const exportDailyLeavesExcel = (")
excel_exporters = excel_exporters.replace("},", "};")
excel_exporters = excel_exporters.replace("};", "};")
# Just to be safe with trailing commas

pdf_exporters = """import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, GovtHolidayResponse } from '../types';
import { ChutiRecord } from './offlineSync';
import { calculateStats, formatTimeToAMPM, getCleanComment, formatDate, escapeHtml } from './dashboardHelpers';
import { printHtml, buildTeamWiseTablesHtml } from './exportCore';

""" + extract_section(export_content, "exportIndividualPDF: (", "exportHolidayResponsesExcel: (") + \
extract_section(export_content, "exportHolidayResponsesPDF: (", "exportSettlementsExcel: (") + \
extract_section(export_content, "exportSettlementsPDF: (", "exportDailyLeavesExcel: (") + \
extract_section(export_content, "exportDailyLeavesPDF: (", "};")

pdf_exporters = pdf_exporters.replace("exportIndividualPDF: (", "export const exportIndividualPDF = (")
pdf_exporters = pdf_exporters.replace("exportSummaryPDF: (", "export const exportSummaryPDF = (")
pdf_exporters = pdf_exporters.replace("exportHolidayResponsesPDF: (", "export const exportHolidayResponsesPDF = (")
pdf_exporters = pdf_exporters.replace("exportSettlementsPDF: (", "export const exportSettlementsPDF = (")
pdf_exporters = pdf_exporters.replace("exportDailyLeavesPDF: (", "export const exportDailyLeavesPDF = (")
pdf_exporters = pdf_exporters.replace("},", "};")
pdf_exporters = pdf_exporters.replace("};", "};")

# Add export keyword to exportCore methods
export_core = export_core.replace("const saveTauriFile = ", "export const saveTauriFile = ")
export_core = export_core.replace("const printHtml = ", "export const printHtml = ")
export_core = export_core.replace("const formatTimeToAMPM = ", "export const formatTimeToAMPM = ")
export_core = export_core.replace("const getCleanComment = ", "export const getCleanComment = ")
export_core = export_core.replace("const buildTeamWiseTablesHtml = ", "export const buildTeamWiseTablesHtml = ")

with open(f"{base_dir}/exportCore.ts", "w") as f:
    f.write(export_core)

with open(f"{base_dir}/excelExporters.ts", "w") as f:
    f.write(excel_exporters)

with open(f"{base_dir}/pdfExporters.ts", "w") as f:
    f.write(pdf_exporters)

with open(f"{base_dir}/exportHelper.ts", "w") as f:
    f.write("""import { exportIndividualExcel, exportSummaryExcel, exportHolidayResponsesExcel, exportSettlementsExcel, exportDailyLeavesExcel } from './excelExporters';
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
""")

print("Done")
