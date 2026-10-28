import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { shell } from 'electron';
import {
  DuplicateFile,
  DuplicateGroup,
  DuplicateScanOptions,
  DuplicateScanProgress,
} from '../../shared/types';

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

    const rootPath = path.resolve(options.targetPath);
    const minSizeBytes = options.minSizeBytes !== undefined ? options.minSizeBytes : 1024 * 1024; // default 1MB

    let scannedFilesCount = 0;
    let lastProgressEmit = 0;

    const emitProgress = (curPath: string, stage: 'indexing' | 'hashing', foundCount: number) => {
      const now = Date.now();
      if (now - lastProgressEmit > 60) {
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

    const walk = async (dir: string) => {
      if (signal.aborted) return;

      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (signal.aborted) return;
        const fullPath = path.join(dir, entry.name);

        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory()) {
          const lower = entry.name.toLowerCase();
          if (
            lower === 'node_modules' ||
            lower === '.git' ||
            lower === '$recycle.bin' ||
            lower === 'appdata'
          ) {
            continue;
          }
          await walk(fullPath);
        } else if (entry.isFile()) {
          try {
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
          } catch {
            // In use or unreadable
          }
        }
      }
    };

    await walk(rootPath);
    if (signal.aborted) return [];

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

    for (const bucket of candidateSizeBuckets) {
      if (signal.aborted) return [];

      for (const filePath of bucket.paths) {
        if (signal.aborted) return [];
        emitProgress(filePath, 'hashing', quickHashMap.size);

        try {
          const quickHash = await this.computeQuickHash(filePath);
          const key = `${bucket.size}_${quickHash}`;
          const existing = quickHashMap.get(key);
          if (existing) {
            existing.paths.push(filePath);
          } else {
            quickHashMap.set(key, { size: bucket.size, paths: [filePath] });
          }
        } catch {
          // File read error
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

    for (const bucket of candidateFullBuckets) {
      if (signal.aborted) return [];

      for (const filePath of bucket.paths) {
        if (signal.aborted) return [];
        emitProgress(filePath, 'hashing', fullHashMap.size);

        try {
          const fullHash = await this.computeFullHash(filePath);
          const key = fullHash;
          const existing = fullHashMap.get(key);
          if (existing) {
            existing.paths.push(filePath);
          } else {
            fullHashMap.set(key, { size: bucket.size, paths: [filePath] });
          }
        } catch {
          // Read error
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
        if (useTrash) {
          await shell.trashItem(p);
        } else {
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

  private computeQuickHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath, { start: 0, end: 4095 });
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private computeFullHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
