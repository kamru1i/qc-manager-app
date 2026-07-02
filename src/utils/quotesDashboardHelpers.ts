import { RecordItem } from '@/types';
import { toast } from 'react-hot-toast';

interface TauriWindow extends Window {
  __TAURI__?: {
    core: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<string>;
    };
  };
}

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
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  // Prepended \uFEFF Byte Order Mark (BOM) allows Excel to render non-ASCII characters (e.g. Bengali script) correctly
  const fullContent = '\uFEFF' + csvContent;

  const isTauri = typeof window !== 'undefined' && (window as unknown as TauriWindow).__TAURI__ !== undefined;
  if (isTauri) {
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(fullContent);
      const { invoke } = (window as unknown as TauriWindow).__TAURI__!.core;
      invoke('save_file', { fileName: `${fileName}.csv`, content: Array.from(bytes) })
        .then((savedPath: string) => {
          toast.success(`Excel saved to: ${savedPath}`);
        })
        .catch((err: unknown) => {
          const errMsg = String(err);
          if (errMsg !== 'Save cancelled') {
            toast.error(`Failed to save Excel: ${errMsg}`);
          }
        });
    } catch {
      toast.error('Failed to export Excel in desktop app.');
    }
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
