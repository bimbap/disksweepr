import { app, BrowserWindow } from 'electron';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import type { UpdateInfo, UpdateDownloadProgress } from '../../shared/types.ts';
import { settingsStore } from './settingsStore';

export class UpdateService {
  private mainWindow: BrowserWindow | null = null;
  private isDownloading: boolean = false;

  public init(window: BrowserWindow): void {
    this.mainWindow = window;

    // Check automatically on startup if enabled
    setTimeout(async () => {
      const settings = settingsStore.get();
      if (settings.autoCheckUpdates) {
        try {
          const info = await this.checkForUpdates();
          if (info.available) {
            this.mainWindow?.webContents.send('cleaner:update-available', info);
          }
        } catch {
          // Silent catch on background startup check
        }
      }
    }, 6000);
  }

  public compareVersions(v1: string, v2: string): number {
    const clean1 = v1.replace(/^v/, '').trim();
    const clean2 = v2.replace(/^v/, '').trim();

    const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

    const len = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < len; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  public async checkForUpdates(): Promise<UpdateInfo> {
    const currentVersion = app.getVersion();

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/bimbap/disksweepr/releases/latest',
        headers: {
          'User-Agent': 'DiskSweepr-Desktop-App',
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 8000,
      };

      const req = https.get(options, (res) => {
        if (res.statusCode === 404 || res.statusCode! >= 400) {
          resolve({
            available: false,
            currentVersion,
            latestVersion: currentVersion,
            releaseName: `v${currentVersion}`,
            releaseNotes: 'No published releases found.',
            publishedAt: new Date().toISOString(),
            htmlUrl: 'https://github.com/bimbap/disksweepr/releases',
          });
          return;
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const tagName = (release.tag_name || '').trim();
            const latestVer = tagName.replace(/^v/, '');
            const isNewer = this.compareVersions(latestVer, currentVersion) > 0;

            let downloadUrl: string | undefined;
            if (Array.isArray(release.assets)) {
              // Prioritize full offline setup (DiskSweepr-Setup-*.exe) for 100% reliable local installation
              const setupAsset =
                release.assets.find(
                  (a: any) =>
                    a.name &&
                    a.name.toLowerCase().includes('setup') &&
                    !a.name.toLowerCase().includes('web') &&
                    a.name.toLowerCase().endsWith('.exe')
                ) ||
                release.assets.find(
                  (a: any) =>
                    a.name &&
                    a.name.toLowerCase().includes('setup') &&
                    a.name.toLowerCase().endsWith('.exe')
                ) ||
                release.assets.find(
                  (a: any) => a.name && a.name.toLowerCase().endsWith('.exe')
                );

              if (setupAsset && setupAsset.browser_download_url) {
                downloadUrl = setupAsset.browser_download_url;
              }
            }

            if (!downloadUrl && tagName) {
              downloadUrl = `https://github.com/bimbap/disksweepr/releases/download/${tagName}/DiskSweepr-Setup-${latestVer}.exe`;
            }

            resolve({
              available: isNewer,
              currentVersion,
              latestVersion: latestVer || currentVersion,
              releaseName: release.name || tagName || `v${latestVer}`,
              releaseNotes: release.body || 'Performance improvements and bug fixes.',
              publishedAt: release.published_at || new Date().toISOString(),
              downloadUrl,
              htmlUrl: release.html_url || 'https://github.com/bimbap/disksweepr/releases',
            });
          } catch (err) {
            resolve({
              available: false,
              currentVersion,
              latestVersion: currentVersion,
              releaseName: `v${currentVersion}`,
              releaseNotes: '',
              publishedAt: new Date().toISOString(),
              htmlUrl: 'https://github.com/bimbap/disksweepr/releases',
            });
          }
        });
      });

      req.on('error', () => {
        resolve({
          available: false,
          currentVersion,
          latestVersion: currentVersion,
          releaseName: `v${currentVersion}`,
          releaseNotes: '',
          publishedAt: new Date().toISOString(),
          htmlUrl: 'https://github.com/bimbap/disksweepr/releases',
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          available: false,
          currentVersion,
          latestVersion: currentVersion,
          releaseName: `v${currentVersion}`,
          releaseNotes: '',
          publishedAt: new Date().toISOString(),
          htmlUrl: 'https://github.com/bimbap/disksweepr/releases',
        });
      });
    });
  }

  public async downloadUpdate(
    downloadUrl: string,
    onProgress?: (progress: UpdateDownloadProgress) => void
  ): Promise<{ success: boolean; installerPath?: string; error?: string }> {
    if (this.isDownloading) {
      return { success: false, error: 'Download already in progress.' };
    }

    this.isDownloading = true;
    const destPath = path.join(os.tmpdir(), 'DiskSweepr-Setup-Update.exe');

    return new Promise((resolve) => {
      const downloadWithRedirect = (currentUrl: string, maxRedirects = 5) => {
        if (maxRedirects <= 0) {
          this.isDownloading = false;
          resolve({ success: false, error: 'Too many redirects.' });
          return;
        }

        const req = https.get(
          currentUrl,
          {
            headers: {
              'User-Agent': 'DiskSweepr-Desktop-App',
            },
          },
          (res) => {
            // Handle redirects (GitHub release asset redirects to AWS S3)
            if (
              (res.statusCode === 301 ||
                res.statusCode === 302 ||
                res.statusCode === 307 ||
                res.statusCode === 308) &&
              res.headers.location
            ) {
              downloadWithRedirect(res.headers.location, maxRedirects - 1);
              return;
            }

            if (res.statusCode !== 200) {
              this.isDownloading = false;
              resolve({ success: false, error: `HTTP ${res.statusCode}` });
              return;
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let transferredBytes = 0;
            const fileStream = fs.createWriteStream(destPath);

            res.on('data', (chunk) => {
              transferredBytes += chunk.length;
              const percent = totalBytes > 0 ? (transferredBytes / totalBytes) * 100 : 0;
              onProgress?.({
                percent,
                transferredBytes,
                totalBytes,
              });
              this.mainWindow?.webContents.send('cleaner:update-download-progress', {
                percent,
                transferredBytes,
                totalBytes,
              });
            });

            res.pipe(fileStream);

            fileStream.on('finish', () => {
              fileStream.close();
              this.isDownloading = false;
              resolve({ success: true, installerPath: destPath });
            });

            fileStream.on('error', (err) => {
              this.isDownloading = false;
              try {
                fs.unlinkSync(destPath);
              } catch {}
              resolve({ success: false, error: err.message });
            });
          }
        );

        req.on('error', (err) => {
          this.isDownloading = false;
          resolve({ success: false, error: err.message });
        });
      };

      downloadWithRedirect(downloadUrl);
    });
  }

  public installUpdate(installerPath: string): void {
    if (!fs.existsSync(installerPath)) {
      throw new Error(`Installer file not found at ${installerPath}`);
    }

    // Spawn installer detached so it continues after app exits
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    app.quit();
  }
}

export const updateService = new UpdateService();

