/**
 * Intelligent file size formatting across all Cleaner components.
 * Automatically selects the appropriate granular unit (B, KB, MB, GB).
 */
export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Truncates long directory paths in the middle to preserve both the root drive
 * and the currently inspected leaf folder without causing layout jitter.
 * Example: "M:\MMVC\MMVCServerSI0\fairseq\modules\dynamicconv_layer\__pycache"
 * -> "M:\MMVC\...\dynamicconv_layer\__pycache"
 */
export const formatMiddleTruncate = (pathStr: string, maxLength = 46): string => {
  if (!pathStr || pathStr.length <= maxLength) return pathStr;

  const separator = pathStr.includes('\\') ? '\\' : '/';
  const parts = pathStr.split(/[/\\]+/).filter(Boolean);

  if (parts.length <= 2) {
    const keepStart = Math.floor((maxLength - 3) / 2);
    const keepEnd = maxLength - 3 - keepStart;
    return `${pathStr.slice(0, keepStart)}...${pathStr.slice(-keepEnd)}`;
  }

  const root = parts[0];
  const leaf = parts[parts.length - 1];
  const secondLeaf = parts.length > 2 ? parts[parts.length - 2] : '';

  // Try keeping root + ... + secondLeaf + leaf
  if (secondLeaf) {
    const candidate = `${root}${separator}...${separator}${secondLeaf}${separator}${leaf}`;
    if (candidate.length <= maxLength) {
      return candidate;
    }
  }

  // Fallback: root + ... + leaf
  const shortCandidate = `${root}${separator}...${separator}${leaf}`;
  if (shortCandidate.length <= maxLength) {
    return shortCandidate;
  }

  // If leaf itself is large
  const availableForLeaf = maxLength - root.length - 5; // root + \...\
  if (availableForLeaf > 8) {
    return `${root}${separator}...${separator}${leaf.slice(-availableForLeaf)}`;
  }

  return `${pathStr.slice(0, 16)}...${pathStr.slice(-(maxLength - 19))}`;
};

/**
 * Formats a Windows drive letter and volume label cleanly.
 * If the label is empty, identical to the letter, or generic (e.g. "Local Disk"),
 * it avoids redundant brackets like "Drive C: [C:]" and cleanly returns "Drive C:".
 * If a custom label exists (e.g. "Data", "Games"), it formats as "Drive D: [Data]".
 */
export const formatDriveDisplay = (letter: string = '', label?: string): string => {
  if (!letter) return '';
  const cleanLetter = letter.replace(/:/g, '').trim().toUpperCase();
  const cleanLabel = (label || '').replace(/[:[\]()]/g, '').trim();
  const hasDistinctLabel =
    cleanLabel &&
    cleanLabel.toUpperCase() !== cleanLetter &&
    cleanLabel.toUpperCase() !== `DRIVE ${cleanLetter}` &&
    cleanLabel.toUpperCase() !== 'LOCAL DISK';

  return hasDistinctLabel ? `Drive ${cleanLetter}: [${cleanLabel}]` : `Drive ${cleanLetter}:`;
};

