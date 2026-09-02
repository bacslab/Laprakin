import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));

async function findJsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findJsxFiles(entryPath));
    else if (entry.name.endsWith('.jsx')) files.push(entryPath);
  }
  return files;
}

test('every client JSX module stays within the 500-line boundary', async () => {
  const files = await findJsxFiles(sourceRoot);
  const oversized = [];
  for (const file of files) {
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/).length;
    if (lines > 500) oversized.push(`${path.relative(sourceRoot, file)} (${lines})`);
  }
  assert.deepEqual(oversized, []);
});
