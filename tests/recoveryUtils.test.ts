import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareText, parseBinDate, getParentDir } from '../src/shared/recoveryUtils.ts';

test('parseBinDate reads dd/mm/yyyy and orders chronologically', () => {
  const earlier = parseBinDate('09/10/2026 23:59');
  const later = parseBinDate('28/10/2026 9:36');
  assert.ok(later > earlier);
  assert.equal(new Date(later).getMonth(), 9);
  assert.equal(new Date(later).getDate(), 28);
});

test('parseBinDate returns 0 for unparseable input', () => {
  assert.equal(parseBinDate(''), 0);
  assert.equal(parseBinDate('yesterday'), 0);
});

test('getParentDir strips the file name and keeps drive roots usable', () => {
  assert.equal(getParentDir('M:\\AmongUs\\Self Studio.zip'), 'M:\\AmongUs');
  assert.equal(getParentDir('M:\\Special Icon Pack.rar'), 'M:\\');
  assert.equal(getParentDir('/tmp/a/b.zip'), '/tmp/a');
  assert.equal(getParentDir('nofolder.zip'), 'nofolder.zip');
});

test('compareText sorts case-insensitively with natural numbers', () => {
  assert.ok(compareText('file2.zip', 'file10.zip') < 0);
  assert.equal(compareText('ABC', 'abc'), 0);
});

