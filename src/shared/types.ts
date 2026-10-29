export type RiskLevel = 'safe' | 'recommended' | 'caution';

export type CategoryGroup = 'system' | 'browsers' | 'apps' | 'developer' | 'media';

export interface CategoryDefinition {
  id: string;
  name: string;
  description: string;
  group: CategoryGroup;
  risk: RiskLevel;
  defaultSelected: boolean;
  paths: string[]; // Environment-variable aware paths (e.g. %TEMP%, %LOCALAPPDATA%\CrashDumps)
  fileExtensions?: string[]; // Optional filter e.g. ['.log', '.dmp', '.tmp']
  isRecycleBin?: boolean;
  requiresAdmin?: boolean;
  useTrash?: boolean; // When true, send items to Recycle Bin instead of permanent unlink
}

export interface ScannedFile {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedTime: number;
}

export interface ScannedCategory {
  id: string;
  name: string;
  description: string;
  group: CategoryGroup;
  risk: RiskLevel;
  selected: boolean;
  totalBytes: number;
  fileCount: number;
  files: ScannedFile[];
  excludedPaths?: string[];
  requiresAdmin?: boolean;
  isRecycleBin?: boolean;
  useTrash?: boolean;
}

export interface ScanProgress {
  currentCategory: string;
  currentPath: string;
  scannedFilesCount: number;
  scannedBytes: number;
  percent: number;
}

export interface ScanResult {
  categories: ScannedCategory[];
  totalBytes: number;
  totalFiles: number;
  elapsedMs: number;
}

export interface CleanProgress {
  currentFile: string;
  currentCategory: string;
  cleanedFilesCount: number;
  cleanedBytes: number;
  totalFiles: number;
  totalBytes: number;
  percent: number;
}

export interface HistoryDetailItem {
  name: string;
  path: string;
  sizeBytes: number;
  category?: string;
  status: 'purged' | 'skipped';
  reason?: string;
}

export interface CleanReport {
  reclaimedBytes: number;
  cleanedFilesCount: number;
  skippedFilesCount: number;
  elapsedMs: number;
  errors: Array<{ path: string; reason: string }>;
  items?: HistoryDetailItem[];
}

