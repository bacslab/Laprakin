import assert from 'node:assert/strict';
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
