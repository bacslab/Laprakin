import assert from 'node:assert/strict';
import test from 'node:test';

import { streamOpenAiCompatible } from '../src/ai.js';

test('streamOpenAiCompatible relays provider deltas and returns the complete message', async () => {
  let requestBody;
  const response = new Response(ReadableStream.from([
    'data: {"choices":[{"delta":{"content":"{\\"message\\":\\"La"}}] }\n\n',
    'data: {"choices":[{"delta":{"content":"por\\\"}"}}],"usage":{"total_tokens":3}}\n\n',
    'data: [DONE]\n\n',
  ]), { headers: { 'content-type': 'text/event-stream' } });

  const events = [];
  for await (const event of streamOpenAiCompatible({
    provider: 'nararouter',
    model: 'test-model',
    messages: [{ role: 'user', content: 'halo' }],
    maxOutputTokens: 100,
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response;
    },
  })) events.push(event);

  assert.equal(requestBody.stream, true);
  assert.deepEqual(events, [
    { type: 'delta', text: '{"message":"La' },
    { type: 'delta', text: 'por"}' },
    { type: 'done', message: '{"message":"Lapor"}', usage: { total_tokens: 3 } },
  ]);
});

