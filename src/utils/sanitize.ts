import DOMPurify from 'dompurify';

/**
 * Sanitizes an HTML string using DOMPurify.
 * Use this for any content rendered via dangerouslySetInnerHTML that originates
 * from user input or database fields (defense-in-depth).
 *
 * Allows only safe inline formatting tags and <br> by default.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') return dirty;
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
}

/**
 * Converts newlines to <br/> tags and sanitizes the result.
 * Common pattern used throughout the app for rendering multi-line
 * text from database fields.
 */
export function sanitizeWithLineBreaks(text: string | null | undefined): string {
  if (!text) return '';
  const withBreaks = text.replace(/\n/g, '<br/>');
  return sanitizeHtml(withBreaks);
}
