import DOMPurify from 'dompurify';

/** Preserve document formatting while removing executable browser content. */
export function sanitizeRichTextHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  });
}

export function plainTextToHtml(text: string): string {
  const element = document.createElement('div');
  element.textContent = text;
  return element.innerHTML.replace(/\r?\n/g, '<br>');
}
