import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DevCleanerService, TARGET_ARTIFACT_NAMES } from '../src/main/services/devCleanerService.ts';

test('TARGET_ARTIFACT_NAMES contains IaC and Python virtual environments', () => {
  assert.ok(TARGET_ARTIFACT_NAMES.has('.terraform'));
  assert.ok(TARGET_ARTIFACT_NAMES.has('.venv'));
  assert.ok(TARGET_ARTIFACT_NAMES.has('venv'));
  assert.ok(TARGET_ARTIFACT_NAMES.has('__pycache__'));
  assert.ok(TARGET_ARTIFACT_NAMES.has('.serverless'));
  assert.ok(TARGET_ARTIFACT_NAMES.has('node_modules'));
});

test('DevCleanerService scans and identifies .terraform and .venv artifacts', async () => {
  const service = new DevCleanerService();
  const testRoot = path.join(os.tmpdir(), `disksweepr_dev_test_${Date.now()}`);
  fs.mkdirSync(testRoot, { recursive: true });

  const proj1 = path.join(testRoot, 'my_infra');
  const tfDir = path.join(proj1, '.terraform');
  fs.mkdirSync(tfDir, { recursive: true });
  fs.writeFileSync(path.join(tfDir, 'provider.bin'), Buffer.alloc(1024 * 50)); // 50 KB

  const proj2 = path.join(testRoot, 'my_python');
  const venvDir = path.join(proj2, '.venv');
  fs.mkdirSync(venvDir, { recursive: true });
  fs.writeFileSync(path.join(venvDir, 'pyvenv.cfg'), 'home = /usr/bin\n');
  fs.writeFileSync(path.join(venvDir, 'sample.bin'), Buffer.alloc(1024 * 100)); // 100 KB

  const results = await service.scan({ rootPath: testRoot });

  assert.equal(results.length, 2);
  const types = results.map((r) => r.artifactType);
  assert.ok(types.includes('.terraform'), 'Should detect .terraform');
  assert.ok(types.includes('.venv'), 'Should detect .venv');

  // Clean up
  fs.rmSync(testRoot, { recursive: true, force: true });
});

