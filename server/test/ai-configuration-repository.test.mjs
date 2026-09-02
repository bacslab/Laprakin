import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { createAiConfigurationRepository } from '../src/ai-configuration-repository.js';

function database() {
  const store = new DatabaseSync(':memory:');
  store.exec('PRAGMA foreign_keys=ON');
  return store;
}

function validInput(label = 'v1') {
  return {
    actorUserId: 'admin-1',
    reason: `Configure ${label}`,
    providers: [{
      providerId: 'nararouter',
      displayName: 'NaraRouter',
      adapterType: 'openai-compatible',
      baseUrl: 'https://router.bynara.id/v1',
      enabled: true,
      priority: 1,
      requestTimeoutMs: 45_000,
      rpmLimit: 8,
      concurrencyLimit: 2,
      retryCount: 2,
      circuitFailureThreshold: 4,
      circuitCooldownMs: 30_000,
      secretReference: 'secret-ref-1',
      secretVersion: '1',
      credentialFingerprint: '0123456789abcdef',
      credentialLastFour: 'ABCD',
    }],
    models: [{
      providerId: 'nararouter',
      modelId: 'mistral-medium-test',
      source: 'discovered',
      enabled: true,
      state: 'enabled',
      capabilities: { text: true, vision: false, reasoning: true, structuredOutput: true, tools: false },
      capabilityEvidence: { text: 'provider', reasoning: 'provider', structuredOutput: 'verified' },
      contextWindow: 128_000,
      maxOutputTokens: 16_384,
      health: 'available',
    }],
    routes: [{
      routeId: 'chat.basic',
      enabled: true,
      primaryProviderId: 'nararouter',
      primaryModelId: 'mistral-medium-test',
      fallbacks: [],
      timeoutMs: 30_000,
      retryCount: 1,
      outputTokenLimit: 2_000,
      reasoningEffort: 'low',
      requiresStructuredOutput: false,
      requiresVision: false,
      costClass: 'standard',
      plans: ['free', 'single', 'monthly', 'pro'],
    }],
  };
}

test('configuration drafts persist secret references only and immutable child rows', () => {
  const store = database();
  try {
    const repository = createAiConfigurationRepository({ store });
    const draft = repository.createDraft(validInput());
    assert.equal(draft.state, 'draft');
    assert.equal(draft.revisionNumber, 1);
    assert.equal(draft.providers[0].secretReference, 'secret-ref-1');
    assert.equal(JSON.stringify(draft).includes('provider-api-key-plaintext'), false);
    assert.throws(
      () => store.prepare("UPDATE ai_provider_revisions SET display_name = 'Changed' WHERE configuration_revision_id = ?").run(draft.id),
      /immutable/i,
    );
    assert.throws(
      () => store.prepare('DELETE FROM ai_route_assignments WHERE configuration_revision_id = ?').run(draft.id),
      /immutable/i,
    );
  } finally {
    store.close();
  }
});

test('model catalogs are isolated per provider even when model IDs match', () => {
  const store = database();
  try {
    const repository = createAiConfigurationRepository({ store });
    const input = validInput();
    input.providers.push({ ...input.providers[0], providerId: 'cloudflare-ai', displayName: 'Cloudflare AI', secretReference: 'secret-ref-2' });
    input.models.push({ ...input.models[0], providerId: 'cloudflare-ai' });
    const draft = repository.createDraft(input);
    assert.equal(draft.models.length, 2);
    assert.deepEqual(draft.models.map((model) => model.providerId), ['cloudflare-ai', 'nararouter']);
  } finally {
    store.close();
  }
});

test('activation atomically advances active and last-known-good pointers', () => {
  const store = database();
  try {
    const repository = createAiConfigurationRepository({ store, now: () => '2026-09-03T02:00:00.000Z' });
    const first = repository.createDraft(validInput('first'));
    const firstTested = repository.markTested({ revisionId: first.id, actorUserId: 'admin-1', evidence: { connection: 'passed', canary: 'passed' } });
    assert.equal(firstTested.providers[0].state, 'tested');
    repository.activate({ revisionId: first.id, actorUserId: 'admin-1', reason: 'Initial activation' });
    assert.deepEqual(repository.getPointers(), { activeRevisionId: first.id, lastKnownGoodRevisionId: null, updatedAt: '2026-09-03T02:00:00.000Z' });

    const second = repository.createDraft(validInput('second'));
    repository.markTested({ revisionId: second.id, actorUserId: 'admin-2', evidence: { connection: 'passed', canary: 'passed' } });
    repository.activate({ revisionId: second.id, actorUserId: 'admin-2', reason: 'Route update' });
    assert.deepEqual(repository.getPointers(), { activeRevisionId: second.id, lastKnownGoodRevisionId: first.id, updatedAt: '2026-09-03T02:00:00.000Z' });
    assert.equal(repository.getActiveRevision().id, second.id);
    assert.equal(repository.getActiveRevision().providers[0].state, 'active');
    assert.equal(repository.getRevision(first.id).state, 'superseded');
    assert.equal(repository.getRevision(first.id).providers[0].state, 'tested');
  } finally {
    store.close();
  }
});

test('untested activation fails without changing the live pointer', () => {
  const store = database();
  try {
    const repository = createAiConfigurationRepository({ store });
    const tested = repository.createDraft(validInput('tested'));
    repository.markTested({ revisionId: tested.id, actorUserId: 'admin-1', evidence: { connection: 'passed' } });
    repository.activate({ revisionId: tested.id, actorUserId: 'admin-1', reason: 'Working revision' });
    const draft = repository.createDraft(validInput('untested'));
    assert.throws(() => repository.activate({ revisionId: draft.id, actorUserId: 'admin-1', reason: 'Unsafe activation' }), (error) => error.code === 'AI_CONFIGURATION_NOT_TESTED');
    assert.equal(repository.getPointers().activeRevisionId, tested.id);
  } finally {
    store.close();
  }
});
