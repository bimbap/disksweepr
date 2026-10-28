import fs from 'fs';
import path from 'path';
import { LargeFileItem, LargeFilesScanOptions } from '../../shared/types';
import { getDriveTelemetry } from './telemetryService';

const PROTECTED_DIR_NAMES = new Set([
  '$recycle.bin',
  'system volume information',
  'recovery',
  'msocache',
  'config.msi',
]);

export class LargeFileService {
  private abortController: AbortController | null = null;

  public cancelScan() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async scan(
    options: LargeFilesScanOptions,
    onProgress?: (progress: { currentDirectory: string }) => void
  ): Promise<LargeFileItem[]> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const minSizeBytes = options.minSizeBytes || 100 * 1024 * 1024; // Default 100MB
    const maxResults = options.maxResults || 300;

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

    const results: LargeFileItem[] = [];
    const queue: Array<{ dirPath: string; depth: number }> = rootPaths.map((p) => ({ dirPath: p, depth: 0 }));
    const MAX_DEPTH = 6; // Traverse up to 6 subfolder levels to prevent infinite recursion

    while (queue.length > 0 && results.length < 1000) {
      if (signal.aborted) {
        break;
      }

      const current = queue.shift();
      if (!current) break;

      onProgress?.({ currentDirectory: current.dirPath });

      try {
        const entries = await fs.promises.readdir(current.dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (signal.aborted) break;

          const entryNameLower = entry.name.toLowerCase();

          // Skip protected / system root directories
          if (PROTECTED_DIR_NAMES.has(entryNameLower)) {
            continue;
          }

          const fullPath = path.join(current.dirPath, entry.name);

          if (entry.isFile()) {
            try {
              const stat = await fs.promises.stat(fullPath);
              if (stat.size >= minSizeBytes) {
                results.push({
                  id: `${fullPath}_${stat.mtimeMs}`,
                  name: entry.name,
                  path: fullPath,
                  extension: path.extname(entry.name).toLowerCase(),
                  sizeBytes: stat.size,
                  modifiedTime: stat.mtimeMs,
                });
              }
            } catch {
              // Ignore locked / inaccessible files
            }
          } else if (entry.isDirectory() && current.depth < MAX_DEPTH) {
            // Check if top-level subfolder itself is a massive directory
            if (current.depth <= 1 && !entry.name.startsWith('.')) {
              try {
                const dirSize = await this.getDirectorySizeBytes(fullPath, 5000);
                if (dirSize >= minSizeBytes) {
                  const stat = await fs.promises.stat(fullPath).catch(() => null);
                  results.push({
                    id: `${fullPath}_${stat?.mtimeMs || Date.now()}`,
                    name: entry.name,
                    path: fullPath,
                    extension: '',
                    sizeBytes: dirSize,
                    modifiedTime: stat?.mtimeMs || Date.now(),
                    isDirectory: true,
                  });
                }
              } catch {}
            }

            // Skip hidden folders or node_modules to keep large file scan fast
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              queue.push({ dirPath: fullPath, depth: current.depth + 1 });
            }
          }
        }
      } catch {
        // Skip inaccessible folders (EPERM / EACCES)
      }
    }

    this.abortController = null;
    if (signal.aborted) {
      return [];
    }

    // Sort descending by size (largest first) and slice to maxResults
    results.sort((a, b) => b.sizeBytes - a.sizeBytes);
    return results.slice(0, maxResults);
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

  public async deleteFiles(filePaths: string[]): Promise<{
    deletedPaths: string[];
    failedPaths: string[];
    reclaimedBytes: number;
  }> {
    const deletedPaths: string[] = [];
    const failedPaths: string[] = [];
    let reclaimedBytes = 0;

    for (const filePath of filePaths) {
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
          const dirSize = await this.getDirectorySizeBytes(filePath);
          await fs.promises.rm(filePath, { recursive: true, force: true });
          deletedPaths.push(filePath);
          reclaimedBytes += dirSize;
        } else {
          await fs.promises.unlink(filePath);
          deletedPaths.push(filePath);
          reclaimedBytes += stat.size;
        }
      } catch (err) {
        console.error(`Failed to delete large target: ${filePath}`, err);
        failedPaths.push(filePath);
      }
    }

    return { deletedPaths, failedPaths, reclaimedBytes };
  }
}
