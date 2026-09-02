import assert from 'node:assert/strict';
import test from 'node:test';
import {
  courseLabelsMatch,
  defaultChatConfig,
  mergeFiles,
  preferredCourseLabel,
  resolveAccent,
} from '../src/lib/workspace-helpers.js';

test('workspace config keeps the guided laprak defaults', () => {
  assert.equal(defaultChatConfig.structureMode, 'guided');
  assert.equal(defaultChatConfig.configuration.documentProfile, 'langkah');
  assert.equal(defaultChatConfig.configuration.allowExternalAi, true);
});

test('attachment merge deduplicates files by stable browser identity', () => {
  const first = { name: 'modul.pdf', size: 12, lastModified: 4 };
  const duplicate = { name: 'modul.pdf', size: 12, lastModified: 4 };
  const second = { name: 'bukti.png', size: 18, lastModified: 5 };
  assert.deepEqual(mergeFiles([first], [duplicate, second]), [first, second]);
});

test('course grouping accepts useful abbreviations without merging unknown buckets', () => {
  assert.equal(courseLabelsMatch('Jaringan Komputer', 'JK'), true);
  assert.equal(courseLabelsMatch('Belum dikelompokkan', 'Jaringan Komputer'), false);
  assert.equal(preferredCourseLabel('JK', 'Jaringan Komputer'), 'Jaringan Komputer');
});

test('dark-only accents fall back to a readable light accent', () => {
  const dark = resolveAccent('amber', 'dark');
  const light = resolveAccent('amber', 'light');
  assert.equal(dark.key, 'amber');
  assert.equal(light.key, 'gray');
});
