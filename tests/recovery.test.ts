import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { RecoveryService } from '../src/main/services/recoveryService.ts';

test('RecoveryService scans deep recovery directory with category filter', async () => {
  const service = new RecoveryService();
  const tempDir = path.join(os.tmpdir(), `disksweepr_recovery_test_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const imgFile = path.join(tempDir, 'photo.jpg');
  const docFile = path.join(tempDir, 'invoice.pdf');
  const textFile = path.join(tempDir, 'notes.txt');

  fs.writeFileSync(imgFile, Buffer.from('JPEG_HEADER_DUMMY_DATA'));
  fs.writeFileSync(docFile, Buffer.from('PDF_HEADER_DUMMY_DATA'));
  fs.writeFileSync(textFile, Buffer.from('TEXT_DATA'));

  // Test images filter
  const imgResults = await service.scanDeepRecovery({
    targetPath: tempDir,
    category: 'images',
  });

  assert.equal(imgResults.length, 1, 'Should find only photo.jpg for images category');
  assert.equal(imgResults[0].name, 'photo.jpg');
  assert.equal(imgResults[0].status, 'recoverable');

  // Test documents filter
  const docResults = await service.scanDeepRecovery({
    targetPath: tempDir,
    category: 'documents',
  });

  assert.equal(docResults.length, 2, 'Should find invoice.pdf and notes.txt for documents category');

  // Test recovering files to another directory
  const destDir = path.join(os.tmpdir(), `disksweepr_recovered_dest_${Date.now()}`);
  const recoverRes = await service.recoverDeepFiles(imgResults, destDir);

  assert.equal(recoverRes.recoveredCount, 1);
  assert.ok(fs.existsSync(path.join(destDir, 'photo.jpg')));

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(destDir, { recursive: true, force: true });
});

test('RecoveryService handles empty or cancelled deep recovery cleanly', async () => {
  const service = new RecoveryService();
  const tempDir = path.join(os.tmpdir(), `disksweepr_recovery_cancel_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  fs.writeFileSync(path.join(tempDir, 'file1.dat'), Buffer.alloc(100));

  const scanPromise = service.scanDeepRecovery(
    { targetPath: tempDir, category: 'all' },
    () => {
      service.cancelDeepRecovery();
    }
  );

  const results = await scanPromise;
  assert.ok(Array.isArray(results));

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('RecoveryService reads Recycle Bin items without throwing', async () => {
  const service = new RecoveryService();
  const items = await service.getRecycleBinItems();
  assert.ok(Array.isArray(items), 'Recycle Bin items should be an array');
  if (items.length > 0) {
    assert.ok(typeof items[0].name === 'string');
    assert.ok(typeof items[0].originalLocation === 'string');
  }
});

