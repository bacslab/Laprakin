import assert from 'node:assert/strict';
import test from 'node:test';

import { formatBytes, formatCurrency, formatDate } from '../src/lib/formatters.js';
import { courseTokens, editDistance } from '../src/lib/academic.js';

test('formatBytes preserves the current display contract', () => {
  assert.equal(formatBytes(0), '0 MB');
  assert.match(formatBytes(2 * 1024 * 1024), /^2(?:\.0)? MB$/);
});

test('formatCurrency supports the application locale', () => {
  assert.match(formatCurrency(3900), /3\.900/);
});

test('formatDate accepts an explicit locale', () => {
  assert.match(formatDate('2026-01-02', 'id-ID'), /2026/);
});

test('editDistance is symmetric', () => {
  assert.equal(editDistance('laprak', 'laprak'), 0);
  assert.equal(editDistance('laprak', 'laprakx'), editDistance('laprakx', 'laprak'));
});

test('courseTokens normalizes course labels and removes stopwords', () => {
  assert.deepEqual(courseTokens('Mata Kuliah Manajemen Internetworking'), ['manajemen', 'internetworking']);
});
