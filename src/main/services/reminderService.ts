import { app, BrowserWindow, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import { settingsStore } from './settingsStore';

export class ReminderService {
  private checkIntervalTimer: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;

  public init(window: BrowserWindow): void {
    this.mainWindow = window;
    // Check shortly after startup (after 10s)
    setTimeout(() => {
      this.checkReminder();
    }, 10000);

    // Run check once every 2 hours
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
    }
    this.checkIntervalTimer = setInterval(() => {
      this.checkReminder();
    }, 2 * 60 * 60 * 1000);
  }

  private getIconPath(): string {
    const appPath = app.getAppPath();
    const pngPath = path.join(appPath, 'build', 'icon.png');
    const icoPath = path.join(appPath, 'build', 'icon.ico');

    // Windows Toast Notifications require clean high-res PNG for payload rendering
    if (fs.existsSync(pngPath)) {
      return pngPath;
    }
    if (fs.existsSync(icoPath)) {
      return icoPath;
    }
    return '';
  }

  public checkReminder(): boolean {
    const settings = settingsStore.get();
    const intervalDays = settings.cleanupReminderDays;

    // Disabled if 0
    if (intervalDays <= 0) return false;

    const now = Date.now();
    const lastClean = settings.lastCleanTimestamp || (now - intervalDays * 24 * 3600 * 1000);
    const lastNotified = settings.lastReminderNotifiedTimestamp || 0;

    const daysSinceClean = Math.floor((now - lastClean) / (1000 * 60 * 60 * 24));
    const daysSinceNotified = Math.floor((now - lastNotified) / (1000 * 60 * 60 * 24));

    if (daysSinceClean >= intervalDays && daysSinceNotified >= 1) {
      this.sendReminderNotification(daysSinceClean);
      settingsStore.update({ lastReminderNotifiedTimestamp: now });
      return true;
    }

    return false;
  }

  public sendReminderNotification(days: number): void {
    if (!Notification.isSupported()) return;

    const settings = settingsStore.get();
    const isId = settings.language === 'id';

    const title = isId ? 'DiskSweepr - Pengingat Pembersihan' : 'DiskSweepr - Storage Reminder';
    const body = isId
      ? `Sudah ${days} hari sejak pembersihan disk terakhir. Buka DiskSweepr untuk memeriksa file sampah dan optimasi drive.`
      : `It has been ${days} days since your last disk hygiene cleanup. Open DiskSweepr to reclaim valuable storage space.`;

    const notification = new Notification({
      title,
      body,
      icon: this.getIconPath(),
    });

    notification.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    notification.show();
  }

  public sendTestNotification(): boolean {
    if (!Notification.isSupported()) return false;

    const settings = settingsStore.get();
    const isId = settings.language === 'id';

    const title = isId ? 'DiskSweepr - Notifikasi Berfungsi' : 'DiskSweepr - Notifications Active';
    const body = isId
      ? 'Notifikasi pengingat pembersihan aktif dan berjalan normal di sistem Anda.'
      : 'Storage maintenance notifications are active and operating normally on your system.';

    const notification = new Notification({
      title,
      body,
      icon: this.getIconPath(),
    });

    notification.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    notification.show();
    return true;
  }

  public recordCleanAction(): void {
    settingsStore.update({
      lastCleanTimestamp: Date.now(),
      lastReminderNotifiedTimestamp: Date.now(),
    });
  }

  public destroy(): void {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }
  }
}

export const reminderService = new ReminderService();

