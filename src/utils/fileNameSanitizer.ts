// Reusable, configurable file-name sanitizer.
//
// The DEFAULT_* regex lists are copied VERBATIM from the original inline
// implementation in quotesDashboardHelpers.ts, so `buildCleanFileName()` with
// no config is byte-for-byte identical to the previous `cleanFileName`.
//
// Superadmins can supply additional terms (persisted in global_settings) via
// `config.extraWords`; each is compiled to a case-insensitive, word-bounded
// regex and stripped in the same iterative pass. The additive design preserves
// all existing behavior — configured words only ADD to what is removed.

export interface SanitizerConfig {
  /** Extra terms to strip (superadmin-managed, from global_settings). */
  extraWords?: string[];
}

// 1. Literal comment phrases (case-insensitive), optional surrounding parens.
const DEFAULT_PHRASES: RegExp[] = [
  /\(?check\s+note\)?/gi,
  /\(?expert\s+please\)?/gi,
  /\(?\(?dot\)?\)?/gi,
];

// 2. File-type tokens (case-insensitive).
const DEFAULT_FILE_TYPES: RegExp[] = [
  /\bIndividual\s+Review\b/gi,
  /\bOther\s+Site\b/gi,
  /\bRequote\s+Van\b/gi,
  /\bRequote\s+Bike\b/gi,
  /\bReview\s+Van\b/gi,
  /\bReview\s+Bike\b/gi,
  /\bRequote\b/gi,
  /\bReview\b/gi,
  /\bQuote\b/gi,
  /\bSale\b/gi,
  /\bVan\b/gi,
  /\bBike\b/gi,
];

// 3. Branch-name tokens (case-insensitive).
const DEFAULT_BRANCHES: RegExp[] = [
  /\bPRIDE\s+COMPARE\b/gi,
  /\bEAZY\s+COMPARE\b/gi,
  /\bSWANDRIVE\b/gi,
  /\bMIDDLESURE\b/gi,
  /\bIRESURE\b/gi,
  /\bBRISTOL\b/gi,
  /\bSHEFFIELD\b/gi,
  /\bPRIDE\b/gi,
  /\bEAZY\b/gi,
  /\bNOTTS\b/gi,
  /\bRIDE\b/gi,
  /\bSORT\b/gi,
  /\bGET\b/gi,
  /\bADI\b/gi,
  /\bAQ\b/gi,
  /\bBC\b/gi,
  /\bMK\b/gi,
  /\bBI\b/gi,
  /\bNN\b/gi,
];

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Compile a superadmin-configured term into a case-insensitive, word-bounded
// regex. Multi-word terms match any run of whitespace between words.
const compileTerm = (term: string): RegExp | null => {
  const trimmed = term.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/).map(escapeRegExp);
  return new RegExp(`\\b${parts.join("\\s+")}\\b`, "gi");
};

/**
 * Builds a sanitizer function. Call with no args for the exact legacy behavior,
 * or pass `{ extraWords }` from global settings to strip additional terms.
 */
export const buildCleanFileName = (config?: SanitizerConfig) => {
  const extraRegexes = (config?.extraWords ?? [])
    .map(compileTerm)
    .filter((r): r is RegExp => r !== null);

  return (name: string): string => {
    if (!name) return "";
    let cleaned = name;

    let prev = "";
    let iterations = 0;
    while (cleaned !== prev && iterations < 5) {
      prev = cleaned;
      iterations++;
      for (const regex of DEFAULT_PHRASES) cleaned = cleaned.replace(regex, "");
      for (const regex of DEFAULT_FILE_TYPES) cleaned = cleaned.replace(regex, "");
      for (const regex of DEFAULT_BRANCHES) cleaned = cleaned.replace(regex, "");
      for (const regex of extraRegexes) cleaned = cleaned.replace(regex, "");
      cleaned = cleaned.replace(/[-\s.,()/\\]+/g, " ").trim();
    }

    return cleaned
      .replace(/^[-_.\s]+|[-_.\s]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };
};

/** Legacy entry point — default config, identical to the original behavior. */
export const cleanFileName = (name: string): string => buildCleanFileName()(name);
