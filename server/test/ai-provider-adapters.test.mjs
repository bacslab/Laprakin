import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdapterRegistry } from '../src/ai-providers/adapter-registry.js';
import { createOpenAiCompatibleAdapter } from '../src/ai-providers/openai-compatible.js';
import { createCloudflareAiAdapter } from '../src/ai-providers/cloudflare-ai.js';

const providerPolicy = {
  isProd: true,
  allowedHosts: ['router.bynara.id', 'api.cloudflare.com'],
  allowedPorts: [443],
};

function jsonResponse(payload, contentType = 'application/json') {
  const bytes = Buffer.from(JSON.stringify(payload));
  return {
    status: 200,
    ok: true,
    headers: { 'content-type': contentType },
    bytes,
    body: [bytes],
    text: async () => bytes.toString('utf8'),
    json: async () => payload,
  };
}

test('adapter registry enforces the complete provider contract and unique IDs', () => {
  const complete = Object.fromEntries(['testConnection', 'discoverModels', 'runCanary', 'complete', 'stream', 'normalizeError'].map((name) => [name, () => {}]));
  const registry = createAdapterRegistry([{ id: 'nara', ...complete }]);
  assert.equal(registry.get('nara').id, 'nara');
  assert.deepEqual(registry.ids(), ['nara']);
  assert.throws(() => createAdapterRegistry([{ id: 'broken' }]), /contract/i);
  assert.throws(() => createAdapterRegistry([{ id: 'nara', ...complete }, { id: 'nara', ...complete }]), /duplicate/i);
  assert.throws(() => registry.get('missing'), /unknown/i);
});

test('OpenAI-compatible discovery records explicit capability evidence and leaves unknowns unverified', async () => {
  const calls = [];
  const adapter = createOpenAiCompatibleAdapter({
    id: 'nararouter',
    baseUrl: 'https://router.bynara.id/v1',
    getToken: async () => 'top-secret-key',
    policy: providerPolicy,
    request: async (options) => {
      calls.push(options);
      return jsonResponse({ data: [
        { id: 'explicit-model', context_length: 16000, supportsVision: true, supportsStructuredOutput: false },
        { id: 'vision-by-name-only' },
      ] });
    },
  });
  const models = await adapter.discoverModels();
  assert.equal(calls[0].url, 'https://router.bynara.id/v1/models');
  assert.equal(calls[0].headers.authorization, 'Bearer top-secret-key');
  assert.deepEqual(models[0].capabilities, { vision: true, reasoning: null, structuredOutput: false, tools: null });
  assert.deepEqual(models[0].capabilityEvidence, {
    vision: 'provider', reasoning: 'unverified', structuredOutput: 'provider', tools: 'unverified',
  });
  assert.equal(models[1].capabilities.vision, null);
  assert.equal(models[1].capabilityEvidence.vision, 'unverified');
});

test('OpenAI-compatible adapter shapes completion, structured output, canary, and safe errors', async () => {
  const calls = [];
  const adapter = createOpenAiCompatibleAdapter({
    id: 'nararouter',
    baseUrl: 'https://router.bynara.id/v1',
    getToken: () => 'provider-secret',
    policy: providerPolicy,
    request: async (options) => {
      calls.push(options);
      return jsonResponse({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }], usage: { total_tokens: 2 } });
    },
  });
  const payload = await adapter.complete({
    model: 'm1', messages: [{ role: 'user', content: 'ping' }], maxOutputTokens: 20,
    reasoningEffort: 'low', responseJsonSchema: { type: 'object' }, supportsStructuredOutput: true,
  });
  const body = JSON.parse(calls[0].body);
  assert.equal(body.max_tokens, 20);
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(payload.choices[0].message.content, '{"ok":true}');
  assert.equal((await adapter.runCanary({ model: 'm1' })).ok, true);

  const safe = adapter.normalizeError(new Error('Bearer provider-secret private-body'));
  assert.equal(safe.code, 'AI_PROVIDER_NETWORK_FAILED');
  assert.doesNotMatch(`${safe.message} ${JSON.stringify(safe)}`, /provider-secret|private-body/);
});

test('OpenAI-compatible adapter streams deltas and completion metadata through the guarded stream', async () => {
  let requestOptions;
  const controller = new AbortController();
  const adapter = createOpenAiCompatibleAdapter({
    id: 'nararouter',
    baseUrl: 'https://router.bynara.id/v1',
    getToken: () => 'stream-secret',
    policy: providerPolicy,
    streamRequest: async (options) => {
      requestOptions = options;
      return {
        status: 200,
        ok: true,
        headers: { 'content-type': 'text/event-stream' },
        body: ReadableStream.from([
          'data: {"choices":[{"delta":{"content":"La"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"por"},"finish_reason":"stop"}],"usage":{"total_tokens":3}}\n\n',
          'data: [DONE]\n\n',
        ]),
      };
    },
  });
  const events = [];
  for await (const event of adapter.stream({ model: 'm1', messages: [], maxOutputTokens: 30, signal: controller.signal })) events.push(event);
  assert.equal(JSON.parse(requestOptions.body).stream, true);
  assert.equal(requestOptions.signal, controller.signal);
  assert.deepEqual(events, [
    { type: 'delta', text: 'La' },
    { type: 'delta', text: 'por' },
    { type: 'done', message: 'Lapor', usage: { total_tokens: 3 }, finishReason: 'stop' },
  ]);
});

test('Cloudflare adapter uses the account-scoped OpenAI-compatible endpoint without model discovery claims', async () => {
  const calls = [];
  const adapter = createCloudflareAiAdapter({
    accountId: 'acct-123',
    getToken: () => 'cf-secret',
    configuredModel: '@cf/test/model',
    policy: providerPolicy,
    request: async (options) => { calls.push(options); return jsonResponse({ choices: [{ message: { content: 'ok' } }] }); },
  });
  const models = await adapter.discoverModels();
  assert.equal(models[0].modelId, '@cf/test/model');
  assert.equal(models[0].source, 'configured');
  assert.equal(models[0].capabilityEvidence.vision, 'unverified');
  await adapter.complete({ model: '@cf/test/model', messages: [], maxOutputTokens: 10 });
  assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/acct-123/ai/v1/chat/completions');
});
