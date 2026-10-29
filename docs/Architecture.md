# Architecture Document
## Project: DiskSweepr (Official Name: DiskSweepr, Codename: Cleaner)

---

## 1. System Overview & Technology Stack

The application is structured as a decoupled desktop application powered by **Electron**, **Vite**, **React 19**, and **TypeScript**. It leverages a secure two-tier process model with isolated context bridging.

```
┌────────────────────────────────────────────────────────┐
│               Renderer Process (React 19)              │
│  UI Components • State Management • Virtualized Lists  │
└───────────────────────────┬────────────────────────────┘
                            │ Type-Safe IPC (contextBridge)
┌───────────────────────────▼────────────────────────────┐
│                  Preload Script (Bridge)               │
│               window.cleanerApi Exposed API            │
└───────────────────────────┬────────────────────────────┘
                            │ IPC Messages & Event Streams
┌───────────────────────────▼────────────────────────────┐
│               Main Process (Node.js Engine)            │
│  • Rule Engine (Path Resolution & Environment Vars)    │
│  • Scan Worker (Non-blocking async disk traversal)     │
│  • Purge Engine (Safe unlink, recursive prune, locks)  │
│  • Win32 Shell Integrations (Recycle Bin, Elevation)   │
│  • System Storage Telemetry (Disk Space queries)       │
└────────────────────────────────────────────────────────┘
```

