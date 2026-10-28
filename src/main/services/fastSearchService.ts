import fs from 'fs';
import path from 'path';
import type {
  FastSearchFileType,
  FastSearchItem,
  FastSearchOptions,
  FastSearchProgress,
  FastSearchSizeFilter,
  FastSearchTargetKind,
} from '../../shared/types.ts';
import { getDriveTelemetry } from './telemetryService.ts';

const PROTECTED_SYSTEM_DIRS = new Set([
  '$recycle.bin',
  'system volume information',
  'recovery',
  'config.msi',
  'msocache',
]);

const FILE_TYPE_EXTENSIONS: Record<Exclude<FastSearchFileType, 'all'>, Set<string>> = {
  documents: new Set([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.rtf', '.odt', '.md', '.log',
  ]),
  images: new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg',
    '.ico', '.tiff', '.psd', '.ai', '.raw',
  ]),
  media: new Set([
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma',
  ]),
  archives: new Set([
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.cab',
  ]),
  executables: new Set([
    '.exe', '.msi', '.bat', '.cmd', '.ps1', '.vbs', '.reg',
  ]),
  code: new Set([
    '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.json',
    '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.php',
    '.rb', '.sql', '.yaml', '.yml', '.xml',
  ]),
};

export class FastSearchService {
  private abortController: AbortController | null = null;

