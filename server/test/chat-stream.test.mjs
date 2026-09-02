import assert from 'node:assert/strict';
import test from 'node:test';

import { createSseChannel, requestOpenAiCompatibleStream, writeSseResponse } from '../src/chat-stream.js';

test('requestOpenAiCompatibleStream emits deltas and done from an SSE provider', async () => {
  const response = new Response(ReadableStream.from([
    'data: {"choices":[{"delta":{"content":"La"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"por"}}]}\n\n',
    'data: [DONE]\n\n',
  ]), { headers: { 'content-type': 'text/event-stream' } });
  const events = [];
  for await (const event of requestOpenAiCompatibleStream({ url: 'https://provider.test/chat', token: 'secret', body: { model: 'test' }, fetchImpl: async () => response })) events.push(event);
  assert.deepEqual(events, [{ type: 'delta', text: 'La' }, { type: 'delta', text: 'por' }, { type: 'done' }]);
});

test('writeSseResponse emits one fallback delta and the canonical payload', () => {
  const chunks = [];
  const response = { setHeader: () => {}, flushHeaders: () => {}, write: (chunk) => chunks.push(chunk), end: () => {} };
  writeSseResponse(response, { messages: [{ content: 'Selesai' }] }, 'Selesai');
  assert.equal(chunks.length, 2);
  assert.match(chunks[0], /"type":"delta"/);
  assert.match(chunks[1], /"type":"done"/);
});

test('createSseChannel keeps the connection open for deltas and closes with one canonical payload', () => {
  const chunks = [];
  const headers = new Map();
  const response = {
    writableEnded: false,
    setHeader: (key, value) => headers.set(key, value),
    flushHeaders: () => {},
    write: (chunk) => chunks.push(chunk),
    end: () => { response.writableEnded = true; },
  };
  const channel = createSseChannel(response, { heartbeatMs: 100000 });
  channel.writeDelta('Sebagian');
  channel.finish({ messages: [{ content: 'Selesai' }] });
  assert.equal(headers.get('Content-Type'), 'text/event-stream; charset=utf-8');
  assert.equal(chunks.length, 2);
  assert.match(chunks[0], /Sebagian/);
  assert.match(chunks[1], /"type":"done"/);
  assert.equal(response.writableEnded, true);
  assert.equal(channel.signal.aborted, false);
});