### Stack Breakdown:
* **Runtime**: Node.js 24 (bundled via Electron 34+)
* **Application Shell**: Electron (Hardened: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` on renderer)
* **Frontend Framework**: React 19 + TypeScript
* **Build System**: Vite 6 + `@vitejs/plugin-react`
* **Styling**: Vanilla Modern CSS with semantic CSS variables, fluid typography, and dark-mode tokens (no bulky UI frameworks)
* **Icons**: Handcrafted lightweight SVG icon set

---

## 2. Process Architecture & Security Model

### 2.1 Main Process (`src/main/`)
The Main Process executes privileged operating system operations across modular backend services:
1. **Rule Engine (`ruleEngine.ts` & `ruleRegistry.ts`)**:
   * Evaluates cleaning targets dynamically by resolving Windows environment variables (`%TEMP%`, `%APPDATA%`, `%LOCALAPPDATA%`, `%SYSTEMROOT%`, `%PROGRAMDATA%`).
   * Validates target paths against strict safety allowlists to prevent traversal outside defined boundaries.
2. **Scanner Service (`scannerService.ts`)**:
   * Traverses directory structures using batched, non-blocking asynchronous calls (`fs.promises.readdir` with `{ withFileTypes: true }`).
   * Computes file sizes and counts, streaming scan progress events (`scan:progress`) to the renderer via IPC.
   * Supports immediate cancellation through `AbortController`.
3. **Purge Engine (`cleanerService.ts`)**:
   * Executes deletion with atomic unlinking (`fs.promises.unlink`).
   * Automatically traps and logs locked files (`EBUSY`, `EPERM`) without halting the entire purge process.
   * Prunes empty subdirectories recursively once child items are cleared.
4. **Large Files Service (`largeFileService.ts`)**:
   * Scans configured volumes or custom directories for massive files exceeding threshold sizes (100MB, 300MB, 500MB, 1GB).
   * Calculates actual recursive directory sizes for top-level folders.
5. **Fast Search Service (`fastSearchService.ts`)**:
   * Blazing-fast whole-drive directory crawler with target kind filters (`all`, `files`, `folders`).
   * Accelerates folder-only scans by skipping stat calls on individual child files.
6. **Duplicate Hunter Service (`duplicateService.ts`)**:
   * Multi-drive duplicate scanner using a 2-stage verification pipeline: size matching -> sampled head/tail hash -> full SHA-256 comparison.
   * Supports abortable whole-PC scans and safe single-copy retention.
7. **Dev Workspace Service (`devCleanerService.ts`)**:
   * Audits local dev projects for dormant build artifacts (`node_modules`, `.next`, `dist`, `target`, `build`, `.gradle`).
8. **Power Tools Engine (`emptyFolderService.ts` & `dismService.ts`)**:
   * Prunes truly empty directory trees while strictly protecting Windows system roots and user library anchors.
   * Safely triggers Windows Component Store cleanup via `DISM.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase`.
9. **Recovery & Undelete Service (`recoveryService.ts`)**:
   * **Recycle Bin Manager**: Communicates with native Windows COM via `Shell.Application` Namespace 10. Reads original paths and deletion timestamps, restores items using native verb `"Restore"`, and purges permanently via `"Delete"` verb or `Clear-RecycleBin -Force` with live `WaveEqualizerLoader` state feedback.
   * **Deep File Recovery (3-Stage Raw NTFS `$MFT` & Remnant Pipeline)**:
     * **Stage 1 (Native Win32 Raw NTFS `$MFT` Engine)**: Compiles and invokes `NtfsMftEngine` (C# Win32 P/Invoke `CreateFileW` on `\\.\X:`, `FSCTL_GET_NTFS_VOLUME_DATA`, `SetFilePointerEx`, `ReadFile`) via a temporary `.ps1` script in `os.tmpdir()`. Scans up to `1,000,000` 1024-byte `FILE` records, applies Update Sequence Array (USA) fixups, extracts deleted file records (`Flags == 0x0000`), correlates deleted `$Ixxxxxx` and `$Rxxxxxx` Recycle Bin records to restore original filenames and paths, and reconstructs up to `2,500` deleted candidates from resident `$DATA` (`0x80`) or non-resident cluster data runs (`LCN` + cluster count) with 64-bit byte size accuracy.
     * **Stage 2 (Orphaned `$Recycle.Bin` SID Remnants)**: Traverses `<Drive>:\$Recycle.Bin` SID folders and parses binary `$I` metadata headers (`v1` Vista/7 and `v2` Win10/11) for items not present in the active Recycle Bin.
     * **Stage 3 (Lost Cluster & Crash Remnants)**: Scans `found.000\*.chk` fragments and crash-recovery artifacts (`~$*`, `.asd`, `.wbk`, `.xlk`, `.crdownload`, `.part`) while strictly excluding live `.bak`/`.old` files and active Recycle Bin items.
10. **Windows Explorer Context Menu (`contextMenuService.ts`)**:
    * Registers/unregisters `"Scan with DiskSweepr"` in `HKCU\Software\Classes\Directory\shell\DiskSweepr`, `Directory\Background\shell\DiskSweepr`, and `Drive\shell\DiskSweepr`.
    * Passes target directory path via CLI arguments (`parsePathArg` in `src/main/index.ts`) and focuses existing instance via `second-instance` event.
11. **Drive Telemetry (`telemetryService.ts`)**:
    * Queries mounted drive capacities, volume labels, and current free space via Windows WMI/CIM `Win32_LogicalDisk` and PowerShell.

### 2.2 Preload Script (`src/preload/`)
Exposes a strongly typed API surface on `window.cleanerApi`:
```typescript
export interface CleanerApi {
  // System Telemetry & Explorer
  getDriveStats(): Promise<DriveStat[]>;
  openPathInExplorer(targetPath: string): Promise<void>;
  
  // Module 1: System Junk Cleaner
  startScan(options?: ScanOptions): Promise<ScanResult>;
  cancelScan(): Promise<void>;
  onScanProgress(callback: (progress: ScanProgress) => void): () => void;
  startClean(categoryIds: string[], excludedFilePaths?: string[]): Promise<CleanReport>;
  onCleanProgress(callback: (progress: CleanProgress) => void): () => void;
  
  // Module 2: Large Files Hunter
  scanLargeFiles(options: LargeFileScanOptions): Promise<LargeFileItem[]>;
  cancelLargeFilesScan(): Promise<void>;
  deleteLargeFiles(paths: string[]): Promise<LargeFilesDeleteReport>;
  
  // Module 3: Fast Search
  searchFiles(options: FastSearchOptions): Promise<FastSearchResult>;
  cancelSearch(): Promise<void>;
  onSearchProgress(callback: (progress: FastSearchProgress) => void): () => void;
  
  // Module 4: Duplicate Hunter
  scanDuplicates(options: DuplicateScanOptions): Promise<DuplicateGroup[]>;
  cancelDuplicatesScan(): Promise<void>;
  deleteDuplicateFiles(paths: string[], useTrash: boolean): Promise<DuplicateDeleteReport>;
  
  // Module 5: Dev Workspace Cleaner
  scanDevProjects(rootPath: string): Promise<DevProjectItem[]>;
  cleanDevProjects(projectPaths: string[]): Promise<DevCleanReport>;
  
  // Module 6: Power Tools
  scanEmptyFolders(targetPath: string): Promise<EmptyFolderItem[]>;
  deleteEmptyFolders(folderPaths: string[]): Promise<EmptyFolderDeleteReport>;
  runDismCleanup(): Promise<DismReport>;
  
  // Module 8: Recovery & Undelete
  getRecycleBinItems(): Promise<RecycleBinItem[]>;
  restoreRecycleBinItems(paths: string[]): Promise<{ restoredCount: number }>;
  deleteRecycleBinItems(paths: string[]): Promise<{ deletedCount: number }>;
  emptyRecycleBin(): Promise<void>;
  scanDeepRecovery(options: DeepRecoveryOptions): Promise<DeepRecoveryItem[]>;
  cancelDeepRecovery(): Promise<void>;
  onDeepRecoveryProgress(callback: (progress: DeepRecoveryScanProgress) => void): () => void;
  recoverDeepFiles(fileIds: string[], targetDir: string): Promise<DeepRecoveryResult>;
}
```

### 2.3 Renderer Process (`src/renderer/`)
* Completely isolated from direct Node.js APIs.
* Uses route-level `React.lazy` code-splitting (`Suspense` in `App.tsx`) so only `TitleBar`, `NavRail`, and `SystemCleanupView` are parsed on initial launch, while the 7 secondary modules load on demand.
* Dynamically synchronizes `document.title` (`DiskSweepr - <Feature Name>`) per active module and language for clear Windows `Alt+Tab` identification.
* Manages UI state:
  * Current step: `IDLE` -> `SCANNING` -> `SCANNED` -> `CLEANING` -> `COMPLETED`.
  * Category & granular per-file toggle selections (`excludedPaths`).
  * Real-time scan / purge progress animation.
  * Paginated expandable drawer (`20` files/page) for inspecting and excluding individual files.

---

## 3. Data Models

```typescript
export interface CategoryDefinition {
  id: string;
  name: string;
  description: string;
  group: 'system' | 'browsers' | 'apps' | 'developer';
  risk: 'safe' | 'recommended' | 'caution';
  defaultSelected: boolean;
  paths: string[]; // Environment-variable aware paths
  filePatterns?: string[]; // Optional wildcard filters (e.g., *.log, *.dmp)
}

export interface ScannedCategory {
  id: string;
  name: string;
  group: string;
  risk: 'safe' | 'recommended' | 'caution';
  selected: boolean;
  totalBytes: number;
  fileCount: number;
  files: ScannedFile[];
}

export interface ScannedFile {
  path: string;
  sizeBytes: number;
  modifiedTime: number;
}

export interface CleanReport {
  reclaimedBytes: number;
  cleanedFilesCount: number;
  skippedFilesCount: number;
  elapsedMs: number;
  errors: Array<{ path: string; reason: string }>;
}
```

---

## 4. Safety & Boundary Invariants
1. **Never delete root or parent system directories**: Operations only delete the *contents* of target cache directories, preserving the root container if necessary.
2. **Path Sanitization**: Every path must resolve within its declared parent folder (`path.resolve(targetPath).startsWith(parentDirectory)`).
3. **No Symbolic Link Traversals**: Symlinks are never recursively walked into to prevent accidental deletion outside the target folder.
