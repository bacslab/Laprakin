import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { createAiConfigurationRepository } from '../src/ai-configuration-repository.js';
import { createAiConfigurationService } from '../src/ai-configuration-service.js';

function database() {
  const store = new DatabaseSync(':memory:');
  store.exec('PRAGMA foreign_keys=ON');
  return store;
}

const auth = Object.freeze({
  actorUserId: 'owner-1',
  capabilities: ['ai.providers.view', 'ai.providers.manage', 'ai.credentials.rotate', 'ai.models.manage', 'ai.routing.manage', 'ai.health.view'],
  recentMfa: true,
});

function input(label = 'one', providerId = 'nararouter') {
  return {
    reason: `Configure ${label}`,
    providers: [{
      providerId,
      displayName: providerId === 'nararouter' ? 'NaraRouter' : 'Cloudflare AI',
      adapterType: 'openai-compatible',
      baseUrl: providerId === 'nararouter' ? 'https://router.bynara.id/v1' : 'https://api.cloudflare.com/client/v4/accounts/a/ai/v1',
      enabled: true,
      priority: 1,
      secretReference: `secret-${providerId}-${label}`,
      secretVersion: '1',
      credentialFingerprint: `fingerprint-${label}`,
      credentialLastFour: 'ABCD',
    }],
    models: [{
      providerId,
      modelId: `model-${label}`,
      source: 'discovered',
      enabled: true,
      state: 'available',
      capabilities: { text: true, vision: false, structuredOutput: true },
      capabilityEvidence: { text: 'provider', vision: 'provider', structuredOutput: 'provider' },
      contextWindow: 128_000,
      maxOutputTokens: 8_000,
      health: 'available',
    }],
    routes: [{
      routeId: 'chat.basic',
      enabled: true,
      primaryProviderId: providerId,
      primaryModelId: `model-${label}`,
      fallbacks: [],
      timeoutMs: 30_000,
      retryCount: 1,
      outputTokenLimit: 2_000,
      reasoningEffort: 'low',
      requiresStructuredOutput: false,
      requiresVision: false,
      costClass: 'standard',
      plans: ['free', 'pro'],
    }],
  };
}

function harness({ start = '2026-09-03T02:00:00.000Z', failCanary = false, production = false, secondApproval } = {}) {
  const store = database();
  let clock = new Date(start).getTime();
  let shouldFailCanary = failCanary;
  const now = () => new Date(clock).toISOString();
  const repository = createAiConfigurationRepository({ store, now });
  const calls = [];
  const adapter = {
    async testConnection(options) { calls.push({ method: 'testConnection', options }); return { ok: true, modelCount: 1 }; },
    async discoverModels() {
      calls.push({ method: 'discoverModels' });
      return [{
        providerId: 'nararouter', modelId: 'discovered-model', source: 'discovered', enabled: true, state: 'available',
        capabilities: { vision: false, structuredOutput: true },
        capabilityEvidence: { vision: 'provider', structuredOutput: 'provider' }, health: 'available',
      }];
    },
    async runCanary(options) {
      calls.push({ method: 'runCanary', options });
      if (shouldFailCanary) throw Object.assign(new Error('private upstream body'), { code: 'AI_CANARY_FAILED' });
      return { ok: true, usage: { total_tokens: 2 } };
    },
  };
  const audit = [];
  const service = createAiConfigurationService({
    repository,
    now,
    production,
    adapterForProvider: async () => adapter,
    secretStore: {
      async put({ providerId }) {
        return { reference: `rotated-${providerId}`, secretVersion: 2, fingerprint: 'new-fingerprint', lastFour: 'WXYZ' };
      },
    },
    recordAudit: (...entry) => audit.push(entry),
    secondApproval,
  });
  return {
    store, repository, service, calls, audit,
    advance(milliseconds) { clock += milliseconds; },
    setFailCanary(value) { shouldFailCanary = Boolean(value); },
  };
}

async function testAndActivate(service, draft, activationReason = 'Approved rollout') {
  await service.testDraft({ revisionId: draft.id, auth });
  return service.activateRevision({ revisionId: draft.id, reason: activationReason, auth });
}

