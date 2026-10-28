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

export type NavModule = 'system' | 'large_files' | 'dev_projects' | 'history' | 'fast_search';

export type FastSearchFileType = 'all' | 'documents' | 'images' | 'media' | 'archives' | 'executables' | 'code';
export type FastSearchSizeFilter = 'all' | 'tiny' | 'small' | 'medium' | 'large' | 'custom';

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
  module: 'system' | 'large_files' | 'dev_projects';
  reclaimedBytes: number;
  filesCount: number;
  summary: string;
  elapsedMs?: number;
  items?: HistoryDetailItem[];
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
  startClean(categoryIds: string[]): Promise<CleanReport>;
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