  public cancelSearch(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async search(
    options: FastSearchOptions,
    onProgress?: (progress: FastSearchProgress) => void,
    onBatch?: (batch: FastSearchItem[]) => void
  ): Promise<FastSearchItem[]> {
    this.cancelSearch();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const startTime = Date.now();
    const maxResults = options.maxResults || 2000;
    const query = options.query.trim();
    const matchCase = !!options.matchCase;
    const includeHidden = !!options.includeHidden;
    const fileType = options.fileType || 'all';
    const targetKind: FastSearchTargetKind = options.targetKind || 'all';
    const sizeFilter = options.sizeFilter || 'all';

    // Build matcher
    let regexMatcher: RegExp | null = null;
    let queryLower = query.toLowerCase();

    if (query.includes('*') || query.includes('?')) {
      try {
        const escaped = query.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                             .replace(/\*/g, '.*')
                             .replace(/\?/g, '.');
        regexMatcher = new RegExp(`^${escaped}$`, matchCase ? '' : 'i');
      } catch {
        regexMatcher = null;
      }
    }

    const typeExtSet = fileType !== 'all' ? FILE_TYPE_EXTENSIONS[fileType] : null;

    // Resolve Root Folders
    let rootPaths: string[] = [];
    if (options.customPath && fs.existsSync(options.customPath)) {
      rootPaths = [options.customPath];
    } else if (options.scanAllDrives) {
      try {
        const drives = await getDriveTelemetry();
        rootPaths = drives.map((d) => `${d.letter.replace(/:/g, '')}:\\`);
      } catch {
        rootPaths = ['C:\\'];
      }
    } else {
      const driveLetter = (options.driveLetter || 'C:').toUpperCase().replace(/[/\\]+$/, '').replace(/:/g, '');
      rootPaths = [`${driveLetter}:\\`];
    }

    const results: FastSearchItem[] = [];
    let scannedFilesCount = 0;
    let lastProgressTime = 0;
    let lastBatchTime = 0;
    let pendingBatch: FastSearchItem[] = [];

    const flushBatch = () => {
      if (pendingBatch.length > 0) {
        onBatch?.(pendingBatch);
        pendingBatch = [];
        lastBatchTime = Date.now();
      }
    };

    const emitProgress = (dir: string) => {
      const now = Date.now();
      if (now - lastProgressTime >= 80) {
        lastProgressTime = now;
        onProgress?.({
          currentDirectory: dir,
          scannedFilesCount,
          matchesCount: results.length,
          elapsedMs: now - startTime,
        });
      }
    };

    const isSizeMatch = (sizeBytes: number, filter: FastSearchSizeFilter): boolean => {
      switch (filter) {
        case 'tiny': return sizeBytes < 1024 * 1024; // < 1MB
        case 'small': return sizeBytes >= 1024 * 1024 && sizeBytes < 50 * 1024 * 1024; // 1-50MB
        case 'medium': return sizeBytes >= 50 * 1024 * 1024 && sizeBytes < 500 * 1024 * 1024; // 50-500MB
        case 'large': return sizeBytes >= 500 * 1024 * 1024; // > 500MB
        case 'custom': {
          if (options.minSizeBytes !== undefined && sizeBytes < options.minSizeBytes) return false;
          if (options.maxSizeBytes !== undefined && sizeBytes > options.maxSizeBytes) return false;
          return true;
        }
        default: return true;
      }
    };

    // Queue for parallel BFS traversal
    const queue: string[] = [...rootPaths];
    const CONCURRENCY = 12; // Parallel directory reads
    const activeWorkers = new Set<Promise<void>>();

    const processDirectory = async (dirPath: string): Promise<void> => {
      if (signal.aborted || results.length >= maxResults) return;

      emitProgress(dirPath);

      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      } catch {
        // Skip permission denied or locked directories
        return;
      }

      for (const entry of entries) {
        if (signal.aborted || results.length >= maxResults) break;

        const entryName = entry.name;
        const entryNameLower = entryName.toLowerCase();

        if (PROTECTED_SYSTEM_DIRS.has(entryNameLower)) {
          continue;
        }

        if (!includeHidden && entryName.startsWith('.')) {
          continue;
        }

        // Avoid infinite junction loops in Windows AppData
        if (entryNameLower === 'application data' && dirPath.toLowerCase().includes('appdata\\local')) {
          continue;
        }

        const fullPath = path.join(dirPath, entryName);

        if (entry.isFile()) {
          scannedFilesCount++;

          // If user only wants folders, skip files immediately
          if (targetKind === 'folders') {
            continue;
          }

          // 1. Check Name Match FIRST (In-memory, zero stat calls!)
          let nameMatches = false;
          if (!query) {
            nameMatches = true;
          } else if (regexMatcher) {
            nameMatches = regexMatcher.test(entryName);
          } else if (matchCase) {
            nameMatches = entryName.includes(query);
          } else {
            nameMatches = entryNameLower.includes(queryLower);
          }

          if (!nameMatches) continue;

          // 2. Check Extension Filter (In-memory)
          const ext = path.extname(entryName).toLowerCase();
          if (typeExtSet && !typeExtSet.has(ext)) {
            continue;
          }

          // 3. Only if query & extension match, call fs.promises.stat
          try {
            const stat = await fs.promises.stat(fullPath);
            if (!isSizeMatch(stat.size, sizeFilter)) {
              continue;
            }

            const item: FastSearchItem = {
              id: `${fullPath}_${stat.mtimeMs}`,
              name: entryName,
              path: fullPath,
              directory: dirPath,
              extension: ext,
              sizeBytes: stat.size,
              modifiedTime: stat.mtimeMs,
            };

            results.push(item);
            pendingBatch.push(item);

            const now = Date.now();
            if (pendingBatch.length >= 25 || now - lastBatchTime >= 80) {
              flushBatch();
            }
          } catch {
            // Ignore locked files
          }
        } else if (entry.isDirectory()) {
          scannedFilesCount++;

          // Check if folder name matches query when targetKind !== 'files'
          if (targetKind !== 'files' && (fileType === 'all' || targetKind === 'folders')) {
            let folderMatches = false;
            if (!query) {
              folderMatches = targetKind === 'folders';
            } else if (regexMatcher) {
              folderMatches = regexMatcher.test(entryName);
            } else if (matchCase) {
              folderMatches = entryName.includes(query);
            } else {
              folderMatches = entryNameLower.includes(queryLower);
            }

            if (folderMatches) {
              try {
                const stat = await fs.promises.stat(fullPath);
                // Non-blocking: Stream matching folder immediately with sizeBytes: -1 (Calculating...)
                const folderItem: FastSearchItem = {
                  id: `${fullPath}_${stat.mtimeMs}`,
                  name: entryName,
                  path: fullPath,
                  directory: dirPath,
                  extension: '',
                  sizeBytes: -1,
                  modifiedTime: stat.mtimeMs,
                  isDirectory: true,
                  sizePending: true,
                };

                results.push(folderItem);
                pendingBatch.push(folderItem);

                const now = Date.now();
                if (pendingBatch.length >= 25 || now - lastBatchTime >= 80) {
                  flushBatch();
                }
              } catch {
                // Ignore locked folders
              }
            }
          }

          // Skip node_modules and .git unless user explicitly searches inside one
          if (entryNameLower === 'node_modules' || entryNameLower === '.git') {
            continue;
          }
          queue.push(fullPath);
        }
      }
    };

    // Worker pool execution
    while ((queue.length > 0 || activeWorkers.size > 0) && results.length < maxResults) {
      if (signal.aborted) break;

      while (queue.length > 0 && activeWorkers.size < CONCURRENCY && results.length < maxResults) {
        const nextDir = queue.shift();
        if (!nextDir) break;

        const workerPromise = processDirectory(nextDir).finally(() => {
          activeWorkers.delete(workerPromise);
        });
        activeWorkers.add(workerPromise);
      }

      if (activeWorkers.size > 0) {
        await Promise.race(activeWorkers);
      }
    }

    flushBatch();

    // Background folder size resolution (asynchronous, non-blocking)
    const pendingFolders = results.filter((r) => r.isDirectory && r.sizePending);
    if (pendingFolders.length > 0) {
      (async () => {
        for (const f of pendingFolders) {
          if (signal.aborted) break;
          try {
            const size = await this.getDirectorySizeBytes(f.path, 3000);
            f.sizeBytes = size;
            f.sizePending = false;
            onProgress?.({
              currentDirectory: f.path,
              scannedFilesCount,
              matchesCount: results.length,
              elapsedMs: Date.now() - startTime,
              folderSizeUpdate: { path: f.path, sizeBytes: size },
            });
          } catch {
            f.sizeBytes = 0;
            f.sizePending = false;
          }
        }
      })().catch(() => {});
    }

    // Final progress update
    onProgress?.({
      currentDirectory: '',
      scannedFilesCount,
      matchesCount: results.length,
      elapsedMs: Date.now() - startTime,
    });

    return results;
  }