test('drafts do not affect runtime; captures remain stable while activation and restart see the new revision', async () => {
  const h = harness();
  try {
    const first = h.service.createDraft({ ...input('one'), auth });
    assert.equal(h.service.captureActiveConfiguration(), null);
    await testAndActivate(h.service, first);
    const inFlight = h.service.captureActiveConfiguration();
    assert.equal(inFlight.revision.id, first.id);
    assert.equal(inFlight.processorManifest.configurationRevisionId, first.id);
    assert.deepEqual(inFlight.processorManifest.providers.map((provider) => provider.id), ['nararouter']);
    assert.equal(Object.isFrozen(inFlight.revision), true);

    const second = h.service.createDraft({ ...input('two'), parentRevisionId: first.id, auth });
    assert.equal(h.service.captureActiveConfiguration().revision.id, first.id);
    await testAndActivate(h.service, second);
    assert.equal(inFlight.revision.id, first.id);
    assert.equal(h.service.captureActiveConfiguration().revision.id, second.id);
    assert.equal(h.repository.getActiveRevision().activatedByUserId, auth.actorUserId);
    assert.equal(h.repository.getActiveRevision().activationReason, 'Approved rollout');
    assert.deepEqual(h.audit.find((entry) => entry[1] === 'admin.ai_configuration_activated' && entry[3] === second.id)[4].routeDiff.changed, ['chat.basic']);

    const restarted = createAiConfigurationService({ repository: createAiConfigurationRepository({ store: h.store }), now: () => '2026-09-03T02:01:00.000Z' });
    assert.equal(restarted.captureActiveConfiguration().revision.id, second.id);
  } finally { h.store.close(); }
});

test('draft tests use only synthetic Laprakin-owned cases and bind expiring evidence plus route diff to the revision', async () => {
  const h = harness();
  try {
    const draft = h.service.createDraft({ ...input('synthetic'), auth });
    const tested = await h.service.testDraft({ revisionId: draft.id, auth });
    assert.equal(tested.state, 'tested');
    assert.equal(tested.testEvidence.revisionId, draft.id);
    assert.equal(tested.testEvidence.syntheticOnly, true);
    assert.deepEqual(tested.testEvidence.routeDiff.added, ['chat.basic']);
    assert.equal(new Date(tested.testEvidence.expiresAt) - new Date(tested.testEvidence.issuedAt), 10 * 60 * 1000);
    const canary = h.calls.find((call) => call.method === 'runCanary');
    assert.equal(canary.options.testCase.owner, 'laprakin');
    assert.match(canary.options.testCase.prompt, /^LAPRAKIN_SYNTHETIC_CANARY:/);
    assert.doesNotMatch(JSON.stringify(h.calls), /student|user upload|private upstream body/i);

    h.advance(10 * 60 * 1000 + 1);
    assert.throws(
      () => h.service.previewActivation({ revisionId: draft.id, auth }),
      (error) => error.code === 'AI_CONFIGURATION_TEST_EVIDENCE_EXPIRED',
    );
    await assert.rejects(
      () => h.service.activateRevision({ revisionId: draft.id, reason: 'Too late', auth }),
      (error) => error.code === 'AI_CONFIGURATION_TEST_EVIDENCE_EXPIRED',
    );
  } finally { h.store.close(); }
});

test('a failed draft test cannot move active or last-known-good pointers', async () => {
  const h = harness();
  try {
    const first = h.service.createDraft({ ...input('one'), auth });
    await testAndActivate(h.service, first);
    const second = h.service.createDraft({ ...input('two'), auth });
    await testAndActivate(h.service, second);
    const before = h.repository.getPointers();

    const failing = harness();
    try {
      const prior = failing.service.createDraft({ ...input('prior'), auth });
      await testAndActivate(failing.service, prior);
      const bad = failing.service.createDraft({ ...input('bad'), auth });
      failing.setFailCanary(true);
      const failingBefore = failing.repository.getPointers();
      await assert.rejects(() => failing.service.testDraft({ revisionId: bad.id, auth }), (error) => error.code === 'AI_CONFIGURATION_TEST_FAILED');
      assert.deepEqual(failing.repository.getPointers(), failingBefore);
      assert.equal(failing.repository.getRevision(bad.id).state, 'draft');
    } finally { failing.store.close(); }

    assert.deepEqual(h.repository.getPointers(), before);
  } finally { h.store.close(); }
});

