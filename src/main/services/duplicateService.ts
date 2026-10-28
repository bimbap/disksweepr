import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  DuplicateFile,
  DuplicateGroup,
  DuplicateScanOptions,
  DuplicateScanProgress,
} from '../../shared/types.ts';
import { getDriveTelemetry } from './telemetryService.ts';

const PROTECTED_DIR_NAMES = new Set([
  '$recycle.bin',
  'system volume information',
  'recovery',
  'msocache',
  'config.msi',
  'node_modules',
  '.git',
  'appdata',
]);

export class DuplicateService {
  private abortController: AbortController | null = null;

  public cancelScan() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async scanDuplicates(
    options: DuplicateScanOptions,
    onProgress?: (progress: DuplicateScanProgress) => void
  ): Promise<DuplicateGroup[]> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    let rootPaths: string[] = [];
    if (options.scanAllDrives) {
      try {
        const drives = await getDriveTelemetry();
        rootPaths = drives.map((d) => `${d.letter.replace(/:/g, '')}:\\`);
      } catch {
        rootPaths = ['C:\\'];
      }
    } else if (options.targetPath) {
      rootPaths = [path.resolve(options.targetPath)];
    } else {
      rootPaths = ['C:\\'];
    }

    const minSizeBytes = Math.max(1, options.minSizeBytes !== undefined ? options.minSizeBytes : 1024 * 1024); // default 1MB, skip 0-byte

    let scannedFilesCount = 0;
    let lastProgressEmit = 0;

    const emitProgress = (curPath: string, stage: 'indexing' | 'hashing', foundCount: number) => {
      const now = Date.now();
      if (now - lastProgressEmit > 50) {
        lastProgressEmit = now;
        onProgress?.({
          currentPath: curPath,
          stage,
          scannedFilesCount,
          duplicatesFoundCount: foundCount,
        });
      }
    };

    // --- PHASE 1: SIZE BUCKETING ---
    // Map of sizeBytes -> array of file paths
    const sizeMap = new Map<number, string[]>();

