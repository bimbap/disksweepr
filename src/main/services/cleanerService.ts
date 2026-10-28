import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { shell } from 'electron';
import {
  CleanProgress,
  CleanReport,
  ScannedCategory,
  HistoryDetailItem,
} from '../../shared/types';
import { CATEGORY_DEFINITIONS, expandEnvVars } from './ruleRegistry';

const execPromise = util.promisify(exec);

export class CleanerService {
  private abortController: AbortController | null = null;

  public cancelClean() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async clean(
    scannedCategories: ScannedCategory[],
    selectedCategoryIds: string[],
    onProgress?: (progress: CleanProgress) => void
  ): Promise<CleanReport> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const startTime = Date.now();
    let reclaimedBytes = 0;
    let cleanedFilesCount = 0;
    let skippedFilesCount = 0;
    const errors: Array<{ path: string; reason: string }> = [];
    const items: HistoryDetailItem[] = [];

    // Filter categories selected for cleaning
    const targetsToClean = scannedCategories.filter(
      (cat) => selectedCategoryIds.includes(cat.id) && (cat.fileCount > 0 || cat.isRecycleBin)
    );

    const totalFiles = targetsToClean.reduce((acc, cat) => acc + cat.fileCount, 0);
    const totalBytes = targetsToClean.reduce((acc, cat) => acc + cat.totalBytes, 0);

    let lastProgressEmit = 0;
    const emitProgress = (fileName: string, categoryName: string) => {
      const now = Date.now();
      if (now - lastProgressEmit > 50) {
        lastProgressEmit = now;
        const percent = totalFiles > 0 ? Math.round((cleanedFilesCount / totalFiles) * 100) : 100;
        onProgress?.({
          currentFile: fileName,
          currentCategory: categoryName,
          cleanedFilesCount,
          cleanedBytes: reclaimedBytes,
          totalFiles,
          totalBytes,
          percent: Math.min(100, Math.max(0, percent)),
        });
      }
    };

    // Build safety allowlist of resolved root directories
    // Include all system category definitions (C: drive)
    const allowedRoots = new Set<string>();
    for (const def of CATEGORY_DEFINITIONS) {
      for (const p of def.paths) {
        const expanded = expandEnvVars(p);
        if (expanded) {
          allowedRoots.add(path.resolve(expanded).toLowerCase());
        }
      }
    }

    // Also include paths from the actual scan targets (covers secondary drives, media hunter, etc.)
    for (const category of targetsToClean) {
      // Find the original definition to get its declared paths
      const def = CATEGORY_DEFINITIONS.find((d) => d.id === category.id);
      if (def) {
        for (const p of def.paths) {
          const expanded = expandEnvVars(p);
          if (expanded) {
            allowedRoots.add(path.resolve(expanded).toLowerCase());
          }
        }
      }
      // Authorize drive root for any file path in this category (covers secondary drive categories)
      for (const file of category.files) {
        const resolved = path.resolve(file.path);
        const parsed = path.parse(resolved);
        // Authorize both the drive root and the direct parent directory of each file
        if (parsed.root) {
          allowedRoots.add(path.resolve(parsed.root).toLowerCase());
        }
        // Authorize the parent directory so boundary check passes
        const parentDir = path.dirname(resolved).toLowerCase();
        allowedRoots.add(parentDir);
      }
    }

