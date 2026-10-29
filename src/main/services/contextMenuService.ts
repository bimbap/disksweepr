import { exec } from 'child_process';
import { app } from 'electron';
import util from 'util';
import { ContextMenuStatus } from '../../shared/types';

const execPromise = util.promisify(exec);

export class ContextMenuService {
  private baseKey = 'HKCU\\Software\\Classes\\Directory\\shell\\DiskSweepr';
  private bgKey = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\DiskSweepr';
  private driveKey = 'HKCU\\Software\\Classes\\Drive\\shell\\DiskSweepr';

  public async getStatus(): Promise<ContextMenuStatus> {
    try {
      await execPromise(`reg query "${this.baseKey}" /ve`);
      return { enabled: true };
    } catch {
      return { enabled: false };
    }
  }

  public async setStatus(enable: boolean): Promise<boolean> {
    const appPath = process.execPath.replace(/\//g, '\\');
    const appRoot = app.getAppPath().replace(/\//g, '\\');
    const launcherPrefix = app.isPackaged
      ? `\\"${appPath}\\"`
      : `\\"${appPath}\\" \\"${appRoot}\\"`;

    if (enable) {
      try {
        // 1. Directory right-click
        await execPromise(`reg add "${this.baseKey}" /ve /d "Scan with DiskSweepr" /f`);
        await execPromise(`reg add "${this.baseKey}" /v Icon /d "\\"${appPath}\\"" /f`);
        await execPromise(`reg add "${this.baseKey}\\command" /ve /d "${launcherPrefix} \\"%V\\"" /f`);

        // 2. Directory background right-click (inside folder)
        await execPromise(`reg add "${this.bgKey}" /ve /d "Scan with DiskSweepr" /f`);
        await execPromise(`reg add "${this.bgKey}" /v Icon /d "\\"${appPath}\\"" /f`);
        await execPromise(`reg add "${this.bgKey}\\command" /ve /d "${launcherPrefix} \\"%V\\"" /f`);

        // 3. Drive right-click
        await execPromise(`reg add "${this.driveKey}" /ve /d "Scan with DiskSweepr" /f`);
        await execPromise(`reg add "${this.driveKey}" /v Icon /d "\\"${appPath}\\"" /f`);
        await execPromise(`reg add "${this.driveKey}\\command" /ve /d "${launcherPrefix} \\"%V\\"" /f`);

        return true;
      } catch (err) {
        console.error('Failed to register context menu:', err);
        return false;
      }
    } else {
      try {
        await execPromise(`reg delete "${this.baseKey}" /f`).catch(() => {});
        await execPromise(`reg delete "${this.bgKey}" /f`).catch(() => {});
        await execPromise(`reg delete "${this.driveKey}" /f`).catch(() => {});
        return true;
      } catch {
        return false;
      }
    }
  }
}
