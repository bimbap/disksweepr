import { app, BrowserWindow, Menu, Tray, nativeImage, shell, Notification, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { settingsStore } from './settingsStore';
import { updateService } from './updateService';

export class TrayService {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private updatePopupWindow: BrowserWindow | null = null;
  private onQuitCallback: (() => void) | null = null;

  public init(window: BrowserWindow, onQuit: () => void): void {
    this.mainWindow = window;
    this.onQuitCallback = onQuit;
    this.createTray();
  }

  private getIconPath(): string {
    const appPath = app.getAppPath();
    const icoPath = path.join(appPath, 'build', 'icon.ico');
    const pngPath = path.join(appPath, 'build', 'icon.png');

    if (process.platform === 'win32' && fs.existsSync(icoPath)) {
      return icoPath;
    }
    if (fs.existsSync(pngPath)) {
      return pngPath;
    }
    return '';
  }

  private getNotificationIconPath(): string {
    const appPath = app.getAppPath();
    const pngPath = path.join(appPath, 'build', 'icon.png');
    const icoPath = path.join(appPath, 'build', 'icon.ico');

    if (fs.existsSync(pngPath)) {
      return pngPath;
    }
    if (fs.existsSync(icoPath)) {
      return icoPath;
    }
    return '';
  }

  public createTray(): void {
    // If a tray already exists, destroy it first to guarantee zero duplicate system tray icons
    if (this.tray) {
      this.destroy();
    }

    const iconPath = this.getIconPath();
    let trayIcon = nativeImage.createEmpty();
    if (iconPath) {
      trayIcon = nativeImage.createFromPath(iconPath);
      if (trayIcon.isEmpty() && iconPath.endsWith('.ico')) {
        const fallbackPng = path.join(app.getAppPath(), 'build', 'icon.png');
        if (fs.existsSync(fallbackPng)) {
          trayIcon = nativeImage.createFromPath(fallbackPng);
        }
      }
    }

    try {
      this.tray = new Tray(trayIcon);
      this.tray.setToolTip('DiskSweepr - Storage Cleanup Utility');
      this.updateContextMenu();

      // Windows emits `click` twice before `double-click`; debounce single clicks
      // so double-clicking the tray icon never runs a show -> hide -> show flash.
      let clickTimer: ReturnType<typeof setTimeout> | null = null;
      const clearClickTimer = () => {
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
      };

      this.tray.on('click', () => {
        clearClickTimer();
        clickTimer = setTimeout(() => {
          clickTimer = null;
          if (!this.tray || this.tray.isDestroyed()) return;
          this.toggleWindow();
        }, 250);
        clickTimer.unref?.();
      });

      this.tray.on('double-click', () => {
        clearClickTimer();
        this.showWindow();
      });
    } catch (err) {
      console.error('Failed to create System Tray:', err);
    }
  }

  public destroy(): void {
    if (this.updatePopupWindow && !this.updatePopupWindow.isDestroyed()) {
      try {
        this.updatePopupWindow.close();
      } catch {}
      this.updatePopupWindow = null;
    }
    if (this.tray) {
      try {
        this.tray.destroy();
      } catch {
        // Silently catch if already disposed
      }
      this.tray = null;
    }
  }

  public updateContextMenu(): void {
    if (!this.tray) return;

    const settings = settingsStore.get();
    const isId = settings.language === 'id';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: isId ? 'Buka DiskSweepr' : 'Open DiskSweepr',
        type: 'normal',
        click: () => this.showWindow(),
      },
      { type: 'separator' },
      {
        label: isId ? 'Periksa Pembaruan...' : 'Check for Updates...',
        type: 'normal',
        click: () => {
          this.handleTrayCheckForUpdates();
        },
      },
      {
        label: 'GitHub Repository',
        type: 'normal',
        click: () => {
          shell.openExternal('https://github.com/bimbap/disksweepr');
        },
      },
      { type: 'separator' },
      {
        label: isId ? 'Keluar dari DiskSweepr' : 'Quit DiskSweepr',
        type: 'normal',
        click: () => {
          if (this.onQuitCallback) {
            this.onQuitCallback();
          } else {
            app.quit();
          }
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private async handleTrayCheckForUpdates(): Promise<void> {
    const currentVersion = app.getVersion();

    // Check updates in background without unhiding the main window
    try {
      const info = await updateService.checkForUpdates();

      if (info.available) {
        this.showCustomUpdatePopup({
          status: 'available',
          currentVersion,
          latestVersion: info.latestVersion,
          releaseName: info.releaseName,
          info,
        });
      } else {
        this.showCustomUpdatePopup({
          status: 'latest',
          currentVersion,
        });
      }
    } catch {
      this.showCustomUpdatePopup({
        status: 'error',
        currentVersion,
      });
    }
  }

  private showCustomUpdatePopup(payload: {
    status: 'latest' | 'available' | 'error';
    currentVersion: string;
    latestVersion?: string;
    releaseName?: string;
    info?: any;
  }): void {
    if (this.updatePopupWindow && !this.updatePopupWindow.isDestroyed()) {
      try {
        this.updatePopupWindow.close();
      } catch {}
      this.updatePopupWindow = null;
    }

    const settings = settingsStore.get();
    const isId = settings.language === 'id';
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const popupWidth = 418;
    const popupHeight = payload.status === 'available' ? 208 : 174;
    const x = Math.round((screenWidth - popupWidth) / 2);
    const y = Math.round((screenHeight - popupHeight) / 2);

    this.updatePopupWindow = new BrowserWindow({
      width: popupWidth,
      height: popupHeight,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const isAvailable = payload.status === 'available';
    const isError = payload.status === 'error';

    // Load actual high-res DiskSweepr logo in base64
    const appPath = app.getAppPath();
    const iconCandidates = [
      path.join(appPath, 'build', 'icon.png'),
      path.join(appPath, 'public', 'icon.png'),
    ];
    let logoDataUrl = '';
    for (const cand of iconCandidates) {
      if (fs.existsSync(cand)) {
        try {
          const buf = fs.readFileSync(cand);
          logoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
          break;
        } catch {}
      }
    }

    const titleText = isAvailable
      ? (isId ? `Pembaruan Tersedia` : `Update Available`)
      : isError
      ? (isId ? `Pemeriksaan Gagal` : `Check Failed`)
      : (isId ? `DiskSweepr Sudah Versi Terbaru` : `DiskSweepr is Up to Date`);

    const versionBadge = isAvailable
      ? (payload.releaseName || `v${payload.latestVersion}`)
      : `v${payload.currentVersion}`;

    const descText = isAvailable
      ? (isId
          ? `Versi baru <strong>${versionBadge}</strong> telah dirilis. Versi Anda saat ini: <strong>v${payload.currentVersion}</strong>. Unduh sekarang untuk fitur dan perbaikan terbaru.`
          : `A new version <strong>${versionBadge}</strong> is now available. You are running <strong>v${payload.currentVersion}</strong>.`)
      : isError
      ? (isId
          ? `Tidak dapat terhubung ke GitHub Releases. Pastikan koneksi internet Anda aktif lalu coba beberapa saat lagi.`
          : `Could not connect to GitHub Releases. Please check your internet connection and try again.`)
      : (isId
          ? `DiskSweepr <strong>v${payload.currentVersion}</strong> adalah versi terbaru. Sistem penyimpanan Anda tetap aman, bersih, dan optimal.`
          : `DiskSweepr <strong>v${payload.currentVersion}</strong> is currently the newest version available. Your system storage is optimal.`);

    // High quality status pip indicator SVGs
    const miniPipSvg = isAvailable
      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
      : isError
      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;

    const badgeClass = isAvailable ? 'update' : isError ? 'warning' : 'success';

    const buttonsHtml = isAvailable
      ? `<a href="action:update" class="btn btn-primary">${isId ? 'Buka & Perbarui' : 'Open & Update'}</a>
         <a href="action:close" class="btn btn-ghost">${isId ? 'Nanti Saja' : 'Later'}</a>`
      : `<a href="action:close" class="btn btn-primary">${isId ? 'Tutup' : 'OK'}</a>`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .card {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #111827 0%, #090d16 100%);
      border: 1px solid rgba(56, 189, 248, 0.28);
      border-radius: 14px;
      box-shadow: none;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes popIn {
      0% { opacity: 0; transform: scale(0.97); }
      100% { opacity: 1; transform: scale(1); }
    }
    .header {
      -webkit-app-region: drag;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px 6px 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .brand-icon {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      object-fit: contain;
    }
    .brand-fallback-icon {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      background: #0284c7;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: -0.05em;
    }
    .brand-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .close-btn {
      -webkit-app-region: no-drag;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 15px;
      text-decoration: none;
      transition: all 0.15s ease;
      line-height: 1;
    }
    .close-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
    }
    .body {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 4px 18px 8px 18px;
      gap: 14px;
    }
    .logo-wrapper {
      position: relative;
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }
    .main-app-logo {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      object-fit: cover;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: block;
    }
    .main-app-fallback {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #0ea5e9;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      font-weight: 800;
    }
    .status-pip {
      position: absolute;
      bottom: -3px;
      right: -3px;
      width: 19px;
      height: 19px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #0b0f19;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
    }
    .status-pip.success {
      background: #10b981;
    }
    .status-pip.update {
      background: #0ea5e9;
    }
    .status-pip.warning {
      background: #f59e0b;
    }
    .text-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .title {
      font-size: 14.5px;
      font-weight: 600;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }
    .desc {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.45;
    }
    .desc strong {
      color: #e2e8f0;
      font-weight: 600;
    }
    .footer {
      -webkit-app-region: no-drag;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 0 16px 14px 16px;
    }
    .btn {
      font-size: 12px;
      font-weight: 600;
      padding: 6px 16px;
      border-radius: 7px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff;
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
    }
    .btn-primary:hover {
      background: linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%);
      box-shadow: 0 4px 14px rgba(14, 165, 233, 0.45);
    }
    .btn-ghost {
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #f8fafc;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">
        ${logoDataUrl ? `<img src="${logoDataUrl}" class="brand-icon" alt="DiskSweepr" />` : `<div class="brand-fallback-icon">DS</div>`}
        <span class="brand-title">DiskSweepr</span>
      </div>
      <a href="action:close" class="close-btn" title="Close">✕</a>
    </div>
    <div class="body">
      <div class="logo-wrapper">
        ${logoDataUrl ? `<img src="${logoDataUrl}" class="main-app-logo" alt="DiskSweepr" />` : `<div class="main-app-fallback">DS</div>`}
        <div class="status-pip ${badgeClass}">
          ${miniPipSvg}
        </div>
      </div>
      <div class="text-block">
        <div class="title">${titleText}</div>
        <div class="desc">${descText}</div>
      </div>
    </div>
    <div class="footer">
      ${buttonsHtml}
    </div>
  </div>
</body>
</html>`;

    this.updatePopupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    this.updatePopupWindow.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      if (url.includes('action:close')) {
        this.updatePopupWindow?.close();
      } else if (url.includes('action:update')) {
        this.updatePopupWindow?.close();
        this.showWindow();
        if (payload.info) {
          this.mainWindow?.webContents.send('cleaner:update-available', payload.info);
        }
        this.mainWindow?.webContents.send('cleaner:trigger-check-updates');
      }
    });

    this.updatePopupWindow.once('ready-to-show', () => {
      this.updatePopupWindow?.show();
    });

    this.updatePopupWindow.on('closed', () => {
      this.updatePopupWindow = null;
    });
  }

  public showWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    if (!this.mainWindow.isVisible()) {
      this.mainWindow.show();
    }
    this.mainWindow.focus();
  }

  public hideWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.hide();
  }

  public toggleWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isVisible() && !this.mainWindow.isMinimized()) {
      this.mainWindow.hide();
    } else {
      this.showWindow();
    }
  }

  public notifyMinimized(): void {
    const settings = settingsStore.get();
    if (!settings.notifyOnMinimizeToTray) return;

    const isId = settings.language === 'id';
    const title = 'DiskSweepr';
    const body = isId
      ? 'DiskSweepr berjalan di latar belakang. Klik ikon tray di taskbar untuk membuka kembali.'
      : 'DiskSweepr continues running in the system tray. Click the tray icon to reopen.';

    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        icon: this.getNotificationIconPath(),
        silent: true,
      });
      notification.on('click', () => this.showWindow());
      notification.show();
    } else if (this.tray && process.platform === 'win32') {
      this.tray.displayBalloon({
        title,
        content: body,
        iconType: 'info',
      });
    }
  }
}

export const trayService = new TrayService();