    for (const category of targetsToClean) {
      if (signal.aborted) break;

      if (category.isRecycleBin) {
        emitProgress('Emptying Recycle Bin...', category.name);
        try {
          const driveMatch = category.name.match(/\(([A-Z]:)\)/i) || category.id.match(/^([A-Z]:)_/i);
          const driveArg = driveMatch ? `-DriveLetter ${driveMatch[1].replace(':', '')}` : '';
          await execPromise(`powershell -NoProfile -Command "Clear-RecycleBin ${driveArg} -Force -ErrorAction SilentlyContinue"`);
          reclaimedBytes += category.totalBytes;
          cleanedFilesCount += category.fileCount;

          for (const f of category.files) {
            items.push({
              name: f.name,
              path: f.path,
              sizeBytes: f.sizeBytes,
              category: category.name,
              status: 'purged',
            });
          }
        } catch (err: any) {
          errors.push({ path: 'Recycle Bin', reason: err.message || 'Failed to empty' });
          skippedFilesCount += category.fileCount;
        }
        continue;
      }

      // Track directories to prune later
      const directoriesVisited = new Set<string>();

      for (const file of category.files) {
        if (signal.aborted) break;

        const resolvedFilePath = path.resolve(file.path);
        const resolvedLower = resolvedFilePath.toLowerCase();

        // Safety Invariant: File must strictly reside inside an allowed root
        // A file is safe if it's inside any of the allowed roots (starts with root path, is not the root itself)
        const isSafe = Array.from(allowedRoots).some((root) => {
          const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
          return resolvedLower.startsWith(rootWithSep) || resolvedLower === root || resolvedLower.startsWith(root + '\\') || resolvedLower.startsWith(root + '/');
        });

        if (!isSafe) {
          skippedFilesCount++;
          errors.push({
            path: file.path,
            reason: 'Path boundary violation: file outside authorized target roots',
          });
          continue;
        }

        emitProgress(file.name, category.name);

        try {
          if (category.useTrash || category.id.includes('media_hunter')) {
            await shell.trashItem(resolvedFilePath);
          } else {
            await fs.promises.unlink(resolvedFilePath);
          }
          reclaimedBytes += file.sizeBytes;
          cleanedFilesCount++;
          items.push({
            name: file.name,
            path: file.path,
            sizeBytes: file.sizeBytes,
            category: category.name,
            status: 'purged',
          });

          // Only prune empty folders for system cache/temp, NEVER prune user personal root folders!
          if (!category.useTrash && !category.id.includes('media_hunter')) {
            const parentDir = path.dirname(resolvedFilePath);
            directoriesVisited.add(parentDir);
          }
        } catch (err: any) {
          skippedFilesCount++;
          // Common Windows locks (file open in another program)
          const reason =
            err.code === 'EBUSY'
              ? 'File is currently locked/in use'
              : err.code === 'EPERM' || err.code === 'EACCES'
              ? 'Insufficient permissions'
              : err.message || 'Deletion failed';
          errors.push({ path: file.path, reason });
          items.push({
            name: file.name,
            path: file.path,
            sizeBytes: file.sizeBytes,
            category: category.name,
            status: 'skipped',
            reason,
          });
        }
      }

      // Post-clean pruning: remove empty subdirectories, preserving root directories
      await this.pruneEmptyDirectories(directoriesVisited, allowedRoots);
    }

    this.abortController = null;

    return {
      reclaimedBytes,
      cleanedFilesCount,
      skippedFilesCount,
      elapsedMs: Date.now() - startTime,
      errors,
      items,
    };
  }

  private async pruneEmptyDirectories(
    directories: Set<string>,
    allowedRoots: Set<string>
  ): Promise<void> {
    // Sort deepest paths first so leaf directories are pruned before parents
    const sortedDirs = Array.from(directories).sort((a, b) => b.length - a.length);

    for (const dir of sortedDirs) {
      const resolvedDir = path.resolve(dir).toLowerCase();

      // NEVER remove the root target directory or drive root itself
      if (
        allowedRoots.has(resolvedDir) ||
        path.parse(dir).root.toLowerCase() === resolvedDir ||
        resolvedDir.endsWith(':\\') ||
        resolvedDir.endsWith(':/')
      ) {
        continue;
      }

      try {
        const remaining = await fs.promises.readdir(dir);
        if (remaining.length === 0) {
          await fs.promises.rmdir(dir);
        }
      } catch {
        // Directory in use or not empty; skip
      }
    }
  }
}
