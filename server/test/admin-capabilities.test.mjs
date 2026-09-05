import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ADMIN_CAPABILITIES,
  capabilitiesForUser,
  hasCapability,
  requireCapability,
} from '../src/admin-capabilities.js';

const REQUIRED_CAPABILITIES = [
  'ai.providers.view',
  'ai.providers.manage',
  'ai.credentials.rotate',
  'ai.models.manage',
  'ai.routing.manage',
  'ai.health.view',
  'users.view',
  'users.pii.reveal',
  'users.content.reveal',
  'users.restrict',
  'appeals.review',
  'billing.view',
  'billing.manage',
  'credits.grant',
  'pricing.manage',
  'cms.edit',
  'cms.publish',
  'audit.view',
  'retention.execute',
  'incidents.manage',
  'roles.manage',
];

test('admin capability vocabulary exactly covers the mission contract', () => {
  assert.deepEqual([...ADMIN_CAPABILITIES], REQUIRED_CAPABILITIES);
  assert.equal(Object.isFrozen(ADMIN_CAPABILITIES), true);
});

test('roles resolve to least-privilege capability sets without trusting browser input', () => {
  assert.deepEqual(capabilitiesForUser({ role: 'student', capabilities: REQUIRED_CAPABILITIES }), []);
  assert.deepEqual(capabilitiesForUser({ role: 'ai_admin' }), REQUIRED_CAPABILITIES.slice(0, 6));
  assert.deepEqual(capabilitiesForUser({ role: 'billing_admin' }), [
    'billing.view',
    'billing.manage',
    'credits.grant',
    'pricing.manage',
  ]);
  assert.equal(capabilitiesForUser({ role: 'admin' }).includes('users.pii.reveal'), false);
  assert.equal(capabilitiesForUser({ role: 'admin' }).includes('users.content.reveal'), false);
  assert.equal(capabilitiesForUser({ role: 'owner' }).includes('users.pii.reveal'), true);
  assert.equal(capabilitiesForUser({ role: 'owner' }).includes('users.content.reveal'), true);
  assert.deepEqual(capabilitiesForUser({ role: 'privacy_admin' }), [
    'users.view',
    'users.pii.reveal',
    'audit.view',
    'retention.execute',
  ]);
  assert.equal(hasCapability({ role: 'support_admin' }, 'users.restrict'), true);
  assert.equal(hasCapability({ role: 'support_admin' }, 'ai.providers.manage'), false);
});

test('requireCapability denies a direct API call with a typed server error', () => {
  const middleware = requireCapability('ai.credentials.rotate');
  let error = null;
  middleware({ user: { role: 'support_admin' } }, {}, (value) => { error = value || null; });
  assert.equal(error?.status, 403);
  assert.equal(error?.code, 'ADMIN_CAPABILITY_REQUIRED');
  assert.equal(error?.message, 'Akses tidak tersedia untuk tugas admin ini.');

  error = Symbol('not-called');
  middleware({ user: { role: 'ai_admin' } }, {}, (value) => { error = value || null; });
  assert.equal(error, null);
});

test('unknown capabilities cannot be attached to a route accidentally', () => {
  assert.throws(() => requireCapability('ai.keys.reveal'), /Unknown admin capability/);
});
