import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import { isProtectedSystemPath } from '../src/main/services/pathSafety.ts';
import { CleanerService } from '../src/main/services/cleanerService.ts';
import { VirtualDiskService } from '../src/main/services/virtualDiskService.ts';
import { closeRunningApps } from '../src/main/services/processService.ts';
import { FastSearchService } from '../src/main/services/fastSearchService.ts';
import { LargeFileService } from '../src/main/services/largeFileService.ts';
import type { ScannedCategory } from '../src/shared/types.ts';

test('isProtectedSystemPath blocks drive roots and core system roots', () => {
  assert.equal(isProtectedSystemPath('C:'), true);
  assert.equal(isProtectedSystemPath('C:\\'), true);
  assert.equal(isProtectedSystemPath('D:\\'), true);
  assert.equal(isProtectedSystemPath('M:\\'), true);
  assert.equal(isProtectedSystemPath('C:\\Windows'), true);
  assert.equal(isProtectedSystemPath('C:\\Windows\\System32'), true);
  assert.equal(isProtectedSystemPath('C:\\Windows\\System32\\drivers'), true);
  assert.equal(isProtectedSystemPath('C:\\Windows\\SysWOW64'), true);
  assert.equal(isProtectedSystemPath('C:\\Windows\\WinSxS'), true);
  assert.equal(isProtectedSystemPath('C:\\Program Files'), true);
  assert.equal(isProtectedSystemPath('C:\\Program Files (x86)'), true);
  assert.equal(isProtectedSystemPath('C:\\ProgramData'), true);
  assert.equal(isProtectedSystemPath('C:\\$Recycle.Bin'), true);
  assert.equal(isProtectedSystemPath('C:\\System Volume Information'), true);
});

test('isProtectedSystemPath blocks critical registry and boot files', () => {
  assert.equal(isProtectedSystemPath('C:\\Users\\User\\NTUSER.DAT'), true);
  assert.equal(isProtectedSystemPath('C:\\Users\\User\\ntuser.dat.LOG1'), true);
  assert.equal(isProtectedSystemPath('C:\\Users\\User\\AppData\\Local\\Microsoft\\Windows\\UsrClass.dat'), true);
  assert.equal(isProtectedSystemPath('C:\\bootmgr'), true);
  assert.equal(isProtectedSystemPath('C:\\pagefile.sys'), true);
  assert.equal(isProtectedSystemPath('C:\\hiberfil.sys'), true);
});

test('isProtectedSystemPath allows legitimate application cache and temp files', () => {
  assert.equal(isProtectedSystemPath('C:\\Users\\User\\AppData\\Local\\Temp\\junk_123.tmp'), false);
  assert.equal(isProtectedSystemPath('C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\data_0'), false);
  assert.equal(isProtectedSystemPath('C:\\Users\\User\\AppData\\Local\\SquirrelTemp\\update.exe'), false);
  assert.equal(isProtectedSystemPath('M:\\Downloads\\test_installer.iso'), false);
});

test('cleanerService blocks path traversal and unauthorized target injections', async () => {
  const cleaner = new CleanerService();
  const maliciousCategory: ScannedCategory = {
    id: 'user_temp',
    name: 'User Temporary Files (AppData\\Local\\Temp)',
    description: 'Test category',
    group: 'system',
    risk: 'safe',
    selected: true,
    totalBytes: 2048,
    fileCount: 2,
    files: [
      {
        path: 'C:\\Windows\\System32\\cmd.exe',
        name: 'cmd.exe',
        sizeBytes: 1024,
        modifiedTime: Date.now(),
      },
      {
        path: path.join(os.homedir(), 'NTUSER.DAT'),
        name: 'NTUSER.DAT',
        sizeBytes: 1024,
        modifiedTime: Date.now(),
      },
    ],
  };

  const report = await cleaner.clean([maliciousCategory], ['user_temp']);

  assert.equal(report.cleanedFilesCount, 0, 'No unauthorized files should be purged');
  assert.equal(report.skippedFilesCount, 2, 'Both malicious targets must be skipped');
  assert.equal(report.errors.length, 2, 'Errors must record boundary/security blocks');
  assert.ok(
    report.errors.some((e) => e.reason.includes('Critical system/user registry file protection') || e.reason.includes('Path boundary violation')),
    'Must explicitly state protection or boundary violation'
  );
});

test('VirtualDiskService prevents command injection into diskpart', async () => {
  const vdisk = new VirtualDiskService();
  const maliciousPayload = 'test.vhdx"\\r\\nselect disk 0\\r\\nclean\\r\\n';
  const result = await vdisk.compactVirtualDisk(maliciousPayload);

  assert.equal(result.success, false);
  assert.ok(result.error?.includes('Security block'), 'Must trigger security gate block');
});

test('FastSearchService and LargeFileService reject protected system paths', async () => {
  const fastSearch = new FastSearchService();
  const searchResult = await fastSearch.deleteFile('C:\\Windows\\System32');
  assert.equal(searchResult, false, 'FastSearch deleteFile must block System32');

  const largeFiles = new LargeFileService();
  const largeResult = await largeFiles.deleteFiles(['C:\\Windows\\System32', 'C:\\Windows\\explorer.exe']);
  assert.deepEqual(largeResult.deletedPaths, [], 'No system paths should be deleted');
  assert.equal(largeResult.failedPaths.length, 2, 'Both system paths must be in failedPaths');
});

test('closeRunningApps silently ignores protected system processes', async () => {
  // Should complete safely without attempting to taskkill critical system binaries
  await assert.doesNotReject(async () => {
    await closeRunningApps(['explorer.exe', 'svchost.exe', 'csrss.exe', 'winlogon.exe']);
  });
});

