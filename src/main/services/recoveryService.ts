import fs from 'fs';
import os from 'os';
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
  images: new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.bmp',
    '.svg',
    '.tiff',
    '.tif',
    '.ico',
    '.heic',
    '.raw',
    '.psd',
    '.ai',
  ]),
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
    '.odt',
    '.ods',
    '.odp',
    '.epub',
    '.json',
    '.xml',
    '.sql',
  ]),
  media: new Set([
    '.mp4',
    '.mkv',
    '.avi',
    '.mov',
    '.wmv',
    '.webm',
    '.flv',
    '.m4v',
    '.mp3',
    '.wav',
    '.flac',
    '.aac',
    '.m4a',
    '.ogg',
    '.opus',
    '.wma',
  ]),
  archives: new Set([
    '.zip',
    '.rar',
    '.7z',
    '.tar',
    '.gz',
    '.tgz',
    '.bz2',
    '.tbz2',
    '.xz',
    '.txz',
    '.zst',
    '.iso',
    '.cab',
    '.wim',
    '.apk',
    '.jar',
    '.nupkg',
    '.vsix',
    '.dmg',
    '.img',
    '.vhd',
    '.vhdx',
  ]),
};

// Patterns of genuine orphaned / auto-recovery / lost-cluster file remnants (strictly NOT normal .bak/.old files!)
const ORPHAN_FILE_PATTERNS = [
  /^~\$.+/i, // Office AutoRecover lock/shadow remnants
  /^~WRL\d+\.tmp$/i, // Word recovery temporary document
  /\.asd$/i, // Word AutoRecover snapshot
  /\.wbk$/i, // Word backup copy
  /\.xlk$/i, // Excel backup copy
  /\.chk$/i, // CHKDSK recovered lost cluster fragment
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
 * Also supports fallback size calculation from $FILE_NAME (0x30) or cluster run counts when
 * Windows resets the $DATA realSize field on deletion.
 */
export function parseDeletedNtfsMftRecord(
  recordBuf: Buffer,
  recordNumber: number,
  driveLetter: string,
  bytesPerCluster: number
): DeepRecoveryItem | null {
  if (!recordBuf || recordBuf.length < 1024) return null;
  if (recordBuf.toString('ascii', 0, 4) !== 'FILE') return null;

  const flags = recordBuf.readUInt16LE(22);
  // 0x0000 = Deleted File
  if (flags !== 0x0000) return null;

  // Apply Update Sequence Array (USA) fixup
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
  let fnRealSize = 0;
  let fnAllocSize = 0;
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
        const pLow = buf.readUInt32LE(valOffset);
        const pHigh = buf.readUInt16LE(valOffset + 4);
        const pRec = pLow + pHigh * 0x100000000;
        const fnMtimeFt = buf.readBigUInt64LE(valOffset + 16);
        const allocSz = Number(buf.readBigUInt64LE(valOffset + 40));
        const realSz = Number(buf.readBigUInt64LE(valOffset + 48));
        const fnNameLen = buf.readUInt8(valOffset + 64);
        const fnNamespace = buf.readUInt8(valOffset + 65);
        const nameEnd = valOffset + 66 + fnNameLen * 2;
        if (nameEnd <= buf.length) {
          const candidateName = buf.subarray(valOffset + 66, nameEnd).toString('utf16le');
          if (!fileName || fnNamespace !== 2 || nameNamespace === 2) {
            fileName = candidateName;
            nameNamespace = fnNamespace;
            parentRecordNum = pRec;
            if (realSz > 0) fnRealSize = realSz;
            if (allocSz > 0) fnAllocSize = allocSz;
            if (!modifiedTimeMs) {
              modifiedTimeMs = filetimeToMs(fnMtimeFt);
            }
          }
        }
      }
    }

    // 0x80 = $DATA (Default unnamed stream)
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
        const allocSize = Number(buf.readBigUInt64LE(attrOffset + 40));
        const realSize = Number(buf.readBigUInt64LE(attrOffset + 48));
        fileSize = realSize > 0 ? realSize : allocSize;

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

  const totalRunBytes = dataRuns.reduce(
    (acc, r) => acc + r.clusterCount * (bytesPerCluster || 4096),
    0
  );
  if (fileSize <= 0) {
    fileSize = fnRealSize > 0 ? fnRealSize : fnAllocSize > 0 ? fnAllocSize : totalRunBytes;
  }

  if (!fileName || (fileName.startsWith('$') && !fileName.startsWith('$R')) || fileSize <= 0) {
    return null;
  }

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

