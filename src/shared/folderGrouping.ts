import { splitFileAndLocation } from './formatters.ts';
import type { ScannedCategory } from './types.ts';

export interface FolderGroup<T> {
  /** Case-insensitive lookup key for consistent Windows folder merging. */
  key: string;
  /** Folder directory path with preserved original casing. */
  folderPath: string;
  /** Leaf directory name (or drive root like "C:\\"). */
  folderName: string;
  /** Parent directory above folderName (empty string for drive roots). */
  parentPath: string;
  /** Member items stored directly inside this folder. */
  items: T[];
  /** Aggregate byte size of all items in this folder. */
  totalBytes: number;
  /** Most recent modification timestamp across items in this folder. */
  latestModifiedTime: number;
}

export type FolderSortField = 'size' | 'count' | 'name' | 'date';
export type FolderSortDirection = 'asc' | 'desc';

interface FolderMeta {
  key: string;
  folderPath: string;
  folderName: string;
  parentPath: string;
}

/**
 * Extracts normalized parent folder metadata from an item path.
 */
export const extractFolderMeta = (itemPath: string, fallbackName: string): FolderMeta => {
  const { folderPath } = splitFileAndLocation(itemPath, fallbackName, '');
  if (!folderPath) {
    const cleanFallback = fallbackName || 'Unknown';
    return {
      key: cleanFallback.toLowerCase(),
      folderPath: '',
      folderName: cleanFallback,
      parentPath: '',
    };
  }

  if (/^[A-Za-z]:\\$/.test(folderPath)) {
    return {
      key: folderPath.toLowerCase(),
      folderPath,
      folderName: folderPath,
      parentPath: '',
    };
  }

  const { fileName: leafFolderName, folderPath: upperParent } = splitFileAndLocation(
    folderPath,
    folderPath,
    ''
  );

  return {
    key: folderPath.toLowerCase(),
    folderPath,
    folderName: leafFolderName || folderPath,
    parentPath: upperParent,
  };
};

/**
 * Groups flat file or item collections by their immediate parent directory.
 */
export const groupItemsByFolder = <T>(
  items: T[],
  getPath: (item: T) => string,
  getName: (item: T) => string,
  getSize: (item: T) => number,
  getModifiedTime?: (item: T) => number
): FolderGroup<T>[] => {
  const groupsMap = new Map<string, FolderGroup<T>>();

  for (const item of items) {
    const meta = extractFolderMeta(getPath(item), getName(item));
    const size = Math.max(0, getSize(item) || 0);
    const modifiedTime = getModifiedTime ? getModifiedTime(item) || 0 : 0;

    let group = groupsMap.get(meta.key);
    if (!group) {
      group = {
        key: meta.key,
        folderPath: meta.folderPath,
        folderName: meta.folderName,
        parentPath: meta.parentPath,
        items: [],
        totalBytes: 0,
        latestModifiedTime: 0,
      };
      groupsMap.set(meta.key, group);
    }

    group.items.push(item);
    group.totalBytes += size;
    if (modifiedTime > group.latestModifiedTime) {
      group.latestModifiedTime = modifiedTime;
    }
  }

  return Array.from(groupsMap.values());
};

/**
 * Sorts folder groups deterministically by size, item count, name, or modified date.
 */
export const sortFolderGroups = <T>(
  groups: FolderGroup<T>[],
  sortBy: FolderSortField,
  sortDir: FolderSortDirection
): FolderGroup<T>[] => {
  const sorted = [...groups];
  const factor = sortDir === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    let diff = 0;
    switch (sortBy) {
      case 'count':
        diff = a.items.length - b.items.length;
        if (diff === 0) diff = a.totalBytes - b.totalBytes;
        break;
      case 'date':
        diff = a.latestModifiedTime - b.latestModifiedTime;
        if (diff === 0) diff = a.totalBytes - b.totalBytes;
        break;
      case 'name':
        diff = a.folderName.localeCompare(b.folderName, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        break;
      case 'size':
      default:
        diff = a.totalBytes - b.totalBytes;
        if (diff === 0) diff = a.items.length - b.items.length;
        break;
    }

    if (diff !== 0) {
      return diff * factor;
    }

    return a.folderPath.localeCompare(b.folderPath, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  return sorted;
};

/**
 * Applies a batch folder selection toggle to a System Cleanup category's exclusion list.
 */
export const applyFolderSelectionToCategory = (
  category: ScannedCategory,
  folderFilePaths: string[],
  select: boolean
): ScannedCategory => {
  if (folderFilePaths.length === 0) return category;

  const targetPathSet = new Set(folderFilePaths);

  if (select) {
    if (!category.selected) {
      // Category was off: turn it on while excluding everything outside this folder.
      const excludedPaths = category.files
        .filter((file) => !targetPathSet.has(file.path))
        .map((file) => file.path);

      return {
        ...category,
        selected: true,
        excludedPaths,
      };
    }

    const nextExcluded = (category.excludedPaths || []).filter(
      (path) => !targetPathSet.has(path)
    );
    return {
      ...category,
      selected: true,
      excludedPaths: nextExcluded,
    };
  }

  if (!category.selected) {
    return category;
  }

  const nextExcludedSet = new Set(category.excludedPaths || []);
  for (const path of folderFilePaths) {
    nextExcludedSet.add(path);
  }

  if (nextExcludedSet.size >= category.files.length && category.files.length > 0) {
    return {
      ...category,
      selected: false,
      excludedPaths: [],
    };
  }

  return {
    ...category,
    selected: true,
    excludedPaths: Array.from(nextExcludedSet),
  };
};

/**
 * Adds or removes a batch of item IDs without duplicates.
 */
export const toggleIdsBatch = (
  currentSelectedIds: string[],
  targetIds: string[],
  select: boolean
): string[] => {
  if (targetIds.length === 0) return currentSelectedIds;

  const targetSet = new Set(targetIds);
  if (select) {
    const merged = new Set(currentSelectedIds);
    for (const id of targetIds) {
      merged.add(id);
    }
    return Array.from(merged);
  }

  return currentSelectedIds.filter((id) => !targetSet.has(id));
};

