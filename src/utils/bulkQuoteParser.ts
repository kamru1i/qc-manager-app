import { DEFAULT_SANITIZER_WORDS, buildCleanFileName } from "./fileNameSanitizer";

export interface ParsedQuoteItem {
  id: string;
  file_name: string;
  branch_name: string;
  file_type: string;
  sale_status?: 'SOLD' | 'UNSOLD';
  raw_line: string;
  status: 'pending' | 'submitting' | 'success' | 'error';
  error_message?: string;
}

export const DEFAULT_BRANCHES = [
  'PrideCompare', 'EazyCompare', 'SwanDrive', 'MiddleSure', 'IreSure',
  'BRISTOL', 'SHEFFIELD', 'PRIDE', 'EAZY', 'NOTTS', 'RIDE', 'SORT',
  'GET', 'ADI', 'AQ', 'BC', 'MK', 'BI', 'NN'
];

export const ALL_10_FILE_TYPES = [
  'Quote', 'Requote', 'Requote Van', 'Requote Bike', 'Review',
  'Review Van', 'Review Bike', 'Individual Review', 'Other Site',
  'Van', 'Bike', 'Sale'
];
const BRANCH_PATTERNS: Array<{ key: string; regex: RegExp }> = [
  { key: 'PrideCompare', regex: /\bpride[\s-_]*compare\b/i },
  { key: 'EazyCompare', regex: /\beazy[\s-_]*compare\b/i },
  { key: 'SwanDrive', regex: /\bswan[\s-_]*drive\b/i },
  { key: 'MiddleSure', regex: /\bmiddle[\s-_]*sure\b/i },
  { key: 'IreSure', regex: /\bire[\s-_]*sure\b/i },
  { key: 'BRISTOL', regex: /\bbristol\b/i },
  { key: 'SHEFFIELD', regex: /\bsheffield\b/i },
  { key: 'PRIDE', regex: /\bpride\b/i },
  { key: 'EAZY', regex: /\beazy\b/i },
  { key: 'NOTTS', regex: /\bnotts\b/i },
  { key: 'RIDE', regex: /\bride\b/i },
  { key: 'SORT', regex: /\bsort\b/i },
  { key: 'GET', regex: /\bget\b/i },
  { key: 'ADI', regex: /\badi\b/i },
  { key: 'AQ', regex: /\baq\b/i },
  { key: 'BC', regex: /\bbc\b/i },
  { key: 'MK', regex: /\bmk\b/i },
  { key: 'BI', regex: /\b(bi|bl)\b/i },
  { key: 'NN', regex: /\bnn\b/i },
];

// Known file types to match (order longest first)
const FILE_TYPE_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  { type: 'Individual Review', regex: /\bindividual[\s-_]*review\b/i },
  { type: 'Other Site', regex: /\bother[\s-_]*site\b/i },
  { type: 'Requote Van', regex: /\brequote[\s-_]*van\b/i },
  { type: 'Requote Bike', regex: /\brequote[\s-_]*bike\b/i },
  { type: 'Review Van', regex: /\breview[\s-_]*van\b/i },
  { type: 'Review Bike', regex: /\breview[\s-_]*bike\b/i },
  { type: 'Requote', regex: /\brequote\b/i },
  { type: 'Review', regex: /\breview\b/i },
  { type: 'Sale', regex: /\bsale\b/i },
  { type: 'Van', regex: /\bvan\b/i },
  { type: 'Bike', regex: /\bbike\b/i },
  { type: 'Quote', regex: /\bquote\b/i },
];

export function resolveMatchedBranch(
  detectedKey: string,
  allowedBranches: string[] = DEFAULT_BRANCHES
): string {
  if (!allowedBranches || allowedBranches.length === 0) return detectedKey || 'PrideCompare';

  if (!detectedKey) return allowedBranches[0];

  // 1. Exact match
  if (allowedBranches.includes(detectedKey)) return detectedKey;

  // 2. Case & space insensitive match (e.g. 'SwanDrive' matches 'Swan Drive' or 'SWANDRIVE')
  const normKey = detectedKey.replace(/[\s-_]+/g, '').toLowerCase();
  const match = allowedBranches.find(
    (b) => b.replace(/[\s-_]+/g, '').toLowerCase() === normKey
  );
  if (match) return match;

  return allowedBranches[0] || detectedKey;
}

/**
  Parse a single raw line or filename string into structured quote data.
 */
export function parseQuoteLine(
  rawText: string,
  sanitizerWords: string[] = DEFAULT_SANITIZER_WORDS,
  allowedBranches: string[] = DEFAULT_BRANCHES
): ParsedQuoteItem {
  const id = Math.random().toString(36).substring(2, 11);
  let text = rawText.trim();

  // Strip common file extension if present (e.g. .docx, .pdf, .txt, .xlsx)
  text = text.replace(/\.(docx?|pdf|txt|xlsx?|csv|png|jpe?g)$/i, '');

  let matchedType = 'Quote';
  let detectedBranch = '';
  let saleStatus: 'SOLD' | 'UNSOLD' | undefined = undefined;

  // 1. Detect File Type
  for (const item of FILE_TYPE_PATTERNS) {
    if (item.regex.test(text)) {
      matchedType = item.type;
      text = text.replace(item.regex, '');
      break;
    }
  }

  // Detect Sale status if type is Sale or text indicates [SOLD] / [UNSOLD]
  if (matchedType === 'Sale') {
    if (/\[sold\]/i.test(rawText) || /\bsold\b/i.test(rawText)) {
      saleStatus = 'SOLD';
    } else {
      saleStatus = 'UNSOLD';
    }
  }

  // 2. Detect Branch Name
  for (const item of BRANCH_PATTERNS) {
    if (item.regex.test(text)) {
      detectedBranch = item.key;
      text = text.replace(item.regex, '');
      break;
    }
  }

  const finalBranch = resolveMatchedBranch(detectedBranch, allowedBranches);

  // 3. Clean remaining filename using sanitizer
  const cleanFn = buildCleanFileName(sanitizerWords);
  let cleanedName = cleanFn(text);

  if (!cleanedName) {
    cleanedName = rawText.trim();
  }

  return {
    id,
    file_name: cleanedName,
    branch_name: finalBranch,
    file_type: matchedType,
    sale_status: saleStatus,
    raw_line: rawText,
    status: 'pending'
  };
}

/**
  Parse multiple multiline text blocks into an array of quote items.
 */
export function parseBulkQuoteLines(
  bulkText: string,
  sanitizerWords: string[] = DEFAULT_SANITIZER_WORDS,
  allowedBranches: string[] = DEFAULT_BRANCHES
): ParsedQuoteItem[] {
  if (!bulkText || !bulkText.trim()) return [];

  const lines = bulkText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('---'));

  return lines.map(line => parseQuoteLine(line, sanitizerWords, allowedBranches));
}
