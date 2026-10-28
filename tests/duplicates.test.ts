import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DuplicateService } from '../src/main/services/duplicateService.ts';

test('DuplicateService finds identical duplicate files and ignores unique files', async () => {
  const service = new DuplicateService();
  const tempDir = path.join(os.tmpdir(), `disksweepr_dup_test_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const contentA = Buffer.from('IdenticalContentForDiskSweeprTest'.repeat(50));
  const contentB = Buffer.from('DifferentContentWithIdenticalSize'.repeat(50)); // Same length, different data

  assert.equal(contentA.length, contentB.length);

  const file1 = path.join(tempDir, 'clone1.bin');
  const file2 = path.join(tempDir, 'clone2.bin');
  const fileUnique = path.join(tempDir, 'unique.bin');
  const fileSmall = path.join(tempDir, 'tiny.txt');

  fs.writeFileSync(file1, contentA);
  fs.writeFileSync(file2, contentA);
  fs.writeFileSync(fileUnique, contentB);
  fs.writeFileSync(fileSmall, Buffer.from('hi'));

  const groups = await service.scanDuplicates({
    targetPath: tempDir,
    minSizeBytes: 10,
  });

  assert.equal(groups.length, 1, 'Should find exactly 1 duplicate group');
  assert.equal(groups[0].files.length, 2, 'Group should contain both clones');
  assert.equal(groups[0].sizeBytes, contentA.length);
  assert.equal(groups[0].wastedBytes, contentA.length);

  // Test deletion of one clone
  const cloneToDelete = groups[0].files[1].path;
  const deleteResult = await service.deleteDuplicates([cloneToDelete], false);

  assert.equal(deleteResult.deletedPaths.length, 1);
  assert.equal(deleteResult.reclaimedBytes, contentA.length);
  assert.ok(!fs.existsSync(cloneToDelete), 'Deleted clone should no longer exist');
  assert.ok(fs.existsSync(groups[0].files[0].path), 'Original file should still be preserved');

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('DuplicateService handles cancellation gracefully', async () => {
  const service = new DuplicateService();
  const tempDir = path.join(os.tmpdir(), `disksweepr_dup_cancel_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const dummyContent = Buffer.alloc(1024 * 50); // 50 KB
  fs.writeFileSync(path.join(tempDir, 'f1.dat'), dummyContent);
  fs.writeFileSync(path.join(tempDir, 'f2.dat'), dummyContent);

  // Trigger scan and immediately cancel
  const scanPromise = service.scanDuplicates(
    { targetPath: tempDir, minSizeBytes: 10 },
    () => {
      service.cancelScan();
    }
  );

  const results = await scanPromise;
  assert.equal(results.length, 0, 'Cancelled scan should return empty array');

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

