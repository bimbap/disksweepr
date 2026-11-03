import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { AppSettings } from '../../shared/types.ts';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'dark',
  closeToTray: true,
  enableTray: true,
  notifyOnMinimizeToTray: true,
  hasShownTrayBalloon: false,
  cleanupReminderDays: 7,
  defaultScanScope: 'full',
  lastCleanTimestamp: Date.now(),
  lastReminderNotifiedTimestamp: 0,
  autoCheckUpdates: true,
  confirmBeforeClean: true,
  warnRunningApps: true,
  autoTrashMedia: true,
  startWithWindows: false,
};

export class SettingsStore {
  private cachedSettings: AppSettings | null = null;

  private getFilePath(): string {
    const userData = app.getPath('userData');
    return path.join(userData, 'app_settings.json');
  }

  public get(): AppSettings {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      const filePath = this.getFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const settings: AppSettings = { ...DEFAULT_SETTINGS, ...parsed };
        this.cachedSettings = settings;
        return settings;
      }
    } catch (err) {
      console.warn('Failed to read app_settings.json, falling back to defaults:', err);
    }

    const fallback: AppSettings = { ...DEFAULT_SETTINGS };
    this.cachedSettings = fallback;
    return fallback;
  }

  public update(patch: Partial<AppSettings>): AppSettings {
    const current = this.get();
    const updated: AppSettings = { ...current, ...patch };
    this.cachedSettings = updated;

    try {
      const filePath = this.getFilePath();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write app_settings.json:', err);
    }

    return updated;
  }
}

export const settingsStore = new SettingsStore();

