import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandEnvVars,
  getCategoryDefinitionsForDrive,
  getSecondaryMediaPaths,
  CATEGORY_DEFINITIONS,
} from '../src/main/services/ruleRegistry.ts';
import { ScannerService } from '../src/main/services/scannerService.ts';

test('CATEGORY_DEFINITIONS includes user_media_hunter with defaultSelected true and group media', () => {
  const mediaCat = CATEGORY_DEFINITIONS.find((d) => d.id === 'user_media_hunter');
  assert.ok(mediaCat, 'user_media_hunter must exist in definitions');
  assert.equal(mediaCat.group, 'media');
  assert.equal(mediaCat.defaultSelected, true);
  assert.equal(mediaCat.useTrash, true);
  assert.ok(mediaCat.paths.some((p) => p.includes('OneDrive')), 'Should include OneDrive paths');
  assert.ok(mediaCat.fileExtensions?.includes('.mp4'));
  assert.ok(mediaCat.fileExtensions?.includes('.mkv'));
  assert.ok(mediaCat.fileExtensions?.includes('.zip'));
});

test('getCategoryDefinitionsForDrive handles secondary drive', () => {
  const secondaryDefs = getCategoryDefinitionsForDrive('M:');
  const mediaCat = secondaryDefs.find((d) => d.id === 'M:_media_hunter');
  assert.ok(mediaCat, 'Secondary drive media hunter must exist');
  assert.equal(mediaCat.group, 'media');
  assert.equal(mediaCat.defaultSelected, true);
  assert.equal(mediaCat.useTrash, true);
  assert.ok(mediaCat.paths.includes('M:\\'), 'Must include drive root');
});

test('getSecondaryMediaPaths discovers drive root and fallback paths', () => {
  const paths = getSecondaryMediaPaths('Z:');
  assert.ok(paths.includes('Z:\\'));
  assert.ok(paths.includes('Z:\\Downloads'));
  assert.ok(paths.includes('Z:\\Videos'));
});

test('ScannerService initializes properly', () => {
  const scanner = new ScannerService();
  assert.ok(scanner);
  assert.equal(typeof scanner.scan, 'function');
});
