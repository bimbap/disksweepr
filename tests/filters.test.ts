import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExtensionInput, matchesExtension, customSizeToMB } from '../src/shared/filters.ts';

test('parseExtensionInput normalizes a single extension', () => {
  assert.deepEqual(parseExtensionInput('bak'), ['.bak']);
  assert.deepEqual(parseExtensionInput('  .BAK  '), ['.bak']);
  assert.deepEqual(parseExtensionInput('*.log'), ['.log']);
});

test('parseExtensionInput splits comma, semicolon and space separated lists', () => {
  assert.deepEqual(parseExtensionInput('bak, tmp;log old'), ['.bak', '.tmp', '.log', '.old']);
});

test('parseExtensionInput deduplicates and keeps multi-part extensions', () => {
  assert.deepEqual(parseExtensionInput('bak .bak BAK'), ['.bak']);
  assert.deepEqual(parseExtensionInput('tar.gz'), ['.tar.gz']);
});

test('parseExtensionInput drops invalid tokens', () => {
  assert.deepEqual(parseExtensionInput(''), []);
  assert.deepEqual(parseExtensionInput('   '), []);
  assert.deepEqual(parseExtensionInput('*'), []);
  assert.deepEqual(parseExtensionInput('a/b ..bak c:\\d'), []);
});

test('matchesExtension matches by suffix, case-insensitively', () => {
  assert.equal(matchesExtension('Report.LOG', ['.log']), true);
  assert.equal(matchesExtension('archive.tar.gz', ['.tar.gz']), true);
  assert.equal(matchesExtension('archive.tar.gz', ['.gz']), true);
  assert.equal(matchesExtension('archive.tgz', ['.gz']), false);
  assert.equal(matchesExtension('notes.txt', ['.log', '.tmp']), false);
});

test('matchesExtension with an empty list matches nothing', () => {
  // Regression: an empty selection used to behave like "no filter" and scanned everything.
  assert.equal(matchesExtension('anything.tmp', []), false);
});

test('customSizeToMB converts MB and GB', () => {
  assert.equal(customSizeToMB('300', 'MB'), 300);
  assert.equal(customSizeToMB('1.5', 'GB'), 1536);
  assert.equal(customSizeToMB('0.5', 'GB'), 512);
});

test('customSizeToMB rejects empty, invalid and sub-1MB input', () => {
  // Regression: values below 0.5 MB rounded to 0 and silently fell back to the 100 MB default.
  assert.equal(customSizeToMB('', 'MB'), null);
  assert.equal(customSizeToMB('abc', 'MB'), null);
  assert.equal(customSizeToMB('0', 'MB'), null);
  assert.equal(customSizeToMB('0.4', 'MB'), null);
  assert.equal(customSizeToMB('-5', 'GB'), null);
});
