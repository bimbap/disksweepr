import fs from 'fs';
import path from 'path';
import { DevArtifactItem, DevScanOptions } from '../../shared/types';

const TARGET_ARTIFACT_NAMES = new Set([
  'node_modules',
  '.next',
  'dist',
  'target',
  'build',
  '.turbo',
]);

export class DevCleanerService {
  private abortController: AbortController | null = null;

  public cancelScan() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async scan(
    options: DevScanOptions,
    onProgress?: (progress: { currentDirectory: string }) => void
  ): Promise<DevArtifactItem[]> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const rootPath = options.rootPath;
    const results: DevArtifactItem[] = [];

    if (!fs.existsSync(rootPath)) {
      return [];
    }

    const queue: Array<{ dirPath: string; depth: number }> = [{ dirPath: rootPath, depth: 0 }];
    const MAX_DEPTH = 4; // Search up to 4 project subdirectories deep

    while (queue.length > 0) {
      if (signal.aborted) break;
      const current = queue.shift();
      if (!current) break;

      onProgress?.({ currentDirectory: current.dirPath });

      try {
        const entries = await fs.promises.readdir(current.dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const fullPath = path.join(current.dirPath, entry.name);
          const dirNameLower = entry.name.toLowerCase();

          // If this directory IS a target build artifact (e.g. node_modules, .next)
          if (TARGET_ARTIFACT_NAMES.has(dirNameLower)) {
            onProgress?.({ currentDirectory: fullPath });
            try {
              const stat = await fs.promises.stat(fullPath);
              const parentDir = current.dirPath;
              const projectName = path.basename(parentDir);

              // Calculate size of directory (fast calculation)
              const sizeBytes = await this.calculateDirSize(fullPath);
              const daysInactive = Math.max(
                0,
                Math.floor((Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24))
              );

              results.push({
                id: fullPath,
                projectName,
                artifactType: entry.name as any,
                path: fullPath,
                sizeBytes,
                lastModifiedTime: stat.mtimeMs,
                daysInactive,
                selected: daysInactive > 30, // Pre-select if untouched for > 30 days
              });
            } catch {
              // Ignore locked directory stat
            }
            // Do NOT recurse into artifact directories
            continue;
          }

          // Otherwise, if under max depth, continue scanning subfolders (skip hidden folders except .git check)
          if (current.depth < MAX_DEPTH && !entry.name.startsWith('.')) {
            queue.push({ dirPath: fullPath, depth: current.depth + 1 });
          }
        }
      } catch {
        // Skip inaccessible folders
      }
    }

    this.abortController = null;
    if (signal.aborted) {
      return [];
    }

    // Sort descending by size
    results.sort((a, b) => b.sizeBytes - a.sizeBytes);
    return results;
  }

  public async deleteArtifacts(artifactPaths: string[]): Promise<{
    deletedPaths: string[];
    failedPaths: string[];
    reclaimedBytes: number;
  }> {
    const deletedPaths: string[] = [];
    const failedPaths: string[] = [];
    let reclaimedBytes = 0;

    for (const dirPath of artifactPaths) {
      // Safety check: Dir name must strictly be one of the recognized artifact folders
      const baseName = path.basename(dirPath).toLowerCase();
      if (!TARGET_ARTIFACT_NAMES.has(baseName)) {
        failedPaths.push(dirPath);
        continue;
      }

      try {
        const size = await this.calculateDirSize(dirPath);
        await fs.promises.rm(dirPath, { recursive: true, force: true });
        deletedPaths.push(dirPath);
        reclaimedBytes += size;
      } catch {
        failedPaths.push(dirPath);
      }
    }

    return { deletedPaths, failedPaths, reclaimedBytes };
  }

  private async calculateDirSize(dirPath: string): Promise<number> {
    let totalBytes = 0;
    const queue = [dirPath];
    let fileCount = 0;
    const MAX_FILES = 20000; // Cap file count to keep scan ultra-responsive

    while (queue.length > 0 && fileCount < MAX_FILES) {
      const currentDir = queue.shift();
      if (!currentDir) break;

      try {
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          fileCount++;
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isFile()) {
            try {
              const stat = await fs.promises.stat(fullPath);
              totalBytes += stat.size;
            } catch {
              // Ignore
            }
          } else if (entry.isDirectory()) {
            queue.push(fullPath);
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    return totalBytes;
  }
}
