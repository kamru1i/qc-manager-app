import { RecordItem } from '@/types';
import { toast } from 'react-hot-toast';

// Helper function to format date from ISO string (or YYYY-MM-DD) to DD-MM-YYYY format
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
};

// Helper function to convert any date string format (ISO, DD-MM-YYYY, YYYY-MM-DD) into YYYY-MM-DD for HTML date inputs
export const formatDateToYYYYMMDD = (val: string | null | undefined): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  // Match DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    const mm = month.padStart(2, '0');
    const dd = day.padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  // Match YYYY-MM-DD
  const yyyymmddMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    const mm = month.padStart(2, '0');
    const dd = day.padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
};

// Helper function to format ISO timestamp to 12-hour AM/PM format (e.g. 03:04 PM)
export const formatTimeToAMPM = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateStr;
  }
};

// Helper function to format timestamp/time string to 24-hour HH:MM format for HTML time inputs
export const formatTimeToHHMM = (val: string | null | undefined): string => {
  if (!val) return '12:00';
  const str = String(val).trim();
  if (!str) return '12:00';

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = ampmMatch[2];
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${minutes}`;
  }

  return '12:00';
};

// Calculate counts of files of each type
export const calculateSummaryStats = (records: RecordItem[]) => {
  let quote = 0;
  let requote = 0;
  let requoteVan = 0;
  let requoteBike = 0;
  let review = 0;
  let reviewVan = 0;
  let reviewBike = 0;
  let individualReview = 0;
  let otherSite = 0;
  let van = 0;
  let bike = 0;
  let sale = 0;

  records.forEach(r => {
    const type = r.file_type;
    if (type === 'Quote') quote++;
    else if (type === 'Requote') requote++;
    else if (type === 'Requote Van') requoteVan++;
    else if (type === 'Requote Bike') requoteBike++;
    else if (type === 'Review') review++;
    else if (type === 'Review Van') reviewVan++;
    else if (type === 'Review Bike') reviewBike++;
    else if (type === 'Individual Review') individualReview++;
    else if (type === 'Other Site') otherSite++;
    else if (type === 'Van') van++;
    else if (type === 'Bike') bike++;
    else if (type === 'Sale') sale++;
  });

  return {
    total: records.length - otherSite,
    quote,
    requote,
    requoteVan,
    requoteBike,
    review,
    reviewVan,
    reviewBike,
    individualReview,
    otherSite,
    van,
    bike,
    sale
  };
};

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

// Sanitizes pasted/typed quote file names by stripping comments, file types,
// branch names, dots, etc. The implementation now lives in a reusable module
// (src/utils/fileNameSanitizer.ts) — the single source of truth. This re-export
// preserves existing imports; pass the settings-derived word list from
// getSanitizerWords() to buildCleanFileName() for the configurable list.
export { cleanFileName, buildCleanFileName } from "@/utils/fileNameSanitizer";
export type { SanitizerRule } from "@/utils/fileNameSanitizer";
