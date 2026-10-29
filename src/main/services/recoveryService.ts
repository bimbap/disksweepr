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
  documents: new Set([
    '.pdf',
    '.docx',
    '.doc',
    '.xlsx',
    '.xls',
    '.pptx',
    '.ppt',
    '.txt',
    '.csv',
    '.rtf',
    '.md',
  ]),
  media: new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.mp3', '.wav', '.flac', '.aac', '.m4a']),
  archives: new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.iso']),
};

// Patterns of genuine orphaned / auto-recovery / lost-cluster file remnants
const ORPHAN_FILE_PATTERNS = [
  /^~\$.+/i, // Office AutoRecover lock/shadow remnants
  /^~WRL\d+\.tmp$/i, // Word recovery temporary document
  /\.asd$/i, // Word AutoRecover snapshot
  /\.wbk$/i, // Word backup copy
  /\.xlk$/i, // Excel backup copy
  /\.chk$/i, // CHKDSK recovered lost cluster fragment
  /\.bak$/i, // Explicit backup file
  /\.old$/i, // Old displaced file
  /\.crdownload$/i, // Unfinished browser download remnant
  /\.part$/i, // Unfinished partial file
];

export interface ParsedRecycleMetadata {
  originalPath: string;
  deletedTimeMs: number;
  sizeBytes: number;
}

/**
 * Parses a Windows $Recycle.Bin $Ixxxxxx metadata buffer (Vista/Win7 v1 or Win10/Win11 v2).
 */
export function parseRecycleBinMetadataBuffer(buf: Buffer): ParsedRecycleMetadata | null {
  if (!buf || buf.length < 28) return null;
  try {
    const version = buf.readBigUInt64LE(0);
    const sizeBytes = Number(buf.readBigUInt64LE(8));
    const filetime = buf.readBigUInt64LE(16);
    // Convert Windows FILETIME (100ns intervals since Jan 1, 1601) to Unix epoch ms
    const EPOCH_DIFF = 116444736000000000n;
    const deletedTimeMs =
      filetime > EPOCH_DIFF ? Number((filetime - EPOCH_DIFF) / 10000n) : Date.now();

    let originalPath = '';
    if (version === 2n) {
      const charCount = buf.readUInt32LE(24);
      const byteLen = Math.min(buf.length - 28, charCount * 2);
      originalPath = buf
        .subarray(28, 28 + byteLen)
        .toString('utf16le')
        .replace(/\0+$/, '');
    } else if (version === 1n) {
      originalPath = buf
        .subarray(24)
        .toString('utf16le')
        .replace(/\0+$/, '');
    } else {
      return null;
    }

    if (!originalPath) return null;
    return { originalPath, deletedTimeMs, sizeBytes };
  } catch {
    return null;
  }
}

/**
 * Parses an NTFS $MFT 1024-byte FILE record buffer for a deleted file (flags === 0x00).
 */
