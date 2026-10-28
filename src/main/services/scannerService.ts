import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import {
  CategoryDefinition,
  ScannedCategory,
  ScannedFile,
  ScanOptions,
  ScanProgress,
  ScanResult,
} from '../../shared/types';
import { expandEnvVars, getCategoryDefinitionsForDrive } from './ruleRegistry';
import { matchesExtension } from '../../shared/filters';

const execPromise = util.promisify(exec);

export class ScannerService {
  private abortController: AbortController | null = null;

  public cancelScan() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async scan(
    options?: ScanOptions,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ScanResult> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const startTime = Date.now();
    const targetDrive = options?.targetDrive || 'C:';
    const categoryIds = options?.categoryIds;
    // undefined = every format; an empty array = no format matches (never "scan everything").
    const extensionFilter = options?.extensionFilter
      ? options.extensionFilter.map((e) => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`))
      : undefined;

    const allDefinitions = getCategoryDefinitionsForDrive(targetDrive);
    const definitions = categoryIds && categoryIds.length > 0
      ? allDefinitions.filter((def) => categoryIds.includes(def.id))
      : allDefinitions;

    const scannedCategories: ScannedCategory[] = [];
    let overallScannedBytes = 0;
    let overallScannedFiles = 0;

    let lastProgressEmit = 0;
    const emitProgress = (categoryName: string, currentPath: string, percent: number) => {
      const now = Date.now();
      if (now - lastProgressEmit > 50 || percent === 100) {
        lastProgressEmit = now;
        onProgress?.({
          currentCategory: categoryName,
          currentPath,
          scannedFilesCount: overallScannedFiles,
          scannedBytes: overallScannedBytes,
          percent: Math.min(100, Math.max(0, percent)),
        });
      }
    };

    for (let i = 0; i < definitions.length; i++) {
      if (signal.aborted) {
        break;
      }

      const def = definitions[i];
      const categoryPercent = Math.round((i / definitions.length) * 100);
      emitProgress(def.name, 'Initializing scan...', categoryPercent);

      const categoryFiles: ScannedFile[] = [];
      let categoryTotalBytes = 0;

      if (def.isRecycleBin) {
        const binResult = await this.scanRecycleBin(signal, targetDrive, extensionFilter);
        categoryFiles.push(...binResult.files);
        categoryTotalBytes += binResult.totalBytes;
        overallScannedBytes += binResult.totalBytes;
        overallScannedFiles += binResult.files.length;
      } else {
        for (const rawPath of def.paths) {
          if (signal.aborted) break;

          const expandedRoot = expandEnvVars(rawPath);
          if (!expandedRoot) continue;

          emitProgress(def.name, expandedRoot, categoryPercent);

          try {
            await fs.promises.access(expandedRoot, fs.constants.R_OK);
          } catch {
            // Target folder does not exist or not readable; skip quietly
            continue;
          }

          await this.walkDirectory(
            expandedRoot,
            expandedRoot,
            def,
            categoryFiles,
            signal,
            extensionFilter,
            (filePath, fileSize) => {
              categoryTotalBytes += fileSize;
              overallScannedBytes += fileSize;
              overallScannedFiles += 1;
              emitProgress(def.name, filePath, categoryPercent);
            }
          );
        }
      }

      scannedCategories.push({
        id: def.id,
        name: def.name,
        description: def.description,
        group: def.group,
        risk: def.risk,
        selected: categoryFiles.length > 0 ? def.defaultSelected : false,
        totalBytes: categoryTotalBytes,
        fileCount: categoryFiles.length,
        files: categoryFiles,
        requiresAdmin: def.requiresAdmin,
        isRecycleBin: def.isRecycleBin,
        useTrash: def.useTrash,
      });
    }

    if (signal.aborted) {
      this.abortController = null;
      return {
        categories: [],
        totalBytes: 0,
        totalFiles: 0,
        elapsedMs: Date.now() - startTime,
      };
    }

    emitProgress('Complete', 'All categories audited', 100);
    this.abortController = null;

    return {
      categories: scannedCategories,
      totalBytes: overallScannedBytes,
      totalFiles: overallScannedFiles,
      elapsedMs: Date.now() - startTime,
    };
  }

  private async walkDirectory(
    currentDir: string,
    allowedRoot: string,
    def: CategoryDefinition,
    results: ScannedFile[],
    signal: AbortSignal,
    extensionFilter: string[] | undefined,
    onFileFound: (filePath: string, size: number) => void
  ): Promise<void> {
    if (signal.aborted) return;

    const isDriveRoot = /^[A-Z]:\\?$/i.test(allowedRoot);

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      // Permission denied or locked directory (e.g. system folder)
      return;
    }

    for (const entry of entries) {
      if (signal.aborted) return;

      const fullPath = path.join(currentDir, entry.name);

      // Rule: Do NOT traverse symbolic links to avoid escaping boundary
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        const lowerName = entry.name.toLowerCase();
        // Skip code repos and system trash inside user folders to avoid slow recursive scans
        if (
          lowerName === 'node_modules' ||
          lowerName === '.git' ||
          lowerName === '$recycle.bin' ||
          lowerName === 'appdata'
        ) {
          continue;
        }
        // If scanning a drive root directly, do NOT recurse into user personal folders
        if (isDriveRoot) {
          continue;
        }
        await this.walkDirectory(fullPath, allowedRoot, def, results, signal, extensionFilter, onFileFound);
      } else if (entry.isFile()) {
        if (extensionFilter) {
          // If user specified custom extension filter:
          if (def.id.includes('media_hunter')) {
            // Media hunter matches any extension the user chose
            if (!matchesExtension(entry.name, extensionFilter)) {
              continue;
            }
          } else {
            // Standard category must match user filter
            if (!matchesExtension(entry.name, extensionFilter)) {
              continue;
            }
            // And must also match category-specific extensions if defined
            if (def.fileExtensions && def.fileExtensions.length > 0) {
              if (!matchesExtension(entry.name, def.fileExtensions)) {
                continue;
              }
            }
          }
        } else {
          // No user extension filter (All Formats):
          if (def.fileExtensions && def.fileExtensions.length > 0) {
            if (!matchesExtension(entry.name, def.fileExtensions)) {
              continue;
            }
          }
        }

        try {
          const stat = await fs.promises.stat(fullPath);
          const scannedFile: ScannedFile = {
            path: fullPath,
            name: entry.name,
            sizeBytes: stat.size,
            modifiedTime: stat.mtimeMs,
          };
          results.push(scannedFile);
          onFileFound(fullPath, stat.size);
        } catch {
          // File in use or unreadable
          continue;
        }
      }
    }
  }

  private async scanRecycleBin(
    signal: AbortSignal,
    driveLetter?: string,
    extensionFilter?: string[]
  ): Promise<{ files: ScannedFile[]; totalBytes: number }> {
    if (signal.aborted) return { files: [], totalBytes: 0 };

    const normDrive = (driveLetter || 'C:').toUpperCase().slice(0, 1) + ':';

    try {
      const cmd = `powershell -NoProfile -Command "$shell = New-Object -ComObject Shell.Application; $bin = $shell.Namespace(10); $res = @(); foreach ($item in $bin.Items()) { $res += [PSCustomObject]@{ Name = $item.Name; Path = $item.Path; Size = [long]$item.Size } }; $res | ConvertTo-Json"`;
      const { stdout } = await execPromise(cmd, { timeout: 4000 });
      if (!stdout.trim()) {
        return { files: [], totalBytes: 0 };
      }

      const raw = JSON.parse(stdout);
      const list: Array<{ Name?: string; Path?: string; Size?: number }> = Array.isArray(raw) ? raw : [raw];
      const filtered = list.filter(
        (i) =>
          i &&
          i.Path &&
          i.Path.toUpperCase().startsWith(normDrive) &&
          (!extensionFilter || matchesExtension(i.Name || path.basename(i.Path), extensionFilter))
      );

      if (filtered.length === 0) {
        return { files: [], totalBytes: 0 };
      }

      const files: ScannedFile[] = filtered.map((i) => ({
        path: i.Path || `${normDrive}\\$Recycle.Bin`,
        name: i.Name || path.basename(i.Path || 'Recycle Bin Item'),
        sizeBytes: Number(i.Size) || 0,
        modifiedTime: Date.now(),
      }));

      const totalBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);
      return { files, totalBytes };
    } catch {
      return { files: [], totalBytes: 0 };
    }
  }
}

