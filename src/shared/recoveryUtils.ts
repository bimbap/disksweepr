/** Pure helpers shared by the Recovery view (sorting and path handling). */

export const compareText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

/** Parses Recycle Bin dates rendered as "dd/mm/yyyy h:mm". Returns 0 when unparseable. */
export const parseBinDate = (value: string): number => {
  const m = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])).getTime();
};

/** Returns the parent directory of a file path; drive roots keep their trailing backslash. */
export const getParentDir = (filePath: string): string => {
  const idx = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  if (idx < 0) return filePath;
  const dir = filePath.slice(0, idx);
  return /^[A-Za-z]:$/.test(dir) ? `${dir}\\` : dir;
};

/**
 * Formats epoch milliseconds into a readable "DD/MM/YYYY HH:mm" string.
 * Returns '-' when missing, non-positive, or NaN.
 */
export const formatRecoveryDate = (timeMs?: number): string => {
  if (!timeMs || isNaN(timeMs) || timeMs <= 0) return '-';
  const d = new Date(timeMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

