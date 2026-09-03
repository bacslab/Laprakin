import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdminListLocation, parseAdminListSearch } from '../src/pages/Admin/legacy/list-query.js';

test('Admin list query parses bounded URL state', () => {
  assert.deepEqual(parseAdminListSearch('?q=%20ayu%20&status=open&cursor=25&limit=500', { status: 'all' }), {
    q: 'ayu', status: 'open', cursor: '25', limit: 100,
  });
  assert.deepEqual(parseAdminListSearch('?cursor=-1&limit=nope', { status: 'all', limit: 25 }), {
    q: '', status: 'all', cursor: '', limit: 25,
  });
});

test('Admin list location preserves filters and resets cursor when filters change', () => {
  assert.equal(buildAdminListLocation('/admin/audit', { q: 'login', status: 'all', cursor: '50', limit: 25 }, { q: 'mfa' }), '/admin/audit?q=mfa&status=all&limit=25');
  assert.equal(buildAdminListLocation('/admin/audit', { q: 'mfa', status: 'all', cursor: '', limit: 25 }, { cursor: '25' }), '/admin/audit?q=mfa&status=all&cursor=25&limit=25');
});
