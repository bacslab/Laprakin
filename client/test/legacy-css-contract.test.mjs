import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:js|jsx)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

test('retired landing-page root is absent from runtime source and compatibility selectors', async () => {
  const files = await sourceFiles('client/src');
  const runtime = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  const compatibility = await readFile('client/src/styles.css', 'utf8');

  assert.doesNotMatch(runtime, /\blanding-page\b/);
  assert.doesNotMatch(compatibility, /\.landing-page\b/);
  assert.match(runtime, /className="fg-page"/);
});
