import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { CleanProgress, ScanOptions, ScanProgress } from '../shared/types';

contextBridge.exposeInMainWorld('cleanerApi', {
  getDriveStats: () => ipcRenderer.invoke('cleaner:get-drive-stats'),
  getCategoryDefinitions: (driveLetter?: string) => ipcRenderer.invoke('cleaner:get-categories', driveLetter),

  startScan: (options?: ScanOptions) => ipcRenderer.invoke('cleaner:start-scan', options),
  cancelScan: () => ipcRenderer.invoke('cleaner:cancel-scan'),
  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const handler = (_: any, progress: ScanProgress) => callback(progress);
    ipcRenderer.on('cleaner:scan-progress', handler);
    return () => ipcRenderer.removeListener('cleaner:scan-progress', handler);
  },

  startClean: (categoryIds: string[]) => ipcRenderer.invoke('cleaner:start-clean', categoryIds),
  cancelClean: () => ipcRenderer.invoke('cleaner:cancel-clean'),
  getRunningApps: (categoryIds: string[]) => ipcRenderer.invoke('cleaner:get-running-apps', categoryIds),
  closeApps: (processNames: string[]) => ipcRenderer.invoke('cleaner:close-apps', processNames),
  onCleanProgress: (callback: (progress: CleanProgress) => void) => {
    const handler = (_: any, progress: CleanProgress) => callback(progress);
    ipcRenderer.on('cleaner:clean-progress', handler);
    return () => ipcRenderer.removeListener('cleaner:clean-progress', handler);
  },

  openPathInExplorer: (targetPath: string) => ipcRenderer.invoke('cleaner:open-path', targetPath),
  openExternalUrl: (url: string) => ipcRenderer.invoke('cleaner:open-external-url', url),
  onOpenTargetPath: (callback: (targetPath: string) => void) => {
    const handler = (_: any, path: string) => callback(path);
    ipcRenderer.on('cleaner:open-target-path', handler);
    return () => ipcRenderer.removeListener('cleaner:open-target-path', handler);
  },
  getPathForFile: (file: File): string => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) {
      console.warn('Failed to resolve path using webUtils:', e);
    }
    return (file as any).path || '';
  },

  // Large Files Hunter
  scanLargeFiles: (options: any) => ipcRenderer.invoke('cleaner:scan-large-files', options),
  cancelLargeFilesScan: () => ipcRenderer.invoke('cleaner:cancel-scan-large-files'),
  onLargeFilesScanProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('cleaner:large-files-scan-progress', handler);
    return () => ipcRenderer.removeListener('cleaner:large-files-scan-progress', handler);
  },
  deleteLargeFiles: (filePaths: string[]) => ipcRenderer.invoke('cleaner:delete-large-files', filePaths),

  // Developer Artifacts
  scanDevArtifacts: (options: any) => ipcRenderer.invoke('cleaner:scan-dev-artifacts', options),
  cancelDevScan: () => ipcRenderer.invoke('cleaner:cancel-scan-dev'),
  onDevScanProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('cleaner:dev-scan-progress', handler);
    return () => ipcRenderer.removeListener('cleaner:dev-scan-progress', handler);
  },
  deleteDevArtifacts: (artifactPaths: string[]) => ipcRenderer.invoke('cleaner:delete-dev-artifacts', artifactPaths),
  selectFolderDialog: () => ipcRenderer.invoke('cleaner:select-folder-dialog'),

  // History & Logs
  getHistory: () => ipcRenderer.invoke('cleaner:get-history'),
  saveHistoryRecord: (record: any) => ipcRenderer.invoke('cleaner:save-history-record', record),
  clearHistory: () => ipcRenderer.invoke('cleaner:clear-history'),
  exportHistory: (format: 'json' | 'txt') => ipcRenderer.invoke('cleaner:export-history', format),

  // Fast File Search
  startFastSearch: (options: any) => ipcRenderer.invoke('cleaner:start-fast-search', options),
  cancelFastSearch: () => ipcRenderer.invoke('cleaner:cancel-fast-search'),
  onFastSearchProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('cleaner:fast-search-progress', handler);
    return () => ipcRenderer.removeListener('cleaner:fast-search-progress', handler);
  },
  onFastSearchBatch: (callback: (batch: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('cleaner:fast-search-batch', handler);
    return () => ipcRenderer.removeListener('cleaner:fast-search-batch', handler);
  },
  openFile: (filePath: string) => ipcRenderer.invoke('cleaner:open-file', filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('cleaner:delete-file', filePath),

  minimizeWindow: () => ipcRenderer.send('cleaner:window-minimize'),
  maximizeWindow: () => ipcRenderer.send('cleaner:window-maximize'),
  closeWindow: () => ipcRenderer.send('cleaner:window-close'),
});
