/**
 * Pure helpers for user-supplied filters (file formats and custom size thresholds).
 * Kept free of imports so they can be unit tested directly with `node --test`.
 */

/**
 * Parses raw user input such as "bak, .TMP *.log tar.gz" into normalized
 * extensions (lowercase, leading dot). Invalid tokens are dropped silently.
 */
export const parseExtensionInput = (raw: string): string[] => {
  const result: string[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    const cleaned = token.trim().toLowerCase().replace(/^\*+/, '');
    if (!cleaned) continue;
    const ext = cleaned.startsWith('.') ? cleaned : `.${cleaned}`;
    // One or more ".part" groups, so multi-part extensions like ".tar.gz" are allowed.
    if (/^(\.[a-z0-9_+-]+)+$/.test(ext) && !result.includes(ext)) {
      result.push(ext);
    }
  }
  return result;
};

/**
 * True when the file name ends with one of the given extensions.
 * Uses suffix matching (not path.extname) so ".tar.gz" works as expected.
 */
export const matchesExtension = (fileName: string, extensions: string[]): boolean => {
  const lower = fileName.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
};

/**
 * Converts a custom size input into whole megabytes.
 * Returns null when the input is empty, not a number, or below the 1 MB minimum,
 * so callers never fall back silently to a stale or default threshold.
 */
export const customSizeToMB = (input: string, unit: 'MB' | 'GB'): number | null => {
  const parsed = parseFloat(input);
  if (!Number.isFinite(parsed)) return null;
  const mb = Math.round(unit === 'GB' ? parsed * 1024 : parsed);
  return mb >= 1 ? mb : null;
};
