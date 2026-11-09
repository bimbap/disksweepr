import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import type {
  CleanProgress,
  CleanReport,
  ScannedCategory,
  HistoryDetailItem,
} from '../../shared/types.ts';
import {
  CATEGORY_DEFINITIONS,
  getCategoryDefinitionsForDrive,
  resolveCategoryPaths,
} from './ruleRegistry.ts';
import { isProtectedSystemPath } from './pathSafety.ts';

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
    onProgress?: (progress: CleanProgress) => void,
    excludedFilePaths?: string[]
  ): Promise<CleanReport> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const startTime = Date.now();
    let reclaimedBytes = 0;
    let cleanedFilesCount = 0;
    let skippedFilesCount = 0;
    const errors: Array<{ path: string; reason: string }> = [];
    const items: HistoryDetailItem[] = [];

    const excludedExact = new Set(excludedFilePaths || []);
    const excludedResolved = new Set(
      (excludedFilePaths || []).map((p) => path.resolve(p).toLowerCase())
    );
    const isFileExcluded = (filePath: string) =>
      excludedExact.has(filePath) || excludedResolved.has(path.resolve(filePath).toLowerCase());

    // Filter categories selected for cleaning and exclude unchecked individual files
    const targetsToClean = scannedCategories
      .filter((cat) => selectedCategoryIds.includes(cat.id))
      .map((cat) => {
        if (excludedExact.size === 0) return cat;
        const includedFiles = cat.files.filter((f) => !isFileExcluded(f.path));
        const hasExcludedInCategory = includedFiles.length < cat.files.length;
        const includedBytes = includedFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
        return {
          ...cat,
          files: includedFiles,
          fileCount: includedFiles.length,
          totalBytes: includedBytes,
          // If user unchecked specific items in Recycle Bin, delete only the selected files instead of Clear-RecycleBin
          isRecycleBin: hasExcludedInCategory ? false : cat.isRecycleBin,
        };
      })
      .filter((cat) => cat.fileCount > 0 || (cat.isRecycleBin && excludedExact.size === 0));

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
      const resolvedList = resolveCategoryPaths(def);
      for (const p of resolvedList) {
        allowedRoots.add(path.resolve(p).toLowerCase());
      }
    }

    // Also include paths from the actual scan targets (covers secondary drives, media hunter, etc.)
    for (const category of targetsToClean) {
      // Find definition across system drive and secondary drive targets
      const driveMatch = category.id.match(/^([A-Z]:)/i);
      const targetDrive = driveMatch ? driveMatch[1] : 'C:';
      const driveDefs = getCategoryDefinitionsForDrive(targetDrive);
      const def =
        driveDefs.find((d) => d.id === category.id) ||
        CATEGORY_DEFINITIONS.find((d) => d.id === category.id);

      if (def) {
        const resolvedList = resolveCategoryPaths(def);
        for (const p of resolvedList) {
          allowedRoots.add(path.resolve(p).toLowerCase());
        }
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

        // Safety Invariant: File must strictly reside inside an authorized category root and NOT be protected
        const isProtected = isProtectedSystemPath(resolvedLower);

        const isSafe =
          !isProtected &&
          Array.from(allowedRoots).some((root) => {
            // C: drive root itself must never be an allowed root
            if (/^c:\\?$/i.test(root)) return false;
            const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
            return (
              resolvedLower.startsWith(rootWithSep) ||
              resolvedLower.startsWith(root + '\\') ||
              resolvedLower.startsWith(root + '/')
            );
          });

        if (!isSafe) {
          skippedFilesCount++;
          errors.push({
            path: file.path,
            reason: isProtected
              ? 'Blocked: Critical system/user registry file protection'
              : 'Path boundary violation: file outside authorized target roots',
          });
          continue;
        }

        emitProgress(file.name, category.name);

        try {
          if (category.useTrash || category.id.includes('media_hunter')) {
            try {
              const electron = await import('electron');
              const electronShell = electron.shell || (electron as any).default?.shell;
              if (electronShell?.trashItem) {
                await electronShell.trashItem(resolvedFilePath);
              } else {
                await fs.promises.unlink(resolvedFilePath);
              }
            } catch {
              await fs.promises.unlink(resolvedFilePath);
            }
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
