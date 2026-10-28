import { exec } from 'child_process';
import util from 'util';
import type { DriveStat } from '../../shared/types.ts';

const execPromise = util.promisify(exec);

export async function getDriveTelemetry(): Promise<DriveStat[]> {
  try {
    const cmd =
      'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json"';
    const { stdout } = await execPromise(cmd);
    if (!stdout.trim()) {
      return [];
    }

    const parsed = JSON.parse(stdout);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    return list.map((item: any) => {
      const totalBytes = Number(item.Size) || 0;
      const freeBytes = Number(item.FreeSpace) || 0;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

      return {
        letter: String(item.DeviceID || '').toUpperCase(),
        label: String(item.VolumeName || item.DeviceID || 'Local Disk'),
        totalBytes,
        freeBytes,
        usedBytes,
        usedPercent,
      };
    });
  } catch (error) {
    console.error('Failed to query drive telemetry:', error);
    return [];
  }
}
