import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production deploy defaults to the repository HTTPS checkout', async () => {
  const source = await readFile(new URL('../../ops/laprakin-deploy.sh', import.meta.url), 'utf8');
  assert.match(source, /REPO_URL="\$\{LAPRAKIN_REPO_URL:-https:\/\/github\.com\/bacslab\/Laprakin\.git\}"/);
});

test('SPA fallback uses an Express 5-compatible wildcard route', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /app\.get\('\*'/);
  assert.match(source, /app\.get\(\/\.\*\//);
});
