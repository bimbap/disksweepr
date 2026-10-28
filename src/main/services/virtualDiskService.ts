import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import { CompactVDiskResult, VirtualDiskItem } from '../../shared/types';

const execPromise = util.promisify(exec);

export class VirtualDiskService {
  /**
   * Scans default WSL2 and Docker Desktop locations for ext4.vhdx files
   */
  public async scanVirtualDisks(): Promise<VirtualDiskItem[]> {
    const results: VirtualDiskItem[] = [];
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

    // 1. Scan WSL2 Distribution Packages
    const packagesDir = path.join(localAppData, 'Packages');
    if (fs.existsSync(packagesDir)) {
      try {
        const entries = await fs.promises.readdir(packagesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const vhdxPath = path.join(packagesDir, entry.name, 'LocalState', 'ext4.vhdx');
          if (fs.existsSync(vhdxPath)) {
            try {
              const stat = await fs.promises.stat(vhdxPath);
              let distroName = entry.name;
              if (distroName.includes('Ubuntu')) distroName = 'Ubuntu (WSL2)';
              else if (distroName.includes('Debian')) distroName = 'Debian (WSL2)';
              else if (distroName.includes('kali')) distroName = 'Kali Linux (WSL2)';
              else if (distroName.includes('openSUSE')) distroName = 'openSUSE (WSL2)';

              results.push({
                id: `wsl_${entry.name}`,
                name: `${distroName} Virtual Disk`,
                path: vhdxPath,
                sizeBytes: stat.size,
                type: 'wsl',
                distroName,
              });
            } catch {
              // Unreadable or in use
            }
          }
        }
      } catch {
        // Packages unreadable
      }
    }

    // 2. Scan Docker Desktop WSL Data & Distro
    const dockerWslDir = path.join(localAppData, 'Docker', 'wsl');
    if (fs.existsSync(dockerWslDir)) {
      const dockerCandidates = [
        { sub: 'data', name: 'Docker Desktop Data (WSL2)' },
        { sub: 'distro', name: 'Docker Desktop Distro (WSL2)' },
      ];

      for (const item of dockerCandidates) {
        const vhdxPath = path.join(dockerWslDir, item.sub, 'ext4.vhdx');
        if (fs.existsSync(vhdxPath)) {
          try {
            const stat = await fs.promises.stat(vhdxPath);
            results.push({
              id: `docker_${item.sub}`,
              name: item.name,
              path: vhdxPath,
              sizeBytes: stat.size,
              type: 'docker',
              distroName: 'Docker Desktop',
            });
          } catch {
            // In use
          }
        }
      }
    }

    return results;
  }

  /**
   * Compacts a VHDX file using diskpart
   */
  public async compactVirtualDisk(vhdxPath: string): Promise<CompactVDiskResult> {
    if (!fs.existsSync(vhdxPath)) {
      return {
        path: vhdxPath,
        beforeBytes: 0,
        afterBytes: 0,
        reclaimedBytes: 0,
        success: false,
        error: 'Virtual disk file does not exist.',
      };
    }

    let beforeBytes = 0;
    try {
      beforeBytes = (await fs.promises.stat(vhdxPath)).size;
    } catch (e: any) {
      return {
        path: vhdxPath,
        beforeBytes: 0,
        afterBytes: 0,
        reclaimedBytes: 0,
        success: false,
        error: `Failed to inspect file size: ${e.message}`,
      };
    }

    // 1. Gracefully shutdown WSL to release file lock on ext4.vhdx
    try {
      await execPromise('wsl --shutdown', { timeout: 10000 });
      // Small pause to allow handles to close
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch {
      // WSL might not be running or installed; ignore
    }

    // 2. Create diskpart script in temp
    const tempScriptPath = path.join(os.tmpdir(), `disksweepr_compact_${Date.now()}.txt`);
    const cleanPath = vhdxPath.replace(/\//g, '\\');
    const diskpartCommands = [
      `select vdisk file="${cleanPath}"`,
      'attach vdisk readonly',
      'compact vdisk',
      'detach vdisk',
      'exit',
    ].join('\r\n');

    try {
      await fs.promises.writeFile(tempScriptPath, diskpartCommands, 'utf-8');

      // 3. Execute diskpart
      await execPromise(`diskpart /s "${tempScriptPath}"`, { timeout: 600000 }); // 10m timeout

      // 4. Measure new size
      const afterBytes = (await fs.promises.stat(vhdxPath)).size;
      const reclaimedBytes = Math.max(0, beforeBytes - afterBytes);

      return {
        path: vhdxPath,
        beforeBytes,
        afterBytes,
        reclaimedBytes,
        success: true,
      };
    } catch (err: any) {
      return {
        path: vhdxPath,
        beforeBytes,
        afterBytes: beforeBytes,
        reclaimedBytes: 0,
        success: false,
        error: err.message || 'Diskpart compaction failed.',
      };
    } finally {
      try {
        if (fs.existsSync(tempScriptPath)) {
          await fs.promises.unlink(tempScriptPath);
        }
      } catch {
        // Temporary file cleanup failure
      }
    }
  }
}

