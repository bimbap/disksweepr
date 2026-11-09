import path from 'path';
import os from 'os';

/**
 * Validates whether a target path is a critical system file or directory
 * that must NEVER be deleted, modified, or unlinked.
 */
export function isProtectedSystemPath(targetPath: string): boolean {
  if (!targetPath) return true;
  const resolved = path.resolve(targetPath);
  const lower = resolved.toLowerCase().replace(/\\+$/, '');
  const baseName = path.basename(lower);

  // 1. Block Volume/Drive Roots (e.g. C:, C:\, D:, D:\)
  if (/^[a-z]:\\?$/i.test(lower) || /^[a-z]:$/i.test(lower)) {
    return true;
  }

  // 2. Block Critical System Registry Hives & OS Memory/Boot Files
  const criticalFiles = new Set([
    'ntuser.dat',
    'usrclass.dat',
    'bootmgr',
    'bootstat.dat',
    'pagefile.sys',
    'swapfile.sys',
    'hiberfil.sys',
  ]);
  if (criticalFiles.has(baseName) || baseName.startsWith('ntuser.dat.')) {
    return true;
  }

  // 3. Block Critical Windows Operating System Roots & Root Binaries
  const systemRoot = (process.env.SystemRoot || 'C:\\Windows').toLowerCase().replace(/\\+$/, '');
  if (lower === systemRoot) return true;
  if (path.dirname(lower) === systemRoot) return true;
  if (lower.startsWith(systemRoot + '\\system32')) return true;
  if (lower.startsWith(systemRoot + '\\syswow64')) return true;
  if (lower.startsWith(systemRoot + '\\winsxs')) return true;
  if (lower.startsWith(systemRoot + '\\diagnostics')) return true;

  // 4. Block Core Program Files & User Profile Roots
  const homeDir = os.homedir().toLowerCase().replace(/\\+$/, '');
  const userRoot = path.dirname(homeDir); // e.g. C:\Users
  if (lower === userRoot || lower === homeDir) return true;

  const userShellDirs = new Set([
    path.join(homeDir, 'desktop'),
    path.join(homeDir, 'documents'),
    path.join(homeDir, 'downloads'),
    path.join(homeDir, 'pictures'),
    path.join(homeDir, 'videos'),
    path.join(homeDir, 'music'),
  ]);
  // The directory itself is protected (individual files within downloads/pictures can still be purged if audited)
  if (userShellDirs.has(lower)) {
    return true;
  }

  const programFiles = (process.env.ProgramFiles || 'C:\\Program Files').toLowerCase().replace(/\\+$/, '');
  const programFilesX86 = (process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)').toLowerCase().replace(/\\+$/, '');
  const programData = (process.env.ProgramData || 'C:\\ProgramData').toLowerCase().replace(/\\+$/, '');

  if (lower === programFiles || lower === programFilesX86 || lower === programData) {
    return true;
  }

  // 5. Block System Metadata & Volume Information
  if (baseName === 'system volume information' || baseName === '$recycle.bin' || baseName === 'recovery') {
    return true;
  }

  return false;
}