    for (const root of rootPaths) {
      if (signal.aborted) break;

      const queue: string[] = [root];

      while (queue.length > 0) {
        if (signal.aborted) break;

        const currentDir = queue.shift()!;
        let entries: fs.Dirent[] = [];
        try {
          entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        } catch {
          continue;
        }

        for (const entry of entries) {
          if (signal.aborted) break;

          try {
            if (entry.isSymbolicLink()) continue;

            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
              const lower = entry.name.toLowerCase();
              if (PROTECTED_DIR_NAMES.has(lower)) {
                continue;
              }
              queue.push(fullPath);
            } else if (entry.isFile()) {
              const stat = await fs.promises.stat(fullPath);
              scannedFilesCount++;
              emitProgress(fullPath, 'indexing', 0);

              if (stat.size >= minSizeBytes) {
                const list = sizeMap.get(stat.size);
                if (list) {
                  list.push(fullPath);
                } else {
                  sizeMap.set(stat.size, [fullPath]);
                }
              }
            }
          } catch {
            // File in use, unreadable, or missing
          }
        }
      }
    }

    if (signal.aborted) {
      this.abortController = null;
      return [];
    }

    // Filter to sizes with 2 or more files
    const candidateSizeBuckets: Array<{ size: number; paths: string[] }> = [];
    for (const [size, paths] of sizeMap.entries()) {
      if (paths.length >= 2) {
        candidateSizeBuckets.push({ size, paths });
      }
    }

    // --- PHASE 2: QUICK CHUNK HASH (4KB) ---
    // Group candidates by `${size}_${quickHash}`
    const quickHashMap = new Map<string, { size: number; paths: string[] }>();
    let potentialDupesCount = 0;

    for (const bucket of candidateSizeBuckets) {
      if (signal.aborted) {
        this.abortController = null;
        return [];
      }

      for (const filePath of bucket.paths) {
        if (signal.aborted) {
          this.abortController = null;
          return [];
        }
        emitProgress(filePath, 'hashing', potentialDupesCount);

        try {
          const quickHash = await this.computeQuickHash(filePath, signal);
          const key = `${bucket.size}_${quickHash}`;
          const existing = quickHashMap.get(key);
          if (existing) {
            existing.paths.push(filePath);
            potentialDupesCount++;
          } else {
            quickHashMap.set(key, { size: bucket.size, paths: [filePath] });
          }
        } catch {
          // File read error or aborted
        }
      }
    }

    // Filter quickHash groups with 2 or more files
    const candidateFullBuckets: Array<{ size: number; paths: string[] }> = [];
    for (const item of quickHashMap.values()) {
      if (item.paths.length >= 2) {
        candidateFullBuckets.push(item);
      }
    }

    // --- PHASE 3: FULL SHA-256 HASH ---
    const fullHashMap = new Map<string, { size: number; paths: string[] }>();
    let confirmedDupesCount = 0;

    for (const bucket of candidateFullBuckets) {
      if (signal.aborted) {
        this.abortController = null;
        return [];
      }

      for (const filePath of bucket.paths) {
        if (signal.aborted) {
          this.abortController = null;
          return [];
        }
        emitProgress(filePath, 'hashing', confirmedDupesCount);

        try {
          const fullHash = await this.computeFullHash(filePath, signal);
          const key = fullHash;
          const existing = fullHashMap.get(key);
          if (existing) {
            existing.paths.push(filePath);
            confirmedDupesCount++;
          } else {
            fullHashMap.set(key, { size: bucket.size, paths: [filePath] });
          }
        } catch {
          // Read error or aborted
        }
      }
    }

    // --- PHASE 4: COMPILE DUPLICATE GROUPS ---
    const groups: DuplicateGroup[] = [];

    for (const [hash, bucket] of fullHashMap.entries()) {
      if (bucket.paths.length >= 2) {
        const files: DuplicateFile[] = [];

        for (const p of bucket.paths) {
          try {
            const stat = await fs.promises.stat(p);
            files.push({
              path: p,
              name: path.basename(p),
              sizeBytes: stat.size,
              modifiedTime: stat.mtimeMs,
              selected: false,
            });
          } catch {
            // Skip unreadable
          }
        }

        if (files.length >= 2) {
          // By default, sort newest to oldest
          files.sort((a, b) => b.modifiedTime - a.modifiedTime);
          const wastedBytes = bucket.size * (files.length - 1);

          groups.push({
            id: hash,
            hash,
            sizeBytes: bucket.size,
            files,
            wastedBytes,
          });
        }
      }
    }

    // Sort groups by wastedBytes descending (biggest reclaimable storage first)
    groups.sort((a, b) => b.wastedBytes - a.wastedBytes);

    this.abortController = null;
    return groups;
  }

  public async deleteDuplicates(
    filePaths: string[],
    useTrash: boolean = true
  ): Promise<{ deletedPaths: string[]; failedPaths: string[]; reclaimedBytes: number }> {
    const deletedPaths: string[] = [];
    const failedPaths: string[] = [];
    let reclaimedBytes = 0;

    for (const p of filePaths) {
      try {
        const stat = await fs.promises.stat(p);
        let deleted = false;
        if (useTrash) {
          try {
            const electron = await import('electron');
            if (electron?.shell?.trashItem) {
              await electron.shell.trashItem(p);
              deleted = true;
            }
          } catch {
            // Electron shell unavailable in tests
          }
        }
        if (!deleted) {
          await fs.promises.unlink(p);
        }
        reclaimedBytes += stat.size;
        deletedPaths.push(p);
      } catch {
        failedPaths.push(p);
      }
    }

    return { deletedPaths, failedPaths, reclaimedBytes };
  }

  private computeQuickHash(filePath: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error('Aborted'));
      }
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath, { start: 0, end: 4095, signal });
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => {
        stream.destroy();
        reject(err);
      });
    });
  }

  private computeFullHash(filePath: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error('Aborted'));
      }
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath, { signal });
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => {
        stream.destroy();
        reject(err);
      });
    });
  }
}
