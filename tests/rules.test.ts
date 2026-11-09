import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandEnvVars,
  expandPathWildcards,
  resolveCategoryPaths,
  getCategoryDefinitionsForDrive,
  getSecondaryMediaPaths,
  CATEGORY_DEFINITIONS,
} from '../src/main/services/ruleRegistry.ts';
import { ScannerService } from '../src/main/services/scannerService.ts';

test('CATEGORY_DEFINITIONS includes user_temp explicitly targeting AppData Local Temp and LocalLow', () => {
  const userTemp = CATEGORY_DEFINITIONS.find((d) => d.id === 'user_temp');
  assert.ok(userTemp, 'user_temp must exist in definitions');
  assert.equal(userTemp.group, 'system');
  assert.equal(userTemp.risk, 'safe');
  assert.equal(userTemp.defaultSelected, true);
  assert.ok(userTemp.paths.includes('%TEMP%'), 'Must include %TEMP%');
  assert.ok(userTemp.paths.some((p) => p.includes('AppData\\Local\\Temp') || p.includes('LOCALAPPDATA%\\Temp')), 'Must explicitly target AppData\\Local\\Temp');
});

test('CATEGORY_DEFINITIONS includes universal multi-app cache and installers', () => {
  const universal = CATEGORY_DEFINITIONS.find((d) => d.id === 'app_universal_cache');
  assert.ok(universal, 'app_universal_cache must exist');
  assert.equal(universal.group, 'apps');
  assert.equal(universal.risk, 'safe');
  assert.equal(universal.defaultSelected, true);

  const installerTemp = CATEGORY_DEFINITIONS.find((d) => d.id === 'app_installer_temp');
  assert.ok(installerTemp, 'app_installer_temp must exist');
  assert.equal(installerTemp.group, 'apps');
  assert.equal(installerTemp.risk, 'safe');
  assert.equal(installerTemp.defaultSelected, true);
  assert.ok(installerTemp.paths.some((p) => p.includes('SquirrelTemp')), 'Must target SquirrelTemp');

  const drivers = CATEGORY_DEFINITIONS.find((d) => d.id === 'driver_installers');
  assert.ok(drivers, 'driver_installers must exist');
  assert.equal(drivers.group, 'system');
  assert.equal(drivers.defaultSelected, true);

  const upgradeResidue = CATEGORY_DEFINITIONS.find((d) => d.id === 'windows_upgrade_cache');
  assert.ok(upgradeResidue, 'windows_upgrade_cache must exist');
  assert.equal(upgradeResidue.group, 'system');
  assert.equal(upgradeResidue.requiresAdmin, true);
});

test('resolveCategoryPaths resolves and deduplicates paths', () => {
  const userTemp = CATEGORY_DEFINITIONS.find((d) => d.id === 'user_temp');
  assert.ok(userTemp);
  const resolved = resolveCategoryPaths(userTemp);
  assert.ok(resolved.length > 0, 'Resolved paths must not be empty');
  assert.ok(resolved.some((p) => p.toLowerCase().includes('temp')), 'Must include temp directory');

  // Verify deduplication
  const uniqueSet = new Set(resolved.map((p) => p.toLowerCase()));
  assert.equal(resolved.length, uniqueSet.size, 'Paths must be strictly deduplicated');
});

test('expandPathWildcards safely handles non-wildcard and nonexistent paths', () => {
  const nonWildcard = expandPathWildcards('C:\\Windows');
  assert.ok(nonWildcard.length >= 1);
  const nonexistent = expandPathWildcards('C:\\NonExistentPath_XYZ_123\\*\\cache');
  assert.deepEqual(nonexistent, []);
});

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

test('CATEGORY_DEFINITIONS includes old_downloads with safe Recycle Bin recycling and 30-day minAgeDays', () => {
  const oldDownloads = CATEGORY_DEFINITIONS.find((d) => d.id === 'old_downloads');
  assert.ok(oldDownloads, 'old_downloads must exist in definitions');
  assert.equal(oldDownloads.group, 'media');
  assert.equal(oldDownloads.useTrash, true);
  assert.equal(oldDownloads.minAgeDays, 30);
  assert.equal(oldDownloads.defaultSelected, false);
  assert.ok(oldDownloads.fileExtensions?.includes('.exe'));
  assert.ok(oldDownloads.fileExtensions?.includes('.msi'));
  assert.ok(oldDownloads.fileExtensions?.includes('.iso'));
  assert.ok(oldDownloads.fileExtensions?.includes('.zip'));
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