export function parseDeletedNtfsMftRecord(
  recordBuf: Buffer,
  recordNumber: number,
  driveLetter: string,
  bytesPerCluster: number
): DeepRecoveryItem | null {
  if (!recordBuf || recordBuf.length < 1024) return null;

  // Check "FILE" magic signature (0x454C4946)
  if (recordBuf.toString('ascii', 0, 4) !== 'FILE') return null;

  const flags = recordBuf.readUInt16LE(22);
  // In NTFS, flags === 0x00 means Deleted File (0x01 = In-Use File, 0x02 = Deleted Dir, 0x03 = In-Use Dir)
  if (flags !== 0x0000) return null;

  // Apply Update Sequence Array (USA) fixup to ensure sector integrity
  const usaOffset = recordBuf.readUInt16LE(4);
  const usaCount = recordBuf.readUInt16LE(6);
  const buf = Buffer.from(recordBuf);
  if (usaOffset > 0 && usaOffset + usaCount * 2 <= 1024 && usaCount >= 2) {
    const usn = buf.readUInt16LE(usaOffset);
    for (let i = 1; i < usaCount; i++) {
      const sectorEndOffset = i * 512 - 2;
      if (sectorEndOffset + 2 <= buf.length && buf.readUInt16LE(sectorEndOffset) === usn) {
        buf.writeUInt16LE(buf.readUInt16LE(usaOffset + i * 2), sectorEndOffset);
      }
    }
  }

  let attrOffset = buf.readUInt16LE(20);
  let fileName = '';
  let nameNamespace = -1;
  let parentRecordNum = 0;
  let modifiedTimeMs = 0;
  let fileSize = 0;
  let residentDataBase64: string | undefined;
  const dataRuns: Array<{ clusterOffset: number; clusterCount: number }> = [];

  const EPOCH_DIFF = 116444736000000000n;
  const filetimeToMs = (ft: bigint): number =>
    ft > EPOCH_DIFF ? Number((ft - EPOCH_DIFF) / 10000n) : 0;

  while (attrOffset > 0 && attrOffset + 16 <= buf.length) {
    const attrType = buf.readUInt32LE(attrOffset);
    if (attrType === 0xffffffff || attrType === 0) break;

    const attrLen = buf.readUInt32LE(attrOffset + 4);
    if (attrLen <= 0 || attrOffset + attrLen > buf.length) break;

    const nonResident = buf.readUInt8(attrOffset + 8);
    const nameLen = buf.readUInt8(attrOffset + 9);

    // 0x10 = $STANDARD_INFORMATION
    if (attrType === 0x10 && nonResident === 0) {
      const valOffset = attrOffset + buf.readUInt16LE(attrOffset + 20);
      if (valOffset + 32 <= buf.length) {
        const mtimeFt = buf.readBigUInt64LE(valOffset + 8);
        modifiedTimeMs = filetimeToMs(mtimeFt);
      }
    }

    // 0x30 = $FILE_NAME
    if (attrType === 0x30 && nonResident === 0) {
      const valOffset = attrOffset + buf.readUInt16LE(attrOffset + 20);
      const valLen = buf.readUInt32LE(attrOffset + 16);
      if (valOffset + 66 <= buf.length && valOffset + valLen <= buf.length) {
        // First 6 bytes of $FILE_NAME is parent MFT record number (48-bit little endian)
        const pLow = buf.readUInt32LE(valOffset);
        const pHigh = buf.readUInt16LE(valOffset + 4);
        const pRec = pLow + pHigh * 0x100000000;
        const fnMtimeFt = buf.readBigUInt64LE(valOffset + 16);
        const fnNameLen = buf.readUInt8(valOffset + 64);
        const fnNamespace = buf.readUInt8(valOffset + 65);
        const nameEnd = valOffset + 66 + fnNameLen * 2;
        if (nameEnd <= buf.length) {
          const candidateName = buf.subarray(valOffset + 66, nameEnd).toString('utf16le');
          // Prefer Win32 (1) or Win32&DOS (3) or POSIX (0) over DOS-8.3 (2)
          if (!fileName || fnNamespace !== 2 || nameNamespace === 2) {
            fileName = candidateName;
            nameNamespace = fnNamespace;
            parentRecordNum = pRec;
            if (!modifiedTimeMs) {
              modifiedTimeMs = filetimeToMs(fnMtimeFt);
            }
          }
        }
      }
    }

    // 0x80 = $DATA (Only unnamed default data stream: nameLen === 0)
    if (attrType === 0x80 && nameLen === 0) {
      if (nonResident === 0) {
        const valLen = buf.readUInt32LE(attrOffset + 16);
        const valOffset = attrOffset + buf.readUInt16LE(attrOffset + 20);
        if (valLen > 0 && valOffset + valLen <= buf.length) {
          fileSize = valLen;
          residentDataBase64 = buf.subarray(valOffset, valOffset + valLen).toString('base64');
        }
      } else {
        const runListOffset = attrOffset + buf.readUInt16LE(attrOffset + 32);
        const realSize = Number(buf.readBigUInt64LE(attrOffset + 48));
        fileSize = realSize;

        // Decode NTFS Data Runs (LCN/VCN runlist)
        let pos = runListOffset;
        let currentLcn = 0n;
        const attrEnd = attrOffset + attrLen;
        while (pos < attrEnd && pos < buf.length) {
          const header = buf.readUInt8(pos);
          pos++;
          if (header === 0) break;

          const lenBytes = header & 0x0f;
          const offBytes = (header >> 4) & 0x0f;
          if (lenBytes === 0 || pos + lenBytes + offBytes > attrEnd) break;

          let runLength = 0n;
          for (let i = 0; i < lenBytes; i++) {
            runLength |= BigInt(buf.readUInt8(pos + i)) << BigInt(i * 8);
          }
          pos += lenBytes;

          if (offBytes > 0) {
            let runOffset = 0n;
            for (let i = 0; i < offBytes; i++) {
              runOffset |= BigInt(buf.readUInt8(pos + i)) << BigInt(i * 8);
            }
            // Sign-extend negative relative LCN offset
            const signBit = 1n << BigInt(offBytes * 8 - 1);
            if ((runOffset & signBit) !== 0n) {
              runOffset -= 1n << BigInt(offBytes * 8);
            }
            currentLcn += runOffset;
            pos += offBytes;

            if (currentLcn > 0n && runLength > 0n) {
              dataRuns.push({
                clusterOffset: Number(currentLcn),
                clusterCount: Number(runLength),
              });
            }
          }
        }
      }
    }

    attrOffset += attrLen;
  }

  // Filter out system metadata files ($MFT, $LogFile, etc.) and empty records
  if (!fileName || fileName.startsWith('$') || fileSize <= 0) return null;

  const hasData = Boolean(residentDataBase64) || dataRuns.length > 0;
  const ext = path.extname(fileName).toLowerCase();
  const cleanDrive = driveLetter.replace(/[:\\/]+$/, '').toUpperCase() + ':';
  const reconstructedPath =
    parentRecordNum === 5
      ? `${cleanDrive}\\${fileName}`
      : `${cleanDrive}\\MFT#${parentRecordNum}\\${fileName}`;

  return {
    id: `mft_${cleanDrive}_${recordNumber}_${modifiedTimeMs}`,
    name: fileName,
    originalPath: reconstructedPath,
    detectedType: ext.replace(/^\./, '').toUpperCase() || 'FILE',
    sizeBytes: fileSize,
    status: hasData ? 'recoverable' : 'corrupted',
    modifiedTime: modifiedTimeMs || undefined,
    extension: ext,
    recoverySource: 'ntfs_mft',
    sourcePath: `\\\\.\\${cleanDrive}`,
    mftRecordNumber: recordNumber,
    bytesPerCluster,
    dataRuns: dataRuns.length > 0 ? dataRuns : undefined,
    residentDataBase64,
  };
}

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
      await execAsync(
        'powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"'
      );
      return true;
    } catch (err) {
      console.error('Failed to empty recycle bin:', err);
      return false;
    }
  }

  /**
   * Deep Recovery Engine:
   * Never copies normal live user files! Scans exclusively for genuinely deleted / orphaned data:
   * 1. Raw NTFS Master File Table ($MFT) Deleted Records (flags === 0x00) on the target drive (`\\.\X:`)
   * 2. Unindexed / Orphaned $Recycle.Bin `$R*` & `$I*` remnants across all SIDs on the target drive
   * 3. Volume Shadow Copy (`\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy*`) files that were deleted from the live disk
   * 4. Lost cluster fragments (`found.000\*.chk`) and orphaned application recovery backups (`~$*`, `.asd`, `.wbk`, `.bak`, `.crdownload`, `.part`)
   */
  public async scanDeepRecovery(
    options: DeepRecoveryScanOptions,
    onProgress?: (progress: DeepRecoveryScanProgress) => void
  ): Promise<DeepRecoveryItem[]> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const rootPath = path.resolve(options.targetPath);
    const parsedRoot = path.parse(rootPath);
    const driveRoot = parsedRoot.root || `${rootPath.slice(0, 2)}\\`;
    const driveLetter = driveRoot.replace(/[\\/]+$/, ''); // e.g. "M:"
    const isDriveRootScan =
      rootPath.toLowerCase() === path.resolve(driveRoot).toLowerCase();

    const category = options.category || 'all';
    const allowedExts = category !== 'all' ? CATEGORY_EXTENSIONS[category] : null;
    const maxResults = options.maxResults || 500;

    const results: DeepRecoveryItem[] = [];
    const seenKeys = new Set<string>();
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

    const matchesCategory = (ext: string): boolean => {
      if (!allowedExts) return true;
      return allowedExts.has(ext.toLowerCase());
    };

    // Exclude any items that are currently sitting in the active Recycle Bin (Tab 1)
    // so Deep Recovery (Tab 2) strictly lists permanently deleted / unindexed remnants
    const activeRecyclePaths = new Set<string>();
    const activeRecycleOrigPaths = new Set<string>();
    try {
      const activeBinItems = await this.getRecycleBinItems();
      for (const rbItem of activeBinItems) {
        if (rbItem.path) activeRecyclePaths.add(path.resolve(rbItem.path).toLowerCase());
        if (rbItem.originalFullPath) {
          activeRecycleOrigPaths.add(path.resolve(rbItem.originalFullPath).toLowerCase());
        }
      }
    } catch {
      // Ignore error fetching active bin items
    }

    // =========================================================================
    // STAGE 1: Raw NTFS $MFT Deleted File Record Scanner (`\\.\X:`)
    // =========================================================================
    if (!signal.aborted && results.length < maxResults) {
      await this.scanNtfsMftDeletedRecords(
        driveLetter,
        isDriveRootScan ? null : rootPath,
        matchesCategory,
        maxResults,
        signal,
        results,
        seenKeys,
        activeRecycleOrigPaths,
        (curPath, count) => {
          scannedFilesCount += count;
          emitProgress(curPath);
        }
      );
    }

    // =========================================================================
    // STAGE 2: Orphaned $Recycle.Bin $R Remnants (ONLY items NOT in active Recycle Bin)
    // =========================================================================
    if (!signal.aborted && results.length < maxResults) {
      const recycleRoot = path.join(driveRoot, '$Recycle.Bin');
      await this.scanDeepRecycleBinRemnants(
        recycleRoot,
        isDriveRootScan ? null : rootPath,
        matchesCategory,
        maxResults,
        signal,
        results,
        seenKeys,
        activeRecyclePaths,
        (curPath) => {
          scannedFilesCount++;
          emitProgress(curPath);
        }
      );
    }

    // =========================================================================
    // STAGE 3: Lost Cluster Fragments (found.000) & Orphaned Recovery Remnants
    // =========================================================================
    if (!signal.aborted && results.length < maxResults) {
      await this.scanOrphanFragments(
        rootPath,
        matchesCategory,
        maxResults,
        signal,
        results,
        seenKeys,
        (curPath) => {
          scannedFilesCount++;
          emitProgress(curPath);
        }
      );
    }

    this.abortController = null;
    return results;
  }

  /**
   * Opens raw NTFS volume `\\.\X:` (requires Administrator privileges) and reads the Master File Table ($MFT)
   * to find deleted file records (Flags == 0x0000) whose clusters are still recoverable on disk.
   * Uses a two-pass strategy:
   * - Pass 1: Scans MFT runs to build the directory tree map (recordNumber -> {name, parent}) AND collect deleted file records.
   * - Pass 2: Resolves full folder paths for all collected deleted records using the complete directory map!
   */
  private async scanNtfsMftDeletedRecords(
    driveLetter: string,
    scopePrefix: string | null,
    matchesCategory: (ext: string) => boolean,
    maxResults: number,
    signal: AbortSignal,
    results: DeepRecoveryItem[],
    seenKeys: Set<string>,
    activeRecycleOrigPaths: Set<string>,
    onTick: (curPath: string, recordsScanned: number) => void
  ): Promise<void> {
    const cleanDrive = driveLetter.replace(/[:\\/]+$/, '').toUpperCase() + ':';
    const volumeDevicePath = `\\\\.\\${cleanDrive}`;

    let fd: number | null = null;
    try {
      fd = await new Promise<number>((resolve, reject) => {
        fs.open(volumeDevicePath, 'r', (err, handle) => {
          if (err) reject(err);
          else resolve(handle);
        });
      });

      // Read NTFS Boot Sector (4096-byte aligned buffer for raw volume compatibility)
      const bootSector = Buffer.alloc(4096);
      const { bytesRead: bootRead } = await this.readRawBytes(fd, bootSector, 0, 4096, 0);
      if (bootRead < 512) return;

      const oemId = bootSector.toString('ascii', 3, 7);
      if (oemId !== 'NTFS') return;

      const bytesPerSector = bootSector.readUInt16LE(11);
      const sectorsPerCluster = bootSector.readUInt8(13);
      const bytesPerCluster = bytesPerSector * sectorsPerCluster;
      const mftStartCluster = Number(bootSector.readBigUInt64LE(48));

      if (bytesPerCluster <= 0 || mftStartCluster <= 0) return;

      const mftByteOffset = mftStartCluster * bytesPerCluster;

      // Read Record 0 ($MFT itself) using 4096-byte aligned buffer
      const mftRecord0Buf = Buffer.alloc(4096);
      const { bytesRead: rec0Read } = await this.readRawBytes(
        fd,
        mftRecord0Buf,
        0,
        4096,
        mftByteOffset
      );
      if (rec0Read < 1024 || mftRecord0Buf.toString('ascii', 0, 4) !== 'FILE') return;

      const mftRecord0 = mftRecord0Buf.subarray(0, 1024);
      const mftRuns = this.extractMftDataRuns(mftRecord0);
      const runsToScan =
        mftRuns.length > 0
          ? mftRuns
          : [{ clusterOffset: mftStartCluster, clusterCount: 32768 }];

      const dirMap = new Map<number, { name: string; parent: number }>();
      dirMap.set(5, { name: cleanDrive, parent: 5 });

      const rawDeletedCandidates: DeepRecoveryItem[] = [];
      const RECORDS_PER_BATCH = 512; // 512 KB (4096-byte aligned) per batch read
      const batchBuf = Buffer.alloc(RECORDS_PER_BATCH * 1024);
      let globalRecordIndex = 0;
      const MAX_RECORDS_TO_SCAN = 250000;

      for (const run of runsToScan) {
        if (signal.aborted || globalRecordIndex >= MAX_RECORDS_TO_SCAN) {
          break;
        }

        const runStartByte = run.clusterOffset * bytesPerCluster;
        const runTotalBytes = run.clusterCount * bytesPerCluster;
        const totalRecordsInRun = Math.floor(runTotalBytes / 1024);

        for (let recInRun = 0; recInRun < totalRecordsInRun; recInRun += RECORDS_PER_BATCH) {
          if (signal.aborted || globalRecordIndex >= MAX_RECORDS_TO_SCAN) {
            break;
          }

          const recordsToRead = Math.min(RECORDS_PER_BATCH, totalRecordsInRun - recInRun);
          // Align read length to 4096 bytes
          const bytesToRead = Math.ceil((recordsToRead * 1024) / 4096) * 4096;
          if (bytesToRead > batchBuf.length) break;
          const readPos = runStartByte + recInRun * 1024;

          let bytesRead = 0;
          try {
            const res = await this.readRawBytes(fd, batchBuf, 0, bytesToRead, readPos);
            bytesRead = res.bytesRead;
          } catch {
            break;
          }
          if (bytesRead < 1024) break;

          const actualRecords = Math.min(recordsToRead, Math.floor(bytesRead / 1024));
          onTick(
            `${cleanDrive}\\$MFT (Scanning sector record #${globalRecordIndex.toLocaleString()})`,
            actualRecords
          );

          for (let i = 0; i < actualRecords; i++) {
            const currentRecNum = globalRecordIndex + i;
            if (currentRecNum < 24) continue; // Skip NTFS reserved metadata records (0..23)

            const slice = batchBuf.subarray(i * 1024, (i + 1) * 1024);
            if (slice.toString('ascii', 0, 4) !== 'FILE') continue;

            const flags = slice.readUInt16LE(22);

            // Always cache directory names (0x03 = Active Dir, 0x02 = Deleted Dir) so Pass 2 can resolve any parent folder!
            if ((flags === 0x0003 || flags === 0x0002) && dirMap.size < 100000) {
              const dirInfo = this.extractQuickFileNameAndParent(slice);
              if (dirInfo && !dirInfo.name.startsWith('$')) {
                dirMap.set(currentRecNum, dirInfo);
              }
              continue;
            }

            // 0x0000 = Permanently Deleted File Record!
            if (flags === 0x0000 && rawDeletedCandidates.length < maxResults * 4) {
              const parsedItem = parseDeletedNtfsMftRecord(
                slice,
                currentRecNum,
                cleanDrive,
                bytesPerCluster
              );
              if (!parsedItem) continue;
              if (!matchesCategory(parsedItem.extension)) continue;

              // Skip Recycle Bin metadata headers ($Ixxxxxx)
              if (parsedItem.name.startsWith('$I') && parsedItem.name.length === 8) continue;

              rawDeletedCandidates.push(parsedItem);
            }
          }

          globalRecordIndex += actualRecords;
        }
      }

      // Pass 2: Resolve complete parent folder paths now that dirMap has all directories across the MFT
      // Sort most recently modified/deleted first so recently deleted files appear at the top
      rawDeletedCandidates.sort((a, b) => (b.modifiedTime || 0) - (a.modifiedTime || 0));

      for (const candidate of rawDeletedCandidates) {
        if (results.length >= maxResults) break;

        const resolvedParent = this.resolveParentPathFromMft(
          candidate.originalPath,
          dirMap,
          cleanDrive
        );
        candidate.originalPath = path.join(resolvedParent, candidate.name);

        // Skip internal browser/system temp cache noise unless user specifically scanned that folder
        const lowerOrig = candidate.originalPath.toLowerCase();
        if (
          !scopePrefix &&
          (lowerOrig.includes('\\appdata\\local\\temp\\') ||
            lowerOrig.includes('\\cache\\cache_data\\') ||
            lowerOrig.includes('\\code cache\\') ||
            lowerOrig.includes('\\gpucache\\') ||
            lowerOrig.includes('\\$recycle.bin\\'))
        ) {
          continue;
        }

        if (scopePrefix && !lowerOrig.startsWith(scopePrefix.toLowerCase())) {
          continue;
        }

        // Skip if a live file or active Recycle Bin item already exists for this path
        if (fs.existsSync(candidate.originalPath)) continue;
        if (activeRecycleOrigPaths.has(lowerOrig)) continue;

        const dedupKey = `${lowerOrig}_${candidate.sizeBytes}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        results.push(candidate);
      }
    } catch {
      // Raw volume access requires Administrator privileges or NTFS filesystem; silently continue to fallback scanners
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // Ignore close error
        }
      }
    }
  }

  private extractMftDataRuns(
    mftRecord0: Buffer
  ): Array<{ clusterOffset: number; clusterCount: number }> {
    const runs: Array<{ clusterOffset: number; clusterCount: number }> = [];
    let attrOffset = mftRecord0.readUInt16LE(20);
    while (attrOffset > 0 && attrOffset + 16 <= mftRecord0.length) {
      const attrType = mftRecord0.readUInt32LE(attrOffset);
      if (attrType === 0xffffffff || attrType === 0) break;
      const attrLen = mftRecord0.readUInt32LE(attrOffset + 4);
      if (attrLen <= 0 || attrOffset + attrLen > mftRecord0.length) break;

      const nonResident = mftRecord0.readUInt8(attrOffset + 8);
      if (attrType === 0x80 && nonResident === 1) {
        const runListOffset = attrOffset + mftRecord0.readUInt16LE(attrOffset + 32);
        let pos = runListOffset;
        let currentLcn = 0n;
        const attrEnd = attrOffset + attrLen;
        while (pos < attrEnd && pos < mftRecord0.length) {
          const header = mftRecord0.readUInt8(pos);
          pos++;
          if (header === 0) break;
          const lenBytes = header & 0x0f;
          const offBytes = (header >> 4) & 0x0f;
          if (lenBytes === 0 || pos + lenBytes + offBytes > attrEnd) break;

          let runLength = 0n;
          for (let i = 0; i < lenBytes; i++) {
            runLength |= BigInt(mftRecord0.readUInt8(pos + i)) << BigInt(i * 8);
          }
          pos += lenBytes;

          if (offBytes > 0) {
            let runOffset = 0n;
            for (let i = 0; i < offBytes; i++) {
              runOffset |= BigInt(mftRecord0.readUInt8(pos + i)) << BigInt(i * 8);
            }
            const signBit = 1n << BigInt(offBytes * 8 - 1);
            if ((runOffset & signBit) !== 0n) {
              runOffset -= 1n << BigInt(offBytes * 8);
            }
            currentLcn += runOffset;
            pos += offBytes;
            if (currentLcn > 0n && runLength > 0n) {
              runs.push({
                clusterOffset: Number(currentLcn),
                clusterCount: Number(runLength),
              });
            }
          }
        }
        break;
      }
      attrOffset += attrLen;
    }
    return runs;
  }

  private extractQuickFileNameAndParent(
    recordSlice: Buffer
  ): { name: string; parent: number } | null {
    let attrOffset = recordSlice.readUInt16LE(20);
    let bestName = '';
    let bestParent = 5;
    let bestNs = -1;

    while (attrOffset > 0 && attrOffset + 16 <= recordSlice.length) {
      const attrType = recordSlice.readUInt32LE(attrOffset);
      if (attrType === 0xffffffff || attrType === 0) break;
      const attrLen = recordSlice.readUInt32LE(attrOffset + 4);
      if (attrLen <= 0 || attrOffset + attrLen > recordSlice.length) break;

      const nonResident = recordSlice.readUInt8(attrOffset + 8);
      if (attrType === 0x30 && nonResident === 0) {
        const valOffset = attrOffset + recordSlice.readUInt16LE(attrOffset + 20);
        if (valOffset + 66 <= recordSlice.length) {
          const pLow = recordSlice.readUInt32LE(valOffset);
          const pHigh = recordSlice.readUInt16LE(valOffset + 4);
          const pRec = pLow + pHigh * 0x100000000;
          const fnLen = recordSlice.readUInt8(valOffset + 64);
          const fnNs = recordSlice.readUInt8(valOffset + 65);
          const nameEnd = valOffset + 66 + fnLen * 2;
          if (nameEnd <= recordSlice.length) {
            const name = recordSlice.subarray(valOffset + 66, nameEnd).toString('utf16le');
            if (!bestName || fnNs !== 2 || bestNs === 2) {
              bestName = name;
              bestParent = pRec;
              bestNs = fnNs;
            }
          }
        }
      }
      attrOffset += attrLen;
    }

    return bestName ? { name: bestName, parent: bestParent } : null;
  }

  private resolveParentPathFromMft(
    initialReconstructedPath: string,
    dirMap: Map<number, { name: string; parent: number }>,
    cleanDrive: string
  ): string {
    const match = initialReconstructedPath.match(/MFT#(\d+)/);
    if (!match) return path.dirname(initialReconstructedPath);

    let curRec = parseInt(match[1], 10);
    const segments: string[] = [];
    let depth = 0;

    while (curRec !== 5 && depth < 12) {
      const info = dirMap.get(curRec);
      if (!info) {
        segments.unshift(`[DeletedFolder_${curRec}]`);
        break;
      }
      segments.unshift(info.name);
      if (info.parent === curRec) break;
      curRec = info.parent;
      depth++;
    }

    return `${cleanDrive}\\${segments.join('\\')}`;
  }

  /**
   * Scans all SID subdirectories inside `<Drive>:\$Recycle.Bin` ONLY for orphaned `$R*` payloads
   * that are NOT present in the active Windows Recycle Bin (Tab 1).
   */
  private async scanDeepRecycleBinRemnants(
    recycleRoot: string,
    scopePrefix: string | null,
    matchesCategory: (ext: string) => boolean,
    maxResults: number,
    signal: AbortSignal,
    results: DeepRecoveryItem[],
    seenKeys: Set<string>,
    activeRecyclePaths: Set<string>,
    onTick: (curPath: string) => void
  ): Promise<void> {
    if (!fs.existsSync(recycleRoot)) return;

    const queue: string[] = [recycleRoot];
    while (queue.length > 0 && results.length < maxResults) {
      if (signal.aborted) break;
      const curDir = queue.shift()!;

      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(curDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (signal.aborted || results.length >= maxResults) break;
        const fullPath = path.join(curDir, entry.name);

        if (entry.isDirectory()) {
          queue.push(fullPath);
          continue;
        }

        if (!entry.isFile() || !entry.name.startsWith('$R')) continue;

        // Skip if this item is already displayed in Tab 1 (Active Recycle Bin Manager)
        if (activeRecyclePaths.has(path.resolve(fullPath).toLowerCase())) {
          continue;
        }

        onTick(fullPath);

        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.size <= 0) continue;

          // Look for companion $Ixxxxxx metadata file to get original filename & path
          const iFileName = '$I' + entry.name.slice(2);
          const iFilePath = path.join(curDir, iFileName);
          let origPath = fullPath;
          let displayName = entry.name;
          let deletedTime = stat.mtimeMs;

          if (fs.existsSync(iFilePath)) {
            const iBuf = await fs.promises.readFile(iFilePath);
            const meta = parseRecycleBinMetadataBuffer(iBuf);
            if (meta && meta.originalPath) {
              origPath = meta.originalPath;
              displayName = path.basename(meta.originalPath);
              deletedTime = meta.deletedTimeMs || stat.mtimeMs;
            }
          }

          const ext = path.extname(displayName).toLowerCase();
          if (!matchesCategory(ext)) continue;

          if (scopePrefix && !origPath.toLowerCase().startsWith(scopePrefix.toLowerCase())) {
            continue;
          }

          const dedupKey = `${origPath.toLowerCase()}_${stat.size}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);

          results.push({
            id: `rb_remnant_${fullPath}_${stat.mtimeMs}`,
            name: displayName,
            originalPath: origPath,
            detectedType: ext.replace(/^\./, '').toUpperCase() || 'FILE',
            sizeBytes: stat.size,
            status: 'recoverable',
            modifiedTime: deletedTime,
            extension: ext,
            recoverySource: 'recycle_remnant',
            sourcePath: fullPath,
          });
        } catch {
          // Skip unreadable entry
        }
      }
    }
  }

  /**
   * Scans for genuine orphaned fragments (`found.000\*.chk`, Office AutoRecover `~$*`, `.asd`, `.wbk`, `.bak`, `.crdownload`, `.part`)
   * without ever indexing normal active user files.
   */
  private async scanOrphanFragments(
    rootPath: string,
    matchesCategory: (ext: string) => boolean,
    maxResults: number,
    signal: AbortSignal,
    results: DeepRecoveryItem[],
    seenKeys: Set<string>,
    onTick: (curPath: string) => void
  ): Promise<void> {
    const queue: Array<{ dir: string; depth: number; inFoundCluster: boolean }> = [
      { dir: rootPath, depth: 0, inFoundCluster: false },
    ];
    const MAX_DEPTH = 4;

    while (queue.length > 0 && results.length < maxResults) {
      if (signal.aborted) break;
      const { dir, depth, inFoundCluster } = queue.shift()!;

      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (signal.aborted || results.length >= maxResults) break;
        const fullPath = path.join(dir, entry.name);
        const lowerName = entry.name.toLowerCase();

        if (entry.isDirectory()) {
          if (
            lowerName === '$recycle.bin' ||
            lowerName === 'system volume information' ||
            lowerName === 'windows' ||
            lowerName === 'program files' ||
            lowerName === 'program files (x86)' ||
            lowerName === 'node_modules' ||
            lowerName === '.git'
          ) {
            continue;
          }
          const isFoundDir = /^found\.\d+$/i.test(entry.name) || inFoundCluster;
          if (depth < MAX_DEPTH || isFoundDir) {
            queue.push({ dir: fullPath, depth: depth + 1, inFoundCluster: isFoundDir });
          }
          continue;
        }

        if (!entry.isFile()) continue;

        const isOrphanPattern =
          inFoundCluster || ORPHAN_FILE_PATTERNS.some((rx) => rx.test(entry.name));
        if (!isOrphanPattern) continue;

        onTick(fullPath);

        try {
          const stat = await fs.promises.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();

          // Determine underlying extension for .bak / .old / .crdownload / .part (e.g. "report.pdf.bak" -> ".pdf")
          const stemName = entry.name.replace(/\.(bak|old|crdownload|part|tmp)$/i, '');
          const effectiveExt = path.extname(stemName).toLowerCase() || ext;

          if (!matchesCategory(effectiveExt) && !matchesCategory(ext)) continue;

          const dedupKey = `${fullPath.toLowerCase()}_${stat.size}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);

          results.push({
            id: `orphan_${fullPath}_${stat.mtimeMs}`,
            name: entry.name,
            originalPath: fullPath,
            detectedType: (effectiveExt || ext).replace(/^\./, '').toUpperCase() || 'FRAGMENT',
            sizeBytes: stat.size,
            status: stat.size > 0 ? 'recoverable' : 'corrupted',
            modifiedTime: stat.mtimeMs,
            extension: effectiveExt || ext,
            recoverySource: 'orphan_fragment',
            sourcePath: fullPath,
          });
        } catch {
          // Ignore unreadable
        }
      }
    }
  }

  /**
   * Recovers selected deleted items to `destinationDir`:
   * - For `ntfs_mft` records: reconstructs the deleted file directly from raw disk clusters (`\\.\X:`) or resident MFT bytes!
   * - For `recycle_remnant` / `orphan_fragment`: copies the physical remnant payload (`sourcePath`) and restores its original filename.
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
        const cleanFileName = item.name.replace(/[<>:"/\\|?*]+/g, '_');
        const destPath = path.join(destinationDir, cleanFileName);
        let finalPath = destPath;
        let counter = 1;
        while (fs.existsSync(finalPath)) {
          const parsed = path.parse(destPath);
          finalPath = path.join(parsed.dir, `${parsed.name}_recovered_${counter}${parsed.ext}`);
          counter++;
        }

        if (item.recoverySource === 'ntfs_mft') {
          const ok = await this.recoverFromNtfsMft(item, finalPath);
          if (ok) recoveredCount++;
          else failedCount++;
        } else {
          const physicalSource = item.sourcePath || item.originalPath;
          await fs.promises.copyFile(physicalSource, finalPath);
          recoveredCount++;
        }
      } catch (err) {
        console.error(`Failed to recover ${item.name}:`, err);
        failedCount++;
      }
    }

    return { recoveredCount, failedCount };
  }

  /**
   * Reconstructs a permanently deleted NTFS file by reading its Resident Data or Non-Resident Cluster Data Runs
   * directly from the raw volume handle (`\\.\X:`).
   */
  private async recoverFromNtfsMft(item: DeepRecoveryItem, finalPath: string): Promise<boolean> {
    if (item.residentDataBase64) {
      const buf = Buffer.from(item.residentDataBase64, 'base64');
      await fs.promises.writeFile(finalPath, buf);
      return true;
    }

    if (!item.dataRuns || item.dataRuns.length === 0 || !item.sourcePath || !item.bytesPerCluster) {
      return false;
    }

    let volFd: number | null = null;
    let outFd: number | null = null;

    try {
      volFd = await new Promise<number>((resolve, reject) => {
        fs.open(item.sourcePath!, 'r', (err, handle) => {
          if (err) reject(err);
          else resolve(handle);
        });
      });

      outFd = await new Promise<number>((resolve, reject) => {
        fs.open(finalPath, 'w', (err, handle) => {
          if (err) reject(err);
          else resolve(handle);
        });
      });

      let remainingBytes = item.sizeBytes;
      const bytesPerCluster = item.bytesPerCluster;
      const CHUNK_SIZE = 1024 * 1024; // 1 MB read buffer
      const chunkBuf = Buffer.alloc(CHUNK_SIZE);

      for (const run of item.dataRuns) {
        if (remainingBytes <= 0) break;

        let diskOffset = run.clusterOffset * bytesPerCluster;
        let runBytesLeft = run.clusterCount * bytesPerCluster;

        while (runBytesLeft > 0 && remainingBytes > 0) {
          // Sector reads on raw volume handles must be aligned to cluster/sector multiples
          const alignedReadLen = Math.min(CHUNK_SIZE, runBytesLeft);
          const { bytesRead } = await this.readRawBytes(
            volFd,
            chunkBuf,
            0,
            alignedReadLen,
            diskOffset
          );
          if (bytesRead <= 0) break;

          const bytesToWrite = Math.min(bytesRead, remainingBytes);
          await new Promise<void>((resolve, reject) => {
            fs.write(outFd!, chunkBuf, 0, bytesToWrite, null, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          diskOffset += bytesRead;
          runBytesLeft -= bytesRead;
          remainingBytes -= bytesToWrite;
        }
      }

      return true;
    } catch (err) {
      console.error('Raw NTFS sector recovery failed:', err);
      return false;
    } finally {
      if (outFd !== null) {
        try {
          fs.closeSync(outFd);
        } catch {}
      }
      if (volFd !== null) {
        try {
          fs.closeSync(volFd);
        } catch {}
      }
    }
  }

  private readRawBytes(
    fd: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ): Promise<{ bytesRead: number; buffer: Buffer }> {
    return new Promise((resolve, reject) => {
      fs.read(fd, buffer, offset, length, position, (err, bytesRead, buf) => {
        if (err) reject(err);
        else resolve({ bytesRead, buffer: buf });
      });
    });
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
