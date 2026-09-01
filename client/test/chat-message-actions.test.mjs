import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevisionRequest,
  getEditableMessage,
  getRegenerationTarget,
} from '../src/lib/chat-message-actions.js';

test('buildRevisionRequest creates an edit request with trimmed content', () => {
  assert.deepEqual(
    buildRevisionRequest({
      sessionId: 's1',
      messageId: 'm2',
      mode: 'edit',
      content: '  Revisi  ',
    }),
    {
      path: '/chat/sessions/s1/messages/m2/revise',
      body: { mode: 'edit', content: 'Revisi' },
    },
  );
});

test('buildRevisionRequest creates a regenerate request without content', () => {
  assert.deepEqual(
    buildRevisionRequest({
      sessionId: 's1',
      messageId: 'm3',
      mode: 'regenerate',
    }),
    {
      path: '/chat/sessions/s1/messages/m3/revise',
      body: { mode: 'regenerate' },
    },
  );
});

test('getEditableMessage returns only an owned user message', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Pertanyaan' },
    { id: 'a1', role: 'assistant', content: 'Jawaban' },
  ];
  assert.deepEqual(getEditableMessage(messages, 'u1'), messages[0]);
  assert.equal(getEditableMessage(messages, 'a1'), null);
  assert.equal(getEditableMessage(messages, 'missing'), null);
});

test('getRegenerationTarget selects the preceding user message', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Pertanyaan' },
    { id: 'a1', role: 'assistant', content: 'Jawaban' },
  ];
  assert.deepEqual(getRegenerationTarget(messages, 'a1'), messages[0]);
  assert.equal(getRegenerationTarget(messages, 'u1'), null);
});
