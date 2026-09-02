import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyRequestFailure,
  composeRequestSignal,
  loadDraftRequest,
  parseOriginalResponse,
  rememberDraftRequest,
  clearDraftRequest,
} from '../src/lib/request-lifecycle.js';

function storageDouble() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('parseOriginalResponse reads parseable JSON even when a proxy changes its content type', async () => {
  const response = new Response('{"state":"completed"}', {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
  assert.deepEqual(await parseOriginalResponse(response), { state: 'completed' });
  assert.equal(response.bodyUsed, true);
});

test('composeRequestSignal preserves caller cancellation distinctly from timeout', async () => {
  const caller = new AbortController();
  const composed = composeRequestSignal({ signal: caller.signal, timeoutMs: 1000 });
  caller.abort(new DOMException('User canceled', 'AbortError'));
  assert.equal(composed.signal.aborted, true);
  assert.equal(classifyRequestFailure(composed.signal.reason), 'REQUEST_CANCELED');
  composed.cleanup();

  const timed = composeRequestSignal({ timeoutMs: 5 });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(timed.signal.aborted, true);
  assert.equal(classifyRequestFailure(timed.signal.reason), 'REQUEST_TIMEOUT');
  timed.cleanup();
});

test('draft request identity survives a retry and clears only after acknowledgement', () => {
  const storage = storageDouble();
  const draft = { sessionId: 'session-1', content: 'Satu aksi', aiMode: 'basic', requestId: 'chat-request-1234' };
  rememberDraftRequest(draft, storage);
  assert.deepEqual(loadDraftRequest(draft, storage), draft);
  assert.equal(loadDraftRequest({ ...draft, content: 'Input berubah' }, storage), null);
  clearDraftRequest(draft.sessionId, draft.requestId, storage);
  assert.equal(loadDraftRequest(draft, storage), null);
});
