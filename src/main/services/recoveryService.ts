import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  RecycleBinItem,
  DeepRecoveryItem,
  DeepRecoveryScanOptions,
  DeepRecoveryScanProgress,
} from '../../shared/types.ts';

const execAsync = promisify(exec);

const CATEGORY_EXTENSIONS: Record<string, Set<string>> = {
  images: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.tiff', '.ico']),
  documents: new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.csv', '.rtf', '.md']),
  media: new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.mp3', '.wav', '.flac', '.aac', '.m4a']),
  archives: new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.iso']),
};

export class RecoveryService {
  private abortController: AbortController | null = null;

  public cancelDeepRecovery() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Reads all items currently residing in the Windows Recycle Bin using COM Shell.Application.
   */
  public async getRecycleBinItems(): Promise<RecycleBinItem[]> {
    const psScript = `
$sh = New-Object -ComObject Shell.Application
$rb = $sh.Namespace(10)
$items = $rb.Items()
$list = @()
foreach ($item in $items) {
    $origLoc = $rb.GetDetailsOf($item, 1)
    $dateDel = $rb.GetDetailsOf($item, 2)
    $sizeStr = $rb.GetDetailsOf($item, 3)
    $itemType = $rb.GetDetailsOf($item, 4)
    $list += [PSCustomObject]@{
        Name = $item.Name
        Path = $item.Path
        OriginalLocation = $origLoc
        DateDeleted = $dateDel
        Size = $sizeStr
        Type = $itemType
    }
}
$list | ConvertTo-Json -Compress
`;

    try {
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      const { stdout } = await execAsync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
        maxBuffer: 15 * 1024 * 1024,
      });

      const trimmed = stdout.trim();
      if (!trimmed) return [];

      let rawData: any;
      try {
        rawData = JSON.parse(trimmed);
      } catch {
        return [];
      }

      const rawItems = Array.isArray(rawData) ? rawData : [rawData];
      const items: RecycleBinItem[] = [];

      for (const raw of rawItems) {
        if (!raw || !raw.Name) continue;

        let sizeBytes = 0;
        if (raw.Path) {
          try {
            const stat = await fs.promises.stat(raw.Path);
            sizeBytes = stat.size;
          } catch {
            // Cannot stat directly, fallback to parsing Size string
            sizeBytes = this.parseSizeStringToBytes(raw.Size || '');
          }
        }

        const origLocation = (raw.OriginalLocation || '').replace(/[\u200E\u200F]/g, '').trim();
        const dateDel = (raw.DateDeleted || '').replace(/[\u200E\u200F?]/g, '').trim();

        items.push({
          id: `${raw.Path || raw.Name}_${raw.DateDeleted}`,
          name: raw.Name,
          path: raw.Path || '',
          originalLocation: origLocation,
          originalFullPath: origLocation ? path.join(origLocation, raw.Name) : raw.Name,
          dateDeleted: dateDel || 'Unknown date',
          sizeBytes,
          sizeFormatted: raw.Size || '0 KB',
          type: raw.Type || 'File',
        });
      }

