import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LargeFileService } from '../src/main/services/largeFileService.ts';

test('LargeFileService calculates directory size properly', async () => {
  const service = new LargeFileService();
  const tempDir = path.join(os.tmpdir(), `disksweepr_test_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const file1 = path.join(tempDir, 'file1.dat');
  const file2 = path.join(tempDir, 'file2.dat');
  fs.writeFileSync(file1, Buffer.alloc(1024 * 100)); // 100 KB
  fs.writeFileSync(file2, Buffer.alloc(1024 * 200)); // 200 KB

  const size = await service.getDirectorySizeBytes(tempDir);
  assert.equal(size, 1024 * 300);

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('LargeFileService honors minSizeBytes and finds massive files', async () => {
  const service = new LargeFileService();
  const tempDir = path.join(os.tmpdir(), `disksweepr_scan_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const smallFile = path.join(tempDir, 'small.dat');
  const largeFile = path.join(tempDir, 'large.dat');
  fs.writeFileSync(smallFile, Buffer.alloc(1024 * 10)); // 10 KB
  fs.writeFileSync(largeFile, Buffer.alloc(1024 * 1024 * 2)); // 2 MB

  const results = await service.scan({
    customPath: tempDir,
    minSizeBytes: 1024 * 1024, // 1 MB min
    maxResults: 10,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'large.dat');
  assert.equal(results[0].sizeBytes, 1024 * 1024 * 2);

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});
