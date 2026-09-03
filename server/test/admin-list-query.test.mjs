import assert from 'node:assert/strict';
import test from 'node:test';
import { adminListPage, parseAdminListQuery } from '../src/admin-list-query.js';

test('Admin list query bounds search, status, cursor, and limit', () => {
  assert.deepEqual(parseAdminListQuery({ q: '  ayu  ', status: 'open', cursor: '25', limit: '500' }, { statuses: ['open', 'closed'], defaultStatus: 'open' }), {
    q: 'ayu', status: 'open', cursor: 25, limit: 100,
  });
  assert.deepEqual(parseAdminListQuery({ q: 'x'.repeat(200), status: 'invalid', cursor: '-2', limit: 'nope' }, { statuses: ['open', 'closed'], defaultStatus: 'open', defaultLimit: 25 }), {
    q: 'x'.repeat(120), status: 'open', cursor: 0, limit: 25,
  });
});

test('Admin list page returns a bounded slice and opaque continuation value', () => {
  assert.deepEqual(adminListPage(['a', 'b', 'c'], { cursor: 20, limit: 2 }), {
    items: ['a', 'b'],
    pageInfo: { cursor: '20', nextCursor: '22', limit: 2, hasMore: true },
  });
  assert.deepEqual(adminListPage(['a'], { cursor: 22, limit: 2 }), {
    items: ['a'],
    pageInfo: { cursor: '22', nextCursor: null, limit: 2, hasMore: false },
  });
});
