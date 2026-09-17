import { RecordItem } from '@/types';
import { toast } from 'sonner';
import { formatDate, formatTimeToAMPM } from './businessDateTime';

export {
  BUSINESS_TIMEZONE,
  getBusinessDateParts,
  getDhakaDateParts,
  getBusinessToday,
  getBusinessTodayDateKey,
  getBusinessYear,
  getBusinessMonth,
  getBusinessMonthRange,
  getDhakaMonthRange,
  formatBusinessDate,
  formatDate,
  formatDateToYYYYMMDD,
  formatBusinessTime,
  formatTimeToAMPM,
  formatTimeToHHMM,
} from './businessDateTime';
export type { BusinessDateParts } from './businessDateTime';

export {
  ALL_10_ACTIVE_FILE_TYPES,
  CANONICAL_FILE_TYPES,
  normalizeQuotationFileType,
  isCountedInQuotationTotals,
  isQuotesOffAdmin,
  canAccessAllQuotesData,
  calculateCanonicalQuotationStats,
  calculateCanonicalQuotationStats as calculateSummaryStats,
  filterQuotationRecordsByDate,
  resolveQuotationRecordScope,
} from './quotationConsistency';
export type { CanonicalQuotationStats } from './quotationConsistency';

// Export records list to CSV file (Microsoft Excel compatible with UTF-8 BOM)
export const exportToCSV = (records: RecordItem[], fileName: string) => {
  const headers = ['Date', 'Submitted Time', 'File Name', 'Branch', 'Codename', 'Type'];

  const rows = records.map(r => {
    const date = formatDate(r.submitted_at);
    const time = formatTimeToAMPM(r.submitted_at);
    return [
      date,
      time,
      r.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, ''),
      r.branch_name,
      r.codename,
      r.file_type
    ];
  });

  downloadCSVRows(headers, rows, fileName);
};

// Export arbitrary tabular rows to CSV (used by the leaderboard Excel export)
export const downloadCSVRows = (
  headers: string[],
  rows: (string | number)[][],
  fileName: string,
) => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Prepended \uFEFF Byte Order Mark (BOM) allows Excel to render non-ASCII characters (e.g. Bengali script) correctly
  const fullContent = '\uFEFF' + csvContent;

  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || (window as any).__TAURI__ !== undefined);
  if (isTauri) {
    (async () => {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        
        const filePath = await save({
          defaultPath: `${fileName}.csv`,
          filters: [{
            name: 'CSV File',
            extensions: ['csv']
          }]
        });

        if (filePath) {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(fullContent);
          await writeFile(filePath, bytes);
          toast.success('Excel saved successfully!');
        }
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to export Excel.');
      }
    })();
    return;
  }
  
  const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Computes smart default Year and Month for Quotation Mistakes based on actual data:
 * - Default Year: currentYearStr if it has mistakes, otherwise most recent available year (or currentYearStr if empty).
 * - Default Month: currentMonthStr if targetYear has mistake records in currentMonthStr, otherwise '' ("All Months").
 */
export function computeSmartMistakePeriod(
  availableDates: Array<{ year: string; month: string }>,
  currentYearStr: string,
  currentMonthStr: string,
): { year: string; month: string } {
  const yearsSet = new Set<string>();
  availableDates.forEach((d) => {
    if (d.year && /^\d{4}$/.test(d.year)) {
      yearsSet.add(d.year);
    }
  });
  const dynamicYears = Array.from(yearsSet).sort(
    (a, b) => parseInt(b, 10) - parseInt(a, 10)
  );

  let targetYear = currentYearStr;
  if (dynamicYears.length > 0 && !dynamicYears.includes(currentYearStr)) {
    targetYear = dynamicYears[0];
  }

  const hasCurrentMonthData = availableDates.some(
    (d) => (!targetYear || d.year === targetYear) && d.month === currentMonthStr
  );

  const targetMonth = hasCurrentMonthData ? currentMonthStr : '';

  return {
    year: targetYear,
    month: targetMonth,
  };
}

// Sanitizes pasted/typed quote file names by stripping comments, file types,
// branch names, dots, etc. The implementation now lives in a reusable module
// (src/utils/fileNameSanitizer.ts) — the single source of truth. This re-export
// preserves existing imports; pass the settings-derived word list from
// getSanitizerWords() to buildCleanFileName() for the configurable list.
export { cleanFileName, buildCleanFileName } from "@/utils/fileNameSanitizer";
export type { SanitizerRule } from "@/utils/fileNameSanitizer";