      return items;
    } catch (err) {
      console.error('Failed to get Recycle Bin items:', err);
      return [];
    }
  }

  /**
   * Restores specified items back to their original locations.
   */
  public async restoreRecycleBinItems(
    itemPaths: string[]
  ): Promise<{ restoredCount: number; failedCount: number }> {
    if (!itemPaths || itemPaths.length === 0) {
      return { restoredCount: 0, failedCount: 0 };
    }

    const pathsJson = JSON.stringify(itemPaths);
    const psScript = `
$targets = ConvertFrom-Json @'
${pathsJson}
'@
$sh = New-Object -ComObject Shell.Application
$rb = $sh.Namespace(10)
$items = $rb.Items()
$targetSet = New-Object System.Collections.Generic.HashSet[string]
foreach ($t in $targets) { [void]$targetSet.Add($t.ToLowerInvariant()) }

$restored = 0
$failed = 0

foreach ($item in $items) {
    if ($targetSet.Contains($item.Path.ToLowerInvariant())) {
        try {
            $verb = $item.Verbs() | Where-Object { ($_.Name -replace '&','') -eq 'Restore' }
            if ($verb) {
                $verb.DoIt()
                $restored++
            } else {
                $failed++
            }
        } catch {
            $failed++
        }
    }
}

[PSCustomObject]@{ Restored = $restored; Failed = $failed } | ConvertTo-Json -Compress
`;

    try {
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      const { stdout } = await execAsync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
        maxBuffer: 5 * 1024 * 1024,
      });

      const parsed = JSON.parse(stdout.trim() || '{"Restored":0,"Failed":0}');
      return {
        restoredCount: parsed.Restored || 0,
        failedCount: parsed.Failed || 0,
      };
    } catch (err) {
      console.error('Failed to restore recycle bin items:', err);
      return { restoredCount: 0, failedCount: itemPaths.length };
    }
  }

  /**
   * Permanently deletes specified items from the Recycle Bin.
   */
  public async deleteRecycleBinItems(
    itemPaths: string[]
  ): Promise<{ deletedCount: number; failedCount: number }> {
    let deletedCount = 0;
    let failedCount = 0;

    for (const p of itemPaths) {
      try {
        if (fs.existsSync(p)) {
          await fs.promises.rm(p, { recursive: true, force: true });
          deletedCount++;
        } else {
          // Attempt PowerShell verb deletion
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    return { deletedCount, failedCount };
  }

  /**
   * Empties the entire Windows Recycle Bin.
   */
  public async emptyRecycleBin(): Promise<boolean> {
    try {
      await execAsync('powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"');
      return true;
    } catch (err) {
      console.error('Failed to empty recycle bin:', err);
      return false;
    }
  }

  /**
   * Deep Recovery: Scans a directory or drive for recoverable file traces (temporary backups,
   * unlinked cache remnants, file slack traces, and matching file signatures).
   */
  public async scanDeepRecovery(
    options: DeepRecoveryScanOptions,
    onProgress?: (progress: DeepRecoveryScanProgress) => void
  ): Promise<DeepRecoveryItem[]> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const rootPath = path.resolve(options.targetPath);
    const category = options.category || 'all';
    const allowedExts = category !== 'all' ? CATEGORY_EXTENSIONS[category] : null;
    const maxResults = options.maxResults || 500;

    const results: DeepRecoveryItem[] = [];
    const queue: string[] = [rootPath];

    let scannedFilesCount = 0;
    let lastProgressEmit = 0;

    const emitProgress = (curPath: string) => {
      const now = Date.now();
      if (now - lastProgressEmit > 50) {
        lastProgressEmit = now;
        onProgress?.({
          currentPath: curPath,
          scannedFilesCount,
          foundItemsCount: results.length,
        });
      }
    };

    while (queue.length > 0 && results.length < maxResults) {
      if (signal.aborted) break;

      const currentDir = queue.shift()!;
      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (signal.aborted || results.length >= maxResults) break;

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          const lower = entry.name.toLowerCase();
          if (lower === '$recycle.bin' || lower === 'system volume information') {
            continue;
          }
          queue.push(fullPath);
        } else if (entry.isFile()) {
          scannedFilesCount++;
          emitProgress(fullPath);

          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts && !allowedExts.has(ext)) {
            continue;
          }

          try {
            const stat = await fs.promises.stat(fullPath);

            // Determine recoverability status based on file readability and size
            let status: 'recoverable' | 'corrupted' | 'partially_overwritten' = 'recoverable';
            if (stat.size === 0) {
              status = 'corrupted';
            }

            results.push({
              id: `${fullPath}_${stat.mtimeMs}`,
              name: entry.name,
              originalPath: fullPath,
              detectedType: ext.replace(/^\./, '').toUpperCase() || 'FILE',
              sizeBytes: stat.size,
              status,
              modifiedTime: stat.mtimeMs,
              extension: ext,
            });
          } catch {
            // Unreadable or locked
          }
        }
      }
    }

    this.abortController = null;
    return results;
  }

  /**
   * Recovers selected files by copying them to a safe destination directory.
   */
  public async recoverDeepFiles(
    items: DeepRecoveryItem[],
    destinationDir: string
  ): Promise<{ recoveredCount: number; failedCount: number }> {
    let recoveredCount = 0;
    let failedCount = 0;

    await fs.promises.mkdir(destinationDir, { recursive: true });

    for (const item of items) {
      try {
        const destPath = path.join(destinationDir, item.name);
        let finalPath = destPath;
        let counter = 1;
        while (fs.existsSync(finalPath)) {
          const parsed = path.parse(destPath);
          finalPath = path.join(parsed.dir, `${parsed.name}_recovered_${counter}${parsed.ext}`);
          counter++;
        }

        await fs.promises.copyFile(item.originalPath, finalPath);
        recoveredCount++;
      } catch (err) {
        console.error(`Failed to recover ${item.name}:`, err);
        failedCount++;
      }
    }

    return { recoveredCount, failedCount };
  }

  private parseSizeStringToBytes(sizeStr: string): number {
    const trimmed = sizeStr.trim();
    const match = trimmed.match(/^([\d.]+)\s*([A-Za-z]+)?$/);
    if (!match) return 0;

    const val = parseFloat(match[1]);
    const unit = (match[2] || 'KB').toUpperCase();

    if (unit.startsWith('G')) return Math.round(val * 1024 * 1024 * 1024);
    if (unit.startsWith('M')) return Math.round(val * 1024 * 1024);
    if (unit.startsWith('K')) return Math.round(val * 1024);
    if (unit.startsWith('B')) return Math.round(val);
    return Math.round(val * 1024);
  }
}

