import assert from 'node:assert/strict';
import test from 'node:test';

import { streamOpenAiCompatible } from '../src/ai.js';

test('streamOpenAiCompatible relays provider deltas and returns the complete message', async () => {
  let requestBody;
  const providerAdapters = { get: () => ({
    async *stream(options) {
      requestBody = { ...options, stream: true };
      yield { type: 'delta', text: '{"message":"La' };
      yield { type: 'delta', text: 'por"}' };
      yield { type: 'done', message: '{"message":"Lapor"}', usage: { total_tokens: 3 } };
    },
  }) };

  const events = [];
  for await (const event of streamOpenAiCompatible({
    provider: 'nararouter',
    model: 'test-model',
    messages: [{ role: 'user', content: 'halo' }],
    maxOutputTokens: 100,
    providerAdapters,
  })) events.push(event);

  assert.equal(requestBody.stream, true);
  assert.deepEqual(events, [
    { type: 'delta', text: '{"message":"La' },
    { type: 'delta', text: 'por"}' },
    { type: 'done', message: '{"message":"Lapor"}', usage: { total_tokens: 3 } },
  ]);
});

