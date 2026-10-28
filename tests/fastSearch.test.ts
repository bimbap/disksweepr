import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FastSearchService } from '../src/main/services/fastSearchService.ts';

test('FastSearchService filters by targetKind: files, folders, all', async () => {
  const service = new FastSearchService();
  const testRoot = path.join(os.tmpdir(), `disksweepr_fs_test_${Date.now()}`);
  fs.mkdirSync(testRoot, { recursive: true });

  // Create sample files and folders
  const subFolder = path.join(testRoot, 'my_target_folder');
  fs.mkdirSync(subFolder, { recursive: true });

  const sampleFile = path.join(testRoot, 'my_target_file.txt');
  fs.writeFileSync(sampleFile, 'hello world');

  const nestedFile = path.join(subFolder, 'nested_target.txt');
  fs.writeFileSync(nestedFile, 'nested data');

  // Test 1: targetKind = 'files'
  const filesOnly = await service.search({
    customPath: testRoot,
    query: 'target',
    targetKind: 'files',
  });
  assert.ok(filesOnly.length >= 2, 'Should find at least 2 files');
  assert.ok(filesOnly.every((i) => !i.isDirectory), 'All items must be files');

  // Test 2: targetKind = 'folders'
  const foldersOnly = await service.search({
    customPath: testRoot,
    query: 'target',
    targetKind: 'folders',
  });
  assert.ok(foldersOnly.length >= 1, 'Should find the folder');
  assert.ok(foldersOnly.every((i) => i.isDirectory), 'All items must be directories');
  assert.equal(foldersOnly[0].name, 'my_target_folder');

  // Test 3: targetKind = 'all'
  const allItems = await service.search({
    customPath: testRoot,
    query: 'target',
    targetKind: 'all',
  });
  assert.ok(allItems.some((i) => i.isDirectory), 'Must contain folder');
  assert.ok(allItems.some((i) => !i.isDirectory), 'Must contain file');

  // Clean up
  fs.rmSync(testRoot, { recursive: true, force: true });
});

