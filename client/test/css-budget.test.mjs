import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const importantCount = (css.match(/!important\b/g) || []).length;

test('compatibility stylesheet stays within the measured rule budget', () => {
  assert.ok(importantCount <= 3060, `CSS !important budget exceeded: ${importantCount} > 3060`);
});

test('section styles declare explicit ownership layers', async () => {
  const sources = await Promise.all([
    readFile(new URL('../src/styles/auth.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/workspace.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/admin.css', import.meta.url), 'utf8'),
  ]);
  for (const source of sources) assert.match(source, /@layer sections/);
});
