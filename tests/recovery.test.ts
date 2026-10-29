import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  RecoveryService,
  parseRecycleBinMetadataBuffer,
  parseDeletedNtfsMftRecord,
} from '../src/main/services/recoveryService.ts';

test('RecoveryService ignores normal active files and only detects orphaned/deleted remnants', async () => {
  const service = new RecoveryService();
  const tempDir = path.join(os.tmpdir(), `disksweepr_recovery_test_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // Normal live files (including live .bak/.old config backups!) MUST NOT be returned by Deep Recovery
  const activeImg = path.join(tempDir, 'active_photo.jpg');
  const activeVideo = path.join(tempDir, 'active_movie.mkv');
  const activeBak = path.join(tempDir, 'config-20260818.json.bak');
  fs.writeFileSync(activeImg, Buffer.from('LIVE_JPEG_FILE'));
  fs.writeFileSync(activeVideo, Buffer.from('LIVE_MKV_FILE'));
  fs.writeFileSync(activeBak, Buffer.from('{}'));

  // Genuine crash-recovery / incomplete download / lost-cluster files SHOULD be detected
  const orphanImgPart = path.join(tempDir, 'unfinished_photo.jpg.crdownload');
  const orphanDocAsd = path.join(tempDir, 'unsaved_report.docx.asd');
  const foundDir = path.join(tempDir, 'found.000');
  fs.mkdirSync(foundDir, { recursive: true });
  const chkFragment = path.join(foundDir, 'file0001.chk');

  fs.writeFileSync(orphanImgPart, Buffer.from('RECOVERABLE_JPEG_PARTIAL'));
  fs.writeFileSync(orphanDocAsd, Buffer.from('RECOVERABLE_WORD_AUTORECOVER'));
  fs.writeFileSync(chkFragment, Buffer.from('CHKDSK_CLUSTER_DATA'));

  // 1. Test images category filter: only unfinished_photo.jpg.crdownload should match, NOT active_photo.jpg!
  const imgResults = await service.scanDeepRecovery({
    targetPath: tempDir,
    category: 'images',
  });

  assert.equal(imgResults.length, 1, 'Should find only partial image remnant and ignore active photo.jpg');
  assert.equal(imgResults[0].name, 'unfinished_photo.jpg.crdownload');
  assert.equal(imgResults[0].status, 'recoverable');

  // 2. Test all category filter: should find the 3 orphaned items and 0 active files (and 0 live .bak files!)
  const allResults = await service.scanDeepRecovery({
    targetPath: tempDir,
    category: 'all',
  });
  const foundNames = allResults.map((r) => r.name);
  assert.ok(!foundNames.includes('active_photo.jpg'), 'Must never include normal active photo.jpg');
  assert.ok(!foundNames.includes('active_movie.mkv'), 'Must never include normal active movie.mkv');
  assert.ok(!foundNames.includes('config-20260818.json.bak'), 'Must never include normal active .bak files');
  assert.equal(allResults.length, 3);

  // 3. Test recovering files to destination directory
  const destDir = path.join(os.tmpdir(), `disksweepr_recovered_dest_${Date.now()}`);
  const recoverRes = await service.recoverDeepFiles(imgResults, destDir);

  assert.equal(recoverRes.recoveredCount, 1);
  assert.ok(fs.existsSync(path.join(destDir, 'unfinished_photo.jpg.crdownload')));

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(destDir, { recursive: true, force: true });
});

test('parseRecycleBinMetadataBuffer parses Windows 10/11 v2 $I header', () => {
  const origPath = 'M:\\Videos\\episode_01.mkv';
  const pathBuf = Buffer.from(origPath + '\0', 'utf16le');
  const header = Buffer.alloc(28 + pathBuf.length);
  header.writeBigUInt64LE(2n, 0); // Version 2
  header.writeBigUInt64LE(248512000n, 8); // Size in bytes
  header.writeBigUInt64LE(133430000000000000n, 16); // Windows FILETIME
  header.writeUInt32LE(origPath.length + 1, 24); // Char count
  pathBuf.copy(header, 28);

  const parsed = parseRecycleBinMetadataBuffer(header);
  assert.ok(parsed);
  assert.equal(parsed.originalPath, origPath);
  assert.equal(parsed.sizeBytes, 248512000);
  assert.ok(parsed.deletedTimeMs > 0);
});

test('parseDeletedNtfsMftRecord parses a synthetic deleted NTFS $MFT record and reconstructs resident data', async () => {
  const record = Buffer.alloc(1024, 0);
  record.write('FILE', 0, 'ascii');
  record.writeUInt16LE(48, 20); // First attribute offset
  record.writeUInt16LE(0x0000, 22); // Flags = 0x0000 (Deleted File!)

  // Attribute 1 at offset 48: 0x30 ($FILE_NAME)
  const fileName = 'secret_contract.pdf';
  const nameUtf16 = Buffer.from(fileName, 'utf16le');
  const fnValueLen = 66 + nameUtf16.length;
  const fnAttrLen = Math.ceil((24 + fnValueLen) / 8) * 8;
  record.writeUInt32LE(0x30, 48); // Type $FILE_NAME
  record.writeUInt32LE(fnAttrLen, 52); // Attr length
  record.writeUInt8(0, 56); // Resident
  record.writeUInt32LE(fnValueLen, 64); // Value length
  record.writeUInt16LE(24, 68); // Value offset

  const fnValStart = 48 + 24;
  record.writeUInt32LE(5, fnValStart); // Parent MFT record = 5 (root directory)
  record.writeBigUInt64LE(133450000000000000n, fnValStart + 16); // Modified FILETIME
  record.writeUInt8(fileName.length, fnValStart + 64); // Filename length in chars
  record.writeUInt8(1, fnValStart + 65); // Win32 namespace
  nameUtf16.copy(record, fnValStart + 66);

  // Attribute 2: 0x80 ($DATA - Resident)
  const dataAttrOffset = 48 + fnAttrLen;
  const payload = Buffer.from('%PDF-1.7 RECOVERED_FROM_MFT_SECTOR');
  const dataAttrLen = Math.ceil((24 + payload.length) / 8) * 8;
  record.writeUInt32LE(0x80, dataAttrOffset); // Type $DATA
  record.writeUInt32LE(dataAttrLen, dataAttrOffset + 4);
  record.writeUInt8(0, dataAttrOffset + 8); // Resident
  record.writeUInt32LE(payload.length, dataAttrOffset + 16);
  record.writeUInt16LE(24, dataAttrOffset + 20);
  payload.copy(record, dataAttrOffset + 24);

  // End marker 0xFFFFFFFF
  record.writeUInt32LE(0xffffffff, dataAttrOffset + dataAttrLen);

  const item = parseDeletedNtfsMftRecord(record, 142, 'M:', 4096);
  assert.ok(item, 'Should parse deleted NTFS MFT record');
  assert.equal(item.name, 'secret_contract.pdf');
  assert.equal(item.originalPath, 'M:\\secret_contract.pdf');
  assert.equal(item.sizeBytes, payload.length);
  assert.equal(item.status, 'recoverable');
  assert.equal(item.recoverySource, 'ntfs_mft');

  // Verify recovering this MFT item writes the exact resident bytes to disk
  const service = new RecoveryService();
  const destDir = path.join(os.tmpdir(), `disksweepr_mft_recover_${Date.now()}`);
  const res = await service.recoverDeepFiles([item], destDir);
  assert.equal(res.recoveredCount, 1);
  const recoveredContent = fs.readFileSync(path.join(destDir, 'secret_contract.pdf'), 'utf8');
  assert.equal(recoveredContent, '%PDF-1.7 RECOVERED_FROM_MFT_SECTOR');
  fs.rmSync(destDir, { recursive: true, force: true });
});

test('parseDeletedNtfsMftRecord falls back to $FILE_NAME size and cluster runs for deleted archives with zeroed $DATA realSize', () => {
  const record = Buffer.alloc(1024, 0);
  record.write('FILE', 0, 'ascii');
  record.writeUInt16LE(48, 20); // First attribute offset
  record.writeUInt16LE(0x0000, 22); // Flags = 0x0000 (Deleted File!)

  // Attribute 1 at offset 48: 0x30 ($FILE_NAME) for "backup_project.zip"
  const fileName = 'backup_project.zip';
  const nameUtf16 = Buffer.from(fileName, 'utf16le');
  const fnValueLen = 66 + nameUtf16.length;
  const fnAttrLen = Math.ceil((24 + fnValueLen) / 8) * 8;
  record.writeUInt32LE(0x30, 48);
  record.writeUInt32LE(fnAttrLen, 52);
  record.writeUInt8(0, 56); // Resident
  record.writeUInt32LE(fnValueLen, 64);
  record.writeUInt16LE(24, 68);

  const fnValStart = 48 + 24;
  record.writeUInt32LE(5, fnValStart); // Root directory
  record.writeBigUInt64LE(133450000000000000n, fnValStart + 16);
  record.writeBigUInt64LE(10485760n, fnValStart + 40); // Allocated size in $FILE_NAME (10 MB)
  record.writeBigUInt64LE(9850120n, fnValStart + 48); // Real size in $FILE_NAME (~9.85 MB)
  record.writeUInt8(fileName.length, fnValStart + 64);
  record.writeUInt8(1, fnValStart + 65);
  nameUtf16.copy(record, fnValStart + 66);

  // Attribute 2: 0x80 ($DATA - Non-Resident with zeroed RealSize & AllocSize, but intact DataRun!)
  const dataAttrOffset = 48 + fnAttrLen;
  // DataRun: 0x21 (1 byte length, 2 bytes offset), length = 10 clusters (0x0A), offset = 0x0500 (cluster 1280), end = 0x00
  const dataRunBytes = Buffer.from([0x21, 0x0a, 0x00, 0x05, 0x00]);
  const dataAttrLen = 72; // 64-byte header + 8-byte runlist
  record.writeUInt32LE(0x80, dataAttrOffset);
  record.writeUInt32LE(dataAttrLen, dataAttrOffset + 4);
  record.writeUInt8(1, dataAttrOffset + 8); // Non-Resident = 1
  record.writeUInt16LE(64, dataAttrOffset + 32); // RunList offset = 64
  record.writeBigUInt64LE(0n, dataAttrOffset + 40); // AllocSize zeroed by OS on delete
  record.writeBigUInt64LE(0n, dataAttrOffset + 48); // RealSize zeroed by OS on delete
  dataRunBytes.copy(record, dataAttrOffset + 64);

  record.writeUInt32LE(0xffffffff, dataAttrOffset + dataAttrLen);

  const item = parseDeletedNtfsMftRecord(record, 255, 'M:', 4096);
  assert.ok(item, 'Should parse deleted non-resident archive even when $DATA size is zeroed');
  assert.equal(item.name, 'backup_project.zip');
  assert.equal(item.extension, '.zip');
  assert.equal(item.sizeBytes, 9850120, 'Should fallback to $FILE_NAME RealSize');
  assert.equal(item.status, 'recoverable');
  assert.ok(item.dataRuns && item.dataRuns.length === 1);
  assert.equal(item.dataRuns[0].clusterOffset, 1280);
  assert.equal(item.dataRuns[0].clusterCount, 10);
});

test('RecoveryService handles empty or cancelled deep recovery cleanly', async () => {
  const service = new RecoveryService();
  const tempDir = path.join(os.tmpdir(), `disksweepr_recovery_cancel_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  fs.writeFileSync(path.join(tempDir, 'file1.bak'), Buffer.alloc(100));

  const scanPromise = service.scanDeepRecovery(
    { targetPath: tempDir, category: 'all' },
    () => {
      service.cancelDeepRecovery();
    }
  );

  const results = await scanPromise;
  assert.ok(Array.isArray(results));

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
