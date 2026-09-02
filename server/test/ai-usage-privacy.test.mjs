import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'laprakin-ai-usage-'));
process.env.LAPRAKIN_DATA_DIR = sandbox;
process.env.LAPRAKIN_UPLOAD_DIR = path.join(sandbox, 'uploads');
process.env.LAPRAKIN_PUBLIC_MEDIA_DIR = path.join(sandbox, 'public-media');
process.env.NARAROUTER_API_KEY = 'bootstrap-present-for-test';

const { db } = await import('../src/db.js');
const { config } = await import('../src/config.js');
const { generateAiContent } = await import('../src/ai.js');
config.aiMaxRetries = 1;
config.naraRouterMaxRpm = 600;

after(() => {
  db.close();
  fs.rmSync(sandbox, { recursive: true, force: true });
});

const runtimeSnapshot = Object.freeze({
  source: 'active',
  revisionId: 'revision-privacy-test',
  available: true,
  providers: [{ providerId: 'managed', enabled: true }],
  models: [{
    providerId: 'managed', modelId: 'managed-model', enabled: true, state: 'available', contextWindow: 64000,
    capabilities: { vision: false, structuredOutput: true }, capabilityEvidence: { vision: 'provider', structuredOutput: 'provider' },
  }],
  routes: [{
    routeId: 'chat.thinking', enabled: true, primaryProviderId: 'managed', primaryModelId: 'managed-model', fallbacks: [],
    reasoningEffort: 'low', outputTokenLimit: 1200, requiresVision: false, requiresStructuredOutput: false,
  }],
  processorManifest: { manifestVersion: 'test', policyVersion: 'test', providers: [{ id: 'managed', dataClasses: ['chat_content'] }] },
});

test('usage telemetry stores complete operational metadata without prompt or output content', async () => {
  const providerAdapters = { get: () => ({
    async complete() {
      return {
        choices: [{ message: { content: 'PRIVATE_MODEL_OUTPUT' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
      };
    },
  }) };
  const result = await generateAiContent({
    purpose: 'chat',
    mode: 'thinking',
    contents: [{ role: 'user', parts: [{ text: 'PRIVATE_USER_PROMPT' }] }],
    maxOutputTokens: 100,
    runtimeSnapshot,
    providerAdapters,
  });
  assert.equal(result.configurationRevision, runtimeSnapshot.revisionId);
  assert.equal(result.routeId, 'chat.thinking');
  const row = db.prepare('SELECT * FROM ai_usage_events ORDER BY created_at DESC LIMIT 1').get();
  assert.equal(row.provider, 'managed');
  assert.equal(row.model, 'managed-model');
  assert.equal(row.configuration_revision, runtimeSnapshot.revisionId);
  assert.equal(row.route_id, 'chat.thinking');
  assert.equal(row.mode, 'thinking');
  assert.equal(row.total_tokens, 18);
  assert.equal(typeof row.queue_depth, 'number');
  assert.match(row.circuit_state, /^(?:closed|open|half_open)$/);
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE_USER_PROMPT|PRIVATE_MODEL_OUTPUT/);
});

test('an undisclosed fallback is never called and produces an explicit consent-aware degraded error', async () => {
  const calls = [];
  const providerAdapters = { get: (providerId) => ({
    async complete() {
      calls.push(providerId);
      throw Object.assign(new Error('safe failure'), { code: 'AI_TEST_PRIMARY_FAILED', retryable: false });
    },
  }) };
  const snapshot = {
    ...runtimeSnapshot,
    models: [
      ...runtimeSnapshot.models,
      { ...runtimeSnapshot.models[0], providerId: 'undisclosed', modelId: 'fallback-model' },
    ],
    routes: [{
      routeId: 'chat.basic', enabled: true, primaryProviderId: 'managed', primaryModelId: 'managed-model',
      fallbacks: [{ providerId: 'undisclosed', modelId: 'fallback-model' }], reasoningEffort: 'low', outputTokenLimit: 100,
    }],
  };
  await assert.rejects(
    () => generateAiContent({ purpose: 'chat', mode: 'basic', contents: [{ role: 'user', parts: [{ text: 'PRIVATE_FALLBACK_PROMPT' }] }], runtimeSnapshot: snapshot, providerAdapters }),
    (error) => error.code === 'AI_CONSENT_ROUTE_UNAVAILABLE',
  );
  assert.deepEqual(calls, ['managed']);
  const row = db.prepare('SELECT * FROM ai_usage_events ORDER BY rowid DESC LIMIT 1').get();
  assert.equal(row.error_code, 'AI_CONSENT_ROUTE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(row), /PRIVATE_FALLBACK_PROMPT/);
});

test('an image-bearing request uses the captured verified vision route', async () => {
  const calls = [];
  const providerAdapters = { get: (providerId) => ({
    async complete(options) {
      calls.push({ providerId, model: options.model });
      return { choices: [{ message: { content: 'Bukti visual terbaca.' }, finish_reason: 'stop' }], usage: {} };
    },
  }) };
  const visionSnapshot = {
    ...runtimeSnapshot,
    models: [{
      ...runtimeSnapshot.models[0], modelId: 'managed-vision',
      capabilities: { vision: true, structuredOutput: true },
      capabilityEvidence: { vision: 'provider', structuredOutput: 'provider' },
    }],
    routes: [{
      routeId: 'vision.evidence', enabled: true, primaryProviderId: 'managed', primaryModelId: 'managed-vision',
      fallbacks: [], reasoningEffort: 'low', outputTokenLimit: 100, requiresVision: true,
    }],
  };
  const result = await generateAiContent({
    purpose: 'document_evidence',
    mode: 'thinking',
    contents: [{ role: 'user', parts: [{ text: 'Periksa bukti.' }, { inlineData: { mimeType: 'image/png', data: 'AA==' } }] }],
    runtimeSnapshot: visionSnapshot,
    providerAdapters,
  });
  assert.equal(result.routeId, 'vision.evidence');
  assert.deepEqual(calls, [{ providerId: 'managed', model: 'managed-vision' }]);
});