  public async getDirectorySizeBytes(dirPath: string, maxFiles = 8000): Promise<number> {
    let totalBytes = 0;
    let fileCount = 0;
    const queue = [dirPath];

    while (queue.length > 0 && fileCount < maxFiles) {
      const currentDir = queue.shift();
      if (!currentDir) break;

      try {
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (fileCount >= maxFiles) break;
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isFile()) {
            fileCount++;
            try {
              const stat = await fs.promises.stat(fullPath);
              totalBytes += stat.size;
            } catch {
              // Ignore locked files
            }
          } else if (entry.isDirectory()) {
            const lower = entry.name.toLowerCase();
            if (
              !lower.startsWith('.') &&
              lower !== '$recycle.bin' &&
              lower !== 'system volume information' &&
              lower !== 'recovery'
            ) {
              queue.push(fullPath);
            }
          }
        }
      } catch {
        // Ignore unreadable dirs
      }
    }

    return totalBytes;
  }

  public async deleteFile(filePath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) return false;
      try {
        const electron = await import('electron');
        const shell = electron.shell || (electron as any).default?.shell;
        if (shell?.trashItem) {
          await shell.trashItem(filePath);
          return true;
        }
      } catch {
        // Fall back to direct fs deletion if electron shell is unavailable
      }

      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) {
        await fs.promises.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(filePath);
      }
      return true;
    } catch {
      return false;
    }
  }
}
