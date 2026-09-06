import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  normalizeAdminSearchQuery,
  rankAdminSearchResults,
  scoreAdminSearchCandidate,
} from '../src/admin-search.js';

test('admin search query is normalized and bounded', () => {
  assert.deepEqual(normalizeAdminSearchQuery({ q: '  AI  ', kind: 'users', limit: '90' }), {
    q: 'AI', kind: 'users', limit: 40,
  });
  assert.deepEqual(normalizeAdminSearchQuery({ q: 'x'.repeat(200), kind: 'invalid', limit: '-2' }), {
    q: 'x'.repeat(120), kind: 'all', limit: 10,
  });
});

test('admin search scores exact and prefix matches above loose token matches', () => {
  const exact = scoreAdminSearchCandidate({ title: 'Monitoring', searchText: 'monitoring health' }, 'monitoring');
  const prefix = scoreAdminSearchCandidate({ title: 'Monitoring dashboard', searchText: 'monitoring dashboard' }, 'monitor');
  const loose = scoreAdminSearchCandidate({ title: 'AI health', searchText: 'provider monitoring' }, 'monitoring');
  assert.ok(exact > prefix);
  assert.ok(prefix > loose);
});

test('admin search ranking is deterministic, deduplicated, and capped', () => {
  const rows = rankAdminSearchResults([
    { id: 'b', title: 'AI routing', searchText: 'routing model' },
    { id: 'a', title: 'AI routing', searchText: 'routing model' },
    { id: 'c', title: 'User access', searchText: 'users' },
    { id: 'd', title: 'Monitoring', searchText: 'monitoring' },
  ], 'routing', 2);
  assert.deepEqual(rows.map((item) => item.id), ['a', 'b']);
  assert.equal(rows.every((item) => Number.isFinite(item.score)), true);
});

test('admin search user query only selects columns present in the users schema', async () => {
  const source = await readFile(path.join(process.cwd(), 'server/src/index.js'), 'utf8');
  const endpoint = source.slice(source.indexOf("app.get('/api/admin/search'"), source.indexOf("app.get('/api/admin/ai/usage'"));
  assert.match(endpoint, /SELECT id, role, full_name, created_at FROM users/);
  assert.doesNotMatch(endpoint, /SELECT id, role, plan, created_at FROM users/);
});
