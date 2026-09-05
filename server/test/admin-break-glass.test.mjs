import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  BreakGlassError,
  createBreakGlassGrant,
  findActiveBreakGlassGrant,
  revokeBreakGlassGrant,
} from '../src/admin-break-glass.js';

function memoryStore() {
  const store = new DatabaseSync(':memory:');
  store.exec(`
    CREATE TABLE admin_break_glass_grants (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      target_resource_id TEXT,
      scope TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      reason_note TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return store;
}

test('break-glass grants are actor-, scope-, and time-bound', () => {
  const store = memoryStore();
  const nowMs = Date.parse('2026-09-03T04:00:00.000Z');
  try {
    const grant = createBreakGlassGrant({
      store,
      actorUserId: 'privacy-operator',
      targetUserId: 'target-user',
      scope: 'pii',
      reasonCode: 'support_case',
      reasonNote: 'Investigating verified ticket SUP-1234.',
      durationMinutes: 8,
      nowMs,
    });
    assert.equal(grant.scope, 'pii');
    assert.equal(grant.expiresAt, '2026-09-03T04:08:00.000Z');
    assert.equal(findActiveBreakGlassGrant({ store, grantId: grant.id, actorUserId: 'privacy-operator', scope: 'pii', nowMs: nowMs + 1_000 }).targetUserId, 'target-user');
    assert.throws(
      () => findActiveBreakGlassGrant({ store, grantId: grant.id, actorUserId: 'other-operator', scope: 'pii', nowMs: nowMs + 1_000 }),
      (error) => error instanceof BreakGlassError && error.code === 'BREAK_GLASS_GRANT_NOT_FOUND',
    );
    assert.throws(
      () => findActiveBreakGlassGrant({ store, grantId: grant.id, actorUserId: 'privacy-operator', scope: 'content', nowMs: nowMs + 1_000 }),
      (error) => error instanceof BreakGlassError && error.code === 'BREAK_GLASS_GRANT_NOT_FOUND',
    );
    assert.throws(
      () => findActiveBreakGlassGrant({ store, grantId: grant.id, actorUserId: 'privacy-operator', scope: 'pii', nowMs: nowMs + 8 * 60_000 }),
      (error) => error instanceof BreakGlassError && error.code === 'BREAK_GLASS_GRANT_EXPIRED',
    );
  } finally {
    store.close();
  }
});

test('break-glass duration is capped and grants can be revoked', () => {
  const store = memoryStore();
  const nowMs = Date.parse('2026-09-03T04:00:00.000Z');
  try {
    assert.throws(
      () => createBreakGlassGrant({ store, actorUserId: 'actor', targetUserId: 'target', scope: 'pii', reasonCode: 'other', reasonNote: 'A sufficiently detailed reason.', durationMinutes: 11, nowMs }),
      (error) => error instanceof BreakGlassError && error.code === 'BREAK_GLASS_DURATION_INVALID',
    );
    const grant = createBreakGlassGrant({ store, actorUserId: 'actor', targetUserId: 'target', scope: 'content', targetResourceId: 'room-1', reasonCode: 'security_incident', reasonNote: 'Reviewing incident SEC-42 evidence.', durationMinutes: 5, nowMs });
    assert.equal(revokeBreakGlassGrant({ store, grantId: grant.id, actorUserId: 'actor', nowMs: nowMs + 1_000 }), true);
    assert.throws(
      () => findActiveBreakGlassGrant({ store, grantId: grant.id, actorUserId: 'actor', scope: 'content', nowMs: nowMs + 2_000 }),
      (error) => error instanceof BreakGlassError && error.code === 'BREAK_GLASS_GRANT_REVOKED',
    );
  } finally {
    store.close();
  }
});
