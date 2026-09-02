import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSseEvents } from '../src/lib/read-sse-stream.js';

async function collect(iterator) {
  const result = [];
  for await (const event of iterator) result.push(event);
  return result;
}

test('parseSseEvents joins events split across network chunks', async () => {
  const readable = ReadableStream.from([
    'data: {"type":"delta","text":"La',
    'por"}\n\n',
    ': heartbeat\n\n',
    'data: {"type":"done"}\n\n',
  ]);
  assert.deepEqual(await collect(parseSseEvents(readable)), [
    { type: 'delta', text: 'Lapor' },
    { type: 'done' },
  ]);
});

test('parseSseEvents yields structured errors and ignores malformed frames', async () => {
  const readable = ReadableStream.from(['data: not-json\n\n', 'data: {"type":"error","code":"AI_TIMEOUT"}\n\n']);
  assert.deepEqual(await collect(parseSseEvents(readable)), [{ type: 'error', code: 'AI_TIMEOUT' }]);
});
