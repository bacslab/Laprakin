import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [shared, changes] = await Promise.all([
  read('../src/pages/Admin/ai/shared.jsx'),
  read('../src/pages/Admin/ai/ChangesModule.jsx'),
]);

test('AI pagination exposes icon controls and supports opaque cursor history', () => {
  assert.match(shared, /previousCursor/);
  assert.match(shared, /<ArrowLeft/);
  assert.match(shared, /<ArrowRight/);
  assert.match(changes, /cursorHistory/);
  assert.match(changes, /setCursorHistory/);
  assert.match(changes, /previousCursor=\{cursorHistory\.at\(-1\)/);
});
