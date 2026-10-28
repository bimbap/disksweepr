import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import path from 'path';
import { isProtectedDirectory } from '../src/main/services/emptyFolderService.ts';

test('isProtectedDirectory flags root paths as protected', () => {
  const root = 'C:\\TestFolder';
  assert.equal(isProtectedDirectory('C:\\TestFolder', root), true);
  assert.equal(isProtectedDirectory('c:\\testfolder\\', root), true);
  assert.equal(isProtectedDirectory('C:\\', root), true);
  assert.equal(isProtectedDirectory('D:\\', root), true);
});

test('isProtectedDirectory flags user shell roots as protected', () => {
  const root = 'C:\\';
  assert.equal(isProtectedDirectory(os.homedir(), root), true);
  assert.equal(isProtectedDirectory(path.join(os.homedir(), 'Documents'), root), true);
  assert.equal(isProtectedDirectory(path.join(os.homedir(), 'Downloads'), root), true);
  assert.equal(isProtectedDirectory(path.join(os.homedir(), 'Desktop'), root), true);
});

test('isProtectedDirectory flags system and critical directories as protected', () => {
  const root = 'C:\\';
  assert.equal(isProtectedDirectory('C:\\Windows', root), true);
  assert.equal(isProtectedDirectory('C:\\Program Files', root), true);
  assert.equal(isProtectedDirectory('C:\\Program Files (x86)', root), true);
  assert.equal(isProtectedDirectory('C:\\ProgramData', root), true);
  assert.equal(isProtectedDirectory('C:\\System Volume Information', root), true);
  assert.equal(isProtectedDirectory('C:\\$Recycle.Bin', root), true);
  assert.equal(isProtectedDirectory('C:\\Users\\User\\project\\.git', root), true);
});

test('isProtectedDirectory allows regular subfolders', () => {
  const root = 'C:\\TestFolder';
  assert.equal(isProtectedDirectory('C:\\TestFolder\\old_cache', root), false);
  assert.equal(isProtectedDirectory('C:\\TestFolder\\temp_exports\\empty_leaf', root), false);
});

