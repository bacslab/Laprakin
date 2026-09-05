import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production deploy defaults to the repository HTTPS checkout', async () => {
  const source = await readFile(new URL('../../ops/laprakin-deploy.sh', import.meta.url), 'utf8');
  assert.match(source, /REPO_URL="\$\{LAPRAKIN_REPO_URL:-https:\/\/github\.com\/bacslab\/Laprakin\.git\}"/);
  assert.match(source, /BRANCH="\$\{LAPRAKIN_DEPLOY_BRANCH:-main\}"/);
});

test('production deployment metadata has no release-branch dependency', async () => {
  const [workflow, service, timer] = await Promise.all([
    readFile(new URL('../../.github/workflows/test.yml', import.meta.url), 'utf8'),
    readFile(new URL('../../ops/laprakin-deploy.service', import.meta.url), 'utf8'),
    readFile(new URL('../../ops/laprakin-deploy.timer', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(workflow, /refs\/heads\/release|branch release/i);
  assert.doesNotMatch(`${service}\n${timer}`, /release branch/i);
});

test('production environment template promotes the requested admin identity', async () => {
  const source = await readFile(new URL('../.env.production.example', import.meta.url), 'utf8');
  assert.match(source, /^ADMIN_EMAIL=hilmimubarok2006@gmail\.com$/m);
});

test('SPA fallback uses an Express 5-compatible wildcard route', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /app\.get\('\*'/);
  assert.match(source, /app\.get\(\/\.\*\//);
});