export interface DriveStat {
  letter: string;
  label: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export interface ScanOptions {
  targetDrive?: string; // e.g. 'C:', 'D:', 'M:'
  categoryIds?: string[];
  extensionFilter?: string[]; // e.g. ['.log', '.tmp']. undefined = all formats, empty array = no format matches
  scanMode?: 'quick' | 'full' | 'custom';
}

export type NavModule =
  | 'system'
  | 'large_files'
  | 'duplicates'
  | 'dev_projects'
  | 'tools'
  | 'recovery'
  | 'history'
  | 'fast_search';

export type FastSearchFileType = 'all' | 'documents' | 'images' | 'media' | 'archives' | 'executables' | 'code';
export type FastSearchSizeFilter = 'all' | 'tiny' | 'small' | 'medium' | 'large' | 'custom';
export type FastSearchTargetKind = 'all' | 'files' | 'folders';

export interface FastSearchItem {
  id: string;
  name: string;
  path: string;
  directory: string;
  extension: string;
  sizeBytes: number;
  modifiedTime: number;
  isDirectory?: boolean;
  sizePending?: boolean;
}

export interface FastSearchOptions {
  query: string;
  driveLetter?: string;
  customPath?: string;
  scanAllDrives?: boolean;
  fileType?: FastSearchFileType;
  targetKind?: FastSearchTargetKind;
  sizeFilter?: FastSearchSizeFilter;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  includeHidden?: boolean;
  matchCase?: boolean;
  maxResults?: number;
}

export interface FastSearchProgress {
  currentDirectory: string;
  scannedFilesCount: number;
  matchesCount: number;
  elapsedMs: number;
  folderSizeUpdate?: { path: string; sizeBytes: number };
}

export interface RunningAppInfo {
  id: string;
  name: string;
  processName: string;
}

export interface LargeFileItem {
  id: string;
  name: string;
  path: string;
  extension: string;
  sizeBytes: number;
  modifiedTime: number;
  isDirectory?: boolean;
}

export interface LargeFilesScanOptions {
  driveLetter?: string;
  customPath?: string;
  scanAllDrives?: boolean;
  minSizeBytes: number; // e.g. 100MB, 500MB, 1GB
  maxResults?: number;
}

export interface DevArtifactItem {
  id: string;
  projectName: string;
  artifactType: 'node_modules' | '.next' | 'target' | 'dist' | 'build' | '.turbo';
  path: string;
  sizeBytes: number;
  lastModifiedTime: number;
  daysInactive: number;
  selected?: boolean;
}

export interface DevScanOptions {
  rootPath: string; // e.g. "M:\\testProject"
}

export interface DevScanProgress {
  currentDirectory: string;
}

export interface LargeFilesScanProgress {
  currentDirectory: string;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  driveLetter: string;
  module: 'system' | 'large_files' | 'dev_projects' | 'duplicates' | 'tools';
  reclaimedBytes: number;
  filesCount: number;
  summary: string;
  elapsedMs?: number;
  items?: HistoryDetailItem[];
}

// --- Virtual Disks (WSL2 & Docker VHDX) ---
export interface VirtualDiskItem {
  id: string;
  name: string;
  path: string;
  sizeBytes: number;
  type: 'wsl' | 'docker' | 'custom';
  distroName?: string;
}

export interface CompactVDiskResult {
  path: string;
  beforeBytes: number;
  afterBytes: number;
  reclaimedBytes: number;
  success: boolean;
  error?: string;
}

// --- Duplicate Files Hunter ---
export interface DuplicateFile {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedTime: number;
  selected?: boolean;
}

export interface DuplicateGroup {
  id: string;
  hash: string;
  sizeBytes: number;
  files: DuplicateFile[];
  wastedBytes: number;
}

export interface DuplicateScanOptions {
  targetPath?: string;
  scanAllDrives?: boolean;
  minSizeBytes?: number;
}

export interface DuplicateScanProgress {
  currentPath: string;
  stage: 'indexing' | 'hashing';
  scannedFilesCount: number;
  duplicatesFoundCount: number;
}

// --- Empty Folders Sweeper ---
export interface EmptyFolderItem {
  id: string;
  path: string;
  name: string;
  parentPath: string;
  selected?: boolean;
}

// --- Windows Component Store (DISM) ---
export interface DismAnalysisResult {
  reportedSizeMB: number;
  actualSizeMB: number;
  sharedSizeMB: number;
  backupsSizeMB: number;
  reclaimablePackages: number;
  cleanupRecommended: boolean;
  rawOutput: string;
}

export interface DismCleanResult {
  success: boolean;
  output: string;
  error?: string;
}

// --- Windows Explorer Context Menu ---
export interface ContextMenuStatus {
  enabled: boolean;
}

// --- File Recovery (Recycle Bin & Deep Recovery) ---
export interface RecycleBinItem {
  id: string;
  name: string;
  path: string; // The physical location in $Recycle.Bin
  originalLocation: string;
  originalFullPath: string;
  dateDeleted: string;
  sizeBytes: number;
  sizeFormatted: string;
  type: string;
}

export interface DeepRecoveryItem {
  id: string;
  name: string;
  originalPath: string;
  detectedType: string;
  sizeBytes: number;
  status: 'recoverable' | 'corrupted' | 'partially_overwritten';
  modifiedTime?: number;
  extension: string;
}

export interface DeepRecoveryScanOptions {
  targetPath: string;
  category?: 'all' | 'images' | 'documents' | 'media' | 'archives';
  maxResults?: number;
}

export interface DeepRecoveryScanProgress {
  currentPath: string;
  scannedFilesCount: number;
  foundItemsCount: number;
}

export interface CleanerApi {
  // Drive Stats
  getDriveStats(): Promise<DriveStat[]>;

  // Category Catalog
  getCategoryDefinitions(driveLetter?: string): Promise<CategoryDefinition[]>;

  // Scan (System Junk)
  startScan(options?: ScanOptions): Promise<ScanResult>;
  cancelScan(): Promise<void>;
  onScanProgress(callback: (progress: ScanProgress) => void): () => void;

