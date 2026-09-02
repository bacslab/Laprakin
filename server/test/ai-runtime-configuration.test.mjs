import assert from 'node:assert/strict';
import test from 'node:test';

import { createAiRuntimeResolver, resolveRuntimeRoute } from '../src/ai-runtime-configuration.js';

function activeRevision(id = 'active-1') {
  return {
    id,
    state: 'active',
    providers: [{ providerId: 'managed', displayName: 'Managed AI', adapterType: 'openai-compatible', baseUrl: 'https://ai.example.test/v1', enabled: true, secretReference: 'secret-ref', secretVersion: '1' }],
    models: [{ providerId: 'managed', modelId: 'managed-model', enabled: true, state: 'available', capabilities: { vision: false, structuredOutput: true }, capabilityEvidence: { vision: 'provider', structuredOutput: 'provider' }, contextWindow: 64000 }],
    routes: [{ routeId: 'chat.basic', enabled: true, primaryProviderId: 'managed', primaryModelId: 'managed-model', fallbacks: [], reasoningEffort: 'low', outputTokenLimit: 2000 }],
  };
}

test('runtime precedence is active revision, environment bootstrap, then explicit unavailable state', () => {
  let active = activeRevision();
  const revisions = new Map([[active.id, active]]);
  const resolver = createAiRuntimeResolver({
    repository: { getActiveRevision: () => active, getRevision: (id) => revisions.get(id) || null },
    environment: { naraRouterApiKey: 'env-key', naraRouterBaseUrl: 'https://router.bynara.id/v1', cloudflareAiEnabled: false },
    getEnvironmentModels: () => [{ model: 'env-model', provider: 'nararouter', supportsVision: false }],
    now: () => '2026-09-03T03:00:00.000Z',
  });
  const managed = resolver.capture();
  assert.equal(managed.source, 'active');
  assert.equal(managed.revisionId, active.id);
  assert.equal(managed.models[0].modelId, 'managed-model');
  assert.equal(Object.isFrozen(managed), true);

  active = null;
  const bootstrap = resolver.capture();
  assert.equal(bootstrap.source, 'environment');
  assert.equal(bootstrap.providers[0].providerId, 'nararouter');
  assert.equal(bootstrap.models[0].modelId, 'env-model');

  const disabled = createAiRuntimeResolver({
    repository: { getActiveRevision: () => null, getRevision: () => null },
    environment: { naraRouterApiKey: '' },
  }).capture();
  assert.equal(disabled.source, 'unavailable');
  assert.equal(disabled.available, false);
  assert.equal(disabled.degradedReason, 'AI_RUNTIME_NOT_CONFIGURED');
});

test('a requested immutable revision can be recaptured for a queued job after a later activation', () => {
  const starting = { ...activeRevision('start-revision'), state: 'superseded' };
  const later = activeRevision('later-revision');
  const revisions = new Map([[starting.id, starting], [later.id, later]]);
  const resolver = createAiRuntimeResolver({
    repository: { getActiveRevision: () => later, getRevision: (id) => revisions.get(id) || null },
    environment: {},
    now: () => '2026-09-03T03:10:00.000Z',
  });
  const jobSnapshot = resolver.capture({ revisionId: starting.id });
  assert.equal(jobSnapshot.revisionId, starting.id);
  assert.equal(jobSnapshot.source, 'revision');
  assert.equal(resolver.capture().revisionId, later.id);
});

test('route resolution uses immutable provider/model pairs and removes undisclosed fallbacks', () => {
  const snapshot = {
    ...createAiRuntimeResolver({
      repository: { getActiveRevision: () => ({
        ...activeRevision(),
        routes: [{
          routeId: 'chat.basic', enabled: true, primaryProviderId: 'managed', primaryModelId: 'managed-model',
          fallbacks: [{ providerId: 'undisclosed', modelId: 'other-model' }], reasoningEffort: 'low', outputTokenLimit: 2000,
        }],
      }), getRevision: () => null },
      environment: {},
    }).capture(),
    processorManifest: { providers: [{ id: 'managed' }] },
  };
  const route = resolveRuntimeRoute(snapshot, { purpose: 'chat', mode: 'basic' });
  assert.deepEqual(route.candidates, [{ providerId: 'managed', modelId: 'managed-model' }]);
  assert.equal(route.filteredUndisclosed, 1);
});
