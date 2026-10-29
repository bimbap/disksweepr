import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { ScannerService } from './services/scannerService';
import { CleanerService } from './services/cleanerService';
import { LargeFileService } from './services/largeFileService';
import { DevCleanerService } from './services/devCleanerService';
import { HistoryService } from './services/historyService';
import { FastSearchService } from './services/fastSearchService';
import { VirtualDiskService } from './services/virtualDiskService';
import { DuplicateService } from './services/duplicateService';
import { EmptyFolderService } from './services/emptyFolderService';
import { DismService } from './services/dismService';
import { ContextMenuService } from './services/contextMenuService';
import { RecoveryService } from './services/recoveryService';
import { getDriveTelemetry } from './services/telemetryService';
import { getCategoryDefinitionsForDrive } from './services/ruleRegistry';
import { getRunningAppsForCategories, closeRunningApps } from './services/processService';
import {
  DevScanOptions,
  FastSearchOptions,
  HistoryRecord,
  LargeFilesScanOptions,
  ScanOptions,
  ScanResult,
  DeepRecoveryScanOptions,
  DeepRecoveryItem,
} from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const scannerService = new ScannerService();
const cleanerService = new CleanerService();
const largeFileService = new LargeFileService();
const devCleanerService = new DevCleanerService();
const historyService = new HistoryService();
const fastSearchService = new FastSearchService();
const virtualDiskService = new VirtualDiskService();
const duplicateService = new DuplicateService();
const emptyFolderService = new EmptyFolderService();
const dismService = new DismService();
const contextMenuService = new ContextMenuService();
const recoveryService = new RecoveryService();
let latestScanResult: ScanResult | null = null;

function parsePathArg(argv: string[]): string | null {
  const startIndex = app.isPackaged ? 1 : 2;
  const appRoot = path.resolve(app.getAppPath()).toLowerCase();
  const cwdRoot = path.resolve(process.cwd()).toLowerCase();

  for (const raw of argv.slice(startIndex)) {
    if (!raw || raw.startsWith('--') || raw.startsWith('-')) continue;
    try {
      let clean = raw.replace(/^["']+|["']+$/g, '').trim();
      if (!clean || clean === '.' || clean === './' || clean === '.\\') continue;
      if (/^[A-Za-z]:$/.test(clean)) {
        clean = `${clean}\\`;
      }
      if (fs.existsSync(clean) && fs.statSync(clean).isDirectory()) {
        const resolved = path.resolve(clean);
        const lower = resolved.toLowerCase();
        if (lower === appRoot || lower === cwdRoot) continue;
        return resolved;
      }
    } catch {
      // Ignore unreadable argument
    }
  }
  return null;
}

// Single instance lock to prevent duplicate app windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const targetPath = parsePathArg(commandLine);
      if (targetPath) {
        mainWindow.webContents.send('cleaner:open-target-path', targetPath);
      }
    }
  });

  function createWindow() {
    const iconPath = path.join(app.getAppPath(), 'build', 'icon.png');
    mainWindow = new BrowserWindow({
      width: 980,
      height: 700,
      minWidth: 680,
      minHeight: 400,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      webPreferences: {
        preload: path.join(app.getAppPath(), 'dist-electron/preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      show: false,
    });

    mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      console.error('Failed to load page:', errorCode, errorDescription);
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
      const initialPath = parsePathArg(process.argv);
      if (initialPath) {
        mainWindow?.webContents.send('cleaner:open-target-path', initialPath);
      }
    });

    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    }
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

// --- IPC HANDLERS ---

ipcMain.handle('cleaner:get-drive-stats', async () => {
  return await getDriveTelemetry();
});

ipcMain.handle('cleaner:get-categories', async (_, driveLetter?: string) => {
  return getCategoryDefinitionsForDrive(driveLetter);
});

ipcMain.handle('cleaner:start-scan', async (_, options?: ScanOptions) => {
  const result = await scannerService.scan(options, (progress) => {
    mainWindow?.webContents.send('cleaner:scan-progress', progress);
  });
  latestScanResult = result;
  return result;
});

ipcMain.handle('cleaner:cancel-scan', async () => {
  scannerService.cancelScan();
});

ipcMain.handle('cleaner:start-clean', async (_, categoryIds: string[]) => {
  const categoriesToClean = latestScanResult ? latestScanResult.categories : [];
  const report = await cleanerService.clean(categoriesToClean, categoryIds, (progress) => {
    mainWindow?.webContents.send('cleaner:clean-progress', progress);
  });
  if (report && report.reclaimedBytes > 0) {
    const firstCat = categoriesToClean[0];
    const driveLetter = firstCat?.name.match(/\(([A-Z]:)\)/i)?.[1] || 'C:';
    await historyService.addRecord({
      timestamp: Date.now(),
      driveLetter,
      module: 'system',
      reclaimedBytes: report.reclaimedBytes,
      filesCount: report.cleanedFilesCount,
      summary: `Cleaned ${categoryIds.length} categories (${report.cleanedFilesCount} files purged)`,
      elapsedMs: report.elapsedMs,
      items: report.items,
    });
  }
  return report;
});

