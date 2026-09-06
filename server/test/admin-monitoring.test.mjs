import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAdminMonitoringWhere, normalizeAdminMonitoringQuery } from '../src/admin-monitoring.js';

test('monitoring filters are bounded to safe operational dimensions', () => {
  assert.deepEqual(normalizeAdminMonitoringQuery({ days: '7', provider: ' nara ', model: 'm1', route: ' default ', status: 'error' }), {
    days: 7, userId: '', provider: 'nara', model: 'm1', route: 'default', status: 'error',
  });
  assert.deepEqual(normalizeAdminMonitoringQuery({ days: '999', status: 'DROP TABLE' }), {
    days: 90, userId: '', provider: '', model: '', route: '', status: '',
  });
});

test('monitoring where clause uses parameterized filters and a bounded time window', () => {
  const result = buildAdminMonitoringWhere({ days: 14, provider: 'nara', model: 'model-x', route: 'chat', status: 'success', userId: 'user-1' });
  assert.match(result.sql, /created_at >= \?/);
  assert.match(result.sql, /provider[^?]*\?/);
  assert.match(result.sql, /model[^?]*\?/);
  assert.match(result.sql, /route_id[^?]*\?/);
  assert.match(result.sql, /status = \?/);
  assert.deepEqual(result.params.slice(1), ['user-1', 'nara', 'model-x', 'chat', 'success']);
  assert.equal(result.params.length, 6);
});
