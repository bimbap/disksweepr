# Architecture Document
## Project: Windows System Cleaner (Codename: Cleaner)

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
The Main Process executes privileged operating system operations:
1. **Rule Engine (`ruleEngine.ts`)**:
   * Evaluates cleaning targets dynamically by resolving Windows environment variables (`%TEMP%`, `%APPDATA%`, `%LOCALAPPDATA%`, `%SYSTEMROOT%`, `%PROGRAMDATA%`).
   * Validates target paths against strict safety allowlists to prevent traversal outside defined boundaries.
2. **Scanner Service (`scannerService.ts`)**:
   * Traverses directory structures using batched, non-blocking asynchronous calls (`fs.promises.readdir` with `{ withFileTypes: true }`).
   * Computes file sizes and counts, streaming scan progress events (`scan:progress`) to the renderer via IPC.
   * Supports immediate cancellation through `AbortController`.
3. **Purge Engine (`cleanerService.ts`)**:
   * Executes deletion with strict error handling:
     * Attempts atomic unlinking (`fs.promises.unlink`).
     * Automatically traps and logs locked files (`EBUSY`, `EPERM`) without halting the entire purge process.
     * Prunes empty subdirectories recursively once child items are cleared.
     * Emptying the Recycle Bin using native PowerShell invocation or Win32 API.
4. **Drive Telemetry (`systemService.ts`)**:
   * Queries mounted drive capacities and current free space via Windows Management Instrumentation (`wmic`) or PowerShell `Get-Volume`.

### 2.2 Preload Script (`src/preload/`)
Exposes a strongly typed API surface on `window.cleanerApi`:
```typescript
export interface CleanerApi {
  // System Telemetry
  getDriveStats(): Promise<DriveStat[]>;
  
  // Scanning Operations
  startScan(categoryIds?: string[]): Promise<ScanResult>;
  cancelScan(): Promise<void>;
  onScanProgress(callback: (progress: ScanProgress) => void): () => void;
  
  // Cleaning Operations
  startClean(categoryIds: string[]): Promise<CleanReport>;
  onCleanProgress(callback: (progress: CleanProgress) => void): () => void;
  
  // Shell Utilities
  openPathInExplorer(targetPath: string): Promise<void>;
}
```

### 2.3 Renderer Process (`src/renderer/`)
* Completely isolated from direct Node.js APIs.
* Manages UI state:
  * Current step: `IDLE` -> `SCANNING` -> `AUDIT_READY` -> `CLEANING` -> `COMPLETED`.
  * Category toggle selections.
  * Real-time scan / purge progress animation.
  * Drill-down modal for inspecting file lists.

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