test('rollback atomically restores last-known-good and credential replacement creates a child draft without plaintext', async () => {
  const h = harness();
  try {
    const first = h.service.createDraft({ ...input('one'), auth });
    await testAndActivate(h.service, first);
    const second = h.service.createDraft({ ...input('two'), auth });
    await testAndActivate(h.service, second);
    assert.equal(h.repository.getPointers().lastKnownGoodRevisionId, first.id);

    const rolledBack = h.service.rollbackRevision({ reason: 'Canary regression', auth });
    assert.equal(rolledBack.id, first.id);
    assert.equal(h.repository.getPointers().activeRevisionId, first.id);
    assert.equal(h.repository.getPointers().lastKnownGoodRevisionId, first.id);
    const stablePointers = h.repository.getPointers();
    assert.throws(
      () => h.service.rollbackRevision({ reason: 'No further rollback target', auth }),
      (error) => error.code === 'AI_CONFIGURATION_ROLLBACK_UNAVAILABLE',
    );
    assert.deepEqual(h.repository.getPointers(), stablePointers);

    const replacement = await h.service.replaceCredential({ revisionId: first.id, providerId: 'nararouter', credential: 'plaintext-never-returned', reason: 'Rotate key', auth });
    assert.equal(replacement.parentRevisionId, first.id);
    assert.equal(replacement.providers[0].secretReference, 'rotated-nararouter');
    assert.equal(replacement.providers[0].credentialLastFour, 'WXYZ');
    assert.equal(JSON.stringify(replacement).includes('plaintext-never-returned'), false);
    assert.equal(h.repository.getRevision(first.id).providers[0].secretReference, 'secret-nararouter-one');
    assert.equal(JSON.stringify(h.audit).includes('plaintext-never-returned'), false);
  } finally { h.store.close(); }
});

test('model discovery creates an immutable child catalog and standalone canaries use the same synthetic contract', async () => {
  const h = harness();
  try {
    const source = h.service.createDraft({ ...input('catalog'), auth });
    const refreshed = await h.service.discoverDraftModels({ revisionId: source.id, providerId: 'nararouter', auth });
    assert.equal(refreshed.parentRevisionId, source.id);
    assert.equal(refreshed.models.find((model) => model.modelId === 'discovered-model').source, 'discovered');
    assert.equal(refreshed.models.find((model) => model.modelId === 'model-catalog').health, 'unavailable');
    assert.equal(h.repository.getRevision(source.id).models.length, 1);
    const results = await h.service.runDraftCanaries({ revisionId: refreshed.id, auth });
    assert.equal(results.providers[0].ok, true);
    assert.equal(results.routes[0].modelId, 'model-catalog');
    assert.match(h.calls.findLast((call) => call.method === 'runCanary').options.testCase.prompt, /^LAPRAKIN_SYNTHETIC_CANARY:/);
  } finally { h.store.close(); }
});

test('production provider replacement requires recent MFA, capability, and an independent approval hook', async () => {
  const approvals = [];
  const h = harness({ production: true, secondApproval: async (request) => { approvals.push(request); return request.approverUserId === 'owner-2'; } });
  try {
    const first = h.service.createDraft({ ...input('one'), auth });
    await testAndActivate(h.service, first);
    const replacement = h.service.createDraft({ ...input('replacement', 'cloudflare'), auth });
    await h.service.testDraft({ revisionId: replacement.id, auth });

    await assert.rejects(
      () => h.service.activateRevision({ revisionId: replacement.id, reason: 'Replace processor', auth, approval: { approverUserId: 'owner-1' } }),
      (error) => error.code === 'AI_CONFIGURATION_SECOND_APPROVAL_REQUIRED',
    );
    const activated = await h.service.activateRevision({ revisionId: replacement.id, reason: 'Replace processor', auth, approval: { approverUserId: 'owner-2' } });
    assert.equal(activated.id, replacement.id);
    assert.equal(approvals.length, 1);

    assert.throws(
      () => h.service.createDraft({ ...input('denied'), auth: { ...auth, capabilities: [] } }),
      (error) => error.code === 'AI_CONFIGURATION_CAPABILITY_REQUIRED',
    );
    assert.throws(
      () => h.service.rollbackRevision({ reason: 'No MFA', auth: { ...auth, recentMfa: false } }),
      (error) => error.code === 'AI_CONFIGURATION_MFA_REQUIRED',
    );
  } finally { h.store.close(); }
});
