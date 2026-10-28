import fs from 'fs';
import path from 'path';
import { app, dialog } from 'electron';
import { HistoryRecord } from '../../shared/types';

export class HistoryService {
  private getFilePath(): string {
    const dataDir = app.getPath('userData');
    return path.join(dataDir, 'cleaner_history.json');
  }

  public async getHistory(): Promise<HistoryRecord[]> {
    try {
      const filePath = this.getFilePath();
      if (!fs.existsSync(filePath)) {
        return [];
      }
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const records = JSON.parse(raw);
      if (Array.isArray(records)) {
        return records.sort((a, b) => b.timestamp - a.timestamp);
      }
      return [];
    } catch {
      return [];
    }
  }

  public async addRecord(record: Omit<HistoryRecord, 'id'>): Promise<void> {
    try {
      const current = await this.getHistory();
      const newRecord: HistoryRecord = {
        ...record,
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };
      const updated = [newRecord, ...current].slice(0, 100); // Keep last 100 records
      const filePath = this.getFilePath();
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save history record:', err);
    }
  }

  public async clearHistory(): Promise<void> {
    try {
      const filePath = this.getFilePath();
      if (fs.existsSync(filePath)) {
        await fs.promises.writeFile(filePath, '[]', 'utf-8');
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  public async exportHistory(format: 'json' | 'txt'): Promise<boolean> {
    try {
      const records = await this.getHistory();
      if (records.length === 0) return false;

      const dateStr = new Date().toISOString().split('T')[0];
      const defaultFileName = `disksweepr_audit_log_${dateStr}.${format}`;

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export DiskSweepr Audit Log',
        defaultPath: defaultFileName,
        filters:
          format === 'json'
            ? [{ name: 'JSON Document', extensions: ['json'] }]
            : [{ name: 'Text Document', extensions: ['txt'] }],
      });

      if (canceled || !filePath) {
        return false;
      }

      if (format === 'json') {
        await fs.promises.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
      } else {
        let content = `=======================================================\n`;
        content += `       DISKSWEEPR AUDIT & STORAGE HISTORY LOG          \n`;
        content += `          Exported on: ${new Date().toLocaleString()}  \n`;
        content += `=======================================================\n\n`;

        let totalLifetimeReclaimed = 0;
        let totalFilesDeleted = 0;

        for (const r of records) {
          totalLifetimeReclaimed += r.reclaimedBytes;
          totalFilesDeleted += r.filesCount;
          const date = new Date(r.timestamp).toLocaleString();
          const sizeMB = (r.reclaimedBytes / (1024 * 1024)).toFixed(2);
          content += `[${date}] Drive ${r.driveLetter} | Module: ${r.module.toUpperCase()}\n`;
          content += `  - Reclaimed: ${sizeMB} MB (${r.filesCount} files/folders)\n`;
          content += `  - Summary: ${r.summary}\n`;
          content += `-------------------------------------------------------\n`;
        }

        content += `\nLIFETIME TOTAL RECLAIMED: ${(totalLifetimeReclaimed / (1024 * 1024 * 1024)).toFixed(2)} GB (${totalFilesDeleted} items purged)\n`;
        await fs.promises.writeFile(filePath, content, 'utf-8');
      }

      return true;
    } catch (err) {
      console.error('Failed to export history:', err);
      return false;
    }
  }
}