  // Clean (System Junk)
  startClean(categoryIds: string[], excludedFilePaths?: string[]): Promise<CleanReport>;
  cancelClean(): Promise<void>;
  getRunningApps(categoryIds: string[]): Promise<RunningAppInfo[]>;
  closeApps(processNames: string[]): Promise<void>;
  onCleanProgress(callback: (progress: CleanProgress) => void): () => void;

  // Large Files Hunter
  scanLargeFiles(options: LargeFilesScanOptions): Promise<LargeFileItem[]>;
  cancelLargeFilesScan(): Promise<void>;
  onLargeFilesScanProgress(callback: (progress: LargeFilesScanProgress) => void): () => void;
  deleteLargeFiles(filePaths: string[]): Promise<{ deletedPaths: string[]; failedPaths: string[]; reclaimedBytes: number }>;

  // Developer Artifacts
  scanDevArtifacts(options: DevScanOptions): Promise<DevArtifactItem[]>;
  cancelDevScan(): Promise<void>;
  onDevScanProgress(callback: (progress: DevScanProgress) => void): () => void;
  deleteDevArtifacts(artifactPaths: string[]): Promise<{ deletedPaths: string[]; failedPaths: string[]; reclaimedBytes: number }>;
  selectFolderDialog(): Promise<string | null>;

  // Virtual Disks (WSL2 & Docker)
  scanVirtualDisks(): Promise<VirtualDiskItem[]>;
  compactVirtualDisk(vhdxPath: string): Promise<CompactVDiskResult>;

  // Duplicate Files Hunter
  scanDuplicates(options: DuplicateScanOptions): Promise<DuplicateGroup[]>;
  cancelDuplicateScan(): Promise<void>;
  onDuplicateScanProgress(callback: (progress: DuplicateScanProgress) => void): () => void;
  deleteDuplicates(filePaths: string[], useTrash?: boolean): Promise<{ deletedPaths: string[]; failedPaths: string[]; reclaimedBytes: number }>;

  // Empty Folders Sweeper
  scanEmptyFolders(targetPath: string): Promise<EmptyFolderItem[]>;
  deleteEmptyFolders(folderPaths: string[]): Promise<{ deletedPaths: string[]; failedPaths: string[] }>;

  // Windows Component Store (DISM)
  analyzeComponentStore(): Promise<DismAnalysisResult>;
  cleanComponentStore(): Promise<DismCleanResult>;

  // Windows Context Menu
  getContextMenuStatus(): Promise<ContextMenuStatus>;
  setContextMenuStatus(enable: boolean): Promise<boolean>;

  // History & Logs
  getHistory(): Promise<HistoryRecord[]>;
  saveHistoryRecord(record: Omit<HistoryRecord, 'id'>): Promise<void>;
  clearHistory(): Promise<void>;
  exportHistory(format: 'json' | 'txt'): Promise<boolean>;

  // Fast File Search
  startFastSearch(options: FastSearchOptions): Promise<FastSearchItem[]>;
  cancelFastSearch(): Promise<void>;
  onFastSearchProgress(callback: (progress: FastSearchProgress) => void): () => void;
  onFastSearchBatch(callback: (batch: FastSearchItem[]) => void): () => void;
  openFile(filePath: string): Promise<void>;
  deleteFile(filePath: string): Promise<boolean>;

  // File Recovery
  getRecycleBinItems(): Promise<RecycleBinItem[]>;
  restoreRecycleBinItems(itemPaths: string[]): Promise<{ restoredCount: number; failedCount: number }>;
  deleteRecycleBinItems(itemPaths: string[]): Promise<{ deletedCount: number; failedCount: number }>;
  emptyRecycleBin(): Promise<boolean>;
  scanDeepRecovery(options: DeepRecoveryScanOptions): Promise<DeepRecoveryItem[]>;
  cancelDeepRecovery(): Promise<void>;
  onDeepRecoveryProgress(callback: (progress: DeepRecoveryScanProgress) => void): () => void;
  recoverDeepFiles(items: DeepRecoveryItem[], destinationDir: string): Promise<{ recoveredCount: number; failedCount: number }>;

  // Shell & Utilities
  openPathInExplorer(targetPath: string): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  getPathForFile(file: File): string;
  onOpenTargetPath(callback: (targetPath: string) => void): () => void;

  // Window Controls
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
}

declare global {
  interface Window {
    cleanerApi: CleanerApi;
  }
}