/**
 * Native C# P/Invoke engine for reading raw NTFS volumes (`\\.\X:`) and scanning the entire $MFT.
 * Bypasses Node.js libuv `fs.open` device limitations by calling Win32 `CreateFileW`, `SetFilePointerEx`, and `ReadFile` directly.
 * Also correlates deleted `$Ixxxxxx` Recycle Bin metadata records with deleted `$Rxxxxxx` payload records
 * so files emptied from the Recycle Bin recover their true original filenames and sizes!
 */
const CSHARP_MFT_ENGINE = `
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class NtfsMftEngine {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetFilePointerEx(
        SafeFileHandle hFile,
        long liDistanceToMove,
        out long lpNewFilePointer,
        uint dwMoveMethod);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadFile(
        SafeFileHandle hFile,
        byte[] lpBuffer,
        uint nNumberOfBytesToRead,
        out uint lpNumberOfBytesRead,
        IntPtr lpOverlapped);

    private const uint GENERIC_READ = 0x80000000;
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint FILE_SHARE_DELETE = 0x00000004;
    private const uint OPEN_EXISTING = 3;

    public class DataRun {
        public long ClusterOffset;
        public long ClusterCount;
    }

    public class DirNode {
        public string Name;
        public long Parent;
    }

    public class RecycleMeta {
        public string OriginalPath;
        public long SizeBytes;
        public long DeletedMs;
    }

    public class DeletedCandidate {
        public long RecordNum;
        public string Name;
        public long ParentRecord;
        public long SizeBytes;
        public long ModifiedMs;
        public string ResidentBase64;
        public List<DataRun> Runs = new List<DataRun>();
    }

    private static bool ReadSectorAligned(SafeFileHandle handle, long byteOffset, byte[] buffer, int count, out uint bytesRead) {
        bytesRead = 0;
        long newPos;
        if (!SetFilePointerEx(handle, byteOffset, out newPos, 0)) return false;
        return ReadFile(handle, buffer, (uint)count, out bytesRead, IntPtr.Zero);
    }

    private static void ApplyUsaFixup(byte[] rec, int offset) {
        ushort usaOffset = BitConverter.ToUInt16(rec, offset + 4);
        ushort usaCount = BitConverter.ToUInt16(rec, offset + 6);
        if (usaOffset > 0 && usaOffset + usaCount * 2 <= 1024 && usaCount >= 2) {
            ushort usn = BitConverter.ToUInt16(rec, offset + usaOffset);
            for (int i = 1; i < usaCount; i++) {
                int secEnd = offset + i * 512 - 2;
                if (BitConverter.ToUInt16(rec, secEnd) == usn) {
                    ushort fix = BitConverter.ToUInt16(rec, offset + usaOffset + i * 2);
                    rec[secEnd] = (byte)(fix & 0xFF);
                    rec[secEnd + 1] = (byte)((fix >> 8) & 0xFF);
                }
            }
        }
    }

    private static long FiletimeToMs(ulong ft) {
        const ulong EPOCH_DIFF = 116444736000000000UL;
        if (ft <= EPOCH_DIFF) return 0;
        return (long)((ft - EPOCH_DIFF) / 10000UL);
    }

    private static List<DataRun> DecodeDataRuns(byte[] buf, int startPos, int endPos) {
        List<DataRun> runs = new List<DataRun>();
        int pos = startPos;
        long currentLcn = 0;
        while (pos < endPos) {
            byte header = buf[pos++];
            if (header == 0) break;
            int lenBytes = header & 0x0F;
            int offBytes = (header >> 4) & 0x0F;
            if (lenBytes == 0 || pos + lenBytes + offBytes > endPos) break;

            long runLen = 0;
            for (int i = 0; i < lenBytes; i++) {
                runLen |= ((long)buf[pos + i]) << (i * 8);
            }
            pos += lenBytes;

            if (offBytes > 0) {
                long runOff = 0;
                for (int i = 0; i < offBytes; i++) {
                    runOff |= ((long)buf[pos + i]) << (i * 8);
                }
                long signBit = 1L << (offBytes * 8 - 1);
                if ((runOff & signBit) != 0) {
                    runOff -= (1L << (offBytes * 8));
                }
                currentLcn += runOff;
                pos += offBytes;

                if (currentLcn > 0 && runLen > 0) {
                    runs.Add(new DataRun { ClusterOffset = currentLcn, ClusterCount = runLen });
                }
            } else {
                // Sparse run
            }
        }
        return runs;
    }

    private static RecycleMeta ParseRecycleMetaBytes(byte[] data) {
        if (data == null || data.Length < 28) return null;
        try {
            ulong ver = BitConverter.ToUInt64(data, 0);
            long sz = (long)BitConverter.ToUInt64(data, 8);
            ulong ft = BitConverter.ToUInt64(data, 16);
            long delMs = FiletimeToMs(ft);
            string orig = "";
            if (ver == 2UL) {
                int charCount = (int)BitConverter.ToUInt32(data, 24);
                int byteLen = Math.Min(data.Length - 28, charCount * 2);
                if (byteLen > 0) orig = Encoding.Unicode.GetString(data, 28, byteLen).TrimEnd('\\0');
            } else if (ver == 1UL) {
                orig = Encoding.Unicode.GetString(data, 24, data.Length - 24).TrimEnd('\\0');
            }
            if (string.IsNullOrEmpty(orig)) return null;
            return new RecycleMeta { OriginalPath = orig, SizeBytes = sz, DeletedMs = delMs };
        } catch {
            return null;
        }
    }

    public static void ScanVolume(string driveLetter, int maxRecordsToScan, string outFilePath) {
        string cleanDrive = driveLetter.TrimEnd(':', '\\\\', '/').ToUpperInvariant() + ":";
        string devPath = "\\\\\\\\.\\\\" + cleanDrive;

        using (SafeFileHandle handle = CreateFile(devPath, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero)) {
            if (handle.IsInvalid) return;

            byte[] boot = new byte[4096];
            uint br;
            if (!ReadSectorAligned(handle, 0, boot, 4096, out br) || br < 512) return;

            string oem = Encoding.ASCII.GetString(boot, 3, 4);
            if (oem != "NTFS") return;

            int bytesPerSector = BitConverter.ToUInt16(boot, 11);
            int sectorsPerCluster = boot[13];
            long bytesPerCluster = (long)bytesPerSector * sectorsPerCluster;
            long mftStartCluster = (long)BitConverter.ToUInt64(boot, 48);
            if (bytesPerCluster <= 0 || mftStartCluster <= 0) return;

            byte[] rec0 = new byte[4096];
            if (!ReadSectorAligned(handle, mftStartCluster * bytesPerCluster, rec0, 4096, out br) || br < 1024) return;
            if (Encoding.ASCII.GetString(rec0, 0, 4) != "FILE") return;
            ApplyUsaFixup(rec0, 0);

            List<DataRun> mftRuns = new List<DataRun>();
            int aOff = BitConverter.ToUInt16(rec0, 20);
            while (aOff > 0 && aOff + 16 <= 1024) {
                uint aType = BitConverter.ToUInt32(rec0, aOff);
                if (aType == 0xFFFFFFFF || aType == 0) break;
                int aLen = (int)BitConverter.ToUInt32(rec0, aOff + 4);
                if (aLen <= 0 || aOff + aLen > 1024) break;
                if (aType == 0x80 && rec0[aOff + 8] == 1) {
                    int rlOff = aOff + BitConverter.ToUInt16(rec0, aOff + 32);
                    mftRuns = DecodeDataRuns(rec0, rlOff, aOff + aLen);
                    break;
                }
                aOff += aLen;
            }
            if (mftRuns.Count == 0) {
                mftRuns.Add(new DataRun { ClusterOffset = mftStartCluster, ClusterCount = 65536 });
            }

            Dictionary<long, DirNode> dirMap = new Dictionary<long, DirNode>();
            dirMap[5] = new DirNode { Name = cleanDrive, Parent = 5 };

            // Map of "$Ixxxxxx" key (suffix after $I) -> RecycleMeta (from both live $Recycle.Bin and deleted $I records in MFT!)
            Dictionary<string, RecycleMeta> recycleMetaMap = new Dictionary<string, RecycleMeta>(StringComparer.OrdinalIgnoreCase);

            // Pre-populate recycleMetaMap from any remaining $I files on disk inside $Recycle.Bin
            try {
                string rbRoot = cleanDrive + "\\\\$Recycle.Bin";
                if (Directory.Exists(rbRoot)) {
                    foreach (string sidDir in Directory.GetDirectories(rbRoot)) {
                        try {
                            foreach (string iFile in Directory.GetFiles(sidDir, "$I*")) {
                                string baseName = Path.GetFileName(iFile);
                                if (baseName.Length > 2) {
                                    string key = baseName.Substring(2);
                                    byte[] iBytes = File.ReadAllBytes(iFile);
                                    RecycleMeta rm = ParseRecycleMetaBytes(iBytes);
                                    if (rm != null) recycleMetaMap[key] = rm;
                                }
                            }
                        } catch { }
                    }
                }
            } catch { }

            List<DeletedCandidate> candidates = new List<DeletedCandidate>();

            int batchRecords = 1024; // 1 MB per read
            byte[] batchBuf = new byte[batchRecords * 1024];
            long globalRecordIndex = 0;

            foreach (DataRun mftRun in mftRuns) {
                if (globalRecordIndex >= maxRecordsToScan) break;
                long runByteStart = mftRun.ClusterOffset * bytesPerCluster;
                long totalRecordsInRun = (mftRun.ClusterCount * bytesPerCluster) / 1024;

                for (long r = 0; r < totalRecordsInRun; r += batchRecords) {
                    if (globalRecordIndex >= maxRecordsToScan) break;
                    int recsToRead = (int)Math.Min((long)batchRecords, totalRecordsInRun - r);
                    int bytesToRead = ((recsToRead * 1024 + 4095) / 4096) * 4096;
                    if (bytesToRead > batchBuf.Length) bytesToRead = batchBuf.Length;

                    uint readNow;
                    if (!ReadSectorAligned(handle, runByteStart + r * 1024, batchBuf, bytesToRead, out readNow) || readNow < 1024) {
                        break;
                    }

                    int actualRecs = Math.Min(recsToRead, (int)(readNow / 1024));
                    for (int i = 0; i < actualRecs; i++) {
                        long recNum = globalRecordIndex + i;
                        if (recNum < 24) continue;

                        int baseOff = i * 1024;
                        if (batchBuf[baseOff] != 'F' || batchBuf[baseOff + 1] != 'I' || batchBuf[baseOff + 2] != 'L' || batchBuf[baseOff + 3] != 'E') {
                            continue;
                        }

                        ushort flags = BitConverter.ToUInt16(batchBuf, baseOff + 22);
                        // We only care about directories (0x02, 0x03) and deleted files (0x00)
                        if (flags != 0x0000 && flags != 0x0002 && flags != 0x0003) continue;

                        ApplyUsaFixup(batchBuf, baseOff);

                        int attrPos = BitConverter.ToUInt16(batchBuf, baseOff + 20);
                        string bestName = null;
                        int bestNs = -1;
                        long parentRec = 5;
                        long stdMtime = 0;
                        long fnMtime = 0;
                        long fnSize = 0;
                        long dataSize = 0;
                        byte[] residentBytes = null;
                        List<DataRun> fileRuns = null;

                        while (attrPos > 0 && attrPos + 16 <= 1024) {
                            int cur = baseOff + attrPos;
                            uint aType = BitConverter.ToUInt32(batchBuf, cur);
                            if (aType == 0xFFFFFFFF || aType == 0) break;
                            int aLen = (int)BitConverter.ToUInt32(batchBuf, cur + 4);
                            if (aLen <= 0 || attrPos + aLen > 1024) break;

                            byte nonRes = batchBuf[cur + 8];
                            byte nameLen = batchBuf[cur + 9];

                            if (aType == 0x10 && nonRes == 0) {
                                int vOff = cur + BitConverter.ToUInt16(batchBuf, cur + 20);
                                if (vOff + 32 <= baseOff + 1024) {
                                    stdMtime = FiletimeToMs(BitConverter.ToUInt64(batchBuf, vOff + 8));
                                }
                            } else if (aType == 0x30 && nonRes == 0) {
                                int vOff = cur + BitConverter.ToUInt16(batchBuf, cur + 20);
                                int vLen = (int)BitConverter.ToUInt32(batchBuf, cur + 16);
                                if (vOff + 66 <= baseOff + 1024 && vOff + vLen <= baseOff + 1024) {
                                    uint pLow = BitConverter.ToUInt32(batchBuf, vOff);
                                    ushort pHigh = BitConverter.ToUInt16(batchBuf, vOff + 4);
                                    long pR = (long)pLow + ((long)pHigh << 32);
                                    long fMt = FiletimeToMs(BitConverter.ToUInt64(batchBuf, vOff + 16));
                                    long allocSz = (long)BitConverter.ToUInt64(batchBuf, vOff + 40);
                                    long realSz = (long)BitConverter.ToUInt64(batchBuf, vOff + 48);
                                    byte fnLen = batchBuf[vOff + 64];
                                    byte fnNs = batchBuf[vOff + 65];
                                    if (vOff + 66 + fnLen * 2 <= baseOff + 1024) {
                                        string cand = Encoding.Unicode.GetString(batchBuf, vOff + 66, fnLen * 2);
                                        if (bestName == null || fnNs != 2 || bestNs == 2) {
                                            bestName = cand;
                                            bestNs = fnNs;
                                            parentRec = pR;
                                            fnMtime = fMt;
                                            long sz = realSz > 0 ? realSz : allocSz;
                                            if (sz > 0) fnSize = sz;
                                        }
                                    }
                                }
                            } else if (flags == 0x0000 && aType == 0x80 && nameLen == 0) {
                                if (nonRes == 0) {
                                    int vLen = (int)BitConverter.ToUInt32(batchBuf, cur + 16);
                                    int vOff = cur + BitConverter.ToUInt16(batchBuf, cur + 20);
                                    if (vLen > 0 && vOff + vLen <= baseOff + 1024) {
                                        dataSize = vLen;
                                        residentBytes = new byte[vLen];
                                        Buffer.BlockCopy(batchBuf, vOff, residentBytes, 0, vLen);
                                    }
                                } else {
                                    int rlOff = cur + BitConverter.ToUInt16(batchBuf, cur + 32);
                                    long allocSz = (long)BitConverter.ToUInt64(batchBuf, cur + 40);
                                    long realSz = (long)BitConverter.ToUInt64(batchBuf, cur + 48);
                                    dataSize = realSz > 0 ? realSz : allocSz;
                                    fileRuns = DecodeDataRuns(batchBuf, rlOff, cur + aLen);
                                }
                            }

                            attrPos += aLen;
                        }

                        if (string.IsNullOrEmpty(bestName)) continue;

                        if (flags == 0x0002 || flags == 0x0003) {
                            if (!bestName.StartsWith("$") || bestName.Equals("$Recycle.Bin", StringComparison.OrdinalIgnoreCase)) {
                                dirMap[recNum] = new DirNode { Name = bestName, Parent = parentRec };
                            }
                            continue;
                        }

                        // Deleted File (flags == 0x0000)
                        if (bestName.StartsWith("$I", StringComparison.OrdinalIgnoreCase) && bestName.Length > 2 && residentBytes != null) {
                            RecycleMeta rm = ParseRecycleMetaBytes(residentBytes);
                            if (rm != null) {
                                recycleMetaMap[bestName.Substring(2)] = rm;
                            }
                            continue;
                        }

                        if (bestName.StartsWith("$") && !bestName.StartsWith("$R", StringComparison.OrdinalIgnoreCase)) {
                            continue;
                        }

                        long totalRunBytes = 0;
                        if (fileRuns != null) {
                            foreach (var fr in fileRuns) totalRunBytes += fr.ClusterCount * bytesPerCluster;
                        }

                        long finalSize = dataSize > 0 ? dataSize : (fnSize > 0 ? fnSize : totalRunBytes);
                        bool hasData = (residentBytes != null && residentBytes.Length > 0) || (fileRuns != null && fileRuns.Count > 0);
                        if (!hasData && finalSize <= 0) continue;

                        candidates.Add(new DeletedCandidate {
                            RecordNum = recNum,
                            Name = bestName,
                            ParentRecord = parentRec,
                            SizeBytes = finalSize,
                            ModifiedMs = stdMtime > 0 ? stdMtime : fnMtime,
                            ResidentBase64 = residentBytes != null ? Convert.ToBase64String(residentBytes) : "",
                            Runs = fileRuns ?? new List<DataRun>()
                        });
                    }

                    globalRecordIndex += actualRecs;
                }
            }

            // Write TSV lines to outFilePath:
            // RecordNum \t Name \t FullPath \t SizeBytes \t ModifiedMs \t BytesPerCluster \t ResidentBase64 \t RunsSpec
            using (StreamWriter sw = new StreamWriter(outFilePath, false, Encoding.UTF8)) {
                foreach (var c in candidates) {
                    string resolvedName = c.Name;
                    string resolvedFullPath = null;
                    long resolvedSize = c.SizeBytes;
                    long resolvedTime = c.ModifiedMs;

                    // If this deleted record was a Recycle Bin payload ($Rxxxxxx.ext), restore its original name & path from $Ixxxxxx!
                    if (c.Name.StartsWith("$R", StringComparison.OrdinalIgnoreCase) && c.Name.Length > 2) {
                        string suffixKey = c.Name.Substring(2);
                        RecycleMeta rm;
                        if (recycleMetaMap.TryGetValue(suffixKey, out rm)) {
                            resolvedFullPath = rm.OriginalPath;
                            resolvedName = Path.GetFileName(rm.OriginalPath);
                            if (resolvedSize <= 0 && rm.SizeBytes > 0) resolvedSize = rm.SizeBytes;
                            if (rm.DeletedMs > 0) resolvedTime = rm.DeletedMs;
                        }
                    }

                    if (resolvedFullPath == null) {
                        List<string> parts = new List<string>();
                        long curP = c.ParentRecord;
                        int depth = 0;
                        while (curP != 5 && depth < 15) {
                            DirNode dn;
                            if (!dirMap.TryGetValue(curP, out dn)) {
                                parts.Insert(0, "[Folder_" + curP + "]");
                                break;
                            }
                            parts.Insert(0, dn.Name);
                            if (dn.Parent == curP) break;
                            curP = dn.Parent;
                            depth++;
                        }
                        string dirPrefix = parts.Count > 0 ? (cleanDrive + "\\\\" + string.Join("\\\\", parts)) : cleanDrive;
                        resolvedFullPath = dirPrefix + "\\\\" + resolvedName;
                    }

                    if (resolvedSize <= 0) continue;

                    StringBuilder runSb = new StringBuilder();
                    for (int idx = 0; idx < c.Runs.Count; idx++) {
                        if (idx > 0) runSb.Append(";");
                        runSb.Append(c.Runs[idx].ClusterOffset).Append(":").Append(c.Runs[idx].ClusterCount);
                    }

                    sw.WriteLine(string.Join("\\t", new string[] {
                        c.RecordNum.ToString(),
                        resolvedName.Replace("\\t", " "),
                        resolvedFullPath.Replace("\\t", " "),
                        resolvedSize.ToString(),
                        resolvedTime.ToString(),
                        bytesPerCluster.ToString(),
                        c.ResidentBase64 ?? "",
                        runSb.ToString()
                    }));
                }
            }
        }
    }

    public static bool RecoverDataRuns(string driveLetter, long fileSize, long bytesPerCluster, string runsSpec, string destPath) {
        string cleanDrive = driveLetter.TrimEnd(':', '\\\\', '/').ToUpperInvariant() + ":";
        string devPath = "\\\\\\\\.\\\\" + cleanDrive;

        using (SafeFileHandle handle = CreateFile(devPath, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero)) {
            if (handle.IsInvalid) return false;

            using (FileStream outFs = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None)) {
                long remaining = fileSize;
                int chunkSize = 1024 * 1024; // 1 MB sector-aligned buffer
                byte[] buf = new byte[chunkSize];

                string[] parts = runsSpec.Split(new char[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (string part in parts) {
                    if (remaining <= 0) break;
                    string[] kv = part.Split(':');
                    if (kv.Length != 2) continue;
                    long clusterOff = long.Parse(kv[0]);
                    long clusterCnt = long.Parse(kv[1]);

                    long diskOffset = clusterOff * bytesPerCluster;
                    long runBytesLeft = clusterCnt * bytesPerCluster;

                    while (runBytesLeft > 0 && remaining > 0) {
                        int alignedToRead = (int)Math.Min((long)chunkSize, runBytesLeft);
                        alignedToRead = ((alignedToRead + 4095) / 4096) * 4096;
                        if (alignedToRead > buf.Length) alignedToRead = buf.Length;

                        uint br;
                        if (!ReadSectorAligned(handle, diskOffset, buf, alignedToRead, out br) || br == 0) {
                            break;
                        }

                        int toWrite = (int)Math.Min((long)br, remaining);
                        outFs.Write(buf, 0, toWrite);

                        diskOffset += br;
                        runBytesLeft -= br;
                        remaining -= toWrite;
                    }
                }
            }
            return true;
        }
    }
}
`;

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
   * 1. Raw NTFS Master File Table ($MFT) Deleted Records via native Win32 C# P/Invoke (`CreateFileW` on `\\.\X:`),
   *    including automatic correlation of deleted `$Ixxxxxx` & `$Rxxxxxx` records from emptied Recycle Bins!
   * 2. Orphaned $Recycle.Bin `$R*` remnants that are not in the active Recycle Bin
   * 3. Lost cluster fragments (`found.000\*.chk`) and orphaned application recovery backups (`~$*`, `.asd`, `.wbk`, `.bak`, `.crdownload`, `.part`)
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
    const maxResults = options.maxResults || 2500;

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

    const matchesCategory = (ext: string, fileName?: string): boolean => {
      if (!allowedExts) return true;
      const lowerExt = ext.toLowerCase();
      if (allowedExts.has(lowerExt)) return true;
      if (fileName) {
        const lowerName = fileName.toLowerCase();
        for (const allowed of allowedExts) {
          if (lowerName.endsWith(allowed)) return true;
        }
      }
      return false;
    };

    // Exclude any items that are currently sitting in the active Recycle Bin (Tab 1)
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
    // STAGE 1: Native Win32 Raw NTFS $MFT Deleted Record & Emptied Recycle Bin Scanner
    // =========================================================================
    if (!signal.aborted && results.length < maxResults) {
      emitProgress(`${driveLetter}\\$MFT (Initializing raw sector Master File Table scan...)`);
      await this.scanNtfsMftNativeWin32(
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
   * Executes the C# Win32 P/Invoke raw NTFS $MFT scanner (`CreateFileW` on `\\.\X:`)
   * and parses all deleted file records (`Flags == 0x0000`).
   */
  private async scanNtfsMftNativeWin32(
    driveLetter: string,
    scopePrefix: string | null,
    matchesCategory: (ext: string, fileName?: string) => boolean,
    maxResults: number,
    signal: AbortSignal,
    results: DeepRecoveryItem[],
    seenKeys: Set<string>,
    activeRecycleOrigPaths: Set<string>,
    onTick: (curPath: string, recordsScanned: number) => void
  ): Promise<void> {
    const cleanDrive = driveLetter.replace(/[:\\/]+$/, '').toUpperCase() + ':';
    const stamp = `${cleanDrive[0]}_${Date.now()}`;
    const tempOutFile = path.join(os.tmpdir(), `disksweepr_mft_scan_${stamp}.tsv`);
    const tempPs1File = path.join(os.tmpdir(), `disksweepr_mft_scan_${stamp}.ps1`);

    const psScript = `
Add-Type -TypeDefinition @'
${CSHARP_MFT_ENGINE}
'@
[NtfsMftEngine]::ScanVolume('${cleanDrive}', 1000000, '${tempOutFile.replace(/'/g, "''")}')
`;

    try {
      await fs.promises.writeFile(tempPs1File, psScript, 'utf8');
      await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1File}"`, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 45000,
      });

      if (signal.aborted || !fs.existsSync(tempOutFile)) return;

      const content = await fs.promises.readFile(tempOutFile, 'utf8');
      const lines = content.split(/\r?\n/);
      onTick(`${cleanDrive}\\$MFT (Parsing ${lines.length.toLocaleString()} deleted MFT records...)`, lines.length);

      const parsedCandidates: DeepRecoveryItem[] = [];

      for (const line of lines) {
        if (!line) continue;
        const cols = line.split('\t');
        if (cols.length < 8) continue;

        const recordNum = parseInt(cols[0], 10);
        const fileName = cols[1];
        const fullPath = cols[2];
        const sizeBytes = Number(cols[3]);
        const modifiedMs = Number(cols[4]);
        const bytesPerCluster = parseInt(cols[5], 10) || 4096;
        const residentBase64 = cols[6] || undefined;
        const runsSpec = cols[7] || '';

        if (!fileName || sizeBytes <= 0) continue;

        const ext = path.extname(fileName).toLowerCase();
        if (!matchesCategory(ext, fileName)) continue;

        const lowerOrig = fullPath.toLowerCase();

        // Filter out noisy browser cache chunks unless user explicitly targeted that folder
        if (
          !scopePrefix &&
          (lowerOrig.includes('\\appdata\\local\\temp\\') ||
            lowerOrig.includes('\\cache\\cache_data\\') ||
            lowerOrig.includes('\\code cache\\') ||
            lowerOrig.includes('\\gpucache\\') ||
            lowerOrig.includes('\\ dawnwebgpucache\\') ||
            lowerOrig.includes('\\service worker\\cachestorage\\'))
        ) {
          continue;
        }

        if (scopePrefix && !lowerOrig.startsWith(scopePrefix.toLowerCase())) {
          continue;
        }

        // Must NOT be a live file or an item currently inside the active Recycle Bin (Tab 1)
        if (fs.existsSync(fullPath)) continue;
        if (activeRecycleOrigPaths.has(lowerOrig)) continue;

        const dataRuns: Array<{ clusterOffset: number; clusterCount: number }> = [];
        if (runsSpec) {
          for (const part of runsSpec.split(';')) {
            const [cOff, cCnt] = part.split(':').map((n) => parseInt(n, 10));
            if (cOff > 0 && cCnt > 0) {
              dataRuns.push({ clusterOffset: cOff, clusterCount: cCnt });
            }
          }
        }

        const hasData = Boolean(residentBase64) || dataRuns.length > 0;

        parsedCandidates.push({
          id: `mft_${cleanDrive}_${recordNum}_${modifiedMs}`,
          name: fileName,
          originalPath: fullPath,
          detectedType: ext.replace(/^\./, '').toUpperCase() || 'FILE',
          sizeBytes,
          status: hasData ? 'recoverable' : 'partially_overwritten',
          modifiedTime: modifiedMs > 0 ? modifiedMs : undefined,
          extension: ext,
          recoverySource: 'ntfs_mft',
          sourcePath: `\\\\.\\${cleanDrive}`,
          mftRecordNumber: recordNum,
          bytesPerCluster,
          dataRuns: dataRuns.length > 0 ? dataRuns : undefined,
          residentDataBase64: residentBase64,
        });
      }

      // Sort recoverable items first, then most recently deleted/modified first
      parsedCandidates.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'recoverable' ? -1 : 1;
        }
        return (b.modifiedTime || 0) - (a.modifiedTime || 0);
      });

      for (const cand of parsedCandidates) {
        if (results.length >= maxResults) break;
        const dedupKey = `${cand.originalPath.toLowerCase()}_${cand.sizeBytes}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);
        results.push(cand);
      }
    } catch {
      // Fallback if PowerShell / Admin elevation unavailable
    } finally {
      try {
        if (fs.existsSync(tempOutFile)) {
          fs.unlinkSync(tempOutFile);
        }
        if (fs.existsSync(tempPs1File)) {
          fs.unlinkSync(tempPs1File);
        }
      } catch {}
    }
  }

  /**
   * Scans all SID subdirectories inside `<Drive>:\$Recycle.Bin` ONLY for orphaned `$R*` payloads
   * that are NOT present in the active Windows Recycle Bin (Tab 1).
   */
  private async scanDeepRecycleBinRemnants(
    recycleRoot: string,
    scopePrefix: string | null,
    matchesCategory: (ext: string, fileName?: string) => boolean,
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

        if (activeRecyclePaths.has(path.resolve(fullPath).toLowerCase())) {
          continue;
        }

        onTick(fullPath);

        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.size <= 0) continue;

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
          if (!matchesCategory(ext, displayName)) continue;

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
    matchesCategory: (ext: string, fileName?: string) => boolean,
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

          const stemName = entry.name.replace(/\.(bak|old|crdownload|part|tmp)$/i, '');
          const effectiveExt = path.extname(stemName).toLowerCase() || ext;

          if (!matchesCategory(effectiveExt, stemName) && !matchesCategory(ext, entry.name)) {
            continue;
          }

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
   * - For `ntfs_mft` records: reconstructs the deleted file directly from raw disk clusters (`\\.\X:`) using Win32 P/Invoke or resident MFT bytes!
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
   * directly from the raw volume handle (`\\.\X:`) via native Win32 C# P/Invoke.
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

    const cleanDrive = item.sourcePath.replace(/^\\\\\.\\/, '');
    const runsSpec = item.dataRuns.map((r) => `${r.clusterOffset}:${r.clusterCount}`).join(';');
    const tempPs1File = path.join(os.tmpdir(), `disksweepr_mft_recover_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.ps1`);

    const psScript = `
Add-Type -TypeDefinition @'
${CSHARP_MFT_ENGINE}
'@
$ok = [NtfsMftEngine]::RecoverDataRuns('${cleanDrive}', ${item.sizeBytes}, ${item.bytesPerCluster}, '${runsSpec}', '${finalPath.replace(/'/g, "''")}')
if ($ok) { Write-Output "OK" } else { Write-Output "FAIL" }
`;

    try {
      await fs.promises.writeFile(tempPs1File, psScript, 'utf8');
      const { stdout } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPs1File}"`, {
        maxBuffer: 5 * 1024 * 1024,
        timeout: 120000,
      });
      return stdout.trim().includes('OK') && fs.existsSync(finalPath);
    } catch (err) {
      console.error('Raw NTFS sector recovery failed:', err);
      return false;
    } finally {
      try {
        if (fs.existsSync(tempPs1File)) {
          fs.unlinkSync(tempPs1File);
        }
      } catch {}
    }
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
