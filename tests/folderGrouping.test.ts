import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFolderMeta,
  groupItemsByFolder,
  sortFolderGroups,
  applyFolderSelectionToCategory,
  toggleIdsBatch,
} from '../src/shared/folderGrouping.ts';
import type { ScannedCategory } from '../src/shared/types.ts';

test('extractFolderMeta separates folder name and parent directory accurately', () => {
  const nested = extractFolderMeta('C:\\Users\\Habil\\AppData\\Local\\Temp\\dump.log', 'dump.log');
  assert.equal(nested.folderPath, 'C:\\Users\\Habil\\AppData\\Local\\Temp');
  assert.equal(nested.folderName, 'Temp');
  assert.equal(nested.parentPath, 'C:\\Users\\Habil\\AppData\\Local');

  const root = extractFolderMeta('D:\\pagefile.sys', 'pagefile.sys');
  assert.equal(root.folderPath, 'D:\\');
  assert.equal(root.folderName, 'D:\\');
  assert.equal(root.parentPath, '');
});

test('groupItemsByFolder aggregates case-insensitively on Windows paths and totals sizes', () => {
  const items = [
    { path: 'C:\\Temp\\Cache\\a.bin', name: 'a.bin', sizeBytes: 100, modifiedTime: 10 },
    { path: 'c:\\temp\\cache\\b.bin', name: 'b.bin', sizeBytes: 250, modifiedTime: 40 },
    { path: 'C:\\Temp\\Logs\\app.log', name: 'app.log', sizeBytes: 500, modifiedTime: 25 },
  ];

  const groups = groupItemsByFolder(
    items,
    (f) => f.path,
    (f) => f.name,
    (f) => f.sizeBytes,
    (f) => f.modifiedTime
  );

  assert.equal(groups.length, 2);

  const bySize = sortFolderGroups(groups, 'size', 'desc');
  assert.equal(bySize[0].folderName, 'Logs');
  assert.equal(bySize[0].totalBytes, 500);
  assert.equal(bySize[0].items.length, 1);

  assert.equal(bySize[1].folderPath, 'C:\\Temp\\Cache');
  assert.equal(bySize[1].items.length, 2);
  assert.equal(bySize[1].totalBytes, 350);
  assert.equal(bySize[1].latestModifiedTime, 40);

  const byCount = sortFolderGroups(groups, 'count', 'desc');
  assert.equal(byCount[0].folderName, 'Cache');
  assert.equal(byCount[0].items.length, 2);
});

test('applyFolderSelectionToCategory selects single folder cleanly when category was off', () => {
  const category: ScannedCategory = {
    id: 'test_cat',
    name: 'Test',
    description: 'Desc',
    group: 'apps',
    risk: 'safe',
    selected: false,
    totalBytes: 300,
    fileCount: 3,
    files: [
      { path: 'C:\\A\\1.tmp', name: '1.tmp', sizeBytes: 100, modifiedTime: 1 },
      { path: 'C:\\A\\2.tmp', name: '2.tmp', sizeBytes: 100, modifiedTime: 2 },
      { path: 'C:\\B\\3.tmp', name: '3.tmp', sizeBytes: 100, modifiedTime: 3 },
    ],
    excludedPaths: [],
  };

  const afterSelectA = applyFolderSelectionToCategory(
    category,
    ['C:\\A\\1.tmp', 'C:\\A\\2.tmp'],
    true
  );
  assert.equal(afterSelectA.selected, true);
  assert.deepEqual(afterSelectA.excludedPaths, ['C:\\B\\3.tmp']);

  // Deselecting folder A now disables whole category because C:\B was also excluded.
  const afterDeselectA = applyFolderSelectionToCategory(
    afterSelectA,
    ['C:\\A\\1.tmp', 'C:\\A\\2.tmp'],
    false
  );
  assert.equal(afterDeselectA.selected, false);
  assert.deepEqual(afterDeselectA.excludedPaths, []);
});

test('applyFolderSelectionToCategory removes exclusions on re-select without dropping siblings', () => {
  const category: ScannedCategory = {
    id: 'test_cat',
    name: 'Test',
    description: 'Desc',
    group: 'apps',
    risk: 'safe',
    selected: true,
    totalBytes: 300,
    fileCount: 3,
    files: [
      { path: 'C:\\A\\1.tmp', name: '1.tmp', sizeBytes: 100, modifiedTime: 1 },
      { path: 'C:\\A\\2.tmp', name: '2.tmp', sizeBytes: 100, modifiedTime: 2 },
      { path: 'C:\\B\\3.tmp', name: '3.tmp', sizeBytes: 100, modifiedTime: 3 },
    ],
    excludedPaths: ['C:\\A\\2.tmp', 'C:\\B\\3.tmp'],
  };

  const resolved = applyFolderSelectionToCategory(
    category,
    ['C:\\A\\1.tmp', 'C:\\A\\2.tmp'],
    true
  );
  assert.equal(resolved.selected, true);
  assert.deepEqual(resolved.excludedPaths, ['C:\\B\\3.tmp']);
});

test('toggleIdsBatch adds and removes folder item IDs cleanly without duplicates', () => {
  const initial = ['id-1', 'id-2'];
  const added = toggleIdsBatch(initial, ['id-2', 'id-3', 'id-4'], true);
  assert.deepEqual(added, ['id-1', 'id-2', 'id-3', 'id-4']);

  const removed = toggleIdsBatch(added, ['id-2', 'id-4'], false);
  assert.deepEqual(removed, ['id-1', 'id-3']);
});

