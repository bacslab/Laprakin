import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(full));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

test('all client icons are sourced from the Iconoir adapter', async () => {
  const files = await sourceFiles(srcRoot);
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(source, /lucide-react/);
  assert.match(source, /iconoir-react/);
  assert.match(source, /strokeWidth = 1\.8/);
});

test('Akses user selection keeps the full picker list', async () => {
  const route = await read('../src/pages/Admin/legacy/UsersRoute.jsx');
  assert.doesNotMatch(route, /adminListApiPath\('\/admin\/users', query, \{ userId: selectedUserId \}\)/);
  assert.match(route, /adminListApiPath\('\/admin\/users', query\)/);
  assert.match(route, /selectedData/);
  assert.match(route, /!userData\.users\.some/);
});

test('Admin dark mode uses neutral grey tokens for legacy and AI shells', async () => {
  const styles = await read('../src/styles/admin-overhaul.css');
  assert.match(styles, /\.admin-workspace\.theme-dark\s*\{[^}]*--admin-bg:\s*#151515/s);
  assert.match(styles, /--admin-accent:\s*#d0d0d0/);
  assert.match(styles, /--admin-chart-positive:\s*#c4c4c4/);
  assert.match(styles, /\.admin-ai-shell\.theme-dark\s*\{[^}]*--aai-bg:\s*#151515/s);
  assert.match(styles, /--aai-accent:\s*#d0d0d0/);
});