ipcMain.handle('cleaner:cancel-clean', async () => {
  cleanerService.cancelClean();
});

ipcMain.handle('cleaner:get-running-apps', async (_, categoryIds: string[]) => {
  return await getRunningAppsForCategories(categoryIds || []);
});

ipcMain.handle('cleaner:close-apps', async (_, processNames: string[]) => {
  return await closeRunningApps(processNames || []);
});

ipcMain.handle('cleaner:open-path', async (_, targetPath: string) => {
  if (!targetPath) return;
  try {
    const resolved = path.resolve(targetPath);
    if (fs.existsSync(resolved)) {
      const stat = await fs.promises.stat(resolved).catch(() => null);
      if (stat && stat.isDirectory()) {
        await shell.openPath(resolved);
      } else {
        shell.showItemInFolder(resolved);
      }
    } else {
      const parentDir = path.dirname(resolved);
      if (fs.existsSync(parentDir)) {
        await shell.openPath(parentDir);
      }
    }
  } catch (err) {
    console.error('Failed to reveal path in explorer:', err);
  }
});

ipcMain.handle('cleaner:open-external-url', async (_, url: string) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

// --- LARGE FILES IPC ---
ipcMain.handle('cleaner:scan-large-files', async (_, options: LargeFilesScanOptions) => {
  return await largeFileService.scan(options, (progress) => {
    mainWindow?.webContents.send('cleaner:large-files-scan-progress', progress);
  });
});

ipcMain.handle('cleaner:cancel-scan-large-files', async () => {
  largeFileService.cancelScan();
});

ipcMain.handle('cleaner:delete-large-files', async (_, filePaths: string[]) => {
  const result = await largeFileService.deleteFiles(filePaths);
  if (result.reclaimedBytes > 0) {
    await historyService.addRecord({
      timestamp: Date.now(),
      driveLetter: path.parse(filePaths[0] || 'C:').root || 'C:',
      module: 'large_files',
      reclaimedBytes: result.reclaimedBytes,
      filesCount: result.deletedPaths.length,
      summary: `Purged ${result.deletedPaths.length} large space hogs`,
      items: result.deletedPaths.map((p) => ({
        name: path.basename(p),
        path: p,
        sizeBytes: 0,
        category: 'Large File',
        status: 'purged' as const,
      })),
    });
  }
  return result;
});

// --- DEV ARTIFACTS IPC ---
ipcMain.handle('cleaner:scan-dev-artifacts', async (_, options: DevScanOptions) => {
  return await devCleanerService.scan(options, (progress) => {
    mainWindow?.webContents.send('cleaner:dev-scan-progress', progress);
  });
});

ipcMain.handle('cleaner:cancel-scan-dev', async () => {
  devCleanerService.cancelScan();
});

ipcMain.handle('cleaner:delete-dev-artifacts', async (_, artifactPaths: string[]) => {
  const result = await devCleanerService.deleteArtifacts(artifactPaths);
  if (result.reclaimedBytes > 0) {
    await historyService.addRecord({
      timestamp: Date.now(),
      driveLetter: path.parse(artifactPaths[0] || 'C:').root || 'C:',
      module: 'dev_projects',
      reclaimedBytes: result.reclaimedBytes,
      filesCount: result.deletedPaths.length,
      summary: `Purged ${result.deletedPaths.length} developer project directories (build artifacts)`,
      items: result.deletedPaths.map((p) => ({
        name: path.basename(p),
        path: p,
        sizeBytes: 0,
        category: 'Dev Artifact',
        status: 'purged' as const,
      })),
    });
  }
  return result;
});

ipcMain.handle('cleaner:select-folder-dialog', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Workspace Directory to Scan',
    properties: ['openDirectory'],
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

// --- HISTORY IPC ---
ipcMain.handle('cleaner:get-history', async () => {
  return await historyService.getHistory();
});

ipcMain.handle('cleaner:save-history-record', async (_, record: Omit<HistoryRecord, 'id'>) => {
  await historyService.addRecord(record);
});

ipcMain.handle('cleaner:clear-history', async () => {
  await historyService.clearHistory();
});

ipcMain.handle('cleaner:export-history', async (_, format: 'json' | 'txt') => {
  return await historyService.exportHistory(format);
});

// --- FAST FILE SEARCH IPC ---
ipcMain.handle('cleaner:start-fast-search', async (_, options: FastSearchOptions) => {
  return await fastSearchService.search(
    options,
    (progress) => {
      mainWindow?.webContents.send('cleaner:fast-search-progress', progress);
    },
    (batch) => {
      mainWindow?.webContents.send('cleaner:fast-search-batch', batch);
    }
  );
});

ipcMain.handle('cleaner:cancel-fast-search', async () => {
  fastSearchService.cancelSearch();
});

ipcMain.handle('cleaner:open-file', async (_, filePath: string) => {
  if (!filePath) return;
  try {
    await shell.openPath(filePath);
  } catch (err) {
    console.error('Failed to open file:', err);
  }
});

ipcMain.handle('cleaner:delete-file', async (_, filePath: string) => {
  if (!filePath) return false;
  return await fastSearchService.deleteFile(filePath);
});

// --- VIRTUAL DISKS (WSL2 & DOCKER) IPC ---
ipcMain.handle('cleaner:scan-vdisks', async () => {
  return await virtualDiskService.scanVirtualDisks();
});

ipcMain.handle('cleaner:compact-vdisk', async (_, vhdxPath: string) => {
  const result = await virtualDiskService.compactVirtualDisk(vhdxPath);
  if (result.success && result.reclaimedBytes > 0) {
    const driveLetter = path.parse(vhdxPath).root || 'C:';
    await historyService.addRecord({
      timestamp: Date.now(),
      driveLetter,
      module: 'tools',
      reclaimedBytes: result.reclaimedBytes,
      filesCount: 1,
      summary: `Compacted Virtual Disk (${path.basename(vhdxPath)})`,
    });
  }
  return result;
});

// --- DUPLICATE FILES HUNTER IPC ---
ipcMain.handle('cleaner:scan-duplicates', async (_, options: any) => {
  return await duplicateService.scanDuplicates(options, (progress) => {
    mainWindow?.webContents.send('cleaner:duplicate-scan-progress', progress);
  });
});

ipcMain.handle('cleaner:cancel-scan-duplicates', async () => {
  duplicateService.cancelScan();
});

ipcMain.handle('cleaner:delete-duplicates', async (_, filePaths: string[], useTrash: boolean = true) => {
  const result = await duplicateService.deleteDuplicates(filePaths, useTrash);
  if (result.deletedPaths.length > 0 && result.reclaimedBytes > 0) {
    const first = result.deletedPaths[0];
    const driveLetter = path.parse(first).root || 'C:';
    await historyService.addRecord({
      timestamp: Date.now(),
      driveLetter,
      module: 'duplicates',
      reclaimedBytes: result.reclaimedBytes,
      filesCount: result.deletedPaths.length,
      summary: `Purged ${result.deletedPaths.length} duplicate files`,
      items: result.deletedPaths.map((p) => ({
        name: path.basename(p),
        path: p,
        sizeBytes: 0,
        category: 'Duplicate File',
        status: 'purged' as const,
      })),
    });
  }
  return result;
});

// --- EMPTY FOLDERS SWEEPER IPC ---
ipcMain.handle('cleaner:scan-empty-folders', async (_, targetPath: string) => {
  return await emptyFolderService.scanEmptyFolders(targetPath);
});

ipcMain.handle('cleaner:delete-empty-folders', async (_, folderPaths: string[]) => {
  return await emptyFolderService.deleteEmptyFolders(folderPaths);
});

// --- DISM COMPONENT STORE IPC ---
ipcMain.handle('cleaner:analyze-component-store', async () => {
  return await dismService.analyzeComponentStore();
});

ipcMain.handle('cleaner:clean-component-store', async () => {
  return await dismService.cleanComponentStore();
});

// --- WINDOWS CONTEXT MENU IPC ---
ipcMain.handle('cleaner:get-context-menu-status', async () => {
  return await contextMenuService.getStatus();
});

ipcMain.handle('cleaner:set-context-menu-status', async (_, enable: boolean) => {
  return await contextMenuService.setStatus(enable);
});

// --- FILE RECOVERY (RECYCLE BIN & DEEP RECOVERY) IPC ---
ipcMain.handle('cleaner:get-recycle-bin-items', async () => {
  return await recoveryService.getRecycleBinItems();
});

ipcMain.handle('cleaner:restore-recycle-bin-items', async (_, itemPaths: string[]) => {
  return await recoveryService.restoreRecycleBinItems(itemPaths);
});

ipcMain.handle('cleaner:delete-recycle-bin-items', async (_, itemPaths: string[]) => {
  return await recoveryService.deleteRecycleBinItems(itemPaths);
});

ipcMain.handle('cleaner:empty-recycle-bin', async () => {
  return await recoveryService.emptyRecycleBin();
});

ipcMain.handle('cleaner:scan-deep-recovery', async (_, options: DeepRecoveryScanOptions) => {
  return await recoveryService.scanDeepRecovery(options, (progress) => {
    mainWindow?.webContents.send('cleaner:deep-recovery-progress', progress);
  });
});

ipcMain.handle('cleaner:cancel-deep-recovery', async () => {
  recoveryService.cancelDeepRecovery();
});

ipcMain.handle('cleaner:recover-deep-files', async (_, items: DeepRecoveryItem[], destinationDir: string) => {
  return await recoveryService.recoverDeepFiles(items, destinationDir);
});

// Window controls
ipcMain.on('cleaner:window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('cleaner:window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('cleaner:window-close', () => {
  mainWindow?.close();
});
