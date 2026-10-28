import fs from 'fs';
import path from 'path';
import os from 'os';
import type { EmptyFolderItem } from '../../shared/types.ts';

export function isProtectedDirectory(folderPath: string, rootPath: string): boolean {
  const rootResolved = path.resolve(rootPath).toLowerCase();
  const folderResolved = path.resolve(folderPath).toLowerCase();

  const protectedLowerRoots = new Set<string>([
    rootResolved,
    path.resolve(os.homedir()).toLowerCase(),
    path.join(os.homedir(), 'Documents').toLowerCase(),
    path.join(os.homedir(), 'Downloads').toLowerCase(),
    path.join(os.homedir(), 'Desktop').toLowerCase(),
    path.join(os.homedir(), 'Pictures').toLowerCase(),
    path.join(os.homedir(), 'Videos').toLowerCase(),
    path.join(os.homedir(), 'Music').toLowerCase(),
  ]);

  const rootParsed = path.parse(rootPath);
  if (rootParsed.root) {
    protectedLowerRoots.add(path.resolve(rootParsed.root).toLowerCase());
  }

  if (protectedLowerRoots.has(folderResolved)) return true;
  if (folderResolved.endsWith(':\\') || folderResolved.endsWith(':/')) return true;

  const base = path.basename(folderResolved);
  if (
    base === 'windows' ||
    base === 'program files' ||
    base === 'program files (x86)' ||
    base === 'programdata' ||
    base === 'appdata' ||
    base === 'system volume information' ||
    base === '$recycle.bin' ||
    base === 'recovery' ||
    base === '.git'
  ) {
    return true;
  }

  return false;
}

export class EmptyFolderService {
  /**
   * Scans target directory recursively for empty folders
   */
  public async scanEmptyFolders(targetPath: string): Promise<EmptyFolderItem[]> {
    const rootPath = path.resolve(targetPath);
    const emptyFolders: EmptyFolderItem[] = [];

    // Bottom-up post-order directory check
    const checkDir = async (dir: string): Promise<boolean> => {
      if (isProtectedDirectory(dir, rootPath)) {
        // Still explore inside user folders, but do NOT enter Windows/ProgramFiles
        const base = path.basename(dir.toLowerCase());
        if (
          base === 'windows' ||
          base === 'program files' ||
          base === 'program files (x86)' ||
          base === 'system volume information' ||
          base === '$recycle.bin' ||
          base === 'recovery' ||
          base === '.git'
        ) {
          return false;
        }
      }

      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return false;
      }

      let hasFiles = false;
      let hasNonEmptySubdirs = false;

      for (const entry of entries) {
        if (entry.isSymbolicLink()) {
          hasFiles = true;
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const isSubDirEmpty = await checkDir(fullPath);
          if (!isSubDirEmpty) {
            hasNonEmptySubdirs = true;
          }
        } else {
          hasFiles = true;
        }
      }

      const isEmpty = !hasFiles && !hasNonEmptySubdirs;

      // Only flag as candidate if empty AND not protected
      if (isEmpty && !isProtectedDirectory(dir, rootPath)) {
        emptyFolders.push({
          id: dir,
          path: dir,
          name: path.basename(dir),
          parentPath: path.dirname(dir),
          selected: true,
        });
        return true;
      }

      return false;
    };

    await checkDir(rootPath);
    return emptyFolders;
  }

  /**
   * Prunes selected empty directories from deepest to shallowest
   */
  public async deleteEmptyFolders(
    folderPaths: string[]
  ): Promise<{ deletedPaths: string[]; failedPaths: string[] }> {
    // Sort deepest first
    const sorted = [...folderPaths].sort((a, b) => b.length - a.length);
    const deletedPaths: string[] = [];
    const failedPaths: string[] = [];

    for (const dir of sorted) {
      try {
        await fs.promises.rmdir(dir);
        deletedPaths.push(dir);
      } catch {
        failedPaths.push(dir);
      }
    }

    return { deletedPaths, failedPaths };
  }
}
