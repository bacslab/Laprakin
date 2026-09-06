import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const legacyWorkspaceSource = await readFile(new URL('../src/pages/Workspace/LegacyWorkspaceView.jsx', import.meta.url), 'utf8');
const loaderSource = await readFile(new URL('../src/lib/load-page.js', import.meta.url), 'utf8');

test('route modules are loaded through the shared page loader', () => {
  assert.match(mainSource, /loadPage\(\(\) => import\('\.\/pages\/Landing\/LandingPage'\)\)/);
  assert.match(mainSource, /loadPage\(\(\) => import\('\.\/pages\/Auth\/AuthPage'\)\)/);
  assert.match(mainSource, /loadPage\(\(\) => import\('\.\/pages\/Workspace\/Workspace'\)\)/);
  assert.match(mainSource, /loadPage\(\(\) => import\('\.\/pages\/Workspace\/LegacyWorkspace'\)\)/);
  assert.match(mainSource, /import AdminWorkspace from '\.\/pages\/Admin\/AdminWorkspace'/);
  assert.match(mainSource, /import LegacyAdminWorkspace from '\.\/pages\/Admin\/LegacyAdminWorkspace'/);
  assert.match(legacyWorkspaceSource, /loadPage\(\(\) => import\('\.\/ChatSurface'\)\)/);
  assert.match(mainSource, /loadPage\(\(\) => import\('\.\/pages\/Status\/StatusPage'\)\)/);
  assert.match(mainSource, /loadPage\(\(\) => import\('\.\/pages\/Pricing\/PublicPricingPage'\)\)/);
  assert.doesNotMatch(mainSource, /import\s+[^;]+from\s+['"]\.\/pages\/(?:Landing\/LandingPage|Auth\/AuthPage|Workspace\/Workspace|Workspace\/LegacyWorkspace|Workspace\/ChatSurface)['"];/);
});

test('loadPage adapts default and named page modules for React.lazy', () => {
  assert.match(loaderSource, /export function loadPage/);
  assert.match(loaderSource, /module\.default \|\| module/);
  assert.match(mainSource, /<Suspense fallback=\{<LoadingScreen \/>\}>/);
});
