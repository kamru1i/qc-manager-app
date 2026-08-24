/**
 * Path Security & Containment Utility
 *
 * Enforces strict containment boundaries for file operations, preventing path traversal,
 * cross-directory escape, and unsafe file writes while supporting cross-platform path formats
 * (Windows drive letters, backslashes/forward slashes, UNC paths, and case-insensitivity).
 */

const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

/**
 * Normalizes a path string:
 * - Converts backslashes to forward slashes.
 * - Collapses redundant slashes (preserving leading '//' for UNC paths).
 * - Resolves '.' and '..' segments safely.
 * - Strips trailing slashes (except root paths).
 */
export function normalizePath(p: string): string {
  if (!p) return '';
  let normalized = p.replace(/\\/g, '/');

  const isUnc = normalized.startsWith('//');
  normalized = normalized.replace(/\/+/g, '/');
  if (isUnc) {
    normalized = '/' + normalized;
  }

  const isAbsolute = normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized);
  const segments = normalized.split('/');
  const resolved: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === '' && i > 0 && i < segments.length - 1) continue;
    if (seg === '.') continue;
    if (seg === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      } else if (!isAbsolute) {
        resolved.push('..');
      }
    } else {
      resolved.push(seg);
    }
  }

  let result = resolved.join('/');
  if (result.endsWith('/') && result.length > 1 && !/^[a-zA-Z]:\/$/.test(result)) {
    result = result.slice(0, -1);
  }
  return result;
}

/**
 * Checks if candidatePath is strictly inside or equal to allowedBaseDir.
 * Component-aware, separator-agnostic, and case-insensitive on Windows.
 */
export function isPathContained(allowedBaseDir: string, candidatePath: string): boolean {
  if (!allowedBaseDir || !candidatePath) return false;

  const normBase = normalizePath(allowedBaseDir);
  const normCandidate = normalizePath(candidatePath);

  // Detect Windows paths or platform
  const isWindows =
    /^[a-zA-Z]:/.test(normBase) ||
    /^[a-zA-Z]:/.test(normCandidate) ||
    (typeof navigator !== 'undefined' && /win/i.test(navigator.platform || navigator.userAgent));

  const baseKey = isWindows ? normBase.toLowerCase() : normBase;
  const candidateKey = isWindows ? normCandidate.toLowerCase() : normCandidate;

  if (candidateKey === baseKey) return true;

  const prefixWithSlash = baseKey.endsWith('/') ? baseKey : `${baseKey}/`;
  return candidateKey.startsWith(prefixWithSlash);
}

/**
 * Validates and sanitizes a DOCX file name.
 * - Strips illegal Windows characters and path separators.
 * - Neutralizes relative path traversal attempts (e.g. `..`).
 * - Protects against Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
 * - Guarantees a safe `.docx` extension.
 */
export function sanitizeDocxFilename(filename: string): string {
  if (!filename) return 'Document.docx';

  // Replace path separators with spaces to eliminate traversal vectors
  let clean = filename.replace(/[/\\]+/g, ' ');

  // Strip illegal Windows characters and control characters
  clean = clean.replace(ILLEGAL_FILENAME_CHARS, '');

  // Collapse multiple spaces
  clean = clean.replace(/\s+/g, ' ').trim();

  // Strip leading and trailing dots and spaces (Windows disallows them)
  clean = clean.replace(/^[\s.]+|[\s.]+$/g, '');

  const nameWithoutExt = clean.replace(/\.docx$/i, '');
  if (WINDOWS_RESERVED_NAMES.test(nameWithoutExt)) {
    clean = `Document_${clean}`;
  }

  if (!clean.toLowerCase().endsWith('.docx')) {
    clean = `${clean}.docx`;
  }

  if (clean === '.docx' || !clean || clean === '..docx') {
    clean = 'Document.docx';
  }

  return clean;
}

/**
 * Checks if a subfolder is an allowed safe subfolder (e.g. 'Sold', 'Unsold', or null/empty).
 * Blocks any directory traversal or arbitrary subfolder paths.
 */
export function isSafeSubdirectory(subFolder: string | null | undefined): boolean {
  if (!subFolder) return true;
  // Only allow alphanumeric characters, spaces, hyphens, or underscores
  return /^[a-zA-Z0-9_\- ]+$/.test(subFolder) && !subFolder.includes('..');
}
