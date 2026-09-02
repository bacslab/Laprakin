import assert from 'node:assert/strict';
import test from 'node:test';

import { guardedProviderRequest, guardedProviderStream } from '../src/guarded-provider-client.js';

const policy = {
  isProd: true,
  allowedHosts: ['router.bynara.id'],
  allowedPorts: [443],
};

test('guarded provider request resolves once and pins the validated address', async () => {
  let lookupCalls = 0;
  const transports = [];
  const response = await guardedProviderRequest({
    url: 'https://router.bynara.id/v1/models',
    policy,
    lookup: async () => {
      lookupCalls += 1;
      return [{ address: '1.1.1.1', family: 4 }];
    },
    transport: async (options) => {
      transports.push(options);
      return { status: 200, headers: { 'content-type': 'application/json' }, body: [Buffer.from('{"data":[]}')] };
    },
  });
  assert.equal(lookupCalls, 1);
  assert.equal(transports[0].address, '1.1.1.1');
  assert.equal(transports[0].family, 4);
  assert.equal(transports[0].serverName, 'router.bynara.id');
  assert.deepEqual(await response.json(), { data: [] });
});

test('guarded provider request blocks redirects without following their target', async () => {
  let calls = 0;
  await assert.rejects(
    guardedProviderRequest({
      url: 'https://router.bynara.id/v1/models',
      policy,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      transport: async () => {
        calls += 1;
        return { status: 302, headers: { location: 'http://127.0.0.1/private' }, body: [] };
      },
    }),
    (error) => error.code === 'AI_EGRESS_REDIRECT_BLOCKED',
  );
  assert.equal(calls, 1);
});

test('guarded provider request caps response bytes and request bytes', async () => {
  await assert.rejects(
    guardedProviderRequest({
      url: 'https://router.bynara.id/v1/models',
      policy,
      maxBytes: 8,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      transport: async () => ({ status: 200, headers: {}, body: [Buffer.from('12345'), Buffer.from('67890')] }),
    }),
    (error) => error.code === 'AI_EGRESS_RESPONSE_TOO_LARGE',
  );
  await assert.rejects(
    guardedProviderRequest({
      url: 'https://router.bynara.id/v1/chat/completions',
      method: 'POST',
      body: '123456789',
      maxRequestBytes: 8,
      policy,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      transport: async () => ({ status: 200, headers: {}, body: [] }),
    }),
    (error) => error.code === 'AI_EGRESS_REQUEST_TOO_LARGE',
  );
});

test('guarded provider request applies a bounded operation timeout with safe errors', async () => {
  await assert.rejects(
    guardedProviderRequest({
      url: 'https://router.bynara.id/v1/models',
      policy,
      timeoutMs: 25,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      transport: async () => new Promise(() => {}),
    }),
    (error) => error.code === 'AI_EGRESS_TIMEOUT' && !/router|1\.1\.1\.1/.test(error.message),
  );
});

test('guarded provider timeout also bounds DNS resolution', async () => {
  await assert.rejects(
    guardedProviderRequest({
      url: 'https://router.bynara.id/v1/models',
      policy,
      timeoutMs: 25,
      lookup: async () => new Promise(() => {}),
      transport: async () => ({ status: 200, headers: {}, body: [] }),
    }),
    (error) => error.code === 'AI_EGRESS_TIMEOUT',
  );
});

test('guarded provider stream pins DNS and caps bytes while preserving progressive chunks', async () => {
  let transportOptions;
  const response = await guardedProviderStream({
    url: 'https://router.bynara.id/v1/chat/completions',
    method: 'POST',
    body: '{"stream":true}',
    policy,
    maxBytes: 12,
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    transport: async (options) => {
      transportOptions = options;
      return { status: 200, headers: { 'content-type': 'text/event-stream' }, body: [Buffer.from('one'), Buffer.from('two')] };
    },
  });
  const chunks = [];
  for await (const chunk of response.body) chunks.push(chunk.toString('utf8'));
  assert.deepEqual(chunks, ['one', 'two']);
  assert.equal(transportOptions.address, '1.1.1.1');
  assert.equal(response.headers['content-type'], 'text/event-stream');

  const oversized = await guardedProviderStream({
    url: 'https://router.bynara.id/v1/chat/completions',
    method: 'POST',
    policy,
    maxBytes: 5,
    lookup: async () => [{ address: '1.1.1.1', family: 4 }],
    transport: async () => ({ status: 200, headers: {}, body: [Buffer.from('123'), Buffer.from('456')] }),
  });
  await assert.rejects(async () => {
    for await (const _chunk of oversized.body) { /* consume */ }
  }, (error) => error.code === 'AI_EGRESS_RESPONSE_TOO_LARGE');
});

test('guarded provider errors never return raw response headers or bodies', async () => {
  const privateBody = 'upstream-secret-body';
  await assert.rejects(
    guardedProviderRequest({
      url: 'https://router.bynara.id/v1/models',
      policy,
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      transport: async () => ({
        status: 401,
        headers: { authorization: 'Bearer upstream-secret', 'set-cookie': 'session=secret' },
        body: [Buffer.from(privateBody)],
      }),
    }),
    (error) => error.code === 'AI_EGRESS_AUTH_FAILED'
      && !error.message.includes(privateBody)
      && !JSON.stringify(error).includes('upstream-secret'),
  );
});
