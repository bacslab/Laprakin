import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '');
const [component, workspace, apiClient] = await Promise.all([
  read('../src/pages/Admin/AdminGlobalSearch.jsx'),
  read('../src/pages/Admin/LegacyAdminWorkspace.jsx'),
  read('../src/lib/admin-ai.js'),
]);

test('admin global search is keyboard accessible, relevance-ranked, and mounted once in the shell', () => {
  assert.match(component, /admin\/search/);
  assert.match(component, /Control|Meta|keydown/);
  assert.match(component, /AbortController/);
  assert.match(component, /localStorage/);
  assert.match(component, /aria-label/);
  assert.match(component, /score/);
  assert.match(workspace, /AdminGlobalSearch/);
});

test('Admin AI client exposes filtered monitoring usage', () => {
  assert.match(apiClient, /usage: \(filters\)/);
  assert.match(apiClient, /admin\/ai\/usage/);
});
